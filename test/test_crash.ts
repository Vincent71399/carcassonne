import { createInitialState, placeTile } from '../src/engine/state';
import { getOccupiedFeaturesOnTile, evaluateFeature } from '../src/engine/features';
import { BASE_TILES } from '../src/engine/tiles';

console.log('--- Simulating Tile B Placement ---');

const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });

// Find Tile B in the deck or manually add it to hand
const tileB = BASE_TILES.find(t => t.typeId === 'B')!;

// Force Tile B into Player 1's hand
state.hands[1][0] = tileB;
const success = placeTile(state, 1, 0, 0, 1, 0);
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
