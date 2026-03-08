import { rotateEdges, edgeMatches } from '../../src/engine/board';
import { BASE_TILES } from '../../src/engine/tiles';

const tileD = BASE_TILES.find(t => t.typeId === 'D')!; // top: r, right: r, bottom: r, left: r
const tileV = BASE_TILES.find(t => t.typeId === 'V')!; // top: f, right: f, bottom: r, left: r

// Let's say Tile D is placed at 0,0 with rotation 0.
// We want to place Tile V at 1,0 (to the right of D).
// This means V's LEFT edge must match D's RIGHT edge.
// D's RIGHT edge = r = [f, r, f].

console.log("D's original edges:", tileD.edges);
console.log("V's original edges:", tileV.edges);

console.log("\nPlacing V to the right of D (1,0):");
console.log("D's right edge:", rotateEdges(tileD.edges, 0).right);

for (let r = 0; r < 4; r++) {
    const vEdges = rotateEdges(tileV.edges, r);
    console.log(`V rotation ${r}: Left edge =`, vEdges.left);
    console.log(`  Match? ${edgeMatches(rotateEdges(tileD.edges, 0).right, vEdges.left)}`);
}

// Now let's try something that SHOULD fail: placing A (all fields) next to D's right edge (road).
const tileA = BASE_TILES.find(t => t.typeId === 'A')!;
console.log("\nPlacing A to the right of D (1,0):");
for (let r = 0; r < 4; r++) {
    const aEdges = rotateEdges(tileA.edges, r);
    console.log(`A rotation ${r}: Left edge =`, aEdges.left);
    console.log(`  Match? ${edgeMatches(rotateEdges(tileD.edges, 0).right, aEdges.left)}`);
}
