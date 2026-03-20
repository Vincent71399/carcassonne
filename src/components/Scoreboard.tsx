import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState, PlayerId } from '../engine/types';
import { PLAYER_COLORS, UI_COLORS } from '../utils/styles';
import { DEBUG_MODE, AI_EXPERIMENT_MODE } from '../utils/debug';

interface ScoreboardProps {
  gameState: GameState;
  currentPlayer: PlayerId;
  isScoreboardRetractable: boolean;
  isScoreboardExpanded: boolean;
  showFieldView: boolean;
  setShowFieldView: React.Dispatch<React.SetStateAction<boolean>>;
  showDeckViewer: boolean;
  setShowDeckViewer: React.Dispatch<React.SetStateAction<boolean>>;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  showGallery: boolean;
  setShowGallery: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSandbox: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  gameState,
  currentPlayer,
  isScoreboardRetractable,
  isScoreboardExpanded,
  showFieldView,
  setShowFieldView,
  showDeckViewer,
  setShowDeckViewer,
  isMuted,
  setIsMuted,
  showGallery,
  setShowGallery,
  setShowSandbox
}) => {
  const { t } = useTranslation();
  const hasLargeMeepleGame = gameState?.players.some(p => (gameState.remainingMeeples[p]?.large || 0) > 0) || Object.values(gameState?.board || {}).some(t => t.meeples.some(m => m.meeple.type === 'large'));

  return (
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
                <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'nowrap', alignItems: 'center', maxWidth: 130 }}>
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
                  {hasLargeMeepleGame && (
                    <svg key="large" width="12" height="12" viewBox="0 0 14 14" style={{ marginLeft: 4, marginTop: -1 }}>
                      <circle
                        cx="7" cy="7" r="6"
                        fill={(gameState.remainingMeeples[pid]?.large ?? 0) > 0 ? color : 'none'}
                        stroke={color}
                        strokeWidth="1.5"
                        opacity={(gameState.remainingMeeples[pid]?.large ?? 0) > 0 ? 1 : 0.3}
                      />
                      <text x="7" y="10.5" fontSize="9" fontWeight="bold" textAnchor="middle" fill={(gameState.remainingMeeples[pid]?.large ?? 0) > 0 ? '#fff' : color} opacity={(gameState.remainingMeeples[pid]?.large ?? 0) > 0 ? 1 : 0.5}>2</text>
                    </svg>
                  )}
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
  );
};
