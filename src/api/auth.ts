/**
 * src/api/auth.ts — JWT loading. SPEC §1a.
 *
 * **There is exactly one auth path and it involves no key and no signing.**
 * The account is an Abstract Global Wallet, which exposes no user-held EOA
 * private key; SPEC's old "Path B (bot-owned EOA, `AUTH_MODE=eoa`)" was DELETED
 * on 2026-08-20 (CLAUDE.md rule 3) rather than left as future work, because it
 * described a wallet model that does not apply and because a bot that reads a
 * private key cannot make the one promise this repo can otherwise make: **it
 * asks for a session token, not custody of a wallet.** Do not add a signer here.
 *
 * [session 59] Path resolution moved behind `src/profile.ts`. `loadJwt()` with
 * no argument is byte-for-byte the old behaviour — `~/.secrets/gigaverse-jwt.txt`
 * — so nothing an existing caller does changes.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The author's own JWT location, and the default for the unnamed profile.
 *
 * This is the ONE `homedir()` call the source-level path test
 * (`tests/noHardcodedPaths.test.ts`) allows outside `src/profile.ts`, because
 * the default has to be written down somewhere and this module is where a
 * reader looks for it.
 */
export const DEFAULT_JWT_PATH = join(homedir(), ".secrets", "gigaverse-jwt.txt");

/** Never print more than this — CLAUDE.md §3. */
export const mask = (t: string): string => `${t.slice(0, 8)}...(${t.length} chars)`;

export class MissingJwtError extends Error {
  constructor(path: string = DEFAULT_JWT_PATH) {
    super(
      `No JWT at ${path}\n` +
        "Log into gigaverse.io, DevTools > Network, play one action, copy the\n" +
        "Authorization: Bearer <token> value into that file.",
    );
    this.name = "MissingJwtError";
  }
}

/**
 * Read the JWT from `path`, defaulting to the author's own location.
 *
 * Throws `MissingJwtError` naming the path it actually looked at — with
 * profiles in play, "no JWT" is only actionable if it says WHICH file was
 * missing.
 */
export function loadJwt(path: string = DEFAULT_JWT_PATH): string {
  if (!existsSync(path)) throw new MissingJwtError(path);
  const jwt = readFileSync(path, "utf8").trim();
  if (!jwt) throw new MissingJwtError(path);
  return jwt;
}
