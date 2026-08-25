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

// ─── [session 95 §E] scripts/claimRoms.ts — the third script to need this ───
//
// Session 94 ran `npx tsx scripts/claimRoms.ts --dry-run` expecting a preview.
// The file had NO argument parsing at all, so the flag was silently ignored and
// the real claim went through (4 ROMs, energy 156 -> 315). Harmless in itself —
// a claim is an energy gain — but "accepts a flag it does not implement" is the
// session-80 defect exactly, one script over, and the next person to trust a
// --dry-run here might be pointing it at something that spends.
//
// Same source-assertion construction as the block above, and for the same
// reason: this file must NOT be imported, because importing it runs `main()`
// and would make a REAL claim from the test suite. That is also why the
// dry-run behaviour below is pinned by reading the source rather than by
// executing it.
describe("scripts/claimRoms.ts wires the guard in and implements --dry-run for real", () => {
  const src = readFileSync("scripts/claimRoms.ts", "utf8");

  it("calls rejectUnknownArgs as main()'s first statement", () => {
    expect(src).toContain('import { rejectUnknownArgs } from "./lib/cliArgs.js";');
    expect(src).toMatch(
      /async function main\(\) \{\n\s*rejectUnknownArgs\(process\.argv\.slice\(2\), KNOWN_ARGS, USAGE\);/,
    );
  });

  it("declares every flag it reads", () => {
    // KNOWN_ARGS is a one-liner here, unlike the multi-line lists in the two
    // spending scripts, so the declaration is read off that line rather than
    // off indented array entries.
    const knownLine = /const KNOWN_ARGS = \[([^\]]*)\]/.exec(src)?.[1] ?? "";
    const declared = new Set([...knownLine.matchAll(/"(--[a-z0-9-]+=?)"/g)].map((m) => m[1]!));
    const read = new Set([...src.matchAll(/argv\.(?:includes|find)\(\s*\(?a?\)?\s*=?>?\s*a?\.?(?:startsWith)?\(?"(--[a-z0-9-]+=?)"/g)].map((m) => m[1]!));
    expect(read.size).toBeGreaterThan(0);
    for (const flag of read) expect(declared).toContain(flag);
  });

  it("--dry-run guards the claim call itself, not just the logging", () => {
    // The specific regression: a `--dry-run` that prints "DRY RUN" and then
    // claims anyway is worse than no flag at all. `claimRomEnergy` must sit
    // behind the dryRun branch's `continue`.
    // `.indexOf` would land in the docblock, which names the endpoint too —
    // match the actual awaited CALL.
    const claimIdx = src.indexOf("await client.claimRomEnergy(");
    const guardIdx = src.indexOf("if (dryRun) {");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeGreaterThan(guardIdx);
    expect(src.slice(guardIdx, claimIdx)).toContain("continue;");
  });

  it("classifyArgs accepts --dry-run and refuses the near-misses", () => {
    const KNOWN_CLAIM = ["--dry-run"] as const;
    expect(classifyArgs(["--dry-run"], KNOWN_CLAIM).unknown).toEqual([]);
    expect(classifyArgs([], KNOWN_CLAIM).unknown).toEqual([]);
    expect(classifyArgs(["--dryrun"], KNOWN_CLAIM).unknown).toEqual(["--dryrun"]);
    expect(classifyArgs(["--dry_run"], KNOWN_CLAIM).unknown).toEqual(["--dry_run"]);
    // The shape session 94 would have hit next: a plausible flag this script
    // has never implemented.
    expect(classifyArgs(["--limit=2"], KNOWN_CLAIM).unknown).toEqual(["--limit=2"]);
  });
});
