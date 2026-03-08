import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tilesFile = join(__dirname, '../src/engine/tiles.ts');

let content = fs.readFileSync(tilesFile, 'utf8');

const mapping = {
    'G': '[[0]]',
    'H': '[[0], []]',
    'I': '[[], [0]]',
    'J': '[[0, 1]]',
    'K': '[[0, 1]]',
    'L': '[[0], []]',
    'M': '[[0], [], []]',
    'N': '[[0]]',
    'O': '[[0]]',
    'P': '[[], [0]]',
    'Q': '[[], [0]]',
    'R': '[[0], [0]]',
    'S': '[[0], [0]]',
    'U': '[[0], [0], [0], [0]]',
    'V': '[[0]]',
    'W': '[[0], [0]]',
    'X': '[[0], [0]]',
    'Start': '[[0], []]'
};

for (const [typeId, ac] of Object.entries(mapping)) {
    // We match the whole object of the tile up to fieldConnections
    const rx = new RegExp("(typeId:\\s*'" + typeId + "'[\\s\\S]*?fieldConnections\\s*:\\s*\\[.*?\\])(,?\\s*\\n\\s*\\}(\\s*,?))");
    if (rx.test(content)) {
        content = content.replace(rx, "$1,\n        adjacentCities: " + ac + "$2");
    } else {
        // Assume it might have fieldPaths so regex needs to match just after fieldConnections
        const rx2 = new RegExp("(typeId:\\s*'" + typeId + "'[\\s\\S]*?fieldConnections\\s*:\\s*\\[.*?\\]\\])(,\\n\\s*fieldPaths)");
        if (rx2.test(content)) {
            content = content.replace(rx2, "$1,\n        adjacentCities: " + ac + "$2");
        }
    }
}

fs.writeFileSync(tilesFile, content);
console.log('patched adjacentCities');
