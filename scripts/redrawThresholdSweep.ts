/**
 * scripts/redrawThresholdSweep.ts — Task 11 fishing-side sweep, session-21
 * brief §3. SPEC.md §5 says explicitly "tune the threshold in the sim, not
 * live" — this has never actually been run as a dedicated sweep before.
 * `REDRAW_THRESHOLD` (currently 0, `src/sim/fishing/castSim.ts`) traces back
 * to an informal session-13 sweep over {-∞, 0, 1, 2, 3, 5, 8} done while
 * fixing the `evPerMana`-vs-raw-EV bug (SPEC.md, session 12ish) — real
 * evidence, but never built as a standalone, re-runnable script with a full
 * reported curve and CIs, the way `potionTimingSweep.ts` is on the dungeon
 * side. This is that fishing-side analog.
 *
 * Zero energy cost — sim-only, mirrors `potionTimingSweep.ts`'s shape and
 * discipline: report the full curve, not just the winner, and check the
 * optimum isn't sitting on the boundary of whatever range gets tested.
 * `matcherPool` defaults to the full synthetic pool (matcher not forced
 * blind) — same setup the original session-13 sweep used, since this
 * question is about redraw/card-choice behavior, not matcher accuracy.
 *
 * Usage: npx tsx scripts/redrawThresholdSweep.ts [runs=2000]
 */
import { makeMatcherFishPolicy, simulateCasts } from "../src/sim/fishing/castSim.js";

const RUNS = Number(process.argv[2] ?? 2000);
const rule = (s: string) => `\n${"═".repeat(84)}\n${s}\n${"═".repeat(84)}`;

// Wide enough either side of the current default (0) and the session-13
// informal sweep's tested range ({-∞≈never-redraw, 0..8}) to see the curve
// turn over on BOTH sides, not just approach a boundary asymptotically.
const NEVER_REDRAW = -1_000_000;
const THRESHOLDS = [NEVER_REDRAW, -5, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5, 8, 12, 20];

interface Row {
  threshold: number;
  label: string;
  catchRate: number;
  ci95: number;
  meanTurns: number;
}

function ci95(p: number, n: number): number {
  return n < 2 ? 0 : 1.96 * Math.sqrt((p * (1 - p)) / n);
}

console.log(rule(`REDRAW THRESHOLD SWEEP — ${RUNS} casts each, matcher-ev policy`));
console.log(
  `\nCurrent DEFAULT_REDRAW_THRESHOLD in src/sim/fishing/castSim.ts is 0. This sweep checks\n` +
  `whether that's actually the optimum, not just an informal session-13 finding never\n` +
  `re-verified as a dedicated script.\n`,
);

const rows: Row[] = [];
for (const threshold of THRESHOLDS) {
  const policy = makeMatcherFishPolicy(threshold);
  const summary = simulateCasts(RUNS, { policy });
  rows.push({
    threshold,
    label: threshold === NEVER_REDRAW ? "never" : String(threshold),
    catchRate: summary.catchRate,
    ci95: ci95(summary.catchRate, RUNS),
    meanTurns: summary.meanTurns,
  });
}

console.log(`${"threshold".padEnd(12)}${"catch rate".padEnd(20)}mean turns`);
for (const r of rows) {
  console.log(
    `${r.label.padEnd(12)}${`${(r.catchRate * 100).toFixed(1)}% ± ${(r.ci95 * 100).toFixed(1)}`.padEnd(20)}${r.meanTurns.toFixed(2)}`,
  );
}

const best = rows.reduce((a, b) => (b.catchRate > a.catchRate ? b : a));
console.log(`\nBest: threshold=${best.label} at ${(best.catchRate * 100).toFixed(1)}% ± ${(best.ci95 * 100).toFixed(1)}`);

const isLowBoundary = best.threshold === THRESHOLDS[0];
const isHighBoundary = best.threshold === THRESHOLDS[THRESHOLDS.length - 1];
if (isLowBoundary || isHighBoundary) {
  console.log(
    `\nWARNING: best threshold sits on the ${isLowBoundary ? "low" : "high"} boundary of the tested range — ` +
    `the true optimum may lie further out. Extend THRESHOLDS and re-run before adopting.`,
  );
} else {
  console.log(`\nBest threshold is an interior point of the tested range (not a boundary artifact).`);
}

console.log(
  `\nCurrent config value (0): ${rows.find((r) => r.threshold === 0)?.catchRate !== undefined
    ? `${(rows.find((r) => r.threshold === 0)!.catchRate * 100).toFixed(1)}% ± ${(rows.find((r) => r.threshold === 0)!.ci95 * 100).toFixed(1)}`
    : "not in tested set"}`,
);
