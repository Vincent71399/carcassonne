import { createInitialState } from './src/engine/state';
import { checkAndScoreFeatures } from './src/engine/scoring';
import { BASE_TILES } from './src/engine/tiles';

console.log('--- Testing Monastery Scoring ---');
const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });

BASE_TILES.find(t => t.typeId === 'A');

// Clear board
state.board = {};

// Place a fully surrounded monastery at 0,0
for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
        state.board[`${dx},${dy}`] = {
            id: `tile_${dx}_${dy}`,
            typeId: 'A', // all monasteries for fun!
            x: dx,
            y: dy,
            rotation: 0,
            meeples: []
        };
    }
}

// Put a meeple on the center monastery (0,0)
state.board['0,0'].meeples.push({
    meeple: { id: 'm1', playerId: 1, type: 'standard' },
    featureId: 'monastery-0'
});

// Put a P2 meeple on an adjacent monastery (1,0)
state.board['1,0'].meeples.push({
    meeple: { id: 'm2', playerId: 2, type: 'standard' },
    featureId: 'monastery-0'
});

// Hack state to score it
state.recentTilePosition = { x: 0, y: 0 };
state.scores = { 1: 0, 2: 0 };
state.remainingMeeples = { 1: { standard: 7, large: 0, builder: 0, pig: 0, abbott: 0 }, 2: { standard: 7, large: 0, builder: 0, pig: 0, abbott: 0 } };

const updates = checkAndScoreFeatures(state);
console.log('Score Updates:', JSON.stringify(updates, null, 2));
