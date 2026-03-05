import { createInitialState, placeTile } from './src/engine/state';
import { evaluateMonastery } from './src/engine/features';
import { checkAndScoreFeatures } from './src/engine/scoring';
import { BASE_TILES } from './src/engine/tiles';

console.log('--- Testing Monastery Scoring ---');
const state = createInitialState(['P1', 'P2']);

const tileA = BASE_TILES.find(t => t.typeId === 'A')!;

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
    meeple: { id: 'm1', playerId: 0, type: 'standard' },
    featureId: 'monastery-0'
});

// Put a P2 meeple on an adjacent monastery (1,0)
state.board['1,0'].meeples.push({
    meeple: { id: 'm2', playerId: 1, type: 'standard' },
    featureId: 'monastery-0'
});

// Hack state to score it
state.recentTilePosition = { x: 0, y: 0 };
state.scores = [0, 0];
state.remainingMeeples = [{ standard: 7 }, { standard: 7 }] as any;

const updates = checkAndScoreFeatures(state);
console.log('Score Updates:', JSON.stringify(updates, null, 2));
