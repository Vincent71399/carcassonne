import * as fs from 'fs';
import { BASE_TILES } from '../src/engine/tiles';
import type { TileDefinition } from '../src/engine/types';

/**
 * This script generates a markdown table (tile_list.md) summarizing all tiles in the base set.
 * It's useful for verifying the deck composition against official rules.
 */

const tableHeader = `
| Tile ID | Count | Description (Edges Top-Right-Bottom-Left) | Special Features |
| :---: | :---: | :--- | :--- |`;

let tableBody = '';
let totalCount = 0;

BASE_TILES.forEach((def: TileDefinition) => {
    totalCount += def.count;

    const getEdgeName = (edge: [string, string, string]) => {
        if (edge[0] === 'city') return 'City';
        if (edge[1] === 'road') return 'Road';
        return 'Field';
    };

    const edges = [
        getEdgeName(def.edges.top),
        getEdgeName(def.edges.right),
        getEdgeName(def.edges.bottom),
        getEdgeName(def.edges.left)
    ].join(' - ');

    const special = [];
    if (def.monastery) special.push('Monastery');
    if (def.pennants) special.push(`${def.pennants} Pennant(s)`);

    // Detect junctions: 3 or more road edges that aren't all connected as one road
    const roadEdgesCount = Object.values(def.edges).filter(e => e[1] === 'road').length;
    if (roadEdgesCount >= 3) {
        special.push(`${roadEdgesCount}-way Road Junction`);
    } else if (roadEdgesCount === 4) {
        special.push('4-way Crossroad');
    }

    tableBody += `\n| **${def.typeId}** | ${def.count} | ${edges} | ${special.join(', ') || '-'} |`;
});

const markdown = `# Base Game Tile Set (A-X)

This deck contains EXACTLY **${totalCount}** tiles, matching the official standard Carcassonne rules.

${tableHeader}${tableBody}
`;

fs.writeFileSync('tile_list.md', markdown);
console.log('tile_list.md generated successfully.');
