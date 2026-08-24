/**
 * src/strategy/fishing/redrawShadow.ts — [session 90 §4, QUESTIONS.md §26]
 * SHADOW evaluation of the redraw trigger candidate. Pure: state in, record
 * out, no I/O and no network.
 *
 * ## What this is for, and what it is emphatically not
 *
 * **`redrawEnabled` stays `false` and `REDRAW_THRESHOLD` stays `0`. Nothing in
 * this file changes either, and nothing here is a step toward changing them
 * without a further decision.** §28's restated reason for keeping redraw
 * closed names *"no validated trigger"* as half the blocker. This is the
 * instrument that could produce out-of-sample evidence about one — evidence
 * being the point, since every number the candidate has was fitted to the same
 * 148-cast corpus it was discovered in, with oracle labels and no held-out set.
 *
 * A shadow does not redraw. It answers *"would the candidate have fired here?"*
 * at the moment the live bot chose a card, records the answer, and changes
 * nothing.
 *
 * ## THE ENTIRE RISK IS THAT SHADOW STOPS BEING SHADOW
 *
 * `oilShadow.ts` is the precedent and its three structural properties are
 * copied deliberately rather than reinvented:
 *
 *   1. **`evaluateRedrawShadow` is handed a DEEP COPY and never the live
 *      objects.** `snapshotRedrawDecision` rebuilds the hand — cards and their
 *      zone arrays — into fresh frozen objects. The copy is what gets frozen;
 *      freezing the live `deckCardData` in place would itself be a side effect
 *      on the live path, which is the trap the ordering avoids.
 *   2. **It cannot throw.** The whole body is wrapped. A shadow that threw
 *      would abort a real cast, which is influence of the worst kind. A
 *      failure becomes `error` on the record and the cast plays on.
 *   3. **Its return value is inert by type.** A `RedrawShadowRecord` has no
 *      field the live loop reads. It is logged and dropped.
 *
 * ## THE PHASE, and why it is NOT the oil shadow's phase
 *
 * `oilShadow.ts`'s header carries the lesson session 68 paid for: *"a shadow
 * evaluated in the wrong phase of a turn is blind to exactly the decisions
 * that end the turn, and it reports that blindness as an ordinary run of quiet
 * records."* The fix there was to hoist the evaluation ABOVE the oil block.
 *
 * **The correct phase for THIS shadow is the other side of that block, and the
 * reason is not convenience.** The candidate conditions on the focus BUDGET,
 * and the offline definition of budget (`budgetBefore`, `matcherHeadroom.ts`)
 * is the pre-play meter *including any oil restore taken this turn* — that is
 * the entire finding session 65 built `budgetBefore` around, and 24 of 24
 * observed consumes restore a budget of 2 from a meter reading 0. Evaluating
 * above the oil block would read the PRE-oil meter and therefore shadow a
 * different signal from the one the corpus validated, on exactly the turns
 * where an oil made the difference. So: **after the oil block, before
 * `play_cards`.**
 *
 * **The blindness that placement does buy is real and is COUNTED, not
 * absorbed.** A cast ended by a lethal oil inside the block never reaches a
 * card decision, so this shadow writes no record for it. That is correct — no
 * card decision means no redraw decision, so there is nothing to shadow — but
 * "correct" is exactly what session 68 believed too. `scripts/liveFishing.ts`
 * logs `redraw_shadow_no_decision` on those turns, so the count of turns this
 * instrument cannot see is a visible number rather than an absence.
 *
 * ## What shadow CANNOT establish — read this before quoting any number
 *
 * **It cannot tell you whether a redraw would have helped.** The bot really
 * plays the card, so the counterfactual is unobservable live, exactly as it is
 * for the oil shadow. What it CAN establish is the thing the corpus cannot:
 * how often the candidate fires on hands it has never seen, and whether the
 * firing rate out of sample resembles the in-sample one. A trigger that fires
 * ten times more often live than it did on the corpus is refuted as a
 * calibrated rule before any outcome question is asked.
 */
import { cellKey, reachableCells, type Cell } from "../../sim/fishing/geometry.js";
import { coverageOfCards } from "../../sim/fishing/redrawCounterfactual.js";
import type { FishingCardLike } from "./cardChoice.js";

/**
 * **The pre-registered threshold, and it is NOT fitted here.**
 *
 * Session 83 derived `heldCoverage` conditioned on `budget >= 1` and swept K
 * over 0..16. K=6 is taken from that sweep because it was the cleanest arm at
 * the time it was published, and it is frozen here so this shadow is testing a
 * rule someone committed to in advance rather than one chosen to look good on
 * the data it is about to see. `DECISIONS.md` 2026-08-23 (session 83 §3) calls
 * the sweep *"a shape, not a tuning"*, and that caveat is the reason this is a
 * shadow and not a shipped threshold.
 *
 * ⚠ **[session 90 §2] The numbers session 83 published for K=6 have MOVED, and
 * anyone reading this should know before quoting them.** On 148 casts the arm
 * was `{fires 6, rescues 6, sacrifices 0, wasted 0}` — perfectly clean. On the
 * current 168 it is `{fires 12, rescues 8, sacrifices 0, wasted 2}`. The
 * `sacrifices: 0` half survived; `wasted: 0` did not. That drift on 20 casts
 * is itself an argument for out-of-sample measurement rather than against it.
 *
 * **Nothing is lost by shadowing ONE K**, which is why this is a constant and
 * not a swept array: `heldCoverage` is recorded RAW on every record, so the
 * verdict at any other K is reconstructable offline from the same rows for
 * free. That is the same reasoning `oilShadow.ts` used when it replaced its
 * certainty arm rather than adding a second one.
 */
export const REDRAW_SHADOW_COVERAGE_K = 6;

/** The candidate's own condition: a fresh triple cannot restore the focus meter, so a dead hand with no budget is not rescuable. */
export const REDRAW_SHADOW_MIN_BUDGET = 1;

/** A human-readable name for the shadowed rule, so a log row is self-describing. */
export const REDRAW_SHADOW_POLICY_NAME = `heldCoverage<=${REDRAW_SHADOW_COVERAGE_K} & budget>=${REDRAW_SHADOW_MIN_BUDGET}`;

/** The live board quantities the candidate needs. */
export interface RedrawShadowBoard {
  hand: readonly FishingCardLike[];
  gridSize: number;
}

/** The scalars read off the doc at the live CARD decision, after any oil consume. */
export interface RedrawShadowScalars {
  turn: number;
  /** The focus meter at the card decision — post-oil, pre-play. See this file's phase note. */
  budget: number;
  focusCell: Cell;
  mana: number;
  fishHp: number;
}

/** The shadow's private frozen copy. Nothing on it is a live reference. */
export interface RedrawDecisionState {
  readonly turn: number;
  readonly budget: number;
  readonly focusCell: Cell;
  readonly mana: number;
  readonly fishHp: number;
  readonly board: RedrawShadowBoard;
}

export interface RedrawShadowRecord {
  turn: number;
  /** Recorded so a row is self-describing if the shipped state ever changes. Always false while §26 stands. */
  liveRedrawEnabled: boolean;
  shadowPolicy: string;
  /** THE RAW SIGNAL. Recorded so the verdict at any other K is reconstructable offline. */
  heldCoverage: number;
  /** The focus budget the condition is evaluated against — post-oil, pre-play. */
  budget: number;
  /** `budget >= REDRAW_SHADOW_MIN_BUDGET`. Separated from the coverage test so a non-firing row says WHICH clause refused. */
  conditionMet: boolean;
  /** `heldCoverage <= K`, independent of the budget condition — again so the two clauses are separable offline. */
  coverageBelowK: boolean;
  /** The candidate's verdict: both clauses. **Nothing reads this back.** */
  wouldRedraw: boolean;
  handSize: number;
  /** How many focus cells the budget makes reachable — the denominator coverage is measured over. */
  reachable: number;
  gridSize: number;
  focusCell: Cell;
  mana: number;
  fishHp: number;
  /** Nonsense-decision checks. Empty is the expected state; anything here is a real finding. */
  sanity: string[];
  /** Set only if the shadow threw. The cast is unaffected — that is the point. */
  error?: string;
}

/** Copy a card into fresh frozen objects, including the zone arrays the coverage geometry reads. */
function copyCard(c: FishingCardLike): FishingCardLike {
  return Object.freeze({
    ...c,
    hitZones: Object.freeze([...c.hitZones]),
    critZones: Object.freeze([...c.critZones]),
    hitEffects: Object.freeze(c.hitEffects.map((e) => Object.freeze({ ...e }))),
    missEffects: Object.freeze(c.missEffects.map((e) => Object.freeze({ ...e }))),
    critEffects: Object.freeze(c.critEffects.map((e) => Object.freeze({ ...e }))),
  }) as FishingCardLike;
}

/**
 * Build the shadow's own private, frozen copy of the decision state.
 *
 * Exported because the live loop builds it at the card-decision moment — see
 * `scripts/liveFishing.ts`. Structural property 1: after this returns, the
 * shadow holds no reference to anything the live path will read again.
 */
export function snapshotRedrawDecision(s: RedrawShadowScalars, board: RedrawShadowBoard): RedrawDecisionState {
  return Object.freeze({
    turn: s.turn,
    budget: s.budget,
    focusCell: Object.freeze({ x: s.focusCell.x, y: s.focusCell.y }),
    mana: s.mana,
    fishHp: s.fishHp,
    board: Object.freeze({
      hand: Object.freeze(board.hand.map(copyCard)),
      gridSize: board.gridSize,
    }),
  }) as RedrawDecisionState;
}

/**
 * Ask the candidate what it would have done. **Never throws.**
 *
 * `liveRedrawEnabled` is recorded, not consulted — this function has no branch
 * on it. It is on the record so a row read three sessions from now says what
 * the bot was actually doing at the time.
 */
export function evaluateRedrawShadow(
  snapshot: RedrawDecisionState,
  liveRedrawEnabled: boolean,
  k: number = REDRAW_SHADOW_COVERAGE_K,
  minBudget: number = REDRAW_SHADOW_MIN_BUDGET,
): RedrawShadowRecord {
  const base: RedrawShadowRecord = {
    turn: snapshot.turn,
    liveRedrawEnabled,
    shadowPolicy: `heldCoverage<=${k} & budget>=${minBudget}`,
    heldCoverage: -1,
    budget: snapshot.budget,
    conditionMet: false,
    coverageBelowK: false,
    wouldRedraw: false,
    handSize: snapshot.board.hand.length,
    reachable: 0,
    gridSize: snapshot.board.gridSize,
    focusCell: snapshot.focusCell,
    mana: snapshot.mana,
    fishHp: snapshot.fishHp,
    sanity: [],
  };

  try {
    const g = snapshot.board.gridSize;
    const reach = reachableCells(g, snapshot.focusCell, Math.max(0, snapshot.budget));
    // ONE implementation, shared with `separability`'s offline arm. See
    // `coverageOfCards`'s doc comment for why that matters more than it looks.
    const heldCoverage = coverageOfCards(snapshot.board.hand, reach, g);
    // §1b-style idempotence check: a pure function of a frozen state can only
    // disagree with itself if it is reading something it should not be.
    const second = coverageOfCards(snapshot.board.hand, reach, g);

    const coverageBelowK = heldCoverage <= k;
    const conditionMet = snapshot.budget >= minBudget;
    const record: RedrawShadowRecord = {
      ...base,
      heldCoverage,
      reachable: reach.length,
      coverageBelowK,
      conditionMet,
      wouldRedraw: coverageBelowK && conditionMet,
    };
    record.sanity = sanityViolations(record, heldCoverage, second, g);
    return record;
  } catch (e) {
    // A shadow that aborts a live cast is the failure this whole file exists
    // to avoid. Record and carry on.
    return { ...base, error: e instanceof Error ? e.message : String(e), sanity: ["shadow_threw"] };
  }
}

/**
 * The nonsense checks. Each is a decision or a reading that would be wrong on
 * its face regardless of what the corpus says, so a hit here is a finding
 * about the instrument, not about the fishery.
 */
function sanityViolations(r: RedrawShadowRecord, coverage: number, second: number, gridSize: number): string[] {
  const out: string[] = [];
  if (coverage !== second) out.push("shadow_not_idempotent");
  // Coverage counts DISTINCT cells on the board, so it cannot exceed the board.
  if (coverage < 0 || coverage > gridSize * gridSize) out.push("coverage_out_of_range");
  // "redraw with nothing in hand" — there is no hand to replace, and the
  // candidate was fitted on plays that had one.
  if (r.wouldRedraw && r.handSize === 0) out.push("redraw_with_empty_hand");
  // The condition is the whole reason the candidate is not the unconditional
  // sweep, which nets ~nothing. Firing without it means the clauses drifted.
  if (r.wouldRedraw && !r.conditionMet) out.push("redraw_without_budget");
  // `reachableCells` with a non-negative budget always returns at least the
  // focus cell itself, so an empty reach means the focus point is off-board —
  // the session-63 `[0,0]` bug, which would silently read coverage as 0 and
  // make the trigger fire on everything.
  if (r.reachable === 0) out.push("empty_reachable_set");
  // The live bot cannot redraw. If this is ever true the shadow is no longer
  // a shadow, which is the one failure this file is built to make loud.
  if (r.liveRedrawEnabled) out.push("live_redraw_is_ENABLED_this_is_no_longer_a_shadow");
  return out;
}

/** Stable key for a focus cell, re-exported so log consumers do not re-derive it. */
export const redrawShadowCellKey = cellKey;
