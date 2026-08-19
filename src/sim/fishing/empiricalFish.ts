/**
 * src/sim/fishing/empiricalFish.ts — [session 45, brief §2] a fish generator
 * that samples from the REAL corpus's movement statistics instead of from
 * `patterns.ts`'s synthetic primitive pool.
 *
 * Why this exists. `patterns.ts`'s own header already says "never use this
 * library to drive live card choice", but the sim has always drawn its
 * ground-truth fish from it, and every sim number this project has ever
 * produced inherits that. Session 44 measured heuristic (d)
 * (`pruneReturnToPrevious`) as a reproducible ~2pp catch-rate REGRESSION and
 * traced it to `patterns.ts`'s `bounceDelta` wall-reflection primitive doing
 * exactly what (d) forbids — the trace was correct, but the conclusion drawn
 * from it was backwards: the real corpus shows 0 reversals in 109 k=1
 * observations (`scripts/auditStepClass.ts`), so `bounceDelta` models a fish
 * this game does not have, and the SIM was wrong rather than the heuristic.
 * A synthetic generator can only ever answer "does the algorithm exploit the
 * structure I put in"; this one answers "does it exploit the structure the
 * real fish has."
 *
 * The sampler is FACT 1 + FACT 2 as a generative process (see
 * `src/strategy/fishing/stepClass.ts` for both, and
 * `scripts/auditStepClass.ts` for their derivation):
 *   1. draw the cast's step class `k` from the corpus's observed class prior;
 *   2. draw the first delta from that class's marginal;
 *   3. draw every later delta from the (class, previous delta) conditional,
 *      shrunk toward the class marginal by the same `n / (n + shrinkageK)`
 *      used everywhere else in this project;
 *   4. reject any delta leaving the grid and renormalize over what is legal —
 *      the corpus never once shows an off-grid landing, so a wall must
 *      constrain the draw rather than clamp the result.
 *
 * IMPORTANT and stated up front: a policy that uses the ring model
 * (`stepClass.ts`) against a fish sampled from this generator shares its
 * movement model with its own opponent, which is optimistic by construction —
 * the same "sim authority is earned per domain" caveat SPEC.md §5 already
 * carries, and the session-45 brief's §0 named. The honest out-of-sample
 * evidence for the ring model is `scripts/fishingRingCV.ts`'s leave-one-
 * cast-out table, not any catch rate measured here. What this generator IS
 * good for is comparing two policies against a fish that at least moves the
 * way the real one does.
 */

import type { Rng } from "../rng.js";
import type { Cell } from "./geometry.js";
import { inGrid } from "./geometry.js";
import {
  ringCells,
  STEP_CLASSES,
  type DeltaStats,
  type StepClass,
  type StepClassTable,
} from "../../strategy/fishing/stepClass.js";

export interface EmpiricalFishOptions {
  /** Shrinkage of the (class, prev-delta) conditional toward the class marginal. Mirrors `stepClass.ts`'s own smoothing rather than introducing a second one. */
  shrinkageK: number;
}

export const DEFAULT_EMPIRICAL_FISH_OPTIONS: EmpiricalFishOptions = { shrinkageK: 3 };

interface Delta {
  dx: number;
  dy: number;
}

function parseDelta(key: string): Delta {
  const [dx, dy] = key.split(",").map(Number);
  return { dx: dx!, dy: dy! };
}

/** Weighted draw over `[key, weight]` pairs; returns null if nothing has positive weight. */
function drawWeighted(entries: readonly [string, number][], rng: Rng): string | null {
  let total = 0;
  for (const [, w] of entries) total += w;
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[entries.length - 1]?.[0] ?? null;
}

/** Draws the cast's step class from the corpus's observed per-class cast counts. */
export function sampleStepClass(table: StepClassTable, rng: Rng): StepClass | null {
  const entries = STEP_CLASSES.map((k) => [String(k), table.classCasts.get(k) ?? 0] as [string, number]);
  const picked = drawWeighted(entries, rng);
  return picked === null ? null : (Number(picked) as StepClass);
}

/** Uniform draw over the legal in-grid `k`-ring — the fallback that keeps FACT 1 true even where the delta table has no legal option. */
function uniformRingDelta(from: Cell, k: StepClass, gridSize: number, rng: Rng): Delta | null {
  const legal = ringCells(from, k, gridSize);
  if (legal.length === 0) return null;
  const c = rng.pick(legal);
  return { dx: c.x - from.x, dy: c.y - from.y };
}

/**
 * Blends the conditional and marginal delta weights, drops anything that
 * would leave the grid, and draws.
 *
 * If NO observed delta is legal from this cell — a thin table whose class
 * marginal happens to contain only deltas that point off the grid from here —
 * this falls back to a uniform draw over the legal `k`-ring rather than
 * holding position. FACT 1 (the fish always moves, always onto its ring) is
 * the hard constraint; the delta table is only an estimate of the shape
 * WITHIN that ring, so a gap in the estimate must never be allowed to
 * manufacture a zero-length move the real fish never makes. Returns null only
 * when the ring itself is empty, which cannot happen on a grid of size >= 2.
 */
function sampleDelta(
  from: Cell,
  k: StepClass,
  gridSize: number,
  marginal: DeltaStats | undefined,
  conditional: DeltaStats | undefined,
  opts: EmpiricalFishOptions,
  rng: Rng,
): Delta | null {
  if (!marginal || marginal.counts.size === 0) return uniformRingDelta(from, k, gridSize, rng);
  const margTotal = [...marginal.counts.values()].reduce((a, b) => a + b, 0);
  const n = conditional?.castIds.size ?? 0;
  const condTotal = conditional ? [...conditional.counts.values()].reduce((a, b) => a + b, 0) : 0;
  const w = condTotal > 0 ? n / (n + opts.shrinkageK) : 0;

  const keys = new Set<string>([...marginal.counts.keys(), ...(conditional?.counts.keys() ?? [])]);
  const entries: [string, number][] = [];
  for (const key of keys) {
    const d = parseDelta(key);
    if (!inGrid({ x: from.x + d.dx, y: from.y + d.dy }, gridSize)) continue;
    const pm = (marginal.counts.get(key) ?? 0) / margTotal;
    const pc = condTotal > 0 ? (conditional!.counts.get(key) ?? 0) / condTotal : 0;
    entries.push([key, w * pc + (1 - w) * pm]);
  }
  const picked = drawWeighted(entries, rng);
  return picked === null ? uniformRingDelta(from, k, gridSize, rng) : parseDelta(picked);
}

export interface EmpiricalTrajectory {
  /** The class this cast's fish was drawn as — the thing a live policy has to identify. */
  stepClass: StepClass | null;
  /** `cells[t]` is the fish's position AFTER turn `t`'s move; `cells` never includes the start cell, matching `Pattern.path`'s existing contract. */
  cells: Cell[];
}

/**
 * Samples one cast's full fish trajectory. Movement does not depend on the
 * player's actions (the corpus shows the fish moving every turn regardless of
 * hit or miss), so the whole path can be drawn up front exactly as
 * `Pattern.path` already is — this is a drop-in replacement for it, not a new
 * control flow in the sim's turn loop.
 */
export function sampleEmpiricalTrajectory(
  table: StepClassTable,
  startCell: Cell,
  gridSize: number,
  turns: number,
  rng: Rng,
  opts: EmpiricalFishOptions = DEFAULT_EMPIRICAL_FISH_OPTIONS,
): EmpiricalTrajectory {
  const stepClass = sampleStepClass(table, rng);
  const cells: Cell[] = [];
  if (stepClass === null) {
    for (let i = 0; i < turns; i++) cells.push({ ...startCell });
    return { stepClass, cells };
  }
  const marginal = table.marginal.get(stepClass);
  let current = startCell;
  let prev: Delta | null = null;
  for (let i = 0; i < turns; i++) {
    const conditional = prev ? table.conditional.get(`${stepClass}|${prev.dx},${prev.dy}`) : undefined;
    const d = sampleDelta(current, stepClass, gridSize, marginal, conditional, opts, rng);
    if (!d) {
      cells.push({ ...current });
      continue;
    }
    current = { x: current.x + d.dx, y: current.y + d.dy };
    cells.push({ ...current });
    prev = d;
  }
  return { stepClass, cells };
}
