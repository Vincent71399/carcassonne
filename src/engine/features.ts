import type { GameState, EdgeDirection, FeatureType } from './types';
import { TILES_MAP } from './tiles';

// A specific segment of a feature on a specific tile (matches the hotspot IDs like 'city-0')
export interface FeatureComponent {
    tileId: string; // The placed tile instance ID
    tileX: number;
    tileY: number;
    featureId: string; // The hotspot ID, e.g., 'city-0', 'road-1', 'monastery-0'
}

export interface FeatureEvaluation {
    isComplete: boolean;
    openEdges: number; // Number of edges that are open (not connected to another tile)
    components: FeatureComponent[]; // Specific segments making up this feature
}

// Helper: rotate a direction
export const rotateDir = (d: EdgeDirection, rotation: number): EdgeDirection => {
    const order: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
    const idx = order.indexOf(d);
    return order[(idx + rotation) % 4];
};

// Helper: which direction is opposite
const opposite = (dir: EdgeDirection): EdgeDirection => {
    switch (dir) {
        case 'top': return 'bottom';
        case 'right': return 'left';
        case 'bottom': return 'top';
        case 'left': return 'right';
    }
};

// Get the neighbor tile coordinate in a direction
const getNeighborCoord = (x: number, y: number, dir: EdgeDirection): { x: number, y: number } => {
    switch (dir) {
        case 'top': return { x, y: y - 1 };
        case 'bottom': return { x, y: y + 1 };
        case 'right': return { x: x + 1, y };
        case 'left': return { x: x - 1, y };
    }
};

/**
 * Traverse a city, road, or field feature starting from a given segment on a tile using BFS.
 */
export function evaluateFeature(
    board: GameState['board'],
    startX: number,
    startY: number,
    featureType: FeatureType,
    startFeatureIdx: number // The index of the feature on the start tile (e.g., 0 for 'city-0')
): FeatureEvaluation {
    const visitedSegments = new Set<string>(); // "x,y,featureType,idx"
    const components: FeatureComponent[] = [];
    let openEdges = 0;

    // Queue item: coords, type, and the local index of that generic feature (e.g., 0 for first city)
    const queue: { x: number, y: number, fType: FeatureType, fIdx: number }[] = [
        { x: startX, y: startY, fType: featureType, fIdx: startFeatureIdx }
    ];

    while (queue.length > 0) {
        const { x, y, fType, fIdx } = queue.shift()!;
        const segKey = `${x},${y},${fType},${fIdx}`;

        if (visitedSegments.has(segKey)) continue;
        visitedSegments.add(segKey);

        const tileKey = `${x},${y}`;
        const placedTile = board[tileKey];
        if (!placedTile) continue;

        const def = TILES_MAP[placedTile.typeId];
        if (!def) continue;

        let connections;
        if (fType === 'city') connections = def.cityConnections;
        else if (fType === 'road') connections = def.roadConnections;
        else if (fType === 'field') connections = def.fieldConnections;

        if (!connections || !connections[fIdx]) continue;

        const segmentEdges = connections[fIdx];

        components.push({
            tileId: placedTile.id,
            tileX: x,
            tileY: y,
            featureId: `${fType}-${fIdx}`
        });

        // For each locally unrotated edge in this segment, look out to the world
        for (const localEdge of segmentEdges) {
            let worldDir: EdgeDirection;
            let fieldSegmentIdx: string | undefined;

            if (fType === 'field') {
                const parts = (localEdge as string).split('-');
                worldDir = rotateDir(parts[0] as EdgeDirection, placedTile.rotation);
                fieldSegmentIdx = parts[1];
            } else {
                worldDir = rotateDir(localEdge as EdgeDirection, placedTile.rotation);
            }

            const neighborCoord = getNeighborCoord(x, y, worldDir);
            const nextTileKey = `${neighborCoord.x},${neighborCoord.y}`;
            const nextTile = board[nextTileKey];

            if (!nextTile) {
                // No tile connected to this edge
                openEdges++;
                continue;
            }

            const nextDef = TILES_MAP[nextTile.typeId];
            if (!nextDef) continue;

            // Find which segment on the neighbor tile connects to us
            const incomingWorldDir = opposite(worldDir);
            const incomingLocalDir = rotateDir(incomingWorldDir, (4 - nextTile.rotation) % 4);

            let incomingLocalEdge: string;
            if (fType === 'field') {
                // Fields hit the opposite segment index (0 hits 2, 1 hits 1, 2 hits 0)
                const incomingIdx = 2 - parseInt(fieldSegmentIdx!);
                incomingLocalEdge = `${incomingLocalDir}-${incomingIdx}`;
            } else {
                incomingLocalEdge = incomingLocalDir;
            }

            let nextConnections;
            if (fType === 'city') nextConnections = nextDef.cityConnections;
            else if (fType === 'road') nextConnections = nextDef.roadConnections;
            else if (fType === 'field') nextConnections = nextDef.fieldConnections;

            if (!nextConnections) continue;

            for (let i = 0; i < nextConnections.length; i++) {
                if (nextConnections[i].includes(incomingLocalEdge as any)) {
                    queue.push({
                        x: neighborCoord.x,
                        y: neighborCoord.y,
                        fType: fType,
                        fIdx: i
                    });
                    break;
                }
            }
        }
    }

    return {
        isComplete: openEdges === 0,
        openEdges,
        components
    };
}

/**
 * Check if a monastery is complete (surrounded by 8 tiles).
 */
export function evaluateMonastery(board: GameState['board'], x: number, y: number): FeatureEvaluation {
    const tileKey = `${x},${y}`;
    const centerTile = board[tileKey];
    if (!centerTile) return { isComplete: false, openEdges: 8, components: [] };
    const components: FeatureComponent[] = [];

    let openCount = 0;

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const currentTileKey = `${x + dx},${y + dy}`;
            if (!board[currentTileKey]) {
                openCount++;
            } else {
                components.push({
                    tileId: board[currentTileKey].id,
                    tileX: x + dx,
                    tileY: y + dy,
                    featureId: (dx === 0 && dy === 0) ? 'monastery-0' : 'monastery-surrounding'
                });
            }
        }
    }

    return {
        isComplete: openCount === 0,
        openEdges: openCount,
        components
    };
}

/**
 * Returns a list of featureIds on a given tile that are part of an already occupied feature.
 * Used to disable meeple placement on claimed features.
 */
export function getOccupiedFeaturesOnTile(board: GameState['board'], x: number, y: number): string[] {
    const tileKey = `${x},${y}`;
    const tile = board[tileKey];
    if (!tile) return [];
    const def = TILES_MAP[tile.typeId];
    if (!def) return [];

    const occupiedIds: string[] = [];

    const isFeatureOccupied = (evalResult: FeatureEvaluation) => {
        return evalResult.components.some(comp => {
            const cTile = board[`${comp.tileX},${comp.tileY}`];
            if (!cTile) return false;
            return cTile.meeples.some(m => m.featureId === comp.featureId);
        });
    };

    // Check cities
    if (def.cityConnections) {
        def.cityConnections.forEach((_, idx) => {
            const evalResult = evaluateFeature(board, x, y, 'city', idx);
            if (isFeatureOccupied(evalResult)) occupiedIds.push(`city-${idx}`);
        });
    }

    // Check roads
    if (def.roadConnections) {
        def.roadConnections.forEach((_, idx) => {
            const evalResult = evaluateFeature(board, x, y, 'road', idx);
            if (isFeatureOccupied(evalResult)) occupiedIds.push(`road-${idx}`);
        });
    }

    // Check monastery (monastery only exists on this tile)
    if (def.monastery) {
        if (tile.meeples.some(m => m.featureId === 'monastery-0')) {
            occupiedIds.push('monastery-0');
        }
    }

    // Check fields using actual graph traversal now!
    if (def.fieldConnections) {
        def.fieldConnections.forEach((_, idx) => {
            const evalResult = evaluateFeature(board, x, y, 'field', idx);
            if (isFeatureOccupied(evalResult)) occupiedIds.push(`field-${idx}`);
        });
    }

    return occupiedIds;
}
