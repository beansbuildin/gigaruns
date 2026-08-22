/**
 * src/strategy/fishing/focusBudget.ts — [session 49, brief §3] the focus-meter
 * SPEND POLICY, replacing the inert `focusReserveWeight` penalty term.
 *
 * Session 48's loss decomposition is the reason this module exists, and it is
 * unambiguous: on 73 real trajectories **80.8% of casts escape by meter-out**
 * at a mean final `focusMeter` of 0.25, **50.4% of all turns (192/381) are
 * played at focus zero**, and 56 of 73 casts empty the meter. The profile by
 * turn is
 *
 *     3.00 → 1.38 → 0.72 → 0.36 → 0.14 → 0.04 → 0.00 → 0.00 → 0.00
 *
 * i.e. **the first move alone spends 1.62 of 3 points.**
 *
 * ── [session 71 §1] THOSE NUMBERS ARE THIS MODULE'S OWN ERA, AND THE FISHERY
 *    HAS MOVED OUT FROM UNDER ITS PREMISE ────────────────────────────────────
 *
 * Session 70 called the figures above stale and recomputed them over the whole
 * 123-trace corpus (64.2% meter-out, opening spend 1.40). **Both readings are
 * wrong in the same way.** The corpus is three policy eras, and the numbers
 * above are exactly the oldest of them — correct for the 73 casts they were
 * computed on, and not a description of the corpus at any other size:
 *
 *     era                        casts  opening  meter-out  catch
 *     pre-logging (session 49)      73     1.62      80.8%   11.0%
 *     retired fixed-0.9 weighting   15     1.67      53.3%   33.3%
 *     TODAY's policy                35     0.83      34.3%   60.0%
 *
 * **This is not a footnote, it is a question about whether the module is still
 * needed.** It was built because meter-out was the dominant loss at 80.8%. On
 * the era the shipped policy actually plays, meter-out is 34.3% and the catch
 * rate is 60.0% — the failure mode is less than half as common and may no
 * longer be the binding constraint at all. The module stays `NO_FOCUS_POLICY`
 * and nothing here is wired live, so no behaviour rests on this; what rests on
 * it is whether the next session should sweep these families at all.
 *
 * Caveats that must travel with the split: n=35 is small, an era is a BUNDLE
 * (zone map, matcher weighting, lures, rod — not one knob), and the era spans
 * the Makeshift/Shroom deck break. See `handoff/reports/session-71-replay-gap.md`
 * and `scripts/focusProfileCheck.ts` §1b, which prints the split on every run.
 *
 * ── [session 72 §4] THE QUESTION ABOVE IS ANSWERED, AND THE ANSWER SPLITS ──
 *
 * **`costCap` is inert because the policy does not need it. That is a FINDING
 * about the fishery, not a measurement failure, and it should not be
 * rebuilt.** Today's policy spends **0.83** of a 3-point meter on the opening
 * move, so `costCap(2)` has nothing to bind on and `focusBudgetSweep.ts`'s
 * `+0/−0` is the correct reading rather than a broken one. The user's
 * opening-turn directive is substantially already satisfied by the shipped
 * policy.
 *
 * **`schedule` is NOT covered by that, and retiring this module on `costCap`'s
 * inertness would throw away the arm that still has a question in it.** Two
 * things hold at once: the opener is gentle (0.83), AND the meter still
 * empties in **34.3%** of casts — including the cast the user watched reach
 * 0/3 by turn 3. `costCap` bounds a SINGLE move. A meter draining across
 * several turns is a CUMULATIVE problem, and `schedule` is the only family
 * here that prices it. If any focus arm is worth a session, it is that one.
 *
 * Recorded in `handoff/DECISIONS.md` 2026-08-21 (session 72). Still nothing
 * wired live; `NO_FOCUS_POLICY` remains the default.
 *
 * Why the penalty term could never fix that (session 48 measured it inert:
 * w=0 and w=3 indistinguishable on 73 traces, w>=4 monotonically worse):
 * `focusReserveWeight` adds a FIXED penalty proportional to budget retained,
 * but the policy's problem is not that it undervalues retention — it is that
 * it has no representation of how many turns remain or what a point will be
 * worth in them. A constant either loses to a real EV gain every turn (small
 * w: inert) or blocks genuinely correct moves (large w: worse). There is no
 * value of a constant that encodes an opportunity cost which changes with the
 * turn index.
 *
 * So this module does not score retention. It emits a per-turn CONSTRAINT on
 * what the placement search is allowed to spend, and `bestFocusForCard`
 * applies it. Three families, cheapest first, per the brief:
 *
 *   - `costCap`   — no non-lethal move may cost more than `cap`. Spreads 3
 *                   points over >= 3 turns and attacks the 1.62-point first
 *                   move directly. Proposed twice before and never run.
 *   - `threshold` — move only if the EV gain over the best STAY-PUT placement
 *                   exceeds `theta`.
 *   - `schedule`  — cumulative spend by turn `t` capped at
 *                   `ceil(meterMax * t / expectedTurns)`, with `expectedTurns`
 *                   from `ceil(fishHp / bestHitEffect)` — the same building
 *                   block `isManaConstrained` already uses.
 *
 * Pure, no I/O, per CLAUDE.md's strategy/API split. Two invariants hold for
 * every policy and both are asserted in `tests/fishing/focusBudget.test.ts`:
 * a cost-0 placement (staying put) is ALWAYS allowed, so the search space can
 * never be emptied; and a LETHAL placement is never blocked, so no schedule
 * can talk the bot out of landing the catch.
 */

/** What the placement search may spend on THIS turn. */
export interface FocusSpendConstraint {
  /**
   * Maximum Manhattan move cost for a NON-LETHAL placement. Always >= 0, so
   * staying put survives every policy.
   */
  maxMoveCost: number;
  /**
   * Minimum EV advantage over the best stay-put placement required before a
   * non-lethal move is taken at all. 0 disables it.
   */
  moveEvThreshold: number;
}

/** The pre-session-49 behavior: spend whatever the meter allows, whenever EV says so. */
export const UNCONSTRAINED: FocusSpendConstraint = {
  maxMoveCost: Number.POSITIVE_INFINITY,
  moveEvThreshold: 0,
};

export type FocusBudgetPolicy =
  | { kind: "none" }
  | { kind: "costCap"; cap: number }
  | { kind: "threshold"; theta: number }
  | { kind: "schedule"; expectedTurns?: number };

export const NO_FOCUS_POLICY: FocusBudgetPolicy = { kind: "none" };

/** Everything a policy needs about where the cast currently stands. */
export interface FocusSpendContext {
  /** 0-based turn index within the cast. */
  turn: number;
  /** Points already spent off the meter this cast. */
  spent: number;
  /** The meter's full value — `FOCUS_METER_MAX` in every capture so far. */
  meterMax: number;
  /** Points still on the meter. */
  remaining: number;
  /** The fish's current HP, for the schedule's horizon estimate. */
  fishHp: number;
  /** The best single-hit amount available in hand, for the same estimate. */
  bestHitEffect: number;
}

/**
 * How many turns this cast plausibly still has to run — the horizon the
 * schedule spreads the meter over.
 *
 * `ceil(fishHp / bestHitEffect)` is the optimistic count (every shot lands),
 * which is the same estimator `isManaConstrained` uses, deliberately: two
 * places in the strategy layer asking "how long until this fish is caught?"
 * should not answer it two different ways. Optimistic is the conservative
 * direction HERE — it under-states the horizon, so the schedule permits
 * spending FASTER, and the policy is less likely to strand the bot behind a
 * cap it did not need.
 */
export function expectedRemainingTurns(fishHp: number, bestHitEffect: number): number {
  if (bestHitEffect <= 0 || fishHp <= 0) return 1;
  return Math.max(1, Math.ceil(fishHp / bestHitEffect));
}

/** The per-turn constraint a policy imposes given where the cast stands. */
export function spendConstraint(policy: FocusBudgetPolicy, ctx: FocusSpendContext): FocusSpendConstraint {
  switch (policy.kind) {
    case "none":
      return UNCONSTRAINED;

    case "costCap":
      return { maxMoveCost: Math.max(0, policy.cap), moveEvThreshold: 0 };

    case "threshold":
      return { maxMoveCost: Number.POSITIVE_INFINITY, moveEvThreshold: Math.max(0, policy.theta) };

    case "schedule": {
      const horizon = policy.expectedTurns ?? expectedRemainingTurns(ctx.fishHp, ctx.bestHitEffect);
      // Cumulative allowance by the END of turn `t` (0-based), so turn 0 gets
      // one instalment rather than nothing — a cap of 0 on the opening turn
      // would freeze the bobber wherever it started, which is a different
      // policy (and a worse one) than spreading the meter.
      const allowedByNow = Math.ceil((ctx.meterMax * (ctx.turn + 1)) / Math.max(1, horizon));
      return { maxMoveCost: Math.max(0, allowedByNow - ctx.spent), moveEvThreshold: 0 };
    }
  }
}

/** Human-readable label for a policy, for sweep output and logs. */
export function describePolicy(policy: FocusBudgetPolicy): string {
  switch (policy.kind) {
    case "none":
      return "none (shipped)";
    case "costCap":
      return `costCap(${policy.cap})`;
    case "threshold":
      return `threshold(${policy.theta})`;
    case "schedule":
      return `schedule(${policy.expectedTurns ?? "ceil(fishHp/bestHit)"})`;
  }
}
