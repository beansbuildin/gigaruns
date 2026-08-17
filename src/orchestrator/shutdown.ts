/**
 * src/orchestrator/shutdown.ts — Task 10: "graceful SIGINT (finish the
 * current action, never abandon a run mid-turn)".
 *
 * Split in two, same discipline as `guards.ts`: the decision logic
 * (`nextSigintState`) is pure and unit-testable without ever sending a real
 * OS signal; only `installProcessSigintHandler` touches `process` directly,
 * and it's thin enough not to need its own test.
 *
 * A single flag object (`ShutdownSignal`) is threaded into `runOnce`/
 * `runOneCast` via their deps. Both check it at the top of their per-turn
 * loop, AFTER reading state but BEFORE sending the next action — the
 * in-flight turn always finishes; only the *next* one is skipped. A second
 * SIGINT (the user asking twice) forces an immediate exit rather than
 * waiting out a long sleep or a stuck network call.
 */

export interface ShutdownSignal {
  requested: boolean;
}

export function createShutdownSignal(): ShutdownSignal {
  return { requested: false };
}

/**
 * Pure decision for one SIGINT press, given how many have landed so far
 * (including this one). Returns what to do — the caller performs the actual
 * `process.exit`, this function never does.
 */
export function nextSigintState(pressCount: number): { requested: true; forceExit: boolean } {
  return { requested: true, forceExit: pressCount >= 2 };
}

/**
 * Wires `nextSigintState` to real `process.on("SIGINT", ...)`. Returns a
 * disposer so a caller (or a test that stubs `process`) can remove the
 * listener. `forceExitCode` matches the conventional 128+SIGINT(2) code.
 */
export function installProcessSigintHandler(signal: ShutdownSignal, forceExitCode = 130): () => void {
  let presses = 0;
  const handler = () => {
    presses++;
    const next = nextSigintState(presses);
    signal.requested = next.requested;
    if (next.forceExit) {
      console.log("\n▸ second SIGINT — forcing immediate exit.");
      process.exit(forceExitCode);
    } else {
      console.log("\n▸ SIGINT received — finishing the current action, then stopping (press again to force-exit).");
    }
  };
  process.on("SIGINT", handler);
  return () => process.off("SIGINT", handler);
}
