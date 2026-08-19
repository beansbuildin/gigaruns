/**
 * scripts/ringPredictionReport.ts — [session 45, brief §5.4] realized
 * predicted-vs-actual accuracy of this project's OWN next-cell predictor on
 * live play, read off `data/ringPrediction.jsonl` (written one row per turn
 * by `scripts/liveFishing.ts`).
 *
 * Why this and not catch rate. A live fishing batch small enough to afford is
 * far too small to settle a catch rate — at n=8 anything from 0 to 4 catches
 * is consistent with a 30% true rate. Per-TURN prediction accuracy accrues
 * 8-12 rows per cast instead of 1, so a 2-cast batch already yields ~20
 * scored predictions, and it answers the question that actually matters
 * after §1: did the movement model transfer out of the corpus and onto the
 * live board.
 *
 * Compares against `scripts/fishingRingCV.ts`'s leave-one-cast-out figures —
 * and does so PER STEP CLASS, because the two classes are very different
 * prediction problems (k=1: 4 ring cells and never reverses, LOO top-1 54.1%;
 * k=2: up to 8 ring cells, LOO top-1 38.2%). A live batch that happens to
 * draw one class must not be scored against the class-mixed number.
 *
 * [session 46, brief §1b/§1d] Three additions, all read off the same log:
 *
 *  1. **The paired comparison.** Rows now carry the shipped
 *     `contextualFallback` baseline's own numbers, scored on the SAME turn
 *     against the SAME fish. The decisive statistic is the paired mean
 *     log-loss DIFFERENCE (ring − baseline) with a CI, not two independent
 *     rates compared by eye — pairing removes between-fish variance
 *     entirely, and the offline gap of 2.4 nats is overwhelming at n≈200 if
 *     it transfers at all.
 *  2. **Per-class top-1 for BOTH predictors**, never pooled. Session 45's
 *     live batch drew two `k=2` casts, which is exactly why a pooled
 *     comparator misled.
 *  3. **A calibration curve** (§1d): the hit probability `chooseCard`
 *     assigned to the shot it actually played, bucketed, against the
 *     realized hit rate. This is the diagnostic that distinguishes "the
 *     model is fine, the binding constraint moved" from "focus placement is
 *     the defect" from "the model didn't generalize".
 *
 * Read-only.
 *
 * Usage: npx tsx scripts/ringPredictionReport.ts [path]
 */

import { loadRingPredictions, DEFAULT_RING_PREDICTION_LOG_PATH, type RingPredictionRecord } from "./liveFishing.js";

/**
 * Log loss of one row under one predictor, with the ZERO-PROBABILITY
 * convention pinned to `-log(1e-9)` ≈ 20.7 nats — the same floor
 * `fishingRingCV.ts` and `fishingContextualCV.ts` use, so live and offline
 * numbers are directly comparable. See SPEC-fishing.md §9's smoothing note:
 * an ε-smoothed convention charges ~6.7 nats for the same event instead, and
 * the choice moves the BASELINE's number by ~1.5 nats while leaving the ring
 * model's untouched (it has no zero-probability events by construction —
 * the ring floor). Stating the convention is what makes the comparison mean
 * something.
 */
function nats(p: number | undefined): number {
  return -Math.log(p !== undefined && p > 0 ? p : 1e-9);
}

/** Rows that carry a paired baseline — pre-session-46 rows are dropped from the paired arm rather than scored as a zero. */
function paired(rows: readonly RingPredictionRecord[]): RingPredictionRecord[] {
  return rows.filter((r) => r.baselinePActual !== undefined);
}

/**
 * Mean and normal-approximation 95% CI of the per-row difference. Paired, so
 * the SD is of the differences themselves — between-fish variance never
 * enters. Returns null below 2 rows, where an SD is undefined rather than
 * merely noisy.
 */
function meanDiffCI(diffs: readonly number[]): { mean: number; lo: number; hi: number; n: number } | null {
  const n = diffs.length;
  if (n < 2) return null;
  const mean = diffs.reduce((a, d) => a + d, 0) / n;
  const variance = diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / (n - 1);
  const half = 1.96 * Math.sqrt(variance / n);
  return { mean, lo: mean - half, hi: mean + half, n };
}

/** Wilson 95% interval — the same rule `liveFishing.ts`'s nextPosition override gate uses, rather than a normal approximation that misbehaves at small n or extreme p. */
function wilson(hits: number, n: number): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 0 };
  const z = 1.96;
  const p = hits / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: Math.max(0, (centre - spread) / d), hi: Math.min(1, (centre + spread) / d) };
}

function summarize(label: string, rows: readonly RingPredictionRecord[], reference?: string) {
  if (rows.length === 0) {
    console.log(`  ${label.padEnd(34)} (no rows)`);
    return;
  }
  const hits = rows.filter((r) => r.hit).length;
  const logLoss = rows.reduce((a, r) => a + -Math.log(r.pActual > 0 ? r.pActual : 1e-9), 0) / rows.length;
  const zeroP = rows.filter((r) => r.pActual <= 0).length;
  console.log(
    `  ${label.padEnd(34)} n=${String(rows.length).padStart(4)}  top1=${((hits / rows.length) * 100).toFixed(1).padStart(5)}%  logLoss=${logLoss.toFixed(3).padStart(7)}  zeroP=${zeroP}${reference ? `   [offline LOO: ${reference}]` : ""}`,
  );
}

function main() {
  const path = process.argv[2] ?? DEFAULT_RING_PREDICTION_LOG_PATH;
  const all = loadRingPredictions(path);
  const sinceArg = process.argv.find((a) => a.startsWith("--since="));
  const since = sinceArg ? sinceArg.slice("--since=".length) : null;
  const rows = since ? all.filter((r) => r.ts >= since) : all;
  console.log(`\n▸ ringPredictionReport.ts — ${path}${since ? `  (--since=${since})` : ""}`);
  console.log(`  ${rows.length} scored turn(s) across ${new Set(rows.map((r) => r.castId)).size} cast(s)\n`);
  if (rows.length === 0) {
    console.log("  nothing logged yet — run a live batch first.\n");
    return;
  }

  console.log("── overall ──");
  summarize("ALL tiers", rows);

  console.log("\n── by predictor tier ──");
  for (const tier of [...new Set(rows.map((r) => r.tier))].sort()) {
    summarize(tier, rows.filter((r) => r.tier === tier));
  }

  console.log("\n── ring tier, by step class (the class-matched comparison) ──");
  const ringRows = rows.filter((r) => r.tier === "ring" || r.tier === "matcher_ring");
  summarize("k=1", ringRows.filter((r) => r.stepClass === 1), "top1 54.1%, logLoss 0.803");
  summarize("k=2", ringRows.filter((r) => r.stepClass === 2), "top1 38.2%, logLoss 1.455");
  summarize("all classes", ringRows, "top1 46.4%, logLoss 1.118");

  // ---- [session 46, brief §1b] the paired comparison -----------------------
  const pairedRows = paired(rows);
  console.log("\n── PAIRED: ring vs. the shipped contextualFallback baseline ──");
  console.log(`  (same turns, same fish, same history — ${pairedRows.length} of ${rows.length} row(s) carry a baseline)`);
  if (pairedRows.length === 0) {
    console.log("  no paired rows yet — every row predates session 46's instrumentation.\n");
  } else {
    console.log("");
    console.log(`  ${"".padEnd(14)} ${"n".padStart(4)}  ${"ring top1".padStart(10)}  ${"base top1".padStart(10)}  ${"ring LL".padStart(8)}  ${"base LL".padStart(8)}  paired ΔLL (ring − base), 95% CI`);
    const classRow = (label: string, rs: readonly RingPredictionRecord[]) => {
      if (rs.length === 0) {
        console.log(`  ${label.padEnd(14)} ${"0".padStart(4)}  (no rows)`);
        return;
      }
      const ringTop1 = rs.filter((r) => r.hit).length / rs.length;
      const baseTop1 = rs.filter((r) => r.baselineHit).length / rs.length;
      const ringLL = rs.reduce((a, r) => a + nats(r.pActual), 0) / rs.length;
      const baseLL = rs.reduce((a, r) => a + nats(r.baselinePActual), 0) / rs.length;
      const ci = meanDiffCI(rs.map((r) => nats(r.pActual) - nats(r.baselinePActual)));
      const ciStr = ci
        ? `${ci.mean >= 0 ? "+" : ""}${ci.mean.toFixed(3)}  [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}]${ci.hi < 0 ? "  ✓ ring better" : ci.lo > 0 ? "  ✗ ring WORSE" : "  — inconclusive"}`
        : "(n<2)";
      console.log(
        `  ${label.padEnd(14)} ${String(rs.length).padStart(4)}  ${(ringTop1 * 100).toFixed(1).padStart(9)}%  ${(baseTop1 * 100).toFixed(1).padStart(9)}%  ${ringLL.toFixed(3).padStart(8)}  ${baseLL.toFixed(3).padStart(8)}  ${ciStr}`,
      );
    };
    classRow("k=1", pairedRows.filter((r) => r.stepClass === 1));
    classRow("k=2", pairedRows.filter((r) => r.stepClass === 2));
    classRow("unknown k", pairedRows.filter((r) => r.stepClass === null));
    classRow("ALL", pairedRows);
    console.log("");
    console.log("  Offline leave-one-cast-out comparators, per class — never the pooled 46.4%:");
    console.log("    k=1  ring top1 54.1% / LL 0.803      k=2  ring top1 38.2% / LL 1.455");
    console.log("    baseline (all classes) top1 42.7% / LL 3.536, 23 zero-probability events in 211");
    console.log(`  Zero-probability events here: ring ${pairedRows.filter((r) => r.pActual <= 0).length}, baseline ${pairedRows.filter((r) => (r.baselinePActual ?? 0) <= 0).length} (of ${pairedRows.length}).`);
  }

  // ---- [session 46, brief §1d] calibration --------------------------------
  const shots = rows.filter((r) => r.pHitPredicted !== undefined && r.realizedHit !== undefined);
  console.log("\n── CALIBRATION: predicted P(hit) of the shot actually played vs. realized ──");
  if (shots.length === 0) {
    console.log("  no rows carry a played-shot probability yet.\n");
  } else {
    const buckets: Array<[string, (p: number) => boolean]> = [
      ["0.00–0.20", (p) => p < 0.2],
      ["0.20–0.40", (p) => p >= 0.2 && p < 0.4],
      ["0.40–0.60", (p) => p >= 0.4 && p < 0.6],
      ["0.60–0.80", (p) => p >= 0.6 && p < 0.8],
      ["0.80–1.00", (p) => p >= 0.8],
    ];
    console.log(`  ${"bucket".padEnd(12)} ${"n".padStart(4)}  ${"mean pred".padStart(10)}  ${"realized".padStart(9)}  95% CI (Wilson)`);
    for (const [label, test] of buckets) {
      const rs = shots.filter((r) => test(r.pHitPredicted!));
      if (rs.length === 0) continue;
      const meanPred = rs.reduce((a, r) => a + r.pHitPredicted!, 0) / rs.length;
      const hits = rs.filter((r) => r.realizedHit).length;
      const w = wilson(hits, rs.length);
      console.log(
        `  ${label.padEnd(12)} ${String(rs.length).padStart(4)}  ${meanPred.toFixed(3).padStart(10)}  ${((hits / rs.length) * 100).toFixed(1).padStart(8)}%  [${(w.lo * 100).toFixed(1)}%, ${(w.hi * 100).toFixed(1)}%]`,
      );
    }
    const meanPred = shots.reduce((a, r) => a + r.pHitPredicted!, 0) / shots.length;
    const hits = shots.filter((r) => r.realizedHit).length;
    const w = wilson(hits, shots.length);
    console.log(
      `  ${"OVERALL".padEnd(12)} ${String(shots.length).padStart(4)}  ${meanPred.toFixed(3).padStart(10)}  ${((hits / shots.length) * 100).toFixed(1).padStart(8)}%  [${(w.lo * 100).toFixed(1)}%, ${(w.hi * 100).toFixed(1)}%]`,
    );
    console.log("");
    console.log("  Reading this (brief §1d): realized ≈ predicted with a low catch rate means the");
    console.log("  movement model is fine and the binding constraint is focus budget / deck / mana.");
    console.log("  Realized well BELOW predicted means focus placement is the defect — the policy is");
    console.log("  aiming at cells the model likes but cannot actually cover.");
  }

  console.log("\n── by cast ──");
  for (const castId of [...new Set(rows.map((r) => r.castId))]) {
    const rs = rows.filter((r) => r.castId === castId);
    const classes = [...new Set(rs.map((r) => r.stepClass).filter((c) => c !== null))];
    summarize(`cast ${castId} (k=${classes.join("/") || "?"})`, rs);
  }
  console.log("");
}

const isMain = process.argv[1]?.endsWith("ringPredictionReport.ts");
if (isMain) main();
