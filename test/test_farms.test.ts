import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { scoreEndGame } from '../src/engine/scoring';

describe('Farm Scoring Logic', () => {
    it('should correctly score farms at the end of the game', () => {
        const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });
        state.deck = []; // Empty deck to trigger end game scoring
        state.board = {};

        // Tile L: { top: c, right: r, bottom: f, left: r }
        // field-0 is right-0, left-2 (top field)
        // field-1 is right-2, bottom-0, bottom-1, bottom-2, left-0 (bottom field)

        state.board['0,0'] = {
            id: 't1',
            typeId: 'L',
            x: 0, y: 0,
            rotation: 0,
            meeples: [
                { featureId: 'field-1', meeple: { id: 'm1', playerId: 1, type: 'standard' } }
            ]
        };

        // This farm (field-1) touches 0 completed cities currently.
        // Score should be 0.
        const updates = scoreEndGame(state);
        const fieldUpdate = updates.find(u => u.category === 'field');

        // If there are no completed cities, points should be 0.
        // The scoring engine might not even return an update if 0 points.
        if (fieldUpdate) {
            expect(fieldUpdate.points).toBe(0);
        }
    });
});
