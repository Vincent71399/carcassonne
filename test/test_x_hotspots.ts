import { TILES_MAP } from '../src/engine/tiles';

const tileX = TILES_MAP['X'];
console.log('Tile X:', JSON.stringify(tileX, null, 2));

// Simulate computeHotspots for rotation 0
const featureCount = {
    city: tileX.cityConnections?.length ?? 0,
    road: tileX.roadConnections?.length ?? 0,
    field: 0 // from TILE_FIELD_REGIONS
};

console.log('City connections:', tileX.cityConnections);
console.log('Road connections:', tileX.roadConnections);
console.log('Field connections:', tileX.fieldConnections);

// The TILE_FIELD_REGIONS for X:
const xFields = [
    { id: 'field-0', x: 25, y: 12 },
    { id: 'field-1', x: 75, y: 12 }
];
featureCount.field = xFields.length;
console.log(`\nExpected hotspots: city=${featureCount.city}, road=${featureCount.road}, field=${featureCount.field}`);
console.log(`Total: ${featureCount.city + featureCount.road + featureCount.field}`);
