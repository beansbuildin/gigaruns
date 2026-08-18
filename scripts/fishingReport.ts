/**
 * scripts/fishingReport.ts — [session 30] run-visibility reporting, fishing
 * half. Same rebuild-from-source-of-truth discipline as
 * `scripts/dungeonReport.ts`: rewrites `data/run-reports/fishing.jsonl`
 * (gitignored) and `handoff/reports/fishing-casts.md` (committed) from the
 * full fixture corpus every run, via `loadFishingCorpus()` (session 28) —
 * no cast-grouping logic duplicated here.
 *
 * Usage: npx tsx scripts/fishingReport.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { loadFishingCorpus } from "../src/sim/fishingCorpus.js";
import { buildFishingMarkdown, summarizeFishingCast, type FishingCastRecord } from "../src/sim/fishingReport.js";

export const JSONL_PATH = join("data", "run-reports", "fishing.jsonl");
export const MARKDOWN_PATH = join("handoff", "reports", "fishing-casts.md");

export function buildRecords(corpusRoot?: string): FishingCastRecord[] {
  return loadFishingCorpus(corpusRoot).map(summarizeFishingCast);
}

export function writeReports(records: FishingCastRecord[], jsonlPath = JSONL_PATH, markdownPath = MARKDOWN_PATH): void {
  mkdirSync(dirname(jsonlPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(jsonlPath, records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : ""));
  writeFileSync(markdownPath, buildFishingMarkdown(records));
}

function main(): void {
  const records = buildRecords();
  writeReports(records);
  console.log(`▸ fishingReport.ts — ${records.length} casts`);
  console.log(`  written to ${JSONL_PATH} and ${MARKDOWN_PATH}`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("fishingReport.ts");
if (isMain) main();
