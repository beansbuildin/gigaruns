/**
 * scripts/oilReachability.ts — [session 64 §1] Prints the oil-trigger
 * reachability report over the committed fishing corpus. Offline: reads
 * `fixtures/`, spends no cast, contacts no server.
 *
 *   npx tsx scripts/oilReachability.ts            # the correct definition
 *   npx tsx scripts/oilReachability.ts --lax      # drops "with a turn remaining"
 *
 * `--lax` is not an analysis mode. It exists so the gap between the two
 * readings can be SHOWN rather than asserted — see `src/sim/fishing/
 * oilReachability.ts` for why that clause is the whole question.
 */

import { loadFishingCorpus } from "../src/sim/fishingCorpus.js";
import { PAYLOAD_OIL_EFFECTS } from "../src/strategy/fishing/oilTiming.js";
import { reachabilityReport } from "../src/sim/fishing/oilReachability.js";

const lax = process.argv.includes("--lax");
const casts = loadFishingCorpus();
const r = reachabilityReport(casts, { requireTurnRemaining: !lax });
const pct = (n: number) => `${n} / ${r.casts} = ${((100 * n) / r.casts).toFixed(1)}%`;

console.log(`# on-demand oil-trigger REACHABILITY over the committed corpus`);
console.log(`definition: ${lax ? "LAX — 'with a turn remaining' DROPPED" : "STRICT — a decision point requires a later play_cards in the same cast"}`);
console.log(`oil model:  relaxing lethal at fishHp <= ${PAYLOAD_OIL_EFFECTS.fishDamage}; focus at focusMeter <= 0`);
console.log(``);
console.log(`casts                        ${r.casts}   (incomplete, under-reports: ${r.incomplete})`);
console.log(`decision points (turns)      ${r.totalDecisionPoints}`);
console.log(``);
console.log(`RELAXING reachable           ${pct(r.relaxingReachable)}   (${r.totalRelaxingPoints} turns)`);
console.log(`FOCUS    reachable           ${pct(r.focusReachable)}   (${r.totalFocusPoints} turns)`);
console.log(`either                       ${pct(r.eitherReachable)}`);
console.log(`both                         ${pct(r.bothReachable)}`);
console.log(`neither                      ${pct(r.neitherReachable)}`);

if (process.argv.includes("--per-cast")) {
  console.log(`\ndocId          turns  relax  focus  caught  incomplete`);
  for (const c of r.perCast.sort((a, b) => a.docId.localeCompare(b.docId))) {
    console.log(
      `${c.docId.padEnd(14)} ${String(c.decisionPoints).padStart(5)} ${String(c.relaxingPoints).padStart(6)} ${String(c.focusPoints).padStart(6)}  ${c.caught ? "yes" : "no "}     ${c.incomplete ? "yes" : "no"}`,
    );
  }
}
