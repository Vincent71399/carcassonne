import { useState, useEffect } from 'react';
import { Board } from './components/Board';
import { Hand } from './components/Hand';
import { DeckViewer } from './components/DeckViewer';
import { createInitialState, placeTile, placeMeeple, skipMeeple, finishScoring } from './engine/state';
import { calculateBestAIMove } from './engine/ai';
import { PLAYER_COLORS, FEATURE_COLORS, UI_COLORS, DEBUG_MODE } from './engine/constants';
import type { GameState } from './engine/types';
import { getValidPlacements } from './engine/board';
import { BASE_TILES } from './engine/tiles';
import { TileRenderer } from './components/TileRenderer';
import { computeFieldConquest, getCityMaskPaths, getRoadMaskPaths } from './engine/fieldConquest';
import { FieldSandbox } from './components/FieldSandbox';
import { StartScreen } from './components/StartScreen';
import { getOccupiedFeaturesOnTile } from './engine/features';
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
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedHandIndex, setSelectedHandIndex] = useState(-1);
  const [rotation, setRotation] = useState(0);
  const [prePlacementState, setPrePlacementState] = useState<GameState | null>(null);

  // We need to remember what the AI decided to do with its meeple when it calculated the tile placement
  const [pendingAIMove, setPendingAIMove] = useState<any>(null);
  const [aiFocusTarget, setAiFocusTarget] = useState<{ x: number, y: number } | null>(null);

  const [showDeckViewer, setShowDeckViewer] = useState(false);
  const [showFieldView, setShowFieldView] = useState(false);
  const [showBoardPostGame, setShowBoardPostGame] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);


  useEffect(() => {
    // Game state will be initialized by the StartScreen now instead of auto-starting.
  }, []);

  useEffect(() => {
    if (gameState?.turnPhase === 'Score' && gameState?.scoreUpdates?.length) {
      // Play scoring sound
      const update = gameState.scoreUpdates[0];
      const soundFile = AUDIO_MAP[update.category];
      if (soundFile) {
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
  }, [gameState?.scoreUpdateKey]); // Re-fires for EVERY new pop-up (key increments per served update)

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
  }, [gameState?.turnPhase, gameState?.currentPlayerIndex]);

  if (!gameState) {
    return <StartScreen onStartGame={(names, types) => setGameState(createInitialState(names, types))} />;
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
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0, position: 'relative' }}>
      <style>{SCORING_CSS}</style>

      {/* Scoreboard Overlay */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        backgroundColor: 'rgba(255,255,255,0.95)',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        zIndex: 50,
        fontFamily: 'sans-serif',
        minWidth: '200px'
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


      {gameState.turnPhase === 'PlaceMeeple' && (() => {
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
      })()}

      {/* Show hand if it's a human turn */}
      {gameState.turnPhase !== 'PlaceMeeple' && gameState.turnPhase !== 'GameOver' && gameState.playerTypes[currentPlayer] === 'human' && (
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
        />
      )}

      {/* Game Over Overlay */}
      {gameState.turnPhase === 'GameOver' && (() => {
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
      })()}
      {/* Deck Viewer Modal */}
      {showDeckViewer && (
        <DeckViewer
          deck={gameState.deck}
          onClose={() => setShowDeckViewer(false)}
        />
      )}

      {/* Tile Gallery Modal */}
      {showGallery && (
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
    </div >
  );
}

export default App;
