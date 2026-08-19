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
 * Read-only.
 *
 * Usage: npx tsx scripts/ringPredictionReport.ts [path]
 */

import { loadRingPredictions, DEFAULT_RING_PREDICTION_LOG_PATH, type RingPredictionRecord } from "./liveFishing.js";

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
  const rows = loadRingPredictions(path);
  console.log(`\n▸ ringPredictionReport.ts — ${path}`);
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
