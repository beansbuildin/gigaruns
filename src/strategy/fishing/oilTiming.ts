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
 * with the item unidentifiable.
 *
 * **[session 64] Now ONE fully-captured oil cast (13019015), and it is this
 * bot's own.** That is enough to confirm the MECHANICS below (the +2, the
 * slot, the turn and mana cost) and nowhere near enough to score an EFFECT:
 * n=1, and the trigger fires because of the cast's own state, so a consuming
 * cast is selected, not sampled.
 *
 * So every candidate below is still scored against a MODEL of the oils'
 * effect, built from the item payloads (`FishingRestoreFocus` +2,
 * `FishingDamageFish` +2) rather than from observed oil casts. The one live
 * consume CONFIRMS the Focus payload's +2 exactly; it does not turn the model
 * into a measurement. That is stated here rather than in a footnote because it
 * bounds what any recommendation from this file can be worth.
 *
 * ## The mechanic this file could not resolve — RESOLVED [session 64]
 *
 * Does consuming an oil COST A TURN? The payload never said, so every policy
 * here was scored under BOTH assumptions with neither as the default.
 *
 * **It costs no turn.** Measured on the first live consume (cast 13019015,
 * Mid Focus Oil at `focusMeter: 0`): the `use_fishing_item` response carries
 * `FOCUS_STAMINA_DIFF` and NO `FISH_MOVED`, and `fishPosition`,
 * `previousFishPosition`, `lastMovePath`, `hand`, `discard` and
 * `nextCardIndex` are byte-identical across it. The fish does not move, no
 * card leaves the hand, and no mana is spent. SPEC-fishing §4a carries the
 * full envelope.
 *
 * **What this changes, and what it does not.** The dual scoring can now
 * collapse to the free-consume arm, which is the FAVOURABLE one — so any
 * recommendation already made under both assumptions still stands, and no
 * policy ranking here is invalidated. It is not re-scored in this file
 * because that is a sweep, not a definition; see `scripts/oilTimingSweep.ts`.
 *
 * It also removes the one thing that made `lethal-relaxing-only` specially
 * defensible. Its thesis says the lethal trigger "is provably indifferent to
 * the mechanic this project cannot yet measure" — true, and now unremarkable,
 * because every trigger is indifferent to it. That is an argument the shipped
 * policy no longer needs rather than one it has lost.
 */

import type { Cell } from "../../sim/fishing/geometry.js";
import { reachableCells } from "../../sim/fishing/geometry.js";
import {
  evaluateCardAtFocus,
  type Distribution,
  type FishingCardLike,
} from "./cardChoice.js";

/** The two oils, and what the payloads say they do. Amounts are the MODEL's inputs, so a sweep can vary them. */
export interface OilEffects {
  /** `FishingRestoreFocus` amount on Mid Focus Oil (942). Payload says 2. */
  focusRestore: number;
  /** `FishingDamageFish` amount on Mid Relaxing Oil (937). Payload says 2. */
  fishDamage: number;
}

export const PAYLOAD_OIL_EFFECTS: OilEffects = { focusRestore: 2, fishDamage: 2 };

/**
 * **[session 65 §3] The turn cost, MEASURED — no longer a swept parameter.**
 *
 * *Live-measured, session 64, cast 13019015 (Mid Focus Oil 942 at
 * `focusMeter: 0`); re-confirmed session 65 on item 937.* `use_fishing_item`
 * costs **no turn**: the response carries `FOCUS_STAMINA_DIFF` and no
 * `FISH_MOVED`, and `fishPosition`, `previousFishPosition`, `lastMovePath`,
 * `hand`, `discard` and `nextCardIndex` are identical across it. No mana
 * either (942: 3→3; 937: 6→6).
 *
 * This constant exists so the answer has ONE home. `scripts/oilTimingSweep.ts`
 * swept `costsTurn` over `[false, true]` because the payload never said; that
 * is now a resolved parameter, and a sweep that keeps sweeping a resolved
 * parameter quietly re-opens a settled question every time it is run.
 * `tests/fishing/oilTiming.test.ts` pins both this value and the fact that the
 * sweep's recommendation is drawn from the arm it names.
 *
 * **Deliberately NOT deleting the `costsTurn` option from `castSim`.** The
 * simulator should still be able to model a turn-costing consumable — the
 * game has other consumables and may add more. What is fixed is which arm
 * THESE oils are scored in, not what the simulator can express.
 */
export const MEASURED_CONSUME_COSTS_TURN = false;

export interface OilTimingState {
  turn: number;
  fishHp: number;
  fishMaxHp: number;
  mana: number;
  /** Focus-meter points left. Never regenerates within a cast THROUGH CARD PLAY (CONFIRMED session 13); a Focus Oil is the one exception, measured session 64. */
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
  /**
   * [session 67 §1] Takes the WIDER `OilDecisionState`, not `OilTimingState`.
   *
   * Every policy written before the necessity gate declares its parameter as
   * `OilTimingState` and reads none of the new fields, so all of them still
   * satisfy this signature unchanged — a function accepting a supertype is
   * assignable where one accepting a subtype is wanted. What DOES change is
   * the obligation on callers: `castSim` must now supply `focusCell` and
   * `board`, and it fails to compile if it does not.
   */
  decide(s: OilDecisionState, effects: OilEffects): OilTimingDecision;
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
 * **The on-demand TRIGGERS, evaluated independently of how many oils are held.**
 *
 * [session 62 §1b] Split out of `onDemand.decide` so the live loop can tell
 * apart two states that `decide` deliberately collapses:
 *
 *   - the trigger did not fire, and
 *   - the trigger fired and the account held none of that oil.
 *
 * `decide` returns `[]` for both, which is right for the SIM (a policy that
 * cannot spend an oil plays on without one) and wrong for the LIVE record. The
 * user has a few oils, fewer than a batch needs, so stock runs out MID-batch;
 * a cast the oil policy played while dry is not an oil cast and is not a clean
 * non-oil cast either, and folding it into either arm is how the dead era
 * poisoned a rate for 40 casts before anyone noticed.
 *
 * This is also the shape `tests/fishing/oilTiming.test.ts` pins the shipped
 * live policy against — the trigger, not a literal threshold, so reinstating
 * session 43's fraction-of-max heuristic fails the test even if someone picks
 * a fraction that happens to equal 2 HP on the fish in the fixture.
 *
 * `onDemand.decide` is defined in terms of this, so the two cannot drift.
 */
export function onDemandTriggers(s: OilTimingState, e: OilEffects): OilKind[] {
  const out: OilKind[] = [];
  // LETHAL, not "low": at `fishHp <= fishDamage` the oil ends the cast, which
  // is what makes this trigger indifferent to the turn-cost mechanic.
  if (s.fishHp > 0 && s.fishHp <= e.fishDamage) out.push("relaxing");
  // ZERO, not "low": card play never regenerates the meter (CONFIRMED session
  // 13, re-scored session 64 with the oil transition excluded), so zero is the
  // only state where +2 changes a reachable cell. The oil itself is the sole
  // regeneration there is, which is exactly why this trigger is its moment.
  if (s.focusRemaining <= 0) out.push("focus");
  return out;
}

/** How many of `kind` the state says are held — the stock half of the decision, kept beside the trigger half. */
export function heldOf(s: OilTimingState, kind: OilKind): number {
  return kind === "focus" ? s.focusOilHeld : s.relaxingOilHeld;
}

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
 *
 * **[session 62 §1, USER-APPROVED and SHIPPED LIVE.]** This is no longer a
 * candidate among candidates: it is the policy `scripts/liveFishing.ts` plays,
 * replacing session 43's heuristic (c). See `handoff/OIL-POLICY.md`.
 */
export const onDemand: OilTimingPolicy = {
  name: "on-demand",
  thesis:
    "spend the Relaxing Oil only when it is LETHAL (converting a probabilistic shot into a certain catch, " +
    "which also makes it indifferent to whether consuming costs a turn), and the Focus Oil only when the " +
    "meter is at zero, the only state where restoring it changes which cells are reachable.",
  decide: (s, e) => onDemandTriggers(s, e).filter((k) => heldOf(s, k) > 0),
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



// ───────────────────────────────────────────────────────────────────────────
// [session 67 §1] THE NECESSITY GATE — "oils are a backup, not a routine spend"
//
// ## The directive
//
// User, 2026-08-21: *"use oils only on an as-needed basis. If the autofisher
// believes it can catch the fish without oil, don't use the oil — conserve
// inventory for future casts. The priority is to use mana to get the fish as
// close as possible to caught, with the oils as a backup to guarantee a catch
// if need be."*
//
// **DERIVED AND SCORED, NOT SHIPPED.** `scripts/liveFishing.ts` still plays
// `onDemandTriggers`. Nothing below has a live call site, by instruction
// (session-67 brief §1d) and by CLAUDE.md rule 4.
//
// ## Why "believes it can catch the fish" needs a NUMBER, not a sentence
//
// The obvious reading — *skip the oil when a card in hand can finish the
// fish* — collapses on contact with the mechanics. A card only deals damage
// if it CONNECTS, and whether it connects depends on where the fish moves,
// which is exactly the thing this bot is uncertain about. Read strictly
// ("can a card GUARANTEE the kill?") the answer is almost always no, and the
// gate degenerates to always-fire — i.e. back to `on-demand`, the policy the
// directive is asking to change. Read loosely ("could a card conceivably kill
// it?") the answer is almost always yes and the gate degenerates to
// never-fire, which throws the oils away rather than conserving them.
//
// **So the gate is a THRESHOLD on a probability, and the threshold is the
// directive's conservatism dial made explicit.** Both degenerate readings are
// still expressible — they are the endpoints of the same dial — which is what
// makes the pin in `tests/fishing/oilNecessity.test.ts` meaningful rather
// than decorative: it asserts that the shipped-candidate threshold is
// strictly between two behaviours that the same code can produce.
//
// ## "Mana first" is true BY CONSTRUCTION here, and that is worth stating
//
// The directive ranks mana ahead of oils, and the brief asked for a check
// that the gate does not make the bot hold mana back in anticipation of an
// oil. It cannot: the oil decision is taken in `castSim.ts` BEFORE
// `opts.policy.act`, and the context that reaches the card policy
// (`FishPolicyContext`) carries no oil field of any kind — not the held
// counts, not the trigger, not this gate's verdict. The card policy is
// therefore a pure function of state that does not mention oils, so no oil
// policy expressible in this file can change which card it plays or how much
// mana it spends on the turn the oil is considered. Pinned by a test on the
// context's own key set rather than by this paragraph.

/**
 * What the gate needs to see that `OilTimingState` does not carry: the hand,
 * the fish's predicted position, and the grid it sits on. Exactly the fields
 * `castSim`'s `FishPolicyContext` already has in scope at the moment the oil
 * decision is taken, so nothing new is computed for the gate's benefit.
 */
export interface OilBoardView {
  hand: readonly FishingCardLike[];
  dist: Distribution;
  gridSize: number;
}

/**
 * `OilTimingState` plus what a necessity gate must see. Two narrowings, both
 * REQUIRED rather than optional, and both on purpose:
 *
 *   - `focusCell` stops being optional. Reachability is meaningless without
 *     it, and an undefined-means-fail-closed branch would be a silent
 *     degeneration to one of the two endpoints this whole design exists to
 *     avoid. Making it a compile error is the same trick as
 *     `LiveFishingIsolatedPaths` and `OilSpendContext`.
 *   - `board` is added.
 *
 * `OilTimingPolicy.decide` takes THIS type, so every existing policy (which
 * declares its parameter as the wider `OilTimingState` and reads none of the
 * new fields) still typechecks unmodified, while `castSim` is forced at
 * compile time to supply the new fields. One call site had to change.
 */
export interface OilDecisionState extends OilTimingState {
  focusCell: Cell;
  board: OilBoardView;
}

const amountOf = (effects: readonly { amount: number }[]): number => effects[0]?.amount ?? 0;

/**
 * P(playing `card` at `focus` drives `fishHp` to <= 0 this turn).
 *
 * Crit and hit are disjoint outcomes with their own damage amounts, so each
 * contributes only if ITS amount finishes the fish. `evaluateCardAtFocus`
 * already computes both probabilities against the same distribution the card
 * policy will use, which is the point of reusing it rather than re-deriving
 * the geometry: the gate must be asking about the play the bot would actually
 * make, not about a differently-modelled one. Its `missPenaltyMultiplier`
 * argument only scales the `ev` field, which is discarded here.
 */
export function killProbabilityAt(
  card: FishingCardLike,
  focus: Cell,
  fishHp: number,
  board: OilBoardView,
): number {
  const { pHit, pCrit } = evaluateCardAtFocus(card, focus, board.dist, board.gridSize, 1);
  const hitAmount = amountOf(card.hitEffects);
  const critAmount = card.critZones.length > 0 ? amountOf(card.critEffects) : hitAmount;
  return (hitAmount >= fishHp ? pHit : 0) + (critAmount >= fishHp ? pCrit : 0);
}

/**
 * The best chance the bot has of finishing the fish THIS TURN with a card it
 * can actually afford, maximised over every affordable card and every focus
 * placement the remaining meter allows. This is the operational reading of
 * *"the autofisher believes it can catch the fish without oil"*.
 *
 * Unaffordable cards are excluded rather than discounted: a card that cannot
 * be played is not a reason to withhold the oil, and counting it would be the
 * precise failure the directive is guarding against.
 */
export function bestKillProbability(s: OilDecisionState): number {
  const cells = reachableCells(s.board.gridSize, s.focusCell, Math.max(0, s.focusRemaining));
  let best = 0;
  for (const card of s.board.hand) {
    if (card.manaCost > s.mana) continue;
    for (const f of cells) best = Math.max(best, killProbabilityAt(card, f, s.fishHp, s.board));
  }
  return best;
}

/**
 * The best chance of CONNECTING at all from the cell the marker is frozen on.
 *
 * The Focus Oil's necessity case is different from the Relaxing Oil's and must
 * not be modelled with the same function. At `focusRemaining <= 0` the policy
 * cannot aim: `reachableCells(grid, cell, 0)` is exactly `[cell]`, so every
 * remaining shot this cast is taken from one square. The question is therefore
 * not "can a card kill the fish" but "can a card REACH it" — a meter with two
 * points restored is worth nothing on a turn where the frozen cell already
 * covers the fish's likely position, and worth a great deal on a turn where it
 * covers none of it.
 */
export function bestConnectProbabilityFromFrozenCell(s: OilDecisionState): number {
  let best = 0;
  for (const card of s.board.hand) {
    if (card.manaCost > s.mana) continue;
    const { pHit, pCrit } = evaluateCardAtFocus(card, s.focusCell, s.board.dist, s.board.gridSize, 1);
    best = Math.max(best, pHit + pCrit);
  }
  return best;
}

/**
 * The conservatism dial, and the two values that make it degenerate.
 *
 * A gate fires when the bot's own best chance is BELOW its threshold. So:
 *
 *   - `0` — nothing can be below zero, the arm never fires, the policy is
 *     `never` for that oil.
 *   - anything `> 1` — every probability is below it, the arm always fires,
 *     the policy is `on-demand`'s trigger for that oil.
 *
 * Both are real, reachable configurations of the same code, which is what
 * lets `tests/fishing/oilNecessity.test.ts` pin the recommended value as
 * strictly between two behaviours rather than merely asserting a number.
 */
export const NEVER_FIRES_THRESHOLD = 0;
export const ALWAYS_FIRES_THRESHOLD = 2;

export interface OilNecessityThresholds {
  /** Spend the Relaxing Oil only when the best affordable card's kill chance is below this. */
  relaxing: number;
  /** Spend the Focus Oil only when the best affordable card's chance of connecting from the frozen cell is below this. */
  focus: number;
}

/**
 * **The recommended thresholds, and the reason they are 1 and not a tuned
 * number — see `handoff/OIL-CONSERVE.md` for the sweep.** Not shipped:
 * `scripts/liveFishing.ts` still plays `onDemandTriggers`.
 *
 * At `1`, a gate fires unless the bot's best chance is EXACTLY certain, so the
 * policy reads back as the directive's own sentence with no free parameter in
 * it: *if the bot can guarantee the outcome without the oil, don't spend the
 * oil.*
 *
 * That is available because both quantities the gates read turn out to be
 * strongly BIMODAL rather than spread — measured, `scripts/oilConserveSweep.ts`
 * §2b, at the moments `onDemandTriggers` actually fires:
 *
 *   `bestKillProbability`      34.3% exactly 0, 55.8% exactly 1, 9.9% between
 *   `bestConnectProbability`   59.8% exactly 0, 27.8% exactly 1, 12.5% between
 *
 * so every threshold from 0.25 to 1 lands on the same plateau (catch 88.29% to
 * 88.46%, 2.18 to 2.42 oils per extra fish) and the tuned pair buys 0.08pp for
 * a constant somebody would later have to defend. A fitted parameter that
 * cannot be distinguished from 1 on the sim that fitted it is not worth
 * shipping — especially in a simulator whose control arm catches 68.71%
 * against a real fishery's 25.9%.
 */
export const RECOMMENDED_NECESSITY_THRESHOLDS: OilNecessityThresholds = { relaxing: 1, focus: 1 };

// ---------------------------------------------------------------------------
// [session 69 §3] THE EXCHANGE-RATE THRESHOLD — derived, PRE-REGISTERED, and
// deliberately not fitted. NOT SHIPPED: `scripts/liveFishing.ts` still plays
// `onDemandTriggers`, and this is evaluated in shadow beside it.
// ---------------------------------------------------------------------------

/**
 * **The user's question, made arithmetic.** A lethal-band Relaxing Oil converts
 * an uncertain catch into a certain one. If `p` is the chance of taking the
 * fish without it, spending gains `(1 - p)` fish and costs one oil. So the oil
 * is worth spending exactly when
 *
 *     (1 - p)  >  v          where `v` = what one oil is worth, IN FISH
 *
 * and holding is right when `p >= 1 - v`. That is the whole derivation: the
 * hold threshold is one minus the value of an oil.
 *
 * **This is the reason the number is not tuned, and the distinction matters
 * more than the value.** A swept threshold is chosen because it scores well on
 * the simulator that swept it — and CLAUDE.md's standing guidance says not to,
 * on a sim whose control arm catches 68.71% against a real fishery's 25.9%.
 * This one is chosen because the user is trading oils for fish at a rate that
 * was MEASURED, so the only way to argue with it is to argue with the
 * measurement. If the exchange rate is re-measured, the threshold moves as a
 * consequence rather than as a decision.
 */
export function holdThresholdFromExchangeRate(oilsPerExtraFish: number): number {
  if (!(oilsPerExtraFish > 0)) {
    throw new Error(`oilsPerExtraFish must be > 0, got ${oilsPerExtraFish} — an oil that buys no fish has no exchange rate`);
  }
  // An oil worth MORE than a whole fish would put the threshold below zero,
  // i.e. never hold. Clamped rather than allowed to go negative, so the
  // degenerate reading is the named `NEVER_FIRES_THRESHOLD` and not a silent
  // sign flip.
  return Math.max(NEVER_FIRES_THRESHOLD, 1 - 1 / oilsPerExtraFish);
}

/**
 * **The measured rate, corpus-derived, session 66.** Holding zero Mid Relaxing
 * Oil costs an expected +1.83pp of catch rate over the 109-cast corpus, 95%
 * Wilson [0.5pp, 6.4pp] — about **six oils per extra fish**, with the interval
 * spanning roughly 1.5 to 20. `handoff/reports/session-66-relaxing-cost.md`.
 *
 * **The interval is not decoration.** At 1.5 oils/fish the hold threshold is
 * 0.33 and at 20 it is 0.95; the point estimate's 0.83 sits between two
 * genuinely different policies. Any report of this threshold that omits the
 * interval is overstating what was measured — the numerator behind the point
 * estimate is TWO casts.
 */
export const MEASURED_RELAXING_OILS_PER_EXTRA_FISH = 6;
export const MEASURED_RELAXING_OILS_PER_EXTRA_FISH_INTERVAL: readonly [number, number] = [1.5, 20];

/**
 * **PRE-REGISTERED, 2026-08-21, before the session-69 batch was cast.**
 *
 * `relaxing` = `holdThresholdFromExchangeRate(6)` = **0.8333…**, straight off
 * the measured rate above. Nothing was swept to obtain it.
 *
 * **`focus` stays at 1, and that is a finding rather than an omission.** The
 * derivation above is specific to the LETHAL band: it prices an oil that
 * converts an uncertain catch into a certain one, so `(1 - p)` is a number of
 * fish. A Mid Focus Oil does no such thing — it restores two points of meter,
 * which changes which cells are reachable on later turns and buys no catch
 * directly. `bestConnectProbabilityFromFrozenCell` is therefore not a `p` this
 * arithmetic can use, and no corpus-measured oils-per-extra-fish exists for the
 * Focus trigger to substitute. **Applying the Relaxing number to it would be
 * the fitted parameter this whole construction exists to avoid**, wearing a
 * derivation's clothes.
 *
 * Stock is a SECOND reason the two arms should differ and is deliberately not
 * folded in here: live on 2026-08-21 the account held Relaxing 56 and Focus 19,
 * so the scarce oil is the Focus one and its shadow price is higher — but
 * scarcity is not efficacy, this repo has measured neither shadow price, and
 * inventing one would be a third unmeasured constant. See
 * `handoff/OIL-CONSERVE.md` and CLAUDE.md rule 4.
 */
export const PREREGISTERED_EXCHANGE_THRESHOLDS: OilNecessityThresholds = {
  relaxing: holdThresholdFromExchangeRate(MEASURED_RELAXING_OILS_PER_EXTRA_FISH),
  focus: 1,
};

/**
 * The exchange-rate policy, for shadow evaluation beside the shipped one.
 *
 * **What `p` really is, and which way the proxy is wrong.** The derivation
 * wants `P(catch EVENTUALLY without the oil)`. `bestKillProbability` is
 * `P(kill THIS TURN with an affordable card)`, which is smaller — the cast can
 * go on and land the fish two turns later. So the proxy UNDERSTATES `p`, the
 * gate therefore holds LESS often than the exchange rate says it should, and
 * every oil this policy saves is an oil the correctly-specified policy would
 * also have saved. It errs toward SPENDING. Say that whenever the saving is
 * quoted.
 *
 * The bias is not unbounded in the lethal band, which is the one place it can
 * be reasoned about: a miss HEALS the fish by the card's miss amount (3 to 6 on
 * the live deck), which lifts it clear of the oil's 2 damage, so the trigger
 * does not simply recur next turn. The oil held here is held for a LATER CAST,
 * not for later in this one — which is exactly what the directive asked for.
 */
export const conservingByExchangeRate: OilTimingPolicy = conservingOil(PREREGISTERED_EXCHANGE_THRESHOLDS);

/**
 * **[session 68 §1] The comparison is epsilon-tolerant, and this is a
 * FLOATING-POINT FIX, not a tuned threshold. Read the distinction before
 * touching it.**
 *
 * Both gate inputs are sums of probability mass over a distribution, so a
 * genuinely certain outcome arrives as `0.9999999999999999` whenever the
 * summation order happens not to cancel. At the recommended threshold of
 * exactly `1` a bare `>=` then reads that as "not certain" and FIRES the gate
 * — the precise decision the policy's own thesis says it must not take.
 *
 * This was not hypothetical and was not found by reading. Session 68's live
 * shadow harness put a full-template card on a 3x3 board, where a hit is
 * certain by construction, and `bestKillProbability` returned
 * `0.9999999999999999` on one turn and exactly `1` on the next — same card,
 * same certainty, different distribution. Without this tolerance the gate's
 * behaviour on a certain kill depends on float summation order, which is a
 * coin flip nobody chose.
 *
 * **Why it is not a tune.** A tuned threshold moves the decision boundary to
 * buy score; `1e-9` moves it by less than any probability this model can
 * meaningfully distinguish, and session 67 measured every threshold from 0.25
 * to 1 landing on the same plateau — so a shift of 1e-9 cannot change a
 * ranking. It restores the boundary the constant `1` was always meant to
 * express. CLAUDE.md's "do not tune the necessity thresholds" is untouched:
 * `RECOMMENDED_NECESSITY_THRESHOLDS` is still `{1, 1}`.
 *
 * The degenerate endpoints still work: `NEVER_FIRES_THRESHOLD` is `0` and no
 * probability is below `0 - 1e-9`; `ALWAYS_FIRES_THRESHOLD` is `2` and every
 * probability is below `2 - 1e-9`.
 */
export const NECESSITY_EPSILON = 1e-9;

/** `p >= t`, tolerant of float summation error — see `NECESSITY_EPSILON`. */
export function meetsThreshold(p: number, t: number): boolean {
  return p >= t - NECESSITY_EPSILON;
}

/**
 * `on-demand`'s two triggers, each with a necessity condition ANDed onto it.
 *
 * The triggers themselves are UNCHANGED and are deliberately reused from
 * `onDemandTriggers` rather than restated: the directive is about spending
 * fewer oils at the same moments, not about moving the moments. A gate that
 * also redefined the trigger would confound the two changes and neither could
 * be attributed.
 */
export function conservingOil(t: OilNecessityThresholds): OilTimingPolicy {
  return {
    name: `conserve(r=${t.relaxing},f=${t.focus})`,
    thesis:
      "as on-demand, but each trigger must also be NECESSARY: skip the Relaxing Oil when an affordable card " +
      "already kills with probability >= the relaxing threshold, and skip the Focus Oil when an affordable " +
      "card already connects from the frozen cell with probability >= the focus threshold. Mana first, oils " +
      "as the backup that guarantees the catch.",
    decide: (s, e) => {
      const d = s as OilDecisionState;
      const wanted = onDemandTriggers(s, e);
      const out: OilKind[] = [];
      for (const kind of wanted) {
        if (kind === "relaxing") {
          if (heldOf(s, "relaxing") <= 0) continue;
          if (meetsThreshold(bestKillProbability(d), t.relaxing)) continue;
          out.push("relaxing");
        } else {
          if (heldOf(s, "focus") <= 0) continue;
          if (meetsThreshold(bestConnectProbabilityFromFrozenCell(d), t.focus)) continue;
          out.push("focus");
        }
      }
      return out;
    },
  };
}

/** The conserving arm at the recommended thresholds — the candidate the sweep scores. */
export const conserving: OilTimingPolicy = conservingOil(RECOMMENDED_NECESSITY_THRESHOLDS);

// ---------------------------------------------------------------------------
// [session 89 §6] THE DOUBLE-LETHAL BAND — derived, NOT SHIPPED.
// ---------------------------------------------------------------------------

/**
 * **The gap this closes.** `onDemandTriggers` fires the Relaxing Oil exactly
 * when `fishHp <= fishDamage` — when ONE oil already finishes the fish. At
 * `fishHp` 3 or 4 (with the payload's +2) it fires ZERO times: one oil leaves
 * the fish alive, and nothing has ever asked for a second to finish it.
 *
 * `config/bot.json`'s `dendren.oils.perItemMaxPerCast["937"] = 2` has permitted
 * two Relaxing-Oil spends per cast since **session 69**, on the user's own
 * directive. The budget plumbing was built twenty sessions before a trigger
 * that would use it.
 *
 * **The rule, and it is conditional rather than a default.** In the band
 * `fishDamage < fishHp <= 2 * fishDamage`, holding at least two Relaxing Oils,
 * fire BOTH in the same turn **only when the bot is not already certain of
 * landing the fish this turn on its own**. The certainty read is
 * `bestKillProbability` — the same function the necessity gate uses, reused
 * rather than reinvented, exactly as `onDemand` and `conservingOil` share
 * `onDemandTriggers` instead of each restating the lethal condition.
 *
 * **The cutoff is `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` and NOT a new
 * fitted number.** At 1 the rule reads back as the directive's own sentence
 * with no free parameter: *if the bot can guarantee the kill without the oils,
 * don't spend them.* `oilTiming.ts`'s standing rule against tuning the
 * necessity thresholds applies here unchanged, and inventing a second constant
 * for the same question would be the failure that rule exists to prevent.
 *
 * ⚠ **NOT SHIPPED, and deliberately reachable-but-uncalled**, the same status
 * `conservingOil` has held since session 67. `scripts/liveFishing.ts` still
 * calls `onDemandTriggers`. CLAUDE.md rule 4 requires the user to see the
 * derived policy before its timing goes live, and `dendren.oils.policyApproved`
 * authorises a BUDGET, never a timing.
 *
 * ## The live executor CAN do this — verified, not assumed [session 89]
 *
 * `scripts/liveFishing.ts`'s consume loop is `for (const kind of oilWanted)`
 * and issues one `use_fishing_item` per entry, in order. It does NOT dedupe or
 * short-circuit on a repeated kind, and every piece of per-consume state is
 * updated INSIDE the loop: `doc` is replaced by the response (so `fishHp`,
 * `COMPLETE_CID` and the `fishingConsumableSlotUsed` cursor are fresh),
 * `oilHeld[kind]`, `oilsUsedThisCast` and `oilsUsedThisCastOf[kind]` all
 * decrement/increment per iteration, and `mayConsumeOil` is re-called with the
 * updated counts. So `["relaxing", "relaxing"]` issues two authorised POSTs
 * against `perItemMaxPerCast` 2, taking consumable slots 0 and 1.
 *
 * Two properties of that loop matter to this trigger specifically:
 *
 *  - **Session 68's `COMPLETE_CID` break does not bite here, by construction.**
 *    That break exists because a LETHAL first consume ends the cast and the
 *    second consume is then rejected against a finished cast — which cost a
 *    cast live. In this band the first oil provably cannot kill (`fishHp >
 *    fishDamage`), so the fish is alive at 1..fishDamage HP when the second is
 *    sent. The band's own definition is what makes the pair safe.
 *  - **The decision is committed BEFORE the first oil's result is seen.**
 *    `oilWanted` is evaluated once per turn from the pre-consume state, so this
 *    returns both entries up front rather than re-deciding after the first
 *    lands. That is sound here for the same reason — the first consume's
 *    outcome in this band is arithmetic, not a roll — and it would NOT be sound
 *    for a band where the first oil might finish the fish.
 */
export function doubleLethalTriggers(
  s: OilDecisionState,
  e: OilEffects,
  relaxingThreshold: number = RECOMMENDED_NECESSITY_THRESHOLDS.relaxing,
): OilTimingDecision {
  const base = onDemandTriggers(s, e);
  // Today's single-lethal case is UNCHANGED. If it fired, one oil ends the
  // cast and a second could not be spent on a finished fish anyway.
  if (base.includes("relaxing")) return base;
  if (s.fishHp <= e.fishDamage) return base;
  if (s.fishHp > 2 * e.fishDamage) return base;
  if (s.relaxingOilHeld < 2) return base;
  if (bestKillProbability(s) >= relaxingThreshold) return base;
  // Order matters to the live loop, which sends these in sequence. Relaxing
  // first: the pair is the point, and a focus consume between them would be
  // sent against a state the second relaxing then acts on.
  return ["relaxing", "relaxing", ...base];
}

/**
 * The double-lethal arm, scored beside the existing roster. `on-demand` is the
 * comparison that matters — it is what ships live.
 */
export function doubleLethal(relaxingThreshold: number): OilTimingPolicy {
  return {
    name: `double-lethal(r=${relaxingThreshold})`,
    thesis:
      "as on-demand, plus: in the band where ONE Relaxing Oil cannot finish the fish but TWO can, and the bot's " +
      "own best affordable card cannot guarantee the kill this turn, spend both in the same turn to make it certain.",
    decide: (s, e) => doubleLethalTriggers(s, e, relaxingThreshold).filter((k, i, all) => {
      // Stock check per POSITION, not per kind: the second "relaxing" needs a
      // second oil, which is the whole condition. Counting occurrences before
      // this index is what `heldOf` alone cannot express.
      const needed = all.slice(0, i + 1).filter((x) => x === k).length;
      return heldOf(s, k) >= needed;
    }),
  };
}

/** The Focus half of the conserving policy alone, so the decomposition matches `focus-when-empty-only`'s. */
export function conservingFocusOnly(focusThreshold: number): OilTimingPolicy {
  const inner = conservingOil({ relaxing: NEVER_FIRES_THRESHOLD, focus: focusThreshold });
  return { ...inner, name: `conserve-focus-only(f=${focusThreshold})` };
}

/**
 * The scored arms. `conserving` and `conserve-focus-only` are [session 67]
 * additions; the six above them are unchanged and their historical numbers
 * are still reproducible (verified this session against `handoff/OIL-POLICY.md`'s
 * table, byte-for-byte at n=8000).
 */
export const OIL_TIMING_POLICIES: readonly OilTimingPolicy[] = [
  neverOil,
  consumeAtStart,
  onDemand,
  lethalRelaxingOnly,
  focusWhenEmptyOnly,
  heuristicC,
  conserving,
  conservingFocusOnly(RECOMMENDED_NECESSITY_THRESHOLDS.focus),
  // [session 89 §6] Derived, not shipped — see `doubleLethalTriggers`.
  doubleLethal(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing),
];
