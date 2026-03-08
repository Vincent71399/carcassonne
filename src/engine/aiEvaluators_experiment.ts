import type { GameState, PlayerId, PlacedTile, FeatureType } from './types';
import { evaluateFeature, evaluateMonastery, type FeatureEvaluation } from './features';
import { TILES_MAP } from './tiles';
import { AI_CONSTANTS_EXPERIMENT } from './aiConstants';

/**
 * Calculates the score impact of meeple usage/gain.
 */
export function evaluateMeepleUsage(
    countBefore: number,
    countAfter: number
): number {
    const weights = AI_CONSTANTS_EXPERIMENT.MEEPLE_PLACEMENT;
    let score = 0;

    if (countAfter < countBefore) {
        // Meeples were used
        for (let i = countBefore; i > countAfter; i--) {
            // i is the rank (1-7). Index is i-1.
            const weight = weights[i - 1] || 0.5;
            score -= weight;
        }
    } else if (countAfter > countBefore) {
        // Meeples were returned
        for (let i = countBefore + 1; i <= countAfter; i++) {
            const weight = weights[i - 1] || 0.5;
            score += weight;
        }
    }

    return score;
}

/**
 * Calculates the score gained from completing a city, road, or monastery.
 */
export function evaluateGainScoreComplete(
    board: GameState['board'],
    x: number,
    y: number,
    simTile: PlacedTile,
    players: PlayerId[]
): Record<PlayerId | 'neutral', number> {
    const results: Record<PlayerId | 'neutral', number> = { neutral: 0 };
    players.forEach(p => { results[p] = 0; });

    const tileDef = TILES_MAP[simTile.typeId];
    if (!tileDef) return results;

    const completedFeatures = new Set<string>();

    const processFeature = (evalResult: FeatureEvaluation, category: 'city' | 'road' | 'monastery') => {
        if (!evalResult.isComplete) return;

        const componentIds = evalResult.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort();
        const featureKey = componentIds.join('|');
        if (completedFeatures.has(featureKey)) return;
        completedFeatures.add(featureKey);

        const ownership = getFeatureOwnership(evalResult, board);
        const winners = getFeatureWinners(ownership);

        const uniqueTileKeys = new Set(evalResult.components.map(c => `${c.tileX},${c.tileY}`));
        let points = uniqueTileKeys.size * (category === 'city' ? 2 : 1);

        if (category === 'city') {
            uniqueTileKeys.forEach(tk => {
                const t = board[tk];
                const tDef = t ? TILES_MAP[t.typeId] : null;
                if (tDef?.pennants) {
                    points += (tDef.pennants * 2);
                }
            });
        }

        winners.forEach(w => {
            if (w === 'neutral') {
                // Neutral completion gain is always 0 (impact is in In-Progress delta)
                return;
            } else {
                results[w] = (results[w] || 0) + points;
            }
        });
    };


    if (tileDef.cityConnections) {
        tileDef.cityConnections.forEach((_, i) => processFeature(evaluateFeature(board, x, y, 'city', i), 'city'));
    }
    if (tileDef.roadConnections) {
        tileDef.roadConnections.forEach((_, i) => processFeature(evaluateFeature(board, x, y, 'road', i), 'road'));
    }
    if (tileDef.monastery) {
        processFeature(evaluateMonastery(board, x, y), 'monastery');
    }

    // Check adjacent monasteries
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            const nTile = board[`${nx},${ny}`];
            if (nTile) {
                const nDef = TILES_MAP[nTile.typeId];
                if (nDef?.monastery) {
                    processFeature(evaluateMonastery(board, nx, ny), 'monastery');
                }
            }
        }
    }

    return results;
}

/**
 * Calculates the score gained from cities that are still in progress.
 */
export function evaluateGainScoreCity_InProgress(
    originalBoard: GameState['board'],
    simBoard: GameState['board'],
    _x: number,
    _y: number,
    players: PlayerId[]
): Record<PlayerId | 'neutral', number> {
    return calculateInProgressDelta(originalBoard, simBoard, _x, _y, 'city', players);
}

/**
 * Calculates the score gained from roads that are still in progress.
 */
export function evaluateGainScoreRoad_InProgress(
    originalBoard: GameState['board'],
    simBoard: GameState['board'],
    x: number,
    y: number,
    players: PlayerId[]
): Record<PlayerId | 'neutral', number> {
    return calculateInProgressDelta(originalBoard, simBoard, x, y, 'road', players);
}

/**
 * Calculates the score gained from monasteries that are still in progress.
 */
export function evaluateGainScoreMonastery_InProgress(
    originalBoard: GameState['board'],
    simBoard: GameState['board'],
    _x: number,
    _y: number,
    players: PlayerId[]
): Record<PlayerId | 'neutral', number> {
    const scoreBefore = calculateTotalInProgress(originalBoard, players, 'monastery');
    const scoreAfter = calculateTotalInProgress(simBoard, players, 'monastery');

    const results: Record<PlayerId | 'neutral', number> = { neutral: scoreAfter.neutral - scoreBefore.neutral };
    players.forEach(p => {
        results[p] = (scoreAfter[p] || 0) - (scoreBefore[p] || 0);
    });
    return results;
}

/**
 * Calculates the score change for fields.
 */
export function evaluateGainScoreField(
    originalBoard: GameState['board'],
    simBoard: GameState['board'],
    players: PlayerId[]
): Record<PlayerId | 'neutral', number> {
    const scoreBefore = calculateFieldScore(originalBoard, players);
    const scoreAfter = calculateFieldScore(simBoard, players);

    const results: Record<PlayerId | 'neutral', number> = { neutral: scoreAfter.neutral - scoreBefore.neutral };
    players.forEach(p => {
        results[p] = (scoreAfter[p] || 0) - (scoreBefore[p] || 0);
    });
    return results;
}

// --- Internal Helpers ---

function getFeatureOwnership(evaluation: FeatureEvaluation, board: GameState['board']): Record<PlayerId, number> {
    const meepleCounts: Record<PlayerId, number> = {};
    evaluation.components.forEach(comp => {
        const t = board[`${comp.tileX},${comp.tileY}`];
        if (t) {
            t.meeples.filter(m => m.featureId === comp.featureId).forEach(m => {
                const pid = m.meeple.playerId;
                const weight = m.meeple.type === 'large' ? 2 : 1;
                meepleCounts[pid] = (meepleCounts[pid] || 0) + weight;
            });
        }
    });
    return meepleCounts;
}

function getFeatureWinners(ownership: Record<PlayerId, number>): (PlayerId | 'neutral')[] {
    const counts = Object.values(ownership);
    if (counts.length === 0) return ['neutral'];
    const max = Math.max(...counts);
    return Object.keys(ownership)
        .filter(pid => ownership[Number(pid)] === max)
        .map(Number);
}

function calculateInProgressDelta(
    originalBoard: GameState['board'],
    simBoard: GameState['board'],
    _x: number,
    _y: number,
    type: 'city' | 'road',
    players: PlayerId[]
): Record<PlayerId | 'neutral', number> {
    const scoreBefore = calculateTotalInProgress(originalBoard, players, type);
    const scoreAfter = calculateTotalInProgress(simBoard, players, type);

    const results: Record<PlayerId | 'neutral', number> = { neutral: scoreAfter.neutral - scoreBefore.neutral };
    players.forEach(p => {
        results[p] = (scoreAfter[p] || 0) - (scoreBefore[p] || 0);
    });
    return results;
}

function calculateTotalInProgress(
    board: GameState['board'],
    players: PlayerId[],
    type: FeatureType
): Record<PlayerId | 'neutral', number> {
    const scoredFeatures = new Set<string>();
    const results: Record<PlayerId | 'neutral', number> = { neutral: 0 };
    players.forEach(p => { results[p] = 0; });

    for (const tileKey of Object.keys(board)) {
        const tile = board[tileKey];
        const def = TILES_MAP[tile.typeId];
        if (!def) continue;

        const processEval = (ev: FeatureEvaluation) => {
            if (ev.isComplete) return;

            const featureKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
            if (scoredFeatures.has(featureKey)) return;
            scoredFeatures.add(featureKey);

            const ownership = getFeatureOwnership(ev, board);
            const winners = getFeatureWinners(ownership);

            const uniqueTiles = new Set(ev.components.map(c => `${c.tileX},${c.tileY}`));
            let pts = uniqueTiles.size;
            if (type === 'city') {
                uniqueTiles.forEach(tk => {
                    const t = board[tk];
                    const tDef = t ? TILES_MAP[t.typeId] : null;
                    if (tDef?.pennants) pts += tDef.pennants;
                });
            } else if (type === 'monastery') {
                pts = ev.components.length;
            }

            winners.forEach(w => {
                if (w === 'neutral') {
                    // Rule 1: No neutral monasteries
                    if (type === 'monastery') return;
                    // Rule 2: Connection only (more than one tile)
                    if (ev.components.length <= 1) return;

                    results['neutral'] = Math.max(results['neutral'], pts);
                } else {
                    results[w] = (results[w] || 0) + pts;
                }
            });
        };

        if (type === 'city' && def.cityConnections) {
            def.cityConnections.forEach((_, i) => processEval(evaluateFeature(board, tile.x, tile.y, 'city', i)));
        } else if (type === 'road' && def.roadConnections) {
            def.roadConnections.forEach((_, i) => processEval(evaluateFeature(board, tile.x, tile.y, 'road', i)));
        } else if (type === 'monastery' && def.monastery) {
            processEval(evaluateMonastery(board, tile.x, tile.y));
        }
    }
    return results;
}

function calculateFieldScore(
    board: GameState['board'],
    players: PlayerId[]
): Record<PlayerId | 'neutral', number> {
    const scoredFields = new Set<string>();
    const results: Record<PlayerId | 'neutral', number> = { neutral: 0 };
    players.forEach(p => { results[p] = 0; });

    for (const tileKey of Object.keys(board)) {
        const tile = board[tileKey];
        const def = TILES_MAP[tile.typeId];
        if (!def || !def.fieldConnections) continue;

        for (let i = 0; i < def.fieldConnections.length; i++) {
            const ev = evaluateFeature(board, tile.x, tile.y, 'field', i);
            const fieldKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
            if (scoredFields.has(fieldKey)) continue;
            scoredFields.add(fieldKey);

            const ownership = getFeatureOwnership(ev, board);
            const winners = getFeatureWinners(ownership);

            // Count completed cities adjacent to this field
            const adjacentCityKeys = new Set<string>();
            ev.components.forEach(comp => {
                const compTile = board[`${comp.tileX},${comp.tileY}`];
                if (!compTile) return;
                const compDef = TILES_MAP[compTile.typeId];
                if (!compDef?.adjacentCities) return;

                const localFieldIdx = parseInt(comp.featureId.split('-')[1], 10);
                const adjacentCityIndices = compDef.adjacentCities[localFieldIdx];
                if (!adjacentCityIndices) return;

                for (const cIdx of adjacentCityIndices) {
                    const ce = evaluateFeature(board, compTile.x, compTile.y, 'city', cIdx);
                    if (ce.isComplete) {
                        adjacentCityKeys.add(
                            ce.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|')
                        );
                    }
                }
            });
            const fieldPoints = adjacentCityKeys.size * 3;

            winners.forEach(w => {
                if (w === 'neutral') {
                    results['neutral'] = Math.max(results['neutral'], fieldPoints);
                } else {
                    results[w] = (results[w] || 0) + fieldPoints;
                }
            });
        }
    }
    return results;
}
