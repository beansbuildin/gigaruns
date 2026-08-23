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

import { loadCastTraces } from "../src/sim/fishing/castTrace.js";
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

  console.log("\n── §5  READ THIS BEFORE QUOTING ANY OF IT ──");
  console.log("  Redraw is CLOSED and nothing here reopens it. `redrawEnabled` ships false and is");
  console.log("  pinned false from both ends. This script measures a price; it does not license a");
  console.log("  policy, and rule 4 bars a live change on a sim result regardless.\n");
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

if (process.argv[1] && process.argv[1].endsWith("redrawCounterfactual.ts")) main();
