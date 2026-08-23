/**
 * tests/liveRunFinishRun.test.ts — [session 84 §4] THE GATE ON `finishRun`.
 *
 * ## The gate, quoted from where it was set
 *
 * DECISIONS 2026-08-23 (session 83 §4): *"the reporting must be demonstrated
 * executing on a REPLAYED run of each shape (one ending with state absent, one
 * ending with state present-and-finished) before it is trusted live."* That is
 * meetable offline against a mocked `fetch` and costs no run-unit, which is
 * what makes it a gate and not a capture request (CLAUDE.md rule 6).
 *
 * ## What was actually broken, and why "add the missing lines" was the wrong fix
 *
 * `scripts/liveRun.ts` had two run-end exits. Every real run takes
 * `run_ended_or_absent` — the state simply vanishes when the run resolves —
 * and `run_over` has **never fired in any logged run**. Both the boon-coverage
 * snapshot and session 78 §3's `EV support` line lived inside `run_over`, so
 * neither has ever been emitted, despite session 78 shipping the line with the
 * comment *"said out loud at the end of every run, whatever the outcome"*.
 *
 * Two exits printing different things is HOW that happened. Copying the
 * reporting into the second exit would leave the same divergence one edit
 * away, so both now call one `finishRun(reason, room)` and this file asserts
 * they agree — not merely that each one works.
 *
 * ## Why each test drives a run that made a DECISION first
 *
 * The `EV support` line is guarded on `totalDecisions > 0`. A run that ends
 * before it decides anything would exercise `finishRun` and prove nothing
 * about the line that motivated the extraction, so both shapes here play one
 * real combat exchange and only then end.
 *
 * Isolated `guardStatePath` per CLAUDE.md's tests-never-write-a-real-data-path
 * rule; `playCountsPersistence` and `opponentModelPersistence` are left unset,
 * which `runOnce` treats as a genuine no-write no-op.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runOnce, type LiveRunDeps } from "../scripts/liveRun.js";
import { GigaverseClient } from "../src/api/client.js";
import type { BotConfig } from "../src/orchestrator/config.js";
import { GuardState } from "../src/orchestrator/guards.js";
import { OpponentModel } from "../src/strategy/opponentModel.js";
import { LIVE_CONFIG } from "../src/strategy/config.js";
import type { WireRun, WireSide } from "../src/sim/corpus.js";

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

const ENTITY = { ROOM_NUM_CID: 4 };

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const { status, body } = handler(url, init);
    return { status, text: async () => JSON.stringify(body) } as Response;
  });
}

let guardStateTestDir: string;
let logged: Record<string, unknown>[];
let printed: string[];

beforeEach(() => {
  vi.useFakeTimers();
  guardStateTestDir = mkdtempSync(join(tmpdir(), "giga-finishrun-"));
  logged = [];
  printed = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
    printed.push(a.map(String).join(" "));
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  rmSync(guardStateTestDir, { recursive: true, force: true });
});

function makeDeps(): LiveRunDeps & Required<Pick<LiveRunDeps, "guardStatePath">> {
  return {
    client: new GigaverseClient({ jwt: "test-jwt" }),
    config: TEST_CONFIG,
    guards: new GuardState(TEST_CONFIG),
    model: new OpponentModel(),
    strategyConfig: LIVE_CONFIG,
    fixtures: { write: vi.fn(), dir: "test-fixtures" } as unknown as LiveRunDeps["fixtures"],
    log: {
      write: (r: Record<string, unknown>) => {
        logged.push(r);
      },
      filePath: "test.jsonl",
    } as unknown as LiveRunDeps["log"],
    dryRun: false,
    // Isolated per CLAUDE.md: never the real data/guard-budget.json.
    guardStatePath: join(guardStateTestDir, "guard-budget.json"),
  };
}

/**
 * Replays a run that resumes an ACTIVE fight, plays exactly one combat
 * exchange, and then ends in the shape the caller asks for.
 *
 *  - `"absent"`   — the next state read returns `data.run: null`, which is what
 *                   every real run has always done.
 *  - `"finished"` — the next state read carries a run whose enemy is at 0 HP,
 *                   so `classifyPhase` returns `"over"` with the state present.
 */
async function replayRunEndingWith(shape: "absent" | "finished"): Promise<void> {
  // The loop reads state TWICE before it decides anything — once to discover
  // there is a run to resume, once at the top of the loop — so the ending is
  // keyed on the combat POST having happened, not on a read count.
  let acted = false;
  vi.stubGlobal(
    "fetch",
    mockFetch((_url, init) => {
      if (init?.method === "POST") {
        acted = true;
        // The state the action echoes is not read by the loop, which re-GETs
        // at the top of the next iteration.
        return { status: 200, body: { success: true, actionToken: 2, data: { run: fakeRun(), entity: ENTITY } } };
      }
      if (!acted) {
        return { status: 200, body: { success: true, actionToken: 1, data: { run: fakeRun(), entity: ENTITY } } };
      }
      // The ending.
      if (shape === "absent") {
        return { status: 200, body: { success: true, actionToken: 1, data: { run: null } } };
      }
      return {
        status: 200,
        body: {
          success: true,
          actionToken: 1,
          data: {
            run: fakeRun({ players: [fakeSide("player"), fakeSide("Enemy Room 63", 0)] }),
            entity: ENTITY,
          },
        },
      };
    }),
  );
  const p = runOnce(makeDeps(), { resumeExisting: true });
  await vi.runAllTimersAsync();
  await p;
}

const eventsOf = () => logged.map((r) => r.event);
const find = (event: string) => logged.find((r) => r.event === event);

describe("finishRun — the state-ABSENT shape, which is the one every real run takes", () => {
  beforeEach(async () => {
    await replayRunEndingWith("absent");
  });

  it("still terminates on run_ended_or_absent, so the log's run-end marker is unchanged", () => {
    expect(eventsOf()).toContain("run_ended_or_absent");
    // No room is invented when the state is gone — the field is omitted rather
    // than written null, so a reader joining on `room` sees no row.
    expect(find("run_ended_or_absent")).toEqual({ event: "run_ended_or_absent" });
  });

  it("NOW emits the boon-coverage snapshot, which this exit never did", () => {
    expect(eventsOf()).toContain("boon_run_coverage");
    expect(printed.some((l) => l.includes("boon coverage this run"))).toBe(true);
  });

  it("NOW emits session 78 §3's EV support line, which this exit never did", () => {
    const c = find("decision_coverage");
    expect(c).toBeDefined();
    expect(c!.totalDecisions).toBe(1);
    expect(printed.some((l) => l.includes("EV support: "))).toBe(true);
  });
});

describe("finishRun — the state-PRESENT-and-finished shape, which no logged run has ever taken", () => {
  beforeEach(async () => {
    await replayRunEndingWith("finished");
  });

  it("terminates on run_over and carries the room it read", () => {
    expect(eventsOf()).toContain("run_over");
    expect(find("run_over")).toEqual({ event: "run_over", room: ENTITY.ROOM_NUM_CID });
    expect(printed.some((l) => l.includes(`run over at room ${ENTITY.ROOM_NUM_CID}`))).toBe(true);
  });

  it("emits the same boon-coverage snapshot, with the room attached", () => {
    const c = find("boon_run_coverage");
    expect(c).toBeDefined();
    expect(c!.room).toBe(ENTITY.ROOM_NUM_CID);
  });

  it("emits the same EV support line", () => {
    expect(find("decision_coverage")!.totalDecisions).toBe(1);
    expect(printed.some((l) => l.includes("EV support: "))).toBe(true);
  });
});

describe("the two shapes AGREE, which is the property one exit exists to guarantee", () => {
  it("report the same run-end events in the same order, differing only in the terminator", async () => {
    await replayRunEndingWith("absent");
    const absent = eventsOf();
    const absentCoverage = { ...find("decision_coverage") };

    logged = [];
    printed = [];
    await replayRunEndingWith("finished");
    const finished = eventsOf();
    const finishedCoverage = { ...find("decision_coverage") };

    const normalise = (e: unknown[]) => e.map((x) => (x === "run_over" ? "TERMINATOR" : x === "run_ended_or_absent" ? "TERMINATOR" : x));
    expect(normalise(absent)).toEqual(normalise(finished));
    expect(absentCoverage).toEqual(finishedCoverage);
  });

  it("would FAIL if either exit stopped calling finishRun — the reporting is not duplicated anywhere", () => {
    // A structural check, not a behavioural one: `scripts/liveRun.ts` must
    // contain exactly one `boon_run_coverage` write and one `decision_coverage`
    // write. Two of either is the divergence that caused this bug returning.
    const src = readFileSync(join("scripts", "liveRun.ts"), "utf8");
    expect(src.split(`event: "boon_run_coverage"`).length - 1).toBe(1);
    expect(src.split(`event: "decision_coverage"`).length - 1).toBe(1);
    expect(src.split("finishRun(").length - 1).toBe(2);
  });
});
