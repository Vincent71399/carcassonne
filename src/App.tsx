import { useState, useEffect, useRef } from 'react';
import { Board } from './components/Board';
import { Hand } from './components/Hand';
import { DeckViewer } from './components/DeckViewer';
import { createInitialState, placeTile, placeMeeple, skipMeeple, finishScoring, advanceTurn } from './engine/state';
import { calculateBestAIMove } from './engine/ai';
import { PLAYER_COLORS, FEATURE_COLORS, UI_COLORS, DEBUG_MODE } from './engine/constants';
import { getValidPlacements } from './engine/board';
import { BASE_TILES } from './engine/tiles';
import { TileRenderer } from './components/TileRenderer';
import { computeFieldConquest, getCityMaskPaths, getRoadMaskPaths } from './engine/fieldConquest';
import { FieldSandbox } from './components/FieldSandbox';
import { StartScreen } from './components/StartScreen';
import { getOccupiedFeaturesOnTile } from './engine/features';
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
`;

const AUDIO_MAP = {
  city: scoreCity,
  field: scoreField,
  road: scoreRoad,
  monastery: scoreMonastery,
};

function App() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedHandIndex, setSelectedHandIndex] = useState(-1);
  const [rotation, setRotation] = useState(0);
  const [prePlacementState, setPrePlacementState] = useState<GameState | null>(null);

  // Layout states for mobile/iPad
  const [isIPad, setIsIPad] = useState(typeof window !== 'undefined' ? (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0) : false);
  const useRetractableUI = isMobile || isIPad;
  const isScoreboardRetractable = isMobile;
  const [isScoreboardExpanded, setIsScoreboardExpanded] = useState(!isScoreboardRetractable);
  const [isHandExpanded, setIsHandExpanded] = useState(true);

  // Board position and zoom (moved from Board.tsx)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // We need to remember what the AI decided to do with its meeple when it calculated the tile placement
  const [pendingAIMove, setPendingAIMove] = useState<{ meeplePlacement?: { featureId: string } } | null>(null);
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
    const overlap = 50;

    const limitXMin = overlap - halfW - (maxX * 100 + 50) * curZoom;
    const limitXMax = halfW - overlap - (minX * 100 - 50) * curZoom;
    const limitYMin = overlap - halfH - (maxY * 100 + 50) * curZoom;
    const limitYMax = halfH - overlap - (minY * 100 - 50) * curZoom;

    return {
      x: Math.min(Math.max(newPan.x, limitXMin), limitXMax),
      y: Math.min(Math.max(newPan.y, limitYMin), limitYMax)
    };
  };

  const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleStartMove = (dx: number, dy: number) => {
    if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);

    // Initial move
    setPan(p => clampPan({ x: p.x + dx, y: p.y + dy }));

    // Continuous move
    moveIntervalRef.current = setInterval(() => {
      setPan(p => clampPan({ x: p.x + dx * 0.2 * (2 / 3), y: p.y + dy * 0.2 * (2 / 3) }));
    }, 30);
  };

  const handleEndMove = () => {
    if (moveIntervalRef.current) {
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }
  };

  const zoomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleStartZoom = (factor: number) => {
    if (zoomIntervalRef.current) clearInterval(zoomIntervalRef.current);

    setZoom(z => Math.min(Math.max(z * factor, 0.3), 3));

    zoomIntervalRef.current = setInterval(() => {
      // Use a smaller factor for smoother continuous zoom
      const continuousFactor = factor > 1 ? 1.02 : 1 / 1.02;
      setZoom(z => Math.min(Math.max(z * continuousFactor, 0.3), 3));
    }, 30);
  };

  const handleEndZoom = () => {
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
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
      const currentRetractable = mobile || iPad;
      const prevRetractable = prevMobile || prevIPad;

      setIsMobile(mobile);
      setIsIPad(iPad);
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });

      if (!currentRetractable) {
        setIsScoreboardExpanded(true);
        setIsHandExpanded(true);
      } else if (!prevRetractable) {
        // Just switched to mobile/iPad
        setIsScoreboardExpanded(!mobile); // persistent on iPad, retracted on mobile
        setIsHandExpanded(true); // default open on both
      }
      prevMobile = mobile;
      prevIPad = iPad;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fullscreen effect for mobile/iPad
  useEffect(() => {
    const isMobileOrIPad = isMobile || isIPad;

    if (isMobileOrIPad) {
      if (gameState) {
        const doc = window.document.documentElement as VendorElement;
        const requestFullScreen = doc.requestFullscreen || doc.mozRequestFullScreen || doc.webkitRequestFullScreen || doc.msRequestFullScreen;

        if (requestFullScreen) {
          requestFullScreen.call(doc).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            const name = err instanceof Error ? err.name : 'Error';
            console.warn(`Error attempting to enable full-screen mode: ${message} (${name})`);
          });
        }
      } else {
        // Exit fullscreen when returning to start screen
        const doc = window.document as VendorDocument;
        const exitFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

        if (exitFullScreen && doc.fullscreenElement) {
          exitFullScreen.call(doc).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            const name = err instanceof Error ? err.name : 'Error';
            console.warn(`Error attempting to exit full-screen mode: ${message} (${name})`);
          });
        }
      }
    }
  }, [gameState, isMobile, isIPad]);

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
      const soundFile = AUDIO_MAP[update.category];
      if (soundFile && !isMuted) {
        const audio = new Audio(soundFile);
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
        const move = calculateBestAIMove(gameState, currentPlayer);

        if (move) {
          // Focus before placing
          setAiFocusTarget({ x: move.tilePlacement.x, y: move.tilePlacement.y });
          await new Promise(r => setTimeout(r, 800)); // wait for pan
          if (!active) return;

          setPrePlacementState(gameState);
          const newState: GameState = JSON.parse(JSON.stringify(gameState));
          const success = placeTile(newState, currentPlayer, move.handIndex, move.tilePlacement.x, move.tilePlacement.y, move.tilePlacement.rotation);
          if (success) {
            setPendingAIMove(move); // Remember what the AI wanted to do with the meeple
            setAiFocusTarget(null);
            setGameState(newState);
          }
        }
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

  let validPlacements: { x: number, y: number }[] = [];
  if (selectedHandIndex !== -1) {
    const tileDef = gameState.hands[currentPlayer][selectedHandIndex];
    if (tileDef) {
      validPlacements = getValidPlacements(gameState.board, tileDef, rotation);
    }
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

  // PLAYER_COLORS is now imported globally

  return (
    <div
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0, position: 'relative' }}
      onClick={() => {
        if (useRetractableUI && gameState.turnPhase !== 'PlaceTile' && gameState.turnPhase !== 'PlaceMeeple') {
          setIsScoreboardExpanded(false);
          setIsHandExpanded(false);
        }
      }}
    >
      <style>{SCORING_CSS}</style>


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
          <span>Scoreboard</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setShowFieldView(v => !v)}
              title="Toggle Field Conquer View"
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
              title="Show Remaining Tiles"
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
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
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
                  title="Toggle Tile Gallery"
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
                  title="Open Field Sandbox"
                  style={{
                    background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: 16, padding: '2px 8px', color: '#555'
                  }}
                >🧪 Sandbox</button>
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
                <div style={{ fontSize: '14px', color: '#333' }}>{gameState.playerNames[pid] || `Player ${pid}`}</div>
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
      </div>

      <Board
        state={gameState}
        pan={pan}
        setPan={setPan}
        zoom={zoom}
        setZoom={setZoom}
        isMobile={isMobile}
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

      {/* Mobile/iPad Navigation Arrows */}
      {
        useRetractableUI && !isHandExpanded && (!isScoreboardRetractable || !isScoreboardExpanded) && (
          <>
            {/* Top Arrow */}
            <button
              onMouseDown={(e) => { e.stopPropagation(); handleStartMove(0, 100); }}
              onMouseUp={(e) => { e.stopPropagation(); handleEndMove(); }}
              onMouseLeave={(e) => { e.stopPropagation(); handleEndMove(); }}
              onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleStartMove(0, 100); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleEndMove(); }}
              onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); handleEndMove(); }}
              style={{
                position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
                width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.8)',
                border: 'none', fontSize: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 200, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >↑</button>

            {/* Bottom Arrow */}
            <button
              onMouseDown={(e) => { e.stopPropagation(); handleStartMove(0, -100); }}
              onMouseUp={(e) => { e.stopPropagation(); handleEndMove(); }}
              onMouseLeave={(e) => { e.stopPropagation(); handleEndMove(); }}
              onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleStartMove(0, -100); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleEndMove(); }}
              onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); handleEndMove(); }}
              style={{
                position: 'absolute', bottom: isHandExpanded ? 220 : 80, left: '50%', transform: 'translateX(-50%)',
                width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.8)',
                border: 'none', fontSize: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 200, cursor: 'pointer',
                transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >↓</button>

            {/* Left Arrow */}
            <button
              onMouseDown={(e) => { e.stopPropagation(); handleStartMove(100, 0); }}
              onMouseUp={(e) => { e.stopPropagation(); handleEndMove(); }}
              onMouseLeave={(e) => { e.stopPropagation(); handleEndMove(); }}
              onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleStartMove(100, 0); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleEndMove(); }}
              onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); handleEndMove(); }}
              style={{
                position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)',
                width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.8)',
                border: 'none', fontSize: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 200, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >←</button>

            {/* Right Arrow */}
            <button
              onMouseDown={(e) => { e.stopPropagation(); handleStartMove(-100, 0); }}
              onMouseUp={(e) => { e.stopPropagation(); handleEndMove(); }}
              onMouseLeave={(e) => { e.stopPropagation(); handleEndMove(); }}
              onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleStartMove(-100, 0); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleEndMove(); }}
              onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); handleEndMove(); }}
              style={{
                position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)',
                width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.8)',
                border: 'none', fontSize: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 200, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >→</button>
          </>
        )
      }

      {/* Zoom/Hand-toggle Controls (Always visible on mobile/iPad) */}
      {
        useRetractableUI && (
          <div style={{
            position: 'absolute',
            bottom: isHandExpanded ? 210 : 90,
            right: 15,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            zIndex: 400,
            transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            {/* Zoom Controls (Mobile/iPad specific rules) */}
            {(isMobile ? (!isScoreboardExpanded && !isHandExpanded) : (isIPad && !isHandExpanded)) && (
              <>
                <button
                  onMouseDown={(e) => { e.stopPropagation(); handleStartZoom(1.2); }}
                  onMouseUp={(e) => { e.stopPropagation(); handleEndZoom(); }}
                  onMouseLeave={(e) => { e.stopPropagation(); handleEndZoom(); }}
                  onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleStartZoom(1.2); }}
                  onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleEndZoom(); }}
                  onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); handleEndZoom(); }}
                  style={{
                    width: 54, height: 54, borderRadius: '50%', background: 'white',
                    border: 'none', fontSize: 24, fontWeight: 'bold', boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >+</button>
                <button
                  onMouseDown={(e) => { e.stopPropagation(); handleStartZoom(0.8); }}
                  onMouseUp={(e) => { e.stopPropagation(); handleEndZoom(); }}
                  onMouseLeave={(e) => { e.stopPropagation(); handleEndZoom(); }}
                  onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleStartZoom(0.8); }}
                  onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleEndZoom(); }}
                  onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); handleEndZoom(); }}
                  style={{
                    width: 54, height: 54, borderRadius: '50%', background: 'white',
                    border: 'none', fontSize: 24, fontWeight: 'bold', boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >-</button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsHandExpanded(!isHandExpanded);
              }}
              style={{
                width: 54, height: 54, borderRadius: '50%', background: 'white',
                border: 'none', fontSize: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {isHandExpanded ? '❌' : '🃏'}
            </button>
          </div>
        )
      }


      {
        gameState.turnPhase === 'PlaceMeeple' && (() => {
          const meeplesLeft = gameState.remainingMeeples[currentPlayer]?.standard ?? 0;
          const hasNoMeeples = meeplesLeft === 0;
          return (
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(255,255,255,0.95)',
              padding: '12px 24px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              zIndex: 100,
            }}>
              <span style={{ fontWeight: 'bold', color: hasNoMeeples ? '#c62828' : '#333', fontSize: '14px' }}>
                {hasNoMeeples
                  ? `Player ${currentPlayer} has no meeples remaining`
                  : `Click a spot on the tile to place a meeple`}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleCancelPlacement}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: 'transparent',
                    color: UI_COLORS.danger,
                    border: `2px solid ${UI_COLORS.dangerLight}`,
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancel Tile
                </button>
                <button
                  onClick={handleSkipMeeple}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: hasNoMeeples ? UI_COLORS.primary : 'transparent',
                    color: hasNoMeeples ? '#fff' : '#888',
                    border: hasNoMeeples ? `2px solid ${UI_COLORS.primary}` : '2px solid #ccc',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {hasNoMeeples ? 'Continue' : 'Skip (No Meeple)'}
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
                transform: useRetractableUI && !isHandExpanded ? 'translateY(110%)' : 'translateY(0)',
                pointerEvents: useRetractableUI && !isHandExpanded ? 'none' : 'auto'
              }}>
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
                isMobile={useRetractableUI}
              />
            </div>
          </>
        )
      }

      {/* Game Over Overlay */}
      {
        gameState.turnPhase === 'GameOver' && (() => {
          const sortedPlayers = [...gameState.players].sort((a, b) => (gameState.scores[b] || 0) - (gameState.scores[a] || 0));
          const topScore = gameState.scores[sortedPlayers[0]] || 0;
          const winners = sortedPlayers.filter(p => (gameState.scores[p] || 0) === topScore);
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <>
              {/* Always render Board so players can pan/zoom and use field view */}
              {showBoardPostGame && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  background: 'linear-gradient(90deg, rgba(18,18,40,0.96), rgba(40,15,60,0.96))',
                  zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 24px', boxShadow: '0 2px 16px rgba(0,0,0,0.5)'
                }}>
                  <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: 18 }}>
                    {winners.length === 1 ? `🏆 Player ${winners[0]} Wins!` : `🤝 Tie`}
                    {gameState.players.map(p => (
                      <span key={p} style={{ marginLeft: 16, fontSize: 14, color: PLAYER_COLORS[p] || '#fff' }}>
                        P{p}: {gameState.scores[p] || 0}pts
                      </span>
                    ))}
                  </span>
                  <button
                    onClick={() => setShowBoardPostGame(false)}
                    style={{
                      padding: '7px 18px', background: 'rgba(255,215,0,0.15)', color: '#ffd700',
                      border: '1px solid #ffd70055', borderRadius: 8, cursor: 'pointer',
                      fontWeight: 'bold', fontSize: 13
                    }}
                  >← Back to Results</button>
                </div>
              )}
              {!showBoardPostGame && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(135deg, rgba(18,18,40,0.97), rgba(40,15,60,0.97))',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1000, fontFamily: 'sans-serif'
                }}>
                  <div style={{ fontSize: 64, marginBottom: 12 }}>🏰</div>
                  <h1 style={{ color: '#ffd700', fontSize: 36, margin: '0 0 4px', textShadow: '0 2px 12px rgba(255,215,0,0.6)' }}>Game Over!</h1>
                  <p style={{ color: '#aaa', margin: '0 0 32px', fontSize: 16 }}>All tiles placed — final scores are in!</p>

                  {/* Winner banner */}
                  <div style={{
                    background: 'linear-gradient(90deg, #ffd700, #ff9800)',
                    borderRadius: 14, padding: '12px 32px', marginBottom: 28,
                    boxShadow: '0 4px 24px rgba(255,165,0,0.4)'
                  }}>
                    <span style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' }}>
                      {winners.length === 1 ? `🏆 Player ${winners[0]} Wins!` : `🤝 Tie: ${winners.map(p => `Player ${p}`).join(' & ')}`}
                    </span>
                  </div>

                  {/* Final score breakdown bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 480, marginBottom: 36 }}>
                    {(() => {
                      const CATS = [
                        { key: 'city' as const, label: 'Cities', color: '#c9a84c', midColor: '#e8cfa0' },
                        { key: 'road' as const, label: 'Roads', color: '#9e9e9e', midColor: '#cfcfcf' },
                        { key: 'monastery' as const, label: 'Monasteries', color: FEATURE_COLORS.monastery, midColor: '#f08080' },
                        { key: 'field' as const, label: 'Fields', color: FEATURE_COLORS.field, midColor: '#90c994' },
                      ];
                      return sortedPlayers.map((pid, rank) => {
                        const total = gameState.scores[pid] || 0;
                        const breakdown = gameState.endGameScoreBreakdown?.[pid];
                        const midBreakdown = gameState.midGameScoreBreakdown?.[pid];
                        const maxScore = Math.max(...gameState.players.map(p => gameState.scores[p] || 0), 1);

                        return (
                          <div key={pid} style={{
                            background: 'rgba(255,255,255,0.06)',
                            borderLeft: `5px solid ${PLAYER_COLORS[pid] || '#999'}`,
                            borderRadius: '0 12px 12px 0',
                            padding: '12px 16px',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ color: '#eee', fontSize: 15 }}>{medals[rank] || '  '} Player {pid}</span>
                              <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: 18 }}>{total} pts</span>
                            </div>
                            {/* Stacked bar */}
                            <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', marginBottom: 6 }}>
                              {/* Mid-game segments (lighter shade, same category colours) */}
                              {midBreakdown && CATS.map(cat => {
                                const pts = midBreakdown[cat.key] || 0;
                                if (pts === 0) return null;
                                return (
                                  <div key={`mid-${cat.key}`} title={`Mid-game ${cat.label}: ${pts}pts`} style={{
                                    width: `${(pts / maxScore) * 100}%`,
                                    background: cat.midColor, minWidth: 2,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, color: '#333', fontWeight: 'bold',
                                  }}>{pts > 4 ? pts : ''}</div>
                                );
                              })}
                              {/* End-game category segments (full colour) */}
                              {breakdown && CATS.map(cat => {
                                const pts = breakdown[cat.key] || 0;
                                if (pts === 0) return null;
                                return (
                                  <div key={cat.key} title={`End-game ${cat.label}: ${pts}pts`} style={{
                                    width: `${(pts / maxScore) * 100}%`,
                                    background: cat.color, minWidth: 2,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, color: '#fff', fontWeight: 'bold',
                                  }}>{pts > 4 ? pts : ''}</div>
                                );
                              })}
                            </div>
                            {/* Legend pills */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {midBreakdown && CATS.map(cat => {
                                const pts = midBreakdown[cat.key] || 0;
                                if (pts === 0) return null;
                                return <span key={`mid-${cat.key}`} style={{ fontSize: 11, background: cat.midColor, borderRadius: 10, padding: '2px 7px', color: '#333' }}>Mid {cat.label} {pts}</span>;
                              })}
                              {breakdown && CATS.map(cat => {
                                const pts = breakdown[cat.key] || 0;
                                if (pts === 0) return null;
                                return <span key={cat.key} style={{ fontSize: 11, background: cat.color, borderRadius: 10, padding: '2px 7px', color: '#fff' }}>{cat.label} {pts}</span>;
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <button
                      onClick={() => {
                        setShowBoardPostGame(true);
                        setShowFieldView(true);
                      }}
                      style={{
                        padding: '14px 32px', fontSize: 18, fontWeight: 'bold',
                        background: 'rgba(255,255,255,0.1)',
                        color: '#ddd', border: '1px solid #555', borderRadius: 12, cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ddd'; }}
                    >
                      View Field Conquest
                    </button>
                    <button
                      onClick={() => {
                        setGameState(createInitialState(gameState.playerNames, gameState.playerTypes));
                        setSelectedHandIndex(-1);
                        setRotation(0);
                        setShowDeckViewer(false);
                        setShowBoardPostGame(false);
                      }}
                      style={{
                        padding: '14px 48px', fontSize: 18, fontWeight: 'bold',
                        background: `linear-gradient(90deg, ${UI_COLORS.primary}, ${UI_COLORS.primaryLight})`,
                        color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(33,150,243,0.5)',
                        transition: 'transform 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      Play Again
                    </button>
                    <button
                      onClick={() => {
                        setGameState(null);
                        setSelectedHandIndex(-1);
                        setRotation(0);
                        setShowDeckViewer(false);
                        setShowBoardPostGame(false);
                      }}
                      style={{
                        padding: '14px 24px', fontSize: 16, fontWeight: 'bold',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#bbb', border: '1px solid #444', borderRadius: 12, cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#bbb'; }}
                    >
                      Back to Main Menu
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()
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
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(255,255,255,0.98)',
            zIndex: 2000, overflowY: 'auto', padding: '40px',
            fontFamily: 'sans-serif'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
              <h2 style={{ color: '#333', margin: 0 }}>Tile Gallery (Field Coverage Verification)</h2>
              <div style={{ display: 'flex', gap: 16 }}>
                <button
                  onClick={() => setShowFieldView(v => !v)}
                  style={{
                    background: showFieldView ? UI_COLORS.success : '#e0e0e0',
                    color: showFieldView ? '#fff' : '#333', border: 'none', borderRadius: 8,
                    padding: '8px 16px', fontSize: 16, cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  {showFieldView ? '🌾 Field Coverage ON' : '🌾 Field Coverage OFF'}
                </button>
                <button
                  onClick={() => setShowGallery(false)}
                  style={{
                    background: UI_COLORS.danger, color: '#fff', border: 'none', borderRadius: 8,
                    padding: '8px 16px', fontSize: 16, cursor: 'pointer', fontWeight: 'bold'
                  }}
                >Close</button>
              </div>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '30px', maxWidth: 1200, margin: '0 auto'
            }}>
              {BASE_TILES.map(def => {
                // Create dummy field conquest data mapping each field index to a distinct "player" color
                const fakeConquest = new Map<string, number[]>();
                if (def.fieldConnections) {
                  def.fieldConnections.forEach((_, i) => {
                    fakeConquest.set(`0,0,${i}`, [1]); // always red (player 1)
                  });
                }
                return (
                  <div key={def.typeId} style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: 140, height: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: 4 }}>
                      <TileRenderer
                        def={def} size={140}
                        placed={{ id: 'gal', typeId: def.typeId, x: 0, y: 0, rotation: 0, meeples: [] }}
                      />
                      {showFieldView && def.fieldConnections && (() => {
                        const hasMonastery = !!def.monastery;
                        const cityPaths = getCityMaskPaths(def);
                        const roadPaths = getRoadMaskPaths(def);
                        return def.fieldConnections.map((_, fIdx) => {
                          const winners = fakeConquest.get(`0,0,${fIdx}`);
                          if (!winners) return null;
                          const fieldD = def.fieldPaths?.[fIdx];
                          const isFullTile = def.fieldConnections!.length === 1;
                          if (!fieldD && !isFullTile) return null;

                          const patId = `gal-pat-${def.typeId}-${fIdx}`;
                          const maskId = `gal-msk-${def.typeId}-${fIdx}`;
                          const clipId = `gal-clp-${def.typeId}-${fIdx}`;
                          const c = PLAYER_COLORS[winners[0]] || '#888';
                          return (
                            <svg key={fIdx} width="140" height="140" viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                              <defs>
                                <pattern id={patId} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                  <rect width="10" height="10" fill={c} fillOpacity="0.22" />
                                  <line x1="0" y1="5" x2="10" y2="5" stroke={c} strokeWidth="4" strokeOpacity="0.7" />
                                </pattern>
                                <mask id={maskId}>
                                  <rect width="100" height="100" fill="white" />
                                  {cityPaths.map((d: string, i: number) => <path key={`c${i}`} d={d} fill="black" />)}
                                  {roadPaths.map((d: string, i: number) => <path key={`r${i}`} d={d} fill="none" stroke="black" strokeWidth="12" strokeLinecap="round" />)}
                                  {hasMonastery && <circle cx="50" cy="50" r="24" fill="black" />}
                                </mask>
                                <clipPath id={clipId}>
                                  {isFullTile ? <rect width="100" height="100" /> : <path d={fieldD} />}
                                </clipPath>
                              </defs>
                              <rect x="0" y="0" width="100" height="100" fill={`url(#${patId})`} mask={`url(#${maskId})`} clipPath={`url(#${clipId})`} />
                            </svg>
                          );
                        });
                      })()}
                    </div>
                    <h4 style={{ margin: '8px 0 0', color: '#555' }}>Tile {def.typeId}</h4>
                  </div>
                );
              })}
            </div>
          </div >
        )
      }
      {/* Quit Button (placed here to overlay everything) */}
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
        title="Quit to Main Menu"
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

      {/* Fullscreen Button */}
      {!isFullscreen && (
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
          title="Enter Fullscreen"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6" />
          </svg>
        </button>
      )}

      {/* Custom Quit Confirmation Modal */}
      {showQuitConfirm && (
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
              Quit Game?
            </h2>
            <p style={{ margin: 0, lineHeight: '1.5', color: '#ecf0f1', fontSize: '16px' }}>
              Are you sure you want to leave the current game? All progress will be lost.
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
                Stay
              </button>
              <button
                onClick={() => {
                  setShowQuitConfirm(false);
                  setGameState(null);
                  setSelectedHandIndex(-1);
                  setRotation(0);
                  setShowDeckViewer(false);
                  setShowBoardPostGame(false);
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  background: '#e74c3c', color: 'white', border: 'none',
                  cursor: 'pointer', fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(231, 76, 60, 0.3)'
                }}
              >
                Quit
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

export default App;
