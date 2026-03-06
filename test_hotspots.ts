import { BASE_TILES } from './src/engine/tiles';
import type { TileDefinition } from './src/engine/types';

// Let's duplicate computeHotspots logic from TileRenderer here without React imports
const TILE_FIELD_REGIONS: Record<string, { id: string }[]> = {
    'A': [{ id: 'field-0' }],
    'B': [{ id: 'field-0' }],
    'C': [],
    'D': [{ id: 'field-0' }, { id: 'field-1' }],
    'E': [{ id: 'field-0' }],
    'F': [{ id: 'field-0' }],
    'G': [{ id: 'field-0' }, { id: 'field-1' }],
    'H': [{ id: 'field-0' }],
    'I': [{ id: 'field-0' }],
    'J': [{ id: 'field-0' }],
    'K': [{ id: 'field-0' }, { id: 'field-1' }],
    'L': [{ id: 'field-0' }, { id: 'field-1' }],
    'M': [{ id: 'field-0' }],
    'N': [{ id: 'field-0' }],
    'O': [{ id: 'field-0' }],
    'P': [{ id: 'field-0' }],
    'Q': [{ id: 'field-0' }],
    'R': [{ id: 'field-0' }],
    'S': [{ id: 'field-0' }, { id: 'field-1' }, { id: 'field-2' }],
    'T': [{ id: 'field-0' }, { id: 'field-1' }],
    'U': [{ id: 'field-0' }, { id: 'field-1' }],
    'V': [{ id: 'field-0' }, { id: 'field-1' }],
    'W': [{ id: 'field-0' }, { id: 'field-1' }, { id: 'field-2' }],
    'X': [{ id: 'field-0' }, { id: 'field-1' }, { id: 'field-2' }, { id: 'field-3' }],
};

function checkHotspots(def: TileDefinition) {
    const ids: string[] = [];

    if (def.cityConnections) {
        def.cityConnections.forEach((_, idx) => ids.push(`city-${idx}`));
    }
    if (def.roadConnections) {
        def.roadConnections.forEach((_, idx) => ids.push(`road-${idx}`));
    }
    if (def.monastery) {
        ids.push('monastery-0');
    }
    const fieldRegions = TILE_FIELD_REGIONS[def.typeId] || [];
    fieldRegions.forEach(r => ids.push(r.id));

    // Check for duplicates
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
        console.error(`CRITICAL: Tile ${def.typeId} has duplicate hotspots!`, ids);
    } else {
        console.log(`Tile ${def.typeId} OK. (${ids.length} hotspots: ${ids.join(', ')})`);
    }
}

console.log('--- Verifying Hotspot Uniqueness ---');
BASE_TILES.forEach(checkHotspots);
