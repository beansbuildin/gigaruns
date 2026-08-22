/**
 * tests/cliArgs.test.ts — [session 80 §5] **an unrecognised flag must stop a
 * spending script, and both spending scripts must actually call the guard.**
 *
 * This exists because of a real incident, not a hypothetical one. Session 80,
 * 2026-08-22: `npx tsx scripts/liveFishing.ts --help` was run to read the
 * script's flags. There is no `--help`. The flag was ignored, `--casts=`
 * defaulted to 1, and the script **played a real cast** off a capped daily
 * allowance nobody had authorised. It surfaced only through CLAUDE.md rule
 * 13's ledger check.
 *
 * The same defect was live in `liveRun.ts`, where the default is to start a
 * DUNGEON RUN — three run-units under rule 11, or one plain 20-energy entry
 * that rule 11 forbids outright.
 *
 * Two halves are pinned, and the second is the one that would have caught the
 * incident: the classifier's behaviour, and the fact that **each script wires
 * it in**. A guard nothing calls is the same as no guard.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { classifyArgs } from "../scripts/lib/cliArgs.js";

const KNOWN = ["--casts=", "--dry-run", "--status", "--profile="] as const;

describe("classifyArgs", () => {
  it("accepts every declared flag, exact and value-carrying alike", () => {
    expect(classifyArgs(["--dry-run", "--casts=8", "--profile=alt"], KNOWN).unknown).toEqual([]);
  });

  it("REFUSES the flag that caused the incident", () => {
    // `--help` is not "unknown" — it is handled, and handled by printing rather
    // than by playing. Either outcome is fine; silently defaulting is not.
    expect(classifyArgs(["--help"], KNOWN).help).toBe(true);
    expect(classifyArgs(["-h"], KNOWN).help).toBe(true);
  });

  it("REFUSES a near-miss typo rather than falling through to the default", () => {
    expect(classifyArgs(["--cast=3"], KNOWN).unknown).toEqual(["--cast=3"]);
    expect(classifyArgs(["--casts", "3"], KNOWN).unknown).toEqual(["--casts", "3"]);
    expect(classifyArgs(["--dryrun"], KNOWN).unknown).toEqual(["--dryrun"]);
  });

  it("treats a bare value-flag as unknown — that is the shape that becomes the default", () => {
    // `--casts` with no `=` is exactly what `argv.find(a => a.startsWith("--casts="))`
    // cannot see, so it is exactly what silently became `casts = 1`.
    expect(classifyArgs(["--casts"], KNOWN).unknown).toEqual(["--casts"]);
  });

  it("reports EVERY unknown token, not just the first", () => {
    expect(classifyArgs(["--nope", "--casts=1", "--also-nope"], KNOWN).unknown).toEqual(["--nope", "--also-nope"]);
  });

  it("passes an empty argv — the default invocation is still legal", () => {
    expect(classifyArgs([], KNOWN)).toEqual({ help: false, unknown: [] });
  });
});

describe("both spending scripts wire the guard in", () => {
  // A source assertion, deliberately. The incident was not that the guard was
  // wrong — there was no guard — so the durable check is that `main()` calls
  // one before it does anything else. Same construction as the repo's other
  // "this wire must stay connected" pins.
  for (const script of ["scripts/liveFishing.ts", "scripts/liveRun.ts"]) {
    it(`${script} calls rejectUnknownArgs as main()'s first statement`, () => {
      const src = readFileSync(script, "utf8");
      expect(src).toContain('import { rejectUnknownArgs } from "./lib/cliArgs.js";');
      expect(src).toMatch(
        /async function main\(\) \{\n\s*rejectUnknownArgs\(process\.argv\.slice\(2\), KNOWN_ARGS, USAGE\);/,
      );
    });

    it(`${script} declares every flag its own parseArgs reads`, () => {
      // The failure mode this catches: someone adds a flag to `parseArgs` and
      // forgets `KNOWN_ARGS`, so a legitimate invocation is now refused. The
      // guard is only safe if the declaration cannot drift from the parser.
      const src = readFileSync(script, "utf8");
      const declared = new Set([...src.matchAll(/^\s{2}"(--[a-z0-9-]+=?)",$/gm)].map((m) => m[1]!));
      const read = new Set([...src.matchAll(/argv\.(?:includes|find)\(\s*\(?a?\)?\s*=?>?\s*a?\.?(?:startsWith)?\(?"(--[a-z0-9-]+=?)"/g)].map((m) => m[1]!));
      for (const flag of read) expect(declared).toContain(flag);
      expect(read.size).toBeGreaterThan(3);
    });
  }
});
