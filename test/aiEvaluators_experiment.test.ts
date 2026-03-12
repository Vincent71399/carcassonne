import { describe, it, expect } from 'vitest';
import {
    evaluateGainScoreRoad_InProgress,
    evaluateGainScoreMonastery_InProgress,
    evaluateGainScoreComplete,
    evaluateGainScoreCity_InProgress,
    evaluateGainScoreField,
    evaluateCityAttack,
    evaluateRoadAttack as evaluateRoadAttackFn,
    evaluateFieldAttack,
    evaluateReturnedMeeples
} from '../src/engine/aiEvaluators_experiment';
import { TILES_MAP } from '../src/engine/tiles';
import { PlayerId, GameState, PlacedTile } from '../src/engine/types';

describe('AI Evaluators Experiment - Final Suite', () => {
    const p1 = 1 as PlayerId;
    const p2 = 2 as PlayerId;
    const players = [p1, p2];

    const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

    const createManualBoard = (): GameState['board'] => ({});
    const addTile = (board: GameState['board'], x: number, y: number, typeId: string, rotation: number, id: string) => {
        board[`${x},${y}`] = { id, typeId, x, y, rotation, meeples: [] };
    };
    const addMeeple = (board: GameState['board'], x: number, y: number, pid: PlayerId, featureId: string) => {
        board[`${x},${y}`].meeples.push({
            meeple: { id: `m-${pid}-${x}-${y}`, playerId: pid, type: 'standard' },
            featureId
        });
    };

    it('evaluateGainScoreComplete: should return points for completed city', () => {
        const board = createManualBoard();
        addTile(board, 0, 0, 'G', 0, 't1');
        addMeeple(board, 0, 0, p1, 'city-0');
        const simBoard = deepClone(board);
        const simTile = { id: 't2', typeId: 'G', x: 0, y: -1, rotation: 2, meeples: [] };
        simBoard['0,-1'] = simTile;
        const gain = evaluateGainScoreComplete(simBoard, 0, -1, simTile, players);
        expect(gain[p1]).toBe(4);
    });

    it('evaluateGainScoreCity_InProgress: should return positive delta when expanding', () => {
        const board = createManualBoard();
        addTile(board, 0, 0, 'N', 1, 't1');
        addMeeple(board, 0, 0, p1, 'city-0');
        const simBoard = deepClone(board);
        addTile(simBoard, 1, 0, 'G', 3, 't2');
        const delta = evaluateGainScoreCity_InProgress(board, simBoard, 1, 0, players);
        expect(delta[p1]).toBe(1);
    });

    it('evaluateGainScoreRoad_InProgress: should return positive delta when extending road', () => {
        const board = createManualBoard();
        // Tile B: r (Top), f (Right), r (Bottom), f (Left) -> Straight road Top-Bottom
        addTile(board, 0, 0, 'B', 0, 't1');
        addMeeple(board, 0, 0, p1, 'road-0');

        const boardBefore = deepClone(board);
        const boardAfter = deepClone(board);
        addTile(boardAfter, 0, 1, 'B', 0, 't2'); // Extend Bottom

        const delta = evaluateGainScoreRoad_InProgress(boardBefore, boardAfter, 0, 1, players);
        expect(delta[p1]).toBe(1);
    });

    it('evaluateGainScoreMonastery_InProgress: should return delta for surrounding tiles', () => {
        const board = createManualBoard();
        // Tile E: Monastery. featureId 'monastery-0'
        addTile(board, 0, 0, 'E', 0, 't1');
        addMeeple(board, 0, 0, p1, 'monastery-0');

        const boardBefore = deepClone(board);
        const boardAfter = deepClone(board);
        addTile(boardAfter, 1, 0, 'G', 0, 't2');

        const delta = evaluateGainScoreMonastery_InProgress(boardBefore, boardAfter, 0, 0, players);
        expect(delta[p1]).toBe(1);
    });

    it('evaluateGainScoreField: should return 3 pts per completed city', () => {
        const board = createManualBoard();
        addTile(board, 0, 0, 'E', 0, 't1');
        addMeeple(board, 0, 0, p1, 'field-0');
        addTile(board, 0, 1, 'G', 2, 'c1');
        addTile(board, 0, 2, 'G', 0, 'c2');
        const gain = evaluateGainScoreField({}, board, 0, 0, players);
        expect(gain[p1]).toBe(3);
    });

    describe('Attack Logic', () => {
        it('evaluateCityAttack: should detect mutual gain', () => {
            const board = createManualBoard();
            addTile(board, 0, 0, 'G', 1, 'tp2');
            addMeeple(board, 0, 0, p2, 'city-0');
            addTile(board, 2, 0, 'G', 3, 'tp1');
            addMeeple(board, 2, 0, p1, 'city-0');

            // Coord (1,0) is junction connecting City Right 0,0 and City Left 2,0
            const attack = evaluateCityAttack(board, p1, players, { x: 2, y: 0 }, [], [TILES_MAP['R']]);
            expect(attack[p1]).toBeGreaterThan(0);
            expect(attack[p2]).toBeGreaterThan(0);
        });

        it('evaluateRoadAttack: should detect mutual gain for roads', () => {
            const board = createManualBoard();
            // P2 road at (0,0) - Tile B (Top-Bottom). 
            addTile(board, 0, 0, 'B', 0, 'r2');
            addMeeple(board, 0, 0, p2, 'road-0');

            // P1 road at (0,2) - Tile B (Top-Bottom). 
            addTile(board, 0, 2, 'B', 0, 'r1');
            addMeeple(board, 0, 2, p1, 'road-0');

            // Junction (0,1) connects Top of 0,2 and Bottom of 0,0
            const attack = evaluateRoadAttackFn(board, p1, players, { x: 0, y: 2 }, [], [TILES_MAP['B']]);
            expect(attack[p1]).toBeGreaterThan(0);
            expect(attack[p2]).toBeGreaterThan(0);
        });

        it('evaluateFieldAttack: should detect capture and handle overlapping', () => {
            const board = createManualBoard();
            addTile(board, 0, 0, 'E', 0, 'f2');
            addMeeple(board, 0, 0, p2, 'field-0');
            addTile(board, 0, 1, 'G', 2, 'c1');
            addTile(board, 0, 2, 'G', 0, 'c2');

            addTile(board, 2, 0, 'E', 0, 'f1');
            addMeeple(board, 2, 0, p1, 'field-0');
            addMeeple(board, 2, 0, p1, 'field-0');

            const attack = evaluateFieldAttack(board, p1, players, { x: 2, y: 0 }, [], [TILES_MAP['E']]);
            expect(attack[p1]).toBe(3);
            expect(attack[p2]).toBe(-3);
        });

        describe('FieldAttack Refinements', () => {
            const createBaseFieldBoard = (): GameState['board'] => {
                const board: GameState['board'] = {};
                addTile(board, 0, 0, 'A', 0, 't0');
                addMeeple(board, 0, 0, p1, 'field-1');
                addTile(board, 2, 0, 'A', 0, 't1');
                addMeeple(board, 2, 0, p2, 'field-1');
                return board;
            };

            it('should NOT count connectingTile if it cannot be placed due to other neighbors', () => {
                const board = createBaseFieldBoard();
                addTile(board, 1, -1, 'E', 0, 't2');
                const results = evaluateFieldAttack(board, p1, players, { x: 0, y: 0 }, [TILES_MAP['U']], []);
                expect(results[p1]).toBe(0);
            });

            it('should NOT count connectingTile if field remains separated by internal road', () => {
                const board = createBaseFieldBoard();
                const results = evaluateFieldAttack(board, p1, players, { x: 0, y: 0 }, [TILES_MAP['V']], []);
                expect(results[p1]).toBe(0);
            });

            it('should only treat as FieldAttack if control state of cities changes', () => {
                const board = createBaseFieldBoard();
                addTile(board, 0, -1, 'G', 2, 't4');
                addTile(board, 2, -1, 'G', 2, 't5');
                const results = evaluateFieldAttack(board, p1, players, { x: 0, y: 0 }, [TILES_MAP['U']], []);
                expect(results[p1]).toBe(0);
            });

            it('should NOT give attack score if Tile A separates players and no valid merge exists', () => {
                const board: GameState['board'] = {};
                addTile(board, 0, 0, 'G', 1, 't7');
                addMeeple(board, 0, 0, p2, 'field-0');
                addTile(board, 1, 0, 'G', 3, 't_comp');
                addTile(board, 2, 0, 'A', 0, 't8');
                addMeeple(board, 2, 0, p1, 'field-1');

                const results = evaluateFieldAttack(board, p1, players, { x: 2, y: 0 }, [TILES_MAP['B']], []);
                expect(results[p1]).toBe(0);
            });
        });
    });

    describe('One-Sided City Bonus (G-M)', () => {
        it('should apply bonus for player-owned size-1 city on tile G', () => {
            const boardBefore = createManualBoard();
            const boardAfter = deepClone(boardBefore);
            addTile(boardAfter, 1, 0, 'G', 0, 't1');
            addMeeple(boardAfter, 1, 0, p1, 'city-0');

            const delta = evaluateGainScoreCity_InProgress(boardBefore, boardAfter, 1, 0, players);
            expect(delta[p1]).toBe(1.5);
        });

        it('should apply bonus for neutral size-1 city on tile G', () => {
            const boardBefore = createManualBoard();
            const boardAfter = deepClone(boardBefore);
            addTile(boardAfter, 1, 0, 'G', 0, 't1');

            const delta = evaluateGainScoreCity_InProgress(boardBefore, boardAfter, 1, 0, players);
            expect(delta['neutral']).toBe(1.0);
        });
    });

    describe('evaluateReturnedMeeples', () => {
        it('should return 1 when placing a tile completes a road with an existing meeple', () => {
            const board = createManualBoard();
            // Tile F: Monastery with road at Bottom
            addTile(board, 0, 0, 'F', 0, 't1');
            addMeeple(board, 0, 0, p1, 'road-0');

            const simBoard = deepClone(board);
            // Place another tile F to complete the road (rotation 2 means road at Top)
            const simTile: PlacedTile = { id: 't2', typeId: 'F', x: 0, y: 1, rotation: 2, meeples: [] };
            simBoard['0,1'] = simTile;

            const returned = evaluateReturnedMeeples(simBoard, 0, 1, simTile, p1);
            expect(returned).toBe(1);
        });

        it('should return 1 when placing a meeple on a completing road', () => {
            const board = createManualBoard();
            // Tile F: Monastery with road at Bottom
            addTile(board, 0, 0, 'F', 0, 't1');

            const simBoard = { ...board };
            // Place another tile F to complete the road (rotation 2 means road at Top)
            const simTile: PlacedTile = { id: 't2', typeId: 'F', x: 0, y: 1, rotation: 2, meeples: [] };
            simBoard['0,1'] = simTile;
            // Place meeple on the new tile's road
            simTile.meeples.push({ meeple: { id: 'm1', playerId: p1, type: 'standard' }, featureId: 'road-0' });

            const returned = evaluateReturnedMeeples(simBoard, 0, 1, simTile, p1);
            expect(returned).toBe(1);
        });

        it('should return 0 if the feature is not completed', () => {
            const board = createManualBoard();
            addTile(board, 0, 0, 'B', 0, 't1');
            addMeeple(board, 0, 0, p1, 'road-0');

            const simBoard = deepClone(board);
            const simTile = { id: 't2', typeId: 'B', x: 0, y: 1, rotation: 1, meeples: [] }; // Road Left-Right (not connected)
            simBoard['0,1'] = simTile;

            const returned = evaluateReturnedMeeples(simBoard, 0, 1, simTile, p1);
            expect(returned).toBe(0);
        });
    });
});
