/**
 * tests/fishing/fishingDocGuard.test.ts — [session 67 §2 / GATE 2] the guard
 * that makes the `fakeDoc` consolidation worth doing.
 *
 * ## The consolidation is not the deliverable
 *
 * Six copies of the fishing mock became one (`tests/helpers/fishingDoc.ts`).
 * That is ergonomics. **A single copy that omits a field the live path reads
 * is the same bug with better ergonomics** — session 65's two copies missing
 * `fishingConsumableSlotUsed` made every *"it consumes the oil"* assertion
 * vacuous while staying green, and one copy could do that just as quietly.
 *
 * So this file asserts the property the copies never had: **that every field
 * in `LIVE_PATH_FIELDS` is actually load-bearing.** For each one it builds a
 * doc WITHOUT that field, drives a real `runOneCast` against it, and requires
 * the result to differ from the complete-doc control — a throw, a different
 * outcome, or a different sequence of posted actions.
 *
 * ## Why it is written as "removing it must be OBSERVABLE"
 *
 * The tempting assertion is `expect(Object.keys(doc.data)).toContain(f)`, and
 * it is worthless: it passes for a field nothing reads, so it cannot tell a
 * complete mock from a mock with a decorative extra key. It is also exactly
 * the class of assertion session 66 caught being useless — a source-text pin
 * proves a line exists, not that it runs.
 *
 * The observable version has teeth in both directions:
 *
 *   - **Drop a field from the builder** and the control run changes, so the
 *     tests that depend on it move.
 *   - **List a field here that nothing reads** and its case FAILS, because
 *     removing it changes nothing. That failure is information, not noise: it
 *     means either the live path stopped reading it (drop it from the list,
 *     deliberately) or the guard has gone blind. It is never "loosen the
 *     assertion".
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fakeDoc, LIVE_PATH_FIELDS } from "../helpers/fishingDoc.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
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

/**
 * Approved and funded. The oils are switched ON here on purpose: a consume is
 * the single richest observable the live path produces (it names an item id
 * AND a slot index, both derived from doc fields), and it is the exact path
 * session 65's missing field silenced.
 */
const APPROVED_BUDGET: OilBudgetConfig = {
  allowedItemIds: [MID_FOCUS_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID],
  maxPerCast: 3,
  policyApproved: true,
};

/**
 * Everything the cast did, in order. Card index, focus cell, item id and slot
 * all show up in `posts`; `console` captures the rest.
 *
 * **The console half is not padding, and it is what this guard learned by
 * failing.** With `posts` + `outcome` alone, `fishMaxHp` and `focusMeterMax`
 * both came back UNOBSERVABLE — and the reason is real: under the shipped
 * `onDemandTriggers`, neither field enters a decision. `fishHp <= fishDamage`
 * and `focusRemaining <= 0` are the whole trigger; the maxima are read only to
 * be REPORTED (`liveFishing.ts`'s `★ on-demand LETHAL trigger: fish at
 * 2/20 HP` line).
 *
 * That is still reading them, and a mock that omits them prints `undefined` to
 * the operator's screen at the exact moment they are deciding whether the bot
 * is behaving. So the fix was to widen the observable rather than shorten the
 * list — dropping them would have recorded "the mock need not carry these",
 * which is false, and would have been the loosening this file's header
 * forbids.
 */
type Trace = { posts: string[]; console: string[]; outcome: string } | { threw: string };

async function traceWith(omit: readonly string[]): Promise<Trace> {
  // Isolated temp dir per run — CLAUDE.md's "tests must never write to a real
  // data path", and `depsFor` takes every path explicitly for the same reason.
  const dir = mkdtempSync(join(tmpdir(), "gigaruns-docguard-"));
  try {
    const posts: string[] = [];
    const slotUsed = [false, false, false];
    let plays = 0;
    const client = {
      getFishingState: async () => ({ gameState: null }),
      getFishingActionToken: () => "",
      getItemsBalances: async () => ({
        entities: [
          { ID_CID: String(MID_FOCUS_OIL_ITEM_ID), BALANCE_CID: 3 },
          { ID_CID: String(MID_RELAXING_OIL_ITEM_ID), BALANCE_CID: 3 },
        ],
      }),
      postFishingAction: async (body: { action: string; data?: Record<string, unknown> }) => {
        posts.push(`${body.action} ${JSON.stringify(body.data ?? {})}`);
        if (body.action === "use_fishing_item") {
          const i = Number(body.data?.slotIndex ?? 0);
          if (slotUsed[i]) throw new Error("HTTP 400 — slot already used");
          slotUsed[i] = true;
        }
        if (body.action === "play_cards") plays++;
        return {
          success: true,
          message: body.action === "start_run" ? "Game started successfully." : "Cards played successfully.",
          // `fishHp: 2` == the payload's fishDamage, so the LETHAL trigger is
          // live; `focusMeter: 0` fires the FOCUS trigger. Both oils are in
          // play, which is what makes the consume observable.
          data: { doc: fakeDoc({ docId: "60000001", fishHp: 2, fishMaxHp: 20, focusMeter: 0, slotUsed, complete: plays >= 2, omit }), events: [] },
          actionToken: 1,
        };
      },
    } as unknown as GigaverseClient;

    const deps: LiveFishingDeps = makeLiveFishingDeps({
      client,
      config: TEST_CONFIG,
      guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
      oilBudget: APPROVED_BUDGET,
      transitionsPath: join(dir, "fish-patterns.jsonl"),
      guardStatePath: join(dir, "guard-budget.json"),
      nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
      ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
      oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
      nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
      logsDir: join(dir, "logs"),
    });

    const lines: string[] = [];
    const realLog = console.log;
    console.log = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
    try {
      const r = await runOneCast(deps);
      return { posts, console: lines, outcome: String(r.outcome) };
    } catch (e) {
      return { threw: e instanceof Error ? e.message : String(e) };
    } finally {
      console.log = realLog;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("the shared builder carries every field LIVE_PATH_FIELDS names", () => {
  it("produces all of them — the cheap check, which is necessary and nowhere near sufficient", () => {
    const keys = new Set(Object.keys(fakeDoc().data));
    for (const f of LIVE_PATH_FIELDS) expect(keys.has(f), `builder is missing ${f}`).toBe(true);
  });

  it("`omit` really removes the field, so the guard below is measuring what it thinks it is", () => {
    for (const f of LIVE_PATH_FIELDS) {
      expect(Object.keys(fakeDoc({ omit: [f] }).data)).not.toContain(f);
    }
  });
});

describe("GATE 2 — REMOVING ANY OF THEM IS OBSERVABLE, which is the whole point", () => {
  it("the control run is stable — two identical builds trace identically", async () => {
    // Without this, "differs from the control" could be satisfied by ordinary
    // nondeterminism and the whole file would be measuring noise.
    expect(await traceWith([])).toEqual(await traceWith([]));
  });

  for (const field of LIVE_PATH_FIELDS) {
    it(`omitting \`${field}\` changes what the live path does`, async () => {
      const control = await traceWith([]);
      const without = await traceWith([field]);
      expect(
        without,
        `removing \`${field}\` changed NOTHING about the cast. Either the live decision path no longer reads it ` +
          `(drop it from LIVE_PATH_FIELDS, deliberately and in a commit that says so) or this guard has gone ` +
          `blind. Do not loosen this assertion — it is the one that stops session 65 happening again.`,
      ).not.toEqual(control);
    });
  }
});
