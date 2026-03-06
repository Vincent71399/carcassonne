import React, { useRef, useEffect } from 'react';
import type { GameState, PlayerId, PlacedTile } from '../engine/types';
import { TileRenderer } from './TileRenderer';
import { TILES_MAP } from '../engine/tiles';
import { getCityMaskPaths, getRoadMaskPaths } from '../engine/fieldConquest';
import { PLAYER_COLORS } from '../engine/constants';


interface BoardProps {
    state: GameState;
    pan: { x: number, y: number };
    setPan: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    isMobile?: boolean;
    validPlacements?: { x: number, y: number }[];
    meepleTilePosition?: { x: number, y: number } | null;
    onTileClick?: (x: number, y: number, e: React.MouseEvent) => void;
    /** Fired when an empty grid position is clicked to place a tile */
    onPlacementClick?: (x: number, y: number) => void;
    /** Fired when a clicked tile feature (like a city segment or field region) is clicked */
    onFeatureClick?: (featureId: string, placed?: PlacedTile) => void;
    /** Disable placing meeples on specific feature IDs */
    disabledHotspots?: string[];
    /** When set, field regions with farmers are highlighted with coloured stripe overlays */
    fieldConquest?: Map<string, PlayerId[]>;
    /** Make all tiles show hotspots simultaneously (used in Sandbox) */
    allTilesInteractive?: boolean;
    /** Enables right-clicking tiles to delete them, and disables non-field hotspots */
    sandboxMode?: boolean;
    /** Fired when a tile is right-clicked (context menu) */
    onContextMenu?: (x: number, y: number, e: React.MouseEvent) => void;
    /** Triggers an automatic camera pan to this grid coordinate */
    focusTarget?: { x: number, y: number } | null;
}


export const Board: React.FC<BoardProps> = ({ state, pan, setPan, zoom, setZoom, isMobile = false, validPlacements = [], meepleTilePosition, onTileClick, onPlacementClick, onFeatureClick, disabledHotspots = [], fieldConquest, allTilesInteractive = false, sandboxMode = false, onContextMenu, focusTarget }) => {
    const isDragging = useRef(false);
    const lastPan = useRef({ x: 0, y: 0 });

    const handleSetPan = (updater: { x: number, y: number } | ((p: { x: number, y: number }) => { x: number, y: number })) => {
        setPan(updater);
    };

    // Auto-focus the camera when requested
    useEffect(() => {
        if (focusTarget) {
            handleSetPan({ x: -focusTarget.x * 100, y: -focusTarget.y * 100 });
        }
    }, [focusTarget]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isMobile) return; // Disable dragging on mobile as requested
        isDragging.current = true;
        lastPan.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastPan.current.x;
        const dy = e.clientY - lastPan.current.y;
        handleSetPan(p => ({ x: p.x + dx, y: p.y + dy }));
        lastPan.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.deltaY < 0) {
            setZoom(z => Math.min(z * 1.1, 3));
        } else {
            setZoom(z => Math.max(z * 0.9, 0.3));
        }
    };

    return (
        <div
            style={{
                width: '100%',
                height: '100vh',
                overflow: 'hidden',
                backgroundColor: '#f0e6d2',
                cursor: isDragging.current ? 'grabbing' : 'grab',
                position: 'relative'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
        >
            <div
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transition: isDragging.current ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                {Object.values(state.board).map(placed => {
                    const def = TILES_MAP[placed.typeId];
                    const isMeepleMode = allTilesInteractive || !!(meepleTilePosition && placed.x === meepleTilePosition.x && placed.y === meepleTilePosition.y);

                    // Compute dynamic disabled hotspots for the sandbox mode
                    let tileDisabledHotspots = isMeepleMode ? disabledHotspots : undefined;
                    if (isMeepleMode && sandboxMode) {
                        // In sandbox mode, disable all hotspots that don't start with 'field-'
                        const computedAllHotspots: string[] = [];
                        if (def.monastery) computedAllHotspots.push('monastery-0');
                        if (def.cityConnections) def.cityConnections.forEach((_, i) => computedAllHotspots.push(`city-${i}`));
                        if (def.roadConnections) def.roadConnections.forEach((_, i) => computedAllHotspots.push(`road-${i}`));
                        // Field hotspots are not added here because they are the *only* ones allowed.
                        // By setting tileDisabledHotspots to all non-field hotspots, we effectively enable only fields.
                        tileDisabledHotspots = computedAllHotspots;
                    }

                    return (
                        <div
                            key={placed.id}
                            style={{
                                position: 'absolute',
                                left: placed.x * 100 - 50,
                                top: placed.y * 100 - 50
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onTileClick?.(placed.x, placed.y, e);
                            }}
                            onContextMenu={(e) => {
                                if (sandboxMode) {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onContextMenu?.(placed.x, placed.y, e);
                                }
                            }}
                        >
                            <TileRenderer
                                def={def}
                                placed={placed}
                                meeplePlacementMode={isMeepleMode}
                                disabledHotspots={tileDisabledHotspots}
                                onFeatureClick={(fId) => onFeatureClick?.(fId, placed)}
                            />

                            {/* Field conquest overlay — mask approach */}
                            {fieldConquest && def?.fieldConnections && (() => {
                                const cityPaths = getCityMaskPaths(def);
                                const roadPaths = getRoadMaskPaths(def);
                                const hasMonastery = !!def.monastery;

                                const overlays: React.ReactNode[] = [];
                                def.fieldConnections.forEach((_, fIdx) => {
                                    const key = `${placed.x},${placed.y},${fIdx}`;
                                    const winners = fieldConquest.get(key);
                                    if (!winners || winners.length === 0) return;

                                    const fieldD = def.fieldPaths?.[fIdx];
                                    const isFullTile = def.fieldConnections!.length === 1;

                                    if (!fieldD && !isFullTile) return;

                                    const patId = `fc-pat-${placed.x}-${placed.y}-${fIdx}-${winners.join('-')}`;
                                    const maskId = `fc-msk-${placed.x}-${placed.y}-${fIdx}`;
                                    const clipId = `fc-clp-${placed.x}-${placed.y}-${fIdx}`;
                                    const colors = winners.map(p => PLAYER_COLORS[p] || '#888');

                                    overlays.push(
                                        <svg
                                            key={key}
                                            width="100" height="100"
                                            viewBox="0 0 100 100"
                                            style={{
                                                position: 'absolute', top: 0, left: 0,
                                                transform: `rotate(${placed.rotation * 90}deg)`,
                                                transformOrigin: '50% 50%',
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            <defs>
                                                {/* Stripe pattern */}
                                                {colors.length === 1 ? (
                                                    <pattern id={patId} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform={`translate(50, 50) rotate(${-placed.rotation * 90}) translate(${-50 - placed.x * 100}, ${-50 - placed.y * 100}) rotate(45)`}>
                                                        <rect width="10" height="10" fill={colors[0]} fillOpacity="0.22" />
                                                        <line x1="0" y1="5" x2="10" y2="5" stroke={colors[0]} strokeWidth="4" strokeOpacity="0.7" />
                                                    </pattern>
                                                ) : (
                                                    <pattern id={patId} x="0" y="0" width={colors.length * 10} height={colors.length * 10} patternUnits="userSpaceOnUse" patternTransform={`translate(50, 50) rotate(${-placed.rotation * 90}) translate(${-50 - placed.x * 100}, ${-50 - placed.y * 100}) rotate(45)`}>
                                                        {colors.map((c, ci) => (
                                                            <React.Fragment key={ci}>
                                                                <line x1="0" y1={ci * 10 + 5} x2={colors.length * 10} y2={ci * 10 + 5} stroke={c} strokeWidth="4" strokeOpacity="1.0" />
                                                            </React.Fragment>
                                                        ))}
                                                    </pattern>
                                                )}

                                                {/* Mask: white = draw stripe, black = hide (roads/cities/monastery) */}
                                                <mask id={maskId}>
                                                    <rect width="100" height="100" fill="white" />
                                                    {cityPaths.map((d, i) => <path key={`c${i} `} d={d} fill="black" />)}
                                                    {roadPaths.map((d, i) => (
                                                        <path key={`r${i} `} d={d} fill="none" stroke="black" strokeWidth="12" strokeLinecap="round" />
                                                    ))}
                                                    {hasMonastery && <circle cx="50" cy="50" r="24" fill="black" />}
                                                </mask>

                                                {/* Clip to exact path (for multi-field) or full rect (single-field) */}
                                                <clipPath id={clipId}>
                                                    {isFullTile ? <rect width="100" height="100" /> : <path d={fieldD} />}
                                                </clipPath>
                                            </defs>

                                            {/* Fill: pattern, masked to field-only areas, clipped to this field zone */}
                                            <rect
                                                x="0" y="0" width="100" height="100"
                                                fill={`url(#${patId})`}
                                                mask={`url(#${maskId})`}
                                                clipPath={`url(#${clipId})`}
                                            />
                                        </svg>
                                    );
                                });
                                return overlays;
                            })()}
                        </div>
                    );
                })}
                {validPlacements.map((pos, idx) => (
                    <div
                        key={`valid-${pos.x}-${pos.y}-${idx}`}
                        style={{
                            position: 'absolute',
                            left: pos.x * 100 - 45,
                            top: pos.y * 100 - 45,
                            width: 90,
                            height: 90,
                            backgroundColor: 'rgba(76, 175, 80, 0.4)',
                            border: '3px dashed #388e3c',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            boxSizing: 'border-box'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlacementClick?.(pos.x, pos.y);
                        }}
                    />
                ))}

                {/* Score Animations */}
                {state.scoreUpdates?.map((update, i) => {
                    let sumX = 0, sumY = 0;
                    update.completedComponentIds.forEach(cid => {
                        const [xStr, yStr] = cid.split(',');
                        sumX += parseFloat(xStr);
                        sumY += parseFloat(yStr);
                    });
                    const count = update.completedComponentIds.length;
                    const avgX = count > 0 ? (sumX / count) * 100 : 0;
                    const avgY = count > 0 ? (sumY / count) * 100 : 0;
                    return (
                        <div
                            key={`score - ${state.scoreUpdateKey ?? i} -${update.completedComponentIds[0] ?? i} `}
                            style={{
                                position: 'absolute',
                                left: avgX,
                                top: avgY,
                                zIndex: 100, // Stay above tiles
                                pointerEvents: 'none',
                                animation: 'scoreFloatUp 3s ease-out forwards'
                            }}
                        >
                            <div style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                border: '2px solid #ffb300',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <span style={{ fontSize: '28px', fontWeight: '900', color: '#f57c00', textShadow: '1px 1px 0px #fff' }}>
                                    +{update.points}
                                </span>
                                <span style={{ fontSize: '14px', color: '#424242', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    {update.featureName}
                                </span>
                                {update.returnedMeeples.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                        {update.returnedMeeples.map(m => (
                                            <div key={m.meeple.id} style={{
                                                width: 14, height: 14, borderRadius: '50%',
                                                backgroundColor: PLAYER_COLORS[m.meeple.playerId] || '#999',
                                                border: '2px solid white',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                                            }} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
