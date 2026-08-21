/**
 * src/strategy/fishing/oilBatch.ts — [session 64 §2b] WHEN A BATCH STOPS.
 *
 * ## Why this is a module and not four `if`s in `main()`
 *
 * The user's directive is "keep casting until the first cast that uses an oil,
 * then end the session". That is one stop condition; the brief names five, and
 * four of them exist because the obvious one can never be met:
 *
 *   1. **A cast consumed an oil.** The intended exit. Finish that cast, stop.
 *   2. **Six clean casts.** NOT a budget — a tripwire on the model. Under the
 *      sim's own consumption rate six clean casts is a ~1-in-900 event, so
 *      reaching it is evidence the trigger model does not describe live play,
 *      and the correct response is to report that rather than to extend.
 *   3. **The day's cast ledger is exhausted.**
 *   4. **Stock is dry for both oils.** The stop condition can then never be
 *      met, so every further cast spends a ledger entry for nothing.
 *   5. **The zero-streak tripwire.**
 *
 * Conditions 2 and 4 are the ones a hand-rolled loop gets wrong, and they fail
 * in opposite directions: 2 forgotten means casting forever chasing an event
 * the model mispriced; 4 forgotten means casting forever chasing an event that
 * is now impossible. Both are silent. So the decision is pure, returns a
 * REASON rather than a boolean, and is tested against each halt individually.
 *
 * Pure by construction: no I/O, no network, no clock. `scripts/liveFishing.ts`
 * feeds it observed counts and acts on the verdict.
 */

/** Which condition ended the batch. `null` means keep casting. */
export type BatchStopReason =
  | "oil_consumed"
  | "clean_cast_cap"
  | "ledger_exhausted"
  | "stock_dry"
  | "zero_streak";

export interface BatchState {
  /** Casts COMPLETED so far in this batch. */
  castsPlayed: number;
  /** Oils consumed across the batch. The intended exit fires at the first one. */
  oilsConsumed: number;
  /** Casts completed with no oil consumed. Drives the tripwire. */
  cleanCasts: number;
  /** Casts still available on the GAME's own day ledger (`dayDocs[pondId]`), not this repo's policy budget. */
  ledgerCastsRemaining: number;
  /** Live balances. Both zero means the intended exit is unreachable. */
  focusOilHeld: number;
  relaxingOilHeld: number;
  /** Consecutive casts with no catch, as tracked by `zeroStreak.ts`. */
  zeroStreak: number;
}

export interface BatchLimits {
  /** §2c. Six, and it is pre-registered as a finding rather than a budget. */
  cleanCastCap: number;
  /** The zero-streak tripwire, armed at 15. */
  zeroStreakCap: number;
}

export const SESSION_64_LIMITS: BatchLimits = { cleanCastCap: 6, zeroStreakCap: 15 };

export interface BatchVerdict {
  stop: boolean;
  reason: BatchStopReason | null;
  /** Operator-facing sentence. Distinct per reason because they mean very different things. */
  detail: string;
}

const KEEP_GOING: BatchVerdict = { stop: false, reason: null, detail: "batch continues" };

/**
 * Evaluated BETWEEN casts, on completed-cast counts only. Never mid-cast: stop
 * condition 1 is explicitly "finish that cast completely, then stop", so a
 * consume seen part-way through a cast must not abort the cast it is in.
 *
 * Order matters where two conditions hold at once. `oil_consumed` outranks
 * everything because it is the SUCCESS exit and reporting it as an exhaustion
 * or a tripwire would misdescribe a batch that did exactly what was asked.
 * `ledger_exhausted` then outranks the tripwire: running out of casts is not
 * evidence about the model.
 */
export function batchVerdict(s: BatchState, limits: BatchLimits = SESSION_64_LIMITS): BatchVerdict {
  if (s.oilsConsumed > 0) {
    return {
      stop: true,
      reason: "oil_consumed",
      detail: `an oil was consumed on cast ${s.castsPlayed} of the batch — the intended exit. Stopping for recap.`,
    };
  }
  if (s.ledgerCastsRemaining <= 0) {
    return {
      stop: true,
      reason: "ledger_exhausted",
      detail: `the day's cast ledger is exhausted after ${s.castsPlayed} cast(s). Not evidence about the model.`,
    };
  }
  if (s.focusOilHeld <= 0 && s.relaxingOilHeld <= 0) {
    return {
      stop: true,
      reason: "stock_dry",
      detail:
        `both oils are at zero after ${s.castsPlayed} cast(s) — the stop condition can no longer be met, ` +
        `so further casts would spend ledger entries for nothing.`,
    };
  }
  if (s.cleanCasts >= limits.cleanCastCap) {
    return {
      stop: true,
      reason: "clean_cast_cap",
      detail:
        `${s.cleanCasts} clean casts with no consume. Under the sim's ~0.70 oils/cast this is a ~1-in-900 ` +
        `event: report it as evidence the trigger model does not describe live play. DO NOT extend the batch.`,
    };
  }
  if (s.zeroStreak >= limits.zeroStreakCap) {
    return {
      stop: true,
      reason: "zero_streak",
      detail: `zero-streak tripwire at ${s.zeroStreak} (cap ${limits.zeroStreakCap}).`,
    };
  }
  return KEEP_GOING;
}
