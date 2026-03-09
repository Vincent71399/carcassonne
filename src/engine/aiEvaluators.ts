import type { GameState, PlayerId, PlacedTile } from './types';
import { evaluateFeature, evaluateMonastery, type FeatureEvaluation, type FeatureComponent } from './features';
import { TILES_MAP } from './tiles';
import {AI_CONSTANTS, AI_CONSTANTS_EXPERIMENT} from './aiConstants';

export interface ActionImpact {
    selfGain: number;       // Points we definitively score (or secure)
    opponentDelta: Record<PlayerId, number>; // Points each opponent specifically gains (+) or loses (-)
}

const emptyImpact: ActionImpact = { selfGain: 0, opponentDelta: {} };

function addImpacts(a: ActionImpact, b: ActionImpact): ActionImpact {
    const combinedDelta: Record<PlayerId, number> = { ...a.opponentDelta };
    for (const [pid, delta] of Object.entries(b.opponentDelta)) {
        const playerId = parseInt(pid, 10) as PlayerId;
        combinedDelta[playerId] = (combinedDelta[playerId] || 0) + delta;
    }
    return {
        selfGain: a.selfGain + b.selfGain,
        opponentDelta: combinedDelta
    };
}





function getFeatureDelta(_board: GameState['board'], fId: string, simTile: PlacedTile): number {
    if (fId.startsWith('city')) {
        let pts = 2;
        if (TILES_MAP[simTile.typeId]?.pennants) pts += 2;
        return pts;
    }
    if (fId.startsWith('road')) return 1;
    if (fId.startsWith('monastery')) return 1;
    return 0; // Fields are evaluated based on completion
}

function getFeatureOwnership(evaluation: FeatureEvaluation, board: GameState['board'], fId: string, x?: number, y?: number): Record<PlayerId, number> {
    const meepleCounts: Record<PlayerId, number> = {};
    if (fId.startsWith('monastery') && x !== undefined && y !== undefined) {
        const centerTile = board[`${x},${y}`];
        if (centerTile) {
            centerTile.meeples.filter(m => m.featureId === 'monastery-0').forEach(m => {
                const pid = m.meeple.playerId;
                meepleCounts[pid] = (meepleCounts[pid] || 0) + 1;
            });
        }
        return meepleCounts;
    }

    evaluation.components.forEach((comp: FeatureComponent) => {
        const t = board[`${comp.tileX},${comp.tileY}`];
        if (t) {
            t.meeples.filter(m => m.featureId === comp.featureId).forEach(m => {
                const pid = m.meeple.playerId;
                meepleCounts[pid] = (meepleCounts[pid] || 0) + 1;
            });
        }
    });
    return meepleCounts;
}

// ---------------------------------------------------------
// SCORE GENERATING ACTIONS
// ---------------------------------------------------------

export function evaluateGainCity(board: GameState['board'], x: number, y: number, fId: string, aiPlayerId: PlayerId, placedMeepleFeatureId: string | null, simTile: PlacedTile): ActionImpact {
    if (!fId.startsWith('city')) return emptyImpact;
    const evaluation = evaluateFeature(board, x, y, 'city', parseInt(fId.split('-')[1]));
    const ownership = getFeatureOwnership(evaluation, board, fId);

    // Determine if we actually own it
    const ourCount = ownership[aiPlayerId] || 0;
    // If we don't own it, and we didn't just place a meeple here, it's not a score gain for us.
    if (ourCount === 0 && placedMeepleFeatureId !== fId) return emptyImpact;

    let points = getFeatureDelta(board, fId, simTile);
    if (evaluation.isComplete) points += AI_CONSTANTS.FEATURES.COMPLETION_BONUS_CITY;

    return { selfGain: points, opponentDelta: {} };
}

export function evaluateGainRoad(board: GameState['board'], x: number, y: number, fId: string, aiPlayerId: PlayerId, placedMeepleFeatureId: string | null, simTile: PlacedTile): ActionImpact {
    if (!fId.startsWith('road')) return emptyImpact;
    const evaluation = evaluateFeature(board, x, y, 'road', parseInt(fId.split('-')[1]));
    const ownership = getFeatureOwnership(evaluation, board, fId);

    if ((ownership[aiPlayerId] || 0) === 0 && placedMeepleFeatureId !== fId) return emptyImpact;

    let points = getFeatureDelta(board, fId, simTile);
    if (evaluation.isComplete) points += AI_CONSTANTS.FEATURES.COMPLETION_BONUS_ROAD;

    return { selfGain: points, opponentDelta: {} };
}

export function evaluateGainMonastery(board: GameState['board'], x: number, y: number, fId: string, aiPlayerId: PlayerId, placedMeepleFeatureId: string | null, simTile: PlacedTile): ActionImpact {
    if (!fId.startsWith('monastery')) return emptyImpact;
    const evaluation = evaluateMonastery(board, x, y);
    const ownership = getFeatureOwnership(evaluation, board, fId, x, y);

    if ((ownership[aiPlayerId] || 0) === 0 && placedMeepleFeatureId !== fId) return emptyImpact;

    let points = getFeatureDelta(board, fId, simTile);
    if (evaluation.isComplete) points += 10;

    return { selfGain: points, opponentDelta: {} };
}

export function evaluateGainField(board: GameState['board'], x: number, y: number, fId: string, _aiPlayerId: PlayerId, placedMeepleFeatureId: string | null): ActionImpact {
    if (!fId.startsWith('field')) return emptyImpact;
    const evaluation = evaluateFeature(board, x, y, 'field', parseInt(fId.split('-')[1]));

    // We only gain points for a field if we are actively taking control of it by placing a meeple right now.
    // Otherwise, extending an already-owned field has 0 base delta (points come from completing adjacent cities, which is too complex to delta-track here).
    if (placedMeepleFeatureId !== fId) return emptyImpact;

    let points = 0;
    if (fId.startsWith('field')) {
        // Count completed cities adjacent to this field
        const adjacentCityKeys = new Set<string>();
        evaluation.components.forEach(comp => {
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
        points += adjacentCityKeys.size * AI_CONSTANTS_EXPERIMENT.FIELD_MULTIPLIER;
    }
    return { selfGain: points, opponentDelta: {} };
}

// ---------------------------------------------------------
// MASTER ACTION COMPOSER
// ---------------------------------------------------------

export function evaluateAllActions(
    _originalState: GameState,
    simBoard: GameState['board'],
    x: number,
    y: number,
    simTile: PlacedTile,
    aiPlayerId: PlayerId,
    meepleFeatureId: string | null
): ActionImpact {
    const tileDef = TILES_MAP[simTile.typeId];
    if (!tileDef) return emptyImpact;

    let totalImpact: ActionImpact = { selfGain: 0, opponentDelta: {} };

    const featuresToEvaluate: string[] = [];
    if (tileDef.cityConnections) tileDef.cityConnections.forEach((_, i: number) => featuresToEvaluate.push(`city-${i}`));
    if (tileDef.roadConnections) tileDef.roadConnections.forEach((_, i: number) => featuresToEvaluate.push(`road-${i}`));
    if (tileDef.fieldConnections) tileDef.fieldConnections.forEach((_, i: number) => featuresToEvaluate.push(`field-${i}`));
    if (tileDef.monastery) featuresToEvaluate.push(`monastery-0`);

    for (const fId of featuresToEvaluate) {
        // Gain Actions (All AIs)
        totalImpact = addImpacts(totalImpact, evaluateGainCity(simBoard, x, y, fId, aiPlayerId, meepleFeatureId, simTile));
        totalImpact = addImpacts(totalImpact, evaluateGainRoad(simBoard, x, y, fId, aiPlayerId, meepleFeatureId, simTile));
        totalImpact = addImpacts(totalImpact, evaluateGainMonastery(simBoard, x, y, fId, aiPlayerId, meepleFeatureId, simTile));
        totalImpact = addImpacts(totalImpact, evaluateGainField(simBoard, x, y, fId, aiPlayerId, meepleFeatureId));
    }

    return totalImpact;
}

