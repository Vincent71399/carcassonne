import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Board } from './components/Board';
import { Hand } from './components/Hand';
import { DeckViewer } from './components/DeckViewer';
import { createInitialState, placeTile, discardTile, placeMeeple, skipMeeple, finishScoring, advanceTurn } from './engine/state';
import { calculateBestAIMove } from './engine/ai';
import { PLAYER_COLORS, UI_COLORS } from './utils/styles';
import { DEBUG_MODE, AI_EXPERIMENT_MODE } from './utils/debug';
import { getValidPlacements } from './engine/board';
import { BASE_TILES } from './engine/tiles';
import { TileRenderer } from './components/TileRenderer';
import { computeFieldConquest } from './engine/fieldConquest';
import { FieldSandbox } from './components/FieldSandbox';
import { StartScreen } from './components/StartScreen';
import { getOccupiedFeaturesOnTile } from './engine/features';
import { GameEndPage } from './components/GameEndPage';
import { TileGallery } from './components/TileGallery';
import type { GameState, PlayerId, PlayerType } from './engine/types';

interface VendorDocument extends Document {
  mozCancelFullScreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface VendorElement extends HTMLElement {
  mozRequestFullScreen?: () => Promise<void>;
  webkitRequestFullScreen?: () => Promise<void>;
  msRequestFullScreen?: () => Promise<void>;
}
import scoreCity from './assets/score_city.mp3';
import scoreField from './assets/score_field.mp3';
import scoreRoad from './assets/score_road.mp3';
import scoreMonastery from './assets/score_monastery.mp3';

// Set to true to show gallery mode for reviewing all tile hotspots
const GALLERY_MODE = false;

// CSS for scoring animation
const SCORING_CSS = `
@keyframes scoreFloatUp {
    0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
    15% { transform: translate(-50%, -40px) scale(1.1); opacity: 1; }
    85% { transform: translate(-50%, -70px) scale(1); opacity: 1; }
    100% { transform: translate(-50%, -90px) scale(0.8); opacity: 0; }
}

@keyframes bannerFadeIn {
    from { opacity: 0; transform: translate(-50%, -20px); }
    to { opacity: 1; transform: translate(-50%, 0); }
}

  @keyframes bannerPulse {
    0%, 100% { transform: translate(-50%, 0) scale(1); }
    50% { transform: translate(-50%, 0) scale(1.02); }
  }
  
  .thinking-banner {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      padding: 12px 24px;
      border-radius: 50px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1.5px solid var(--player-color-faint, rgba(25, 118, 210, 0.3));
      animation: bannerFadeIn 0.4s ease-out forwards, bannerPulse 2s infinite ease-in-out;
      pointer-events: none;
      transition: all 0.3s ease;
  }
  
  .thinking-banner-text {
      color: var(--player-color, #1976d2);
      font-weight: 600;
      font-size: 16px;
      font-family: sans-serif;
      letter-spacing: 0.5px;
      white-space: nowrap;
  }
  
  .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid var(--player-color-faint, rgba(25, 118, 210, 0.1));
      border-top: 2px solid var(--player-color, #1976d2);
      border-radius: 50%;
      animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
      to { transform: rotate(360deg); }
  }

  @media (max-width: 600px) {
      .thinking-banner {
          top: 15px;
          padding: 8px 16px;
          gap: 8px;
      }
      .thinking-banner-text {
          font-size: 14px;
      }
      .spinner {
          width: 14px;
          height: 14px;
      }
  }
`;

const AUDIO_MAP = {
  city: scoreCity,
  field: scoreField,
  road: scoreRoad,
  monastery: scoreMonastery,
};

// Singleton audio instances to avoid hitting iOS object limits
const audioPool: Record<string, HTMLAudioElement> = {};
const getAudio = (category: string) => {
  const soundFile = AUDIO_MAP[category as keyof typeof AUDIO_MAP];
  if (!soundFile) return null;
  if (!audioPool[category]) {
    audioPool[category] = new Audio(soundFile);
  }
  return audioPool[category];
};

import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedHandIndex, setSelectedHandIndex] = useState(-1);
  const [rotation, setRotation] = useState(0);
  const [prePlacementState, setPrePlacementState] = useState<GameState | null>(null);

  // Layout states for mobile/iPad
  const [isIPad, setIsIPad] = useState(typeof window !== 'undefined' ? (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0) : false);
  const [isIPhone, setIsIPhone] = useState(typeof window !== 'undefined' ? /iPhone/i.test(navigator.userAgent) : false);
  const useRetractableUI = isMobile || isIPad || isIPhone;
  const isScoreboardRetractable = isMobile || isIPhone;
  const [isScoreboardExpanded, setIsScoreboardExpanded] = useState(!isScoreboardRetractable);
  const [isHandExpanded, setIsHandExpanded] = useState(true);

  // Board position and zoom (moved from Board.tsx)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // We need to remember what the AI decided to do with its meeple when it calculated the tile placement
  const [pendingAIMove, setPendingAIMove] = useState<{ meeplePlacement?: { featureId: string } } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiFocusTarget, setAiFocusTarget] = useState<{ x: number, y: number } | null>(null);

  const [showDeckViewer, setShowDeckViewer] = useState(false);
  const [showFieldView, setShowFieldView] = useState(false);
  const [showBoardPostGame, setShowBoardPostGame] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 1200, height: typeof window !== 'undefined' ? window.innerHeight : 800 });
  const validPlacements = useMemo(() => {
    if (gameState && selectedHandIndex !== -1) {
      const currentPId = gameState.players[gameState.currentPlayerIndex];
      const tileDef = gameState.hands[currentPId][selectedHandIndex];
      if (tileDef) {
        return getValidPlacements(gameState.board, tileDef, rotation);
      }
    }
    return [];
  }, [gameState, selectedHandIndex, rotation]);

  const lastStateRef = useRef({ gameState, zoom, windowSize });
  useEffect(() => {
    lastStateRef.current = { gameState, zoom, windowSize };
  }, [gameState, zoom, windowSize]);

  const clampPan = (newPan: { x: number, y: number }) => {
    const { gameState: gState, zoom: curZoom, windowSize: wSize } = lastStateRef.current;
    if (!gState) return newPan;
    const tiles = Object.values(gState.board);
    if (tiles.length === 0) return newPan;

    const minX = Math.min(...tiles.map(t => t.x));
    const maxX = Math.max(...tiles.map(t => t.x));
    const minY = Math.min(...tiles.map(t => t.y));
    const maxY = Math.max(...tiles.map(t => t.y));

    const halfW = wSize.width / 2;
    const halfH = wSize.height / 2;
    
    // We want exactly one full tile visible at the edges
    const marginX = 100 * curZoom;
    const marginY = 100 * curZoom;
    // On mobile, the hand panel sits at the bottom instead of floating. 
    // It's about ~220px tall in terms of padding + tile size + button heights.
    const mobileBottomUIOffset = (wSize.width < 768) ? 220 : 0;

    let limitXMin = -halfW - (maxX * 100 + 50) * curZoom + marginX;
    let limitXMax = halfW - (minX * 100 - 50) * curZoom - marginX;
    let limitYMin = -halfH - (maxY * 100 + 50) * curZoom + marginY;
    let limitYMax = halfH - (minY * 100 - 50) * curZoom - marginY - mobileBottomUIOffset;

    // If the board is smaller than the screen padding, limits might cross
    if (limitXMin > limitXMax) {
      const mid = (limitXMin + limitXMax) / 2;
      limitXMin = mid;
      limitXMax = mid;
    }
    if (limitYMin > limitYMax) {
      const mid = (limitYMin + limitYMax) / 2;
      limitYMin = mid;
      limitYMax = mid;
    }

    return {
      x: Math.min(Math.max(newPan.x, limitXMin), limitXMax),
      y: Math.min(Math.max(newPan.y, limitYMin), limitYMax)
    };
  };

  const handleSetPanBounded = (updater: { x: number, y: number } | ((p: { x: number, y: number }) => { x: number, y: number })) => {
    setPan(prevPan => {
      const nextPan = typeof updater === 'function' ? updater(prevPan) : updater;
      return clampPan(nextPan);
    });
  };


  useEffect(() => {
    // Game state will be initialized by the StartScreen now instead of auto-starting.
  }, []);

  // Update expanded states and isMobile when window resizes
  useEffect(() => {
    const checkIPad = () => /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0;

    let prevMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    let prevIPad = checkIPad();

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      const iPad = checkIPad();
      const iPhone = /iPhone/i.test(navigator.userAgent);
      const currentRetractable = mobile || iPad || iPhone;
      const prevRetractable = prevMobile || prevIPad;

      setIsMobile(mobile);
      setIsIPad(iPad);
      setIsIPhone(iPhone);
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });

      if (!currentRetractable) {
        setIsScoreboardExpanded(true);
        setIsHandExpanded(true);
      } else if (!prevRetractable) {
        // Just switched to mobile/iPad/iPhone
        setIsScoreboardExpanded(!mobile && !iPhone); // persistent on iPad, retracted on mobile/iPhone
        setIsHandExpanded(true); // default open on all
      }
      prevMobile = mobile;
      prevIPad = iPad;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const doc = document.documentElement as VendorElement;
      const requestFullScreen = doc.requestFullscreen || doc.mozRequestFullScreen || doc.webkitRequestFullScreen || doc.msRequestFullScreen;
      if (requestFullScreen) requestFullScreen.call(doc);
    } else {
      const doc = document as VendorDocument;
      const exitFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
      if (exitFullScreen) exitFullScreen.call(doc);
    }
  };

  useEffect(() => {
    if (gameState?.turnPhase === 'Score' && gameState?.scoreUpdates?.length) {
      // Play scoring sound
      const update = gameState.scoreUpdates[0];
      const audio = getAudio(update.category);
      if (audio && !isMuted) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio play failed:', e));
      }

      const timer = setTimeout(() => {
        setGameState(prevState => {
          if (!prevState) return prevState;
          const newState = JSON.parse(JSON.stringify(prevState));
          finishScoring(newState);
          return newState;
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.scoreUpdateKey, gameState?.scoreUpdates, gameState?.turnPhase, isMuted]); // Re-fires for EVERY new pop-up (key increments per served update)

  // Turn Change Delay (if no scoring occurred)
  useEffect(() => {
    if (gameState?.turnPhase === 'WaitingNextTurn') {
      const timer = setTimeout(() => {
        setGameState(prevState => {
          if (!prevState) return prevState;
          const newState = JSON.parse(JSON.stringify(prevState));
          advanceTurn(newState);
          return newState;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.turnPhase]);

  // AI Game Loop execution
  useEffect(() => {
    let active = true;
    (async () => {
      if (!gameState || gameState.endGameMode || gameState.turnPhase === 'Score') return;

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (gameState.playerTypes[currentPlayer] === 'human') return;

      // It's the AI's turn! Depending on phase, it acts.
      if (gameState.turnPhase === 'PlaceTile') {
        setIsAiThinking(true);
        // Larger delay to ensure the overlay paints before the main thread is hammered
        await new Promise(r => setTimeout(r, 600));
        if (!active) return;

        // Use requestAnimationFrame to ensure we are in a clean state
        requestAnimationFrame(() => {
          setTimeout(() => {
            const move = calculateBestAIMove(gameState, currentPlayer);

            if (move) {
              // Focus before placing
              setAiFocusTarget({ x: move.tilePlacement.x, y: move.tilePlacement.y });
              setTimeout(async () => {
                if (!active) return;
                await new Promise(r => setTimeout(r, 800)); // wait for pan

                setPrePlacementState(gameState);
                const newState: GameState = JSON.parse(JSON.stringify(gameState));
                const success = placeTile(newState, currentPlayer, move.handIndex, move.tilePlacement.x, move.tilePlacement.y, move.tilePlacement.rotation);
                if (success) {
                  setPendingAIMove(move); // Remember what the AI wanted to do with the meeple
                  setAiFocusTarget(null);
                  setIsAiThinking(false);
                  setGameState(newState);
                }
              }, 100);
            } else {
              setIsAiThinking(false);
            }
          }, 0);
        });
      }

      if (gameState.turnPhase === 'PlaceMeeple') {
        await new Promise(r => setTimeout(r, 600)); // admire the tile
        if (!active) return;

        const newState: GameState = JSON.parse(JSON.stringify(gameState));

        // To ensure the state machine moves forward
        if (pendingAIMove?.meeplePlacement) {
          placeMeeple(newState, currentPlayer, pendingAIMove.meeplePlacement.featureId);
        } else {
          skipMeeple(newState, currentPlayer);
        }

        setPendingAIMove(null);
        setGameState(newState);
        setPrePlacementState(null);
      }
    })();

    return () => { active = false; };
  }, [gameState, pendingAIMove?.meeplePlacement]);

  // Centralized Board Boundary Enforcement
  useEffect(() => {
    requestAnimationFrame(() => {
      setPan(prevPan => {
        const clamped = clampPan(prevPan);
        if (clamped.x !== prevPan.x || clamped.y !== prevPan.y) {
          return clamped;
        }
        return prevPan;
      });
    });
  }, [gameState, zoom, windowSize]);

  if (!gameState) {
    return <StartScreen isMobile={isMobile} onStartGame={(names: Record<PlayerId, string>, types: Record<PlayerId, PlayerType>) => setGameState(createInitialState(names, types))} />;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  let computedFocusTarget: { x: number, y: number } | null = null;
  if (aiFocusTarget) {
    computedFocusTarget = aiFocusTarget;
  } else if (gameState?.turnPhase === 'Score' && gameState.scoreUpdates && gameState.scoreUpdates.length > 0) {
    const firstId = gameState.scoreUpdates[0].completedComponentIds[0];
    if (firstId) {
      const parts = firstId.split(',');
      if (parts.length >= 2) {
        computedFocusTarget = { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
      }
    }
  }

  // Render sandbox if active
  if (showSandbox) {
    return <FieldSandbox onClose={() => setShowSandbox(false)} />;
  }

  // Gallery mode: show all tiles with hotspots
  if (GALLERY_MODE) {
    return (
      <div style={{
        padding: '30px',
        backgroundColor: '#f0e6d2',
        minHeight: '100vh',
        boxSizing: 'border-box'
      }}>
        <h2 style={{ textAlign: 'center', color: '#5d4037', marginBottom: 20 }}>
          Meeple Hotspot Review — All 24 Tiles
        </h2>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: 30, fontSize: 14 }}>
          Each white circle = a meeple placement spot. Corner circles = farmer (field) spots.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '20px',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          {BASE_TILES.map((tileDef) => (
            <div key={tileDef.typeId} style={{ textAlign: 'center' }}>
              <TileRenderer
                def={tileDef}
                size={130}
                placed={{ id: 'gallery', typeId: tileDef.typeId, x: 0, y: 0, rotation: 0, meeples: [] }}
                meeplePlacementMode={true}
                onFeatureClick={(id) => console.log(`Tile ${tileDef.typeId}: ${id}`)}
              />
              <div style={{ marginTop: 4, fontWeight: 'bold', color: '#5d4037' }}>
                {tileDef.typeId}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }


  const handlePlacementClick = (x: number, y: number) => {
    if (selectedHandIndex === -1) return;
    setPrePlacementState(gameState);
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const success = placeTile(newState, currentPlayer, selectedHandIndex, x, y, rotation);
    if (success) {
      setGameState(newState);
      setSelectedHandIndex(-1);
      setRotation(0);
    }
  };

  const handlePlaceMeeple = (featureId: string) => {


    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const success = placeMeeple(newState, currentPlayer, featureId);
    if (success) {
      setGameState(newState);
      setPrePlacementState(null);
    }
  };

  const handleSkipMeeple = () => {


    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const success = skipMeeple(newState, currentPlayer);
    if (success) {
      setGameState(newState);
      setPrePlacementState(null);
    }
  };

  const handleCancelPlacement = () => {
    if (prePlacementState) {
      setGameState(prePlacementState);
      setPrePlacementState(null);
    }
  };

  const handleDiscardTile = (index: number) => {
    if (!gameState) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const success = discardTile(newState, currentPlayer, index);
    if (success) {
      setGameState(newState);
      setSelectedHandIndex(-1);
    }
  };

  // PLAYER_COLORS is now imported globally

  return (
    <div
      style={{ width: '100%', height: '100%', overflow: 'hidden', margin: 0, padding: 0, position: 'fixed', top: 0, left: 0, overscrollBehavior: 'none', touchAction: 'none' }}
      onClick={() => {
        if (useRetractableUI && gameState.turnPhase !== 'PlaceTile' && gameState.turnPhase !== 'PlaceMeeple') {
          setIsScoreboardExpanded(false);
          setIsHandExpanded(false);
        }
      }}
    >
      <style>{SCORING_CSS}</style>

      {/* AI Thinking Banner */}
      {isAiThinking && (
        <div
          className="thinking-banner"
          style={{
            '--player-color': PLAYER_COLORS[currentPlayer],
            '--player-color-faint': `${PLAYER_COLORS[currentPlayer]}44`
          } as React.CSSProperties}
        >
          <div className="spinner"></div>
          <div className="thinking-banner-text">
            {t('game.playerTurn', { name: gameState.playerNames[currentPlayer] }) || `${gameState.playerNames[currentPlayer]}'s turn`}
          </div>
        </div>
      )}


      {/* Scoreboard Toggle (Mobile only) */}
      {isScoreboardRetractable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsScoreboardExpanded(!isScoreboardExpanded);
          }}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 300,
            background: 'white',
            border: 'none',
            borderRadius: '50%',
            width: 44,
            height: 44,
            fontSize: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s'
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isScoreboardExpanded ? '❌' : '🏆'}
        </button>
      )}

      {/* Scoreboard Overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: isScoreboardRetractable ? 60 : 20,
          left: 20,
          backgroundColor: 'rgba(255,255,255,0.95)',
          padding: '16px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          zIndex: 50,
          fontFamily: 'sans-serif',
          minWidth: '200px',
          transition: isScoreboardRetractable ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          transform: isScoreboardRetractable && !isScoreboardExpanded ? 'translateX(-120%)' : 'translateX(0)',
          maxHeight: isScoreboardRetractable ? '70vh' : 'none',
          overflowY: isScoreboardRetractable ? 'auto' : 'visible'
        }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <span>{t('game.scoreboard')}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setShowFieldView(v => !v)}
              title={t('game.toggleFieldView')}
              style={{
                background: showFieldView ? UI_COLORS.success : 'rgba(0,0,0,0.08)',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: 16, padding: '2px 8px',
                color: showFieldView ? '#fff' : '#555',
                transition: 'all 0.2s'
              }}
            >🌾</button>
            <button
              onClick={() => setShowDeckViewer(v => !v)}
              title={t('game.showRemainingTiles')}
              style={{
                background: showDeckViewer ? UI_COLORS.primary : 'rgba(0,0,0,0.08)',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: 16, padding: '2px 8px',
                color: showDeckViewer ? '#fff' : '#555',
                transition: 'all 0.2s'
              }}
            >🃏</button>
            <button
              onClick={() => setIsMuted(v => !v)}
              title={isMuted ? t('game.unmuteSound') : t('game.muteSound')}
              style={{
                background: isMuted ? UI_COLORS.danger : 'rgba(0,0,0,0.08)',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: 16, padding: '2px 8px',
                color: isMuted ? '#fff' : '#555',
                transition: 'all 0.2s'
              }}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {DEBUG_MODE && (
              <>
                <button
                  onClick={() => setShowGallery(v => !v)}
                  title={t('game.toggleTileGallery')}
                  style={{
                    background: showGallery ? UI_COLORS.primary : 'rgba(0,0,0,0.08)',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: 16, padding: '2px 8px',
                    color: showGallery ? '#fff' : '#555',
                    transition: 'all 0.2s'
                  }}
                >🖼️</button>
                <button
                  onClick={() => setShowSandbox(true)}
                  title={t('game.openSandbox')}
                  style={{
                    background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: 16, padding: '2px 8px', color: '#555'
                  }}
                >🧪 {t('game.openSandbox')}</button>
              </>
            )}

          </div>
        </h3>
        {gameState.players.map(pid => {
          const isCurrent = currentPlayer === pid;
          const meepleCount = gameState.remainingMeeples[pid]?.standard ?? 0;
          const totalMeeples = 7; // standard meeple pool size
          const color = PLAYER_COLORS[pid] || '#999';
          return (
            <div key={pid} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
              padding: '6px 10px',
              backgroundColor: isCurrent ? 'rgba(0,0,0,0.05)' : 'transparent',
              borderLeft: `4px solid ${color}`,
              borderRadius: '0 4px 4px 0',
              fontWeight: isCurrent ? 'bold' : 'normal'
            }}>
              <div>
                <div style={{ fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {gameState.playerNames[pid] || t('startScreen.playerPlaceholder', { id: pid })}
                </div>
                {/* Score Breakdown display */}
                <div style={{ fontSize: '11px', color: '#666', marginTop: 2, display: 'flex', gap: 6 }}>
                  <div>🏰 {gameState.midGameScoreBreakdown[pid]?.city + (gameState.endGameScoreBreakdown?.[pid]?.city || 0)}</div>
                  <div>🛣️ {gameState.midGameScoreBreakdown[pid]?.road + (gameState.endGameScoreBreakdown?.[pid]?.road || 0)}</div>
                  <div>🕌 {gameState.midGameScoreBreakdown[pid]?.monastery + (gameState.endGameScoreBreakdown?.[pid]?.monastery || 0)}</div>
                  {gameState.endGameMode && <div>🌾 {gameState.endGameScoreBreakdown?.[pid]?.field || 0}</div>}
                </div>
                {/* Meeple icons: filled = remaining, hollow = used */}
                <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap', maxWidth: 100 }}>
                  {Array.from({ length: totalMeeples }).map((_, idx) => (
                    <svg key={idx} width="10" height="10" viewBox="0 0 10 10">
                      <circle
                        cx="5" cy="5" r="4"
                        fill={idx < meepleCount ? color : 'none'}
                        stroke={color}
                        strokeWidth="1.5"
                        opacity={idx < meepleCount ? 1 : 0.3}
                      />
                    </svg>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: '20px', color: '#333' }}>
                {gameState.scores[pid] || 0}
              </div>
            </div>
          );
        })}

        {/* AI Experiment Evaluators Box */}
        {AI_EXPERIMENT_MODE && gameState.lastMoveEvaluation && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(0,0,0,0.1)',
            fontSize: '12px',
            color: '#555'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>🧪</span> {t('game.aiExperimentMode')}
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
              {t('game.lastMoveBy', { name: gameState.playerNames[gameState.lastMoveEvaluation.playerId] || t('startScreen.playerPlaceholder', { id: gameState.lastMoveEvaluation.playerId }) })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 12px', alignItems: 'center' }}>
              {[
                { label: t('game.eval.complete'), data: gameState.lastMoveEvaluation.complete },
                { label: t('game.eval.cityInProgress'), data: gameState.lastMoveEvaluation.cityInProgress },
                { label: t('game.eval.roadInProgress'), data: gameState.lastMoveEvaluation.roadInProgress },
                { label: t('game.eval.monasteryInProgress'), data: gameState.lastMoveEvaluation.monasteryInProgress },
                { label: t('game.eval.fieldDelta'), data: gameState.lastMoveEvaluation.field },
                { label: t('game.eval.meepleUsage'), data: gameState.lastMoveEvaluation.meepleUsage },
                { label: t('game.eval.cityAttack'), data: gameState.lastMoveEvaluation.cityAttack },
                { label: t('game.eval.roadAttack'), data: gameState.lastMoveEvaluation.roadAttack },
                { label: t('game.eval.fieldAttack'), data: gameState.lastMoveEvaluation.fieldAttack },
                { label: t('game.eval.cityOpenEdgeDelta'), data: gameState.lastMoveEvaluation.cityOpenEdgeDelta }
              ].map((row, idx) => (
                <React.Fragment key={idx}>
                  <span style={{ color: '#666' }}>{row.label}:</span>
                  <div style={{ textAlign: 'right', display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {gameState.players.map((pid, pIdx) => {
                      const val = row.data[pid] || 0;
                      const color = PLAYER_COLORS[pid] || '#999';
                      return (
                        <span key={pid} style={{
                          fontWeight: 'bold',
                          color: val > 0 ? UI_COLORS.success : (val < 0 ? UI_COLORS.danger : color),
                          opacity: val === 0 ? 0.3 : 1
                        }}>
                          {val > 0 && row.label !== t('game.eval.cityCompletionChance') ? `+${val}` : val}{pIdx < gameState.players.length - 1 || row.data.neutral !== undefined ? ',' : ''}
                        </span>
                      );
                    })}
                    {row.data.neutral !== undefined && (
                      <span style={{
                        fontWeight: 'bold',
                        color: row.data.neutral > 0 ? UI_COLORS.success : (row.data.neutral < 0 ? UI_COLORS.danger : '#999'),
                        opacity: row.data.neutral === 0 ? 0.3 : 1
                      }}>
                        {row.data.neutral > 0 && row.label !== t('game.eval.cityCompletionChance') ? `+${row.data.neutral}` : row.data.neutral}
                        <span style={{ fontSize: '9px', fontWeight: 'normal', opacity: 0.6, marginLeft: '2px' }}> (N)</span>
                      </span>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      <Board
        state={gameState}
        pan={pan}
        setPan={handleSetPanBounded}
        zoom={zoom}
        setZoom={setZoom}
        focusTarget={computedFocusTarget}
        validPlacements={gameState.turnPhase === 'PlaceTile' ? validPlacements : []}
        meepleTilePosition={
          gameState.turnPhase === 'PlaceMeeple' &&
            (gameState.remainingMeeples[currentPlayer]?.standard ?? 0) > 0
            ? gameState.recentTilePosition
            : null
        }
        disabledHotspots={
          gameState.turnPhase === 'PlaceMeeple' && gameState.recentTilePosition &&
            (gameState.remainingMeeples[currentPlayer]?.standard ?? 0) > 0
            ? getOccupiedFeaturesOnTile(gameState.board, gameState.recentTilePosition.x, gameState.recentTilePosition.y)
            : []
        }
        onTileClick={(x: number, y: number) => console.log('Clicked board at', x, y)}
        onPlacementClick={handlePlacementClick}
        fieldConquest={showFieldView ? computeFieldConquest(gameState) : undefined}
        onFeatureClick={handlePlaceMeeple}
      />

      {
        gameState.turnPhase === 'PlaceMeeple' && gameState.playerTypes[currentPlayer] === 'human' && (() => {
          const meeplesLeft = gameState.remainingMeeples[currentPlayer]?.standard ?? 0;
          const hasNoMeeples = meeplesLeft === 0;
          return (
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: isMobile ? 16 : '50%',
              right: isMobile ? 16 : 'auto',
              transform: isMobile ? 'none' : 'translateX(-50%)',
              backgroundColor: 'rgba(255,255,255,0.95)',
              padding: '16px',
              borderRadius: isMobile ? '16px' : '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              zIndex: 100,
              boxSizing: 'border-box'
            }}>
              <span style={{ fontWeight: 'bold', color: hasNoMeeples ? '#c62828' : '#333', fontSize: '14px' }}>
                {hasNoMeeples
                  ? t('game.noMeeples', { name: gameState.playerNames[currentPlayer] || currentPlayer })
                  : t('game.placeMeeplePrompt')}
              </span>
              <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
                <button
                  onClick={handleCancelPlacement}
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '10px 20px',
                    backgroundColor: 'transparent',
                    color: UI_COLORS.danger,
                    border: `2px solid ${UI_COLORS.dangerLight}`,
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {t('game.cancelTile')}
                </button>
                <button
                  onClick={handleSkipMeeple}
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '10px 20px',
                    backgroundColor: hasNoMeeples ? UI_COLORS.primary : 'transparent',
                    color: hasNoMeeples ? '#fff' : '#888',
                    border: hasNoMeeples ? `2px solid ${UI_COLORS.primary}` : '2px solid #ccc',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {hasNoMeeples ? t('game.continue') : t('game.skipMeeple')}
                </button>
              </div>
            </div>
          );
        })()
      }

      {/* Show hand if it's a human turn */}
      {
        gameState.turnPhase !== 'PlaceMeeple' && gameState.turnPhase !== 'GameOver' && gameState.playerTypes[currentPlayer] === 'human' && (
          <>
            {useRetractableUI && (
              <div style={{ display: 'none' }} />
            )}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 300,
                transition: useRetractableUI ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                transform: useRetractableUI && !isHandExpanded ? 'translateY(calc(100% - 74px))' : 'translateY(0)',
                pointerEvents: 'auto'
              }}>
              {/* Toggle button aligned with top edge of hand panel */}
              {useRetractableUI && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsHandExpanded(!isHandExpanded);
                  }}
                  style={{
                    position: 'absolute',
                    top: -65,
                    right: 15,
                    width: 54, height: 54, borderRadius: '50%', background: 'white',
                    border: 'none', fontSize: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 400
                  }}
                >
                  {isHandExpanded ? '❌' : '🃏'}
                </button>
              )}
              <Hand
                state={gameState}
                playerId={currentPlayer}
                playerColor={PLAYER_COLORS[currentPlayer] || '#999'}
                selectedIndex={selectedHandIndex}
                currentRotation={rotation}
                onSelect={(idx) => {
                  setSelectedHandIndex(idx);
                  setRotation(0);
                }}
                onRotate={() => setRotation(r => (r + 1) % 4)}
                onDiscard={handleDiscardTile}
                isMobile={useRetractableUI}
              />
            </div>
          </>
        )
      }

      {/* Game Over Overlay */}
      {
        gameState.turnPhase === 'GameOver' && (
          <GameEndPage
            gameState={gameState}
            showBoardPostGame={showBoardPostGame}
            setShowBoardPostGame={setShowBoardPostGame}
            setShowFieldView={setShowFieldView}
            handlePlayAgain={() => {
              setGameState(createInitialState(gameState.playerNames, gameState.playerTypes));
              setSelectedHandIndex(-1);
              setRotation(0);
              setShowDeckViewer(false);
              setShowBoardPostGame(false);
              setPan({ x: 0, y: 0 });
              setZoom(1);
            }}
            handleBackToMainMenu={() => {
              setGameState(null);
              setSelectedHandIndex(-1);
              setRotation(0);
              setShowDeckViewer(false);
              setShowBoardPostGame(false);
              setPan({ x: 0, y: 0 });
              setZoom(1);
            }}
          />
        )
      }
      {/* Deck Viewer Modal */}
      {
        showDeckViewer && (
          <DeckViewer
            deck={gameState.deck}
            onClose={() => setShowDeckViewer(false)}
          />
        )
      }

      {/* Tile Gallery Modal */}
      {
        showGallery && (
          <TileGallery
            showFieldView={showFieldView}
            setShowFieldView={setShowFieldView}
            onClose={() => setShowGallery(false)}
          />
        )
      }
      {/* Quit Button (placed here to overlay everything) */}
      {!showGallery && gameState?.turnPhase !== 'GameOver' && (
        <button
        className="quit-button"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 3000,
          background: 'rgba(0,0,0,0.08)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          width: 44,
          height: 44,
          pointerEvents: 'auto'
        }}
        title={t('game.quitToMainMenu')}
        onClick={(e) => {
          e.stopPropagation();
          setShowQuitConfirm(true);
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
      )}

      {/* Fullscreen Button: Restricted to Android only */}
      {
        !showGallery && gameState?.turnPhase !== 'GameOver' && !isFullscreen && !isIPad && !isIPhone && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFullscreen();
            }}
            style={{
              position: 'absolute',
              top: 20,
              right: 74,
              zIndex: 3000,
              background: 'rgba(0,0,0,0.08)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: 44,
              height: 44,
              pointerEvents: 'auto'
            }}
            title={t('game.enterFullscreen')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6" />
            </svg>
          </button>
        )
      }

      {/* Custom Quit Confirmation Modal */}
      {
        showQuitConfirm && (
          <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
              width: isMobile ? '100vw' : '400px',
              borderRadius: isMobile ? '0px' : '24px',
              padding: '32px',
              color: 'white',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: '24px',
              border: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px' }}>🏰</div>
              <h2 style={{ margin: 0, fontSize: '24px', color: '#f1c40f', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                {t('tutorial.quitTitle')}
              </h2>
              <p style={{ margin: 0, lineHeight: '1.5', color: '#ecf0f1', fontSize: '16px' }}>
                {t('tutorial.quitContent')}
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowQuitConfirm(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.1)', color: 'white',
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  {t('tutorial.stay')}
                </button>
                <button
                  onClick={() => {
                    setShowQuitConfirm(false);
                    setGameState(null);
                    setSelectedHandIndex(-1);
                    setRotation(0);
                    setShowDeckViewer(false);
                    setShowBoardPostGame(false);
                    setPan({ x: 0, y: 0 });
                    setZoom(1);
                  }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    background: '#e74c3c', color: 'white', border: 'none',
                    cursor: 'pointer', fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(231, 76, 60, 0.3)'
                  }}
                >
                  {t('tutorial.quit')}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}

export default App;
