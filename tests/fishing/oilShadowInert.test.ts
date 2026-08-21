/**
 * tests/fishing/oilShadowInert.test.ts — [session 68 §1a, GATE 1]
 *
 * **The live decision must be byte-identical with shadow on and shadow off.**
 *
 * That sentence is easy to satisfy vacuously, and this file is mostly about
 * refusing to. Three ways it could pass while proving nothing, each with its
 * own test below:
 *
 *   1. **The shadow never ran.** An evaluator that is switched off, or that
 *      throws on the first turn and gets swallowed, is trivially inert.
 *      `it("the shadow actually RAN")` requires real records with a real
 *      probability computed on them.
 *   2. **The shadow always agreed with the live policy.** If the conserving
 *      gate never diverges from `on-demand` on the states this test drives,
 *      then letting it influence the decision would change nothing, and
 *      byte-identity is a tautology rather than a guarantee.
 *      `it("the shadow DISAGREES")` requires a turn where it would skip an
 *      oil the live policy actually spends — so a leak necessarily shows up
 *      as a missing `use_fishing_item`.
 *   3. **The comparator cannot fail.** `it("the comparator is sensitive")`
 *      feeds it two runs whose live decisions genuinely differ and requires it
 *      to say so.
 *
 * With all three held, the byte-identity assertion means what it says.
 *
 * Session 66's lesson, restated because it is the reason for the shape: a
 * source-text pin proves a line exists, not that it runs.
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
import { meetsThreshold, PAYLOAD_OIL_EFFECTS } from "../../src/strategy/fishing/oilTiming.js";

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
 * **`gridSize: 3` is deliberate and is the only synthetic thing here.**
 *
 * A card's hit zones are a 3x3 template (`geometry.ZONE_OFFSET`), so on the
 * real gridSize-4 board no single placement can cover every cell and
 * `bestKillProbability` can only reach 1 if the movement model happens to
 * concentrate all its mass in one 3x3 window — which depends on a corpus this
 * test deliberately does not have. On a 3x3 board a full-template card centred
 * at [2,2] covers the whole grid, so the kill probability is 1 *whatever* the
 * distribution says, and the conserving gate's skip is forced by construction
 * rather than by luck.
 *
 * That is a statement about the test's ability to CREATE a disagreement, not a
 * claim about the fishery. The disagreement is what gives byte-identity teeth;
 * its frequency in the real game is a live measurement, not this file's job.
 */
const GRID = 3;

/** Full 3x3 template, damage well above the lethal threshold — so a hit kills and, on a 3x3 board, a hit is certain. */
const CERTAIN_KILL_CARD = fakeCard({ id: 1, hitAmount: 9 });

function fakeDoc(opts: { fishHp: number; focusMeter: number; complete: boolean; slotUsed: boolean[] }) {
  return sharedFakeDoc({
    docId: "77777777",
    fishHp: opts.fishHp,
    fishMaxHp: 20,
    focusMeter: opts.focusMeter,
    complete: opts.complete,
    slotUsed: opts.slotUsed,
    cards: [CERTAIN_KILL_CARD],
    fishPosition: [2, 2],
    focusPoint: [2, 2],
    extraData: { gridSize: GRID },
  });
}

interface Arm {
  result: CastRunResult;
  /** Every POST body, in order, as the wire saw it. The object under comparison. */
  posts: unknown[];
}

/**
 * One cast against a fully deterministic server. The fish sits at lethal HP
 * with the meter full, so the RELAXING trigger fires and nothing else does.
 */
async function runArm(shadowOil: boolean, opts: { oilBudget?: OilBudgetConfig } = {}): Promise<Arm> {
  const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-shadow-"));
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
      const doc = fakeDoc({
        // Lethal for the whole cast: the trigger is available on every turn,
        // so a shadow leak has more than one chance to show up.
        fishHp: PAYLOAD_OIL_EFFECTS.fishDamage,
        focusMeter: 3,
        complete: body.action === "play_cards" && plays >= 2,
        slotUsed,
      });
      return { success: true, message: "ok", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;

  const deps: LiveFishingDeps = makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget: "oilBudget" in opts ? opts.oilBudget : APPROVED_BUDGET,
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

/**
 * The comparator, named and reused, so the sensitivity test below exercises
 * the SAME function the guarantee rests on rather than a lookalike.
 *
 * `oilShadowRecords` is stripped from the result: it is the one field that is
 * supposed to differ between the arms, and comparing it would make the test
 * fail for the very reason the feature exists.
 */
function liveDecisionOf(arm: Arm): string {
  const { oilShadowRecords: _dropped, ...rest } = arm.result;
  return JSON.stringify({ posts: arm.posts, result: rest });
}

describe("GATE 1 — the oil shadow is provably inert", () => {
  it("the shadow actually RAN — otherwise byte-identity is a statement about nothing", async () => {
    const on = await runArm(true);
    expect(on.result.oilShadowRecords.length).toBeGreaterThan(0);
    // It reached the gate's own inputs, not merely a stub row.
    const scored = on.result.oilShadowRecords.filter((r) => r.bestKillProbability !== null);
    expect(scored.length).toBeGreaterThan(0);
    // And it never threw. A swallowed exception is the quiet way this goes vacuous.
    expect(on.result.oilShadowRecords.filter((r) => r.error !== undefined)).toEqual([]);
  });

  it("the shadow DISAGREES with the live policy here — so a leak would be visible", async () => {
    const on = await runArm(true);
    // The live policy wanted the Relaxing Oil and really spent it...
    expect(on.posts.some((p) => (p as { action: string }).action === "use_fishing_item")).toBe(true);
    // ...and the conserving gate would have kept it, because a card in hand
    // already kills with certainty. This is the divergence the guarantee is about.
    const skips = on.result.oilShadowRecords.filter((r) => r.wouldSkip.includes("relaxing"));
    expect(skips.length).toBeGreaterThan(0);
    // Asserted through `meetsThreshold`, NOT as `toBe(1)`. This board makes a
    // hit certain by construction, and the summation still returns
    // `0.9999999999999999` on some turns — the exact defect
    // `NECESSITY_EPSILON` exists for, and the first version of this line
    // re-imported it by comparing the raw float. `oilNecessity.test.ts` pins
    // the unit behaviour.
    expect(meetsThreshold(skips[0]!.bestKillProbability!, 1)).toBe(true);
  });

  it("the live decision is BYTE-IDENTICAL with shadow on and shadow off", async () => {
    const on = await runArm(true);
    const off = await runArm(false);
    expect(liveDecisionOf(on)).toBe(liveDecisionOf(off));
  });

  it("the comparator is SENSITIVE — two genuinely different live decisions compare unequal", async () => {
    // No oil budget at all means no oil is ever spent (silence is not
    // authorization), which is exactly the shape a shadow leak would produce:
    // the `use_fishing_item` POST disappears.
    const spending = await runArm(true);
    const notSpending = await runArm(true, { oilBudget: undefined });
    expect(liveDecisionOf(spending)).not.toBe(liveDecisionOf(notSpending));
  });

  it("no shadow record reports a sanity violation on a state the live loop really produced", async () => {
    const on = await runArm(true);
    expect(on.result.oilShadowRecords.flatMap((r) => r.sanity)).toEqual([]);
  });

  it("shadow off produces NO records — the switch is real, not decorative", async () => {
    const off = await runArm(false);
    expect(off.result.oilShadowRecords).toEqual([]);
  });
});
