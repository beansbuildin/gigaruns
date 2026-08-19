/**
 * src/strategy/fishing/stepClass.ts — [session 45] the STEP-CLASS RING model
 * of fish movement, replacing the class-blind empirical fallback tiers as
 * the primary predictor.
 *
 * Established against the real corpus by `scripts/auditStepClass.ts` (run it
 * again as the corpus grows — that is what it is committed for). On the 66
 * clean casts / 259 transitions of `data/fish-patterns.jsonl`:
 *
 *   FACT 1 (exceptionless, 259/259): every move of a cast lands on the
 *   Manhattan-`k` ring around the fish's CURRENT cell, and `k` is fixed for
 *   the whole cast — 64/64 multi-move clean casts have a constant `k`, and
 *   0 moves land off the legal in-grid `k`-ring. Only k=1 (35 casts, 144
 *   transitions) and k=2 (31 casts, 115 transitions) are ever observed.
 *   The single non-clean cast (`12923189`, a duplicate-turn-0 record — the
 *   session-29 CODEXREVIEW #5 artifact, not fish behavior) is the ONLY
 *   source of apparent counterexamples in the raw log, and it is excluded
 *   by `isCleanCast` everywhere this project analyses trajectories.
 *
 *   FACT 2: within a class the next move is strongly conditioned on the
 *   previous one, in OPPOSITE directions for the two classes —
 *     k=1: P(repeat prev delta) 28.4%, P(exact reversal) **0.0%, 0 of 109**
 *     k=2: P(repeat prev delta)  3.6%, P(exact reversal) **41.7%, 35 of 84**
 *   A 1-step fish never backtracks; a 2-step fish backtracks more than it
 *   does anything else. Both are large; neither was visible to the
 *   class-blind predictors that preceded this module.
 *
 * The class is a HARD CONSTRAINT, not a prior: once `k` is known, every cell
 * off the `k`-ring gets probability zero. 259/259 is what licenses that.
 * Before the first hop resolves, the two rings are mixed by the observed
 * class prior.
 *
 * Pure — no I/O, no network, per CLAUDE.md's strategy/API split. Loading the
 * corpus and calling this stays the caller's job (`scripts/liveFishing.ts`,
 * `scripts/fishingRingCV.ts`, `src/sim/fishing/castSim.ts`).
 *
 * Smoothing deliberately reuses `contextualFallback.ts`'s continuous
 * `n / (n + shrinkageK)` shrinkage rather than inventing a second mechanism
 * (session-45 brief §1 design note 2, and the same reasoning that retired
 * `DEFAULT_MIN_INDEPENDENT_CASTS` in session 38): a hard threshold assigns
 * exactly zero to everything outside a thin sample the instant it clears,
 * and `chooseCard` consumes the whole distribution, not just its top-1.
 */

import type { Cell } from "../../sim/fishing/geometry.js";
import { cellKey, inGrid } from "../../sim/fishing/geometry.js";
import type { Cast } from "../../sim/fishing/transitionCorpus.js";
import { castHops, type Displacement } from "./contextualFallback.js";
import { mixDistributions } from "./matcher.js";

/** The two step classes ever observed in the real corpus. See FACT 1. */
export type StepClass = 1 | 2;

export const STEP_CLASSES: readonly StepClass[] = [1, 2];

export type Distribution = Map<string, { cell: Cell; p: number }>;

function deltaKey(d: Displacement): string {
  return `${d.dx},${d.dy}`;
}

function parseDeltaKey(k: string): Displacement {
  const [dx, dy] = k.split(",").map(Number);
  return { dx: dx!, dy: dy! };
}

function stepLen(from: Cell, to: Cell): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

/**
 * Every in-grid cell at exactly Manhattan distance `k` from `cell`. Not to
 * be confused with `geometry.ts`'s `reachableCells`, which is the FOCUS
 * point's movement budget (distance <= max) — this is the FISH's next-cell
 * support (distance === k, exactly).
 */
export function ringCells(cell: Cell, k: number, gridSize: number): Cell[] {
  const out: Cell[] = [];
  for (let dx = -k; dx <= k; dx++) {
    const rem = k - Math.abs(dx);
    const dys = rem === 0 ? [0] : [-rem, rem];
    for (const dy of dys) {
      const c = { x: cell.x + dx, y: cell.y + dy };
      if (inGrid(c, gridSize)) out.push(c);
    }
  }
  return out;
}

/**
 * The cast's step class, read off its own observed movement so far.
 *
 * `history` is a position history in `MatcherState.history` shape (the cells
 * the fish has occupied, oldest first), so `classifyStep` is callable
 * mid-cast from exactly the state live code already carries.
 *
 * Returns `null` before any nonzero hop has been observed — turn 1 of a cast
 * is an IDENTIFICATION turn and the honest answer is "unknown", not a guess.
 * Callers mix the two rings by the class prior in that case
 * (`ringDistributionUnknownClass`).
 *
 * FACT 1 says `k` is constant, so the first nonzero hop already settles it;
 * the mode is used rather than the first hop purely so a single anomalous
 * record (the kind `isCleanCast` exists to catch) cannot pin the whole cast
 * to a wrong class. With FACT 1 holding these are the same answer.
 */
export function classifyStep(history: readonly Cell[]): StepClass | null {
  const counts = new Map<StepClass, number>();
  const firstSeen = new Map<StepClass, number>();
  for (let i = 1; i < history.length; i++) {
    const len = stepLen(history[i - 1]!, history[i]!);
    if (len !== 1 && len !== 2) continue; // 0 = no move; >2 never observed
    const k = len as StepClass;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (!firstSeen.has(k)) firstSeen.set(k, i);
  }
  if (counts.size === 0) return null;
  let best: StepClass | null = null;
  for (const k of STEP_CLASSES) {
    const c = counts.get(k) ?? 0;
    if (c === 0) continue;
    if (best === null) {
      best = k;
      continue;
    }
    const bc = counts.get(best)!;
    if (c > bc || (c === bc && firstSeen.get(k)! < firstSeen.get(best)!)) best = k;
  }
  return best;
}

// ── the corpus table ──────────────────────────────────────────────────────

export interface DeltaStats {
  /** delta key -> raw observation count. */
  counts: Map<string, number>;
  /** Distinct casts contributing here — the gating unit for shrinkage, never raw transition count (one cast cycling must not look like independent evidence). */
  castIds: Set<string>;
}

export interface StepClassTable {
  /** class -> number of casts observed in that class (the pre-first-hop prior). */
  classCasts: Map<StepClass, number>;
  /** class -> delta distribution over ALL that class's hops (the marginal / backoff tier). */
  marginal: Map<StepClass, DeltaStats>;
  /** `${class}|${prevDx},${prevDy}` -> delta distribution conditioned on the previous move. */
  conditional: Map<string, DeltaStats>;
}

export function conditionalKey(k: StepClass, prev: Displacement): string {
  return `${k}|${deltaKey(prev)}`;
}

function bump(stats: DeltaStats, key: string, castId: string) {
  stats.counts.set(key, (stats.counts.get(key) ?? 0) + 1);
  stats.castIds.add(castId);
}

function emptyStats(): DeltaStats {
  return { counts: new Map(), castIds: new Set() };
}

/**
 * Builds the class-aware movement table from grouped casts. Callers pass
 * `isCleanCast`-filtered casts — a duplicate-turn cast fabricates hops that
 * never happened (see this file's header, cast `12923189`).
 */
export function buildStepClassTable(casts: readonly Cast[]): StepClassTable {
  const table: StepClassTable = { classCasts: new Map(), marginal: new Map(), conditional: new Map() };
  for (const cast of casts) {
    const hops = castHops(cast);
    if (hops.length === 0) continue;
    const k = classifyStep([cast.start, ...hops.map((h) => h.to)]);
    if (k === null) continue;
    table.classCasts.set(k, (table.classCasts.get(k) ?? 0) + 1);
    for (const hop of hops) {
      const d: Displacement = { dx: hop.to.x - hop.from.x, dy: hop.to.y - hop.from.y };
      if (Math.abs(d.dx) + Math.abs(d.dy) !== k) continue; // FACT 1 holds on clean casts; skip rather than poison the table
      const marg = table.marginal.get(k) ?? emptyStats();
      bump(marg, deltaKey(d), cast.castId);
      table.marginal.set(k, marg);
      if (hop.prev) {
        const ck = conditionalKey(k, hop.prev);
        const cond = table.conditional.get(ck) ?? emptyStats();
        bump(cond, deltaKey(d), cast.castId);
        table.conditional.set(ck, cond);
      }
    }
  }
  return table;
}

// ── the distribution ──────────────────────────────────────────────────────

export interface RingModelOptions {
  /**
   * Shrinkage of the prev-delta conditional toward the class marginal:
   * weight `n / (n + shrinkageK)` at `n` supporting casts. Same continuous
   * mechanism as `contextualFallback.ts` — not a second smoothing scheme.
   */
  shrinkageK: number;
  /**
   * Mass reserved for a uniform distribution over the legal ring, mixed in
   * last. Guards log loss against a ring cell the corpus happens never to
   * have produced from this exact context — the ring itself is the hard
   * constraint (FACT 1), the delta table within it is only an estimate.
   */
  ringFloor: number;
}

/**
 * Picked from `scripts/fishingRingCV.ts`'s leave-one-cast-out sweep over
 * shrinkageK x ringFloor on the real corpus (66 clean casts, 193 scored
 * transitions). Log loss is a broad flat plateau — 1.065-1.09 across
 * shrinkageK 2-5 and ringFloor 0.02-0.2 — with the global minimum (1.065 at
 * k=5, floor=0.05) only 0.003 below this choice (1.068), which is noise at
 * n=193. `{3, 0.1}` is taken because it sits in the INTERIOR of the plateau
 * on both axes rather than on its edge, the same robustness reasoning that
 * picked `DEFAULT_SHRINKAGE_K = 1` in session 38.
 *
 * Top-1 accuracy is 48.2% at essentially every setting in the sweep (49.2%
 * only at shrinkageK=10, where log loss is already worse): the RING
 * CONSTRAINT is what buys top-1, and the smoothing knobs only move
 * calibration. That is the expected shape if FACT 1 is doing the work, and
 * it is a useful sanity check that it is.
 */
export const DEFAULT_RING_MODEL_OPTIONS: RingModelOptions = { shrinkageK: 3, ringFloor: 0.1 };

function uniformOver(cells: readonly Cell[]): Distribution {
  const out: Distribution = new Map();
  if (cells.length === 0) return out;
  const p = 1 / cells.length;
  for (const c of cells) out.set(cellKey(c), { cell: c, p });
  return out;
}

/** Projects a delta-keyed weight map onto in-grid cells around `cell`, renormalizing over what survives. */
function deltasToCells(cell: Cell, stats: DeltaStats, gridSize: number): Distribution {
  const out: Distribution = new Map();
  let total = 0;
  for (const [dk, count] of stats.counts) {
    const d = parseDeltaKey(dk);
    const c = { x: cell.x + d.dx, y: cell.y + d.dy };
    if (!inGrid(c, gridSize)) continue;
    const key = cellKey(c);
    const prev = out.get(key);
    out.set(key, { cell: c, p: (prev?.p ?? 0) + count });
    total += count;
  }
  if (total === 0) return new Map();
  for (const v of out.values()) v.p /= total;
  return out;
}

/**
 * The class-aware ring distribution over the fish's next cell.
 *
 * `prevDelta` is the displacement of the fish's most recent hop (null on the
 * turn right after the identifying hop is unavailable, e.g. a resumed cast
 * with no history) — with it, the conditional tier fires; without it, the
 * class marginal does. Everything is restricted to the legal in-grid
 * `k`-ring, which is the whole point: cells the fish provably cannot reach
 * this turn get exactly zero, instead of the mass the class-blind empirical
 * map was handing them.
 */
export function ringDistribution(
  cell: Cell,
  k: StepClass,
  prevDelta: Displacement | null,
  table: StepClassTable,
  gridSize: number,
  opts: RingModelOptions = DEFAULT_RING_MODEL_OPTIONS,
): Distribution {
  const ring = ringCells(cell, k, gridSize);
  const uniformRing = uniformOver(ring);
  if (ring.length === 0) return uniformRing;

  const marginal = table.marginal.get(k);
  const marginalDist = marginal ? deltasToCells(cell, marginal, gridSize) : new Map<string, { cell: Cell; p: number }>();

  let base: Distribution = marginalDist.size > 0 ? marginalDist : uniformRing;

  if (prevDelta) {
    const cond = table.conditional.get(conditionalKey(k, prevDelta));
    const n = cond?.castIds.size ?? 0;
    if (n > 0) {
      const condDist = deltasToCells(cell, cond!, gridSize);
      if (condDist.size > 0) {
        base = mixDistributions(condDist, base, n / (n + opts.shrinkageK));
      }
    }
  }

  if (opts.ringFloor <= 0) return base;
  return mixDistributions(base, uniformRing, 1 - opts.ringFloor);
}

/**
 * Before the first hop resolves, the class is unknown — mix the two rings by
 * the corpus's observed class prior rather than guessing one. This is the
 * only place the class stops being a hard constraint, and it is honest about
 * why (`classifyStep` returned `null`, there is no evidence yet).
 */
export function ringDistributionUnknownClass(
  cell: Cell,
  prevDelta: Displacement | null,
  table: StepClassTable,
  gridSize: number,
  opts: RingModelOptions = DEFAULT_RING_MODEL_OPTIONS,
): Distribution {
  const totals = STEP_CLASSES.map((k) => table.classCasts.get(k) ?? 0);
  const sum = totals.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? totals[0]! / sum : 0.5;
  const d1 = ringDistribution(cell, 1, prevDelta, table, gridSize, opts);
  const d2 = ringDistribution(cell, 2, prevDelta, table, gridSize, opts);
  return mixDistributions(d1, d2, w);
}

/**
 * Intersects an arbitrary distribution with the legal `k`-ring, renormalizing
 * over what survives (session-45 brief §1 design note 3): a surviving mined
 * `perimeterWalk` candidate that predicts an off-ring cell is now provably
 * wrong, and its mass should not reach `chooseCard`. Returns `null` if
 * NOTHING survives — the caller should then fall through to the ring model
 * rather than trust a fully-refuted predictor.
 */
export function intersectWithRing(dist: Distribution, cell: Cell, k: StepClass, gridSize: number): Distribution | null {
  const legal = new Set(ringCells(cell, k, gridSize).map(cellKey));
  const out: Distribution = new Map();
  let total = 0;
  for (const [key, v] of dist) {
    if (!legal.has(key)) continue;
    out.set(key, { cell: v.cell, p: v.p });
    total += v.p;
  }
  if (total <= 0) return null;
  for (const v of out.values()) v.p /= total;
  return out;
}

// ── the sticky step-count latent ──────────────────────────────────────────

/**
 * [session 49, brief §2] The switch probability of the per-turn step count,
 * estimated from `data/fish-patterns.jsonl` at 73 clean casts.
 *
 * Session 48 falsified the half of FACT 1 that said the step count is fixed
 * for a cast (`scripts/auditMovePaths.ts`, cast `12988700`). The count is
 * still STICKY — 233 of 238 consecutive hop pairs keep it — but the model
 * treated stickiness as certainty, so cast `12988700` drew three
 * probability-ZERO outcomes and a log loss of 11.316.
 *
 * The count is OBSERVED the moment a hop resolves, so nothing here is a
 * hidden-state filter: the only unknown is the NEXT turn's count, and a
 * two-state Markov chain on the last observed one is its whole sufficient
 * statistic. That is why this takes `lastK` and not a posterior.
 *
 * **14 switches / 284 consecutive hop pairs = 4.93% raw, 5.25% with
 * Laplace +1**, at 83 clean casts. The swept optimum sits at 0.050, on top of
 * that estimate — as it did at the previous corpus size, which is the check
 * that the estimator and the sweep are measuring the same thing.
 *
 * This number has moved every time anyone counted it, always upward, and that
 * history is the point (CLAUDE.md §9 — an exceptionless count is a claim
 * about the SAMPLE'S POWER, not about the mechanism):
 *
 *   session-49 brief, from memory:  "one switch in ~309"     ~0.5-0.7%
 *   73 clean casts, counted:         5 switches / 238         2.50%
 *   83 clean casts, counted:        14 switches / 284         5.25%
 *
 * The jump came from ONE cast: `12991364` alternates 2,1,2,1,2,1,2,1,2,1 over
 * ten turns — the second such cast ever seen, and it turned up in the very
 * next ten casts played after the first one was found. At `s = 0`, i.e. under
 * the hard ring this replaced, the corpus now carries **8 zero-probability
 * events**, up from 3. Re-run `scripts/stickyStepSweep.ts` whenever the
 * corpus grows; do not assume this constant has settled.
 */
export const DEFAULT_SWITCH_PROBABILITY = 0.05;

/**
 * [session 50, brief §3 / open question 4] The floor under an ESTIMATED `s`.
 *
 * `estimateSwitchProbability` reads `s` off the corpus at load, and a small
 * corpus that happens to contain no class switch at all would hand back 0 —
 * which is not "the fish never switches", it is "we have not seen one yet",
 * and it is the degenerate hard-ring case the sticky latent was built to
 * remove (an off-ring landing collapses to `-log(1e-9)`). The floor makes
 * that impossible.
 *
 * Set at the value the corpus produced at 73 casts (2.50%), so the floor is a
 * number the data has actually supported rather than an invention, and it is
 * well below every count since.
 */
export const SWITCH_PROBABILITY_FLOOR = 0.025;

export interface SwitchProbabilityEstimate {
  /** The floored estimate, ready to pass to `stickyStepDistribution`. */
  s: number;
  /** The raw switches/transitions ratio, BEFORE the floor. */
  raw: number;
  /** Consecutive hop pairs both of whose step counts were classifiable. */
  n: number;
  /** How many of those pairs changed class. */
  switches: number;
  /** True when the floor bound the estimate — worth logging loudly. */
  floored: boolean;
}

/**
 * Estimate the sticky chain's switch probability from the corpus.
 *
 * **Why this is estimated rather than shipped as a constant.** `s` has risen
 * at every single count: the session-49 brief put it at ~0.6% ("one in
 * ~309"), 73 clean casts made it 2.50%, 83 made it 5.25%, and
 * `scripts/stickyStepSweep.ts`'s swept optimum tracked the estimator at both
 * sizes. A shipped constant is stale by construction under a monotone trend,
 * and nobody knows where the trend stops — so the number is read off the
 * corpus at load, floored, and logged with its `n` on every run (the brief's
 * §0 rule: no corpus statistic without its `n`).
 *
 * The unit is the consecutive hop PAIR, not the cast: a switch is observable
 * only between two adjacent classifiable hops, which is exactly the
 * transition the two-state chain models.
 */
export function estimateSwitchProbability(
  casts: readonly Cast[],
  floor: number = SWITCH_PROBABILITY_FLOOR,
): SwitchProbabilityEstimate {
  let n = 0;
  let switches = 0;
  for (const cast of casts) {
    let prevK: StepClass | null = null;
    let prev: Cell = cast.start;
    for (let t = 0; t <= cast.maxTurn; t++) {
      const to = cast.byTurn.get(t);
      if (!to) break;
      const len = stepLen(prev, to);
      const k: StepClass | null = len === 1 || len === 2 ? (len as StepClass) : null;
      if (k !== null && prevK !== null) {
        n++;
        if (k !== prevK) switches++;
      }
      if (k !== null) prevK = k;
      prev = to;
    }
  }
  const raw = n > 0 ? switches / n : 0;
  const s = Math.max(floor, raw);
  return { s, raw, n, switches, floored: s > raw };
}

/**
 * The step count of the fish's MOST RECENT nonzero hop.
 *
 * Deliberately not `classifyStep`, which takes the cast-wide mode. The mode
 * is the right summary only under the retracted "constant per cast" reading;
 * under a sticky chain the last observation is the sufficient statistic, and
 * on an alternating cast the two disagree on every turn. They agree on all
 * 72 constant casts in the corpus.
 */
export function lastStepClass(history: readonly Cell[]): StepClass | null {
  for (let i = history.length - 1; i >= 1; i--) {
    const len = stepLen(history[i - 1]!, history[i]!);
    if (len === 1 || len === 2) return len as StepClass;
  }
  return null;
}

/**
 * The next-cell distribution under the sticky two-state step count:
 *
 *   P(next cell) = (1 - s) * P(cell | lastK) + s * P(cell | the other class)
 *
 * marginalising the ring model over both counts instead of conditioning
 * hard on one. Three things fall out of that and none of them needed a new
 * constant:
 *
 *  - **The floor is free.** An off-"ring" cell gets roughly `s` spread over
 *    the alternate ring, capping a surprise at ~5 nats instead of the
 *    `-log(1e-9)` = 20.7 a true zero collapses to. There is no arbitrary
 *    floor to justify, which is why the brief prefers this to flooring.
 *  - **Reclassification is automatic and PROMPT.** An off-ring landing
 *    changes `lastStepClass` on the very next turn, so the model corrects
 *    before the next prediction rather than after a mode has been outvoted.
 *  - **On the 72 constant casts it is a `s`-sized perturbation** of what
 *    shipped, so the cost of being wrong about the mechanism is bounded.
 *
 * `lastK === null` (no hop resolved yet) hands over to
 * `ringDistributionUnknownClass` unchanged — the class prior is already the
 * honest answer there and stickiness has nothing to be sticky about.
 */
export function stickyStepDistribution(
  cell: Cell,
  lastK: StepClass | null,
  prevDelta: Displacement | null,
  table: StepClassTable,
  gridSize: number,
  opts: RingModelOptions = DEFAULT_RING_MODEL_OPTIONS,
  switchProbability: number = DEFAULT_SWITCH_PROBABILITY,
): Distribution {
  if (lastK === null) return ringDistributionUnknownClass(cell, prevDelta, table, gridSize, opts);
  const s = Math.min(Math.max(switchProbability, 0), 1);
  const other: StepClass = lastK === 1 ? 2 : 1;
  const stay = ringDistribution(cell, lastK, prevDelta, table, gridSize, opts);
  if (s <= 0) return stay;
  const jump = ringDistribution(cell, other, prevDelta, table, gridSize, opts);
  // `mixDistributions(a, b, w)` is `w*a + (1-w)*b`, so the stay-weight is 1-s.
  return mixDistributions(stay, jump, 1 - s);
}
