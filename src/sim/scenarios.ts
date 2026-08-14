/**
 * src/sim/scenarios.ts — the hand-built battle states required by TASKS.md
 * Task 4, plus the threshold case from the session-04 brief §1.
 *
 * Every one is assembled from numbers that appear in the corpus: the player's
 * real loadout and the four observed enemies. Where a scenario reproduces an
 * actual recorded position, `from` names the fixture state. Shapes are not
 * invented — the point of a hand-built set is to reach positions the corpus
 * never happened to visit, using stats it did.
 */

import { bestKnownProfile, PLAYER } from "./enemies.js";
import { cloneCombatant, type BattleState, type Combatant, type MoveKey } from "./types.js";

/**
 * The lowest-tier capture available for a room — Safe for rooms 1, 2 and 4;
 * the only capture that exists (Risky) for room 3. These scenarios exercise
 * combat.ts with real numbers, not "what live play would fight", so falling
 * back across tiers here is fine — `dungeonSim.ts`'s `simulateRun` is the one
 * that must not.
 */
const enemy = (room: number): Combatant => {
  const p = bestKnownProfile(room);
  if (!p) throw new Error(`no observed enemy for room ${room}`);
  return cloneCombatant(p.enemy);
};

const player = (): Combatant => cloneCombatant(PLAYER);

interface Tweak {
  hp?: number;
  armor?: number;
  charges?: Partial<Record<MoveKey, number>>;
}

function tweak(c: Combatant, t: Tweak): Combatant {
  const out = cloneCombatant(c);
  if (t.hp !== undefined) out.hp = t.hp;
  if (t.armor !== undefined) out.armor = t.armor;
  for (const [m, v] of Object.entries(t.charges ?? {})) {
    out.moves[m as MoveKey].charges = v;
  }
  return out;
}

export interface Scenario {
  name: string;
  /** What this state is for — which branch of the decision it exercises. */
  note: string;
  /** Fixture this position was taken from, when it is a real one. */
  from?: string;
  state: BattleState;
}

export const SCENARIOS: Scenario[] = [
  {
    name: "opening-room-1",
    note: "Full HP, full armor, all charges. The clean baseline; every capture starts here.",
    from: "run-2026-08-14-01-00-08/state-000.json",
    state: { me: player(), foe: enemy(1), room: 1 },
  },
  {
    name: "opening-room-2",
    note: "Fresh enemy 64 at full pools, player carrying damage in. Room transitions do NOT refill the player.",
    from: "run-2026-08-13-23-29-39/state-010.json",
    state: {
      me: tweak(player(), { hp: 2, armor: 4, charges: { rock: 2, paper: 0, scissor: 3 } }),
      foe: enemy(2),
      room: 2,
    },
  },
  {
    name: "low-hp-armor-intact",
    note: "HP nearly gone but armor full — armor absorbs first, so this is far safer than it reads.",
    state: { me: tweak(player(), { hp: 6, armor: 15 }), foe: enemy(1), room: 1 },
  },
  {
    name: "low-hp-no-armor",
    note: "The genuinely dangerous shape: any lost exchange goes straight to HP.",
    from: "run-2026-08-13-23-29-39/state-006.json",
    state: { me: tweak(player(), { hp: 2, armor: 0 }), foe: tweak(enemy(1), { hp: 10, armor: 4 }), room: 1 },
  },
  {
    name: "enemy-one-hit-from-death",
    note: "Enemy on 1 HP, no armor. Any won or tied exchange ends it.",
    from: "run-2026-08-14-01-00-08/state-037.json",
    state: { me: tweak(player(), { hp: 22, armor: 15 }), foe: tweak(enemy(3), { hp: 1, armor: 0 }), room: 3 },
  },
  {
    name: "enemy-one-hit-but-armored",
    note: "Enemy on 1 HP behind full armor — 'one hit from death' is false while armor stands.",
    state: { me: player(), foe: tweak(enemy(1), { hp: 1, armor: 12 }), room: 1 },
  },
  {
    name: "self-one-hit-from-death",
    note: "We die to any lost exchange. Terminal-case weighting must dominate here.",
    state: { me: tweak(player(), { hp: 4, armor: 0 }), foe: tweak(enemy(1), { hp: 20, armor: 0 }), room: 1 },
  },
  {
    name: "mutual-one-hit-from-death",
    note: "Both sides lethal to each other. A tie kills both; utility must not treat that as a win.",
    state: { me: tweak(player(), { hp: 5, armor: 0 }), foe: tweak(enemy(1), { hp: 5, armor: 0 }), room: 1 },
  },
  {
    name: "zero-charge-enemy-sword",
    note: "Enemy Sword at 0. Under a hard limit its strongest opener is off the table.",
    state: { me: player(), foe: tweak(enemy(1), { charges: { rock: 0 } }), room: 1 },
  },
  {
    name: "zero-charge-enemy-spell",
    note: "Enemy Spell at 0 — its 16-ATK move. The single most valuable read in the game.",
    state: { me: player(), foe: tweak(enemy(1), { charges: { scissor: 0 } }), room: 1 },
  },
  {
    name: "negative-charge-enemy",
    note: "Charges observed going to -1 via the last-charge rule. Below zero is a real state, not a clamp.",
    from: "run-2026-08-14-01-00-08/state-018.json",
    state: {
      me: tweak(player(), { hp: 31, armor: 0, charges: { rock: -1 } }),
      foe: tweak(enemy(1), { hp: 10, armor: 0, charges: { paper: 0, scissor: 2 } }),
      room: 1,
    },
  },
  {
    name: "enemy-two-moves-locked",
    note: "Only Shield left. Under a hard limit the enemy's move is known exactly.",
    state: { me: player(), foe: tweak(enemy(1), { charges: { rock: 0, scissor: -1 } }), room: 1 },
  },
  {
    name: "all-my-moves-locked",
    note: "Every one of our moves non-positive. Unobserved server behaviour — must fail closed, never guess.",
    state: {
      me: tweak(player(), { charges: { rock: 0, paper: -1, scissor: 0 } }),
      foe: enemy(1),
      room: 1,
    },
  },
  {
    name: "threshold-tie-loop-zero-progress",
    note:
      "The real §1 threshold, corrected. Our Shield (ATK 6) mirrored against enemy 66's Shield (8/8): " +
      "on a tie the enemy regenerates 8 before taking 6, so its HP never moves and its armor never breaks. " +
      "Zero net progress, forever. The offset exists ONLY on a tie — a loser regenerates nothing.",
    state: { me: player(), foe: enemy(4), room: 4 },
  },
  {
    name: "threshold-tie-loop-progresses",
    note:
      "Same shape against enemy 63, whose Shield is 8/2. Our 6 clears the 2 and nets 4 per tie. " +
      "One point of DEF separates a winnable grind from an unwinnable one.",
    state: { me: player(), foe: enemy(1), room: 1 },
  },
  {
    name: "the-lost-run-position",
    note:
      "Session 03's losing position after six exchanges: enemy 63 still at 30/30 behind 8 armor. " +
      "Not because 6 ATK is below a restore rate, but because 6 per landed hit never outruns a " +
      "12-armor pool topped up 2-6 at a time. It is a rate race, not a flat threshold.",
    from: "run-2026-08-13-23-21-36/state-007.json",
    state: {
      me: tweak(player(), { hp: 11, armor: 0 }),
      foe: tweak(enemy(1), { hp: 30, armor: 8 }),
      room: 1,
    },
  },
  {
    name: "armor-cap-waste",
    // Two below the cap, expressed relative to it — the user's gear changes
    // between sessions (armorMax 15 -> 16 in session 06) and the scenario is
    // about waste, not about a particular ceiling.
    note: "Two below the armor cap, winning with Spell (DEF 8): 6 of the 8 regenerated is wasted. Excess does not bank.",
    state: { me: tweak(player(), { armor: player().armorMax - 2 }), foe: enemy(1), room: 1 },
  },
  {
    name: "overflow-armor-to-hp",
    note: "Armor 4 taking 16 — 4 absorbed, 12 carries to HP in the same exchange.",
    from: "run-2026-08-13-23-29-39/state-007.json",
    state: { me: tweak(player(), { hp: 20, armor: 4 }), foe: enemy(1), room: 1 },
  },
  {
    name: "deep-room-4-opening",
    note:
      "Enemy 66, the deepest position ever reached, at Safe tier — enemyBuff null, rolled stats zero. " +
      "[CORRECTED session 07] The recorded battle later shows Burn on the enemy, but that's the PLAYER's " +
      "own AddBurnSword boon landing on a Sword win, not an enemy or tier mechanic. This opening is clean.",
    from: "run-2026-08-14-01-00-08/state-040.json",
    state: { me: tweak(player(), { hp: 22, armor: 15, charges: { rock: 2, paper: 1 } }), foe: enemy(4), room: 4 },
  },
  {
    name: "high-def-enemy-66-shield",
    note: "Enemy 66's Shield is 8/8 — the highest restore in the corpus. Our Shield (6) is under it; our Spell (12) is not.",
    state: { me: player(), foe: enemy(4), room: 4 },
  },
  {
    name: "enemy-65-heavy-shield",
    note: "Enemy 65's Shield is 15/6 — a defensive move that also hits harder than our Spell. Do not assume Shield is weak.",
    state: { me: tweak(player(), { hp: 22, armor: 12 }), foe: tweak(enemy(3), { hp: 11, armor: 2 }), room: 3 },
  },
];
