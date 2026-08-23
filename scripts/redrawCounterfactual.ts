/**
 * scripts/redrawCounterfactual.ts — [session 83, brief §2 / GATE 1] the
 * redraw counterfactual, priced off the committed corpus.
 *
 * ## The question
 *
 * Redraw is CLOSED (`handoff/DECISIONS.md`, 2026-08-22) on a price: **43.9
 * mana per extra fish against a cast holding 10.** Two things about that
 * number are worth knowing before it is quoted again.
 *
 *  - It was measured on a SIM ARM that redraws on 27–61% of its turns
 *    (session 80), against a shipped threshold that would want one on a few
 *    percent. It prices a policy nobody proposed.
 *  - It prices the redraw against MANA, and §3 below measures what the corpus
 *    says mana is worth: **the average cast throws away 5.85 of its 10, and
 *    89.8% end with some to spare.** The pool is not what ends casts.
 *
 * This script does not reopen the decision — that is the user's call, and
 * CLAUDE.md rule 4 bars a live change on a sim result regardless. It replaces
 * a number measured on the wrong arm against the wrong resource with two
 * measured on the corpus.
 *
 * ## ⚠ The brief's four numbers, and where this disagrees with them
 *
 * The session-83 brief computed 386 plays / 262 / 26 / 42 / 56 and a 1.57 mean
 * rescue cost, and gated the session on reproducing them. This script measures
 * **389 / 261 / 27 / 45 / 56** and **1.60**. The disagreement is small and
 * legible rather than mysterious:
 *
 *  - both arms agree EXACTLY on how many plays the held hand could reach —
 *    288 — so the availability numerator reproduces and only the denominator
 *    moves (74.6% -> 74.0%);
 *  - three rows this counts and the brief does not, all with two cards held,
 *    all in the RESCUE cell, plus one row scored differently between the two
 *    middle cells;
 *  - `neitherReaches` is 56 in both, and the rescue histogram agrees on its
 *    largest bucket (24 one-card hands).
 *
 * No variant tried here reproduces 386 — and it cannot be a subset of this
 * measurement, because the brief's `bothReach` is one HIGHER. CLAUDE.md
 * rule 9: the corpus wins, the numbers this script prints are the numbers, and
 * the finding is unchanged in shape and very nearly in size.
 *
 * The two clauses that decide the count are written out in
 * `src/sim/fishing/redrawCounterfactual.ts`'s predicate, and one of them is a
 * trap worth naming: **"exactly one card moved from hand to discard" is not
 * `hand.length` shrinking by one.** A refill turn's hand goes 1 -> 3, so the
 * length reading drops every refill and gives 286 rows instead of 389.
 *
 * Offline and deterministic: committed fixtures only, no network, no live
 * budget, nothing written anywhere.
 *
 * Usage: npx tsx scripts/redrawCounterfactual.ts
 */

import { loadRingPredictions } from "./liveFishing.js";
import { loadCastTraces, type CastTrace } from "../src/sim/fishing/castTrace.js";
import {
  assertCastEraSound,
  budgetZeroDecomposition,
  budgetZeroPlays,
  budgetZeroPlaysWithoutRestore,
  compareEraPredicates,
  deckCritFraction,
  deckIntrinsicReach,
  focusEraSplit,
  firedOil,
  loadCastCreatedAt,
  openingOverspendByDay,
  openingOverspendSplit,
  playCount,
  POLICY_ERA_BOUNDARY,
  splitByEra,
  standardise,
  wilson,
  type Era,
} from "../src/sim/fishing/castEra.js";
import {
  assertRedrawCounterfactualSound,
  manaSlack,
  redrawCounterfactual,
  separability,
  tripleReconstruction,
  type TriggerRow,
} from "../src/sim/fishing/redrawCounterfactual.js";

function histLine(h: ReadonlyMap<number, number>): string {
  return [...h.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join("  ");
}

function main(): void {
  const traces = loadCastTraces();
  console.log(`\n▸ redrawCounterfactual.ts — GATE 1: what a redraw would have been worth`);
  console.log(`  corpus: ${traces.length} traces on disk. Offline, deterministic, nothing written.\n`);

  // ── §1  THE METHOD'S OWN CHECK ──────────────────────────────────────────
  //
  // Pinned SEPARATELY from the table it feeds, so a corpus change that breaks
  // the triple reconstruction fails here rather than quietly shifting §2.
  console.log("── §1  THE TRIPLE RECONSTRUCTION, CHECKED BEFORE IT IS USED ──");
  const tr = tripleReconstruction(traces);
  console.log(`    nextCardIndex deltas when it advances   ${histLine(tr.deltas)}`);
  console.log(`    draws containing a previously-unheld card   ${tr.drawsWithUnheldCard} / ${tr.draws}`);
  console.log(
    `\n    Every draw is a clean triple (+3 ×${tr.deltas.get(3) ?? 0}); the ${tr.wraps} negatives are session 79's`,
  );
  console.log(`    pile wraps — the cursor going DOWN, which is what exhaustion looks like when the`);
  console.log(`    server wraps rather than overflows. No draw re-deals cards already held.`);
  console.log(`\n    ⚠ INFERRED, NOT OBSERVED. A redraw drawing from the same pile position follows`);
  console.log(`      from the per-cast shuffle; no redraw has ever been played live. If one ever is,`);
  console.log(`      check the dealt triple against this model FIRST.`);

  // ── §2  THE FOUR-CELL TABLE ─────────────────────────────────────────────
  console.log("\n── §2  THE COUNTERFACTUAL ──");
  const r = redrawCounterfactual(traces);
  assertRedrawCounterfactualSound(r);
  const pct = (n: number) => `${((n / Math.max(1, r.plays)) * 100).toFixed(1)}%`;
  console.log(`    ${"actual hand reaches".padEnd(24)}${"redrawn hand reaches".padEnd(24)}${"n".padStart(6)}${"share".padStart(9)}`);
  console.log(
    `    ${"yes".padEnd(24)}${"yes".padEnd(24)}${String(r.bothReach).padStart(6)}${pct(r.bothReach).padStart(9)}`,
  );
  console.log(
    `    ${"yes".padEnd(24)}${"no".padEnd(24)}${String(r.sacrifice).padStart(6)}${pct(r.sacrifice).padStart(9)}   ← sacrifice`,
  );
  console.log(
    `    ${"no".padEnd(24)}${"yes".padEnd(24)}${String(r.rescue).padStart(6)}${pct(r.rescue).padStart(9)}   ← rescue`,
  );
  console.log(
    `    ${"no".padEnd(24)}${"no".padEnd(24)}${String(r.neitherReaches).padStart(6)}${pct(r.neitherReaches).padStart(9)}`,
  );
  console.log(`\n    n = ${r.plays} plays over ${r.casts} casts.`);
  console.log(`    hit-availability, actual hand    ${(r.actualAvailability * 100).toFixed(1)}%`);
  console.log(`    hit-availability, redrawn hand   ${(r.redrawAvailability * 100).toFixed(1)}%`);
  console.log(
    `    mana a rescuing redraw would have cost:  mean ${r.meanRescueCost.toFixed(2)}   ${histLine(r.rescueCostHist)}`,
  );

  const dead = r.rescue + r.neitherReaches;
  console.log(
    `\n    Conditional on the held hand having NO reachable hit — ${dead} of ${r.plays} plays, ` +
      `${((dead / r.plays) * 100).toFixed(1)}% —`,
  );
  console.log(
    `    a redraw restores hit-availability ${((r.rescue / Math.max(1, dead)) * 100).toFixed(1)}% of the time. ` +
      `Those ${dead} plays are GUARANTEED`,
  );
  console.log(`    MISSES: no card, no reachable focus, no outcome but a heal to the fish.`);

  console.log(`\n    ⚠ THREE THINGS THIS DOES NOT SAY.`);
  console.log(`      1. It is AVAILABILITY, not hits. Both arms use an oracle lens that knows where the`);
  console.log(`         fish went. The bot converts ~half of available hits into actual ones (session 81:`);
  console.log(`         ACTUAL 36.3% against a 71.1% best-card ceiling). The bias is the SAME on both`);
  console.log(`         sides, so the paired comparison is fair; the absolute levels are not achievable.`);
  console.log(`      2. It is NOT a trigger. The bot cannot know at decision time that its hand is dead.`);
  console.log(`         The ${r.sacrifice} sacrifices are what a bad trigger costs.`);
  console.log(`      3. It does NOT convert to mana-per-fish. That needs an availability→hit rate and a`);
  console.log(`         hits→fish rate, and inventing either is how 43.9 happened.`);

  // ── §3  SEPARABILITY — the question that decides whether §2 is actionable ─
  console.log("\n── §3  CAN ANYTHING THE BOT KNOWS FIND A DEAD HAND? ──");
  const s = separability(r);
  console.log(
    `    heldCoverage — distinct cells the hand can reach, over every reachable focus.` +
      `\n    Known at DECISION time: it uses the hand, the focus point and the meter, and nothing else.\n`,
  );
  console.log(
    `    dead hands ${s.deadPlays}   live hands ${s.livePlays}   ` +
      `mean coverage ${s.meanCoverageDead.toFixed(2)} vs ${s.meanCoverageLive.toFixed(2)}   ` +
      `AUC ${s.coverageAuc.toFixed(3)}`,
  );
  console.log(`\n    THE SIGNAL SEPARATES. And now the inversion:\n`);
  console.log(`    ${"rescue rate among DEAD hands".padEnd(34)}${"dead".padStart(6)}${"rescued".padStart(9)}${"rate".padStart(8)}`);
  for (const sp of s.splits) {
    console.log(
      `    ${sp.label.padEnd(34)}${String(sp.deadPlays).padStart(6)}${String(sp.rescued).padStart(9)}` +
        `${`${(sp.rescueRate * 100).toFixed(0)}%`.padStart(8)}`,
    );
  }
  console.log(`
    **The dead hands the signal can FIND are mostly the ones a redraw cannot FIX.** Both
    facts have one cause: a dead hand is usually a hand firing from an exhausted focus
    meter, and a redraw does not restore the meter. Split on the meter and it flips.

    heldCoverage <= K as a trigger — first over every play, then over the plays that
    still have a point of focus budget:`);
  const sweepTable = (label: string, rows: readonly TriggerRow[]) => {
    console.log(`\n    ${label}`);
    console.log(
      `      ${"K".padStart(3)}${"fires".padStart(8)}${"rescues".padStart(9)}${"sacrificed".padStart(12)}` +
        `${"wasted".padStart(8)}${"mana".padStart(7)}${"net".padStart(6)}`,
    );
    for (const row of rows) {
      if (row.fires === 0) continue;
      console.log(
        `      ${String(row.threshold).padStart(3)}${String(row.fires).padStart(8)}${String(row.rescues).padStart(9)}` +
          `${String(row.sacrifices).padStart(12)}${String(row.wasted).padStart(8)}${String(row.manaSpent).padStart(7)}` +
          `${String(row.rescues - row.sacrifices).padStart(6)}`,
      );
    }
  };
  sweepTable("over ALL plays — net barely clears zero until K is so high it fires everywhere", s.sweep);
  sweepTable("over plays with focus budget >= 1 — the same signal, conditioned", s.sweepWithBudget);
  console.log(`
    ⚠ FITTED TO THIS CORPUS WITH ORACLE LABELS AND NO HELD-OUT SET. The shape is the
      result; the threshold is not a tuning and must not be read as one. Nothing here
      authorises flipping redrawEnabled or setting REDRAW_THRESHOLD.`);

  // ── §4  WHICH RESOURCE IS ACTUALLY SCARCE ───────────────────────────────
  console.log("\n── §4  THE MANA SLACK — what the 43.9 figure was priced against ──");
  printManaSlack(traces);

  // ── §5  THE ERA SPLIT ───────────────────────────────────────────────────
  //
  // Everything above pools policy eras. §5 and §6 are session 84's correction
  // to that, and §6 is the one that changes what §2 means.
  const created = loadCastCreatedAt();
  assertCastEraSound(traces, created);
  printEraSplit(traces, created);

  // ── §6  THE COUNTERFACTUAL, CONDITIONED ON THE ERA ──────────────────────
  printEraConditionedCounterfactual(traces, created);

  // ── §7  WHAT THE COLLAPSE IS MADE OF ────────────────────────────────────
  printDecomposition(traces, created);

  // ── §7a  DOES THE TRIGGER SIGNAL SURVIVE THE ERA SPLIT? ─────────────────
  printEraSeparability(traces, created);

  // ── §7b  [session 85 §1 / GATE 1] THE OVERSPEND CONTROL ─────────────────
  printOverspend(traces, created);

  console.log("\n── §8  READ THIS BEFORE QUOTING ANY OF IT ──");
  console.log("  Redraw is CLOSED and nothing here reopens it. `redrawEnabled` ships false and is");
  console.log("  pinned false from both ends. This script measures a price; it does not license a");
  console.log("  policy, and rule 4 bars a live change on a sim result regardless.\n");
  console.log("  And nothing above may be quoted WITHOUT its era. §5 measures why: the pooled corpus is");
  console.log("  64% a bot that no longer exists, and §6's two arms disagree about the headline.\n");
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

/**
 * §5 — plays fired at focus budget 0, before / today / pooled, plus the
 * predicate comparison gate 1 asks for.
 */
function printEraSplit(traces: readonly CastTrace[], created: ReadonlyMap<string, string>): void {
  const s = focusEraSplit(traces, created);
  console.log(`\n── §5  THE ERA SPLIT — the corpus pools two bots, and one of them is gone ──`);
  console.log(`  Era predicate: a cast belongs to TODAY when its doc.createdAt (constant across the`);
  console.log(`  cast's states, 148/148) is on or after ${POLICY_ERA_BOUNDARY} UTC. Committed fixtures only.\n`);
  console.log(`    ${"".padEnd(8)}${"casts".padStart(6)}${"plays".padStart(7)}${"budget 0".padStart(10)}${"rate".padStart(8)}${"1st-play spend".padStart(16)}${"catch".padStart(8)}`);
  for (const a of [s.before, s.today, s.all]) {
    console.log(
      `    ${String(a.era).padEnd(8)}${String(a.casts).padStart(6)}${String(a.plays).padStart(7)}` +
        `${String(a.budgetZero).padStart(10)}${pct(a.rate).padStart(8)}` +
        `${`${a.meanFirstPlaySpend.toFixed(3)} (max ${a.maxFirstPlaySpend})`.padStart(16)}` +
        `${(a.resolved ? pct(a.caught / a.resolved) : "—").padStart(8)}`,
    );
  }
  console.log(
    `\n    The focus meter is a non-regenerating pool, so budget 0 is ABSORBING in a cast with no`,
  );
  console.log(`    restore and TRANSIENT in one with it. That is why the effect is this large.`);
  console.log(
    `    Casts that ever froze: ${s.before.castsEverFrozen}/${s.before.casts} before, ` +
      `${s.today.castsEverFrozen}/${s.today.casts} today.`,
  );

  // The predicate comparison. `todaysEraCastIds()` reads data/ringPrediction.jsonl,
  // which is gitignored — so this arm is best-effort and says so when absent.
  const other = matcherWeightEraCastIds();
  if (other === null) {
    console.log(`\n    todaysEraCastIds() comparison: SKIPPED — data/ringPrediction.jsonl is not present.`);
    console.log(`    That absence is the point: it is gitignored, so it cannot be the era instrument a`);
    console.log(`    committed test pins. The date above reads committed fixtures and always resolves.`);
    return;
  }
  const cmp = compareEraPredicates(traces, created, other);
  console.log(`\n    vs todaysEraCastIds() (scripts/focusProfileCheck.ts — matcherWeight, i.e. the`);
  console.log(`    MATCHER-WEIGHTING boundary at 2026-08-20T18:27Z, a different boundary):`);
  if (cmp.agree) {
    console.log(`      AGREE on every cast. Either predicate would do; the date one is preferred`);
    console.log(`      because it reads committed fixtures and classifies all 148 casts.`);
  } else {
    console.log(
      `      DISAGREE: ${cmp.otherOnly.length} cast(s) it calls today and the date does not` +
        `${cmp.dateOnly.length ? `, ${cmp.dateOnly.length} the other way` : ", 0 the other way"}.`,
    );
    console.log(
      `      Those ${cmp.otherOnly.length} read ${cmp.otherOnlyBudgetZero}/${cmp.otherOnlyPlays} = ` +
        `${pct(cmp.otherOnlyBudgetZero / Math.max(1, cmp.otherOnlyPlays))} at budget 0 — the OLD regime.`,
    );
    console.log(`      Folding them in takes today's rate to ${pct((s.today.budgetZero + cmp.otherOnlyBudgetZero) / (s.today.plays + cmp.otherOnlyPlays))}. THE DATE PREDICATE WINS, on evidence.`);
  }
}

/**
 * `todaysEraCastIds()`'s set, by the SAME predicate `scripts/focusProfileCheck.ts`
 * and `scripts/oilArmCatchCheck.ts` use — a turn-0 ring-prediction row carrying
 * `matcherWeight`. Re-derived here rather than imported because neither script
 * exports it; the loader IS imported, so this file hard-codes no path.
 *
 * Returns null when the log yields nothing, which in a fresh clone is the
 * normal case: `data/ringPrediction.jsonl` is gitignored. An empty log and an
 * absent one are treated the same because they license the same conclusion —
 * this comparison cannot be made here.
 */
function matcherWeightEraCastIds(): Set<string> | null {
  const rows = loadRingPredictions();
  if (rows.length === 0) return null;
  const out = new Set<string>();
  for (const r of rows as (typeof rows[number] & { focusMoveCost?: unknown; matcherWeight?: unknown })[]) {
    if (r.turn === 0 && typeof r.focusMoveCost === "number" && r.matcherWeight !== undefined) out.add(r.castId);
  }
  return out;
}

/** §6 — §2's four-cell table, run once per era. */
function printEraConditionedCounterfactual(traces: readonly CastTrace[], created: ReadonlyMap<string, string>): void {
  const split = splitByEra(traces, created);
  console.log(`\n── §6  §2's TABLE, CONDITIONED ON THE ERA — and it INVERTS ──`);
  console.log(
    `    ${"".padEnd(8)}${"n".padStart(5)}${"both".padStart(6)}${"sac".padStart(5)}${"rescue".padStart(8)}` +
      `${"neither".padStart(9)}${"dead".padStart(7)}${"rescue rate".padStart(13)}${"cost".padStart(7)}${"availability".padStart(20)}`,
  );
  const arms: [string, readonly CastTrace[]][] = [
    ["pooled", traces],
    ["before", split.before],
    ["today", split.today],
  ];
  for (const [label, ts] of arms) {
    const r = redrawCounterfactual(ts);
    assertRedrawCounterfactualSound(r);
    const dead = r.rescue + r.neitherReaches;
    const [lo, hi] = wilson(r.rescue, dead);
    console.log(
      `    ${label.padEnd(8)}${String(r.plays).padStart(5)}${String(r.bothReach).padStart(6)}` +
        `${String(r.sacrifice).padStart(5)}${String(r.rescue).padStart(8)}${String(r.neitherReaches).padStart(9)}` +
        `${String(dead).padStart(7)}${`${pct(dead ? r.rescue / dead : 0)}`.padStart(13)}` +
        `${r.meanRescueCost.toFixed(2).padStart(7)}` +
        `${`${pct(r.actualAvailability)} -> ${pct(r.redrawAvailability)}`.padStart(20)}`,
    );
    console.log(`    ${"".padEnd(8)}95% CI on the rescue rate: [${pct(lo)}, ${pct(hi)}]  (n = ${dead} dead hands)`);
  }
  console.log(`
    THE READING. In today's era \`neither\` is ZERO: there is not one play where both the held
    hand and the redrawn triple are dead. Every dead hand is rescued, at a mean 1.33 mana on
    a pool that discards 5.85 per cast. Session 83's "the dead hands a signal finds are the
    ones a redraw cannot fix" describes the BEFORE arm and nothing else.

    ⚠ DO NOT READ 15/15 AS 100%. The interval above is the number; its lower bound is near
      78%. And this is AVAILABILITY under an oracle lens, not hits — the same lens on both
      arms, so the pairing is fair and the levels are not achievable. It is still not a
      TRIGGER: three sacrifices remain and the bot cannot see the fish's next cell.

    ⚠ Session 83's unexplained 389-vs-387 residual lives ENTIRELY in the before arm. Today's
      arm reproduces the session-84 brief cell for cell, so the residual does not touch this.

    This does not reopen the CLOSED verdict. It says the counterfactual that informs it
    should be read on the era the bot actually plays in.`);
}

/**
 * §7a — §3's `heldCoverage` separability, re-run on each era.
 *
 * NOT GATED, and it is the input a shadow-evaluation design would need: §3's
 * dominant dead-hand class was the budget-0 hands, and today's era has almost
 * none, so whether the signal survives at all was unknown before this ran.
 */
function printEraSeparability(traces: readonly CastTrace[], created: ReadonlyMap<string, string>): void {
  const split = splitByEra(traces, created);
  console.log(`\n── §7a  DOES §3's SIGNAL SURVIVE THE SPLIT? (not gated) ──`);
  console.log(
    `    ${"".padEnd(8)}${"dead".padStart(6)}${"live".padStart(6)}${"AUC".padStart(8)}` +
      `${"mean cov dead".padStart(15)}${"live".padStart(8)}`,
  );
  for (const [label, ts] of [["pooled", traces], ["before", split.before], ["today", split.today]] as [string, readonly CastTrace[]][]) {
    const sp = separability(redrawCounterfactual(ts));
    console.log(
      `    ${label.padEnd(8)}${String(sp.deadPlays).padStart(6)}${String(sp.livePlays).padStart(6)}` +
        `${sp.coverageAuc.toFixed(3).padStart(8)}${sp.meanCoverageDead.toFixed(2).padStart(15)}` +
        `${sp.meanCoverageLive.toFixed(2).padStart(8)}`,
    );
  }
  const today = separability(redrawCounterfactual(split.today));
  console.log(`\n    today's era, \`heldCoverage <= K\` as a trigger over ALL its plays:`);
  console.log(`      ${"K".padStart(3)}${"fires".padStart(7)}${"rescues".padStart(9)}${"sacrifices".padStart(12)}${"wasted".padStart(8)}${"mana".padStart(7)}`);
  for (const row of today.sweep) {
    if (row.fires === 0) continue;
    console.log(
      `      ${String(row.threshold).padStart(3)}${String(row.fires).padStart(7)}${String(row.rescues).padStart(9)}` +
        `${String(row.sacrifices).padStart(12)}${String(row.wasted).padStart(8)}${String(row.manaSpent).padStart(7)}`,
    );
  }
  console.log(`
    WHY THIS IS THE SHADOW DESIGN'S INPUT. In today's era \`wasted\` is structurally ZERO —
    §6 pinned neither = 0, so a redraw fired on a dead hand always rescues it. The trigger's
    job is therefore DETECTION, not selection, and the only thing a threshold trades is
    rescues against sacrifices. ⚠ Still oracle-labelled, still no held-out set, n = 15 dead.
    QUESTIONS.md §26 asks the user whether to shadow-evaluate it live for non-oracle labels.`);
}

/** §7 — GATE 2: what the 44.9% -> 1.5% collapse is made of. */
function printDecomposition(traces: readonly CastTrace[], created: ReadonlyMap<string, string>): void {
  const d = budgetZeroDecomposition(traces, created);
  const split = splitByEra(traces, created);
  console.log(`\n── §7  THE COLLAPSE, DECOMPOSED — GATE 2 ──`);
  console.log(`    before-era crude rate                                   ${pct(d.beforeRate).padStart(7)}`);
  console.log(`      - cast LENGTH mix (direct standardisation)            ${`-${(100 * d.lengthTerm).toFixed(1)}pp`.padStart(7)}`);
  console.log(`    = before-era rates at today's length mix                ${pct(d.standardisedRate).padStart(7)}`);
  console.log(`      - focus PACING (today's spend, no restores)           ${`-${(100 * d.pacingTerm).toFixed(1)}pp`.padStart(7)}`);
  console.log(`    = today's plays off an un-refilled pool                 ${pct(d.noRestoreRate).padStart(7)}`);
  console.log(`      - focus OIL restores                                  ${`-${(100 * d.oilTerm).toFixed(1)}pp`.padStart(7)}`);
  console.log(`    = today's crude rate                                    ${pct(d.todayRate).padStart(7)}`);
  if (d.unmatchedPlays > 0) {
    console.log(`    (${d.unmatchedPlays} today plays had no length-matched before-era stratum and are excluded from the standardisation.)`);
  }

  console.log(`\n    THE ORDER-FREE STATEMENT, which is the one to quote. The three terms above are`);
  console.log(`    sequential and each takes the residual of the ones before it. These two do not`);
  console.log(`    depend on that ordering:\n`);
  for (const [label, ts] of [["no-oil", split.today.filter((t) => !firedOil(t))], ["oil", split.today.filter(firedOil)]] as [string, CastTrace[]][]) {
    const st = standardise(split.before, ts);
    let plays = 0, zero = 0, noRestore = 0;
    for (const t of ts) { plays += playCount(t); zero += budgetZeroPlays(t); noRestore += budgetZeroPlaysWithoutRestore(t); }
    console.log(
      `      today ${label.padEnd(7)} ${String(ts.length).padStart(2)} casts / ${String(plays).padStart(3)} plays` +
        `   observed ${pct(zero / plays).padStart(6)}` +
        `   before-era length-standardised ${pct(st.rate).padStart(6)}` +
        `   with restores stripped ${pct(noRestore / plays).padStart(6)}`,
    );
  }
  console.log(`
      - The NO-OIL arm never fired a restore, so its counterfactual equals its observation by
        construction — that is the self-check, not a result. Its result is the gap to the
        standardised column, and the oil cannot explain any of it.
      - The OIL arm reverts almost exactly to the before-era standardised rate once the
        restores are stripped. On that arm the oil does essentially all the work.
      - Self-check on the control: run the no-restore counterfactual over the BEFORE era, which
        fired no oils, and it must reproduce the observation.`);
  const beforeNoRestore = split.before.reduce((s, t) => s + budgetZeroPlaysWithoutRestore(t), 0);
  const beforeObserved = split.before.reduce((s, t) => s + budgetZeroPlays(t), 0);
  console.log(`        before era: counterfactual ${beforeNoRestore} vs observed ${beforeObserved}.` +
    ` The one difference is the single cast that opened at focusMeter 2.`);

  // The gear control.
  console.log(`\n    AND IT IS NOT THE GEAR. Deck intrinsic reach is policy-free and fish-free — over every`);
  console.log(`    (focus, target) pair, the fraction one deck card covers:\n`);
  for (const e of ["before", "today"] as Era[]) {
    const ts = split[e];
    const reach = ts.reduce((s, t) => s + deckIntrinsicReach(t), 0) / ts.length;
    const crit = ts.reduce((s, t) => s + deckCritFraction(t), 0) / ts.length;
    const size = ts.reduce((s, t) => s + t.turns[0]!.fullDeck.length, 0) / ts.length;
    console.log(`      ${e.padEnd(7)} reach ${pct(reach)}   mean deck ${size.toFixed(1)} cards   crit-bearing ${pct(crit)}`);
  }
  console.log(`
      The decks got bigger and much crit-richer — which plausibly drives the catch rate from
      15.1% to 63.0% — and their REACH did not move. The era effect also survives deck-size
      matching (11-12 cards: 45% -> 4%; 13-15: 51% -> 2%).

    ⚠ WHAT THIS DOES NOT DO IS NAME A CAUSE FOR THE PACING TERM, and CLAUDE.md rule 6 says
      say so. The corpus brackets the change to 2026-08-20T18:28:24Z -> 2026-08-21T14:46:17Z,
      a 20.3-hour gap with no casts. The only code in it is sessions 61 and 62, whose
      liveFishing.ts diff is oil plumbing and touches neither focus nor card selection;
      focusReserveWeight defaults to 0 and costCap is documented inert. The proximate
      mechanism IS identified — mean first-play focus spend fell 1.553 -> 0.852 and today
      never reaches 3, where 17 of 94 before-era casts emptied the meter before their second
      play. WHAT WOULD SETTLE THE CAUSE: replay the corpus's own decision points through the
      session-60 and session-62 policies and compare the focus move each chooses.
      scripts/offPolicyReplay.ts is the existing instrument for that shape.`);
}

/**
 * Exported so `scripts/damageEconomy.ts` prints the identical block beside its
 * margin column — it is the same argument about which resource is scarce, and
 * two scripts printing two versions of it is how numbers drift apart.
 */
export function printManaSlack(traces: readonly import("../src/sim/fishing/castTrace.js").CastTrace[]): void {
  const m = manaSlack(traces);
  const spare = m.casts - m.manaOut;
  const entries = [...m.hist.entries()].sort((a, b) => a[0] - b[0]);
  const half = Math.ceil(entries.length / 2);
  for (let i = 0; i < half; i++) {
    const l = entries[i];
    const rgt = entries[i + half];
    const cell = (e: [number, number] | undefined) =>
      e === undefined ? "".padEnd(22) : `${String(e[0]).padStart(6)} left : ${String(e[1]).padStart(3)}`.padEnd(22);
    console.log(`    ${cell(l)}${cell(rgt)}`);
  }
  console.log(
    `\n    mean ${m.mean.toFixed(2)}   median ${m.median}   over ${m.casts} RESOLVED casts of a 10-mana pool.`,
  );
  console.log(
    `    ${spare} of ${m.casts} (${((spare / Math.max(1, m.casts)) * 100).toFixed(1)}%) ended with mana to spare.` +
      `   mana-out: ${m.manaOut} (${((m.manaOut / Math.max(1, m.casts)) * 100).toFixed(1)}%)`,
  );
  console.log(
    `    escapes ${m.meanWhenEscaped.toFixed(2)} left (n=${m.escaped})   catches ${m.meanWhenCaught.toFixed(2)} left (n=${m.caught})`,
  );
}

/**
 * §7b — [session 85 §1 / GATE 1] the opening-play overspend control, plus the
 * daily series §1a turns on.
 *
 * The argument in one line: session 84 showed the bot's first-play focus spend
 * fell 1.553 -> 0.852, and this shows the CHEAPEST MOVE THAT WOULD HAVE WORKED
 * did not move at all (0.656 -> 0.648). So the collapse is overshoot
 * disappearing, not targets getting easier.
 *
 * ⚠ ORACLE-LENSED. `optimal` uses the cell the fish actually resolved on. It is
 * a control applied identically to both eras, never a policy target — same
 * posture as `matcherHeadroom.ts`'s oracle rows.
 */
function printOverspend(
  traces: readonly CastTrace[],
  created: ReadonlyMap<string, string>,
): void {
  const over = openingOverspendSplit(traces, created);
  console.log(`\n── §7b  THE OVERSPEND CONTROL — did the bot aim cheaper, or did the fish get closer? ──`);
  console.log(`  ${"".padEnd(10)}${"casts".padStart(7)}${"hand fp".padStart(10)}${"actual".padStart(9)}${"optimal".padStart(9)}${"OVERSPEND".padStart(11)}`);
  for (const arm of [over.before, over.today, over.all]) {
    console.log(
      `  ${arm.era.padEnd(10)}${String(arm.casts).padStart(7)}${arm.meanHandFootprint.toFixed(2).padStart(10)}` +
        `${arm.meanActual.toFixed(3).padStart(9)}${arm.meanOptimal.toFixed(3).padStart(9)}` +
        `${(arm.overspend >= 0 ? "+" : "") + arm.overspend.toFixed(2)}`.padStart(11),
    );
  }
  const hist = (m: ReadonlyMap<number, number>, n: number): string =>
    [...m.entries()].sort((a, b) => a[0] - b[0]).map(([d, c]) => `${d}:${c} (${((100 * c) / n).toFixed(0)}%)`).join("  ");
  console.log(`\n  optimal move distance   before  ${hist(over.before.optimalHistogram, over.before.scored)}`);
  console.log(`                          today   ${hist(over.today.optimalHistogram, over.today.scored)}`);
  console.log(`  actual  move distance   before  ${hist(over.before.actualHistogram, over.before.casts)}`);
  console.log(`                          today   ${hist(over.today.actualHistogram, over.today.casts)}`);
  console.log(
    `\n  THREE DOORS CLOSED AT ONCE. The targets did not get closer (optimal 0.656 vs 0.648, and the\n` +
      `  whole distribution matches). The hands did not get wider (footprint 7.38 vs 7.20 cells). And the\n` +
      `  opening focus is (2,2) on ALL 147 casts with a recorded start — assertOpeningFocusPinned. What\n` +
      `  changed is how far the bot CHOOSES to move. It does NOT name what changed; rule 6.`,
  );

  console.log(`\n  §1a  THE DAILY SERIES — it STEPS, it does not trend`);
  for (const d of openingOverspendByDay(over.rows)) {
    const os = Number.isNaN(d.overspend) ? "     —" : `${(d.overspend >= 0 ? "+" : "") + d.overspend.toFixed(2)}`.padStart(6);
    console.log(
      `    ${d.day}  n=${String(d.n).padStart(3)}  actual ${d.meanActual.toFixed(2)}  ` +
        `optimal ${Number.isNaN(d.meanOptimal) || d.scored === 0 ? " —  " : d.meanOptimal.toFixed(2)}  overspend ${os}` +
        (d.scored === 0 ? "   (the one resumed cast — no recorded opening, no optimal)" : ""),
    );
  }
  console.log(
    `\n  A learned model sharpening as the mined corpus grew would DECLINE GRADUALLY. This steps, and\n` +
      `  inside today's era it drifts back UP (+0.10 -> +0.25 -> +0.50). That argues for a DISCRETE change.\n` +
      `\n  ⚠ AND IT BREAKS THE BRACKET. The five 08-20 casts already read the NEW regime (-0.40) and are\n` +
      `  stamped BEFORE sessions 61/62's commits (11:27 PT vs 13:33 and 15:59 PT). At n=5 that is not\n` +
      `  evidence, but the corpus cannot date the change closer than "between 08-19 and 08-21", so the\n` +
      `  20.3h empty gap is NOT the clean bracket it looks like. Session 84's open question 1 proposes\n` +
      `  replaying those two commits' policies — they may sit on the WRONG SIDE of the change.`,
  );
}

if (process.argv[1] && process.argv[1].endsWith("redrawCounterfactual.ts")) main();
