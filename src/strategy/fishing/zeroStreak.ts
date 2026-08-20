/**
 * src/strategy/fishing/zeroStreak.ts — [session 61 §4e] the zero-catch
 * tripwire, as CODE. Pure: cast outcomes in, verdict out, no I/O.
 *
 * > **Halt and report on 15 consecutive casts with zero catches.**
 *
 * ## Why this is a module and not a line in a brief
 *
 * It was a line in a brief, for many sessions, and this is what that bought:
 * **the dead era ran 40 casts before a human noticed.** The tripwire's own
 * justification — "it is the one thing that would have caught the dead era
 * early" — describes a rule that did not fire, because nothing computed it.
 * A tripwire nobody evaluates is not a safeguard; it is a sentence about one.
 *
 * The session-61 brief asks for it to be "confirmed armed" through the oil
 * transition and explicitly forbids removing it as a side effect of dropping
 * the 60% target (`handoff/DECISIONS.md`, 2026-08-20). "Armed" cannot mean
 * "still written down", so it is computed here and asserted in the suite.
 *
 * ## Why 15, and why that number is NOT re-derived here
 *
 * 15 is the user's standing figure and it is carried forward unchanged. Note
 * what it is worth against the current fishery: at a 25.9% catch rate
 * (dead-era-excluded), 15 consecutive misses has probability 0.741^15 ~= 1.2%,
 * so this is a genuine anomaly detector rather than a hair trigger. At the
 * lifetime rate including the dead era (14.9%) it is 8.9%, which is exactly
 * the sensitivity you want from a rule designed to catch a period like that.
 *
 * ## It spans the oil boundary deliberately
 *
 * A zero streak does not reset because the spending policy changed — the
 * transition is precisely when a safeguard earns its keep, and a tripwire that
 * resets on every policy change can never fire during one. This is the ONE
 * place §4b's outcome/movement split does not apply: it is an outcome metric,
 * but it is a SAFETY metric, and splitting it into per-arm streaks would halve
 * its sensitivity at the exact moment it matters most.
 */

/** The standing figure. User's, session 51 onward; carried unchanged through the 60% drop. */
export const ZERO_STREAK_LIMIT = 15;

export interface ZeroStreakVerdict {
  /** Consecutive zero-catch casts ending at the most recent one. */
  streak: number;
  limit: number;
  /** True when the streak has reached the limit — halt and report. */
  tripped: boolean;
  /** Casts still to miss before the tripwire fires. */
  castsRemaining: number;
  rationale: string;
}

/**
 * `outcomes` is oldest-first, one entry per COMPLETED cast — `true` = caught.
 * Incomplete casts have no outcome and must be filtered out by the caller
 * rather than counted as misses; a process killed mid-cast is not evidence
 * about the fishery.
 */
export function evaluateZeroStreak(
  outcomes: readonly boolean[],
  limit: number = ZERO_STREAK_LIMIT,
): ZeroStreakVerdict {
  let streak = 0;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (outcomes[i]) break;
    streak++;
  }
  const tripped = streak >= limit;
  return {
    streak,
    limit,
    tripped,
    castsRemaining: Math.max(0, limit - streak),
    rationale: tripped
      ? `TRIPWIRE: ${streak} consecutive casts with zero catches (limit ${limit}). Halt and report — ` +
        `this is the shape the dead era had, and it ran 40 casts before a human noticed.`
      : `${streak} consecutive zero-catch cast(s) of ${limit}. ${limit - streak} more would trip it.`,
  };
}
