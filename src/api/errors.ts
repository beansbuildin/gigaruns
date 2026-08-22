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

/**
 * [session 78, §1 / CODEXAUG22REVIEW M1] The request outlived its deadline and
 * was aborted. Before this existed there was no deadline at all: `raw()` called
 * `fetch()` with no signal, inside the client's ONE mutex, whose own header says
 * "a second concurrent request can only race it, never help it." So a stalled
 * socket did not slow the bot down — it stopped it permanently, holding the
 * lock, with no guard able to fire. `maxConsecutiveActionFailures` never counts,
 * no `GuardTrip` throws, the process simply never returns. CLAUDE.md §5 says a
 * stopped bot costs nothing; a HUNG bot is not a stopped bot, and this is the
 * error that turns one into the other.
 *
 * `ambiguousWrite` is the field callers must respect. On a GET an abort proves
 * nothing was written and a bounded retry is safe. On a POST it proves nothing
 * at all — the request may have been fully applied server-side with only the
 * response lost, which is the same shape session 08 measured directly
 * (`reward_one` returned HTTP 500 with `pickedBoons` already grown). So a POST
 * timeout is NOT evidence the action did not land, and any caller reading it as
 * "did not apply" repeats CLAUDE.md rule 13's mistake at machine speed. Route it
 * through `runActionTransaction` (src/api/actionTransaction.ts) instead.
 */
export class RequestTimeoutError extends Error {
  /** True for every method except GET — see the class comment. */
  public readonly ambiguousWrite: boolean;

  constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly timeoutMs: number,
  ) {
    super(
      `${method} ${path} exceeded its ${timeoutMs}ms deadline and was aborted` +
        (method === "GET"
          ? " — a GET abort proves nothing was written."
          : " — an aborted write is AMBIGUOUS: it may have applied server-side with only the response lost."),
    );
    this.name = "RequestTimeoutError";
    this.ambiguousWrite = method !== "GET";
  }
}
