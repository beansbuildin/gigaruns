/**
 * src/sim/fishing/geometry.ts — the confirmed Dendren board geometry.
 *
 * Zones are a fixed 3×3 template, row-major, numbered 1–9, centred on the
 * submitted `focusPoint`. A card's hit/crit zones translate through this
 * template to absolute cells; a zone that lands off-grid is simply
 * unreachable that turn, not clamped.
 *
 * **[CORRECTED session 47 — `ZONE_OFFSET` was TRANSPOSED, and had been since
 * session 05.]** The original table was derived from
 * `fixtures/fishing-casts/cast.json`, whose cards happen to be
 * transpose-symmetric, so it fit the one capture it was checked against and
 * was marked CONFIRMED on that basis. Against the full 282-play corpus it
 * predicts the recorded hit/miss outcome on **228 of 282** plays; the
 * transposed table predicts **282 of 282, exceptionless**
 * (`scripts/auditZoneTemplate.ts`).
 *
 * The cause, confirmed independently of the outcome fit: **`Cell.x` is the
 * ROW and `Cell.y` is the COLUMN**, because `position[0]` is the row.
 * `doc.data.lastMovePath` carries 1-based cell INDICES, and across the whole
 * corpus `index === (position[0] - 1) * gridSize + position[1]` holds
 * **289/289** — row-major over `position`, which only works if `position[0]`
 * indexes the row. The zone template is numbered row-major too, so zone 2 is
 * (row − 1, col) = `[-1, 0]` in this file's `(x, y)` naming, NOT the `[0, -1]`
 * the old table had. Two independent lines of evidence, same conclusion.
 *
 * This was a live-only defect. The sim used this table on BOTH sides — to
 * place the policy's focus and to resolve the shot — so it stayed internally
 * consistent and its numbers never flinched; the live server resolves with
 * the true map while the policy aimed with the transposed one. That is a
 * systematic aiming error on every card whose zone set is not
 * transpose-symmetric, and it is the most likely single cause of the
 * long-standing live-vs-sim hit-rate gap (live 7/69 = 10.1% all-time).
 *
 * Everything else here remains [CONFIRMED] as before — see SPEC.md §5 and
 * SPEC-fishing.md §4.
 */

export interface Cell {
  x: number;
  y: number;
}

/**
 * zone (1-9) -> (dx, dy) offset from the focus point. Row-major, 3x3, where
 * `x` is the ROW and `y` is the COLUMN (see this file's header). Equivalent
 * closed form: `dx = floor((z - 1) / 3) - 1`, `dy = ((z - 1) % 3) - 1`.
 */
const ZONE_OFFSET: Record<number, readonly [number, number]> = {
  1: [-1, -1],
  2: [-1, 0],
  3: [-1, 1],
  4: [0, -1],
  5: [0, 0],
  6: [0, 1],
  7: [1, -1],
  8: [1, 0],
  9: [1, 1],
};

export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function inGrid(c: Cell, gridSize: number): boolean {
  return c.x >= 1 && c.x <= gridSize && c.y >= 1 && c.y <= gridSize;
}

/** Translate one zone (1-9) through the focus point. Null if off-grid. */
export function zoneToCell(focus: Cell, zone: number, gridSize: number): Cell | null {
  const offset = ZONE_OFFSET[zone];
  if (!offset) throw new Error(`unknown fishing zone ${zone} — not in the confirmed 1-9 template`);
  const c = { x: focus.x + offset[0], y: focus.y + offset[1] };
  return inGrid(c, gridSize) ? c : null;
}

/** Translate a card's zone list through a focus point, dropping off-grid cells. */
export function zonesToCells(focus: Cell, zones: readonly number[], gridSize: number): Cell[] {
  const out: Cell[] = [];
  for (const z of zones) {
    const c = zoneToCell(focus, z, gridSize);
    if (c) out.push(c);
  }
  return out;
}

export function allCells(gridSize: number): Cell[] {
  const out: Cell[] = [];
  for (let x = 1; x <= gridSize; x++) {
    for (let y = 1; y <= gridSize; y++) out.push({ x, y });
  }
  return out;
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Every grid cell reachable from `current` without exceeding `maxDistance`
 * of `focusMeter` — **[CONFIRMED 2026-08-15, session 13, live]**: moving the
 * focus point costs its Manhattan distance from the current focus, out of a
 * budget that never regenerated within the one cast observed. Four clean
 * data points, no counterexample: (2,2)→(2,2) dist 0, meter 3→3;
 * (2,2)→(1,2) dist 1, meter 3→2; (1,2)→(1,1) dist 1, meter 2→1;
 * (1,1)→(2,2) dist 2 with only 1 meter left — REJECTED (HTTP 400) by the
 * live server, confirming the cap rather than just the cost. See
 * SPEC-fishing.md §4.
 */
export function reachableCells(gridSize: number, current: Cell, maxDistance: number): Cell[] {
  return allCells(gridSize).filter((c) => manhattan(c, current) <= maxDistance);
}

/**
 * **[MODELLED session 14, MOVED here session 45]** The focus-movement
 * budget's size: 3 points per cast, non-regenerating (see `reachableCells`
 * above for the four confirmed live data points on the spend rule).
 *
 * Lived in `src/sim/fishing/castSim.ts` until session 45, which needed it in
 * `src/strategy/fishing/cardChoice.ts` to normalize the focus-reserve term.
 * `geometry.ts` is already the shared dependency of both the sim and the
 * strategy modules (and already documents this mechanic), so the constant
 * moved here rather than being duplicated or having strategy import from the
 * simulator — which CLAUDE.md's working-style split forbids. `castSim.ts`
 * re-exports it, so every existing import site is unchanged.
 */
export const FOCUS_METER_MAX = 3;
