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
 *
 * ## [session 65 §1b] A batch can have the OPPOSITE intended exit
 *
 * Session 64's batch existed to see whether an oil could be consumed at all,
 * so the first consume ENDED it. Session 65's exists to accumulate
 * instrumented turns (§19) and to give the Relaxing trigger — reachable in
 * ~10% of casts, corpus-measured — a number of chances to fire, so a consume
 * is a CAPTURE and the batch runs on past it to a fixed size.
 *
 * Those are different shapes, not different constants, so the two are named
 * limit sets rather than one set with a retuned number: `stopOnOilConsume`
 * flips the success exit off, and `castCap` supplies the replacement one.
 * Session 64's is kept exported and tested so its halts stay demonstrable —
 * this is an added shape, not a retuned one.
 *
 * ## Why `cleanCastCap` is nullable rather than raised
 *
 * §2c pre-registered six clean casts as EVIDENCE the trigger model is wrong.
 * That interpretation stands and is not being retired (session 64's recap
 * explicitly keeps it pre-registered for a batch against fixed code — this is
 * that batch). But under a fixed seven-cast size the tripwire can only ever
 * pre-empt the last cast of an authorized batch, so it is set to REPORT
 * without halting: `null` means "the caller still counts clean casts and says
 * so", not "nobody is watching". Raising the number instead would have
 * silently rewritten the pre-registration.
 */

/** Which condition ended the batch. `null` means keep casting. */
export type BatchStopReason =
  | "oil_consumed"
  | "cast_cap"
  | "clean_cast_cap"
  | "ledger_exhausted"
  | "stock_dry"
  | "zero_streak"
  | "shadow_blind";

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
  /**
   * [session 69 §6] Shadow records taken at a moment the RELAXING trigger
   * fired, on which `bestKillProbability` came back `null`.
   *
   * After the session-69 hoist this number must be **zero**: the whole point
   * of moving the evaluation above the oil block was that the gate's own input
   * gets computed at the firing moment rather than in a phase a lethal consume
   * never reaches. A non-zero count means the hoist is not doing live what it
   * does in test, and every further cast would accumulate unobservable data —
   * which is exactly the state session 68 spent five casts in without knowing.
   */
  shadowBlindRelaxingFirings: number;
}

export interface BatchLimits {
  /**
   * [session 65] The batch's own size, and its INTENDED exit when the
   * objective is data rather than a first consume. `null` = no cast ceiling
   * (session 64's shape, which expected to exit on the consume instead).
   */
  castCap: number | null;
  /**
   * §2c. Six, and it is pre-registered as a finding rather than a budget.
   * `null` = the tripwire does not HALT — see the module header on why that is
   * nullable rather than raised.
   */
  cleanCastCap: number | null;
  /** The zero-streak tripwire, armed at 15. */
  zeroStreakCap: number;
  /**
   * [session 69 §6] Halt if the shadow goes blind on a Relaxing firing.
   * `false` for the historical shapes, which predate the hoist and could not
   * have observed the arm at all — arming it there would make those constants
   * describe a batch that never ran.
   */
  haltOnShadowBlind: boolean;
  /**
   * [session 65] Whether the first consume ends the batch. TRUE is session
   * 64's success exit; FALSE is a batch whose objective is instrumented turns,
   * for which a consume is a capture and not an exit.
   */
  stopOnOilConsume: boolean;
}

/** Session 64's shape: stop at the first consume, tripwire at six clean casts, no cast ceiling. */
export const SESSION_64_LIMITS: BatchLimits = {
  castCap: null,
  cleanCastCap: 6,
  zeroStreakCap: 15,
  stopOnOilConsume: true,
  haltOnShadowBlind: false,
};

/**
 * [session 65 §1b] Seven casts, run to completion. A consume does NOT stop it
 * — not the first Focus consume, not a Relaxing consume, not a second consume
 * within one cast. The clean-cast tripwire reports without halting.
 *
 * ## [session 66 §4] ITS OBJECTIVE IS SPENT. §19 IS CLOSED.
 *
 * This shape existed to accumulate instrumented matcher turns for §19, and
 * §19 finished: **POWERED KEEP at n=35 of 32** (session 65, DECISIONS
 * 2026-08-21). There are no more turns to accrue and no verdict waiting on
 * them, so **do not budget casts for §19 and do not report turn accrual.**
 *
 * The constant stays exported, tested and unchanged — session 64's is kept
 * for exactly the same reason, and a shape is history, not a setting. What is
 * retired is its RATIONALE, not its numbers. A future batch that wants seven
 * casts must say what those seven casts are for in its own brief; inheriting
 * this one's reasons would be carrying a closed programme forward out of
 * habit, which is the specific failure §4 was written to prevent.
 */
export const SESSION_65_LIMITS: BatchLimits = {
  castCap: 7,
  cleanCastCap: null,
  zeroStreakCap: 15,
  stopOnOilConsume: false,
  haltOnShadowBlind: false,
};

/**
 * **[session 69 §6] The shape THIS batch runs, and what its ten casts are
 * for.** Session 66 §4 settled that a batch shape is history rather than a
 * standing authorization and that a session wanting N casts must say what they
 * are for in its own brief. So, stated:
 *
 * **The casts are for OBSERVING THE RELAXING ARM OF THE NECESSITY GATE AT ITS
 * FIRING MOMENT.** Session 68 shadowed the gate over five casts and got one
 * observation, all on the Focus arm, with `bestKillProbability` null on every
 * record — the arm's firing moment is a turn a lethal oil ends, and the shadow
 * was evaluated after it. Session 69 §1 hoisted the pipeline; ten casts at the
 * live Relaxing firing rate (4 firings over the ~24 casts on record) is the
 * budget for finding out whether the fix produces observations against a real
 * server rather than only against a mock.
 *
 * `castCap: 10` leaves five of the day's twenty in reserve. `cleanCastCap` is
 * null because a clean cast is not the finding here. `stopOnOilConsume` is
 * false because a consume is the CAPTURE — stopping on one would end the batch
 * on the first thing it is looking for, which is session 64's shape and the
 * wrong one for this objective.
 *
 * `haltOnShadowBlind` is the new one and is the reason this is a distinct
 * shape rather than `SESSION_65_LIMITS` with a bigger number: if the hoist
 * fails live, the remaining casts would accumulate exactly the unobservable
 * data this batch exists to stop accumulating.
 */
export const SESSION_69_LIMITS: BatchLimits = {
  castCap: 10,
  cleanCastCap: null,
  zeroStreakCap: 15,
  stopOnOilConsume: false,
  haltOnShadowBlind: true,
};

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
 * Order matters where two conditions hold at once. The INTENDED EXIT outranks
 * everything, because reporting it as an exhaustion or a tripwire would
 * misdescribe a batch that did exactly what was asked — that is `oil_consumed`
 * under session 64's shape and `cast_cap` under session 65's.
 * `ledger_exhausted` then outranks the tripwires: running out of casts is not
 * evidence about the model.
 */
export function batchVerdict(s: BatchState, limits: BatchLimits = SESSION_64_LIMITS): BatchVerdict {
  if (limits.stopOnOilConsume && s.oilsConsumed > 0) {
    return {
      stop: true,
      reason: "oil_consumed",
      detail: `an oil was consumed on cast ${s.castsPlayed} of the batch — the intended exit. Stopping for recap.`,
    };
  }
  if (limits.castCap !== null && s.castsPlayed >= limits.castCap) {
    return {
      stop: true,
      reason: "cast_cap",
      detail:
        `${s.castsPlayed} of ${limits.castCap} casts completed — the intended exit. ` +
        `${s.oilsConsumed} oil(s) consumed along the way; a consume is a capture here, not an exit.`,
    };
  }
  if (s.ledgerCastsRemaining <= 0) {
    return {
      stop: true,
      reason: "ledger_exhausted",
      detail: `the day's cast ledger is exhausted after ${s.castsPlayed} cast(s). Not evidence about the model.`,
    };
  }
  // [session 65] Gated on `stopOnOilConsume`, because this halt's whole
  // justification is that the CONSUME EXIT can no longer be met. A batch whose
  // objective is instrumented turns still gets every turn out of a dry cast, so
  // "further casts would spend ledger entries for nothing" is simply false
  // there. Note this is about BOTH oils being dry; PARTIAL dry never halts
  // under either shape, and never has — see `tests/fishing/oilPartialDry.test.ts`.
  if (limits.stopOnOilConsume && s.focusOilHeld <= 0 && s.relaxingOilHeld <= 0) {
    return {
      stop: true,
      reason: "stock_dry",
      detail:
        `both oils are at zero after ${s.castsPlayed} cast(s) — the stop condition can no longer be met, ` +
        `so further casts would spend ledger entries for nothing.`,
    };
  }
  if (limits.cleanCastCap !== null && s.cleanCasts >= limits.cleanCastCap) {
    return {
      stop: true,
      reason: "clean_cast_cap",
      detail:
        `${s.cleanCasts} clean casts with no consume. Under the sim's ~0.70 oils/cast this is a ~1-in-900 ` +
        `event: report it as evidence the trigger model does not describe live play. DO NOT extend the batch.`,
    };
  }
  // [session 69 §6] Ranked BELOW the ledger and the cast cap (running out of
  // casts is not evidence about the shadow) and ABOVE the zero-streak, because
  // a blind shadow means the batch's own objective is unreachable while a zero
  // streak is a statement about the fishery.
  if (limits.haltOnShadowBlind && s.shadowBlindRelaxingFirings > 0) {
    return {
      stop: true,
      reason: "shadow_blind",
      detail:
        `${s.shadowBlindRelaxingFirings} shadow record(s) at a RELAXING firing came back with ` +
        `bestKillProbability null after ${s.castsPlayed} cast(s). The session-69 hoist is not producing the ` +
        `observation live that it produces in test — STOP AND REPORT rather than accumulating unobservable casts. ` +
        `This is the exact state session 68 spent five casts in without knowing.`,
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
