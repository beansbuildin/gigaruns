/**
 * tests/fishing/oilDoubleLethalLive.test.ts — [session 90 §1a] the double-lethal
 * band, exercised through `runOneCast`'s ACTUAL consume loop.
 *
 * ## Why this file exists, and what it is not
 *
 * `tests/fishing/oilDoubleLethal.test.ts` pins `doubleLethalTriggers` as a pure
 * function — 19 assertions, none of which touch `scripts/liveFishing.ts`. That
 * left the load-bearing half of session 89's finding unexercised: the claim
 * that *"the live executor CAN consume the same kind twice in one turn"* was a
 * **code-reading claim**, argued from `for (const kind of oilWanted)` and from
 * which variables update inside the loop. Sound reasoning, never run.
 *
 * The wiring in session 90 §1 turned that reading into live behaviour on the
 * user's explicit override (`QUESTIONS.md` §30 — and note the sim recommends
 * AGAINST this trigger; this file tests that it works, not that it is wise).
 * A code-reading claim is not a thing to ship real oil stock on, so this file
 * runs the sequence a server would actually see.
 *
 * ## The case worth being paranoid about
 *
 * Session 68's `COMPLETE_CID` break was LIVE-FOUND and cost a cast: a lethal
 * consume ends the cast mid-loop, and the next consume in the same decision
 * array is then sent against a finished cast, is rejected HTTP 400, and — per
 * session 65 — still advances the server's action token, making the cast
 * unrecoverable.
 *
 * `doubleLethalTriggers` returns `["relaxing", "relaxing", ...base]`, and
 * `base` can carry a trailing `"focus"`. In that shape the SECOND relaxing is
 * the lethal one, so the mid-sequence break is not a theoretical concern — it
 * is on the happy path of the new trigger, every time the meter is also empty.
 * Session 89's argument that the band is safe reasons about the FIRST oil
 * (which provably cannot kill) and is correct about it; it does not cover the
 * third entry. `the trailing focus entry` block below is that case, run.
 *
 * ## The fish HP arithmetic is DERIVED, not written down
 *
 * `BAND_HP` comes from `PAYLOAD_OIL_EFFECTS.fishDamage`, and the mock decrements
 * by the same field. If the payload's damage is ever re-measured, this file
 * follows it instead of silently testing a band that no longer exists.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { fakeCard, fakeDoc } from "../helpers/fishingDoc.js";
import { board, distAt, oilState } from "../helpers/oilDecisionState.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";
import {
  PAYLOAD_OIL_EFFECTS,
  doubleLethalTriggers,
  onDemandTriggers,
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

/**
 * The user's REAL per-item ceiling, not a convenient one: `perItemMaxPerCast`
 * `{"937": 2}` is what `config/bot.json` has carried since session 69 §4 on the
 * user's own directive. Testing against a laxer cap would prove the loop can
 * send two oils while saying nothing about whether the SHIPPED budget permits
 * it — which is the only question that matters now the trigger is wired.
 */
const APPROVED_BUDGET: OilBudgetConfig = {
  allowedItemIds: [MID_FOCUS_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID],
  maxPerCast: 3,
  perItemMaxPerCast: { [String(MID_RELAXING_OIL_ITEM_ID)]: 2 },
  policyApproved: true,
};

/** The bottom of the band: one oil leaves the fish alive, two finish it. */
const BAND_HP = PAYLOAD_OIL_EFFECTS.fishDamage + 1;

/**
 * A hand that CANNOT guarantee the kill, which is the trigger's own condition.
 * Hit amount one below the fish's HP, so `killProbabilityAt` is 0 for both the
 * hit and (with no crit zones) the crit branch — `bestKillProbability` is 0,
 * comfortably under the cutoff of 1.
 */
const CANNOT_KILL = [fakeCard({ id: 1, hitAmount: BAND_HP - 1 })];

interface MockOpts {
  /** `0` puts the meter at empty, which is what makes `onDemandTriggers` add the trailing `"focus"`. */
  focusMeter: number;
  balances: { focus: number; relaxing: number };
}

/**
 * A server that plays the band honestly: every `use_fishing_item` takes
 * `fishDamage` off the fish, and the cast COMPLETES the moment the fish reaches
 * zero — mid-loop, exactly as the live server did on cast 13024xxx.
 *
 * Slot reuse throws HTTP 400 the way the real one does, so a loop that aimed
 * two consumes at the same slot would fail here rather than pass quietly.
 */
function makeClient(opts: MockOpts): {
  client: GigaverseClient;
  calls: string[];
  itemIds: number[];
  slots: number[];
} {
  const calls: string[] = [];
  const itemIds: number[] = [];
  const slots: number[] = [];
  const slotUsed = [false, false, false];
  let fishHp = BAND_HP;
  let plays = 0;

  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => ({
      entities: [
        { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: opts.balances.focus },
        { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: opts.balances.relaxing },
      ],
    }),
    postFishingAction: async (body: { action: string; data: { slotIndex: number; itemId: number } }) => {
      calls.push(body.action);
      if (body.action === "use_fishing_item") {
        if (slotUsed[body.data.slotIndex]) throw new Error("HTTP 400 — slot already used");
        slotUsed[body.data.slotIndex] = true;
        itemIds.push(body.data.itemId);
        slots.push(body.data.slotIndex);
        // Only the RELAXING oil damages the fish. A focus consume that reduced
        // fish HP would hide the very ordering this file is about.
        if (body.data.itemId === MID_RELAXING_OIL_ITEM_ID) fishHp -= PAYLOAD_OIL_EFFECTS.fishDamage;
      }
      if (body.action === "play_cards") plays += 1;
      const dead = fishHp <= 0;
      const doc = fakeDoc({
        docId: "77777777",
        fishHp: Math.max(0, fishHp),
        fishMaxHp: 20,
        focusMeter: opts.focusMeter,
        cards: CANNOT_KILL,
        // The fish dying ENDS the cast, whatever action ended it. `plays >= 2`
        // is only the escape hatch so a non-firing control cast terminates.
        complete: dead || plays >= 2,
        success: dead,
        slotUsed,
      });
      return {
        success: true,
        message: body.action === "start_run" ? "Game started successfully." : "ok",
        data: { doc, events: [] },
        actionToken: 1,
      };
    },
  } as unknown as GigaverseClient;

  return { client, calls, itemIds, slots };
}

function depsFor(dir: string, client: GigaverseClient, events: Record<string, unknown>[]): LiveFishingDeps {
  return makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget: APPROVED_BUDGET,
    // The log is the only place `oil_skipped_cast_complete` is observable, and
    // that event IS the session-68 break firing. Capturing it is how this file
    // distinguishes "the third consume was skipped" from "the third consume was
    // never wanted in the first place".
    log: { write: (e: Record<string, unknown>) => { events.push(e); }, filePath: "test.jsonl" } as unknown as LiveFishingDeps["log"],
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
// The premise: this really is a state the OLD trigger would have spent nothing on.
// ───────────────────────────────────────────────────────────────────────────

describe("the band state is one the SHIPPED-YESTERDAY trigger declined", () => {
  /** The same state the mocked cast starts in, expressed through the shared builder. */
  const bandState = (relaxingOilHeld: number, fishHp = BAND_HP) =>
    oilState({
      turn: 1,
      fishHp,
      fishMaxHp: 20,
      mana: 10,
      focusRemaining: 3,
      focusOilHeld: 0,
      relaxingOilHeld,
      board: board({ hand: CANNOT_KILL, dist: distAt({ x: 2, y: 2 }) }),
    });

  it("on-demand wants no relaxing oil here, and double-lethal wants two", () => {
    const s = bandState(2);
    // If this ever stops holding, the integration assertions below are testing
    // a band that no longer separates the two policies and would pass vacuously.
    expect(onDemandTriggers(s, PAYLOAD_OIL_EFFECTS)).toEqual([]);
    expect(doubleLethalTriggers(s, PAYLOAD_OIL_EFFECTS)).toEqual(["relaxing", "relaxing"]);
  });

  it("a genuinely LETHAL fish is untouched — the base case is returned verbatim", () => {
    // The claim the whole override rests on: single-oil behaviour is preserved
    // BY CONSTRUCTION. Pinned here too because this file is what a reader
    // checks when the live loop misbehaves.
    const s = bandState(3, PAYLOAD_OIL_EFFECTS.fishDamage);
    expect(doubleLethalTriggers(s, PAYLOAD_OIL_EFFECTS)).toEqual(onDemandTriggers(s, PAYLOAD_OIL_EFFECTS));
    expect(doubleLethalTriggers(s, PAYLOAD_OIL_EFFECTS)).toEqual(["relaxing"]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §1a — two POSTs, two slots, through the real loop.
// ───────────────────────────────────────────────────────────────────────────

describe("the live consume loop sends TWO relaxing oils in one turn", () => {
  it("issues two use_fishing_item POSTs, into two DIFFERENT slots, and lands the catch", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-dbl-pair-"));
    const events: Record<string, unknown>[] = [];
    // Meter FULL, so the focus arm stays out of it and the decision array is
    // exactly ["relaxing", "relaxing"].
    const { client, calls, itemIds, slots } = makeClient({ focusMeter: 3, balances: { focus: 0, relaxing: 2 } });

    const result = await runOneCast(depsFor(dir, client, events));

    expect(calls.filter((a) => a === "use_fishing_item")).toHaveLength(2);
    expect(itemIds).toEqual([MID_RELAXING_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID]);
    // Two DISTINCT slots — the cursor advanced. A hard-coded 0 would have
    // thrown HTTP 400 in the mock, which is what cost cast 13019682 live.
    expect(new Set(slots).size).toBe(2);
    expect(slots).toEqual([0, 1]);
    // The per-kind counter reached 2 — observable here as two AUTHORISED
    // spends against a `perItemMaxPerCast` of exactly 2. A loop that had not
    // incremented `oilsUsedThisCastOf` would have been refused on the second.
    expect(result.oilsConsumed).toBe(2);
    expect(events.filter((e) => e.event === "oil_spend_refused")).toEqual([]);
    expect(result.oilTriggerNoStock).toEqual([]);
    // The second oil was LETHAL: the fish died mid-loop and no card was played.
    expect(result.outcome).toBe("caught");
    expect(calls).not.toContain("play_cards");

    rmSync(dir, { recursive: true, force: true });
  });

  it("spends only what is HELD — one oil in the bag means the band never fires at all", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-dbl-one-"));
    const events: Record<string, unknown>[] = [];
    const { client, calls } = makeClient({ focusMeter: 3, balances: { focus: 0, relaxing: 1 } });

    const result = await runOneCast(depsFor(dir, client, events));

    // `doubleLethalTriggers` guards on `relaxingOilHeld >= 2` BEFORE firing, so
    // this is not "the second was refused" — the pair was never wanted. That
    // distinction matters: a refusal would flag the cast out of both arms.
    expect(calls).not.toContain("use_fishing_item");
    expect(result.oilsConsumed).toBe(0);
    expect(result.oilTriggerNoStock).toEqual([]);

    rmSync(dir, { recursive: true, force: true });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §1a — the case worth being paranoid about: the trailing focus entry.
// ───────────────────────────────────────────────────────────────────────────

describe("a trailing focus entry after a LETHAL second relaxing — session 68's break, on the new trigger's happy path", () => {
  it("stops at the completed cast instead of sending a third POST", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-dbl-complete-"));
    const events: Record<string, unknown>[] = [];
    // Meter EMPTY: `onDemandTriggers` adds "focus", so the decision array is
    // ["relaxing", "relaxing", "focus"] — and the fish dies on entry two.
    const { client, calls, itemIds } = makeClient({ focusMeter: 0, balances: { focus: 3, relaxing: 2 } });

    const result = await runOneCast(depsFor(dir, client, events));

    // Exactly two POSTs. The third was WANTED (focus oil held, budget ample,
    // a free slot available) and was correctly not sent.
    expect(calls.filter((a) => a === "use_fishing_item")).toHaveLength(2);
    expect(itemIds).toEqual([MID_RELAXING_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID]);
    expect(itemIds).not.toContain(MID_FOCUS_OIL_ITEM_ID);
    expect(result.oilsConsumed).toBe(2);

    // ...and it was stopped by session 68's break specifically, not by luck,
    // by stock, or by a budget refusal. This is the assertion that would catch
    // the break being removed as "unreachable".
    const skipped = events.filter((e) => e.event === "oil_skipped_cast_complete");
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatchObject({ kind: "focus" });
    expect(events.filter((e) => e.event === "action_failed")).toEqual([]);

    expect(result.outcome).toBe("caught");

    rmSync(dir, { recursive: true, force: true });
  });
});
