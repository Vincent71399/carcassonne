import type { DetailedEdge, TileDefinition } from './types';

// Helper to create edges
const f: DetailedEdge = ['field', 'field', 'field'];
const c: DetailedEdge = ['city', 'city', 'city'];
const r: DetailedEdge = ['field', 'road', 'field'];

export const BASE_TILES: TileDefinition[] = [
    {
        typeId: 'A', count: 9,
        edges: { top: f, right: f, bottom: r, left: r },
        roadConnections: [['bottom', 'left']],
        fieldConnections: [['top-0', 'top-1', 'top-2', 'right-0', 'right-1', 'right-2', 'bottom-0', 'left-2'], ['bottom-2', 'left-0']],
        fieldPaths: ['M 0 0 L 100 0 L 100 100 L 50 100 Q 50 50 0 50 Z', 'M 0 50 Q 50 50 50 100 L 0 100 Z']
    },
    {
        typeId: 'B', count: 8,
        edges: { top: r, right: f, bottom: r, left: f },
        roadConnections: [['top', 'bottom']],
        fieldConnections: [['top-0', 'left-2', 'left-1', 'left-0', 'bottom-2'], ['top-2', 'right-0', 'right-1', 'right-2', 'bottom-0']],
        fieldPaths: ['M 0 0 L 50 0 L 50 100 L 0 100 Z', 'M 50 0 L 100 0 L 100 100 L 50 100 Z']
    },
    {
        typeId: 'C', count: 4,
        edges: { top: f, right: r, bottom: r, left: r },
        roadConnections: [['right'], ['bottom'], ['left']],
        fieldConnections: [['top-0', 'top-1', 'top-2', 'right-0', 'left-2'], ['right-2', 'bottom-0'], ['bottom-2', 'left-0']],
        fieldPaths: ['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 100 50 L 50 50 L 50 100 L 100 100 Z', 'M 0 50 L 50 50 L 50 100 L 0 100 Z']
    },
    {
        typeId: 'D', count: 1,
        edges: { top: r, right: r, bottom: r, left: r },
        roadConnections: [['top'], ['right'], ['bottom'], ['left']],
        fieldConnections: [['top-2', 'right-0'], ['right-2', 'bottom-0'], ['bottom-2', 'left-0'], ['left-2', 'top-0']],
        fieldPaths: ['M 50 0 L 100 0 L 100 50 L 50 50 Z', 'M 100 50 L 100 100 L 50 100 L 50 50 Z', 'M 0 50 L 50 50 L 50 100 L 0 100 Z', 'M 0 0 L 50 0 L 50 50 L 0 50 Z']
    },
    {
        typeId: 'E', count: 4,
        edges: { top: f, right: f, bottom: f, left: f },
        monastery: true,
        fieldConnections: [['top-0', 'top-1', 'top-2', 'right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']],
        adjacentCities: [[]]
    },
    {
        typeId: 'F', count: 2,
        edges: { top: f, right: f, bottom: r, left: f },
        monastery: true,
        roadConnections: [['bottom']],
        fieldConnections: [['top-0', 'top-1', 'top-2', 'right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-2', 'left-0', 'left-1', 'left-2']]
    },
    {
        typeId: 'G', count: 5,
        edges: { top: c, right: f, bottom: f, left: f },
        cityConnections: [['top']],
        fieldConnections: [['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']],
        adjacentCities: [[0]]
    },
    {
        typeId: 'H', count: 3,
        edges: { top: f, right: r, bottom: r, left: c },
        cityConnections: [['left']],
        roadConnections: [['right', 'bottom']],
        fieldConnections: [['top-0', 'top-1', 'top-2', 'right-0', 'bottom-2'], ['right-2', 'bottom-0']],
        adjacentCities: [[0], []],
        fieldPaths: ['M 0 0 L 100 0 L 100 50 Q 50 50 50 100 L 0 100 Z', 'M 100 50 Q 50 50 50 100 L 100 100 Z']
    },
    {
        typeId: 'I', count: 3,
        edges: { top: r, right: r, bottom: f, left: c },
        cityConnections: [['left']],
        roadConnections: [['top', 'right']],
        fieldConnections: [['top-2', 'right-0'], ['top-0', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2']],
        adjacentCities: [[], [0]],
        fieldPaths: ['M 50 0 Q 50 50 100 50 L 100 0 Z', 'M 50 0 Q 50 50 100 50 L 100 100 L 0 100 L 0 0 Z']
    },
    {
        typeId: 'J', count: 2,
        edges: { top: c, right: f, bottom: f, left: c },
        cityConnections: [['top'], ['left']], // separated cities
        fieldConnections: [['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2']],
        adjacentCities: [[0, 1]]
    },
    {
        typeId: 'K', count: 3,
        edges: { top: f, right: c, bottom: f, left: c },
        cityConnections: [['left'], ['right']], // separated cities
        fieldConnections: [['top-0', 'top-1', 'top-2', 'bottom-0', 'bottom-1', 'bottom-2']],
        adjacentCities: [[0, 1]]
    },
    {
        typeId: 'L', count: 4,
        edges: { top: c, right: r, bottom: f, left: r },
        cityConnections: [['top']],
        roadConnections: [['left', 'right']],
        fieldConnections: [['right-0', 'left-2'], ['right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0']],
        adjacentCities: [[0], []],
        fieldPaths: ['M 0 0 L 100 0 L 100 50 Q 50 50 0 50 Z', 'M 0 50 Q 50 50 100 50 L 100 100 L 0 100 Z']
    },
    {
        typeId: 'M', count: 3,
        edges: { top: c, right: r, bottom: r, left: r },
        cityConnections: [['top']],
        roadConnections: [['right'], ['bottom'], ['left']],
        fieldConnections: [['right-0', 'left-2'], ['right-2', 'bottom-0'], ['bottom-2', 'left-0']],
        adjacentCities: [[0], [], []],
        fieldPaths: ['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 100 50 L 50 50 L 50 100 L 100 100 Z', 'M 0 50 L 50 50 L 50 100 L 0 100 Z']
    },
    {
        typeId: 'N', count: 3,
        edges: { top: c, right: c, bottom: f, left: f },
        cityConnections: [['top', 'right']],
        fieldConnections: [['bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']],
        adjacentCities: [[0]]
    },
    {
        typeId: 'O', count: 2,
        edges: { top: c, right: c, bottom: f, left: f },
        pennants: 1,
        cityConnections: [['top', 'right']],
        fieldConnections: [['bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']],
        adjacentCities: [[0]]
    },
    {
        typeId: 'P', count: 3,
        edges: { top: r, right: r, bottom: c, left: c },
        cityConnections: [['bottom', 'left']],
        roadConnections: [['top', 'right']],
        fieldConnections: [['top-2', 'right-0'], ['top-0', 'right-2']],
        adjacentCities: [[], [0]],
        fieldPaths: ['M 50 0 Q 50 50 100 50 L 100 0 Z', 'M 50 0 Q 50 50 100 50 L 100 100 L 0 100 L 0 0 Z']
    },
    {
        typeId: 'Q', count: 2,
        edges: { top: r, right: r, bottom: c, left: c },
        pennants: 1,
        cityConnections: [['bottom', 'left']],
        roadConnections: [['top', 'right']],
        fieldConnections: [['top-2', 'right-0'], ['top-0', 'right-2']],
        adjacentCities: [[], [0]],
        fieldPaths: ['M 50 0 Q 50 50 100 50 L 100 0 Z', 'M 50 0 Q 50 50 100 50 L 100 100 L 0 100 L 0 0 Z']
    },
    {
        typeId: 'R', count: 1,
        edges: { top: f, right: c, bottom: f, left: c },
        cityConnections: [['right', 'left']],
        fieldConnections: [['top-0', 'top-1', 'top-2'], ['bottom-0', 'bottom-1', 'bottom-2']],
        adjacentCities: [[0], [0]],
        fieldPaths: ['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 0 50 L 100 50 L 100 100 L 0 100 Z']
    },
    {
        typeId: 'S', count: 2,
        edges: { top: f, right: c, bottom: f, left: c },
        pennants: 1,
        cityConnections: [['right', 'left']],
        fieldConnections: [['top-0', 'top-1', 'top-2'], ['bottom-0', 'bottom-1', 'bottom-2']],
        adjacentCities: [[0], [0]],
        fieldPaths: ['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 0 50 L 100 50 L 100 100 L 0 100 Z']
    },
    {
        typeId: 'T', count: 1,
        edges: { top: c, right: c, bottom: c, left: c },
        pennants: 1,
        cityConnections: [['top', 'right', 'bottom', 'left']],
        fieldConnections: []
    },
    {
        typeId: 'U', count: 3,
        edges: { top: f, right: c, bottom: c, left: c },
        cityConnections: [['right', 'bottom', 'left']],
        fieldConnections: [['top-0', 'top-1', 'top-2']],
        adjacentCities: [[0]]
    },
    {
        typeId: 'V', count: 1,
        edges: { top: f, right: c, bottom: c, left: c },
        pennants: 1,
        cityConnections: [['right', 'bottom', 'left']],
        fieldConnections: [['top-0', 'top-1', 'top-2']],
        adjacentCities: [[0]]
    },
    {
        typeId: 'W', count: 1,
        edges: { top: r, right: c, bottom: c, left: c },
        cityConnections: [['right', 'bottom', 'left']],
        roadConnections: [['top']],
        fieldConnections: [['top-0'], ['top-2']],
        adjacentCities: [[0], [0]],
        fieldPaths: ['M 0 0 L 50 0 L 50 50 L 0 50 Z', 'M 50 0 L 100 0 L 100 50 L 50 50 Z']
    },
    {
        typeId: 'X', count: 2,
        edges: { top: r, right: c, bottom: c, left: c },
        pennants: 1,
        cityConnections: [['right', 'bottom', 'left']],
        roadConnections: [['top']],
        fieldConnections: [['top-0'], ['top-2']],
        adjacentCities: [[0], [0]],
        fieldPaths: ['M 0 0 L 50 0 L 50 50 L 0 50 Z', 'M 50 0 L 100 0 L 100 50 L 50 50 Z']
    }
];

export const TILES_MAP: Record<string, TileDefinition> = {};
for (const def of BASE_TILES) {
    TILES_MAP[def.typeId] = def;
}

// Register the Start tile (not part of regular deck but needs to be in the map for engine lookups)
TILES_MAP['Start'] = {
    typeId: 'Start',
    count: 1,
    edges: { top: ['city', 'city', 'city'], right: ['field', 'road', 'field'], bottom: ['field', 'field', 'field'], left: ['field', 'road', 'field'] },
    cityConnections: [['top']],
    roadConnections: [['left', 'right']],
    fieldConnections: [['right-0', 'left-2'], ['right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0']],
    adjacentCities: [[0], []],
    fieldPaths: ['M 0 0 L 100 0 L 100 50 L 0 50 Z', 'M 0 50 L 100 50 L 100 100 L 0 100 Z']
};

export function generateDeck(): TileDefinition[] {
    const deck: TileDefinition[] = [];
    for (const def of BASE_TILES) {
        for (let i = 0; i < def.count; i++) {
            deck.push({ ...def });
        }
    }
    return shuffle(deck);
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}
