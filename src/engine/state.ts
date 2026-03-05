import type { GameState, TileDefinition, PlayerId, PlayerType, MeepleType, ScoreUpdate } from './types';
import { generateDeck } from './tiles';
import { isValidPlacement } from './board';
import { checkAndScoreFeatures, scoreEndGame } from './scoring';

export function createInitialState(
    playerNames: Record<PlayerId, string>,
    playerTypes: Record<PlayerId, PlayerType>
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
        state.remainingMeeples[p] = { standard: 7, large: 1, builder: 1, pig: 1, abbott: 1 };
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
    endTurn(state, playerId);
    return true;
}

export function skipMeeple(state: GameState, playerId: PlayerId): boolean {
    if (playerId !== state.players[state.currentPlayerIndex]) return false;
    if (state.turnPhase !== 'PlaceMeeple') return false;
    endTurn(state, playerId);
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

function _advanceTurn(state: GameState) {
    const playerId = state.players[state.currentPlayerIndex];
    if (state.deck.length > 0 && state.hands[playerId].length < 3) drawTile(state, playerId);

    const totalCardsLeft = Object.values(state.hands).reduce((s, h) => s + h.length, 0) + state.deck.length;
    if (totalCardsLeft === 0) { _startEndGameQueue(state); return; }

    state.turnPhase = 'PlaceTile';
    state.recentTilePosition = null;
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
}

// ─── Public turn functions ────────────────────────────────────────────────────

export function endTurn(state: GameState, _playerId: PlayerId) {
    // checkAndScoreFeatures is now PURE — only computes updates, no mutations
    const updates = checkAndScoreFeatures(state);

    if (updates.length > 0) {
        // _serveQueue applies the first update's mutations and queues the rest
        _serveQueue(state, updates, false /* not end-game */);
        return;
    }

    _advanceTurn(state);
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
    _advanceTurn(state);
}
