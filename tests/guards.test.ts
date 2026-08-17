/**
 * tests/guards.test.ts — the centralized hard stops (SPEC §6, CLAUDE.md §5).
 */

import { describe, expect, it } from "vitest";

import { assertKnownEnum, GuardState, GuardTrip, isBudgetGuardTrip } from "../src/orchestrator/guards.js";

const BUDGET = { dailyEnergyBudget: 60, maxRunsPerSession: 3, maxConsecutiveActionFailures: 3 };

describe("GuardState — energy budget", () => {
  it("allows spending up to the budget", () => {
    const g = new GuardState(BUDGET);
    g.assertCanStartRun(20);
    g.recordRunStarted();
    g.recordEnergySpent(20);
    expect(g.spentEnergy).toBe(20);
  });

  it("trips when the observed spend exceeds the budget", () => {
    const g = new GuardState(BUDGET);
    g.recordEnergySpent(60);
    expect(() => g.recordEnergySpent(1)).toThrow(GuardTrip);
  });

  it("assertCanStartRun trips BEFORE sending an action that would exceed budget", () => {
    const g = new GuardState(BUDGET);
    g.recordEnergySpent(50);
    expect(() => g.assertCanStartRun(20)).toThrow(GuardTrip);
  });
});

describe("GuardState — seeded from prior spend", () => {
  it("starts spentEnergy/runCount from the seed rather than zero", () => {
    const g = new GuardState(BUDGET, { energySpent: 20, runsStarted: 1 });
    expect(g.spentEnergy).toBe(20);
    expect(g.runCount).toBe(1);
  });

  it("a seed already at budget trips on the very next spend — the point of persisting it", () => {
    const g = new GuardState(BUDGET, { energySpent: 60, runsStarted: 3 });
    expect(() => g.assertCanStartRun(20)).toThrow(GuardTrip);
  });

  it("defaults to zero when no seed is given — unseeded behavior is unchanged", () => {
    const g = new GuardState(BUDGET);
    expect(g.spentEnergy).toBe(0);
    expect(g.runCount).toBe(0);
  });
});

describe("GuardState — session run cap", () => {
  it("allows exactly maxRunsPerSession runs", () => {
    const g = new GuardState(BUDGET);
    for (let i = 0; i < 3; i++) {
      g.assertCanStartRun(20);
      g.recordRunStarted();
    }
    expect(g.runCount).toBe(3);
  });

  it("trips on the run past the cap", () => {
    const g = new GuardState(BUDGET);
    for (let i = 0; i < 3; i++) {
      g.assertCanStartRun(20);
      g.recordRunStarted();
    }
    expect(() => g.assertCanStartRun(20)).toThrow(GuardTrip);
  });
});

describe("GuardState — consecutive action failures", () => {
  it("resets the counter on a success", () => {
    const g = new GuardState(BUDGET);
    g.recordActionResult(false);
    g.recordActionResult(false);
    g.recordActionResult(true);
    g.recordActionResult(false);
    g.recordActionResult(false);
    // 4th failure since the last success — still below the limit of 3 in a row.
    expect(() => g.recordActionResult(true)).not.toThrow();
  });

  it("trips on three consecutive failures", () => {
    const g = new GuardState(BUDGET);
    g.recordActionResult(false);
    g.recordActionResult(false);
    expect(() => g.recordActionResult(false)).toThrow(GuardTrip);
  });
});

describe("GuardState — stall detection", () => {
  it("passes on progressing states", () => {
    const g = new GuardState(BUDGET);
    g.checkStateProgress("room1-hp30");
    expect(() => g.checkStateProgress("room1-hp28")).not.toThrow();
  });

  it("trips on the same state fingerprint twice in a row", () => {
    const g = new GuardState(BUDGET);
    g.checkStateProgress("room1-hp30");
    expect(() => g.checkStateProgress("room1-hp30")).toThrow(GuardTrip);
  });

  it("does not trip on a repeat that isn't consecutive", () => {
    const g = new GuardState(BUDGET);
    g.checkStateProgress("A");
    g.checkStateProgress("B");
    expect(() => g.checkStateProgress("A")).not.toThrow();
  });
});

describe("assertKnownEnum", () => {
  it("returns the value when it's in the allowed set", () => {
    expect(assertKnownEnum("rock", ["rock", "paper", "scissor"] as const, "move")).toBe("rock");
  });

  it("throws GuardTrip on a value outside the allowed set", () => {
    expect(() => assertKnownEnum("lizard", ["rock", "paper", "scissor"] as const, "move")).toThrow(GuardTrip);
  });
});

describe("isBudgetGuardTrip — Task 10's mode-isolation classifier", () => {
  it("is true for the run/energy-cap trips assertCanStartRun and recordEnergySpent throw", () => {
    const g = new GuardState(BUDGET);
    g.recordEnergySpent(60);
    try {
      g.recordEnergySpent(1);
      throw new Error("expected a throw");
    } catch (e) {
      expect(e).toBeInstanceOf(GuardTrip);
      expect(isBudgetGuardTrip(e as GuardTrip)).toBe(true);
    }

    const g2 = new GuardState(BUDGET);
    g2.recordEnergySpent(50);
    try {
      g2.assertCanStartRun(20);
      throw new Error("expected a throw");
    } catch (e) {
      expect(isBudgetGuardTrip(e as GuardTrip)).toBe(true);
    }

    const g3 = new GuardState({ ...BUDGET, maxRunsPerSession: 0 });
    try {
      g3.assertCanStartRun(1);
      throw new Error("expected a throw");
    } catch (e) {
      expect(isBudgetGuardTrip(e as GuardTrip)).toBe(true);
    }
  });

  it("is false for anomaly trips — consecutive failures, stalled state, unknown enum", () => {
    const g = new GuardState(BUDGET);
    try {
      g.recordActionResult(false);
      g.recordActionResult(false);
      g.recordActionResult(false);
      throw new Error("expected a throw");
    } catch (e) {
      expect(isBudgetGuardTrip(e as GuardTrip)).toBe(false);
    }

    const g2 = new GuardState(BUDGET);
    g2.checkStateProgress("A");
    try {
      g2.checkStateProgress("A");
      throw new Error("expected a throw");
    } catch (e) {
      expect(isBudgetGuardTrip(e as GuardTrip)).toBe(false);
    }

    try {
      assertKnownEnum("lizard", ["rock"] as const, "move");
      throw new Error("expected a throw");
    } catch (e) {
      expect(isBudgetGuardTrip(e as GuardTrip)).toBe(false);
    }
  });
});
