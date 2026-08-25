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
import { fakeDoc as sharedFakeDoc, CANNOT_FINISH_CARD } from "../helpers/fishingDoc.js";

import { runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { board, card, oilState } from "../helpers/oilDecisionState.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";
import {
  doubleLethalTriggers,
  heuristicC,
  PAYLOAD_OIL_EFFECTS,
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

/**
 * [session 67 §2] **The ONE builder lives in `tests/helpers/fishingDoc.ts`.**
 * This wrapper keeps only this file's docId; it holds NO field list of its own.
 * The `focusPoint`/`fishingConsumableSlotUsed` reasoning that used to live here
 * moved there verbatim, because it is the reasoning that has to survive, not
 * the copy of the literal it was attached to.
 */
const fakeDoc = (opts: { fishHp: number; fishMaxHp: number; focusMeter: number; complete: boolean; slotUsed: boolean[] }) =>
  sharedFakeDoc({ docId: "88888888", cards: [CANNOT_FINISH_CARD], ...opts });

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
  const slotUsed = [false, false, false];
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
    postFishingAction: async (body: { action: string; data: { slotIndex: number } }) => {
      calls.push(body.action);
      if (body.action === "use_fishing_item") {
        if (slotUsed[body.data.slotIndex]) throw new Error("HTTP 400 — slot already used");
        slotUsed[body.data.slotIndex] = true;
      }
      const doc = fakeDoc({
        fishHp: opts.fishHp,
        fishMaxHp: opts.fishMaxHp,
        focusMeter: opts.focusMeter,
        // start_run plus one play_cards, then the cast ends — enough turns for
        // a trigger to fire, few enough that the test is fast and total.
        complete: body.action === "play_cards" && calls.filter((a) => a === "play_cards").length >= 2,
        slotUsed,
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
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
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
   *
   * **[session 90 §1] It now asks the SHIPPED trigger, which is no longer
   * `onDemandTriggers`.** This test failed the moment `liveFishing.ts` was
   * wired to `doubleLethalTriggers`, and it failed CORRECTLY: against a
   * 20-HP fish the separating hp was 3, which is exactly the bottom of the
   * new double-lethal band, so the live loop really does spend there now. The
   * fix is not to loosen the assertion — GATE 2's claim is *"the live trigger
   * is not (c)'s fraction-of-max rule"*, and that claim is still true and
   * still worth pinning. It just has to be asked about the trigger that
   * actually ships.
   *
   * **The separation is made BOARD-INDEPENDENT on purpose.** `doubleLethalTriggers`
   * consults `bestKillProbability` inside the band, so inside the band whether
   * it fires depends on the hand and the fish distribution — which this mock
   * does not control. So the search accepts a fish only when the shipped
   * trigger declines it *while holding a board that cannot possibly kill* —
   * the case most likely to make it fire. A fish it refuses under those
   * conditions it refuses under all of them, which is what makes the live
   * assertion below sound rather than lucky.
   */
  function discriminatingFishHp(fishMaxHp: number): number {
    for (let hp = 1; hp <= fishMaxHp; hp++) {
      const s = oilState({
        turn: 1,
        fishHp: hp,
        fishMaxHp,
        mana: 5,
        focusRemaining: 3,
        focusMax: 3,
        // Mirrors the live mock's ample stock: with fewer than two held the
        // double case cannot fire and the search would flatter itself.
        relaxingOilHeld: 5,
        focusOilHeld: 5,
        // A hand whose only card cannot reach this fish's HP — the adversarial
        // board described above.
        board: board({ hand: [card({ hitZones: [5], critZones: [], hitEffects: [{ amount: Math.max(1, hp - 1) }] })] }),
      });
      const cFires = heuristicC.decide(s, PAYLOAD_OIL_EFFECTS).includes("relaxing");
      const shippedFires = doubleLethalTriggers(s, PAYLOAD_OIL_EFFECTS).includes("relaxing");
      if (cFires && !shippedFires) return hp;
    }
    throw new Error("no fish HP separates heuristic (c) from the SHIPPED trigger — the domination claim is void");
  }

  /**
   * **20 was enough until session 90 and is not any more, which is itself the
   * finding.** (c) fires at `fishHp <= 0.15 * fishMaxHp`; the shipped trigger
   * now reaches up to `2 * fishDamage = 4`. At `fishMaxHp` 20 that is 3 vs 4 —
   * the shipped trigger's reach SWALLOWS (c)'s entire firing range and no
   * separating fish exists. The double-lethal band did not just move the
   * boundary, it inverted which rule is more eager on a small fish. 40 restores
   * a gap (c fires to 6, the band stops at 4).
   */
  const GATE2_FISH_MAX_HP = 40;

  it("such a fish EXISTS — the two rules really do differ, which is the premise of replacing one with the other", () => {
    // If this ever stops holding, OIL-POLICY.md's "44% more oil for
    // indistinguishable benefit" has lost its mechanism and the replacement
    // needs re-arguing rather than re-asserting.
    expect(discriminatingFishHp(GATE2_FISH_MAX_HP)).toBeGreaterThan(2 * PAYLOAD_OIL_EFFECTS.fishDamage);
  });

  it("on a fish where heuristic (c) WOULD spend and the shipped trigger would not, the live loop spends NOTHING", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-oil-heuristic-c-"));
    const fishMaxHp = GATE2_FISH_MAX_HP;
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
