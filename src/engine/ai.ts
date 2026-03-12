import type { GameState, PlayerId, PlacedTile, TileDefinition, PlayerType } from './types';
import { getValidPlacements } from './board';

import { AI_CONSTANTS, AI_CONSTANTS_EXPERIMENT } from './aiConstants';
import { evaluateAllActions, type ActionImpact } from './aiEvaluators';
import * as experimental from './aiEvaluators_experiment';
import { evaluateReturnedMeeples, createAITurnContext, type AITurnContext } from './aiEvaluators_experiment';
import { getOccupiedFeaturesOnTile } from './features';

export interface AIMove {
    handIndex: number;
    tilePlacement: { x: number; y: number; rotation: number };
    // undefined means skip meeple placement
    meeplePlacement?: { featureId: string; meepleType: 'standard' };
    score: number;
}

export function calculateBestAIMove(state: GameState, aiPlayerId: PlayerId): AIMove | null {
    const rawAiType = state.playerTypes[aiPlayerId];
    if (!rawAiType || rawAiType === 'human') return null;

    const currentHand = state.hands[aiPlayerId];
    if (!currentHand || currentHand.length === 0) return null;

    let bestMove: AIMove | null = null;
    let bestScore = -Infinity;

    const context = createAITurnContext(state.board, aiPlayerId, state.players);

    for (let i = 0; i < currentHand.length; i++) {
        const tile = currentHand[i];
        // The Computer AI always evaluates at 0-ply (just greedy current placement)
        const scoredMoves = getScoredMoves(state, aiPlayerId, tile, i, context);
        
        if (scoredMoves.length > 0) {
            const topMove = scoredMoves[0];
            if (topMove.score > bestScore) {
                bestScore = topMove.score;
                bestMove = topMove.move;
            }
        }
    }

    return bestMove;
}

function getAiWeights(type: PlayerType): AIWeights | null {
    if (type === 'ai-easy') return AI_CONSTANTS_EXPERIMENT.EASY;
    if (type === 'ai-medium') return AI_CONSTANTS_EXPERIMENT.MEDIUM;
    return null;
}

export interface AIWeights {
    SCORE_GAIN: number;
    CITY_IN_PROGRESS: number;
    ROAD_IN_PROGRESS: number;
    MONASTERY_IN_PROGRESS: number;
    FIELD: number;
    MEEPLE_USAGE: number;
    CITY_ATTACK: number;
    ROAD_ATTACK: number;
    FIELD_ATTACK: number;

    OPPONENT_SCORE_GAIN: number;
    OPPONENT_CITY_IN_PROGRESS: number;
    OPPONENT_ROAD_IN_PROGRESS: number;
    OPPONENT_MONASTERY_IN_PROGRESS: number;
    OPPONENT_FIELD: number;
    OPPONENT_MEEPLE_USAGE: number;
    OPPONENT_CITY_ATTACK: number;
    OPPONENT_ROAD_ATTACK: number;
    OPPONENT_FIELD_ATTACK: number;

    NEUTRAL_CITY_IN_PROGRESS: number;
    NEUTRAL_ROAD_IN_PROGRESS: number;
    NEUTRAL_FIELD: number;

    FIELD_SCORE_INITIAL_MULTIPLIER: number;
    CITY_OPEN_EDGE: number;
    OPPONENT_CITY_OPEN_EDGE: number;
}

function calculateWeightedScore(
    state: GameState,
    simBoard: GameState['board'],
    x: number,
    y: number,
    simTile: PlacedTile,
    aiPlayerId: PlayerId,
    meepleFeatureId: string | null,
    weights: AIWeights,
    context?: AITurnContext
): number {
    const players = state.players;
    const opponentIds = players.filter(id => id !== aiPlayerId);

    // Categories from evaluators
    const complete = experimental.evaluateGainScoreComplete(simBoard, x, y, simTile, players);
    const cityInProgress = experimental.evaluateGainScoreCity_InProgress(state.board, simBoard, x, y, players, context);
    const roadInProgress = experimental.evaluateGainScoreRoad_InProgress(state.board, simBoard, x, y, players, context);
    const monasteryInProgress = experimental.evaluateGainScoreMonastery_InProgress(state.board, simBoard, x, y, players, context);
    const field = experimental.evaluateGainScoreField(state.board, simBoard, x, y, players, context);

    // Meeple usage (approximate: only for active player)
    // We count a simple delta: -1 if meeple placed, +X if any features were completed.
    // For simplicity, we can rely on the fact that ONLY the active player places a meeple.
    // Returned meeples can be checked by comparing board states or using evaluateGainScoreComplete info.
    // Actually, experimental.evaluateMeepleUsage is quite sophisticated about "weights".
    // Let's use it for the active player.
    const returnedMeeples = evaluateReturnedMeeples(simBoard, x, y, simTile, aiPlayerId);

    const countBefore = state.remainingMeeples[aiPlayerId]?.standard || 0;
    const countAfter = countBefore - (meepleFeatureId ? 1 : 0) + returnedMeeples;

    // experimental.evaluateMeepleUsage is quite sophisticated about "weights".
    const meepleUsageScore = experimental.evaluateMeepleUsage(countBefore, countAfter);

    const cityAttack = experimental.evaluateCityAttack(simBoard, aiPlayerId, players, { x, y }, state.hands[aiPlayerId], state.deck, context);
    const roadAttack = experimental.evaluateRoadAttack(simBoard, aiPlayerId, players, { x, y }, state.hands[aiPlayerId], state.deck, context);
    const fieldAttack = experimental.evaluateFieldAttack(simBoard, aiPlayerId, players, { x, y }, state.hands[aiPlayerId], state.deck, context);

    const cityOpenEdgeDelta = experimental.evaluateCityOpenEdgeDelta(state.board, simBoard, x, y, players);

    // game_end_factor scales from FIELD_SCORE_INITIAL_MULTIPLIER (at game start)
    // to 1.0 (when deck is empty).
    const initialMultiplier = weights.FIELD_SCORE_INITIAL_MULTIPLIER || 1;
    const deckSize = state.deck.length;
    const totalTiles = 72; // Standard Carcassonne has 72 tiles (including start tile)
    const progress = 1 - (deckSize / totalTiles);
    const game_end_factor = initialMultiplier + (1 - initialMultiplier) * progress;

    let totalScore = 0;

    // 1. Self weights
    totalScore += complete[aiPlayerId] * weights.SCORE_GAIN;
    totalScore += cityInProgress[aiPlayerId] * weights.CITY_IN_PROGRESS;
    totalScore += roadInProgress[aiPlayerId] * weights.ROAD_IN_PROGRESS;
    totalScore += monasteryInProgress[aiPlayerId] * weights.MONASTERY_IN_PROGRESS;
    totalScore += field[aiPlayerId] * weights.FIELD * game_end_factor;
    totalScore += meepleUsageScore * weights.MEEPLE_USAGE;
    totalScore += cityAttack[aiPlayerId] * weights.CITY_ATTACK;
    totalScore += roadAttack[aiPlayerId] * weights.ROAD_ATTACK;
    totalScore += fieldAttack[aiPlayerId] * weights.FIELD_ATTACK * game_end_factor;
    totalScore += (cityOpenEdgeDelta[aiPlayerId] || 0) * weights.CITY_OPEN_EDGE;

    // 2. Neutral weights
    totalScore += cityInProgress['neutral'] * (weights.NEUTRAL_CITY_IN_PROGRESS || 0);
    totalScore += roadInProgress['neutral'] * (weights.NEUTRAL_ROAD_IN_PROGRESS || 0);
    totalScore += (field['neutral'] || 0) * (weights.NEUTRAL_FIELD || 0);

    // 3. Opponent weights
    if (opponentIds.length > 0) {
        const scores = opponentIds.map(id => state.scores[id] || 0);
        const maxOpponentScore = Math.max(...scores, 1);

        for (const oppId of opponentIds) {
            let threaten_factor = 1;
            if (players.length > 2) {
                threaten_factor = (state.scores[oppId] || 0) / maxOpponentScore;
            }

            totalScore += (complete[oppId] || 0) * weights.OPPONENT_SCORE_GAIN * threaten_factor;
            totalScore += (cityInProgress[oppId] || 0) * weights.OPPONENT_CITY_IN_PROGRESS * threaten_factor;
            totalScore += (roadInProgress[oppId] || 0) * weights.OPPONENT_ROAD_IN_PROGRESS * threaten_factor;
            totalScore += (monasteryInProgress[oppId] || 0) * weights.OPPONENT_MONASTERY_IN_PROGRESS * threaten_factor;
            totalScore += (field[oppId] || 0) * weights.OPPONENT_FIELD * threaten_factor * game_end_factor;
            totalScore += (cityAttack[oppId] || 0) * weights.OPPONENT_CITY_ATTACK * threaten_factor;
            totalScore += (roadAttack[oppId] || 0) * weights.OPPONENT_ROAD_ATTACK * threaten_factor;
            totalScore += (fieldAttack[oppId] || 0) * weights.OPPONENT_FIELD_ATTACK * threaten_factor * game_end_factor;
            totalScore += (cityOpenEdgeDelta[oppId] || 0) * weights.OPPONENT_CITY_OPEN_EDGE * threaten_factor;
            // Note: OPPONENT_MEEPLE_USAGE is usually not applicable here as opponents don't place/return meeples on AI turn (mostly)
        }
    }

    return totalScore;
}

function getAvailableMeeples(state: GameState, playerId: PlayerId): number {
    return state.remainingMeeples[playerId]?.standard || 0;
}

function calculateFinalScore(
    impact: ActionImpact
): number {
    let finalScore = impact.selfGain * AI_CONSTANTS.NOOB.SELF_WEIGHT;

    for (const delta of Object.values(impact.opponentDelta)) {
        // The Computer AI doesn't heavily weigh opponents, but it respects the constant
        finalScore -= delta * AI_CONSTANTS.NOOB.OPPONENT_WEIGHT;
    }

    return finalScore;
}

interface ScoredMove {
    move: AIMove;
    score: number;
}

export function getScoredMoves(
    state: GameState,
    activePlayerId: PlayerId,
    tileDef: TileDefinition,
    handIndex: number,
    context?: AITurnContext
): ScoredMove[] {
    const scoredMoves: ScoredMove[] = [];
    const aiType = state.playerTypes[activePlayerId];
    const weights = getAiWeights(aiType);

    for (let rotation = 0; rotation < 4; rotation++) {
        const validPlacements = getValidPlacements(state.board, tileDef, rotation);

        for (const placement of validPlacements) {
            const simBoard = { ...state.board };
            const simTile: PlacedTile = {
                id: `sim-${Date.now()}-${Math.random()}`,
                typeId: tileDef.typeId,
                x: placement.x, y: placement.y, rotation, meeples: []
            };
            simBoard[`${placement.x},${placement.y}`] = simTile;

            // 1) Evaluate Placement WITHOUT a Meeple
            const scoreNoMeeple = weights
                ? calculateWeightedScore(state, simBoard, placement.x, placement.y, simTile, activePlayerId, null, weights, context)
                : calculateFinalScore(evaluateAllActions(state, simBoard, placement.x, placement.y, simTile, activePlayerId, null));

            scoredMoves.push({
                move: { handIndex, tilePlacement: { x: placement.x, y: placement.y, rotation }, score: scoreNoMeeple },
                score: scoreNoMeeple
            });

            // 2) Evaluate Placement WITH a Meeple
            if (getAvailableMeeples(state, activePlayerId) > 0) {
                const featuresToTry: string[] = [];
                if (tileDef.cityConnections) tileDef.cityConnections.forEach((_, i) => featuresToTry.push(`city-${i}`));
                if (tileDef.roadConnections) tileDef.roadConnections.forEach((_, i) => featuresToTry.push(`road-${i}`));
                if (tileDef.monastery) featuresToTry.push(`monastery-0`);

                // Fields: Easy and Medium AI CAN place farmers
                if (aiType !== 'ai-noob' && tileDef.fieldConnections) {
                    tileDef.fieldConnections.forEach((_, i) => featuresToTry.push(`field-${i}`));
                }

                for (const fId of featuresToTry) {
                    const occupied = new Set(getOccupiedFeaturesOnTile(simBoard, placement.x, placement.y));
                    if (!occupied.has(fId)) {
                        simTile.meeples.push({ meeple: { id: 'sim-meeple', playerId: activePlayerId, type: 'standard' }, featureId: fId });

                        const scoreWithMeeple = weights
                            ? calculateWeightedScore(state, simBoard, placement.x, placement.y, simTile, activePlayerId, fId, weights, context)
                            : calculateFinalScore(evaluateAllActions(state, simBoard, placement.x, placement.y, simTile, activePlayerId, fId)) + AI_CONSTANTS.NOOB.MEEPLE_PLACEMENT_BONUS;

                        simTile.meeples.pop();

                        scoredMoves.push({
                            move: { handIndex, tilePlacement: { x: placement.x, y: placement.y, rotation }, meeplePlacement: { featureId: fId, meepleType: 'standard' }, score: scoreWithMeeple },
                            score: scoreWithMeeple
                        });
                    }
                }
            }
        }
    }

    // Sort descending by score
    scoredMoves.sort((a, b) => b.score - a.score);
    return scoredMoves;
}
