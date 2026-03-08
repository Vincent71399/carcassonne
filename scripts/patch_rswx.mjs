import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tilesFile = join(__dirname, '../src/engine/tiles.ts');

let content = fs.readFileSync(tilesFile, 'utf8');

const polygonsData = {
    'R': `['0,0 100,0 100,20 0,20 0,0', '0,80 100,80 100,100 0,100 0,80']`,
    'S': `['0,0 100,0 100,20 0,20 0,0', '0,80 100,80 100,100 0,100 0,80']`,
    'W': `['0,0 40,0 40,40 0,40 0,0', '60,0 100,0 100,40 60,40 60,0']`,
    'X': `['0,0 40,0 40,40 0,40 0,0', '60,0 100,0 100,40 60,40 60,0']`
};

for (const [typeId, polys] of Object.entries(polygonsData)) {
    // If it already has fieldPolygons, replace them. Otherwise inject before the closing brace.
    if (content.includes(`typeId: '${typeId}'`) && content.includes('fieldPolygons')) {
        const rx = new RegExp(`(typeId:\\s*'${typeId}'[\\s\\S]*?fieldPolygons\\s*:\\s*)\\[.*?\\]`, 'g');
        content = content.replace(rx, `$1${polys}`);
    } else {
        const rx = new RegExp(`(typeId:\\s*'${typeId}'[\\s\\S]*?fieldConnections\\s*:\\s*\\[.*?\\])\\n\\s*\\}(\\s*,?)`, 'g');
        content = content.replace(rx, `$1,\n        fieldPolygons: ${polys}\n    }$2`);
    }
}

fs.writeFileSync(tilesFile, content);
console.log('patched R S W X');
