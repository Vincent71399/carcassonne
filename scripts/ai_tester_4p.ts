import { createInitialState, placeTile, discardTile, placeMeeple, skipMeeple, finishScoring, advanceTurn } from '../src/engine/state';
import { calculateBestAIMove } from '../src/engine/ai';
import type { PlayerType, GameState, MeepleType } from '../src/engine/types';

const ENABLE_LARGER_MEEPLE = true;

interface LocalTestState extends GameState {
    pendingMeepleMove?: { featureId: string; meepleType: MeepleType } | null;
}

async function runMatch(types: Record<number, PlayerType>, names: Record<number, string>) {
    const state = createInitialState(names, types, ENABLE_LARGER_MEEPLE);

    let moveCount = 0;
    while (state.turnPhase !== 'GameOver' && moveCount < 1000) {
        moveCount++;

        // Drain any pending score popups
        while (state.turnPhase === 'Score') {
            finishScoring(state);
        }

        if (state.turnPhase as string === 'GameOver') break;

        const currentPlayer = state.players[state.currentPlayerIndex];

        if (state.turnPhase === 'PlaceTile') {
            const move = calculateBestAIMove(state, currentPlayer);
            if (!move) {
                // Unplayable tile! Discard it and advance turn.
                state.hands[currentPlayer].shift();
                if (state.deck.length > 0) {
                    state.hands[currentPlayer].push(state.deck.shift()!);
                }
                state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
                continue;
            }
            placeTile(state, currentPlayer, move.handIndex, move.tilePlacement.x, move.tilePlacement.y, move.tilePlacement.rotation);
            // Remember meeple move for next phase
            (state as LocalTestState).pendingMeepleMove = move.meeplePlacement;
        } else if (state.turnPhase === 'PlaceMeeple') {
            const meepleMove = (state as LocalTestState).pendingMeepleMove;
            if (meepleMove) {
                placeMeeple(state, currentPlayer, meepleMove.featureId, meepleMove.meepleType);
            } else {
                skipMeeple(state, currentPlayer);
            }
            (state as LocalTestState).pendingMeepleMove = null;
        } else if (state.turnPhase === 'DiscardTile') {
            discardTile(state, currentPlayer, 0);
        } else if (state.turnPhase === 'WaitingNextTurn') {
            advanceTurn(state);
        }
    }

    return state;
}

async function runTournament(p1Type: PlayerType = 'ai-noob', p2Type: PlayerType = 'ai-easy', p3Type: PlayerType = 'ai-noob', p4Type: PlayerType = 'ai-medium') {
    console.log("Starting AI Tournament...");

    const matchups = [
        { name: `4-Player Tournament: ${p1Type} vs ${p2Type} vs ${p3Type} vs ${p4Type}`, types: { 1: p1Type, 2: p2Type, 3: p3Type, 4: p4Type } as Record<number, PlayerType> }
    ];

    const MATCHES_PER_PAIR = 10;

    for (const matchup of matchups) {
        console.log(`\n--- Playing ${matchup.name} (${MATCHES_PER_PAIR} matches) ---`);
        const wins: Record<number, number> = {};
        for (const p of Object.keys(matchup.types)) wins[Number(p)] = 0;
        let ties = 0;

        for (let i = 0; i < MATCHES_PER_PAIR; i++) {
            const names: Record<number, string> = {};
            for (const p of Object.keys(matchup.types)) {
                names[Number(p)] = `P${p} (${matchup.types[Number(p)]})`;
            }

            const finalState = await runMatch(matchup.types, names);

            const scores = Object.keys(matchup.types).map(p => ({ p: Number(p), score: finalState.scores[Number(p)] || 0 }));
            scores.sort((a, b) => b.score - a.score);

            const topScore = scores[0].score;
            const winners = scores.filter(s => s.score === topScore);

            if (winners.length === 1) {
                wins[winners[0].p]++;
            } else {
                ties++;
            }

            const scoreStrs = Object.keys(matchup.types).map(p => `${names[Number(p)]} scored ${finalState.scores[Number(p)] || 0}`);
            console.log(`Match ${i + 1}: ${scoreStrs.join(' | ')}`);
        }

        const winStrs = Object.keys(wins).map(p => `P${p} wins ${wins[Number(p)]}`);
        console.log(`Result for ${matchup.name}: ${winStrs.join(', ')}, Ties ${ties}`);
    }
}

runTournament().catch(console.error);
