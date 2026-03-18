import React from 'react';
import { useTranslation } from 'react-i18next';
import { BASE_TILES } from '../engine/tiles';
import { TileRenderer } from './TileRenderer';
import { PLAYER_COLORS, UI_COLORS } from '../utils/styles';
import { getCityMaskPaths, getRoadMaskPaths } from '../engine/fieldConquest';

interface TileGalleryProps {
  showFieldView: boolean;
  setShowFieldView: (val: boolean | ((prev: boolean) => boolean)) => void;
  onClose: () => void;
}

export const TileGallery: React.FC<TileGalleryProps> = ({
  showFieldView,
  setShowFieldView,
  onClose
}) => {
  const { t } = useTranslation();

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(255,255,255,0.98)',
      zIndex: 2000, overflowY: 'auto', padding: '40px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <h2 style={{ color: '#333', margin: 0 }}>{t('game.tileGalleryTitle')}</h2>
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
            onClick={onClose}
            style={{
              background: UI_COLORS.danger, color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontSize: 16, cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {t('game.close')}
          </button>
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
          const cityPaths = getCityMaskPaths(def);
          const roadPaths = getRoadMaskPaths(def);
          const hasMonastery = !!def.monastery;

          return (
            <div key={def.typeId} style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', width: 140, height: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: 4 }}>
                <TileRenderer
                  def={def} size={140}
                  placed={{ id: 'gal', typeId: def.typeId, x: 0, y: 0, rotation: 0, meeples: [] }}
                />
                {showFieldView && def.fieldConnections && def.fieldConnections.map((_, fIdx) => {
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
                })}
              </div>
              <h4 style={{ margin: '8px 0 0', color: '#555' }}>{t('game.tileId', { id: def.typeId })}</h4>
            </div>
          );
        })}
      </div>
    </div>
  );
};
