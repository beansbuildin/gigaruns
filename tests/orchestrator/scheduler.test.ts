/**
 * tests/orchestrator/scheduler.test.ts — Task 10's budget-aware decision
 * logic. Pure — every case is a fixed energy/budget snapshot, no timers,
 * no fs, no network.
 */

import { describe, expect, it } from "vitest";
import { nextAction, type EnergyState, type ModeBudget } from "../../src/orchestrator/scheduler.js";

const energy = (value: number, overrides: Partial<EnergyState> = {}): EnergyState => ({
  value,
  max: 420,
  regenPerHour: 18,
  ...overrides,
});

const mode = (overrides: Partial<ModeBudget> = {}): ModeBudget => ({
  costPerAction: 20,
  dailyEnergyBudget: 240,
  energySpentToday: 0,
  maxActionsPerSession: 12,
  actionsToday: 0,
  ...overrides,
});

describe("nextAction — both modes fresh", () => {
  it("picks dungeon when both are affordable and headroom ties (real energy plenty)", () => {
    expect(nextAction(energy(100), mode(), mode())).toEqual({ kind: "dungeon" });
  });

  it("picks whichever mode has proportionally MORE daily budget left", () => {
    // dungeon has spent 200/240 (16.7% left), fishing spent 0/200 (100% left)
    const dungeon = mode({ dailyEnergyBudget: 240, energySpentToday: 200 });
    const fishing = mode({ dailyEnergyBudget: 200, energySpentToday: 0, costPerAction: 12 });
    expect(nextAction(energy(100), dungeon, fishing)).toEqual({ kind: "fishing" });
  });

  it("only fishing configured -> fishing, even with headroom tied against nothing", () => {
    expect(nextAction(energy(100), null, mode())).toEqual({ kind: "fishing" });
  });

  it("only dungeon configured -> dungeon", () => {
    expect(nextAction(energy(100), mode(), null)).toEqual({ kind: "dungeon" });
  });
});

describe("nextAction — real energy too low right now", () => {
  it("sleeps for exactly the time needed to reach the CHEAPER mode's cost", () => {
    // fishing costs 12, dungeon costs 20; real energy is 5; regen 18/hr = 0.005/s
    const dungeon = mode({ costPerAction: 20 });
    const fishing = mode({ costPerAction: 12 });
    const d = nextAction(energy(5, { regenPerHour: 18 }), dungeon, fishing);
    expect(d.kind).toBe("sleep");
    if (d.kind === "sleep") {
      // needs 7 more energy at 18/hr (0.005/s) -> 1400s
      expect(d.seconds).toBe(1400);
      // [session 47, brief §1f] The target the orchestrator tries to claim to
      // before honouring the sleep — the CHEAPER eligible mode's cost, same
      // number the sleep is sized off.
      expect(d.targetEnergy).toBe(12);
    }
  });

  it("only sleeps for what the STILL-POLICY-ELIGIBLE mode needs, ignoring an exhausted one", () => {
    // dungeon is policy-exhausted (cap hit), fishing needs to wait
    const dungeon = mode({ costPerAction: 5, maxActionsPerSession: 0 });
    const fishing = mode({ costPerAction: 30 });
    const d = nextAction(energy(10, { regenPerHour: 36 }), dungeon, fishing);
    expect(d.kind).toBe("sleep");
    if (d.kind === "sleep") {
      // needs 20 more energy at 36/hr (0.01/s) -> 2000s, NOT sized off dungeon's cheaper (already-exhausted) cost
      expect(d.seconds).toBe(2000);
      // Likewise the claim target must ignore the exhausted mode — claiming to
      // 5 would top up to a level that still can't start anything.
      expect(d.targetEnergy).toBe(30);
    }
  });

  it("done, not an infinite sleep, when regenPerHour is 0 and nothing is affordable now", () => {
    const d = nextAction(energy(0, { regenPerHour: 0 }), mode(), mode());
    expect(d).toEqual({ kind: "done", reason: expect.stringContaining("regenPerHour is 0") });
  });
});

describe("nextAction — policy caps exhausted", () => {
  it("done when both modes hit their run/cast cap", () => {
    const dungeon = mode({ maxActionsPerSession: 3, actionsToday: 3 });
    const fishing = mode({ maxActionsPerSession: 5, actionsToday: 5 });
    expect(nextAction(energy(300), dungeon, fishing)).toEqual({
      kind: "done",
      reason: expect.stringContaining("exhausted"),
    });
  });

  it("done when both modes would exceed their daily energy budget", () => {
    const dungeon = mode({ dailyEnergyBudget: 240, energySpentToday: 230, costPerAction: 20 });
    const fishing = mode({ dailyEnergyBudget: 200, energySpentToday: 195, costPerAction: 12 });
    expect(nextAction(energy(300), dungeon, fishing).kind).toBe("done");
  });

  it("done when neither mode is configured at all", () => {
    expect(nextAction(energy(300), null, null)).toEqual({
      kind: "done",
      reason: expect.stringContaining("exhausted"),
    });
  });

  it("uses the remaining eligible mode when the other hits its cap", () => {
    const dungeon = mode({ maxActionsPerSession: 1, actionsToday: 1 });
    const fishing = mode();
    expect(nextAction(energy(100), dungeon, fishing)).toEqual({ kind: "fishing" });
  });
});
