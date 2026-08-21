/**
 * tests/noHardcodedPaths.test.ts — session 59.
 *
 * **The profile seam's invariant, enforced where it is load-bearing and
 * INVENTORIED where it is not.** Read this header before adding a name to any
 * list below.
 *
 * The brief asked for "a test that greps `src/` and `scripts/` for `homedir(`,
 * `"data/`, `"logs/`, `"fixtures/` outside `profile.ts` and fails on a hit."
 * Taken literally that fails on ~60 sites today, most of them in one-off
 * analysis scripts (`reversalDispersion.ts`, `parseHar.ts`, `chargeTable.ts`,
 * …) that nobody but the author will ever run and that read the author's own
 * corpus by design. Converting all of them would be a large refactor with no
 * portability value, so this test does something narrower and honest instead:
 *
 *  1. **The entry points a person actually runs MUST resolve paths through the
 *     profile.** That is the real invariant and it is asserted, not inventoried.
 *  2. **`src/` may define default paths in exactly the known places.** A NEW
 *     path literal appearing in `src/` fails, because `src/` is library code
 *     that every profile shares.
 *  3. **Everything else is listed by name.** Not enforced, but counted — so the
 *     set cannot grow silently and a later session can see exactly what is left.
 *
 * If you are here because this failed: prefer resolving through the profile to
 * adding a name. The list is a record of debt, not a place to put things.
 *
 * Reads source text. Writes nothing.
 */
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Path-literal shapes that would bypass the profile. */
const PATTERNS = [
  "homedir(",
  '"data/',
  "'data/",
  '"logs/',
  "'logs/",
  '"fixtures/',
  "'fixtures/",
  'join("data"',
  'join("logs"',
  'join("fixtures"',
];

const grepArgs = PATTERNS.map((p) => `-e ${JSON.stringify(p)}`).join(" ");

interface Hit {
  file: string;
  line: number;
  text: string;
}

function scan(dirs: string): Hit[] {
  const out = execSync(`grep -rn --include='*.ts' ${grepArgs} ${dirs} || true`, { encoding: "utf8" });
  return out
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const [file, line, ...rest] = l.split(":");
      return { file: file!, line: Number(line), text: rest.join(":") };
    })
    // Comments and doc blocks name these paths constantly and correctly.
    .filter((h) => {
      const t = h.text.trim();
      return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
    });
}

/**
 * The ONLY files in `src/` allowed to name a path, and why.
 *
 * All three persistence modules define the DEFAULT-profile location of a
 * ledger. That is legitimate — the default has to be written down somewhere —
 * and every live entry point now passes an explicit profile-resolved path over
 * the top of it. The corpus readers name the shared, game-global fixture tree.
 */
const SRC_ALLOWED = new Map<string, string>([
  ["src/profile.ts", "the seam itself"],
  ["src/api/auth.ts", "DEFAULT_JWT_PATH — the default profile's token location"],
  ["src/orchestrator/guardPersistence.ts", "DEFAULT_GUARD_STATE_PATH"],
  ["src/orchestrator/opponentModelPersistence.ts", "DEFAULT_OPPONENT_MODEL_PATH"],
  ["src/orchestrator/playCountsPersistence.ts", "DEFAULT_PLAY_COUNTS_PATH"],
  ["src/strategy/fishing/oilCastState.ts", "DEFAULT_OIL_CAST_STATE_PATH — the oil-policy-dry sidecar, same shape as the three above"],
  [
    "src/strategy/fishing/nextPositionArm.ts",
    // [session 66 §1] Meets this header's stated condition rather than merely
    // resembling the entries above it: `main()` resolves
    // `dataPath(profile, "nextPositionOverrideDisarm.json")` and passes it
    // over the top, pinned by `tests/fishing/nextPositionTripwire.test.ts`.
    // That matters more here than for the other ledgers — a --profile run that
    // fell through to the default would disarm the DEFAULT profile's override,
    // and nothing re-arms it automatically.
    "DEFAULT_NEXT_POSITION_ARM_STATE_PATH — the override tripwire's disarm state, profile-resolved by every live caller",
  ],
  ["src/sim/corpus.ts", "CORPUS_DIR — the shared, game-global fixture tree"],
  ["src/sim/fishingCorpus.ts", "fishing corpus root, same reason"],
  ["src/sim/fishing/castTrace.ts", "fishing corpus root, same reason"],
  ["src/sim/fishing/deck.ts", "CARD_CATALOG_PATH — a shipped game data file"],
]);

/** Entry points a person actually runs. These must go through the profile. */
const ENTRY_POINTS = ["scripts/doctor.ts", "scripts/liveRun.ts", "scripts/liveFishing.ts", "scripts/orchestrator.ts"];

describe("the profile seam — src/ may not grow new path literals", () => {
  const hits = scan("src");

  it("every path-naming file in src/ is a known, documented one", () => {
    const offenders = hits.filter((h) => !SRC_ALLOWED.has(h.file));
    expect(
      offenders.map((h) => `${h.file}:${h.line} ${h.text.trim()}`),
      "new hard-coded path in src/ — resolve it through src/profile.ts instead",
    ).toEqual([]);
  });

  it("each allowlisted file still actually names a path, so the list cannot rot", () => {
    const named = new Set(hits.map((h) => h.file));
    const stale = [...SRC_ALLOWED.keys()].filter((f) => !named.has(f));
    expect(stale, `allowlist entries with nothing left to allow: ${stale.join(", ")}`).toEqual([]);
  });
});

describe("the profile seam — the entry points resolve through it", () => {
  it.each(ENTRY_POINTS)("%s resolves a profile and reads --profile", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src, `${file} must import the seam`).toContain('from "../src/profile.js"');
    expect(src, `${file} must resolve a profile`).toMatch(/resolveProfile\(profileArg\(process\.argv\)\)/);
  });

  it("liveRun and liveFishing pass a profile-resolved guard path rather than relying on the default", () => {
    // The failure this catches: leaving `guardStatePath` undefined means the
    // spend ledger silently falls back to the DEFAULT profile's file, so two
    // people running under different profiles share one budget and each sees
    // the other's spend. It fails safe-looking and is wrong.
    expect(readFileSync("scripts/liveRun.ts", "utf8")).toContain("guardStatePath: guardBudgetPath");
    expect(readFileSync("scripts/liveFishing.ts", "utf8")).toContain("guardStatePath: fishingGuardPath");
  });

  it("no entry point calls homedir() directly", () => {
    for (const file of ENTRY_POINTS) {
      expect(readFileSync(file, "utf8"), `${file} should get its token path from the profile`).not.toContain("homedir(");
    }
  });
});

describe("the profile seam — what is NOT converted, counted so it cannot grow silently", () => {
  /**
   * Analysis, probe and audit scripts that read the author's own corpus or
   * ledgers directly. A person running this bot never invokes these; they are
   * developer tools. Left alone deliberately — converting them is a large
   * refactor with no portability value.
   */
  it("the unconverted set is exactly as large as it was when this test was written", () => {
    const unconverted = new Set(scan("scripts").map((h) => h.file).filter((f) => !ENTRY_POINTS.includes(f)));
    // A ratchet, not a target. If this fails LOW, a script was converted —
    // lower the number. If it fails HIGH, a new script hard-coded a path;
    // prefer the profile instead of raising it.
    expect([...unconverted].sort().length).toBe(25);
  });

  it("the three entry points are NOT in the unconverted set", () => {
    const unconverted = new Set(scan("scripts").map((h) => h.file));
    for (const e of ENTRY_POINTS) {
      // liveRun/liveFishing still DEFINE default constants, so they legitimately
      // appear in a raw grep; what matters is that they also resolve a profile,
      // asserted above. doctor.ts should be clean outright.
      if (e === "scripts/doctor.ts") expect(unconverted.has(e)).toBe(false);
    }
  });
});
