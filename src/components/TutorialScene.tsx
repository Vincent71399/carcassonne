import React from 'react';
import { useTranslation } from 'react-i18next';
import { TileRenderer } from './TileRenderer';
import { TILES_MAP } from '../engine/tiles';
import { PLAYER_COLORS } from '../engine/constants';
import { getCityMaskPaths, getRoadMaskPaths } from '../engine/fieldConquest';
import type { PlayerId, PlacedTile } from '../engine/types';

interface TutorialSceneProps {
    tiles: PlacedTile[];
    validPlacements?: { x: number, y: number }[];
    meepleHighlightPos?: { x: number, y: number };
    scoreUpdate?: { x: number, y: number, points: number, text: string };
    fieldConquest?: Map<string, PlayerId[]>;
    handTile?: string;
    showMockUI?: boolean;
    mockHand?: string[];
    mockScores?: { name: string, score: number, color: string }[];
    extraMeeples?: { x: number, y: number, playerId: PlayerId }[];
    showStartPreview?: boolean;
    highlightButton?: boolean;
    size?: number;
    isMobile?: boolean;
}

export const TutorialScene: React.FC<TutorialSceneProps> = ({
    tiles,
    validPlacements = [],
    meepleHighlightPos,
    scoreUpdate,
    fieldConquest,
    handTile,
    showMockUI = false,
    mockHand = [],
    mockScores,
    extraMeeples = [],
    showStartPreview = false,
    highlightButton = false,
    size = 350,
    isMobile = false
}) => {
    const { t } = useTranslation();
    const scores = mockScores || [
        { name: t('startScreen.playerPlaceholder', { id: 1 }).replace('{{id}}', '1'), score: 42, color: '#e74c3c' },
        { name: t('startScreen.computer'), score: 38, color: '#3498db' }
    ];
    // Determine bounds to center the tiles
    const minX = Math.min(...tiles.map(t => t.x), ...validPlacements.map(p => p.x));
    const maxX = Math.max(...tiles.map(t => t.x), ...validPlacements.map(p => p.x));
    const minY = Math.min(...tiles.map(t => t.y), ...validPlacements.map(p => p.y));
    const maxY = Math.max(...tiles.map(t => t.y), ...validPlacements.map(p => p.y));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const scale = size / (Math.max(maxX - minX + 1.5, maxY - minY + 1.5) * 100);
    const tileSize = 100 * scale;

    return (
        <div style={{
            width: size, height: size,
            backgroundColor: '#f0e6d2',
            borderRadius: isMobile ? '0px' : '16px',
            overflow: 'hidden',
            position: 'relative',
            border: '2px solid rgba(0,0,0,0.1)'
        }}>
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%)`,
                width: '100%',
                height: '100%'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(${-centerX * tileSize}px, ${-centerY * tileSize}px)`,
                }}>
                    {tiles.map(placed => {
                        const def = TILES_MAP[placed.typeId];
                        const isMeepleSpot = meepleHighlightPos && placed.x === meepleHighlightPos.x && placed.y === meepleHighlightPos.y;

                        return (
                            <div key={`${placed.x},${placed.y}`} style={{
                                position: 'absolute',
                                left: placed.x * tileSize - tileSize / 2,
                                top: placed.y * tileSize - tileSize / 2,
                                width: tileSize,
                                height: tileSize
                            }}>
                                <TileRenderer
                                    def={def}
                                    placed={placed}
                                    size={tileSize}
                                    meeplePlacementMode={isMeepleSpot}
                                    animate={false}
                                />

                                {fieldConquest && def.fieldConnections && def.fieldConnections.map((_, fIdx) => {
                                    const key = `${placed.x},${placed.y},${fIdx}`;
                                    const winners = fieldConquest.get(key);
                                    if (!winners) return null;

                                    const fieldD = def.fieldPaths?.[fIdx];
                                    const patId = `tut-pat-${placed.x}-${placed.y}-${fIdx}`;
                                    const maskId = `tut-msk-${placed.x}-${placed.y}-${fIdx}`;
                                    const clipId = `tut-clp-${placed.x}-${placed.y}-${fIdx}`;
                                    const color = PLAYER_COLORS[winners[0]];

                                    return (
                                        <svg key={fIdx} width={tileSize} height={tileSize} viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', transform: `rotate(${placed.rotation * 90}deg)` }}>
                                            <defs>
                                                <pattern id={patId} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                                    <rect width="10" height="10" fill={color} fillOpacity="0.22" />
                                                    <line x1="0" y1="5" x2="10" y2="5" stroke={color} strokeWidth="4" strokeOpacity="0.7" />
                                                </pattern>
                                                <mask id={maskId}>
                                                    <rect width="100" height="100" fill="white" />
                                                    {getCityMaskPaths(def).map((d, i) => <path key={i} d={d} fill="black" />)}
                                                    {getRoadMaskPaths(def).map((d, i) => <path key={i} d={d} fill="none" stroke="black" strokeWidth="12" />)}
                                                    {def.monastery && <circle cx="50" cy="50" r="24" fill="black" />}
                                                </mask>
                                                <clipPath id={clipId}>
                                                    {def.fieldConnections!.length === 1 ? <rect width="100" height="100" /> : <path d={fieldD} />}
                                                </clipPath>
                                            </defs>
                                            <rect width="100" height="100" fill={`url(#${patId})`} mask={`url(#${maskId})`} clipPath={`url(#${clipId})`} />
                                        </svg>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {validPlacements.map((pos, idx) => (
                        <div key={`valid-${idx}`} style={{
                            position: 'absolute',
                            left: Math.round(pos.x * tileSize - tileSize / 2 + (tileSize * 0.05)),
                            top: Math.round(pos.y * tileSize - tileSize / 2 + (tileSize * 0.05)),
                            width: Math.round(tileSize * 0.9),
                            height: Math.round(tileSize * 0.9),
                            backgroundColor: 'rgba(76, 175, 80, 0.4)',
                            border: `${Math.max(1, Math.round(3 * scale))}px dashed #388e3c`,
                            borderRadius: `${Math.max(2, Math.round(10 * scale))}px`,
                            boxSizing: 'border-box',
                            animation: 'none'
                        }} />
                    ))}

                    {scoreUpdate && (
                        <div style={{
                            position: 'absolute',
                            left: scoreUpdate.x * tileSize,
                            top: scoreUpdate.y * tileSize - 40 * scale,
                            transform: 'translateX(-50%)',
                            backgroundColor: 'white',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            border: '2px solid #ffb300',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                            zIndex: 10,
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            animation: 'scoreFloatUp 1.5s ease-out infinite'
                        }}>
                            <span style={{ fontSize: '18px', fontWeight: '900', color: '#f57c00' }}>+{scoreUpdate.points}</span>
                            <span style={{ fontSize: '10px', color: '#424242', fontWeight: 'bold' }}>{scoreUpdate.text}</span>
                        </div>
                    )}

                    {extraMeeples.map((m, idx) => (
                        <div key={`extra-${idx}`} style={{
                            position: 'absolute',
                            left: m.x * tileSize - (12 * scale),
                            top: m.y * tileSize - (12 * scale),
                            width: 24 * scale,
                            height: 24 * scale,
                            backgroundColor: PLAYER_COLORS[m.playerId],
                            borderRadius: '50%',
                            border: `${2 * scale}px solid white`,
                            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                            zIndex: 25
                        }} />
                    ))}
                </div>
            </div>

            {handTile && (
                <div style={{
                    position: 'absolute', bottom: 10, right: 10,
                    padding: '8px', background: 'rgba(255,255,255,0.9)',
                    borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>{t('tutorial.inHand')}</span>
                    <TileRenderer def={TILES_MAP[handTile]} size={60} style={{ borderRadius: '4px' }} animate={false} />
                </div>
            )}

            {showMockUI && (
                <>
                    {/* Mock Scoreboard */}
                    <div style={{
                        position: 'absolute', top: 10, left: 10,
                        backgroundColor: 'rgba(255,255,255,0.92)', padding: '10px',
                        borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                        zIndex: 20, pointerEvents: 'none', transform: 'scale(0.85)', transformOrigin: 'top left',
                        display: 'flex', flexDirection: 'column', gap: '6px'
                    }}>
                        {scores.map((s, i) => (
                            <div key={i} style={{
                                fontSize: '12px', fontWeight: '800',
                                borderLeft: `4px solid ${s.color}`, paddingLeft: '8px',
                                color: '#2c3e50', display: 'flex', justifyContent: 'space-between', gap: '15px'
                            }}>
                                <span>{s.name}</span>
                                <span style={{ color: s.color }}>{s.score}</span>
                            </div>
                        ))}
                    </div>

                    {/* Mock Hand */}
                    <div style={{
                        position: 'absolute', bottom: 10, left: '50%',
                        transform: 'translateX(-50%) scale(0.75)',
                        backgroundColor: 'rgba(255,255,255,0.95)', padding: '12px',
                        borderRadius: '16px', boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                        display: 'flex', gap: '10px', zIndex: 20, pointerEvents: 'none',
                        border: '1px solid rgba(0,0,0,0.05)'
                    }}>
                        {mockHand.map((tId, i) => (
                            <TileRenderer key={i} def={TILES_MAP[tId]} size={60} style={{ borderRadius: '4px' }} animate={false} />
                        ))}
                    </div>
                </>
            )}

            {showStartPreview && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '20px', zIndex: 30, transform: 'scale(1)', borderRadius: '14px'
                }}>
                    <h1 style={{
                        margin: 0, textAlign: 'center', fontSize: '36px', fontWeight: 'bold',
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)', color: 'white'
                    }}>{t('startScreen.title')}</h1>
                    <div style={{
                        padding: '12px 30px', background: '#2ecc71', color: 'white',
                        borderRadius: '8px', fontWeight: 'bold', fontSize: '18px',
                        boxShadow: '0 4px 15px rgba(46, 204, 113, 0.4)', position: 'relative'
                    }}>
                        {t('startScreen.startGame').toUpperCase()}
                        {highlightButton && (
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '130%', height: '160%',
                                border: '4px solid #e74c3c', borderRadius: '40px',
                                animation: 'tutorial-button-pulse-red 2s infinite'
                            }} />
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes tutorial-button-pulse-red {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
                }
            `}</style>
        </div>
    );
};
