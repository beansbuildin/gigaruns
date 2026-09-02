/**
 * scripts/regenerateReports.ts — [session 31] shared "regenerate both
 * committed run-visibility reports, non-fatally" step.
 *
 * Session 30 wired report regeneration into `scripts/orchestrator.ts`'s
 * end-of-session rollup only. Task 6/9's standalone `liveRun.ts`/
 * `liveFishing.ts` invocations didn't trigger it, so a non-orchestrator
 * session left `handoff/reports/*.md` stale until someone remembered to run
 * `dungeonReport.ts`/`fishingReport.ts` by hand — automation is cheap here
 * and a stale committed report is worse than a redundant regeneration
 * (session 30's open question 4). Extracted into one place so all three
 * call sites (`orchestrator.ts`, `liveRun.ts`, `liveFishing.ts`) share the
 * exact same non-fatal-on-failure behavior instead of drifting apart.
 *
 * [session 117, OFFLINE] A third report joins the other two:
 * `lossDecompositionReport.ts`'s terminal-reason breakdown
 * (`scripts/lossDecomposition.ts`, session 48, had been a console-only
 * diagnostic nobody re-ran between sessions — see `handoff/DECISIONS.md`,
 * 2026-09-02). Same non-fatal-as-a-whole behavior as the other two: this
 * function still never throws, so a failure in any one report does not
 * turn an otherwise-clean run/cast/session into a non-zero exit.
 */

import { buildRecords as buildDungeonRecords, writeReports as writeDungeonReports } from "./dungeonReport.js";
import { buildRecords as buildFishingRecords, writeReports as writeFishingReports } from "./fishingReport.js";
import { buildRecords as buildLossDecompositionRecords, writeReports as writeLossDecompositionReports } from "./lossDecompositionReport.js";
import type { BotConfig } from "../src/orchestrator/config.js";

/**
 * Rebuilds all three reports from the full fixture corpus. Never throws — a
 * report-generation failure shouldn't turn an otherwise-clean run/cast/
 * session into a non-zero exit, same reasoning as every other diagnostic
 * step in this project's live loops.
 */
export function regenerateRunReports(config: BotConfig, log: (line: string) => void = console.log): void {
  try {
    const dungeonRecords = buildDungeonRecords(config.energyCostPerRun);
    writeDungeonReports(dungeonRecords);
    const fishingRecords = buildFishingRecords();
    writeFishingReports(fishingRecords);
    const lossDecompositionRecords = buildLossDecompositionRecords();
    writeLossDecompositionReports(lossDecompositionRecords);
    log(
      `  ▸ run reports regenerated: ${dungeonRecords.length} dungeon attempts, ${fishingRecords.length} fishing casts, ` +
        `${lossDecompositionRecords.length} loss-decomposition casts.\n`,
    );
  } catch (e) {
    log(`  ✗ run-report regeneration failed (non-fatal): ${e instanceof Error ? e.message : e}\n`);
  }
}
