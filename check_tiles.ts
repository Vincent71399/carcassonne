import { BASE_TILES } from './src/engine/tiles';

BASE_TILES.forEach(tile => {
    let hasAsymmetry = false;
    for (const [dir, edge] of Object.entries(tile.edges)) {
        if (edge[0] !== edge[2]) {
            console.log(`Asymmetric edge found on Tile ${tile.typeId} - ${dir}:`, edge);
            hasAsymmetry = true;
        }
    }
    if (hasAsymmetry) console.log('----');
});
console.log('Done checking tiles.');
