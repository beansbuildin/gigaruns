/**
 * scripts/fishingContextualCV.ts — [session 33, CODEXIMPROVE #3] offline
 * leave-one-cast-out cross-validation of the previous-direction contextual
 * fallback against the real `data/fish-patterns.jsonl` corpus, BEFORE any
 * live wiring — per this session's brief and CLAUDE.md §9 (a brief's
 * numbers are a hypothesis to verify, not a fact to implement).
 *
 * Two things this script does:
 *
 *  1. Reproduces Codex's own 4-row ablation table (cell-only / cell+turn /
 *     cell+prevdir / cell+turn+prevdir) as a methodology sanity check — if
 *     this project's independently-coded cross-validation doesn't land near
 *     Codex's reported 16.4%/33.9% top-1 numbers, that's a signal the
 *     methodology or the corpus itself diverges, not just noise to shrug
 *     off (brief requirement: stop and report honestly if it doesn't
 *     reproduce).
 *  2. Evaluates the actual SHIPPED hierarchical backoff
 *     (`contextualFallback`, cell-only never included when the ordering
 *     result is decided by a fast context-tier check) with log loss and
 *     Brier score in addition to top-1, at several `minIndependentCasts`
 *     thresholds — this is what `DEFAULT_MIN_INDEPENDENT_CASTS` was picked
 *     from.
 *
 * Cross-validation unit is the CAST, not the transition (brief requirement
 * 5) — leave-one-cast-out, so no turn of a held-out cast ever appears in its
 * own training folds.
 *
 * Usage: npx tsx scripts/fishingContextualCV.ts
 */

import { join } from "node:path";

import type { Cell } from "../src/sim/fishing/geometry.js";
import { cellKey } from "../src/sim/fishing/geometry.js";
import { groupByCast, isCleanCast, loadTransitionRecords, type Cast } from "../src/sim/fishing/transitionCorpus.js";
import {
  buildCellOnlyMap,
  buildContextualMap,
  castHops,
  contextKey,
  contextualFallback,
  type ContextStats,
  type Displacement,
} from "../src/strategy/fishing/contextualFallback.js";
import { distributionFromMultiset, emptyFallback, uniformDistribution } from "../src/strategy/fishing/matcher.js";

const DEFAULT_PATH = join("data", "fish-patterns.jsonl");

interface EvalResult {
  name: string;
  n: number;
  correct: number;
  covered: number;
  logLossSum: number;
  brierSum: number;
}

function newEval(name: string): EvalResult {
  return { name, n: 0, correct: 0, covered: 0, logLossSum: 0, brierSum: 0 };
}

/**
 * Deterministic top-1 pick: highest probability, ties broken by lowest x
 * then lowest y among the tied cells. [session 33] Confirmed by direct
 * comparison against Codex's own reported numbers — with the empirical
 * cell-only distribution's frequent ties (small per-cell sample sizes),
 * insertion-order or "any tied cell counts" tie-breaks reproduce a
 * DIFFERENT accuracy (23.0%/29.1% respectively) than Codex's reported
 * 16.4%; this (x,y)-sorted rule reproduces it exactly (27/165 = 16.4%,
 * see this script's own scratch verification). Needed for a fair
 * apples-to-apples comparison against Codex's table, and a reasonable
 * canonical choice for evaluation generally — a real predict() call
 * doesn't need one tie-break since downstream code (`chooseCard`) consumes
 * the full distribution, not a single top-1 pick.
 */
function top1(dist: Map<string, { cell: Cell; p: number }>): { cell: Cell; p: number } | undefined {
  const values = [...dist.values()];
  if (values.length === 0) return undefined;
  const maxP = Math.max(...values.map((v) => v.p));
  const tied = values.filter((v) => Math.abs(v.p - maxP) < 1e-9);
  tied.sort((a, b) => a.cell.x - b.cell.x || a.cell.y - b.cell.y);
  return tied[0];
}

function score(res: EvalResult, dist: Map<string, { cell: Cell; p: number }>, actual: Cell, covered: boolean) {
  res.n++;
  if (covered) res.covered++;
  const best = top1(dist);
  if (best && cellKey(best.cell) === cellKey(actual)) res.correct++;
  const pActual = dist.get(cellKey(actual))?.p ?? 0;
  res.logLossSum += pActual > 0 ? -Math.log(pActual) : -Math.log(1e-9);
  let brier = 0;
  for (const { p } of dist.values()) brier += p * p;
  brier += -2 * pActual + 1; // sum((p_i - y_i)^2) = sum(p_i^2) - 2*p_actual + 1, since y is one-hot
  res.brierSum += brier;
}

function report(res: EvalResult) {
  const acc = res.n > 0 ? (res.correct / res.n) * 100 : 0;
  const cov = res.n > 0 ? (res.covered / res.n) * 100 : 0;
  const ll = res.n > 0 ? res.logLossSum / res.n : 0;
  const brier = res.n > 0 ? res.brierSum / res.n : 0;
  console.log(
    `  ${res.name.padEnd(38)} n=${String(res.n).padEnd(4)} top1=${acc.toFixed(1).padStart(5)}%  coverage=${cov.toFixed(1).padStart(5)}%  logLoss=${ll.toFixed(3)}  brier=${brier.toFixed(3)}`,
  );
}

// ── Codex's 4-row raw-predictor reproduction (no backoff — a predictor with
// no training support at a held-out key falls back straight to uniform, so
// accuracy/log-loss/brier are always well-defined, but "coverage" reports
// whether the SPECIFIC tier actually had support). ────────────────────────

function cellOnlyKey(from: Cell): string {
  return cellKey(from);
}

function cellTurnKey(from: Cell, turn: number): string {
  return `${cellKey(from)}@${turn}`;
}

function buildCellTurnMap(casts: readonly Cast[]): Map<string, Cell[]> {
  const map = new Map<string, Cell[]>();
  for (const cast of casts) {
    for (const hop of castHops(cast)) {
      const key = cellTurnKey(hop.from, hop.turn);
      const arr = map.get(key) ?? [];
      arr.push(hop.to);
      map.set(key, arr);
    }
  }
  return map;
}

function cellTurnPrevKey(from: Cell, turn: number, prev: Displacement): string {
  return `${cellKey(from)}@${turn}|${prev.dx},${prev.dy}`;
}

function buildCellTurnPrevMap(casts: readonly Cast[]): Map<string, Cell[]> {
  const map = new Map<string, Cell[]>();
  for (const cast of casts) {
    for (const hop of castHops(cast)) {
      if (!hop.prev) continue;
      const key = cellTurnPrevKey(hop.from, hop.turn, hop.prev);
      const arr = map.get(key) ?? [];
      arr.push(hop.to);
      map.set(key, arr);
    }
  }
  return map;
}

// ── main ─────────────────────────────────────────────────────────────────

function main() {
  const path = process.argv[2] ?? DEFAULT_PATH;
  const records = loadTransitionRecords(path);
  const allCasts = groupByCast(records);
  const casts = allCasts.filter(isCleanCast);
  const totalHops = casts.reduce((n, c) => n + castHops(c).length, 0);
  const hopsWithPrev = casts.reduce((n, c) => n + castHops(c).filter((h) => h.prev).length, 0);

  console.log(`\n▸ fishingContextualCV.ts — ${path}`);
  console.log(
    `  ${records.length} raw transitions, ${allCasts.length} distinct casts (${allCasts.length - casts.length} excluded by isCleanCast per CODEXREVIEW #5), ${casts.length} clean casts, ${totalHops} hops (${hopsWithPrev} with a previous displacement)\n`,
  );
  if (casts.length < 5) {
    console.log("  too few clean casts for a meaningful leave-one-cast-out evaluation — stopping.\n");
    return;
  }

  const gridSize = casts[0]!.gridSize;

  console.log("── Reproducing Codex's raw-predictor ablation table (leave-one-cast-out) ──");
  const cellOnly = newEval("current cell only");
  const cellTurn = newEval("current cell + turn number");
  const cellPrev = newEval("current cell + previous direction");
  const cellTurnPrev = newEval("current cell + turn + previous direction");

  for (let i = 0; i < casts.length; i++) {
    const heldOut = casts[i]!;
    const training = casts.filter((_, j) => j !== i);
    const cellMap = buildCellOnlyMap(training);
    const cellTurnMap = buildCellTurnMap(training);
    const cellPrevMap = buildContextualMap(training);
    const cellTurnPrevMap = buildCellTurnPrevMap(training);

    for (const hop of castHops(heldOut)) {
      // cell only
      {
        const observed = cellMap.get(cellOnlyKey(hop.from));
        const dist = observed && observed.length > 0 ? distributionFromMultiset(observed) : uniformDistribution(gridSize);
        score(cellOnly, dist, hop.to, !!observed && observed.length > 0);
      }
      // cell + turn
      {
        const observed = cellTurnMap.get(cellTurnKey(hop.from, hop.turn));
        const dist = observed && observed.length > 0 ? distributionFromMultiset(observed) : uniformDistribution(gridSize);
        score(cellTurn, dist, hop.to, !!observed && observed.length > 0);
      }
      // cell + previous direction (turn-0 hops have no previous direction — excluded, matching Codex's own coverage denominator shape)
      if (hop.prev) {
        const stats: ContextStats | undefined = cellPrevMap.get(contextKey(hop.from, hop.prev));
        const observed = stats?.observations;
        const dist = observed && observed.length > 0 ? distributionFromMultiset(observed) : uniformDistribution(gridSize);
        score(cellPrev, dist, hop.to, !!observed && observed.length > 0);
      }
      // cell + turn + previous direction
      if (hop.prev) {
        const observed = cellTurnPrevMap.get(cellTurnPrevKey(hop.from, hop.turn, hop.prev));
        const dist = observed && observed.length > 0 ? distributionFromMultiset(observed) : uniformDistribution(gridSize);
        score(cellTurnPrev, dist, hop.to, !!observed && observed.length > 0);
      }
    }
  }

  report(cellOnly);
  report(cellTurn);
  report(cellPrev);
  report(cellTurnPrev);
  console.log(`\n  Codex's reported numbers (for comparison): current cell only 16.4%/100.0%, current cell + turn 16.4%/82.4%,`);
  console.log(`  current cell + previous direction 33.9%/75.2%, current cell + turn + previous direction 24.2%/49.1%.\n`);

  console.log("── Shipped hierarchical backoff (context -> cell-only -> uniform), continuous shrinkage, log loss + Brier ──");
  console.log("  [session 38, CODEXAUDIT #2] sweeping shrinkageK — weight = n / (n + shrinkageK); large K ≈ disabled\n");
  const cellOnlyBaseline = newEval(`cell-only baseline (no context tier, i.e. shrinkageK = ∞)`);
  const shrinkageValues = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5, 8, 13, 21, 34, 55, 100, 1000];
  for (const shrinkageK of shrinkageValues) {
    const hier = newEval(`hierarchical (shrinkageK=${shrinkageK})`);
    for (let i = 0; i < casts.length; i++) {
      const heldOut = casts[i]!;
      const training = casts.filter((_, j) => j !== i);
      const contextMap = buildContextualMap(training);
      const cellMap = buildCellOnlyMap(training);
      for (const hop of castHops(heldOut)) {
        const dist = contextualFallback(hop.from, hop.prev, contextMap, cellMap, gridSize, { shrinkageK });
        const contextStats = hop.prev ? contextMap.get(contextKey(hop.from, hop.prev)) : undefined;
        const usedContext = !!contextStats && contextStats.castIds.size > 0;
        score(hier, dist, hop.to, usedContext);

        if (shrinkageK === shrinkageValues[0]) {
          // only need to compute the cell-only baseline once
          const baselineDist = emptyFallback(hop.from, cellMap, gridSize);
          score(cellOnlyBaseline, baselineDist, hop.to, cellMap.has(cellKey(hop.from)));
        }
      }
    }
    report(hier);
  }
  report(cellOnlyBaseline);
  console.log();
  console.log(
    `  gate (this session's brief): keep the context tier's live contribution at zero unless some shrinkageK\n` +
      `  beats the cell-only baseline's logLoss=${(cellOnlyBaseline.logLossSum / cellOnlyBaseline.n).toFixed(3)} and brier=${(cellOnlyBaseline.brierSum / cellOnlyBaseline.n).toFixed(3)} above — on this real-corpus CV, not the synthetic ablation alone.\n`,
  );
}

main();
