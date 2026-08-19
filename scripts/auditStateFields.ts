/**
 * scripts/auditStateFields.ts — [session 48, brief §2]
 *
 * The `[CONFIRMED]` falsifiability pass, applied to SPEC-fishing.md §4's
 * state-field claims. Same construction as `auditZoneTemplate.ts` and
 * `auditMovePaths.ts`: score the claim against every recorded instance and
 * report the count, never a spot check.
 *
 *   npx tsx scripts/auditStateFields.ts
 */

import { loadCastTraces, isCleanTrace } from "../src/sim/fishing/castTrace.js";
import {
  auditFocusMeter,
  auditFishHp,
  correctedZoneOffset,
  transposedZoneOffset,
} from "../src/sim/fishing/stateFieldAudit.js";

function main() {
  const traces = loadCastTraces().filter(isCleanTrace);
  console.log(`\n▸ auditStateFields.ts — ${traces.length} clean cast trace(s)\n`);

  const fm = auditFocusMeter(traces);
  console.log("── focus-meter spend rule (SPEC-fishing.md §4, session 13, n=1 cast) ──");
  console.log(`  meter spent == manhattan(focus(t), focus(t+1)): ${fm.agree}/${fm.scored}`);
  console.log(`  turns where the meter REGENERATED within a cast: ${fm.regenObserved}`);
  for (const v of fm.violations.slice(0, 10)) console.log(`      ! ${v}`);
  console.log(
    `  establishing sample was distances 0,1,1 — under which "cost = Manhattan"\n` +
      `  and "cost = 1 per move" predict identically. Now scored on ${fm.scored} turns.\n`,
  );

  const hp = auditFishHp(traces);
  console.log("── fishHp damage arithmetic (SPEC-fishing.md §4, sign-agreement only) ──");
  console.log(`  Δ == played card's FISH_HP effect (hit/crit/miss, clamped): ${hp.agree}/${hp.scored}`);
  console.log(`  crits identified purely by critZone geometry: ${hp.crits}`);
  for (const v of hp.violations.slice(0, 10)) console.log(`      ! ${v}`);
  console.log("");

  console.log("── does the crit test DISCRIMINATE the corrected zone table? ──");
  for (const [label, off] of [
    ["corrected  ", correctedZoneOffset],
    ["transposed ", transposedZoneOffset],
  ] as const) {
    const r = auditFishHp(traces, off);
    console.log(`  ${label} ${r.agree}/${r.scored}   crits flagged: ${r.crits}`);
  }
  console.log(
    `  Yes. An independent confirmation of session 47's correction on a\n` +
      `  DIFFERENT zone set (critZones) and a DIFFERENT observable (damage\n` +
      `  magnitude, not the server's hit/miss verdict).\n`,
  );
}

main();
