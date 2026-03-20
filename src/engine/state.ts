import type { GameState, TileDefinition, PlayerId, PlayerType, MeepleType, ScoreUpdate, PlacedMeeple, PlacedTile } from './types';
import { generateDeck } from './tiles';
import { isValidPlacement, hasAnyValidPlacement } from './board';
import { checkAndScoreFeatures, scoreEndGame } from './scoring';
import { AI_EXPERIMENT_MODE } from '../utils/debug.ts';
import {
    evaluateGainScoreComplete,
    evaluateGainScoreCity_InProgress,
    evaluateGainScoreRoad_InProgress,
    evaluateGainScoreMonastery_InProgress,
    evaluateGainScoreField,
    evaluateMeepleUsage,
    evaluateCityAttack,
    evaluateRoadAttack,
    evaluateFieldAttack,
    evaluateCityOpenEdgeDelta
} from './aiEvaluators_experiment';

export function createInitialState(
    playerNames: Record<PlayerId, string>,
    playerTypes: Record<PlayerId, PlayerType>,
    useLargeMeeple: boolean = false
): GameState {
    const players = Object.keys(playerNames).map(Number).sort();
    const deck = generateDeck();

    const startTile: TileDefinition = {
        typeId: 'Start',
        count: 1,
        edges: { top: ['city', 'city', 'city'], right: ['field', 'road', 'field'], bottom: ['field', 'field', 'field'], left: ['field', 'road', 'field'] },
        cityConnections: [['top']],
        roadConnections: [['left', 'right']],
        fieldConnections: [['right-0', 'left-2'], ['right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0']]
    };

    const state: GameState = {
        players,
        playerNames,
        playerTypes,
        currentPlayerIndex: 0,
        turnPhase: 'PlaceTile',
        recentTilePosition: null,
        hands: {},
        deck,
        board: {
            '0,0': { id: 'start-tile', typeId: startTile.typeId, x: 0, y: 0, rotation: 0, meeples: [] }
        },
        remainingMeeples: {},
        scores: {},
        midGameScores: {},
        midGameScoreBreakdown: {},
        scoreUpdateKey: 0,
        endGameMode: false,
    };

    for (const p of players) {
        state.remainingMeeples[p] = { standard: 7, large: useLargeMeeple ? 1 : 0, builder: 1, pig: 1, abbott: 1 };
        state.scores[p] = 0;
        state.midGameScores[p] = 0;
        state.midGameScoreBreakdown[p] = { city: 0, road: 0, monastery: 0, field: 0 };
        state.hands[p] = [];
        for (let i = 0; i < 3; i++) {
            const drawn = state.deck.pop();
            if (drawn) state.hands[p].push(drawn);
        }
    }

    return state;
}

export function drawTile(state: GameState, playerId: PlayerId) {
    if (state.deck.length > 0) {
        state.hands[playerId].push(state.deck.pop()!);
    }
}

export function placeTile(
    state: GameState,
    playerId: PlayerId,
    handIndex: number,
    x: number,
    y: number,
    rotation: number
): boolean {
    if (playerId !== state.players[state.currentPlayerIndex]) return false;

    const hand = state.hands[playerId];
    if (handIndex < 0 || handIndex >= hand.length) return false;

    const tileDef = hand[handIndex];
    if (!isValidPlacement(state.board, x, y, tileDef, rotation)) return false;

    state.board[`${x},${y}`] = {
        id: `${Date.now()}-${Math.random()}`,
        typeId: tileDef.typeId,
        x, y, rotation, meeples: []
    };
    hand.splice(handIndex, 1);
    state.turnPhase = 'PlaceMeeple';
    state.recentTilePosition = { x, y };
    return true;
}

export function discardTile(
    state: GameState,
    playerId: PlayerId,
    handIndex: number
): boolean {
    if (playerId !== state.players[state.currentPlayerIndex]) return false;
    if (state.turnPhase !== 'DiscardTile') return false;

    const hand = state.hands[playerId];
    if (handIndex < 0 || handIndex >= hand.length) return false;

    hand.splice(handIndex, 1);
    advanceTurn(state);
    return true;
}

export function placeMeeple(
    state: GameState,
    playerId: PlayerId,
    featureId: string,
    meepleType: MeepleType = 'standard'
): boolean {
    if (playerId !== state.players[state.currentPlayerIndex]) return false;
    if (state.turnPhase !== 'PlaceMeeple') return false;
    if (!state.recentTilePosition) return false;
    if (state.remainingMeeples[playerId][meepleType] <= 0) return false;

    const tile = state.board[`${state.recentTilePosition.x},${state.recentTilePosition.y}`];
    state.remainingMeeples[playerId][meepleType]--;
    tile.meeples.push({ meeple: { id: Date.now().toString(), playerId, type: meepleType }, featureId });
    endTurn(state);
    return true;
}

export function skipMeeple(state: GameState, playerId: PlayerId): boolean {
    if (playerId !== state.players[state.currentPlayerIndex]) return false;
    if (state.turnPhase !== 'PlaceMeeple') return false;
    endTurn(state);
    return true;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Apply one update's score + meeple-return mutations to state.
 * Called when a pop-up is SERVED (before animation),
 * so the meeple disappears and score registers exactly when the pop-up appears.
 */
function _applyUpdate(state: GameState, update: ScoreUpdate) {
    // Award points
    update.players.forEach(p => { state.scores[p] += update.points; });

    // Remove meeples from board and return to player supply
    update.returnedMeeples.forEach(pm => {
        for (const tileKey of Object.keys(state.board)) {
            const tile = state.board[tileKey];
            const before = tile.meeples.length;
            tile.meeples = tile.meeples.filter(m => m.meeple.id !== pm.meeple.id);
            if (tile.meeples.length < before) {
                state.remainingMeeples[pm.meeple.playerId][pm.meeple.type]++;
                break;
            }
        }
    });

    // Track per-category breakdown for whichever phase we're in
    update.players.forEach(p => {
        if (state.endGameScoreBreakdown) {
            // End-game phase
            state.endGameScoreBreakdown[p][update.category] += update.points;
        } else {
            // Mid-game phase — initialise row if somehow missing
            if (!state.midGameScoreBreakdown[p]) {
                state.midGameScoreBreakdown[p] = { city: 0, road: 0, monastery: 0, field: 0 };
            }
            state.midGameScoreBreakdown[p][update.category] += update.points;
        }
    });
}

/**
 * Serve the FIRST update in `updates` as the active animation:
 *  - Apply its mutations (score + meeple removal) immediately so the board reflects the change
 *  - Queue the rest; they will be served one-by-one as each animation resolves
 *  - Increment scoreUpdateKey so App.tsx's useEffect re-fires
 */
function _serveQueue(state: GameState, updates: ScoreUpdate[], endGameMode: boolean) {
    if (updates.length === 0) return false;
    const [first, ...rest] = updates;

    // Apply this update's mutations NOW — meeple disappears, score goes up, when pop-up appears
    _applyUpdate(state, first);

    state.scoreUpdates = [first];
    state.scoreUpdateQueue = rest;
    state.endGameMode = endGameMode;
    state.scoreUpdateKey = (state.scoreUpdateKey || 0) + 1;
    state.turnPhase = 'Score';
    return true;
}

function _startEndGameQueue(state: GameState) {
    // Snapshot mid-game scores for the breakdown bar
    state.players.forEach(p => { state.midGameScores[p] = state.scores[p]; });
    state.endGameScoreBreakdown = {};
    state.players.forEach(p => { state.endGameScoreBreakdown![p] = { city: 0, road: 0, monastery: 0, field: 0 }; });

    // scoreEndGame is PURE — no mutations, just computes the ordered queue
    const queue = scoreEndGame(state);
    if (queue.length === 0) {
        state.turnPhase = 'GameOver';
        return;
    }
    _serveQueue(state, queue, true /* endGameMode */);
}

export function advanceTurn(state: GameState) {
    const playerId = state.players[state.currentPlayerIndex];
    if (state.deck.length > 0 && state.hands[playerId].length < 3) drawTile(state, playerId);

    const totalCardsLeft = Object.values(state.hands).reduce((s, h) => s + h.length, 0) + state.deck.length;
    if (totalCardsLeft === 0) { _startEndGameQueue(state); return; }

    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

    // Check if the NEW current player has ANY playable tiles
    const nextPlayerId = state.players[state.currentPlayerIndex];
    const playerHand = state.hands[nextPlayerId];
    if (playerHand.length > 0) {
        const hasPlayable = playerHand.some(tile => hasAnyValidPlacement(state.board, tile));
        if (!hasPlayable) {
            state.turnPhase = 'DiscardTile';
        } else {
            state.turnPhase = 'PlaceTile';
        }
    } else {
        state.turnPhase = 'PlaceTile';
    }
}

// ─── Public turn functions ────────────────────────────────────────────────────

export function endTurn(state: GameState) {
    const playerId = state.players[state.currentPlayerIndex];
    if (!state.recentTilePosition) return;

    const { x, y } = state.recentTilePosition;

    // 1. Board state AFTER the move was performed (tile placed, meeple optional) but BEFORE scoring.
    const boardAfterMove: Record<string, PlacedTile> = JSON.parse(JSON.stringify(state.board));
    const placedTile = boardAfterMove[`${x},${y}`];

    // 2. Board state BEFORE the move was performed (simulate removal of the recent tile).
    const boardBeforeMove = JSON.parse(JSON.stringify(boardAfterMove));
    delete boardBeforeMove[`${x},${y}`];

    // checkAndScoreFeatures is now PURE — only computes updates, no mutations
    const meeplesBeforeScoring: Record<PlayerId, Record<MeepleType, number>> = JSON.parse(JSON.stringify(state.remainingMeeples));
    const updates = checkAndScoreFeatures(state);

    if (updates.length > 0) {
        // _serveQueue applies the first update's mutations (awards points, removes meeples)
        _serveQueue(state, updates, false /* not end-game */);
    }

    // 3. Current state.board is now "boardAfterScoring" (if updates were served, meeples are gone).

    // If experiment mode is on, capture the evaluation of what just happened
    if (AI_EXPERIMENT_MODE) {
        const didPlaceMeeple = placedTile.meeples.some((m: PlacedMeeple) => m.meeple.playerId === playerId);
        const meepleUsage: Record<PlayerId | 'neutral', number> = { neutral: 0 };
        state.players.forEach(p => {
            let countBefore = meeplesBeforeScoring[p].standard;
            if (p === playerId && didPlaceMeeple) {
                countBefore += 1;
            }
            meepleUsage[p] = evaluateMeepleUsage(countBefore, state.remainingMeeples[p].standard);
        });

        state.lastMoveEvaluation = {
            playerId,
            complete: evaluateGainScoreComplete(boardAfterMove, x, y, placedTile, state.players),
            cityInProgress: evaluateGainScoreCity_InProgress(boardBeforeMove, state.board, x, y, state.players),
            roadInProgress: evaluateGainScoreRoad_InProgress(boardBeforeMove, state.board, x, y, state.players),
            monasteryInProgress: evaluateGainScoreMonastery_InProgress(boardBeforeMove, state.board, x, y, state.players),
            field: evaluateGainScoreField(boardBeforeMove, state.board, x, y, state.players),
            meepleUsage,
            cityAttack: evaluateCityAttack(state.board, playerId, state.players, { x, y }, state.hands[playerId], state.deck),
            roadAttack: evaluateRoadAttack(state.board, playerId, state.players, { x, y }, state.hands[playerId], state.deck),
            fieldAttack: evaluateFieldAttack(state.board, playerId, state.players, { x, y }, state.hands[playerId], state.deck),
            cityOpenEdgeDelta: evaluateCityOpenEdgeDelta(boardBeforeMove, state.board, x, y, state.players)
        };
    }

    if (updates.length > 0) return;

    // Only delay if the NEXT player is an AI
    const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const nextPlayerId = state.players[nextPlayerIndex];
    const isNextAI = state.playerTypes[nextPlayerId] !== 'human';

    if (isNextAI) {
        state.turnPhase = 'WaitingNextTurn';
    } else {
        advanceTurn(state);
    }
}

export function finishScoring(state: GameState) {
    if (state.turnPhase !== 'Score') return;

    // Mutations for the just-resolved pop-up were already applied when it was served.
    state.scoreUpdates = undefined;

    // More items queued? Serve the next one (applies its mutations + increments key → timer re-fires)
    if (state.scoreUpdateQueue && state.scoreUpdateQueue.length > 0) {
        _serveQueue(state, state.scoreUpdateQueue, state.endGameMode);
        return;
    }

    // Queue fully drained
    state.scoreUpdateQueue = undefined;

    if (state.endGameMode) {
        state.endGameMode = false;
        state.turnPhase = 'GameOver';
        return;
    }

    // Mid-game scoring complete → advance turn
    advanceTurn(state);
}
