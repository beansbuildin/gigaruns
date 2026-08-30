/**
 * tests/fishing/oilDoubleLethalDisabled.test.ts — [session 113] the
 * double-lethal band is DISARMED, and stays disarmed.
 *
 * ## The directive
 *
 * **USER, 2026-08-30:** *"focus oil will not be added back on the allowlist,
 * disable the override rule."* That is option (b) of STATE.md session 112's
 * open question 2, and it REVERSES the standing user override of 2026-08-24
 * (`QUESTIONS.md` §30). Both directions were the account owner's; neither was
 * an agent's, and this file exists so the current one cannot be undone by
 * accident.
 *
 * ## What the reversal is FOR — the finding that motivated it
 *
 * Session 112 measured that the rule-4-approved on-demand policy was
 * effectively **unreachable**. Its Relaxing arm lives at `fishHp <= 2`; the
 * override kills at 3-4 with a certain two-oil pair, so the fish never
 * descends into the approved band. Observed `fishHp`-at-decision histogram
 * over 96 live decision turns was **1:1, 2:0, 3:4, 4:5** — and **14 of 14
 * oils spent came from the override, 0 from the approved policy.** The policy
 * the user approved was not the policy spending their oils. Disarming the band
 * is what lets it be.
 *
 * ## Why the disabled arm is `conservingTriggers` and not some third thing
 *
 * `necessityGatedDoubleLethalTriggers` IS
 * `doubleLethalOver(conservingTriggers(...))`. Its own case analysis
 * (`tests/fishing/oilNecessityComposition.test.ts`) proves the two layers act
 * on **disjoint `fishHp` bands with no interaction term**. So removing the
 * outer layer is a clean cut: behaviour changes on `fishDamage < fishHp <=
 * 2 * fishDamage` and provably nowhere else. The `differs ONLY on the band`
 * block below runs that claim over the whole partition rather than citing it.
 *
 * ## Three independent locks, because one would not have held
 *
 *  1. **The policy is structurally incapable of wanting two.** No flag, no
 *     config — `conservingTriggers` over `onDemandTriggers` cannot emit two
 *     relaxings at any HP, at any kill probability, with any stock.
 *  2. **The default is DISARMED**, and `config/bot.json` is read from disk to
 *     prove the shipped file does not arm it. `=== true` semantics are pinned
 *     so a truthy non-`true` value (`1`, `"yes"`) cannot sneak the band back.
 *  3. **The live loop sends no oil in the band**, driven through `runOneCast`
 *     against a mock server — the same instrument
 *     `oilDoubleLethalLive.test.ts` uses to prove the armed case, pointed the
 *     other way. Locks 1 and 2 are both static; this one is the only thing
 *     that would catch the wiring being reverted while the policy and the
 *     config stayed correct.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { fakeCard, fakeDoc } from "../helpers/fishingDoc.js";
import { board, card, distAt, oilState } from "../helpers/oilDecisionState.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";
import {
  PAYLOAD_OIL_EFFECTS,
  RELAXING_ONLY_NECESSITY_THRESHOLDS,
  conservingTriggers,
  necessityGatedDoubleLethalTriggers,
} from "../../src/strategy/fishing/oilTiming.js";
import {
  MID_FOCUS_OIL_ITEM_ID,
  MID_RELAXING_OIL_ITEM_ID,
  type OilBudgetConfig,
} from "../../src/strategy/fishing/oilPolicy.js";

const E = PAYLOAD_OIL_EFFECTS;
const D = E.fishDamage; // 2 — so the band the directive removes is fishHp 3..4
const T = RELAXING_ONLY_NECESSITY_THRESHOLDS;
const FISH = { x: 2, y: 2 };

/** The bottom of the retired band: one oil leaves the fish alive, two finish it. */
const BAND_HP = D + 1;

// ───────────────────────────────────────────────────────────────────────────
// Lock 1 — the disarmed policy CANNOT want two relaxing oils, at any state
// ───────────────────────────────────────────────────────────────────────────

/**
 * Only affordable card cannot possibly kill — this is what makes the band want
 * to fire. Built with the `card` helper (hit zones + effects), NOT with
 * `fakeCard`: `fakeCard` builds a DOC-shaped card for the mock server in lock
 * 3, and feeding it to `bestKillProbability` yields a kill probability of 0 for
 * the wrong reason — the first draft did exactly that and the ARMED control
 * came back empty, which would have made lock 1 assert nothing.
 */
const cannotKill = (hp: number) =>
  board({ hand: [card({ hitZones: [5], critZones: [], hitEffects: [{ amount: Math.max(0, hp - 1) }] })], dist: distAt(FISH) });

/** The whole `fishHp` partition, plus both sides of every boundary the band names. */
const HP_PARTITION = [-1, 0, 1, D, D + 1, 2 * D, 2 * D + 1, 5, 18];

describe("lock 1 — the disarmed policy is STRUCTURALLY incapable of a two-oil turn", () => {
  it("never wants two relaxing oils, across the whole fishHp partition, with stock to spare", () => {
    for (const fishHp of HP_PARTITION) {
      const s = oilState({
        fishHp,
        fishMaxHp: 20,
        focusRemaining: 0, // empty meter — the state that ALSO adds a trailing "focus"
        relaxingOilHeld: 9,
        focusOilHeld: 9,
        board: cannotKill(fishHp),
      });
      const got = conservingTriggers(s, E, T);
      expect(got.filter((k) => k === "relaxing").length, `fishHp ${fishHp}`).toBeLessThanOrEqual(1);
    }
  });

  it("the ARMED policy does want two in the band — so the test above is measuring something", () => {
    // Without this control, lock 1 would pass just as happily against a state
    // the band would have declined anyway, and would be pinning nothing.
    const s = oilState({
      fishHp: BAND_HP,
      fishMaxHp: 20,
      focusRemaining: 3,
      relaxingOilHeld: 9,
      focusOilHeld: 9,
      board: cannotKill(BAND_HP),
    });
    expect(necessityGatedDoubleLethalTriggers(s, E).filter((k) => k === "relaxing")).toHaveLength(2);
    expect(conservingTriggers(s, E, T).filter((k) => k === "relaxing")).toHaveLength(0);
  });

  it("differs from the armed policy ONLY on the band, and is IDENTICAL everywhere else", () => {
    // The composition proof says the cut is clean. This runs it.
    for (const fishHp of HP_PARTITION) {
      const s = oilState({
        fishHp,
        fishMaxHp: 20,
        focusRemaining: 0,
        relaxingOilHeld: 9,
        focusOilHeld: 9,
        board: cannotKill(fishHp),
      });
      const armed = necessityGatedDoubleLethalTriggers(s, E);
      const disarmed = conservingTriggers(s, E, T);
      const inBand = fishHp > D && fishHp <= 2 * D;
      if (inBand) expect(armed, `fishHp ${fishHp} is in the band`).not.toEqual(disarmed);
      else expect(disarmed, `fishHp ${fishHp} is OUTSIDE the band`).toEqual(armed);
    }
  });

  it("holds even with exactly two oils in the bag — stock is not what stops it", () => {
    const s = oilState({
      fishHp: BAND_HP,
      fishMaxHp: 20,
      focusRemaining: 3,
      relaxingOilHeld: 2,
      focusOilHeld: 0,
      board: cannotKill(BAND_HP),
    });
    expect(necessityGatedDoubleLethalTriggers(s, E).filter((k) => k === "relaxing")).toHaveLength(2);
    expect(conservingTriggers(s, E, T)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Lock 2 — the DEFAULT is disarmed, and the shipped config does not arm it
// ───────────────────────────────────────────────────────────────────────────

describe("lock 2 — absent means DISABLED, and config/bot.json leaves it absent", () => {
  it("config/bot.json does not set doubleLethalOverride", () => {
    const cfg = JSON.parse(readFileSync("config/bot.json", "utf8"));
    expect(cfg.dendren?.oils?.doubleLethalOverride).toBeUndefined();
    // The neighbouring user decisions this file must not disturb, asserted so
    // that "disable the override" cannot be implemented by loosening either.
    // The same directive's first half: Focus Oil (942) stays OFF the allowlist.
    expect(cfg.dendren.oils.allowedItemIds).toEqual([MID_RELAXING_OIL_ITEM_ID]);
    expect(cfg.dendren.oils.allowedItemIds).not.toContain(MID_FOCUS_OIL_ITEM_ID);
    expect(cfg.dendren.oils.policyApproved).toBe(true);
  });

  it("arms on `=== true` ONLY — a truthy non-true value does not re-arm the band", () => {
    // The live site reads `deps.oilBudget?.doubleLethalOverride === true`. A
    // config hand-edited to `1` or `"yes"` must fail CLOSED (disarmed), which
    // is the opposite default from `perItemMaxPerCast`, where absence means
    // uncapped. The asymmetry is deliberate: a forgotten ceiling can only fail
    // toward spending LESS, a forgotten override switch would fail toward
    // spending MORE.
    const armedBy = (v: unknown) => v === true;
    expect(armedBy(undefined)).toBe(false);
    expect(armedBy(false)).toBe(false);
    expect(armedBy(1)).toBe(false);
    expect(armedBy("true")).toBe(false);
    expect(armedBy(true)).toBe(true);
  });

  it("the live site reads the flag with that exact comparison", async () => {
    // A grep is a weak instrument and does not carry this alone — lock 3 runs
    // the loop. This exists so the failure MESSAGE names the decision, the same
    // role the guard in `oilDoubleLethal.test.ts` plays for the armed case.
    const src = readFileSync("scripts/liveFishing.ts", "utf8");
    expect(src).toContain("const doubleLethalArmed = deps.oilBudget?.doubleLethalOverride === true;");
    expect(src).toContain(": conservingTriggers(fullOilState, PAYLOAD_OIL_EFFECTS, RELAXING_ONLY_NECESSITY_THRESHOLDS)");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Lock 3 — the LIVE loop spends nothing in the band
// ───────────────────────────────────────────────────────────────────────────

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
 * The SHIPPED budget — `doubleLethalOverride` deliberately absent, mirroring
 * `config/bot.json`. `oilDoubleLethalLive.test.ts` uses the identical object
 * plus `doubleLethalOverride: true`; that one line is the entire difference
 * between the two files, which is what makes this pair a controlled comparison
 * rather than two unrelated setups.
 */
const SHIPPED_BUDGET: OilBudgetConfig = {
  allowedItemIds: [MID_FOCUS_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID],
  maxPerCast: 3,
  perItemMaxPerCast: { [String(MID_RELAXING_OIL_ITEM_ID)]: 2 },
  policyApproved: true,
};

const CANNOT_KILL = [fakeCard({ id: 1, hitAmount: BAND_HP - 1 })];

function makeClient(): { client: GigaverseClient; calls: string[]; itemIds: number[] } {
  const calls: string[] = [];
  const itemIds: number[] = [];
  const slotUsed = [false, false, false];
  let fishHp = BAND_HP;
  let plays = 0;

  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => ({
      entities: [
        { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: 9 },
        { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: 9 },
      ],
    }),
    postFishingAction: async (body: { action: string; data: { slotIndex: number; itemId: number } }) => {
      calls.push(body.action);
      if (body.action === "use_fishing_item") {
        slotUsed[body.data.slotIndex] = true;
        itemIds.push(body.data.itemId);
        if (body.data.itemId === MID_RELAXING_OIL_ITEM_ID) fishHp -= E.fishDamage;
      }
      if (body.action === "play_cards") plays += 1;
      const dead = fishHp <= 0;
      const doc = fakeDoc({
        docId: "77777777",
        fishHp: Math.max(0, fishHp),
        fishMaxHp: 20,
        // Meter at 3, NOT 0: an empty meter would add a trailing "focus" and
        // this file's question is about the relaxing pair alone.
        focusMeter: 3,
        cards: CANNOT_KILL,
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

  return { client, calls, itemIds };
}

function depsFor(dir: string, client: GigaverseClient, events: Record<string, unknown>[]): LiveFishingDeps {
  return makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    oilBudget: SHIPPED_BUDGET,
    log: { write: (e: Record<string, unknown>) => { events.push(e); }, filePath: "test.jsonl" } as unknown as LiveFishingDeps["log"],
    // Every path isolated — CLAUDE.md working style, "tests must never write to
    // a real data path". Session 31's `guard-budget.json` leak was three tests
    // that omitted exactly this.
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath: join(dir, "guard-budget.json"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
    logsDir: join(dir, "logs"),
  });
}

describe("lock 3 — runOneCast sends NO oil in the retired band", () => {
  it("plays the cast out with zero use_fishing_item POSTs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oil-disarmed-"));
    try {
      const { client, calls, itemIds } = makeClient();
      const events: Record<string, unknown>[] = [];
      const result = await runOneCast(depsFor(dir, client, events));
      // The whole point: the armed file asserts TWO POSTs on this same state.
      expect(calls.filter((a) => a === "use_fishing_item")).toHaveLength(0);
      expect(itemIds).toEqual([]);
      expect(result.oilsConsumed).toBe(0);
      // The band's own event must be absent — not merely "no POST landed", but
      // "the decision was never taken". Those differ: a withdrawn or
      // out-of-stock oil also sends no POST, and would be a different bug.
      expect(events.filter((e) => e.event === "oil_double_lethal_fired")).toHaveLength(0);
      // And the anomaly siren for a band firing while disarmed stayed silent.
      expect(events.filter((e) => e.event === "oil_double_lethal_fired_while_disarmed")).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
