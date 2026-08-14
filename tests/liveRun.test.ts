/**
 * tests/liveRun.test.ts — scripts/liveRun.ts, Task 6's live loop.
 *
 * The pure helpers (classifyPhase, selectByIndex, buildEnvelope,
 * wireBoonToOption) are tested directly. The loop itself (`runOnce`) is
 * tested against a real `GigaverseClient` with a mocked global `fetch`, same
 * pattern as `tests/api/client.test.ts` — this repo has no live JWT this
 * session (QUESTIONS.md §7), so nothing here touches the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildBattleState,
  buildEnvelope,
  classifyPhase,
  moveToAction,
  runOnce,
  selectByIndex,
  wireBoonToOption,
  type LiveRunDeps,
} from "../scripts/liveRun.js";
import { GigaverseClient } from "../src/api/client.js";
import type { BotConfig } from "../src/orchestrator/config.js";
import { GuardState } from "../src/orchestrator/guards.js";
import { OpponentModel } from "../src/strategy/opponentModel.js";
import { LIVE_CONFIG } from "../src/strategy/config.js";
import { UnsafeTierError } from "../src/strategy/enemyTier.js";
import type { WireRun, WireSide } from "../src/sim/corpus.js";

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

describe("selectByIndex", () => {
  it("maps 0-3 to loot_one..loot_four", () => {
    expect(selectByIndex(0)).toBe("loot_one");
    expect(selectByIndex(1)).toBe("loot_two");
    expect(selectByIndex(2)).toBe("loot_three");
    expect(selectByIndex(3)).toBe("loot_four");
  });

  it("throws rather than guessing past the observed 3-option offers", () => {
    expect(() => selectByIndex(4)).toThrow();
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
    expect(getCalls).toBe(1);
  });
});

describe("runOnce — stage 2 (single POST then halt)", () => {
  it("sends exactly one start_run POST and returns without polling further", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch((url, init) => {
        calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun() } } };
      }),
    );
    const deps = makeDeps(false);
    const p = runOnce(deps, { stage2Only: true });
    await vi.runAllTimersAsync();
    await p;

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("POST");
    const sentBody = JSON.parse(calls[0]!.body!);
    expect(sentBody.action).toBe("start_run");
    expect(deps.guards.runCount).toBe(1);
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
