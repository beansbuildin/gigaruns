/**
 * web/server/src/parentRepo.ts — the ONLY file in this server that reaches
 * across the repo boundary into the bot's own `src/`.
 *
 * Deliberately narrow: this re-exports `src/profile.ts` and
 * `src/api/auth.ts` only. Both are small, dependency-light modules (node
 * built-ins only) that own the profile/path/JWT conventions the CLI already
 * uses — importing them directly means this web UI can never drift from
 * those conventions, the same way a second `terminalReason` implementation
 * would drift from the first (see `handoff/DECISIONS.md`, session 117).
 *
 * Everything else this server needs from the bot (running an actual
 * dungeon/fishing session, the doctor preflight, config validation) is
 * NOT imported here — it is invoked by spawning the existing, already-
 * tested CLI scripts as child processes (see `jobManager.ts`). That is a
 * deliberate choice, not a shortcut: those scripts pull in the full
 * strategy/sim dependency graph (hundreds of KB across dozens of files),
 * and importing that into a thin HTTP server would mean either duplicating
 * validation logic here (a second place for it to drift from the CLI) or
 * carrying that entire graph into the server's own process for no reason —
 * every game DECISION should be made by the one code path that is tested
 * against the real corpus, not a second one reachable only from a browser.
 */

export {
  resolveProfile,
  profileArg,
  assertValidProfileName,
  configPath,
  dataPath,
  PROFILES_ROOT,
  DEFAULT_PROFILE_NAME,
  type Profile,
} from "../../../src/profile.js";

export { mask, DEFAULT_JWT_PATH } from "../../../src/api/auth.js";
