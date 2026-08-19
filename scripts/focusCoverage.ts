/**
 * scripts/focusCoverage.ts — [session 50, brief §2] the COVERAGE ceiling
 * table.
 *
 * Coverage is defined as: P(the fish's actual next cell lands inside the 3x3
 * window around the focus you chose that turn). It is the quantity a focus
 * policy actually controls, and it bounds everything downstream:
 *
 *     hit rate = coverage x conversion
 *
 * — the 3x3 window must contain the fish before the played card's zone subset
 * can. Crucially it is scored GEOMETRICALLY against a recorded trajectory:
 * no predictor appears anywhere in the scoring path, so a coverage number
 * cannot be inflated by a leaking matcher (which is the defect that made
 * session 49's focus A/B uninformative).
 *
 * This script computes the HINDSIGHT ceilings — what the best possible focus
 * schedule would have achieved on each recorded cast, at several budgets.
 * They are not achievable by any online policy; they exist to answer one
 * question: is the 3-point focus budget (`FOCUS_METER_MAX`) actually scarce?
 * If a hindsight-optimal schedule at budget 3 already reaches the same
 * coverage as an unlimited budget, then spend QUANTITY is not the binding
 * constraint and every knob that regulates it (`focusReserveWeight`,
 * `costCap`, `threshold`) was tuning the wrong dimension.
 *
 * Scoring unit is the TURN, pooled over clean casts (`isCleanCast`), which is
 * the same corpus and the same filter `fishingRingCV.ts` uses. Every figure
 * is printed with its `n` per SPEC-fishing.md §9.
 *
 * Usage: npx tsx scripts/focusCoverage.ts [path-to-fish-patterns.jsonl]
 */

import { join } from "node:path";

import type { Cell } from "../src/sim/fishing/geometry.js";
import { FOCUS_METER_MAX, allCells, cellKey, manhattan } from "../src/sim/fishing/geometry.js";
import { groupByCast, isCleanCast, loadTransitionRecords, type Cast } from "../src/sim/fishing/transitionCorpus.js";

const DEFAULT_PATH = join("data", "fish-patterns.jsonl");

/** The confirmed pre-move focus point on the 4x4 board (castSim.ts `defaultStartFocus`). */
function startFocus(gridSize: number): Cell {
  const c = Math.ceil(gridSize / 2);
  return { x: c, y: c };
}

/** Coverage is a CHEBYSHEV-1 test: the 3x3 zone template spans exactly the cells at Chebyshev distance <= 1. */
export function covers(focus: Cell, target: Cell): boolean {
  return Math.abs(focus.x - target.x) <= 1 && Math.abs(focus.y - target.y) <= 1;
}

/** The recorded post-move cell for each turn 0..maxTurn of a clean cast. */
export function trajectory(cast: Cast): Cell[] {
  const out: Cell[] = [];
  for (let t = 0; t <= cast.maxTurn; t++) out.push(cast.byTurn.get(t)!);
  return out;
}

/**
 * Hindsight-optimal number of covered turns for one cast under a total move
 * budget, by DP over (turn, focus cell, budget spent). The focus for turn `t`
 * is chosen BEFORE turn `t` resolves, and moving costs Manhattan distance out
 * of a non-regenerating pool (geometry.ts `reachableCells`).
 */
export function bestScheduleCovered(traj: Cell[], gridSize: number, budget: number): number {
  const cells = allCells(gridSize);
  const idx = new Map(cells.map((c, i) => [cellKey(c), i]));
  const NEG = -1;
  // best[cellIdx][spent] = max covered turns so far, or NEG for unreachable state
  let best: number[][] = cells.map(() => new Array<number>(budget + 1).fill(NEG));
  best[idx.get(cellKey(startFocus(gridSize)))!]![0] = 0;

  for (const target of traj) {
    const next: number[][] = cells.map(() => new Array<number>(budget + 1).fill(NEG));
    for (let i = 0; i < cells.length; i++) {
      for (let s = 0; s <= budget; s++) {
        const v = best[i]![s]!;
        if (v === NEG) continue;
        for (let j = 0; j < cells.length; j++) {
          const cost = manhattan(cells[i]!, cells[j]!);
          const s2 = s + cost;
          if (s2 > budget) continue;
          const gain = covers(cells[j]!, target) ? 1 : 0;
          if (v + gain > next[j]![s2]!) next[j]![s2] = v + gain;
        }
      }
    }
    best = next;
  }
  let out = 0;
  for (const row of best) for (const v of row) if (v > out) out = v;
  return out;
}

/** Hindsight-optimal single FIXED placement (one move at turn 0, then never move again) within `budget`. */
export function bestFixedCovered(traj: Cell[], gridSize: number, budget: number): number {
  const from = startFocus(gridSize);
  let out = 0;
  for (const f of allCells(gridSize)) {
    if (manhattan(from, f) > budget) continue;
    let n = 0;
    for (const target of traj) if (covers(f, target)) n++;
    if (n > out) out = n;
  }
  return out;
}

function pct(n: number, d: number): string {
  return d === 0 ? "   n/a" : `${((100 * n) / d).toFixed(1)}%`;
}

function main(): void {
  const path = process.argv[2] ?? DEFAULT_PATH;
  const records = loadTransitionRecords(path);
  const casts = groupByCast(records).filter(isCleanCast);
  const gridSizes = new Set(casts.map((c) => c.gridSize));
  if (gridSizes.size !== 1) throw new Error(`mixed grid sizes in corpus: ${[...gridSizes].join(",")}`);
  const gridSize = [...gridSizes][0]!;

  const trajs = casts.map(trajectory);
  const turns = trajs.reduce((a, t) => a + t.length, 0);

  const rows: { label: string; covered: number }[] = [];

  // frozen at the start focus, budget 0
  let frozen = 0;
  for (const traj of trajs) for (const target of traj) if (covers(startFocus(gridSize), target)) frozen++;
  rows.push({ label: `frozen at (${startFocus(gridSize).x},${startFocus(gridSize).y}), never moves — budget 0`, covered: frozen });

  rows.push({
    label: `best FIXED placement, hindsight, reachable within ${FOCUS_METER_MAX}`,
    covered: trajs.reduce((a, t) => a + bestFixedCovered(t, gridSize, FOCUS_METER_MAX), 0),
  });

  for (const budget of [1, 2, FOCUS_METER_MAX, 6, 12]) {
    rows.push({
      label: `optimal schedule at budget ${budget}, hindsight`,
      covered: trajs.reduce((a, t) => a + bestScheduleCovered(t, gridSize, budget), 0),
    });
  }

  const width = Math.max(...rows.map((r) => r.label.length));
  console.log(`# focus coverage ceilings — ${casts.length} clean casts / ${turns} scored turns (grid ${gridSize}x${gridSize})`);
  console.log(`# coverage = P(fish's actual next cell within Chebyshev 1 of the chosen focus)`);
  console.log("");
  console.log(`| ${"focus policy".padEnd(width)} | coverage | covered/turns |`);
  console.log(`|${"-".repeat(width + 2)}|----------|---------------|`);
  for (const r of rows) {
    console.log(`| ${r.label.padEnd(width)} | ${pct(r.covered, turns).padStart(8)} | ${`${r.covered}/${turns}`.padStart(13)} |`);
  }
  console.log("");
  const cap3 = rows.find((r) => r.label.startsWith(`optimal schedule at budget ${FOCUS_METER_MAX}`))!.covered;
  const capInf = rows.find((r) => r.label.startsWith("optimal schedule at budget 12"))!.covered;
  const gapPp = (100 * (capInf - cap3)) / turns;
  // A ceiling gap of a fraction of one turn per hundred is not scarcity. The
  // threshold is stated rather than implied so a future reader can argue with
  // the number instead of guessing at it: 1pp of pooled coverage is far below
  // the ~30pp gap between doing nothing and hindsight, which is the quantity
  // this table exists to attribute.
  console.log(
    gapPp < 1
      ? `VERDICT: budget ${FOCUS_METER_MAX} is NOT the binding constraint — it reaches ${cap3}/${turns} against the unlimited-budget ceiling's ${capInf}/${turns}, a gap of ${gapPp.toFixed(2)}pp (${capInf - cap3} turn(s)). More budget buys essentially nothing. The lever is PLACEMENT, not spend.`
      : `VERDICT: budget ${FOCUS_METER_MAX} IS scarce — unlimited reaches ${capInf}/${turns} vs budget-${FOCUS_METER_MAX}'s ${cap3}/${turns}, a gap of ${gapPp.toFixed(2)}pp. Spend quantity matters.`,
  );
  const meanTurns = turns / casts.length;
  console.log(`cast length: mean ${meanTurns.toFixed(2)} turns, max ${Math.max(...trajs.map((t) => t.length))}`);
}

main();
