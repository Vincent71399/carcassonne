import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../engine/types';
import { PLAYER_COLORS, FEATURE_COLORS, UI_COLORS } from '../utils/styles';

interface GameEndPageProps {
  gameState: GameState;
  showBoardPostGame: boolean;
  setShowBoardPostGame: (show: boolean) => void;
  setShowFieldView: React.Dispatch<React.SetStateAction<boolean>>;
  handlePlayAgain?: () => void;
  handleBackToMainMenu: () => void;
}

export const GameEndPage: React.FC<GameEndPageProps> = ({
  gameState,
  showBoardPostGame,
  setShowBoardPostGame,
  setShowFieldView,
  handlePlayAgain,
  handleBackToMainMenu
}) => {
  const { t } = useTranslation();
  
  const sortedPlayers = [...gameState.players].sort((a, b) => (gameState.scores[b] || 0) - (gameState.scores[a] || 0));
  const topScore = gameState.scores[sortedPlayers[0]] || 0;
  const winners = sortedPlayers.filter(p => (gameState.scores[p] || 0) === topScore);
  const medals = ['🥇', '🥈', '🥉'];

  if (showBoardPostGame) {
    return (
      <div style={{
        position: 'absolute', bottom: '4vh', left: '50%', transform: 'translateX(-50%)',
        zIndex: 999, display: 'flex', justifyContent: 'center'
      }}>
        <button
          onClick={() => setShowBoardPostGame(false)}
          style={{
            padding: '12px 24px', background: 'rgba(18,18,40,0.95)', color: '#ffd700',
            border: '2px solid #ffd700', borderRadius: 12, cursor: 'pointer',
            fontWeight: 'bold', fontSize: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(40,15,60,0.95)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(18,18,40,0.95)'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ← {t('game.backToResults')}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(135deg, rgba(18,18,40,0.97), rgba(40,15,60,0.97))',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, fontFamily: 'sans-serif', padding: '20px 10px', overflowY: 'auto'
    }}>
      <div style={{ fontSize: 'min(64px, 8vh)', marginBottom: '0.5vh' }}>🏰</div>
      <h1 style={{ color: '#ffd700', fontSize: 'min(36px, 4vh)', margin: '0 0 2px', textShadow: '0 2px 12px rgba(255,215,0,0.6)', textAlign: 'center' }}>{t('game.gameOverTitle')}</h1>
      <p style={{ color: '#aaa', margin: '0 0 16px', fontSize: 'min(16px, 2vh)', textAlign: 'center' }}>{t('game.gameOverSubtitle')}</p>

      {/* Winner banner */}
      <div style={{
        background: 'linear-gradient(90deg, #ffd700, #ff9800)',
        borderRadius: 14, padding: '8px 24px', marginBottom: '2vh',
        boxShadow: '0 4px 24px rgba(255,165,0,0.4)',
        maxWidth: '90%', textAlign: 'center'
      }}>
        <span style={{ fontSize: 'min(20px, 2.5vh)', fontWeight: 'bold', color: '#1a1a1a' }}>
          {winners.length === 1 ? t('game.playerWins', { name: gameState.playerNames[winners[0]] || winners[0] }) : `${t('game.tie')}: ${winners.map(p => gameState.playerNames[p] || p).join(' & ')}`}
        </span>
      </div>

      {/* Final score breakdown bars */}
      <div style={{ 
        display: 'flex', flexDirection: 'column', gap: '1vh', width: '100%', maxWidth: 480, 
        marginBottom: '2vh', flexShrink: 1, minHeight: 0
      }}>
        {(() => {
          const CATS = [
            { key: 'city' as const, label: t('game.categories.city'), color: '#c9a84c', midColor: '#e8cfa0' },
            { key: 'road' as const, label: t('game.categories.road'), color: '#9e9e9e', midColor: '#cfcfcf' },
            { key: 'monastery' as const, label: t('game.categories.monastery'), color: FEATURE_COLORS.monastery, midColor: '#f08080' },
            { key: 'field' as const, label: t('game.categories.field'), color: FEATURE_COLORS.field, midColor: '#90c994' },
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
                padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#eee', fontSize: 'min(15px, 1.8vh)' }}>{medals[rank] || '  '} {gameState.playerNames[pid] || t('startScreen.playerPlaceholder', { id: pid })}</span>
                  <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: 'min(18px, 2.2vh)' }}>{total} pts</span>
                </div>
                {/* Stacked bar */}
                <div style={{ display: 'flex', height: '1.8vh', minHeight: 14, borderRadius: 6, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', marginBottom: 4 }}>
                  {/* Mid-game segments (lighter shade, same category colours) */}
                  {midBreakdown && CATS.map(cat => {
                    const pts = midBreakdown[cat.key] || 0;
                    if (pts === 0) return null;
                    return (
                      <div key={`mid-${cat.key}`} title={`${t('game.midGame')} ${cat.label}: ${pts}pts`} style={{
                        width: `${(pts / maxScore) * 100}%`,
                        background: cat.midColor, minWidth: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: '#333', fontWeight: 'bold',
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
                        fontSize: 9, color: '#fff', fontWeight: 'bold',
                      }}>{pts > 4 ? pts : ''}</div>
                    );
                  })}
                </div>
                {/* Legend pills */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {midBreakdown && CATS.map(cat => {
                    const pts = midBreakdown[cat.key] || 0;
                    if (pts === 0) return null;
                    return <span key={`mid-${cat.key}`} style={{ fontSize: 9, background: cat.midColor, borderRadius: 10, padding: '1px 6px', color: '#333' }}>{t('game.midGame')} {cat.label} {pts}</span>;
                  })}
                  {breakdown && CATS.map(cat => {
                    const pts = breakdown[cat.key] || 0;
                    if (pts === 0) return null;
                    return <span key={cat.key} style={{ fontSize: 9, background: cat.color, borderRadius: 10, padding: '1px 6px', color: '#fff' }}>{cat.label} {pts}</span>;
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>
      <div style={{ display: 'flex', gap: 'min(2vw, 8px)', flexWrap: 'wrap', justifyContent: 'center', padding: '0 5px' }}>
        <button
          onClick={() => {
            setShowBoardPostGame(true);
            setShowFieldView(true);
          }}
          style={{
            padding: 'min(10px, 1.5vh) min(12px, 2vw)', fontSize: 'clamp(11px, 3.5vw, 15px)', fontWeight: 'bold',
            background: 'rgba(255,255,255,0.1)',
            color: '#ddd', border: '1px solid #555', borderRadius: 12, cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ddd'; }}
        >
          {t('game.viewBoard')}
        </button>
        {handlePlayAgain && (
          <button
            onClick={handlePlayAgain}
            style={{
              padding: 'min(10px, 1.5vh) min(16px, 3vw)', fontSize: 'clamp(13px, 4vw, 17px)', fontWeight: 'bold',
              background: `linear-gradient(90deg, ${UI_COLORS.primary}, ${UI_COLORS.primaryLight})`,
              color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(33,150,243,0.5)',
              transition: 'transform 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {t('game.playAgain')}
          </button>
        )}
        <button
          onClick={handleBackToMainMenu}
          style={{
            padding: 'min(10px, 1.5vh) min(10px, 2vw)', fontSize: 'clamp(10px, 3vw, 13px)', fontWeight: 'bold',
            background: 'rgba(255,255,255,0.05)',
            color: '#bbb', border: '1px solid #444', borderRadius: 12, cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#bbb'; }}
        >
          {t('game.backToMainMenu')}
        </button>
      </div>
    </div>
  );
};
