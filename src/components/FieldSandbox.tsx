import React, { useState, useMemo } from 'react';
import { Board } from './Board';
import type { GameState, PlayerId } from '../engine/types';
import { BASE_TILES, TILES_MAP } from '../engine/tiles';
import { getValidPlacements } from '../engine/board';
import { scoreEndGame } from '../engine/scoring';
import { computeFieldConquest } from '../engine/fieldConquest';
import { TileRenderer } from './TileRenderer';
import { PLAYER_COLORS } from '../utils/styles.ts';

export const FieldSandbox: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // Sandbox specific state
    const [board, setBoard] = useState<GameState['board']>({});
    const [selectedTypeId, setSelectedTypeId] = useState<string>('Start');
    const [rotations, setRotations] = useState<Record<string, number>>({});
    const currentRotation = rotations[selectedTypeId] || 0;
    const [mode, setMode] = useState<'tile' | 'meeple-1' | 'meeple-2' | 'meeple-3' | 'meeple-4'>('tile');
    const [meepleTilePos, setMeepleTilePos] = useState<{ x: number, y: number } | null>(null);

    // Pan and Zoom state for the Board component
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);

    // For valid placements
    const validPlacements = useMemo(() => {
        if (Object.keys(board).length === 0) return [{ x: 0, y: 0 }];
        const def = TILES_MAP[selectedTypeId];
        if (!def) return [];
        return getValidPlacements(board, def, currentRotation);
    }, [board, selectedTypeId, currentRotation]);

    const fieldConquest = useMemo(() => {
        return computeFieldConquest({ board, players: [1, 2, 3, 4] } as unknown as GameState);
    }, [board]);

    // Dummy state for Board component
    const dummyState: GameState = useMemo(() => ({
        players: [1, 2, 3, 4],
        deck: [],
        board,
        endGameScoreBreakdown: {
            1: { city: 0, road: 0, monastery: 0, field: 0 },
            2: { city: 0, road: 0, monastery: 0, field: 0 },
            3: { city: 0, road: 0, monastery: 0, field: 0 },
            4: { city: 0, road: 0, monastery: 0, field: 0 }
        }
    } as unknown as GameState), [board]);

    const calculatedScores = useMemo(() => {
        const updates = scoreEndGame(dummyState);
        return updates.filter(u => u.category === 'field');
    }, [dummyState]);

    const handlePlacementClick = (x: number, y: number) => {
        if (mode !== 'tile') return;
        const key = `${x},${y}`;
        const newBoard = { ...board };
        newBoard[key] = {
            id: `sb-${Date.now()}`,
            typeId: selectedTypeId,
            x, y, rotation: currentRotation,
            meeples: []
        };
        setBoard(newBoard);
    };

    const handleTileClick = (x: number, y: number, e?: React.MouseEvent) => {
        if (e && e.type === 'contextmenu') {
            e.preventDefault();
            const key = `${x},${y}`;
            if (board[key]) {
                const newBoard = { ...board };
                delete newBoard[key];
                setBoard(newBoard);
            }
            return;
        }

        if (mode.startsWith('meeple')) {
            setMeepleTilePos({ x, y });
        }
    };

    const handleFeatureClick = (featureId: string, pt?: { x: number, y: number }) => {
        if (!mode.startsWith('meeple')) return;
        if (!featureId.startsWith('field-')) return; // Sandbox is pure fields

        const key = pt ? `${pt.x},${pt.y}` : (meepleTilePos ? `${meepleTilePos.x},${meepleTilePos.y}` : '');
        if (!key) return;

        const tile = board[key];
        if (!tile) return;

        const playerId = parseInt(mode.split('-')[1], 10) as PlayerId;

        // Toggle meeple
        const existingIdx = tile.meeples.findIndex(m => m.featureId === featureId && m.meeple.playerId === playerId);
        const newMeeples = [...tile.meeples];
        if (existingIdx >= 0) {
            newMeeples.splice(existingIdx, 1);
        } else {
            newMeeples.push({
                featureId,
                meeple: { id: `m-${Date.now()}`, playerId, type: 'standard' }
            });
        }

        setBoard({
            ...board,
            [key]: { ...tile, meeples: newMeeples }
        });
        setMeepleTilePos(null);
    };

    const handleClear = () => {
        setBoard({});
        setMeepleTilePos(null);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#f0f0f0', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 20px', background: '#333', color: 'white', display: 'flex', gap: 20, alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>🌾 Field Sandbox</h2>

                <div style={{ display: 'flex', gap: 10, background: '#444', padding: 5, borderRadius: 6 }}>
                    <button
                        style={{ padding: '6px 12px', background: mode === 'tile' ? '#fff' : 'transparent', color: mode === 'tile' ? '#000' : '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => { setMode('tile'); setMeepleTilePos(null); }}
                    >Place Tiles</button>
                    <button
                        style={{ padding: '6px 12px', background: mode === 'meeple-1' ? PLAYER_COLORS[1] : 'transparent', color: '#fff', border: '1px solid ' + PLAYER_COLORS[1], borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => { setMode('meeple-1'); }}
                    >P1 Fields</button>
                    <button
                        style={{ padding: '6px 12px', background: mode === 'meeple-2' ? PLAYER_COLORS[2] : 'transparent', color: '#fff', border: '1px solid ' + PLAYER_COLORS[2], borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => { setMode('meeple-2'); }}
                    >P2 Fields</button>
                    <button
                        style={{ padding: '6px 12px', background: mode === 'meeple-3' ? PLAYER_COLORS[3] : 'transparent', color: '#fff', border: '1px solid ' + PLAYER_COLORS[3], borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => { setMode('meeple-3'); }}
                    >P3 Fields</button>
                    <button
                        style={{ padding: '6px 12px', background: mode === 'meeple-4' ? PLAYER_COLORS[4] : 'transparent', color: '#fff', border: '1px solid ' + PLAYER_COLORS[4], borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => { setMode('meeple-4'); }}
                    >P4 Fields</button>
                </div>

                <div style={{ flex: 1 }}></div>
                <button
                    style={{ padding: '6px 16px', background: '#e53935', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    onClick={handleClear}
                >Clear</button>
                <button
                    style={{ padding: '6px 16px', background: '#666', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    onClick={onClose}
                >Exit</button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left Sidebar */}
                <div style={{ width: 200, background: 'white', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
                    {mode === 'tile' && (
                        <div style={{ padding: 15, borderBottom: '1px solid #eee' }}>
                            <h4 style={{ margin: '0 0 10px 0' }}>Rotate</h4>
                            <div style={{ display: 'flex', gap: 5 }}>
                                <button onClick={() => setRotations(r => ({ ...r, [selectedTypeId]: ((r[selectedTypeId] || 0) + 3) % 4 }))} style={{ flex: 1, padding: 8 }}>↺</button>
                                <button onClick={() => setRotations(r => ({ ...r, [selectedTypeId]: ((r[selectedTypeId] || 0) + 1) % 4 }))} style={{ flex: 1, padding: 8 }}>↻</button>
                            </div>
                        </div>
                    )}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                        <h4 style={{ margin: '0 0 10px 0' }}>Tiles</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {['Start', ...BASE_TILES.map(t => t.typeId)].map(tid => (
                                <div
                                    key={tid}
                                    onClick={() => {
                                        setSelectedTypeId(tid);
                                        setMode('tile');
                                    }}
                                    style={{
                                        width: 60, height: 60,
                                        background: '#e0e0e0',
                                        border: selectedTypeId === tid ? '3px solid #1976d2' : '1px solid #ccc',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        borderRadius: 4
                                    }}
                                >
                                    <div style={{ position: 'absolute', top: 2, left: 2, zIndex: 10, fontSize: 10, fontWeight: 'bold', background: 'rgba(255,255,255,0.7)', padding: '0 4px', borderRadius: 4 }}>{tid}</div>
                                    <div style={{ transform: selectedTypeId === tid ? `rotate(${currentRotation * 90}deg)` : `rotate(${(rotations[tid] || 0) * 90}deg)`, transition: 'transform 0.2s', width: '100%', height: '100%' }}>
                                        <TileRenderer def={TILES_MAP[tid]} size={60} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, position: 'relative' }} onContextMenu={(e) => e.preventDefault()}>
                    <Board
                        state={dummyState}
                        pan={pan}
                        setPan={setPan}
                        zoom={zoom}
                        setZoom={setZoom}
                        validPlacements={mode === 'tile' ? validPlacements : []}
                        onPlacementClick={handlePlacementClick}
                        onTileClick={handleTileClick}
                        onFeatureClick={handleFeatureClick}
                        meepleTilePosition={meepleTilePos}
                        fieldConquest={fieldConquest}
                        allTilesInteractive={mode.startsWith('meeple')}
                        sandboxMode={true}
                    />

                    {/* Temporary Instructions Overlay */}
                    <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px 20px', borderRadius: 20, pointerEvents: 'none', textAlign: 'center' }}>
                        {mode === 'tile' ? "Select a tile on the left, rotate it, and click a green square to place." : "Click any grassy field dot to toggle a meeple."}
                        <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Right-click a placed tile to remove it.</div>
                    </div>
                </div>

                {/* Right Sidebar - Scores */}
                <div style={{ width: 250, background: 'white', borderLeft: '1px solid #ddd', display: 'flex', flexDirection: 'column', padding: 15, overflowY: 'auto' }}>
                    <h3 style={{ margin: '0 0 15px 0', borderBottom: '2px solid #eee', paddingBottom: 10 }}>Live Farm Scores</h3>
                    {calculatedScores.length === 0 ? (
                        <div style={{ color: '#888', fontStyle: 'italic', fontSize: 13, lineHeight: '1.5' }}>
                            No farm points yet.<br /><br />
                            Place farmer meeples on fields that touch <b>completed cities</b> to see score breakdowns here.
                        </div>
                    ) : (
                        calculatedScores.map((sc, i) => (
                            <div key={i} style={{ padding: 10, background: '#f5f5f5', borderRadius: 6, marginBottom: 10 }}>
                                <div style={{ fontWeight: 'bold' }}>{sc.featureName}</div>
                                <div style={{ marginTop: 5 }}>
                                    {sc.players.map((p: PlayerId) => (
                                        <span key={p} style={{ background: PLAYER_COLORS[p], color: 'white', padding: '2px 6px', borderRadius: 4, marginRight: 5, fontSize: 12 }}>
                                            P{p}: +{sc.points}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
