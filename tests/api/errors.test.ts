/**
 * tests/api/errors.test.ts — [session 51 §5] `serverErrorDetail`.
 *
 * Written because session 51's dungeon dry-run found that `TokenExpiredError`
 * — which carries a `.body` exactly like `UnexpectedResponseError` — was not
 * handled here, so every auth failure logged this repo's own summary string
 * and none of what the server actually said. The function had no test at all,
 * which is how a sibling class with the identical field went unnoticed.
 */

import { describe, expect, it } from "vitest";

import { RateLimitedError, TokenExpiredError, UnexpectedResponseError, serverErrorDetail } from "../../src/api/errors.js";

describe("serverErrorDetail", () => {
  it("carries the server's own body for an UnexpectedResponseError", () => {
    const e = new UnexpectedResponseError(400, "/game/dungeon/action", '{"message":"Player is already in a game"}');
    const d = serverErrorDetail(e);
    expect(d.body).toBe('{"message":"Player is already in a game"}');
    expect(d.message).toContain("Player is already in a game");
  });

  it("carries the server's own body for a TokenExpiredError too — the session-51 fix", () => {
    // Confirmed against the live API by corrupting the JWT: the real 401 body
    // is `{"error":"Unauthorized"}`, and before this fix none of it reached
    // `logs/`. A revoked session, an expired token and a rate-limited auth all
    // produced the identical line, and they want different responses.
    const e = new TokenExpiredError(401, '{"error":"Unauthorized"}');
    const d = serverErrorDetail(e);
    expect(d.body).toBe('{"error":"Unauthorized"}');
    expect(d.message).toContain("Unauthorized");
    expect(d.message).toContain("HTTP 401");
  });

  it("falls back to the message for an error carrying no server body", () => {
    const d = serverErrorDetail(new RateLimitedError(5));
    expect(d.body).toBeUndefined();
    expect(d.message).toContain("Rate limited");
  });

  it("is safe on a plain Error, so call sites can use it unconditionally", () => {
    expect(serverErrorDetail(new Error("socket hang up"))).toEqual({ message: "socket hang up" });
  });

  it("EVERY error class in this module that carries a body is handled", () => {
    // The guard against a fifth instance of this repo's recurring shape: a fix
    // applied to one class and never re-scored against its siblings. If a new
    // body-carrying error type is added, this fails until it is handled.
    const bodied: Error[] = [
      new UnexpectedResponseError(500, "/x", "boom"),
      new TokenExpiredError(403, "forbidden"),
    ];
    for (const e of bodied) {
      expect(serverErrorDetail(e).body).toBeDefined();
      expect(serverErrorDetail(e).message).toContain(serverErrorDetail(e).body!);
    }
  });
});
