/**
 * tests/fishing/oilFocusWithdrawn.test.ts — [session 93 §1, GATE 5.1]
 *
 * **User directive 2026-08-24: relaxing-oil-only.** `942` (Mid Focus Oil) is
 * out of `config/bot.json`'s `dendren.oils.allowedItemIds`.
 *
 * `mayConsumeOil` has always refused an id absent from that list, so the POST
 * half of this needed no code and is asserted here only so a regression is
 * loud. **What did need code is which BRANCH the refusal takes**, and that is
 * what the second test pins:
 *
 *   - Before: a withdrawn focus trigger fell through `!auth.allowed` into
 *     `liveFishing.ts`'s `held <= 0` arm — keyed on the BALANCE, not on the
 *     reason — logging `oil_trigger_no_stock`, recording a `dryTriggers` row,
 *     and flagging the whole cast OIL-POLICY-DRY, i.e. out of BOTH outcome
 *     arms. Under a withdrawal that is permanent: every future cast whose
 *     meter reached zero would leave the corpus, for an oil nobody wants.
 *   - After: the kind is dropped before the spend loop with its own event,
 *     `oil_trigger_policy_withdrawn`, and the cast stays in its arm.
 *
 * The first test deliberately stocks FIVE Focus Oils. A withdrawal that only
 * held because the bag was empty would be a stock artifact; this is a policy,
 * and the difference is the whole reason the change was made rather than noted.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { fakeDoc as sharedFakeDoc } from "../helpers/fishingDoc.js";

import { runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";
import {
  MID_FOCUS_OIL_ITEM_ID,
  MID_RELAXING_OIL_ITEM_ID,
  type OilBudgetConfig,
} from "../../src/strategy/fishing/oilPolicy.js";

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

/** The SHIPPED budget as of session 93 — relaxing only. */
const RELAXING_ONLY: OilBudgetConfig = {
  allowedItemIds: [MID_RELAXING_OIL_ITEM_ID],
  maxPerCast: 3,
  policyApproved: true,
  perItemMaxPerCast: { "937": 2 },
};

/** The budget as it stood through session 92, kept for the contrast test only. */
const BOTH_OILS: OilBudgetConfig = {
  allowedItemIds: [MID_FOCUS_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID],
  maxPerCast: 3,
  policyApproved: true,
  perItemMaxPerCast: { "937": 2 },
};

const fakeDoc = (opts: { fishHp: number; fishMaxHp: number; focusMeter: number; complete: boolean; slotUsed: boolean[] }) =>
  sharedFakeDoc({ docId: "93000001", ...opts });

function makeClient(opts: {
  fishHp: number;
  focusMeter: number;
  balances: { focus: number; relaxing: number };
}): { client: GigaverseClient; calls: string[]; itemIds: number[] } {
  const calls: string[] = [];
  const itemIds: number[] = [];
  const slotUsed = [false, false, false];
  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => ({
      entities: [
        { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: opts.balances.focus },
        { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: opts.balances.relaxing },
      ],
    }),
    postFishingAction: async (body: { action: string; data: { slotIndex: number; itemId?: number } }) => {
      calls.push(body.action);
      if (body.action === "use_fishing_item") {
        itemIds.push(Number(body.data.itemId));
        if (slotUsed[body.data.slotIndex]) throw new Error("HTTP 400 — slot already used");
        slotUsed[body.data.slotIndex] = true;
      }
      const doc = fakeDoc({
        fishHp: opts.fishHp,
        fishMaxHp: 20,
        focusMeter: opts.focusMeter,
        complete: body.action === "play_cards" && calls.filter((a) => a === "play_cards").length >= 2,
        slotUsed,
      });
      return { success: true, message: body.action === "start_run" ? "Game started successfully." : "Cards played successfully.", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;
  return { client, calls, itemIds };
}

function depsFor(dir: string, client: GigaverseClient, oilBudget: OilBudgetConfig, events: LoggedEvent[] = []): LiveFishingDeps {
  return makeLiveFishingDeps({
    log: capturingLog(events),
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget,
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath: join(dir, "guard-budget.json"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
    logsDir: join(dir, "logs"),
  });
}

/**
 * `makeLiveFishingDeps` stubs `log.write` to a no-op, so the run log is not on
 * disk to be read. Capturing it in memory is the supported override and keeps
 * this test off every real path, per CLAUDE.md's working-style rule.
 */
type LoggedEvent = { event?: string; kinds?: string[] };
function capturingLog(sink: LoggedEvent[]): LiveFishingDeps["log"] {
  return { write: (rec: LoggedEvent) => sink.push(rec), filePath: "test.jsonl" } as unknown as LiveFishingDeps["log"];
}

describe("[session 93 §1] Focus Oil is WITHDRAWN by policy, not merely out of stock", () => {
  it("sends no use_fishing_item and does NOT flag the cast out of both arms — WITH FIVE FOCUS OILS IN STOCK", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-withdrawn-"));
    // fishHp 10 is far above the payload's fishDamage (2), so the LETHAL
    // trigger stays silent and the focus trigger is the only one firing. The
    // bag holds five of each: nothing here is a stock artifact.
    const { client, calls } = makeClient({ fishHp: 10, focusMeter: 0, balances: { focus: 5, relaxing: 5 } });
    const events: LoggedEvent[] = [];

    const result = await runOneCast(depsFor(dir, client, RELAXING_ONLY, events));

    // Ordinary play, and nothing spent.
    expect(calls).toContain("play_cards");
    expect(calls).not.toContain("use_fishing_item");

    // THE POINT: not a dry trigger. The cast stays in its outcome arm.
    expect(result.oilTriggerNoStock).toEqual([]);
    expect(existsSync(join(dir, "oil-cast-states.jsonl"))).toBe(false);

    // And the withdrawal is on the record under its own name.
    const withdrawn = events.filter((e) => e.event === "oil_trigger_policy_withdrawn");
    expect(withdrawn.length).toBeGreaterThan(0);
    expect(withdrawn[0]!.kinds).toEqual(["focus"]);

    rmSync(dir, { recursive: true, force: true });
  });

  it("CONTRAST — the same state under the session-92 budget DOES flag the cast dry, which is the regression this prevents", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-notwithdrawn-"));
    // Focus stock 0 here, which is the live condition through session 92: the
    // trigger fires, `mayConsumeOil` refuses for an empty bag, and the
    // `held <= 0` branch flags the cast OIL-POLICY-DRY.
    const { client } = makeClient({ fishHp: 10, focusMeter: 0, balances: { focus: 0, relaxing: 5 } });
    const events: LoggedEvent[] = [];

    const result = await runOneCast(depsFor(dir, client, BOTH_OILS, events));

    expect(result.oilTriggerNoStock.map((r) => r.kind)).toContain("focus");
    expect(readFileSync(join(dir, "oil-cast-states.jsonl"), "utf8").trim()).not.toBe("");
    expect(events.some((e) => e.event === "oil_trigger_policy_withdrawn")).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it("the RELAXING oil is untouched by the withdrawal — it still fires, and it is the only id ever posted", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-relaxing-still-"));
    // fishHp 2 == fishDamage fires the lethal trigger; meter 0 fires the
    // withdrawn focus one. Exactly one POST should result, and it should be 937.
    const { client, calls, itemIds } = makeClient({ fishHp: 2, focusMeter: 0, balances: { focus: 5, relaxing: 5 } });

    await runOneCast(depsFor(dir, client, RELAXING_ONLY));

    expect(calls).toContain("use_fishing_item");
    expect(new Set(itemIds)).toEqual(new Set([MID_RELAXING_OIL_ITEM_ID]));
    expect(itemIds).not.toContain(MID_FOCUS_OIL_ITEM_ID);

    rmSync(dir, { recursive: true, force: true });
  });
});
