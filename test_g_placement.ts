import { createInitialState } from './src/engine/state';
import { isValidPlacement } from './src/engine/board';
import { BASE_TILES } from './src/engine/tiles';

console.log('--- Simulating Tile G and U Placements ---');
const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });

const tileU = BASE_TILES.find(t => t.typeId === 'U')!;
const tileG = BASE_TILES.find(t => t.typeId === 'G')!;

// 1. Emulate starting the board with Tile U at 0,0
state.board['0,0'] = {
    id: 'u1', typeId: 'U', x: 0, y: 0, rotation: 0, meeples: []
};

console.log('Tile U placed at (0,0)');
console.log('U Edges:', tileU.edges);
console.log('G Edges:', tileG.edges);

// 2. Can we place Tile G at (1,0)? i.e., immediately to the right of U?
// U right edge = ["field","field","field"]
// G left edge = ["field","field","field"]
const gRightValidRot0 = isValidPlacement(state.board, 1, 0, tileG, 0);
console.log('Can place G at (1,0) directly right of U? ', gRightValidRot0);

// 3. What if we try to place Tile G at (0,-1)? i.e., immediately above U?
// U top edge = ["field","road","field"]
// G bottom edge = ["city","city","city"]
const gTopValidRot0 = isValidPlacement(state.board, 0, -1, tileG, 0);
console.log('Can place G at (0,-1) directly above U (road meets city)? ', gTopValidRot0);
