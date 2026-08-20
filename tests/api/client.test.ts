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

  // [session 28, CODEXREVIEW #4] REVERSED: a blanket "any 5xx means no
  // active run" conflated a transient server outage with a genuinely idle
  // account, and after a failed action POST could make
  // `postWithVerifiedRetry()` report an action as applied when it never
  // was. A 5xx now retries once and only reads as idle if the retry clears
  // to the authoritative shape; a PERSISTENT 5xx now throws.
  it("retries once on a 5xx, then throws UnexpectedResponseError if it persists — a transient outage must not read as idle", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 500, body: "<html>error</html>" })));
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getDungeonState();
    const assertion = expect(p).rejects.toBeInstanceOf(UnexpectedResponseError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("resolves null when a first 5xx clears on retry to the HTTP-200 idle shape — the historical 'run just ended' pattern", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      mockFetch(() => {
        calls++;
        if (calls === 1) return { status: 500, body: "<html>error</html>" };
        return { status: 200, body: { success: true, actionToken: 0, data: { run: null, entity: null } } };
      }),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getDungeonState();
    const assertion = expect(p).resolves.toBeNull();
    await vi.runAllTimersAsync();
    await assertion;
    expect(calls).toBe(2);
  });

  it("resolves the real run when a first 5xx clears on retry to a genuine run state", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      mockFetch(() => {
        calls++;
        if (calls === 1) return { status: 500, body: "<html>error</html>" };
        return {
          status: 200,
          body: {
            success: true,
            actionToken: 0,
            data: { run: { DUNGEON_ID_CID: 1, players: [], lootPhase: false, pathPhase: false, rewardPathPhase: false, enemyPathPhase: false } },
          },
        };
      }),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getDungeonState();
    const assertion = expect(p).resolves.not.toBeNull();
    await vi.runAllTimersAsync();
    await assertion;
    expect(calls).toBe(2);
  });

  it("also treats HTTP 200 with data.run:null as 'no active run' — the idle-account shape found live in session 08", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({
        status: 200,
        body: { success: true, actionToken: 0, data: { run: null, entity: null } },
      })),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getDungeonState();
    const assertion = expect(p).resolves.toBeNull();
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("does NOT update the tracked actionToken from a getDungeonState() response — session 08, live", async () => {
    // Live finding, Task 6 stage 3: this endpoint's actionToken field is not
    // a fresh token, it reports 0 regardless of the run's real state. A POST
    // /game/dungeon/action response DOES carry a real one; a subsequent
    // getDungeonState() must not clobber it back to 0, or the next action
    // gets sent with a stale token and the server rejects it (HTTP 500,
    // confirmed live).
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({
        status: 200,
        body: {
          success: true,
          actionToken: 0,
          data: { run: { DUNGEON_ID_CID: 1, players: [], lootPhase: false, pathPhase: false, rewardPathPhase: false, enemyPathPhase: false } },
        },
      })),
    );
    const client = new GigaverseClient({ jwt: "test-jwt" });
    // Simulate a prior POST having set a real token.
    (client as unknown as { actionToken: number }).actionToken = 999;
    const p = client.getDungeonState();
    await vi.runAllTimersAsync();
    await p;
    expect(client.getActionToken()).toBe(999);
  });

  it("still fails closed on a 200 that matches neither the run shape nor the null-run idle shape", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 200, body: { success: true, data: {} } })));
    const client = new GigaverseClient({ jwt: "test-jwt" });
    const p = client.getDungeonState();
    const assertion = expect(p).rejects.toBeInstanceOf(UnexpectedResponseError);
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

  /**
   * [session 53, brief §0c] `minGapSinceResponseMs` is measured from the last
   * RESPONSE, not the last request. The distinction is the entire point: the
   * server's outstanding-token window runs from when it answered, and the two
   * clocks differ by one response latency (0.72-1.78 s live). A request-clock
   * gap of 3600ms would have left only ~1.8 s since the response — inside the
   * band where 66 of 66 live path-selection POSTs were rejected.
   */
  describe("minGapSinceResponseMs (session 53)", () => {
    const actionBody = {
      action: "reward_one" as const,
      dungeonId: 5,
      actionToken: "" as const,
      data: { consumables: [], isJuiced: false, index: 0 },
    };

    it("measures the gap from the last RESPONSE, not the last request", async () => {
      const requestAt: number[] = [];
      const responseAt: number[] = [];
      const latency = 1500;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          requestAt.push(Date.now());
          vi.advanceTimersByTime(latency);
          responseAt.push(Date.now());
          return { status: 200, text: async () => JSON.stringify({ success: true, actionToken: 7, data: {} }) } as Response;
        }),
      );
      const client = new GigaverseClient({ jwt: "test-jwt" });

      const p1 = client.postDungeonAction(actionBody, { minGapSinceResponseMs: 4000 });
      await vi.runAllTimersAsync();
      await p1;
      const p2 = client.postDungeonAction(actionBody, { minGapSinceResponseMs: 4000 });
      await vi.runAllTimersAsync();
      await p2;

      expect(requestAt).toHaveLength(2);
      // The guarantee that matters: >= 4000ms since the server answered.
      expect(requestAt[1]! - responseAt[0]!).toBeGreaterThanOrEqual(4000);
      // And therefore strictly more than 4000ms since the last REQUEST — the
      // difference a request-clock setting could not have expressed.
      expect(requestAt[1]! - requestAt[0]!).toBeGreaterThanOrEqual(4000 + latency);
    });

    it("leaves ordinary pacing alone when the override is absent", async () => {
      const requestAt: number[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          requestAt.push(Date.now());
          vi.advanceTimersByTime(1500);
          return { status: 200, text: async () => JSON.stringify({ success: true, actionToken: 7, data: {} }) } as Response;
        }),
      );
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p1 = client.postDungeonAction(actionBody);
      await vi.runAllTimersAsync();
      await p1;
      const p2 = client.postDungeonAction(actionBody);
      await vi.runAllTimersAsync();
      await p2;

      // MIN_GAP_MS + jitter only — the request clock, unchanged from before.
      expect(requestAt[1]! - requestAt[0]!).toBeGreaterThanOrEqual(1200);
      expect(requestAt[1]! - requestAt[0]!).toBeLessThan(4000);
    });

    it("never SHORTENS the ordinary gap when the override is smaller", async () => {
      const requestAt: number[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          requestAt.push(Date.now());
          return { status: 200, text: async () => JSON.stringify({ success: true, actionToken: 7, data: {} }) } as Response;
        }),
      );
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p1 = client.postDungeonAction(actionBody, { minGapSinceResponseMs: 10 });
      await vi.runAllTimersAsync();
      await p1;
      const p2 = client.postDungeonAction(actionBody, { minGapSinceResponseMs: 10 });
      await vi.runAllTimersAsync();
      await p2;
      expect(requestAt[1]! - requestAt[0]!).toBeGreaterThanOrEqual(1200);
    });
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

  describe("redactSecrets", () => {
    // [session 28, CODEXREVIEW #7] Every prior fixture-writing caller passed
    // maskedJwt().split("...")[0] — the truncated 8-char DISPLAY prefix, not
    // the real token — to a redaction function. If a response ever echoed
    // the full token, only 8 characters got replaced. This confirms the real
    // fix: zero characters of a complete token survive redaction.
    it("removes every character of the full token from text that echoes it", () => {
      const jwt = "eyJhbGciOiJIUzI1NiJ9." + "x".repeat(300) + ".signature-part";
      const client = new GigaverseClient({ jwt });
      const echoed = `{"message":"you sent Bearer ${jwt} in your request"}`;
      const redacted = client.redactSecrets(echoed);
      expect(redacted).not.toContain(jwt);
      expect(redacted).toContain("<JWT>");
      // Even a long substring of the token must not survive — a partial
      // redaction (e.g. only the display prefix) would still leave this.
      expect(redacted).not.toContain(jwt.slice(0, 8));
      expect(redacted).not.toContain(jwt.slice(-8));
    });

    it("is a no-op on text that never contained the token", () => {
      const client = new GigaverseClient({ jwt: "test-jwt" });
      expect(client.redactSecrets("nothing secret here")).toBe("nothing secret here");
    });
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

  describe("claimRomEnergy", () => {
    it("sends romId/claimId/amount and returns the bare success envelope", async () => {
      let sent: { url: string; init?: RequestInit } | null = null;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          sent = { url, init };
          return { status: 200, text: async () => JSON.stringify({ success: true }) } as Response;
        }),
      );
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p = client.claimRomEnergy("5345", 12);
      const assertion = expect(p).resolves.toEqual({ success: true });
      await vi.runAllTimersAsync();
      await assertion;

      expect(sent!.url).toContain("/roms/factory-claim");
      expect(JSON.parse(sent!.init!.body as string)).toEqual({ romId: "5345", claimId: "energy", amount: 12 });
    });

    it("defaults amount to 0 when not given — SPEC.md: amount is cosmetic, server determines payout", async () => {
      let sent: { url: string; init?: RequestInit } | null = null;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          sent = { url, init };
          return { status: 200, text: async () => JSON.stringify({ success: true }) } as Response;
        }),
      );
      const client = new GigaverseClient({ jwt: "test-jwt" });
      await client.claimRomEnergy("7959");
      expect(JSON.parse(sent!.init!.body as string)).toEqual({ romId: "7959", claimId: "energy", amount: 0 });
    });

    it("fails closed on a 500, the real failure mode observed live for a not-yet-accrued ROM", async () => {
      vi.stubGlobal("fetch", mockFetch(() => ({ status: 500, body: { error: {} } })));
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p = client.claimRomEnergy("689", 0);
      const assertion = expect(p).rejects.toBeInstanceOf(UnexpectedResponseError);
      await vi.runAllTimersAsync();
      await assertion;
    });
  });

  describe("getRomsPlayer", () => {
    it("hits /roms/player?id=<address> and returns the entities list", async () => {
      let sentUrl: string | null = null;
      const entity = {
        docId: "2696",
        factoryStats: { tier: "Gold", faction: "Overseer", energyCollectable: 540 },
      };
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          sentUrl = url;
          return { status: 200, text: async () => JSON.stringify({ entities: [entity] }) } as Response;
        }),
      );
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p = client.getRomsPlayer("0xUSER");
      const assertion = expect(p).resolves.toEqual({ entities: [entity] });
      await vi.runAllTimersAsync();
      await assertion;

      expect(sentUrl).toContain("/roms/player?id=0xUSER");
    });

    it("fails closed on a 500", async () => {
      vi.stubGlobal("fetch", mockFetch(() => ({ status: 500, body: { error: {} } })));
      const client = new GigaverseClient({ jwt: "test-jwt" });
      const p = client.getRomsPlayer("0xUSER");
      const assertion = expect(p).rejects.toBeInstanceOf(UnexpectedResponseError);
      await vi.runAllTimersAsync();
      await assertion;
    });
  });
});
