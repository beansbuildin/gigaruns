/**
 * tests/fishing/focusBudget.test.ts — [session 49, brief §3]
 *
 * The two invariants every focus-spend policy must satisfy, plus the shape of
 * each family. The invariants are the important half: they are what makes it
 * safe to add a policy at all.
 */

import { describe, expect, it } from "vitest";

import { chooseCard, type FishingCardLike, type FocusBudget } from "../../src/strategy/fishing/cardChoice.js";
import {
  UNCONSTRAINED,
  NO_FOCUS_POLICY,
  describePolicy,
  expectedRemainingTurns,
  spendConstraint,
  type FocusBudgetPolicy,
  type FocusSpendContext,
} from "../../src/strategy/fishing/focusBudget.js";
import { cellKey, manhattan, type Cell } from "../../src/sim/fishing/geometry.js";

const GRID = 4;

function ctx(over: Partial<FocusSpendContext> = {}): FocusSpendContext {
  return { turn: 0, spent: 0, meterMax: 3, remaining: 3, fishHp: 10, bestHitEffect: 5, ...over };
}

describe("spendConstraint", () => {
  it("leaves the shipped behavior unconstrained under `none`", () => {
    expect(spendConstraint(NO_FOCUS_POLICY, ctx())).toEqual(UNCONSTRAINED);
  });

  it("costCap emits the cap and no threshold", () => {
    expect(spendConstraint({ kind: "costCap", cap: 1 }, ctx())).toEqual({ maxMoveCost: 1, moveEvThreshold: 0 });
  });

  it("threshold emits the theta and no cap", () => {
    const c = spendConstraint({ kind: "threshold", theta: 0.5 }, ctx());
    expect(c.moveEvThreshold).toBe(0.5);
    expect(c.maxMoveCost).toBe(Number.POSITIVE_INFINITY);
  });

  it("schedule spreads the meter across the horizon and shrinks as spend accumulates", () => {
    const policy: FocusBudgetPolicy = { kind: "schedule", expectedTurns: 3 };
    // turn 0: ceil(3*1/3) = 1 allowed, nothing spent yet.
    expect(spendConstraint(policy, ctx({ turn: 0, spent: 0 })).maxMoveCost).toBe(1);
    // turn 1: ceil(3*2/3) = 2 cumulative, 1 already spent -> 1 more.
    expect(spendConstraint(policy, ctx({ turn: 1, spent: 1 })).maxMoveCost).toBe(1);
    // turn 1 having already overspent: clamped at 0, never negative.
    expect(spendConstraint(policy, ctx({ turn: 1, spent: 3 })).maxMoveCost).toBe(0);
  });

  it("never emits a negative cap, for any policy or context", () => {
    const policies: FocusBudgetPolicy[] = [
      NO_FOCUS_POLICY,
      { kind: "costCap", cap: -5 },
      { kind: "threshold", theta: -1 },
      { kind: "schedule", expectedTurns: 1 },
      { kind: "schedule" },
    ];
    for (const p of policies) {
      for (const turn of [0, 1, 5]) {
        for (const spent of [0, 3, 99]) {
          const c = spendConstraint(p, ctx({ turn, spent }));
          expect(c.maxMoveCost).toBeGreaterThanOrEqual(0);
          expect(c.moveEvThreshold).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("expectedRemainingTurns matches isManaConstrained's estimator and floors at 1", () => {
    expect(expectedRemainingTurns(10, 5)).toBe(2);
    expect(expectedRemainingTurns(11, 5)).toBe(3);
    expect(expectedRemainingTurns(1, 5)).toBe(1);
    expect(expectedRemainingTurns(10, 0)).toBe(1);
  });

  it("describePolicy names every family", () => {
    expect(describePolicy(NO_FOCUS_POLICY)).toContain("none");
    expect(describePolicy({ kind: "costCap", cap: 1 })).toBe("costCap(1)");
    expect(describePolicy({ kind: "threshold", theta: 0.5 })).toBe("threshold(0.5)");
    expect(describePolicy({ kind: "schedule", expectedTurns: 4 })).toBe("schedule(4)");
  });
});

// ── the invariants, exercised through `chooseCard` itself ──────────────────

/** A card whose hit zone is the single cell it is focused on. */
const pointCard: FishingCardLike = {
  id: 1,
  manaCost: 1,
  hitZones: [5], // the focus cell itself under the 3x3 template
  critZones: [],
  hitEffects: [{ amount: 5 }],
  missEffects: [{ amount: -3 }],
  critEffects: [],
};

function certain(cell: Cell) {
  return new Map([[cellKey(cell), { cell, p: 1 }]]);
}

describe("focus-spend invariants, through chooseCard", () => {
  const budget: FocusBudget = { current: { x: 1, y: 1 }, remaining: 3 };

  it("a cost-0 placement always survives, so no policy can empty the search space", () => {
    // The fish is certainly at (2,3) — exactly 3 away from (1,1), i.e. the
    // whole meter. Under costCap(0) the bot must still return a choice.
    const choice = chooseCard(
      [pointCard],
      10,
      certain({ x: 2, y: 3 }),
      GRID,
      1,
      10,
      budget,
      true,
      0,
      { maxMoveCost: 0, moveEvThreshold: 0 },
    );
    expect(choice).not.toBeNull();
    expect(manhattan(budget.current, choice!.focus)).toBe(0);
  });

  it("a LETHAL placement is never blocked by a cap", () => {
    // Same certain fish, but `fishHp` low enough that landing it is the catch.
    const choice = chooseCard(
      [pointCard],
      10,
      certain({ x: 2, y: 3 }),
      GRID,
      1,
      3, // fishHp 3, hitEffect 5 -> lethal
      budget,
      true,
      0,
      { maxMoveCost: 0, moveEvThreshold: 0 },
    );
    expect(choice).not.toBeNull();
    expect(choice!.lethal).toBe(true);
    // Cost 3 — the entire meter — taken anyway, because it lands the catch.
    expect(cellKey(choice!.focus)).toBe(cellKey({ x: 2, y: 3 }));
    expect(manhattan(budget.current, choice!.focus)).toBe(3);
  });

  it("the EV threshold blocks a move that does not clear it, and allows one that does", () => {
    const dist = certain({ x: 2, y: 1 }); // one point away
    const cheap = chooseCard([pointCard], 10, dist, GRID, 1, 100, budget, true, 0, {
      maxMoveCost: Number.POSITIVE_INFINITY,
      moveEvThreshold: 1000, // nothing can clear this
    });
    expect(manhattan(budget.current, cheap!.focus)).toBe(0);

    const allowed = chooseCard([pointCard], 10, dist, GRID, 1, 100, budget, true, 0, {
      maxMoveCost: Number.POSITIVE_INFINITY,
      moveEvThreshold: 0.01,
    });
    expect(manhattan(budget.current, allowed!.focus)).toBeGreaterThan(0);
  });

  it("UNCONSTRAINED reproduces the pre-session-49 choice exactly", () => {
    const dist = certain({ x: 2, y: 3 });
    const withDefault = chooseCard([pointCard], 10, dist, GRID, 1, 100, budget, true, 0);
    const withExplicit = chooseCard([pointCard], 10, dist, GRID, 1, 100, budget, true, 0, UNCONSTRAINED);
    expect(withExplicit).toEqual(withDefault);
  });
});
