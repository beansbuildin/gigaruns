/**
 * scripts/lossDecompositionReport.ts — [session 117, OFFLINE] persisted
 * counterpart to `scripts/lossDecomposition.ts` (session 48). Same
 * rebuild-from-source-of-truth discipline as `dungeonReport.ts`/
 * `fishingReport.ts`: rewrites `data/run-reports/fishing-loss-decomposition.jsonl`
 * (gitignored) and `handoff/reports/fishing-loss-decomposition.md`
 * (committed) from the full fixture corpus every run, via
 * `loadCastTraces()`/`isCleanTrace()` — no cast-grouping logic duplicated
 * here.
 *
 * `scripts/lossDecomposition.ts` stays as the interactive console diagnostic
 * (per-turn focus/mana profile, focus-budget-zero rate) — this file exists
 * because that one's headline table was never persisted anywhere, so nobody
 * saw it again after the session that ran it. See `handoff/DECISIONS.md`,
 * 2026-09-02 (session 117).
 *
 * Usage: npx tsx scripts/lossDecompositionReport.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { isCleanTrace, loadCastTraces } from "../src/sim/fishing/castTrace.js";
import {
  buildLossDecompositionMarkdown,
  summarizeCastTrace,
  type LossDecompositionRecord,
} from "../src/sim/fishing/lossDecompositionReport.js";

export const JSONL_PATH = join("data", "run-reports", "fishing-loss-decomposition.jsonl");
export const MARKDOWN_PATH = join("handoff", "reports", "fishing-loss-decomposition.md");

export function buildRecords(corpusRoot?: string): LossDecompositionRecord[] {
  return loadCastTraces(corpusRoot).filter(isCleanTrace).map(summarizeCastTrace);
}

export function writeReports(records: LossDecompositionRecord[], jsonlPath = JSONL_PATH, markdownPath = MARKDOWN_PATH): void {
  mkdirSync(dirname(jsonlPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(jsonlPath, records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : ""));
  writeFileSync(markdownPath, buildLossDecompositionMarkdown(records));
}

function main(): void {
  const records = buildRecords();
  writeReports(records);
  console.log(`▸ lossDecompositionReport.ts — ${records.length} casts`);
  console.log(`  written to ${JSONL_PATH} and ${MARKDOWN_PATH}`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("lossDecompositionReport.ts");
if (isMain) main();
