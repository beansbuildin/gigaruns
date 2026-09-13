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
 *   2. **Six clean casts.** ⚠ **RETIRED 2026-08-25 — see the `cleanCastCap`
 *      doc below.** It was a tripwire on the model: under the sim's own
 *      consumption rate six clean casts was believed to be a ~1-in-900 event,
 *      so reaching it was evidence the trigger model did not describe live
 *      play. Both halves of that — the instrument and the arithmetic — turned
 *      out to be wrong.
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
 * Under a fixed seven-cast size the tripwire could only ever pre-empt the last
 * cast of an authorized batch, so it was set to REPORT without halting: `null`
 * means "the caller still counts clean casts and says so", not "nobody is
 * watching". Raising the number instead would have silently rewritten the
 * pre-registration.
 *
 * ## ⚠ [session 98 §B] THE §2c CLEAN-CAST TRIPWIRE IS RETIRED — 2026-08-25
 *
 * **By user directive, QUESTIONS.md §44. Retired outright, NOT re-registered
 * with a corrected threshold** — that was offered and declined, and inventing
 * a replacement here would be the second decision the ruling separates from
 * the first.
 *
 * **Why.** Three errors compounded (session 97 §1c, QUESTIONS.md §40–§41):
 *
 *   - **Wrong instrument.** The "~0.70 oils/cast" it was registered against is
 *     a `castSim` number, and `handoff/OIL-POLICY.md` §0a suspends that
 *     simulator for this fishery. Live, the rate is **0.44** in today's era
 *     and **0.30** all-time.
 *   - **Wrong arithmetic.** It printed "~1-in-900". Under its OWN ~0.70
 *     assumption the correct figure for 9 clean of 10 is **~1 in 98** — off by
 *     roughly 9x.
 *   - **Wrong conclusion.** At the LIVE clean-cast rate (30/43 = 69.8%,
 *     `focusDry` era) the same event is **~1 in 7** — an ordinary outcome. It
 *     did not detect a divergence in live play; it detected its own threshold
 *     being derived from a suspended instrument.
 *
 * **What is retired, precisely.** The PRE-REGISTRATION — the claim that N
 * clean casts is evidence about the trigger model, and the ~1-in-900 rarity
 * attached to it. `scripts/liveFishing.ts` no longer evaluates or prints it.
 *
 * **What is NOT changed, and why.** `SESSION_64_LIMITS.cleanCastCap` stays
 * `6` and the `clean_cast_cap` branch of `batchVerdict` stays reachable. That
 * shape is HISTORY — this module's own rule is that "a shape is history, not
 * a setting" — and editing its numbers would rewrite what session 64 actually
 * ran. No live shape sets a non-null `cleanCastCap`: `SESSION_65_LIMITS` and
 * `SESSION_69_LIMITS` are both `null`, and have been since session 65. The
 * branch's message no longer carries the retired rarity claim.
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
   * §2c. Six, and it was pre-registered as a finding rather than a budget.
   *
   * ⚠ **RETIRED 2026-08-25 by user directive (QUESTIONS.md §44)** — the
   * pre-registration was miscalibrated on a suspended `castSim` instrument and
   * its stated rarity was wrong by ~9x. See the module header for the full
   * reason. Every live shape sets this `null`; do not set it non-null in a new
   * shape without a fresh, live-derived pre-registration and a user directive
   * to go with it.
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

/**
 * Session 64's shape: stop at the first consume, tripwire at six clean casts,
 * no cast ceiling.
 *
 * ⚠ [session 98 §B] Its `cleanCastCap` of 6 is the RETIRED §2c
 * pre-registration (QUESTIONS.md §44). The number stays because this constant
 * records what session 64 ran — history, not a setting — and no live shape
 * uses it.
 */
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

/**
 * **[session 98 §D] NINE casts, and what the nine are for.**
 *
 * Session 66 §4's rule is that a batch shape is history rather than a standing
 * authorization, and that a session wanting N casts states what they are for
 * in its own brief. Stated:
 *
 * **The cap is NINE because the ROD has about nine casts left**, on the
 * account owner's own estimate (`rodDeck.ts`: nothing in this repo can see
 * durability, so the owner is the only sensor), and the user is replacing the
 * rod immediately after this batch — QUESTIONS.md §45, 2026-08-25, verbatim:
 * *"we can queue up 9 live casts then I will replace the rod with a new one
 * that will have a new deck."* Nine is deliberately INSIDE that estimate
 * rather than testing it to failure.
 *
 * **What the casts buy:** the first live read of two things that changed
 * without any live play between them — the necessity gate's Relaxing threshold
 * at the user's **0.85** (QUESTIONS.md §43, session 98 §A: 9 of 24 recorded
 * observations would be held, against 0 at the old threshold of 1), and the
 * standing no-Focus-Oil configuration (§42). Neither has ever been observed
 * live in combination.
 *
 * **It is a distinct shape rather than `SESSION_69_LIMITS` with a smaller
 * number** for the same reason session 69's was: the number is load-bearing
 * and it is justified here, beside itself. Making the cap structural also
 * means a mistyped `--casts` flag cannot spend a tenth cast the rod may not
 * have.
 *
 * Everything else is session 69's shape and is inherited deliberately:
 * `stopOnOilConsume` false (a consume is the capture, not the exit),
 * `cleanCastCap` null (the §2c pre-registration is RETIRED — §B, QUESTIONS.md
 * §44), `haltOnShadowBlind` true (a blind shadow means the objective is
 * unreachable and further casts accumulate unobservable data).
 */
export const SESSION_98_LIMITS: BatchLimits = {
  castCap: 9,
  cleanCastCap: null,
  zeroStreakCap: 15,
  stopOnOilConsume: false,
  haltOnShadowBlind: true,
};

/**
 * **[session 99 §2] TWO casts, and what the two are for.**
 *
 * Session 66 §4's rule again: a batch shape is history, not a standing
 * authorization, so the number is justified beside itself.
 *
 * **The cap is TWO because the DAY'S LEDGER holds exactly two.**
 * `dayDocs[pondId 2]` read 18 of 20 at the start of this session and the repo
 * ledger agreed at 18, so two is the whole remaining allowance — this is the
 * one batch shape in this file whose number is set by the ledger rather than
 * in spite of it. Session 98's nine were capped by the ROD against a ledger
 * with room to spare; this is the opposite case, and the distinction is worth
 * keeping because `ledger_exhausted` and `cast_cap` would fire on the same
 * cast here. `batchVerdict` ranks `cast_cap` first, which is correct: two
 * casts completed is the INTENDED exit, not an exhaustion.
 *
 * **What the casts buy:** the first PLAY capture on the new rod. The account
 * swapped Shroom (811, durability 0) for **Golkan (812)** at
 * 2026-08-26T02:27:20Z — after session 98's last cast, exactly as
 * QUESTIONS.md §47 said — and `/offchain/static` gives Golkan's grant as
 * `[74,80,81,84,85,86,87,88,89,90]`. That is the PAYLOAD half. These two
 * casts are the half that reads the game: whether PLAY is actually dealt that
 * grant, which `rodDeck.ts` has been burned on before (a rod being equipped
 * does not mean its grant is dealt — session 89's durability window).
 *
 * Everything else is session 98's shape, inherited deliberately and for its
 * reasons: `stopOnOilConsume` false, `cleanCastCap` null (RETIRED, §44),
 * `haltOnShadowBlind` true.
 */
export const SESSION_99_LIMITS: BatchLimits = {
  castCap: 2,
  cleanCastCap: null,
  zeroStreakCap: 15,
  stopOnOilConsume: false,
  haltOnShadowBlind: true,
};

/**
 * **[session 127] TWENTY-FIVE casts. A batch shape is history, not a standing
 * authorization (session 66 §4), so the number is justified beside itself.**
 *
 * **The cap is 25 because the USER authorized 25**, directly in chat on
 * 2026-09-10: "up to 25 fishing casts ... without stopping". Not derived from
 * the ledger, and not a general loosening — `SESSION_99_LIMITS` stays exported
 * and tested, exactly as its predecessors do.
 *
 * **Why the rod hazard behind `castCap: 2` does not apply today.** The small
 * shape exists because rod durability is read at PREFLIGHT and AFTER the
 * batch, never between casts, so a long batch can play past zero onto a dry
 * rod and inject `BASE_DECK` mid-batch unnoticed. **That needs the rod to
 * reach 0, and it cannot here:** rod 923 read **38** at 17:54:10Z; 25 casts at
 * -1.00 per PLAYED cast leaves it at **13**. The reason for the small shape is
 * absent, not overridden.
 *
 * **What DOES break, deliberately.** The slot-15 pair read **18 / 18** and
 * wears -1.00 per played cast, reaching 0 on played cast **18**. Casts
 * **19-25 are a BROKEN-SLOT-15 ARM** and must be labelled as such in the
 * recap; nothing downstream separates the arms after the fact.
 *
 * **Purpose:** the Dendren catch-rate tripwire has failed to arm for two
 * sessions. The corpus stands at n = 76; ~24 more casts reach the
 * pre-registered n ~ 100 where the <50% / 50-65% rule is read.
 *
 * Everything else inherits session 99's shape for session 99's reasons.
 */
/**
 * [session 130] The SECOND Puppeteer (924) batch. `castCap: 10` is sized to the
 * **GEAR HALT** again: the slot-15 pair read **10 / 20** at 16:58:56Z (both
 * repaired out of band since session 129's 10 / 0) and wears -1.00 per PLAYED
 * cast, so the 10 reaches 0 exactly at played cast 10 and the [USER] per-arm
 * halt fires there. The rod is at 27 and the game ledger at 0/20 (CHARGED
 * casts), so both are slack — the user's 20-cast scope is cut to 10 by gear.
 *
 * The `castCap: 2` convention does not bind: 27 - 10 = 17 means the rod cannot
 * reach 0 with casts still to play.
 *
 * Everything else inherits session 99's shape for session 99's reasons.
 */
export const SESSION_130_LIMITS: BatchLimits = {
  castCap: 10,
  cleanCastCap: null,
  zeroStreakCap: 15,
  stopOnOilConsume: false,
  haltOnShadowBlind: true,
};

/**
 * [session 129] The FIRST Puppeteer (924) batch. `castCap: 17` is sized to the
 * **GEAR HALT**, not to the rod and not to the ledger — the two slot-15 pieces
 * read 27 and 17 at session open and wear -1.00 per PLAYED cast, so the 17
 * reaches 0 exactly at cast 17 and the [USER] per-arm halt fires there. The
 * rod itself is at 44 and the game ledger at 20, so both are slack.
 *
 * The `castCap: 2` convention does not bind: the dry-rod hazard it exists for
 * (a dry rod injects BASE_DECK mid-batch unnoticed, because durability is read
 * at preflight and after the batch only) needs the rod to reach 0 with casts
 * still to play, and 44 - 17 = 27 makes that unreachable.
 *
 * Everything else inherits session 99's shape for session 99's reasons.
 */
export const SESSION_129_LIMITS: BatchLimits = {
  castCap: 17,
  cleanCastCap: null,
  zeroStreakCap: 15,
  stopOnOilConsume: false,
  haltOnShadowBlind: true,
};

/**
 * [session 128] The day-20706 tail: exactly THREE casts, the whole of what the
 * game ledger had left (dayDocs[2] read 17/20) before the 18:00Z rollover.
 *
 * `castCap: 3` is sized to the LEDGER here, not to the rod — the rod is at 13,
 * so the dry-rod hazard the `castCap: 2` convention exists for (a dry rod
 * injects BASE_DECK mid-batch unnoticed, because durability is read only at
 * preflight and after the batch) is unreachable at any cap of 13 or fewer.
 * Deliberately sized, same as session 127's 25.
 */
export const SESSION_128_LIMITS: BatchLimits = {
  castCap: 3,
  cleanCastCap: null,
  zeroStreakCap: 15,
  stopOnOilConsume: false,
  haltOnShadowBlind: true,
};

export const SESSION_127_LIMITS: BatchLimits = {
  castCap: 25,
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
        `${s.cleanCasts} clean casts with no consume. ⚠ THE §2c PRE-REGISTRATION THIS HALT CARRIED IS ` +
        `RETIRED (2026-08-25, user directive, QUESTIONS.md §44): its "~1-in-900" rarity was miscomputed by ` +
        `~9x AND derived from a suspended simulator, and the same event is ~1 in 7 at the live clean-cast ` +
        `rate. This halt is now nothing but the cap the caller asked for — it is NOT evidence about the ` +
        `trigger model. DO NOT extend the batch on the strength of it, and DO NOT report it as a finding.`,
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
