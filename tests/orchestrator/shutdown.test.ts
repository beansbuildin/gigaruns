/**
 * tests/orchestrator/shutdown.test.ts — Task 10's graceful-SIGINT decision
 * logic. `installProcessSigintHandler` itself (real `process.on` wiring) is
 * deliberately untested here, same footing as `guards.ts`'s split between
 * pure logic and thin fs/network wiring.
 */

import { describe, expect, it } from "vitest";
import { createShutdownSignal, installProcessSigintHandler, nextSigintState } from "../../src/orchestrator/shutdown.js";

describe("createShutdownSignal", () => {
  it("starts unrequested", () => {
    expect(createShutdownSignal()).toEqual({ requested: false });
  });
});

describe("nextSigintState", () => {
  it("first press: requested, not a force-exit", () => {
    expect(nextSigintState(1)).toEqual({ requested: true, forceExit: false });
  });

  it("second press: requested AND a force-exit", () => {
    expect(nextSigintState(2)).toEqual({ requested: true, forceExit: true });
  });

  it("third+ press: still a force-exit (never un-forces)", () => {
    expect(nextSigintState(3)).toEqual({ requested: true, forceExit: true });
  });
});

describe("[session 51 §5] installProcessSigintHandler — the real process wiring", () => {
  // This file's header said the real `process.on` wiring is "thin enough not
  // to need its own test". Session 51's §5 dungeon dry-run is the reason that
  // is no longer good enough: the handler is one of three `liveRun.ts`
  // changes that had never met a live run, and a dry run cannot press
  // Ctrl-C. Raising the signal in-process is the closest thing that costs
  // nothing. `forceExit` is NOT exercised here — it calls `process.exit`,
  // which would take the test runner with it; `nextSigintState` covers that
  // decision above.
  it("flips the shared signal on a real SIGINT, and the disposer really unsubscribes", () => {
    const signal = createShutdownSignal();
    const before = process.listenerCount("SIGINT");
    const uninstall = installProcessSigintHandler(signal);
    expect(process.listenerCount("SIGINT")).toBe(before + 1);
    expect(signal.requested).toBe(false);

    process.emit("SIGINT");
    expect(signal.requested).toBe(true);

    uninstall();
    expect(process.listenerCount("SIGINT")).toBe(before);

    // After disposal a second signal must not touch a fresh flag — a leaked
    // listener would keep a stale run's signal alive across invocations.
    const second = createShutdownSignal();
    process.emit("SIGINT");
    expect(second.requested).toBe(false);
  });

  it("is idempotent on the flag — repeated presses keep requesting, never un-request", () => {
    const signal = createShutdownSignal();
    const uninstall = installProcessSigintHandler(signal);
    try {
      process.emit("SIGINT");
      expect(signal.requested).toBe(true);
      // NOT a second emit: press two force-exits by design.
      expect(nextSigintState(2).forceExit).toBe(true);
      expect(nextSigintState(1).forceExit).toBe(false);
    } finally {
      uninstall();
    }
  });
});
