/**
 * scripts/auditZoneTemplate.ts — [session 47]
 *
 * Scores `geometry.ts`'s `ZONE_OFFSET` against every recorded play in the
 * fixture corpus: given the focus point actually submitted, the card actually
 * played, and the cell the fish actually occupied, did the template predict
 * the hit/miss the server actually returned?
 *
 * This is what found the transpose. The committed table scored 228/282; its
 * transpose scored 282/282, and `lastMovePath`'s cell indices independently
 * confirmed why (`position[0]` is the ROW — see `geometry.ts`'s header).
 * Committed and kept because the template had gone eleven sessions marked
 * CONFIRMED on a single symmetric-card capture with nothing checking it
 * against the corpus that accumulated afterwards.
 *
 * Re-run it as the corpus grows — that is what it is committed for. It also
 * scores the transpose alongside the live table, so a future regression shows
 * up as the two swapping places rather than as a bare count nobody can read.
 *
 * Usage: npx tsx scripts/auditZoneTemplate.ts
 */

import { loadCastTraces } from "../src/sim/fishing/castTrace.js";
import { auditZoneTemplate, TRANSPOSED_ZONE_OFFSET } from "../src/sim/fishing/zoneAudit.js";

function main() {
  const traces = loadCastTraces();
  const live = auditZoneTemplate(traces);
  const transposed = auditZoneTemplate(traces, TRANSPOSED_ZONE_OFFSET);

  console.log(`\n▸ zone-template audit — does ZONE_OFFSET predict the server's own hit/miss?\n`);
  console.log(`  plays scored: ${live.scored}   (crits included; a crit fires a HIT event, there is no CRIT event type)`);
  console.log(`  committed ZONE_OFFSET : ${live.correct}/${live.scored} correct`);
  console.log(`  its transpose         : ${transposed.correct}/${transposed.scored} correct`);
  if (live.mismatches.length > 0) {
    console.log(`\n  mismatches under the committed table (first 10):`);
    for (const m of live.mismatches.slice(0, 10)) {
      console.log(
        `    ${m.docId}#${m.turn}  card ${m.cardId} zones [${m.hitZones}]  focus (${m.focus.x},${m.focus.y})  ` +
          `fish (${m.fish.x},${m.fish.y})  predicted ${m.predicted}  actual ${m.actual}`,
      );
    }
  }
  console.log(
    `\n  ${live.correct === live.scored ? "✓ exceptionless — the template matches the server on every recorded play." : "✗ the template disagrees with the server; do not trust any hit-probability figure until this is resolved."}\n`,
  );
  if (live.correct !== live.scored) process.exitCode = 2;
}

main();
