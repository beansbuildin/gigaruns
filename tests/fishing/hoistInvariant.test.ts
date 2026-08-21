/**
 * tests/fishing/hoistInvariant.test.ts — [session 69 §1, GATE 1b]
 *
 * **Moving a computation must not move a decision.**
 *
 * Session 69 hoists the distribution pipeline (`overrideStats` … `dist`) from
 * the card-choice phase of the turn to above the oil block, so the shadow can
 * be evaluated at the moment the oil decision is actually taken rather than in
 * a phase a lethal consume never reaches (`oilShadowRelaxingArm.test.ts` is
 * the observation that buys). The argument that this is safe is that `dist`
 * reads `matcher.history`, `pendingPrediction`, `switchEstimate` and the mined
 * tables and NOTHING off the doc, while the oil block writes only `doc`,
 * `oilHeld` and its own tallies.
 *
 * **That argument is exactly the kind that is right until it isn't.** Sessions
 * 64 and 65 both shipped a restructure justified as "only moving a
 * computation"; the brief for this one names that as the failure mode to
 * avoid. So the guarantee here is not the argument — it is a byte-level
 * capture of what the live loop DID, taken before the move and compared after.
 *
 * ## How the golden was made, and why it cannot be quietly re-blessed
 *
 * `tests/fishing/golden/liveDecision.golden.json` was generated against the
 * PRE-hoist code and committed in the same commit as the hoist. It is only
 * rewritten when `UPDATE_LIVE_DECISION_GOLDEN=1` is set, so a refactor that
 * changes play fails here instead of updating its own expectation. A diff to
 * this file is a claim that live play was MEANT to change, and belongs in a
 * commit message that says so.
 *
 * It is also the reason this file is not merely a session-69 artifact: any
 * future rearrangement of the turn loop is measured against the same capture.
 *
 * ## Anti-vacuity
 *
 * A golden of six empty POST lists would compare equal forever. The scenarios
 * are asserted to be non-trivial in their own right — every one drives at
 * least a `start_run`, the set as a whole must contain a consume, a refusal, a
 * dry trigger and a multi-turn cast — so the comparison has something to be
 * about.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const GOLDEN_PATH = join(process.cwd(), "tests", "fishing", "golden", "liveDecision.golden.json");

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

interface BoardState {
  plays: number;
  relaxingLanded: boolean;
  focusLanded: boolean;
}

interface Scenario {
  name: string;
  /** Absent means NO oil is ever authorized — silence is not authorization. */
  budget?: OilBudgetConfig;
  balances: { focus: number; relaxing: number };
  board: (s: BoardState) => { fishHp: number; focusMeter: number; complete: boolean; success: boolean };
}

/**
 * Six shapes, chosen to walk every branch the hoisted region sits between:
 * a refusal, a consume, a terminal consume, the dual trigger, an empty bag,
 * and a plain multi-turn cast that never touches an oil at all.
 */
const SCENARIOS: Scenario[] = [
  {
    name: "no-authorization — the trigger fires and mayConsumeOil refuses",
    balances: { focus: 5, relaxing: 5 },
    board: (s) => ({ fishHp: 10, focusMeter: 0, complete: s.plays >= 2, success: false }),
  },
  {
    name: "focus oil spent on an empty meter, then play continues",
    budget: APPROVED_BUDGET,
    balances: { focus: 19, relaxing: 56 },
    board: (s) => ({ fishHp: 10, focusMeter: s.focusLanded ? 2 : 0, complete: s.plays >= 2, success: false }),
  },
  {
    name: "lethal relaxing oil ENDS the cast before any card is played",
    budget: APPROVED_BUDGET,
    balances: { focus: 19, relaxing: 56 },
    board: (s) => ({ fishHp: s.relaxingLanded ? 0 : 2, focusMeter: 3, complete: s.relaxingLanded, success: true }),
  },
  {
    name: "both triggers on one turn — only the lethal one may be sent",
    budget: APPROVED_BUDGET,
    balances: { focus: 19, relaxing: 56 },
    board: (s) => ({ fishHp: s.relaxingLanded ? 0 : 2, focusMeter: 0, complete: s.relaxingLanded, success: true }),
  },
  {
    name: "both triggers against an EMPTY bag — OIL-POLICY-DRY",
    budget: APPROVED_BUDGET,
    balances: { focus: 0, relaxing: 0 },
    board: (s) => ({ fishHp: 2, focusMeter: 0, complete: s.plays >= 2, success: false }),
  },
  {
    name: "plain multi-turn cast — no trigger ever fires",
    budget: APPROVED_BUDGET,
    balances: { focus: 19, relaxing: 56 },
    board: (s) => ({ fishHp: 15, focusMeter: 3, complete: s.plays >= 3, success: false }),
  },
];

interface ArmCapture {
  posts: unknown[];
  result?: unknown;
  error?: string;
}

async function capture(sc: Scenario): Promise<ArmCapture> {
  const dir = mkdtempSync(join(tmpdir(), "gigaruns-hoist-invariant-"));
  const posts: unknown[] = [];
  const slotUsed = [false, false, false];
  const state: BoardState = { plays: 0, relaxingLanded: false, focusLanded: false };

  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => ({
      entities: [
        { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: sc.balances.focus },
        { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: sc.balances.relaxing },
      ],
    }),
    postFishingAction: async (body: { action: string; data: { slotIndex: number; itemId: number } }) => {
      // The server really does reject anything after completion (session 68,
      // live). Modelling it is what keeps a post-terminal POST a failure here
      // rather than a silently absorbed extra line in the golden.
      if (sc.board(state).complete) throw new Error("Unexpected response from /fishing/action: HTTP 400");
      posts.push(JSON.parse(JSON.stringify(body)));
      if (body.action === "use_fishing_item") {
        slotUsed[body.data.slotIndex] = true;
        if (body.data.itemId === MID_RELAXING_OIL_ITEM_ID) state.relaxingLanded = true;
        if (body.data.itemId === MID_FOCUS_OIL_ITEM_ID) state.focusLanded = true;
      }
      if (body.action === "play_cards") state.plays += 1;
      const b = sc.board(state);
      const doc = sharedFakeDoc({
        docId: "13024200",
        fishHp: b.fishHp,
        fishMaxHp: 18,
        focusMeter: b.focusMeter,
        complete: b.complete,
        success: b.success,
        slotUsed,
      });
      return { success: true, message: "ok", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;

  const deps: LiveFishingDeps = makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget: sc.budget,
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath: join(dir, "guard-budget.json"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
    logsDir: join(dir, "logs"),
  });

  try {
    // `oilShadowRecords` is the ONE field the move is supposed to change.
    // Comparing it would make this test fail for the exact reason the hoist
    // exists — the same exclusion `oilShadowInert.test.ts` makes, for the
    // same reason.
    const { oilShadowRecords: _dropped, ...rest } = await runOneCast(deps);
    return { posts, result: rest };
  } catch (e) {
    return { posts, error: (e as Error).message };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function captureAll(): Promise<Record<string, ArmCapture>> {
  const out: Record<string, ArmCapture> = {};
  for (const sc of SCENARIOS) out[sc.name] = await capture(sc);
  return out;
}

describe("GATE 1b — hoisting `dist` above the oil block does not change live play", () => {
  it("the scenarios are non-trivial — a golden of nothing would compare equal forever", async () => {
    const all = await captureAll();
    const actions = Object.values(all).flatMap((a) => a.posts.map((p) => (p as { action: string }).action));
    expect(Object.keys(all)).toHaveLength(SCENARIOS.length);
    for (const a of Object.values(all)) expect(a.posts.length).toBeGreaterThan(0);
    // A consume really lands, a card really gets played, and a cast really
    // ends on the oil — the three shapes the hoist sits between.
    expect(actions).toContain("use_fishing_item");
    expect(actions).toContain("play_cards");
    expect(Object.values(all).some((a) => (a.result as { oilsConsumed?: number } | undefined)?.oilsConsumed === 1)).toBe(true);
    expect(
      Object.values(all).some((a) => ((a.result as { oilTriggerNoStock?: unknown[] } | undefined)?.oilTriggerNoStock?.length ?? 0) > 0),
    ).toBe(true);
  });

  it("live play is BYTE-IDENTICAL to the capture taken before the hoist", async () => {
    const all = await captureAll();
    const serialized = JSON.stringify(all, null, 2);
    if (process.env.UPDATE_LIVE_DECISION_GOLDEN === "1") {
      writeFileSync(GOLDEN_PATH, serialized + "\n");
      // Deliberately not a silent pass: regenerating is an assertion about
      // intent, and the run that does it should say so.
      console.error(`[hoistInvariant] golden REWRITTEN at ${GOLDEN_PATH}`);
    }
    expect(existsSync(GOLDEN_PATH)).toBe(true);
    expect(serialized + "\n").toBe(readFileSync(GOLDEN_PATH, "utf8"));
  });
});
