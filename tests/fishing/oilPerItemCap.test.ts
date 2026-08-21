/**
 * tests/fishing/oilPerItemCap.test.ts — [session 69 §4]
 *
 * **User directive, 2026-08-21:** *"Continue using Focus oil until supply
 * naturally depletes, then only use 2x Relaxing oil per fishing run."*
 *
 * Two halves, and the second is the one that is easy to get wrong by writing a
 * number where silence belongs:
 *
 *   - **Relaxing (937): hard ceiling of 2 per cast.**
 *   - **Focus (942): UNCONSTRAINED** — bounded only by `maxPerCast` and the
 *     three consumable slots the board exposes. Expressed by being ABSENT from
 *     `perItemMaxPerCast`, not by a generous number that would read as a limit
 *     somebody later "tidies".
 *
 * **"per fishing run" is read as PER CAST**, because `start_run` is the
 * server's own action for starting one cast (SPEC-fishing §2) — the
 * directive's word is the API's word. A per-SESSION reading would be strictly
 * tighter and is not what shipped; it is recorded here so the reading is
 * visible rather than assumed.
 *
 * **A ceiling never causes a spend.** It can only refuse an oil the policy
 * already wanted, which is why applying it while Focus stock is still healthy
 * is safe rather than premature — pinned below, because "non-binding in the
 * common case" is exactly the sort of claim that quietly stops being true.
 *
 * **And a cap hit is the THIRD CAST STATE, not an ordinary refusal.** The
 * policy wanted the oil and the account HELD one; a user ceiling withheld it.
 * That cast was played by the oil policy running dry on that arm, so it is
 * flagged `OIL-POLICY-DRY` and kept out of both outcome arms — the session-62
 * §1b lesson, whose whole point is that an unflagged policy change gets
 * averaged into a rate that then means nothing. The cast CONTINUES and the
 * batch does NOT halt; a ceiling reached is an expected state, not a rule-5
 * unexpected one.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOneCast, type CastRunResult, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { fakeDoc as sharedFakeDoc } from "../helpers/fishingDoc.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";
import {
  mayConsumeOil,
  MID_FOCUS_OIL_ITEM_ID,
  MID_RELAXING_OIL_ITEM_ID,
  type OilBudgetConfig,
  type OilSpendContext,
} from "../../src/strategy/fishing/oilPolicy.js";
import { PAYLOAD_OIL_EFFECTS } from "../../src/strategy/fishing/oilTiming.js";

const RELAXING_CAP = 2;

const TEST_CONFIG: BotConfig = {
  dungeonId: 5,
  energyCostPerRun: 20,
  maxRoom: 16,
  maxRunsPerDayGame: 12,
  dailyEnergyBudget: 240,
  maxRunsPerSession: 12,
  maxConsecutiveActionFailures: 3,
  dendren: { nodeId: "5", tierId: 1, energyCostPerCast: 12, maxCastsPerDayGame: 20, dailyEnergyBudget: 240, maxCastsPerSession: 20 },
};

/** The directive, as configuration: Relaxing capped, Focus absent and therefore uncapped. */
const DIRECTIVE_BUDGET: OilBudgetConfig = {
  allowedItemIds: [MID_FOCUS_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID],
  maxPerCast: 3,
  perItemMaxPerCast: { [String(MID_RELAXING_OIL_ITEM_ID)]: RELAXING_CAP },
  policyApproved: true,
};

const ctx = (over: Partial<OilSpendContext> = {}): OilSpendContext => ({
  configured: DIRECTIVE_BUDGET,
  itemId: MID_RELAXING_OIL_ITEM_ID,
  heldBalance: 56,
  usedThisCast: 0,
  usedThisCastOfItem: 0,
  dryRun: false,
  spendFailedThisCast: false,
  ...over,
});

describe("the per-item ceiling, at the gate", () => {
  it("allows the first two Relaxing Oils and refuses the third", () => {
    expect(mayConsumeOil(ctx({ usedThisCast: 0, usedThisCastOfItem: 0 })).allowed).toBe(true);
    expect(mayConsumeOil(ctx({ usedThisCast: 1, usedThisCastOfItem: 1 })).allowed).toBe(true);
    const third = mayConsumeOil(ctx({ usedThisCast: 2, usedThisCastOfItem: 2 }));
    expect(third.allowed).toBe(false);
    // The message must name the ITEM cap, not the overall budget — the live
    // loop keys the OIL-POLICY-DRY branch off which limit actually bound.
    expect(third.reason).toContain(`per-cast cap for item ${MID_RELAXING_OIL_ITEM_ID}`);
  });

  it("leaves the Focus Oil unconstrained — two Relaxing spent does not touch its own count", () => {
    const focus = mayConsumeOil(ctx({ itemId: MID_FOCUS_OIL_ITEM_ID, usedThisCast: 2, usedThisCastOfItem: 0 }));
    expect(focus.allowed).toBe(true);
  });

  it("the OVERALL cap still binds, so a per-item allowance can never exceed it", () => {
    // A per-item number larger than `maxPerCast` must not read as permission.
    const generous: OilBudgetConfig = { ...DIRECTIVE_BUDGET, maxPerCast: 1, perItemMaxPerCast: { [String(MID_RELAXING_OIL_ITEM_ID)]: 3 } };
    expect(mayConsumeOil(ctx({ configured: generous, usedThisCast: 1, usedThisCastOfItem: 0 })).allowed).toBe(false);
  });

  it("the ceiling NEVER causes a spend — every other refusal still refuses with it in place", () => {
    // The claim in this file's header, asserted rather than asserted-in-prose.
    expect(mayConsumeOil(ctx({ configured: undefined })).allowed).toBe(false);
    expect(mayConsumeOil(ctx({ configured: { ...DIRECTIVE_BUDGET, policyApproved: false } })).allowed).toBe(false);
    expect(mayConsumeOil(ctx({ heldBalance: 0 })).allowed).toBe(false);
    expect(mayConsumeOil(ctx({ dryRun: true })).allowed).toBe(false);
    expect(mayConsumeOil(ctx({ spendFailedThisCast: true })).allowed).toBe(false);
  });
});

/**
 * A server on which the LETHAL trigger fires every single turn and the oil
 * never finishes the fish — so nothing but the cap can stop a third consume.
 * The cast ends after a fixed number of card plays.
 */
async function runCappedCast(itemKind: "relaxing" | "focus"): Promise<{ result: CastRunResult; consumes: number[] }> {
  const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-cap-"));
  const consumes: number[] = [];
  const slotUsed = [false, false, false];
  let plays = 0;
  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => ({
      entities: [
        { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: 19 },
        { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: 56 },
      ],
    }),
    postFishingAction: async (body: { action: string; data: { slotIndex: number; itemId: number } }) => {
      if (body.action === "use_fishing_item") {
        consumes.push(body.data.itemId);
        slotUsed[body.data.slotIndex] = true;
      }
      if (body.action === "play_cards") plays += 1;
      const doc = sharedFakeDoc({
        docId: "13024300",
        // Lethal for the whole cast (so `relaxing` triggers every turn) and the
        // meter empty (so `focus` does too) — whichever arm is under test, the
        // trigger is never the limiting factor.
        fishHp: PAYLOAD_OIL_EFFECTS.fishDamage,
        fishMaxHp: 18,
        focusMeter: 0,
        complete: plays >= 4,
        slotUsed,
      });
      return { success: true, message: "ok", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;

  // Only the oil under test is allowed, so the two arms cannot contaminate
  // each other's slot budget.
  const itemId = itemKind === "relaxing" ? MID_RELAXING_OIL_ITEM_ID : MID_FOCUS_OIL_ITEM_ID;
  const deps: LiveFishingDeps = makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget: { ...DIRECTIVE_BUDGET, allowedItemIds: [itemId] },
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath: join(dir, "guard-budget.json"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
    logsDir: join(dir, "logs"),
  });
  const result = await runOneCast(deps);
  rmSync(dir, { recursive: true, force: true });
  return { result, consumes };
}

describe("the per-item ceiling, in a real cast", () => {
  it("spends exactly two Relaxing Oils on a cast that would otherwise take four", async () => {
    const { result, consumes } = await runCappedCast("relaxing");
    expect(consumes.filter((i) => i === MID_RELAXING_OIL_ITEM_ID)).toHaveLength(RELAXING_CAP);
    expect(result.oilsConsumed).toBe(RELAXING_CAP);
  });

  it("the third trigger is recorded as OIL-POLICY-DRY with reason `per_cast_cap`, and the cast plays on", async () => {
    const { result } = await runCappedCast("relaxing");
    const capped = result.oilTriggerNoStock.filter((r) => r.reason === "per_cast_cap");
    expect(capped.length).toBeGreaterThan(0);
    expect(capped.every((r) => r.kind === "relaxing")).toBe(true);
    // NOT `empty`: reading a user ceiling as an empty bag would understate the
    // account's real holdings in exactly the reports that track them.
    expect(result.oilTriggerNoStock.some((r) => r.reason === "empty")).toBe(false);
    // The cast reached its natural end rather than halting on the cap.
    expect(result.outcome).toBe("escaped");
    expect(result.turns).toBeGreaterThan(RELAXING_CAP);
  });

  it("the Focus Oil is NOT capped — it spends up to the slot budget on the same board", async () => {
    const { result, consumes } = await runCappedCast("focus");
    expect(consumes.filter((i) => i === MID_FOCUS_OIL_ITEM_ID).length).toBeGreaterThan(RELAXING_CAP);
    expect(result.oilTriggerNoStock.filter((r) => r.reason === "per_cast_cap")).toEqual([]);
  });
});

describe("the SHIPPED config really carries the directive", () => {
  // The cap lives in `config/bot.json`, so a test of the code alone would pass
  // with the directive unconfigured — which is the state that shipped before
  // this session.
  const cfg = JSON.parse(readFileSync("config/bot.json", "utf8")) as {
    dendren: { oils: { perItemMaxPerCast?: Record<string, number> } };
  };

  it("caps the Mid Relaxing Oil at 2 per cast", () => {
    expect(cfg.dendren.oils.perItemMaxPerCast?.[String(MID_RELAXING_OIL_ITEM_ID)]).toBe(RELAXING_CAP);
  });

  it("says NOTHING about the Mid Focus Oil — absence is how 'unconstrained' is expressed", () => {
    expect(cfg.dendren.oils.perItemMaxPerCast).toBeDefined();
    expect(String(MID_FOCUS_OIL_ITEM_ID) in (cfg.dendren.oils.perItemMaxPerCast ?? {})).toBe(false);
  });
});
