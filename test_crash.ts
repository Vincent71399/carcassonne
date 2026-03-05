import { createInitialState, placeTile, endTurn } from './src/engine/state';
import { getOccupiedFeaturesOnTile, evaluateFeature } from './src/engine/features';
import { BASE_TILES } from './src/engine/tiles';
import type { GameState } from './src/engine/types';

console.log('--- Simulating Tile B Placement ---');

const state = createInitialState(['P1', 'P2']);

// Find Tile B in the deck or manually add it to hand
const tileB = BASE_TILES.find(t => t.typeId === 'B')!;

// Force Tile B into Player 1's hand
state.hands['P1'][0] = tileB;

console.log('Placing Tile B at x:0, y:1 (rot: 0)...');
// Place it below the starting tile D
const success = placeTile(state, 'P1', 0, 0, 1, 0);
console.log('Placement success:', success);

if (success) {
    console.log('Checking occupied features on new tile...');
    try {
        const occupied = getOccupiedFeaturesOnTile(state.board, 0, 1);
        console.log('Occupied features:', occupied);
    } catch (e) {
        console.error('CRASH in getOccupiedFeaturesOnTile:', e);
    }

    console.log('Evaluating road on Tile B manually...');
    try {
        const result = evaluateFeature(state.board, 0, 1, 'road', 0);
        console.log('Evaluation result:', result);
    } catch (e) {
        console.error('CRASH in evaluateFeature:', e);
    }
}
