import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tilesFile = join(__dirname, '../src/engine/tiles.ts');

let content = fs.readFileSync(tilesFile, 'utf8');

const pathsData = {
    'A': `['M 0 0 L 100 0 L 100 100 L 50 100 Q 50 50 0 50 Z', 'M 0 50 Q 50 50 50 100 L 0 100 Z']`,
    'B': `['M 0 0 L 50 0 L 50 100 L 0 100 Z', 'M 50 0 L 100 0 L 100 100 L 50 100 Z']`,
    'C': `['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 100 50 L 50 50 L 50 100 L 100 100 Z', 'M 0 50 L 50 50 L 50 100 L 0 100 Z']`,
    'D': `['M 50 0 L 100 0 L 100 50 L 50 50 Z', 'M 100 50 L 100 100 L 50 100 L 50 50 Z', 'M 0 50 L 50 50 L 50 100 L 0 100 Z', 'M 0 0 L 50 0 L 50 50 L 0 50 Z']`,
    'H': `['M 0 0 L 100 0 L 100 50 Q 50 50 50 100 L 0 100 Z', 'M 100 50 Q 50 50 50 100 L 100 100 Z']`,
    'I': `['M 50 0 Q 50 50 100 50 L 100 0 Z', 'M 50 0 Q 50 50 100 50 L 100 100 L 0 100 L 0 0 Z']`,
    'L': `['M 0 0 L 100 0 L 100 50 Q 50 50 0 50 Z', 'M 0 50 Q 50 50 100 50 L 100 100 L 0 100 Z']`,
    'M': `['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 100 50 L 50 50 L 50 100 L 100 100 Z', 'M 0 50 L 50 50 L 50 100 L 0 100 Z']`,
    'P': `['M 50 0 Q 50 50 100 50 L 100 0 Z', 'M 50 0 Q 50 50 100 50 L 100 100 L 0 100 L 0 0 Z']`,
    'Q': `['M 50 0 Q 50 50 100 50 L 100 0 Z', 'M 50 0 Q 50 50 100 50 L 100 100 L 0 100 L 0 0 Z']`,
    'R': `['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 0 50 L 100 50 L 100 100 L 0 100 Z']`,
    'S': `['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 0 50 L 100 50 L 100 100 L 0 100 Z']`,
    'W': `['M 0 0 L 50 0 L 50 50 L 0 50 Z', 'M 50 0 L 100 0 L 100 50 L 50 50 Z']`,
    'X': `['M 0 0 L 50 0 L 50 50 L 0 50 Z', 'M 50 0 L 100 0 L 100 50 L 50 50 Z']`,
    'Start': `['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 0 50 L 100 50 L 100 100 L 0 100 Z']`
};

for (const [typeId, paths] of Object.entries(pathsData)) {
    // We match the whole object of the tile
    const rx = new RegExp("(typeId:\\s*'" + typeId + "'[\\s\\S]*?fieldConnections\\s*:\\s*\\[.*?\\]\\])(,?\\s*\\n\\s*\\}(\\s*,?))");
    if (rx.test(content)) {
        content = content.replace(rx, "$1,\n        fieldPaths: " + paths + "$2");
    } else {
        // Maybe it already has fieldPaths or fieldPolygons?
        const rx2 = new RegExp("(typeId:\\s*'" + typeId + "'[\\s\\S]*?fieldConnections\\s*:\\s*\\[.*?\\]\\],\\n\\s*)(?:fieldPaths|fieldPolygons)\\s*:\\s*\\[.*?\\]");
        content = content.replace(rx2, "$1fieldPaths: " + paths);
    }
}

fs.writeFileSync(tilesFile, content);
console.log('patched fieldPaths heavily');
