/**
 * scripts/offPolicyReplay.ts — [session 47, brief §1b]
 *
 * "What would today's stack have done on the 69 casts we actually played?"
 * See `src/sim/fishing/offPolicyReplay.ts` for the design, the validity
 * argument, and the three conservatisms this report keeps flagging.
 *
 * Run `scripts/auditMovementIndependence.ts` FIRST — it is the precondition,
 * and this number means nothing if it fails.
 *
 * Usage: npx tsx scripts/offPolicyReplay.ts [--focus-reserve=N]
 */

import { loadCastTraces, isCleanTrace } from "../src/sim/fishing/castTrace.js";
import { replayCorpus, type ReplayReport } from "../src/sim/fishing/offPolicyReplay.js";
import { DEFAULT_FOCUS_RESERVE_WEIGHT } from "../src/strategy/fishing/cardChoice.js";

function pct(k: number, n: number): string {
  return n === 0 ? "n/a" : `${((100 * k) / n).toFixed(1)}%`;
}

/** Wilson score interval — same construction as `liveFishing.ts`'s `wilsonLowerBound`, two-sided. */
function wilson(k: number, n: number, z = 1.96): string {
  if (n === 0) return "[n/a]";
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return `[${(100 * Math.max(0, c - half)).toFixed(1)}%, ${(100 * Math.min(1, c + half)).toFixed(1)}%]`;
}

function pairedCI(diffs: number[]): string {
  const n = diffs.length;
  if (n < 2) return "n/a";
  const mean = diffs.reduce((s, d) => s + d, 0) / n;
  const sd = Math.sqrt(diffs.reduce((s, d) => s + (d - mean) ** 2, 0) / (n - 1));
  const half = (1.96 * sd) / Math.sqrt(n);
  return `${mean.toFixed(3)} ± ${half.toFixed(3)}  95% CI [${(mean - half).toFixed(3)}, ${(mean + half).toFixed(3)}]  (n = ${n}, sd ${sd.toFixed(3)})`;
}

/** McNemar's exact-ish paired comparison on the per-turn hit indicator. */
function mcnemar(report: ReplayReport): { b: number; c: number } {
  let b = 0;
  let c = 0;
  for (const r of report.results) {
    for (const t of r.turns) {
      if (t.hit && !t.actualHit) b++;
      else if (!t.hit && t.actualHit) c++;
    }
  }
  return { b, c };
}

function main() {
  const w = process.argv.find((a) => a.startsWith("--focus-reserve="));
  const focusReserveWeight = w ? Number(w.split("=")[1]) : DEFAULT_FOCUS_RESERVE_WEIGHT;

  const traces = loadCastTraces().filter(isCleanTrace);
  const report = replayCorpus(traces, { focusReserveWeight });
  // The decomposition: same policy, same predictor, same trajectories, but
  // shots resolved under the transposed zone template every recorded cast was
  // actually played in. The gap between this and the main arm is the zone fix;
  // the gap between this and what was actually played is the predictor and
  // the focus-reserve policy.
  const legacy = replayCorpus(traces, { focusReserveWeight, mismatchedZones: true });

  console.log(`\n▸ off-policy replay — today's stack against ${report.casts} real recorded casts\n`);
  console.log(`  focus-reserve weight ${focusReserveWeight}; ring model + contextual fallback, matcher tier OFF (it would leak);`);
  console.log(`  every cast scored against models refit WITHOUT it.\n`);

  console.log(`  ── catch rate`);
  console.log(`    counterfactual : ${report.caught}/${report.casts} = ${pct(report.caught, report.casts)}  ${wilson(report.caught, report.casts)}`);
  console.log(
    `    actually played: ${report.actuallyCaught}/${report.casts} = ${pct(report.actuallyCaught, report.casts)}  ${wilson(report.actuallyCaught, report.casts)}`,
  );
  console.log(`    (a LOWER BOUND — see the outcome mix below for how hard truncation bites)\n`);

  console.log(`  ── per-turn hit rate, on exactly the same turns`);
  console.log(`    counterfactual : ${report.hits}/${report.shots} = ${pct(report.hits, report.shots)}  ${wilson(report.hits, report.shots)}`);
  console.log(
    `    actually played: ${report.actualHits}/${report.actualShotsOnReplayedTurns} = ${pct(report.actualHits, report.actualShotsOnReplayedTurns)}  ${wilson(report.actualHits, report.actualShotsOnReplayedTurns)}`,
  );
  const { b, c } = mcnemar(report);
  console.log(`    discordant turns: new hit / old missed = ${b}; old hit / new missed = ${c}  (McNemar pair, n = ${b + c})\n`);

  console.log(`  ── paired per-turn log loss, baseline (contextualFallback) minus ring policy`);
  console.log(`    ${pairedCI(report.logLossDiffs)}`);
  console.log(`    positive favours the ring model. This arm is leave-one-cast-out, so it is NOT in-sample.\n`);

  console.log(`  ── outcome mix (why the bound is conservative)`);
  console.log(`    caught                ${report.caught}`);
  console.log(`    escaped (meter maxed) ${report.casts - report.caught - report.truncated - report.noAffordableCard - report.handExhausted}`);
  console.log(`    TRUNCATED at record   ${report.truncated}   <- would have played on; scored as not caught`);
  console.log(`    hand exhausted        ${report.handExhausted}   <- corpus can't say what would have been drawn`);
  console.log(`    no affordable card    ${report.noAffordableCard}\n`);

  console.log(`  ── decomposition: how much of the lift is the session-47 zone fix?`);
  console.log(`    catch rate     actually played ${pct(report.actuallyCaught, report.casts).padStart(6)}`);
  console.log(`                -> new predictor, OLD (transposed) zone geometry ${pct(legacy.caught, legacy.casts).padStart(6)}`);
  console.log(`                -> new predictor, corrected zone geometry        ${pct(report.caught, report.casts).padStart(6)}`);
  console.log(`    hit rate       actually played ${pct(report.actualHits, report.actualShotsOnReplayedTurns).padStart(6)}`);
  console.log(`                -> new predictor, OLD (transposed) zone geometry ${pct(legacy.hits, legacy.shots).padStart(6)}  (${legacy.hits}/${legacy.shots})`);
  console.log(`                -> new predictor, corrected zone geometry        ${pct(report.hits, report.shots).padStart(6)}  (${report.hits}/${report.shots})\n`);

  const stillAlive = report.results.filter((r) => (r.outcome === "truncated" || r.outcome === "hand_exhausted") && r.finalFishHp < r.fishMaxHp);
  console.log(`  ── of the ${report.truncated + report.handExhausted} casts cut short, ${stillAlive.length} were still live (fish HP below max) when the record ran out.`);
  if (stillAlive.length > 0) {
    const mean = stillAlive.reduce((s, r) => s + r.finalFishHp / r.fishMaxHp, 0) / stillAlive.length;
    console.log(`     mean fish HP at cutoff: ${(100 * mean).toFixed(1)}% of max (100% = escaped).`);
  }
  console.log("");
}

main();
