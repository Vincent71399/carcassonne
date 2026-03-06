import React, { useState, useEffect } from 'react';
import type { PlayerType } from '../engine/types';
import { DEBUG_MODE } from '../engine/constants';
import { TutorialModal } from './TutorialModal';
import { useTranslation } from 'react-i18next';

interface StartScreenProps {
    isMobile: boolean;
    onStartGame: (playerNames: Record<number, string>, playerTypes: Record<number, PlayerType>) => void;
}

const AI_NAMES = [
    'Miso', 'Pippin', 'Nibble', 'Dot', 'Pebble', 'Orbit', 'Flux', 'Pivot', 'Moor', 'Abbey', 'Sentinel', 'Warden', 'Cipher', 'Vector', 'Nexus', 'Castell', 'Rampart', 'Bastion', 'Keep', 'Relic', 'Razor', 'Blade', 'Fang', 'Viper', 'Talon', 'Spike'
];

const getRandomAiName = (existingNames: string[] = [], i18n_computer: string = '(AI)') => {
    const availableNames = AI_NAMES.filter(name => !existingNames.includes(`${name} ${i18n_computer}`));
    const pool = availableNames.length > 0 ? availableNames : AI_NAMES;
    const name = pool[Math.floor(Math.random() * pool.length)];
    return `${name} ${i18n_computer}`;
};

const ChinaFlag = () => (
    <svg width="24" height="18" viewBox="0 0 30 20" style={{ borderRadius: '2px' }}>
        <rect width="30" height="20" fill="#ee1c25" />
        <path d="M5,5 l-0.951,2.927 L6.545,6.073 L3.455,6.073 L5.951,7.927 z" fill="#ffff00" transform="translate(-1.5,-1.5) scale(1.5)" />
        <path d="M10,2 l-0.317,0.976 L10.515,2.358 L9.485,2.358 L10.317,2.976 z" fill="#ffff00" transform="rotate(-36.8,10,2)" />
        <path d="M12,4 l-0.317,0.976 L12.515,4.358 L11.485,4.358 L12.317,4.976 z" fill="#ffff00" transform="rotate(-9.5,12,4)" />
        <path d="M12,7 l-0.317,0.976 L12.515,7.358 L11.485,7.358 L12.317,7.976 z" fill="#ffff00" transform="rotate(12.4,12,7)" />
        <path d="M10,9 l-0.317,0.976 L10.515,9.358 L9.485,9.358 L10.317,9.976 z" fill="#ffff00" transform="rotate(28.1,10,9)" />
    </svg>
);

const EnglishFlag = () => (
    <svg width="24" height="18" viewBox="0 0 60 30" style={{ borderRadius: '2px' }}>
        <clipPath id="s">
            <path d="M0,0 v30 h60 v-30 z" />
        </clipPath>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#s)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
);

export const StartScreen: React.FC<StartScreenProps> = ({ isMobile, onStartGame }) => {
    const { t, i18n } = useTranslation();
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
        let initial: Record<number, string>;
        if (savedNames) {
            initial = JSON.parse(savedNames);
        } else {
            initial = {
                1: i18n.t('startScreen.playerPlaceholder', { id: 1 }),
                2: getRandomAiName([], i18n.t('startScreen.aiMarker')),
                3: getRandomAiName([], i18n.t('startScreen.aiMarker')),
                4: getRandomAiName([], i18n.t('startScreen.aiMarker'))
            };
        }

        // Migration: convert (Co) to (AI)
        let changed = false;
        Object.keys(initial).forEach(key => {
            const id = parseInt(key, 10);
            if (initial[id].endsWith('(Co)')) {
                initial[id] = initial[id].replace('(Co)', '(AI)');
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem('carcassonne_names', JSON.stringify(initial));
        }

        return initial;
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
            if (!currentName || currentName.startsWith('Player ') || currentName.startsWith('玩家 ') || currentName === 'Computer' || !currentName.includes('(')) {
                setNames(prev => ({ ...prev, [pId]: getRandomAiName(Object.values(prev), t('startScreen.aiMarker')) }));
            }
        } else {
            if (currentName.includes('(')) {
                setNames(prev => ({ ...prev, [pId]: t('startScreen.playerPlaceholder', { id: pId }) }));
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

    const toggleLanguage = () => {
        const oldLang = i18n.language;
        const newLang = oldLang === 'en' ? 'zh' : 'en';
        i18n.changeLanguage(newLang);
        localStorage.setItem('carcassonne_lang', newLang);

        // Update default names immediately to avoid effect loop check
        setNames(prev => {
            const next = { ...prev };
            let changed = false;
            Object.keys(next).forEach(key => {
                const id = parseInt(key, 10);
                const name = next[id];
                const type = types[id];

                if (type === 'human') {
                    const isDefaultHuman =
                        name === `Player ${id}` ||
                        name === `玩家 ${id}` ||
                        name === i18n.t('startScreen.playerPlaceholder', { id, lng: 'en' }) ||
                        name === i18n.t('startScreen.playerPlaceholder', { id, lng: 'zh' });

                    if (isDefaultHuman) {
                        next[id] = i18n.t('startScreen.playerPlaceholder', { id, lng: newLang });
                        changed = true;
                    }
                } else {
                    const oldMarker = oldLang === 'en' ? '(AI)' : '(电脑)';
                    const newMarker = newLang === 'en' ? '(AI)' : '(电脑)';
                    if (name.endsWith(oldMarker)) {
                        next[id] = name.replace(oldMarker, newMarker);
                        changed = true;
                    }
                }
            });
            return changed ? next : prev;
        });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontFamily: 'sans-serif'
        }}>
            {/* Language Toggle */}
            <div
                onClick={toggleLanguage}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.2s',
                    zIndex: 100
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
            >
                {i18n.language === 'en' ? (
                    <>
                        <EnglishFlag />
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>English</span>
                    </>
                ) : (
                    <>
                        <ChinaFlag />
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>简体中文</span>
                    </>
                )}
            </div>

            <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                padding: isMobile ? '20px' : '40px',
                borderRadius: isMobile ? '0px' : '16px',
                boxShadow: isMobile ? 'none' : '0 8px 32px rgba(0,0,0,0.3)',
                width: isMobile ? '100vw' : '480px',
                height: isMobile ? '100vh' : 'auto',
                maxWidth: isMobile ? '100vw' : '480px',
                maxHeight: isMobile ? '100vh' : 'auto',
                display: 'flex', flexDirection: 'column', gap: '24px',
                boxSizing: 'border-box',
                justifyContent: isMobile ? 'center' : 'flex-start'
            }}>
                <h1 style={{ margin: 0, textAlign: 'center', fontSize: '36px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                    {t('startScreen.title')}
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
                    {t('startScreen.subtitle')}
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
                            {t('startScreen.localGame')}
                        </button>
                        <button
                            style={{
                                flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
                                background: 'transparent',
                                color: '#888',
                                cursor: 'not-allowed',
                                position: 'relative'
                            }}
                            title={t('startScreen.comingSoon')}
                        >
                            {t('startScreen.onlineGame')}
                            <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '10px', background: '#e74c3c', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>WIP</span>
                        </button>
                    </div>
                )}

                {/* Player Settings */}
                {mode === 'local' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#eee' }}>{t('startScreen.numberOfPlayers')}</label>
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
                                                    if (!newNames[3]) newNames[3] = getRandomAiName(Object.values(newNames), `(${t('startScreen.computer').substring(0, 2)})`);
                                                    if (!newNames[4]) newNames[4] = getRandomAiName(Object.values(newNames), `(${t('startScreen.computer').substring(0, 2)})`);
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
                            <label style={{ display: 'block', fontSize: '14px', color: '#eee' }}>{t('startScreen.playerSettings')}</label>
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
                                            <option value="human">{t('startScreen.human')}</option>
                                            <option value="ai-easy">{t('startScreen.computer')}</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={names[pId]}
                                            onChange={(e) => setNames({ ...names, [pId]: e.target.value })}
                                            placeholder={t('startScreen.playerPlaceholder', { id: pId })}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                background: 'rgba(0,0,0,0.3)',
                                                color: 'white',
                                                outline: 'none',
                                                fontSize: '16px',
                                                width: '100%'
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
                        marginTop: '10px',
                        width: '100%'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    {t('startScreen.startGame')}
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
                    {t('startScreen.howToPlay')}
                </button>
            </div>

            {showTutorial && <TutorialModal isMobile={isMobile} onClose={() => setShowTutorial(false)} />}

            {/* Author Credit */}
            <div style={{
                position: 'absolute',
                bottom: '16px',
                right: '24px',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '12px',
                fontFamily: 'monospace'
            }}>
                {t('startScreen.author')}
            </div>
        </div>
    );
};
