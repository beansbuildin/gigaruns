/**
 * src/api/errors.ts — typed failures so the client can fail closed (CLAUDE.md
 * §5) instead of guessing. Every one of these should end a run cleanly, not
 * trigger a retry loop.
 */

/** 401/403 — the JWT is missing, expired, or rejected. Halt, don't retry. */
export class TokenExpiredError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Auth rejected (HTTP ${status}). The JWT is expired or invalid — refresh it.`);
    this.name = "TokenExpiredError";
  }
}

/** 429 exhausted every retry in the backoff schedule. */
export class RateLimitedError extends Error {
  constructor(public readonly attempts: number) {
    super(`Rate limited after ${attempts} attempts with exponential backoff — giving up.`);
    this.name = "RateLimitedError";
  }
}

/**
 * Any other non-2xx, or a 2xx body that failed zod validation. Carries the
 * full body so CLAUDE.md §5 ("log the full response body to logs/") can be
 * honoured by the caller.
 */
export class UnexpectedResponseError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`Unexpected response from ${path}: HTTP ${status}`);
    this.name = "UnexpectedResponseError";
  }
}

/**
 * [session 46, MOVED HERE session 47] The server's OWN message for a failed
 * action, not the transport-level summary.
 *
 * `UnexpectedResponseError.message` is only ever `"Unexpected response from
 * <path>: HTTP <status>"` — the server's actual text (`"Player is already in
 * a game"`, `"...reached max runs..."`, an energy-floor rejection) lives ONLY
 * in `.body`. Two consequences, both found live in session 46 while trying to
 * diagnose a fishing `start_run` HTTP 400:
 *
 *  1. `runOneCast`'s server-cap classifier tested `.message` for
 *     `/reached max runs/i`, a string that can never appear there — so the
 *     branch was dead from the day it was written (session 29). A guard's
 *     condition can name a real fact while reading a field that fact never
 *     appears in.
 *  2. CLAUDE.md §5 requires the full response body in `logs/` on an
 *     unexpected state. Logging `.message` alone did not honour that, and it
 *     is what made session 46's HTTP 400 ambiguous between a stuck doc, a
 *     server cap, and a real energy floor.
 *
 * It lived in `scripts/liveFishing.ts` until session 47, which found the same
 * omission on the DUNGEON side in three places (`start_run rejected`,
 * `dungeon action rejected`, `postWithVerifiedRetry`'s `post_attempt_failed`)
 * — the fishing-only home is what let that happen. It is a property of the
 * error type, so it lives with the error type now.
 *
 * [session 51 §5] `TokenExpiredError` was MISSING here, and the omission is
 * the same one this function exists to fix — one class up. It carries a
 * `.body` exactly like `UnexpectedResponseError` does (the server's own 401/
 * 403 text), and this function dropped it, so every dungeon and fishing call
 * site logged `"Auth rejected (HTTP 401). The JWT is expired or invalid"` and
 * nothing about what the server actually said. That summary is written by
 * THIS repo; the server's reason for rejecting — an expired token, a revoked
 * session, a wrong audience, rate-limited auth — is only in the body, and
 * those want different responses from the user.
 *
 * Found by session 51's §5 dungeon dry-run, by corrupting the JWT and reading
 * what the log would have carried. It is the fourth instance of this repo's
 * recurring shape (SPEC-fishing.md §4): the fix was applied to one class and
 * the sibling with the identical field was never re-scored.
 *
 * Falls back to `.message` for any error carrying no server body (a network
 * failure, an abort), so callers can use it unconditionally.
 */
export function serverErrorDetail(e: unknown): { message: string; body?: string } {
  if (e instanceof UnexpectedResponseError || e instanceof TokenExpiredError) {
    return { message: `${e.message} — ${e.body}`, body: e.body };
  }
  return { message: (e as Error).message };
}
