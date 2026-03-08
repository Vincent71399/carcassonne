import { createInitialState, placeTile, placeMeeple } from '../src/engine/state';
import { BASE_TILES } from '../src/engine/tiles';

console.log('--- Testing Tile S Meeple Placement ---');
const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });

const tileS = BASE_TILES.find(t => t.typeId === 'S')!;

// Clear board
state.board = {};

// Give player Tile S
state.hands[1][0] = tileS;

// Place Tile S at 0,0
placeTile(state, 1, 0, 0, 0, 0);

console.log('Tile S placed. Phase:', state.turnPhase);

// Try to place meeple on left road ('road-2')
try {
    const success = placeMeeple(state, 1, 'road-2');
    console.log('Meeple placed?', success);
    console.log('Phase after placement:', state.turnPhase);
} catch (e) {
    console.error('CRASH placing meeple:', e);
}
