import { getValidPlacements, rotateEdges, edgeMatches } from './src/engine/board';
import { BASE_TILES } from './src/engine/tiles';
import type { PlacedTile } from './src/engine/types';

const board: Record<string, PlacedTile> = {};

// Place D at 0,0, rotation 0
const tileD = BASE_TILES.find(t => t.typeId === 'D');
board['0,0'] = {
    id: 'd1',
    typeId: 'D',
    x: 0,
    y: 0,
    rotation: 0,
    meeples: []
};

// D edges rot 0: top=c, right=r, bottom=f, left=r

const tileA = BASE_TILES.find(t => t.typeId === 'A');
// A edges: f on all sides

console.log('Testing placements for Tile A (all fields) around Tile D (c, r, f, r)...');
const placements = getValidPlacements(board, tileA, 0);
console.log('Valid placements for A rot 0:', placements);

for (let r = 0; r < 4; r++) {
    console.log(`Valid placements for A rot ${r}:`, getValidPlacements(board, tileA, r));
}

// Next testing Tile V (f, f, r, r)
const tileV = BASE_TILES.find(t => t.typeId === 'V');
for (let r = 0; r < 4; r++) {
    console.log(`Valid placements for V rot ${r}:`, getValidPlacements(board, tileV, r));
}
