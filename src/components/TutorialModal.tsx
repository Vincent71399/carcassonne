import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TutorialScene } from './TutorialScene';
import type { PlayerId, PlacedTile } from '../engine/types';

interface TutorialModalProps {
    isMobile: boolean;
    onClose: () => void;
}

interface StepDefinition {
    title: string;
    content: string;
    scene: {
        tiles: PlacedTile[];
        validPlacements?: { x: number, y: number }[];
        meepleHighlightPos?: { x: number, y: number };
        scoreUpdate?: { x: number, y: number, points: number, text: string };
        fieldConquest?: Record<string, PlayerId[]>;
        handTile?: string;
        showMockUI?: boolean;
        mockHand?: string[];
        mockScores?: { name: string, score: number, color: string }[];
        extraMeeples?: { x: number, y: number, playerId: PlayerId }[];
        showStartPreview?: boolean;
        highlightButton?: boolean;
    };
}

import type { TFunction } from 'i18next';

const getSteps = (t: TFunction): StepDefinition[] => [
    {
        title: t('tutorial.welcomeTitle'),
        content: t('tutorial.welcomeContent'),
        scene: {
            tiles: [
                { id: 't1', typeId: 'Start', x: 0, y: 0, rotation: 0, meeples: [] },
                { id: 't2', typeId: 'C', x: -1, y: 0, rotation: 0, meeples: [] },
                { id: 't3', typeId: 'Q', x: 0, y: -1, rotation: 0, meeples: [] }
            ],
            showMockUI: true,
            mockHand: ['D', 'E', 'F']
        }
    },
    {
        title: t('tutorial.placingTilesTitle'),
        content: t('tutorial.placingTilesContent'),
        scene: {
            tiles: [
                { id: 't1', typeId: 'Start', x: 0, y: 0, rotation: 0, meeples: [] },
                { id: 't2', typeId: 'X', x: 0, y: -1, rotation: 0, meeples: [] }
            ],
            validPlacements: [
                { x: 0, y: -2 }, { x: 1, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }
            ],
            handTile: 'H'
        }
    },
    {
        title: t('tutorial.deployingMeeplesTitle'),
        content: t('tutorial.deployingMeeplesContent'),
        scene: {
            tiles: [
                { id: 't1', typeId: 'Start', x: 0, y: 0, rotation: 0, meeples: [] },
                { id: 't2', typeId: 'G', x: 0, y: -1, rotation: 2, meeples: [] },
                { id: 't3', typeId: 'H', x: 1, y: 0, rotation: 1, meeples: [] }
            ],
            meepleHighlightPos: { x: 1, y: 0 },
            extraMeeples: [{ x: 1.8, y: 0.8, playerId: 1 }]
        }
    },
    {
        title: t('tutorial.scoringPointsTitle'),
        content: t('tutorial.scoringPointsContent'),
        scene: {
            tiles: [
                { id: 't1', typeId: 'G', x: 0, y: -1, rotation: 2, meeples: [] },
                {
                    id: 't2', typeId: 'R', x: 0, y: 0, rotation: 1, meeples: [
                        { meeple: { id: 'm1', playerId: 1, type: 'standard' }, featureId: 'city-0' }
                    ]
                },
                { id: 't3', typeId: 'G', x: 0, y: 1, rotation: 0, meeples: [] }
            ],
            scoreUpdate: { x: 0, y: 0, points: 6, text: t('game.cityComplete') }
        }
    },
    {
        title: t('tutorial.powerOfFarmersTitle'),
        content: t('tutorial.powerOfFarmersContent'),
        scene: {
            tiles: [
                { id: 't1', typeId: 'G', x: -1, y: 0, rotation: 1, meeples: [] },
                {
                    id: 't2', typeId: 'K', x: 0, y: 0, rotation: 0, meeples: [
                        { meeple: { id: 'm1', playerId: 1, type: 'standard' }, featureId: 'field-0' }
                    ]
                },
                { id: 't3', typeId: 'G', x: 1, y: 0, rotation: 3, meeples: [] }
            ],
            fieldConquest: {
                '0,0,0': [1],
                '0,0,1': [1]
            }
        }
    },
    {
        title: t('tutorial.readyToPlayTitle'),
        content: t('tutorial.readyToPlayContent'),
        scene: {
            tiles: [],
            showStartPreview: true,
            highlightButton: true
        }
    }
];

export const TutorialModal: React.FC<TutorialModalProps> = ({ isMobile, onClose }) => {
    const { t } = useTranslation();
    const STEPS = getSteps(t);
    const [currentStep, setCurrentStep] = useState(0);
    const step = STEPS[currentStep];

    const next = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onClose();
        }
    };

    const prev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const fieldConquestMap = step.scene.fieldConquest
        ? new Map(Object.entries(step.scene.fieldConquest).map(([k, v]) => [k, v]))
        : undefined;

    return (
        <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
                width: isMobile ? '100vw' : 'min(600px, 95vw)',
                height: isMobile ? '100vh' : 'auto',
                borderRadius: isMobile ? '0px' : '24px',
                padding: isMobile ? '24px' : '32px',
                color: 'white',
                boxShadow: isMobile ? 'none' : '0 20px 50px rgba(0,0,0,0.5)',
                position: 'relative',
                display: 'flex', flexDirection: 'column', gap: '20px',
                border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)',
                boxSizing: isMobile ? 'border-box' : 'content-box',
                justifyContent: isMobile ? 'center' : 'unset'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '20px', right: '20px',
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        color: 'white', fontSize: '20px', cursor: 'pointer',
                        width: '32px', height: '32px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10
                    }}
                >
                    &times;
                </button>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <TutorialScene
                        {...step.scene}
                        fieldConquest={fieldConquestMap}
                        size={380}
                        isMobile={isMobile}
                    />
                </div>

                <div style={{ textAlign: 'center' }}>
                    <h2 style={{
                        margin: '0 0 10px 0', fontSize: '24px', color: '#f1c40f',
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}>
                        {step.title}
                        {currentStep === 2 && (
                            <svg width="24" height="24" viewBox="-8 -12 16 24" style={{ overflow: 'visible' }}>
                                <circle cx="0" cy="-5" r="4" fill="#e74c3c" stroke="#fff" strokeWidth="1.5" />
                                <path d="M -5 8 L -3 -1 Q 0 -3 3 -1 L 5 8 L 2 8 L 1 3 L -1 3 L -2 8 Z" fill="#e74c3c" stroke="#fff" strokeWidth="1" />
                            </svg>
                        )}
                    </h2>
                    <p style={{
                        margin: 0, lineHeight: '1.5', color: '#ecf0f1', fontSize: '15px',
                        minHeight: '60px'
                    }}>
                        {step.content}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {STEPS.map((_, i) => (
                            <div key={i} style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: i === currentStep ? '#3498db' : 'rgba(255,255,255,0.2)',
                                transition: 'all 0.3s'
                            }} />
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        {currentStep > 0 && (
                            <button
                                onClick={prev}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.1)', color: 'white',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                {t('tutorial.back')}
                            </button>
                        )}
                        <button
                            onClick={next}
                            style={{
                                flex: 2, padding: '12px', borderRadius: '10px',
                                background: '#3498db', color: 'white', border: 'none',
                                cursor: 'pointer', fontWeight: 'bold',
                                boxShadow: '0 4px 15px rgba(52, 152, 219, 0.3)'
                            }}
                        >
                            {currentStep === STEPS.length - 1 ? t('tutorial.letsPlay') : t('tutorial.next')}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes scoreFloatUp {
                    0% { transform: translate(-50%, 0) scale(0.8); opacity: 0; }
                    20% { transform: translate(-50%, -10px) scale(1); opacity: 1; }
                    80% { transform: translate(-50%, -15px) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -20px) scale(0.8); opacity: 0; }
                }
            `}</style>
        </div>
    );
};
