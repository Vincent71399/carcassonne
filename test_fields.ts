import { createInitialState, placeTile } from './src/engine/state';
import { getOccupiedFeaturesOnTile, evaluateFeature } from './src/engine/features';
import { BASE_TILES } from './src/engine/tiles';

console.log('--- Testing Field Traversal & Occupation ---');
const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });

// Tile U: Straight road top-to-bottom. Fields on left and right.
BASE_TILES.find(t => t.typeId === 'U');
// Tile V: Curve road bottom-left. Fields on top/right.
BASE_TILES.find(t => t.typeId === 'V');

// D is at 0,0.
const D = state.board['0,0'];
console.log('Tile D check:', D ? D.typeId : 'MISSING');
const defD = BASE_TILES.find(t => t.typeId === 'D');
console.log('Def D fieldConnections:', defD?.fieldConnections);

// Place A at 0, 1 (rot 0). Top of U is r. Wait, D's bottom is f! So U top cannot be r!
const tileA = BASE_TILES.find(t => t.typeId === 'A')!;
state.hands[1][0] = tileA;
placeTile(state, 1, 0, 0, 1, 0);

// Place meeple on A's field
state.board['0,1'].meeples.push({
    meeple: { id: 'm1', playerId: 1, type: 'standard' },
    featureId: 'field-0'
});

// Now let's check D (at 0,0) to see if its field is occupied!
// D has field on bottom (field-1 is below road).
const occupiedD = getOccupiedFeaturesOnTile(state.board, 0, 0);
console.log('Occupied features on D (0,0):', occupiedD);
console.log('Expect field-1 to be occupied:', occupiedD.includes('field-1'));

// Let's place another A below A.
state.hands[2][0] = tileA;
state.currentPlayerIndex = 1; // P2 turn
const s2 = placeTile(state, 2, 0, 0, 2, 0);
console.log('Placed A2?', s2);

// Check if A2's field is occupied
const occupiedA2 = getOccupiedFeaturesOnTile(state.board, 0, 2);
console.log('Occupied features on A2 (0,2):', occupiedA2);
console.log('Expect field-0 to be occupied:', occupiedA2.includes('field-0'));

// What about evaluating field-1 on D?
const evalD = evaluateFeature(state.board, 0, 0, 'field', 1);
console.log('Field evaluation size for D field-1:', evalD.components.length);
