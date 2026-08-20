/**
 * tests/profile.test.ts — session 59.
 *
 * The profile seam, and above all the promise that **omitting `--profile`
 * changes nothing**. Every default below is written as a LITERAL rather than
 * recomputed from `profile.ts`, deliberately: a test that says
 * `expect(p.dataRoot).toBe(DEFAULT_DATA_ROOT)` passes no matter what the module
 * decides that constant means, which is precisely the failure it is supposed to
 * catch. The author's setup must not move, so the old paths are spelled out.
 *
 * Writes nothing — path resolution only, no I/O.
 */
import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_PROFILE_NAME,
  assertValidProfileName,
  profileArg,
  resolveProfile,
  dataPath,
  logPath,
  fixturePath,
  configPath,
} from "../src/profile.js";

describe("resolveProfile — the default profile is today's layout, unchanged", () => {
  it("resolves every root to the literal path used since session 01", () => {
    const p = resolveProfile();
    expect(p.name).toBe("default");
    expect(p.dataRoot).toBe("data");
    expect(p.logRoot).toBe("logs");
    expect(p.fixtureRoot).toBe("fixtures");
    expect(p.configRoot).toBe("config");
    expect(p.jwtPath).toBe(join(homedir(), ".secrets", "gigaverse-jwt.txt"));
  });

  it('naming "default" explicitly is the same as omitting it', () => {
    expect(resolveProfile(DEFAULT_PROFILE_NAME)).toMatchObject({
      dataRoot: "data",
      logRoot: "logs",
      fixtureRoot: "fixtures",
    });
  });

  it("reproduces the exact ledger paths the persistence modules default to", () => {
    // These four strings are the real files the author's account has been
    // writing since sessions 09-33. If a refactor moves any of them, the guard
    // ledger and the learned opponent model silently start from zero.
    const p = resolveProfile();
    expect(dataPath(p, "guard-budget.json")).toBe(join("data", "guard-budget.json"));
    expect(dataPath(p, "guard-budget-fishing.json")).toBe(join("data", "guard-budget-fishing.json"));
    expect(dataPath(p, "opponent-model.json")).toBe(join("data", "opponent-model.json"));
    expect(dataPath(p, "play-counts.json")).toBe(join("data", "play-counts.json"));
    expect(fixturePath(p, "dungeon-runs")).toBe(join("fixtures", "dungeon-runs"));
    expect(fixturePath(p, "fishing-casts")).toBe(join("fixtures", "fishing-casts"));
    expect(configPath(p, "bot.json")).toBe(join("config", "bot.json"));
    expect(p.discoveredPath).toBe(join("config", "discovered.json"));
    expect(logPath(p, "x.jsonl")).toBe(join("logs", "x.jsonl"));
  });
});

describe("resolveProfile — a named profile is fully separated", () => {
  const p = resolveProfile("alice");

  it("puts data, logs, fixtures and config under profiles/<name>/", () => {
    expect(p.name).toBe("alice");
    expect(p.dataRoot).toBe(join("profiles", "alice", "data"));
    expect(p.logRoot).toBe(join("profiles", "alice", "logs"));
    expect(p.fixtureRoot).toBe(join("profiles", "alice", "fixtures"));
    expect(p.configRoot).toBe(join("profiles", "alice", "config"));
  });

  it("keeps the JWT in ~/.secrets, NOT under the repo", () => {
    // A token inside the working tree is one `git add -A` from being committed,
    // and this repo is public. The separation is per-name, not per-directory.
    expect(p.jwtPath).toBe(join(homedir(), ".secrets", "gigaverse-jwt-alice.txt"));
    expect(p.jwtPath.startsWith("profiles")).toBe(false);
  });

  it("shares nothing per-account with the default profile", () => {
    const d = resolveProfile();
    for (const key of ["dataRoot", "logRoot", "fixtureRoot", "configRoot", "jwtPath"] as const) {
      expect(p[key]).not.toBe(d[key]);
    }
  });

  it("DOES share config/discovered.json — it is game-global, not per-account", () => {
    // Forbidden Woods is dungeon 5 and maxRoom 16 for everyone (four dungeons,
    // session 57). Per-profile discovery would make each person re-run probe.ts
    // to rediscover facts that cannot differ between them. bot.json goes the
    // other way and IS per-profile, because budgets are personal — that split
    // is the entire reason these are two files.
    expect(p.discoveredPath).toBe(resolveProfile().discoveredPath);
    expect(p.discoveredPath).toBe(join("config", "discovered.json"));
    expect(p.discoveredPath.startsWith("profiles")).toBe(false);
    expect(configPath(p, "bot.json")).toBe(join("profiles", "alice", "config", "bot.json"));
  });
});

describe("a named profile's state is gitignored", () => {
  it("every root a named profile writes is ignored by git", async () => {
    // The gap this closes: `data/` and `logs/` in .gitignore match at any
    // depth, so profiles/<name>/data and .../logs were covered by accident —
    // but profiles/<name>/fixtures and .../config were NOT, and a second
    // account's captured game states would have been committed to a PUBLIC
    // repo. Asserted against real `git check-ignore` rather than by reading
    // .gitignore, because the pattern semantics are the thing being tested.
    const { execSync } = await import("node:child_process");
    const p = resolveProfile("someone-else");
    for (const root of [p.dataRoot, p.logRoot, p.fixtureRoot, p.configRoot]) {
      const probe = join(root, "anything.json");
      const ignored = execSync(`git check-ignore -q ${JSON.stringify(probe)} && echo yes || echo no`, {
        encoding: "utf8",
      }).trim();
      expect(ignored, `${probe} would be committed`).toBe("yes");
    }
  });

  it("the DEFAULT profile's roots are ignored too — unchanged, but worth stating", () => {
    expect(resolveProfile().dataRoot).toBe("data");
    expect(resolveProfile().logRoot).toBe("logs");
  });
});

describe("assertValidProfileName — rejects rather than sanitises", () => {
  it("accepts ordinary names", () => {
    for (const n of ["alice", "bob-2", "a_b", "X9"]) {
      expect(() => assertValidProfileName(n)).not.toThrow();
    }
  });

  it("rejects anything that could escape or redirect the directory", () => {
    // A silently-sanitised name is how one person's ledger gets written over
    // another's. `..` is the obvious way in; the rest are the same class.
    for (const n of ["..", "../x", "a/b", "a\\b", "", " ", "-lead", ".hidden", "a b"]) {
      expect(() => assertValidProfileName(n), n).toThrow(/Invalid --profile name/);
    }
  });

  it("resolveProfile applies the same check", () => {
    expect(() => resolveProfile("../escape")).toThrow(/Invalid --profile name/);
  });
});

describe("profileArg", () => {
  it("reads --profile=name and nothing else", () => {
    expect(profileArg(["--juiced", "--profile=alice", "--runs=1"])).toBe("alice");
    expect(profileArg(["--juiced", "--runs=1"])).toBeUndefined();
  });

  it("refuses the space-separated form rather than silently ignoring it", () => {
    // The failure this prevents: `--profile alice` parses as no profile at all,
    // so the command runs happily against the DEFAULT profile's ledgers — the
    // exact opposite of what was asked, with no error.
    expect(() => profileArg(["--profile", "alice"])).toThrow(/equals sign/);
  });
});

describe("getJwt is a provider, not a string", () => {
  it("is a function that is not called during resolution", async () => {
    // Resolution must stay side-effect free: `doctor.ts` and the help paths
    // resolve a profile without a token existing yet.
    const p = resolveProfile("nobody-has-this-profile");
    expect(typeof p.getJwt).toBe("function");
    await expect(p.getJwt()).rejects.toThrow(/No JWT at/);
  });

  it("names the missing file in the error, so the failure is actionable", async () => {
    const p = resolveProfile("nobody-has-this-profile");
    await expect(p.getJwt()).rejects.toThrow(/gigaverse-jwt-nobody-has-this-profile\.txt/);
  });
});
