/**
 * tests/orchestrator/energyPreflight.test.ts — [session 47, brief §1a]
 *
 * The brief's explicit asks: assert the claim fires when the pool is below the
 * planned batch's cost, does not fire when it isn't, and that a claim error
 * fails closed rather than proceeding with a short pool.
 *
 * Everything here is network-free — `EnergyPreflightDeps` is the whole seam.
 * `sleep` is stubbed to a no-op so the CLAUDE.md §7 pacing (1200ms + jitter
 * per claim) doesn't turn a 3-claim test into a 4-second one.
 */

import { describe, expect, it, vi } from "vitest";

import { ensureEnergyFor, EnergyPreflightError, type EnergyPreflightDeps, type RomBankEntry } from "../../src/orchestrator/energyPreflight.js";

const noSleep = async () => {};

/**
 * A bank that behaves like the real one: claiming a ROM moves its
 * `energyCollectable` into the pool, capped at the account's 420 ceiling with
 * the remainder left banked (CONFIRMED non-wasting, sessions 21/22).
 */
function fakeAccount(startEnergy: number, bank: RomBankEntry[], opts: { cap?: number; failOn?: string } = {}) {
  const cap = opts.cap ?? 420;
  let pool = startEnergy;
  const balances = new Map(bank.map((r) => [r.docId, r.energyCollectable]));
  const claims: string[] = [];
  const deps: EnergyPreflightDeps = {
    getEnergy: async () => pool,
    getRomBank: async () => bank.map((r) => ({ ...r })),
    claimRom: async (docId: string) => {
      if (opts.failOn === docId) throw new Error(`HTTP 500 claiming ${docId}`);
      claims.push(docId);
      const available = balances.get(docId) ?? 0;
      const moved = Math.min(available, Math.max(0, cap - pool));
      pool += moved;
      balances.set(docId, available - moved);
    },
    sleep: noSleep,
  };
  return {
    deps,
    claims,
    get pool() {
      return pool;
    },
  };
}

describe("ensureEnergyFor", () => {
  it("does not read the ROM bank or claim when the pool already covers the batch", async () => {
    const getRomBank = vi.fn(async () => []);
    const claimRom = vi.fn(async () => {});
    const res = await ensureEnergyFor(60, { getEnergy: async () => 240, getRomBank, claimRom, sleep: noSleep });

    expect(res.alreadySufficient).toBe(true);
    expect(res.poolBefore).toBe(240);
    expect(res.poolAfter).toBe(240);
    expect(res.bankTotal).toBeNull();
    expect(res.claimedDocIds).toEqual([]);
    expect(getRomBank).not.toHaveBeenCalled();
    expect(claimRom).not.toHaveBeenCalled();
  });

  it("treats exactly-enough as enough (no off-by-one claim)", async () => {
    const claimRom = vi.fn(async () => {});
    const res = await ensureEnergyFor(60, { getEnergy: async () => 60, getRomBank: async () => [], claimRom, sleep: noSleep });
    expect(res.alreadySufficient).toBe(true);
    expect(claimRom).not.toHaveBeenCalled();
  });

  it("claims when the pool is short, biggest ROM first, and stops once the deficit is covered", async () => {
    // Session 46's real shape: a nearly-empty pool and a fat bank.
    const acct = fakeAccount(15, [
      { docId: "rom-small", energyCollectable: 20 },
      { docId: "rom-big", energyCollectable: 540 },
      { docId: "rom-mid", energyCollectable: 315 },
      { docId: "rom-zero", energyCollectable: 0 },
    ]);
    const res = await ensureEnergyFor(60, acct.deps);

    // 60 - 15 = 45 deficit; the 540 ROM covers it alone, so exactly one claim.
    expect(acct.claims).toEqual(["rom-big"]);
    expect(res.alreadySufficient).toBe(false);
    expect(res.bankTotal).toBe(875);
    expect(res.claimedSnapshotTotal).toBe(540);
    expect(res.poolBefore).toBe(15);
    expect(res.poolAfter).toBeGreaterThanOrEqual(60);
  });

  it("claims across several ROMs when no single one covers the deficit", async () => {
    const acct = fakeAccount(0, [
      { docId: "a", energyCollectable: 100 },
      { docId: "b", energyCollectable: 90 },
      { docId: "c", energyCollectable: 80 },
      { docId: "d", energyCollectable: 5 },
    ]);
    const res = await ensureEnergyFor(240, acct.deps);

    expect(acct.claims).toEqual(["a", "b", "c"]);
    expect(res.claimedSnapshotTotal).toBe(270);
    expect(res.poolAfter).toBe(270);
  });

  it("ignores ROMs with a zero balance", async () => {
    const acct = fakeAccount(0, [
      { docId: "empty-1", energyCollectable: 0 },
      { docId: "full", energyCollectable: 300 },
      { docId: "empty-2", energyCollectable: 0 },
    ]);
    const res = await ensureEnergyFor(240, acct.deps);
    expect(acct.claims).toEqual(["full"]);
    expect(res.bankTotal).toBe(300);
  });

  it("fails closed BEFORE claiming when pool + bank cannot fund the batch", async () => {
    const acct = fakeAccount(10, [{ docId: "a", energyCollectable: 30 }]);
    await expect(ensureEnergyFor(240, acct.deps)).rejects.toThrow(EnergyPreflightError);
    // The point of checking the total first: no requests are spent claiming
    // into a pool that still can't fund the batch.
    expect(acct.claims).toEqual([]);
  });

  it("fails closed on a claim error rather than proceeding with a short pool", async () => {
    const acct = fakeAccount(
      0,
      [
        { docId: "a", energyCollectable: 200 },
        { docId: "b", energyCollectable: 200 },
      ],
      { failOn: "a" },
    );
    // The bank could cover 240 in aggregate, but the first claim rejects.
    await expect(ensureEnergyFor(240, acct.deps)).rejects.toThrow(/ROM claim failed for docId a/);
    expect(acct.claims).toEqual([]);
  });

  it("carries the numbers on the fail-closed error so logs/ gets the full picture", async () => {
    const acct = fakeAccount(10, [{ docId: "a", energyCollectable: 30 }]);
    const err = await ensureEnergyFor(240, acct.deps).catch((e) => e);
    expect(err).toBeInstanceOf(EnergyPreflightError);
    expect(err.detail).toMatchObject({ requiredEnergy: 240, poolBefore: 10, bankTotal: 30, romsWithBalance: 1 });
  });

  it("verifies against the measured pool, not the snapshots — a stale snapshot still fails closed", async () => {
    // The bank claims 400 is available; the claim actually moves nothing
    // (someone else drained it between the read and the claim).
    const deps: EnergyPreflightDeps = {
      getEnergy: async () => 10,
      getRomBank: async () => [{ docId: "stale", energyCollectable: 400 }],
      claimRom: async () => {},
      sleep: noSleep,
    };
    const err = await ensureEnergyFor(240, deps).catch((e) => e);
    expect(err).toBeInstanceOf(EnergyPreflightError);
    expect(err.message).toMatch(/still short of the planned 240 after claiming/);
    expect(err.detail).toMatchObject({ claimedDocIds: ["stale"], claimedSnapshotTotal: 400, poolAfter: 10 });
  });

  it("succeeds when the 420 cap truncates the claim but the pool still covers the batch", async () => {
    const acct = fakeAccount(400, [{ docId: "huge", energyCollectable: 540 }]);
    const res = await ensureEnergyFor(420, acct.deps);
    expect(res.poolAfter).toBe(420);
    expect(acct.claims).toEqual(["huge"]);
  });

  it("paces every claim per CLAUDE.md §7", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const acct = fakeAccount(0, [
      { docId: "a", energyCollectable: 150 },
      { docId: "b", energyCollectable: 150 },
    ]);
    await ensureEnergyFor(240, { ...acct.deps, sleep });
    // one before the bank read, one before each of the two claims, one before
    // the verify read.
    expect(sleep).toHaveBeenCalledTimes(4);
    for (const call of sleep.mock.calls) {
      expect(call[0]).toBeGreaterThanOrEqual(1200);
      expect(call[0]).toBeLessThanOrEqual(1600);
    }
  });
});
