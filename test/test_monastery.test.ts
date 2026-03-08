import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { checkAndScoreFeatures } from '../src/engine/scoring';

describe('Monastery Scoring Logic', () => {
    it('should correctly score a fully surrounded monastery', () => {
        const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });

        // Clear board for explicit setup
        state.board = {};

        // Place a fully surrounded monastery at 0,0
        // (dx/dy from -1 to 1 covers 9 tiles total)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                state.board[`${dx},${dy}`] = {
                    id: `tile_${dx}_${dy}`,
                    typeId: (dx === 0 && dy === 0) ? 'E' : 'A', // center is monastery (E), neighbors are A
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

        // Hack state to score it (monastery requires recentTilePosition to trigger score check)
        state.recentTilePosition = { x: 0, y: 0 };

        const updates = checkAndScoreFeatures(state);

        // A full monastery is 9 points (1 for the tile itself + 8 neighbors)
        const monasteryUpdate = updates.find(u => u.category === 'monastery');
        expect(monasteryUpdate).toBeDefined();
        expect(monasteryUpdate?.points).toBe(9);
        expect(monasteryUpdate?.players).toContain(1);
    });
});
