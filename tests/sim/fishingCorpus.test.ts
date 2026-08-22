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

import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadFishingCorpus, summarizeFishingCorpus } from "../../src/sim/fishingCorpus.js";
import { FixtureWriter, runOneCast, type LiveFishingDeps } from "../../scripts/liveFishing.js";
import { GigaverseClient } from "../../src/api/client.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { FishingGameDoc } from "../../src/api/fishing.js";

describe("loadFishingCorpus / summarizeFishingCorpus — against the real committed corpus", () => {
  it("counts by docId, not by directory or raw file — reproduces the CODEXREVIEW-corrected numbers", () => {
    const casts = loadFishingCorpus();
    const summary = summarizeFishingCorpus(casts);
    // [session 45] Recount after this session's live batch: 2 more completed
    // casts, both escaped, 0 caught (session 44's 16-cast batch is the
    // previous entry here). `incomplete` stays 1 — that is session 44's
    // docId 12975755, which a `--dry-run` read this session confirmed is no
    // longer the account's active cast. If this fails after a future live
    // session added real casts, update the expected numbers — don't revert
    // the loader.
    // [session 50] Recount after this session's 5-cast batch: 5 more
    // completed casts, 1 caught (12992267, a Barnaboo). Previous entry was
    // session 49's.
    // [session 60] Recount after this session's 5-cast batch: 5 more completed
    // casts, 1 caught (13004295, a Finley). Old figures 89/492/392/13/75/1.
    // `incomplete` stays 1 — still session 44's docId 12975755, untouched.
    // [session 63] Recount after this session's ONE cast, and every delta
    // reconciles with exactly that cast: +1 cast, +5 responseDocs (its 5 state
    // files), +3 playTurns (it was a 3-turn catch), +1 caught, `escaped`
    // UNCHANGED at 79. Old figures 94/517/411/14/79/1. The cast was
    // classified clean non-oil — the on-demand policy wanted no oil, so it is
    // an ordinary member of the non-oil arm, not a third-state exclusion.
    // [session 64] The §2 oil batch (6 casts, 3 caught / 3 escaped) plus the
    // post-fix re-run (1 cast, escaped, and the corpus's FIRST real oil cast —
    // one Mid Focus Oil consumed). 7 casts total: +7 casts, +40 responseDocs,
    // +29 playTurns, +3 caught, +4 escaped, `incomplete` unchanged at 1.
    // `playTurns` counts the `Item used successfully.` response, which is not a
    // turn — see castTrace's ITEM_MESSAGE. Old figures 95/522/414/15/79/1.
    // [session 65] The seven-cast batch: +7 casts, +44 responseDocs,
    // +27 playTurns, +5 caught, +2 escaped, `incomplete` unchanged at 1.
    // Old figures 102/562/443/18/83/1. Four of the seven consumed an oil and
    // one of those consumed THREE, so `responseDocs` outruns `playTurns` by
    // more than usual here — `use_fishing_item` responses are docs and are not
    // turns (castTrace's ITEM_MESSAGE).
    // [session 68] Five-cast batch: 109 -> 114, +25 responseDocs, +14
    // playTurns, +3 caught, +2 escaped, `incomplete` unchanged at 1. Three of
    // the five consumed an oil; two of those three were killed BY the oil.
    // [session 69] Ten-cast batch: 114 -> 124, +65 responseDocs, +37
    // playTurns, +8 caught, +2 escaped, `incomplete` unchanged at 1. Six of
    // the ten consumed an oil and ten oils were spent in total, so
    // `responseDocs` again outruns `playTurns` by more than the turn count —
    // `use_fishing_item` responses are docs and are not turns (castTrace's
    // ITEM_MESSAGE).
    // [session 72] Four-cast batch (the day's remaining allowance): 124 -> 128,
    // +25 responseDocs, +16 playTurns, +2 caught, +2 escaped, `incomplete`
    // unchanged at 1. Two of the four consumed an oil.
    expect(summary.casts).toBe(128);
    expect(summary.responseDocs).toBe(721);
    expect(summary.playTurns).toBe(537);
    expect(summary.caught).toBe(36);
    expect(summary.escaped).toBe(91);
    expect(summary.incomplete).toBe(1);
  });

  /**
   * **[session 68 §4] `ls fixtures/fishing-casts/live | wc -l` IS NOT THE CAST
   * COUNT, and the session-67 brief asked this session to hunt a cast that was
   * never missing.**
   *
   * The brief said: *"`fixtures/fishing-casts/live/` holds 110 `cast-*`
   * directories and the corpus loads 109. One cast does not load. Find out
   * which and why."* Nothing fails to load. The two numbers count different
   * things and merely happened to be adjacent:
   *
   *   - A directory is created per **invocation** of `liveFishing.ts`, not per
   *     cast. A five-cast batch writes ONE directory holding five casts; this
   *     corpus has directories holding up to six.
   *   - A run that starts no cast — every `--dry-run`, and any invocation that
   *     halts before `start_run` — still creates a directory containing only
   *     `raw`. There were 23 such directories when this was written.
   *
   * The near-equality was an artefact of a corpus mostly gathered one cast at
   * a time, and it invited exactly the wrong hypothesis. This replaces the
   * coincidence with the identity that actually holds, so the question cannot
   * be asked a third time.
   *
   * Asserted as RELATIONS, not literals: the directory count grows with every
   * invocation, including ones that record nothing, so pinning it would make
   * this fail for reasons that mean nothing.
   */
  it("reconciles with the fixture tree: distinct docIds, NOT directories", () => {
    const casts = loadFishingCorpus();
    const root = join("fixtures", "fishing-casts", "live");
    const dirs = readdirSync(root).filter((d) => d.startsWith("cast-"));
    const withStates = dirs.filter(
      (d) => existsSync(join(root, d)) && readdirSync(join(root, d)).some((f) => f.startsWith("state-")),
    );
    // The corpus counts casts by docId, and that is the only number any
    // statistic in this repo is computed on.
    expect(new Set(casts.map((c) => c.docId)).size).toBe(casts.length);
    // Strictly MORE directories than directories-with-data, because empty ones
    // exist; and strictly FEWER directories-with-data than casts, because a
    // batch packs several casts into one. Both inequalities are the point.
    expect(dirs.length).toBeGreaterThan(withStates.length);
    expect(withStates.length).toBeLessThan(casts.length);
  });

  it("every cast has at least one start_run response, except a cast this project's own process only ever RESUMED", () => {
    const casts = loadFishingCorpus();
    // [session 44] docId 12975152 was an active pre-existing cast (the
    // user's own manual play, user-confirmed OK to take over) when this
    // project's process first read it — logged as "resuming_existing_cast"
    // rather than a fresh start_run (logs/fishing-2026-08-19-00-52-19.jsonl's
    // very first event). No start_run for it exists in OUR committed corpus
    // because we never sent one. A genuinely legitimate exception, not a gap
    // in the loader; exactly one is allowed. (Not to be confused with
    // 12975755, this same session's LATER interrupted cast — see
    // TASKS.md/SPEC-fishing.md §4c — which DID get a real start_run from us,
    // it just never finished playing.)
    const withoutStartRun = casts.filter((c) => !c.responses.some((r) => r.kind === "start_run"));
    expect(withoutStartRun.map((c) => c.docId)).toEqual(["12975152"]);
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
      // [session 45] Constructed through the SHARED factory
      // (`tests/helpers/liveFishingDeps.ts`) rather than as a raw object
      // literal. As a literal this call site silently escaped the type guard
      // that covers every other `LiveFishingDeps` construction, and leaked
      // this test's synthetic docIds into the real
      // `data/ringPrediction.jsonl` the moment session 45 added that path —
      // the fourth occurrence of the bug class the comments below document
      // the first three of. See that file's header.
      const p = runOneCast(makeLiveFishingDeps({
        client,
        config: TEST_CONFIG,
        guards,
        fixtures,
        log,
        address: "0xUSER",
        dryRun: false,
        // [session 30, QUESTIONS.md §14] Without this, runOneCast defaults
        // transitionsPath to the REAL data/fish-patterns.jsonl — this test's
        // synthetic docIds 9001/9002 leaked into the real corpus every time
        // it ran, which is exactly what session 29 found and couldn't
        // explain. Must stay isolated to `root`.
        transitionsPath: join(root, "fish-patterns-test.jsonl"),
        // [session 31, CODEXREVIEW #8] Same leak, different file: without
        // this, a successful start_run's newly-committed energy spend
        // (recordEnergySpent, added this session) persists via
        // saveGuardBudget's DEFAULT_GUARD_STATE_PATH fallback — the
        // DUNGEON guard file, not fishing's — every time this test runs.
        // Found by diffing data/guard-budget.json before/after this file's
        // own test suite.
        guardStatePath: join(root, "guard-budget-test.json"),
        // [session 39] Same isolation convention as transitionsPath/
        // guardStatePath above — this fakeDoc carries no `nextPosition`
        // field today so neither path is actually exercised, but every
        // I/O-owning runOneCast construction isolates ALL of its optional
        // paths on principle (CLAUDE.md working-style), not just the ones
        // proven to fire by the current fixture.
        nextPositionLogPath: join(root, "next-position-test.jsonl"),
        ringPredictionLogPath: join(root, "ring-prediction-test.jsonl"),
        oilCastStatePath: join(root, "oil-cast-states-test.jsonl"),
        nextPositionArmStatePath: join(root, "nextPositionOverrideDisarm-test.json"),
        logsDir: join(root, "logs"),
      }));
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

// ---------------------------------------------------------------------------
// [session 61 §4b] The oil-era flag, derived from the capture rather than
// written by the live loop — see `FishingCast.consumablesUsed`'s doc comment
// for why that is the stronger form of "a flag on the cast record".
// ---------------------------------------------------------------------------

describe("the oil flag — derived off the server's own consumablesUsed", () => {
  const corpus = loadFishingCorpus();

  it("classifies EVERY cast, with no cast left undefined", () => {
    expect(corpus.length).toBeGreaterThan(0);
    for (const c of corpus) {
      expect(typeof c.consumablesUsed).toBe("number");
      expect(typeof c.oilEra).toBe("boolean");
      expect(c.slotsUsed).toHaveLength(3);
    }
  });

  it("finds the two consumable casts — one inherited, one this bot's own first oil spend", () => {
    // [session 61] Written expecting an empty result, and it was not empty.
    // The session-61 brief states "the corpus contains zero oil casts" and
    // this agent repeated it in a doc comment before running the check.
    // `12975152` (fixtures/fishing-casts/live/cast-2026-08-19-00-52-19)
    // carries `consumablesUsed: 1` and `fishingConsumableSlotUsed[0] === true`
    // on its FIRST captured state — so the consumable was spent at or before
    // cast start, not mid-cast by this bot. No `use_fishing_item` appears in
    // that cast's log, and the bot's own balance read has never returned a
    // positive count, so the spend was not ours.
    //
    // WHICH consumable is not recoverable: the board state counts consumables
    // and marks slots without naming one, and both
    // `fintuitionOilBoostPercent` and `dualYieldOilBoostPercent` read 0 on
    // this cast, which only rules out those two families. That gap is exactly
    // what `RingPredictionRecord.oilItemIdsUsed` exists to close going forward.
    //
    // Pinned as a COUNT with the id named, deliberately not as "expect
    // exactly this docId forever": a second consumable cast appearing is real
    // news and should fail this test rather than slip through.
    //
    // ── [session 64] IT APPEARED, AND THE TEST CAUGHT IT ────────────────────
    //
    // `13019015` is the FIRST oil this bot has ever consumed: one Mid Focus Oil
    // (item 942, `slotIndex: 0`) at `focusMeter: 0` on turn 7, restoring the
    // meter 0 -> 2. Unlike `12975152` this one IS ours and every unknown that
    // cast left open is closed on it — the item is named on the per-turn record
    // and the whole `use_fishing_item` envelope is captured.
    //
    // The two are kept in ONE assertion rather than split, because what the
    // test is really pinning is that the derived flag finds every consumable
    // cast whatever its provenance.
    // ── [session 65] FIVE now, and the fifth broke the one-slot pattern ────
    //
    // The seven-cast batch added three: `13019665` (Mid Relaxing Oil 937 — the
    // first 937 this bot has ever spent, confirming `slotIndex: 0` for it),
    // `13019677`, and `13019682`.
    //
    // **`13019682` is the one that matters.** It carries `consumablesUsed: 3`
    // and `[true, true, true]` — THREE consumes in a single cast, walking
    // slots 0, 1 and 2. Every earlier oil cast used exactly slot 0, which is
    // precisely why a hard-coded `slotIndex: 0` survived from session 44 to
    // session 65 without ever being wrong. It became wrong the first time a
    // cast wanted a second oil, and the server answered HTTP 400.
    //
    // So the per-cast assertion is no longer "one oil in slot 0". It is the
    // invariant that actually holds: `consumablesUsed` equals the number of
    // slots marked used, and the used slots are a PREFIX — the cursor never
    // skips a free slot or reuses a spent one.
    const oilCasts = corpus.filter((c) => c.oilEra).sort((a, b) => a.docId.localeCompare(b.docId));
    // [session 68] +3 from the five-cast batch. Note `13022748` records ONE
    // consumable, not two: its second `use_fishing_item` was rejected HTTP 400
    // and the server counted nothing — which is the corpus confirming that the
    // rejected consume really was rejected rather than half-applied.
    // [session 69] +6 from the ten-cast batch: `13024476` (THREE consumables,
    // all Focus — the second cast ever to walk all three slots, and the first
    // to do it with one oil type), `13024510`, `13024550` (2), `13024562`,
    // `13024574`, `13024581` (2). Ten oils across six casts; the prefix
    // invariant below held on every one, which is the slot cursor from session
    // 65 now tested across a much wider sample than the single cast that
    // motivated it.
    // [session 72] +2 from the four-cast batch: `13025987` (TWO consumables,
    // 10 turns, ESCAPED) and `13025990` (one, 2 turns, caught). Checked against
    // the log rather than assumed: `13025987`'s pair were both FOCUS oil (942),
    // fired by the meter-zero trigger on turns 4 and 6 — the Relaxing per-cast
    // cap of 2 did not bind and has still never bound. So the batch added 2 oil
    // casts and only 1 oil-arm catch; the arm went 10/12 -> 11/14, not 12/14.
    expect(oilCasts.map((c) => c.docId)).toEqual([
      "12975152", "13019015", "13019665", "13019677", "13019682",
      "13022748", "13022874", "13022876",
      "13024476", "13024510", "13024550", "13024562", "13024574", "13024581",
      "13025987", "13025990",
    ]);
    for (const c of oilCasts) {
      const used = c.slotsUsed!.filter(Boolean).length;
      expect(c.consumablesUsed).toBe(used);
      expect(c.slotsUsed).toEqual([...Array(used).fill(true), ...Array(3 - used).fill(false)]);
    }
    // And the multi-consume cast is named, so this stops being a vacuous
    // prefix check if the corpus ever loses it.
    expect(oilCasts.find((c) => c.docId === "13019682")!.consumablesUsed).toBe(3);
    // ...and everything else is genuinely clean, which is what §4b's pooling
    // rules rest on.
    expect(corpus.filter((c) => !c.oilEra).length).toBe(corpus.length - oilCasts.length);
  });

  it("oilEra and consumablesUsed agree, so a call site may use either", () => {
    for (const c of corpus) expect(c.oilEra).toBe(c.consumablesUsed > 0 || c.slotsUsed.some((v) => v));
  });
});
