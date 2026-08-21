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
import { fakeDoc as sharedFakeDoc } from "../helpers/fishingDoc.js";

import { runOneCast, nextConsumableSlot, type LiveFishingDeps } from "../../scripts/liveFishing.js";
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

/**
 * [session 67 §2] **The ONE builder lives in `tests/helpers/fishingDoc.ts`.**
 * This wrapper keeps only this file's docId; it holds NO field list of its own.
 * The `focusPoint`/`fishingConsumableSlotUsed` reasoning that used to live here
 * moved there verbatim, because it is the reasoning that has to survive, not
 * the copy of the literal it was attached to.
 */
const fakeDoc = (opts: { fishHp: number; fishMaxHp: number; focusMeter: number; complete: boolean; slotUsed: boolean[] }) =>
  sharedFakeDoc({ docId: "77777777", ...opts });

function makeClient(opts: {
  fishHp: number;
  fishMaxHp: number;
  focusMeter: number;
  balances: { focus: number; relaxing: number };
  /** Pre-spent slots, for the "no slot left" case. Defaults to a fresh ledger. */
  slotUsed?: boolean[];
}): { client: GigaverseClient; calls: string[]; itemIds: number[]; slots: number[]; slotUsed: boolean[] } {
  const calls: string[] = [];
  const itemIds: number[] = [];
  const slots: number[] = [];
  const slotUsed = opts.slotUsed ?? [false, false, false];
  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => ({
      entities: [
        { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: opts.balances.focus },
        { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: opts.balances.relaxing },
      ],
    }),
    postFishingAction: async (body: { action: string; data: { itemId: number; slotIndex: number } }) => {
      calls.push(body.action);
      // `itemId` lives under `data`, not at the top level — `buildFishingEnvelope`
      // nests it. A mock that reads `body.itemId` gets `undefined` and an
      // assertion on it passes vacuously against `not.toContain`.
      if (body.action === "use_fishing_item") {
        // THE SERVER'S OWN RULE, reproduced from the live HTTP 400 on cast
        // 13019682: a consume aimed at a slot already marked used is rejected.
        // Without this the mock accepts slot 0 forever and the cursor could
        // regress to a constant with every test still green.
        if (slotUsed[body.data.slotIndex]) throw new Error("HTTP 400 — slot already used");
        slotUsed[body.data.slotIndex] = true;
        slots.push(body.data.slotIndex);
        itemIds.push(body.data.itemId);
      }
      const doc = fakeDoc({
        fishHp: opts.fishHp,
        fishMaxHp: opts.fishMaxHp,
        focusMeter: opts.focusMeter,
        complete: body.action === "play_cards" && calls.filter((a) => a === "play_cards").length >= 2,
        slotUsed,
      });
      return { success: true, message: body.action === "start_run" ? "Game started successfully." : "ok", data: { doc, events: [] }, actionToken: 1 };
    },
  } as unknown as GigaverseClient;
  return { client, calls, itemIds, slots, slotUsed };
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
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
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
    shadowBlindRelaxingFirings: 0,
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
    shadowBlindRelaxingFirings: 0,
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

// ───────────────────────────────────────────────────────────────────────────
// [session 65, LIVE-MEASURED] The consumable slot is a CURSOR, not a constant.
//
// Cast 13019682 spent a Focus Oil at slot 0, hit `focusMeter: 0` again two
// turns later, and sent a SECOND consume at slot 0 — the hard-coded value that
// had stood at that call site since session 44. The server rejected it with
// HTTP 400, having already marked `fishingConsumableSlotUsed [T,F,F]`.
//
// This is exactly the question session 64 recorded as open ("`slotIndex` for a
// SECOND consume within one cast is UNCONFIRMED"). The answer is that there is
// no single right index: it is a cursor over the server's own three-slot
// ledger, and the ledger is on every state.
// ───────────────────────────────────────────────────────────────────────────

describe("nextConsumableSlot — the cursor over the server's own slot ledger", () => {
  it("returns 0 on a fresh cast", () => {
    expect(nextConsumableSlot([false, false, false])).toBe(0);
  });

  it("returns 1 once slot 0 is spent — THE BUG, stated as a test", () => {
    // The live state that produced the HTTP 400. A hard-coded 0 here is what
    // cost cast 13019682 its remaining turns.
    expect(nextConsumableSlot([true, false, false])).toBe(1);
  });

  it("walks the whole ledger", () => {
    expect(nextConsumableSlot([true, true, false])).toBe(2);
  });

  it("returns null when every slot is spent — no wrap-around onto a used slot", () => {
    expect(nextConsumableSlot([true, true, true])).toBeNull();
  });

  it("returns null rather than guessing 0 when the server sends no ledger", () => {
    // Fails CLOSED (rule 5). Guessing 0 on an absent field is the same class
    // of mistake as the hard-code, just harder to see.
    expect(nextConsumableSlot(undefined)).toBeNull();
    expect(nextConsumableSlot([])).toBeNull();
  });

  it("skips a ledger that is out of order rather than assuming slots fill left to right", () => {
    expect(nextConsumableSlot([false, true, false])).toBe(0);
    expect(nextConsumableSlot([true, false, true])).toBe(1);
  });
});

describe("[session 65] a SECOND consume in one cast targets the next free slot, live", () => {
  it("sends slotIndex 0 then slotIndex 1 when the meter empties twice", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-slot-"));
    // Meter empty on every state, so the FOCUS trigger fires every turn —
    // precisely the live shape that exposed the bug on cast 13019682.
    const { client, slots, calls } = makeClient({
      fishHp: 9, fishMaxHp: 20, focusMeter: 0, balances: { focus: 22, relaxing: 0 },
    });

    const result = await runOneCast(depsFor(dir, client));

    // Distinct, ascending slots — never the same slot twice. The mock throws
    // on a repeat, so a regression to a hard-coded 0 fails here loudly.
    expect(slots.length).toBeGreaterThanOrEqual(2);
    expect(slots.slice(0, 2)).toEqual([0, 1]);
    expect(new Set(slots).size).toBe(slots.length);
    // And the cast survived to a real outcome, which it does not if a consume
    // is rejected — a rejection now fails the whole cast closed, by design.
    expect(result.outcome).toBe("escaped");
    expect(calls).toContain("play_cards");

    rmSync(dir, { recursive: true, force: true });
  });

  it("stops sending consumes once all three slots are spent, and plays on", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-slotfull-"));
    const { client, calls } = makeClient({
      fishHp: 9, fishMaxHp: 20, focusMeter: 0, balances: { focus: 22, relaxing: 0 },
      slotUsed: [true, true, true],
    });

    const result = await runOneCast(depsFor(dir, client));

    // MAX_CONSUMABLE_SLOTS is 3 and all three are gone, so nothing is sent —
    // but this is ORDINARY PLAY, not a failure. Fail-closed here means "do not
    // send", not "abort the cast".
    expect(calls).not.toContain("use_fishing_item");
    expect(calls).toContain("play_cards");
    expect(result.outcome).toBe("escaped");

    rmSync(dir, { recursive: true, force: true });
  });
});
