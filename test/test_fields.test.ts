import { describe, it, expect } from 'vitest';
import { createInitialState, placeTile } from '../src/engine/state';
import { getOccupiedFeaturesOnTile, evaluateFeature } from '../src/engine/features';
import { BASE_TILES } from '../src/engine/tiles';

describe('Field Traversal & Occupation', () => {
    it('should correctly identify occupied fields across connected tiles', () => {
        // Create initial state with 2 players (using numeric IDs)
        const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });

        // Initial board has 'Start' tile at 0,0.
        // Start tile: { top=c, right=r, bottom=f, left=r }
        // field-0 is right-0, left-2
        // field-1 is right-2, bottom-0, bottom-1, bottom-2, left-0

        // Let's place Tile A at 0, 1 (below Start tile)
        // Tile A: { top=f, right=f, bottom=r, left=r }
        // A's top=f matches Start's bottom=f. Correct.
        const tileA = BASE_TILES.find(t => t.typeId === 'A')!;
        state.hands[1] = [tileA, ...state.hands[1].slice(1)];

        // placeTile(state, playerId, handIndex, x, y, rotation)
        const success = placeTile(state, 1, 0, 0, 1, 0);
        expect(success).toBe(true);
        expect(state.board['0,1']).toBeDefined();

        // Place meeple on A's field-0 (top field)
        state.board['0,1'].meeples.push({
            meeple: { id: 'm1', playerId: 1, type: 'standard' },
            featureId: 'field-0'
        });

        // Check if Start tile's field-1 (bottom field) is occupied
        // A (0,1) field-0 is at top. Start (0,0) field-1 is at bottom. They match.
        const occupiedStart = getOccupiedFeaturesOnTile(state.board, 0, 0);
        expect(occupiedStart).toContain('field-1');

        // Evaluate field-1 on Start tile
        const evalStart = evaluateFeature(state.board, 0, 0, 'field', 1);

        // Manually check ownership since FeatureEvaluation doesn't have .owner
        const meepleCounts: Record<number, number> = {};
        for (const comp of evalStart.components) {
            const tile = state.board[`${comp.tileX},${comp.tileY}`];
            if (!tile) continue;
            for (const m of tile.meeples) {
                if (m.featureId === comp.featureId) {
                    meepleCounts[m.meeple.playerId] = (meepleCounts[m.meeple.playerId] || 0) + 1;
                }
            }
        }

        // Player 1 should have 1 meeple on this field
        expect(meepleCounts[1]).toBe(1);
        expect(meepleCounts[2] || 0).toBe(0);
    });
});
