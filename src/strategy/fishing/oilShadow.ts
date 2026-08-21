/**
 * src/strategy/fishing/oilShadow.ts — [session 68 §1, re-placed session 69 §1]
 * SHADOW evaluation of the
 * conserving oil gate. Pure: state in, record out, no I/O and no network.
 *
 * ## What this is for
 *
 * `conserveOil(r=1,f=1)` (session 67, `oilTiming.ts`) beats the shipped
 * `on-demand` policy on both axes IN SIMULATION. The user's decision
 * (2026-08-21) is **not to ship it** but to run it in shadow: at every moment
 * the live policy takes an oil decision, ask the conserving gate what it
 * WOULD have done, record the answer, and change nothing.
 *
 * ## THE ENTIRE RISK IS THAT SHADOW STOPS BEING SHADOW
 *
 * An evaluator that touches the live decision is worse than no evaluator at
 * all, because it changes the thing it is measuring while looking like an
 * observer. Three structural properties, in descending order of how much they
 * are worth:
 *
 *   1. **`evaluateOilShadow` is handed a DEEP COPY and never the live objects.**
 *      `snapshotOilDecision` rebuilds the cards, the effect arrays and the
 *      distribution into fresh objects and then freezes them. So the shadow
 *      cannot mutate live state even if a policy tried: it holds no reference
 *      to anything the live path will read again. Note the copy is what gets
 *      frozen — freezing the live `deckCardData` objects in place would itself
 *      be a side effect on the live path, which is the trap this ordering
 *      avoids.
 *   2. **It cannot throw.** Every path is wrapped; a shadow that threw would
 *      abort a real cast, which is influence of the worst kind. A failure is
 *      recorded as `error` on the record and the cast plays on.
 *   3. **Its return value is inert by type.** An `OilShadowRecord` has no
 *      field the live loop reads. It is logged and dropped.
 *
 * None of that is self-proving, which is why the actual guarantee is a test:
 * `tests/fishing/oilShadowInert.test.ts` runs the same cast with shadow on and
 * shadow off and requires the full POST sequence to be byte-identical.
 *
 * ## What shadow CANNOT establish — read this before quoting any number
 *
 * **It cannot tell you whether skipping would have cost a fish.** The oil is
 * really spent by the live policy, so the counterfactual outcome is
 * unobservable. A cast where on-demand spent, shadow said skip, and the fish
 * was caught does NOT confirm the saving — the oil was in play the whole time.
 *
 * **AND THERE WAS A SECOND LIMIT, FOUND BY RUNNING IT — NOW FIXED (session
 * 69). Read it anyway: it is the clearest example this repo has of a shadow
 * that ran, recorded, and saw nothing.**
 *
 * Not for the reason the session-68 brief gave. That said the Relaxing arm was
 * unexercisable because stock was zero (Relaxing 0, Focus 18); live stock was
 * actually Relaxing 56, Focus 19, so the brief's reason was simply wrong. The
 * real reason was ORDERING, and it was structural:
 *
 *   - the shadow was evaluated after `dist` existed, i.e. in the card-choice
 *     phase of the turn;
 *   - the Relaxing trigger fires only when the fish is lethal;
 *   - a lethal Relaxing Oil ENDS the cast inside the oil block, so the loop
 *     `continue`d before the card-choice phase was ever reached.
 *
 * So the one turn the arm was observable on was the one turn no record was
 * written. Measured over the five-cast batch: 13 records, 0 sanity violations,
 * 0 throws, and exactly ONE at a firing moment — the Focus arm, `bestConnect`
 * 0.074, gate agreed with the live spend. `bestKillProbability` was `null` on
 * all 13. The same gap swallowed any turn whose oil block threw.
 *
 * **Session 69 hoisted the distribution pipeline above the oil block and moved
 * the evaluation up with it**, so `snapshotOilDecision` is now called at the
 * moment it describes rather than being carried across the block. Two tests
 * hold the fix in place, and they are separate on purpose: the observation was
 * bought (`tests/fishing/oilShadowRelaxingArm.test.ts`, red on the pre-hoist
 * placement) AND live play did not move (`tests/fishing/hoistInvariant.test.ts`,
 * a byte-level capture taken before the hoist and committed with it).
 *
 * **The general lesson outlives the fix: a shadow evaluated in the wrong phase
 * of a turn is blind to exactly the decisions that end the turn**, and it
 * reports that blindness as an ordinary run of quiet records. Nothing about
 * "13 records, 0 violations" says half the gate was never asked. Only counting
 * FIRING MOMENTS did.
 *
 * What it genuinely validates is narrower and still worth having: the gate's
 * FIRING RATE against a real server, the shape of its two INPUT distributions
 * (the "no constant to defend" argument for threshold 1 rests on both being
 * bimodal, which is a corpus measurement that live can contradict), and
 * SANITY — that the gate never produces a decision that is nonsense on its
 * face.
 */

import type { Cell } from "../../sim/fishing/geometry.js";
import { cellKey } from "../../sim/fishing/geometry.js";
import type { Distribution, FishingCardLike } from "./cardChoice.js";
import {
  bestConnectProbabilityFromFrozenCell,
  bestKillProbability,
  conservingOil,
  onDemandTriggers,
  PREREGISTERED_EXCHANGE_THRESHOLDS,
  type OilDecisionState,
  type OilEffects,
  type OilKind,
  type OilTimingPolicy,
} from "./oilTiming.js";

/**
 * Stock the shadow state is saturated to before the gate is asked.
 *
 * **This is the single most important line in the file, so it is a named
 * constant rather than a literal.** `conservingOil.decide` filters by held
 * stock as well as by necessity, so asking it against the user's REAL stock
 * would conflate two completely different reasons for a skip: "the gate judged
 * the oil unnecessary" (the thing being measured) and "the bag was empty" (the
 * thing session 62's third cast state already records". Without it, every
 * lethal trigger taken against an empty bag would be logged as a necessity
 * skip and the arm's firing rate would read 100% for reasons that have nothing
 * to do with the gate.
 *
 * **Do not restate the account's stock in this comment.** The session-68
 * version did — "Live stock on 2026-08-21 is Relaxing 0 / Focus 18" — and it
 * was wrong the day it was written; the real balances were Relaxing 56 / Focus
 * 19. Stock is something the user changes between sessions, so a number frozen
 * in a doc comment goes stale silently and reads as current forever.
 * `heldAtDecision` carries the real counts per decision, which is the only
 * place they belong.
 *
 * The real held counts are recorded on the record as `heldAtDecision`, and
 * `exercisable` says whether the arm could have been exercised for real.
 */
const SHADOW_SATURATED_STOCK = 99;

/**
 * [session 70 §3] **THE POLICY THE SHADOW ACTUALLY EVALUATES — and it is no
 * longer the certainty gate.**
 *
 * Until session 70 this was `conserving`, i.e. `conserve(r=1,f=1)`. Session 69
 * measured that gate against a real server and the result is unambiguous:
 * **it has never once held a Relaxing Oil live — 0 of 9 firings on the entire
 * record, and `wouldSkip` on 0 of 42 shadow records across ten casts.**
 *
 * That is not bad luck; it follows from the inputs. `conserve(r=1,f=1)` holds
 * only when a card ALREADY kills with probability >= 1, and every Relaxing
 * `bestKillProbability` ever observed live — 0.400 0.481 0.505 0.506 0.580
 * 0.587 0.690 0.964 0.975 — is strictly between 0 and 1, as is every Focus
 * `bestConnectProbability`. The gate was chosen (session 67) because the
 * SIMULATOR's inputs are bimodal at 0 and 1, 34.3% / 55.8%. Live has no mass at
 * either endpoint.
 *
 * So the shadow was spending every one of its records on the one rule known to
 * do nothing. It now evaluates the exchange-rate threshold
 * (`PREREGISTERED_EXCHANGE_THRESHOLDS`, session 69 §3), which would have held
 * 2 of those 9 firings — derived from a measured exchange rate, pre-registered
 * before the batch that tested it, and never swept.
 *
 * **NOTHING IS LOST BY REPLACING RATHER THAN ADDING A SECOND ARM**, which is
 * the whole reason this is a swap and not a schema change. `conserve(r=1,f=1)`
 * holds an arm exactly when that arm's recorded probability is >= 1, and
 * `bestKillProbability` / `bestConnectProbability` are recorded on EVERY firing
 * record. The certainty gate's verdict is therefore reconstructable offline
 * from the same rows, for free — pinned by
 * `tests/fishing/oilShadowExchangeArm.test.ts` so this claim cannot quietly
 * stop being true.
 *
 * **Still NOT SHIPPED.** `liveFishing.ts` plays `onDemandTriggers`; this is
 * observed beside it and changes nothing.
 */
export const SHADOWED_OIL_POLICY = conservingOil(PREREGISTERED_EXCHANGE_THRESHOLDS);

/** The live board quantities the gate needs and `OilTimingState` does not carry. */
export interface OilShadowBoard {
  hand: readonly FishingCardLike[];
  dist: Distribution;
  gridSize: number;
}

/** The scalars read off the doc at the live oil-decision moment. */
export interface OilShadowScalars {
  turn: number;
  fishHp: number;
  fishMaxHp: number;
  mana: number;
  focusRemaining: number;
  focusMax: number;
  focusCell: Cell;
  focusOilHeld: number;
  relaxingOilHeld: number;
}

export interface OilShadowRecord {
  turn: number;
  /** The policy actually being played. Recorded so a log row is self-describing if the live policy ever changes. */
  livePolicy: string;
  shadowPolicy: string;
  /** `onDemandTriggers` at this moment — stock-independent, exactly as the live loop evaluates it. */
  liveWanted: OilKind[];
  /** The conserving gate at this moment, against SATURATED stock — so a skip here means "judged unnecessary", never "bag empty". */
  shadowWanted: OilKind[];
  /** `liveWanted` minus `shadowWanted`: the oils the conserving policy would have SAVED. */
  wouldSkip: OilKind[];
  /** The gate's own inputs, `null` when that arm's trigger did not fire and the quantity was therefore never consulted. */
  bestKillProbability: number | null;
  bestConnectProbability: number | null;
  /** What the account really held, kept apart from the saturated stock the gate was asked against. */
  heldAtDecision: { focus: number; relaxing: number };
  /**
   * Per fired trigger: could this arm have been exercised for real? False when
   * the trigger fired against an empty bag — the live policy could not have
   * spent that oil either way, so the shadow decision is untested by outcome.
   * Session-68 brief §1c: with Relaxing at 0, the Relaxing arm is not
   * exercisable live at all and must not be reported as validated.
   */
  exercisable: Partial<Record<OilKind, boolean>>;
  handSize: number;
  mana: number;
  fishHp: number;
  focusRemaining: number;
  focusCell: Cell;
  gridSize: number;
  /** Nonsense-decision checks. Empty is the expected state; anything here is a real finding. */
  sanity: string[];
  /** Set only if the shadow threw. The cast is unaffected — that is the point. */
  error?: string;
}

/** Copy a card into fresh objects, including the three effect arrays the gate reads amounts off. */
function copyCard(c: FishingCardLike): FishingCardLike {
  const copyEffects = (e: readonly { amount: number }[]) => e.map((x) => Object.freeze({ ...x }));
  return Object.freeze({
    ...c,
    hitZones: Object.freeze([...c.hitZones]),
    critZones: Object.freeze([...c.critZones]),
    hitEffects: Object.freeze(copyEffects(c.hitEffects)),
    missEffects: Object.freeze(copyEffects(c.missEffects)),
    critEffects: Object.freeze(copyEffects(c.critEffects)),
  }) as FishingCardLike;
}

/**
 * Build the shadow's own private, frozen copy of the decision state.
 *
 * Exported because the live loop builds it at the oil-decision moment — see
 * `scripts/liveFishing.ts`.
 *
 * **[session 69] It is no longer CARRIED across the oil block.** Session 68
 * took the snapshot above the block and evaluated it below, once `dist`
 * existed, and holding a frozen copy is what made that deferral correct: an
 * oil may have been consumed in between and the pre-consume state is the one
 * the decision was taken on. The pipeline has since been hoisted, so snapshot
 * and evaluation now happen at the same point and the doc being read IS the
 * pre-consume doc. The freezing is unchanged and is still the inertness
 * guarantee — it just no longer has a second job.
 */
export function snapshotOilDecision(s: OilShadowScalars, board: OilShadowBoard): OilDecisionState {
  const dist = new Map<string, { cell: Cell; p: number }>();
  for (const { cell, p } of board.dist.values()) {
    const c = Object.freeze({ x: cell.x, y: cell.y });
    dist.set(cellKey(c), Object.freeze({ cell: c, p }));
  }
  return Object.freeze({
    turn: s.turn,
    fishHp: s.fishHp,
    fishMaxHp: s.fishMaxHp,
    mana: s.mana,
    focusRemaining: s.focusRemaining,
    focusMax: s.focusMax,
    // SATURATED, not the real stock — see SHADOW_SATURATED_STOCK.
    focusOilHeld: SHADOW_SATURATED_STOCK,
    relaxingOilHeld: SHADOW_SATURATED_STOCK,
    focusCell: Object.freeze({ x: s.focusCell.x, y: s.focusCell.y }),
    board: Object.freeze({
      hand: Object.freeze(board.hand.map(copyCard)),
      dist,
      gridSize: board.gridSize,
    }),
  }) as OilDecisionState;
}

/**
 * Ask the shadow policy what it would have done. **Never throws.**
 *
 * `held` is the account's REAL stock, used only to fill `heldAtDecision` and
 * `exercisable`; the gate itself is asked against the saturated snapshot.
 */
export function evaluateOilShadow(
  snapshot: OilDecisionState,
  effects: OilEffects,
  held: { focus: number; relaxing: number },
  policy: OilTimingPolicy = SHADOWED_OIL_POLICY,
  livePolicyName = "on-demand",
): OilShadowRecord {
  const base: OilShadowRecord = {
    turn: snapshot.turn,
    livePolicy: livePolicyName,
    shadowPolicy: policy.name,
    liveWanted: [],
    shadowWanted: [],
    wouldSkip: [],
    bestKillProbability: null,
    bestConnectProbability: null,
    heldAtDecision: { focus: held.focus, relaxing: held.relaxing },
    exercisable: {},
    handSize: snapshot.board.hand.length,
    mana: snapshot.mana,
    fishHp: snapshot.fishHp,
    focusRemaining: snapshot.focusRemaining,
    focusCell: snapshot.focusCell,
    gridSize: snapshot.board.gridSize,
    sanity: [],
  };

  try {
    const liveWanted = onDemandTriggers(snapshot, effects);
    const shadowWanted = policy.decide(snapshot, effects);
    // §1b sanity: "disagree with itself across two evaluations of the same
    // state". The gate is a pure function of a frozen state, so this can only
    // fail if it is reading something it should not be.
    const second = policy.decide(snapshot, effects);
    const record: OilShadowRecord = {
      ...base,
      liveWanted: [...liveWanted],
      shadowWanted: [...shadowWanted],
      wouldSkip: liveWanted.filter((k) => !shadowWanted.includes(k)),
    };
    if (liveWanted.includes("relaxing")) {
      record.bestKillProbability = bestKillProbability(snapshot);
      record.exercisable.relaxing = held.relaxing > 0;
    }
    if (liveWanted.includes("focus")) {
      record.bestConnectProbability = bestConnectProbabilityFromFrozenCell(snapshot);
      record.exercisable.focus = held.focus > 0;
    }
    record.sanity = sanityViolations(record, shadowWanted, second);
    return record;
  } catch (e) {
    // A shadow that aborts a live cast is the failure this whole file is
    // built to avoid. Record and carry on.
    return { ...base, error: (e as Error).message, sanity: ["shadow_threw"] };
  }
}

/**
 * The §1b nonsense checks. Each one is a decision that would be wrong on its
 * face regardless of what the sim says, so a hit here is a finding about the
 * gate, not about the fishery.
 */
function sanityViolations(r: OilShadowRecord, shadowWanted: readonly OilKind[], second: readonly OilKind[]): string[] {
  const out: string[] = [];
  if (shadowWanted.join(",") !== second.join(",")) out.push("shadow_not_idempotent");
  // The gate ANDs a condition onto on-demand's triggers, so it can never want
  // an oil on-demand did not. Anything else means the two have drifted apart.
  for (const k of shadowWanted) if (!r.liveWanted.includes(k)) out.push(`shadow_wanted_untriggered_${k}`);
  // "skip with no card in hand" — with nothing playable there is no reason to
  // believe the bot can do it without the oil.
  if (r.wouldSkip.length > 0 && r.handSize === 0) out.push("shadow_skipped_with_empty_hand");
  // "fire with a certain kill available" — the gate's whole thesis is that it
  // withholds the oil exactly then.
  if (shadowWanted.includes("relaxing") && (r.bestKillProbability ?? 0) >= 1) out.push("shadow_fired_with_certain_kill");
  if (shadowWanted.includes("focus") && (r.bestConnectProbability ?? 0) >= 1) out.push("shadow_fired_with_certain_connect");
  return out;
}

/** Bucket a probability the way §1b's bimodality claim is stated: exactly 0, exactly 1, or between. */
export function bimodalBucket(p: number): "zero" | "one" | "between" {
  if (p <= 0) return "zero";
  if (p >= 1) return "one";
  return "between";
}
