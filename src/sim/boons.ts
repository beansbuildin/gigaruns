/**
 * src/sim/boons.ts — boons as state deltas, derived from before/after pairs.
 *
 * Task 4.5. The rule from the session-05 brief §3, held to strictly:
 *
 *   A boon is modelled ONLY if the corpus contains a state pair bracketing its
 *   pickup. Nothing is inferred from the option text. `UpgradePaper` almost
 *   certainly adds 4 to Shield — its name says so and its `selectedVal2` is 4 —
 *   and it is NOT modelled here, because nobody ever picked it and no recorded
 *   state shows what moved.
 *
 * A boon pickup is the pair (`rewardPathPhase` state → `enemyPathPhase` state).
 * All four in the corpus add exactly one entry to `pickedBoons`, so each pair
 * isolates a single boon with no attribution ambiguity.
 *
 * `tests/boons.test.ts` re-derives every delta below from the fixtures, so this
 * table cannot drift from the responses it claims to come from.
 *
 * Values come from `selectedVal1`/`selectedVal2`, NEVER `val1Min`/`val1Max`
 * (DECISIONS 2026-08-14). Heal's range is 8 and its `selectedVal1` is 16;
 * reading the range halves every boon.
 */

import type { Reason } from "./coverage.js";
import { cloneCombatant, type Combatant, type RolledStat } from "./types.js";

/** One entry of `rewardPathOptions[].boon`, reduced to what the sim needs. */
export interface BoonOption {
  type: string;
  val1: number;
  val2: number;
}

export type BoonEffect =
  /** `rolled[stat] += val1`. */
  | { kind: "rolled"; stat: RolledStat }
  /** `hp = min(hpMax, hp + val1)`. */
  | { kind: "heal" }
  /** Verified to change nothing at pickup. The effect is latent, in combat. */
  | { kind: "latent" };

export interface BoonModel {
  effect: BoonEffect;
  /**
   * Mechanics that taking this boon drags into the run. A boon can be perfectly
   * modelled at pickup and still make everything after it unscorable — that is
   * exactly what the two rolled-stat boons do, and it is the reason Task 4.5
   * does not move `deepestScorableRoom`.
   */
  contaminates: Reason[];
  /** The corpus pair this was read off. Asserted by tests/boons.test.ts. */
  evidence: string;
  /** What the pair actually showed, for the reader. */
  observed: string;
}

export const BOON_MODELS: Record<string, BoonModel> = {
  AddLuck: {
    effect: { kind: "rolled", stat: "lck" },
    // Modelled at pickup, useless in combat: `lck`'s effect on damage is
    // unexplained, so every exchange after this one is unscorable.
    contaminates: ["ROLLED_STATS"],
    evidence: "run-2026-08-13-23-29-39 state-008→state-009",
    observed: "selectedVal1 1 → lck.current 0 → 1",
  },
  AddEvasion: {
    effect: { kind: "rolled", stat: "evasion" },
    contaminates: ["ROLLED_STATS"],
    evidence: "run-2026-08-14-01-00-08 state-021→state-022",
    observed: "selectedVal1 1 → evasion.current 0 → 1",
  },
  AddTenacity: {
    // [session 06] Third rolled-stat boon with a pair, and the first whose
    // val1 is not 1 — so "rolled boons add selectedVal1" is now distinguishable
    // from "rolled boons add 1", which the two earlier samples could not
    // separate. It adds 2.
    effect: { kind: "rolled", stat: "tenacity" },
    contaminates: ["ROLLED_STATS"],
    evidence: "run-2026-08-14-03-26-57 state-005→state-006",
    observed: "selectedVal1 2 → tenacity.current 0 → 2",
  },
  Heal: {
    // The only fully clean boon in the corpus.
    effect: { kind: "heal" },
    contaminates: [],
    evidence: "run-2026-08-14-01-00-08 state-027→state-028",
    observed: "selectedVal1 16 → health.current 15 → 31 (hpMax 32)",
  },
  AddBurnSword: {
    // A zero delta is a RESULT here, not a gap: the pair proves the pickup
    // changes no stat. What it does is arm Burn on our Sword wins, and Burn is
    // behind a default-off flag (see `BURN_PER_EXCHANGE`), so taking it makes
    // the run unscorable for STATUS_EFFECT.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-14-01-00-08 state-038→state-039",
    observed: "selectedVal1 3 → no change to any player field",
  },
};

/**
 * Burn, as the corpus shows it — kept here rather than in `combat.ts` because
 * it is NOT part of the confirmed clean model.
 *
 * Evidence (enemy 66, the three exchanges the replay flags as unexplained):
 *   045→046  predicted HP 28, actual 25
 *   046→047  predicted 25/2, actual 24/0  → 9 taken = 6 ATK + 3
 *   047→048  predicted 24/2, actual 23/0  → 9 taken = 6 ATK + 3
 * `statusEffects` is `[{Burn, amount: 3}]` and the amount does NOT decrement
 * across all three. Burn first appears immediately after the player's first
 * Sword win of that battle, which is what `AddBurnSword` should do.
 *
 * Why this stays OFF by default despite fitting 3/3: the boon's `selectedVal1`,
 * the status `amount` and the damage are all the number 3, from a single status
 * instance at a single value, and it is never observed expiring — so "ticks for
 * `amount`" and "ticks for 3" and "ticks for the boon's val1" are the same
 * observation, and the duration is unknown. Same treatment as
 * `chargesAreHardLimit`: implemented, flagged, defaulted to the side that
 * refuses to score rather than the side that guesses.
 *
 * Turning it on buys nothing today — the only enemy ever seen burning is in
 * room 4, which is unscorable for ENEMY_BUFF regardless.
 */
export const BURN_PER_EXCHANGE = {
  /** Damage per exchange to the afflicted side, after the exchange's own damage. */
  perExchange: (amount: number): number => amount,
  decrements: false,
  observedSamples: 3,
  unknownDuration: true,
} as const;

export interface BoonApplication {
  player: Combatant;
  /** Empty only for a boon that is both modelled AND clean — i.e. Heal. */
  reasons: Reason[];
  /** Null when the type has no model. */
  model: BoonModel | null;
}

/**
 * Apply a boon to the player, fail-closed.
 *
 * An unmodelled type returns the player UNCHANGED plus `BOON_UNMODELLED`. The
 * unchanged state is not a claim that the boon does nothing — it is a state
 * that no reported number is ever allowed to depend on, because the reason code
 * makes everything downstream unscorable.
 */
export function applyBoon(player: Combatant, option: BoonOption): BoonApplication {
  const model = BOON_MODELS[option.type];
  if (!model) {
    return { player: cloneCombatant(player), reasons: ["BOON_UNMODELLED"], model: null };
  }

  const next = cloneCombatant(player);
  switch (model.effect.kind) {
    case "rolled":
      // Additive. Both samples went 0 → val1, so `+= val1` and `= val1` fit
      // equally; additive is the reading the "Add*" names support and the only
      // one that composes if two rolled-stat boons are ever taken in one run.
      next.rolled[model.effect.stat] += option.val1;
      break;
    case "heal":
      // The cap is UNVERIFIED: the one sample healed 15 → 31 against an hpMax
      // of 32, so it never reached the ceiling. Capping is the conservative
      // choice — HP has never been recorded above `currentMax` anywhere.
      next.hp = Math.min(next.hpMax, next.hp + option.val1);
      break;
    case "latent":
      break;
  }

  return { player: next, reasons: [...model.contaminates], model };
}

/** A recorded `rewardPathOptions` triple, with the room it was offered in. */
export interface BoonOffer {
  room: number;
  source: string;
  options: BoonOption[];
}

const opt = (type: string, val1: number, val2 = 0): BoonOption => ({ type, val1, val2 });

/**
 * Every reward offer the corpus contains. Four triples: two at room 1, one each
 * at rooms 2 and 3. The deepest run died in room 4 without clearing it, so
 * there is no room-4 offer and nothing beyond.
 *
 * The sim draws from these and does not synthesise offers. A generated offer
 * distribution would be inventing the single thing that decides how a run
 * develops, off a sample of four.
 *
 * Note what these show: of the 6 distinct options ever offered at room 1, ZERO
 * are both modelled and clean. That is Wall 1 in `handoff/scratch-session-05.md`
 * and it is why this task's gate cannot be met.
 */
export const OBSERVED_OFFERS: BoonOffer[] = [
  {
    room: 1,
    source: "run-2026-08-13-23-29-39/state-008",
    options: [opt("AddLuck", 1), opt("CorrosiveShield", 2), opt("UpgradePaper", 0, 4)],
  },
  {
    room: 1,
    source: "run-2026-08-14-01-00-08/state-021",
    options: [opt("AddEvasion", 1), opt("AddTenacity", 2), opt("AddBlock", 2)],
  },
  {
    room: 1,
    source: "run-2026-08-14-03-26-57/state-005",
    options: [opt("AddTenacity", 2), opt("AddLuck", 2), opt("AddBlock", 2)],
  },
  {
    // [session 06] The first room-1 offer containing a boon that is neither a
    // rolled stat nor an upgrade. `AddMaxArmor` was NOT taken, so it has no
    // pair and stays unmodelled — but it is the strongest candidate yet for a
    // clean room-1 boon, since a max-pool change is something combat.ts already
    // models. See QUESTIONS §5b.
    room: 1,
    source: "run-2026-08-14-03-26-57/state-016",
    options: [opt("AddMaxArmor", 2), opt("AddLuck", 1), opt("UpgradeScissor", 0, 4)],
  },
  {
    room: 2,
    source: "run-2026-08-14-01-00-08/state-027",
    options: [opt("Heal", 16), opt("UpgradeScissor", 4), opt("AddIntuition", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-14-01-00-08/state-038",
    options: [opt("AddBurnSword", 3), opt("TieDamageReduction", 8), opt("AddEvasion", 1)],
  },
];

export const offersForRoom = (room: number): BoonOffer[] =>
  OBSERVED_OFFERS.filter((o) => o.room === room);

/** Boon types the corpus has offered but never shows the effect of. */
export const UNMODELLED_TYPES: string[] = [
  ...new Set(
    OBSERVED_OFFERS.flatMap((o) => o.options.map((x) => x.type)).filter((t) => !BOON_MODELS[t]),
  ),
].sort();
