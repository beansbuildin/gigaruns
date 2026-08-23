/**
 * scripts/matcherHeadroom.ts — [session 81, GATE 2]
 *
 * What the fishing matcher is worth, as a standing metric rather than a
 * one-off: a floor (aim at random), the shipped bot, and two ceilings (aim
 * with knowledge of where the fish will be, with and without free choice of
 * card). Every row is scored on the same plays, the same cards and the same
 * focus budget — only the aiming policy differs.
 *
 * Run it after any change to the matcher. The floor and the ceilings move only
 * when the CORPUS grows; the ACTUAL row is the only one a code change can
 * move, which is what makes this a scoreboard.
 *
 * The oracle rows use knowledge no policy has at decision time. They are a
 * ceiling to measure against and never a policy to ship (CLAUDE.md rule 4).
 *
 * Usage: npx tsx scripts/matcherHeadroom.ts
 */

import { loadCastTraces } from "../src/sim/fishing/castTrace.js";
import { assertHeadroomSelfConsistent, matcherHeadroom } from "../src/sim/fishing/matcherHeadroom.js";
import { auditZoneTemplate, RESOLUTION_READINGS } from "../src/sim/fishing/zoneAudit.js";

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

function bar(x: number, width = 40): string {
  return "█".repeat(Math.round(x * width));
}

function main() {
  const traces = loadCastTraces();
  const r = matcherHeadroom(traces);
  assertHeadroomSelfConsistent(traces, r);

  console.log(`\n▸ matcher headroom — what better next-cell prediction is worth\n`);
  console.log(
    `  ${r.plays} plays over ${r.casts} casts. Predicate: every transition whose resulting state carries a play,`,
  );
  console.log(`  whose handIndex resolves to a card in the pre-play hand, present in deckCardData. Nothing else filtered.`);
  console.log(`  ${r.oilRestored} plays had the focus meter restored by an oil mid-transition (budget read off the move).\n`);

  const rows: [string, number, string][] = [
    ["RANDOM      uniform over reachable focus", r.random, "floor — no prediction at all"],
    ["STAY-PUT    never move the focus", r.stayPut, "what the zones alone are worth"],
    ["ACTUAL      what the shipped bot did", r.actual, ""],
    ["ORACLE      same card, best focus", r.oracleSameCard, "ceiling for prediction"],
    ["ORACLE      best card in hand + best focus", r.oracleBestCard, "+ free card selection"],
  ];
  for (const [label, v, note] of rows) {
    console.log(`  ${label.padEnd(44)} ${pct(v).padStart(6)}  ${bar(v)}${note ? `  ← ${note}` : ""}`);
  }

  console.log(`\n  the matcher captures ${pct(r.capturedFraction)} of the available prediction headroom`);
  console.log(
    `    (${pct(r.actual)} − ${pct(r.random)}) / (${pct(r.oracleSameCard)} − ${pct(r.random)}), i.e. it is doing real work`,
  );
  console.log(`  ${(100 * r.headroomRemaining).toFixed(1)}pp of hit rate remain reachable with today's cards and budget`);
  console.log(`  card SELECTION is worth a further ${(100 * r.cardSelectionValue).toFixed(1)}pp on top — the smaller prize`);
  console.log(
    `  focus MOVEMENT is worth ${(100 * (r.actual - r.stayPut)).toFixed(1)}pp over never moving — prediction is load-bearing`,
  );

  // §5's distribution: is the miss structured (a tie-break away) or diffuse
  // (not tracking at all)? Measured from the shot's own footprint, so it is in
  // "how far off was the aim" units rather than "how far away was the fish".
  console.log(`\n  aim error on MISSES — distance from the shot's footprint to the fish's actual cell:`);
  const keys = [...r.missAimErrorHist.keys()].sort((a, b) => a - b);
  const missTotal = [...r.missAimErrorHist.values()].reduce((a, b) => a + b, 0);
  for (const k of keys) {
    const n = r.missAimErrorHist.get(k)!;
    console.log(`    ${k}  ${String(n).padStart(4)}  ${pct(n / missTotal).padStart(6)}  ${bar(n / missTotal, 30)}`);
  }
  console.log(
    `\n  ${r.noFootprint} plays (${pct(r.noFootprint / r.plays)}) had NO on-grid footprint at all — every zone of the card`,
  );
  console.log(
    `  translated off the board, so the shot could not hit whatever the fish did. All are misses, and ${r.noFootprintAvoidable}`,
  );
  console.log(`  of them were avoidable with the SAME card from a different reachable focus. Reported, not fixed (rule 4).`);
  console.log(`  These are excluded from the aim-error histogram above: there is no footprint to measure from.`);

  const near = (r.missAimErrorHist.get(1) ?? 0) / missTotal;
  console.log(
    `\n  ${pct(near)} of misses are ONE cell from the footprint. A concentrated distribution means the matcher is`,
  );
  console.log(`  nearly right and a better tie-break scores; a flat one means it is not tracking the fish at all.`);

  // The ceiling is only meaningful if the resolver underneath it is exact, so
  // the two are reported together rather than in separate places.
  const zone = auditZoneTemplate(traces);
  const wrong = auditZoneTemplate(traces, undefined, RESOLUTION_READINGS.previousFishPosition);
  console.log(
    `\n  resolver underneath: ${zone.correct}/${zone.scored} against the server` +
      `  (the previousFishPosition reading: ${wrong.correct}/${wrong.scored})`,
  );
  if (zone.correct !== zone.scored) {
    console.log(`  ✗ the resolver disagrees with the server — every rate above is unsafe to read.`);
    process.exitCode = 2;
  }
  console.log();
}

main();
