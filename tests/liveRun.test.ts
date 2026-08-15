/**
 * tests/liveRun.test.ts — scripts/liveRun.ts, Task 6's live loop.
 *
 * The pure helpers (classifyPhase, selectRewardByIndex, selectEnemyPathByIndex,
 * buildEnvelope, buildPathSelectionEnvelope, wireBoonToOption) are tested
 * directly. The loop itself (`runOnce`) is tested against a real
 * `GigaverseClient` with a mocked global `fetch`, same pattern as
 * `tests/api/client.test.ts` — nothing here touches the real network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildBattleState,
  buildEnvelope,
  buildPathSelectionEnvelope,
  classifyPhase,
  KNOWN_SIDE_KEYS,
  locateRewardOption,
  locateSafeTierOption,
  moveToAction,
  postWithVerifiedRetry,
  runOnce,
  selectEnemyPathByIndex,
  selectRewardByIndex,
  unknownSideKeys,
  wireBoonToOption,
  type LiveRunDeps,
} from "../scripts/liveRun.js";
import { GigaverseClient } from "../src/api/client.js";
import type { BotConfig } from "../src/orchestrator/config.js";
import { GuardState, GuardTrip } from "../src/orchestrator/guards.js";
import { OpponentModel } from "../src/strategy/opponentModel.js";
import { LIVE_CONFIG } from "../src/strategy/config.js";
import { UnsafeTierError } from "../src/strategy/enemyTier.js";
import type { WireBoon, WireRun, WireSide } from "../src/sim/corpus.js";

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

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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

describe("locateSafeTierOption", () => {
  it("finds whichever position currently holds tier 0, regardless of where it was before", () => {
    const runA = fakeRun({ enemyPathPhase: true, enemyPathOptions: [{ tier: 0, index: 0 }, { tier: 1, index: 1 }, { tier: 2, index: 2 }] });
    const runB = fakeRun({ enemyPathPhase: true, enemyPathOptions: [{ tier: 2, index: 0 }, { tier: 0, index: 1 }, { tier: 1, index: 2 }] });
    expect(locateSafeTierOption(runA)).toBe(0);
    expect(locateSafeTierOption(runB)).toBe(1);
  });

  it("returns null — never falls back to a non-Safe tier — if no Safe tier is offered", () => {
    const run = fakeRun({ enemyPathPhase: true, enemyPathOptions: [{ tier: 1, index: 0 }, { tier: 2, index: 1 }] });
    expect(locateSafeTierOption(run)).toBeNull();
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

describe("postWithVerifiedRetry", () => {
  // [session 08, live] reward_one returned HTTP 500 twice on an otherwise
  // byte-identical request — once where the pick had silently applied
  // server-side anyway, once where it hadn't. This is the fix.
  //
  // [session 09] `locate`/`buildBody` replace the old static `body` param —
  // every attempt, including the first, re-derives its index from whatever
  // state is passed in rather than trusting a captured position. These tests
  // aren't about identity resolution itself (locateRewardOption/
  // locateSafeTierOption have their own tests below); `locate` here just
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

    expect(calls).toHaveLength(2); // 1 GET (pre-check) + 1 POST (start_run)
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

  it("halts with UnsafeTierError if Safe is somehow not the resolved choice — hard rule, CLAUDE.md §8", async () => {
    // Regression guard: pickSafeTier always chooses the lowest tier and then
    // asserts it. If the corpus ever offered no tier-0 option, this is
    // exactly the halt CLAUDE.md §8 requires, not a silent Dangerous pick.
    const dangerousOnly = {
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
        body: { success: true, actionToken: 1, data: { run: fakeRun(dangerousOnly) } },
      })),
    );
    const deps = makeDeps(true);
    const p = runOnce(deps);
    const assertion = expect(p).rejects.toBeInstanceOf(UnsafeTierError);
    await vi.runAllTimersAsync();
    await assertion;
  });
});
