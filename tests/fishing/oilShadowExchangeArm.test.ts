/**
 * tests/fishing/oilShadowExchangeArm.test.ts — [session 70 §3]
 *
 * **THE SHADOW NOW EVALUATES THE EXCHANGE-RATE THRESHOLD, NOT THE CERTAINTY
 * GATE**, and this file is why that swap is safe as well as worth making.
 *
 * ## Why the certainty gate had to come off the shadow
 *
 * Session 69 ran `conserve(r=1,f=1)` in shadow against a real server for ten
 * casts. It **never once held a Relaxing Oil** — 0 of 9 firings on the whole
 * live record, `wouldSkip` on 0 of 42 records. That is not sampling noise, it
 * is what its inputs force: it holds only when a card ALREADY kills with
 * probability >= 1, and every Relaxing `bestKillProbability` ever seen live
 * (0.400 … 0.975) is strictly between 0 and 1. The gate was chosen because the
 * SIMULATOR's inputs are bimodal at 0 and 1; live has no mass at either
 * endpoint.
 *
 * So the shadow was spending every record it took on the one rule known to do
 * nothing.
 *
 * ## Why this is a SWAP and not a second arm
 *
 * `OilShadowRecord` has one `shadowWanted` / `wouldSkip` pair, so evaluating
 * both policies would mean widening the record. It does not need to:
 * `conserve(r=1,f=1)` holds an arm exactly when that arm's probability is
 * `>= 1`, and that probability is recorded on EVERY firing record. **The
 * certainty gate's verdict is reconstructable offline from the same rows, for
 * free** — which is asserted below rather than asserted in prose, because it is
 * the entire argument that the swap discards nothing.
 *
 * ## Anti-vacuity
 *
 * "The shadow ran the new policy" is not the finding — a swap that changed the
 * NAME and nothing else would pass that. The two policies must be shown to
 * genuinely disagree, and to disagree **in the band live actually occupies**,
 * which is the band the sim has no mass in.
 *
 * NOT SHIPPED. `liveFishing.ts` still plays `onDemandTriggers`.
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
import { MID_FOCUS_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID, type OilBudgetConfig } from "../../src/strategy/fishing/oilPolicy.js";
import {
  conserving,
  conservingOil,
  NECESSITY_EPSILON,
  PAYLOAD_OIL_EFFECTS,
  PREREGISTERED_EXCHANGE_THRESHOLDS,
  RECOMMENDED_NECESSITY_THRESHOLDS,
} from "../../src/strategy/fishing/oilTiming.js";
import { SHADOWED_OIL_POLICY } from "../../src/strategy/fishing/oilShadow.js";

/** Every Relaxing `bestKillProbability` on the entire live record (sessions 68-69, nine firings). */
const LIVE_RELAXING_KILL_PROBABILITIES = [0.4, 0.481, 0.505, 0.506, 0.58, 0.587, 0.69, 0.964, 0.975] as const;

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

describe("the shadowed policy is the exchange threshold", () => {
  it("is `conservingOil(PREREGISTERED_EXCHANGE_THRESHOLDS)` and NOT the certainty gate", () => {
    expect(SHADOWED_OIL_POLICY.name).toBe(conservingOil(PREREGISTERED_EXCHANGE_THRESHOLDS).name);
    expect(SHADOWED_OIL_POLICY.name).not.toBe(conserving.name);
  });

  it("the two policies really are different rules, not a rename", () => {
    // If these thresholds were equal the swap would be cosmetic and every
    // assertion in this file would pass while measuring nothing.
    expect(PREREGISTERED_EXCHANGE_THRESHOLDS.relaxing).toBeLessThan(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing);
    // The FOCUS arm deliberately stays at 1 — no corpus exchange rate exists
    // for its trigger, and borrowing the Relaxing number would be the fitted
    // constant the derivation exists to avoid (session 69 §3).
    expect(PREREGISTERED_EXCHANGE_THRESHOLDS.focus).toBe(RECOMMENDED_NECESSITY_THRESHOLDS.focus);
  });

  it("disagrees on the band LIVE actually occupies — 2 of the 9 recorded firings", () => {
    // The whole point. Both gates hold when `p >= threshold - epsilon`.
    const heldByExchange = LIVE_RELAXING_KILL_PROBABILITIES.filter(
      (p) => p >= PREREGISTERED_EXCHANGE_THRESHOLDS.relaxing - NECESSITY_EPSILON,
    );
    const heldByCertainty = LIVE_RELAXING_KILL_PROBABILITIES.filter(
      (p) => p >= RECOMMENDED_NECESSITY_THRESHOLDS.relaxing - NECESSITY_EPSILON,
    );
    expect(heldByExchange).toEqual([0.964, 0.975]);
    // The measured no-op, pinned as a number so a future report cannot soften it.
    expect(heldByCertainty).toEqual([]);
  });
});

describe("nothing is lost — the certainty gate stays reconstructable from the record", () => {
  it("`bestKillProbability >= 1` reproduces `conserve(r=1,f=1)`'s verdict at every live-observed value", () => {
    // This is the argument that the swap discards nothing. If it ever fails,
    // the record has stopped carrying enough to reconstruct the old gate and
    // the swap would need revisiting rather than the assertion loosening.
    for (const p of LIVE_RELAXING_KILL_PROBABILITIES) {
      const reconstructed = p >= RECOMMENDED_NECESSITY_THRESHOLDS.relaxing - NECESSITY_EPSILON;
      expect(reconstructed).toBe(false);
    }
    // And it is not vacuously false: a certain kill reconstructs as HELD.
    expect(1 >= RECOMMENDED_NECESSITY_THRESHOLDS.relaxing - NECESSITY_EPSILON).toBe(true);
    // NECESSITY_EPSILON is what makes a genuinely certain kill — arriving as
    // 0.9999999999999999 from float summation — reconstruct correctly too.
    expect(0.9999999999999999 >= RECOMMENDED_NECESSITY_THRESHOLDS.relaxing - NECESSITY_EPSILON).toBe(true);
  });
});

/** The session-69 shape: fish at lethal HP, meter FULL, so the Relaxing trigger fires alone. */
function makeClient(): GigaverseClient {
  const slotUsed = [false, false, false];
  let complete = false;
  return {
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
      if (body.action === "use_fishing_item") {
        slotUsed[body.data.slotIndex] = true;
        if (body.data.itemId === MID_RELAXING_OIL_ITEM_ID) complete = true;
      }
      const doc = sharedFakeDoc({
        docId: "13024100",
        fishHp: complete ? 0 : PAYLOAD_OIL_EFFECTS.fishDamage,
        fishMaxHp: 18,
        focusMeter: 3,
        complete,
        success: true,
        slotUsed,
      });
      return { success: true, message: "ok", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;
}

async function runCast(): Promise<CastRunResult> {
  const dir = mkdtempSync(join(tmpdir(), "gigaruns-exchange-arm-"));
  const deps: LiveFishingDeps = makeLiveFishingDeps({
    client: makeClient(),
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
  const result = await runOneCast(deps);
  rmSync(dir, { recursive: true, force: true });
  return result;
}

describe("the wire — a real cast records the exchange threshold", () => {
  it("names the exchange policy on the record, not `conserve(r=1,f=1)`", async () => {
    const result = await runCast();
    const firing = result.oilShadowRecords.filter((r) => r.liveWanted.includes("relaxing"));
    // Not vacuous: session 68's placement produced NO firing record at all,
    // which is what session 69's hoist bought.
    expect(firing.length).toBeGreaterThan(0);
    for (const r of firing) {
      expect(r.shadowPolicy).toBe(SHADOWED_OIL_POLICY.name);
      expect(r.shadowPolicy).not.toBe(conserving.name);
      // And the gate's own input is still populated, so the old gate stays
      // reconstructable from these very rows.
      expect(typeof r.bestKillProbability).toBe("number");
    }
  });

  it("still changes nothing — the live policy on the record is on-demand and the oil was really spent", async () => {
    const result = await runCast();
    expect(result.oilShadowRecords.every((r) => r.livePolicy === "on-demand")).toBe(true);
    expect(result.oilsConsumed).toBeGreaterThan(0);
    expect(result.oilShadowRecords.every((r) => r.sanity.length === 0)).toBe(true);
    expect(result.oilShadowRecords.every((r) => r.error === undefined)).toBe(true);
  });
});
