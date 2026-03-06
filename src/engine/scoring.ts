import type { GameState, PlacedMeeple, PlayerId, ScoreUpdate } from './types';
import { evaluateFeature, evaluateMonastery } from './features';
import { TILES_MAP } from './tiles';

// Check all features on the recently placed tile to see if they just completed
export function checkAndScoreFeatures(state: GameState): ScoreUpdate[] {
    const updates: ScoreUpdate[] = [];
    if (!state.recentTilePosition) return updates;

    const { x, y } = state.recentTilePosition;
    const tileKey = `${x},${y}`;
    const placedTile = state.board[tileKey];
    if (!placedTile) return updates;

    const def = TILES_MAP[placedTile.typeId];
    if (!def) return updates;

    const scoredFeatures = new Set<string>(); // avoid double scoring if we traverse from different angles

    // Helper to process a scored feature
    const processFeature = (evaluation: ReturnType<typeof evaluateFeature>, featureName: string, pointsPerTile: number, booleanPennants = false, featureData?: Record<string, string | number | boolean>) => {
        if (!evaluation.isComplete) return;

        // Create a unique key for this completed feature (sort the component IDs)
        const componentIds = evaluation.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort();
        const featureKey = componentIds.join('|');
        if (scoredFeatures.has(featureKey)) return;
        scoredFeatures.add(featureKey);

        // Find all meeples on this feature
        const meeplesOnFeature: { meeple: PlacedMeeple, tileKey: string }[] = [];
        evaluation.components.forEach(comp => {
            const tKey = `${comp.tileX},${comp.tileY}`;
            const t = state.board[tKey];
            if (t) {
                const found = t.meeples.filter(m => m.featureId === comp.featureId);
                found.forEach(f => meeplesOnFeature.push({ meeple: f, tileKey: tKey }));
            }
        });

        // Calculate points
        // Get unique tiles in the feature
        const uniqueTileKeys = new Set(evaluation.components.map(c => `${c.tileX},${c.tileY}`));
        let points = uniqueTileKeys.size * pointsPerTile;

        // Add pennants if applicable
        if (booleanPennants) {
            uniqueTileKeys.forEach(tk => {
                const t = state.board[tk];
                if (t) {
                    const tDef = TILES_MAP[t.typeId];
                    if (tDef && tDef.pennants) {
                        points += (tDef.pennants * pointsPerTile); // Pennants usually score same as the tile
                    }
                }
            });
        }

        // Determine majority
        const meepleCounts: Record<PlayerId, number> = {};
        meeplesOnFeature.forEach(m => {
            const pid = m.meeple.meeple.playerId;
            // A large meeple counts as 2
            const weight = m.meeple.meeple.type === 'large' ? 2 : 1;
            meepleCounts[pid] = (meepleCounts[pid] || 0) + weight;
        });

        if (Object.keys(meepleCounts).length === 0) return; // No one scores, so skip this feature popup

        let maxMeeples = 0;
        let winners: PlayerId[] = [];
        for (const p of state.players) {
            const count = meepleCounts[p] || 0;
            if (count > maxMeeples) {
                maxMeeples = count;
                winners = [p];
            } else if (count === maxMeeples && count > 0) {
                winners.push(p);
            }
        }

        // Apply score and return meeples — REMOVED: now done lazily per-update in _serveQueue

        const returned: PlacedMeeple[] = [];
        meeplesOnFeature.forEach(m => {
            returned.push(m.meeple);
        });

        if (winners.length > 0) { // Only log/popup if someone actually scored points!
            updates.push({
                players: winners,
                points,
                featureName,
                featureData,
                category: featureName.toLowerCase().includes('city') ? 'city'
                    : featureName.toLowerCase().includes('road') ? 'road'
                        : featureName.toLowerCase().includes('monastery') ? 'monastery' : 'field',
                returnedMeeples: returned,
                completedComponentIds: componentIds
            });
        }
    };

    // 1. Check Cities
    if (def.cityConnections) {
        def.cityConnections.forEach((_, idx) => {
            const evalResult = evaluateFeature(state.board, x, y, 'city', idx);
            // 2 points per tile and 2 per pennant for completed cities
            processFeature(evalResult, 'game.city', 2, true);
        });
    }

    // 2. Check Roads
    if (def.roadConnections) {
        def.roadConnections.forEach((_, idx) => {
            const evalResult = evaluateFeature(state.board, x, y, 'road', idx);
            // 1 point per tile for roads
            processFeature(evalResult, 'game.road', 1, false);
        });
    }

    // 3. Check Monastery (if this tile is a monastery)
    if (def.monastery) {
        const evalResult = evaluateMonastery(state.board, x, y);
        processFeature(evalResult, 'game.monastery', 1, false); // 1 point per tile (9 total)
    }

    // 4. Check neighboring Monasteries (placing this tile might have completed an adjacent monastery)
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            const nTile = state.board[`${nx},${ny}`];
            if (nTile) {
                const nDef = TILES_MAP[nTile.typeId];
                if (nDef && nDef.monastery) {
                    const evalResult = evaluateMonastery(state.board, nx, ny);
                    processFeature(evalResult, 'game.monastery', 1, false);
                }
            }
        }
    }

    return updates;
}

/**
 * Final scoring at end of game for all incomplete features and farm scoring.
 * PURE COMPUTATION — does NOT mutate state. Returns an ordered queue of ScoreUpdate
 * to be played one-at-a-time via finishScoring. Ordering: player-interleaved by category:
 *   P1-City, P2-City, P1-Road, P2-Road, P1-Monastery, P2-Monastery, P1-Field, P2-Field
 */
export function scoreEndGame(state: GameState): ScoreUpdate[] {
    const scoredFeatures = new Set<string>();

    // Buckets: category -> playerId -> ScoreUpdate[]
    const buckets: Record<string, Record<PlayerId, ScoreUpdate[]>> = {
        city: {}, road: {}, monastery: {}, field: {}
    };
    for (const p of state.players) {
        for (const cat of ['city', 'road', 'monastery', 'field']) {
            buckets[cat][p] = [];
        }
    }

    // Helper: build a single ScoreUpdate for a feature (NO mutation)
    const buildUpdate = (
        evaluation: ReturnType<typeof evaluateFeature> | null,
        featureName: string,
        category: 'city' | 'road' | 'monastery' | 'field',
        pointsOverride?: number,
        meeplesOverride?: { meeple: PlacedMeeple, tileKey: string }[],
        componentIdsOverride?: string[],
        featureData?: Record<string, string | number | boolean>
    ) => {
        if (!evaluation && !meeplesOverride) return;

        const componentIds = componentIdsOverride ??
            (evaluation?.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort() ?? []);
        const featureKey = componentIds.join('|');
        if (scoredFeatures.has(featureKey)) return;
        scoredFeatures.add(featureKey);

        const meeplesOnFeature: { meeple: PlacedMeeple, tileKey: string }[] = meeplesOverride ?? [];
        if (!meeplesOverride && evaluation) {
            evaluation.components.forEach(comp => {
                const t = state.board[`${comp.tileX},${comp.tileY}`];
                if (t) t.meeples.filter(m => m.featureId === comp.featureId)
                    .forEach(f => meeplesOnFeature.push({ meeple: f, tileKey: `${comp.tileX},${comp.tileY}` }));
            });
        }
        if (meeplesOnFeature.length === 0) return;

        let points = pointsOverride ?? 0;
        if (!pointsOverride && evaluation) {
            const uniqueTileKeys = new Set(evaluation.components.map(c => `${c.tileX},${c.tileY}`));
            points = uniqueTileKeys.size;
            if (category === 'city') {
                uniqueTileKeys.forEach(tk => {
                    const t = state.board[tk];
                    const tDef = t ? TILES_MAP[t.typeId] : null;
                    if (tDef?.pennants) points += tDef.pennants;
                });
            }
        }

        // Determine majority
        const meepleCounts: Record<PlayerId, number> = {};
        meeplesOnFeature.forEach(m => {
            const pid = m.meeple.meeple.playerId;
            const w = m.meeple.meeple.type === 'large' ? 2 : 1;
            meepleCounts[pid] = (meepleCounts[pid] || 0) + w;
        });

        let maxMeeples = 0;
        let winners: PlayerId[] = [];
        for (const p of state.players) {
            const count = meepleCounts[p] || 0;
            if (count > maxMeeples) { maxMeeples = count; winners = [p]; }
            else if (count === maxMeeples && count > 0) winners.push(p);
        }
        if (winners.length === 0) return;

        const update: ScoreUpdate = {
            players: winners,
            points,
            featureName,
            featureData,
            category,
            returnedMeeples: meeplesOnFeature.map(m => m.meeple),
            completedComponentIds: componentIds,
        };

        // Store in the correct bucket for EACH winner player
        // We use the winner with the most meeples to decide the bucket owner for ordering,
        // but the update itself covers all winners. We add it to each winner's bucket so
        // the interleaving covers it from in the right player slot.
        // To avoid duplicate pop-ups: add to the first winner's slot only.
        const primaryWinner = winners[0];
        buckets[category][primaryWinner].push(update);
    };

    // --- Scan board for incomplete features ---
    for (const tileKey of Object.keys(state.board)) {
        const tile = state.board[tileKey];
        const def = TILES_MAP[tile.typeId];
        if (!def) continue;

        // Incomplete cities (1pt/tile + 1pt/pennant)
        def.cityConnections?.forEach((_, idx) => {
            const ev = evaluateFeature(state.board, tile.x, tile.y, 'city', idx);
            if (!ev.isComplete) buildUpdate(ev, 'game.cityPartial', 'city');
        });

        // Incomplete roads (1pt/tile)
        def.roadConnections?.forEach((_, idx) => {
            const ev = evaluateFeature(state.board, tile.x, tile.y, 'road', idx);
            if (!ev.isComplete) buildUpdate(ev, 'game.roadPartial', 'road');
        });

        // Incomplete monasteries (1pt/present tile)
        if (def.monastery) {
            const ev = evaluateMonastery(state.board, tile.x, tile.y);
            if (!ev.isComplete) {
                const monk = tile.meeples.find(m => m.featureId === 'monastery-0');
                if (monk) {
                    const compIds = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort();
                    buildUpdate(null, 'game.monasteryPartial', 'monastery',
                        ev.components.length,
                        [{ meeple: monk, tileKey }],
                        compIds
                    );
                }
            }
        }
    }

    // --- Farm scoring ---
    const farmerFeatures = new Set<string>();
    for (const tileKey of Object.keys(state.board)) {
        const tile = state.board[tileKey];
        const def = TILES_MAP[tile.typeId];
        if (!def) continue;

        for (const farmer of tile.meeples.filter(m => m.featureId.startsWith('field-'))) {
            const fieldIdx = parseInt(farmer.featureId.split('-')[1], 10);
            if (isNaN(fieldIdx)) continue;
            const ev = evaluateFeature(state.board, tile.x, tile.y, 'field', fieldIdx);

            const fieldKey = ev.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|');
            if (farmerFeatures.has(fieldKey)) continue;
            farmerFeatures.add(fieldKey);

            // Collect all farmers on this field
            const farmersOnField: { meeple: PlacedMeeple, tileKey: string }[] = [];
            ev.components.forEach(comp => {
                const t2 = state.board[`${comp.tileX},${comp.tileY}`];
                if (t2) t2.meeples.filter(m => m.featureId === comp.featureId)
                    .forEach(f => farmersOnField.push({ meeple: f, tileKey: `${comp.tileX},${comp.tileY}` }));
            });
            if (farmersOnField.length === 0) continue;

            // Count completed cities adjacent to this field across all connected tiles.
            // We use the deterministic local adjacentCities mapping to check cities ON THE SAME TILE.
            const adjacentCityKeys = new Set<string>();
            ev.components.forEach(comp => {
                const compTile = state.board[`${comp.tileX},${comp.tileY}`];
                if (!compTile) return;
                const compDef = TILES_MAP[compTile.typeId];
                if (!compDef?.adjacentCities) return;

                const localFieldIdx = parseInt(comp.featureId.split('-')[1], 10);
                const adjacentCityIndices = compDef.adjacentCities[localFieldIdx];
                if (!adjacentCityIndices) return;

                for (const cIdx of adjacentCityIndices) {
                    const ce = evaluateFeature(state.board, compTile.x, compTile.y, 'city', cIdx);
                    if (ce.isComplete) {
                        adjacentCityKeys.add(
                            ce.components.map(c => `${c.tileX},${c.tileY},${c.featureId}`).sort().join('|')
                        );
                    }
                }
            });

            const farmPts = adjacentCityKeys.size * 3;
            if (farmPts === 0) continue;

            buildUpdate(null, 'game.farmWithCities', 'field',
                farmPts, farmersOnField, [fieldKey], { count: adjacentCityKeys.size });
        }
    }

    // --- Interleave by player, by category ---
    // Order: [City, Road, Monastery, Field] x [P1, P2, ...]
    const ordered: ScoreUpdate[] = [];
    for (const cat of ['city', 'road', 'monastery', 'field'] as const) {
        // Determine max updates any player has in this category
        const maxLen = Math.max(...state.players.map(p => buckets[cat][p].length), 0);
        for (let i = 0; i < maxLen; i++) {
            for (const p of state.players) {
                if (buckets[cat][p][i]) ordered.push(buckets[cat][p][i]);
            }
        }
    }

    return ordered;
}

