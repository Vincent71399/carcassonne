import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState, PlayerId, MeepleType } from '../engine/types';
import { PLAYER_COLORS, UI_COLORS } from '../utils/styles';

interface MeeplePlacementPanelProps {
  gameState: GameState;
  currentPlayer: PlayerId;
  isMobile: boolean;
  selectedMeepleType: MeepleType;
  setSelectedMeepleType: (type: MeepleType) => void;
  onCancel: () => void;
  onSkip: () => void;
}

export const MeeplePlacementPanel: React.FC<MeeplePlacementPanelProps> = ({
  gameState,
  currentPlayer,
  isMobile,
  selectedMeepleType,
  setSelectedMeepleType,
  onCancel,
  onSkip,
}) => {
  const { t } = useTranslation();

  const standardLeft = gameState.remainingMeeples[currentPlayer]?.standard ?? 0;
  const largeLeft = gameState.remainingMeeples[currentPlayer]?.large ?? 0;
  const hasNoMeeples = standardLeft === 0 && largeLeft === 0;

  // Sync selected meeple type if the current type is unavailable
  React.useEffect(() => {
    if (selectedMeepleType === 'standard' && standardLeft === 0 && largeLeft > 0) {
      setSelectedMeepleType('large');
    } else if (selectedMeepleType === 'large' && largeLeft === 0 && standardLeft > 0) {
      setSelectedMeepleType('standard');
    }
  }, [selectedMeepleType, standardLeft, largeLeft, setSelectedMeepleType]);

  const effectiveType = selectedMeepleType;

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

      {!hasNoMeeples && (largeLeft > 0 || standardLeft > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          <button
            onClick={() => setSelectedMeepleType('standard')}
            disabled={standardLeft === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', fontSize: '14px', borderRadius: '15px', border: '1px solid #ccc',
              background: effectiveType === 'standard' ? UI_COLORS.primary : '#f0f0f0',
              color: effectiveType === 'standard' ? '#fff' : (standardLeft === 0 ? '#aaa' : '#333'),
              cursor: standardLeft > 0 ? 'pointer' : 'default', opacity: standardLeft === 0 ? 0.5 : 1
            }}
          >
            <svg width="14" height="18" viewBox="-7 -10 14 20" style={{ display: 'block' }}>
              <circle cx="0" cy="-5" r="4" fill={PLAYER_COLORS[currentPlayer] || '#999'} stroke="#fff" strokeWidth="1.5" />
              <path d="M -5 8 L -3 -1 Q 0 -3 3 -1 L 5 8 L 2 8 L 1 3 L -1 3 L -2 8 Z" fill={PLAYER_COLORS[currentPlayer] || '#999'} stroke="#fff" strokeWidth="1.5" />
            </svg>
            <span style={{ fontWeight: 'bold' }}>{standardLeft}</span>
          </button>
          {(largeLeft > 0 || (gameState.deck && gameState.deck.length < 70)) && (
            <button
              onClick={() => setSelectedMeepleType('large')}
              disabled={largeLeft === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', fontSize: '14px', borderRadius: '15px', border: '1px solid #ccc',
                background: effectiveType === 'large' ? UI_COLORS.primary : '#f0f0f0',
                color: effectiveType === 'large' ? '#fff' : (largeLeft === 0 ? '#aaa' : '#333'),
                cursor: largeLeft > 0 ? 'pointer' : 'default', opacity: largeLeft === 0 ? 0.5 : 1
              }}
            >
              <svg width="18" height="22" viewBox="-9 -12 18 24" style={{ display: 'block' }}>
                <g transform="scale(1.2)">
                  <circle cx="0" cy="-5" r="4" fill={PLAYER_COLORS[currentPlayer] || '#999'} stroke="#fff" strokeWidth="1.5" />
                  <path d="M -5 8 L -3 -1 Q 0 -3 3 -1 L 5 8 L 2 8 L 1 3 L -1 3 L -2 8 Z" fill={PLAYER_COLORS[currentPlayer] || '#999'} stroke="#fff" strokeWidth="1.5" />
                  <text x="0" y="-3.5" fontSize="4.5" fontWeight="bold" textAnchor="middle" fill="#fff">2</text>
                </g>
              </svg>
              <span style={{ fontWeight: 'bold' }}>{largeLeft}</span>
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
        <button
          onClick={onCancel}
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
          onClick={onSkip}
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
};

export default MeeplePlacementPanel;
