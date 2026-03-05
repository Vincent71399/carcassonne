export type PlayerId = number;
export type PlayerType = 'human' | 'ai-easy';

export type FeatureType = 'city' | 'road' | 'field' | 'monastery';

export type EdgeDirection = 'top' | 'right' | 'bottom' | 'left';

export type MeepleType = 'standard' | 'large' | 'builder' | 'pig' | 'abbott';

export interface Meeple {
    id: string;
    playerId: PlayerId;
    type: MeepleType;
}

// Represent an edge split into 3 segments for accurate field connections.
// For example, a road edge has [field, road, field].
// A city edge has [city, city, city].
// A field edge has [field, field, field].
export type DetailedEdge = [FeatureType, FeatureType, FeatureType];

export interface TileEdges {
    top: DetailedEdge;
    right: DetailedEdge;
    bottom: DetailedEdge;
    left: DetailedEdge;
}

export interface TileDefinition {
    typeId: string; // e.g., 'A', 'B', 'C' base game notation
    count: number; // initial count in deck
    edges: TileEdges;
    monastery?: boolean;
    pennants?: number; // small shields in cities
    // a list of connected segments (to track continuous features through the tile)
    // We can derive connections programmatically or define them explicitly
    cityConnections?: EdgeDirection[][];
    roadConnections?: EdgeDirection[][];
    fieldConnections?: string[][];
    /**
     * Maps which local cities each local field touches.
     * Array length matches `fieldConnections`.
     * Each element is an array of indices referring to `cityConnections`.
     */
    adjacentCities?: number[][];
    // Optional predefined exact SVG path data `d` string to exactly bound each field
    fieldPaths?: string[];
}

export interface PlacedTile {
    id: string; // unique instance ID
    typeId: string;
    x: number;
    y: number;
    rotation: number; // 0, 90, 180, 270 (clockwise)
    meeples: PlacedMeeple[];
}

export interface PlacedMeeple {
    meeple: Meeple;
    featureId: string; // which feature it was placed on
}

export interface ScoreUpdate {
    players: PlayerId[];
    points: number;
    featureName: string;
    category: 'city' | 'road' | 'monastery' | 'field';
    returnedMeeples: PlacedMeeple[];
    completedComponentIds: string[]; // "x,y,featureId"
}

export type TurnPhase = 'PlaceTile' | 'PlaceMeeple' | 'Score' | 'GameOver';

export interface GameState {
    players: PlayerId[]; // The sequence of player turns
    playerNames: Record<PlayerId, string>;
    playerTypes: Record<PlayerId, PlayerType>;
    currentPlayerIndex: number; // index in players array
    turnPhase: TurnPhase;
    recentTilePosition: { x: number, y: number } | null;
    hands: Record<PlayerId, TileDefinition[]>;
    deck: TileDefinition[];
    board: Record<string, PlacedTile>; // "x,y" -> PlacedTile
    remainingMeeples: Record<PlayerId, Record<MeepleType, number>>;
    scores: Record<PlayerId, number>; // Player scores (running total)
    midGameScores: Record<PlayerId, number>; // Total mid-game scores (snapshot before end-game)
    midGameScoreBreakdown: Record<PlayerId, Record<'city' | 'road' | 'monastery' | 'field', number>>; // Mid-game breakdown by category
    scoreUpdates?: ScoreUpdate[]; // Pending score animation (single item)
    scoreUpdateQueue?: ScoreUpdate[]; // Full ordered queue for end-game sequencing
    scoreUpdateKey: number; // Incremented each time a new pop-up is served (triggers the timer)
    endGameMode: boolean; // True when draining end-game queue (mutations applied lazily)
    endGameScoreBreakdown?: Record<PlayerId, Record<'city' | 'road' | 'monastery' | 'field', number>>;
}
