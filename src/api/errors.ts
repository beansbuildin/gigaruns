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
