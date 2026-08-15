/**
 * tests/orchestrator/guardPersistence.test.ts — session 09, brief §2.
 *
 * Uses a temp dir + explicit path param, same pattern as config.test.ts —
 * never touches the real `data/guard-budget.json`.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadGuardBudget, saveGuardBudget, todayKey } from "../../src/orchestrator/guardPersistence.js";

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

  it("returns a zero seed on corrupt JSON — fails open, never blocks startup", () => {
    writeFileSync(path, "{not valid json");
    expect(loadGuardBudget(path)).toEqual({ energySpent: 0, runsStarted: 0 });
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
});
