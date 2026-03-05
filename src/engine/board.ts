import type { PlacedTile, TileDefinition, TileEdges, DetailedEdge } from './types';
import { TILES_MAP } from './tiles';

// Rotate edges 90 degrees clockwise
export function rotateEdges(edges: TileEdges, rotations: number): TileEdges {
    let rotated = { ...edges };
    for (let i = 0; i < (rotations % 4); i++) {
        rotated = {
            top: rotated.left,
            right: rotated.top,
            bottom: rotated.right,
            left: rotated.bottom
        };
    }
    return rotated;
}

export function edgeMatches(edge1: DetailedEdge, edge2: DetailedEdge): boolean {
    // edge2 is the adjacent tile's edge. since they face each other, the order of segments 
    // left-to-right on edge1 meets right-to-left on edge2.
    if (edge1.length !== edge2.length) return false;
    for (let i = 0; i < edge1.length; i++) {
        if (edge1[i] !== edge2[edge2.length - 1 - i]) {
            return false;
        }
    }
    return true;
}

export function isValidPlacement(
    board: Record<string, PlacedTile>,
    x: number,
    y: number,
    tileDef: TileDefinition,
    rotation: number
): boolean {
    const coord = `${x},${y}`;
    // 1. Must be empty
    if (board[coord]) return false;

    // 2. Must be adjacent to at least one tile (unless board is fully empty)
    const isFirstTile = Object.keys(board).length === 0;

    const neighbors = {
        top: board[`${x},${y - 1}`],
        right: board[`${x + 1},${y}`],
        bottom: board[`${x},${y + 1}`],
        left: board[`${x - 1},${y}`]
    };

    const hasNeighbor = Object.values(neighbors).some(n => !!n);
    if (!isFirstTile && !hasNeighbor) return false;

    const newEdges = rotateEdges(tileDef.edges, rotation);

    // 3. Edges must match all adjacent tiles
    if (neighbors.top) {
        const neighborDef = TILES_MAP[neighbors.top.typeId];
        const neighborEdges = rotateEdges(neighborDef.edges, neighbors.top.rotation);
        if (!edgeMatches(newEdges.top, neighborEdges.bottom)) return false;
    }

    if (neighbors.right) {
        const neighborDef = TILES_MAP[neighbors.right.typeId];
        const neighborEdges = rotateEdges(neighborDef.edges, neighbors.right.rotation);
        if (!edgeMatches(newEdges.right, neighborEdges.left)) return false;
    }

    if (neighbors.bottom) {
        const neighborDef = TILES_MAP[neighbors.bottom.typeId];
        const neighborEdges = rotateEdges(neighborDef.edges, neighbors.bottom.rotation);
        if (!edgeMatches(newEdges.bottom, neighborEdges.top)) return false;
    }

    if (neighbors.left) {
        const neighborDef = TILES_MAP[neighbors.left.typeId];
        const neighborEdges = rotateEdges(neighborDef.edges, neighbors.left.rotation);
        if (!edgeMatches(newEdges.left, neighborEdges.right)) return false;
    }

    return true;
}

// Helper to find all valid (x,y) positions for a specific tile and rotation
export function getValidPlacements(
    board: Record<string, PlacedTile>,
    tileDef: TileDefinition,
    rotation: number
): { x: number, y: number }[] {
    const validSpots: { x: number, y: number }[] = [];

    // If board is empty, 0,0 is the only valid spot (though normally start tile is placed automatically)
    if (Object.keys(board).length === 0) {
        if (isValidPlacement(board, 0, 0, tileDef, rotation)) {
            validSpots.push({ x: 0, y: 0 });
        }
        return validSpots;
    }

    // Check all adjacent empty spots to existing tiles
    const checked = new Set<string>();

    for (const posStr of Object.keys(board)) {
        const [px, py] = posStr.split(',').map(Number);
        const adjacent = [
            { x: px, y: py - 1 },
            { x: px + 1, y: py },
            { x: px, y: py + 1 },
            { x: px - 1, y: py }
        ];

        for (const spot of adjacent) {
            const spotKey = `${spot.x},${spot.y}`;
            if (!checked.has(spotKey) && !board[spotKey]) {
                checked.add(spotKey);
                if (isValidPlacement(board, spot.x, spot.y, tileDef, rotation)) {
                    validSpots.push(spot);
                }
            }
        }
    }

    return validSpots;
}
