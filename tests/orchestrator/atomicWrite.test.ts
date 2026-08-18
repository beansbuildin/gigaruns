/**
 * tests/orchestrator/atomicWrite.test.ts — session 37, CODEXAUDIT #5.
 *
 * Uses a temp dir + explicit path param, same isolation convention as
 * guardPersistence.test.ts — never touches a real data/ path.
 *
 * `vi.mock("node:fs", { spy: true })` is required here (not plain
 * `vi.spyOn`) because Node's built-in ESM module namespace is not
 * configurable — a direct `vi.spyOn(fs, "fsyncSync")` throws "Cannot
 * redefine property" at runtime. `{ spy: true }` auto-spies every export
 * while calling through to the real implementation by default, which is
 * exactly what these tests need: real behavior except where a specific test
 * overrides one function to simulate a failure.
 *
 * What's provable here and what isn't (stated per the session-37 brief,
 * §1.3): a unit test cannot prove a write survives a real power loss — that
 * is a filesystem/OS guarantee this project is trusting, not one it can
 * independently verify. What IS provable, and asserted below: the fsync
 * syscalls actually happen during a real save (spy), a failed write cleans
 * up its temp file rather than leaving it behind, and the function still
 * round-trips valid JSON through a real rename.
 */

import { existsSync, fsyncSync, mkdtempSync, openSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", { spy: true });

import { atomicWriteJson } from "../../src/orchestrator/atomicWrite.js";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gigaruns-atomic-write-test-"));
  path = join(dir, "state.json");
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("atomicWriteJson", () => {
  it("round-trips a JSON body through a real write + rename", () => {
    atomicWriteJson(path, { hello: "world", n: 3 });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ hello: "world", n: 3 });
  });

  it("creates the parent directory if it doesn't exist", () => {
    const nested = join(dir, "nested", "deeper", "state.json");
    atomicWriteJson(nested, { a: 1 });
    expect(JSON.parse(readFileSync(nested, "utf8"))).toEqual({ a: 1 });
  });

  it("leaves no .tmp-* file behind after a clean write", () => {
    atomicWriteJson(path, { a: 1 });
    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
  });

  it("overwrites rather than accumulates on repeated calls", () => {
    atomicWriteJson(path, { a: 1 });
    atomicWriteJson(path, { a: 2 });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ a: 2 });
  });

  // The actual fix CODEXREVIEW #2 asked for: writeFileSync never exposed a
  // file descriptor to fsync, so the old code never called it at all. This
  // confirms the code PATH exists and runs on every save — the concrete,
  // testable claim — not that the bytes survive a real power loss, which no
  // unit test can prove.
  it("fsyncs the temp file's descriptor before renaming it into place", () => {
    atomicWriteJson(path, { a: 1 });
    expect(vi.mocked(fsyncSync)).toHaveBeenCalled();
  });

  // Directory-fsync isn't supported on every platform/filesystem — confirm
  // a failure there is swallowed and doesn't take down an otherwise-good
  // write, per the brief's explicit "wrap in its own try/catch" requirement.
  // Only the directory-fsync's own open call is made to fail; the temp-file
  // open still goes through to the real syscall via `vi.importActual`, so
  // the write itself must still succeed.
  it("does not throw if the best-effort directory fsync fails", async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
    vi.mocked(openSync).mockImplementation(((p: unknown, ...rest: unknown[]) => {
      if (p === dir) throw new Error("directory fsync not supported here");
      return (actual.openSync as (...a: unknown[]) => number)(p, ...rest);
    }) as typeof openSync);

    expect(() => atomicWriteJson(path, { a: 1 })).not.toThrow();
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ a: 1 });
  });

  it("cleans up the temp file and rethrows if the rename fails", () => {
    vi.mocked(renameSync).mockImplementation(() => {
      throw new Error("simulated rename failure");
    });

    expect(() => atomicWriteJson(path, { a: 1 })).toThrow("simulated rename failure");
    expect(existsSync(path)).toBe(false);
    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
  });

  it("cleans up the temp file and rethrows if fsync on the temp file fails", () => {
    vi.mocked(fsyncSync).mockImplementation(() => {
      throw new Error("simulated fsync failure");
    });

    expect(() => atomicWriteJson(path, { a: 1 })).toThrow("simulated fsync failure");
    expect(existsSync(path)).toBe(false);
    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
  });
});
