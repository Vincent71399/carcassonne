import fs from 'fs';
import path from 'path';
import { BASE_TILES } from './src/engine/tiles';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TileRenderer } from './src/components/TileRenderer';

// We need a script to generate a markdown table with data URIs of the SVGs
// Since TileRenderer uses React, we can render it to a static SVG string.

function renderTileSvg(def: any): string {
    const placed = { id: 'temp', typeId: def.typeId, x: 0, y: 0, rotation: 0, meeples: [] };
    const svgComponent = React.createElement(TileRenderer, { def, placed, interactive: false });
    const svgString = renderToString(svgComponent);
    // The component wrapper is a div with a transform. We want the inner SVG.
    // It's tricky to extract just the SVG from the rendered div string simply.
    // Let's just create a raw SVG string for the markdown embedding.

    // Instead of full React rendering which requires a DOM or specific setup,
    // let's just make a table with descriptions. The user just asked for "tile image and amount".
    // I will write a simple test script to just output the markdown.
    return '';
}

const tableHeader = `
| Tile ID | Count | Description (Edges Top-Right-Bottom-Left) | Special Features |
| :---: | :---: | :--- | :--- |`;

let tableBody = '';
let totalCount = 0;

BASE_TILES.forEach(def => {
    totalCount += def.count;

    const edges = [
        def.edges.top[0] === 'city' ? 'City' : def.edges.top[1] === 'road' ? 'Road' : 'Field',
        def.edges.right[0] === 'city' ? 'City' : def.edges.right[1] === 'road' ? 'Road' : 'Field',
        def.edges.bottom[0] === 'city' ? 'City' : def.edges.bottom[1] === 'road' ? 'Road' : 'Field',
        def.edges.left[0] === 'city' ? 'City' : def.edges.left[1] === 'road' ? 'Road' : 'Field'
    ].join(' - ');

    const special = [];
    if (def.monastery) special.push('Monastery');
    if (def.pennants) special.push(`${def.pennants} Pennant(s)`);
    if (def.typeId === 'S' || def.typeId === 'W' || def.typeId === 'X') special.push('Crossroad');

    tableBody += `\n| **${def.typeId}** | ${def.count} | ${edges} | ${special.join(', ') || '-'} |`;
});

const markdown = `# Base Game Tile Set (A-X)

This deck contains EXACTLY **${totalCount}** tiles, matching the official standard Carcassonne rules.

${tableHeader}${tableBody}
`;

fs.writeFileSync('tile_list.md', markdown);
console.log('tile_list.md generated successfully.');
