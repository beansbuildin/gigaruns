/**
 * src/api/auth.ts — Path A (browser JWT) loading. SPEC §1a.
 *
 * Path B (bot-owned EOA) is deferred until `AUTH_MODE=eoa` per SPEC — this
 * module only implements the recommended starting path.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SECRETS = join(homedir(), ".secrets");
const JWT_PATH = join(SECRETS, "gigaverse-jwt.txt");

/** Never print more than this — CLAUDE.md §3. */
export const mask = (t: string): string => `${t.slice(0, 8)}...(${t.length} chars)`;

export class MissingJwtError extends Error {
  constructor() {
    super(
      `No JWT at ${JWT_PATH}\n` +
        "Log into gigaverse.io, DevTools > Network, play one action, copy the\n" +
        "Authorization: Bearer <token> value into that file.",
    );
    this.name = "MissingJwtError";
  }
}

export function loadJwt(): string {
  if (!existsSync(JWT_PATH)) throw new MissingJwtError();
  const jwt = readFileSync(JWT_PATH, "utf8").trim();
  if (!jwt) throw new MissingJwtError();
  return jwt;
}
