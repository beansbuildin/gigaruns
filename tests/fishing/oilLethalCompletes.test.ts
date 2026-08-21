/**
 * tests/fishing/oilLethalCompletes.test.ts — [session 68 §2]
 *
 * **A regression pin for a defect the live server found, not the sim.**
 *
 * `onDemandTriggers` is evaluated ONCE per turn and can return BOTH oils. The
 * loop that acts on it then sends them in order — but the Relaxing Oil's
 * entire thesis is that at `fishHp <= fishDamage` it ENDS the cast. So on a
 * turn where the fish is lethal AND the focus meter is empty, the second
 * consume is sent against a cast the server has already completed.
 *
 * Live, 2026-08-21, first cast of the session's batch, turn 3: fish 2/18 and
 * meter 0/3, both triggers fired, `use_fishing_item(937, slot 0)` took the
 * fish to 0/18, and `use_fishing_item(942, slot 1)` came back HTTP 400. Per
 * session 65 a rejected consume still ADVANCES the server's action token and
 * `GET /fishing/state` carries no token to resync from — so the cast was
 * unrecoverable. The batch stopped on cast 1 of 5.
 *
 * The pre-existing `if (doc.COMPLETE_CID) continue;` could never catch this:
 * it sits AFTER the loop, and the damage is done by the loop's own second
 * iteration.
 *
 * **This is a bug in the SHIPPED on-demand path.** It is not about the
 * conserving gate and not about shadow mode; both were uninvolved. It would
 * have been just as live under any policy that can return two oils at once.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
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
import { onDemandTriggers, PAYLOAD_OIL_EFFECTS } from "../../src/strategy/fishing/oilTiming.js";
import { oilState } from "../helpers/oilDecisionState.js";

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
 * **The server's own behaviour, reproduced: a consume that takes the fish to
 * zero returns a COMPLETE doc, and any action after that is rejected.**
 *
 * The rejection is modelled because without it this test would pass on the
 * unfixed code — the second consume would simply succeed against a mock that
 * does not care. The whole defect is that the real server does care.
 */
function makeClient(): { client: GigaverseClient; calls: { action: string; itemId: number }[] } {
  const calls: { action: string; itemId: number }[] = [];
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
      calls.push({ action: body.action, itemId: body.data.itemId });
      if (body.action === "use_fishing_item") {
        slotUsed[body.data.slotIndex] = true;
        // The Relaxing Oil is LETHAL at this fish HP — the cast ends here.
        if (body.data.itemId === MID_RELAXING_OIL_ITEM_ID) complete = true;
      }
      const doc = sharedFakeDoc({
        docId: "13024000",
        // Lethal, and the meter is empty: BOTH triggers fire on the same turn.
        fishHp: complete ? 0 : PAYLOAD_OIL_EFFECTS.fishDamage,
        fishMaxHp: 18,
        focusMeter: 0,
        complete,
        success: true,
        slotUsed,
      });
      return { success: true, message: "ok", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;
  return { client, calls };
}

function depsFor(dir: string, client: GigaverseClient): LiveFishingDeps {
  return makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget: APPROVED_BUDGET,
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath: join(dir, "guard-budget.json"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
    logsDir: join(dir, "logs"),
  });
}

describe("a lethal Relaxing Oil ends the cast — the Focus Oil that triggered with it must not be sent", () => {
  it("the premise holds: this state really does trigger BOTH oils on one turn", () => {
    // Derived from the policy rather than asserted, so the test keeps
    // describing the real hazard if either trigger is ever reshaped.
    const s = oilState({ fishHp: PAYLOAD_OIL_EFFECTS.fishDamage, focusRemaining: 0 });
    expect(onDemandTriggers(s, PAYLOAD_OIL_EFFECTS).sort()).toEqual(["focus", "relaxing"]);
  });

  it("sends exactly ONE consume and finishes the cast cleanly, instead of tripping on a desynced token", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-lethal-complete-"));
    const { client, calls } = makeClient();

    // Before the fix this threw:
    //   GuardTrip: use_fishing_item was rejected — the action token is now
    //   desynced and the cast cannot continue
    const result = await runOneCast(depsFor(dir, client));

    const consumes = calls.filter((c) => c.action === "use_fishing_item");
    expect(consumes).toHaveLength(1);
    // ...and it is the LETHAL one. Sending the Focus Oil instead would be a
    // different bug with the same count.
    expect(consumes[0]!.itemId).toBe(MID_RELAXING_OIL_ITEM_ID);
    expect(result.oilsConsumed).toBe(1);
    expect(result.outcome).toBe("caught");

    rmSync(dir, { recursive: true, force: true });
  });
});
