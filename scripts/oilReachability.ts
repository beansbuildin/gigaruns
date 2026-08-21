/**
 * scripts/oilReachability.ts — [session 64 §1] Prints the oil-trigger
 * reachability report over the committed fishing corpus. Offline: reads
 * `fixtures/`, spends no cast, contacts no server.
 *
 *   npx tsx scripts/oilReachability.ts                  # the correct definition
 *   npx tsx scripts/oilReachability.ts --lax            # drops "with a turn remaining"
 *   npx tsx scripts/oilReachability.ts --per-cast       # one line per cast
 *   npx tsx scripts/oilReachability.ts --gap            # [s66 §3] the lax-vs-strict gap BY CAST ID
 *   npx tsx scripts/oilReachability.ts --relaxing-cost  # [s66 §2] what zero Relaxing stock costs
 *
 * `--lax` is not an analysis mode. It exists so the gap between the two
 * readings can be SHOWN rather than asserted — see `src/sim/fishing/
 * oilReachability.ts` for why that clause is the whole question.
 */

import { loadFishingCorpus } from "../src/sim/fishingCorpus.js";
import { PAYLOAD_OIL_EFFECTS } from "../src/strategy/fishing/oilTiming.js";
import { castReachability, orderedResponses, reachabilityReport } from "../src/sim/fishing/oilReachability.js";
import { wilsonLowerBound } from "./liveFishing.js";

const lax = process.argv.includes("--lax");
const casts = loadFishingCorpus();

// ── [session 66 §2] --relaxing-cost: what holding ZERO Relaxing Oil costs ───
//
// The user is crafting more and dry-trigger counts stay in the recaps. A count
// of dry triggers is not actionable on its own; this converts it into an
// EXPECTED number of fish, so the answer to "how much crafting time is this
// worth?" is a number rather than a shrug. See
// `handoff/reports/session-66-relaxing-cost.md` for the write-up and the
// caveats, which are load-bearing: this is expected, not observed.
if (process.argv.includes("--relaxing-cost")) {
  const rows = casts.map((c) => castReachability(c, { requireTurnRemaining: true }));
  const reach = rows.filter((r) => r.relaxingReachable);
  const escapedReach = reach.filter((r) => !r.caught);
  const caughtAll = rows.filter((r) => r.caught).length;
  const gained = escapedReach.length;
  const oils = reach.length; // on-demand spends at the FIRST lethal point, so one oil per reachable cast
  const pp = (100 * gained) / casts.length;

  console.log(`# the EXPECTED cost of holding zero Mid Relaxing Oil (937)`);
  console.log(`corpus ${casts.length} casts, played WITHOUT any Relaxing Oil in stock\n`);
  console.log(`catch rate as played                  ${caughtAll}/${casts.length} = ${((100 * caughtAll) / casts.length).toFixed(1)}%`);
  console.log(`lethal trigger REACHABLE              ${reach.length}/${casts.length} = ${((100 * reach.length) / casts.length).toFixed(1)}%`);
  console.log(`  of those, CAUGHT anyway             ${reach.length - gained}`);
  console.log(`  of those, ESCAPED                   ${gained}   <- the only casts an oil could have converted`);
  console.log(``);
  console.log(`expected catches gained               ${gained} over ${casts.length} casts = +${pp.toFixed(2)}pp`);
  console.log(`oils that would have been spent       ${oils}`);
  console.log(`oils per extra fish                   ${(oils / Math.max(gained, 1)).toFixed(1)}`);
  console.log(`at the 20-cast daily cap              ${((20 * reach.length) / casts.length).toFixed(1)} oils/day, ${((20 * pp) / 100).toFixed(2)} extra fish/day`);
  console.log(``);
  // The interval matters more than the point estimate here: the numerator is
  // two casts. `wilsonLowerBound` is the project's own, reused rather than
  // re-implemented (`scripts/liveFishing.ts`); the upper bound is the same
  // formula with the margin added.
  const p = gained / casts.length;
  const z = 1.96;
  const n = casts.length;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  console.log(
    `95% Wilson interval on the gain     [${(100 * wilsonLowerBound(gained, n)).toFixed(1)}pp, ${(100 * (centre + margin)).toFixed(1)}pp]` +
      `   = ${(20 * (centre - margin)).toFixed(2)} to ${(20 * (centre + margin)).toFixed(2)} extra fish/day`,
  );
  console.log(``);
  console.log(`sim comparison (lethal-relaxing-only, n=8000): +4.47pp for 1821 oils = 0.196 extra catches/oil`);
  console.log(`corpus:                                        +${pp.toFixed(2)}pp for ${oils} oils = ${(gained / oils).toFixed(3)} extra catches/oil`);
  console.log(
    `\nPER-OIL the two agree closely. The HEADLINE pp does not, and the reason is trigger RATE:\n` +
      `the sim reaches the lethal band on ${((100 * 1821) / 8000).toFixed(1)}% of casts against this corpus's ${((100 * reach.length) / casts.length).toFixed(1)}%,\n` +
      `so +4.47pp is not transferable to live play. EXPECTED, not observed: the numerator is ${gained} casts.`,
  );
  process.exit(0);
}

// ── [session 66 §3] --gap: WHICH casts the lax reading adds, by docId ───────
//
// The session-65 recap said the lax-vs-strict Focus gap is "STILL exactly 14
// across three independent batches — structural, not sampling noise." A count
// holding across two readings is not a constant (CLAUDE.md rule 10's
// neighbour), and the arithmetic does not support the claim: 7 casts were
// added between the readings, so at the observed 13.7% gap rate ~0.96 new
// members were expected and adding zero has probability ~0.36. A one-in-three
// outcome is the most ordinary thing that could have happened.
//
// So this settles it by MEMBERSHIP instead of by count, and prints whatever
// the ids say.
if (process.argv.includes("--gap")) {
  const gap = casts
    .map((c) => ({
      cast: c,
      strict: castReachability(c, { requireTurnRemaining: true }),
      lax: castReachability(c, { requireTurnRemaining: false }),
    }))
    .filter((r) => r.lax.focusReachable && !r.strict.focusReachable);

  // Chronology by the server's own earliest `updatedAt`, so "the 7 added in
  // session 65" is read off the corpus rather than off a remembered list.
  const chronology = casts
    .map((c) => ({ docId: c.docId, first: orderedResponses(c)[0]?.updatedAt ?? "" }))
    .sort((a, b) => a.first.localeCompare(b.first));
  const newest7 = new Set(chronology.slice(-7).map((c) => c.docId));

  console.log(`# lax-vs-strict FOCUS gap — MEMBERSHIP, not count`);
  console.log(`corpus ${casts.length} casts; gap = ${gap.length}\n`);
  console.log(`docId          turns(lax/strict)  focusPts(lax)  caught  incomplete  in-newest-7`);
  for (const g of gap.sort((a, b) => a.cast.docId.localeCompare(b.cast.docId))) {
    console.log(
      `${g.cast.docId.padEnd(14)} ${String(g.lax.decisionPoints).padStart(6)}/${String(g.strict.decisionPoints).padEnd(6)} ` +
        `${String(g.lax.focusPoints).padStart(10)}   ${g.lax.caught ? "yes" : "no "}     ${g.lax.incomplete ? "yes" : "no "}        ` +
        `${newest7.has(g.cast.docId) ? "YES" : "no"}`,
    );
  }
  // What the 14 actually share, measured rather than eyeballed.
  const escaped = casts.filter((c) => !c.responses.some((r) => r.caughtFish !== null));
  const gapIds = new Set(gap.map((g) => g.cast.docId));
  const escapedInGap = escaped.filter((c) => gapIds.has(c.docId)).length;
  const terminalMeterZero = escaped.filter((c) => {
    const ordered = orderedResponses(c);
    const last = ordered[ordered.length - 1];
    return !!last && last.board.fishHp > 0 && last.board.focusMeter <= 0;
  });
  console.log(`\n-- the shared property, measured --`);
  // [session 69] **This line used to print "(0 can be in the gap...)" and that
  // claim was FALSIFIED by session 68's cast 13022748 — while the very table
  // above it listed the counterexample.** A summary line that contradicts its
  // own data is worse than no summary. The derivation was sound and its
  // premise dated: it assumed a cast ends on a `play_cards`, so the only state
  // the lax reading adds is the terminal `fishHp: 0` one. A lethal Relaxing
  // Oil ends a cast without a following play, and the added state is the
  // PRE-oil one — fish alive, meter empty, no turn remaining. Two such casts
  // now exist (13022748, 13024562), so this is the oil era's ordinary
  // behaviour rather than a freak.
  const caughtInGap = casts.filter(
    (c) => gapIds.has(c.docId) && c.responses.some((r) => r.caughtFish !== null),
  ).length;
  console.log(
    `casts CAUGHT                                   ${casts.length - escaped.length}   ` +
      `(${caughtInGap} in the gap — only reachable via an OIL-ENDED cast; see session 69)`,
  );
  console.log(`casts ESCAPED                                  ${escaped.length}`);
  console.log(`  of those, terminal state alive + meter <= 0  ${terminalMeterZero.length}`);
  console.log(`  of those, in the gap                         ${escapedInGap}`);
  console.log(
    `  of those, ALREADY focus-reachable strictly   ${terminalMeterZero.filter((c) => castReachability(c, { requireTurnRemaining: true }).focusReachable).length}` +
      `   (the meter had already hit zero with a turn still to play)`,
  );
  console.log(`gap members with exactly ONE extra turn        ${gap.filter((g) => g.lax.decisionPoints === g.strict.decisionPoints + 1).length} / ${gap.length}`);
  console.log(`gap members with exactly ONE lax focus point   ${gap.filter((g) => g.lax.focusPoints === 1).length} / ${gap.length}`);

  const fromNew = gap.filter((g) => newest7.has(g.cast.docId)).length;
  console.log(`\ngap members among the 7 most recent casts: ${fromNew}`);
  console.log(`gap members among the older ${casts.length - 7}:            ${gap.length - fromNew}`);
  console.log(
    `\nMembership is a PER-CAST property (castReachability reads one cast and nothing else),\n` +
      `and the corpus only grows, so gap(n=109) is a superset of gap(n=102). Equal counts therefore\n` +
      `IMPLY the same members — the set equality is arithmetic, not evidence of a shared mechanism.\n` +
      `What the count actually reports is that ${fromNew} of the 7 new casts landed in the gap.`,
  );
  process.exit(0);
}
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
