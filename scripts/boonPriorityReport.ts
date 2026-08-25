/**
 * scripts/boonPriorityReport.ts — session-56 brief §2d and §2e.
 *
 * Two questions, both about the user's boon directive
 * (`src/strategy/boonPriority.ts`), both answered off the corpus and the sim
 * rather than off a guess:
 *
 *   §2d  What is the directive's firing rate, and what does it reach for
 *        free? [session 96] This section used to open with an OVERLAP
 *        analysis against a second, gated boon layer, answering whether the
 *        directive subsumed it (it did not — the overlap was 1 of 5). That
 *        layer was deleted in session 96, so the overlap arm is gone with it
 *        and the firing-rate arm below is the whole of §2d. QUESTIONS.md §37
 *        records the deletion; `boonPriority.ts`'s own header keeps the 1-of-5
 *        measurement, which is still the reason this list was never widened.
 *   §2e  Does the directive cost depth against the unmodified `rankBoons`
 *        path? Reported either way and NOT tuned to the answer: the directive
 *        ships regardless, because it is the user's read of a game the
 *        simulator models incompletely.
 *
 * Read-only. No network.
 *
 *   npx tsx scripts/boonPriorityReport.ts [simRuns=2000]
 */

import { BOON_MODELS, OBSERVED_OFFERS } from "../src/sim/boons.js";
import {
  choosePriorityBoon,
  DEFAULT_BOON_PRIORITY,
  priorityOf,
  type BoonPriority,
} from "../src/strategy/boonPriority.js";
import { pickBoon } from "../src/strategy/loot.js";
import { randomPolicy, simulate } from "../src/sim/dungeonSim.js";
import { strategyPolicy } from "../src/strategy/policy.js";
import type { Combatant } from "../src/sim/types.js";

const SIM_RUNS = Number(process.argv[2] ?? 2000);
const rule = (s: string) => `\n${"═".repeat(74)}\n${s}\n${"═".repeat(74)}`;

/**
 * HP is swept rather than fixed: `rankBoons`' heal gate and its pool weighting
 * both move with it, so a single HP value can hide a disagreement that exists
 * at every other HP. Session 55 used the same four fractions.
 */
const HP_FRACTIONS = [1, 0.75, 0.5, 0.25] as const;
const player = (fraction: number): Combatant =>
  ({ hp: Math.max(1, Math.round(40 * fraction)), hpMax: 40, armor: 8, armorMax: 20, moves: {} }) as unknown as Combatant;

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);

// ── FIRING RATE, and the by-product capture ───────────────────────────────
console.log(rule("§2d — firing rate of the directive, and what it reaches for free"));

let fired = 0;
let disagreed = 0;
let decisions = 0;
const byPriority = new Map<BoonPriority, number>();
const reachedUnmodelled = new Map<string, number>();
const firedRoom1 = new Set<number>();

OBSERVED_OFFERS.forEach((offer, idx) => {
  let firedHere = false;
  for (const f of HP_FRACTIONS) {
    decisions++;
    const p = player(f);
    const ranked = pickBoon(p, offer.options, offer.room);
    const d = choosePriorityBoon({ player: p, offered: offer.options, room: offer.room });
    if (!d) continue;
    firedHere = true;
    fired++;
    byPriority.set(d.priority, (byPriority.get(d.priority) ?? 0) + 1);
    if (d.option.type !== ranked.type) disagreed++;
    if (!BOON_MODELS[d.option.type]) {
      reachedUnmodelled.set(d.option.type, (reachedUnmodelled.get(d.option.type) ?? 0) + 1);
    }
  }
  if (firedHere && offer.room === 1) firedRoom1.add(idx);
});

const room1Offers = OBSERVED_OFFERS.filter((o) => o.room === 1).length;
console.log(`
  decisions swept: ${decisions}  (${OBSERVED_OFFERS.length} captured offers × ${HP_FRACTIONS.length} HP fractions)
  the directive matched something:  ${fired}  (${pct(fired, decisions)})
  ...and CHANGED the pick vs rankBoons: ${disagreed}  (${pct(disagreed, decisions)})
  room-1 offers where it fires:     ${firedRoom1.size} of ${room1Offers}  (${pct(firedRoom1.size, room1Offers)})

  by priority rank:`);
for (const rank of [1, 2, 3, 4, 5] as BoonPriority[]) {
  console.log(`    ${rank}  ${String(byPriority.get(rank) ?? 0).padStart(4)} decision(s)`);
}

console.log(`
  UNMODELLED types the directive picks — pickup pairs as a BY-PRODUCT, at no
  strategic cost, where session 55 measured rankBoons reaching 0 in 540
  decisions. This is what makes capture nearly free for these types:`);
if (reachedUnmodelled.size === 0) {
  console.log("    (none — if this is ever empty the 'capture is nearly free' claim is stale)");
} else {
  for (const [t, n] of [...reachedUnmodelled].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t.padEnd(24)} ${String(n).padStart(3)} decision(s)   priority ${priorityOf(t, 1) ?? priorityOf(t, 99)}`);
  }
}

// ── §2e SIM HEAD-TO-HEAD ──────────────────────────────────────────────────
console.log(rule(`§2e — sim head-to-head, ${SIM_RUNS} runs each (reported, NOT tuned to)`));

const base = simulate(
  SIM_RUNS,
  { policy: strategyPolicy({ name: "ev-engine" }), opponent: randomPolicy, chargesAreHardLimit: true },
  1,
);
const directive = simulate(
  SIM_RUNS,
  {
    policy: strategyPolicy({ name: "ev-engine+priority", boonPriority: DEFAULT_BOON_PRIORITY }),
    opponent: randomPolicy,
    chargesAreHardLimit: true,
  },
  1,
);

const band = (s: typeof base): string => {
  const r = s.battlesByRoom.get(1);
  if (!r || r.winRate === null) return "nothing scorable at room 1";
  const ci = r.ci95 ?? 0;
  return `${(100 * r.winRate).toFixed(1)}% ± ${(100 * ci).toFixed(1)}  (${r.won}/${r.scored} scored)`;
};

console.log(`
  ROOM-1 BATTLE WIN RATE, scored subset, 95% CI
    rankBoons (control)   ${band(base)}
    directive             ${band(directive)}

  mean rooms cleared      rankBoons ${base.meanRoomsCleared.toFixed(3)} ± ${base.roomsClearedCi95.toFixed(3)}` +
  `   directive ${directive.meanRoomsCleared.toFixed(3)} ± ${directive.roomsClearedCi95.toFixed(3)}
  battle coverage         rankBoons ${(100 * base.battleCoverage.fraction).toFixed(0)}%` +
  `   directive ${(100 * directive.battleCoverage.fraction).toFixed(0)}%
  deepestScorableRoom     rankBoons ${base.deepestScorableRoom}   directive ${directive.deepestScorableRoom}`);

const dRooms = directive.meanRoomsCleared - base.meanRoomsCleared;
const halfWidth = base.roomsClearedCi95 + directive.roomsClearedCi95;
const separated = Math.abs(dRooms) > halfWidth;
console.log(`
  Δ mean rooms cleared: ${dRooms >= 0 ? "+" : ""}${dRooms.toFixed(3)}  (combined 95% half-width ${halfWidth.toFixed(3)})
  ${
    separated
      ? `→ SEPARATED: the sim says the directive ${dRooms > 0 ? "HELPS" : "COSTS"} depth.`
      : "→ NOT SEPARATED: the sim cannot distinguish the two arms at this n."
  }

  READ THIS BEFORE ACTING ON THE NUMBER ABOVE. The sim's boon arm is the
  weakest thing it models: \`deepestScorableRoom\` is ${base.deepestScorableRoom}, so almost every run
  goes unscorable at the first boon, and the directive deliberately picks types
  the sim has NO model for (they apply nothing, by design — src/sim/boons.ts
  fails closed). An arm that picks unmodelled boons is therefore partly being
  measured on boons that do nothing in the sim and something real in the game.
  That biases this comparison AGAINST the directive. It is reported because the
  brief asked for it either way, and it is explicitly not a reason to tune the
  ordering — the ordering is the user's call about their own account.`);
