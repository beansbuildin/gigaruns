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
 * **The necessity thresholds. `relaxing` is 0.85 BY USER DIRECTIVE; `focus` is
 * still the unfitted 1.**
 *
 * ## The Relaxing arm — 1 → 0.85, 2026-08-25, QUESTIONS.md §43
 *
 * Session 97 shipped this gate at `1` and then measured it: **24 Relaxing
 * evaluations across the whole live-and-replay record, 0 held, maximum
 * observed `bestKillProbability` 0.991, zero observations at exactly 1**
 * (`scripts/liveGateFiringRates.ts`, QUESTIONS.md §40). At `1` the gate was a
 * measured live no-op — it could not withhold an oil because the quantity it
 * reads never reaches its boundary against real fish movement.
 *
 * **The justification for `1` was a `castSim` artefact, and that is why it
 * moved.** The argument below — the input is bimodal, 55.8% of Relaxing
 * decisions sit at exactly 1, so any constant between the modes is buying
 * ~0.1pp on the sim that fitted it — is true of the SIMULATOR and false of
 * live play. Two instruments that resolve against real trajectories (the live
 * loop, and the replay over 684 clean turns) put **no mass at 1 at all**;
 * 100% of live Relaxing evaluations land strictly between the modes, in the
 * region the bimodality argument said was empty.
 *
 * **0.85 is the USER's number, not a fitted one, and the distinction is the
 * whole point.** No agent may pick it — `oilTiming.ts`'s standing rule against
 * tuning the necessity thresholds is unchanged, and it is what made session 97
 * escalate rather than tune. The user chose 0.85 with the live maximum (0.991)
 * and the pre-registered exchange-rate threshold (0.8333, session 69 §3) both
 * in front of them: just above the exchange rate, i.e. deliberately near the
 * aggressive end of the range that was on the table. It is a TRADEOFF that was
 * accepted knowingly — the gate now withholds oils on turns the bot is merely
 * confident about rather than certain of, which saves oil and risks catches.
 *
 * ⚠ **Consequences a reader must not re-derive as bugs.**
 *
 *   - **This gate is no longer a "certainty gate", and prose calling it one is
 *     now wrong.** At 0.85 it withholds on `p >= 0.85`, which is confidence,
 *     not certainty.
 *   - **`NECESSITY_EPSILON` is INERT on the Relaxing arm at this value** and
 *     stays in the code deliberately — see its own doc comment. It was
 *     load-bearing only at exactly 1, where a certain kill can arrive as
 *     `0.9999999999999999`.
 *   - **The sim arms `conserving` and `doubleLethal(...)` rename themselves**
 *     to `conserve(r=0.85,f=1)` / `double-lethal(r=0.85)`, because their names
 *     interpolate this constant. `handoff/OIL-CONSERVE.md` and
 *     `handoff/log/session-67.md`'s tables are keyed to `conserve(r=1,f=1)`
 *     and describe a DIFFERENT arm from today's default. Those rows are
 *     history and stay readable as history; do not "reconcile" them.
 *
 * ## The Focus arm — unchanged at 1, and untouched by the live configuration
 *
 * `focus` stays `1` because nothing was asked about it and no live evidence
 * bears on it: `config/bot.json`'s `allowedItemIds` is `[937]`, so the Focus
 * Oil is not spendable on this account at all (session 93 §35), and the
 * shipped `RELAXING_ONLY_NECESSITY_THRESHOLDS` overrides it to the degenerate
 * `ALWAYS_FIRES_THRESHOLD` regardless. Moving it would be tuning a parameter
 * that governs nothing.
 *
 * ## The original argument for 1, preserved because it is what got overturned
 *
 * Both quantities the gates read are strongly BIMODAL rather than spread in
 * `castSim` — measured, `scripts/oilConserveSweep.ts` §2b, at the moments
 * `onDemandTriggers` actually fires:
 *
 *   `bestKillProbability`      34.3% exactly 0, 55.8% exactly 1, 9.9% between
 *   `bestConnectProbability`   59.8% exactly 0, 27.8% exactly 1, 12.5% between
 *
 * so every threshold from 0.25 to 1 landed on the same plateau there (catch
 * 88.29% to 88.46%, 2.18 to 2.42 oils per extra fish) and a tuned pair bought
 * 0.08pp for a constant somebody would later have to defend. That reasoning is
 * still correct ABOUT THE SIM, and `handoff/OIL-POLICY.md` §0a has since
 * suspended the sim for this fishery.
 */
export const RECOMMENDED_NECESSITY_THRESHOLDS: OilNecessityThresholds = { relaxing: 0.85, focus: 1 };

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
 * this constant has never moved a threshold, and the one threshold that HAS
 * moved was moved by the user, not by a fit (see
 * `RECOMMENDED_NECESSITY_THRESHOLDS`).
 *
 * ⚠ **[session 98 §A] It is now INERT on the Relaxing arm, and it stays
 * anyway.** The tolerance only ever changes a verdict when the threshold sits
 * at the top of the probability range, because that is where float summation
 * error can straddle the boundary. `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing`
 * is `0.85` as of 2026-08-25, and `0.9999999999999999 >= 0.85` under a bare
 * `>=` just as well — so no live Relaxing decision turns on this line today.
 *
 * Three reasons not to delete it, in order of weight: the `focus` arm is still
 * `1`, where it is fully load-bearing; `meetsThreshold` is called with
 * ARBITRARY thresholds (`doubleLethalOver` takes one as a parameter, the
 * degenerate endpoints are passed in tests), so inertness is a property of
 * today's value and not of the function; and the divergence session 97 found —
 * one call site epsilon-tolerant and its sibling reading the same quantity
 * with a bare `>=` — is exactly what re-introducing the bare form invites back.
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
    // Defined in terms of `conservingTriggers` + the stock filter, exactly as
    // `onDemand.decide` is defined in terms of `onDemandTriggers`, so the
    // trigger half and the policy half cannot drift apart.
    decide: (s, e) => conservingTriggers(s as OilDecisionState, e, t).filter((k) => heldOf(s, k) > 0),
  };
}

/**
 * **The necessity gate's TRIGGERS, evaluated independently of how many oils are
 * held** — the sibling `conservingOil` never had, and the reason §1 of the
 * session-97 brief could not simply "swap the trigger call in `liveFishing.ts`".
 *
 * `conservingOil` is a `OilTimingPolicy`, and `decide` folds the stock check in
 * with the trigger check. That is right for the SIM and wrong for the LIVE
 * loop, for precisely the reason session 62 §1b split `onDemandTriggers` out of
 * `onDemand.decide`: collapsing "the trigger did not fire" into "the trigger
 * fired and the account was dry" is what poisoned the dead era's rate for 40
 * casts. `scripts/liveFishing.ts` calls a TRIGGER and does its own stock
 * accounting through `oilHeld`/`mayConsumeOil`; handing it a `decide` would
 * silently re-merge the two states this repo has already paid to keep apart.
 *
 * The triggers themselves are UNCHANGED and are reused from `onDemandTriggers`
 * rather than restated — same reason as before: the directive is about
 * spending fewer oils at the same moments, not about moving the moments.
 *
 * **This function can only ever REMOVE entries from `onDemandTriggers`' array,
 * never add or reorder.** That property is what makes the composition in
 * `necessityGatedDoubleLethalTriggers` analysable, and it is pinned by test.
 */
export function conservingTriggers(
  s: OilDecisionState,
  e: OilEffects,
  t: OilNecessityThresholds,
): OilKind[] {
  const out: OilKind[] = [];
  for (const kind of onDemandTriggers(s, e)) {
    if (kind === "relaxing") {
      if (meetsThreshold(bestKillProbability(s), t.relaxing)) continue;
      out.push("relaxing");
    } else {
      if (meetsThreshold(bestConnectProbabilityFromFrozenCell(s), t.focus)) continue;
      out.push("focus");
    }
  }
  return out;
}

/**
 * **The gate as it is actually configured live: RELAXING ONLY.**
 *
 * [session 93 §35, RELAXING-OIL-ONLY] `config/bot.json`'s
 * `dendren.oils.allowedItemIds` is `[937]`. The Focus Oil is not a spendable
 * item on this account today, so gating it would be gating nothing — and
 * *appearing* to change the Focus policy while shipping the Relaxing one is
 * exactly the confound `conservingOil`'s own header refuses.
 *
 * `focus: ALWAYS_FIRES_THRESHOLD` is not a tune and not a disabling hack: it
 * is the documented degenerate endpoint that makes the Focus arm behave as
 * `onDemandTriggers` does, byte for byte (`NEVER_FIRES_THRESHOLD` /
 * `ALWAYS_FIRES_THRESHOLD`'s own doc comment). So this constant reads as
 * "gate the Relaxing Oil, leave the Focus Oil exactly as it ships", which is
 * the live configuration stated in code rather than in a comment.
 *
 * ⚠ **[session 98 §A] This is no longer `handoff/OIL-CONSERVE.md` §3's
 * `conserve(r=1, f=2)` row.** It was, until the user lowered the Relaxing
 * threshold to `0.85` (QUESTIONS.md §43); the shipped constant is now
 * `conserve(r=0.85, f=2)` and the historical row scores a DIFFERENT arm. The
 * §3 table stays valid as history and must not be read as pricing what ships
 * today — that price has not been measured on any instrument §0a permits.
 */
export const RELAXING_ONLY_NECESSITY_THRESHOLDS: OilNecessityThresholds = {
  relaxing: RECOMMENDED_NECESSITY_THRESHOLDS.relaxing,
  focus: ALWAYS_FIRES_THRESHOLD,
};

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
 * fitted number.** The band asks the same question the gate asks — *can the
 * bot land this fish without the oils?* — so it must read the same constant.
 * `oilTiming.ts`'s standing rule against tuning the necessity thresholds
 * applies here unchanged, and inventing a second constant for the same
 * question would be the failure that rule exists to prevent.
 *
 * [session 98 §A] That constant is **0.85** since 2026-08-25 (QUESTIONS.md
 * §43, the user's own number), where it read `1` from session 89 to session
 * 97. The rule therefore no longer reads "don't spend when the kill is
 * CERTAIN" but "don't spend when the kill is already at least 85% likely",
 * and the pair is withheld on strictly more turns than before. That is the
 * intended direction of the user's ruling, not drift — but it does mean this
 * band, which had never once been reached by the gate at `1`, can now
 * withhold a pair it would previously have spent.
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
  return doubleLethalOver(onDemandTriggers(s, e), s, e, relaxingThreshold);
}

/**
 * **The double-lethal band applied over an ARBITRARY base**, extracted from
 * `doubleLethalTriggers` [session 97 §1b] so the necessity gate can be
 * composed underneath it without either layer being restated.
 *
 * The extraction is behaviour-preserving by construction:
 * `doubleLethalTriggers` is now literally this function over
 * `onDemandTriggers`, which is what its body was.
 *
 * **⚠ The comparison is `meetsThreshold`, not a bare `>=`, and that is a FIX,
 * not a refactor artifact [session 97 §1b].** This line read
 * `bestKillProbability(s) >= relaxingThreshold` from session 89 until now,
 * while the necessity gate reading the SAME quantity against the SAME constant
 * went epsilon-tolerant in session 68. That divergence was live: at the
 * shipped threshold of exactly `1`, a genuinely certain kill arrives as
 * `0.9999999999999999` whenever the probability summation order happens not to
 * cancel (session 68 observed exactly this, same card, same certainty,
 * consecutive turns), and a bare `>=` reads it as "not certain" and fires
 * **two** oils on a turn the bot was already sure of — the precise decision
 * both this band's thesis and the gate's forbid. `NECESSITY_EPSILON`'s own doc
 * comment explains why 1e-9 is not a tune; it applies here unchanged. The
 * degenerate endpoints still behave: nothing is below `0 - 1e-9`, everything
 * is below `2 - 1e-9`.
 */
export function doubleLethalOver(
  base: OilKind[],
  s: OilDecisionState,
  e: OilEffects,
  relaxingThreshold: number,
): OilTimingDecision {
  // Today's single-lethal case is UNCHANGED. If it fired, one oil ends the
  // cast and a second could not be spent on a finished fish anyway.
  if (base.includes("relaxing")) return base;
  if (s.fishHp <= e.fishDamage) return base;
  if (s.fishHp > 2 * e.fishDamage) return base;
  if (s.relaxingOilHeld < 2) return base;
  if (meetsThreshold(bestKillProbability(s), relaxingThreshold)) return base;
  // Order matters to the live loop, which sends these in sequence. Relaxing
  // first: the pair is the point, and a focus consume between them would be
  // sent against a state the second relaxing then acts on.
  return ["relaxing", "relaxing", ...base];
}

/**
 * ── [session 97 §1b] THE COMPOSED LIVE TRIGGER ─────────────────────────────
 * **necessity-gated Relaxing spend, still capable of the same-turn
 * double-lethal spend when the band calls for it.**
 *
 * QUESTIONS.md §39 approved the necessity gate's DIRECTION and explicitly
 * refused to approve a composition nobody had written: *"the two were built as
 * siblings, not composed with each other, and nothing in `OIL-CONSERVE.md` or
 * `oilTiming.ts`'s own comments says what 'necessity-gated AND
 * double-lethal-capable' does together."* This is that composition.
 *
 * ## It costs nothing relative to the gate alone, and this is PROVED, not swept
 *
 * The session-97 brief asked for a sweep to price the composition. A sweep was
 * not the right instrument and would have been the weaker answer: the two
 * layers act on **disjoint `fishHp` bands**, so the composition is decidable by
 * case analysis over a partition. With `D = e.fishDamage`:
 *
 *  - **`fishHp <= 0`** — the fish is dead; `onDemandTriggers`' relaxing arm is
 *    guarded on `fishHp > 0` and does not fire. Nothing to compose.
 *  - **`0 < fishHp <= D`** (single-lethal) — the gate may drop the relaxing
 *    entry. Either way `doubleLethalOver`'s second guard (`fishHp <= D`)
 *    returns the base untouched, so the band CANNOT re-add an oil the gate just
 *    skipped. **Composed == gate alone.**
 *  - **`D < fishHp <= 2D`** (the double band) — `onDemandTriggers` never emits
 *    a relaxing here (`fishHp <= D` is false), and `conservingTriggers` only
 *    ever REMOVES entries, so the base's relaxing content is identical under
 *    both. The band then applies its own `bestKillProbability` check, which is
 *    the same gate against the same constant. **Composed == shipped
 *    double-lethal.**
 *  - **`fishHp > 2D`** — no relaxing trigger on any arm.
 *
 * The Focus arm is untouched at `RELAXING_ONLY_NECESSITY_THRESHOLDS` by the
 * degenerate-endpoint argument in that constant's own comment.
 *
 * **So the composition is exactly "the gate below the single-lethal ceiling,
 * the band above it", with no interaction term at any HP.** That is a stronger
 * statement than a sweep could have produced — a sweep would have reported a
 * near-zero difference with a confidence interval, and near-zero-with-a-CI is
 * how a real interaction hides. `tests/fishing/oilNecessityComposition.test.ts`
 * pins the case analysis exhaustively over the band boundaries rather than
 * trusting this prose.
 *
 * ⚠ **The one behaviour that DOES change versus what shipped before this**, and
 * it is the point of the change rather than a side effect: in the single-lethal
 * band, when the bot's best affordable card already kills with probability at
 * or above the Relaxing threshold, no oil is spent. That is the user's
 * directive from 2026-08-21, approved in §39.
 *
 * [session 98 §A] At the shipped threshold that sentence now reads **0.85**,
 * not "with certainty" — QUESTIONS.md §43. The composition argument above is
 * INDIFFERENT to the value: it turns on the two layers acting on disjoint
 * `fishHp` bands and on `conservingTriggers` only ever removing entries,
 * neither of which mentions a threshold. What the value changes is how often
 * the gate's band actually removes something, which at `1` was measured to be
 * never (§40) and at `0.85` is not.
 */
export function necessityGatedDoubleLethalTriggers(
  s: OilDecisionState,
  e: OilEffects,
  t: OilNecessityThresholds = RELAXING_ONLY_NECESSITY_THRESHOLDS,
): OilTimingDecision {
  return doubleLethalOver(conservingTriggers(s, e, t), s, e, t.relaxing);
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
