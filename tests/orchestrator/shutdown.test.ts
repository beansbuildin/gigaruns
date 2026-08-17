/**
 * tests/orchestrator/shutdown.test.ts — Task 10's graceful-SIGINT decision
 * logic. `installProcessSigintHandler` itself (real `process.on` wiring) is
 * deliberately untested here, same footing as `guards.ts`'s split between
 * pure logic and thin fs/network wiring.
 */

import { describe, expect, it } from "vitest";
import { createShutdownSignal, nextSigintState } from "../../src/orchestrator/shutdown.js";

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
