/**
 * tests/helpers/liveFishingDeps.ts — [session 45] the ONE place
 * `LiveFishingDeps` may be constructed in tests.
 *
 * This factory started life inside `tests/liveFishing.test.ts` (session 40)
 * to make every isolated I/O path a REQUIRED argument, so a new path field
 * added to `LiveFishingDeps` fails to typecheck at the call site instead of
 * silently defaulting to a real `data/` file three sessions later. It worked —
 * exactly as designed — for that file.
 *
 * It did not cover `tests/sim/fishingCorpus.test.ts`, which builds its deps as
 * a raw object literal. Session 45 added `ringPredictionLogPath`, the type
 * guard flagged all six call sites in `liveFishing.test.ts`, and the seventh —
 * the literal — sailed through and wrote its synthetic docIds `9001`/`9002`
 * into the real `data/ringPrediction.jsonl` on every test run. That is the
 * FOURTH occurrence of this bug class (session 30's fixture pollution, session
 * 31's `guard-budget.json` leak, session 39's `nextPositionValidation.jsonl`,
 * now this), and the third one to be found by accident rather than by a
 * reviewer applying CLAUDE.md's rule.
 *
 * So the factory moved here and BOTH files import it. A guard that only covers
 * one file is not a guard; it is a guard-shaped comment.
 */

import type { LiveFishingDeps } from "../../scripts/liveFishing.js";

/** Every I/O path `runOneCast` can write to. `Required`, so omitting one is a compile error, not a silent fallback to a real `data/` file. */
export type LiveFishingIsolatedPaths = Required<
  Pick<
    LiveFishingDeps,
    "transitionsPath" | "guardStatePath" | "nextPositionLogPath" | "ringPredictionLogPath" | "logsDir"
  >
>;

export function makeLiveFishingDeps(
  overrides: Omit<
    LiveFishingDeps,
    | "transitionsPath"
    | "guardStatePath"
    | "nextPositionLogPath"
    | "ringPredictionLogPath"
    | "logsDir"
    | "fixtures"
    | "log"
    | "address"
    | "dryRun"
  > &
    LiveFishingIsolatedPaths &
    Partial<Pick<LiveFishingDeps, "fixtures" | "log" | "address" | "dryRun">>,
): LiveFishingDeps {
  return {
    address: "0xUSER",
    dryRun: false,
    fixtures: { write: () => {}, dir: "test-fixtures" } as unknown as LiveFishingDeps["fixtures"],
    log: { write: () => {}, filePath: "test.jsonl" } as unknown as LiveFishingDeps["log"],
    ...overrides,
  };
}
