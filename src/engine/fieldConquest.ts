import type { GameState, PlayerId, TileDefinition, EdgeDirection } from './types';
import { evaluateFeature } from './features';
import { TILES_MAP } from './tiles';

const EDGE_POSITIONS: Record<EdgeDirection, { x1: number; y1: number; x2: number; y2: number; cx: number; cy: number }> = {
    top: { x1: 0, y1: 0, x2: 100, y2: 0, cx: 50, cy: 0 },
    right: { x1: 100, y1: 0, x2: 100, y2: 100, cx: 100, cy: 50 },
    bottom: { x1: 100, y1: 100, x2: 0, y2: 100, cx: 50, cy: 100 },
    left: { x1: 0, y1: 100, x2: 0, y2: 0, cx: 0, cy: 50 },
};

// ─── Field conquest computation ──────────────────────────────────────────────

export function computeFieldConquest(
    state: GameState
): Map<string, PlayerId[]> {
    const result = new Map<string, PlayerId[]>();
    const processedFields = new Set<string>();

    for (const tileKey of Object.keys(state.board)) {
        const tile = state.board[tileKey];
        const def = TILES_MAP[tile.typeId];
        if (!def?.fieldConnections) continue;

        def.fieldConnections.forEach((_, fIdx) => {
            const ev = evaluateFeature(state.board, tile.x, tile.y, 'field', fIdx);
            const fieldKey = ev.components
                .map(c => `${c.tileX},${c.tileY},${c.featureId}`)
                .sort()
                .join('|');

            if (processedFields.has(fieldKey)) return;
            processedFields.add(fieldKey);

            const farmerCounts: Record<number, number> = {};
            ev.components.forEach(comp => {
                const t = state.board[`${comp.tileX},${comp.tileY}`];
                if (!t) return;
                t.meeples
                    .filter(m => m.featureId === comp.featureId)
                    .forEach(m => {
                        const w = m.meeple.type === 'large' ? 2 : 1;
                        farmerCounts[m.meeple.playerId] = (farmerCounts[m.meeple.playerId] || 0) + w;
                    });
            });

            const players = Object.keys(farmerCounts).map(Number) as PlayerId[];
            if (players.length === 0) return;

            const max = Math.max(...players.map(p => farmerCounts[p]));
            const winners = players.filter(p => farmerCounts[p] === max);

            ev.components.forEach(comp => {
                const localFieldIdx = parseInt(comp.featureId.split('-')[1], 10);
                result.set(`${comp.tileX},${comp.tileY},${localFieldIdx}`, winners);
            });
        });
    }

    return result;
}

// ─── SVG mask helpers ─────────────────────────────────────────────────────────
// These replicate TileRenderer's rendering logic as plain SVG path strings so
// we can generate a mask that excludes city/road/monastery regions from the
// field-stripe overlay.

/** Returns SVG path strings for every city region on the tile (same shapes as TileRenderer). */
export function getCityMaskPaths(def: TileDefinition): string[] {
    if (!def.cityConnections) return [];
    return def.cityConnections.flatMap(conn => {
        const len = conn.length;
        if (len === 0) return [];

        if (len === 1) {
            const pos = EDGE_POSITIONS[conn[0] as EdgeDirection];
            return [`M ${pos.x1} ${pos.y1} Q 50 50 ${pos.x2} ${pos.y2} Z`];
        }

        if (len >= 4) return ['M 0 0 L 100 0 L 100 100 L 0 100 Z'];

        if (len === 2) {
            const hasTop = conn.includes('top'), hasBottom = conn.includes('bottom');
            const hasLeft = conn.includes('left'), hasRight = conn.includes('right');
            if ((hasTop && hasBottom) || (hasLeft && hasRight)) {
                if (hasTop) return ['M 0 0 L 100 0 Q 30 50 100 100 L 0 100 Q 70 50 0 0 Z'];
                return ['M 0 0 L 0 100 Q 50 30 100 100 L 100 0 Q 50 70 0 0 Z'];
            }
            // Adjacent two edges
            const pts = conn.map(d => EDGE_POSITIONS[d as EdgeDirection]);
            return [`M ${pts[0].x1} ${pts[0].y1} L ${pts[0].x2} ${pts[0].y2} L ${pts[1].x1} ${pts[1].y1} L ${pts[1].x2} ${pts[1].y2} Z`];
        }

        // 3 edges
        const allEdges: EdgeDirection[] = ['top', 'right', 'bottom', 'left'];
        const missing = allEdges.find(e => !conn.includes(e));
        if (missing === 'bottom') return ['M 0 100 L 0 0 L 100 0 L 100 100 Q 50 50 0 100 Z'];
        if (missing === 'left') return ['M 0 0 L 100 0 L 100 100 L 0 100 Q 50 50 0 0 Z'];
        if (missing === 'top') return ['M 100 0 L 100 100 L 0 100 L 0 0 Q 50 50 100 0 Z'];
        if (missing === 'right') return ['M 100 100 L 0 100 L 0 0 L 100 0 Q 50 50 100 100 Z'];
        return [];
    });
}

/** Returns SVG path `d` strings for each road centre-line (to be stroked wide as a mask). */
export function getRoadMaskPaths(def: TileDefinition): string[] {
    if (!def.roadConnections) return [];
    return def.roadConnections.flatMap(conn => {
        if (conn.length === 2) {
            const p1 = EDGE_POSITIONS[conn[0] as EdgeDirection];
            const p2 = EDGE_POSITIONS[conn[1] as EdgeDirection];
            return [`M ${p1.cx} ${p1.cy} Q 50 50 ${p2.cx} ${p2.cy}`];
        }
        if (conn.length === 1) {
            const p1 = EDGE_POSITIONS[conn[0] as EdgeDirection];
            return [`M ${p1.cx} ${p1.cy} L 50 50`];
        }
        return [];
    });
}

// ─── Field zone polygon ───────────────────────────────────────────────────────

/**
 * Converts a field's edge-connection list to an approximate SVG polygon that
 * covers the field region.  Uses the centroid of the edge-segment midpoints as
 * the interior anchor (not the tile centre 50,50 which may lie on a road).
 *
 * The polygon is intentionally GENEROUS — it may overlap roads/cities slightly.
 * The SVG mask in Board.tsx clips those away precisely.
 */
export function fieldEdgesToPolygon(
    edges: readonly string[],
    S: number
): string {
    const a = S / 3;
    const b = (2 * S) / 3;

    // Boundary endpoints and midpoints for each segment
    const segData: Record<string, { p1: [number, number]; p2: [number, number]; mid: [number, number] }> = {
        'top-0': { p1: [0, 0], p2: [a, 0], mid: [a / 2, 0] },
        'top-1': { p1: [a, 0], p2: [b, 0], mid: [S / 2, 0] },
        'top-2': { p1: [b, 0], p2: [S, 0], mid: [(b + S) / 2, 0] },
        'right-0': { p1: [S, 0], p2: [S, a], mid: [S, a / 2] },
        'right-1': { p1: [S, a], p2: [S, b], mid: [S, S / 2] },
        'right-2': { p1: [S, b], p2: [S, S], mid: [S, (b + S) / 2] },
        'bottom-0': { p1: [S, S], p2: [b, S], mid: [(S + b) / 2, S] },
        'bottom-1': { p1: [b, S], p2: [a, S], mid: [S / 2, S] },
        'bottom-2': { p1: [a, S], p2: [0, S], mid: [a / 2, S] },
        'left-0': { p1: [0, S], p2: [0, b], mid: [0, (S + b) / 2] },
        'left-1': { p1: [0, b], p2: [0, a], mid: [0, S / 2] },
        'left-2': { p1: [0, a], p2: [0, 0], mid: [0, a / 2] },
    };

    const perimeterPts: [number, number][] = [];
    const mids: [number, number][] = [];

    for (const edge of edges) {
        const seg = segData[edge];
        if (!seg) continue;
        mids.push(seg.mid);
        [seg.p1, seg.p2].forEach(p => {
            if (!perimeterPts.some(q => q[0] === p[0] && q[1] === p[1])) {
                perimeterPts.push(p);
            }
        });
    }

    if (perimeterPts.length === 0) return '';

    // Interior anchor: centroid of edge midpoints — this stays inside the field region
    const cx = mids.reduce((s, m) => s + m[0], 0) / mids.length;
    const cy = mids.reduce((s, m) => s + m[1], 0) / mids.length;
    perimeterPts.push([cx, cy]);

    // Sort by angle around centroid of ALL collected points to produce a convex polygon
    const allCx = perimeterPts.reduce((s, p) => s + p[0], 0) / perimeterPts.length;
    const allCy = perimeterPts.reduce((s, p) => s + p[1], 0) / perimeterPts.length;
    perimeterPts.sort((p, q) => {
        const ap = Math.atan2(p[1] - allCy, p[0] - allCx);
        const aq = Math.atan2(q[1] - allCy, q[0] - allCx);
        return ap - aq;
    });

    return perimeterPts.map(([x, y]) => `${x},${y}`).join(' ');
}
