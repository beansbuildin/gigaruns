/**
 * tests/fishing/fishingLedgerReconcile.test.ts — [session 70 §4, GATE 2]
 *
 * **THE INVARIANT: the repo's cast counter can never exceed the game's.**
 *
 * Two ledgers count today's casts — the game's `dayDocs[pondId 2]` and this
 * repo's `data/guard-budget-fishing.json` — and they drifted in BOTH directions
 * inside twenty-four hours: session 69 closed at game 14 / repo 15, session 70
 * opened at game 16 / repo 15. The first direction refuses casts the account
 * still has; the second plans a batch the server will reject. Only the game's
 * number is enforced by anything.
 *
 * The gate asks for a test that fails if the repo counter can exceed the game's,
 * and it is pinned twice over, because the two halves fail independently:
 *
 *   1. **The rule** — `reconcileFishingLedger` over an exhaustive matrix of
 *      disagreements, not a handful of examples. A clamp written as
 *      `Math.max` passes any one-sided sample and fails here.
 *   2. **THE WIRE** — the same rule reached through a real `runOneCast`, with a
 *      server whose ledger disagrees with the seeded guard. Session 64's
 *      headline was an `oilBudget` that was configured, approved, tested at the
 *      inner hop and never handed over by the caller: inert for three sessions
 *      while looking shipped. A reconciliation nothing calls is that bug again,
 *      so the assertions below are on POSTs and GuardTrips, never on the pure
 *      function's return value.
 *
 * The wiring tests deliberately drive the guard to its cap from BOTH sides.
 * Asserting only that a too-high repo counter gets lowered would pass on a
 * one-way `Math.max` — the very implementation `adoptServerRunCount`'s doc
 * comment exists to forbid.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { fakeDoc } from "../helpers/fishingDoc.js";
import { GuardState, GuardTrip } from "../../src/orchestrator/guards.js";
import { reconcileFishingLedger } from "../../src/orchestrator/fishingLedgerReconcile.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";

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

const seed = (runsStarted: number, energySpent = 0) => ({ date: "2026-08-21", energySpent, runsStarted });

describe("reconcileFishingLedger — the rule", () => {
  it("NEVER lets the repo counter exceed the game's, over every disagreement in range", () => {
    // Exhaustive rather than sampled: this is the gate's own sentence, and a
    // one-sided clamp is exactly the plausible wrong implementation.
    for (let repo = 0; repo <= 25; repo++) {
      for (let game = 0; game <= 25; game++) {
        const out = reconcileFishingLedger(seed(repo), game);
        expect(out.seed.runsStarted).toBeLessThanOrEqual(game);
        // Stronger than the gate asks, and the actual contract: it EQUALS the
        // game's count. "Never exceeds" alone is satisfied by always returning 0.
        expect(out.seed.runsStarted).toBe(game);
      }
    }
  });

  it("names the direction, because the two directions have opposite consequences", () => {
    // Session 69's gap: the repo high, refusing casts the account still had.
    const lowered = reconcileFishingLedger(seed(15), 14);
    expect(lowered.direction).toBe("lowered");
    expect(lowered.adjusted).toBe(true);
    expect(lowered.note).toContain("over-counted by 1");

    // Session 70's gap: the repo low, because two casts were played in a browser.
    const raised = reconcileFishingLedger(seed(15), 16);
    expect(raised.direction).toBe("raised");
    expect(raised.adjusted).toBe(true);
    expect(raised.note).toContain("the server will reject");

    const agreed = reconcileFishingLedger(seed(16), 16);
    expect(agreed.direction).toBe("agreed");
    expect(agreed.adjusted).toBe(false);
  });

  it("FAILS CLOSED on an unreadable ledger — keeps the repo's count, never fabricates a zero", () => {
    const out = reconcileFishingLedger(seed(15), null);
    expect(out.direction).toBe("unreadable");
    expect(out.adjusted).toBe(false);
    expect(out.seed.runsStarted).toBe(15);
    // The trap this branch exists for: `null` is "we failed to find out", and
    // reading it as 0 would authorize a full day of casts off a failed GET.
    expect(out.seed.runsStarted).not.toBe(0);
  });

  it("carries energy through untouched — the ledgers count CASTS, not energy", () => {
    const out = reconcileFishingLedger(seed(15, 180), 16);
    expect(out.seed.energySpent).toBe(180);
    // And any other field the caller had (the date key) survives the join.
    expect(out.seed.date).toBe("2026-08-21");
  });
});

/**
 * A server holding a stated number of casts on its own daily ledger, with no
 * cast in progress. `dayDocs`'s shape is the live one captured in session 62 —
 * `pondId` an explicit sibling, the count under `doc.UINT256_CID` — including
 * the singular `dayDoc` trap (pond 1's, always 0) that `readDayDocs`'s header
 * warns about, so a reader that reaches for the wrong field fails here.
 */
function serverWithLedger(gameCasts: number) {
  const posts: { action: string }[] = [];
  const client = {
    getFishingState: async () => ({
      gameState: null,
      maxPerDayJuiced: 20,
      dayDoc: { pondId: 1, doc: { UINT256_CID: 0 } },
      dayDocs: [
        { pondId: 1, doc: { UINT256_CID: 0 } },
        { pondId: 2, doc: { UINT256_CID: gameCasts } },
      ],
    }),
    getFishingActionToken: () => "",
    getItemsBalances: async () => ({ entities: [] }),
    postFishingAction: async (body: { action: string }) => {
      posts.push({ action: body.action });
      return {
        success: true,
        message: "ok",
        data: { doc: fakeDoc({ docId: "13024510", complete: body.action !== "start_run" }), events: [] },
        actionToken: 1,
      };
    },
  } as unknown as GigaverseClient;
  return { client, posts };
}

/** `runOneCast` against that server, with the guard seeded at the REPO's count and capped at `cap`. */
async function castAgainst(opts: { gameCasts: number; repoCasts: number; cap: number }) {
  const dir = mkdtempSync(join(tmpdir(), "gigaruns-ledger-"));
  const guardStatePath = join(dir, "guard-budget-fishing.json");
  const { client, posts } = serverWithLedger(opts.gameCasts);
  const guards = new GuardState(
    { dailyEnergyBudget: 240, maxRunsPerSession: opts.cap, maxConsecutiveActionFailures: 3 },
    { energySpent: 0, runsStarted: opts.repoCasts },
  );
  const deps: LiveFishingDeps = makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards,
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath,
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
    logsDir: join(dir, "logs"),
  });

  let trip: unknown = null;
  try {
    await runOneCast(deps);
  } catch (e) {
    trip = e;
  }
  let persisted: { runsStarted: number } | null = null;
  try {
    persisted = JSON.parse(readFileSync(guardStatePath, "utf8"));
  } catch {
    /* nothing written is a legitimate outcome — the assertions say which */
  }
  rmSync(dir, { recursive: true, force: true });
  return { posts, trip, runCount: guards.runCount, persisted };
}

describe("the wire — a real cast reconciles against the server's own ledger", () => {
  it("REFUSES a cast the repo counter alone would have allowed, when the game says the cap is spent", async () => {
    // The unsafe direction, and the gate's sentence in its live form. The repo
    // believes 5 casts are spent against a cap of 8, so it would happily start
    // a sixth; the game says 8 are gone. Without reconciliation this POSTs a
    // `start_run` the server rejects — session 27's wasted cast.
    const { posts, trip, runCount } = await castAgainst({ gameCasts: 8, repoCasts: 5, cap: 8 });
    expect(trip).toBeInstanceOf(GuardTrip);
    expect(runCount).toBe(8);
    // The strongest form of the assertion: nothing reached the wire at all.
    expect(posts).toHaveLength(0);
  });

  it("ALLOWS a cast the repo counter alone would have refused, when the game says one remains", async () => {
    // Session 69's direction. A one-way `Math.max` clamp passes the test above
    // and fails this one, which is why both are here.
    const { posts, trip, runCount } = await castAgainst({ gameCasts: 7, repoCasts: 10, cap: 8 });
    expect(trip).toBeNull();
    expect(posts.map((p) => p.action)).toContain("start_run");
    // 7 adopted from the server, then +1 for the cast this test just started.
    expect(runCount).toBe(8);
  });

  it("writes the server's number back to disk, so `--status` stops reporting a stale count", async () => {
    const { persisted } = await castAgainst({ gameCasts: 7, repoCasts: 10, cap: 8 });
    expect(persisted).not.toBeNull();
    expect((persisted as { runsStarted: number }).runsStarted).toBe(8);
  });

  it("changes NOTHING when the ledgers already agree — no adoption, no rewrite of behaviour", async () => {
    const { posts, trip, runCount } = await castAgainst({ gameCasts: 3, repoCasts: 3, cap: 8 });
    expect(trip).toBeNull();
    expect(posts.map((p) => p.action)).toContain("start_run");
    expect(runCount).toBe(4);
  });

  it("leaves the guard alone when the server's ledger cannot be read", async () => {
    // Every other `runOneCast` test in the suite drives a client whose
    // `getFishingState` returns `{ gameState: null }` and no `dayDocs` at all.
    // That must remain a no-op, or this change quietly rewrites the seeded
    // guard in dozens of unrelated tests.
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-ledger-blind-"));
    const posts: string[] = [];
    const client = {
      getFishingState: async () => ({ gameState: null }),
      getFishingActionToken: () => "",
      getItemsBalances: async () => ({ entities: [] }),
      postFishingAction: async (body: { action: string }) => {
        posts.push(body.action);
        return {
          success: true,
          message: "ok",
          data: { doc: fakeDoc({ docId: "13024510", complete: body.action !== "start_run" }), events: [] },
          actionToken: 1,
        };
      },
    } as unknown as GigaverseClient;
    const guards = new GuardState(
      { dailyEnergyBudget: 240, maxRunsPerSession: 8, maxConsecutiveActionFailures: 3 },
      { energySpent: 0, runsStarted: 5 },
    );
    await runOneCast(
      makeLiveFishingDeps({
        client,
        config: TEST_CONFIG,
        guards,
        transitionsPath: join(dir, "fish-patterns.jsonl"),
        guardStatePath: join(dir, "guard-budget-fishing.json"),
        nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
        ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
        oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
        nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
        logsDir: join(dir, "logs"),
      }),
    );
    rmSync(dir, { recursive: true, force: true });
    // Seeded at 5, one cast started, nothing adopted from a ledger that was not there.
    expect(guards.runCount).toBe(6);
    expect(posts).toContain("start_run");
  });
});
