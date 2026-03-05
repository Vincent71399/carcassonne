import { createInitialState, placeTile } from './src/engine/state';
import { getOccupiedFeaturesOnTile, evaluateFeature } from './src/engine/features';
import { BASE_TILES } from './src/engine/tiles';

console.log('--- Testing Tile U and H Field Connection ---');
const state = createInitialState(['P1', 'P2']);

const tileU = BASE_TILES.find(t => t.typeId === 'U')!;
const tileH = BASE_TILES.find(t => t.typeId === 'H')!;

// Clear board and place H at 0,0
state.board = {};
state.board['0,0'] = {
    id: 'h1',
    typeId: 'H',
    x: 0,
    y: 0,
    rotation: 0,
    meeples: []
};

// Place farmer on H's field-0.
// H edges: top: c, right: f, bottom: f, left: c.
// H fieldConnections: [['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2']]
state.board['0,0'].meeples.push({
    meeple: { id: 'm1', playerId: 1, type: 'standard' },
    featureId: 'field-0'
});

// Place U below H at (0, 1) rot 1
// U rot 1 edges: top: f, right: r, bottom: f, left: r
// H rot 0 bottom: f, U rot 1 top: f. Matching!
state.board['0,1'] = {
    id: 'u1',
    typeId: 'U',
    x: 0,
    y: 1,
    rotation: 1,
    meeples: []
};

// Now test if U's field-0 and field-1 are considered occupied.
// U rot 1: top is field. U fieldConnections:
// ['top-0', 'left-2', 'left-1', 'left-0', 'bottom-2']
// ['top-2', 'right-0', 'right-1', 'right-2', 'bottom-0']
// So field-0 and field-1 both touch the top edge!
// Therefore, BOTH fields on U should be occupied by H's farmer.

const occupiedU = getOccupiedFeaturesOnTile(state.board, 0, 1);
console.log('Occupied features on U (0,1):', occupiedU);
console.log('Expect field-0 to be occupied:', occupiedU.includes('field-0'));

const evalResult = evaluateFeature(state.board, 0, 1, 'field', 0);
console.log('Eval of U field-0:', evalResult.components);
