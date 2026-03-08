import { getValidPlacements } from '../src/engine/board';
import { BASE_TILES } from '../src/engine/tiles';
import type { PlacedTile } from '../src/engine/types';

// Let's test W
const boardW: Record<string, PlacedTile> = {};
BASE_TILES.find(t => t.typeId === 'W');
boardW['0,0'] = {
    id: 'w1',
    typeId: 'W',
    x: 0,
    y: 0,
    rotation: 0, // top: f, right: r, bottom: r, left: r
    meeples: []
};

const tileB = BASE_TILES.find(t => t.typeId === 'B')!;
// B edges: top: f, right: f, bottom: r, left: f

console.log('--- Testing B placed around W ---');
for (let r = 0; r < 4; r++) {
    console.log(`Valid placements for B (rot ${r}) around W:`, getValidPlacements(boardW, tileB, r));
}

console.log('\n--- Testing B placed around D ---');
const boardD: Record<string, PlacedTile> = {};
BASE_TILES.find(t => t.typeId === 'D');
boardD['0,0'] = {
    id: 'd1',
    typeId: 'D',
    x: 0,
    y: 0,
    rotation: 0, // top: c, right: r, bottom: f, left: r
    meeples: []
};

for (let r = 0; r < 4; r++) {
    console.log(`Valid placements for B (rot ${r}) around D:`, getValidPlacements(boardD, tileB, r));
}
