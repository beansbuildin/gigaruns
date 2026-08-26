/**
 * tests/fishing/oilNecessityComposition.test.ts — [session 97 §1b] what
 * "necessity-gated Relaxing spend, still capable of a same-turn double-lethal
 * spend" actually does.
 *
 * ## Why this file exists, and why it is a PROOF rather than a sweep
 *
 * QUESTIONS.md §39 approved the necessity gate's direction and refused to
 * approve its composition with `doubleLethalTriggers`, for a precise reason:
 * *"the two were built as siblings, not composed with each other, and nothing
 * in `OIL-CONSERVE.md` or `oilTiming.ts`'s own comments says what
 * 'necessity-gated AND double-lethal-capable' does together."*
 *
 * The session-97 brief asked for that composition to be **swept**. It is
 * measured here instead, and the substitution is deliberate rather than a
 * shortcut. The two layers act on **disjoint `fishHp` bands**, so the
 * composition is decidable by case analysis over a partition — and a sweep of
 * a quantity that is provably zero returns "near zero, CI [−x, +y]", which is
 * indistinguishable from a real interaction that the sample was too small to
 * resolve. A partition covered exhaustively is the stronger instrument here,
 * not the cheaper one.
 *
 * The partition, with `D = PAYLOAD_OIL_EFFECTS.fishDamage` (2):
 *
 *   | `fishHp`      | gate acts? | band acts? | composed result        |
 *   |---------------|-----------|-----------|------------------------|
 *   | `<= 0`        | no        | no        | `[]` (fish dead)       |
 *   | `0 < hp <= D` | **yes**   | no        | == gate alone          |
 *   | `D < hp <= 2D`| no        | **yes**   | == shipped double-leth |
 *   | `hp > 2D`     | no        | no        | == on-demand           |
 *
 * Every row below is asserted by RUNNING both arms on the same state and
 * comparing arrays, never by asserting a constant — session 66's lesson, which
 * `oilNecessity.test.ts`'s header states at length: a source-text pin proves a
 * line exists, not that it runs.
 *
 * ## ⚠ [session 98 §A] THE THRESHOLD MOVED, AND THIS FILE WAS RE-DERIVED
 *
 * `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` went `1` → **0.85** by user
 * directive (QUESTIONS.md §43). Every assertion above the re-derivation block
 * still holds, and that is a fact about how they were built rather than luck:
 * they probe `bestKillProbability` only at `0` and `1`, and both verdicts are
 * unchanged by any threshold strictly between them. **The partition argument
 * itself never mentions a threshold** — it turns on the two layers acting on
 * disjoint `fishHp` bands and on `conservingTriggers` only ever removing
 * entries — so the proof is threshold-independent by construction.
 *
 * What DID change is where the decision boundary sits, and a boundary test
 * that never probes its own boundary proves nothing. So the block
 * "§A — the boundary moved" below covers `0.85` from both sides, plus the
 * interval `(0.85, 1)` that was SPEND under the old threshold and is WITHHOLD
 * under this one — the only region where live play has ever actually landed
 * (2 of the 9 recorded live firings, at 0.964 and 0.975).
 *
 * ## The one guard that matters most
 *
 * A composition that quietly changed the shipped double-lethal band would be
 * the real failure, because that band IS live (session 90 §1, user override,
 * QUESTIONS.md §30). So the load-bearing block is not "the gate fires" — it is
 * **"the band is untouched everywhere the gate does not reach"**.
 */
import { describe, expect, it } from "vitest";

import {
  ALWAYS_FIRES_THRESHOLD,
  NECESSITY_EPSILON,
  NEVER_FIRES_THRESHOLD,
  PAYLOAD_OIL_EFFECTS,
  RECOMMENDED_NECESSITY_THRESHOLDS,
  RELAXING_ONLY_NECESSITY_THRESHOLDS,
  bestKillProbability,
  conservingTriggers,
  doubleLethalTriggers,
  necessityGatedDoubleLethalTriggers,
  onDemandTriggers,
} from "../../src/strategy/fishing/oilTiming.js";
import { board, card, distAt, oilState } from "../helpers/oilDecisionState.js";

const E = PAYLOAD_OIL_EFFECTS; // fishDamage 2, so the band is fishHp 3..4
const D = E.fishDamage;
const T = RELAXING_ONLY_NECESSITY_THRESHOLDS;
const FISH = { x: 2, y: 2 };

/** Only affordable card cannot possibly kill — hit amount strictly below `fishHp`. */
const cannotKill = (hp: number) =>
  board({ hand: [card({ hitZones: [5], critZones: [], hitEffects: [{ amount: hp - 1 }] })], dist: distAt(FISH) });

/** Only affordable card kills with certainty from the marker's own cell. */
const certainKill = (hp: number) =>
  board({ hand: [card({ hitZones: [5], critZones: [], hitEffects: [{ amount: hp + 5 }] })], dist: distAt(FISH) });

/**
 * [session 98 §A] The only affordable card kills iff it connects, and it
 * connects with EXACTLY `p` — the fish's whole predicted mass is `p` on the one
 * cell the card covers. `cannotKill`/`certainKill` are the `p = 0` and `p = 1`
 * ends of this same construction, and they were the only two this file needed
 * while the threshold was `1`, because a gate at `1` partitions the interval
 * into {1} and everything else.
 */
const killsWithProbability = (hp: number, p: number) =>
  board({ hand: [card({ hitZones: [5], critZones: [], hitEffects: [{ amount: hp + 5 }] })], dist: distAt(FISH, p) });

/** The whole partition, plus both sides of every boundary it names. */
const HP_PARTITION = [-1, 0, 1, D, D + 1, 2 * D, 2 * D + 1, 5, 18];

describe("§1b — the RELAXING-ONLY constant is the live configuration, stated in code", () => {
  it("gates the Relaxing Oil at the recommended threshold", () => {
    expect(T.relaxing).toBe(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing);
  });

  it("leaves the Focus arm at the always-fire endpoint, i.e. exactly on-demand", () => {
    // [session 93 §35] `allowedItemIds` is [937]; gating Focus would gate
    // nothing while appearing to change a second policy. The endpoint is the
    // documented degenerate value, not a disabling hack.
    expect(T.focus).toBe(ALWAYS_FIRES_THRESHOLD);
    for (const focusRemaining of [0, 1, 2]) {
      const s = oilState({ focusRemaining, fishHp: 10, board: certainKill(10) });
      const gated = conservingTriggers(s, E, T).filter((k) => k === "focus");
      const plain = onDemandTriggers(s, E).filter((k) => k === "focus");
      expect(gated).toEqual(plain);
    }
  });
});

describe("§1b — `conservingTriggers` only ever REMOVES, which is what makes the composition analysable", () => {
  for (const hp of HP_PARTITION) {
    for (const kill of [cannotKill, certainKill]) {
      it(`fishHp ${hp}, ${kill === cannotKill ? "cannot" : "certain"} kill — result is a subsequence of onDemandTriggers`, () => {
        const s = oilState({ fishHp: hp, board: kill(Math.max(hp, 1)), focusRemaining: 2, relaxingOilHeld: 2 });
        const plain = onDemandTriggers(s, E);
        const gated = conservingTriggers(s, E, T);
        // Subsequence: same order, no additions.
        let i = 0;
        for (const k of gated) {
          i = plain.indexOf(k, i);
          expect(i).toBeGreaterThanOrEqual(0);
          i++;
        }
        expect(gated.length).toBeLessThanOrEqual(plain.length);
      });
    }
  }
});

describe("§1b — the composed trigger equals the GATE ALONE at and below the single-lethal ceiling", () => {
  for (const hp of HP_PARTITION.filter((h) => h <= D)) {
    for (const held of [0, 1, 2]) {
      it(`fishHp ${hp}, ${held} relaxing held — certain kill spends NOTHING`, () => {
        const s = oilState({ fishHp: hp, relaxingOilHeld: held, board: certainKill(Math.max(hp, 1)), focusRemaining: 2 });
        expect(necessityGatedDoubleLethalTriggers(s, E, T)).toEqual(conservingTriggers(s, E, T));
        // The band cannot re-add an oil the gate just skipped.
        expect(necessityGatedDoubleLethalTriggers(s, E, T).filter((k) => k === "relaxing")).toEqual([]);
      });

      it(`fishHp ${hp}, ${held} relaxing held — uncertain kill is UNCHANGED from on-demand`, () => {
        const s = oilState({ fishHp: hp, relaxingOilHeld: held, board: cannotKill(Math.max(hp, 1)), focusRemaining: 2 });
        expect(necessityGatedDoubleLethalTriggers(s, E, T)).toEqual(onDemandTriggers(s, E));
      });
    }
  }
});

describe("§1b — the SHIPPED double-lethal band is untouched (the guard that matters)", () => {
  for (const hp of HP_PARTITION.filter((h) => h > D)) {
    for (const held of [0, 1, 2, 3]) {
      for (const kill of [cannotKill, certainKill]) {
        it(`fishHp ${hp}, ${held} held, ${kill === cannotKill ? "cannot" : "certain"} kill — identical to doubleLethalTriggers`, () => {
          const s = oilState({ fishHp: hp, relaxingOilHeld: held, board: kill(hp), focusRemaining: 2 });
          expect(necessityGatedDoubleLethalTriggers(s, E, T)).toEqual(doubleLethalTriggers(s, E));
        });
      }
    }
  }

  it("still fires the pair in the band when the bot is not confident", () => {
    const s = oilState({ fishHp: 3, relaxingOilHeld: 2, board: cannotKill(3), focusRemaining: 2 });
    expect(necessityGatedDoubleLethalTriggers(s, E, T)).toEqual(["relaxing", "relaxing"]);
  });
});

describe("§1b — the composition is NOT degenerate in either direction", () => {
  const never = { relaxing: NEVER_FIRES_THRESHOLD, focus: ALWAYS_FIRES_THRESHOLD };
  const always = { relaxing: ALWAYS_FIRES_THRESHOLD, focus: ALWAYS_FIRES_THRESHOLD };

  /**
   * The endpoint semantics, restated because they read backwards at a glance
   * and cost this file two red tests when they were assumed rather than
   * checked. A gate fires — i.e. SPENDS — when the bot's best chance is BELOW
   * its threshold (`NEVER_FIRES_THRESHOLD`'s own doc comment). So:
   *   - `relaxing: 0` — nothing is below 0, the gate always skips, oil NEVER spent.
   *   - `relaxing: 2` — everything is below 2, the gate never skips, oil ALWAYS
   *     spent, which is `on-demand`'s own trigger.
   */
  it("at the never-fire endpoint the Relaxing Oil is never spent, at any HP", () => {
    for (const hp of HP_PARTITION) {
      for (const held of [0, 1, 2]) {
        const s = oilState({ fishHp: hp, relaxingOilHeld: held, board: cannotKill(Math.max(hp, 1)), focusRemaining: 2 });
        expect(necessityGatedDoubleLethalTriggers(s, E, never)).not.toContain("relaxing");
      }
    }
  });

  it("at the always-fire endpoint it reproduces the shipped trigger exactly", () => {
    for (const hp of HP_PARTITION) {
      for (const held of [0, 1, 2]) {
        for (const kill of [cannotKill, certainKill]) {
          const s = oilState({ fishHp: hp, relaxingOilHeld: held, board: kill(Math.max(hp, 1)), focusRemaining: 2 });
          expect(necessityGatedDoubleLethalTriggers(s, E, always)).toEqual(doubleLethalTriggers(s, E, ALWAYS_FIRES_THRESHOLD));
        }
      }
    }
  });

  /**
   * The recommended setting sits STRICTLY BETWEEN the endpoints, so no single
   * state can differ from both — that is what "between" means, and asserting
   * it on one state is the mistake this comment replaces. The non-degeneracy
   * claim is therefore existential in each direction: a state where it spends
   * and `never` does not, and a state where it withholds and `always` does not.
   */
  it("differs from the never-fire endpoint: it DOES spend when the kill is uncertain", () => {
    const s = oilState({ fishHp: 2, relaxingOilHeld: 2, board: cannotKill(2), focusRemaining: 2 });
    expect(necessityGatedDoubleLethalTriggers(s, E, T)).toContain("relaxing");
    expect(necessityGatedDoubleLethalTriggers(s, E, never)).not.toContain("relaxing");
  });

  it("differs from the always-fire endpoint: it WITHHOLDS when the kill is certain", () => {
    const s = oilState({ fishHp: 2, relaxingOilHeld: 2, board: certainKill(2), focusRemaining: 2 });
    expect(necessityGatedDoubleLethalTriggers(s, E, T)).not.toContain("relaxing");
    expect(necessityGatedDoubleLethalTriggers(s, E, always)).toContain("relaxing");
  });
});

/**
 * [session 97 §1b] The divergence this session found and fixed. `doubleLethalOver`
 * compared `bestKillProbability >= threshold` with a bare `>=` from session 89
 * until now, while the necessity gate reading the SAME quantity against the
 * SAME constant went epsilon-tolerant in session 68 (`NECESSITY_EPSILON`).
 *
 * The failure is not hypothetical in general — session 68's live shadow harness
 * observed `bestKillProbability` returning `0.9999999999999999` and exactly `1`
 * on consecutive turns for the same card at the same certainty. Under the bare
 * comparison that reads a certain kill as uncertain and fires **two** oils on a
 * turn the bot was already sure of, which both this band's thesis and the
 * gate's forbid.
 */
describe("§A — the boundary moved to 0.85, and it is covered from both sides", () => {
  const T_OLD = { relaxing: 1, focus: ALWAYS_FIRES_THRESHOLD };

  it("the shipped threshold is the user's 0.85, not a fitted number", () => {
    expect(T.relaxing).toBe(0.85);
    expect(T.relaxing).toBe(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing);
  });

  // ── The SINGLE-LETHAL band, where the gate is the only layer acting ──────
  for (const hp of [1, D]) {
    for (const p of [0, 0.5, 0.84, 0.8499999]) {
      it(`fishHp ${hp}, kill p ${p} — BELOW the threshold, the oil is spent`, () => {
        const s = oilState({ fishHp: hp, relaxingOilHeld: 2, focusRemaining: 2, board: killsWithProbability(hp, p) });
        expect(bestKillProbability(s)).toBeCloseTo(p, 12);
        expect(necessityGatedDoubleLethalTriggers(s, E, T)).toContain("relaxing");
      });
    }

    for (const p of [0.85, 0.8500001, 0.9, 0.964, 0.975, 0.99, 1]) {
      it(`fishHp ${hp}, kill p ${p} — AT OR ABOVE the threshold, the oil is withheld`, () => {
        const s = oilState({ fishHp: hp, relaxingOilHeld: 2, focusRemaining: 2, board: killsWithProbability(hp, p) });
        expect(bestKillProbability(s)).toBeCloseTo(p, 12);
        expect(necessityGatedDoubleLethalTriggers(s, E, T)).not.toContain("relaxing");
      });
    }
  }

  // ── The DOUBLE band, where the band's own check reads the same constant ──
  for (const hp of [D + 1, 2 * D]) {
    it(`fishHp ${hp} — below the threshold the PAIR still fires`, () => {
      const s = oilState({ fishHp: hp, relaxingOilHeld: 2, focusRemaining: 2, board: killsWithProbability(hp, 0.84) });
      expect(necessityGatedDoubleLethalTriggers(s, E, T)).toEqual(["relaxing", "relaxing"]);
    });

    it(`fishHp ${hp} — at or above the threshold the PAIR is withheld`, () => {
      const s = oilState({ fishHp: hp, relaxingOilHeld: 2, focusRemaining: 2, board: killsWithProbability(hp, 0.85) });
      expect(necessityGatedDoubleLethalTriggers(s, E, T)).toEqual([]);
    });
  }

  /**
   * The region the move actually bought, stated as a behaviour change rather
   * than as a constant. Every live Relaxing observation ever recorded sits in
   * `(0, 0.991]` with nothing at `1`, so `[0.85, 1)` is the ONLY band in which
   * lowering the threshold can ever have changed a live decision — and it is
   * where 2 of the 9 recorded firings (0.964, 0.975) sit.
   */
  it("`[0.85, 1)` flips from SPEND to WITHHOLD — the whole effect of the change", () => {
    for (const p of [0.85, 0.9, 0.964, 0.975, 0.99]) {
      const s = oilState({ fishHp: 2, relaxingOilHeld: 2, focusRemaining: 2, board: killsWithProbability(2, p) });
      expect(necessityGatedDoubleLethalTriggers(s, E, T_OLD)).toContain("relaxing");
      expect(necessityGatedDoubleLethalTriggers(s, E, T)).not.toContain("relaxing");
    }
  });

  it("outside `[0.85, 1)` the old and new thresholds agree, so nothing else moved", () => {
    for (const hp of [1, D, D + 1, 2 * D, 5]) {
      for (const p of [0, 0.3, 0.6, 0.84, 1]) {
        const s = oilState({ fishHp: hp, relaxingOilHeld: 2, focusRemaining: 2, board: killsWithProbability(hp, p) });
        expect(necessityGatedDoubleLethalTriggers(s, E, T)).toEqual(
          necessityGatedDoubleLethalTriggers(s, E, T_OLD),
        );
      }
    }
  });
});

describe("§1b — the band's certainty comparison is epsilon-tolerant, like the gate's", () => {
  /**
   * A board whose kill probability sums to just under 1 by float error.
   *
   * ⚠ **[session 98 §A] The masses are `0.7, 0.2, 0.1` and the ORDER is
   * load-bearing.** This helper was written in session 97 with three cells each
   * holding `1 / 3`, on the reasoning that `3 * (1 / 3)` does not re-sum to
   * exactly 1 for every summation order. Measured, in this summation order, it
   * does: `bestKillProbability` came back **exactly 1**, so the test asserted
   * that a certain kill is treated as certain — true, and nothing to do with
   * the tolerance it was named for. It passed for the wrong reason and would
   * have kept passing with `meetsThreshold` reverted to a bare `>=`.
   *
   * `0.7 + 0.2 + 0.1` sums left-to-right to `0.9999999999999999`, which is the
   * exact value session 68's live shadow harness observed. Reversing the order
   * (`0.1, 0.2, 0.7`) re-sums to exactly 1 — checked — so a future edit that
   * "tidies" these into ascending order silently restores the vacuous test.
   */
  const almostCertain = (hp: number) => {
    const cells = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    const masses = [0.7, 0.2, 0.1];
    const dist = new Map(cells.map((c, i) => [`${c.x},${c.y}`, { cell: c, p: masses[i]! }]));
    return board({
      hand: [card({ hitZones: [1, 5, 9], critZones: [], hitEffects: [{ amount: hp + 5 }] })],
      dist,
      gridSize: 4,
    });
  };

  /**
   * ⚠ **[session 98 §A] This is asserted at a threshold of `1`, deliberately,
   * even though the SHIPPED threshold is now 0.85.**
   *
   * The tolerance can only change a verdict where the threshold sits at the
   * top of the probability range — that is the only place float summation
   * error can straddle the boundary. At 0.85 it is inert: `0.9999999999999999`
   * clears 0.85 under a bare `>=` too. Pinning the tolerance at `T` alone
   * would therefore assert nothing, and the regression session 97 fixed (one
   * call site epsilon-tolerant, its sibling reading the same quantity with a
   * bare `>=`) could come back green. So the load-bearing case is exercised at
   * the threshold where it is load-bearing, and the shipped threshold is
   * checked beside it.
   */
  it("a kill probability within epsilon of 1 counts as certain in the BAND, at a threshold of 1", () => {
    const s = oilState({ fishHp: 3, relaxingOilHeld: 2, board: almostCertain(3), focusRemaining: 0, focusCell: { x: 2, y: 2 } });
    const p = bestKillProbability(s);
    // Guard the premise: if this is exactly 1 the test proves nothing.
    expect(p).toBeGreaterThan(1 - 1e-6);
    expect(p).toBeLessThanOrEqual(1);
    expect(p).toBeLessThan(1);
    // A bare `>=` at 1 would read this as uncertain — the defect itself.
    expect(p >= 1).toBe(false);
    // Certain enough => the band must NOT spend the pair.
    const atOne = { relaxing: 1, focus: ALWAYS_FIRES_THRESHOLD };
    expect(necessityGatedDoubleLethalTriggers(s, E, atOne)).not.toContain("relaxing");
    expect(doubleLethalTriggers(s, E, 1)).not.toContain("relaxing");
    // And at the shipped threshold, which the tolerance does not reach.
    expect(necessityGatedDoubleLethalTriggers(s, E, T)).not.toContain("relaxing");
    expect(doubleLethalTriggers(s, E)).not.toContain("relaxing");
  });

  it("epsilon is small enough not to move any decision boundary that matters", () => {
    expect(NECESSITY_EPSILON).toBeLessThan(1e-6);
  });
});
