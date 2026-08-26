/**
 * tests/fishing/oilNecessity.test.ts — [session 67 §1c / gate 1] the necessity
 * gate's definition, pinned against the two ways it can quietly stop being a
 * gate.
 *
 * ## What this file is guarding against, stated before the assertions
 *
 * The user's directive — *"if the autofisher believes it can catch the fish
 * without oil, don't use the oil"* — is a sentence, and a sentence has two
 * degenerate implementations that both LOOK like a gate:
 *
 *   - **always-fire.** Read "believes it can catch" strictly enough (can a
 *     card GUARANTEE it?) and the answer is almost never yes, so the gate
 *     passes everything through and the policy is `on-demand` with extra
 *     steps.
 *   - **never-fire.** Read it loosely enough (could a card conceivably kill
 *     it?) and the answer is almost always yes, so the gate blocks everything
 *     and the oils are never spent at all.
 *
 * Both are reachable in this code by moving one number, which is deliberate:
 * it means the anti-degeneracy assertions can be written as *"the recommended
 * setting behaves differently from BOTH endpoints"* rather than as a number
 * somebody eyeballed.
 *
 * ## And why the load-bearing assertions here are BEHAVIOURAL
 *
 * Session 66's lesson, carried forward by the session-67 brief: a source-text
 * pin proves a line exists, not that it runs — the tripwire's populate-side
 * assertions still passed with the tripwire branch dead, because the call
 * remained textually present in it. So the endpoint claims below are made by
 * RUNNING casts and counting oils, not by asserting a constant. A hand-picked
 * pair of states would prove the branch is reachable; it would not prove the
 * gate discriminates in play, which is the thing that can rot.
 */
import { describe, expect, it } from "vitest";

import {
  ALWAYS_FIRES_THRESHOLD,
  NEVER_FIRES_THRESHOLD,
  RECOMMENDED_NECESSITY_THRESHOLDS,
  bestConnectProbabilityFromFrozenCell,
  bestKillProbability,
  conserving,
  conservingOil,
  neverOil,
  onDemand,
  onDemandTriggers,
  PAYLOAD_OIL_EFFECTS,
  MEASURED_CONSUME_COSTS_TURN,
  NECESSITY_EPSILON,
  meetsThreshold,
  type OilTimingPolicy,
} from "../../src/strategy/fishing/oilTiming.js";
import { matcherFishPolicy, simulateCast, type FishPolicyContext } from "../../src/sim/fishing/castSim.js";
import { board, card, distAt, oilState, GRID } from "../helpers/oilDecisionState.js";

const E = PAYLOAD_OIL_EFFECTS;
const CASTS = 2000;

/** Oils spent by `p` over a fixed, seeded block of casts. The one instrument every behavioural claim below reads. */
function oilsOver(p: OilTimingPolicy, casts = CASTS): { oils: number; caught: number } {
  let oils = 0;
  let caught = 0;
  for (let i = 0; i < casts; i++) {
    const r = simulateCast({
      policy: matcherFishPolicy,
      seed: 1 + i,
      oils: {
        policy: p,
        costsTurn: MEASURED_CONSUME_COSTS_TURN,
        effects: E,
        focusOilHeld: 1,
        relaxingOilHeld: 1,
      },
    });
    oils += r.oilsUsed.length;
    if (r.outcome === "caught") caught++;
  }
  return { oils, caught };
}

describe("the dial's endpoints are real behaviours the same code produces", () => {
  it("at NEVER_FIRES_THRESHOLD on both oils, the policy is indistinguishable from `never` over 2000 casts", () => {
    const gated = oilsOver(conservingOil({ relaxing: NEVER_FIRES_THRESHOLD, focus: NEVER_FIRES_THRESHOLD }));
    const control = oilsOver(neverOil);
    expect(gated.oils).toBe(0);
    expect(gated.caught).toBe(control.caught);
  });

  it("at ALWAYS_FIRES_THRESHOLD on both oils, the policy is indistinguishable from `on-demand` over 2000 casts", () => {
    const gated = oilsOver(conservingOil({ relaxing: ALWAYS_FIRES_THRESHOLD, focus: ALWAYS_FIRES_THRESHOLD }));
    const ungated = oilsOver(onDemand);
    expect(gated.oils).toBe(ungated.oils);
    expect(gated.caught).toBe(ungated.caught);
  });
});

describe("THE ANTI-DEGENERACY PIN — the recommended gate is strictly between both endpoints", () => {
  // This is the assertion the brief asked for. It fails if anyone tunes,
  // refactors or short-circuits the gate into either endpoint, and it fails
  // for a reason a reader can act on rather than "a number changed".
  const gated = oilsOver(conserving);
  const ungated = oilsOver(onDemand);

  it("spends STRICTLY FEWER oils than on-demand — so it has not degenerated to always-fire", () => {
    expect(gated.oils).toBeLessThan(ungated.oils);
  });

  it("spends STRICTLY MORE than zero — so it has not degenerated to never-fire", () => {
    expect(gated.oils).toBeGreaterThan(0);
  });

  it("the saving is material, not a rounding artifact — at least 10% of on-demand's oil bill", () => {
    // Deliberately a loose floor. The measured saving is ~32%; asserting the
    // measured value would fail on any harmless retune and teach nothing. What
    // must not silently happen is the gate becoming a no-op that still passes
    // the strict-inequality tests above on a handful of casts.
    expect((ungated.oils - gated.oils) / ungated.oils).toBeGreaterThan(0.1);
  });

  it("does NOT pay for the saving in fish — it catches at least as many as on-demand", () => {
    // The measured result is that it catches MORE (the Focus Oil is deferred
    // to a turn where the frozen cell genuinely cannot reach), but the claim
    // worth pinning is the weaker, more durable one: conserving oil is not
    // bought with catches.
    expect(gated.caught).toBeGreaterThanOrEqual(ungated.caught);
  });
});

describe("the gate narrows on-demand's triggers and never moves them", () => {
  it("every oil the gate spends is one on-demand would also have spent, at the same moment", () => {
    // The directive is about spending fewer oils at the same moments, not
    // about new moments. If a future edit lets the gate fire somewhere
    // on-demand would not, the two changes are confounded and neither can be
    // attributed — so it is pinned rather than trusted.
    for (const fishHp of [0, 1, 2, 3, 8, 20]) {
      for (const focusRemaining of [0, 1, 3]) {
        const s = oilState({ fishHp, focusRemaining, board: board({ dist: distAt({ x: 1, y: 1 }) }) });
        const wanted = new Set(onDemandTriggers(s, E));
        for (const k of conserving.decide(s, E)) expect(wanted.has(k)).toBe(true);
      }
    }
  });
});

describe("bestKillProbability — what 'can catch it without the oil' actually reads", () => {
  it("counts a card only if the damage it deals is enough to finish the fish", () => {
    const fish = { x: 3, y: 3 };
    const s = oilState({
      fishHp: 4,
      focusRemaining: 3,
      focusCell: { x: 3, y: 3 },
      board: board({ dist: distAt(fish), hand: [card({ hitZones: [5], hitEffects: [{ amount: 3 }], critZones: [] })] }),
    });
    // Zone 5 is the focus cell itself on the 3x3 offset grid, so this card
    // certainly connects — and still cannot kill a 4 HP fish with 3 damage.
    expect(bestKillProbability({ ...s, fishHp: 3 })).toBe(1);
    expect(bestKillProbability(s)).toBe(0);
  });

  it("IGNORES a card the bot cannot afford — an unplayable card is not a reason to withhold the oil", () => {
    const fish = { x: 2, y: 2 };
    const lethal = card({ manaCost: 9, hitZones: [5], hitEffects: [{ amount: 99 }], critZones: [] });
    const s = oilState({ fishHp: 2, mana: 3, focusCell: fish, board: board({ dist: distAt(fish), hand: [lethal] }) });
    expect(bestKillProbability(s)).toBe(0);
    expect(bestKillProbability({ ...s, mana: 9 })).toBe(1);
  });
});

describe("bestConnectProbabilityFromFrozenCell — the Focus Oil's necessity is a DIFFERENT question", () => {
  it("is evaluated only from the frozen cell, never from a cell the exhausted meter cannot reach", () => {
    const near = { x: 1, y: 1 };
    const far = { x: GRID, y: GRID };
    const hand = [card({ hitZones: [5], critZones: [] })];
    // Marker frozen on `near`; the fish is certainly on `far`. Zone 5 covers
    // the marker's own cell, so from `near` the card cannot connect at all.
    const s = oilState({ focusRemaining: 0, focusCell: near, board: board({ dist: distAt(far), hand }) });
    expect(bestConnectProbabilityFromFrozenCell(s)).toBe(0);
    // Move the marker onto the fish and the same hand connects with certainty
    // — proving the zero above is about the CELL, not about the card.
    expect(bestConnectProbabilityFromFrozenCell({ ...s, focusCell: far })).toBe(1);
  });
});

describe("MANA FIRST — structural, not aspirational", () => {
  it("the card policy is handed no oil state of any kind, so it cannot hold mana back for an oil", () => {
    // The directive ranks mana ahead of oils and the brief asked for a check
    // that the gate does not induce the bot to save mana in anticipation of
    // one. It cannot: the oil decision is taken before `policy.act`, and the
    // context `policy.act` receives mentions no oil. Asserting the CONTEXT'S
    // OWN KEY SET is the check — a future field named `oilPending` would fail
    // here the moment it were added, which a prose paragraph would not.
    let seen: string[] = [];
    const probe = {
      name: "probe",
      act(ctx: FishPolicyContext, rng: Parameters<typeof matcherFishPolicy.act>[1]) {
        seen = Object.keys(ctx).sort();
        return matcherFishPolicy.act(ctx, rng);
      },
    };
    simulateCast({
      policy: probe,
      seed: 7,
      oils: { policy: conserving, costsTurn: MEASURED_CONSUME_COSTS_TURN, effects: E, focusOilHeld: 1, relaxingOilHeld: 1 },
    });
    expect(seen).toEqual(["dist", "fishHp", "focusBudget", "gridSize", "hand", "mana"]);
    for (const k of seen) expect(k.toLowerCase()).not.toContain("oil");
  });
});

describe("the recommendation carries no fitted constant", () => {
  /**
   * ⚠ **[session 98 §A] `relaxing` is 0.85, and it is still not a fitted
   * number — it is the USER's, QUESTIONS.md §43, 2026-08-25.**
   *
   * The assertion's job never was "the value is 1". It is *"no agent quietly
   * tuned this"*, and that job is unchanged: any future edit to either number
   * fails here and has to point at a user directive recorded in QUESTIONS.md,
   * exactly as this one does. Session 97 measured the gate a live no-op at `1`
   * (24 evaluations, 0 held, max 0.991) and escalated rather than picking a
   * replacement, which is the behaviour this test exists to force.
   *
   * `focus` stays `1` because nothing was asked about it and nothing live
   * bears on it — `allowedItemIds` is `[937]`, so the Focus Oil is not
   * spendable at all, and the shipped constant overrides that arm to
   * `ALWAYS_FIRES_THRESHOLD` regardless.
   */
  it("the thresholds are exactly the two the user set — no agent-fitted constant", () => {
    expect(RECOMMENDED_NECESSITY_THRESHOLDS).toEqual({ relaxing: 0.85, focus: 1 });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// [session 68 §1] The float defect the live shadow harness found.
// ───────────────────────────────────────────────────────────────────────────

describe("a CERTAIN outcome that arrives as 0.9999999999999999 is still certain", () => {
  /**
   * **Found by running the gate against the live loop, not by reading it.**
   *
   * Session 68's shadow harness put a full-template card on a board it covers
   * entirely, so a hit is certain by construction. `bestKillProbability`
   * returned `0.9999999999999999` on one turn and exactly `1` on the next —
   * same card, same certainty, different summation order over the
   * distribution. Under a bare `>=` the gate FIRED on the first and skipped on
   * the second, i.e. its behaviour on a certain kill was decided by float
   * representation.
   *
   * This is a correctness pin, not a threshold tune: see `NECESSITY_EPSILON`.
   */
  it("meetsThreshold accepts the float that a bare >= rejects", () => {
    const almost = 0.9999999999999999;
    // The premise: this really is the value a certain outcome can arrive as,
    // and a bare comparison really does reject it. If either stops holding the
    // pin below is testing nothing.
    expect(almost < 1).toBe(true);
    expect(meetsThreshold(almost, 1)).toBe(true);
  });

  it("the conserving gate SKIPS on a certain kill that sums to 0.9999999999999999", () => {
    // Built by summing mass that cannot be represented exactly, rather than by
    // writing the literal — the defect is a property of summation, so the test
    // reproduces the summation.
    const parts = [0.7, 0.1, 0.1, 0.1];
    const total = parts.reduce((a, b) => a + b, 0);
    expect(total).not.toBe(1);
    expect(meetsThreshold(total, 1)).toBe(true);

    // A fish at exactly the oil's damage fires the lethal trigger, and a card
    // that kills across the whole distribution makes the oil unnecessary.
    const cells = [
      { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 2 },
    ];
    const dist = new Map(
      cells.map((c, i) => [`${c.x},${c.y}`, { cell: c, p: parts[i]! }]),
    );
    const s = oilState({
      fishHp: E.fishDamage,
      focusRemaining: 0,
      focusCell: { x: 2, y: 2 },
      board: board({
        // A 3x3 template centred at [2,2] covers all four cells above.
        hand: [card({ hitZones: [1, 2, 3, 4, 5, 6, 7, 8, 9], hitEffects: [{ amount: 9 }] })],
        dist,
        gridSize: GRID,
      }),
    });
    expect(onDemandTriggers(s, E)).toContain("relaxing");
    expect(bestKillProbability(s)).toBeCloseTo(1, 12);
    // [session 98 §A] Pinned at a threshold of `1` EXPLICITLY, because that is
    // the only threshold at which the tolerance decides anything. The shipped
    // `conserving` now sits at 0.85 (QUESTIONS.md §43), where this sum clears
    // the bar under a bare `>=` too — so asserting only on `conserving` would
    // leave the session-68 defect free to come back green.
    expect(conservingOil({ relaxing: 1, focus: 1 }).decide(s, E)).not.toContain("relaxing");
    expect(conserving.decide(s, E)).not.toContain("relaxing");
  });

  it("the epsilon cannot rescue the degenerate endpoints — they still degenerate", () => {
    // `never` must stay never and `always` must stay always; an epsilon big
    // enough to disturb either would be a tune wearing a fix's clothes.
    expect(meetsThreshold(0, NEVER_FIRES_THRESHOLD)).toBe(true);
    expect(meetsThreshold(1, ALWAYS_FIRES_THRESHOLD)).toBe(false);
    expect(NECESSITY_EPSILON).toBeLessThan(1e-6);
  });
});
