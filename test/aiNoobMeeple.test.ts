import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { getScoredMoves } from '../src/engine/ai';
import { PlayerId } from '../src/engine/types';
import { TILES_MAP } from '../src/engine/tiles';

describe('AI Noob Meeple Selection', () => {
    const p1 = 1 as PlayerId;
    const playerNames = { [p1]: 'NoobBot' };
    const playerTypes = { [p1]: 'ai-noob' as const };

    it('should allow ai-noob to place on fields when large meeple is available', () => {
        // Create state with large meeple enabled
        const state = createInitialState(playerNames, playerTypes, true);
        
        // Tile A: Monastery with 1 city edge and 3 field edges
        // It has fieldConnections: [['bottom-0', 'bottom-1', 'bottom-2', 'right-0', 'right-1', 'right-2', 'left-0', 'left-1', 'left-2']]
        const tileA = TILES_MAP['A'];
        
        const moves = getScoredMoves(state, p1, tileA, 0);
        
        // Check if any move has a field placement
        const fieldMoves = moves.filter(m => m.move.meeplePlacement?.featureId.startsWith('field'));
        expect(fieldMoves.length).toBeGreaterThan(0);
        
        // Check if any field move uses a large meeple
        const largeFieldMoves = fieldMoves.filter(m => m.move.meeplePlacement?.meepleType === 'large');
        expect(largeFieldMoves.length).toBeGreaterThan(0);
    });

    it('should NOT allow ai-noob to place on fields when large meeple is NOT available', () => {
        // Create state without large meeple enabled
        const state = createInitialState(playerNames, playerTypes, false);
        
        const tileA = TILES_MAP['A'];
        const moves = getScoredMoves(state, p1, tileA, 0);
        
        const fieldMoves = moves.filter(m => m.move.meeplePlacement?.featureId.startsWith('field'));
        expect(fieldMoves.length).toBe(0);
    });

    it('should allow ai-noob to place large meeple on cities', () => {
        const state = createInitialState(playerNames, playerTypes, true);
        
        // Tile G: City-City connection
        const tileG = TILES_MAP['G'];
        
        const moves = getScoredMoves(state, p1, tileG, 0);
        
        const largeCityMoves = moves.filter(m => 
            m.move.meeplePlacement?.featureId.startsWith('city') && 
            m.move.meeplePlacement?.meepleType === 'large'
        );
        expect(largeCityMoves.length).toBeGreaterThan(0);
    });

    it('should result in approximately 15% large meeple usage for cities (statistical)', () => {
        const state = createInitialState(playerNames, playerTypes, true);
        const tileG = TILES_MAP['G'];
        
        let largeCount = 0;
        const iterations = 200;
        for(let i=0; i<iterations; i++) {
            // We need a fresh state or at least fresh random each time, 
            // but getScoredMoves uses Math.random() internally.
            const moves = getScoredMoves(state, p1, tileG, 0);
            if (moves.length > 0 && moves[0].move.meeplePlacement?.meepleType === 'large') {
                largeCount++;
            }
        }
        
        const rate = largeCount / iterations;
        // Expected value is 0.15. 200 iterations gives a decent confidence interval.
        expect(rate).toBeGreaterThan(0.05);
        expect(rate).toBeLessThan(0.30);
    });
});
