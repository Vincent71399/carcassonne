import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TileDefinition } from '../engine/types';
import { TileRenderer } from './TileRenderer';
import { BASE_TILES, TILES_MAP } from '../engine/tiles';

interface DeckViewerProps {
    deck: TileDefinition[];
    onClose: () => void;
}

// All tile types to display (original definitions with their max count)
const ALL_TILE_TYPES: TileDefinition[] = BASE_TILES.filter(
    (t, i, arr) => arr.findIndex(x => x.typeId === t.typeId) === i
);

export const DeckViewer: React.FC<DeckViewerProps> = ({ deck, onClose }) => {
    const { t } = useTranslation();
    // Count remaining tiles per typeId in the deck
    const remainingByType: Record<string, number> = {};
    for (const t of deck) {
        remainingByType[t.typeId] = (remainingByType[t.typeId] || 0) + 1;
    }

    return (
        <div
            onClick={onClose}
            style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.65)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 500,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'linear-gradient(160deg, #2a2a3e, #1c1c28)',
                    borderRadius: 20,
                    maxWidth: 720,
                    maxHeight: '80vh',
                    boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
                    position: 'relative',
                    fontFamily: 'sans-serif',
                    color: '#eee',
                    width: '90vw',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#ffd700', fontSize: 22 }}>🃏 {t('deckViewer.title')}</h2>
                        <p style={{ margin: '4px 0 0', color: '#aaa', fontSize: 13 }}>
                            {t('deckViewer.remaining', { count: deck.length })}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
                            color: '#fff', fontSize: 18, cursor: 'pointer', padding: '4px 10px',
                        }}
                    >✕</button>
                </div>

                {/* Tile grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                    gap: 16,
                    padding: '16px 28px 24px',
                    overflowY: 'auto',
                }}>
                    {ALL_TILE_TYPES.map(tileDef => {
                        const remaining = remainingByType[tileDef.typeId] ?? 0;
                        const total = TILES_MAP[tileDef.typeId]?.count ?? tileDef.count;
                        const depleted = remaining === 0;

                        return (
                            <div key={tileDef.typeId} style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: 6,
                            }}>
                                <div style={{
                                    opacity: depleted ? 0.30 : 1,
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    border: depleted
                                        ? '2px solid rgba(255,255,255,0.1)'
                                        : '2px solid rgba(255,215,0,0.3)',
                                    filter: depleted ? 'grayscale(1)' : 'none',
                                    transition: 'all 0.2s',
                                }}>
                                    <TileRenderer
                                        def={tileDef}
                                        size={80}
                                        placed={{ id: 'preview', typeId: tileDef.typeId, x: 0, y: 0, rotation: 0, meeples: [] }}
                                        interactive={false}
                                    />
                                </div>
                                <div style={{
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                    color: depleted ? '#666' : '#ffd700',
                                    letterSpacing: '0.5px',
                                }}>
                                    {remaining} / {total}
                                </div>
                                <div style={{ fontSize: 11, color: '#888' }}>{tileDef.typeId}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
