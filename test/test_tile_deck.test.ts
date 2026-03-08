import { describe, it, expect } from 'vitest';
import { BASE_TILES } from '../src/engine/tiles';

describe('Tile Deck Composition', () => {
    it('should have exactly 72 tiles in the base deck', () => {
        const totalCount = BASE_TILES.reduce((sum, tile) => sum + tile.count, 0);
        expect(totalCount).toBe(72);
    });

    it('should have correct counts for specific tile types', () => {
        const tileA = BASE_TILES.find(t => t.typeId === 'A');
        expect(tileA?.count).toBe(9);

        const tileD = BASE_TILES.find(t => t.typeId === 'D');
        expect(tileD?.count).toBe(1);
    });

    it('should have symmetric edges where expected (sanity check)', () => {
        // Based on test/utils/check_tiles.ts
        BASE_TILES.forEach(tile => {
            for (const [dir, edge] of Object.entries(tile.edges)) {
                // In this engine, edges are [FeatureType, FeatureType, FeatureType]
                // For road edges like [field, road, field], edge[0] should equal edge[2].
                // This sanity check ensures we didn't accidentally break the edge definitions.
                expect(edge[0], `Tile ${tile.typeId} ${dir} edge asymmetry`).toBe(edge[2]);
            }
        });
    });
});
