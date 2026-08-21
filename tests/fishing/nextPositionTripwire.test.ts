/**
 * tests/fishing/nextPositionTripwire.test.ts — [session 66 §1] the first-miss
 * tripwire on the `nextPosition` override.
 *
 * ## What this file is guarding, and why the existing gate could not
 *
 * The override arms behind a Wilson lower bound on hits/attempts. Computed
 * from an unbroken streak that bound ONLY EVER CLIMBS — 12/12 ≈ 0.76,
 * 20/20 ≈ 0.84, 50/50 ≈ 0.93 — so no value the streak can reach lowers it, and
 * the gate cannot fire while the override behaves. The override went live in
 * session 65 at 12/12 with no miss ever observed, which means the number
 * authorising it had spent its entire history going up.
 *
 * This is therefore the first safeguard in this repo designed around *can this
 * ever fire?* rather than *is the threshold right?*, and the tests are written
 * to that question. Every one of them is about an EVENT OCCURRING.
 *
 * ## The two implementation traps this file exists to catch
 *
 * 1. **The read path is not the feature.** A test that seeds a disarm file and
 *    checks the override is off passes identically on a system that never
 *    writes one — i.e. on a permanently-armed override, which is the exact
 *    bug. So the live tests assert the file is ABSENT before the cast and
 *    PRESENT after, and `disarmOverride` being stubbed to a no-op must break
 *    them. (Demonstrated by doing it: session 66 recap.)
 * 2. **Something must populate the dependency.** Session 64's headline was a
 *    config block that existed, was approved, was tested at the inner hop, and
 *    was never handed over by `main()` — inert for three sessions while looking
 *    shipped. `main()`'s object literal is pinned below on its source text,
 *    because the defect is an ABSENT PROPERTY and absence is what has to be
 *    asserted against.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { fakeDoc as sharedFakeDoc } from "../helpers/fishingDoc.js";

import {
  appendNextPositionValidation,
  nextPositionOverrideStats,
  runOneCast,
  NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS,
  type LiveFishingDeps,
} from "../../scripts/liveFishing.js";
import {
  classifyPredictionOutcome,
  describeArmState,
  disarmOverride,
  readArmState,
  tripsWire,
  DEFAULT_NEXT_POSITION_ARM_STATE_PATH,
  type OverrideDisarmRecord,
} from "../../src/strategy/fishing/nextPositionArm.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";

// ---------------------------------------------------------------------------
// §1 the pure classifier — the three cases, which must never be conflated
// ---------------------------------------------------------------------------

describe("classifyPredictionOutcome — 'no prediction' and 'prediction correct' are different facts", () => {
  const at = (x: number, y: number) => ({ x, y });

  it("ABSENT when the server volunteered no nextPosition — nothing to validate, nothing to trip", () => {
    const outcome = classifyPredictionOutcome({ predicted: null, actual: at(2, 2), actedOn: false });
    expect(outcome).toEqual({ kind: "absent" });
    expect(tripsWire(outcome)).toBe(false);
  });

  it("ABSENT even if the override somehow reported active — no prediction cannot be a miss", () => {
    // Defensive: the two flags are computed at different points in the turn,
    // and a future edit that lets them disagree must not manufacture a miss
    // out of a prediction that never existed.
    expect(classifyPredictionOutcome({ predicted: null, actual: at(2, 2), actedOn: true })).toEqual({ kind: "absent" });
  });

  it("NOT_ACTED, carrying the hit/miss, when a prediction was present but did not steer the card choice", () => {
    const hit = classifyPredictionOutcome({ predicted: at(2, 2), actual: at(2, 2), actedOn: false });
    const miss = classifyPredictionOutcome({ predicted: at(2, 2), actual: at(3, 1), actedOn: false });
    expect(hit).toEqual({ kind: "not_acted", hit: true });
    expect(miss).toEqual({ kind: "not_acted", hit: false });
    // The load-bearing half: a miss the bot never acted on does NOT disarm.
    // Disarming on a counterfactual would retire the override over a decision
    // it did not take.
    expect(tripsWire(miss)).toBe(false);
  });

  it("ACTED_HIT when the override steered and was right", () => {
    const outcome = classifyPredictionOutcome({ predicted: at(4, 1), actual: at(4, 1), actedOn: true });
    expect(outcome).toEqual({ kind: "acted_hit" });
    expect(tripsWire(outcome)).toBe(false);
  });

  it("ACTED_MISS — present, steered, wrong — is the ONLY case that trips the wire", () => {
    const outcome = classifyPredictionOutcome({ predicted: at(4, 1), actual: at(1, 4), actedOn: true });
    expect(outcome).toEqual({ kind: "acted_miss" });
    expect(tripsWire(outcome)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §2 the persisted state
// ---------------------------------------------------------------------------

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "gigaruns-tripwire-"));
}

function record(over: Partial<OverrideDisarmRecord> = {}): OverrideDisarmRecord {
  return {
    at: "2026-08-21T18:00:00.000Z",
    castId: "13019999",
    turn: 3,
    predicted: [2, 2],
    actual: [3, 1],
    gridSize: 4,
    streakHits: 12,
    streakAttempts: 12,
    lowerBound: 0.7225,
    ...over,
  };
}

describe("the persisted disarm", () => {
  it("a missing file is ARMED, not an error — that is the normal state and has been all project", () => {
    const state = readArmState(join(tmp(), "nope.json"));
    expect(state).toEqual({ disarmed: false, record: null, reason: "armed_no_file" });
  });

  it("writes the miss and reads it back whole — the recap needs cast, turn, predicted and actual", () => {
    const dir = tmp();
    const path = join(dir, "disarm.json");
    expect(disarmOverride(record(), path)).toBe(true);

    const state = readArmState(path);
    expect(state.disarmed).toBe(true);
    expect(state.reason).toBe("disarmed_by_miss");
    expect(state.record).toMatchObject({ castId: "13019999", turn: 3, predicted: [2, 2], actual: [3, 1] });
    expect(describeArmState(state, path)).toContain("cast 13019999");
    expect(describeArmState(state, path)).toContain("turn 3");
    rmSync(dir, { recursive: true, force: true });
  });

  it("is WRITE-ONCE — a second disarm leaves the first miss exactly as recorded", () => {
    const dir = tmp();
    const path = join(dir, "disarm.json");
    disarmOverride(record({ castId: "first", turn: 1 }), path);
    expect(disarmOverride(record({ castId: "second", turn: 9 }), path)).toBe(false);
    expect(readArmState(path).record).toMatchObject({ castId: "first", turn: 1 });
    rmSync(dir, { recursive: true, force: true });
  });

  it("FAILS CLOSED on an unreadable file — a disarm that cannot be read is still a disarm", () => {
    const dir = tmp();
    const path = join(dir, "disarm.json");
    writeFileSync(path, "{ not json");
    const state = readArmState(path);
    expect(state.disarmed).toBe(true);
    expect(state.reason).toBe("disarmed_unreadable");
    expect(describeArmState(state, path)).toContain("could not be read");
    rmSync(dir, { recursive: true, force: true });
  });

  it("FAILS CLOSED on a well-formed-JSON-but-wrong-shape file, same discipline as the validation loader", () => {
    const dir = tmp();
    const path = join(dir, "disarm.json");
    writeFileSync(path, JSON.stringify({ hello: "world" }));
    expect(readArmState(path).disarmed).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// §3 the veto over the Wilson gate
// ---------------------------------------------------------------------------

describe("the tripwire VETOES the Wilson gate rather than contributing a term to it", () => {
  function seedHits(path: string, n: number): void {
    for (let i = 0; i < n; i++) {
      appendNextPositionValidation(
        { ts: `t${i}`, castId: "c1", turn: i, predicted: [1, 1], actual: [1, 1], hit: true, gridSize: 4 },
        path,
      );
    }
  }

  it("a ledger that clears the bound is still NOT ready once a miss has tripped the wire", () => {
    const dir = tmp();
    const logPath = join(dir, "nextPositionValidation.jsonl");
    const armPath = join(dir, "disarm.json");
    seedHits(logPath, NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS + 10);

    const armed = nextPositionOverrideStats(logPath, armPath);
    expect(armed.ready).toBe(true);
    expect(armed.disarmed).toBe(false);

    disarmOverride(record(), armPath);

    const after = nextPositionOverrideStats(logPath, armPath);
    // The evidence did not change. The verdict did.
    expect(after.attempts).toBe(armed.attempts);
    expect(after.hits).toBe(armed.hits);
    expect(after.lowerBound).toBeCloseTo(armed.lowerBound, 12);
    expect(after.disarmed).toBe(true);
    expect(after.ready).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("and it does NOT wash out as the streak grows — which is exactly what a term in the bound would do", () => {
    // Fold a single miss into hits/attempts instead of vetoing and the bound
    // recovers past 0.5 within a handful of turns, so the override re-arms
    // itself inside the same batch. This asserts the shipped behaviour is the
    // other one.
    const dir = tmp();
    const logPath = join(dir, "nextPositionValidation.jsonl");
    const armPath = join(dir, "disarm.json");
    seedHits(logPath, 200);
    disarmOverride(record(), armPath);
    expect(nextPositionOverrideStats(logPath, armPath).lowerBound).toBeGreaterThan(0.97);
    expect(nextPositionOverrideStats(logPath, armPath).ready).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("exports NO re-arm function — re-arming is a human deleting the file, and that is the point", () => {
    // A safeguard that resets itself is a log line, not a guard. If anything
    // here ever grows a `rearm()`/`clearDisarm()`, this fails and the author
    // has to argue for it in a recap rather than adding it in passing.
    //
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const src = readFileSync(join(process.cwd(), "src", "strategy", "fishing", "nextPositionArm.ts"), "utf8");
    expect(src).not.toMatch(/export function (rearm|reArm|clearDisarm|resetArmState)/);
    expect(src).not.toMatch(/unlinkSync|rmSync/);

    const live = readFileSync(join(process.cwd(), "scripts", "liveFishing.ts"), "utf8");
    // The live loop may WRITE a disarm; it must never remove one.
    expect(live).not.toMatch(/unlinkSync\([^)]*[Aa]rmState/);
  });
});

// ---------------------------------------------------------------------------
// §4 the live wiring — the half that a read-path test cannot reach
// ---------------------------------------------------------------------------

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
 * [session 67 §2] **The ONE builder lives in `tests/helpers/fishingDoc.ts`.**
 * This local wrapper keeps only this file's docId and its positional call
 * signature; it holds NO field list of its own, which is the whole point —
 * there is one place a field can go missing now, and one guard watching it
 * (`tests/fishing/fishingDocGuard.test.ts`).
 */
const fakeDoc = (fishPosition: [number, number], complete: boolean, extraData: Record<string, unknown> = {}) =>
  sharedFakeDoc({ docId: "13066001", fishPosition, complete, extraData });

/**
 * Turn 0 reveals `nextPosition: [2,2]` for turn 1. Turn 1 puts the fish at
 * `actual` — pass a cell other than [2,2] for the synthetic MISS — and ends
 * the cast.
 */
function makeClient(actual: [number, number]): GigaverseClient {
  const calls: string[] = [];
  return {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "",
    postFishingAction: async (body: { action: string }) => {
      calls.push(body.action);
      if (body.action === "start_run") {
        return { success: true, message: "Game started successfully.", data: { doc: fakeDoc([1, 1], false), events: [] }, actionToken: 1 };
      }
      if (calls.filter((a) => a === "play_cards").length === 1) {
        return {
          success: true,
          message: "Cards played successfully.",
          data: { doc: fakeDoc([1, 1], false, { nextPosition: [2, 2] }), events: [] },
          actionToken: 2,
        };
      }
      return { success: true, message: "Cards played successfully.", data: { doc: fakeDoc(actual, true), events: [] }, actionToken: 3 };
    },
  } as unknown as GigaverseClient;
}

function armedDeps(dir: string, actual: [number, number]): LiveFishingDeps {
  return makeLiveFishingDeps({
    client: makeClient(actual),
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    nextPositionArmStatePath: join(dir, "disarm.json"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    logsDir: join(dir, "logs"),
    guardStatePath: join(dir, "guard-budget.json"),
  });
}

/** Puts the ledger where session 65's live one was: enough perfect hits that the override is genuinely armed. */
function seedArmedLedger(dir: string): void {
  for (let i = 0; i < NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS; i++) {
    appendNextPositionValidation(
      { ts: `t${i}`, castId: "prior", turn: i, predicted: [1, 1], actual: [1, 1], hit: true, gridSize: 4, overrideActive: true },
      join(dir, "nextPositionValidation.jsonl"),
    );
  }
}

describe("runOneCast — the tripwire fires on a live miss", () => {
  it("fires on the FIRST validated miss, disarms, and the cast carries on without the override", async () => {
    const dir = tmp();
    const armPath = join(dir, "disarm.json");
    seedArmedLedger(dir);
    // The override must be genuinely armed going in, or this test proves
    // nothing about a tripwire — it would just be watching a dormant feature
    // stay dormant.
    expect(nextPositionOverrideStats(join(dir, "nextPositionValidation.jsonl"), armPath).ready).toBe(true);
    expect(existsSync(armPath)).toBe(false);

    const result = await runOneCast(armedDeps(dir, [3, 1]));

    // The cast finished. The override is an optimisation; losing it mid-cast
    // must not abort anything.
    expect(result.outcome).toBe("escaped");
    // And the file EXISTS now, which is the assertion a read-path-only test
    // cannot make and a no-op `disarmOverride` cannot satisfy.
    expect(existsSync(armPath)).toBe(true);

    const state = readArmState(armPath);
    expect(state.disarmed).toBe(true);
    expect(state.record).toMatchObject({ castId: "13066001", turn: 1, predicted: [2, 2], actual: [3, 1], gridSize: 4 });
    // The streak it ended is recorded, because the number that authorised the
    // override is part of the evidence about it.
    expect(state.record!.streakHits).toBe(NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS);
    expect(state.record!.streakAttempts).toBe(NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS);
    expect(state.record!.lowerBound).toBeGreaterThan(NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS === 10 ? 0.6 : 0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does NOT fire when the armed override is RIGHT", async () => {
    const dir = tmp();
    const armPath = join(dir, "disarm.json");
    seedArmedLedger(dir);

    const result = await runOneCast(armedDeps(dir, [2, 2])); // actual == predicted

    expect(result.outcome).toBe("escaped");
    expect(existsSync(armPath)).toBe(false);
    expect(readArmState(armPath).disarmed).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("does NOT fire on a miss the override never acted on — an UNARMED gate cannot be disarmed", async () => {
    // Same miss, empty ledger: the Wilson gate is unmet, so the prediction is
    // watched rather than acted on. This is the `not_acted` case, and it is
    // the one that would quietly retire the safeguard over a counterfactual.
    const dir = tmp();
    const armPath = join(dir, "disarm.json");

    const result = await runOneCast(armedDeps(dir, [3, 1]));

    expect(result.outcome).toBe("escaped");
    expect(existsSync(armPath)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("records WHICH of the three cases each validation row was, so the ledger can be read back honestly", async () => {
    const dir = tmp();
    seedArmedLedger(dir);
    await runOneCast(armedDeps(dir, [3, 1]));

    const rows = readFileSync(join(dir, "nextPositionValidation.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { castId: string; overrideActive?: boolean; hit: boolean });
    const live = rows.filter((r) => r.castId === "13066001");
    expect(live).toHaveLength(1);
    expect(live[0]!.hit).toBe(false);
    expect(live[0]!.overrideActive).toBe(true); // acted on — that is what makes it a trip
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("the disarm SURVIVES a restart — the half that makes it a guard rather than a log line", () => {
  it("a second invocation against the same paths finds the override off, with an empty-then-full ledger between them", async () => {
    const dir = tmp();
    const logPath = join(dir, "nextPositionValidation.jsonl");
    const armPath = join(dir, "disarm.json");
    seedArmedLedger(dir);

    await runOneCast(armedDeps(dir, [3, 1])); // trips
    expect(readArmState(armPath).disarmed).toBe(true);

    // A fresh `runOneCast` is a fresh process as far as this state is
    // concerned: `pendingPrediction` is per-cast and the stats are re-read from
    // disk every turn. Nothing in memory carries the disarm across.
    const beforeSecond = nextPositionOverrideStats(logPath, armPath);
    expect(beforeSecond.ready).toBe(false);
    expect(beforeSecond.disarmed).toBe(true);

    const second = await runOneCast(armedDeps(dir, [2, 2])); // a would-be HIT, second cast
    expect(second.outcome).toBe("escaped");

    // The second cast's row was NOT acted on, because the override stayed off
    // through a hit it would have got right. That is the whole contract: it
    // does not re-arm itself on good behaviour.
    const rows = readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { castId: string; hit: boolean; overrideActive?: boolean });
    const liveRows = rows.filter((r) => r.castId === "13066001");
    expect(liveRows).toHaveLength(2);
    expect(liveRows[1]!.hit).toBe(true);
    expect(liveRows[1]!.overrideActive).toBe(false);
    // ...and the original miss is still the recorded one.
    expect(readArmState(armPath).record).toMatchObject({ turn: 1, actual: [3, 1] });
    rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// §5 the POPULATE side — session 64's bug class, pinned on source text
// ---------------------------------------------------------------------------

describe("main() actually hands the loop its arm-state path", () => {
  const src = readFileSync(join(process.cwd(), "scripts", "liveFishing.ts"), "utf8");

  it("populates deps.nextPositionArmStatePath in main()'s runOneCast literal", () => {
    // The defect this catches is an ABSENT PROPERTY in an object literal:
    // there is no type error to catch (the field is optional, as every path
    // field here is) and no return value to assert on. Absence is what has to
    // be asserted against — exactly the shape of session 64's `oilBudget`.
    const mainCall = src.slice(src.lastIndexOf("await runOneCast({"));
    const literal = mainCall.slice(0, mainCall.indexOf("});") + 3);
    expect(literal).toMatch(/nextPositionArmStatePath,?/);
    expect(literal).not.toMatch(/nextPositionArmStatePath:\s*undefined/);
  });

  it("resolves that path through the PROFILE, so a --profile run cannot disarm the default profile's override", () => {
    expect(src).toMatch(/const nextPositionArmStatePath = dataPath\(profile, "nextPositionOverrideDisarm\.json"\)/);
  });

  it("prints the arm state before any cast runs, armed or not", () => {
    // A safeguard nobody can see the state of gets rediscovered by accident
    // three sessions later — which is what happened to the override itself.
    expect(src).toMatch(/describeArmState\(armState, nextPositionArmStatePath\)/);
  });

  it("the live loop WRITES the disarm — the read path alone would be a permanently-armed override", () => {
    expect(src).toMatch(/disarmOverride\(disarmRecord, nextPositionArmStatePath\)/);
    expect(src).toMatch(/tripsWire\(predictionOutcome\)/);
    // and the gate consults it rather than the Wilson bound alone
    expect(src).toMatch(/nextPositionOverrideStats\(nextPositionLogPath, nextPositionArmStatePath\)/);
  });

  it("the default path is a real data path, which is why every test above passes its own", () => {
    expect(DEFAULT_NEXT_POSITION_ARM_STATE_PATH).toBe(join("data", "nextPositionOverrideDisarm.json"));
  });
});
