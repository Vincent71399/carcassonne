import { createInitialState, placeTile, placeMeeple, skipMeeple, finishScoring, advanceTurn } from './state';
import { calculateBestAIMove } from './ai';
import type { PlayerType } from './types';

async function runMatch(types: Record<number, PlayerType>, names: Record<number, string>) {
    const state = createInitialState(names, types);

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
            (state as any).pendingMeepleMove = move.meeplePlacement;
        } else if (state.turnPhase === 'PlaceMeeple') {
            const meepleMove = (state as any).pendingMeepleMove;
            if (meepleMove) {
                placeMeeple(state, currentPlayer, meepleMove.featureId);
            } else {
                skipMeeple(state, currentPlayer);
            }
            (state as any).pendingMeepleMove = null;
        } else if (state.turnPhase === 'WaitingNextTurn') {
            advanceTurn(state);
        } else if (state.endGameMode) {
            while (state.turnPhase === 'Score') {
                finishScoring(state);
            }
        }
    }

    return state;
}

async function runTournament() {
    console.log("Starting 2-Player AI Tournament (10 games each match-up)...");

    const matchups = [
        { name: "Computer vs Computer", types: { 1: 'ai-easy', 2: 'ai-easy' } as Record<number, PlayerType> },
    ];

    const MATCHES_PER_PAIR = 10;

    for (const matchup of matchups) {
        console.log(`\n======================================================`);
        console.log(`--- Playing ${matchup.name} (${MATCHES_PER_PAIR} matches) ---`);
        const wins: Record<number, number> = {};
        for (const p of Object.keys(matchup.types)) wins[Number(p)] = 0;
        let ties = 0;

        for (let i = 0; i < MATCHES_PER_PAIR; i++) {
            const names: Record<number, string> = {};
            for (const p of Object.keys(matchup.types)) {
                names[Number(p)] = `P${p} (Computer)`;
            }

            const finalState = await runMatch(matchup.types as Record<number, PlayerType>, names);

            const scores = Object.keys(matchup.types).map(p => ({ p: Number(p), score: finalState.scores[Number(p)] || 0 }));
            scores.sort((a, b) => b.score - a.score);

            const topScore = scores[0].score;
            const winners = scores.filter(s => s.score === topScore);

            let resultStr = "";
            if (winners.length === 1) {
                wins[winners[0].p]++;
                resultStr = `${names[winners[0].p]} wins!`;
            } else {
                ties++;
                resultStr = `Tie!`;
            }

            const scoreStrs = Object.keys(matchup.types).map(p => `${names[Number(p)]}: ${finalState.scores[Number(p)] || 0}`);
            console.log(`Match ${String(i + 1).padStart(2, ' ')} | ${scoreStrs.join(' vs ')} | ${resultStr}`);
        }

        const winStrs = Object.keys(wins).map(p => `P${p} (Computer) won ${wins[Number(p)]}`);
        console.log(`\n[RESULT] ${matchup.name}: ${winStrs.join(', ')}, Ties: ${ties}`);
        console.log(`======================================================`);
    }
}

runTournament().catch(console.error);
