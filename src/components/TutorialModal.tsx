import React, { useState } from 'react';
import { TutorialScene } from './TutorialScene';
import type { PlayerId, PlacedTile } from '../engine/types';

interface TutorialModalProps {
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

const STEPS: StepDefinition[] = [
    {
        title: "Welcome to Carcassonne",
        content: "Carcassonne is a tile-placement game where players build a medieval landscape. Your goal is to score the most points by strategically placing tiles and your followers, called 'Meeples'.",
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
        title: "Placing Tiles",
        content: "Edges must match: road to road, city to city, and field to field. The green squares show where your current tile (in the corner) can be placed correctly.",
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
        title: "Deploying Meeples",
        content: "After placing a tile, you can place a Meeple to 'claim' a feature. They help you control roads and cities. Notice the meeple in the corner waiting to be deployed to a blinking spot!",
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
        title: "Scoring Points",
        content: "Once a feature is completed (like this enclosed city), you get your Meeple back and score points immediately. A big city like this is worth 2 points per tile!",
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
            scoreUpdate: { x: 0, y: 0, points: 6, text: 'CITY COMPLETE' }
        }
    },
    {
        title: "The Power of Farmers",
        content: "Farmers stay on fields until the end of the game. They score 3 points for every completed city in their field! The stripes show the field territory controlled by a player.",
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
        title: "Ready to Play?",
        content: "The game ends when the deck is empty. High score wins! Simply click 'Start Game' on the home screen to begin your adventure.",
        scene: {
            tiles: [],
            showStartPreview: true,
            highlightButton: true
        }
    }
];

export const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
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
                width: 'min(600px, 95vw)',
                borderRadius: '24px',
                padding: '32px',
                color: 'white',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                position: 'relative',
                display: 'flex', flexDirection: 'column', gap: '20px',
                border: '1px solid rgba(255,255,255,0.1)'
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
                    />
                </div>

                <div style={{ textAlign: 'center' }}>
                    <h2 style={{
                        margin: '0 0 10px 0', fontSize: '24px', color: '#f1c40f',
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}>
                        {step.title}
                        {step.title === "Deploying Meeples" && (
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
                                Back
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
                            {currentStep === STEPS.length - 1 ? "Let's Play!" : "Next"}
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
                    80% { transform: translate(-50%, -20px) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -30px) scale(0.8); opacity: 0; }
                }
            `}</style>
        </div>
    );
};
