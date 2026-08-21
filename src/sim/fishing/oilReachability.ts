/**
 * src/sim/fishing/oilReachability.ts — [session 64 §1] Was the `on-demand` oil
 * policy ever ABLE to fire, in a real cast, against the real server?
 *
 * ## The question, and why it outranks spending casts to find out
 *
 * `on-demand` was chosen over five alternatives in sim (session 62) and shipped
 * live. Of its +19.40pp, **+17.74pp is the Focus trigger alone**
 * (`focus-when-empty-only`). Session 63 then played one live cast in which
 * NEITHER trigger was reachable — not "did not fire", *could not*:
 *
 *   - `fishHp` 12 -> 9 -> 4 -> 0. The fish skipped the 1-2 HP band entirely.
 *   - `focusMeter` 3 -> 1 -> 1 -> 0. Zero only on the terminal state, fish
 *     already dead, no turn left to spend into.
 *
 * One cast proves nothing. But it is a specific, falsifiable hypothesis with a
 * FREE test: if live fish skip the lethal band and the meter empties only as a
 * cast ends, then the sim's headline number is an artifact of the sim's cast
 * model and the shipped policy is a no-op wearing a recommendation. This module
 * answers that against the committed corpus — no casts, no oils, no server.
 *
 * ## The definitions, stated here because the definition IS the question
 *
 * A **decision point** is a captured board state at which the live loop
 * actually got to choose:
 *
 *   1. the fish was ALIVE (`fishHp > 0`), and
 *   2. a `play_cards` response exists strictly LATER in the same cast.
 *
 * Clause 2 is "with a turn remaining", and it is the whole question. Drop it
 * and every cast that ends with the meter at zero — which is most of them,
 * because a cast ends when the budget runs out — counts as Focus-reachable,
 * reporting an opportunity that never existed. `requireTurnRemaining: false`
 * reproduces exactly that mistake on purpose, so a test can pin the difference
 * rather than trusting prose (`tests/fishing/oilReachability.test.ts`).
 *
 * Clause 2 is EMPIRICAL, not structural: it asks whether a later turn was
 * actually captured, not whether the rules would have allowed one. A cast whose
 * process was killed mid-play therefore under-reports, so `incomplete` is
 * reported separately rather than folded into the rates.
 *
 * ## What it does NOT re-implement
 *
 * The triggers. It calls `onDemandTriggers` — the shipped function the live
 * loop calls — so this measures the policy that is running, not a paraphrase of
 * it. Held stock is passed as zero and deliberately ignored: `onDemandTriggers`
 * is stock-blind by construction (that split is session 62 §1b's whole point),
 * and the question here is reachability, not affordability.
 */

import type { FishingCast, FishingCorpusResponse } from "../fishingCorpus.js";
import type { OilEffects, OilKind, OilTimingState } from "../../strategy/fishing/oilTiming.js";
import { PAYLOAD_OIL_EFFECTS, onDemandTriggers } from "../../strategy/fishing/oilTiming.js";

export interface ReachabilityOptions {
  /** The oils' modelled amounts. Defaults to the payload's own (+2 / +2). */
  effects?: OilEffects;
  /**
   * Clause 2 of the decision-point definition. **Defaults true, and true is
   * the correct definition.** False exists so a test can demonstrate what the
   * lax reading claims; it is not a supported analysis mode.
   */
  requireTurnRemaining?: boolean;
}

/** One cast's answer. Counts as well as booleans — a cast with six reachable turns is not the same evidence as one with a single borderline one. */
export interface CastReachability {
  docId: string;
  /** States meeting BOTH clauses of the decision-point definition. */
  decisionPoints: number;
  /** Decision points at which the Relaxing (lethal) trigger held. */
  relaxingPoints: number;
  /** Decision points at which the Focus (meter-zero) trigger held. */
  focusPoints: number;
  relaxingReachable: boolean;
  focusReachable: boolean;
  eitherReachable: boolean;
  /** No response in the cast carries `COMPLETE_CID: true` — a process left mid-cast. Under-reports by construction. */
  incomplete: boolean;
  caught: boolean;
}

export interface ReachabilityReport {
  casts: number;
  relaxingReachable: number;
  focusReachable: number;
  eitherReachable: number;
  bothReachable: number;
  neitherReachable: number;
  /** Summed across casts, not per-cast — the number of turns the policy could have spent into. */
  totalDecisionPoints: number;
  totalRelaxingPoints: number;
  totalFocusPoints: number;
  incomplete: number;
  perCast: CastReachability[];
}

/**
 * Chronological order within a cast, by the server's own `updatedAt`, with the
 * file path as a deterministic tiebreak for same-millisecond stamps. See
 * `FishingCorpusResponse.board` for why filesystem order will not do.
 */
export function orderedResponses(cast: FishingCast): FishingCorpusResponse[] {
  return [...cast.responses].sort((a, b) =>
    a.updatedAt === b.updatedAt ? a.file.localeCompare(b.file) : a.updatedAt.localeCompare(b.updatedAt),
  );
}

/** The trigger inputs a board state supplies. Stock is zero and unread — see this file's header. */
function timingStateFrom(r: FishingCorpusResponse, turn: number): OilTimingState {
  return {
    turn,
    fishHp: r.board.fishHp,
    fishMaxHp: r.board.fishMaxHp,
    mana: 0,
    focusRemaining: r.board.focusMeter,
    focusMax: r.board.focusMeterMax,
    focusOilHeld: 0,
    relaxingOilHeld: 0,
  };
}

export function castReachability(cast: FishingCast, opts: ReachabilityOptions = {}): CastReachability {
  const effects = opts.effects ?? PAYLOAD_OIL_EFFECTS;
  const requireTurnRemaining = opts.requireTurnRemaining ?? true;
  const ordered = orderedResponses(cast);

  // Index of the LAST `play_cards` response. A state at index i has a turn
  // remaining iff some play_cards sits strictly after it, i.e. i < lastPlay.
  let lastPlay = -1;
  for (let i = 0; i < ordered.length; i++) if (ordered[i]!.kind === "play_cards") lastPlay = i;

  let decisionPoints = 0;
  let relaxingPoints = 0;
  let focusPoints = 0;

  for (let i = 0; i < ordered.length; i++) {
    const r = ordered[i]!;
    if (!(r.board.fishHp > 0)) continue; // NaN falls here too, which is the safe direction
    if (requireTurnRemaining && i >= lastPlay) continue;
    decisionPoints++;
    const fired: OilKind[] = onDemandTriggers(timingStateFrom(r, i), effects);
    if (fired.includes("relaxing")) relaxingPoints++;
    if (fired.includes("focus")) focusPoints++;
  }

  const relaxingReachable = relaxingPoints > 0;
  const focusReachable = focusPoints > 0;
  return {
    docId: cast.docId,
    decisionPoints,
    relaxingPoints,
    focusPoints,
    relaxingReachable,
    focusReachable,
    eitherReachable: relaxingReachable || focusReachable,
    incomplete: !cast.responses.some((r) => r.completeCid),
    caught: cast.responses.some((r) => r.caughtFish !== null),
  };
}

export function reachabilityReport(casts: readonly FishingCast[], opts: ReachabilityOptions = {}): ReachabilityReport {
  const perCast = casts.map((c) => castReachability(c, opts));
  return {
    casts: perCast.length,
    relaxingReachable: perCast.filter((c) => c.relaxingReachable).length,
    focusReachable: perCast.filter((c) => c.focusReachable).length,
    eitherReachable: perCast.filter((c) => c.eitherReachable).length,
    bothReachable: perCast.filter((c) => c.relaxingReachable && c.focusReachable).length,
    neitherReachable: perCast.filter((c) => !c.eitherReachable).length,
    totalDecisionPoints: perCast.reduce((n, c) => n + c.decisionPoints, 0),
    totalRelaxingPoints: perCast.reduce((n, c) => n + c.relaxingPoints, 0),
    totalFocusPoints: perCast.reduce((n, c) => n + c.focusPoints, 0),
    incomplete: perCast.filter((c) => c.incomplete).length,
    perCast,
  };
}
