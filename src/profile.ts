/**
 * src/profile.ts — the one place that knows where anything lives on disk.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The bot is being made runnable by people who are not its author (model A:
 * they run it themselves, on their own machine, with their own credentials —
 * no hosting, no credential custody). Two people cannot share `data/`, `logs/`
 * or a JWT, so every path has to resolve off a profile rather than a literal.
 *
 * Most of the work for this was already paid, for an unrelated reason: sessions
 * 30 and 31 forced every I/O-owning module to take an explicit path parameter
 * after tests kept overwriting the real ledgers. `guardPersistence`,
 * `opponentModelPersistence`, `playCountsPersistence` and the fishing corpus
 * are already parameterised, so this is a wiring change and not a rewrite.
 *
 * ── THE THREE RULES, AND THE THIRD IS THE ONE THAT MATTERS ────────────────
 *
 * 1. **Omitting `--profile` is byte-for-byte today's behaviour** — `data/`,
 *    `logs/`, `fixtures/`, `~/.secrets/gigaverse-jwt.txt`. The author's setup
 *    must not move. `tests/profile.test.ts` pins each default literally rather
 *    than by recomputing it from this module, so a refactor here cannot quietly
 *    redefine "unchanged".
 *
 * 2. **`getJwt()` is a FUNCTION, not a loaded string.** Today it wraps
 *    `loadJwt()` and nothing changes. But tokens genuinely expire
 *    (`TokenExpiredError` exists because they do), and a hosted layer would
 *    need to refresh one mid-run. Making this a provider now costs one
 *    indirection; making it a string now means rewriting every call site when
 *    that day comes.
 *
 * 3. **Nothing below the entry point may call `homedir()` or name a literal
 *    path.** That is the whole invariant and it is testable —
 *    `tests/noHardcodedPaths.test.ts` greps `src/` and `scripts/` and fails on
 *    a hit outside the small allowlist. Same shape as session 54's
 *    `dungeonArmClosed.test.ts`: a test about which code paths EXIST rather
 *    than what they return.
 *
 * ── WHAT IS AND IS NOT PER-PROFILE ────────────────────────────────────────
 *
 * `config/discovered.json` is **game-global**: Forbidden Woods is dungeon 5 for
 * everyone and `maxRoom` is 16 for everyone (confirmed on four dungeons,
 * session 57). It ships, rather than making each person re-run `probe.ts`.
 * `config/bot.json` is per-profile — budgets are personal.
 */

import { homedir } from "node:os";
import { join } from "node:path";

import { DEFAULT_JWT_PATH, loadJwt } from "./api/auth.js";

/** The unnamed profile: the author's own layout, unchanged since session 01. */
export const DEFAULT_PROFILE_NAME = "default";

/** Named profiles live side by side under here. */
export const PROFILES_ROOT = "profiles";

export interface Profile {
  /** `"default"`, or whatever `--profile=<name>` said. */
  name: string;
  /** Ledgers and learned state. `data/` for the default profile. */
  dataRoot: string;
  /** Raw run logs. `logs/` for the default profile. */
  logRoot: string;
  /** Recorded API captures the sim replays. `fixtures/` for the default. */
  fixtureRoot: string;
  /**
   * Where this profile's OWN config lives — `config/bot.json`, the budgets.
   * `config/` for the default profile, `profiles/<name>/config/` otherwise.
   */
  configRoot: string;
  /**
   * `config/discovered.json`, ALWAYS shared and never per-profile.
   *
   * It holds dungeon IDs, energy costs and room counts, which are properties of
   * the GAME rather than of an account: Forbidden Woods is dungeon 5 for
   * everyone and `maxRoom` is 16 for everyone (confirmed on four dungeons,
   * session 57). Making it per-profile would make every additional person
   * re-run `probe.ts` to rediscover facts that cannot differ between them.
   *
   * `bot.json` goes the other way and IS per-profile, because budgets are
   * personal. The split is the whole reason these are two files.
   */
  discoveredPath: string;
  /** The JWT file this profile reads. Exposed for `doctor.ts`'s diagnostics. */
  jwtPath: string;
  /**
   * The session token, fetched at the moment of use.
   *
   * Async and a function on purpose — see rule 2 in the header. Today this is
   * a synchronous file read wrapped in a promise, and that is fine.
   */
  getJwt(): Promise<string>;
}

/**
 * A profile name has to be safe to put in a path. Rejecting rather than
 * sanitising: a name that silently becomes a different directory is how one
 * person's ledger ends up written over another's, and `..` is the obvious way
 * in. Same fail-closed posture as the rest of this repo.
 */
export function assertValidProfileName(name: string): void {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name)) {
    throw new Error(
      `Invalid --profile name ${JSON.stringify(name)}. Use letters, digits, ` +
        `dashes and underscores only, starting with a letter or digit — the name becomes a directory.`,
    );
  }
}

/**
 * Resolve a profile. `undefined` (or `"default"`) gives today's exact layout.
 *
 * `GIGA_PROFILE` is honoured as a fallback so a friend can export it once
 * rather than passing `--profile` to every script; an explicit argument always
 * wins over the environment.
 */
export function resolveProfile(name?: string): Profile {
  const resolved = name ?? process.env.GIGA_PROFILE ?? DEFAULT_PROFILE_NAME;

  if (resolved === DEFAULT_PROFILE_NAME) {
    return {
      name: DEFAULT_PROFILE_NAME,
      dataRoot: "data",
      logRoot: "logs",
      fixtureRoot: "fixtures",
      configRoot: "config",
      discoveredPath: join("config", "discovered.json"),
      jwtPath: DEFAULT_JWT_PATH,
      getJwt: async () => loadJwt(DEFAULT_JWT_PATH),
    };
  }

  assertValidProfileName(resolved);
  const root = join(PROFILES_ROOT, resolved);
  // The JWT stays in ~/.secrets rather than moving under `profiles/`, which is
  // inside the repo: a token in the working tree is one `git add -A` away from
  // being committed, and this repo is public.
  const jwtPath = join(homedir(), ".secrets", `gigaverse-jwt-${resolved}.txt`);

  return {
    name: resolved,
    dataRoot: join(root, "data"),
    logRoot: join(root, "logs"),
    fixtureRoot: join(root, "fixtures"),
    configRoot: join(root, "config"),
    // Shared, not under `root` — see `discoveredPath`'s doc comment.
    discoveredPath: join("config", "discovered.json"),
    jwtPath,
    getJwt: async () => loadJwt(jwtPath),
  };
}

/**
 * `--profile=<name>` out of an argv array, or `undefined`.
 *
 * Parsed here rather than in each entry point so all four agree on the spelling
 * and so a typo like `--profile foo` (space-separated) is caught in one place.
 */
export function profileArg(argv: readonly string[]): string | undefined {
  const eq = argv.find((a) => a.startsWith("--profile="));
  if (eq) return eq.slice("--profile=".length);
  const i = argv.indexOf("--profile");
  if (i >= 0) {
    throw new Error(
      `--profile takes its value with an equals sign: --profile=${argv[i + 1] ?? "<name>"}. ` +
        `Space-separated would be read as a different flag by every script here.`,
    );
  }
  return undefined;
}

// ── path helpers, so callers never re-join a literal ───────────────────────

export const dataPath = (p: Profile, ...parts: string[]): string => join(p.dataRoot, ...parts);
export const logPath = (p: Profile, ...parts: string[]): string => join(p.logRoot, ...parts);
export const fixturePath = (p: Profile, ...parts: string[]): string => join(p.fixtureRoot, ...parts);
export const configPath = (p: Profile, ...parts: string[]): string => join(p.configRoot, ...parts);
