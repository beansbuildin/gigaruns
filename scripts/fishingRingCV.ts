/**
 * scripts/fishingRingCV.ts — [session 45] leave-one-cast-out cross-validation
 * of the step-class RING movement model (`src/strategy/fishing/stepClass.ts`)
 * against the predictors it is meant to replace, on the real
 * `data/fish-patterns.jsonl` corpus.
 *
 * This is the script that decides session 45's §1 gate: the ring model must
 * beat the cell+prev-displacement baseline on BOTH leave-one-cast-out log
 * loss and top-1 accuracy. Log loss is the column that matters most —
 * `chooseCard` integrates over the whole distribution, so calibration
 * dominates top-1 (the same reasoning that retired the hard
 * `DEFAULT_MIN_INDEPENDENT_CASTS` threshold in session 38).
 *
 * Methodology, deliberately matched to `scripts/fishingContextualCV.ts` so
 * the two are comparable line for line:
 *  - the cross-validation unit is the CAST, never the transition;
 *  - `isCleanCast` filtering, so the duplicate-turn-0 cast `12923189` (a
 *    logging artifact, see `stepClass.ts`'s header) cannot fabricate hops;
 *  - the same `top1` tie-break (lowest x, then lowest y) and the same
 *    `-log(1e-9)` floor for a zero-probability outcome;
 *  - the scored set is hops WITH a previous displacement, so every predictor
 *    is measured on the identical transitions.
 *
 * The step class is derived CAUSALLY — only from the held-out cast's own
 * hops strictly before the scored one, which is exactly what live code has
 * at that moment. No held-out label ever informs its own prediction.
 *
 * Usage: npx tsx scripts/fishingRingCV.ts [path-to-fish-patterns.jsonl]
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
  type Displacement,
} from "../src/strategy/fishing/contextualFallback.js";
import { distributionFromMultiset, uniformDistribution } from "../src/strategy/fishing/matcher.js";
import {
  buildStepClassTable,
  classifyStep,
  ringCells,
  ringDistribution,
  ringDistributionUnknownClass,
  type RingModelOptions,
} from "../src/strategy/fishing/stepClass.js";

const DEFAULT_PATH = join("data", "fish-patterns.jsonl");

type Dist = Map<string, { cell: Cell; p: number }>;

interface EvalResult {
  name: string;
  n: number;
  correct: number;
  logLossSum: number;
  brierSum: number;
  zeroProb: number;
}

function newEval(name: string): EvalResult {
  return { name, n: 0, correct: 0, logLossSum: 0, brierSum: 0, zeroProb: 0 };
}

/** Same deterministic tie-break as `fishingContextualCV.ts` — see its header for why the rule is pinned. */
function top1(dist: Dist): { cell: Cell; p: number } | undefined {
  const values = [...dist.values()];
  if (values.length === 0) return undefined;
  const maxP = Math.max(...values.map((v) => v.p));
  const tied = values.filter((v) => Math.abs(v.p - maxP) < 1e-9);
  tied.sort((a, b) => a.cell.x - b.cell.x || a.cell.y - b.cell.y);
  return tied[0];
}

function score(res: EvalResult, dist: Dist, actual: Cell) {
  res.n++;
  const best = top1(dist);
  if (best && cellKey(best.cell) === cellKey(actual)) res.correct++;
  const pActual = dist.get(cellKey(actual))?.p ?? 0;
  if (pActual <= 0) res.zeroProb++;
  res.logLossSum += pActual > 0 ? -Math.log(pActual) : -Math.log(1e-9);
  let brier = 0;
  for (const { p } of dist.values()) brier += p * p;
  res.brierSum += brier - 2 * pActual + 1;
}

function report(res: EvalResult) {
  const acc = res.n > 0 ? (res.correct / res.n) * 100 : 0;
  const ll = res.n > 0 ? res.logLossSum / res.n : 0;
  const brier = res.n > 0 ? res.brierSum / res.n : 0;
  console.log(
    `  ${res.name.padEnd(44)} n=${String(res.n).padEnd(4)} top1=${acc.toFixed(1).padStart(5)}%  logLoss=${ll.toFixed(3).padStart(6)}  brier=${brier.toFixed(3)}  zeroP=${res.zeroProb}`,
  );
  return { acc, ll, brier };
}

/** One leave-one-cast-out pass over every predictor at the given ring options. */
function runFold(casts: readonly Cast[], gridSize: number, opts: RingModelOptions) {
  const cellOnly = newEval("cell-only (today's tier 2)");
  const cellPrevRaw = newEval("cell + prev-displacement (raw)");
  const cellPrevShipped = newEval("cell + prev-displacement (shipped backoff)");
  const ringOnly = newEval("ring, class-aware (Fact 1 only)");
  const ringCond = newEval("ring + class-aware prev-delta (Facts 1+2)");

  for (let i = 0; i < casts.length; i++) {
    const heldOut = casts[i]!;
    const training = casts.filter((_, j) => j !== i);
    const cellMap = buildCellOnlyMap(training);
    const ctxMap = buildContextualMap(training);
    const stepTable = buildStepClassTable(training);
    const hops = castHops(heldOut);

    for (let h = 0; h < hops.length; h++) {
      const hop = hops[h]!;
      if (!hop.prev) continue; // scored set: hops with a previous displacement
      const prev: Displacement = hop.prev;

      // Causal history: the cells the fish has occupied up to and including `hop.from`.
      const history: Cell[] = [heldOut.start, ...hops.slice(0, h).map((x) => x.to)];
      const k = classifyStep(history);

      {
        const observed = cellMap.get(cellKey(hop.from));
        score(cellOnly, observed && observed.length > 0 ? distributionFromMultiset(observed) : uniformDistribution(gridSize), hop.to);
      }
      {
        const stats = ctxMap.get(contextKey(hop.from, prev));
        const dist =
          stats && stats.observations.length > 0 ? distributionFromMultiset(stats.observations) : uniformDistribution(gridSize);
        score(cellPrevRaw, dist, hop.to);
      }
      score(cellPrevShipped, contextualFallback(hop.from, prev, ctxMap, cellMap, gridSize), hop.to);
      {
        // Fact 1 only: uniform over the legal ring (no conditional, no marginal shape).
        const ring = k === null ? null : ringCells(hop.from, k, gridSize);
        let dist: Dist;
        if (!ring || ring.length === 0) {
          dist = uniformDistribution(gridSize);
        } else {
          dist = new Map();
          for (const c of ring) dist.set(cellKey(c), { cell: c, p: 1 / ring.length });
        }
        score(ringOnly, dist, hop.to);
      }
      {
        const dist =
          k === null
            ? ringDistributionUnknownClass(hop.from, prev, stepTable, gridSize, opts)
            : ringDistribution(hop.from, k, prev, stepTable, gridSize, opts);
        score(ringCond, dist, hop.to);
      }
    }
  }
  return { cellOnly, cellPrevRaw, cellPrevShipped, ringOnly, ringCond };
}

function main() {
  const path = process.argv[2] ?? DEFAULT_PATH;
  const records = loadTransitionRecords(path);
  const allCasts = groupByCast(records);
  const casts = allCasts.filter(isCleanCast);
  const gridSize = casts[0]?.gridSize ?? 4;
  const scored = casts.reduce((n, c) => n + castHops(c).filter((h) => h.prev).length, 0);

  console.log(`\n▸ fishingRingCV.ts — ${path}`);
  console.log(
    `  ${records.length} raw transitions, ${allCasts.length} casts, ${casts.length} clean, ${scored} scored transitions (hops with a previous displacement)\n`,
  );
  if (casts.length < 5) {
    console.log("  too few clean casts for leave-one-cast-out — stopping.\n");
    return;
  }

  console.log("── head-to-head, leave-one-cast-out (ring model at defaults) ──");
  const base = runFold(casts, gridSize, { shrinkageK: 2, ringFloor: 0.1 });
  const r1 = report(base.cellOnly);
  const r2 = report(base.cellPrevRaw);
  const r3 = report(base.cellPrevShipped);
  report(base.ringOnly);
  const r5 = report(base.ringCond);

  console.log("\n── GATE (session-45 brief §1) ──");
  const baselineLl = Math.min(r2.ll, r3.ll);
  const baselineAcc = Math.max(r2.acc, r3.acc);
  console.log(`  baseline to beat = best of the two cell+prev forms: logLoss ${baselineLl.toFixed(3)}, top1 ${baselineAcc.toFixed(1)}%`);
  console.log(`  brief's claimed baseline: logLoss 2.070, top1 40.8%   |   brief's claimed ring result: logLoss 1.123, top1 47.4%`);
  const passLl = r5.ll < baselineLl;
  const passAcc = r5.acc > baselineAcc;
  console.log(`  ring+conditional: logLoss ${r5.ll.toFixed(3)} ${passLl ? "PASS" : "FAIL"}   top1 ${r5.acc.toFixed(1)}% ${passAcc ? "PASS" : "FAIL"}`);
  console.log(`  => §1 GATE ${passLl && passAcc ? "MET" : "NOT MET"}`);
  void r1;

  console.log("\n── sweep: shrinkageK x ringFloor (ring + conditional) ──");
  console.log("  shrinkageK  ringFloor    top1   logLoss    brier");
  let best = { ll: Number.POSITIVE_INFINITY, k: 0, f: 0, acc: 0 };
  for (const k of [0.5, 1, 2, 3, 5, 10]) {
    for (const f of [0, 0.02, 0.05, 0.1, 0.2, 0.35]) {
      const res = runFold(casts, gridSize, { shrinkageK: k, ringFloor: f });
      const n = res.ringCond.n;
      const ll = res.ringCond.logLossSum / n;
      const acc = (res.ringCond.correct / n) * 100;
      const br = res.ringCond.brierSum / n;
      const mark = ll < best.ll ? " <-" : "";
      if (ll < best.ll) best = { ll, k, f, acc };
      console.log(
        `  ${String(k).padStart(10)}  ${String(f).padStart(9)}  ${acc.toFixed(1).padStart(5)}%   ${ll.toFixed(3).padStart(6)}   ${br.toFixed(3)}${mark}`,
      );
    }
  }
  console.log(`\n  best logLoss ${best.ll.toFixed(3)} at shrinkageK=${best.k}, ringFloor=${best.f} (top1 ${best.acc.toFixed(1)}%)\n`);
}

const isMain = process.argv[1]?.endsWith("fishingRingCV.ts");
if (isMain) main();
