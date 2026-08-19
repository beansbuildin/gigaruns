/**
 * src/strategy/fishing/coverageFocus.ts — [session 50, brief §2] focus
 * placement by EXPECTED COVERAGE instead of this turn's EV.
 *
 * ── Why the objective changes ─────────────────────────────────────────────
 *
 * Define **coverage** = P(the fish's actual next cell lands inside the 3×3
 * zone window around the focus you chose). It is the quantity a focus policy
 * actually controls, and it bounds everything downstream:
 *
 *     hit rate = coverage × conversion
 *
 * — the window must contain the fish before the played card's zone SUBSET
 * can. `scripts/focusCoverage.ts` computes the hindsight ceilings on the real
 * corpus, and at 83 clean casts / 364 scored turns they are:
 *
 *     frozen at (2,2), budget 0 ............................. 61.3%
 *     best FIXED placement, hindsight, reachable within 3 .... 92.3%
 *     optimal schedule at budget 3, hindsight ................ 99.7%
 *     optimal schedule at budget 6 or 12, hindsight ......... 100.0%
 *
 * **The 3-point budget is not scarce.** It is one turn short of a
 * hindsight-perfect schedule and more budget buys 0.27pp. That single table
 * explains three inert results in a row: `focusReserveWeight` (session 48),
 * `costCap` and `threshold` (session 49) all regulate HOW MUCH budget to
 * spend, and how much was never the problem. A policy that spends nothing
 * scores 61.3% and a policy that spends optimally scores 99.7%; the entire
 * ~38pp gap is placement QUALITY.
 *
 * ── What this module does ────────────────────────────────────────────────
 *
 * At each turn, pick the reachable focus `f` maximising
 *
 *     Σ_{h=1..H} P(fish within Chebyshev 1 of f, h turns ahead)
 *
 * forward-simulating the sticky step model (`stepClass.ts`), with
 * `H = min(maxHorizon, expectedRemainingTurns)`, ties broken by the cheaper
 * move. Card choice stays EV-maximising GIVEN that focus — the separation is
 * the point, and it leaves `cardChoice.ts`'s scoring untouched.
 *
 * The forward simulation is exact rather than a repeated one-step call: the
 * sticky model conditions on both the last step COUNT and the previous
 * DISPLACEMENT, so propagating it needs the joint belief over
 * (cell, lastK, prevDelta), not the marginal over cells. At h=1 it reproduces
 * `stickyStepDistribution` exactly, which `tests/fishing/coverageFocus.test.ts`
 * asserts.
 *
 * Pure — no I/O, no network, no card or HP arithmetic (CLAUDE.md's
 * strategy/sim split).
 */

import { allCells, cellKey, inGrid, manhattan, reachableCells, type Cell } from "../../sim/fishing/geometry.js";
import type { Displacement } from "./contextualFallback.js";
import type { FocusBudget } from "./cardChoice.js";
import {
  ringDistribution,
  STEP_CLASSES,
  type Distribution,
  type RingModelOptions,
  type StepClass,
  type StepClassTable,
  DEFAULT_RING_MODEL_OPTIONS,
  DEFAULT_SWITCH_PROBABILITY,
} from "./stepClass.js";

/**
 * How many turns ahead the objective looks. Swept by
 * `scripts/focusCoverageSweep.ts`; see that script's output for the corpus
 * evidence behind the shipped value.
 */
export const DEFAULT_COVERAGE_HORIZON = 3;

/** The 3×3 zone window is exactly the Chebyshev-1 neighbourhood of the focus. */
export function covers(focus: Cell, target: Cell): boolean {
  return Math.abs(focus.x - target.x) <= 1 && Math.abs(focus.y - target.y) <= 1;
}

interface ForwardState {
  cell: Cell;
  lastK: StepClass;
  prevDelta: Displacement;
}

function stateKey(s: ForwardState): string {
  return `${s.cell.x},${s.cell.y}|${s.lastK}|${s.prevDelta.dx},${s.prevDelta.dy}`;
}

/**
 * Marginal distributions over the fish's cell at 1..`horizon` turns ahead,
 * under the sticky step model.
 *
 * `lastK === null` (no hop has resolved yet) splits the belief over both
 * classes by the corpus's own class prior — the same prior
 * `ringDistributionUnknownClass` uses, and for the same reason: before the
 * first hop the honest answer is "unknown", not a guess.
 */
export function forwardCellDistributions(
  currentCell: Cell,
  lastK: StepClass | null,
  prevDelta: Displacement | null,
  table: StepClassTable,
  gridSize: number,
  horizon: number,
  opts: RingModelOptions = DEFAULT_RING_MODEL_OPTIONS,
  switchProbability: number = DEFAULT_SWITCH_PROBABILITY,
): Distribution[] {
  const s = Math.min(Math.max(switchProbability, 0), 1);
  const out: Distribution[] = [];
  if (horizon <= 0) return out;

  // The belief is over (cell, lastK, prevDelta). `prevDelta === null` is
  // represented by seeding the class-conditional rings directly from the
  // class prior with a null conditional — handled by the first expansion.
  let belief = new Map<string, { state: ForwardState | null; w: number }>();
  if (lastK === null) {
    const totals = STEP_CLASSES.map((k) => table.classCasts.get(k) ?? 0);
    const sum = totals.reduce((a, b) => a + b, 0);
    const w1 = sum > 0 ? totals[0]! / sum : 0.5;
    for (const [k, w] of [
      [1 as StepClass, w1],
      [2 as StepClass, 1 - w1],
    ] as const) {
      if (w <= 0) continue;
      const key = `seed|${k}`;
      belief.set(key, { state: { cell: currentCell, lastK: k, prevDelta: prevDelta ?? { dx: 0, dy: 0 } }, w });
    }
  } else {
    belief.set("seed", {
      state: { cell: currentCell, lastK, prevDelta: prevDelta ?? { dx: 0, dy: 0 } },
      w: 1,
    });
  }
  // Whether the seed carries a real previous displacement. On the seed step
  // only, a null `prevDelta` must fall through to the class MARGINAL rather
  // than a fabricated `(0,0)` conditional — that is what `ringDistribution`
  // does when handed `null`.
  let seedPrevDelta: Displacement | null = prevDelta;
  // On the SEED step of an unknown-class cast the switch must not fire: the
  // class prior already IS the marginal over both counts, and applying the
  // chain on top of it would mix the prior with itself reversed. Skipping it
  // here is what makes the h=1 output identical to
  // `ringDistributionUnknownClass`, which the tests assert.
  let seedIsPrior = lastK === null;

  for (let h = 0; h < horizon; h++) {
    const next = new Map<string, { state: ForwardState | null; w: number }>();
    const marginal: Distribution = new Map();
    for (const { state, w } of belief.values()) {
      if (!state) continue;
      const branches: readonly (readonly [StepClass, number])[] =
        h === 0 && seedIsPrior
          ? [[state.lastK, 1] as const]
          : [
              [state.lastK, 1 - s] as const,
              [(state.lastK === 1 ? 2 : 1) as StepClass, s] as const,
            ];
      for (const [k2, pk] of branches) {
        if (pk <= 0) continue;
        const cond = h === 0 ? seedPrevDelta : state.prevDelta;
        const d = ringDistribution(state.cell, k2, cond, table, gridSize, opts);
        for (const { cell, p } of d.values()) {
          const wt = w * pk * p;
          if (wt <= 0) continue;
          const ns: ForwardState = {
            cell,
            lastK: k2,
            prevDelta: { dx: cell.x - state.cell.x, dy: cell.y - state.cell.y },
          };
          const key = stateKey(ns);
          const prev = next.get(key);
          next.set(key, { state: ns, w: (prev?.w ?? 0) + wt });
          const mk = cellKey(cell);
          const pm = marginal.get(mk);
          marginal.set(mk, { cell, p: (pm?.p ?? 0) + wt });
        }
      }
    }
    out.push(marginal);
    belief = next;
    seedPrevDelta = null;
    seedIsPrior = false;
    if (belief.size === 0) break;
  }
  return out;
}

/**
 * Expected number of covered turns over the forward horizon — the objective.
 * Deliberately a SUM, not a mean: a placement that covers two of the next
 * three turns is worth twice one that covers one of them, and normalizing by
 * the horizon would only rescale every candidate identically anyway.
 */
export function expectedCoverage(focus: Cell, forward: readonly Distribution[]): number {
  let total = 0;
  for (const dist of forward) {
    for (const { cell, p } of dist.values()) if (covers(focus, cell)) total += p;
  }
  return total;
}

export interface CoverageFocusChoice {
  focus: Cell;
  /** Expected covered turns over the horizon, at `focus`. */
  coverage: number;
  /** Manhattan points this placement costs off the meter. */
  moveCost: number;
  /** How many turns ahead the objective actually looked. */
  horizon: number;
}

const COVERAGE_TIE_EPSILON = 1e-9;

/**
 * The reachable placement maximising expected coverage, ties broken by the
 * cheaper move and then by a fixed cell order so the choice is deterministic.
 *
 * Staying put is always in the search space (`reachableCells` includes
 * distance 0), so this can never empty it — the same invariant
 * `focusBudget.ts`'s constraints hold.
 */
export function chooseCoverageFocus(
  focusBudget: FocusBudget | undefined,
  gridSize: number,
  forward: readonly Distribution[],
): CoverageFocusChoice {
  const searchSpace = focusBudget
    ? reachableCells(gridSize, focusBudget.current, focusBudget.remaining)
    : allCells(gridSize);
  let best: CoverageFocusChoice | null = null;
  for (const focus of searchSpace) {
    if (!inGrid(focus, gridSize)) continue;
    const coverage = expectedCoverage(focus, forward);
    const moveCost = focusBudget ? manhattan(focusBudget.current, focus) : 0;
    const candidate: CoverageFocusChoice = { focus, coverage, moveCost, horizon: forward.length };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.coverage > best.coverage + COVERAGE_TIE_EPSILON) {
      best = candidate;
      continue;
    }
    if (Math.abs(candidate.coverage - best.coverage) <= COVERAGE_TIE_EPSILON) {
      if (candidate.moveCost < best.moveCost) best = candidate;
      else if (
        candidate.moveCost === best.moveCost &&
        (candidate.focus.x < best.focus.x || (candidate.focus.x === best.focus.x && candidate.focus.y < best.focus.y))
      ) {
        best = candidate;
      }
    }
  }
  // `reachableCells` always contains the current focus, so `best` is never
  // null for a real board; the fallback exists so a degenerate gridSize
  // cannot throw inside live play.
  return best ?? { focus: focusBudget?.current ?? { x: 1, y: 1 }, coverage: 0, moveCost: 0, horizon: forward.length };
}

/**
 * How far ahead to look: the horizon cap, clamped by how many turns the cast
 * plausibly still has. Reuses `focusBudget.ts`'s `expectedRemainingTurns`
 * rather than inventing a second estimator — two places in the strategy layer
 * asking "how long until this fish is caught?" should not answer it two
 * different ways.
 */
export function coverageHorizon(maxHorizon: number, expectedRemaining: number): number {
  return Math.max(1, Math.min(maxHorizon, expectedRemaining));
}
