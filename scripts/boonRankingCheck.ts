/**
 * scripts/boonRankingCheck.ts — CODEXIMPROVE #5 (session 35), implementation
 * requirement 4.
 *
 * `loot.ts`'s own header is explicit: the ranking is UNVALIDATED and cannot
 * be validated against the real corpus, because no scored live run has ever
 * reached a second boon decision (`deepestScorableRoom` hasn't moved). That
 * status is unchanged by this script and this script does NOT change it —
 * see the header there before reading this as a corpus-validation result.
 *
 * What CAN get a sim-based signal, the same way session 33's fishing
 * ablation and session 34's charge-reserve ablation used synthetic data
 * rather than waiting on live corpus depth: for a CLEAN, modelled boon
 * (`effect.kind !== "latent"`, `contaminates: []` in `src/sim/boons.ts`),
 * applying it via `applyBoon()` and then running a short continuation
 * (`simulate()` from the next room, `SimOptions.startRoom`) produces a real
 * mean-rooms-cleared number for "what happens after taking this boon." That
 * is exactly what CODEXIMPROVE #5 asked this ranking to get right: does the
 * boon this session made the ranking prefer also come out ahead in a
 * controlled rollout, not just in the flat formula.
 *
 * Three controlled comparisons, one per requirement this session's ranking
 * change made:
 *   A. AddMaxArmor, big val1 vs small — requirement 1 (pool scaling).
 *   B. UpgradeRock, big DEF delta vs small — requirement 1 (upgrade scaling).
 *   C. AddMaxHealth vs AddMaxArmor at the SAME val1, on a hurt player —
 *      requirement 2 (the split). AddMaxHealth also lifts current HP
 *      (`boons.ts`'s `maxHealth` effect), so it should come out ahead.
 *
 * This is a controlled comparison over synthetic continuations, not a live
 * claim, and it is a genuinely separate check from `loot.ts`'s own
 * unvalidated-against-corpus status — one does not fix the other. Both
 * `rankBoons()`'s own score AND the rollout's mean-rooms-cleared are printed
 * for each pair so the two can be read side by side.
 *
 * Usage: npx tsx scripts/boonRankingCheck.ts [runs=5000]
 */

import { applyBoon, type BoonOption } from "../src/sim/boons.js";
import { simulate, randomPolicy } from "../src/sim/dungeonSim.js";
import { PLAYER } from "../src/sim/enemies.js";
import { cloneCombatant, type Combatant } from "../src/sim/types.js";
import { rankBoons } from "../src/strategy/loot.js";
import { strategyPolicy } from "../src/strategy/policy.js";

const RUNS = Number(process.argv[2] ?? 5000);
const BOON_ROOM = 2; // arbitrary mid-run pick point, matches the existing unit tests' convention
const CONTINUE_FROM_ROOM = BOON_ROOM + 1;
const rule = (s: string) => `\n${"═".repeat(78)}\n${s}\n${"═".repeat(78)}`;

const policy = strategyPolicy({ name: "ev-engine" });

interface Case {
  label: string;
  startingPlayer: Combatant;
  better: { name: string; option: BoonOption };
  worse: { name: string; option: BoonOption };
}

// 30% HP — "already going badly," the same threshold `scripts/liveRun.ts`'s
// `PROBE_HP_FRACTION` already uses for this project's other "is this player
// clearly hurt" gate, not a value picked to force a particular result here.
// At 50% HP the two options in case C come out within each other's rollout
// CI — a genuine near-tie, not a bug: armor is renewable through combat's
// own regen every future fight, HP is a one-time bank, so which is "better"
// at a middling HP is a real, close strategic tradeoff, not something this
// script should paper over by picking whichever fraction looks cleanest.
const hurt = (): Combatant => ({ ...cloneCombatant(PLAYER), hp: Math.round(PLAYER.hpMax * 0.3) });

const cases: Case[] = [
  {
    label: "A. AddMaxArmor — bigger val1 should roll forward better than smaller (pool scaling, requirement 1)",
    startingPlayer: cloneCombatant(PLAYER),
    better: { name: "AddMaxArmor val1=8", option: { type: "AddMaxArmor", val1: 8, val2: 0 } },
    worse: { name: "AddMaxArmor val1=2", option: { type: "AddMaxArmor", val1: 2, val2: 0 } },
  },
  {
    label: "B. UpgradeRock — bigger DEF delta should roll forward better than smaller (upgrade scaling, requirement 1)",
    startingPlayer: cloneCombatant(PLAYER),
    better: { name: "UpgradeRock val2=8", option: { type: "UpgradeRock", val1: 0, val2: 8 } },
    worse: { name: "UpgradeRock val2=2", option: { type: "UpgradeRock", val1: 0, val2: 2 } },
  },
  {
    label: "C. AddMaxHealth vs AddMaxArmor at the SAME val1, on a hurt player (the split, requirement 2)",
    startingPlayer: hurt(),
    better: { name: "AddMaxHealth val1=8", option: { type: "AddMaxHealth", val1: 8, val2: 0 } },
    worse: { name: "AddMaxArmor val1=8", option: { type: "AddMaxArmor", val1: 8, val2: 0 } },
  },
];

console.log(rule(`BOON RANKING CHECK — ${RUNS} runs/option, ev-engine policy, controlled comparison (NOT a live claim)`));

let allAgree = true;

for (const c of cases) {
  console.log(`\n${c.label}`);

  const ranked = rankBoons(c.startingPlayer, [c.better.option, c.worse.option], BOON_ROOM);
  const betterRankScore = ranked.find((r) => r.option === c.better.option)!.score;
  const worseRankScore = ranked.find((r) => r.option === c.worse.option)!.score;
  const rankAgrees = betterRankScore > worseRankScore;

  const betterPlayer = applyBoon(c.startingPlayer, c.better.option).player;
  const worsePlayer = applyBoon(c.startingPlayer, c.worse.option).player;

  const betterSim = simulate(RUNS, { policy, opponent: randomPolicy, chargesAreHardLimit: true, player: betterPlayer, startRoom: CONTINUE_FROM_ROOM }, 1);
  const worseSim = simulate(RUNS, { policy, opponent: randomPolicy, chargesAreHardLimit: true, player: worsePlayer, startRoom: CONTINUE_FROM_ROOM }, 1);
  const rolloutAgrees = betterSim.meanRoomsCleared > worseSim.meanRoomsCleared;

  console.log(`  rankBoons score:   ${c.better.name} = ${betterRankScore.toFixed(2)}  vs  ${c.worse.name} = ${worseRankScore.toFixed(2)}  -> ranking prefers "${betterRankScore > worseRankScore ? c.better.name : c.worse.name}"`);
  console.log(
    `  rollout (mean rooms cleared, continuation from room ${CONTINUE_FROM_ROOM}): ` +
      `${c.better.name} = ${betterSim.meanRoomsCleared.toFixed(3)} ± ${betterSim.roomsClearedCi95.toFixed(3)}  vs  ` +
      `${c.worse.name} = ${worseSim.meanRoomsCleared.toFixed(3)} ± ${worseSim.roomsClearedCi95.toFixed(3)}`,
  );
  console.log(`  ranking agrees with rollout direction: ${rankAgrees === rolloutAgrees ? "YES" : "NO"}`);
  if (rankAgrees !== rolloutAgrees) allAgree = false;
}

console.log(
  rule(
    allAgree
      ? "All controlled comparisons: the ranking's preference matches the rollout's direction."
      : "At least one controlled comparison disagreed — see above.",
  ),
);
console.log(
  "This is a controlled comparison over synthetic continuations, not a live claim, and it does NOT change\n" +
    "loot.ts's own unvalidated-against-corpus status — deepestScorableRoom has not moved. See loot.ts's header.",
);
