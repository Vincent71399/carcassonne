import { describe, it, expect } from 'vitest';
import { createInitialState, placeTile } from '../src/engine/state';
import { evaluateFeature } from '../src/engine/features';
import { BASE_TILES } from '../src/engine/tiles';

describe('Road Completion Logic', () => {
    it('should correctly identify a completed road between two tiles', () => {
        const state = createInitialState({ 1: 'P1', 2: 'P2' }, { 1: 'human', 2: 'human' });

        // Start tile (0,0): { top=c, right=r, bottom=f, left=r }
        // Tile B (rot 0): { top=r, right=f, bottom=r, left=f }
        // Let's place B to the right of Start. 
        // Start's right (r) matches B's left (f) -> NO. 
        // Start's right (r) matches B's top (r)? No, top needs to match bottom.

        // Let's follow the original test: B below D(Start?).
        // Original test used 'D' which I found is all roads.
        // Start tile is NOT D.

        const tileB = BASE_TILES.find(t => t.typeId === 'B')!; // { top: r, right: f, bottom: r, left: f }
        const tileW = BASE_TILES.find(t => t.typeId === 'W')!; // { top: r, right: c, bottom: c, left: c }

        // Start (0,0) bottom is field. B top is road. Incompatible.
        // Let's find a tile that fits Start's bottom (field).
        // Tile A: { top: f, right: f, bottom: r, left: r }
        const tileA = BASE_TILES.find(t => t.typeId === 'A')!;

        state.hands[1] = [tileA];
        placeTile(state, 1, 0, 0, 1, 0); // A below Start (0,1). Top(f) matches Bottom(f).

        // A's bottom is road (r).
        // Let's place B below A. B's top is road (r).
        state.hands[2] = [tileB];
        state.currentPlayerIndex = 1; // P2 turn
        placeTile(state, 2, 0, 0, 2, 0); // B below A (0,2). Top(r) matches Bottom(r).

        // B's bottom is road (r).
        // Let's place W below B. W's top is road (r).
        state.hands[1] = [tileW];
        state.currentPlayerIndex = 0; // P1 turn
        placeTile(state, 1, 0, 0, 3, 0); // W below B (0,3). Top(r) matches Bottom(r).

        // Road Evaluation: A(0,1) bottom to B(0,2) to W(0,3) top.
        // A's road terminates at 'left'. B's road is straight. W's road terminates in city/village.
        // So the road goes from A-left to W-top.
        // A (0,1) road-0 connects bottom and left.

        const roadEval = evaluateFeature(state.board, 0, 2, 'road', 0);
        // Is it complete? 
        // A-left is open. So not complete.
        expect(roadEval.isComplete).toBe(false);

        // Now let's place another W at (-1, 1) and rotate it to match A's left road.
        // A (0,1) rot 0: top=f, right=f, bottom=r, left=r.
        // A's left (r) at (-1, 1).
        // W rot 1: top=c, right=r, bottom=c, left=c. (if rotation is clockwise)
        // Wait, rotateDir: ['top', 'right', 'bottom', 'left']. 
        // W (rot 0) top is r. 
        // W (rot 1) top=c, right=r, bottom=c, left=c.
        // So W at (-1, 1) rot 1 matches A's left road with its right road.

        state.hands[2] = [tileW];
        state.currentPlayerIndex = 1;
        placeTile(state, 2, 0, -1, 1, 1);

        const roadEvalComplete = evaluateFeature(state.board, 0, 2, 'road', 0);
        expect(roadEvalComplete.isComplete).toBe(true);
    });
});
