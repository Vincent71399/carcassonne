import React, { useState, useEffect } from 'react';
import type { PlayerType } from '../engine/types';
import { DEBUG_MODE } from '../engine/constants';
import { TutorialModal } from './TutorialModal';

interface StartScreenProps {
    onStartGame: (playerNames: Record<number, string>, playerTypes: Record<number, PlayerType>) => void;
}

const AI_NAMES = [
    'Miso', 'Pippin', 'Nibble', 'Dot', 'Pebble', 'Orbit', 'Flux', 'Pivot', 'Moor', 'Abbey', 'Sentinel', 'Warden', 'Cipher', 'Vector', 'Nexus', 'Castell', 'Rampart', 'Bastion', 'Keep', 'Relic', 'Razor', 'Blade', 'Fang', 'Viper', 'Talon', 'Spike'
];

const getRandomAiName = (existingNames: string[] = []) => {
    const availableNames = AI_NAMES.filter(name => !existingNames.includes(`${name} (AI)`));
    const pool = availableNames.length > 0 ? availableNames : AI_NAMES;
    const name = pool[Math.floor(Math.random() * pool.length)];
    return `${name} (AI)`;
};

export const StartScreen: React.FC<StartScreenProps> = ({ onStartGame }) => {
    const [showTutorial, setShowTutorial] = useState(false);
    const [mode, setMode] = useState<'local' | 'online'>(() => {
        const saved = localStorage.getItem('carcassonne_mode');
        return (saved as 'local' | 'online') || 'local';
    });
    const [playerCount, setPlayerCount] = useState<number>(() => {
        const saved = localStorage.getItem('carcassonne_playerCount');
        return saved ? parseInt(saved, 10) : 2;
    });
    const [types, setTypes] = useState<Record<number, PlayerType>>(() => {
        const saved = localStorage.getItem('carcassonne_types');
        if (saved) return JSON.parse(saved);
        return {
            1: 'human',
            2: 'ai-easy',
            3: 'ai-easy',
            4: 'ai-easy'
        };
    });
    const [names, setNames] = useState<Record<number, string>>(() => {
        const savedNames = localStorage.getItem('carcassonne_names');
        const initialNames = savedNames ? JSON.parse(savedNames) : {
            1: 'Player 1',
            2: 'Computer',
            3: 'Computer',
            4: 'Computer'
        };

        // Ensure AI players have random names if they are currently defaults
        const updatedNames = { ...initialNames };
        Object.entries(types).forEach(([id, type]) => {
            const pId = parseInt(id, 10);
            const name = updatedNames[pId];
            if (type !== 'human' && (!name || name === 'Computer' || name.startsWith('Player ') || !name.endsWith(' (AI)'))) {
                updatedNames[pId] = getRandomAiName(Object.values(updatedNames));
            }
        });
        return updatedNames;
    });

    useEffect(() => {
        localStorage.setItem('carcassonne_mode', mode);
        localStorage.setItem('carcassonne_playerCount', playerCount.toString());
        localStorage.setItem('carcassonne_names', JSON.stringify(names));
        localStorage.setItem('carcassonne_types', JSON.stringify(types));
    }, [mode, playerCount, names, types]);

    const handleTypeChange = (pId: number, newType: PlayerType) => {
        setTypes(prev => ({ ...prev, [pId]: newType }));

        const currentName = names[pId] || '';

        if (newType !== 'human') {
            if (!currentName || currentName.startsWith('Player ') || currentName === 'Computer' || !currentName.endsWith(' (AI)')) {
                setNames(prev => ({ ...prev, [pId]: getRandomAiName(Object.values(prev)) }));
            }
        } else {
            if (currentName.endsWith(' (AI)')) {
                setNames(prev => ({ ...prev, [pId]: `Player ${pId}` }));
            }
        }
    };

    const handleStart = () => {
        // Filter names and types to only include players up to playerCount
        const filteredNames: Record<number, string> = {};
        const filteredTypes: Record<number, PlayerType> = {};

        for (let i = 1; i <= playerCount; i++) {
            filteredNames[i] = names[i];
            filteredTypes[i] = types[i];
        }

        onStartGame(filteredNames, filteredTypes);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontFamily: 'sans-serif'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                padding: '40px',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                width: '400px',
                display: 'flex', flexDirection: 'column', gap: '24px'
            }}>
                <h1 style={{ margin: 0, textAlign: 'center', fontSize: '36px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                    Carcassonne
                </h1>
                <div style={{
                    marginTop: '-16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#f1c40f',
                    letterSpacing: '1px',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}>
                    --- 3-tiles-hand
                </div>

                {/* Mode Selection */}
                {DEBUG_MODE && (
                    <div style={{ display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '8px' }}>
                        <button
                            style={{
                                flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
                                background: mode === 'local' ? '#3498db' : 'transparent',
                                color: mode === 'local' ? 'white' : '#ccc',
                                cursor: 'pointer', fontWeight: mode === 'local' ? 'bold' : 'normal',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setMode('local')}
                        >
                            Local Game
                        </button>
                        <button
                            style={{
                                flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
                                background: 'transparent',
                                color: '#888',
                                cursor: 'not-allowed',
                                position: 'relative'
                            }}
                            title="Coming Soon"
                        >
                            Online Game
                            <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '10px', background: '#e74c3c', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>WIP</span>
                        </button>
                    </div>
                )}

                {/* Player Settings */}
                {mode === 'local' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#eee' }}>Number of Players</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {[2, 3, 4].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => {
                                            setPlayerCount(num);
                                            if (num >= 3) {
                                                setTypes(prev => ({
                                                    ...prev,
                                                    3: prev[3] || 'ai-easy',
                                                    4: prev[4] || 'ai-easy'
                                                }));
                                                setNames(prev => {
                                                    const newNames = { ...prev };
                                                    if (!newNames[3]) newNames[3] = getRandomAiName(Object.values(newNames));
                                                    if (!newNames[4]) newNames[4] = getRandomAiName(Object.values(newNames));
                                                    return newNames;
                                                });
                                            }
                                        }}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '6px',
                                            border: num === playerCount ? '2px solid #3498db' : '1px solid #555',
                                            background: num === playerCount ? 'rgba(52, 152, 219, 0.2)' : 'rgba(0,0,0,0.2)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label style={{ display: 'block', fontSize: '14px', color: '#eee' }}>Player Settings</label>
                            {Array.from({ length: playerCount }).map((_, idx) => {
                                const pId = idx + 1;
                                return (
                                    <div key={pId} style={{ display: 'flex', gap: '8px' }}>
                                        <select
                                            value={types[pId]}
                                            onChange={(e) => handleTypeChange(pId, e.target.value as PlayerType)}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                background: 'rgba(0,0,0,0.5)',
                                                color: 'white',
                                                outline: 'none',
                                                fontSize: '14px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <option value="human">Human 🙋‍♂️</option>
                                            <option value="ai-easy">Computer 🤖</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={names[pId]}
                                            onChange={(e) => setNames({ ...names, [pId]: e.target.value })}
                                            placeholder={`Player ${pId}`}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                background: 'rgba(0,0,0,0.3)',
                                                color: 'white',
                                                outline: 'none',
                                                fontSize: '16px'
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <button
                    onClick={handleStart}
                    style={{
                        padding: '16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#2ecc71',
                        color: 'white',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(46, 204, 113, 0.4)',
                        transition: 'transform 0.1s, box-shadow 0.1s',
                        marginTop: '10px'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    Start Game
                </button>

                <button
                    onClick={() => setShowTutorial(true)}
                    style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.3)',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        marginTop: '4px'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                    How to Play ❔
                </button>
            </div>

            {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

            {/* Author Credit */}
            <div style={{
                position: 'absolute',
                bottom: '16px',
                right: '24px',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '12px',
                fontFamily: 'monospace'
            }}>
                author: vincent71399
            </div>
        </div>
    );
};
