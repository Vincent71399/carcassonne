import { describe, it, expect } from 'vitest';
import { getValidPlacements } from '../src/engine/board';
import { BASE_TILES } from '../src/engine/tiles';
import type { PlacedTile } from '../src/engine/types';

describe('Board Placement Logic', () => {
    const board: Record<string, PlacedTile> = {};

    // Base tile 'D' at 0,0, rotation 0
    // D edges rot 0: top=c (city), right=r (road), bottom=f (field), left=r (road)
    board['0,0'] = {
        id: 'd1',
        typeId: 'D',
        x: 0,
        y: 0,
        rotation: 0,
        meeples: []
    };

    it('should find valid placements for Tile A (roads/fields) around Tile D (all roads)', () => {
        const tileA = BASE_TILES.find(t => t.typeId === 'A')!;
        // Tile D (all roads: r, r, r, r)
        // Tile A (top:f, right:f, bottom:r, left:r)

        // Rot 0 (f, f, r, r):
        // matches D's top (r) with A's bottom (r) -> A at (0, -1)
        // matches D's right (r) with A's left (r) -> A at (1, 0)
        const placements = getValidPlacements(board, tileA, 0);

        expect(placements).toContainEqual({ x: 0, y: -1 });
        expect(placements).toContainEqual({ x: 1, y: 0 });
        expect(placements.length).toBe(2);
    });

    it('should NOT find valid placements for Tile V (city/pennant) around Tile D (all roads)', () => {
        const tileV = BASE_TILES.find(t => t.typeId === 'V')!;
        // Tile V: { top: f, right: c, bottom: c, left: c }
        // Tile D: { top: r, right: r, bottom: r, left: r }
        // None of the city edges can match the road edges of D.
        // Field edge of V (top in rot 0) could potentially match a field edge, but D has no field edges.

        for (let r = 0; r < 4; r++) {
            const placements = getValidPlacements(board, tileV, r);
            expect(placements.length).toBe(0);
        }
    });
});
