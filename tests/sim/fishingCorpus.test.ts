/**
 * tests/sim/fishingCorpus.test.ts — [session 28, CODEXREVIEW #1/#5].
 *
 * Two things verified:
 *  1. Against the REAL committed fixture tree, the loader reproduces the
 *     corrected corpus numbers (50 casts / 225 response docs / 169 play
 *     turns / 7 caught), not the old directory/file-count numbers session
 *     26/27 reported. Same discipline as the repo's other corpus-total
 *     assertions (DECISIONS 2026-08-15): expected to need updating after
 *     every future capture, and that's the point — it forces new data to be
 *     looked at instead of silently drifting.
 *  2. The actual regression for the bug: one CLI invocation covering two
 *     casts (a fresh `FixtureWriter` per cast, exactly what `scripts/
 *     liveFishing.ts`'s `main()` loop now does) must produce fixtures the
 *     loader counts as 2 casts — via the real `runOneCast` against a mocked
 *     `fetch`, not a hand-rolled fixture tree, so the test exercises the
 *     same code path a live `--casts=2` invocation does.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadFishingCorpus, summarizeFishingCorpus } from "../../src/sim/fishingCorpus.js";
import { FixtureWriter, runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { GigaverseClient } from "../../src/api/client.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { FishingGameDoc } from "../../src/api/fishing.js";

describe("loadFishingCorpus / summarizeFishingCorpus — against the real committed corpus", () => {
  it("counts by docId, not by directory or raw file — reproduces the CODEXREVIEW-corrected numbers", () => {
    const casts = loadFishingCorpus();
    const summary = summarizeFishingCorpus(casts);
    // Direct recount, session 28 (CODEXREVIEW #1): 30 directories but 50
    // distinct casts, 225 response docs, 169 play_cards turns, 7 catches.
    // If this fails after a future live session added real casts, update
    // the expected numbers — don't revert the loader.
    expect(summary.casts).toBe(50);
    expect(summary.responseDocs).toBe(225);
    expect(summary.playTurns).toBe(169);
    expect(summary.caught).toBe(7);
    expect(summary.escaped).toBe(43);
    expect(summary.incomplete).toBe(0);
  });

  it("every cast has at least one start_run response", () => {
    const casts = loadFishingCorpus();
    expect(casts.every((c) => c.responses.some((r) => r.kind === "start_run"))).toBe(true);
  });
});

describe("loadFishingCorpus — synthetic corpus regression (session 28, CODEXREVIEW #1 item 4)", () => {
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

  function fakeDoc(docId: string, completeCid: boolean, successCid?: boolean): FishingGameDoc {
    return {
      docId,
      docType: "FISHING_GAME",
      data: {
        deckCardData: [fakeCard()],
        playerMaxHp: 10,
        playerHp: 10,
        fishHp: completeCid ? 0 : 10,
        fishMaxHp: 10,
        fishPosition: [0, 0],
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
      SUCCESS_CID: successCid,
      IS_JUICED_CID: false,
      MULTIPLIER_CID: 1,
    } as unknown as FishingGameDoc;
  }

  const TEST_CONFIG: BotConfig = {
    dungeonId: 5,
    energyCostPerRun: 20,
    maxRoom: 16,
    maxRunsPerDayGame: 12,
    dailyEnergyBudget: 60,
    maxRunsPerSession: 3,
    maxConsecutiveActionFailures: 3,
    dendren: {
      nodeId: "5",
      tierId: 1,
      energyCostPerCast: 12,
      maxCastsPerDayGame: 20,
      dailyEnergyBudget: 240,
      maxCastsPerSession: 20,
    },
  };

  let root: string;
  beforeEach(() => {
    vi.useFakeTimers();
    root = mkdtempSync(join(tmpdir(), "gigaruns-fishing-corpus-test-"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    rmSync(root, { recursive: true, force: true });
  });

  it("a fresh FixtureWriter per cast (main()'s loop shape) produces fixtures the loader counts as exactly 2 casts", async () => {
    const docIds = ["9001", "9002"];
    let castIndex = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          const body = { gameState: null, pondEntryTiers: [], maxPerDay: 20, maxPerDayJuiced: 20, node0Energy: 12, node1Energy: 16, node2Energy: 20 };
          return { status: 200, text: async () => JSON.stringify(body) } as Response;
        }
        const sent = JSON.parse((init!.body as string) ?? "{}") as { action: string };
        const docId = docIds[castIndex]!;
        if (sent.action === "start_run") {
          const body = { success: true, message: "Game started successfully.", data: { doc: fakeDoc(docId, false), events: [] }, actionToken: 1 };
          return { status: 200, text: async () => JSON.stringify(body) } as Response;
        }
        // play_cards -> terminal (escaped) in one turn, to keep the cast short.
        const body = { success: true, message: "Cards played successfully.", data: { doc: fakeDoc(docId, true, false), events: [] }, actionToken: 2 };
        return { status: 200, text: async () => JSON.stringify(body) } as Response;
      }),
    );

    const client = new GigaverseClient({ jwt: "test-jwt" });
    for (let i = 0; i < 2; i++) {
      const guards = new GuardState(TEST_CONFIG.dendren ? { dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 } : TEST_CONFIG);
      // The fix under test: construct a NEW FixtureWriter per cast, pointed
      // at a shared tmp root — exactly what scripts/liveFishing.ts's main()
      // loop now does (previously constructed once, reused across casts).
      const fixtures = new FixtureWriter("0xUSER", (t) => t, root);
      const log = { write: vi.fn(), filePath: "test.jsonl" } as unknown as LiveFishingDeps["log"];
      const p = runOneCast({
        client,
        config: TEST_CONFIG,
        guards,
        fixtures,
        log,
        address: "0xUSER",
        dryRun: false,
      });
      await vi.runAllTimersAsync();
      await p;
      castIndex++;
    }

    const corpus = loadFishingCorpus(root);
    expect(corpus.length).toBe(2);
    expect(corpus.map((c) => c.docId).sort()).toEqual(["9001", "9002"]);
    for (const cast of corpus) {
      expect(cast.responses.filter((r) => r.kind === "start_run").length).toBe(1);
      expect(cast.responses.filter((r) => r.kind === "play_cards").length).toBe(1);
    }
    const summary = summarizeFishingCorpus(corpus);
    expect(summary).toMatchObject({ casts: 2, responseDocs: 4, playTurns: 2, caught: 0, escaped: 2, incomplete: 0 });
  });
});
