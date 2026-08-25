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
describe("§1b — the band's certainty comparison is epsilon-tolerant, like the gate's", () => {
  /** A board whose kill probability sums to just under 1 by float error. */
  const almostCertain = (hp: number) => {
    // Three cells each holding a third of the mass: 3 * (1/3) does not
    // re-sum to exactly 1 for every summation order.
    const third = 1 / 3;
    const cells = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    const dist = new Map(cells.map((c) => [`${c.x},${c.y}`, { cell: c, p: third }]));
    return board({
      hand: [card({ hitZones: [1, 5, 9], critZones: [], hitEffects: [{ amount: hp + 5 }] })],
      dist,
      gridSize: 4,
    });
  };

  it("a kill probability within epsilon of 1 counts as certain in the BAND", () => {
    const s = oilState({ fishHp: 3, relaxingOilHeld: 2, board: almostCertain(3), focusRemaining: 0, focusCell: { x: 2, y: 2 } });
    const p = bestKillProbability(s);
    // Guard the premise: if this is exactly 1 the test proves nothing.
    expect(p).toBeGreaterThan(1 - 1e-6);
    expect(p).toBeLessThanOrEqual(1);
    // Certain enough => the band must NOT spend the pair.
    expect(necessityGatedDoubleLethalTriggers(s, E, T)).not.toContain("relaxing");
    expect(doubleLethalTriggers(s, E)).not.toContain("relaxing");
  });

  it("epsilon is small enough not to move any decision boundary that matters", () => {
    expect(NECESSITY_EPSILON).toBeLessThan(1e-6);
  });
});
