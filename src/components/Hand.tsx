import React from 'react';
import type { GameState, PlayerId } from '../engine/types';
import { TileRenderer } from './TileRenderer';

// Symmetric tiles where rotation has no functional effect
const SYMMETRIC_TILES = new Set(['D', 'E', 'T']);

interface HandProps {
    state: GameState;
    playerId: PlayerId;
    playerColor: string;
    selectedIndex: number;
    currentRotation: number;
    onSelect: (index: number) => void;
    onRotate: () => void;
    isMobile?: boolean;
}

export const Hand: React.FC<HandProps> = ({
    state,
    playerId,
    playerColor,
    selectedIndex,
    currentRotation,
    onSelect,
    onRotate,
    isMobile = false
}) => {
    const hand = state.hands[playerId] || [];
    const selectedTile = selectedIndex !== -1 ? hand[selectedIndex] : null;
    const canRotate = selectedIndex !== -1 && selectedTile && !SYMMETRIC_TILES.has(selectedTile.typeId);

    // Get player name from state.playerNames
    const playerName = state.playerNames[playerId] || `Player ${playerId}`;

    return (
        <div style={{
            position: isMobile ? 'relative' : 'absolute',
            bottom: isMobile ? 0 : 20,
            left: isMobile ? 'unset' : '50%',
            transform: isMobile ? 'unset' : 'translateX(-50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: isMobile ? '10px 20px' : '20px 40px',
            borderRadius: isMobile ? '0px' : '20px',
            boxShadow: isMobile ? 'none' : '0 10px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: isMobile ? '10px' : '20px',
            backdropFilter: 'blur(10px)',
            width: isMobile ? '100%' : 'auto',
            boxSizing: 'border-box'
        }}>
            {/* Player colour indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                    display: 'inline-block',
                    width: 32, height: 6,
                    borderRadius: 3,
                    background: playerColor,
                    boxShadow: `0 0 6px ${playerColor}88`,
                }} />
                {/* Updated to use playerName */}
                <h3 style={{ margin: 0, color: '#333' }}>{playerName}'s Hand</h3>
                <span style={{
                    display: 'inline-block',
                    width: 32, height: 6,
                    borderRadius: 3,
                    background: playerColor,
                    boxShadow: `0 0 6px ${playerColor}88`,
                }} />
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
                {hand.map((tileDef, idx) => (
                    <TileRenderer
                        key={`${tileDef.typeId}-${idx}`}
                        def={tileDef}
                        size={120}
                        interactive
                        selected={selectedIndex === idx}
                        placed={selectedIndex === idx ? { id: 'hand', typeId: tileDef.typeId, x: 0, y: 0, rotation: currentRotation, meeples: [] } : undefined}
                        onClick={() => {
                            if (selectedIndex !== idx) {
                                // Reset rotation when selecting a new tile
                                onSelect(idx);
                            }
                        }}
                    />
                ))}
            </div>
            <button
                onClick={onRotate}
                disabled={!canRotate}
                style={{
                    padding: '10px 20px',
                    backgroundColor: canRotate ? '#1976d2' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: canRotate ? 'pointer' : 'not-allowed',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                }}
            >
                Rotate Selected
            </button>
        </div>
    );
};
