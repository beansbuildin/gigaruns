/**
 * scripts/focusProfileCheck.ts — [session 70 §2a, GATE 1] does the SIMULATOR
 * spend the focus meter the way the real fishery does?
 *
 * ## Why this runs BEFORE the sweep, and not as a footnote to it
 *
 * The session-70 brief asks for a sweep of `focusBudget.ts`'s three policy
 * families against the shipped `{kind:"none"}`. That sweep is scored in the
 * simulator, so its recommendation is worth exactly as much as the
 * simulator's account of the thing being optimised — and this repo has now
 * caught the simulator misdescribing the fishery THREE times in four sessions:
 *
 *   - session 67 chose the oil certainty gate because the sim's
 *     `bestKillProbability` is bimodal at 0 and 1 (34.3% / 55.8%);
 *   - session 69 measured all NINE live Relaxing firings strictly between 0
 *     and 1, with zero mass at either endpoint;
 *   - and the same sim therefore cannot distinguish the derived exchange
 *     threshold from 1, because it has no mass in [0.833, 1) at all.
 *
 * A policy chosen inside a model that has no mass where the decision lives is
 * not a measurement. So this script asks the narrow, checkable question the
 * focus sweep depends on: **the per-turn focus-meter profile, sim vs corpus**,
 * measured the same way in both.
 *
 * ## The same measurement, twice — which is the only reason it means anything
 *
 * The corpus half is `scripts/lossDecomposition.ts`'s profile, unchanged: mean
 * `focusMeter` over the casts still alive at each turn, taken from
 * `castTrace.ts`'s per-turn doc states, terminal state included.
 *
 * The sim half is the same average over states emitted by `castSim.ts`'s new
 * `observeTurn` hook, which fires at the START of each turn plus once on the
 * terminal state — deliberately mirroring what a trace records. `observeTurn`
 * is purely observational; a run with it set is byte-for-byte a run without it.
 *
 * ## What the reader should take from a divergence
 *
 * Nothing here is a policy recommendation, and a divergence is NOT an argument
 * for a particular focus policy. It is an argument about whether the sweep's
 * ranking may be quoted at all. Read §3's verdict line before reading
 * `focusBudgetSweep.ts`'s table.
 *
 * Profile-resolved, so the corpus it reads follows `--profile` rather than a
 * hardcoded `data/` — `tests/noHardcodedPaths.test.ts`'s ratchet stays at 25.
 *
 * Usage: npx tsx scripts/focusProfileCheck.ts [--runs=N] [--profile=NAME]
 */

import { join } from "node:path";

import { simulateCast, makeMatcherFishPolicy, REDRAW_THRESHOLD, type CastOptions, type CastOutcome } from "../src/sim/fishing/castSim.js";
import { loadCastTraces, isCleanTrace, type CastTrace } from "../src/sim/fishing/castTrace.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { buildCellOnlyMap, buildContextualMap } from "../src/strategy/fishing/contextualFallback.js";
import { buildStepClassTable } from "../src/strategy/fishing/stepClass.js";
import { loadMinedPatterns } from "./liveFishing.js";
import { profileArg, resolveProfile } from "../src/profile.js";

/** The real board, as `fishingEmpiricalAblation.ts` fixes it. Same constants, so the two scripts describe one sim. */
const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;
/**
 * **[session 70 §5a] THIS IS THE MAKESHIFT ROD'S DECK, AND IT IS STALE.** A rod
 * grants the starting card set via `gameItems[].CARD_CID_array`, and the
 * account swapped Makeshift Rod (922) for Shroom Rod (811) on 2026-08-21 at
 * 12:58 PT — `fullDeck` flips to `[1,2,3,4,5,6,74,75,76,78]` at cast 13022748,
 * on the same cast `GEAR_CID_array` swaps the rod. See SPEC-fishing.md.
 *
 * Left pointing at the Makeshift deck ON PURPOSE: every historical number in
 * this repo was computed on it and 110 of the corpus's 123 clean traces were
 * played on it, so repointing the constant would make old and new numbers
 * incomparable without making either right. Any comparison against recent live
 * play must SAY which deck it used.
 */
const REAL_DECK = [1, 2, 3, 4, 5, 6, 7, 76, 77, 79];

const TURNS_SHOWN = 11;

interface Profile {
  label: string;
  /** Mean focus meter at turn i over casts still alive at turn i. */
  focus: number[];
  /** Casts alive at turn i. */
  alive: number[];
  /** Share of casts that ended by the meter filling. */
  meterOutRate: number;
  catchRate: number;
  /** Points spent on the opening move: `focus[0] - focus[1]`. */
  openingSpend: number;
  /** Per-cast opening spends, so the comparison can be an interval one rather than an eyeballed one. */
  openingSpends: number[];
  /** Turns played at focusMeter 0, over all turns. */
  zeroTurnShare: number;
  n: number;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Mean with a 95% normal interval. The corpus half is n=123, so the interval is the whole point. */
function meanCi(xs: number[]): { mean: number; lo: number; hi: number; n: number } {
  const n = xs.length;
  const m = mean(xs);
  if (n < 2) return { mean: m, lo: m, hi: m, n };
  const varr = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  const se = Math.sqrt(varr / n);
  return { mean: m, lo: m - 1.96 * se, hi: m + 1.96 * se, n };
}

/** One profile out of a set of per-cast focus sequences plus outcomes. */
function profileOf(label: string, casts: { focus: number[]; caught: boolean; meterOut: boolean }[]): Profile {
  const focus: number[] = [];
  const alive: number[] = [];
  for (let i = 0; i < TURNS_SHOWN; i++) {
    const live = casts.filter((c) => c.focus.length > i);
    alive.push(live.length);
    focus.push(mean(live.map((c) => c.focus[i] as number)));
  }
  const allTurns = casts.flatMap((c) => c.focus);
  const openingSpends = casts
    .filter((c) => c.focus.length >= 2)
    .map((c) => (c.focus[0] as number) - (c.focus[1] as number));
  return {
    label,
    focus,
    alive,
    meterOutRate: casts.filter((c) => c.meterOut).length / Math.max(1, casts.length),
    catchRate: casts.filter((c) => c.caught).length / Math.max(1, casts.length),
    openingSpend: (focus[0] ?? 0) - (focus[1] ?? 0),
    openingSpends,
    zeroTurnShare: allTurns.filter((f) => f === 0).length / Math.max(1, allTurns.length),
    n: casts.length,
  };
}

/**
 * The corpus's terminal reason, matching `lossDecomposition.ts` exactly — a
 * cast escaped by meter-out when the fish reached full HP. Re-derived here
 * rather than imported because that script's copy is a local function; the
 * definition is one line and duplicating it is cheaper than exporting a
 * private helper and having two callers drift.
 */
function corpusMeterOut(t: CastTrace): boolean {
  const last = t.turns[t.turns.length - 1];
  return !t.caught && last !== undefined && last.fishHp >= last.fishMaxHp;
}

function corpusProfile(): Profile {
  const traces = loadCastTraces().filter(isCleanTrace);
  return profileOf(
    `CORPUS (live)`,
    traces.map((t) => ({
      focus: t.turns.map((x) => x.focusMeter),
      caught: t.caught,
      meterOut: corpusMeterOut(t),
    })),
  );
}

function simProfile(label: string, extra: Omit<CastOptions, "seed" | "policy">, runs: number, seed = 1): Profile {
  const policy = makeMatcherFishPolicy(REDRAW_THRESHOLD, true);
  const casts: { focus: number[]; caught: boolean; meterOut: boolean }[] = [];
  for (let i = 0; i < runs; i++) {
    const focus: number[] = [];
    const r = simulateCast({
      policy,
      ...REAL_PARAMS,
      ...extra,
      seed: seed + i,
      observeTurn: (s) => focus.push(s.focusRemaining),
    });
    const outcome: CastOutcome = r.outcome;
    casts.push({ focus, caught: outcome === "caught", meterOut: outcome === "escaped_meter" });
  }
  return profileOf(label, casts);
}

function printProfile(p: Profile): void {
  console.log(`  ${p.label}`);
  console.log(`    focus: ${p.focus.map((f) => f.toFixed(2).padStart(5)).join("")}`);
  console.log(`    n    : ${p.alive.map((a) => String(a).padStart(5)).join("")}`);
  console.log(
    `    meter-out ${(p.meterOutRate * 100).toFixed(1)}%   catch ${(p.catchRate * 100).toFixed(1)}%` +
      `   opening spend ${p.openingSpend.toFixed(2)}   turns at focus 0 ${(p.zeroTurnShare * 100).toFixed(1)}%   casts ${p.n}`,
  );
}

function main(): void {
  const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 4000);

  const profile = resolveProfile(profileArg(process.argv));
  const transitionsPath = join(profile.dataRoot, "fish-patterns.jsonl");
  const records = loadTransitionRecords(transitionsPath);
  const cleanCasts = groupByCast(records).filter(isCleanCast);
  const table = buildStepClassTable(cleanCasts);
  const minedPool = loadMinedPatterns();
  const LIVE_FALLBACK = { contextMap: buildContextualMap(cleanCasts), cellOnlyMap: buildCellOnlyMap(cleanCasts) };

  console.log(`\n▸ focusProfileCheck.ts — GATE 1 for the session-70 focus sweep`);
  console.log(`  n=${runs} per sim arm, seed base 1. Corpus is every clean trace on disk.`);
  console.log(`  profile ${profile.name}, transitions ${transitionsPath}`);
  console.log(`  Both halves measure the SAME statistic: mean focusMeter over casts still alive at each turn.\n`);

  console.log("── §1  THE CORPUS, RECOMPUTED ──");
  const corpus = corpusProfile();
  printProfile(corpus);
  console.log(
    `\n  Session 49 built focusBudget.ts on 73 traces reading 3.00 1.38 0.72 0.36 0.14 0.04 0.00,\n` +
      `  80.8% meter-out, 50.4% of turns at focus 0, opening spend 1.62. Those numbers are STALE —\n` +
      `  the corpus has since roughly doubled and every one of them has moved. See §4.`,
  );

  console.log("\n── §2  THE SIMULATOR ──");
  const empiricalMined: Omit<CastOptions, "seed" | "policy"> = {
    empiricalFish: { table },
    matcherPool: minedPool,
    deckIds: [...REAL_DECK],
  };
  // The configuration `liveFishing.ts` actually wires — mined matcher over the
  // contextual fallback. `fishingEmpiricalAblation.ts` calls this row LIVE.
  const live = simProfile("SIM — live config (mined + contextual fallback, empirical fish)", { ...empiricalMined, blindFallback: LIVE_FALLBACK }, runs);
  // The default the oil sweeps actually ran under: synthetic fish, no fallback
  // tier. Included because the oil conclusions this repo is weighing came out
  // of THIS arm, not the live-config one.
  const synthetic = simProfile("SIM — bare default (synthetic fish, no fallback) — the oil sweeps' arm", { deckIds: [...REAL_DECK] }, runs);
  printProfile(live);
  console.log("");
  printProfile(synthetic);

  console.log("\n── §3  THE COMPARISON, PER TURN ──");
  console.log(`  turn        ${Array.from({ length: TURNS_SHOWN }, (_, i) => String(i).padStart(5)).join("")}`);
  console.log(`  corpus      ${corpus.focus.map((f) => f.toFixed(2).padStart(5)).join("")}`);
  console.log(`  sim (live)  ${live.focus.map((f) => f.toFixed(2).padStart(5)).join("")}`);
  console.log(`  Δ           ${live.focus.map((f, i) => (f - (corpus.focus[i] ?? 0)).toFixed(2).padStart(5)).join("")}`);

  // The two summary statistics the sweep would actually be optimising.
  console.log("");
  console.log(`  meter-out rate      corpus ${(corpus.meterOutRate * 100).toFixed(1)}%   sim ${(live.meterOutRate * 100).toFixed(1)}%`);
  console.log(`  opening spend       corpus ${corpus.openingSpend.toFixed(2)}    sim ${live.openingSpend.toFixed(2)}`);
  console.log(`  turns at focus 0    corpus ${(corpus.zeroTurnShare * 100).toFixed(1)}%   sim ${(live.zeroTurnShare * 100).toFixed(1)}%`);
  console.log(`  catch rate          corpus ${(corpus.catchRate * 100).toFixed(1)}%   sim ${(live.catchRate * 100).toFixed(1)}%`);

  // ── §4. The verdict is COMPUTED, not narrated. The test is an interval one:
  // does the sim's opening spend land inside the corpus's 95% interval for the
  // same statistic? Opening spend is the right single number because it is what
  // every candidate policy actually constrains — a `costCap(2)` cannot bind on a
  // policy that spends 0.53, and inertness would then be read as "no effect"
  // when it means "not exercised".
  console.log("\n── §4  VERDICT ──");
  const cc = meanCi(corpus.openingSpends);
  const sc = meanCi(live.openingSpends);
  const inside = sc.mean >= cc.lo && sc.mean <= cc.hi;
  console.log(`  corpus opening spend  ${cc.mean.toFixed(2)}  95% CI [${cc.lo.toFixed(2)}, ${cc.hi.toFixed(2)}]  n=${cc.n}`);
  console.log(`  sim    opening spend  ${sc.mean.toFixed(2)}  95% CI [${sc.lo.toFixed(2)}, ${sc.hi.toFixed(2)}]  n=${sc.n}`);
  console.log("");
  if (inside) {
    console.log("  PASS — the sim reproduces the corpus's opening focus spend. The sweep is");
    console.log("  measuring the right thing and its ranking may be quoted.");
  } else {
    console.log(`  *** FAIL *** — the sim's ${sc.mean.toFixed(2)} is OUTSIDE the corpus's interval.`);
    console.log(`  The sim meter-outs on ${(live.meterOutRate * 100).toFixed(1)}% of casts against the corpus's ${(corpus.meterOutRate * 100).toFixed(1)}% —`);
    console.log("  it does not reproduce the failure mode focusBudget.ts was built to fix.");
    console.log("");
    console.log("  A spend cap cannot bind on a policy that does not spend, so an inert arm in");
    console.log("  the sweep means NOT EXERCISED, not NO EFFECT. Do not quote the ranking.");
  }
  console.log("");
}

main();
