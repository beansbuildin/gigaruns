/**
 * src/sim/fishing/geometry.ts — the confirmed Dendren board geometry.
 *
 * Everything here is [CONFIRMED] against the one real captured cast
 * (`fixtures/fishing-casts/cast.json`) — see SPEC.md §5 and
 * SPEC-fishing.md §4 for the derivation. Zones are a fixed 3×3 template,
 * row-major, numbered 1–9, centred on the submitted `focusPoint`. A card's
 * hit/crit zones translate through this template to absolute cells; a zone
 * that lands off-grid is simply unreachable that turn, not clamped.
 */

export interface Cell {
  x: number;
  y: number;
}

/** zone (1-9) -> (dx, dy) offset from the focus point. Row-major, 3x3. */
const ZONE_OFFSET: Record<number, readonly [number, number]> = {
  1: [-1, -1],
  2: [0, -1],
  3: [1, -1],
  4: [-1, 0],
  5: [0, 0],
  6: [1, 0],
  7: [-1, 1],
  8: [0, 1],
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
