/**
 * tests/fishing/oilShadowRelaxingArm.test.ts — [session 69 §1, GATE 1a]
 *
 * **The shadow must be able to see the RELAXING arm fire.**
 *
 * Session 68 shipped the shadow and then measured that half of it is blind:
 * 13 records over five live casts, exactly ONE at a firing moment (the Focus
 * arm), and `bestKillProbability` `null` on all thirteen. The cause is not
 * stock and not sampling — it is ORDERING, and it is structural:
 *
 *   - the shadow was evaluated in the CARD-CHOICE phase, because it needs
 *     `dist` and nothing earlier in the turn had built one;
 *   - the Relaxing trigger fires only when the fish is lethal;
 *   - a lethal Relaxing Oil ENDS the cast inside the oil block, so
 *     `if (doc.COMPLETE_CID) continue;` fires and the card-choice phase is
 *     never reached on exactly the turn the arm fired.
 *
 * So the one turn the Relaxing arm is observable on is the one turn the old
 * placement threw away. The same gap swallowed any turn whose oil block threw
 * — which is, again, precisely a turn a trigger fired on.
 *
 * The fix (session 69 §1) hoists the `dist` pipeline above the oil block and
 * evaluates the shadow there. `dist` reads `matcher.history`,
 * `pendingPrediction` and the mined tables and nothing off the doc, none of
 * which a consume changes, so the value is identical — that half is pinned by
 * `tests/fishing/hoistInvariant.test.ts`, which requires live play to be
 * byte-identical across the move.
 *
 * **This file is the other half: that the move actually bought the
 * observation.** Every assertion below is `Tests no tests`-red on the
 * pre-hoist placement, because the pre-hoist placement produces no record at
 * all for this cast.
 *
 * Anti-vacuity, in the shape session 68 established: a record existing is not
 * the finding. The record must be at the FIRING moment (`liveWanted` really
 * contains `relaxing`), must carry the gate's own input rather than a stub
 * (`bestKillProbability` populated), and must have been taken on the
 * PRE-consume state (`fishHp` still lethal, not the 0 the oil left behind) —
 * otherwise the shadow is describing a board the decision never faced.
 */

import { mkdtempSync, rmSync } from "node:fs";
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
  MID_FOCUS_OIL_ITEM_ID,
  MID_RELAXING_OIL_ITEM_ID,
  type OilBudgetConfig,
} from "../../src/strategy/fishing/oilPolicy.js";
import { PAYLOAD_OIL_EFFECTS } from "../../src/strategy/fishing/oilTiming.js";

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

const APPROVED_BUDGET: OilBudgetConfig = {
  allowedItemIds: [MID_FOCUS_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID],
  maxPerCast: 3,
  policyApproved: true,
};

/**
 * The live shape, reproduced: fish at lethal HP with the meter FULL, so the
 * Relaxing trigger fires ALONE (the Focus trigger needs an empty meter), and
 * the consume takes the fish to zero and completes the cast. Any action after
 * completion is rejected, exactly as the real server rejected one on
 * 2026-08-21 — a mock that does not care is not the server.
 */
function makeClient(): { client: GigaverseClient; posts: { action: string; itemId?: number }[] } {
  const posts: { action: string; itemId?: number }[] = [];
  const slotUsed = [false, false, false];
  let complete = false;
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
      if (complete) throw new Error("Unexpected response from /fishing/action: HTTP 400");
      posts.push({ action: body.action, itemId: body.data?.itemId });
      if (body.action === "use_fishing_item") {
        slotUsed[body.data.slotIndex] = true;
        if (body.data.itemId === MID_RELAXING_OIL_ITEM_ID) complete = true;
      }
      const doc = sharedFakeDoc({
        docId: "13024100",
        fishHp: complete ? 0 : PAYLOAD_OIL_EFFECTS.fishDamage,
        fishMaxHp: 18,
        // FULL meter — so `onDemandTriggers` returns ["relaxing"] and nothing
        // else, and `bestConnectProbability` is legitimately never consulted.
        focusMeter: 3,
        complete,
        success: true,
        slotUsed,
      });
      return { success: true, message: "ok", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;
  return { client, posts };
}

async function runCast(shadowOil: boolean): Promise<{ result: CastRunResult; posts: { action: string; itemId?: number }[] }> {
  const dir = mkdtempSync(join(tmpdir(), "gigaruns-relaxing-arm-"));
  const { client, posts } = makeClient();
  const deps: LiveFishingDeps = makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget: APPROVED_BUDGET,
    shadowOil,
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
  return { result, posts };
}

describe("GATE 1a — the shadow observes the RELAXING arm on the turn it fires", () => {
  it("the premise holds: this cast really is ENDED by the oil, with no card ever played", async () => {
    // Without this, every assertion below could be satisfied by a cast that
    // simply carried on to the card-choice phase — i.e. by the one shape the
    // pre-hoist placement could already see.
    const { result, posts } = await runCast(true);
    expect(posts.map((p) => p.action)).toEqual(["start_run", "use_fishing_item"]);
    expect(posts.filter((p) => p.action === "play_cards")).toEqual([]);
    expect(result.outcome).toBe("caught");
    expect(result.oilsConsumed).toBe(1);
  });

  it("records the firing moment — a record exists at all, which pre-hoist it did not", async () => {
    const { result } = await runCast(true);
    expect(result.oilShadowRecords.length).toBeGreaterThan(0);
    expect(result.oilShadowRecords.filter((r) => r.error !== undefined)).toEqual([]);
  });

  it("the record is at a RELAXING firing moment with the gate's own input populated", async () => {
    const { result } = await runCast(true);
    const firing = result.oilShadowRecords.filter((r) => r.liveWanted.includes("relaxing"));
    expect(firing.length).toBeGreaterThan(0);
    // The whole point of session 68's finding: this was `null` on all 13 live
    // records. A number here — any number — is the observation being bought.
    const p = firing[0]!.bestKillProbability;
    expect(p).not.toBeNull();
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
    // The Focus arm did not fire on this state, so its input must stay unread
    // rather than being filled with a default that would read as a measurement.
    expect(firing[0]!.bestConnectProbability).toBeNull();
  });

  it("the record is taken on the PRE-consume state, not the corpse the oil left", async () => {
    const { result } = await runCast(true);
    const firing = result.oilShadowRecords.find((r) => r.liveWanted.includes("relaxing"))!;
    expect(firing.fishHp).toBe(PAYLOAD_OIL_EFFECTS.fishDamage);
    expect(firing.fishHp).not.toBe(0);
    // And the real stock, kept apart from the saturated stock the gate is asked against.
    expect(firing.heldAtDecision).toEqual({ focus: 19, relaxing: 56 });
    expect(firing.exercisable.relaxing).toBe(true);
  });

  it("no sanity violation on a state the live loop really produced", async () => {
    const { result } = await runCast(true);
    expect(result.oilShadowRecords.flatMap((r) => r.sanity)).toEqual([]);
  });

  it("shadow off still produces NO records on this cast — the switch survives the move", async () => {
    const { result } = await runCast(false);
    expect(result.oilShadowRecords).toEqual([]);
  });
});
