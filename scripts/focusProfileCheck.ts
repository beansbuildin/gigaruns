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
 * ## [session 79 §2] The draw-model result, so it is not re-derived by hand
 *
 * `castSim` drew held decks in roster order from index 0 until session 79; the
 * live corpus falsifies that at 129/129 opening hands and the pile now shuffles
 * per cast. Run both ways here (`--sequential-pile`), 4000 casts an arm:
 *
 *     live-config arm      sequential      shuffled      corpus
 *       focus Δ turns 1-3  +0.84/+0.92/+0.69   +0.10/+0.01/-0.01
 *       opening spend      0.53            1.27          0.79 [0.57, 1.02] today's era
 *       fish-at-full       27.3%           29.3%         33.3% today's era
 *     bare arm (the oil sweeps')
 *       fish-at-full       0.6%            0.6%          63.0% pooled
 *       catch              91.5%           81.2%         27.6%
 *
 * **The per-turn focus profile essentially closed** — worst-turn discrepancy
 * 0.92 -> 0.16 — and the VERDICT still FAILS, now because the sim overshoots
 * today's-era opening spend where it used to undershoot it. The bare arm, which
 * is what `OIL-POLICY.md` §0a suspends, did not move where it counts. §0a
 * stands; see its §0a-i for the full table.
 *
 * Usage: npx tsx scripts/focusProfileCheck.ts [--runs=N] [--profile=NAME]
 *                                             [--sequential-pile]
 *                                             [--focus-reserve-weight=N]
 */

import { join } from "node:path";

import { simulateCast, makeMatcherFishPolicy, REDRAW_THRESHOLD, type CastOptions, type CastOutcome } from "../src/sim/fishing/castSim.js";
import { loadCastTraces, isCleanTrace, type CastTrace } from "../src/sim/fishing/castTrace.js";
import { eraOf, loadCastCreatedAt, POLICY_ERA_BOUNDARY } from "../src/sim/fishing/castEra.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { buildCellOnlyMap, buildContextualMap } from "../src/strategy/fishing/contextualFallback.js";
import { buildStepClassTable } from "../src/strategy/fishing/stepClass.js";
import { loadMinedPatterns, loadRingPredictions } from "./liveFishing.js";
import { profileArg, resolveProfile } from "../src/profile.js";
import { REAL_DECK } from "../src/sim/fishing/rodDeck.js";

/** The real board, as `fishingEmpiricalAblation.ts` fixes it. Same constants, so the two scripts describe one sim. */
const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;
/**
 * **[session 71 §2] REPOINTED TO THE SHROOM ROD** — one shared definition, in
 * `src/sim/fishing/rodDeck.ts`, ratcheted by `tests/fishing/rodDeck.test.ts`
 * so the next rod change fails the build instead of going unnoticed for 110
 * traces the way this one did.
 *
 * ⚠ **THE MAKESHIFT/SHROOM BREAK.** Every figure this script printed before
 * 2026-08-21 was computed on the Makeshift deck
 * `[1,2,3,4,5,6,7,76,77,79]`, as were 110 of the corpus's 123 clean traces.
 * A number from a pre-repoint run is a MAKESHIFT-ERA number: date it, do not
 * restate it as current, and if a comparison spans the break, say so.
 */

const TURNS_SHOWN = 11;

interface Profile {
  label: string;
  /** Mean focus meter at turn i over casts still alive at turn i. */
  focus: number[];
  /** Casts alive at turn i. */
  alive: number[];
  /** Share of casts that ended by the meter filling. */
  fishFullRate: number;
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
function profileOf(label: string, casts: { focus: number[]; caught: boolean; fishFull: boolean }[]): Profile {
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
    fishFullRate: casts.filter((c) => c.fishFull).length / Math.max(1, casts.length),
    catchRate: casts.filter((c) => c.caught).length / Math.max(1, casts.length),
    openingSpend: (focus[0] ?? 0) - (focus[1] ?? 0),
    openingSpends,
    zeroTurnShare: allTurns.filter((f) => f === 0).length / Math.max(1, allTurns.length),
    n: casts.length,
  };
}

/**
 * The corpus's terminal reason, matching `lossDecomposition.ts` exactly — a
 * cast escaped by the fish reaching full HP. Re-derived here
 * rather than imported because that script's copy is a local function; the
 * definition is one line and duplicating it is cheaper than exporting a
 * private helper and having two callers drift.
 */
function corpusFishFull(t: CastTrace): boolean {
  const last = t.turns[t.turns.length - 1];
  return !t.caught && last !== undefined && last.fishHp >= last.fishMaxHp;
}

/**
 * [session 71 §1] The docIds of casts played under TODAY's matcher weighting.
 *
 * A `ringPrediction.jsonl` row carrying `matcherWeight` was written by
 * session-51-or-later code, which mixes the matcher tier in at a POSTERIOR; a
 * row without it was written when the tier got a flat `1 - ringFloor = 0.9`.
 * CLAUDE.md rule 10 warns against reading a field's first appearance as a
 * behaviour change, so `scripts/replayGapDecomposition.ts` corroborates the
 * split on `ts` — the two groups are cleanly separated in time, with zero
 * interleaving, at 2026-08-19T22:23Z / 2026-08-20T18:27Z.
 *
 * This matters here because the corpus pools THREE policy eras and the oldest
 * two are 88 of its 123 casts. Comparing today's simulator against that pool
 * is not a gate on the simulator; it is a gate on how much of the corpus was
 * played by code that has since been replaced.
 */
function todaysEraCastIds(): Set<string> {
  return new Set(
    loadRingPredictions()
      .filter((r) => r.turn === 0 && typeof r.focusMoveCost === "number" && r.matcherWeight !== undefined)
      .map((r) => r.castId),
  );
}

function corpusProfile(label = "CORPUS (live)", keep: (t: CastTrace) => boolean = () => true): Profile {
  const traces = loadCastTraces().filter(isCleanTrace).filter(keep);
  return profileOf(
    label,
    traces.map((t) => ({
      focus: t.turns.map((x) => x.focusMeter),
      caught: t.caught,
      fishFull: corpusFishFull(t),
    })),
  );
}

/**
 * [session 79 §2] Run the sim arms under the PRE-SESSION-79 draw model — the
 * roster dealt sequentially from index 0 — instead of the shuffled pile the
 * live corpus shows (`src/sim/fishing/drawModel.ts`, 129/129 opening hands).
 *
 * Here for one reason: this script is the instrument §0a names as its own
 * precondition, so "did the shuffle move the profile" has to be answerable
 * without editing the script to find out. Run it both ways and diff the
 * verdict.
 *
 * **Not a supported mode.** Anything measured under it is measured under a
 * draw order the server does not use.
 */
const SEQUENTIAL_PILE = process.argv.includes("--sequential-pile");

/**
 * [session 85 §2 / GATE 2] The focus-reserve weight this script's SIM arms
 * run under. **Defaults to 0, which is what every figure in this file's
 * header and in forty sessions of reports was computed on** — nothing here
 * changes a default; the deliverable is the DELTA between the two weights.
 *
 * Why the flag exists. `cardChoice.ts` exports
 * `DEFAULT_FOCUS_RESERVE_WEIGHT = 3` and `scripts/liveFishing.ts` passes it,
 * so the LIVE bot has run at w=3 since session 45. `makeMatcherFishPolicy`'s
 * third parameter defaults to 0, so every sim arm has run at w=0. That
 * divergence is deliberate and documented — `cardChoice.ts` says in as many
 * words "NOT the default of `bestFocusForCard`/`chooseCard` ... so every
 * pre-session-45 caller, test and sim script stays byte-for-byte unchanged" —
 * but its SIZE had never been measured on this script's verdict, which is the
 * opening-spend gate, i.e. the exact quantity the term controls.
 *
 * ⚠ Anything printed under a non-zero weight is NOT comparable to a figure in
 * this file's header. The weight is echoed in the run header for that reason.
 *
 * Usage: --focus-reserve-weight=3
 */
const FOCUS_RESERVE_WEIGHT = Number(
  process.argv.find((a) => a.startsWith("--focus-reserve-weight="))?.split("=")[1] ?? 0,
);

function simProfile(label: string, extra: Omit<CastOptions, "seed" | "policy">, runs: number, seed = 1): Profile {
  const policy = makeMatcherFishPolicy(REDRAW_THRESHOLD, true, FOCUS_RESERVE_WEIGHT);
  const casts: { focus: number[]; caught: boolean; fishFull: boolean }[] = [];
  for (let i = 0; i < runs; i++) {
    const focus: number[] = [];
    const r = simulateCast({
      policy,
      ...REAL_PARAMS,
      ...extra,
      sequentialDrawPile: SEQUENTIAL_PILE,
      seed: seed + i,
      observeTurn: (s) => focus.push(s.focusRemaining),
    });
    const outcome: CastOutcome = r.outcome;
    casts.push({ focus, caught: outcome === "caught", fishFull: outcome === "escaped_fish_full" });
  }
  return profileOf(label, casts);
}

function printProfile(p: Profile): void {
  console.log(`  ${p.label}`);
  console.log(`    focus: ${p.focus.map((f) => f.toFixed(2).padStart(5)).join("")}`);
  console.log(`    n    : ${p.alive.map((a) => String(a).padStart(5)).join("")}`);
  console.log(
    `    fish-at-full ${(p.fishFullRate * 100).toFixed(1)}%   catch ${(p.catchRate * 100).toFixed(1)}%` +
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
  console.log(
    `  focus-reserve weight ${FOCUS_RESERVE_WEIGHT}` +
      (FOCUS_RESERVE_WEIGHT === 0
        ? "  (the sim's historical default; live runs at DEFAULT_FOCUS_RESERVE_WEIGHT=3 — see --focus-reserve-weight)"
        : "  ⚠ NOT the weight this file's header figures were computed on"),
  );
  console.log(`  Both halves measure the SAME statistic: mean focusMeter over casts still alive at each turn.\n`);

  console.log("── §1  THE CORPUS, RECOMPUTED ──");
  const corpus = corpusProfile();
  printProfile(corpus);
  console.log(
    `\n  Session 49 built focusBudget.ts on 73 traces reading 3.00 1.38 0.72 0.36 0.14 0.04 0.00,\n` +
      `  80.8% meter-out, 50.4% of turns at focus 0, opening spend 1.62. Those numbers are STALE —\n` +
      `  the corpus has since roughly doubled and every one of them has moved. See §4.`,
  );

  // ── §1b [session 71 §1] THE CORPUS IS THREE POLICY ERAS, NOT ONE ────────
  //
  // Session 70 read this script's FAIL and concluded the simulator does not
  // reproduce the fishery. That verdict was measured against the pooled corpus.
  // It pools 73 casts played before turn-0 logging existed, 15 played under the
  // retired fixed-0.9 matcher weight, and 35 played under what ships today —
  // and the three disagree with each other far more than the sim disagrees with
  // the last of them.
  console.log("\n── §1b  THE CORPUS SPLIT BY POLICY ERA ──");
  const today = todaysEraCastIds();
  const liveIds = new Set(
    loadRingPredictions().filter((r) => r.turn === 0 && typeof r.focusMoveCost === "number").map((r) => r.castId),
  );
  const todaysEra = corpusProfile("CORPUS — today's policy era", (t) => today.has(t.docId));
  const retiredEra = corpusProfile("CORPUS — retired fixed-0.9 era", (t) => liveIds.has(t.docId) && !today.has(t.docId));
  const preLogging = corpusProfile("CORPUS — pre-logging era (session 49's 73)", (t) => !liveIds.has(t.docId));
  printProfile(todaysEra);
  printProfile(retiredEra);
  printProfile(preLogging);
  console.log(
    `\n  Session 49's header numbers — 80.8% meter-out, opening spend 1.62 — are NOT stale-and-wrong.\n` +
      `  They are exactly the pre-logging era above, and correct for the corpus they were computed on.\n` +
      `  What is wrong is pooling all three and calling the result "the fishery".`,
  );
  console.log(
    `\n  ⚠ THE ERA IS A BUNDLE, not a knob. Between these groups the zone map was fixed, the\n` +
      `  matcher weighting changed, lures were equipped and the rod was swapped. This split says\n` +
      `  the pooled comparison is invalid; it does NOT say the weighting alone caused the change.\n` +
      `  scripts/replayGapDecomposition.ts §2 isolates the weighting on fixed cast sets.`,
  );

  console.log("\n── §2  THE SIMULATOR ──");
  console.log(
    SEQUENTIAL_PILE
      ? "  ⚠ --sequential-pile: the FALSIFIED pre-session-79 draw model. Comparison only.\n"
      : "  draw model: SHUFFLED pile, once per cast (session 79 §1, measured 129/129 live).\n",
  );
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
  console.log(`  fish-at-full rate   corpus ${(corpus.fishFullRate * 100).toFixed(1)}%   sim ${(live.fishFullRate * 100).toFixed(1)}%`);
  console.log(`  opening spend       corpus ${corpus.openingSpend.toFixed(2)}    sim ${live.openingSpend.toFixed(2)}`);
  console.log(`  turns at focus 0    corpus ${(corpus.zeroTurnShare * 100).toFixed(1)}%   sim ${(live.zeroTurnShare * 100).toFixed(1)}%`);
  console.log(`  catch rate          corpus ${(corpus.catchRate * 100).toFixed(1)}%   sim ${(live.catchRate * 100).toFixed(1)}%`);
  // [session 72 §1] DO NOT READ THE CATCH ROW AS A SIM VERDICT. Both sim arms
  // here are built without an `oils` key, so they are NO-OIL simulators; the
  // corpus rows pool oil and non-oil casts together. Session 71 read this row
  // as "the simulator's catch rate is the open disagreement, worse than the
  // focus profile" — comparing a no-oil sim against an era 12 of whose 35
  // casts spent an oil. Split like for like and the sim lands INSIDE the live
  // no-oil arm's interval (24.7% vs 42.9%, 95% [24.5%, 63.5%]) — by 0.2pp.
  // scripts/oilArmCatchCheck.ts is that comparison; read it before quoting this.
  console.log(`    ⚠ this row pools oil + non-oil casts against a NO-OIL sim — see scripts/oilArmCatchCheck.ts`);

  // ── §4. The verdict is COMPUTED, not narrated. The test is an interval one:
  // does the sim's opening spend land inside the corpus's 95% interval for the
  // same statistic? Opening spend is the right single number because it is what
  // every candidate policy actually constrains — a `costCap(2)` cannot bind on a
  // policy that spends 0.53, and inertness would then be read as "no effect"
  // when it means "not exercised".
  console.log("\n── §4  VERDICT ──");
  //
  // [session 71 §1] The verdict is taken against TODAY'S ERA, not the pool.
  // The pooled comparison is reported alongside it because session 70 published
  // that number and it must stay traceable — but it is not the gate, for the
  // same reason `replayGapDecomposition.ts` found live's "1.08" was not one
  // policy's opening spend. A simulator of today's policy is not refuted by
  // casts today's policy never played.
  const cc = meanCi(corpus.openingSpends);
  const tc = meanCi(todaysEra.openingSpends);
  const sc = meanCi(live.openingSpends);
  // [session 85 §2] THE GATE'S ERA SET IS BUILT ON THE BOUNDARY SESSION 84
  // REJECTED, so the verdict is also computed on the one it accepted.
  //
  // `todaysEraCastIds()` above keys on `matcherWeight` out of
  // `data/ringPrediction.jsonl`. Session 84 measured that predicate against
  // `castEra.ts`'s date literal and rejected it on evidence: it reads a
  // gitignored path, classifies only 81 of the corpus's 148 casts, and the
  // five casts the two disagree about read the OLD regime. A gate interval
  // computed on it is therefore computed on five casts today's policy did not
  // play — AND it cannot be computed at all in a fresh clone.
  //
  // Reported ALONGSIDE rather than instead of, because the matcher-weight row
  // is the number this file has published for fourteen sessions and it must
  // stay traceable. If the two ever disagree about PASS/FAIL, the date row is
  // the one to believe.
  const created = loadCastCreatedAt();
  const dateEra = corpusProfile(`CORPUS — today's era, castEra.ts date boundary`, (t) => eraOf(t.docId, created) === "today");
  const dc = meanCi(dateEra.openingSpends);
  const inside = sc.mean >= tc.lo && sc.mean <= tc.hi;
  console.log(`  corpus, TODAY's era   ${tc.mean.toFixed(2)}  95% CI [${tc.lo.toFixed(2)}, ${tc.hi.toFixed(2)}]  n=${tc.n}   <- the gate`);
  console.log(
    `  corpus, TODAY's era   ${dc.mean.toFixed(2)}  95% CI [${dc.lo.toFixed(2)}, ${dc.hi.toFixed(2)}]  n=${dc.n}   ` +
      `<- same era on castEra.ts's ${POLICY_ERA_BOUNDARY} boundary (portable; session 84 prefers it)`,
  );
  console.log(
    `                        sim ${sc.mean.toFixed(2)} is ${sc.mean >= dc.lo && sc.mean <= dc.hi ? "INSIDE" : "OUTSIDE"} that one too` +
      ` — the verdict does not turn on which boundary you take, but the margin does` +
      ` (${Math.abs(sc.mean - dc.hi).toFixed(3)} past its top, against ${Math.abs(sc.mean - tc.hi).toFixed(3)}).`,
  );
  console.log(`  corpus, POOLED        ${cc.mean.toFixed(2)}  95% CI [${cc.lo.toFixed(2)}, ${cc.hi.toFixed(2)}]  n=${cc.n}   <- session 70 used this`);
  console.log(`  sim    opening spend  ${sc.mean.toFixed(2)}  95% CI [${sc.lo.toFixed(2)}, ${sc.hi.toFixed(2)}]  n=${sc.n}`);
  console.log("");
  if (inside) {
    console.log(`  PASS — the sim's ${sc.mean.toFixed(2)} is inside today's-era interval, and its fish heal to full on`);
    console.log(`  ${(live.fishFullRate * 100).toFixed(1)}% of casts against today's era's ${(todaysEra.fishFullRate * 100).toFixed(1)}%. Session 70's FAIL was a`);
    console.log(`  comparison against a pool 88/123 composed of retired policies, not a sim fault.`);
    console.log("");
    console.log(`  READ THE INTERVAL BEFORE CELEBRATING: n=${tc.n} makes it ${(tc.hi - tc.lo).toFixed(2)} wide. This is`);
    console.log(`  "not refuted at n=${tc.n}", not "reproduced".`);
    // [session 72 §1] SUPERSEDED. This block used to end "and the CATCH RATE
    // still disagrees badly — sim X% against today's era's Y% — so the sim is
    // NOT cleared in general", and session 71's recap carried that forward as
    // its headline open problem. The comparison was wrong in the same way the
    // one it had just corrected was wrong: `live` here is a NO-OIL sim arm and
    // today's era is 12/35 oil casts. Against the live NO-OIL arm the sim is
    // inside the interval. The catch rate is no longer the open disagreement.
    console.log(`  The CATCH RATE line that used to end this block is RETRACTED — it compared this`);
    console.log(`  no-oil sim (${(live.catchRate * 100).toFixed(1)}%) against an era pooling oil casts (${(todaysEra.catchRate * 100).toFixed(1)}%). Like for like it is`);
    console.log(`  inside the live no-oil arm's interval, by 0.2pp. See scripts/oilArmCatchCheck.ts.`);
    console.log("");
    // [session 71 §2] The comparison SPANS THE MAKESHIFT/SHROOM BREAK and must
    // say so. The sim arm below is the Shroom deck as of this session's
    // repoint; today's-era corpus is 20 Makeshift casts and 15 Shroom ones.
    const SHROOM_FROM = "2026-08-21T19:58:29Z";
    const eraRows = loadRingPredictions().filter(
      (r) => r.turn === 0 && typeof r.focusMoveCost === "number" && r.matcherWeight !== undefined,
    );
    const onShroom = eraRows.filter((r) => String((r as unknown as { ts?: string }).ts ?? "") >= SHROOM_FROM);
    const spendOf = (rs: typeof eraRows) => rs.reduce((a, r) => a + (r.focusMoveCost as number), 0) / Math.max(1, rs.length);
    console.log(`  ⚠ SPANS THE DECK BREAK. The sim arm is the SHROOM deck (repointed this session);`);
    console.log(`  today's-era corpus is ${eraRows.length - onShroom.length} Makeshift casts and ${onShroom.length} Shroom ones (rod swapped ${SHROOM_FROM}).`);
    console.log(`  Opening spend within the era: Makeshift ${spendOf(eraRows.filter((r) => !onShroom.includes(r))).toFixed(2)}, Shroom ${spendOf(onShroom).toFixed(2)} — the`);
    console.log(`  verdict does not turn on which side you take, but the number is not deck-pure.`);
    console.log("");
    console.log("  What this licenses: the sweep's arms are no longer known-unexercised. What it");
    console.log("  does NOT licence: quoting the ranking. Today's policy really does spend ~0.83");
    console.log("  on the opening move, so costCap(2) still has nothing to cap — inert there now");
    console.log("  means the policy does not need it, which is a finding, not a measurement.");
  } else {
    console.log(`  *** FAIL *** — the sim's ${sc.mean.toFixed(2)} is OUTSIDE today's-era interval.`);
    console.log(`  The sim's fish heal to full on ${(live.fishFullRate * 100).toFixed(1)}% of casts against today's era's ${(todaysEra.fishFullRate * 100).toFixed(1)}% —`);
    console.log("  it does not reproduce the failure mode focusBudget.ts was built to fix.");
    console.log("");
    console.log("  A spend cap cannot bind on a policy that does not spend, so an inert arm in");
    console.log("  the sweep means NOT EXERCISED, not NO EFFECT. Do not quote the ranking.");
  }
  console.log("");
}

main();
