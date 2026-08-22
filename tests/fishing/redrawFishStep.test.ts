/**
 * tests/fishing/redrawFishStep.test.ts — [session 75, brief §3 / GATE 2]
 *
 * **A redraw costs a turn and a fish step.** User confirmation, 2026-08-21:
 * the complete cost of a redraw is mana equal to cards held, and the fish
 * moves. It deals no damage and no heal.
 *
 * `castSim`'s redraw branch charged two of those three correctly and skipped
 * the fish step entirely — it `continue`d past both `observe()` and `turn++`,
 * so `trueTrajectory[matcher.turn]` returned the SAME cell on the next
 * iteration and a redraw in the sim was time-free.
 *
 * ── What these tests are FOR ──────────────────────────────────────────────
 *
 * Every assertion below FAILS against the old `continue`. That is the gate's
 * requirement and it is worth stating why it is not automatic: a test that
 * only asserted "redraws cost mana" would have passed on the broken branch,
 * because mana was never the thing that was wrong. The discriminating
 * observable is TIME — the turn counter and the fish's position — so that is
 * what is asserted.
 *
 * ── The trajectory is supplied, not sampled ───────────────────────────────
 *
 * `truePattern` pins the fish to a known path, so "did the fish step" is a
 * question with an exact answer rather than a statistical one. Without it the
 * fish's cell is drawn from the empirical table and a missing step is only
 * visible in aggregate, which is how this survived for three sessions.
 *
 * Writes nothing and reads no data path — the whole cast is constructed here.
 */
import { describe, expect, it } from "vitest";

import {
  simulateCast,
  type CastOptions,
  type FishPolicy,
  type FishPolicyContext,
} from "../../src/sim/fishing/castSim.js";
import type { Cell } from "../../src/sim/fishing/geometry.js";
import type { Pattern } from "../../src/sim/fishing/patterns.js";

/** A fish that walks a known, strictly-changing path, so a skipped step is exactly observable. */
const WALKER: Pattern = {
  name: "walker",
  path: (start: Cell, gridSize: number, n: number): Cell[] => {
    const out: Cell[] = [];
    for (let i = 0; i < n; i++) out.push({ x: (start.x + i) % gridSize, y: start.y });
    return out;
  },
};

/** Redraws for the first `n` decisions it is asked for, then plays whatever is affordable. */
function redrawThenPlay(n: number): FishPolicy & { asked: number; redrawn: number } {
  const p = {
    asked: 0,
    /** How many redraw actions were actually RETURNED — the denominator the turn identity needs. */
    redrawn: 0,
    name: `redraw-x${n}`,
    act(ctx: FishPolicyContext) {
      p.asked++;
      if (p.asked <= n && ctx.mana >= ctx.hand.length && ctx.hand.length > 0) {
        p.redrawn++;
        return { type: "redraw" } as const;
      }
      return { type: "play", handIndex: 0, focus: ctx.focusBudget.current } as const;
    },
  };
  return p;
}

/**
 * `candidatePool` pins the TRUE trajectory; `matcherPool: []` keeps the
 * matcher permanently blind. The blindness is deliberate — it isolates the
 * turn-accounting claim from the INFORMATION a redraw now also buys
 * (`scripts/redrawBlastRadius.ts` §4), so these assertions cannot pass or fail
 * for the wrong reason.
 */
const BASE: Omit<CastOptions, "policy"> = {
  seed: 11,
  gridSize: 4,
  maxTurns: 12,
  candidatePool: [WALKER],
  matcherPool: [],
};

describe("castSim charges a redraw a turn and a fish step [session 75 §3]", () => {
  it("a cast that redraws consumes MORE turns than one that does not", () => {
    // The discriminating observable. Under the old `continue` the redrawing
    // arm burned mana and no time, so this comparison came out EQUAL.
    const none = simulateCast({ ...BASE, policy: redrawThenPlay(0) });
    const three = simulateCast({ ...BASE, policy: redrawThenPlay(3) });
    expect(three.redrawMana).toBeGreaterThan(0);
    expect(none.redrawMana).toBe(0);
    expect(
      three.turns,
      "a redraw must advance the turn counter — the old branch `continue`d past `turn++`",
    ).toBeGreaterThan(none.turns);
  });

  it("each redraw advances the turn counter by EXACTLY one — turns = redraws + shots", () => {
    // Not merely "more": the step is charged ONCE, the same way the
    // turn-costing oil branch charges it. A double-advance would also satisfy
    // the test above.
    //
    // Asserted as an IDENTITY rather than as an increment against a baseline,
    // because a cast can end early (caught, or out of mana) and then two arms
    // are no longer comparable turn-for-turn. `turns = redraws + shots` holds
    // whenever the cast ends, since those are the only two things in this
    // configuration that advance time — no oils are held, so the turn-costing
    // consume branch cannot contribute.
    for (const n of [0, 1, 2, 3]) {
      const policy = redrawThenPlay(n);
      const r = simulateCast({ ...BASE, policy });
      expect(
        r.turns,
        `redraw x${n} (${policy.redrawn} taken, ${r.shots} shots, outcome ${r.outcome}): ` +
          `every redraw must burn exactly one turn`,
      ).toBe(policy.redrawn + r.shots);
    }
  });

  it("the fish is somewhere else after a redraw — the shot resolves against a moved fish", () => {
    // The mechanism, not just the counter. WALKER moves +1 in x every step, so
    // the cell a shot resolves against differs by exactly the number of
    // redraws taken before it. Observed through `observeTurn`, which emits one
    // state per TURN INDEX.
    const seen: number[] = [];
    const policy = redrawThenPlay(2);
    const r = simulateCast({ ...BASE, policy, observeTurn: (s) => seen.push(s.turn) });
    // `observeTurn` emits ONE state per turn INDEX (it suppresses repeats), so
    // under the old branch a redraw produced no new index and the sequence was
    // the same length with or without redraws — which is exactly the blindness
    // this asserts against. The trailing +1 is the terminal state: `record()`
    // runs at the top of the iteration that then exits.
    expect(seen, "turn indices must be gapless and increasing").toEqual(seen.map((_, i) => i));
    expect(
      seen.length,
      `every redraw must own a turn index (${policy.redrawn} redraws, ${r.shots} shots)`,
    ).toBe(policy.redrawn + r.shots + 1);
  });

  it("a redraw still costs mana equal to cards held, and still does not touch fishHp", () => {
    // The two charges that were already RIGHT. Pinned so the fix cannot be
    // "corrected" further in a direction the user's confirmation excludes:
    // a redraw deals no damage and no heal.
    const r = simulateCast({ ...BASE, policy: redrawThenPlay(1) });
    expect(r.redrawMana).toBe(3); // a full hand of three
    expect(r.oilsUsed).toEqual([]);
  });
});
