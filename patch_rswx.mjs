import fs from 'fs';

const tilesFile = 'c:/Users/lutar/.gemini/antigravity/playground/exo-helix/src/engine/tiles.ts';
let content = fs.readFileSync(tilesFile, 'utf8');

// For R and S (cities on left and right, fields top and bottom)
// For W and X (cities right/bottom/left, road on top, fields are the two small top corners left and right of the road)

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
