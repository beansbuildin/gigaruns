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
  estimateSwitchProbability,
  lastStepClass,
  ringCells,
  ringDistribution,
  ringDistributionUnknownClass,
  stickyStepDistribution,
  DEFAULT_RING_MODEL_OPTIONS,
  SHARED_SHRINKAGE_BASELINE,
  type RingModelOptions,
  type StepClass as StepClassT,
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
  // [session 45] Split by the held-out cast's own class. This session's live
  // batch happened to draw two k=2 casts, and a k=2 fish is a genuinely
  // easier prediction problem than a k=1 one (reversal is 39% of its moves,
  // where k=1's most likely single move is 28%) — so comparing a k=2-only
  // live batch against the class-MIXED figure would flatter or damn the model
  // for the wrong reason. These rows are what a class-matched live batch
  // should actually be read against.
  const ringCondByClass = new Map<number, EvalResult>([
    [1, newEval("  ...on k=1 casts only")],
    [2, newEval("  ...on k=2 casts only")],
  ]);

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
        if (k !== null) score(ringCondByClass.get(k)!, dist, hop.to);
      }
    }
  }
  return { cellOnly, cellPrevRaw, cellPrevShipped, ringOnly, ringCond, ringCondByClass };
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
  for (const k of [1, 2]) report(base.ringCondByClass.get(k)!);

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

  perClassShrinkageSweep(casts);
}


// ── [session 51, brief §2] per-class shrinkageK ────────────────────────────
//
// The conditional tier ships ONE `shrinkageK` shared by both step classes.
// The two classes do not want the same value: k=2's legal ring is bigger
// (more cells, so the same corpus spreads its prevDelta->delta keys thinner)
// and its conditional table is correspondingly sparser, so it wants MORE
// smoothing. Over-trusting a sparse table is the mechanism that produces a
// tier losing to its own k-ring null on a k=2-heavy live batch while winning
// on mixed ones (session 50's batch: 21.1% shipped vs 26.3% k-ring null).
//
// Scored under the SHIPPED path, not `runFold`'s: `stickyStepDistribution`
// with `lastStepClass` and a per-fold `estimateSwitchProbability`, which is
// what `liveFishing.ts` actually calls. `runFold` above still scores the
// pre-session-49 mode+hard-ring form, deliberately, so the session-45 gate
// stays reproducible — but a knob tuned there would be tuned on a model that
// no longer ships.
//
// The unit of stratification is the turn's `lastK`, not the cast's mode:
// that is the class the sticky chain conditions on at that turn.

interface ShrinkTurn {
  castId: string;
  fold: number;
  from: Cell;
  prev: Displacement;
  to: Cell;
  lastK: StepClassT | null;
}

interface Fold {
  table: ReturnType<typeof buildStepClassTable>;
  s: number;
}

function buildFolds(casts: readonly Cast[]): { folds: Fold[]; turns: ShrinkTurn[] } {
  const folds: Fold[] = [];
  const turns: ShrinkTurn[] = [];
  for (let i = 0; i < casts.length; i++) {
    const held = casts[i]!;
    const training = casts.filter((_, j) => j !== i);
    // `s` is re-estimated per fold too — it is read off the corpus at load in
    // live code, and letting the held-out cast contribute to it would leak.
    folds.push({ table: buildStepClassTable(training), s: estimateSwitchProbability(training).s });
    const hops = castHops(held);
    for (let h = 0; h < hops.length; h++) {
      const hop = hops[h]!;
      if (!hop.prev) continue;
      const history: Cell[] = [held.start, ...hops.slice(0, h).map((x) => x.to)];
      turns.push({ castId: held.castId, fold: i, from: hop.from, prev: hop.prev, to: hop.to, lastK: lastStepClass(history) });
    }
  }
  return { folds, turns };
}

/** Per-turn log loss and top-1 hit for one option set, on the pre-built folds. */
function scoreTurns(folds: readonly Fold[], turns: readonly ShrinkTurn[], opts: RingModelOptions) {
  return turns.map((t) => {
    const f = folds[t.fold]!;
    const dist = stickyStepDistribution(t.from, t.lastK, t.prev, f.table, 4, opts, f.s);
    const p = dist.get(cellKey(t.to))?.p ?? 0;
    const best = top1(dist);
    return {
      castId: t.castId,
      lastK: t.lastK,
      ll: p > 0 ? -Math.log(p) : -Math.log(1e-9),
      hit: !!best && cellKey(best.cell) === cellKey(t.to),
    };
  });
}

const meanOf = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Cluster bootstrap over CASTS — turns within a cast share the trajectory under test. */
function clusterCI(rows: readonly { castId: string; d: number }[], iters = 4000): [number, number] {
  const byCast = new Map<string, number[]>();
  for (const r of rows) {
    const arr = byCast.get(r.castId) ?? [];
    arr.push(r.d);
    byCast.set(r.castId, arr);
  }
  const groups = [...byCast.values()];
  let seed = 20260819;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const means: number[] = [];
  for (let it = 0; it < iters; it++) {
    const pooled: number[] = [];
    for (let g = 0; g < groups.length; g++) for (const d of groups[Math.floor(rnd() * groups.length)]!) pooled.push(d);
    means.push(meanOf(pooled));
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * iters)]!, means[Math.floor(0.975 * iters)]!];
}

// Grid runs to Infinity deliberately. `n / (n + K) -> 0` as `K -> inf`, so
// the last row IS the "conditional tier off for this class, fall back to the
// class marginal" arm — a candidate the sweep must be able to name, not an
// asymptote it stops short of. Session 50's k=2 diagnosis (a sparse table
// over-trusted) has "drop it entirely" as its limiting case, and a grid that
// ends at 64 cannot distinguish that from "smooth it a lot".
const SHRINK_GRID = [0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 16, 32, 64, 128, 512, Number.POSITIVE_INFINITY];

/**
 * Score ONE fixed candidate pair against the shared value — the honest gate.
 *
 * The sweep's argmin is re-fit on the same corpus it is scored on, so "the
 * argmin at 88 casts beats the shared value at 88 casts" is a weaker claim
 * than it looks. What ships is a FIXED pair, so what has to hold is that the
 * fixed pair beats the shared value at corpus sizes it was not chosen on.
 */
export function scoreFixedPair(casts: readonly Cast[], byClass: Partial<Record<StepClassT, number>>) {
  const { folds, turns } = buildFolds(casts);
  const shared = SHARED_SHRINKAGE_BASELINE;
  const base = scoreTurns(folds, turns, shared);
  const arm = scoreTurns(folds, turns, { ...shared, shrinkageKByClass: byClass });
  const diffs = arm.map((a, i) => ({ castId: a.castId, lastK: a.lastK, d: a.ll - base[i]!.ll }));
  const [lo, hi] = clusterCI(diffs);
  return {
    n: turns.length,
    baseLl: meanOf(base.map((r) => r.ll)),
    armLl: meanOf(arm.map((r) => r.ll)),
    baseHit: base.filter((r) => r.hit).length,
    armHit: arm.filter((r) => r.hit).length,
    d: meanOf(diffs.map((x) => x.d)),
    ci: [lo, hi] as [number, number],
  };
}

export function perClassShrinkageSweep(casts: readonly Cast[]) {
  const { folds, turns } = buildFolds(casts);
  const shared = SHARED_SHRINKAGE_BASELINE;
  const nByClass = new Map<number, number>();
  for (const t of turns) if (t.lastK !== null) nByClass.set(t.lastK, (nByClass.get(t.lastK) ?? 0) + 1);

  console.log(`\n── [session 51 §2] per-class shrinkageK, scored under the SHIPPED sticky path ──`);
  console.log(
    `  ${turns.length} scored transitions: k=1 ${nByClass.get(1) ?? 0}, k=2 ${nByClass.get(2) ?? 0}, no-lastK ${turns.filter((t) => t.lastK === null).length}`,
  );
  console.log(`  shipped shared value: shrinkageK=${shared.shrinkageK}, ringFloor=${shared.ringFloor}\n`);

  // Stage A — sweep one class at a time, the other held at the shipped value,
  // and READ each class's column only on its own turns.
  const picks = new Map<StepClassT, number>();
  for (const c of [1, 2] as StepClassT[]) {
    console.log(`  k=${c} turns only (n=${nByClass.get(c) ?? 0}):`);
    console.log(`    shrinkageK      top1    logLoss`);
    const rowsAt: { K: number; ll: number; acc: number }[] = [];
    for (const K of SHRINK_GRID) {
      const rows = scoreTurns(folds, turns, { ...shared, shrinkageKByClass: { [c]: K } }).filter((r) => r.lastK === c);
      rowsAt.push({ K, ll: meanOf(rows.map((r) => r.ll)), acc: (rows.filter((r) => r.hit).length / rows.length) * 100 });
    }
    const atShipped = rowsAt.find((r) => r.K === shared.shrinkageK)!;
    const unconstrained = rowsAt.reduce((a, b) => (b.ll < a.ll ? b : a));
    // SELECTION RULE — logLoss argmin subject to top-1 no worse than the
    // shipped shared value, not the bare argmin. Two reasons, both from this
    // repo's own history. (1) Session 45's gate on this very model required
    // BOTH columns to improve; a change that trades one for the other is a
    // different decision than the one that rule sanctioned, and it should not
    // be smuggled in under "logLoss dominates". (2) k=2's logLoss is FLAT
    // across 64..Infinity (spread 0.002 at n=150), so its bare argmin is
    // noise picking a point on a plateau — exactly what
    // `DEFAULT_RING_MODEL_OPTIONS`'s own comment says not to do.
    const feasible = rowsAt.filter((r) => r.acc >= atShipped.acc - 1e-9);
    const best = feasible.reduce((a, b) => (b.ll < a.ll ? b : a), atShipped);
    for (const r of rowsAt) {
      const mark = r.K === best.K ? " <-  PICK" : r.K === unconstrained.K ? "  (bare argmin)" : "";
      console.log(`    ${String(r.K).padStart(10)}   ${r.acc.toFixed(1).padStart(5)}%    ${r.ll.toFixed(3).padStart(6)}${mark}`);
    }
    picks.set(c, best.K);
    console.log(
      `    -> k=${c} PICK shrinkageK=${best.K} (logLoss ${best.ll.toFixed(3)}, top1 ${best.acc.toFixed(1)}%)  |  shipped ${shared.shrinkageK}: ${atShipped.ll.toFixed(3)} / ${atShipped.acc.toFixed(1)}%  |  bare argmin ${unconstrained.K}: ${unconstrained.ll.toFixed(3)} / ${unconstrained.acc.toFixed(1)}%\n`,
    );
  }

  // Stage B — the gate: both overrides at once, paired against the shared value.
  const byClass: Partial<Record<StepClassT, number>> = { 1: picks.get(1)!, 2: picks.get(2)! };
  const base = scoreTurns(folds, turns, shared);
  const arm = scoreTurns(folds, turns, { ...shared, shrinkageKByClass: byClass });
  const diffs = arm.map((a, i) => ({ castId: a.castId, lastK: a.lastK, d: a.ll - base[i]!.ll, dHit: (a.hit ? 1 : 0) - (base[i]!.hit ? 1 : 0) }));

  console.log(`── the GATE: paired ΔlogLoss, per-class {1:${byClass[1]}, 2:${byClass[2]}} vs shared ${shared.shrinkageK} ──`);
  console.log(
    `  shared:    logLoss ${meanOf(base.map((r) => r.ll)).toFixed(3)}   top1 ${base.filter((r) => r.hit).length}/${base.length} = ${((base.filter((r) => r.hit).length / base.length) * 100).toFixed(1)}%`,
  );
  console.log(
    `  per-class: logLoss ${meanOf(arm.map((r) => r.ll)).toFixed(3)}   top1 ${arm.filter((r) => r.hit).length}/${arm.length} = ${((arm.filter((r) => r.hit).length / arm.length) * 100).toFixed(1)}%`,
  );
  const [lo, hi] = clusterCI(diffs);
  const dAll = meanOf(diffs.map((d) => d.d));
  console.log(`\n  paired ΔlogLoss (per-class − shared): ${dAll >= 0 ? "+" : ""}${dAll.toFixed(3)}  [${lo.toFixed(3)}, ${hi.toFixed(3)}]  (negative = per-class better)`);
  const [hlo, hhi] = clusterCI(diffs.map((d) => ({ castId: d.castId, d: d.dHit })));
  const dHit = meanOf(diffs.map((d) => d.dHit));
  console.log(`  paired Δtop-1   (per-class − shared): ${dHit >= 0 ? "+" : ""}${(dHit * 100).toFixed(2)}pp  [${(hlo * 100).toFixed(2)}pp, ${(hhi * 100).toFixed(2)}pp]`);
  for (const c of [1, 2] as StepClassT[]) {
    const sub = diffs.filter((d) => d.lastK === c);
    if (sub.length === 0) continue;
    const [slo, shi] = clusterCI(sub);
    console.log(
      `    on k=${c} turns (n=${sub.length}): ΔlogLoss ${meanOf(sub.map((d) => d.d)) >= 0 ? "+" : ""}${meanOf(sub.map((d) => d.d)).toFixed(3)}  [${slo.toFixed(3)}, ${shi.toFixed(3)}]`,
    );
  }
  const pass = hi < 0;
  console.log(`\n  => §2 GATE ${pass ? "MET" : "NOT MET"} (paired ΔlogLoss CI ${pass ? "excludes" : "includes"} zero)`);

  // The re-fit argmin above is scored on the corpus it was chosen on. What
  // actually ships is the FIXED pair in `DEFAULT_RING_MODEL_OPTIONS`; print
  // it here so this script always shows the shipped value's own number, and
  // so a future corpus that moves the argmin away from the shipped pair is
  // visible in the same output rather than needing a second run.
  const shipped = DEFAULT_RING_MODEL_OPTIONS.shrinkageKByClass;
  const fixed = scoreFixedPair(casts, shipped ?? {});
  console.log(
    `\n  SHIPPED pair {1:${shipped?.[1]}, 2:${shipped?.[2]}} on this corpus: ΔlogLoss ${fixed.d >= 0 ? "+" : ""}${fixed.d.toFixed(3)} [${fixed.ci[0].toFixed(3)}, ${fixed.ci[1].toFixed(3)}]   top1 ${fixed.baseHit}/${fixed.n} -> ${fixed.armHit}/${fixed.n}` +
      `${JSON.stringify(shipped) === JSON.stringify(byClass) ? "" : "   (NOTE: differs from this corpus's re-fit pick above)"}\n`,
  );
  return { byClass, dAll, ci: [lo, hi] as [number, number], pass };
}

// Entry point LAST, deliberately. `main()` reaches `perClassShrinkageSweep`,
// which closes over module-level `const`s declared below the old call site —
// invoking main from the middle of the file threw a TDZ ReferenceError that
// importing the module (as the ad-hoc runners did) could never reproduce.
const isMain = process.argv[1]?.endsWith("fishingRingCV.ts");
if (isMain) main();
