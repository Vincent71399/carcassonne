import { rotateEdges } from '../src/engine/board';
import { BASE_TILES } from '../src/engine/tiles';

const tileD = BASE_TILES.find(t => t.typeId === 'D')!;
const tileV = BASE_TILES.find(t => t.typeId === 'V')!;

console.log('Tile D edges:', tileD.edges);
console.log('Tile V edges:', tileV.edges);

console.log('--- Checking D rotation ---');
for (let i = 0; i < 4; i++) {
    console.log(`D rot ${i}:`, rotateEdges(tileD.edges, i));
}

console.log('--- Checking V rotation ---');
for (let i = 0; i < 4; i++) {
    console.log(`V rot ${i}:`, rotateEdges(tileV.edges, i));
}
