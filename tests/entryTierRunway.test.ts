/**
 * tests/entryTierRunway.test.ts — CLAUDE.md rule 11's Tier-2 entry cost.
 *
 * ## [session 113] REWRITTEN, because the thing it pinned was the wrong model
 *
 * This file used to open: *"Tier 2 spends one of EACH of the seven silver
 * rings per run ... so the runway is the SCARCEST faction's balance and never
 * the sum."* Every arithmetic assertion in it passed, for two sessions, while
 * the model underneath was false — Tier 2 charges **3 of ONE faction**, and
 * which faction **rotates daily**.
 *
 * That is worth stating at the top rather than quietly deleting, because it is
 * the same lesson `DECISIONS.md` 2026-08-30 drew from `liveFishing.test.ts`
 * asserting a forged run count as correct since session 29: **a green test
 * proves the code computes what the test says, never that the test says the
 * right thing.** The old file's headline number (30 runs / 7.5 days) was
 * pinned, asserted, and wrong by roughly half.
 *
 * So this file pins the CORRECTED model — and pins the retired one as a
 * counter-example, so that reverting to it fails rather than merely looking
 * plausible again.
 */
import { describe, expect, it } from "vitest";

import {
  factionDayRunway,
  factionOf,
  RINGS_PER_JUICED_RUN,
  ROTATION_PERIOD_DAYS,
  RUNS_PER_DAY,
  type TierCost,
} from "../scripts/checkEntryTiers.js";

const one = (ids: number[]): TierCost[] => ids.map((id) => ({ id, amount: 1 }));

/** The live Tier-2 `inputItems`, in the server's own order. */
const TIER2_IDS = [134, 137, 138, 135, 136, 139, 140];

/** Balances read live 2026-08-30 (session 113), after session 112's one Foxglove-day run. */
const BALANCES = new Map<number, number>([
  [134, 39], [135, 39], [136, 45], [137, 30], [138, 30], [139, 54], [140, 54],
]);

describe("the faction table, from /offchain/static's Hatchard Kit recipes", () => {
  it("maps every silver AND gold ring to its faction index", () => {
    expect(factionOf(135)).toBe(1); // Crusader
    expect(factionOf(136)).toBe(2); // Overseer
    expect(factionOf(137)).toBe(3); // Athena
    expect(factionOf(138)).toBe(4); // Archon
    expect(factionOf(139)).toBe(5); // Foxglove — the one measured live on day 20695
    expect(factionOf(140)).toBe(6); // Summoner
    expect(factionOf(134)).toBe(7); // Chobo
    // Gold is the same seven, offset by 109.
    for (const silver of TIER2_IDS) expect(factionOf(silver + 109)).toBe(factionOf(silver));
  });

  it("returns undefined for a non-ring item rather than guessing a faction", () => {
    expect(factionOf(845)).toBeUndefined(); // Hard Core
    expect(factionOf(131)).toBeUndefined(); // Big Heal Juice
  });

  it("covers all seven ids the live entryData lists, with no duplicates", () => {
    const factions = TIER2_IDS.map(factionOf);
    expect(factions.every((f) => f !== undefined)).toBe(true);
    expect(new Set(factions).size).toBe(ROTATION_PERIOD_DAYS);
  });
});

describe("factionDayRunway — rule 11's Tier-2 ring runway, rotation model", () => {
  it("charges 3 of ONE faction per juiced run, not one of each of seven", () => {
    expect(RINGS_PER_JUICED_RUN).toBe(3);
    const r = factionDayRunway(one(TIER2_IDS), BALANCES)!;
    // A 30-ring faction funds 10 runs on the days it is active. Under the OLD
    // model that 10 would have been the whole account's per-faction share of a
    // seven-ring bill; here it is one faction's own active-day capacity.
    expect(r.perFaction.find((f) => f.id === 137)!.activeDayRuns).toBe(10);
    expect(r.perFaction.find((f) => f.id === 139)!.activeDayRuns).toBe(18);
  });

  it("bounds the runway by the SCARCEST faction and reports the spread", () => {
    const r = factionDayRunway(one(TIER2_IDS), BALANCES)!;
    expect(r.scarcest.balance).toBe(30); // 137 Athena / 138 Archon, tied
    expect(r.richest.balance).toBe(54); // 139 Foxglove / 140 Summoner, tied
  });

  it("converts to cycles, days and runs at rule 11's 4-runs-per-day ceiling", () => {
    expect(RUNS_PER_DAY).toBe(4);
    expect(ROTATION_PERIOD_DAYS).toBe(7);
    const r = factionDayRunway(one(TIER2_IDS), BALANCES)!;
    // 30 held / (4 runs x 3 rings) = 2 full active days = 2 cycles.
    expect(r.cyclesUntilScarcestDries).toBe(2);
    expect(r.daysUntilScarcestDries).toBe(14);
    expect(r.runsUntilScarcestDries).toBe(56);
  });

  it("⚠ REGRESSION: the retired model's 30-run answer is NOT what this returns", () => {
    // `min(balance) / amount` with the literal `inputAmounts: [1,...]` gave 30
    // runs / 7.5 days, and that number is in CLAUDE.md's struck-through history,
    // in two session logs and in three DECISIONS entries. Anyone restoring it
    // here fails this test rather than shipping a plausible-looking halving.
    const retired = Math.min(...TIER2_IDS.map((id) => BALANCES.get(id)!));
    expect(retired).toBe(30);
    const r = factionDayRunway(one(TIER2_IDS), BALANCES)!;
    expect(r.runsUntilScarcestDries).not.toBe(retired);
    expect(r.runsUntilScarcestDries).toBeGreaterThan(retired);
  });

  it("⚠ REGRESSION: the SUM is not the runway either — the original 9.5x trap", () => {
    const sum = TIER2_IDS.reduce((n, id) => n + BALANCES.get(id)!, 0);
    expect(sum).toBe(291);
    const r = factionDayRunway(one(TIER2_IDS), BALANCES)!;
    expect(r.runsUntilScarcestDries).toBeLessThan(sum);
  });

  it("returns null for a free tier — Tier 1 has no runway rather than an infinite one", () => {
    expect(factionDayRunway([], BALANCES)).toBeNull();
  });

  it("treats a missing balance as 0, so an unheld faction blocks the tier entirely", () => {
    const missing = new Map(BALANCES);
    missing.delete(139);
    const r = factionDayRunway(one(TIER2_IDS), missing)!;
    expect(r.scarcest.id).toBe(139);
    expect(r.scarcest.balance).toBe(0);
    expect(r.cyclesUntilScarcestDries).toBe(0);
    expect(r.runsUntilScarcestDries).toBe(0);
  });

  it("scales with the per-run ring spend, so a hypothetical 6x halves the runway", () => {
    const at3 = factionDayRunway(one(TIER2_IDS), BALANCES, RUNS_PER_DAY, 3)!;
    const at6 = factionDayRunway(one(TIER2_IDS), BALANCES, RUNS_PER_DAY, 6)!;
    expect(at6.cyclesUntilScarcestDries * 2).toBe(at3.cyclesUntilScarcestDries);
  });

  it("clamps a malformed 0 spend to 1 rather than dividing into an infinite runway", () => {
    const r = factionDayRunway(one(TIER2_IDS), BALANCES, RUNS_PER_DAY, 0)!;
    expect(Number.isFinite(r.runsUntilScarcestDries)).toBe(true);
    expect(r.perFaction.find((f) => f.id === 137)!.activeDayRuns).toBe(30);
  });

  it("clamps a malformed 0 runs/day the same way", () => {
    const r = factionDayRunway(one(TIER2_IDS), BALANCES, 0)!;
    expect(Number.isFinite(r.runsUntilScarcestDries)).toBe(true);
    expect(r.cyclesUntilScarcestDries).toBe(10); // 30 / (1 run x 3 rings)
  });
});
