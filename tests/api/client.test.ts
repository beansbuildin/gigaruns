/**
 * tests/api/client.test.ts — the client's disciplines (rate limit, mutex,
 * 429 backoff, fail-closed validation), exercised against a mocked `fetch`.
 * Never touches the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GigaverseClient } from "../../src/api/client.js";
import { TokenExpiredError, UnexpectedResponseError, RateLimitedError } from "../../src/api/errors.js";

const okMe = { address: "0xabc", canEnterGame: true };

function mockFetch(handler: (url: string) => { status: number; body: unknown }) {
  return vi.fn(async (url: string) => {
    const { status, body } = handler(url);
    return {
      status,
      text: async () => JSON.stringify(body),
    } as Response;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GigaverseClient", () => {
  it("returns typed data for a valid response", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 200, body: okMe })));
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getMe();
    const assertion = expect(p).resolves.toEqual(okMe);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("throws TokenExpiredError on 401, not a generic error", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 401, body: { error: "bad token" } })));
    const client = new GigaverseClient({ jwt: "bad" });
    const p = client.getMe();
    const assertion = expect(p).rejects.toBeInstanceOf(TokenExpiredError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("throws TokenExpiredError on 403 too", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 403, body: {} })));
    const client = new GigaverseClient({ jwt: "bad" });
    const p = client.getMe();
    const assertion = expect(p).rejects.toBeInstanceOf(TokenExpiredError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("fails closed on a body that doesn't match the schema", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 200, body: { unexpected: "shape" } })));
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getMe();
    const assertion = expect(p).rejects.toBeInstanceOf(UnexpectedResponseError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("treats a 5xx on /game/dungeon/state as 'no active run', not a throw", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 500, body: "<html>error</html>" })));
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getDungeonState();
    const assertion = expect(p).resolves.toBeNull();
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("throws on a 5xx from any OTHER endpoint — no blanket swallow", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 500, body: "oops" })));
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getMe();
    const assertion = expect(p).rejects.toBeInstanceOf(UnexpectedResponseError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("retries a 429 with backoff, then succeeds", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      mockFetch(() => {
        calls++;
        return calls === 1 ? { status: 429, body: {} } : { status: 200, body: okMe };
      }),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getMe();
    const assertion = expect(p).resolves.toEqual(okMe);
    await vi.runAllTimersAsync();
    await assertion;
    expect(calls).toBe(2);
  });

  it("gives up after MAX_429_RETRIES with RateLimitedError", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 429, body: {} })));
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getMe();
    const assertion = expect(p).rejects.toBeInstanceOf(RateLimitedError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("enforces a minimum gap between requests (rate limiter)", async () => {
    const calledAt: number[] = [];
    vi.stubGlobal(
      "fetch",
      mockFetch(() => {
        calledAt.push(Date.now());
        return { status: 200, body: okMe };
      }),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p1 = client.getMe();
    await vi.runAllTimersAsync();
    await p1;
    const p2 = client.getMe();
    await vi.runAllTimersAsync();
    await p2;

    expect(calledAt).toHaveLength(2);
    expect(calledAt[1]! - calledAt[0]!).toBeGreaterThanOrEqual(1200);
  });

  it("serializes concurrent calls through the mutex — never two in flight", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 10));
        inFlight--;
        return { status: 200, text: async () => JSON.stringify(okMe) } as Response;
      }),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p1 = client.getMe();
    const p2 = client.getMe();
    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);
    expect(maxInFlight).toBe(1);
  });

  it("never logs the full JWT, even in a masked-string helper", async () => {
    const jwt = "a".repeat(500);
    const client = new GigaverseClient({ jwt });
    expect(client.maskedJwt()).not.toContain(jwt);
    expect(client.maskedJwt().length).toBeLessThan(50);
  });

  describe("postDungeonAction", () => {
    const startRunBody = {
      action: "start_run" as const,
      dungeonId: 5,
      actionToken: 0,
      data: { consumables: [], isJuiced: false, index: 0 },
    };

    it("sends the body as-is and returns the validated response", async () => {
      let sent: { url: string; init?: RequestInit } | null = null;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          sent = { url, init };
          return {
            status: 200,
            text: async () => JSON.stringify({ success: true, actionToken: 1, data: {} }),
          } as Response;
        }),
      );
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p = client.postDungeonAction(startRunBody);
      const assertion = expect(p).resolves.toEqual({ success: true, actionToken: 1, data: {} });
      await vi.runAllTimersAsync();
      await assertion;

      expect(sent!.url).toContain("/game/dungeon/action");
      expect(sent!.init!.method).toBe("POST");
      expect(JSON.parse(sent!.init!.body as string)).toEqual(startRunBody);
    });

    it("updates the tracked actionToken from the response, same discipline as GET", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(() => ({ status: 200, body: { success: true, actionToken: 42, data: {} } })),
      );
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p = client.postDungeonAction(startRunBody);
      await vi.runAllTimersAsync();
      await p;
      expect(client.getActionToken()).toBe(42);
    });

    it("throws TokenExpiredError on 401, not a crash or a retry", async () => {
      vi.stubGlobal("fetch", mockFetch(() => ({ status: 401, body: { error: "bad token" } })));
      const client = new GigaverseClient({ jwt: "bad" });
      const p = client.postDungeonAction(startRunBody);
      const assertion = expect(p).rejects.toBeInstanceOf(TokenExpiredError);
      await vi.runAllTimersAsync();
      await assertion;
    });

    it("fails closed on a response body that doesn't match the schema", async () => {
      vi.stubGlobal("fetch", mockFetch(() => ({ status: 200, body: { totally: "wrong shape" } })));
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p = client.postDungeonAction(startRunBody);
      const assertion = expect(p).rejects.toBeInstanceOf(UnexpectedResponseError);
      await vi.runAllTimersAsync();
      await assertion;
    });

    it("goes through the same mutex as GETs — never races a GET in flight", async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((r) => setTimeout(r, 10));
          inFlight--;
          const body = url.includes("/game/dungeon/action")
            ? { success: true, actionToken: 1, data: {} }
            : okMe;
          return { status: 200, text: async () => JSON.stringify(body) } as Response;
        }),
      );
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p1 = client.getMe();
      const p2 = client.postDungeonAction(startRunBody);
      await vi.runAllTimersAsync();
      await Promise.all([p1, p2]);
      expect(maxInFlight).toBe(1);
    });
  });
});
