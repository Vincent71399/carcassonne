import { createInitialState } from './src/engine/state';
import { scoreEndGame } from './src/engine/scoring';

const state = createInitialState([1, 2]);
state.deck = [];
state.board = {};

// Tile L: City Top, Road Left-Right, Fields Top & Bottom.
state.board['0,0'] = {
    id: 't-0-0',
    typeId: 'L',
    x: 0, y: 0,
    rotation: 0,
    meeples: [
        // Place Player 1's standard meeple on field-1 (the Bottom field, perfectly walled off from the City by the road)
        { featureId: 'field-1', meeple: { id: 'm1', playerId: 1, type: 'standard' } }
    ]
};

const updates = scoreEndGame(state);

console.log("=== FIELD SCORING RESULTS ===");
const fieldUpdates = updates.filter(u => u.category === 'field');

if (fieldUpdates.length === 0) {
    console.log("No fields scored!");
} else {
    fieldUpdates.forEach(u => {
        console.log(`Players Awarded: ${u.players.join(', ')}`);
        console.log(`Points Awarded: ${u.points}`);
        console.log(`Score Reason: ${u.featureName}`);
        console.log('-'.repeat(30));
    });
}
