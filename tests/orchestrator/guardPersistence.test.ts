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

import { acquireGuardLock, GuardPersistenceError, loadGuardBudget, saveGuardBudget, todayKey } from "../../src/orchestrator/guardPersistence.js";

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
