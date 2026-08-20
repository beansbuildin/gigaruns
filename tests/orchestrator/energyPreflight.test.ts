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
    getMaxEnergy: () => cap,
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

/**
 * [session 52 §1a] Claim ordering.
 *
 * The live shape this was built for: pool 7, a 53-energy deficit, and a bank of
 * 27 ROMs totalling 2496 whose largest single entry is 315. Descending claims
 * that 315 ROM alone; ascending claims 13 + 26 + 30. Both fund the run; only
 * one of them exercises the loop, and only one of them risks the biggest asset
 * in the bank on a code path that had never executed.
 */
describe("ensureEnergyFor — claim order [session 52 §1a]", () => {
  const liveBank = (): RomBankEntry[] => [
    { docId: "3777", energyCollectable: 13 },
    { docId: "7959", energyCollectable: 26 },
    { docId: "2114", energyCollectable: 30 },
    { docId: "7210", energyCollectable: 50 },
    { docId: "4543", energyCollectable: 315 },
  ];

  it("defaults to descending — omitting `order` is byte-for-byte the session-47 behaviour", async () => {
    const acct = fakeAccount(7, liveBank());
    const res = await ensureEnergyFor(60, acct.deps);
    expect(acct.claims).toEqual(["4543"]);
    expect(res.claimOrder).toBe("descending");
    expect(res.fallbackClaimDocId).toBeNull();
    expect(res.poolAfter).toBe(322);
  });

  it("claims smallest-first under `order: \"ascending\"`, still stopping at the deficit", async () => {
    const acct = fakeAccount(7, liveBank());
    const res = await ensureEnergyFor(60, acct.deps, { order: "ascending" });
    // 13 + 26 = 39 < 53; + 30 = 69 >= 53. The 50 and the 315 stay banked.
    expect(acct.claims).toEqual(["3777", "7959", "2114"]);
    expect(res.claimedSnapshotTotal).toBe(69);
    expect(res.claimOrder).toBe("ascending");
    expect(res.fallbackClaimDocId).toBeNull();
    expect(res.claims.map((c) => c.snapshot)).toEqual([13, 26, 30]);
    expect(res.claims.every((c) => !c.fallback)).toBe(true);
    expect(res.poolAfter).toBe(76);
  });

  it("falls back to the largest remaining ROM when `maxClaims` is hit still short of the deficit", async () => {
    const acct = fakeAccount(0, [
      { docId: "a", energyCollectable: 1 },
      { docId: "b", energyCollectable: 1 },
      { docId: "c", energyCollectable: 1 },
      { docId: "big", energyCollectable: 200 },
      { docId: "mid", energyCollectable: 100 },
    ]);
    const res = await ensureEnergyFor(60, acct.deps, { order: "ascending", maxClaims: 3 });
    expect(acct.claims).toEqual(["a", "b", "c", "big"]);
    expect(res.fallbackClaimDocId).toBe("big");
    expect(res.claims.at(-1)).toEqual({ docId: "big", snapshot: 200, fallback: true });
    expect(res.poolAfter).toBe(203);
  });

  it("does not fall back when `maxClaims` is reached exactly AT the deficit", async () => {
    const acct = fakeAccount(0, [
      { docId: "a", energyCollectable: 30 },
      { docId: "b", energyCollectable: 30 },
      { docId: "big", energyCollectable: 200 },
    ]);
    const res = await ensureEnergyFor(60, acct.deps, { order: "ascending", maxClaims: 2 });
    expect(acct.claims).toEqual(["a", "b"]);
    expect(res.fallbackClaimDocId).toBeNull();
  });

  it("still fails closed when the bank cannot fund the batch, whatever the order", async () => {
    const acct = fakeAccount(0, [{ docId: "a", energyCollectable: 5 }]);
    await expect(ensureEnergyFor(60, acct.deps, { order: "ascending", maxClaims: 15 })).rejects.toBeInstanceOf(EnergyPreflightError);
    expect(acct.claims).toEqual([]);
  });

  it("read-only reports the ascending plan, including the fallback, and claims nothing", async () => {
    const lines: string[] = [];
    const acct = fakeAccount(0, [
      { docId: "a", energyCollectable: 1 },
      { docId: "b", energyCollectable: 1 },
      { docId: "big", energyCollectable: 200 },
    ]);
    const res = await ensureEnergyFor(60, { ...acct.deps, log: (l) => lines.push(l) }, { order: "ascending", maxClaims: 2, readOnly: true });
    expect(acct.claims).toEqual([]);
    expect(res.poolAfter).toBe(0);
    expect(lines.join("\n")).toContain("largest-remaining fallback big");
    expect(lines.join("\n")).toContain("would claim 3 ROM(s)");
  });
});

/**
 * [session 53, brief §3] `maxSnapshot` and `headroom` exist to close the
 * standing "overflow past the 420 cap is non-wasting" question BY
 * CONSTRUCTION rather than by running the experiment. When no single ROM in
 * the bank is large enough to fill the pool's remaining headroom, the
 * untested overflow path is unreachable from `ensureEnergyFor` — which is
 * what makes it safe to switch the default claim order to descending.
 */
describe("cap headroom reporting (session 53 §3)", () => {
  it("reports the largest single snapshot and the pool headroom when the bank is read", async () => {
    const acct = fakeAccount(20, [
      { docId: "a", energyCollectable: 30 },
      { docId: "b", energyCollectable: 120 },
      { docId: "c", energyCollectable: 55 },
    ]);
    const res = await ensureEnergyFor(120, acct.deps, { sleep: noSleep } as never);
    expect(res.maxSnapshot).toBe(120);
    expect(res.headroom).toBe(400); // 420 cap - 20 pool
    // 120 < 400 — no single claim can reach the cap from here.
    expect(res.maxSnapshot!).toBeLessThan(res.headroom!);
  });

  it("flags the case where a single claim COULD reach the cap", async () => {
    const acct = fakeAccount(400, [{ docId: "big", energyCollectable: 300 }]);
    const res = await ensureEnergyFor(600, acct.deps, { readOnly: true } as never);
    expect(res.headroom).toBe(20);
    expect(res.maxSnapshot).toBe(300);
    expect(res.maxSnapshot!).toBeGreaterThanOrEqual(res.headroom!);
  });

  it("reports maxSnapshot as null when the bank was never read", async () => {
    const acct = fakeAccount(300, [{ docId: "a", energyCollectable: 30 }]);
    const res = await ensureEnergyFor(60, acct.deps);
    expect(res.alreadySufficient).toBe(true);
    expect(res.maxSnapshot).toBeNull();
    expect(res.headroom).toBe(120); // still knowable — the pool was read
  });

  it("derives overflowReachable on every path, including the ones that claim nothing", async () => {
    // Bank read, cannot reach the cap.
    const safe = await ensureEnergyFor(120, fakeAccount(20, [{ docId: "a", energyCollectable: 120 }]).deps, { sleep: noSleep } as never);
    expect(safe.overflowReachable).toBe(false);

    // Bank read (read-only, nothing claimed), CAN reach the cap.
    const hot = await ensureEnergyFor(600, fakeAccount(400, [{ docId: "big", energyCollectable: 300 }]).deps, { readOnly: true } as never);
    expect(hot.overflowReachable).toBe(true);

    // Pool already sufficient — the bank was never read, so the question is
    // unanswered rather than answered "no". "We did not claim" must never
    // silently mean "we did not check".
    const untouched = await ensureEnergyFor(60, fakeAccount(300, [{ docId: "a", energyCollectable: 30 }]).deps);
    expect(untouched.alreadySufficient).toBe(true);
    expect(untouched.overflowReachable).toBeNull();

    // Cap unknown — also null, never a guess.
    const capless = await ensureEnergyFor(60, {
      getEnergy: async () => 300,
      getRomBank: async () => [],
      claimRom: async () => {},
      sleep: noSleep,
    });
    expect(capless.overflowReachable).toBeNull();
  });

  it("WARNs out loud when overflow becomes reachable, and stays quiet when it isn't", async () => {
    // [session 54, brief §4] `maxSnapshot < headroom` is the condition that
    // made "descending" safe as the default claim order. If it stops holding,
    // the default silently starts being able to reach the untested overflow
    // path — so it has to announce itself.
    const hotLines: string[] = [];
    const hot = fakeAccount(400, [{ docId: "big", energyCollectable: 300 }]);
    await ensureEnergyFor(600, { ...hot.deps, log: (l) => hotLines.push(l) }, { readOnly: true } as never);
    const warn = hotLines.find((l) => l.includes("WARN overflow reachable"));
    expect(warn).toBeDefined();
    expect(warn).toContain("300");
    expect(warn).toContain("20");

    const safeLines: string[] = [];
    const safe = fakeAccount(20, [{ docId: "a", energyCollectable: 120 }]);
    await ensureEnergyFor(120, { ...safe.deps, log: (l) => safeLines.push(l) }, { sleep: noSleep } as never);
    expect(safeLines.some((l) => l.includes("WARN overflow reachable"))).toBe(false);
    expect(safeLines.some((l) => l.includes("no single claim can reach the cap"))).toBe(true);
  });

  it("degrades to null headroom rather than guessing a cap when getMaxEnergy is absent", async () => {
    const res = await ensureEnergyFor(60, {
      getEnergy: async () => 300,
      getRomBank: async () => [],
      claimRom: async () => {},
      sleep: noSleep,
    });
    expect(res.headroom).toBeNull();
    expect(res.maxSnapshot).toBeNull();
  });
});
