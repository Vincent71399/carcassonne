import { createInitialState, placeTile } from '../src/engine/state';
import { evaluateFeature } from '../src/engine/features';
import { BASE_TILES } from '../src/engine/tiles';

console.log('--- Testing Road B-W Completion ---');
const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });

const tileB = BASE_TILES.find(t => t.typeId === 'B')!; // road bottom
const tileW = BASE_TILES.find(t => t.typeId === 'W')!; // road R, B, L

// D is at 0,0
state.hands[1][0] = tileB;
placeTile(state, 1, 0, 0, 1, 0); // B below D (x=0, y=1)

state.currentPlayerIndex = 1;
state.hands[2][0] = tileW;
placeTile(state, 2, 0, 0, 2, 1); // W below B (x=0, y=2) // W below B (x=0, y=2)

// Now B's bottom road connects to W's top road.
// W's top road terminates in the village. B's bottom road originates in the monastery.
// This forms a complete 2-tile road!

const bRoadEval = evaluateFeature(state.board, 0, 1, 'road', 0);
console.log('Road Evaluation from B:', bRoadEval);

console.log('Did it complete? ', bRoadEval.isComplete === true ? 'YES!' : 'No.');
