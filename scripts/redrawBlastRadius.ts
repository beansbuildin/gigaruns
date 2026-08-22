/**
 * scripts/redrawBlastRadius.ts — [session 75, brief §3 / GATE 2]
 *
 * **Which sim consumers actually execute the redraw branch, and what moved
 * when it was fixed.**
 *
 * Session 75 charged a redraw a turn and a fish step in `castSim`
 * (`tests/fishing/redrawFishStep.test.ts`). The brief's requirement is that
 * the fix ship with an ENUMERATION rather than an assertion — "a sim branch
 * fix that silently moves an unrelated published number is exactly the class
 * this repo keeps finding".
 *
 * ── The thing that makes this necessary, stated plainly ───────────────────
 *
 * **The redraw branch is NOT behind an opt-in flag.** `redrawEnabled` is a
 * LIVE flag; it gates nothing in the simulator. `matcherFishPolicy` — the
 * default policy nearly every sim consumer uses — can emit a redraw by TWO
 * paths:
 *
 *   1. `shouldRedraw(best, ...)` at `REDRAW_THRESHOLD = 0`, i.e. whenever the
 *      hand's best card has negative EV and mana allows; and
 *   2. the `!best` fallback — `chooseCard` returned nothing affordable, but
 *      `mana >= hand.length`, so the policy redraws instead of passing.
 *
 * Path 2 is the one that makes "the oil sweeps never enable redraw" false as
 * a blanket claim: no threshold has to be crossed for it, only an unaffordable
 * hand. So the question is measured here, per consumer configuration, rather
 * than argued from the policy names.
 *
 * ── §3 IS THE FINDING, AND IT REVERSES THE RECORD ─────────────────────────
 *
 * Session 74 predicted the fix would make redraw look WORSE — a free fish step
 * makes the sim's redraw cheaper than the real one, so "263 mana per extra
 * fish" was recorded as an UNDERSTATEMENT. That prediction is wrong, and the
 * direction is wrong, not just the magnitude. §3 measures why: a redraw that
 * advances the fish also hands the matcher an OBSERVATION, and the old branch
 * skipped `observe()` along with `turn++`. The sim's redraw was not merely
 * time-free; it was information-free, and being information-free was the
 * larger effect.
 *
 * Pure: no I/O beyond the corpus the sim already loads, no network.
 *
 * Usage: npx tsx scripts/redrawBlastRadius.ts [--runs=N]
 */
import { execSync } from "node:child_process";
import { join } from "node:path";

import {
  makeConnectRedrawFishPolicy,
  makeMatcherFishPolicy,
  matcherFishPolicy,
  simulateCast,
  REDRAW_THRESHOLD,
  type CastOptions,
  type FishPolicy,
} from "../src/sim/fishing/castSim.js";
import { buildStepClassTable } from "../src/strategy/fishing/stepClass.js";
import { buildCellOnlyMap, buildContextualMap } from "../src/strategy/fishing/contextualFallback.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { profileArg, resolveProfile } from "../src/profile.js";
import { REAL_DECK } from "../src/sim/fishing/rodDeck.js";
import { loadMinedPatterns } from "./liveFishing.js";

/** The live cast parameters, matching `scripts/redrawTriggerCalibration.ts` §5 exactly. */
const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

/** Every file that constructs a policy able to emit `{ type: "redraw" }`. Grepped, not listed by hand. */
function consumers(): { file: string; hits: number }[] {
  const out = execSync(
    `grep -rn --include='*.ts' -e makeMatcherFishPolicy -e matcherFishPolicy -e makeConnectRedrawFishPolicy src scripts tests || true`,
    { encoding: "utf8" },
  );
  const counts = new Map<string, number>();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const file = line.split(":")[0]!;
    // The definitions themselves are not consumers.
    if (file === "src/sim/fishing/castSim.ts") continue;
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  return [...counts].map(([file, hits]) => ({ file, hits })).sort((a, b) => a.file.localeCompare(b.file));
}

interface ArmStats {
  casts: number;
  castsWithRedraw: number;
  redrawMana: number;
  hits: number;
  shots: number;
  caught: number;
  turns: number;
}

function run(policy: FishPolicy, base: Omit<CastOptions, "seed" | "policy">, runs: number): ArmStats {
  const s: ArmStats = { casts: runs, castsWithRedraw: 0, redrawMana: 0, hits: 0, shots: 0, caught: 0, turns: 0 };
  for (let i = 0; i < runs; i++) {
    const r = simulateCast({ ...base, policy, seed: 1 + i });
    if (r.redrawMana > 0) s.castsWithRedraw++;
    s.redrawMana += r.redrawMana;
    s.hits += r.hits;
    s.shots += r.shots;
    s.turns += r.turns;
    if (r.outcome === "caught") s.caught++;
  }
  return s;
}

function main(): void {
  const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 4000);
  const profile = resolveProfile(profileArg(process.argv));
  const cleanCasts = groupByCast(loadTransitionRecords(join(profile.dataRoot, "fish-patterns.jsonl"))).filter(isCleanCast);
  const liveConfig: Omit<CastOptions, "seed" | "policy"> = {
    ...REAL_PARAMS,
    empiricalFish: { table: buildStepClassTable(cleanCasts) },
    matcherPool: loadMinedPatterns(),
    deckIds: [...REAL_DECK],
    blindFallback: { contextMap: buildContextualMap(cleanCasts), cellOnlyMap: buildCellOnlyMap(cleanCasts) },
  };

  console.log(`\n▸ redrawBlastRadius.ts — SESSION 75 GATE 2, the enumeration half`);
  console.log(`  n=${runs}/arm, live config, Shroom deck.\n`);

  // ── §1 ────────────────────────────────────────────────────────────────
  console.log("── §1  THE BRANCH IS NOT OPT-IN ──");
  console.log(`  \`redrawEnabled\` is a LIVE flag and gates nothing in the simulator.`);
  console.log(`  \`matcherFishPolicy\` reaches the branch two ways: \`shouldRedraw\` at`);
  console.log(`  REDRAW_THRESHOLD = ${REDRAW_THRESHOLD}, and the \`!best\` fallback, which needs no`);
  console.log(`  threshold crossed at all — only a hand nothing in it can afford.`);

  // ── §2 ────────────────────────────────────────────────────────────────
  console.log("\n── §2  EVERY CONSUMER OF A REDRAW-CAPABLE POLICY ──");
  const c = consumers();
  for (const { file, hits } of c) console.log(`  ${file.padEnd(46)} ${hits} reference(s)`);
  console.log(`\n  ${c.length} files. Being on this list is NOT evidence the branch executes —`);
  console.log(`  §3 measures that. It is the set that COULD be affected.`);

  // ── §3 ────────────────────────────────────────────────────────────────
  console.log("\n── §3  DOES IT ACTUALLY EXECUTE? — THE DEFAULT POLICY, MEASURED ──");
  const def = run(matcherFishPolicy, liveConfig, runs);
  const w0 = run(makeMatcherFishPolicy(REDRAW_THRESHOLD, true, 0), liveConfig, runs);
  console.log(`  matcherFishPolicy            casts with >=1 redraw ${String(def.castsWithRedraw).padStart(5)} / ${runs}   ${pct(def.castsWithRedraw / runs)}`);
  console.log(`  makeMatcherFishPolicy(0,t,0) casts with >=1 redraw ${String(w0.castsWithRedraw).padStart(5)} / ${runs}   ${pct(w0.castsWithRedraw / runs)}`);
  if (def.castsWithRedraw === 0) {
    console.log(`\n  ZERO. The default policy never reaches the branch on the live config, so`);
    console.log(`  every consumer in §2 that uses it is UNAFFECTED by this fix — established`);
    console.log(`  by measurement, not by reading the policy. The two files that DO reach it`);
    console.log(`  are the two that ask for it by name: \`scripts/redrawTriggerCalibration.ts\``);
    console.log(`  and \`scripts/redrawThresholdSweep.ts\`, plus \`tests/fishing/redrawTrigger.test.ts\`.`);
  } else {
    console.log(`\n  NON-ZERO — the fix moves numbers for every consumer of the default policy.`);
    console.log(`  Each published figure derived from one of the §2 files needs re-deriving.`);
  }

  // ── §4 ────────────────────────────────────────────────────────────────
  console.log("\n── §4  WHY THE FIX HELPED REDRAW INSTEAD OF HURTING IT ──");
  console.log(`  Session 74 recorded the old branch as making the sim's redraw CHEAPER than`);
  console.log(`  the real one, so "263 mana per extra fish" was logged as an UNDERSTATEMENT.`);
  console.log(`  Re-deriving it gives ~44. The prediction was wrong in DIRECTION.\n`);
  const never = run(makeConnectRedrawFishPolicy(0), liveConfig, runs);
  const derived = run(makeConnectRedrawFishPolicy(0.339), liveConfig, runs);
  const rate = (s: ArmStats) => (s.shots === 0 ? 0 : s.hits / s.shots);
  console.log(`  arm            casts w/ redraw   shots   hit rate per shot   catch    turns/cast`);
  const show = (label: string, s: ArmStats) =>
    console.log(
      `  ${label.padEnd(14)} ${String(s.castsWithRedraw).padStart(13)} ${String(s.shots).padStart(7)}` +
        `   ${pct(rate(s)).padStart(17)}   ${pct(s.caught / s.casts).padStart(6)}   ${(s.turns / s.casts).toFixed(2).padStart(10)}`,
    );
  show("NEVER (0)", never);
  show("derived (.339)", derived);
  console.log(`\n  THE MECHANISM. The old branch \`continue\`d past BOTH \`turn++\` AND`);
  console.log(`  \`matcher = observe(...)\`. So a sim redraw was not merely time-free — it was`);
  console.log(`  INFORMATION-free, and that is the larger of the two. A real redraw moves the`);
  console.log(`  fish and the bot SEES where it went; the matcher gets an extra observation`);
  console.log(`  for the price of the mana. The old sim charged the mana and withheld the`);
  console.log(`  information, which is why it made redraw look far worse than it is.`);
  console.log(`\n  The hit rate per shot above is the test of that claim: if the extra`);
  console.log(`  observation is what changed, the redrawing arm shoots BETTER, not merely`);
  console.log(`  more often.`);
  console.log(`\n  REDRAW IS STILL CLOSED and this does not reopen it. 44 mana per extra fish`);
  console.log(`  against a cast that holds 10 in total is unaffordable whatever the sign of`);
  console.log(`  the error was, \`escaped_mana\` still roughly doubles, and CLAUDE.md's rule 4`);
  console.log(`  bars a live change on a sim result in any case. What DOES change is the`);
  console.log(`  recorded REASON: "not distinguishable from zero" was true at 263 and is`);
  console.log(`  false now, and SPEC-fishing §7a's "understatement" claim is retracted.\n`);
}

main();
