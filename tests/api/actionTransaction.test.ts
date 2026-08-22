/**
 * tests/api/actionTransaction.test.ts — [session 78, §2 / CODEXAUG22REVIEW H1]
 *
 * The property under test is not "errors are handled". It is that **an error is
 * not evidence that nothing happened**. Session 08 measured `reward_one`
 * returning HTTP 500 twice on a byte-identical request — once with the pick
 * already applied server-side, once without — so the two cases are
 * indistinguishable from the error alone and must be separated by re-reading
 * the server. Everything below is one of those separations.
 *
 * Pure functions and fakes. No network, no filesystem, no data path.
 */

import { describe, expect, it, vi } from "vitest";

import { runActionTransaction } from "../../src/api/actionTransaction.js";
import { TokenExpiredError, RequestTimeoutError } from "../../src/api/errors.js";

/** A minimal authoritative state: a run that exists, or does not. */
interface FakeState {
  runId: string;
  pending: boolean;
}

const base = {
  action: "start_run",
  before: null as FakeState | null,
  didApply: (_b: FakeState | null, a: FakeState | null) => a !== null,
  provesNotApplied: (_b: FakeState | null, a: FakeState | null) => a === null,
};

describe("runActionTransaction", () => {
  it("reports applied with the response on the ordinary success", async () => {
    const out = await runActionTransaction<FakeState, string>({
      ...base,
      send: async () => "ok",
      readState: async () => null,
    });
    expect(out).toEqual({ outcome: "applied", response: "ok" });
  });

  it("does not re-read state on success — reconciliation costs a request", async () => {
    const readState = vi.fn(async () => null);
    await runActionTransaction<FakeState, string>({ ...base, send: async () => "ok", readState });
    expect(readState).not.toHaveBeenCalled();
  });

  describe("applied despite an error — session 08's measured case", () => {
    it("classifies a failed send whose transition IS visible as applied", async () => {
      const out = await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 500");
        },
        readState: async () => ({ runId: "r1", pending: false }),
      });
      expect(out.outcome).toBe("applied");
      // Null response, because the response is exactly what was lost. A caller
      // must handle this — it is not the same as a success.
      expect(out).toMatchObject({ response: null });
    });

    it("COMMITS THE SPEND even though no response came back", async () => {
      // The `start_run` failure this module was built for: the old code threw
      // before `recordRunStarted`/`recordEnergySpent`/`saveGuardBudget`, so the
      // local ledger read zero runs while the server had spent 3 of 12
      // run-units. Silent disagreement about the scarce thing.
      const commitSpend = vi.fn();
      await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 500");
        },
        readState: async () => ({ runId: "r1", pending: false }),
        commitSpend,
      });
      expect(commitSpend).toHaveBeenCalledTimes(1);
    });

    it("hands back the state that proved it, so the caller need not re-read", async () => {
      const after = { runId: "r1", pending: false };
      const out = await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 500");
        },
        readState: async () => after,
      });
      expect(out).toMatchObject({ after });
    });
  });

  describe("definitely not applied", () => {
    it("classifies a failed send the server has no record of as not_applied", async () => {
      const out = await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 400 daily cap reached");
        },
        readState: async () => null,
      });
      expect(out.outcome).toBe("not_applied");
    });

    it("does NOT commit the spend — nothing was spent", async () => {
      const commitSpend = vi.fn();
      await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 400");
        },
        readState: async () => null,
        commitSpend,
      });
      expect(commitSpend).not.toHaveBeenCalled();
    });

    it("carries the original send error, not the reconciliation's view of it", async () => {
      const error = new Error("Player has reached max runs today");
      const out = await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw error;
        },
        readState: async () => null,
      });
      // The server's own reason for refusing is the single most useful thing in
      // a `start_run` rejection (session 46/47) and must survive the protocol.
      expect(out).toMatchObject({ error });
    });
  });

  describe("unknown — the fail-closed branch", () => {
    it("is unknown when the state read itself throws", async () => {
      const out = await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 500");
        },
        readState: async () => {
          throw new Error("repeated 5xx on /game/dungeon/state");
        },
      });
      expect(out.outcome).toBe("unknown");
    });

    it("NEVER commits the spend on unknown — a guess here double-spends", async () => {
      const commitSpend = vi.fn();
      await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 500");
        },
        readState: async () => {
          throw new Error("unreadable");
        },
        commitSpend,
      });
      expect(commitSpend).not.toHaveBeenCalled();
    });

    it("carries the read error too, so a report can say WHY the server was unreadable", async () => {
      const readError = new Error("repeated 5xx");
      const out = await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 500");
        },
        readState: async () => {
          throw readError;
        },
      });
      expect(out).toMatchObject({ outcome: "unknown", readError });
    });

    it("is unknown when the state is READABLE but proves neither thing", async () => {
      // The distinction the two predicates exist for. "I cannot see that it
      // applied" is not "I can see that it did not", and collapsing them is
      // what turns an ambiguous write into a confident wrong answer.
      const out = await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 500");
        },
        readState: async () => ({ runId: "r1", pending: true }),
        didApply: () => false,
        provesNotApplied: () => false,
      });
      expect(out.outcome).toBe("unknown");
      expect(out).toMatchObject({ after: { runId: "r1", pending: true } });
    });

    it("a POST timeout is reconciled, not read as 'did not apply'", async () => {
      // CLAUDE.md rule 13's failure at machine speed: an aborted write may have
      // applied with only the response lost. If it landed, the transaction must
      // say applied — the timeout is not the answer, the server is.
      const out = await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new RequestTimeoutError("POST", "/game/dungeon/action", 10_000);
        },
        readState: async () => ({ runId: "r1", pending: false }),
      });
      expect(out.outcome).toBe("applied");
    });
  });

  describe("exactly-once accounting", () => {
    it("commits once and only once across every applied path", async () => {
      for (const readState of [
        async () => ({ runId: "r1", pending: false }) as FakeState | null,
        async () => null as FakeState | null,
      ]) {
        for (const send of [async () => "ok", async () => { throw new Error("boom"); }]) {
          const commitSpend = vi.fn();
          const out = await runActionTransaction<FakeState, string>({
            ...base,
            send,
            readState,
            commitSpend,
          });
          expect(commitSpend.mock.calls.length).toBe(out.outcome === "applied" ? 1 : 0);
        }
      }
    });

    it("a throwing commitSpend is the CALLER's bug and is not swallowed", async () => {
      // If the ledger write fails, the caller must find out. Catching it here
      // would produce the exact silence this module exists to prevent.
      await expect(
        runActionTransaction<FakeState, string>({
          ...base,
          send: async () => "ok",
          readState: async () => null,
          commitSpend: () => {
            throw new Error("disk full");
          },
        }),
      ).rejects.toThrow("disk full");
    });
  });

  describe("rethrow", () => {
    it("propagates a TokenExpiredError without spending a reconciling read", async () => {
      // The read would be rejected identically, so routing it through would
      // spend a request to turn a precise error into `unknown`.
      const readState = vi.fn(async () => null);
      await expect(
        runActionTransaction<FakeState, string>({
          ...base,
          send: async () => {
            throw new TokenExpiredError(401, '{"error":"Unauthorized"}');
          },
          readState,
          rethrow: (e) => e instanceof TokenExpiredError,
        }),
      ).rejects.toBeInstanceOf(TokenExpiredError);
      expect(readState).not.toHaveBeenCalled();
    });

    it("reconciles anything the predicate does NOT name", async () => {
      const out = await runActionTransaction<FakeState, string>({
        ...base,
        send: async () => {
          throw new Error("HTTP 500");
        },
        readState: async () => ({ runId: "r1", pending: false }),
        rethrow: (e) => e instanceof TokenExpiredError,
      });
      expect(out.outcome).toBe("applied");
    });
  });

  it("logs one line per decision, naming the action", async () => {
    const lines: Record<string, unknown>[] = [];
    await runActionTransaction<FakeState, string>({
      ...base,
      send: async () => {
        throw new Error("HTTP 500");
      },
      readState: async () => ({ runId: "r1", pending: false }),
      log: (e) => lines.push(e),
    });
    expect(lines.map((l) => l.event)).toEqual(["action_failed_reconciling", "action_applied_despite_error"]);
    expect(lines.every((l) => l.action === "start_run")).toBe(true);
  });
});
