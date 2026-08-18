/**
 * tests/liveRun.test.ts — scripts/liveRun.ts, Task 6's live loop.
 *
 * The pure helpers (classifyPhase, selectRewardByIndex, selectEnemyPathByIndex,
 * buildEnvelope, buildPathSelectionEnvelope, wireBoonToOption) are tested
 * directly. The loop itself (`runOnce`) is tested against a real
 * `GigaverseClient` with a mocked global `fetch`, same pattern as
 * `tests/api/client.test.ts` — nothing here touches the real network.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildBattleState,
  buildEnvelope,
  buildPathSelectionEnvelope,
  classifyPhase,
  findRealRunsToday,
  FixtureWriter,
  KNOWN_SIDE_KEYS,
  locateLowestTierOption,
  locateRewardOption,
  moveToAction,
  postWithVerifiedRetry,
  ResumeConfirmationRequired,
  runOnce,
  selectEnemyPathByIndex,
  selectRewardByIndex,
  unknownSideKeys,
  wireBoonToOption,
  type LiveRunDeps,
} from "../scripts/liveRun.js";
import { GigaverseClient } from "../src/api/client.js";
import { UnexpectedResponseError } from "../src/api/errors.js";
import type { BotConfig } from "../src/orchestrator/config.js";
import { GuardState, GuardTrip, isBudgetGuardTrip } from "../src/orchestrator/guards.js";
import { bootstrapFromCorpus, loadOpponentModel } from "../src/orchestrator/opponentModelPersistence.js";
import { OpponentModel, modelKey } from "../src/strategy/opponentModel.js";
import { LIVE_CONFIG } from "../src/strategy/config.js";
import { loadCorpus, type WireBoon, type WireRun, type WireSide } from "../src/sim/corpus.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const move = (atk: number, def: number, charges = 3) => ({
  startingATK: atk,
  startingDEF: def,
  currentATK: atk,
  currentDEF: def,
  currentCharges: charges,
  maxCharges: 3,
});

function fakeSide(id: string, hp = 30, hpMax = 30): WireSide {
  return {
    id,
    rock: move(12, 6),
    paper: move(8, 2),
    scissor: move(16, 4),
    health: { current: hp, starting: hp, currentMax: hpMax, startingMax: hpMax },
    shield: { current: 10, starting: 10, currentMax: 10, startingMax: 10 },
    lastMove: "",
    thisPlayerWin: false,
    otherPlayerWin: false,
    statusEffects: [],
  } as unknown as WireSide;
}

/**
 * `lootPhase`/`pathPhase`/`rewardPathPhase`/`enemyPathPhase` are declared
 * required (not `.optional()`) on the client's `RunSchema` even though
 * corpus.ts's hand-written `WireRun` interface marks them `?:` — a real
 * schema/interface mismatch, harmless here since these tests go through the
 * real client's validation and just need every required field present.
 */
function fakeRun(overrides: Record<string, unknown> = {}): WireRun {
  return {
    DUNGEON_ID_CID: 1,
    players: [fakeSide("player"), fakeSide("Enemy Room 63")],
    lootPhase: false,
    pathPhase: false,
    rewardPathPhase: false,
    enemyPathPhase: false,
    ...overrides,
  } as unknown as WireRun;
}

const TEST_CONFIG: BotConfig = {
  dungeonId: 5,
  energyCostPerRun: 20,
  maxRoom: 16,
  maxRunsPerDayGame: 12,
  dailyEnergyBudget: 60,
  maxRunsPerSession: 3,
  maxConsecutiveActionFailures: 3,
};

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const { status, body } = handler(url, init);
    return { status, text: async () => JSON.stringify(body) } as Response;
  });
}

/**
 * [session 29, CODEXREVIEW #6] A valid, empty `GET /game/dungeon/today`
 * response — `assertDungeonCapNotExhausted` now calls this before every
 * genuinely NEW `start_run`, so any test handler exercising that path needs
 * to answer it (a schema-valid body with no day-progress row, i.e.
 * "genuinely zero runs today so far" — never blocks).
 */
const DUNGEON_TODAY_EMPTY = { status: 200, body: { dungeonDataEntities: [], dayProgressEntities: [] } };

let guardStateTestDir: string;

beforeEach(() => {
  vi.useFakeTimers();
  guardStateTestDir = mkdtempSync(join(tmpdir(), "gigaruns-liverun-test-"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  rmSync(guardStateTestDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("classifyPhase", () => {
  it("returns 'over' for a null/undefined run", () => {
    expect(classifyPhase(null)).toBe("over");
    expect(classifyPhase(undefined)).toBe("over");
  });

  it("returns 'over' when either side's HP is <= 0", () => {
    expect(classifyPhase(fakeRun({ players: [fakeSide("me", 0), fakeSide("foe")] }))).toBe("over");
    expect(classifyPhase(fakeRun({ players: [fakeSide("me"), fakeSide("foe", 0)] }))).toBe("over");
  });

  it("returns 'combat' when both sides are alive and no phase flag is set", () => {
    expect(classifyPhase(fakeRun())).toBe("combat");
  });

  it("prioritises enemyPathPhase, then rewardPathPhase, then lootPhase", () => {
    expect(classifyPhase(fakeRun({ enemyPathPhase: true, rewardPathPhase: true }))).toBe("enemyPath");
    expect(classifyPhase(fakeRun({ rewardPathPhase: true, lootPhase: true }))).toBe("rewardPath");
    expect(classifyPhase(fakeRun({ lootPhase: true }))).toBe("loot");
  });
});

describe("buildBattleState", () => {
  it("carries the room number through and maps both sides via toCombatant", () => {
    const state = buildBattleState(fakeRun(), 3);
    expect(state.room).toBe(3);
    expect(state.me.id).toBe("player");
    expect(state.foe.id).toBe("Enemy Room 63");
    expect(state.me.moves.rock.atk).toBe(12);
  });
});

describe("moveToAction", () => {
  it("is the identity — MoveKey IS the wire action name (SPEC §2)", () => {
    expect(moveToAction("rock")).toBe("rock");
    expect(moveToAction("paper")).toBe("paper");
    expect(moveToAction("scissor")).toBe("scissor");
  });
});

describe("selectRewardByIndex", () => {
  it("maps 0-3 to reward_one..reward_four — reward_one confirmed live, session 08", () => {
    expect(selectRewardByIndex(0)).toBe("reward_one");
    expect(selectRewardByIndex(1)).toBe("reward_two");
    expect(selectRewardByIndex(2)).toBe("reward_three");
    expect(selectRewardByIndex(3)).toBe("reward_four");
  });

  it("throws rather than guessing past the observed 3-option offers", () => {
    expect(() => selectRewardByIndex(4)).toThrow();
  });
});

describe("selectEnemyPathByIndex", () => {
  it("maps 0-2 to path_one..path_three — path_two confirmed live, session 08", () => {
    expect(selectEnemyPathByIndex(0)).toBe("path_one");
    expect(selectEnemyPathByIndex(1)).toBe("path_two");
    expect(selectEnemyPathByIndex(2)).toBe("path_three");
  });

  it("throws rather than guessing past the observed 3-option offers", () => {
    expect(() => selectEnemyPathByIndex(3)).toThrow();
  });
});

describe("buildPathSelectionEnvelope", () => {
  it("matches the real envelope captured live for reward_one — dungeonId 0, actionToken empty string, extra data fields", () => {
    expect(buildPathSelectionEnvelope("reward_one", 0)).toEqual({
      action: "reward_one",
      dungeonId: 0,
      actionToken: "",
      data: { consumables: [], isJuiced: false, index: 0, itemId: 0, expectedAmount: 0, gearInstanceIds: [], devBoons: [] },
    });
  });

  it("matches the real envelope captured live for path_two — data.index 0, NOT the option's array position", () => {
    // Confirmed live: picking enemyPathOptions[1] (the second option) sent
    // path_two with data.index: 0, unlike reward_* where index tracks
    // position. Callers pass 0 explicitly for this family.
    expect(buildPathSelectionEnvelope("path_two", 0)).toEqual({
      action: "path_two",
      dungeonId: 0,
      actionToken: "",
      data: { consumables: [], isJuiced: false, index: 0, itemId: 0, expectedAmount: 0, gearInstanceIds: [], devBoons: [] },
    });
  });
});

// [session 09] The identity-not-position fix, session-09 brief §1: a retry
// must re-locate the intended option by stable fields, never resend the
// array position captured at decision time.
describe("locateRewardOption", () => {
  const boon = (type: string, val1: number, val2 = 0): WireBoon => ({ boonTypeString: type, selectedVal1: val1, selectedVal2: val2 });

  it("finds the intended boon by identity even at a different array position than before", () => {
    const run = fakeRun({
      rewardPathPhase: true,
      rewardPathOptions: [
        { index: 0, boon: boon("UpgradeRock", 4) },
        { index: 1, boon: boon("Heal", 8) },
        { index: 2, boon: boon("AddLuck", 1) },
      ],
    });
    // "Heal" was at position 1 when the decision was made; here it has
    // shifted to position 0 — identity must still find it there, not fail
    // or silently accept whatever sits at the old position 1.
    const shifted = fakeRun({
      rewardPathPhase: true,
      rewardPathOptions: [
        { index: 0, boon: boon("Heal", 8) },
        { index: 1, boon: boon("UpgradeRock", 4) },
        { index: 2, boon: boon("AddLuck", 1) },
      ],
    });
    expect(locateRewardOption(run, { type: "Heal", val1: 8, val2: 0 })).toBe(1);
    expect(locateRewardOption(shifted, { type: "Heal", val1: 8, val2: 0 })).toBe(0);
  });

  it("returns null — never a stale guess — when the intended boon is no longer offered", () => {
    const run = fakeRun({
      rewardPathPhase: true,
      rewardPathOptions: [
        { index: 0, boon: boon("UpgradeRock", 4) },
        { index: 1, boon: boon("AddLuck", 1) },
      ],
    });
    expect(locateRewardOption(run, { type: "Heal", val1: 8, val2: 0 })).toBeNull();
  });
});

describe("locateLowestTierOption", () => {
  it("finds whichever position currently holds tier 0, regardless of where it was before", () => {
    const runA = fakeRun({ enemyPathPhase: true, enemyPathOptions: [{ tier: 0, index: 0 }, { tier: 1, index: 1 }, { tier: 2, index: 2 }] });
    const runB = fakeRun({ enemyPathPhase: true, enemyPathOptions: [{ tier: 2, index: 0 }, { tier: 0, index: 1 }, { tier: 1, index: 2 }] });
    expect(locateLowestTierOption(runA)).toBe(0);
    expect(locateLowestTierOption(runB)).toBe(1);
  });

  // [session 09, live] Room 2's first live encounter offered NO Safe tier at
  // all — three options, tiers {2, 1, 1}. User-confirmed: expected game
  // behavior, not a capture gap. The generalized rule takes the lowest
  // offered tier regardless — no fallback to a "safer" option that isn't
  // actually present.
  it("falls back to the lowest NON-Safe tier when Safe isn't offered — session 09, live", () => {
    const run = fakeRun({ enemyPathPhase: true, enemyPathOptions: [{ tier: 2, index: 0 }, { tier: 1, index: 1 }, { tier: 1, index: 2 }] });
    expect(locateLowestTierOption(run)).toBe(1); // first of the two tier-1 options
  });

  it("returns null only on a genuinely empty offer", () => {
    const run = fakeRun({ enemyPathPhase: true, enemyPathOptions: [] });
    expect(locateLowestTierOption(run)).toBeNull();
  });
});

describe("buildEnvelope", () => {
  it("matches SPEC §2's confirmed request envelope shape", () => {
    expect(buildEnvelope("start_run", 5, 0)).toEqual({
      action: "start_run",
      dungeonId: 5,
      actionToken: 0,
      data: { consumables: [], isJuiced: false, index: 0 },
    });
  });

  it("carries a non-default index through for a loot_* selection", () => {
    expect(buildEnvelope("loot_two", 5, 42, 1).data.index).toBe(1);
    expect(buildEnvelope("loot_two", 5, 42, 1).actionToken).toBe(42);
  });
});

describe("unknownSideKeys", () => {
  it("returns nothing for a side with only known keys", () => {
    expect(unknownSideKeys(fakeSide("player") as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("flags a key not in KNOWN_SIDE_KEYS — the addendum §7 check 2 signal", () => {
    const side = { ...(fakeSide("player") as unknown as Record<string, unknown>), revealedMove: "rock" };
    expect(unknownSideKeys(side)).toEqual(["revealedMove"]);
  });

  it("KNOWN_SIDE_KEYS matches what scripts/fieldFrequency.ts found on the real corpus (SPEC §4e)", () => {
    // Regression guard: if the corpus grows a genuinely new key and someone
    // "fixes" this by adding it to KNOWN_SIDE_KEYS without re-reading SPEC
    // §4e first, this test's count at least makes the addition visible.
    expect(KNOWN_SIDE_KEYS.size).toBe(22);
  });
});

describe("wireBoonToOption", () => {
  it("reads the APPLIED value (selectedVal1/2), never val1Min/Max — DECISIONS 2026-08-14", () => {
    const wire = { boonTypeString: "Heal", selectedVal1: 16, selectedVal2: 0, val1Min: 8, val1Max: 8 };
    expect(wireBoonToOption(wire)).toEqual({ type: "Heal", val1: 16, val2: 0 });
  });
});

// ---------------------------------------------------------------------------
// runOnce — integration against a mocked fetch, no real network.
// ---------------------------------------------------------------------------

function makeDeps(dryRun: boolean): LiveRunDeps {
  return {
    client: new GigaverseClient({ jwt: "test-jwt" }),
    config: TEST_CONFIG,
    guards: new GuardState(TEST_CONFIG),
    model: new OpponentModel(),
    strategyConfig: LIVE_CONFIG,
    fixtures: { write: vi.fn(), dir: "test-fixtures" } as unknown as LiveRunDeps["fixtures"],
    log: { write: vi.fn(), filePath: "test.jsonl" } as unknown as LiveRunDeps["log"],
    dryRun,
    // [session 09] runOnce persists guard budget on every start_run — point
    // it at a throwaway path so exercising runOnce here never touches the
    // real data/guard-budget.json (session 09 caught this happening: a test
    // run left a stale seed a later real --dry-run then reported back).
    guardStatePath: join(guardStateTestDir, "guard-budget.json"),
  };
}

describe("runOnce — dry run", () => {
  it("never POSTs — logs the intended start_run and combat move, then stops", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        calls.push({ url, method: init?.method ?? "GET" });
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } };
      }),
    );
    const deps = makeDeps(true);
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await p;

    expect(calls.every((c) => c.method === "GET")).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("stops after one decision instead of polling forever against a live read", async () => {
    let getCalls = 0;
    vi.stubGlobal(
      "fetch",
      mockFetch(() => {
        getCalls++;
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } };
      }),
    );
    const deps = makeDeps(true);
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await p;
    // 2, not 1: one to check whether a run is already active (before deciding
    // whether to start_run — session 08 stage 3 found the server rejects a
    // second start_run on top of an existing run), one to read it for the
    // decision.
    expect(getCalls).toBe(2);
  });
});

describe("findRealRunsToday", () => {
  it("finds the matching dungeon's row by docId suffix and returns its count", () => {
    const today = {
      dayProgressEntities: [
        { docId: "DayCount#0xUSER#Dungeon#1", UINT256_CID: 12 },
        { docId: "DayCount#0xUSER#Dungeon#5", UINT256_CID: 11 },
      ],
    };
    expect(findRealRunsToday(today, 5)).toBe(11);
    expect(findRealRunsToday(today, 1)).toBe(12);
  });

  it("returns null when no row exists yet for that dungeon (genuinely zero runs today)", () => {
    expect(findRealRunsToday({ dayProgressEntities: [] }, 5)).toBeNull();
    expect(findRealRunsToday({}, 5)).toBeNull();
  });
});

describe("runOnce — resume confirmation (session 23)", () => {
  // [session 23] A run that already existed before this invocation — the
  // user's manually-started juiced run got silently resumed and played to a
  // room-2 death by the ordinary policy, with no way for the bot to see that
  // 3x Big Heal Juice / a Tier-3 entry was on the line. This is the fix.
  it("refuses to resume a pre-existing active run without --resume-existing, sends no POST", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch((_url, init) => {
        calls.push(init?.method ?? "GET");
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun(), entity: { ROOM_NUM_CID: 2 } } } };
      }),
    );
    const deps = makeDeps(false);
    await expect(runOnce(deps, { requireResumeConfirmation: true, resumeExisting: false })).rejects.toBeInstanceOf(ResumeConfirmationRequired);
    expect(calls.every((m) => m === "GET")).toBe(true);
  });

  it("proceeds to resume when --resume-existing is passed", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun(), entity: { ROOM_NUM_CID: 2 } } } })),
    );
    const deps = makeDeps(true); // dry-run so it stops after one decision, not a full combat loop
    const p = runOnce(deps, { requireResumeConfirmation: true, resumeExisting: true });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  it("dry-run never throws — it warns and simulates instead, since it never POSTs anyway", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun(), entity: { ROOM_NUM_CID: 2 } } } })),
    );
    const deps = makeDeps(true);
    const p = runOnce(deps, { requireResumeConfirmation: true, resumeExisting: false });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  it("does not require confirmation when requireResumeConfirmation is unset (orchestrator's continuous-loop use)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun(), entity: { ROOM_NUM_CID: 2 } } } })),
    );
    const deps = makeDeps(true);
    const p = runOnce(deps); // no opts at all — matches orchestrator.ts's call site
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });
});

describe("postWithVerifiedRetry", () => {
  // [session 08, live] reward_one returned HTTP 500 twice on an otherwise
  // byte-identical request — once where the pick had silently applied
  // server-side anyway, once where it hadn't. This is the fix.
  //
  // [session 09] `locate`/`buildBody` replace the old static `body` param —
  // every attempt, including the first, re-derives its index from whatever
  // state is passed in rather than trusting a captured position. These tests
  // aren't about identity resolution itself (locateRewardOption/
  // locateLowestTierOption have their own tests below); `locate` here just
  // mirrors "still in reward phase" -> index 0, same as the old static body.
  const initialRun = fakeRun({ rewardPathPhase: true });
  const locate = (r: ReturnType<typeof fakeRun>) => (classifyPhase(r) === "rewardPath" ? 0 : null);
  const buildBody = (index: number) => buildPathSelectionEnvelope("reward_one", index);
  const stillInRewardPhase = (r: ReturnType<typeof fakeRun>) => classifyPhase(r) === "rewardPath";

  function makeLog() {
    return { write: vi.fn(), filePath: "test.jsonl" } as unknown as import("../scripts/liveRun.js").LiveRunDeps["log"];
  }

  it("returns the response on a clean first success — no retry needed", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } })),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const guards = new GuardState(TEST_CONFIG);
    const log = makeLog();
    const p = postWithVerifiedRetry(client, guards, log, initialRun, locate, buildBody, stillInRewardPhase, "reward selection rejected");
    await vi.runAllTimersAsync();
    const resp = await p;
    expect(resp).not.toBeNull();
  });

  it("does NOT retry if a re-check shows the action already applied despite the error", async () => {
    let postCalls = 0;
    vi.stubGlobal(
      "fetch",
      mockFetch((_url, init) => {
        const method = init?.method ?? "GET";
        if (method === "POST") {
          postCalls++;
          return { status: 500, body: { success: false, message: "server error" } };
        }
        // The re-check: phase has moved on, the pick landed anyway.
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun({ rewardPathPhase: false, enemyPathPhase: true }) } } };
      }),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const guards = new GuardState(TEST_CONFIG);
    const log = makeLog();
    const p = postWithVerifiedRetry(client, guards, log, initialRun, locate, buildBody, stillInRewardPhase, "reward selection rejected");
    await vi.runAllTimersAsync();
    const resp = await p;
    expect(resp).toBeNull(); // applied despite the error — nothing further to write to fixtures
    expect(postCalls).toBe(1); // never retried
  });

  it("retries while the re-check shows the action is still genuinely pending, then succeeds", async () => {
    let postCalls = 0;
    vi.stubGlobal(
      "fetch",
      mockFetch((_url, init) => {
        const method = init?.method ?? "GET";
        if (method === "POST") {
          postCalls++;
          if (postCalls === 1) return { status: 500, body: { success: false, message: "server error" } };
          return { status: 200, body: { success: true, actionToken: 2, data: { run: fakeRun() } } };
        }
        // Re-check after the first failure: still pending, genuinely never landed.
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun({ rewardPathPhase: true }) } } };
      }),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const guards = new GuardState(TEST_CONFIG);
    const log = makeLog();
    const p = postWithVerifiedRetry(client, guards, log, initialRun, locate, buildBody, stillInRewardPhase, "reward selection rejected");
    await vi.runAllTimersAsync();
    const resp = await p;
    expect(resp).not.toBeNull();
    expect(postCalls).toBe(2);
  });

  // [session 28, CODEXREVIEW #4] Before the client's own 5xx-retry fix, a
  // failed POST followed by a transient state-read 500 read as "no active
  // run", and postWithVerifiedRetry treated that as "the action is no
  // longer pending" — silently reporting it as applied when it never was.
  // Now a PERSISTENT 5xx on the re-check throws instead, and that throw
  // must propagate out of postWithVerifiedRetry rather than being
  // swallowed into a null "applied despite the error" result.
  it("halts (does not report 'applied') when the POST fails and the state re-check 5xxs persistently", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((_url, init) => {
        const method = init?.method ?? "GET";
        if (method === "POST") return { status: 500, body: { success: false, message: "server error" } };
        // Every re-check GET also 5xxs — a genuine outage, not idle.
        return { status: 500, body: "<html>error</html>" };
      }),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const guards = new GuardState(TEST_CONFIG);
    const log = makeLog();
    const p = postWithVerifiedRetry(client, guards, log, initialRun, locate, buildBody, stillInRewardPhase, "reward selection rejected");
    const assertion = expect(p).rejects.toBeInstanceOf(UnexpectedResponseError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("trips the guard after maxConsecutiveActionFailures if the action never lands", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((_url, init) => {
        const method = init?.method ?? "GET";
        if (method === "POST") return { status: 500, body: { success: false, message: "server error" } };
        // Every re-check says still pending — the action genuinely never lands.
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun({ rewardPathPhase: true }) } } };
      }),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const guards = new GuardState(TEST_CONFIG); // maxConsecutiveActionFailures: 3
    const log = makeLog();
    const p = postWithVerifiedRetry(client, guards, log, initialRun, locate, buildBody, stillInRewardPhase, "reward selection rejected");
    const assertion = expect(p).rejects.toBeInstanceOf(GuardTrip);
    await vi.runAllTimersAsync();
    await assertion;
  });
});

describe("runOnce — stage 2 (single POST then halt)", () => {
  it("sends exactly one start_run POST and returns without polling further", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        calls.push({ url, method, body: init?.body as string | undefined });
        if (method === "GET" && url.includes("dungeon/today")) return DUNGEON_TODAY_EMPTY;
        // The pre-check GET must see "no active run" or runOnce correctly
        // skips start_run and resumes instead (see the test below) — this
        // test wants the start_run path, so the GET has to come back idle.
        if (method === "GET") {
          return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
        }
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } };
      }),
    );
    const deps = makeDeps(false);
    const p = runOnce(deps, { stage2Only: true });
    await vi.runAllTimersAsync();
    await p;

    // 1 GET (pre-check dungeon/state) + 1 GET (dungeon/today cap check,
    // session 29 CODEXREVIEW #6) + 1 POST (start_run).
    expect(calls).toHaveLength(3);
    const post = calls.find((c) => c.method === "POST")!;
    const sentBody = JSON.parse(post.body!);
    expect(sentBody.action).toBe("start_run");
    expect(deps.guards.runCount).toBe(1);
  });

  it("skips start_run and returns cleanly if a run is already active — no duplicate-start POST", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        calls.push({ url, method: init?.method ?? "GET" });
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } };
      }),
    );
    const deps = makeDeps(false);
    const p = runOnce(deps, { stage2Only: true });
    await vi.runAllTimersAsync();
    await p;

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("GET");
    expect(deps.guards.runCount).toBe(0); // no start_run was sent, so no run was "started" by this call
  });

  // [session 09, LIVE] `assertCanStartRun` used to run unconditionally at the
  // top of `runOnce`, before the existing-run check — invisible through
  // session 08 since guard state never persisted across process invocations,
  // so the session cap never actually bound. Session 09's guard-persistence
  // fix made it bind for real, and it immediately stranded a live run at
  // room 2 (HP 2/32) that had started under the cap but couldn't be resumed
  // once a later run pushed the count to the cap.
  it("resumes an already-active run even at the session cap — resuming costs no new run slot", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        calls.push({ url, method: init?.method ?? "GET" });
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } };
      }),
    );
    const deps = makeDeps(false);
    // Guard already at the cap — a genuinely NEW start_run would throw here.
    deps.guards = new GuardState(TEST_CONFIG, { runsStarted: TEST_CONFIG.maxRunsPerSession });
    const p = runOnce(deps, { stage2Only: true });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined(); // does NOT throw GuardTrip

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("GET");
  });

  it("still blocks a genuinely NEW start_run at the session cap", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } })),
    );
    const deps = makeDeps(false);
    deps.guards = new GuardState(TEST_CONFIG, { runsStarted: TEST_CONFIG.maxRunsPerSession });
    const p = runOnce(deps, { stage2Only: true });
    const assertion = expect(p).rejects.toBeInstanceOf(GuardTrip);
    await vi.runAllTimersAsync();
    await assertion;
  });
});

describe("runOnce — committed energy spend (session 31, CODEXREVIEW #8)", () => {
  // The old model recorded spend from a before/after account-energy read
  // taken in `main()`, well after `runOnce` returned — a window in which an
  // external balance change (a ROM claim landing mid-run, in-run regen) could
  // mask real spend, sometimes down to zero. This proves the guard now
  // records the full `config.energyCostPerRun` the moment start_run succeeds,
  // entirely independent of any energy read — there is no gap left for a
  // mid-run balance change to hide in.
  it("records the full configured energyCostPerRun on a genuinely new start_run, before any energy is ever read", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) return DUNGEON_TODAY_EMPTY;
        if (method === "GET") return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } };
      }),
    );
    const deps = makeDeps(false);
    const p = runOnce(deps, { stage2Only: true });
    await vi.runAllTimersAsync();
    await p;

    // No mock ever answers `GET /offchain/player/energy` in this test —
    // `runOnce` itself never calls it. If committing still depended on an
    // energy read, this test would hang or throw on an unhandled URL instead
    // of resolving cleanly with the committed amount recorded.
    expect(deps.guards.spentEnergy).toBe(TEST_CONFIG.energyCostPerRun);
  });

  it("commits nothing on a resume — no new start_run POST means no new committed spend", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } })),
    );
    const deps = makeDeps(false);
    const p = runOnce(deps, { stage2Only: true });
    await vi.runAllTimersAsync();
    await p;

    expect(deps.guards.spentEnergy).toBe(0);
  });
});

describe("reconcileEnergyAccounting / describeEnergyAccounting (session 31, CODEXREVIEW #8)", () => {
  it("reports no drift when the observed delta matches what was committed", async () => {
    const { reconcileEnergyAccounting } = await import("../src/orchestrator/energyAccounting.js");
    const report = reconcileEnergyAccounting(100, 80, 20);
    expect(report).toEqual({ before: 100, after: 80, observedDelta: 20, committedDelta: 20, drifted: false });
  });

  it("flags drift when an external top-up (e.g. a ROM claim) masks the observed delta, WITHOUT altering the committed figure", async () => {
    const { reconcileEnergyAccounting } = await import("../src/orchestrator/energyAccounting.js");
    // A run committed 20 energy at start_run, but a ROM claim landed mid-run
    // and fully covered the spend — the account reads back unchanged (or
    // even higher). The guard already enforced the real 20 at commit time;
    // this must surface the mismatch, not silently accept the masked 0.
    const report = reconcileEnergyAccounting(100, 100, 20);
    expect(report.committedDelta).toBe(20);
    expect(report.observedDelta).toBe(0);
    expect(report.drifted).toBe(true);
  });

  it("clamps a negative raw delta (regen outrunning spend) to 0 in the observed figure, same as the old ledger-of-record behavior", async () => {
    const { reconcileEnergyAccounting } = await import("../src/orchestrator/energyAccounting.js");
    const report = reconcileEnergyAccounting(50, 55, 0);
    expect(report.observedDelta).toBe(0);
    expect(report.drifted).toBe(false);
  });

  it("describeEnergyAccounting includes a drift warning only when drifted", async () => {
    const { reconcileEnergyAccounting, describeEnergyAccounting } = await import("../src/orchestrator/energyAccounting.js");
    const clean = describeEnergyAccounting(reconcileEnergyAccounting(100, 80, 20));
    expect(clean).not.toContain("drift");
    const drifted = describeEnergyAccounting(reconcileEnergyAccounting(100, 100, 20));
    expect(drifted).toContain("drift");
    expect(drifted).toContain("committed 20");
    expect(drifted).toContain("observed 0");
  });
});

describe("runOnce — dungeon cap reconciliation against GET /game/dungeon/today (session 29, CODEXREVIEW #6)", () => {
  function dungeonTodayBody(runsToday: number) {
    return {
      dungeonDataEntities: [],
      dayProgressEntities: [{ docId: `DayCount#0xUSER#Dungeon#${TEST_CONFIG.dungeonId}`, UINT256_CID: runsToday }],
    };
  }

  it("blocks a genuinely NEW start_run when the SERVER reports the cap already reached — never sends the POST", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        calls.push({ url, method });
        if (method === "GET" && url.includes("dungeon/today")) {
          return { status: 200, body: dungeonTodayBody(TEST_CONFIG.maxRunsPerSession) }; // server says: already at cap
        }
        return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
      }),
    );
    const deps = makeDeps(false);
    // Local guard has plenty of room — only the SERVER says the cap is hit.
    expect(deps.guards.runCount).toBe(0);
    const p = runOnce(deps, { stage2Only: true });
    const assertion = expect(p).rejects.toBeInstanceOf(GuardTrip);
    await vi.runAllTimersAsync();
    await assertion;

    expect(calls.some((c) => c.method === "POST")).toBe(false); // no start_run was attempted
    expect(deps.guards.runCount).toBe(TEST_CONFIG.maxRunsPerSession); // marked exhausted for the rest of the day too
  });

  it("the server-cap trip is classified as a budget trip, not a genuine anomaly", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) {
          return { status: 200, body: dungeonTodayBody(TEST_CONFIG.maxRunsPerSession) };
        }
        return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
      }),
    );
    const deps = makeDeps(false);
    const p = runOnce(deps, { stage2Only: true });
    const assertion = p.catch((e) => e); // attach a handler before the timer flush, same discipline as the .rejects tests above
    await vi.runAllTimersAsync();
    const e = await assertion;
    expect(e).toBeInstanceOf(GuardTrip);
    expect(isBudgetGuardTrip(e as GuardTrip)).toBe(true);
  });

  it("does NOT block when the server reports runs below the cap", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) {
          return { status: 200, body: dungeonTodayBody(TEST_CONFIG.maxRunsPerSession - 1) };
        }
        if (method === "GET") return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } };
      }),
    );
    const deps = makeDeps(false);
    const p = runOnce(deps, { stage2Only: true });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(deps.guards.runCount).toBe(1); // one genuine start_run went through
  });

  it("does NOT block when the server has no day-progress row yet (genuinely zero runs today)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) {
          return { status: 200, body: { dungeonDataEntities: [], dayProgressEntities: [] } };
        }
        if (method === "GET") return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } };
      }),
    );
    const deps = makeDeps(false);
    const p = runOnce(deps, { stage2Only: true });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(deps.guards.runCount).toBe(1);
  });

  it("never checked at all when resuming an already-active run — resuming costs no new run slot", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        calls.push({ url, method });
        // If runOnce ever called dungeon/today here, this would 500/validation-fail
        // since it's the wrong body shape for that path — proving it wasn't hit.
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun(), entity: { ROOM_NUM_CID: 2 } } } };
      }),
    );
    const deps = makeDeps(false);
    const p = runOnce(deps, { stage2Only: true });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(calls.every((c) => !c.url.includes("dungeon/today"))).toBe(true);
  });
});

describe("runOnce — enemy path phase", () => {
  it("dry-run: picks the Safe tier and logs the intended selection, never POSTs", async () => {
    const safeOffer = {
      enemyPathPhase: true,
      enemyPathOptions: [
        { index: 0, tier: 0, tierName: "Safe" },
        { index: 1, tier: 2, tierName: "Dangerous" },
        { index: 2, tier: 2, tierName: "Dangerous" },
      ],
    };
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun(safeOffer) } } })),
    );
    const deps = makeDeps(true);
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  // [session 09, live] Room 2's first live encounter offered no Safe tier at
  // all — refuted the original assumption that Safe is always present.
  // User-confirmed expected behavior, not a bug: generalized to "lowest tier
  // offered, Safe or not" rather than halting whenever Safe is absent.
  it("picks the lowest NON-Safe tier when Safe isn't offered, rather than halting — CLAUDE.md §8, generalized session 09", async () => {
    const noSafeOffered = {
      enemyPathPhase: true,
      enemyPathOptions: [
        { index: 0, tier: 1, tierName: "Risky" },
        { index: 1, tier: 2, tierName: "Dangerous" },
      ],
    };
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({
        status: 200,
        body: { success: true, actionToken: 1, data: { run: fakeRun(noSafeOffered) } },
      })),
    );
    const deps = makeDeps(true); // dry-run — logs the pick, never POSTs
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  it("still halts on a genuinely empty enemyPathOptions offer", async () => {
    const emptyOffer = { enemyPathPhase: true, enemyPathOptions: [] };
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun(emptyOffer) } } })),
    );
    const deps = makeDeps(true);
    const p = runOnce(deps);
    const assertion = expect(p).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;
  });
});

describe("runOnce — use_item probe (Task 12 Stage A, session 13)", () => {
  it("fires exactly once when own HP is critically low, then continues normally without tripping the stall guard", async () => {
    const lowHpRun = fakeRun({ players: [fakeSide("player", 5, 30), fakeSide("Enemy Room 63")] });
    let getCount = 0;
    let probePosts = 0;
    let runEnded = false;

    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) return DUNGEON_TODAY_EMPTY;
        if (method === "GET") {
          getCount++;
          if (getCount === 1 || runEnded) {
            return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
          }
          return { status: 200, body: { success: true, actionToken: 1, data: { run: lowHpRun } } };
        }
        const body = JSON.parse((init?.body as string) ?? "{}");
        if (body.action === "use_item") {
          probePosts++;
          return { status: 400, body: { success: false, message: "no such item" } };
        }
        if (body.action === "start_run") {
          return { status: 200, body: { success: true, actionToken: 2, data: { run: lowHpRun } } };
        }
        // a real combat move — end the run so the loop terminates
        runEnded = true;
        return { status: 200, body: { success: true, actionToken: 3, data: {} } };
      }),
    );

    const deps: LiveRunDeps = { ...makeDeps(false), probeUseItem: { fired: false } };
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();

    expect(probePosts).toBe(1); // exactly once, never retried
    expect(deps.probeUseItem?.fired).toBe(true);
  });

  it("never fires when own HP is healthy", async () => {
    const healthyRun = fakeRun({ players: [fakeSide("player", 28, 30), fakeSide("Enemy Room 63")] });
    let probePosts = 0;
    let runEnded = false;
    let getCount = 0;

    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) return DUNGEON_TODAY_EMPTY;
        if (method === "GET") {
          getCount++;
          if (getCount === 1 || runEnded) {
            return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
          }
          return { status: 200, body: { success: true, actionToken: 1, data: { run: healthyRun } } };
        }
        const body = JSON.parse((init?.body as string) ?? "{}");
        if (body.action === "use_item") probePosts++;
        if (body.action === "start_run") {
          return { status: 200, body: { success: true, actionToken: 2, data: { run: healthyRun } } };
        }
        runEnded = true;
        return { status: 200, body: { success: true, actionToken: 3, data: {} } };
      }),
    );

    const deps: LiveRunDeps = { ...makeDeps(false), probeUseItem: { fired: false } };
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();

    expect(probePosts).toBe(0);
    expect(deps.probeUseItem?.fired).toBe(false);
  });

  it("is a no-op when probeUseItem is not supplied at all, regardless of HP", async () => {
    const lowHpRun = fakeRun({ players: [fakeSide("player", 1, 30), fakeSide("Enemy Room 63")] });
    let probePosts = 0;
    let runEnded = false;
    let getCount = 0;

    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) return DUNGEON_TODAY_EMPTY;
        if (method === "GET") {
          getCount++;
          if (getCount === 1 || runEnded) {
            return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
          }
          return { status: 200, body: { success: true, actionToken: 1, data: { run: lowHpRun } } };
        }
        const body = JSON.parse((init?.body as string) ?? "{}");
        if (body.action === "use_item") probePosts++;
        if (body.action === "start_run") {
          return { status: 200, body: { success: true, actionToken: 2, data: { run: lowHpRun } } };
        }
        runEnded = true;
        return { status: 200, body: { success: true, actionToken: 3, data: {} } };
      }),
    );

    const deps = makeDeps(false); // no probeUseItem field at all
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(probePosts).toBe(0);
  });
});

describe("runOnce — real potion policy (Task 12 Stage B live half)", () => {
  it("fires use_item with the real itemId once HP crosses the threshold, and decrements remaining", async () => {
    const lowHpRun = fakeRun({ players: [fakeSide("player", 10, 30), fakeSide("Enemy Room 63")] });
    // A real heal genuinely changes the wire state (HP goes up) — mocked
    // here so the stall guard sees real progress, same as live play would.
    const healedRun = fakeRun({ players: [fakeSide("player", 30, 30), fakeSide("Enemy Room 63")] });
    let potionPosts: unknown[] = [];
    let runEnded = false;
    let getCount = 0;

    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) return DUNGEON_TODAY_EMPTY;
        if (method === "GET") {
          getCount++;
          if (getCount === 1 || runEnded) {
            return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
          }
          return { status: 200, body: { success: true, actionToken: 1, data: { run: potionPosts.length > 0 ? healedRun : lowHpRun } } };
        }
        const body = JSON.parse((init?.body as string) ?? "{}");
        if (body.action === "use_item") {
          potionPosts.push(body);
          return { status: 200, body: { success: true, actionToken: 2, data: { run: healedRun } } };
        }
        if (body.action === "start_run") {
          return { status: 200, body: { success: true, actionToken: 2, data: { run: lowHpRun } } };
        }
        // a real combat move — end the run so the loop terminates
        runEnded = true;
        return { status: 200, body: { success: true, actionToken: 3, data: {} } };
      }),
    );

    const deps: LiveRunDeps = { ...makeDeps(false), potionPolicy: { itemId: 131, threshold: 0.5, remaining: 2, used: 0 } };
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();

    expect(potionPosts).toHaveLength(1);
    expect((potionPosts[0] as { data: { itemId: number; index: number } }).data.itemId).toBe(131);
    expect((potionPosts[0] as { data: { itemId: number; index: number } }).data.index).toBe(0);
    expect(deps.potionPolicy?.remaining).toBe(1); // decremented from 2
    expect(deps.potionPolicy?.used).toBe(1);
  });

  it("sends index: 1 on the SECOND use in a run — live-confirmed 2026-08-16: index addresses loadout position, not itemId", async () => {
    // Battle 1: HP drops low, one potion fires and heals. Battle continues,
    // HP drops low again (a fresh enemy in a later room), second potion
    // fires. Both share the same itemId, so only `index` distinguishes them.
    const lowHp1 = fakeRun({ players: [fakeSide("player", 10, 30), fakeSide("Enemy Room 63")] });
    const healed1 = fakeRun({ players: [fakeSide("player", 30, 30), fakeSide("Enemy Room 63")] });
    const lowHp2 = fakeRun({ players: [fakeSide("player", 8, 30), fakeSide("Enemy Room 64")] });
    const healed2 = fakeRun({ players: [fakeSide("player", 28, 30), fakeSide("Enemy Room 64")] });
    const potionPosts: Array<{ data: { itemId: number; index: number } }> = [];
    let getCount = 0;
    let runEnded = false;

    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) return DUNGEON_TODAY_EMPTY;
        if (method === "GET") {
          getCount++;
          if (getCount === 1 || runEnded) {
            return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
          }
          const run = potionPosts.length >= 2 ? healed2 : potionPosts.length === 1 ? lowHp2 : lowHp1;
          return { status: 200, body: { success: true, actionToken: 1, data: { run } } };
        }
        const body = JSON.parse((init?.body as string) ?? "{}");
        if (body.action === "use_item") {
          potionPosts.push(body);
          return { status: 200, body: { success: true, actionToken: 2, data: { run: potionPosts.length === 1 ? healed1 : healed2 } } };
        }
        if (body.action === "start_run") {
          return { status: 200, body: { success: true, actionToken: 2, data: { run: lowHp1 } } };
        }
        runEnded = true;
        return { status: 200, body: { success: true, actionToken: 3, data: {} } };
      }),
    );

    const deps: LiveRunDeps = { ...makeDeps(false), potionPolicy: { itemId: 131, threshold: 0.5, remaining: 2, used: 0 } };
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();

    expect(potionPosts).toHaveLength(2);
    expect(potionPosts[0]!.data.index).toBe(0);
    expect(potionPosts[1]!.data.index).toBe(1); // NOT 0 again — this is the live-confirmed fix
    expect(deps.potionPolicy?.remaining).toBe(0);
    expect(deps.potionPolicy?.used).toBe(2);
  });

  it("never fires when own HP is above the threshold", async () => {
    const healthyRun = fakeRun({ players: [fakeSide("player", 28, 30), fakeSide("Enemy Room 63")] });
    let potionPosts = 0;
    let runEnded = false;
    let getCount = 0;

    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) return DUNGEON_TODAY_EMPTY;
        if (method === "GET") {
          getCount++;
          if (getCount === 1 || runEnded) {
            return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
          }
          return { status: 200, body: { success: true, actionToken: 1, data: { run: healthyRun } } };
        }
        const body = JSON.parse((init?.body as string) ?? "{}");
        if (body.action === "use_item") potionPosts++;
        if (body.action === "start_run") {
          return { status: 200, body: { success: true, actionToken: 2, data: { run: healthyRun } } };
        }
        runEnded = true;
        return { status: 200, body: { success: true, actionToken: 3, data: {} } };
      }),
    );

    const deps: LiveRunDeps = { ...makeDeps(false), potionPolicy: { itemId: 131, threshold: 0.5, remaining: 2, used: 0 } };
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();

    expect(potionPosts).toBe(0);
    expect(deps.potionPolicy?.remaining).toBe(2); // untouched
  });

  it("never fires once remaining hits 0, even at critical HP", async () => {
    const criticalRun = fakeRun({ players: [fakeSide("player", 1, 30), fakeSide("Enemy Room 63")] });
    let potionPosts = 0;
    let runEnded = false;
    let getCount = 0;

    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("dungeon/today")) return DUNGEON_TODAY_EMPTY;
        if (method === "GET") {
          getCount++;
          if (getCount === 1 || runEnded) {
            return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
          }
          return { status: 200, body: { success: true, actionToken: 1, data: { run: criticalRun } } };
        }
        const body = JSON.parse((init?.body as string) ?? "{}");
        if (body.action === "use_item") potionPosts++;
        if (body.action === "start_run") {
          return { status: 200, body: { success: true, actionToken: 2, data: { run: criticalRun } } };
        }
        runEnded = true;
        return { status: 200, body: { success: true, actionToken: 3, data: {} } };
      }),
    );

    const deps: LiveRunDeps = { ...makeDeps(false), potionPolicy: { itemId: 131, threshold: 0.5, remaining: 0, used: 0 } };
    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();

    expect(potionPosts).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// [session 36] CODEXAUDIT #1: the live-observe double-count fix.
// ---------------------------------------------------------------------------

describe("runOnce — opponent-model live-observe double-count fix (session 36, CODEXAUDIT #1)", () => {
  let fixtureRoot: string;
  let modelDir: string;
  let modelPath: string;

  beforeEach(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), "gigaruns-liverun-fixtures-test-"));
    modelDir = mkdtempSync(join(tmpdir(), "gigaruns-liverun-model-test-"));
    modelPath = join(modelDir, "opponent-model.json");
  });
  afterEach(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    rmSync(modelDir, { recursive: true, force: true });
  });

  // The exact regression CODEXAUDIT #1 named: a real `runOnce()` combat
  // exchange, through a REAL `FixtureWriter` (not a mock) so the fixture
  // this writes to disk is exactly what a restart's `bootstrapFromCorpus`
  // would later read back via `loadCorpus` — proving the live-observe call
  // site and the corpus bootstrap path now agree on one identity for the
  // same exchange, rather than the live side silently never marking it.
  it("marks a live-observed exchange into the SAME ledger a restart's corpus bootstrap reads, so re-import is a no-op — plus a genuinely new corpus exchange still imports normally", async () => {
    const foeId = "Enemy Room 63"; // room 1, per src/sim/enemies.ts ROOM_ENEMIES
    const before = fakeRun({
      DUNGEON_ID_CID: 7,
      players: [fakeSide("player", 30, 30), fakeSide(foeId, 30, 30)],
    });
    const after = fakeRun({
      DUNGEON_ID_CID: 7,
      players: [
        { ...fakeSide("player", 30, 30), lastMove: "rock" },
        { ...fakeSide(foeId, 20, 30), lastMove: "rock" }, // HP moved 30->20: a real exchange, not an idle poll
      ],
    });

    let getCount = 0;
    vi.stubGlobal(
      "fetch",
      mockFetch((_url, init) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          getCount++;
          // Call 1: runOnce's pre-loop "is a run already active" check.
          // Call 2: the main loop's own first state read (same active run).
          // Call 3+: run over — stops the loop.
          if (getCount <= 2) {
            return { status: 200, body: { success: true, actionToken: 1, data: { run: before, entity: { ROOM_NUM_CID: 1 } } } };
          }
          return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
        }
        return { status: 200, body: { success: true, actionToken: 2, data: { run: after } } };
      }),
    );

    const fixtures = new FixtureWriter("0xTestAddress", (t) => t, fixtureRoot);
    const model = new OpponentModel();
    const bootstrapImportedIds = new Set<string>();

    const deps: LiveRunDeps = {
      ...makeDeps(false),
      fixtures,
      model,
      opponentModelPersistence: { path: modelPath, bootstrapImportedIds },
    };

    const p = runOnce(deps);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();

    const key = modelKey(foeId, 1);
    expect(model.observations(key)).toBe(1); // observed exactly once, live
    expect(bootstrapImportedIds.size).toBe(1); // and marked into the ledger in the SAME process

    // A genuinely new corpus exchange this process never saw live — dropped
    // straight onto disk the way an old capture or another session's play
    // would be, under a DIFFERENT run directory so it can never collide with
    // the live one's identity.
    const canaryDir = join(fixtureRoot, "run-canary-manual");
    mkdirSync(canaryDir, { recursive: true });
    const canaryBefore = { success: true, actionToken: 1, data: { run: fakeRun({ DUNGEON_ID_CID: 99, players: [fakeSide("player", 30, 30), fakeSide(foeId, 30, 30)] }) } };
    const canaryAfter = {
      success: true,
      actionToken: 2,
      data: {
        run: fakeRun({
          DUNGEON_ID_CID: 99,
          players: [
            { ...fakeSide("player", 30, 30), lastMove: "paper" },
            { ...fakeSide(foeId, 18, 30), lastMove: "scissor" },
          ],
        }),
      },
    };
    writeFileSync(join(canaryDir, "state-000.json"), JSON.stringify(canaryBefore));
    writeFileSync(join(canaryDir, "state-001.json"), JSON.stringify(canaryAfter));

    // Simulated restart: a fresh process loads exactly what the live process
    // persisted, then re-runs the same startup bootstrap against the SAME
    // fixture root (now holding both the live-written fixture AND the
    // canary).
    const restarted = loadOpponentModel(modelPath);
    expect(restarted.bootstrapImportedIds.size).toBe(1); // the live exchange survived the round-trip

    const { imported } = bootstrapFromCorpus(restarted.model, restarted.bootstrapImportedIds, loadCorpus(fixtureRoot));

    // Both the canary and the live exchange share the same (enemy, room)
    // key, so the discriminating number is 2 (1 already-persisted live
    // observation + 1 newly-imported canary), NOT 3 — the pre-fix bug would
    // have re-imported the live exchange as a second, indistinguishable
    // observation of this same key, landing here at 3 instead.
    expect(imported).toBe(1); // only the genuinely-new canary — the live one is skipped, not re-counted
    expect(restarted.model.observations(key)).toBe(2); // 1 persisted (live) + 1 newly imported (canary), UNCHANGED from double-counting the live one
    expect(restarted.bootstrapImportedIds.size).toBe(2); // live exchange + the newly-imported canary
  });
});
