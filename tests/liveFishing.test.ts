/**
 * tests/liveFishing.test.ts — pure helpers from scripts/liveFishing.ts,
 * against the real captured cast (fixtures/fishing-casts/cast.json) rather
 * than hand-built fixtures, same discipline as tests/fishing/matcher.test.ts.
 */

import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  appendTransition,
  buildFishingEnvelope,
  buildHand,
  cardsById,
  fishCell,
  lastRecordForCast,
  loadTransitionLog,
  runOneCast,
  unknownDocKeys,
  type LiveFishingDeps,
  type TransitionRecord,
} from "../scripts/liveFishing.js";
import type { FishingGameDoc } from "../src/api/fishing.js";
import type { GigaverseClient } from "../src/api/client.js";
import { loadGuardBudget } from "../src/orchestrator/guardPersistence.js";
import { GuardState, GuardTrip, isBudgetGuardTrip } from "../src/orchestrator/guards.js";
import type { BotConfig } from "../src/orchestrator/config.js";

const cast = JSON.parse(readFileSync("fixtures/fishing-casts/cast.json", "utf8")) as Array<{
  request: unknown;
  response: { data: { doc: FishingGameDoc } };
}>;

describe("cardsById / buildHand", () => {
  it("maps deckCardData by real card id, and resolves hand ids off it", () => {
    const doc0 = cast[0]!.response.data.doc;
    const byId = cardsById(doc0.data.deckCardData);
    expect(byId.get(79)).toMatchObject({ id: 79, manaCost: 1, hitZones: [2, 4, 6, 8] });

    const hand = buildHand(doc0);
    expect(hand.map((c) => c.id)).toEqual(doc0.data.hand); // [79, 7, 2] on the real capture
  });

  it("throws rather than silently dropping a hand card missing from deckCardData", () => {
    const doc0 = cast[0]!.response.data.doc;
    const broken: FishingGameDoc = { ...doc0, data: { ...doc0.data, hand: [999999] } };
    expect(() => buildHand(broken)).toThrow(/999999/);
  });
});

describe("unknownDocKeys", () => {
  it("returns nothing for a real captured doc — the allowlist matches the actual wire shape", () => {
    const doc0 = cast[0]!.response.data.doc;
    expect(unknownDocKeys(doc0 as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("flags an unmodelled top-level field", () => {
    const doc0 = cast[0]!.response.data.doc as unknown as Record<string, unknown>;
    const withExtra = { ...doc0, someNewTopLevelField: true };
    expect(unknownDocKeys(withExtra)).toEqual(["someNewTopLevelField"]);
  });

  it("flags an unmodelled data.* field, prefixed", () => {
    const doc0 = cast[0]!.response.data.doc as unknown as Record<string, unknown>;
    const data = doc0.data as Record<string, unknown>;
    const withExtra = { ...doc0, data: { ...data, someNewMechanic: { amount: 5 } } };
    expect(unknownDocKeys(withExtra)).toEqual(["data.someNewMechanic"]);
  });
});

describe("fishCell", () => {
  it("reads the real cast's fishPosition sequence exactly", () => {
    const cells = cast.map((e) => fishCell(e.response.data.doc));
    // fixtures/fishing-casts/cast.json: [4,2] -> [4,3] -> [4,4] -> [3,4] -> [3,3] -> [4,3]
    expect(cells).toEqual([
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]);
  });
});

describe("buildFishingEnvelope", () => {
  it("reproduces the real cast's start_run request shape", () => {
    const body = buildFishingEnvelope("start_run", "", { nodeId: "5", tierId: 1 });
    expect(body).toEqual({
      action: "start_run",
      actionToken: "",
      data: { cards: [], nodeId: "5", focusPoint: [], itemId: 0, slotIndex: 0, tierId: 1 },
    });
  });

  it("reproduces the real cast's play_cards request shape", () => {
    const body = buildFishingEnvelope("play_cards", "1786764497517", { cards: [1], focusPoint: [2, 2] });
    expect(body).toEqual({
      action: "play_cards",
      actionToken: "1786764497517",
      data: { cards: [1], nodeId: "", focusPoint: [2, 2], itemId: 0, slotIndex: 0, tierId: 0 },
    });
  });

  it("reproduces the real user-captured loot request shape — session 17, QUESTIONS.md §10", () => {
    const body = buildFishingEnvelope("loot", "1786897508188", { cards: [22] });
    expect(body).toEqual({
      action: "loot",
      actionToken: "1786897508188",
      data: { cards: [22], nodeId: "", focusPoint: [], itemId: 0, slotIndex: 0, tierId: 0 },
    });
  });
});

describe("data/fish-patterns.jsonl round-trip", () => {
  let dir: string;
  let path: string;

  it("appends and reloads transitions into emptyFallback's empirical map shape", () => {
    dir = mkdtempSync(join(tmpdir(), "gigaruns-fishpatterns-test-"));
    path = join(dir, "fish-patterns.jsonl");
    expect(existsSync(path)).toBe(false);

    expect(loadTransitionLog(path).size).toBe(0); // missing file -> empty map, not a throw

    const rec1: TransitionRecord = { ts: "t1", castId: "c1", turn: 0, from: [4, 2], to: [4, 3], gridSize: 4 };
    const rec2: TransitionRecord = { ts: "t2", castId: "c1", turn: 1, from: [4, 2], to: [4, 1], gridSize: 4 };
    appendTransition(rec1, path);
    appendTransition(rec2, path);

    const log = loadTransitionLog(path);
    expect(log.get("4,2")).toEqual([
      { x: 4, y: 3 },
      { x: 4, y: 1 },
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("skips malformed lines instead of throwing", () => {
    dir = mkdtempSync(join(tmpdir(), "gigaruns-fishpatterns-test-"));
    path = join(dir, "fish-patterns.jsonl");
    appendTransition({ ts: "t1", castId: "c1", turn: 0, from: [1, 1], to: [1, 2], gridSize: 4 }, path);
    appendFileSync(path, "not json\n"); // one broken line shouldn't lose the rest
    appendTransition({ ts: "t2", castId: "c1", turn: 1, from: [1, 1], to: [1, 3], gridSize: 4 }, path);

    const log = loadTransitionLog(path);
    expect(log.get("1,1")).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("lastRecordForCast — session 29, CODEXREVIEW #5", () => {
  let dir: string;
  let path: string;

  it("returns null when nothing is logged yet for this castId (a genuinely fresh cast)", () => {
    dir = mkdtempSync(join(tmpdir(), "gigaruns-fishpatterns-test-"));
    path = join(dir, "fish-patterns.jsonl");
    expect(lastRecordForCast("12923189", path)).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the highest-turn record for that castId, ignoring other casts", () => {
    dir = mkdtempSync(join(tmpdir(), "gigaruns-fishpatterns-test-"));
    path = join(dir, "fish-patterns.jsonl");
    appendTransition({ ts: "t0", castId: "12923189", turn: 0, from: [2, 4], to: [2, 3], gridSize: 4 }, path);
    appendTransition({ ts: "t1", castId: "12923189", turn: 1, from: [2, 3], to: [1, 3], gridSize: 4 }, path);
    appendTransition({ ts: "t2", castId: "12923189", turn: 2, from: [1, 3], to: [1, 4], gridSize: 4 }, path);
    appendTransition({ ts: "other", castId: "99999999", turn: 9, from: [0, 0], to: [0, 1], gridSize: 4 }, path);

    const last = lastRecordForCast("12923189", path);
    expect(last).toMatchObject({ turn: 2, from: [1, 3], to: [1, 4] });
    rmSync(dir, { recursive: true, force: true });
  });

  // The exact real-world scenario, reproduced faithfully from the actual
  // `data/fish-patterns.jsonl` bug: cast 12923189 logs three real turns
  // (0/1/2), the process ends, and ~5 minutes later a RESUMED process — with
  // the old `let turn = 0` bug — would relabel the cast's real turn-3 move
  // (from the fish's actual position, [1,4]) as a second "turn 0". This test
  // asserts the derivation a resuming caller must use: the correct next turn
  // is 3 (not 0), and the last logged position ([1,4]) matches where a
  // correctly-resumed doc would report the fish actually is.
  it("gives the correct resume point for the exact 12923189 scenario, before the bug's second write lands", () => {
    dir = mkdtempSync(join(tmpdir(), "gigaruns-fishpatterns-test-"));
    path = join(dir, "fish-patterns.jsonl");
    appendTransition({ ts: "2026-08-15T20:32:48.588Z", castId: "12923189", turn: 0, from: [2, 4], to: [2, 3], gridSize: 4 }, path);
    appendTransition({ ts: "2026-08-15T20:32:50.120Z", castId: "12923189", turn: 1, from: [2, 3], to: [1, 3], gridSize: 4 }, path);
    appendTransition({ ts: "2026-08-15T20:32:51.528Z", castId: "12923189", turn: 2, from: [1, 3], to: [1, 4], gridSize: 4 }, path);

    const last = lastRecordForCast("12923189", path);
    expect(last).toMatchObject({ turn: 2, to: [1, 4] });
    // A correctly-resuming caller derives nextTurn = last.turn + 1 = 3, and
    // validates the resumed doc's real position ([1,4]) against last.to —
    // they match, so the log is trustworthy and turn 3 (not a second turn 0)
    // is what gets appended next.
    const nextTurn = last!.turn + 1;
    expect(nextTurn).toBe(3);
  });
});

describe("runOneCast — server-cap rejection backstop (session 29, CODEXREVIEW #6)", () => {
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

  function fakeClient(rejectMessage: string): GigaverseClient {
    return {
      getFishingState: async () => ({ gameState: null }),
      getFishingActionToken: () => "",
      postFishingAction: async () => {
        throw new Error(rejectMessage);
      },
    } as unknown as GigaverseClient;
  }

  function makeDeps(client: GigaverseClient, guardStatePath: string): LiveFishingDeps {
    return {
      client,
      config: TEST_CONFIG,
      guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
      fixtures: { write: () => {}, dir: "test-fixtures" } as unknown as LiveFishingDeps["fixtures"],
      log: { write: () => {}, filePath: "test.jsonl" } as unknown as LiveFishingDeps["log"],
      address: "0xUSER",
      dryRun: false,
      guardStatePath,
    };
  }

  it("classifies the real 'reached max runs for fishing' rejection as a budget trip and persists the exhausted mark", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-fishing-cap-test-"));
    const guardStatePath = join(dir, "guard-budget-fishing.json");
    const deps = makeDeps(fakeClient("Player has reached max runs for fishing"), guardStatePath);

    try {
      await runOneCast(deps);
      throw new Error("expected a throw");
    } catch (e) {
      expect(e).toBeInstanceOf(GuardTrip);
      expect((e as GuardTrip).reason).toBe("session run cap reached");
      expect(isBudgetGuardTrip(e as GuardTrip)).toBe(true);
    }

    expect(deps.guards.runCount).toBe(20); // marked exhausted for the rest of the persisted day
    expect(loadGuardBudget(guardStatePath)).toEqual({ energySpent: 0, runsStarted: 20 }); // persisted, visible to a later invocation
    rmSync(dir, { recursive: true, force: true });
  });

  it("does NOT reclassify an unrelated start_run rejection as a budget trip", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-fishing-cap-test-"));
    const guardStatePath = join(dir, "guard-budget-fishing.json");
    const deps = makeDeps(fakeClient("some unrelated server error"), guardStatePath);

    try {
      await runOneCast(deps);
      throw new Error("expected a throw");
    } catch (e) {
      expect(e).toBeInstanceOf(GuardTrip);
      expect((e as GuardTrip).reason).toBe("fishing start_run rejected");
      expect(isBudgetGuardTrip(e as GuardTrip)).toBe(false);
    }
    expect(deps.guards.runCount).toBe(0); // untouched — not a server-cap situation
    rmSync(dir, { recursive: true, force: true });
  });
});
