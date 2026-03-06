import type { GameState, PlayerId, PlacedTile, TileDefinition } from './types';
import { getValidPlacements } from './board';

import { AI_CONSTANTS } from './aiConstants';
import { evaluateAllActions, type ActionImpact } from './aiEvaluators';
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

    const tileForActivePlayer = currentHand[0];

    // The Computer AI always evaluates at 0-ply (just greedy current placement)
    const scoredMoves = getScoredMoves(state, aiPlayerId, tileForActivePlayer, 0);
    return scoredMoves.length > 0 ? scoredMoves[0].move : null;
}

function getAvailableMeeples(state: GameState, playerId: PlayerId): number {
    return state.remainingMeeples[playerId]?.standard || 0;
}

function calculateFinalScore(
    impact: ActionImpact
): number {
    let finalScore = impact.selfGain * AI_CONSTANTS.EASY.SELF_WEIGHT;

    for (const delta of Object.values(impact.opponentDelta)) {
        // The Computer AI doesn't heavily weigh opponents, but it respects the constant
        finalScore -= delta * AI_CONSTANTS.EASY.OPPONENT_WEIGHT;
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
    handIndex: number
): ScoredMove[] {
    const scoredMoves: ScoredMove[] = [];

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
            const impactNoMeeple = evaluateAllActions(state, simBoard, placement.x, placement.y, simTile, activePlayerId, null);
            const scoreNoMeeple = calculateFinalScore(impactNoMeeple);

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
                // The basic Computer AI doesn't place farmers (fields) because predicting their value
                // without deep tree expansion is too brittle, resulting in wasted meeples early game.

                for (const fId of featuresToTry) {
                    const occupied = new Set(getOccupiedFeaturesOnTile(simBoard, placement.x, placement.y));
                    if (!occupied.has(fId)) {
                        simTile.meeples.push({ meeple: { id: 'sim-meeple', playerId: activePlayerId, type: 'standard' }, featureId: fId });

                        const impactWithMeeple = evaluateAllActions(state, simBoard, placement.x, placement.y, simTile, activePlayerId, fId);
                        let scoreWithMeeple = calculateFinalScore(impactWithMeeple);

                        // Give it the meeple placement bonus so it actually places them
                        scoreWithMeeple += AI_CONSTANTS.EASY.MEEPLE_PLACEMENT_BONUS;

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
