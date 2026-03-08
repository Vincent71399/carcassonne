import type { GameState, PlayerId, PlacedTile, FeatureType, EdgeDirection, TileDefinition, TileEdges, DetailedEdge } from './types';
import { evaluateFeature, evaluateMonastery, type FeatureEvaluation } from './features';
import { TILES_MAP } from './tiles';
import { AI_CONSTANTS_EXPERIMENT } from './aiConstants';

export function evaluateFieldAttack(
    board: GameState['board'],
    attackerId: PlayerId,
    allPlayerIds: PlayerId[],
    currentPos: { x: number, y: number },
    hand: GameState['hands'][PlayerId],
    deck: GameState['deck']
): Record<PlayerId | 'neutral', number> {
    const results: Record<PlayerId | 'neutral', number> = { neutral: 0 } as Record<PlayerId | 'neutral', number>;
    allPlayerIds.forEach(pid => { results[pid] = 0; });

    const attackerTile = board[`${currentPos.x},${currentPos.y}`];
    if (!attackerTile) return results;

    // 1. Identify all cities already controlled by the attacker across the whole board
    const attackerAlreadyControlledCities = new Set<string>();
    const scoredFieldsForAttacker = new Set<string>();
    for (const tileKey of Object.keys(board)) {
        const tile = board[tileKey];
        const def = TILES_MAP[tile.typeId];
        if (!def?.fieldConnections) continue;
        def.fieldConnections.forEach((_, fieldIdx) => {
            const ev = evaluateFeature(board, tile.x, tile.y, 'field', fieldIdx);
            const fieldKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
            if (scoredFieldsForAttacker.has(fieldKey)) return;
            scoredFieldsForAttacker.add(fieldKey);

            const ownership = getFeatureOwnership(ev, board);
            if (ownership[attackerId] > 0) {
                getFieldCities(ev, board).forEach(c => attackerAlreadyControlledCities.add(c));
            }
        });
    }

    // 2. Identify Target Fields (Opponent owned)
    const targetFields: FeatureEvaluation[] = [];
    const scoredTargets = new Set<string>();

    for (const tileKey of Object.keys(board)) {
        const tile = board[tileKey];
        const def = TILES_MAP[tile.typeId];
        if (!def?.fieldConnections) continue;

        def.fieldConnections.forEach((_, fieldIdx) => {
            const ev = evaluateFeature(board, tile.x, tile.y, 'field', fieldIdx);
            const featureKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
            if (scoredTargets.has(featureKey)) return;
            scoredTargets.add(featureKey);

            const ownership = getFeatureOwnership(ev, board);
            const winners = getFeatureWinners(ownership);
            const isOpponentOwned = winners.some(w => w !== 'neutral' && w !== attackerId);

            if (isOpponentOwned) {
                targetFields.push(ev);
            }
        });
    }

    if (targetFields.length === 0) return results;

    // 3. Identify Attacker's Fields on the new tile
    const attackerFeatures: FeatureEvaluation[] = [];
    const attackerDefAtMove = TILES_MAP[attackerTile.typeId];
    attackerDefAtMove?.fieldConnections?.forEach((_, fieldIdx) => {
        const ev = evaluateFeature(board, currentPos.x, currentPos.y, 'field', fieldIdx);
        const ownership = getFeatureOwnership(ev, board);
        if (ownership[attackerId] > 0) {
            attackerFeatures.push(ev);
        }
    });

    if (attackerFeatures.length === 0) return results;

    const attackerOpenEdgesByJunction = new Map<string, { x: number, y: number, segment: string }[]>();
    attackerFeatures.forEach(af => {
        getOpenFieldEdges(af, board).forEach(oe => {
            const dx_dir = oe.segment.split('-')[0] as EdgeDirection;
            const jx = oe.x + (dx_dir === 'right' ? 1 : dx_dir === 'left' ? -1 : 0);
            const jy = oe.y + (dx_dir === 'bottom' ? 1 : dx_dir === 'top' ? -1 : 0);
            const key = `${jx},${jy}`;
            if (!attackerOpenEdgesByJunction.has(key)) attackerOpenEdgesByJunction.set(key, []);
            attackerOpenEdgesByJunction.get(key)!.push(oe);
        });
    });

    // 4. Evaluate attacks on target fields
    targetFields.forEach(target => {
        const targetOpenEdges = getOpenFieldEdges(target, board);
        const targetOwnerShip = getFeatureOwnership(target, board);
        const targetWinners = getFeatureWinners(targetOwnerShip);
        const targetOwnerWinner = targetWinners.find(w => w !== 'neutral' && w !== attackerId);
        if (!targetOwnerWinner) return;
        const targetOwnerId = Number(targetOwnerWinner);

        const seenJunctionsForThisTarget = new Set<string>();

        targetOpenEdges.forEach(targetEdge => {
            const dx_dir = targetEdge.segment.split('-')[0] as EdgeDirection;
            const jx = targetEdge.x + (dx_dir === 'right' ? 1 : dx_dir === 'left' ? -1 : 0);
            const jy = targetEdge.y + (dx_dir === 'bottom' ? 1 : dx_dir === 'top' ? -1 : 0);
            const junctionKey = `${jx},${jy}`;

            if (board[junctionKey] || seenJunctionsForThisTarget.has(junctionKey)) return;
            seenJunctionsForThisTarget.add(junctionKey);

            const matchingAttackerEdges = attackerOpenEdgesByJunction.get(junctionKey);
            if (matchingAttackerEdges) {
                matchingAttackerEdges.forEach(attackerEdge => {
                    const connectingTiles = findConnectingFieldTiles(jx, jy, targetEdge.segment, attackerEdge.segment, hand, deck);
                    if (connectingTiles.count > 0) {
                        const attackerMeeplesPerPid: Record<PlayerId, number> = {};
                        allPlayerIds.forEach(pid => { attackerMeeplesPerPid[pid] = 0; });

                        const processedFeatures = new Set<string>();

                        const dirsToCheck: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
                        dirsToCheck.forEach(dir => {
                            const nx = jx + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
                            const ny = jy + (dir === 'bottom' ? 1 : dir === 'top' ? -1 : 0);
                            const nTile = board[`${nx},${ny}`];
                            if (!nTile) return;

                            const nDef = TILES_MAP[nTile.typeId];
                            const oppositeDir = dir === 'top' ? 'bottom' : dir === 'bottom' ? 'top' : dir === 'left' ? 'right' : 'left';
                            const origDir = getOriginalDir(oppositeDir, nTile.rotation);

                            nDef.fieldConnections?.forEach((conn, fIdx) => {
                                if (conn.some(seg => seg.startsWith(origDir))) {
                                    const ev = evaluateFeature(board, nx, ny, 'field', fIdx);
                                    const featureKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
                                    if (processedFeatures.has(featureKey)) return;
                                    processedFeatures.add(featureKey);

                                    const ownership = getFeatureOwnership(ev, board);
                                    allPlayerIds.forEach(pid => {
                                        attackerMeeplesPerPid[pid] += (ownership[pid] || 0);
                                    });
                                }
                            });
                        });

                        const A_total = attackerMeeplesPerPid[attackerId] || 0;
                        const O_count = Math.max(...allPlayerIds.filter(pid => pid !== attackerId).map(pid => attackerMeeplesPerPid[pid] || 0), 0);

                        if (A_total >= O_count) {
                            const pFactor = connectingTiles.inHand ? 1 :
                                calculatePossibilityFactor(connectingTiles.count, deck.length, allPlayerIds.length);

                            const targetCities = getFieldCities(target, board);
                            let newCitiesCount = 0;
                            targetCities.forEach(cKey => {
                                if (!attackerAlreadyControlledCities.has(cKey)) {
                                    newCitiesCount++;
                                }
                            });

                            const A_gain = newCitiesCount * 3 * pFactor;
                            const O_loss = (A_total > O_count) ? targetCities.size * 3 * pFactor : 0;

                            results[attackerId] = Math.max(results[attackerId], A_gain);
                            results[targetOwnerId] = Math.min(results[targetOwnerId], -O_loss) || 0;
                        }
                    }
                });
            }
        });
    });

    return results;
}

function getFieldCities(ev: FeatureEvaluation, board: GameState['board']): Set<string> {
    const adjacentCityKeys = new Set<string>();
    ev.components.forEach(comp => {
        const compTile = board[`${comp.tileX},${comp.tileY}`];
        if (!compTile) return;
        const compDef = TILES_MAP[compTile.typeId];
        if (!compDef?.adjacentCities) return;
        const localIdx = parseInt(comp.featureId.split('-')[1], 10);
        const adj = compDef.adjacentCities[localIdx];
        if (!adj) return;
        adj.forEach(cIdx => {
            const ce = evaluateFeature(board, compTile.x, compTile.y, 'city', cIdx);
            if (ce.isComplete) {
                adjacentCityKeys.add(ce.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|'));
            }
        });
    });
    return adjacentCityKeys;
}

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
 * Advanced logic for city attack/defense evaluation.
 */
export function evaluateCityAttack(
    board: GameState['board'],
    attackerId: PlayerId,
    players: PlayerId[],
    lastMovePos: { x: number, y: number },
    attackerHand: GameState['hands'][PlayerId],
    deck: GameState['deck']
): Record<PlayerId | 'neutral', number> {
    const results: Record<PlayerId | 'neutral', number> = { neutral: 0 };
    players.forEach(p => { results[p] = 0; });

    const { x: ax, y: ay } = lastMovePos;
    const attackerTile = board[`${ax},${ay}`];
    if (!attackerTile) return results;

    // 1. Identify Target Cities (Opponent owned, in-progress)
    const targetCities: FeatureEvaluation[] = [];
    const scoredTargets = new Set<string>();

    for (const tileKey of Object.keys(board)) {
        const tile = board[tileKey];
        const def = TILES_MAP[tile.typeId];
        if (!def?.cityConnections) continue;

        def.cityConnections.forEach((_, cityIdx) => {
            const ev = evaluateFeature(board, tile.x, tile.y, 'city', cityIdx);
            if (ev.isComplete) return;

            const featureKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
            if (scoredTargets.has(featureKey)) return;
            scoredTargets.add(featureKey);

            const ownership = getFeatureOwnership(ev, board);
            const winners = getFeatureWinners(ownership);

            // Is it owned by an opponent?
            const isOpponentOwned = winners.some(w => w !== 'neutral' && w !== attackerId);
            if (isOpponentOwned) {
                targetCities.push(ev);
            }
        });
    }

    if (targetCities.length === 0) return results;

    // 2. Identify Attacker's Cities on the new tile
    const attackerCities: FeatureEvaluation[] = [];
    const attackerDefForMeeple = TILES_MAP[attackerTile.typeId];
    attackerDefForMeeple?.cityConnections?.forEach((_: EdgeDirection[], i: number) => {
        const ev = evaluateFeature(board, ax, ay, 'city', i);
        const ownership = getFeatureOwnership(ev, board);
        if (ownership[attackerId] > 0) {
            attackerCities.push(ev);
        }
    });

    if (attackerCities.length === 0) return results;

    const attackerOpenEdgesByJunction = new Map<string, { x: number, y: number, dir: EdgeDirection }[]>();
    attackerCities.forEach(ac => {
        getOpenCityEdges(ac, board).forEach(oe => {
            const jx = oe.x + (oe.dir === 'right' ? 1 : oe.dir === 'left' ? -1 : 0);
            const jy = oe.y + (oe.dir === 'bottom' ? 1 : oe.dir === 'top' ? -1 : 0);
            const key = `${jx},${jy}`;
            if (!attackerOpenEdgesByJunction.has(key)) attackerOpenEdgesByJunction.set(key, []);
            attackerOpenEdgesByJunction.get(key)!.push(oe);
        });
    });

    // 3. Evaluate attacks on target cities
    targetCities.forEach(target => {
        const targetOpenEdges = getOpenCityEdges(target, board);
        const targetValue = new Set(target.components.map(c => `${c.tileX},${c.tileY}`)).size * 2;

        const targetOwnerShip = getFeatureOwnership(target, board);
        const targetWinners = getFeatureWinners(targetOwnerShip);
        const targetOwnerWinner = targetWinners.find(w => w !== 'neutral' && w !== attackerId);
        if (!targetOwnerWinner) return;
        const targetOwnerId = Number(targetOwnerWinner);

        const seenJunctionsForThisTarget = new Set<string>();

        targetOpenEdges.forEach(targetEdge => {
            const jx = targetEdge.x + (targetEdge.dir === 'right' ? 1 : targetEdge.dir === 'left' ? -1 : 0);
            const jy = targetEdge.y + (targetEdge.dir === 'bottom' ? 1 : targetEdge.dir === 'top' ? -1 : 0);
            const junctionKey = `${jx},${jy}`;

            if (board[junctionKey] || seenJunctionsForThisTarget.has(junctionKey)) return;
            seenJunctionsForThisTarget.add(junctionKey);

            const matchingAttackerEdges = attackerOpenEdgesByJunction.get(junctionKey);
            if (matchingAttackerEdges) {
                matchingAttackerEdges.forEach(attackerEdge => {
                    const connectingTiles = findConnectingTiles(jx, jy, targetEdge.dir, attackerEdge.dir, attackerHand, deck);
                    if (connectingTiles.count > 0) {
                        const attackerCity = attackerCities.find(ac =>
                            getOpenCityEdges(ac, board).some(oe => oe.x === attackerEdge.x && oe.y === attackerEdge.y && oe.dir === attackerEdge.dir)
                        );
                        if (!attackerCity) return;
                        const attackerCityValue = new Set(attackerCity.components.map(c => `${c.tileX},${c.tileY}`)).size * 2;

                        let attackerMeeples = 0;
                        let opponentMeeples = 0;
                        const processedFeatures = new Set<string>();

                        const dirsToCheck: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
                        dirsToCheck.forEach(dir => {
                            const nx = jx + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
                            const ny = jy + (dir === 'bottom' ? 1 : dir === 'top' ? -1 : 0);
                            const nTile = board[`${nx},${ny}`];
                            if (!nTile) return;

                            const nDef = TILES_MAP[nTile.typeId];
                            const oppositeDir = dir === 'top' ? 'bottom' : dir === 'bottom' ? 'top' : dir === 'left' ? 'right' : 'left';

                            nDef.cityConnections?.forEach((conn, cityIdx) => {
                                if (conn.includes(getOriginalDir(oppositeDir, nTile.rotation))) {
                                    const ev = evaluateFeature(board, nx, ny, 'city', cityIdx);
                                    const featureKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
                                    if (processedFeatures.has(featureKey)) return;
                                    processedFeatures.add(featureKey);

                                    const ownership = getFeatureOwnership(ev, board);
                                    attackerMeeples += (ownership[attackerId] || 0);
                                    opponentMeeples = Math.max(opponentMeeples, ownership[targetOwnerId] || 0);
                                }
                            });
                        });

                        const A_total = attackerMeeples;
                        const O_count = opponentMeeples;
                        const pFactor = connectingTiles.inHand ? 1 :
                            calculatePossibilityFactor(connectingTiles.count, deck.length, players.length);

                        // Attacker Gain (if they can reach/exceed opponent)
                        if (A_total >= O_count) {
                            results[attackerId] = Math.max(results[attackerId], targetValue * pFactor);
                        }

                        // Opponent Gain (if they can reach/exceed attacker)
                        if (O_count >= A_total) {
                            results[targetOwnerId] = Math.max(results[targetOwnerId], attackerCityValue * pFactor);
                        }

                        // Owner Loss (if attacker wins)
                        if (A_total > O_count) {
                            const newLoss = -targetValue * pFactor;
                            results[targetOwnerId] = Math.min(results[targetOwnerId] || 0, newLoss);
                        }
                    }
                });
            }
        });
    });

    return results;
}

export function evaluateRoadAttack(
    board: GameState['board'],
    attackerId: PlayerId,
    players: PlayerId[],
    lastMovePos: { x: number, y: number },
    attackerHand: GameState['hands'][PlayerId],
    deck: GameState['deck']
): Record<PlayerId | 'neutral', number> {
    const results: Record<PlayerId | 'neutral', number> = { neutral: 0 };
    players.forEach(p => { results[p] = 0; });

    const { x: ax, y: ay } = lastMovePos;
    const attackerTile = board[`${ax},${ay}`];
    if (!attackerTile) return results;

    // 1. Identify Target Roads (Opponent owned, in-progress)
    const targetRoads: FeatureEvaluation[] = [];
    const scoredTargets = new Set<string>();

    for (const tileKey of Object.keys(board)) {
        const tile = board[tileKey];
        const def = TILES_MAP[tile.typeId];
        if (!def?.roadConnections) continue;

        def.roadConnections.forEach((_, roadIdx) => {
            const ev = evaluateFeature(board, tile.x, tile.y, 'road', roadIdx);
            if (ev.isComplete) return;

            const featureKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
            if (scoredTargets.has(featureKey)) return;
            scoredTargets.add(featureKey);

            const ownership = getFeatureOwnership(ev, board);
            const winners = getFeatureWinners(ownership);

            const isOpponentOwned = winners.some(w => w !== 'neutral' && w !== attackerId);
            if (isOpponentOwned) {
                targetRoads.push(ev);
            }
        });
    }

    if (targetRoads.length === 0) return results;

    // 2. Identify Attacker's Roads on the new tile
    const attackerRoads: FeatureEvaluation[] = [];
    const attackerDefAtMove = TILES_MAP[attackerTile.typeId];
    attackerDefAtMove?.roadConnections?.forEach((_: EdgeDirection[], i: number) => {
        const ev = evaluateFeature(board, ax, ay, 'road', i);
        const ownership = getFeatureOwnership(ev, board);
        if (ownership[attackerId] > 0) {
            attackerRoads.push(ev);
        }
    });

    if (attackerRoads.length === 0) return results;

    const attackerOpenEdgesByJunction = new Map<string, { x: number, y: number, dir: EdgeDirection }[]>();
    attackerRoads.forEach(ar => {
        getOpenRoadEdges(ar, board).forEach(oe => {
            const jx = oe.x + (oe.dir === 'right' ? 1 : oe.dir === 'left' ? -1 : 0);
            const jy = oe.y + (oe.dir === 'bottom' ? 1 : oe.dir === 'top' ? -1 : 0);
            const key = `${jx},${jy}`;
            if (!attackerOpenEdgesByJunction.has(key)) attackerOpenEdgesByJunction.set(key, []);
            attackerOpenEdgesByJunction.get(key)!.push(oe);
        });
    });

    // 3. Evaluate attacks on target roads
    targetRoads.forEach(target => {
        const targetOpenEdges = getOpenRoadEdges(target, board);
        const targetValue = new Set(target.components.map(c => `${c.tileX},${c.tileY}`)).size; // tiles

        const targetOwnerShip = getFeatureOwnership(target, board);
        const targetWinners = getFeatureWinners(targetOwnerShip);
        const targetOwnerWinner = targetWinners.find(w => w !== 'neutral' && w !== attackerId);
        if (!targetOwnerWinner) return;
        const targetOwnerId = Number(targetOwnerWinner);

        const seenJunctionsForThisTarget = new Set<string>();

        targetOpenEdges.forEach(targetEdge => {
            const jx = targetEdge.x + (targetEdge.dir === 'right' ? 1 : targetEdge.dir === 'left' ? -1 : 0);
            const jy = targetEdge.y + (targetEdge.dir === 'bottom' ? 1 : targetEdge.dir === 'top' ? -1 : 0);
            const junctionKey = `${jx},${jy}`;

            if (board[junctionKey] || seenJunctionsForThisTarget.has(junctionKey)) return;
            seenJunctionsForThisTarget.add(junctionKey);

            const matchingAttackerEdges = attackerOpenEdgesByJunction.get(junctionKey);
            if (matchingAttackerEdges) {
                matchingAttackerEdges.forEach(attackerEdge => {
                    const connectingTiles = findConnectingRoadTiles(jx, jy, targetEdge.dir, attackerEdge.dir, attackerHand, deck);
                    if (connectingTiles.count > 0) {
                        const attackerRoad = attackerRoads.find(ar =>
                            getOpenRoadEdges(ar, board).some(oe => oe.x === attackerEdge.x && oe.y === attackerEdge.y && oe.dir === attackerEdge.dir)
                        );
                        if (!attackerRoad) return;
                        const attackerRoadValue = new Set(attackerRoad.components.map(c => `${c.tileX},${c.tileY}`)).size;

                        let attackerMeeples = 0;
                        let opponentMeeples = 0;
                        const processedFeatures = new Set<string>();

                        const dirsToCheck: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
                        dirsToCheck.forEach(dir => {
                            const nx = jx + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
                            const ny = jy + (dir === 'bottom' ? 1 : dir === 'top' ? -1 : 0);
                            const nTile = board[`${nx},${ny}`];
                            if (!nTile) return;

                            const nDef = TILES_MAP[nTile.typeId];
                            const oppositeDir = dir === 'top' ? 'bottom' : dir === 'bottom' ? 'top' : dir === 'left' ? 'right' : 'left';

                            nDef.roadConnections?.forEach((conn, roadIdx) => {
                                if (conn.includes(getOriginalDir(oppositeDir, nTile.rotation))) {
                                    const ev = evaluateFeature(board, nx, ny, 'road', roadIdx);
                                    const featureKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
                                    if (processedFeatures.has(featureKey)) return;
                                    processedFeatures.add(featureKey);

                                    const ownership = getFeatureOwnership(ev, board);
                                    attackerMeeples += (ownership[attackerId] || 0);
                                    opponentMeeples = Math.max(opponentMeeples, ownership[targetOwnerId] || 0);
                                }
                            });
                        });

                        const A_total = attackerMeeples;
                        const O_count = opponentMeeples;
                        const pFactor = connectingTiles.inHand ? 1 :
                            calculatePossibilityFactor(connectingTiles.count, deck.length, players.length);

                        // Attacker Gain
                        if (A_total >= O_count) {
                            results[attackerId] = Math.max(results[attackerId], targetValue * pFactor);
                        }

                        // Opponent Gain
                        if (O_count >= A_total) {
                            results[targetOwnerId] = Math.max(results[targetOwnerId], attackerRoadValue * pFactor);
                        }

                        // Owner Loss
                        if (A_total > O_count) {
                            const newLoss = -targetValue * pFactor;
                            results[targetOwnerId] = Math.min(results[targetOwnerId] || 0, newLoss);
                        }
                    }
                });
            }
        });
    });

    return results;
}

function getOpenCityEdges(ev: FeatureEvaluation, board: GameState['board']): { x: number, y: number, dir: EdgeDirection }[] {
    const open: { x: number, y: number, dir: EdgeDirection }[] = [];
    ev.components.forEach(comp => {
        const t = board[`${comp.tileX},${comp.tileY}`];
        if (!t) return;
        const def = TILES_MAP[t.typeId];
        const rotatedEdges = rotateEdges(def.edges, t.rotation);

        (['top', 'right', 'bottom', 'left'] as EdgeDirection[]).forEach(dir => {
            if (rotatedEdges[dir][0] === 'city') {
                const nx = comp.tileX + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
                const ny = comp.tileY + (dir === 'bottom' ? 1 : dir === 'top' ? -1 : 0);
                if (!board[`${nx},${ny}`]) {
                    // Open edge detected, check if it's THIS city feature
                    const neighbors = getCityNeighbors(t, dir);
                    if (neighbors.includes(comp.featureId)) {
                        open.push({ x: comp.tileX, y: comp.tileY, dir });
                    }
                }
            }
        });
    });
    return open;
}

function getCityNeighbors(tile: PlacedTile, dir: EdgeDirection): string[] {
    const def = TILES_MAP[tile.typeId];
    if (!def.cityConnections) return [];
    return def.cityConnections.map((conn, idx) => conn.includes(getOriginalDir(dir, tile.rotation)) ? `city-${idx}` : '').filter(Boolean);
}

function getRoadNeighbors(tile: PlacedTile, dir: EdgeDirection): string[] {
    const def = TILES_MAP[tile.typeId];
    if (!def.roadConnections) return [];
    return def.roadConnections.map((conn, idx) => conn.includes(getOriginalDir(dir, tile.rotation)) ? `road-${idx}` : '').filter(Boolean);
}

function getOpenRoadEdges(ev: FeatureEvaluation, board: GameState['board']): { x: number, y: number, dir: EdgeDirection }[] {
    const open: { x: number, y: number, dir: EdgeDirection }[] = [];
    ev.components.forEach(comp => {
        const t = board[`${comp.tileX},${comp.tileY}`];
        if (!t) return;
        const def = TILES_MAP[t.typeId];
        const rotatedEdges = rotateEdges(def.edges, t.rotation);

        (['top', 'right', 'bottom', 'left'] as EdgeDirection[]).forEach(dir => {
            if (rotatedEdges[dir][1] === 'road') {
                const nx = comp.tileX + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
                const ny = comp.tileY + (dir === 'bottom' ? 1 : dir === 'top' ? -1 : 0);
                if (!board[`${nx},${ny}`]) {
                    const neighbors = getRoadNeighbors(t, dir);
                    if (neighbors.includes(comp.featureId)) {
                        open.push({ x: comp.tileX, y: comp.tileY, dir });
                    }
                }
            }
        });
    });
    return open;
}

function findConnectingRoadTiles(_jx: number, _jy: number, targetDir: EdgeDirection, attackerDir: EdgeDirection, hand: GameState['hands'][PlayerId], deck: GameState['deck']) {
    const neededDirs: EdgeDirection[] = [
        targetDir === 'right' ? 'left' : targetDir === 'left' ? 'right' : targetDir === 'top' ? 'bottom' : 'top',
        attackerDir === 'right' ? 'left' : attackerDir === 'left' ? 'right' : attackerDir === 'top' ? 'bottom' : 'top'
    ];

    const fits = (t: TileDefinition) => {
        for (let r = 0; r < 4; r++) {
            const rotSteps = r;
            const edges = rotateEdges(t.edges, rotSteps);
            if (neededDirs.every(d => edges[d][1] === 'road')) {
                if (t.roadConnections) {
                    const localD1 = getOriginalDir(neededDirs[0], rotSteps);
                    const localD2 = getOriginalDir(neededDirs[1], rotSteps);
                    if (t.roadConnections.some((conn: EdgeDirection[]) => conn.includes(localD1) && conn.includes(localD2))) return true;
                }
            }
        }
        return false;
    };

    const inHand = hand.some(fits);
    const countInDeck = deck.filter(fits).length;
    return { inHand, count: inHand ? 1 : countInDeck };
}

function rotateFieldSegment(seg: string, rotation: number): string {
    const [dir, num] = seg.split('-');
    const dirs: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
    const oldIdx = dirs.indexOf(dir as EdgeDirection);
    const newIdx = (oldIdx + rotation) % 4;
    return `${dirs[newIdx]}-${num}`;
}

function getOriginalFieldSeg(seg: string, rotation: number): string {
    const [dir, num] = seg.split('-');
    const dirs: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
    const idx = dirs.indexOf(dir as EdgeDirection);
    const oldIdx = (idx - rotation + 4) % 4;
    return `${dirs[oldIdx]}-${num}`;
}

function getFieldNeighbors(tile: PlacedTile, featureIdOrIdx: string | number): string[] {
    const idx = typeof featureIdOrIdx === 'string' ? parseInt(featureIdOrIdx.split('-')[1]) : featureIdOrIdx;
    const def = TILES_MAP[tile.typeId];
    if (!def.fieldConnections || !def.fieldConnections[idx]) return [];
    return def.fieldConnections[idx].map(seg => rotateFieldSegment(seg, tile.rotation));
}

function getOpenFieldEdges(ev: FeatureEvaluation, board: GameState['board']): { x: number, y: number, segment: string }[] {
    const open: { x: number, y: number, segment: string }[] = [];
    ev.components.forEach(comp => {
        const t = board[`${comp.tileX},${comp.tileY}`];
        if (!t) return;
        const segments = getFieldNeighbors(t, comp.featureId);
        segments.forEach(seg => {
            const dir = seg.split('-')[0] as EdgeDirection;
            const nx = comp.tileX + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
            const ny = comp.tileY + (dir === 'bottom' ? 1 : dir === 'top' ? -1 : 0);
            if (!board[`${nx},${ny}`]) {
                open.push({ x: comp.tileX, y: comp.tileY, segment: seg });
            }
        });
    });
    return open;
}

function findConnectingFieldTiles(_jx: number, _jy: number, targetSeg: string, attackerSeg: string, hand: GameState['hands'][PlayerId], deck: GameState['deck']) {
    const matchSeg = (s: string): string => {
        const [dir, num] = s.split('-');
        const opp: Record<string, string> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
        const oppNum: Record<string, string> = { '0': '2', '1': '1', '2': '0' };
        return `${opp[dir]}-${oppNum[num]}`;
    };

    const neededSeg1 = matchSeg(targetSeg);
    const neededSeg2 = matchSeg(attackerSeg);

    const fits = (t: TileDefinition) => {
        if (!t.fieldConnections) return false;
        for (let r = 0; r < 4; r++) {
            const rotSteps = r;
            const seg1_orig = getOriginalFieldSeg(neededSeg1, rotSteps);
            const seg2_orig = getOriginalFieldSeg(neededSeg2, rotSteps);
            if (t.fieldConnections.some(conn => conn.includes(seg1_orig) && conn.includes(seg2_orig))) return true;
        }
        return false;
    };

    const inHand = hand.some(fits);
    const countInDeck = deck.filter(fits).length;
    return { inHand, count: inHand ? 1 : countInDeck };
}

function findConnectingTiles(_jx: number, _jy: number, targetDir: EdgeDirection, attackerDir: EdgeDirection, hand: GameState['hands'][PlayerId], deck: GameState['deck']) {

    // We need a tile at jx,jy that has city at the OPPOSITE of targetDir and OPPOSITE of attackerDir.
    // e.g. if Target is at Left of Junction (targetDir=right), junction needs city at Left.
    // if Attacker is at Top of Junction (attackerDir=bottom), junction needs city at Top.
    const neededDirs: EdgeDirection[] = [
        targetDir === 'right' ? 'left' : targetDir === 'left' ? 'right' : targetDir === 'top' ? 'bottom' : 'top',
        attackerDir === 'right' ? 'left' : attackerDir === 'left' ? 'right' : attackerDir === 'top' ? 'bottom' : 'top'
    ];

    const fits = (t: TileDefinition) => {
        for (let r = 0; r < 4; r++) {
            const rotDeg = r * 90;
            const edges = rotateEdges(t.edges, rotDeg);
            if (neededDirs.every(d => edges[d][0] === 'city')) {
                // Also check if these two city edges are connected internally
                if (t.cityConnections) {
                    const localD1 = getOriginalDir(neededDirs[0], rotDeg);
                    const localD2 = getOriginalDir(neededDirs[1], rotDeg);
                    if (t.cityConnections.some((conn: EdgeDirection[]) => conn.includes(localD1) && conn.includes(localD2))) return true;
                }
            }
        }
        return false;
    };

    const inHand = hand.some(fits);
    const countInDeck = deck.filter(fits).length;

    return { inHand, count: inHand ? 1 : countInDeck };
}

function getOriginalDir(currentDir: EdgeDirection, rotation: number): EdgeDirection {
    const dirs: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
    const idx = dirs.indexOf(currentDir);
    // rotation is steps (0, 1, 2, 3)
    // To go back, we subtract.
    const steps = rotation % 4;
    return dirs[(idx - steps + 4) % 4];
}

function calculatePossibilityFactor(num_valid_tiles: number, all_tiles: number, numPlayers: number): number {
    if (all_tiles === 0) return 0;
    if (!Number.isInteger(num_valid_tiles) || !Number.isInteger(all_tiles) || !Number.isInteger(numPlayers)) {
        throw new TypeError("n, N, and numPlayers must all be integers.");
    }
    if (num_valid_tiles > all_tiles) {
        throw new Error("n cannot be greater than N.");
    }

    const player1Slots = Math.ceil(all_tiles / numPlayers);
    const otherSlots = all_tiles - player1Slots;

    // If there are more jokers than non-player1 slots,
    // player 1 must get at least 1 joker
    if (num_valid_tiles > otherSlots) {
        return 1;
    }

    const probNeverGet = combination(otherSlots, num_valid_tiles) / combination(all_tiles, num_valid_tiles);
    return 1 - probNeverGet;
}

function combination(a: number, b: number): number {
    if (b < 0 || b > a) return 0;
    if (b === 0 || b === a) return 1;

    b = Math.min(b, a - b);
    let result = 1;

    for (let i = 1; i <= b; i++) {
        result = (result * (a - b + i)) / i;
    }

    return result;
}

/**
 * Calculates the score impact of monasteries that are still in progress.
 */
function rotateEdges(edges: TileEdges, rotations: number): TileEdges {
    let rotated = { ...edges };
    const r = rotations % 4;
    for (let i = 0; i < r; i++) {
        rotated = {
            top: [...rotated.left] as DetailedEdge,
            right: [...rotated.top] as DetailedEdge,
            bottom: [...rotated.right] as DetailedEdge,
            left: [...rotated.bottom] as DetailedEdge
        };
    }
    return rotated;
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
