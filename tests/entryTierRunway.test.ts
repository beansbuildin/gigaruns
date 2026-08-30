/**
 * tests/entryTierRunway.test.ts — session 111, CLAUDE.md rule 11's Tier-2
 * entry cost.
 *
 * Tier 2 spends one of EACH of the seven silver rings per run
 * (`inputItems: [134,137,138,135,136,139,140]`, `inputAmounts` all 1, read
 * live 2026-08-30). So the runway is the SCARCEST faction's balance and never
 * the sum — on that day's real balances the sum says 285 and the truth is 30,
 * an error of 9.5x in the direction that invents a runway the account does not
 * have. That single confusion is what this file pins.
 */
import { describe, expect, it } from "vitest";

import { runwayRuns, RUNS_PER_DAY, type TierCost } from "../scripts/checkEntryTiers.js";

const one = (ids: number[]): TierCost[] => ids.map((id) => ({ id, amount: 1 }));

/** The live Tier-2 cost and balances as read on 2026-08-30, session 111. */
const TIER2_IDS = [134, 137, 138, 135, 136, 139, 140];
const BALANCES_2026_08_30 = new Map<number, number>([
  [134, 33], [135, 39], [136, 42], [137, 30], [138, 30], [139, 57], [140, 54],
]);

describe("runwayRuns — rule 11's Tier-2 ring runway", () => {
  it("is the MINIMUM over required items, not the sum — the live 2026-08-30 case", () => {
    const got = runwayRuns(one(TIER2_IDS), BALANCES_2026_08_30);
    expect(got).not.toBeNull();
    expect(got!.runs).toBe(30);
    // Athena (137) and Archon (138) are tied at 30; either is a correct answer
    // for "scarcest", so assert the balance rather than the id.
    expect(BALANCES_2026_08_30.get(got!.scarcest.id)).toBe(30);
    // The trap, stated as an assertion so it cannot be quietly reintroduced.
    const sum = TIER2_IDS.reduce((n, id) => n + BALANCES_2026_08_30.get(id)!, 0);
    expect(sum).toBe(285);
    expect(got!.runs).toBeLessThan(sum);
  });

  it("converts to days at rule 11's 4-runs-per-day ceiling", () => {
    expect(RUNS_PER_DAY).toBe(4);
    expect(runwayRuns(one(TIER2_IDS), BALANCES_2026_08_30)!.runs / RUNS_PER_DAY).toBe(7.5);
  });

  it("returns null for a free tier — Tier 1 has no runway rather than an infinite one", () => {
    expect(runwayRuns([], BALANCES_2026_08_30)).toBeNull();
  });

  it("treats a missing balance as 0, so an unheld ring blocks the tier", () => {
    const missing = new Map(BALANCES_2026_08_30);
    missing.delete(139);
    const got = runwayRuns(one(TIER2_IDS), missing)!;
    expect(got.runs).toBe(0);
    expect(got.scarcest.id).toBe(139);
  });

  it("divides by the per-run amount, so a 2x cost halves the runway", () => {
    const cost: TierCost[] = [{ id: 134, amount: 2 }, { id: 135, amount: 1 }];
    // 33 / 2 -> 16 (floored), 39 / 1 -> 39; the scarcest is the doubled one.
    expect(runwayRuns(cost, BALANCES_2026_08_30)).toEqual({ runs: 16, scarcest: { id: 134, amount: 2 } });
  });

  it("clamps a malformed amount of 0 to 1 rather than dividing into an infinite runway", () => {
    const got = runwayRuns([{ id: 137, amount: 0 }], BALANCES_2026_08_30)!;
    expect(got.runs).toBe(30);
    expect(Number.isFinite(got.runs)).toBe(true);
  });
});
