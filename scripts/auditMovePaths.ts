/**
 * scripts/auditMovePaths.ts — [session 48]
 *
 * Scores `data.lastMovePath` against the three unit-step identities in
 * `src/sim/fishing/movePathAudit.ts`, and prints the per-cast steps-per-turn
 * sequences that refute FACT 1's "constant `k` per cast" half.
 *
 * Same construction as `scripts/auditZoneTemplate.ts`: score the claim against
 * every recorded instance and report the count, never a spot check.
 *
 *   npx tsx scripts/auditMovePaths.ts
 */

import { loadCastTraces, isCleanTrace } from "../src/sim/fishing/castTrace.js";
import { auditMovePaths, stepCountsPerCast } from "../src/sim/fishing/movePathAudit.js";

function main() {
  const all = loadCastTraces();
  const clean = all.filter(isCleanTrace);
  console.log(`\n▸ auditMovePaths.ts — ${all.length} cast trace(s), ${clean.length} clean\n`);

  for (const [label, traces] of [
    ["ALL casts", all],
    ["clean casts only", clean],
  ] as const) {
    const r = auditMovePaths(traces);
    console.log(`── ${label} ──`);
    console.log(`  turns carrying a lastMovePath: ${r.scored}`);
    console.log(`  length == manhattan(prev, pos): ${r.lengthMatches}/${r.scored}`);
    console.log(`  path[last] == fishPosition:     ${r.endpointMatches}/${r.scored}`);
    console.log(`  every hop is a UNIT step:       ${r.allUnitSteps}/${r.scored}`);
    const hist = [...r.stepHistogram.entries()].sort((a, b) => a[0] - b[0]);
    console.log(`  steps-per-turn histogram:       ${hist.map(([k, n]) => `${k}:${n}`).join("  ")}`);
    if (r.violations.length > 0) {
      console.log(`  ✗ ${r.violations.length} violation(s):`);
      for (const v of r.violations.slice(0, 20)) {
        console.log(`      cast ${v.castId} turn ${v.turnIndex} path ${JSON.stringify(v.path)} len=${v.lengthMatches} end=${v.endpointMatches} unit=${v.allUnitSteps}`);
      }
    } else {
      console.log(`  ✓ zero exceptions`);
    }
    console.log("");
  }

  console.log("── FACT 1's constancy half: steps-per-turn, per cast ──");
  const counts = stepCountsPerCast(clean);
  const constant = counts.filter((c) => c.constant);
  const alternating = counts.filter((c) => c.alternating);
  const other = counts.filter((c) => !c.constant && !c.alternating);
  console.log(`  casts with a constant step count:  ${constant.length}/${counts.length}`);
  console.log(`  casts that strictly ALTERNATE:     ${alternating.length}/${counts.length}`);
  console.log(`  casts neither constant nor alternating: ${other.length}/${counts.length}`);
  for (const c of [...alternating, ...other]) {
    console.log(`      cast ${c.castId}: ${c.counts.join(",")}`);
  }
  console.log("");
}

main();
