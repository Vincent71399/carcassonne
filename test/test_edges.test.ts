import { describe, it, expect } from 'vitest';
import { rotateEdges, edgeMatches } from '../src/engine/board';
import { BASE_TILES } from '../src/engine/tiles';

describe('Edge Rotation Logic', () => {
    it('should correctly rotate edges for Tile D', () => {
        const tileD = BASE_TILES.find(t => t.typeId === 'D')!;
        const edges = tileD.edges;

        // Tile D: { top: r, right: r, bottom: r, left: r }
        // All edges are the same, so rotation should not change anything.
        expect(rotateEdges(edges, 0)).toEqual(edges);
        expect(rotateEdges(edges, 1)).toEqual(edges);
        expect(rotateEdges(edges, 2)).toEqual(edges);
        expect(rotateEdges(edges, 3)).toEqual(edges);
    });

    it('should correctly rotate edges for Tile V', () => {
        const tileV = BASE_TILES.find(t => t.typeId === 'V')!;
        const edges = tileV.edges;

        // Tile V: { top: f, right: c, bottom: c, left: c }

        // Rot 0: top=f, right=c, bottom=c, left=c
        const rot0 = rotateEdges(edges, 0);
        expect(rot0.top).toEqual(['field', 'field', 'field']);
        expect(rot0.right).toEqual(['city', 'city', 'city']);
        expect(rot0.bottom).toEqual(['city', 'city', 'city']);
        expect(rot0.left).toEqual(['city', 'city', 'city']);

        // Rot 1: top=c, right=f, bottom=c, left=c
        const rot1 = rotateEdges(edges, 1);
        expect(rot1.top).toEqual(['city', 'city', 'city']);
        expect(rot1.right).toEqual(['field', 'field', 'field']);
        expect(rot1.bottom).toEqual(['city', 'city', 'city']);
        expect(rot1.left).toEqual(['city', 'city', 'city']);

        // Rot 2: top=c, right=c, bottom=f, left=c
        const rot2 = rotateEdges(edges, 2);
        expect(rot2.top).toEqual(['city', 'city', 'city']);
        expect(rot2.right).toEqual(['city', 'city', 'city']);
        expect(rot2.bottom).toEqual(['field', 'field', 'field']);
        expect(rot2.left).toEqual(['city', 'city', 'city']);

        // Rot 3: top=c, right=c, bottom=c, left=f
        const rot3 = rotateEdges(edges, 3);
        expect(rot3.top).toEqual(['city', 'city', 'city']);
        expect(rot3.right).toEqual(['city', 'city', 'city']);
        expect(rot3.bottom).toEqual(['city', 'city', 'city']);
        expect(rot3.left).toEqual(['field', 'field', 'field']);
    });
});

describe('Edge Matching Logic', () => {
    // Based on test/utils/debug_rotation.ts
    const tileD = BASE_TILES.find(t => t.typeId === 'D')!; // all roads: r, r, r, r
    const tileV = BASE_TILES.find(t => t.typeId === 'V')!; // top: f, right: c, bottom: c, left: c
    const tileA = BASE_TILES.find(t => t.typeId === 'A')!; // top: f, right: f, bottom: r, left: r

    it('should correctly match compatible edges', () => {
        const dRight = rotateEdges(tileD.edges, 0).right; // road
        const vLeft0 = rotateEdges(tileV.edges, 0).left; // city
        const aBottom0 = rotateEdges(tileA.edges, 0).bottom; // road

        expect(edgeMatches(dRight, vLeft0)).toBe(false); // road vs city
        expect(edgeMatches(dRight, aBottom0)).toBe(true);  // road vs road
    });

    it('should correctly match rotated edges', () => {
        const dRight = rotateEdges(tileD.edges, 0).right; // road (r)

        // Tile A (rot 0): top=f, right=f, bottom=r, left=r
        // A rot 0: bottom matches D right
        expect(edgeMatches(dRight, rotateEdges(tileA.edges, 0).bottom)).toBe(true);
        // A rot 0: left matches D right
        expect(edgeMatches(dRight, rotateEdges(tileA.edges, 0).left)).toBe(true);
        // A rot 0: top (f) does NOT match D right (r)
        expect(edgeMatches(dRight, rotateEdges(tileA.edges, 0).top)).toBe(false);
    });
});
