/**
 * tests/fishing/oilPartialDry.test.ts — [session 65 §1c, GATE 2] PARTIAL DRY.
 *
 * ## The state, and why it is new
 *
 * *Live-measured, session 64:* stock is **Relaxing 1, Focus 22**. The moment
 * the single Relaxing Oil is spent the bot is in a state no batch has ever
 * been in — **one oil exhausted while the other is plentiful.**
 *
 * Session 62's `oilStockExhaustion.test.ts` covers TOTAL dry (both at zero)
 * and `oilBatch.ts`'s `stock_dry` halt covers both at zero as well. Neither
 * says anything about the asymmetric case, and asymmetry is where the two
 * plausible bugs live:
 *
 *   1. **The dry trigger swallows the funded one.** `onDemandTriggers` returns
 *      `["relaxing", "focus"]` in that order — Relaxing FIRST. So if the loop
 *      over wanted oils ever `break`s on a refusal instead of `continue`ing,
 *      a dry Relaxing trigger silently suppresses a Focus consume that was
 *      fully funded and fully authorized. The dry oil is the one the account
 *      has least of, so this bug hides behind the scarce item.
 *   2. **The batch halts on half a bag.** `stock_dry` is an `&&`. An `||` there
 *      would end a seven-cast batch the moment the Relaxing Oil ran out, with
 *      22 Focus Oils still held and the Focus objective entirely unaffected.
 *
 * Both are silent, both look like ordinary quiet casts, and neither is
 * observable from a passing suite that only tests the symmetric cases.
 *
 * ## Why this is worth a file rather than a case
 *
 * Session 64's headline was a component that was shipped, gated, tested and
 * INERT because nothing handed it its dependency — found only because a live
 * result contradicted a live expectation. Partial dry is that risk in
 * miniature: it is a state no code path had ever executed, and the session-65
 * batch is the first thing that would run it. Testing it BEFORE the batch is
 * the whole point; finding it afterwards would be finding it the expensive way.
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
  onDemandTriggers,
  PAYLOAD_OIL_EFFECTS,
} from "../../src/strategy/fishing/oilTiming.js";
import {
  MID_FOCUS_OIL_ITEM_ID,
  MID_RELAXING_OIL_ITEM_ID,
  type OilBudgetConfig,
} from "../../src/strategy/fishing/oilPolicy.js";
import {
  batchVerdict,
  SESSION_64_LIMITS,
  SESSION_65_LIMITS,
  type BatchState,
} from "../../src/strategy/fishing/oilBatch.js";

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

/** Approved and funded — so the ONLY thing that can refuse a spend here is stock. */
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

/** `focusPoint` is [1,1], NOT [0,0] — `geometry.ts` is one-indexed and this file drives the meter to zero. */
function fakeDoc(opts: { fishHp: number; fishMaxHp: number; focusMeter: number; complete: boolean }) {
  return {
    docId: "77777777",
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

function makeClient(opts: {
  fishHp: number;
  fishMaxHp: number;
  focusMeter: number;
  balances: { focus: number; relaxing: number };
}): { client: GigaverseClient; calls: string[]; itemIds: number[] } {
  const calls: string[] = [];
  const itemIds: number[] = [];
  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => ({
      entities: [
        { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: opts.balances.focus },
        { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: opts.balances.relaxing },
      ],
    }),
    postFishingAction: async (body: { action: string; data: { itemId: number } }) => {
      calls.push(body.action);
      // `itemId` lives under `data`, not at the top level — `buildFishingEnvelope`
      // nests it. A mock that reads `body.itemId` gets `undefined` and an
      // assertion on it passes vacuously against `not.toContain`.
      if (body.action === "use_fishing_item") itemIds.push(body.data.itemId);
      const doc = fakeDoc({
        fishHp: opts.fishHp,
        fishMaxHp: opts.fishMaxHp,
        focusMeter: opts.focusMeter,
        complete: body.action === "play_cards" && calls.filter((a) => a === "play_cards").length >= 2,
      });
      return { success: true, message: body.action === "start_run" ? "Game started successfully." : "ok", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;
  return { client, calls, itemIds };
}

function depsFor(dir: string, client: GigaverseClient): LiveFishingDeps {
  return makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget: APPROVED_BUDGET,
    // Every I/O path isolated to a temp dir — CLAUDE.md's working-style rule.
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath: join(dir, "guard-budget.json"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    logsDir: join(dir, "logs"),
  });
}

// ───────────────────────────────────────────────────────────────────────────
// The premise this whole file rests on, asserted rather than assumed.
// ───────────────────────────────────────────────────────────────────────────

describe("the ORDER of on-demand's triggers is what makes partial dry dangerous", () => {
  it("returns relaxing BEFORE focus, so a dry Relaxing trigger is evaluated first", () => {
    const both = onDemandTriggers(
      { turn: 1, fishHp: 2, fishMaxHp: 20, mana: 5, focusRemaining: 0, focusMax: 3, focusOilHeld: 9, relaxingOilHeld: 0 },
      PAYLOAD_OIL_EFFECTS,
    );
    // If this ever flips, the `break`-vs-`continue` bug stops being reachable
    // through Relaxing and becomes reachable through Focus instead — the test
    // below would still catch it, but its comment would be lying.
    expect(both).toEqual(["relaxing", "focus"]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// GATE 2, cast half — the funded oil still gets spent.
// ───────────────────────────────────────────────────────────────────────────

describe("GATE 2 (cast) — a DRY Relaxing trigger does not suppress a FUNDED Focus consume", () => {
  it("records OIL-POLICY-DRY for relaxing, sends use_fishing_item for focus, and plays the cast out", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-partial-"));
    // fishHp 2 == the payload's fishDamage, so the LETHAL (relaxing) trigger
    // fires; meter 0 fires the FOCUS trigger. PARTIAL stock: no Relaxing, ample
    // Focus — the live shape once the single Relaxing Oil is spent.
    const { client, calls, itemIds } = makeClient({
      fishHp: 2, fishMaxHp: 20, focusMeter: 0, balances: { focus: 22, relaxing: 0 },
    });

    const result = await runOneCast(depsFor(dir, client));

    // THE LOAD-BEARING ASSERTION. The Focus Oil was actually sent, despite the
    // Relaxing trigger being refused first in the same turn.
    expect(calls).toContain("use_fishing_item");
    expect(itemIds).toContain(MID_FOCUS_OIL_ITEM_ID);
    expect(itemIds).not.toContain(MID_RELAXING_OIL_ITEM_ID);
    expect(result.oilsConsumed).toBeGreaterThan(0);

    // The dry half is RECORDED, not swallowed — and only the dry half.
    expect(new Set(result.oilTriggerNoStock.map((r) => r.kind))).toContain("relaxing");
    expect(result.oilTriggerNoStock.every((r) => r.reason === "empty")).toBe(true);

    // The cast CONTINUED to a real terminal outcome and really played cards.
    expect(result.outcome).toBe("escaped");
    expect(calls).toContain("play_cards");

    // The sidecar records this cast as what it is: dry triggers AND a consume.
    // A row with `oilsConsumed: 0` here would mean the consume went unrecorded.
    const rows = readFileSync(join(dir, "oil-cast-states.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(rows).toHaveLength(1);
    expect(rows[0].dryTriggers).toBeGreaterThan(0);
    expect(rows[0].reasons).toEqual(["empty"]);

    rmSync(dir, { recursive: true, force: true });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// GATE 2, batch half — half a bag is not an empty bag.
// ───────────────────────────────────────────────────────────────────────────

describe("GATE 2 (batch) — partial dry does not halt the batch under EITHER shape", () => {
  const partialDry: BatchState = {
    castsPlayed: 2,
    oilsConsumed: 0,
    cleanCasts: 2,
    ledgerCastsRemaining: 5,
    focusOilHeld: 22,
    relaxingOilHeld: 0, // the scarce oil is gone; the plentiful one is not
    zeroStreak: 0,
  };

  it("keeps going under the session-65 shape — the Focus objective is unaffected", () => {
    const v = batchVerdict(partialDry, SESSION_65_LIMITS);
    expect(v.stop).toBe(false);
    expect(v.reason).toBeNull();
  });

  it("keeps going under the session-64 shape too — `stock_dry` was always BOTH oils", () => {
    const v = batchVerdict(partialDry, SESSION_64_LIMITS);
    expect(v.stop).toBe(false);
  });

  it("the mirror image also keeps going — Focus dry, Relaxing held", () => {
    expect(batchVerdict({ ...partialDry, focusOilHeld: 0, relaxingOilHeld: 1 }, SESSION_65_LIMITS).stop).toBe(false);
  });

  it("and TOTAL dry still halts under the shape whose exit it makes unreachable", () => {
    const total = { ...partialDry, focusOilHeld: 0, relaxingOilHeld: 0 };
    const v = batchVerdict(total, SESSION_64_LIMITS);
    expect(v.stop).toBe(true);
    expect(v.reason).toBe("stock_dry");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §1b — the session-65 shape's own exits, which INVERT session 64's.
// ───────────────────────────────────────────────────────────────────────────

describe("§1b — the seven-cast batch does not stop on a consume", () => {
  const mid: BatchState = {
    castsPlayed: 3,
    oilsConsumed: 2,
    cleanCasts: 1,
    ledgerCastsRemaining: 4,
    focusOilHeld: 20,
    relaxingOilHeld: 0,
    zeroStreak: 0,
  };

  it("a consume mid-batch is a CAPTURE, not an exit", () => {
    expect(batchVerdict(mid, SESSION_65_LIMITS).stop).toBe(false);
    // The same state under session 64's shape is the intended exit — which is
    // what shows the two shapes really do differ here.
    expect(batchVerdict(mid, SESSION_64_LIMITS)).toMatchObject({ stop: true, reason: "oil_consumed" });
  });

  it("seven completed casts is the intended exit, and says so even with consumes", () => {
    const v = batchVerdict({ ...mid, castsPlayed: 7 }, SESSION_65_LIMITS);
    expect(v).toMatchObject({ stop: true, reason: "cast_cap" });
    expect(v.detail).toContain("intended exit");
  });

  it("the ledger still outranks everything but the intended exit", () => {
    expect(batchVerdict({ ...mid, ledgerCastsRemaining: 0 }, SESSION_65_LIMITS)).toMatchObject({
      stop: true,
      reason: "ledger_exhausted",
    });
  });

  it("the zero-streak tripwire is still armed at 15", () => {
    expect(batchVerdict({ ...mid, zeroStreak: 15 }, SESSION_65_LIMITS)).toMatchObject({
      stop: true,
      reason: "zero_streak",
    });
    expect(batchVerdict({ ...mid, zeroStreak: 14 }, SESSION_65_LIMITS).stop).toBe(false);
  });

  it("six clean casts REPORTS but does not halt — the pre-registration is kept, the halt is not", () => {
    const sixClean = { ...mid, oilsConsumed: 0, cleanCasts: 6, castsPlayed: 6 };
    expect(batchVerdict(sixClean, SESSION_65_LIMITS).stop).toBe(false);
    // Session 64's shape halted here, and still does. This is an added shape,
    // not a retuned one.
    expect(batchVerdict(sixClean, SESSION_64_LIMITS)).toMatchObject({ stop: true, reason: "clean_cast_cap" });
  });
});
