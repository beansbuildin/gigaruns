/**
 * tests/orchestrator/playCountsPersistence.test.ts — CODEXIMPROVE #5
 * (session 35).
 *
 * Same isolation discipline as guardPersistence.test.ts and
 * opponentModelPersistence.test.ts: a fresh `mkdtempSync` dir + explicit path
 * param per test, never the real `data/play-counts.json`.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deletePlayCounts,
  loadPlayCounts,
  PLAY_COUNTS_SCHEMA_VERSION,
  PlayCountsPersistenceError,
  savePlayCounts,
} from "../../src/orchestrator/playCountsPersistence.js";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gigaruns-play-counts-test-"));
  path = join(dir, "play-counts.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadPlayCounts", () => {
  it("returns zeroed counts when nothing is on disk yet", () => {
    expect(loadPlayCounts(1, path)).toEqual({ rock: 0, paper: 0, scissor: 0 });
  });

  it("throws PlayCountsPersistenceError on corrupt JSON in an EXISTING file — does not silently reset to zero", () => {
    writeFileSync(path, "{not valid json");
    expect(() => loadPlayCounts(1, path)).toThrow(PlayCountsPersistenceError);
  });

  it("throws PlayCountsPersistenceError on a file that parses but doesn't match the expected shape", () => {
    writeFileSync(path, JSON.stringify({ totally: "wrong shape" }));
    expect(() => loadPlayCounts(1, path)).toThrow(PlayCountsPersistenceError);
  });

  it("throws PlayCountsPersistenceError on a schemaVersion mismatch — rejected, not silently misread", () => {
    writeFileSync(
      path,
      JSON.stringify({ schemaVersion: PLAY_COUNTS_SCHEMA_VERSION + 1, runId: 1, counts: { rock: 0, paper: 0, scissor: 0 } }),
    );
    expect(() => loadPlayCounts(1, path)).toThrow(PlayCountsPersistenceError);
  });
});

describe("savePlayCounts", () => {
  it("round-trips through loadPlayCounts for the same runId", () => {
    savePlayCounts(42, { rock: 3, paper: 1, scissor: 0 }, path);
    expect(loadPlayCounts(42, path)).toEqual({ rock: 3, paper: 1, scissor: 0 });
  });

  it("creates the parent directory if it doesn't exist", () => {
    const nested = join(dir, "nested", "play-counts.json");
    savePlayCounts(1, { rock: 0, paper: 0, scissor: 0 }, nested);
    expect(existsSync(nested)).toBe(true);
  });

  it("writes through a temp file and renames it into place — no temp file survives a clean save", () => {
    savePlayCounts(1, { rock: 1, paper: 0, scissor: 0 }, path);
    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ schemaVersion: PLAY_COUNTS_SCHEMA_VERSION, runId: 1 });
  });
});

// The specific regression CODEXIMPROVE #5 asked for by name: playCounts must
// survive a simulated resume of the SAME run, and must reset — not carry
// over — between two DIFFERENT run IDs.
describe("resume and reset regressions", () => {
  it("survives a simulated resume of the same run (same DUNGEON_ID_CID)", () => {
    const runId = 777;
    savePlayCounts(runId, { rock: 2, paper: 5, scissor: 1 }, path);

    // "Resume" — a fresh runOnce() invocation would construct nothing but
    // call loadPlayCounts against the run it just found active, exactly
    // like this.
    const resumed = loadPlayCounts(runId, path);
    expect(resumed).toEqual({ rock: 2, paper: 5, scissor: 1 });
  });

  it("resets to zero when loaded against a DIFFERENT run ID than what's persisted", () => {
    const firstRunId = 100;
    savePlayCounts(firstRunId, { rock: 9, paper: 9, scissor: 9 }, path);

    const secondRunId = 200;
    expect(loadPlayCounts(secondRunId, path)).toEqual({ rock: 0, paper: 0, scissor: 0 });
  });

  it("a corrupt file on disk fails closed on the next load rather than silently returning zero", () => {
    savePlayCounts(1, { rock: 1, paper: 0, scissor: 0 }, path);
    // ...then the file gets corrupted on disk (truncated write, bad edit, etc).
    writeFileSync(path, readFileSync(path, "utf8").slice(0, -5));
    expect(() => loadPlayCounts(1, path)).toThrow(PlayCountsPersistenceError);
  });
});

describe("deletePlayCounts", () => {
  it("removes the persisted file", () => {
    savePlayCounts(1, { rock: 1, paper: 0, scissor: 0 }, path);
    expect(existsSync(path)).toBe(true);
    deletePlayCounts(path);
    expect(existsSync(path)).toBe(false);
  });

  it("is a no-op, not an error, when nothing is on disk", () => {
    expect(() => deletePlayCounts(path)).not.toThrow();
  });

  it("a run that ends and is deleted does not leak into the next run started with a fresh save", () => {
    savePlayCounts(1, { rock: 9, paper: 9, scissor: 9 }, path);
    deletePlayCounts(path);
    expect(loadPlayCounts(2, path)).toEqual({ rock: 0, paper: 0, scissor: 0 });
  });
});
