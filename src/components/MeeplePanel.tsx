import React from 'react';
import type { GameState, PlayerId, TileDefinition, EdgeDirection } from '../engine/types';
import { TILES_MAP } from '../engine/tiles';
import { FEATURE_COLORS } from '../utils/styles.ts';

interface MeeplePanelProps {
    state: GameState;
    playerId: PlayerId;
    onPlaceMeeple: (featureId: string) => void;
    onSkip: () => void;
}

interface FeatureOption {
    id: string;
    label: string;
    type: 'city' | 'road' | 'monastery' | 'field';
    color: string;
}

// Rotate a connection list by the given rotation count
function rotateConnection(conn: EdgeDirection[], rotation: number): EdgeDirection[] {
    const order: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
    return conn.map(edge => {
        const idx = order.indexOf(edge);
        return order[(idx + rotation) % 4];
    });
}

function getFeatureOptions(tileDef: TileDefinition, rotation: number): FeatureOption[] {
    const options: FeatureOption[] = [];

    // City features
    if (tileDef.cityConnections) {
        tileDef.cityConnections.forEach((conn, idx) => {
            const rotated = rotateConnection(conn, rotation);
            options.push({
                id: `city-${idx}`,
                label: `City (${rotated.join(', ')})`,
                type: 'city',
                color: FEATURE_COLORS.city
            });
        });
    }

    // Road features
    if (tileDef.roadConnections) {
        tileDef.roadConnections.forEach((conn, idx) => {
            const rotated = rotateConnection(conn, rotation);
            options.push({
                id: `road-${idx}`,
                label: `Road (${rotated.join(', ')})`,
                type: 'road',
                color: FEATURE_COLORS.road
            });
        });
    }

    // Monastery
    if (tileDef.monastery) {
        options.push({
            id: 'monastery-0',
            label: 'Monastery',
            type: 'monastery',
            color: FEATURE_COLORS.monastery
        });
    }

    return options;
}

export const MeeplePanel: React.FC<MeeplePanelProps> = ({
    state,
    playerId,
    onPlaceMeeple,
    onSkip
}) => {
    if (!state.recentTilePosition) return null;

    const tile = state.board[`${state.recentTilePosition.x},${state.recentTilePosition.y}`];
    if (!tile) return null;

    const tileDef = TILES_MAP[tile.typeId];
    if (!tileDef) return null;

    const features = getFeatureOptions(tileDef, tile.rotation);
    const meepleCount = state.remainingMeeples[playerId]?.standard ?? 0;

    return (
        <div style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255,255,255,0.95)',
            padding: '20px 30px',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            backdropFilter: 'blur(10px)',
            zIndex: 100,
            minWidth: '360px'
        }}>
            <h3 style={{ margin: 0, color: '#333', fontSize: '16px' }}>
                Place Meeple? <span style={{ fontWeight: 'normal', color: '#888' }}>(Player {playerId}, {meepleCount} left)</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                {features.map(f => (
                    <button
                        key={f.id}
                        onClick={() => onPlaceMeeple(f.id)}
                        disabled={meepleCount <= 0}
                        style={{
                            padding: '10px 16px',
                            backgroundColor: meepleCount > 0 ? f.color : '#eee',
                            color: meepleCount > 0 ? '#fff' : '#999',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: meepleCount > 0 ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            textShadow: meepleCount > 0 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                            transition: 'transform 0.1s, box-shadow 0.1s',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}
                    >
                        🧍 {f.label}
                    </button>
                ))}
            </div>

            <button
                onClick={onSkip}
                style={{
                    padding: '8px 24px',
                    backgroundColor: 'transparent',
                    color: '#888',
                    border: '2px solid #ccc',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px',
                    width: '100%'
                }}
            >
                Skip (No Meeple)
            </button>
        </div>
    );
};
