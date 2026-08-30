/**
 * tests/orchestrator/guardPersistence.test.ts — session 09, brief §2.
 *
 * Uses a temp dir + explicit path param, same pattern as config.test.ts —
 * never touches the real `data/guard-budget.json`.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  acquireGuardLock,
  GuardPersistenceError,
  loadGuardBudget,
  saveGuardBudget,
  todayKey,
  __resetGuardDayMemo,
} from "../../src/orchestrator/guardPersistence.js";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gigaruns-guard-persist-test-"));
  path = join(dir, "guard-budget.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadGuardBudget", () => {
  it("returns a zero seed when nothing is on disk yet", () => {
    expect(loadGuardBudget(path)).toEqual({ energySpent: 0, runsStarted: 0 });
  });

  // [session 28, CODEXREVIEW #2] REVERSED: a file that EXISTS but is
  // corrupt must fail CLOSED, not open. Silently zeroing a corrupted record
  // of real spend is exactly the "unexpected state" CLAUDE.md §5 says to
  // stop on, not paper over — a restart could otherwise spend right past
  // the real daily budget because the corrupted file "looked like" day one.
  it("throws GuardPersistenceError on corrupt JSON in an EXISTING file — fails closed, does not silently zero real spend", () => {
    writeFileSync(path, "{not valid json");
    expect(() => loadGuardBudget(path)).toThrow(GuardPersistenceError);
  });

  it("throws GuardPersistenceError on a file that parses but doesn't match the expected shape", () => {
    writeFileSync(path, JSON.stringify({ totally: "wrong shape" }));
    expect(() => loadGuardBudget(path)).toThrow(GuardPersistenceError);
  });

  it("returns a zero seed when the persisted date is not today — fresh budget per day", () => {
    writeFileSync(path, JSON.stringify({ date: "2000-01-01", energySpent: 40, runsStarted: 2 }));
    expect(loadGuardBudget(path)).toEqual({ energySpent: 0, runsStarted: 0 });
  });

  it("returns the persisted spend when the date matches today", () => {
    writeFileSync(path, JSON.stringify({ date: todayKey(), energySpent: 40, runsStarted: 2 }));
    expect(loadGuardBudget(path)).toEqual({ energySpent: 40, runsStarted: 2 });
  });
});

// [session 29, CODEXREVIEW #6] The guard "day" rolls over at 11am Pacific,
// not UTC midnight — see todayKey's own doc comment for the two confirmed
// live mismatches this fixes. These pin the boundary itself, both sides of
// it, and both sides of a real DST transition (Nov 1 2026: PDT -> PST).
describe("todayKey — 11am Pacific rollover (session 29, CODEXREVIEW #6)", () => {
  it("10:59am Pacific still reads as the PRIOR calendar day", () => {
    // 2026-08-17 10:59am PDT (UTC-7) = 2026-08-17T17:59:00Z
    expect(todayKey(new Date("2026-08-17T17:59:00Z"))).toBe("2026-08-16");
  });

  it("11:01am Pacific reads as the current calendar day", () => {
    // 2026-08-17 11:01am PDT (UTC-7) = 2026-08-17T18:01:00Z
    expect(todayKey(new Date("2026-08-17T18:01:00Z"))).toBe("2026-08-17");
  });

  it("exactly 11:00am Pacific already rolls over to the current day", () => {
    expect(todayKey(new Date("2026-08-17T18:00:00Z"))).toBe("2026-08-17");
  });

  // DST ends (PDT -> PST) at 2am Pacific on 2026-11-01 — check both sides.
  it("holds across the DST fall-back transition — PDT side (Oct 31, still UTC-7)", () => {
    expect(todayKey(new Date("2026-10-31T17:59:00Z"))).toBe("2026-10-30"); // 10:59am PDT
    expect(todayKey(new Date("2026-10-31T18:01:00Z"))).toBe("2026-10-31"); // 11:01am PDT
  });

  it("holds across the DST fall-back transition — PST side (Nov 1, now UTC-8)", () => {
    expect(todayKey(new Date("2026-11-01T18:59:00Z"))).toBe("2026-10-31"); // 10:59am PST
    expect(todayKey(new Date("2026-11-01T19:01:00Z"))).toBe("2026-11-01"); // 11:01am PST
  });
});

describe("saveGuardBudget", () => {
  it("round-trips through loadGuardBudget", () => {
    saveGuardBudget(20, 1, path);
    expect(loadGuardBudget(path)).toEqual({ energySpent: 20, runsStarted: 1 });
  });

  it("overwrites rather than accumulates on repeated calls", () => {
    saveGuardBudget(20, 1, path);
    saveGuardBudget(40, 2, path);
    expect(loadGuardBudget(path)).toEqual({ energySpent: 40, runsStarted: 2 });
  });

  it("creates the parent directory if it doesn't exist", () => {
    const nested = join(dir, "nested", "guard-budget.json");
    saveGuardBudget(5, 1, nested);
    expect(loadGuardBudget(nested)).toEqual({ energySpent: 5, runsStarted: 1 });
  });

  // [session 28, CODEXREVIEW #2] Atomic write: no sibling temp file should
  // ever be left behind by a clean save, and the real path never holds
  // anything other than one complete, valid JSON document.
  it("writes through a temp file and renames it into place — no temp file survives a clean save", () => {
    saveGuardBudget(20, 1, path);
    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ energySpent: 20, runsStarted: 1 });
  });
});

describe("acquireGuardLock", () => {
  it("acquires cleanly when nothing else holds the lock, and the release function removes it", () => {
    const release = acquireGuardLock(path);
    expect(existsSync(`${path}.lock`)).toBe(true);
    release();
    expect(existsSync(`${path}.lock`)).toBe(false);
  });

  it("refuses a second concurrent acquire while this process still holds the lock", () => {
    const release = acquireGuardLock(path);
    expect(() => acquireGuardLock(path)).toThrow(GuardPersistenceError);
    release();
  });

  it("reclaims a stale lock left by a process that is no longer running", () => {
    // A PID this high is astronomically unlikely to be a real running
    // process on any real machine — stands in for "the process that held
    // this lock crashed without cleaning up."
    writeFileSync(`${path}.lock`, "999999999");
    const release = acquireGuardLock(path); // must reclaim, not throw
    expect(existsSync(`${path}.lock`)).toBe(true);
    expect(readFileSync(`${path}.lock`, "utf8")).toBe(String(process.pid));
    release();
  });

  it("release is idempotent — calling it twice doesn't throw", () => {
    const release = acquireGuardLock(path);
    release();
    expect(() => release()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// [session 111, QUESTIONS §65] The day-key straddle.
// ---------------------------------------------------------------------------

describe("saveGuardBudget — the 11:00 Pacific day-key straddle", () => {
  // Session 108's real timestamps, per session 109's log: the `--runs=4`
  // invocation started 2026-08-29T17:53Z and crossed 18:00Z between runs 2
  // and 3. PDT is UTC-7, so 17:53Z is 10:53 PT — BEFORE the 11:00 rollover,
  // which puts it in guard day 2026-08-28, one calendar day behind the UTC
  // date. That off-by-one is the whole reason `todayKey` exists, and getting
  // it wrong here silently turns every case below into a no-straddle case, so
  // the anchor assertion pins both keys before anything else runs.
  const BEFORE_1 = new Date("2026-08-29T17:53:00Z"); // process start
  const BEFORE_2 = new Date("2026-08-29T17:56:00Z"); // run 1 saved
  const BEFORE_3 = new Date("2026-08-29T17:59:00Z"); // run 2 saved
  const AFTER_1 = new Date("2026-08-29T18:03:00Z"); // run 3 saved — new guard day
  const AFTER_2 = new Date("2026-08-29T18:07:00Z"); // run 4 saved

  const read = () => JSON.parse(readFileSync(path, "utf8"));

  beforeEach(() => {
    __resetGuardDayMemo();
  });

  it("anchors the fixture: 17:59Z is guard day 2026-08-28 and 18:03Z is 2026-08-29", () => {
    // If this ever fails, the cases below are testing nothing — same trap as
    // CLAUDE.md rule 10, an instrument that stopped measuring.
    expect(todayKey(BEFORE_1)).toBe("2026-08-28");
    expect(todayKey(BEFORE_3)).toBe("2026-08-28");
    expect(todayKey(AFTER_1)).toBe("2026-08-29");
    expect(todayKey(AFTER_2)).toBe("2026-08-29");
  });

  it("reproduces session 108 exactly: the new day inherits ONLY the runs it saw", () => {
    expect(loadGuardBudget(path, BEFORE_1)).toEqual({ energySpent: 0, runsStarted: 0 });

    saveGuardBudget(60, 3, path, BEFORE_2);
    expect(read()).toEqual({ date: "2026-08-28", energySpent: 60, runsStarted: 3 });

    saveGuardBudget(120, 6, path, BEFORE_3);
    expect(read()).toEqual({ date: "2026-08-28", energySpent: 120, runsStarted: 6 });

    // The rollover. Cumulative counters are 180/9, but only 60/3 of that was
    // spent on the new day.
    saveGuardBudget(180, 9, path, AFTER_1);
    expect(read()).toEqual({ date: "2026-08-29", energySpent: 60, runsStarted: 3 });

    saveGuardBudget(240, 12, path, AFTER_2);
    // Exactly the value session 109 had to write by hand to unblock the day —
    // runs 3+4 and nothing else. Before this fix the file read 240/12, and the
    // next dry run fail-closed with {"attemptedRun":15,"cap":12} against a
    // server that read 6.
    expect(read()).toEqual({ date: "2026-08-29", energySpent: 120, runsStarted: 6 });
    expect(read().runsStarted).not.toBe(12);
  });

  it("rebases correctly when the FIRST save of the process lands after the rollover", () => {
    // The case that rules out memoising lazily at save time: the process loads
    // a non-zero seed before 11:00 and does not write again until after it, so
    // there is no pre-rollover save to learn the boundary from. The memo has to
    // be seeded at LOAD.
    writeFileSync(path, JSON.stringify({ date: "2026-08-28", energySpent: 60, runsStarted: 3 }));
    expect(loadGuardBudget(path, BEFORE_1)).toEqual({ energySpent: 60, runsStarted: 3 });

    saveGuardBudget(120, 6, path, AFTER_1);
    expect(read()).toEqual({ date: "2026-08-29", energySpent: 60, runsStarted: 3 });
  });

  it("FIRST LOAD WINS — a second load mid-process does not reset the baseline", () => {
    // `liveRun.ts` and `liveFishing.ts` both load twice (a preflight read, then
    // the real one), and `doctor.ts`/`checkFishingCaps.ts` load the same paths
    // read-only. A re-seed after the rollover would zero the baseline and
    // reintroduce the whole bug.
    loadGuardBudget(path, BEFORE_1);
    saveGuardBudget(60, 3, path, BEFORE_2);

    // Post-rollover read: the file's date is now stale, so this returns a zero
    // seed — and must NOT tell the memo that the counters start from zero.
    expect(loadGuardBudget(path, AFTER_1)).toEqual({ energySpent: 0, runsStarted: 0 });

    saveGuardBudget(120, 6, path, AFTER_2);
    expect(read()).toEqual({ date: "2026-08-29", energySpent: 60, runsStarted: 3 });
  });

  it("leaves the ordinary non-straddling case byte-identical to the old behaviour", () => {
    loadGuardBudget(path, BEFORE_1);
    saveGuardBudget(20, 1, path, BEFORE_2);
    saveGuardBudget(40, 2, path, BEFORE_3);
    expect(read()).toEqual({ date: "2026-08-28", energySpent: 40, runsStarted: 2 });
  });

  it("a fresh process on a new day still writes its cumulative total, not a negative", () => {
    // §65 rejected naive rebasing for exactly this: `loadGuardBudget` already
    // discards the stale file and seeds {0,0}, so subtracting the file's
    // prior-day totals would go negative.
    writeFileSync(path, JSON.stringify({ date: "2026-08-28", energySpent: 240, runsStarted: 12 }));
    expect(loadGuardBudget(path, AFTER_1)).toEqual({ energySpent: 0, runsStarted: 0 });

    saveGuardBudget(60, 3, path, AFTER_2);
    expect(read()).toEqual({ date: "2026-08-29", energySpent: 60, runsStarted: 3 });
  });

  it("saving with no prior load persists the cumulative unchanged", () => {
    saveGuardBudget(40, 2, path, BEFORE_2);
    expect(read()).toEqual({ date: "2026-08-28", energySpent: 40, runsStarted: 2 });
  });

  it("tracks the dungeon and fishing ledgers independently", () => {
    // One process can account for both arms, and they roll over independently
    // of each other's WRITE timing — the memo is keyed by path for this.
    const fishingPath = join(dir, "guard-budget-fishing.json");
    loadGuardBudget(path, BEFORE_1);
    loadGuardBudget(fishingPath, BEFORE_1);

    saveGuardBudget(60, 3, path, BEFORE_2);
    saveGuardBudget(120, 10, fishingPath, BEFORE_2);

    saveGuardBudget(120, 6, path, AFTER_1);
    expect(read()).toEqual({ date: "2026-08-29", energySpent: 60, runsStarted: 3 });
    // The fishing ledger has not been written since the rollover, so its own
    // pre-rollover file must be untouched.
    expect(JSON.parse(readFileSync(fishingPath, "utf8"))).toEqual({
      date: "2026-08-28",
      energySpent: 120,
      runsStarted: 10,
    });

    saveGuardBudget(156, 13, fishingPath, AFTER_2);
    expect(JSON.parse(readFileSync(fishingPath, "utf8"))).toEqual({
      date: "2026-08-29",
      energySpent: 36,
      runsStarted: 3,
    });
  });

  it("drops the baseline instead of crashing when the counters are re-seeded downward", () => {
    // The live path this protects: `liveFishing.ts` calls
    // `guards.adoptServerRunCount()` after `reconcileFishingLedger`, and that
    // setter assigns the server's count ABSOLUTELY and can lower it. A
    // straddling autonomous batch whose reconciler had just corrected it
    // downward would otherwise hit a negative day total. Writing the raw
    // cumulative errs toward over-counting, which blocks runs and can never
    // authorize a spend — and in the adopt case it is exactly the game's own
    // number, because the reconciler guarantees that equality.
    loadGuardBudget(path, BEFORE_1);
    saveGuardBudget(120, 6, path, BEFORE_2);

    saveGuardBudget(60, 3, path, AFTER_1);
    expect(read()).toEqual({ date: "2026-08-29", energySpent: 60, runsStarted: 3 });

    // And it keeps counting forward correctly from there, with no baseline left.
    saveGuardBudget(72, 4, path, AFTER_2);
    expect(read()).toEqual({ date: "2026-08-29", energySpent: 72, runsStarted: 4 });
  });

  it("keeps the rebased file readable by loadGuardBudget on the new day", () => {
    // End-to-end: the whole point is that the NEXT process reads a correct
    // ledger. Session 109's did not, and blocked two available runs.
    loadGuardBudget(path, BEFORE_1);
    saveGuardBudget(120, 6, path, BEFORE_3);
    saveGuardBudget(240, 12, path, AFTER_2);

    __resetGuardDayMemo(); // a genuinely fresh process
    expect(loadGuardBudget(path, AFTER_2)).toEqual({ energySpent: 120, runsStarted: 6 });
  });
});
