/**
 * tests/fishing/oilStockExhaustion.test.ts — [session 62 §1a/§1b, GATE 1 and 2]
 *
 * Two things the session-62 brief asked to be EXERCISED rather than written:
 *
 *   GATE 1 — a trigger fires, stock is zero, `mayConsumeOil` refuses, and the
 *            cast completes as ORDINARY PLAY. An empty consumable is an
 *            EXPECTED state; CLAUDE.md rule 5 governs unexpected ones, so this
 *            path must degrade, not fail closed and not abort the cast.
 *   GATE 2 — reinstating session 43's heuristic (c) in `liveFishing.ts` FAILS a
 *            test, and the test is pinned on the TRIGGER'S SHAPE rather than on
 *            a literal threshold.
 *
 * Why the stock path is the one that matters: the user holds a few oils, fewer
 * than a batch needs, and `on-demand` spends ~0.70 oils per cast, so a five-cast
 * batch expects ~3.5. **Stock runs out mid-batch, not between batches.**
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";
import {
  heuristicC,
  onDemandTriggers,
  PAYLOAD_OIL_EFFECTS,
  type OilTimingState,
} from "../../src/strategy/fishing/oilTiming.js";
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

/** Approved and funded — so the ONLY thing that can refuse a spend in these tests is stock. */
const APPROVED_BUDGET: OilBudgetConfig = {
  allowedItemIds: [MID_FOCUS_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID],
  maxPerCast: 3,
  policyApproved: true,
};

function fakeCard() {
  return {
    id: 1,
    manaCost: 1,
    hitZones: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    critZones: [],
    hitEffects: [{ type: "FISH_HP", amount: 5 }],
    missEffects: [{ type: "FISH_HP", amount: -3 }],
    critEffects: [],
    earnable: false,
    rarity: 0,
    isDayCard: false,
    foundInPonds: [1],
  };
}

function fakeDoc(opts: { fishHp: number; fishMaxHp: number; focusMeter: number; complete: boolean }) {
  return {
    docId: "88888888",
    docType: "FISHING_GAME",
    data: {
      deckCardData: [fakeCard()],
      playerMaxHp: 10,
      playerHp: 10,
      fishHp: opts.fishHp,
      fishMaxHp: opts.fishMaxHp,
      fishPosition: [1, 1],
      previousFishPosition: [1, 2],
      gridSize: 4,
      // [1,1], NOT [0,0]. `geometry.ts`'s `allCells` is ONE-indexed (x,y from
      // 1..gridSize), so [0,0] is off-grid. That is harmless at a full meter —
      // `reachableCells` at distance 3 still reaches real cells — but at
      // `focusMeter: 0` the reachable set is EMPTY and `bestFocusForCard`
      // throws "gridSize must be >= 1". The meter-at-zero state is precisely
      // what the Focus Oil trigger fires on, so an off-grid focus point makes
      // this whole file untestable. `tests/liveFishing.test.ts`'s older mock
      // still uses [0,0] and gets away with it only because nothing there
      // drives the meter to zero.
      focusPoint: [1, 1],
      focusMeter: opts.focusMeter,
      focusMeterMax: 3,
      focusMechanicEnabled: true,
      patternIndex: 0,
      fullDeck: [1],
      nextCardIndex: 1,
      cardInDrawPile: 0,
      hand: [1],
      discard: [],
    },
    COMPLETE_CID: opts.complete,
    SUCCESS_CID: opts.complete ? false : undefined,
    IS_JUICED_CID: false,
    MULTIPLIER_CID: 1,
  };
}

/**
 * `balances` is what `getItemsBalances` reports for the two oils. `null` makes
 * the READ ITSELF throw, which is the separate `"balance_unknown"` case.
 */
function makeClient(opts: {
  fishHp: number;
  fishMaxHp: number;
  focusMeter: number;
  balances: { focus: number; relaxing: number } | null;
}): { client: GigaverseClient; calls: string[] } {
  const calls: string[] = [];
  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => {
      if (opts.balances === null) throw new Error("simulated balance read failure");
      return {
        entities: [
          { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: opts.balances.focus },
          { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: opts.balances.relaxing },
        ],
      };
    },
    postFishingAction: async (body: { action: string }) => {
      calls.push(body.action);
      const doc = fakeDoc({
        fishHp: opts.fishHp,
        fishMaxHp: opts.fishMaxHp,
        focusMeter: opts.focusMeter,
        // start_run plus one play_cards, then the cast ends — enough turns for
        // a trigger to fire, few enough that the test is fast and total.
        complete: body.action === "play_cards" && calls.filter((a) => a === "play_cards").length >= 2,
      });
      return { success: true, message: body.action === "start_run" ? "Game started successfully." : "Cards played successfully.", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;
  return { client, calls };
}

function depsFor(dir: string, client: GigaverseClient, oilBudget?: OilBudgetConfig): LiveFishingDeps {
  return makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget,
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath: join(dir, "guard-budget.json"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    logsDir: join(dir, "logs"),
  });
}

// ───────────────────────────────────────────────────────────────────────────
// GATE 1 — the stock-exhaustion path, exercised.
// ───────────────────────────────────────────────────────────────────────────

describe("GATE 1 — a trigger firing against ZERO stock degrades to ordinary play", () => {
  it("plays the cast to a normal outcome, sends no use_fishing_item, and records the third state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-dry-"));
    // fishHp 2 == the payload's fishDamage, so the LETHAL trigger fires; the
    // meter at 0 fires the FOCUS trigger. Both wanted, neither held.
    const { client, calls } = makeClient({ fishHp: 2, fishMaxHp: 20, focusMeter: 0, balances: { focus: 0, relaxing: 0 } });
    const deps = depsFor(dir, client, APPROVED_BUDGET);

    const result = await runOneCast(deps);

    // ORDINARY PLAY: the cast ran to a real terminal outcome and cards were
    // actually played. It did not abort, and it did not fail closed.
    expect(result.outcome).toBe("escaped");
    expect(calls).toContain("play_cards");
    // Nothing was spent — there was nothing to spend.
    expect(calls).not.toContain("use_fishing_item");

    // THE THIRD STATE was recorded, with both triggers represented.
    expect(result.oilTriggerNoStock.length).toBeGreaterThan(0);
    expect(new Set(result.oilTriggerNoStock.map((r) => r.kind))).toEqual(new Set(["relaxing", "focus"]));
    // The balance WAS read and reported zero, so this is "empty" — a fact about
    // the user's stock — not "balance_unknown".
    expect(new Set(result.oilTriggerNoStock.map((r) => r.reason))).toEqual(new Set(["empty"]));

    // ...and persisted to the sidecar, which is what keeps the cast out of both arms.
    const rows = readFileSync(join(dir, "oil-cast-states.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ castId: "88888888", oilsConsumed: 0, reasons: ["empty"] });
    expect(rows[0].dryTriggers).toBeGreaterThan(0);

    rmSync(dir, { recursive: true, force: true });
  });

  it("separates 'the account holds none' from 'we never found out' — a FAILED balance read is not evidence about stock", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-unknown-"));
    const { client, calls } = makeClient({ fishHp: 2, fishMaxHp: 20, focusMeter: 0, balances: null });
    const deps = depsFor(dir, client, APPROVED_BUDGET);

    const result = await runOneCast(deps);

    expect(result.outcome).toBe("escaped");
    expect(calls).not.toContain("use_fishing_item");
    // Same exclusion, DIFFERENT reason. Both keep the cast out of both arms;
    // only "empty" says anything about how many oils the user has left.
    expect(new Set(result.oilTriggerNoStock.map((r) => r.reason))).toEqual(new Set(["balance_unknown"]));

    rmSync(dir, { recursive: true, force: true });
  });

  it("a cast that never fires a trigger writes NO sidecar row — an empty ledger is the normal state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-quiet-"));
    // Fish well above lethal, meter not empty: neither trigger fires.
    const { client } = makeClient({ fishHp: 9, fishMaxHp: 20, focusMeter: 3, balances: { focus: 0, relaxing: 0 } });
    const result = await runOneCast(depsFor(dir, client, APPROVED_BUDGET));

    expect(result.oilTriggerNoStock).toEqual([]);
    expect(() => readFileSync(join(dir, "oil-cast-states.jsonl"), "utf8")).toThrow();

    rmSync(dir, { recursive: true, force: true });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// GATE 2 — heuristic (c) cannot come back.
// ───────────────────────────────────────────────────────────────────────────

describe("GATE 2 — the shipped live trigger is on-demand's, not heuristic (c)'s", () => {
  /**
   * The discriminating state is DERIVED from the two policies rather than
   * written down, which is what makes this a pin on the trigger's SHAPE. A
   * fraction-of-max rule and a lethality rule differ exactly on fish where the
   * fraction exceeds the oil's damage; this finds such a fish by asking the
   * policies, so it keeps discriminating if either threshold is ever retuned.
   */
  function discriminatingFishHp(fishMaxHp: number): number {
    const base: OilTimingState = {
      turn: 1, fishHp: 0, fishMaxHp, mana: 5,
      focusRemaining: 3, focusMax: 3, focusOilHeld: 1, relaxingOilHeld: 1,
    };
    for (let hp = 1; hp <= fishMaxHp; hp++) {
      const s = { ...base, fishHp: hp };
      const cFires = heuristicC.decide(s, PAYLOAD_OIL_EFFECTS).includes("relaxing");
      const onDemandFires = onDemandTriggers(s, PAYLOAD_OIL_EFFECTS).includes("relaxing");
      if (cFires && !onDemandFires) return hp;
    }
    throw new Error("no fish HP separates heuristic (c) from the lethal trigger — the domination claim is void");
  }

  it("such a fish EXISTS — the two rules really do differ, which is the premise of replacing one with the other", () => {
    // If this ever stops holding, OIL-POLICY.md's "44% more oil for
    // indistinguishable benefit" has lost its mechanism and the replacement
    // needs re-arguing rather than re-asserting.
    expect(discriminatingFishHp(20)).toBeGreaterThan(PAYLOAD_OIL_EFFECTS.fishDamage);
  });

  it("on a fish where heuristic (c) WOULD spend and lethality would not, the live loop spends NOTHING", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-heuristic-c-"));
    const fishMaxHp = 20;
    const fishHp = discriminatingFishHp(fishMaxHp);
    // Stock is deliberately AMPLE and the budget approved, so the only thing
    // that can hold the spend back is the trigger itself. Meter kept full so
    // the focus trigger stays out of it.
    const { client, calls } = makeClient({ fishHp, fishMaxHp, focusMeter: 3, balances: { focus: 5, relaxing: 5 } });

    const result = await runOneCast(depsFor(dir, client, APPROVED_BUDGET));

    // Reinstating heuristic (c) in `liveFishing.ts` makes this line fail: (c)
    // fires at this fish HP and would POST a use_fishing_item.
    expect(calls).not.toContain("use_fishing_item");
    // ...and it is not merely that nothing could be spent.
    expect(result.oilTriggerNoStock).toEqual([]);

    rmSync(dir, { recursive: true, force: true });
  });

  it("the same loop DOES spend once the fish is genuinely lethal — proving the previous test isn't passing because oils are broken", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-lethal-"));
    const { client, calls } = makeClient({
      fishHp: PAYLOAD_OIL_EFFECTS.fishDamage, fishMaxHp: 20, focusMeter: 3, balances: { focus: 5, relaxing: 5 },
    });

    await runOneCast(depsFor(dir, client, APPROVED_BUDGET));

    expect(calls).toContain("use_fishing_item");

    rmSync(dir, { recursive: true, force: true });
  });
});
