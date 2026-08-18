/**
 * scripts/dungeonReport.ts — [session 30] run-visibility reporting, dungeon
 * half. Rebuilds `data/run-reports/dungeon.jsonl` (gitignored, raw per-run
 * records) and `handoff/reports/dungeon-runs.md` (committed) from the FULL
 * fixture corpus every time it runs — deterministic and idempotent, no
 * incremental-append consistency to worry about, same "recap reads the real
 * state" discipline as `STATE.md`.
 *
 * Reuses `computeAttempts()` (`scripts/deathRooms.ts`) for the exact same
 * cross-directory `DUNGEON_ID_CID` grouping and death/room derivation the
 * histogram tool already uses, rather than re-deriving it — see that file's
 * header comment for why the grouping has to cross capture directories.
 *
 * Called both standalone (`npx tsx scripts/dungeonReport.ts`) and from
 * `scripts/orchestrator.ts`'s end-of-session rollup, so the committed
 * markdown reflects a session's real runs without a separate manual step.
 *
 * Usage: npx tsx scripts/dungeonReport.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { computeAttempts } from "./deathRooms.js";
import { loadBotConfig } from "../src/orchestrator/config.js";
import { buildDungeonMarkdown, summarizeDungeonAttempt, type DungeonRunRecord } from "../src/sim/dungeonReport.js";

export const JSONL_PATH = join("data", "run-reports", "dungeon.jsonl");
export const MARKDOWN_PATH = join("handoff", "reports", "dungeon-runs.md");

export function buildRecords(energyCostPerRun: number, corpusRoot?: string): DungeonRunRecord[] {
  return computeAttempts(corpusRoot).map((attempt) => summarizeDungeonAttempt(attempt, energyCostPerRun));
}

export function writeReports(records: DungeonRunRecord[], jsonlPath = JSONL_PATH, markdownPath = MARKDOWN_PATH): void {
  mkdirSync(dirname(jsonlPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(jsonlPath, records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : ""));
  writeFileSync(markdownPath, buildDungeonMarkdown(records));
}

function main(): void {
  const config = loadBotConfig();
  const records = buildRecords(config.energyCostPerRun);
  writeReports(records);
  console.log(`▸ dungeonReport.ts — ${records.length} attempts`);
  console.log(`  written to ${JSONL_PATH} and ${MARKDOWN_PATH}`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("dungeonReport.ts");
if (isMain) main();
