/**
 * scripts/damageEconomy.ts — [session 80, brief §1c, GATE 1] the per-play
 * `fishHp` drift, computed identically on the live corpus and in the simulator.
 *
 * ## The question, and why this is the right shape for it
 *
 * `scripts/lossDecomposition.ts` (session 48) wrote the decision table:
 *
 *   meter-outs dominate, focus hits 0 early   -> the focus budget, still
 *   meter-outs dominate, focus intact          -> the damage economy
 *   mana-outs dominate                         -> cast length / redraw policy
 *
 * The corpus selects the MIDDLE branch — see §1 below — and nothing in this
 * repo measured the middle branch's own quantity, which is not an outcome rate
 * at all. It is a drift:
 *
 *     E[Δ fishHp per play] = P(hit) × (−damage) + P(miss) × (+heal)
 *
 * A scalar, computed the same way on both sides, that separates the two things
 * an outcome rate confounds: **how often a shot lands** and **what a landed
 * shot is worth**. Session 80's brief eliminated the first — live per-shot hit
 * rate and the sim's shuffled baseline agree inside a point — so if the two
 * drifts disagree, the disagreement is in the arithmetic or in card selection,
 * and if they AGREE the gap is not in the per-play economy at all and the next
 * place to look is the terminal conditions.
 *
 * ## The predicate, stated so it can be audited
 *
 * BOTH halves measure the CLAMPED state-to-state delta — the change in the
 * `fishHp` a reader would see on two consecutive states — and not the effect
 * amount the card claims:
 *
 *  - live: consecutive `castTrace.ts` turn states, on every turn carrying a
 *    `play`. The corpus is every CLEAN trace on disk (`isCleanTrace`: has a
 *    `start_run`, never breaks position continuity).
 *  - sim: consecutive states emitted by `castSim.ts`'s `observeTurn`, which
 *    fires once per turn index plus the terminal state — the same shape a
 *    trace records, and the same hook `scripts/focusProfileCheck.ts` uses.
 *
 * Clamped on both sides is deliberate, and it is the choice that makes the
 * comparison honest rather than the choice that makes it convenient. The
 * server clamps `fishHp` at `fishMaxHp`, `castSim` clamps at the same place
 * (`Math.min(fishMaxHp, ...)`), and a terminal miss is the single most common
 * event in the fishery — measuring the live side unclamped against a sim side
 * that clamps would compare two different quantities on the event that
 * dominates. The live UNCLAMPED figures are reported alongside, off
 * `FISH_HP_DIFF`, so the size of the clamp is visible rather than hidden.
 *
 * ## ⚠ The brief's four numbers, and where this disagrees with them
 *
 * The session-80 brief measured 543 plays / 191 hits / 35.2% / 5.05 / 3.00 /
 * drift +0.166 and gated the session on reproducing them. This script measures
 * **548 plays / 191 hits / 34.9% / 5.05 / 2.99 / drift +0.192** on the corpus
 * as committed. Reproduced EXACTLY: the hit count (191), the damage histogram
 * (mode 5 at n=89, range 1–13), the heal mode and range (3, range 1–6), 130
 * casts, 38 catches. What differs is the denominator — five misses — under a
 * predicate the brief did not record and that no variant tried here reproduces
 * (dropping the unresolved cast, the terminal play, oil casts, or plays after
 * an oil all move it further). CLAUDE.md rule 9: the corpus wins, the number
 * this script prints is the number, and the finding is unchanged in sign and
 * very nearly in size — the live fish gains HP in expectation, at roughly a
 * fifth of a point per play.
 *
 * Offline and deterministic: fixtures plus the shipped simulator, no network,
 * no live budget, and nothing written anywhere.
 *
 * Usage: npx tsx scripts/damageEconomy.ts [--runs=N] [--profile=NAME]
 */

import { join } from "node:path";

import {
  assertShotsAccountedFor,
  corpusEconomy,
  corpusEconomyUnclamped,
  mean,
  modeOf,
  simEconomy,
  type Economy,
  type SimArm,
} from "../src/sim/fishing/damageEconomy.js";
import { makeMatcherFishPolicy, REDRAW_THRESHOLD, type CastOptions } from "../src/sim/fishing/castSim.js";
import { isCleanTrace, loadCastTraces } from "../src/sim/fishing/castTrace.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { buildCellOnlyMap, buildContextualMap } from "../src/strategy/fishing/contextualFallback.js";
import { buildStepClassTable } from "../src/strategy/fishing/stepClass.js";
import { loadMinedPatterns } from "./liveFishing.js";
import { printManaSlack } from "./redrawCounterfactual.js";
import { profileArg, resolveProfile } from "../src/profile.js";
import { REAL_DECK } from "../src/sim/fishing/rodDeck.js";
import { buildFishMaxHpSampler, fishMaxHpCounts, meanFishMaxHp, meanOpeningRatio } from "../src/sim/fishing/fishMaxHp.js";

/**
 * The real board, exactly as `focusProfileCheck.ts` and
 * `fishingEmpiricalAblation.ts` fix it. Same constants, so the three scripts
 * describe one simulator.
 *
 * ⚠ `fishMaxHp` is a CONSTANT here and a DISTRIBUTION live — eleven distinct
 * values over 132 opening hands, mean 18.3 (§5). The opening RATIO is right
 * (live 0.629 against 13/21 = 0.619); the variance is absent. That matters for
 * a threshold outcome like catch rate and matters very little for a per-play
 * drift, which is why the drift is the gate and the catch rate is not.
 */
const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;

/**
 * [session 85 §2 / GATE 2] See `scripts/focusProfileCheck.ts`'s constant of
 * the same name for the full argument. Short form: live runs at
 * `DEFAULT_FOCUS_RESERVE_WEIGHT = 3`, every sim arm has always run at 0, and
 * **0 stays the default here** so every drift and margin figure this script
 * has published remains reproducible. `--focus-reserve-weight=3` reruns the
 * arms under the shipped live weight for comparison only.
 */
const FOCUS_RESERVE_WEIGHT = Number(
  process.argv.find((a) => a.startsWith("--focus-reserve-weight="))?.split("=")[1] ?? 0,
);

/** One arm, at the real board, under the shipped policy. Every arm below differs from this by its `extra` alone. */
function arm(label: string, extra: Omit<CastOptions, "seed" | "policy">, runs: number): SimArm {
  const a = simEconomy(label, { policy: makeMatcherFishPolicy(REDRAW_THRESHOLD, true, FOCUS_RESERVE_WEIGHT), ...REAL_PARAMS, ...extra }, runs);
  assertShotsAccountedFor(a);
  return a;
}

/**
 * [session 81 §2] The hit rate at which the drift is exactly zero:
 * `drift = h·(−damage) + (1−h)·(+heal)` solves to `h* = heal / (damage + heal)`.
 * An arm's drift sign is entirely decided by which side of its own h* its hit
 * rate falls, so the distance to it — the MARGIN — is the comparable quantity
 * across arms and the raw drift is not.
 */
function breakEven(e: Economy): number {
  const denom = e.meanDamage + e.meanHeal;
  return denom === 0 ? 0 : e.meanHeal / denom;
}

function histLine(h: ReadonlyMap<number, number>): string {
  return [...h.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join("  ");
}

function printEconomy(e: Economy): void {
  const dm = modeOf(e.damageHist);
  const hm = modeOf(e.healHist);
  console.log(`  ${e.label}`);
  console.log(
    `    casts ${e.casts}   plays ${e.plays}   hit ${e.hits} (${(e.hitRate * 100).toFixed(1)}%)` +
      `   miss ${e.misses} (${((e.misses / Math.max(1, e.plays)) * 100).toFixed(1)}%)   unchanged ${e.unchanged}`,
  );
  console.log(
    `    damage on a hit  mean ${e.meanDamage.toFixed(2)}  mode ${dm.value} (n=${dm.n})` +
      `      heal on a miss  mean ${e.meanHeal.toFixed(2)}  mode ${hm.value} (n=${hm.n})`,
  );
  console.log(
    `    E[Δ fishHp / play] = ${e.hitRate.toFixed(3)} × (−${e.meanDamage.toFixed(2)}) + ` +
      `${(e.misses / Math.max(1, e.plays)).toFixed(3)} × (+${e.meanHeal.toFixed(2)}) = ` +
      `${e.drift >= 0 ? "+" : ""}${e.drift.toFixed(3)}`,
  );
}

function printRedrawLine(arm: SimArm): void {
  const redrawTurns = arm.turns - arm.shots;
  console.log(
    `    turns ${arm.turns}  =  ${arm.shots} plays + ${redrawTurns} REDRAWS ` +
      `(${((redrawTurns / Math.max(1, arm.turns)) * 100).toFixed(1)}% of turns, ` +
      `${(arm.redrawMana / Math.max(1, arm.economy.casts)).toFixed(2)} mana/cast of a ${REAL_PARAMS.startMana}-mana pool)` +
      `   — live: 0, structurally`,
  );
}

function main(): void {
  const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 4000);
  const traces = loadCastTraces().filter(isCleanTrace);

  console.log(`\n▸ damageEconomy.ts — GATE 1: the per-play fishHp drift, both sides, one predicate`);
  console.log(`  corpus: ${traces.length} clean traces on disk.  sim: n=${runs} per arm, seed base 1.\n`);

  // ── §1  WHICH BRANCH OF SESSION 48's TABLE THE CORPUS SELECTS ───────────
  console.log("── §1  THE LIVE LOSS DECOMPOSITION ──");
  let caught = 0;
  let fishFull = 0;
  let manaOut = 0;
  let other = 0;
  let focusIntactAtFull = 0;
  for (const t of traces) {
    const last = t.turns[t.turns.length - 1]!;
    if (t.caught) caught++;
    else if (last.fishHp >= last.fishMaxHp) {
      fishFull++;
      // "Focus intact" — the meter still had points AND the player still had
      // mana when the fish healed to full. This is the cell of session 48's
      // table that selects the damage economy over the focus budget.
      if (last.focusMeter > 0 && last.mana > 0) focusIntactAtFull++;
    } else if (last.mana <= 0) manaOut++;
    else other++;
  }
  const pct = (n: number) => `${((n / Math.max(1, traces.length)) * 100).toFixed(1)}%`;
  console.log(`    CAUGHT                                   ${String(caught).padStart(4)}   ${pct(caught)}`);
  console.log(`    ESCAPED, fish at full HP                 ${String(fishFull).padStart(4)}   ${pct(fishFull)}`);
  console.log(`    ESCAPED, mana exhausted                  ${String(manaOut).padStart(4)}   ${pct(manaOut)}`);
  console.log(`    unresolved (no terminal doc captured)    ${String(other).padStart(4)}   ${pct(other)}`);
  console.log(
    `\n    Of the ${fishFull} fish-at-full escapes, ${focusIntactAtFull} ended with BOTH focus and mana still in hand.`,
  );
  console.log(`    Session 48's table: meter-outs dominate, focus intact -> THE DAMAGE ECONOMY.`);
  console.log(`    ⚠ "fish at full HP" is what castSim calls escaped_fish_full. It is NOT focus exhaustion:`);
  console.log(`      the meter hits 0 and the cast CONTINUES, and 53% of CAUGHT casts end with it at 0.`);

  // ── §2  THE TWO ECONOMIES ───────────────────────────────────────────────
  console.log("\n── §2  THE LIVE ECONOMY ──");
  const live = corpusEconomy(traces);
  printEconomy(live);
  // The histograms are printed for the live half and only the live half: gate 1
  // asks for §1c's four numbers to be REPRODUCED before the sim half is quoted,
  // and a mean alone cannot be checked against a brief that also recorded the
  // mode and the range.
  console.log(`    damage histogram   ${histLine(live.damageHist)}`);
  console.log(`    heal histogram     ${histLine(live.healHist)}`);
  console.log("");
  printEconomy(corpusEconomyUnclamped(traces));

  const headroom = traces
    .filter((t) => t.turns.length > 0)
    .map((t) => t.turns[0]!.fishMaxHp - t.turns[0]!.fishHp);
  console.log(
    `\n    opening headroom (fishMaxHp − fishHp) mean ${mean(headroom).toFixed(1)} over ${headroom.length} casts` +
      `  ->  at ${live.meanHeal.toFixed(2)} per miss a cast tolerates ~${(mean(headroom) / live.meanHeal).toFixed(1)} NET misses.`,
  );

  console.log("\n── §3  THE SIMULATOR, SAME STATISTIC ──");
  const profile = resolveProfile(profileArg(process.argv));
  const transitionsPath = join(profile.dataRoot, "fish-patterns.jsonl");

  // The BARE arm — synthetic fish, no fallback tier, real held deck. This is
  // the arm every OIL-POLICY.md figure was computed in and the arm §0a
  // suspends, so it is the one the gate is about. It needs no `data/`.
  const bare = arm("SIM — bare default (synthetic fish, no fallback) — the oil sweeps' arm", { deckIds: [...REAL_DECK] }, runs);
  printEconomy(bare.economy);
  printRedrawLine(bare);

  // The BLIND arm — `matcherPool: []`, synthetic fish, real held deck. This is
  // `scripts/deckObjectiveSweep.ts`'s arm, and it is here because the session-80
  // brief eliminated hit geometry by comparing live's 35.2% against that
  // script's 36.42% baseline. The two arms above are not that arm. Running all
  // three side by side is what turns "the brief compared different things" from
  // an assertion into a measurement. (The sweep's own baseline is a 23-card
  // deck, not REAL_DECK, so its 36.42% is not expected to reproduce to the
  // digit — the point is which BAND this arm sits in.)
  const blind = arm("SIM — blind matcher (matcherPool: [], synthetic fish) — the deck sweep's arm", { deckIds: [...REAL_DECK], matcherPool: [] }, runs);
  console.log("");
  printEconomy(blind.economy);
  printRedrawLine(blind);

  // The LIVE-CONFIG arm — what `liveFishing.ts` actually wires. Needs the
  // profile's `data/`; skipped with a stated reason rather than silently when
  // it is absent, because a missing arm and an unrun arm read identically in a
  // transcript.
  let liveArm: SimArm | null = null;
  try {
    const records = loadTransitionRecords(transitionsPath);
    const cleanCasts = groupByCast(records).filter(isCleanCast);
    if (cleanCasts.length === 0) throw new Error(`no clean casts in ${transitionsPath}`);
    liveArm = arm(
      "SIM — live config (mined + contextual fallback, empirical fish)",
      {
        empiricalFish: { table: buildStepClassTable(cleanCasts) },
        matcherPool: loadMinedPatterns(),
        deckIds: [...REAL_DECK],
        blindFallback: { contextMap: buildContextualMap(cleanCasts), cellOnlyMap: buildCellOnlyMap(cleanCasts) },
      },
      runs,
    );
    console.log("");
    printEconomy(liveArm.economy);
    printRedrawLine(liveArm);
  } catch (err) {
    console.log(`\n  SIM — live config: NOT RUN — ${(err as Error).message}`);
    console.log(`    It reads ${transitionsPath}, which is gitignored. In a fresh clone only the bare arm runs.`);
  }

  console.log(
    `\n  ⚠ THE REDRAW LINE IS NOT A FOOTNOTE. The live bot CANNOT redraw — \`redrawEnabled\` ships false in\n` +
      `  liveFishing.ts and no live cast in the corpus contains one, which is why all 548 live turns are\n` +
      `  plays. The simulator redraws on a quarter to a third of its turns, spending mana the live bot\n` +
      `  never spends and buying observations the live bot never buys (session 76 §3 priced that term at\n` +
      `  hit rate 35.6% -> 45.4% between redraw arms). Every figure either arm produces is a figure from\n` +
      `  a policy that is not the shipped one. This is REPORTED, not fixed: turning the sim's redraw off\n` +
      `  would move every pinned number in the repo, and CLAUDE.md rule 4 puts that behind a gate of its own.`,
  );

  // ── §4  THE COMPARISON, AND WHICH TERM CARRIES IT ───────────────────────
  console.log("\n── §4  THE COMPARISON ──");
  const rows: { label: string; e: Economy }[] = [
    { label: "LIVE (corpus)", e: live },
    { label: "SIM bare", e: bare.economy },
    { label: "SIM blind", e: blind.economy },
    ...(liveArm ? [{ label: "SIM live-config", e: liveArm.economy }] : []),
  ];
  console.log(
    `  ${"".padEnd(18)}${"plays".padStart(8)}${"hit%".padStart(9)}${"dmg".padStart(8)}${"heal".padStart(8)}` +
      `${"h*".padStart(9)}${"margin".padStart(10)}${"drift".padStart(10)}`,
  );
  for (const { label, e } of rows) {
    const bp = breakEven(e);
    const m = e.hitRate - bp;
    console.log(
      `  ${label.padEnd(18)}${String(e.plays).padStart(8)}${(e.hitRate * 100).toFixed(1).padStart(9)}` +
        `${e.meanDamage.toFixed(2).padStart(8)}${e.meanHeal.toFixed(2).padStart(8)}` +
        `${(bp * 100).toFixed(1).padStart(9)}${`${m >= 0 ? "+" : ""}${(m * 100).toFixed(1)}pp`.padStart(10)}` +
        `${`${e.drift >= 0 ? "+" : ""}${e.drift.toFixed(3)}`.padStart(10)}`,
    );
  }
  console.log(`
  **h* is the break-even hit rate, heal / (damage + heal), and MARGIN is hit% minus it.**
  [session 81 §2] The whole table is one equation: drift = h·(−damage) + (1−h)·(+heal), which
  is zero exactly at h*. Read the MARGIN column, not the drift column.

  Two arms can match on the SIGN of the drift and match on nothing else. The blind arm clears
  zero the way live does, but for a different reason: its damage is low (lifting its break-even),
  not its hit rate — its hit rate is well ABOVE live's. **Matching a sign is not matching a
  mechanism.**

  The fishery is a knife-edge and the shipped bot sits a couple of points on the wrong side of
  it. That is the whole of the catch-rate chasm, and it is also why catch rate has been such an
  unstable instrument: near h* it is a step function.

  ⚠ THE BARE ARM'S MARGIN IS THE REASON ITS FIGURES MAY NOT BE QUOTED. An arm clearing its own
  break-even by forty-odd points is not a noisy model of this fishery — it is a different
  fishery, one in which the fish essentially cannot escape. Every OIL-POLICY §0a figure,
  +19.40pp included, was computed there. It is kept, and marked, so nobody re-quotes it by
  accident. Do not silently re-home that work onto another arm either: the live-config arm is
  closer and still on the wrong side of the line, so it would produce a different unsupported
  number rather than a supported one. **An arm becomes admissible when its margin brackets
  live's within a stated band. None currently does.**`);

  // ── §4a  THE OTHER RESOURCE, AND WHY IT SITS HERE ───────────────────────
  //
  // [session 83, brief §1c / GATE 2] The margin column above says the fishery
  // is decided at the fish's HP — the drift is a knife-edge and the shipped
  // bot sits on the wrong side of it. This block is the same argument from the
  // other end: the resource the bot is NOT short of.
  //
  // It lives beside the margin column deliberately, and is printed by
  // `scripts/redrawCounterfactual.ts`'s exported helper rather than
  // re-implemented, so the two reports cannot drift apart. Together they say
  // which scarcity a policy should be priced against — and the price that
  // closed redraw (43.9 mana per extra fish, DECISIONS 2026-08-22) was quoted
  // against the abundant one.
  console.log("\n── §4a  THE MANA SLACK — the resource that is NOT scarce ──");
  // Unfiltered on purpose, and it is the ONE block here that is: every other
  // figure on this page needs a replayable trajectory and so takes
  // `isCleanTrace`, but "how much mana was left when the cast ended" needs
  // only the terminal doc. A cast that broke position continuity half way
  // through still ended where it ended, and dropping it would answer a
  // narrower question than the one asked. Same predicate as
  // `scripts/redrawCounterfactual.ts` §3, which is the point of sharing the
  // printer.
  printManaSlack(loadCastTraces());
  console.log(`
  The pool is not what ends casts: ${live.misses} of ${live.plays} plays are misses and a miss HEALS the
  fish, against an opening headroom of ${mean(headroom).toFixed(1)} HP. Mana is what a cast has left over.
  **Read this next to the MARGIN column, not instead of it.** A policy that spends mana to
  avoid a miss is spending the abundant resource on the scarce one; whether any such policy
  is triggerable is a separate question and is not answered here.`);

  // The decomposition: hold two of the three terms at the live value and swap
  // in the sim's, one at a time. This says WHICH term carries the difference
  // rather than that there is one — the whole reason a drift beats an outcome
  // rate as a diagnostic.
  for (const { label, e } of rows.slice(1)) {
    // `unchanged` is 0 on both sides by construction now — live has no non-play
    // turns and the sim's are excluded and asserted — so the miss rate is the
    // complement and this is an exact decomposition, not an approximation.
    const missRate = (x: Economy) => 1 - x.hitRate - x.unchanged / Math.max(1, x.plays);
    const driftWith = (h: number, d: number, m: number, mr: number) => h * -d + mr * m;
    const base = driftWith(live.hitRate, live.meanDamage, live.meanHeal, missRate(live));
    const swapHit = driftWith(e.hitRate, live.meanDamage, live.meanHeal, missRate(e));
    const swapDmg = driftWith(live.hitRate, e.meanDamage, live.meanHeal, missRate(live));
    const swapHeal = driftWith(live.hitRate, live.meanDamage, e.meanHeal, missRate(live));
    console.log(`\n  ${label} — one term at a time, starting from live's ${base >= 0 ? "+" : ""}${base.toFixed(3)}:`);
    console.log(`    swap in its HIT RATE   ${(e.hitRate * 100).toFixed(1)}%  ->  ${swapHit >= 0 ? "+" : ""}${swapHit.toFixed(3)}   (Δ ${(swapHit - base).toFixed(3)})`);
    console.log(`    swap in its DAMAGE     ${e.meanDamage.toFixed(2)}   ->  ${swapDmg >= 0 ? "+" : ""}${swapDmg.toFixed(3)}   (Δ ${(swapDmg - base).toFixed(3)})`);
    console.log(`    swap in its HEAL       ${e.meanHeal.toFixed(2)}   ->  ${swapHeal >= 0 ? "+" : ""}${swapHeal.toFixed(3)}   (Δ ${(swapHeal - base).toFixed(3)})`);
    console.log(`    all three (its own drift)      ->  ${e.drift >= 0 ? "+" : ""}${e.drift.toFixed(3)}`);
  }

  // ── §4b  THE VERDICT, COMPUTED ──────────────────────────────────────────
  //
  // Named by the arithmetic rather than by the author. The brief's §1b
  // eliminated hit geometry as a cause; if the dominant term below is the hit
  // rate, that elimination is wrong and the recap has to say so.
  console.log("\n── §4b  VERDICT ──");
  for (const { label, e } of rows.slice(1)) {
    const missRate = (x: Economy) => 1 - x.hitRate;
    const driftWith = (h: number, d: number, m: number, mr: number) => h * -d + mr * m;
    const base = driftWith(live.hitRate, live.meanDamage, live.meanHeal, missRate(live));
    const terms: { name: string; delta: number }[] = [
      { name: "HIT RATE", delta: driftWith(e.hitRate, live.meanDamage, live.meanHeal, missRate(e)) - base },
      { name: "DAMAGE PER HIT", delta: driftWith(live.hitRate, e.meanDamage, live.meanHeal, missRate(live)) - base },
      { name: "HEAL PER MISS", delta: driftWith(live.hitRate, live.meanDamage, e.meanHeal, missRate(live)) - base },
    ];
    const dominant = terms.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a));
    const share = Math.abs(dominant.delta) / terms.reduce((a, t) => a + Math.abs(t.delta), 0);
    console.log(
      `  ${label.padEnd(16)} drift ${e.drift >= 0 ? "+" : ""}${e.drift.toFixed(3)} against live's ` +
        `+${live.drift.toFixed(3)}  —  dominant term: ${dominant.name} ` +
        `(${(share * 100).toFixed(0)}% of the total absolute term movement)`,
    );
  }
  console.log("");
  console.log("  The per-card AMOUNTS are not the fault and cannot be: they are read from");
  console.log("  fixtures/fishing-casts/cards.json, a real capture, and every arm reproduces live's");
  console.log("  5.05 damage / 2.99 heal to within a tenth. What differs is HOW OFTEN A SHOT LANDS.");
  console.log("");
  console.log("  ⚠ THE SESSION-80 BRIEF'S §1b IS WRONG, AND THIS IS THE MEASUREMENT THAT SAYS SO.");
  console.log("  It eliminated hit geometry by putting live's 35.2% next to \"the sim's shuffled");
  console.log("  baseline\" of 36.42%. That figure is deckObjectiveSweep.ts's baseline, which runs");
  console.log("  matcherPool: [] on a 23-card deck — the BLIND row above. The arms that produce");
  console.log("  OIL-POLICY §0a's catch and meter-out figures are the other two, and they land shots");
  console.log("  at 80.8% and 42.1% against a live 34.9%. Two different arms were compared and the");
  console.log("  conclusion was carried across. Hit geometry is NOT eliminated; on this evidence it");
  console.log("  is the whole gap.");
  console.log("");
  console.log("  The BLIND arm is the one that reproduces live's SIGN (+0.317 against +0.192), and it");
  console.log("  is also the arm that redraws 61% of its turns and therefore plays half as many cards");
  console.log("  per cast as the others. Do not read it as \"the good arm\" on the strength of one");
  console.log("  matching scalar — read it as where the next question is.");

  // ── §5  fishMaxHp: A DISTRIBUTION LIVE, A CONSTANT IN THE SIM ───────────
  console.log("\n── §5  fishMaxHp ──");
  const counts = fishMaxHpCounts(traces);
  console.log(
    `  live, per cast:  ${[...counts.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join("  ")}`,
  );
  console.log(
    `  ${counts.size} distinct values, mean ${meanFishMaxHp(traces).toFixed(2)}, against the sim's fixed ` +
      `${REAL_PARAMS.fishMaxHp}. Opening ratio ${meanOpeningRatio(traces).toFixed(4)} against 13/21 = ${(13 / 21).toFixed(4)}.`,
  );
  console.log(`  The CENTRE is close and the SPREAD is absent. Catch is a threshold outcome, so a`);
  console.log(`  fixed-HP sim understates the result spread on both tails at once.`);
  if (process.argv.includes("--sample-fish-max-hp")) {
    const sampled = arm("SIM — bare, fishMaxHp SAMPLED from the corpus", { deckIds: [...REAL_DECK], fishMaxHpSampler: buildFishMaxHpSampler(traces) }, runs);
    console.log("");
    printEconomy(sampled.economy);
    console.log(
      `\n  drift ${bare.economy.drift.toFixed(3)} -> ${sampled.economy.drift.toFixed(3)} against live's ` +
        `+${live.drift.toFixed(3)}. Sampling the max HP is a PER-CAST change and the drift is a PER-PLAY`,
    );
    console.log(`  quantity, so it barely moves — which is the point of running it: §0a's gap is not here.`);
  } else {
    console.log(`  Pass --sample-fish-max-hp to run the bare arm with the measured distribution. It is`);
    console.log(`  OPT-IN and the default is pinned byte-for-byte (tests/fishing/fishMaxHp.test.ts).`);
  }

  console.log("\n── §6  READ THIS BEFORE QUOTING ANY OF IT ──");
  console.log("  OIL-POLICY.md §0a is NOT lifted by anything printed here. This script measures a");
  console.log("  discrepancy; it does not license a policy.\n");
}

main();
