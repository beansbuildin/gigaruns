/**
 * src/strategy/fishing/oilTiming.ts — [session 61 §4d] WHEN to consume an oil.
 * Pure: state in, decision out, no I/O and no network.
 *
 * `oilPolicy.ts` answers "may we spend one at all" (budget, approval, balance).
 * This answers "is now the moment". The two are deliberately separate modules
 * because they fail for different reasons and are authorized by different
 * people: the budget is the user's, the timing is derived and then approved.
 *
 * ## READ THIS BEFORE READING ANY NUMBER PRODUCED FROM IT
 *
 * **The corpus contains no usable oil data.** 93 of 94 casts spent no
 * consumable at all, and the 94th (12975152) spent one before capture began,
 * with the item unidentifiable. So every candidate below is scored against a
 * MODEL of the oils' effect, built from the item payloads
 * (`FishingRestoreFocus` +2, `FishingDamageFish` +2) and not from a single
 * observed oil cast. That is stated here rather than in a footnote because it
 * bounds what any recommendation from this file can be worth.
 *
 * ## The mechanic this file cannot resolve, and carries both ways instead
 *
 * Does consuming an oil COST A TURN? The payload does not say (see
 * `oilPolicy.ts`). Every policy here is therefore scored under BOTH
 * assumptions, and neither is the default.
 */

import type { Cell } from "../../sim/fishing/geometry.js";

/** The two oils, and what the payloads say they do. Amounts are the MODEL's inputs, so a sweep can vary them. */
export interface OilEffects {
  /** `FishingRestoreFocus` amount on Mid Focus Oil (942). Payload says 2. */
  focusRestore: number;
  /** `FishingDamageFish` amount on Mid Relaxing Oil (937). Payload says 2. */
  fishDamage: number;
}

export const PAYLOAD_OIL_EFFECTS: OilEffects = { focusRestore: 2, fishDamage: 2 };

export interface OilTimingState {
  turn: number;
  fishHp: number;
  fishMaxHp: number;
  mana: number;
  /** Focus-meter points left. Never regenerates within a cast (CONFIRMED session 13). */
  focusRemaining: number;
  focusMax: number;
  focusOilHeld: number;
  relaxingOilHeld: number;
  /** Where the focus marker currently sits — unused by the shipped candidates, present so a positional policy is expressible. */
  focusCell?: Cell;
}

export type OilKind = "focus" | "relaxing";

/** Which oils to consume THIS turn, in order. Empty = none. */
export type OilTimingDecision = OilKind[];

export interface OilTimingPolicy {
  name: string;
  /** One-line statement of the causal claim the policy rests on — reported beside its score, so a winner has to have a reason. */
  thesis: string;
  decide(s: OilTimingState, effects: OilEffects): OilTimingDecision;
}

/** Control arm. Never consumes. Every other policy is scored against this. */
export const neverOil: OilTimingPolicy = {
  name: "never",
  thesis: "control arm — the fishery as it is played today.",
  decide: () => [],
};

/**
 * The brief's own baseline, and explicitly NOT a strawman: consume both at
 * cast start. Un-overfittable to a corpus with no oil casts in it, because it
 * has no trigger to fit. If nothing beats it robustly it wins on that alone.
 */
export const consumeAtStart: OilTimingPolicy = {
  name: "start",
  thesis: "spend immediately; a held oil earns nothing, and an unspent one at cast end is pure waste.",
  decide: (s) => {
    if (s.turn !== 0) return [];
    const out: OilKind[] = [];
    if (s.focusOilHeld > 0) out.push("focus");
    if (s.relaxingOilHeld > 0) out.push("relaxing");
    return out;
  },
};

/**
 * **The lethal trigger.** Spend the Relaxing Oil exactly when its damage is
 * enough to finish the fish, converting a probabilistic shot into a certain
 * catch. Focus Oil when the meter is exhausted, which is the only state in
 * which restoring it changes any reachable cell.
 *
 * This is the policy with the strongest causal story, and the story is worth
 * more than the score: at `fishHp <= fishDamage` the oil ENDS the cast, so
 * whether consuming costs a turn is irrelevant — there is no next turn to
 * lose. It is the one trigger that is provably indifferent to the mechanic
 * this project cannot yet measure.
 */
export const onDemand: OilTimingPolicy = {
  name: "on-demand",
  thesis:
    "spend the Relaxing Oil only when it is LETHAL (converting a probabilistic shot into a certain catch, " +
    "which also makes it indifferent to whether consuming costs a turn), and the Focus Oil only when the " +
    "meter is at zero, the only state where restoring it changes which cells are reachable.",
  decide: (s, e) => {
    const out: OilKind[] = [];
    if (s.relaxingOilHeld > 0 && s.fishHp > 0 && s.fishHp <= e.fishDamage) out.push("relaxing");
    if (s.focusOilHeld > 0 && s.focusRemaining <= 0) out.push("focus");
    return out;
  },
};

/** The lethal trigger alone — isolates how much of `on-demand` is the Relaxing Oil. */
export const lethalRelaxingOnly: OilTimingPolicy = {
  name: "lethal-relaxing-only",
  thesis: "as on-demand, but never spends the Focus Oil — isolates which of the two oils is carrying the effect.",
  decide: (s, e) => (s.relaxingOilHeld > 0 && s.fishHp > 0 && s.fishHp <= e.fishDamage ? ["relaxing"] : []),
};

/** The meter trigger alone — the other half of the same decomposition. */
export const focusWhenEmptyOnly: OilTimingPolicy = {
  name: "focus-when-empty-only",
  thesis: "as on-demand, but never spends the Relaxing Oil.",
  decide: (s) => (s.focusOilHeld > 0 && s.focusRemaining <= 0 ? ["focus"] : []),
};

/**
 * The SHIPPED heuristic (c), session 43, expressed as a timing policy so it is
 * scored on the same footing as everything else rather than assumed good.
 * Trigger: fish HP at or below 15% of its own max — which on a 20-HP fish is
 * 3 HP, i.e. NOT always lethal at +2, and that difference is the whole point
 * of scoring it separately from `lethal-relaxing-only`.
 */
export const heuristicC: OilTimingPolicy = {
  name: "heuristic-c",
  thesis:
    "session 43's shipped rule: fish HP at or below 15% of max is a legitimate Relaxing Oil spend. Scored " +
    "here to check whether a fraction-of-max trigger beats a lethality trigger, since the two only differ on " +
    "fish where 15% exceeds the oil's damage.",
  decide: (s) => (s.relaxingOilHeld > 0 && s.fishMaxHp > 0 && s.fishHp / s.fishMaxHp <= 0.15 ? ["relaxing"] : []),
};

export const OIL_TIMING_POLICIES: readonly OilTimingPolicy[] = [
  neverOil,
  consumeAtStart,
  onDemand,
  lethalRelaxingOnly,
  focusWhenEmptyOnly,
  heuristicC,
];
