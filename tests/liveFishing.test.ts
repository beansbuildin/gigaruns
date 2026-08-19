/**
 * tests/liveFishing.test.ts — pure helpers from scripts/liveFishing.ts,
 * against the real captured cast (fixtures/fishing-casts/cast.json) rather
 * than hand-built fixtures, same discipline as tests/fishing/matcher.test.ts.
 */

import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  appendNextPositionValidation,
  appendTransition,
  buildFishingEnvelope,
  buildHand,
  cardsById,
  certainDistribution,
  confirmedHitCount,
  detectPossibleDualYield,
  extractNextPosition,
  fishCell,
  lastRecordForCast,
  loadNextPositionValidations,
  loadTransitionLog,
  NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS,
  NEXT_POSITION_OVERRIDE_MIN_LOWER_BOUND,
  nextPositionOverrideStats,
  RunLog,
  runOneCast,
  unknownDocKeys,
  wilsonLowerBound,
  type LiveFishingDeps,
  type NextPositionValidation,
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

import { makeLiveFishingDeps } from "./helpers/liveFishingDeps.js";

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

  it("reproduces the real user-captured use_fishing_item request shape — session 44, QUESTIONS.md §16", () => {
    const body = buildFishingEnvelope("use_fishing_item", "1787094007859", { itemId: 821, slotIndex: 0 });
    expect(body).toEqual({
      action: "use_fishing_item",
      actionToken: "1787094007859",
      data: { cards: [], nodeId: "", focusPoint: [], itemId: 821, slotIndex: 0, tierId: 0 },
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

describe("extractNextPosition — session 30, brief §2", () => {
  it("reads a valid [x,y] prediction", () => {
    expect(extractNextPosition({ data: { nextPosition: [2, 4] } })).toEqual({ x: 2, y: 4 });
  });
  it("returns null when the key is absent", () => {
    expect(extractNextPosition({ data: {} })).toBeNull();
  });
  it("returns null when the value is null — the common case once the key has appeared once in a cast (QUESTIONS.md §12)", () => {
    expect(extractNextPosition({ data: { nextPosition: null } })).toBeNull();
  });
  it("returns null on a malformed (non-2-number-array) value rather than throwing", () => {
    expect(extractNextPosition({ data: { nextPosition: [1] } })).toBeNull();
    expect(extractNextPosition({ data: { nextPosition: "nope" } })).toBeNull();
    expect(extractNextPosition({})).toBeNull();
  });
  it("[session 39, CODEXAUDIT #4] returns null for a coordinate outside [1, gridSize] when gridSize is present", () => {
    expect(extractNextPosition({ data: { nextPosition: [5, 2], gridSize: 4 } })).toBeNull();
    expect(extractNextPosition({ data: { nextPosition: [0, 2], gridSize: 4 } })).toBeNull();
    expect(extractNextPosition({ data: { nextPosition: [4, 4], gridSize: 4 } })).toEqual({ x: 4, y: 4 });
  });
  it("[session 39, CODEXAUDIT #4] skips the bounds check when gridSize is absent or non-numeric, rather than rejecting an otherwise-valid prediction", () => {
    expect(extractNextPosition({ data: { nextPosition: [99, 99] } })).toEqual({ x: 99, y: 99 });
    expect(extractNextPosition({ data: { nextPosition: [99, 99], gridSize: "4" } })).toEqual({ x: 99, y: 99 });
  });
});

describe("certainDistribution", () => {
  it("puts all probability mass on the given cell", () => {
    const dist = certainDistribution({ x: 3, y: 1 });
    expect(dist.size).toBe(1);
    expect([...dist.values()]).toEqual([{ cell: { x: 3, y: 1 }, p: 1 }]);
  });
});

describe("nextPosition validation log round-trip", () => {
  it("appends and reloads validations, and confirmedHitCount counts only hits", () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-nextpos-test-"));
    const path = join(dir, "nextPositionValidation.jsonl");
    const hit: NextPositionValidation = { ts: "t1", castId: "c1", turn: 1, predicted: [2, 2], actual: [2, 2], hit: true, gridSize: 4 };
    const miss: NextPositionValidation = { ts: "t2", castId: "c1", turn: 2, predicted: [3, 3], actual: [1, 1], hit: false, gridSize: 4 };
    appendNextPositionValidation(hit, path);
    appendNextPositionValidation(miss, path);

    expect(loadNextPositionValidations(path)).toEqual([hit, miss]);
    expect(confirmedHitCount(path)).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns 0/[] for a missing file rather than throwing", () => {
    expect(loadNextPositionValidations("/nonexistent/path.jsonl")).toEqual([]);
    expect(confirmedHitCount("/nonexistent/path.jsonl")).toBe(0);
  });

  it("[session 39, CODEXAUDIT #4] skips a well-formed-JSON-but-schema-invalid line instead of trusting it", () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-nextpos-test-"));
    const path = join(dir, "nextPositionValidation.jsonl");
    const good: NextPositionValidation = { ts: "t1", castId: "c1", turn: 0, predicted: [1, 1], actual: [1, 1], hit: true, gridSize: 4 };
    const lines = [
      JSON.stringify(good),
      JSON.stringify({ ts: "t2", castId: "c1", turn: 1, predicted: [1, 1], actual: [1, 1], hit: "yes", gridSize: 4 }), // hit as a string
      JSON.stringify({ ts: "t3", castId: "c1", turn: 1, predicted: [1, 1], actual: [1, 1], hit: true }), // missing gridSize
      JSON.stringify({ ts: "t4", castId: "c1", turn: 1, predicted: [5, 1], actual: [1, 1], hit: true, gridSize: 4 }), // predicted x=5 outside [1,4]
      JSON.stringify({ ts: "t5", castId: "c1", turn: -1, predicted: [1, 1], actual: [1, 1], hit: true, gridSize: 4 }), // negative turn
      "not even json",
    ];
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, lines.join("\n") + "\n");

    expect(loadNextPositionValidations(path)).toEqual([good]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("wilsonLowerBound — session 39, CODEXAUDIT #4", () => {
  it("returns 0 for n=0 (no evidence, no confidence)", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });
  it("stays well below 1 even at a perfect small-n rate, unlike a degenerate Wald interval", () => {
    const lb = wilsonLowerBound(10, 10);
    expect(lb).toBeGreaterThan(0.6);
    expect(lb).toBeLessThan(0.9);
  });
  it("a single miss lowers but does not zero out the bound", () => {
    const allHits = wilsonLowerBound(10, 10);
    const oneMiss = wilsonLowerBound(9, 10);
    expect(oneMiss).toBeGreaterThan(0);
    expect(oneMiss).toBeLessThan(allHits);
  });
});

describe("nextPositionOverrideStats — session 39, CODEXAUDIT #4 (the actual bug fix)", () => {
  function seed(path: string, records: Array<{ hit: boolean }>): void {
    for (let i = 0; i < records.length; i++) {
      appendNextPositionValidation(
        { ts: `t${i}`, castId: "c1", turn: i, predicted: [1, 1], actual: records[i]!.hit ? [1, 1] : [2, 2], hit: records[i]!.hit, gridSize: 4 },
        path,
      );
    }
  }

  it("does NOT clear the gate on ten hits buried in ninety interleaved misses — the audit's exact adversarial case", () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-nextpos-gate-test-"));
    const path = join(dir, "nextPositionValidation.jsonl");
    const records = Array.from({ length: 100 }, (_, i) => ({ hit: i % 10 === 0 })); // exactly 10 hits, 90 misses, interleaved
    seed(path, records);

    const stats = nextPositionOverrideStats(path);
    expect(stats.attempts).toBe(100);
    expect(stats.hits).toBe(10);
    expect(stats.ready).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does NOT clear the gate below NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS even at a 100% hit rate", () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-nextpos-gate-test-"));
    const path = join(dir, "nextPositionValidation.jsonl");
    seed(path, Array.from({ length: NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS - 1 }, () => ({ hit: true })));

    expect(nextPositionOverrideStats(path).ready).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("clears the gate at the minimum attempt count with a genuinely high (not just all-time-ever) hit rate", () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-nextpos-gate-test-"));
    const path = join(dir, "nextPositionValidation.jsonl");
    seed(path, Array.from({ length: NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS }, () => ({ hit: true })));

    const stats = nextPositionOverrideStats(path);
    expect(stats.attempts).toBe(NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS);
    expect(stats.lowerBound).toBeGreaterThanOrEqual(NEXT_POSITION_OVERRIDE_MIN_LOWER_BOUND);
    expect(stats.ready).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("a single early miss lowers the bound but does not permanently disable the gate — enough later hits still clear it", () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-nextpos-gate-test-"));
    const path = join(dir, "nextPositionValidation.jsonl");
    // One miss, then enough hits that the Wilson lower bound still clears 0.5.
    seed(path, [{ hit: false }, ...Array.from({ length: 19 }, () => ({ hit: true }))]);

    const stats = nextPositionOverrideStats(path);
    expect(stats.hits).toBe(19);
    expect(stats.attempts).toBe(20);
    expect(stats.ready).toBe(true); // proves "every hit, ever, forever" is NOT what shipped
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns not-ready with lowerBound 0 for a missing file", () => {
    const stats = nextPositionOverrideStats("/nonexistent/path.jsonl");
    expect(stats).toEqual({ attempts: 0, hits: 0, lowerBound: 0, ready: false });
  });
});

describe("runOneCast — nextPosition validation-only recording, live wiring (session 30, brief §2)", () => {
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

  function fakeDoc(fishPosition: [number, number], completeCid: boolean, extraData: Record<string, unknown> = {}) {
    return {
      docId: "99999999",
      docType: "FISHING_GAME",
      data: {
        deckCardData: [fakeCard()],
        playerMaxHp: 10,
        playerHp: 10,
        fishHp: 10,
        fishMaxHp: 10,
        fishPosition,
        previousFishPosition: [0, 0],
        gridSize: 4,
        focusPoint: [0, 0],
        focusMeter: 3,
        focusMeterMax: 3,
        focusMechanicEnabled: true,
        patternIndex: 0,
        fullDeck: [1],
        nextCardIndex: 1,
        cardInDrawPile: 0,
        hand: [1],
        discard: [],
        ...extraData,
      },
      COMPLETE_CID: completeCid,
      SUCCESS_CID: completeCid ? false : undefined,
      IS_JUICED_CID: false,
      MULTIPLIER_CID: 1,
    };
  }

  function makeClient(): { client: GigaverseClient; calls: string[] } {
    const calls: string[] = [];
    const client = {
      getFishingState: async () => ({ gameState: null }),
      getFishingActionToken: () => "",
      postFishingAction: async (body: { action: string }) => {
        calls.push(body.action);
        if (body.action === "start_run") {
          return {
            success: true,
            message: "Game started successfully.",
            data: { doc: fakeDoc([0, 0], false), events: [] },
            actionToken: 1,
          };
        }
        if (calls.filter((a) => a === "play_cards").length === 1) {
          // Turn 0's play_cards: lands the fish at [1,1] and reveals a prediction for turn 1.
          return {
            success: true,
            message: "Cards played successfully.",
            data: { doc: fakeDoc([1, 1], false, { nextPosition: [2, 2] }), events: [] },
            actionToken: 2,
          };
        }
        // Turn 1's play_cards: actual position matches the turn-0 prediction exactly -> HIT. Cast ends here (escaped).
        return {
          success: true,
          message: "Cards played successfully.",
          data: { doc: fakeDoc([2, 2], true), events: [] },
          actionToken: 3,
        };
      },
    } as unknown as GigaverseClient;
    return { client, calls };
  }

  it("records a HIT when the predicted nextPosition matches the following turn's actual position", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-nextpos-live-test-"));
    const nextPositionLogPath = join(dir, "nextPositionValidation.jsonl");
    const { client } = makeClient();
    // [session 31, CODEXREVIEW #8] `guardStatePath` must be isolated — without
    // it, `runOneCast`'s successful start_run falls back to
    // `DEFAULT_GUARD_STATE_PATH` and writes real committed spend into
    // `data/guard-budget.json` — the DUNGEON guard file, not fishing's —
    // every time this test runs. Confirmed live by running this test alone
    // and diffing that file before/after (0 -> 12 energySpent). Same class
    // of bug as the session-30 `9001`/`9002` fishing-corpus pollution fix —
    // a test writing to a real, non-isolated path. `makeLiveFishingDeps`
    // (session 40) now makes every isolated path a required argument here.
    const deps = makeLiveFishingDeps({
      client,
      config: TEST_CONFIG,
      guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
      transitionsPath: join(dir, "fish-patterns.jsonl"),
      nextPositionLogPath,
      ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
      logsDir: join(dir, "logs"),
      guardStatePath: join(dir, "guard-budget.json"),
    });

    const result = await runOneCast(deps);
    expect(result.outcome).toBe("escaped");

    const validations = loadNextPositionValidations(nextPositionLogPath);
    expect(validations).toHaveLength(1);
    expect(validations[0]).toMatchObject({ turn: 1, predicted: [2, 2], actual: [2, 2], hit: true, gridSize: 4 });
    expect(confirmedHitCount(nextPositionLogPath)).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does NOT override chooseCard's distribution while the gate stays unmet — one hit is nowhere near NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS", async () => {
    // The prior test already proves one real hit gets recorded. This test's
    // point is narrower: prove that recording alone never flips behavior —
    // the cast plays out and ends normally (no override-only code path taken),
    // which is the whole "validation-only pass first" contract from the brief.
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-nextpos-live-test-"));
    const nextPositionLogPath = join(dir, "nextPositionValidation.jsonl");
    const { client } = makeClient();
    const deps = makeLiveFishingDeps({
      client,
      config: TEST_CONFIG,
      guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
      transitionsPath: join(dir, "fish-patterns.jsonl"),
      nextPositionLogPath,
      ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
      logsDir: join(dir, "logs"),
      guardStatePath: join(dir, "guard-budget.json"),
    });
    const result = await runOneCast(deps);
    expect(result.outcome).toBe("escaped");
    expect(nextPositionOverrideStats(nextPositionLogPath).ready).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("records the full configured energyCostPerCast on a genuinely new start_run, before any energy is ever read (session 31, CODEXREVIEW #8)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-nextpos-live-test-"));
    const { client } = makeClient();
    const guards = new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 });
    // [session 39, CODEXAUDIT #4 follow-on] This test used to omit
    // `nextPositionLogPath`/`logsDir`, so every run of it appended a real HIT
    // record (this mock's turn-1 position always matches its own turn-0
    // prediction) to the REAL `data/nextPositionValidation.jsonl` and dumped a
    // spurious "unknown midcast field" file into the REAL `logs/` — confirmed
    // live: the on-disk file had accumulated 35 fake hits (docId "99999999",
    // matching this exact mock) before this fix, already past
    // `NEXT_POSITION_OVERRIDE_THRESHOLD`. Same bug class as session 30/31's
    // fixture/guard-budget pollution, a third occurrence, this time in the
    // file that literally documents the first two. `makeLiveFishingDeps`
    // (session 40) now makes this structurally impossible: every isolated
    // path is a required argument, not an optional field a call site can
    // silently skip.
    const deps = makeLiveFishingDeps({
      client,
      config: TEST_CONFIG,
      guards,
      transitionsPath: join(dir, "fish-patterns.jsonl"),
      guardStatePath: join(dir, "guard-budget.json"),
      nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
      ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
      logsDir: join(dir, "logs"),
    });

    // `client` (from `makeClient()`) never implements `getEnergy` — if
    // committing the spend still depended on reading account energy, this
    // would throw on a missing method instead of resolving with the
    // committed amount recorded, same proof shape as the dungeon-side test.
    await runOneCast(deps);
    expect(guards.spentEnergy).toBe(TEST_CONFIG.dendren!.energyCostPerCast);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("detectPossibleDualYield — session 30, brief §3, forward detection only", () => {
  it("does NOT flag an ordinary single catch (one fish + one Hard Core credit)", () => {
    const raw = {
      data: { events: [{ type: "FISH_DIED" }] },
      gameItemBalanceChanges: [{ id: 517 }, { id: 845 }],
    };
    expect(detectPossibleDualYield(raw)).toBeNull();
  });

  it("does NOT flag a plain non-catch response", () => {
    expect(detectPossibleDualYield({ data: { events: [] }, gameItemBalanceChanges: [] })).toBeNull();
    expect(detectPossibleDualYield({})).toBeNull();
  });

  it("flags two FISH_DIED events in one response", () => {
    const raw = { data: { events: [{ type: "FISH_DIED" }, { type: "FISH_DIED" }] } };
    const hit = detectPossibleDualYield(raw);
    expect(hit).not.toBeNull();
    expect(hit!.reason).toContain("2 FISH_DIED");
  });

  it("flags two distinct non-currency items credited in one response", () => {
    const raw = { gameItemBalanceChanges: [{ id: 517 }, { id: 519 }, { id: 845 }] };
    const hit = detectPossibleDualYield(raw);
    expect(hit).not.toBeNull();
    expect(hit!.reason).toContain("2 distinct non-currency items");
  });

  it("does NOT flag two Hard Core credits in one response (same currency id, not two fish)", () => {
    const raw = { gameItemBalanceChanges: [{ id: 845 }, { id: 845 }] };
    expect(detectPossibleDualYield(raw)).toBeNull();
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

  function makeDeps(client: GigaverseClient, dir: string): LiveFishingDeps {
    return makeLiveFishingDeps({
      client,
      config: TEST_CONFIG,
      guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
      transitionsPath: join(dir, "fish-patterns.jsonl"),
      guardStatePath: join(dir, "guard-budget-fishing.json"),
      nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
      ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
      logsDir: join(dir, "logs"),
    });
  }

  it("classifies the real 'reached max runs for fishing' rejection as a budget trip and persists the exhausted mark", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-fishing-cap-test-"));
    const guardStatePath = join(dir, "guard-budget-fishing.json");
    const deps = makeDeps(fakeClient("Player has reached max runs for fishing"), dir);

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
    const deps = makeDeps(fakeClient("some unrelated server error"), dir);

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

describe("runOneCast — contextual fallback live wiring (session 33, CODEXIMPROVE #3)", () => {
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

  function fakeDoc(fishPosition: [number, number], completeCid: boolean) {
    return {
      docId: "88888888",
      docType: "FISHING_GAME",
      data: {
        deckCardData: [fakeCard()],
        playerMaxHp: 10,
        playerHp: 10,
        fishHp: 10,
        fishMaxHp: 10,
        fishPosition,
        previousFishPosition: [0, 0],
        gridSize: 4,
        focusPoint: [0, 0],
        focusMeter: 3,
        focusMeterMax: 3,
        focusMechanicEnabled: true,
        patternIndex: 0,
        fullDeck: [1],
        nextCardIndex: 1,
        cardInDrawPile: 0,
        hand: [1],
        discard: [],
      },
      COMPLETE_CID: completeCid,
      SUCCESS_CID: completeCid ? false : undefined,
      IS_JUICED_CID: false,
      MULTIPLIER_CID: 1,
    };
  }

  function makeClient(): GigaverseClient {
    let playCount = 0;
    return {
      getFishingState: async () => ({ gameState: null }),
      getFishingActionToken: () => "",
      postFishingAction: async (body: { action: string }) => {
        if (body.action === "start_run") {
          return { success: true, message: "Game started successfully.", data: { doc: fakeDoc([1, 1], false), events: [] }, actionToken: 1 };
        }
        playCount++;
        if (playCount === 1) {
          // Turn 0: fish moves (1,1) -> (2,1) — this is the "from" cell turn 1's
          // context lookup will use, with previous displacement (dx=1,dy=0).
          return { success: true, message: "Cards played successfully.", data: { doc: fakeDoc([2, 1], false), events: [] }, actionToken: 2 };
        }
        // Turn 1: cast ends here regardless of the chosen focus — this test is
        // about the wiring not crashing and consulting the seeded context data,
        // not about a specific card-choice outcome.
        return { success: true, message: "Cards played successfully.", data: { doc: fakeDoc([3, 1], true), events: [] }, actionToken: 3 };
      },
    } as unknown as GigaverseClient;
  }

  /** Three independent clean casts, each arriving at (2,1) via displacement (1,0) then continuing on — support for the context key the fake live cast's turn 1 will query. [session 38] The shipped tier now shrinks continuously rather than gating on a cast-count threshold, but this test only asserts the corpus-stats log line, not the resulting distribution, so it's unaffected by that change. */
  function seedContextCorpus(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    const lines: string[] = [];
    for (const castId of ["seed1", "seed2", "seed3"]) {
      lines.push(JSON.stringify({ ts: "2026-08-18T00:00:00.000Z", castId, turn: 0, from: [1, 1], to: [2, 1], gridSize: 4 }));
      lines.push(JSON.stringify({ ts: "2026-08-18T00:00:01.000Z", castId, turn: 1, from: [2, 1], to: [3, 1], gridSize: 4 }));
    }
    writeFileSync(path, lines.join("\n") + "\n");
  }

  it("consults pre-existing contextual corpus data without crashing, and logs that it found support", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-contextual-live-test-"));
    const transitionsPath = join(dir, "fish-patterns.jsonl");
    seedContextCorpus(transitionsPath);

    const deps = makeLiveFishingDeps({
      client: makeClient(),
      config: TEST_CONFIG,
      guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
      transitionsPath,
      guardStatePath: join(dir, "guard-budget.json"),
      nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
      ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
      logsDir: join(dir, "logs"),
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const result = await runOneCast(deps);
      expect(result.outcome).toBe("escaped"); // fakeDoc's SUCCESS_CID is false on the terminal turn
      const logged = logSpy.mock.calls.map((c) => String(c[0]));
      expect(logged.some((l) => l.includes("contextual fallback: 1 (cell, previous-direction) key(s) from 3 clean logged cast(s)"))).toBe(true);
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a seeded cast with a CODEXREVIEW #5 duplicate-turn conflict is excluded from context support, same as mineFishPatterns.ts's testPrimitives", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-contextual-live-test-"));
    const transitionsPath = join(dir, "fish-patterns.jsonl");
    seedContextCorpus(transitionsPath);
    // A 4th cast with a conflicting duplicate at turn 0 — must not count toward support.
    appendFileSync(
      transitionsPath,
      JSON.stringify({ ts: "t", castId: "corrupted", turn: 0, from: [1, 1], to: [2, 1], gridSize: 4 }) +
        "\n" +
        JSON.stringify({ ts: "t2", castId: "corrupted", turn: 0, from: [1, 1], to: [9, 9], gridSize: 4 }) +
        "\n",
    );

    const deps = makeLiveFishingDeps({
      client: makeClient(),
      config: TEST_CONFIG,
      guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
      transitionsPath,
      guardStatePath: join(dir, "guard-budget.json"),
      nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
      ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
      logsDir: join(dir, "logs"),
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runOneCast(deps);
      const logged = logSpy.mock.calls.map((c) => String(c[0]));
      // Still exactly 3 clean casts (not 4) and still exactly 1 context key —
      // the corrupted 4th cast's conflicting turn-0 record is excluded, not
      // silently folded in as a 4th supporting cast.
      expect(logged.some((l) => l.includes("contextual fallback: 1 (cell, previous-direction) key(s) from 3 clean logged cast(s)"))).toBe(true);
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("RunLog — constructor path override (session 41)", () => {
  it("writes into a passed directory, not the real \"logs\"", () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-runlog-fishing-test-"));
    try {
      const log = new RunLog(dir);
      log.write({ kind: "test-entry" });

      expect(existsSync(log.filePath)).toBe(true);
      expect(log.filePath.startsWith(dir)).toBe(true);
      expect(log.filePath.startsWith("logs")).toBe(false);
      const contents = readFileSync(log.filePath, "utf8");
      expect(contents).toContain("test-entry");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
