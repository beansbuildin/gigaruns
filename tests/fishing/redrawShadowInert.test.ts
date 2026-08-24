/**
 * tests/fishing/redrawShadowInert.test.ts — [session 90 §4, QUESTIONS.md §26]
 *
 * **The live decision must be byte-identical with the redraw shadow on and
 * off.** This file follows `oilShadowInert.test.ts` exactly, including its
 * three refusals to pass vacuously, because the guarantee is the same
 * guarantee and a weaker version of it would be worth nothing:
 *
 *   1. **The shadow never ran.** An evaluator that is switched off, or that
 *      throws on the first turn and gets swallowed, is trivially inert.
 *      `it("the shadow actually RAN")` requires real records with a real
 *      coverage computed on them and no `error`.
 *   2. **The shadow never wanted anything.** If the candidate never fires on
 *      the states this test drives, then letting it influence the decision
 *      would change nothing and byte-identity is a tautology.
 *      `it("the shadow FIRES")` requires a turn where it says WOULD REDRAW —
 *      so a leak necessarily shows up as a different POST sequence.
 *   3. **The comparator cannot fail.** `it("the comparator is sensitive")`
 *      feeds it two runs whose live decisions genuinely differ and requires it
 *      to say so.
 *
 * Session 66's lesson, restated because it is the reason for the shape: a
 * source-text pin proves a line exists, not that it runs.
 *
 * ## And the one this file adds, which the oil shadow did not need
 *
 * `it("redrawEnabled is still false")` — the redraw shadow lives one field
 * away from the switch that would make the bot really redraw, and the two are
 * declared next to each other in `runOneCast`. That proximity is deliberate
 * (it makes the difference visible) and it is also exactly the kind of
 * proximity a future edit collapses by accident.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOneCast, type CastRunResult, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { fakeDoc as sharedFakeDoc, fakeCard } from "../helpers/fishingDoc.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";
import {
  MID_FOCUS_OIL_ITEM_ID,
  MID_RELAXING_OIL_ITEM_ID,
  type OilBudgetConfig,
} from "../../src/strategy/fishing/oilPolicy.js";
import {
  REDRAW_SHADOW_COVERAGE_K,
  REDRAW_SHADOW_MIN_BUDGET,
} from "../../src/strategy/fishing/redrawShadow.js";

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
 * **A one-zone card at a one-point budget is what makes the candidate fire,
 * and the arithmetic is derived rather than tuned.**
 *
 * `heldCoverage` counts the DISTINCT cells the held hand can put a zone on,
 * over every reachable focus. A card whose only hit zone is the template
 * centre covers exactly the focus cell, so coverage equals the number of
 * REACHABLE cells — which at budget 1 from `[2,2]` on a 4x4 board is five
 * (the cell and its four neighbours). Five is at or below
 * `REDRAW_SHADOW_COVERAGE_K`, and one is at or above
 * `REDRAW_SHADOW_MIN_BUDGET`, so both clauses hold BY CONSTRUCTION rather
 * than by luck — and the test below asserts the relationship instead of the
 * number, so retuning either constant re-derives rather than silently
 * un-firing.
 */
const NARROW_CARD = { ...fakeCard({ id: 1, hitAmount: 5 }), hitZones: [5], critZones: [] };
/** The opposite: the full 3x3 template covers far more than K cells at a full meter. */
const WIDE_CARD = fakeCard({ id: 1, hitAmount: 5 });

interface Arm {
  result: CastRunResult;
  /** Every POST body, in order, as the wire saw it. The object under comparison. */
  posts: unknown[];
}

async function runArm(opts: {
  shadowRedraw: boolean;
  focusMeter: number;
  card: ReturnType<typeof fakeCard>;
  oilBudget?: OilBudgetConfig;
}): Promise<Arm> {
  const dir = mkdtempSync(join(tmpdir(), "gigaruns-redraw-shadow-"));
  const posts: unknown[] = [];
  const slotUsed = [false, false, false];
  let plays = 0;
  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => ({
      entities: [
        { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: 5 },
        { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: 5 },
      ],
    }),
    postFishingAction: async (body: { action: string; data: { slotIndex: number } }) => {
      posts.push(JSON.parse(JSON.stringify(body)));
      if (body.action === "use_fishing_item") slotUsed[body.data.slotIndex] = true;
      if (body.action === "play_cards") plays += 1;
      const doc = sharedFakeDoc({
        docId: "66666666",
        // Well above lethal, so no oil trigger fires and the cast reaches a
        // CARD decision on every turn — which is the phase this shadow lives in.
        fishHp: 15,
        fishMaxHp: 20,
        focusMeter: opts.focusMeter,
        complete: body.action === "play_cards" && plays >= 3,
        slotUsed,
        cards: [opts.card],
        fishPosition: [3, 3],
        focusPoint: [2, 2],
      });
      return { success: true, message: "ok", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;

  const deps: LiveFishingDeps = makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget: "oilBudget" in opts ? opts.oilBudget : APPROVED_BUDGET,
    shadowRedraw: opts.shadowRedraw,
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

/**
 * The comparator, named and reused, so the sensitivity test exercises the SAME
 * function the guarantee rests on rather than a lookalike.
 *
 * The two shadow fields are stripped: they are exactly what is supposed to
 * differ between the arms, and comparing them would make the test fail for the
 * very reason the feature exists.
 */
function liveDecisionOf(arm: Arm): string {
  const { redrawShadowRecords: _r, redrawShadowNoDecision: _n, ...rest } = arm.result;
  return JSON.stringify({ posts: arm.posts, result: rest });
}

const FIRING = { focusMeter: REDRAW_SHADOW_MIN_BUDGET, card: NARROW_CARD };

describe("the redraw shadow is INERT — the live decision is byte-identical with it on and off", () => {
  it("the shadow actually RAN — records exist, with a real coverage and no error", async () => {
    const on = await runArm({ shadowRedraw: true, ...FIRING });
    expect(on.result.redrawShadowRecords.length).toBeGreaterThan(0);
    for (const r of on.result.redrawShadowRecords) {
      expect(r.error).toBeUndefined();
      expect(r.sanity).toEqual([]);
      expect(r.heldCoverage).toBeGreaterThanOrEqual(0);
      expect(r.handSize).toBeGreaterThan(0);
      // The reachable set always contains at least the focus cell itself; zero
      // would mean the focus point is off-board, which reads coverage as 0 and
      // makes the trigger fire on everything.
      expect(r.reachable).toBeGreaterThan(0);
    }
  });

  it("the shadow FIRES — so a leak into the live decision would be VISIBLE", async () => {
    // Without this, byte-identity is a tautology: a candidate that never wants
    // anything cannot change a decision even if it were wired to.
    const on = await runArm({ shadowRedraw: true, ...FIRING });
    const fired = on.result.redrawShadowRecords.filter((r) => r.wouldRedraw);
    expect(fired.length).toBeGreaterThan(0);
    // Asserted as the RELATIONSHIP rather than as `5 <= 6`, so retuning either
    // constant re-derives the case instead of silently un-firing it.
    for (const r of fired) {
      expect(r.heldCoverage).toBeLessThanOrEqual(REDRAW_SHADOW_COVERAGE_K);
      expect(r.budget).toBeGreaterThanOrEqual(REDRAW_SHADOW_MIN_BUDGET);
      expect(r.coverageBelowK && r.conditionMet).toBe(true);
    }
  });

  it("...and the POST sequence is byte-identical anyway", async () => {
    const on = await runArm({ shadowRedraw: true, ...FIRING });
    const off = await runArm({ shadowRedraw: false, ...FIRING });
    expect(liveDecisionOf(on)).toBe(liveDecisionOf(off));
    // Belt and braces: the shadow-off arm produced no records at all, so the
    // identity above is not "both arms ran the shadow".
    expect(off.result.redrawShadowRecords).toEqual([]);
  });

  it("the comparator is SENSITIVE — it reports a difference when the live decisions really differ", async () => {
    // Two runs whose live decisions genuinely differ (a different hand changes
    // which card is played). If the comparator called these equal, the
    // byte-identity assertion above would be worthless.
    const narrow = await runArm({ shadowRedraw: true, ...FIRING });
    const wide = await runArm({ shadowRedraw: true, focusMeter: 3, card: WIDE_CARD });
    expect(liveDecisionOf(narrow)).not.toBe(liveDecisionOf(wide));
  });

  it("does NOT fire on a wide hand at a full meter — the candidate discriminates", async () => {
    // The other half of "it fires": a rule that fired on everything would also
    // pass the firing test above and would be useless as a trigger.
    const wide = await runArm({ shadowRedraw: true, focusMeter: 3, card: WIDE_CARD });
    expect(wide.result.redrawShadowRecords.length).toBeGreaterThan(0);
    expect(wide.result.redrawShadowRecords.every((r) => !r.wouldRedraw)).toBe(true);
    expect(wide.result.redrawShadowRecords.every((r) => r.heldCoverage > REDRAW_SHADOW_COVERAGE_K)).toBe(true);
  });
});

describe("the shadow cannot become the thing it shadows", () => {
  it("`redrawEnabled` is still false, and every record says so", async () => {
    const on = await runArm({ shadowRedraw: true, ...FIRING });
    expect(on.result.redrawShadowRecords.every((r) => r.liveRedrawEnabled === false)).toBe(true);
    // No redraw was sent. `play_cards` bodies are the only card action here.
    expect(on.posts.every((p) => (p as { action: string }).action !== "redraw")).toBe(true);
  });

  it("REDRAW_THRESHOLD is still 0 and `redrawEnabled` still defaults false in the live loop", async () => {
    // A source pin, and it is the WEAK instrument — everything above is the
    // strong one. It exists so the failure message names §26 rather than
    // showing a diff of POST bodies.
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/sim/fishing/castSim.ts", "utf8")).toContain("export const REDRAW_THRESHOLD = 0;");
    expect(readFileSync("scripts/liveFishing.ts", "utf8")).toContain("const redrawEnabled = deps.redrawEnabled ?? false;");
  });
});
