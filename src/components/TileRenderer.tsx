import React, { useState, useId } from 'react';
import type { TileDefinition, PlacedTile, EdgeDirection } from '../engine/types';
import { PLAYER_COLORS, FEATURE_COLORS } from '../engine/constants';

interface FeatureHotspot {
    id: string;
    x: number;
    y: number;
    label: string;
}

interface TileRendererProps {
    def: TileDefinition;
    placed?: PlacedTile;
    size?: number;
    interactive?: boolean;
    selected?: boolean;
    onClick?: () => void;
    style?: React.CSSProperties;
    meeplePlacementMode?: boolean;
    disabledHotspots?: string[];
    onFeatureClick?: (featureId: string) => void;
    animate?: boolean;
}

const EDGE_POSITIONS = {
    top: { x1: 0, y1: 0, x2: 100, y2: 0, cx: 50, cy: 0 },
    right: { x1: 100, y1: 0, x2: 100, y2: 100, cx: 100, cy: 50 },
    bottom: { x1: 100, y1: 100, x2: 0, y2: 100, cx: 50, cy: 100 },
    left: { x1: 0, y1: 100, x2: 0, y2: 0, cx: 0, cy: 50 },
};

export const TileRenderer: React.FC<TileRendererProps> = ({
    def,
    placed,
    size = 100,
    interactive = false,
    selected = false,
    onClick,
    style = {},
    meeplePlacementMode = false,
    disabledHotspots = [],
    onFeatureClick,
    animate = true
}) => {
    const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
    const tileClipId = useId();

    const rotation = placed?.rotation || 0;

    // Render city regions based on edges
    const renderCities = () => {
        const renderPennant = (x: number, y: number, idSuffix: string | number) => {
            return (
                <g transform={`translate(${x}, ${y}) scale(0.8) rotate(${-rotation * 90})`}>
                    <defs>
                        <clipPath id={`shield-clip-${def.typeId}-${idSuffix}`}>
                            <path d="M -10 -15 L 10 -15 L 10 5 Q 0 15 -10 5 Z" />
                        </clipPath>
                    </defs>
                    <path d="M -10 -15 L 10 -15 L 10 5 Q 0 15 -10 5 Z" fill="#fff" />
                    <g clipPath={`url(#shield-clip-${def.typeId}-${idSuffix})`}>
                        <rect x="-10" y="-15" width="10" height="15" fill={FEATURE_COLORS.cityShield} />
                        <rect x="0" y="0" width="10" height="20" fill={FEATURE_COLORS.cityShield} />
                    </g>
                    <path d="M -10 -15 L 10 -15 L 10 5 Q 0 15 -10 5 Z" fill="none" stroke="#fff" strokeWidth="2" />
                    <line x1="0" y1="-15" x2="0" y2="15" stroke="#fff" strokeWidth="1" />
                    <line x1="-10" y1="0" x2="10" y2="0" stroke="#fff" strokeWidth="1" />
                </g>
            );
        };

        if (!def.cityConnections) return null;
        return def.cityConnections.map((conn, idx) => {
            let pennantPos = { x: 50, y: 50 }; // Default center


            // If the city occupies a single edge (like D or E)
            if (conn.length === 1) {
                const d = conn[0];
                const pos = EDGE_POSITIONS[d];
                const path = `M ${pos.x1} ${pos.y1} Q 50 50 ${pos.x2} ${pos.y2} Z`;

                // Position pennant closer to the edge for single-edge cities
                if (d === 'top') pennantPos = { x: 50, y: 20 };
                else if (d === 'right') pennantPos = { x: 80, y: 50 };
                else if (d === 'bottom') pennantPos = { x: 50, y: 80 };
                else if (d === 'left') pennantPos = { x: 20, y: 50 };

                return (
                    <g key={`city-group-${idx}`}>
                        <path d={path} fill="#cda87a" stroke="#8b5a2b" strokeWidth="2" />
                        {def.pennants && idx === 0 ? (
                            <g transform={`translate(${pennantPos.x}, ${pennantPos.y}) scale(0.8)`}>
                                <path d="M -10 -15 L 10 -15 L 10 5 Q 0 15 -10 5 Z" fill={FEATURE_COLORS.cityShield} stroke="#fff" strokeWidth="2" />
                            </g>
                        ) : null}
                    </g>
                );
            }

            if (conn.length >= 4) {
                // all city
                const path = "M 0 0 L 100 0 L 100 100 L 0 100 Z";
                pennantPos = { x: 50, y: 50 };
                return (
                    <g key={`city-group-${idx}`}>
                        <path d={path} fill="#cda87a" stroke="#8b5a2b" strokeWidth="2" />
                        {def.pennants && idx === 0 ? renderPennant(pennantPos.x, pennantPos.y, idx) : null}
                    </g>
                );
            }

            // For 2 or 3 edges, we generate a smooth path
            const points = conn.map(d => EDGE_POSITIONS[d]);
            let defaultPath = "";
            if (conn.length === 2) {
                // usually adjacent or opposite
                // if opposite (e.g., top and bottom), it's a straight block
                if ((conn.includes('top') && conn.includes('bottom')) || (conn.includes('left') && conn.includes('right'))) {
                    if (conn.includes('top')) {
                        // Top+Bottom city: corners fully covered, center pinches to x=35-65
                        defaultPath = "M 0 0 L 100 0 Q 30 50 100 100 L 0 100 Q 70 50 0 0 Z";
                        pennantPos = { x: 50, y: 50 };
                    } else {
                        // Left+Right city: corners fully covered, center pinches to y=35-65
                        defaultPath = "M 0 0 L 0 100 Q 50 30 100 100 L 100 0 Q 50 70 0 0 Z";
                        pennantPos = { x: 50, y: 50 };
                    }
                } else {
                    // adjacent curve (e.g. top and right)
                    defaultPath = `M ${points[0].x1} ${points[0].y1} L ${points[0].x2} ${points[0].y2} L ${points[1].x1} ${points[1].y1} L ${points[1].x2} ${points[1].y2} Z`;

                    // Place pennant near the corner, not the center
                    if (conn.includes('top') && conn.includes('right')) { pennantPos = { x: 75, y: 25 }; }
                    else if (conn.includes('right') && conn.includes('bottom')) { pennantPos = { x: 75, y: 75 }; }
                    else if (conn.includes('bottom') && conn.includes('left')) { pennantPos = { x: 25, y: 75 }; }
                    else if (conn.includes('left') && conn.includes('top')) { pennantPos = { x: 25, y: 25 }; }
                }
            } else {
                // 3 edges
                const allEdges: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
                const missing = allEdges.find(e => !conn.includes(e));

                if (missing === 'bottom') {
                    defaultPath = "M 0 100 L 0 0 L 100 0 L 100 100 Q 50 50 0 100 Z";
                    pennantPos = { x: 50, y: 30 };
                } else if (missing === 'left') {
                    defaultPath = "M 0 0 L 100 0 L 100 100 L 0 100 Q 50 50 0 0 Z";
                    pennantPos = { x: 70, y: 50 };
                } else if (missing === 'top') {
                    defaultPath = "M 100 0 L 100 100 L 0 100 L 0 0 Q 50 50 100 0 Z";
                    pennantPos = { x: 50, y: 70 };
                } else if (missing === 'right') {
                    defaultPath = "M 100 100 L 0 100 L 0 0 L 100 0 Q 50 50 100 100 Z";
                    pennantPos = { x: 30, y: 50 };
                }
            }

            return (
                <g key={`city-group-${idx}`}>
                    <path d={defaultPath} fill="#cda87a" stroke="#8b5a2b" strokeWidth="2" />
                    {def.pennants && idx === 0 ? renderPennant(pennantPos.x, pennantPos.y, idx) : null}
                </g>
            );
        });
    };

    const renderRoads = () => {
        if (!def.roadConnections) return null;
        return def.roadConnections.map((conn, idx) => {
            if (conn.length === 2) {
                // Curve or straight
                const p1 = EDGE_POSITIONS[conn[0]];
                const p2 = EDGE_POSITIONS[conn[1]];
                return (
                    <path key={`road-${idx}`} d={`M ${p1.cx} ${p1.cy} Q 50 50 ${p2.cx} ${p2.cy}`} fill="none" stroke="#ddd" strokeWidth="12" />
                );
            } else if (conn.length === 1) {
                // Dead end road (ending in a monastery or village)
                const p1 = EDGE_POSITIONS[conn[0]];
                return (
                    <line key={`road-${idx}`} x1={p1.cx} y1={p1.cy} x2="50" y2="50" stroke="#ddd" strokeWidth="12" />
                );
            }
            return null;
        });
    };

    // Crossroad cases (where roads end in center but don't connect)
    const renderCrossroads = () => {
        if (def.typeId === 'C' || def.typeId === 'D' || def.typeId === 'M') {
            // Add village/houses in the center to break the road visually
            const village = (
                <g key="village" transform={`translate(50, 50) rotate(${-rotation * 90})`}>
                    {/* Dirt/cobblestone clearing */}
                    <circle cx="0" cy="0" r="12" fill="#d7ccc8" />
                    {/* Little houses */}
                    <rect x="-8" y="-8" width="6" height="6" fill={FEATURE_COLORS.crossroadWood} />
                    <polygon points="-8,-8 -5,-12 -2,-8" fill={FEATURE_COLORS.crossroadHouse} />
                    <rect x="2" y="-2" width="6" height="8" fill={FEATURE_COLORS.crossroadWood} />
                    <polygon points="2,-2 5,-6 8,-2" fill={FEATURE_COLORS.crossroadHouse} />
                    <rect x="-6" y="2" width="5" height="5" fill={FEATURE_COLORS.crossroadWood} />
                    <polygon points="-6,2 -3.5,-2 -1,2" fill={FEATURE_COLORS.crossroadHouse} />
                </g>
            );

            return [village];
        } else if (def.typeId === 'Start') {
            // Special mark for the starting tile
            const startMark = (
                <g key="start-mark" transform={`translate(50, 50) rotate(${-rotation * 90})`}>
                    <circle cx="0" cy="0" r="14" fill="#333" opacity="0.8" />
                    <text x="0" y="0" textAnchor="middle" alignmentBaseline="central" fontSize="16" fill="#fff" fontWeight="bold">S</text>
                </g>
            );
            return [startMark];
        }
        return null;
    }

    const wrapperStyle: React.CSSProperties = {
        width: size,
        height: size,
        position: 'relative',
        transition: animate ? 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
        transform: selected ? 'scale(1.05) translateY(-10px)' : 'none',
        boxShadow: selected ? '0 10px 20px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.2)',
        borderRadius: '4px',
        cursor: interactive ? 'pointer' : 'default',
        ...style
    };

    return (
        <div style={wrapperStyle} onClick={interactive ? onClick : undefined}>
            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                style={{
                    display: 'block',
                    transform: `rotate(${rotation * 90}deg)`,
                    transition: animate ? 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
                    overflow: 'visible'
                }}
            >
                <defs>
                    <clipPath id={tileClipId}>
                        <rect x="0" y="0" width="100" height="100" rx="4" ry="4" />
                    </clipPath>
                </defs>

                <g clipPath={`url(#${tileClipId})`}>
                    {/* Base Field */}
                    <rect x="0" y="0" width="100" height="100" fill="#7cb342" rx="4" ry="4" />

                    {/* Features */}
                    {renderRoads()}
                    {renderCrossroads()}

                    {renderCities()}

                    {/* Monastery */}
                    {def.monastery && (
                        <g transform={`translate(50, 50) rotate(${-rotation * 90})`}>
                            {/* Dirt plot */}
                            <circle cx="0" cy="0" r="22" fill="#cda87a" />
                            {/* Walled garden */}
                            <circle cx="0" cy="0" r="18" fill="#aed581" stroke="#8b5a2b" strokeWidth="1" />
                            {/* Main building */}
                            <rect x="-10" y="-12" width="20" height="24" fill="#cfd8dc" stroke="#607d8b" strokeWidth="1" />
                            {/* Roof */}
                            <polygon points="-12,-12 0,-22 12,-12" fill="#c62828" stroke="#8e0000" strokeWidth="1" />
                            {/* Tower */}
                            <rect x="-4" y="-26" width="8" height="14" fill="#eceff1" stroke="#607d8b" strokeWidth="1" />
                            <polygon points="-6,-26 0,-34 6,-26" fill="#1565c0" stroke="#0d47a1" strokeWidth="1" />
                            {/* Doors/Windows */}
                            <path d="M -3 10 L -3 4 A 3 3 0 0 1 3 4 L 3 10 Z" fill="#5d4037" />
                            <circle cx="0" cy="-4" r="2" fill="#212121" />
                        </g>
                    )}
                </g>

                {/* Render placed meeples */}
                {placed?.meeples?.map((pm, idx) => {
                    // Use rotation=0 because CSS transform handles visual rotation
                    const hotspots = computeHotspots(def, 0);
                    const spot = hotspots.find(h => h.id === pm.featureId);
                    if (!spot) return null;
                    const color = PLAYER_COLORS[pm.meeple.playerId] || '#999';
                    const isFarmer = pm.featureId.startsWith('field');
                    return (
                        <g key={`meeple-${idx}`} transform={`translate(${spot.x}, ${spot.y}) rotate(${-rotation * 90})`}>
                            {isFarmer ? (
                                /* Farmer: lying down meeple (horizontal ellipse) */
                                <>
                                    <ellipse cx="0" cy="0" rx="8" ry="5" fill={color} stroke="#fff" strokeWidth="1.5" />
                                    <circle cx="-6" cy="0" r="3" fill={color} stroke="#fff" strokeWidth="1" />
                                </>
                            ) : (
                                /* Standing meeple */
                                <>
                                    <circle cx="0" cy="-5" r="4" fill={color} stroke="#fff" strokeWidth="1.5" />
                                    <path d="M -5 8 L -3 -1 Q 0 -3 3 -1 L 5 8 L 2 8 L 1 3 L -1 3 L -2 8 Z" fill={color} stroke="#fff" strokeWidth="1" />
                                </>
                            )}
                        </g>
                    );
                })}

                {/* Meeple placement hotspots */}
                {meeplePlacementMode && (() => {
                    // Use rotation=0 because CSS transform handles visual rotation
                    const hotspots = computeHotspots(def, 0);
                    return hotspots.map((hs, i) => {
                        const isField = hs.id.startsWith('field-');
                        const isDisabled = disabledHotspots?.includes(hs.id);
                        const isActive = hoveredFeature === hs.id;
                        return (
                            <g key={`hot-${i}`}>
                                <circle
                                    cx={hs.x} cy={hs.y}
                                    r={isField ? 14 : 10}
                                    fill={isDisabled ? 'transparent' : 'rgba(255, 255, 255, 0.4)'}
                                    stroke={isDisabled ? 'transparent' : (isActive ? '#000' : '#fff')}
                                    strokeWidth={isActive ? "2" : "1"}
                                    style={{
                                        cursor: isDisabled ? 'default' : 'pointer',
                                        animation: isDisabled ? 'none' : 'meeple-pulse 1.5s infinite',
                                        pointerEvents: isDisabled ? 'none' : 'all'
                                    }}
                                    onPointerEnter={() => {
                                        if (!isDisabled) {
                                            setHoveredFeature(hs.id);
                                        }
                                    }}
                                    onPointerLeave={() => {
                                        if (!isDisabled) {
                                            setHoveredFeature(null);
                                        }
                                    }}
                                    onClick={(e) => {
                                        if (!isDisabled) {
                                            e.stopPropagation();
                                            onFeatureClick?.(hs.id);
                                        }
                                    }}
                                />
                            </g>
                        );
                    });
                })()}
            </svg>
            {/* Type ID overlay - stays statically in the top left corner */}
            <div style={{
                position: 'absolute',
                top: 2,
                left: 4,
                color: 'rgba(255,255,255,0.7)',
                fontSize: '10px',
                fontWeight: 'bold',
                width: 14,
                height: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
            }}>
                {def.typeId}
            </div>
            {/* CSS animation for hotspot pulse */}
            {meeplePlacementMode && (
                <style>{`
                    @keyframes meeple-pulse {
                        0%, 100% { opacity: 0.6; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.2); }
                    }
                `}</style>
            )}
        </div>
    );
};

// Hand-crafted field region positions for each tile type (pre-rotation coordinates)
// Fields are separated by roads and cities. Each entry is a distinct field region.
const TILE_FIELD_REGIONS: Record<string, { id: string, x: number, y: number }[]> = {
    'A': [ // curve bot-left
        { id: 'field-0', x: 75, y: 25 },
        { id: 'field-1', x: 15, y: 85 }
    ],
    'B': [ // straight top-bot
        { id: 'field-0', x: 15, y: 50 },
        { id: 'field-1', x: 85, y: 50 },
    ],
    'C': [ // crossroad bot/left/right
        { id: 'field-0', x: 50, y: 15 },
        { id: 'field-1', x: 85, y: 85 },
        { id: 'field-2', x: 15, y: 85 },
    ],
    'D': [ // 4-way cross
        { id: 'field-0', x: 85, y: 15 },
        { id: 'field-1', x: 85, y: 85 },
        { id: 'field-2', x: 15, y: 85 },
        { id: 'field-3', x: 15, y: 15 },
    ],
    'E': [{ id: 'field-0', x: 25, y: 75 }],                               // Pure Monastery — monk spot from monastery-0, field-0 at bottom-left
    'F': [{ id: 'field-0', x: 25, y: 75 }],                               // Monastery+Road — monk spot from monastery-0, field-0 at bottom-left
    'G': [{ id: 'field-0', x: 50, y: 75 }], // City top
    'H': [ // F-R-R-C
        { id: 'field-0', x: 50, y: 15 },
        { id: 'field-1', x: 85, y: 85 }
    ],
    'I': [ // R-R-F-C
        { id: 'field-0', x: 85, y: 15 },
        { id: 'field-1', x: 50, y: 85 }
    ],
    'J': [{ id: 'field-0', x: 70, y: 70 }], // C-F-F-C sep (City T/L, fields R/B)
    'K': [ // F-C-F-C sep (City L/R, fields T/B unified)
        { id: 'field-0', x: 50, y: 50 },
    ],
    'L': [ // C-R-F-R
        { id: 'field-0', x: 50, y: 35 },
        { id: 'field-1', x: 50, y: 85 }
    ],
    'M': [ // C-R-R-R cross
        { id: 'field-0', x: 50, y: 35 },
        { id: 'field-1', x: 85, y: 85 },
        { id: 'field-2', x: 15, y: 85 }
    ],
    'N': [{ id: 'field-0', x: 30, y: 75 }], // C-C-F-F conn
    'O': [{ id: 'field-0', x: 30, y: 75 }], // C-C-F-F conn
    'P': [ // R-R-C-C conn  (city = bottom-left, roads = top+right)
        { id: 'field-0', x: 82, y: 18 },  // top-right corner (outside road)
        { id: 'field-1', x: 85, y: 65 }   // between road arc (y≈49) and city diagonal (y=85) at x=85
    ],
    'Q': [ // R-R-C-C conn + pennant
        { id: 'field-0', x: 82, y: 18 },  // top-right corner
        { id: 'field-1', x: 85, y: 65 }   // between road arc and city diagonal
    ],
    'R': [ // F-C-F-C conn narrow band  (city y=35-65)
        { id: 'field-0', x: 50, y: 15 },   // top field, well above city band
        { id: 'field-1', x: 50, y: 85 }    // bottom field, well below city band
    ],
    'S': [ // F-C-F-C conn same geometry + pennant
        { id: 'field-0', x: 50, y: 15 },
        { id: 'field-1', x: 50, y: 85 }
    ],
    'T': [], // C-C-C-C
    'U': [{ id: 'field-0', x: 50, y: 15 }], // F-C-C-C
    'V': [{ id: 'field-0', x: 50, y: 15 }], // F-C-C-C
    'W': [ // R-C-C-C  (road=top, city=right+bot+left)
        { id: 'field-0', x: 25, y: 12 },  // left of top road
        { id: 'field-1', x: 75, y: 12 }   // right of top road  (pushed high, away from city arc)
    ],
    'X': [ // R-C-C-C + pennant  (pennant inside city at ~(70,70))
        { id: 'field-0', x: 25, y: 12 },  // left of top road
        { id: 'field-1', x: 75, y: 12 }   // right of top road
    ],
};

// Rotate a point (x, y) on a 100x100 grid by rotation * 90° clockwise
function rotatePoint(x: number, y: number, rotation: number): { x: number; y: number } {
    let rx = x, ry = y;
    for (let i = 0; i < (rotation % 4); i++) {
        const tmp = rx;
        rx = 100 - ry;
        ry = tmp;
    }
    return { x: rx, y: ry };
}

// Compute clickable hotspot positions for each feature on a tile
function computeHotspots(def: TileDefinition, rotation: number): FeatureHotspot[] {
    const hotspots: FeatureHotspot[] = [];
    const order: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];

    // Helper: rotate edge direction
    const rotateDir = (d: EdgeDirection): EdgeDirection => {
        const idx = order.indexOf(d);
        return order[(idx + rotation) % 4];
    };

    // Helper: get center position for an edge direction (after rotation)
    const edgeCenter = (d: EdgeDirection): { x: number; y: number } => {
        switch (d) {
            case 'top': return { x: 50, y: 15 };
            case 'right': return { x: 85, y: 50 };
            case 'bottom': return { x: 50, y: 85 };
            case 'left': return { x: 15, y: 50 };
        }
    };

    // Helper: get center position for a city feature based on its rotated edges
    const cornerCenter = (edges: EdgeDirection[]): { x: number; y: number } => {
        const hasTop = edges.includes('top');
        const hasRight = edges.includes('right');
        const hasBottom = edges.includes('bottom');
        const hasLeft = edges.includes('left');

        if (edges.length >= 4) return { x: 50, y: 50 };
        if (edges.length === 3) {
            if (!hasBottom) return { x: 50, y: 30 };
            if (!hasTop) return { x: 50, y: 70 };
            if (!hasLeft) return { x: 70, y: 50 };
            if (!hasRight) return { x: 30, y: 50 };
        }
        if (edges.length === 2) {
            // Inset pennant position slightly from true corner so hotspot doesn't overlap pennant icon
            if (hasTop && hasRight) return { x: 68, y: 32 };
            if (hasRight && hasBottom) return { x: 68, y: 68 };
            if (hasBottom && hasLeft) return { x: 32, y: 68 };
            if (hasLeft && hasTop) return { x: 32, y: 32 };
            if (hasTop && hasBottom) return { x: 50, y: 50 };
            if (hasLeft && hasRight) return { x: 50, y: 50 };
        }
        if (edges.length === 1) return edgeCenter(edges[0]);
        return { x: 50, y: 50 };
    };

    // City hotspots
    if (def.cityConnections) {
        def.cityConnections.forEach((conn, idx) => {
            const rotated = conn.map(rotateDir);
            const pos = cornerCenter(rotated);
            hotspots.push({ id: `city-${idx}`, x: pos.x, y: pos.y, label: 'City' });
        });
    }

    // Road hotspots - use bezier midpoint for accurate curve positioning
    if (def.roadConnections && def.roadConnections.length > 0) {
        // Actual SVG edge positions (where roads start/end)
        const SVG_EDGE_POS: Record<EdgeDirection, { x: number; y: number }> = {
            top: { x: 50, y: 0 }, right: { x: 100, y: 50 },
            bottom: { x: 50, y: 100 }, left: { x: 0, y: 50 }
        };
        def.roadConnections.forEach((conn, idx) => {
            const rotated = conn.map(rotateDir);
            const p1 = SVG_EDGE_POS[rotated[0]];
            if (conn.length === 2) {
                const p2 = SVG_EDGE_POS[rotated[1]];
                // Bezier midpoint: (P0 + 2*control + P2) / 4, control = (50,50)
                const mx = (p1.x + 2 * 50 + p2.x) / 4;
                const my = (p1.y + 2 * 50 + p2.y) / 4;
                hotspots.push({ id: `road-${idx}`, x: mx, y: my, label: 'Road' });
            } else if (conn.length === 1) {
                // Dead end road: 1/3 from edge toward center, so it stays on the visible road strip
                const mx = p1.x + (50 - p1.x) / 3;
                const my = p1.y + (50 - p1.y) / 3;
                hotspots.push({ id: `road-${idx}`, x: mx, y: my, label: 'Road' });
            }
        });
    }

    // Monastery hotspot
    if (def.monastery) {
        hotspots.push({ id: 'monastery-0', x: 50, y: 50, label: 'Monastery' });
    }

    // Field hotspots from hand-crafted per-tile definitions
    const fieldRegions = TILE_FIELD_REGIONS[def.typeId] || [];
    for (const region of fieldRegions) {
        const rotated = rotatePoint(region.x, region.y, rotation);
        hotspots.push({ id: region.id, x: rotated.x, y: rotated.y, label: 'Field' });
    }

    return hotspots;
}
