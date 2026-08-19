/**
 * scripts/fishingEmpiricalAblation.ts — [session 45, brief §2] re-runs the
 * questions session 44 answered against `patterns.ts`'s SYNTHETIC fish, this
 * time against a fish sampled from the real corpus's own movement statistics
 * (`src/sim/fishing/empiricalFish.ts`).
 *
 * Three questions:
 *
 *  1. **Heuristic (d), `pruneReturnToPrevious` — correcting the record.**
 *     Session 44 measured it as a reproducible ~2pp catch-rate REGRESSION
 *     (N=20000, two seeds) and traced it to `patterns.ts`'s `bounceDelta`
 *     wall-reflection primitive doing exactly what (d) forbids. The trace was
 *     right; the conclusion was backwards. The real corpus has ZERO reversals
 *     in 109 k=1 observations (`scripts/auditStepClass.ts`), so `bounceDelta`
 *     models a fish this game does not have. This re-runs the same ablation
 *     against a fish that moves the way the real one does, and the answer is
 *     recorded in SPEC-fishing.md §8 either way.
 *
 *  2. **Does the ring model actually lift the policy?** Blind fallback vs.
 *     the step-class ring model as the predictor, same fish, same deck.
 *
 *  3. **Sanity: what does the real deck do vs. a shape-matched one?** The
 *     brief's §4 claim, measured here only to size the lever, not to act on.
 *
 * **Caveat, up front and not to be glossed.** Question 2's ring-model rows
 * share their movement model with the fish generator, so they are optimistic
 * BY CONSTRUCTION — the same "sim authority is earned per domain" rule
 * SPEC.md §5 carries. The out-of-sample evidence for the ring model is
 * `scripts/fishingRingCV.ts`'s leave-one-cast-out table, not any number here.
 * Question 1 is NOT affected by this: heuristic (d) is measured with the
 * BLIND predictor in both arms, so neither arm has the generator's model.
 *
 * Real parameters throughout, read from
 * `fixtures/fishing-casts/live/cast-2026-08-19-00-55-15/state-000.json`:
 * deck [1,2,3,4,5,6,7,76,77,79], fishHp 13/21, mana 10, focus 3, hand 3.
 *
 * Usage: npx tsx scripts/fishingEmpiricalAblation.ts [N]
 */

import { join } from "node:path";

import { simulateCasts, makeMatcherFishPolicy, REDRAW_THRESHOLD, type CastOptions } from "../src/sim/fishing/castSim.js";
import { groupByCast, isCleanCast, loadTransitionRecords, type Cast } from "../src/sim/fishing/transitionCorpus.js";
import { buildStepClassTable, classifyStep } from "../src/strategy/fishing/stepClass.js";
import { castHops } from "../src/strategy/fishing/contextualFallback.js";
import { loadMinedPatterns } from "./liveFishing.js";

/** The account's real held deck — `doc.data.fullDeck` from the live capture named in this file's header. */
const REAL_DECK = [1, 2, 3, 4, 5, 6, 7, 76, 77, 79];

/**
 * Comparison decks for the brief's §4 deck-shape claim. Diagnostic only —
 * card acquisition is explicitly NOT this session's task and nothing acts on
 * these rows.
 *
 * `SHAPE_DECK` is the brief's own "shape-matched mid": X `{1,3,7,9}` id 7,
 * plus `{2,4,6,8}` id 79, ring-8 id 76. Note before reading the result that
 * ALL THREE of those cards are already IN the real deck — so this deck is not
 * an upgrade in shape, it is the real deck with its other seven cards
 * removed. `SHAPE_DECK_HIGH` is the brief's "shape-matched high" (ids 108 /
 * 107 / 25): the identical three templates at 10-11 damage instead of 3-6.
 * Running both is what separates the brief's two conflated variables.
 */
const SHAPE_DECK = [7, 79, 76, 7, 79, 76, 7, 79, 76, 7];
const SHAPE_DECK_HIGH = [107, 108, 25, 107, 108, 25, 107, 108, 25, 107];

const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;

const records = loadTransitionRecords(join("data", "fish-patterns.jsonl"));
const casts = groupByCast(records).filter(isCleanCast);
const table = buildStepClassTable(casts);
const minedPool = loadMinedPatterns();

/** A cast's own step class, for the class-split arms of question 1b. */
function castClass(c: Cast): 1 | 2 | null {
  return classifyStep([c.start, ...castHops(c).map((h) => h.to)]);
}

const N = Number(process.argv[2] ?? 20000);
// `simulateCasts(runs, opts, seed)` draws `seed + i` internally, so two seed
// BASES closer together than N overlap almost entirely (session 44 found this
// the hard way). 1 and 500000 are far enough apart for any N used here.
const SEEDS = [1, 500000];

console.log(`\n▸ fishingEmpiricalAblation.ts — N=${N} per row, seeds ${SEEDS.join(" / ")}`);
console.log(
  `  corpus: ${records.length} transitions, ${casts.length} clean casts — class prior k=1 ${table.classCasts.get(1) ?? 0} casts / k=2 ${table.classCasts.get(2) ?? 0} casts`,
);
console.log(`  mined library available: ${minedPool.length} pattern(s) — ${minedPool.map((p) => p.name).join(", ") || "(none)"}\n`);

function run(label: string, extra: Omit<CastOptions, "seed" | "policy">, heuristicsEnabled: boolean) {
  const policy = makeMatcherFishPolicy(REDRAW_THRESHOLD, heuristicsEnabled);
  const cells: string[] = [];
  for (const seed of SEEDS) {
    const r = simulateCasts(N, { policy, ...REAL_PARAMS, ...extra }, seed);
    cells.push(`${(r.catchRate * 100).toFixed(1)}% / ${r.meanFinalFishHp.toFixed(2)}`);
  }
  console.log(`  ${label.padEnd(48)} ${cells.map((c) => c.padStart(14)).join("  ")}`);
}

function header() {
  console.log(`  ${"".padEnd(48)} ${SEEDS.map((s) => `seed ${s}`.padStart(14)).join("  ")}`);
  console.log(`  ${"".padEnd(48)} ${SEEDS.map(() => "catch% / fishHP".padStart(14)).join("  ")}`);
}

const empiricalBlind: Omit<CastOptions, "seed" | "policy"> = {
  empiricalFish: { table },
  matcherPool: [],
  deckIds: [...REAL_DECK],
};
const empiricalMined: Omit<CastOptions, "seed" | "policy"> = {
  empiricalFish: { table },
  matcherPool: minedPool,
  deckIds: [...REAL_DECK],
};
const empiricalRing: Omit<CastOptions, "seed" | "policy"> = {
  empiricalFish: { table },
  matcherPool: [],
  ringModel: { table },
  deckIds: [...REAL_DECK],
};

console.log("0. SIM-vs-LIVE calibration — the reason the rest of this script is trustworthy\n");
header();
run("blind predictor, SYNTHETIC fish  (session 44's sim)", { matcherPool: [], deckIds: [...REAL_DECK] }, true);
run("mined matcher, SYNTHETIC fish    (session 44's sim)", { matcherPool: minedPool, deckIds: [...REAL_DECK] }, true);
run("blind predictor, EMPIRICAL fish", empiricalBlind, true);
run("mined matcher, EMPIRICAL fish    (= today's live config)", empiricalMined, true);
console.log("\n   Live reality to compare against: 16 casts, 0 caught (session 44), 7/67 = 10.4% all-time.\n");

console.log("1. Heuristic (d) pruneReturnToPrevious, against the EMPIRICAL fish\n");
console.log("   1a. whole corpus (both classes mixed, at the class prior)\n");
header();
for (const [label, base] of [
  ["mined matcher", empiricalMined],
  ["ring model", empiricalRing],
] as const) {
  run(`${label}, (d) OFF`, { ...base, pruneReturnToPrevious: false }, true);
  run(`${label}, (d) ON`, { ...base, pruneReturnToPrevious: true }, true);
}

console.log("\n   1b. class-split — the brief's actual claim: (d) is free for k=1, wrong for k=2\n");
header();
for (const k of [1, 2] as const) {
  const classTable = buildStepClassTable(casts.filter((c) => castClass(c) === k));
  const base: Omit<CastOptions, "seed" | "policy"> = {
    empiricalFish: { table: classTable },
    matcherPool: [],
    ringModel: { table },
    deckIds: [...REAL_DECK],
  };
  run(`k=${k} fish only, (d) OFF`, { ...base, pruneReturnToPrevious: false }, true);
  run(`k=${k} fish only, (d) ON`, { ...base, pruneReturnToPrevious: true }, true);
}

console.log("\n   Same ablation against the SYNTHETIC fish, the side-by-side session 44 measured:\n");
header();
run("synthetic fish, mined matcher, (d) OFF", { matcherPool: minedPool, deckIds: [...REAL_DECK], pruneReturnToPrevious: false }, true);
run("synthetic fish, mined matcher, (d) ON", { matcherPool: minedPool, deckIds: [...REAL_DECK], pruneReturnToPrevious: true }, true);

console.log("\n2. Predictor: blind fallback vs. the step-class RING model");
console.log("   (ring rows share their movement model with the generator — optimistic by construction)\n");
header();
run("blind fallback (today's live tier 2/3)", empiricalBlind, true);
run("mined matcher only, no ring", empiricalMined, true);
run("RING model", empiricalRing, true);
run("RING model + mined matcher, ring-intersected", { ...empiricalMined, ringModel: { table } }, true);

console.log("\n3. Deck shape (brief §4) — sizing the lever only, nothing acts on this\n");
header();
run("real deck  [1,2,3,4,5,6,7,76,77,79]", empiricalRing, true);
run("shape-matched MID  [7,79,76] (all 3 already in deck)", { ...empiricalRing, deckIds: [...SHAPE_DECK] }, true);
run("shape-matched HIGH [107,108,25] (same shapes, 10-11 dmg)", { ...empiricalRing, deckIds: [...SHAPE_DECK_HIGH] }, true);
console.log("");
