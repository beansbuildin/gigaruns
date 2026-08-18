/**
 * tests/orchestrator/runWithAccounting.test.ts — [session 28, CODEXREVIEW
 * #3]. Both orchestrator.ts branches now go through this shared helper, so
 * testing it directly covers both modes without spinning up the whole
 * orchestrator loop (client, config, model, real energy reads).
 */

import { describe, expect, it, vi } from "vitest";

import { runWithGuaranteedAccounting } from "../../src/orchestrator/runWithAccounting.js";
import { GuardTrip, isBudgetGuardTrip } from "../../src/orchestrator/guards.js";

describe("runWithGuaranteedAccounting", () => {
  it("runs accounting once on a clean success, no rethrow", async () => {
    const account = vi.fn(async () => {});
    const onBudgetTrip = vi.fn();
    await runWithGuaranteedAccounting({
      action: async () => {},
      isBudgetTrip: () => false,
      onBudgetTrip,
      account,
    });
    expect(account).toHaveBeenCalledTimes(1);
    expect(onBudgetTrip).not.toHaveBeenCalled();
  });

  it("dungeon mode: a recognized budget GuardTrip runs onBudgetTrip and accounting, swallowed (no rethrow)", async () => {
    const trip = new GuardTrip("daily energy budget would be exceeded", {});
    const account = vi.fn(async () => {});
    const onBudgetTrip = vi.fn();
    await runWithGuaranteedAccounting({
      action: async () => {
        throw trip;
      },
      isBudgetTrip: (e) => e instanceof GuardTrip && isBudgetGuardTrip(e),
      onBudgetTrip,
      account,
    });
    expect(account).toHaveBeenCalledTimes(1);
    expect(onBudgetTrip).toHaveBeenCalledWith(trip);
  });

  it("fishing mode: same budget-trip contract as dungeon mode (both use isBudgetGuardTrip)", async () => {
    const trip = new GuardTrip("session run cap reached", {});
    const account = vi.fn(async () => {});
    await runWithGuaranteedAccounting({
      action: async () => {
        throw trip;
      },
      isBudgetTrip: (e) => e instanceof GuardTrip && isBudgetGuardTrip(e),
      onBudgetTrip: () => {},
      account,
    });
    expect(account).toHaveBeenCalledTimes(1);
  });

  // The actual bug (CODEXREVIEW #3): a genuine anomaly used to skip
  // accounting entirely because the old code rethrew BEFORE the
  // after-energy read. This is the regression test for the fix — accounting
  // must run even though the action starts successfully then throws
  // something that isn't a budget trip.
  it("a runner that starts successfully then throws a genuine anomaly: accounting STILL runs, then the original error rethrows", async () => {
    const anomaly = new Error("unexpected state — not a budget trip");
    const account = vi.fn(async () => {});
    const onBudgetTrip = vi.fn();
    const p = runWithGuaranteedAccounting({
      action: async () => {
        // simulates start_run succeeding (real energy spent) before a later failure
        throw anomaly;
      },
      isBudgetTrip: () => false,
      onBudgetTrip,
      account,
    });
    await expect(p).rejects.toBe(anomaly);
    expect(account).toHaveBeenCalledTimes(1);
    expect(onBudgetTrip).not.toHaveBeenCalled();
  });

  it("an unrecognized GuardTrip (not a budget reason) is treated as an anomaly, not swallowed", async () => {
    const trip = new GuardTrip("consecutive action failures", {});
    const account = vi.fn(async () => {});
    const p = runWithGuaranteedAccounting({
      action: async () => {
        throw trip;
      },
      isBudgetTrip: (e) => e instanceof GuardTrip && isBudgetGuardTrip(e),
      onBudgetTrip: () => {},
      account,
    });
    await expect(p).rejects.toBe(trip);
    expect(account).toHaveBeenCalledTimes(1);
  });

  it("accounting runs even when accounting itself is the thing that would matter most — order is action, then account, then rethrow", async () => {
    const order: string[] = [];
    const anomaly = new Error("boom");
    const p = runWithGuaranteedAccounting({
      action: async () => {
        order.push("action");
        throw anomaly;
      },
      isBudgetTrip: () => false,
      onBudgetTrip: () => {},
      account: async () => {
        order.push("account");
      },
    });
    await expect(p).rejects.toBe(anomaly);
    expect(order).toEqual(["action", "account"]);
  });
});
