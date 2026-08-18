/**
 * src/sim/fishingReport.ts — [session 30] run-visibility reporting, fishing
 * half. Pure functions only (no filesystem) — `scripts/fishingReport.ts`
 * does the reading/writing, same split as the dungeon half
 * (`src/sim/dungeonReport.ts`).
 *
 * Built on `loadFishingCorpus()`/`FishingCast` (session 28, the one place
 * allowed to walk the fishing fixture tree) rather than re-deriving cast
 * grouping here.
 */

import type { FishingCast } from "./fishingCorpus.js";

export interface FishingCastRecord {
  docId: string;
  caught: boolean;
  fishName: string | null;
  rarity: number | null;
}

/** One cast's outcome — the terminal response (`completeCid: true`) decides caught vs. escaped, same rule as `summarizeFishingCorpus`. */
export function summarizeFishingCast(cast: FishingCast): FishingCastRecord {
  const terminal = cast.responses.find((r) => r.completeCid);
  const caughtResponse = cast.responses.find((r) => r.caughtFish !== null);
  const caught = terminal ? terminal.successCid === true : false;
  return {
    docId: cast.docId,
    caught,
    fishName: caughtResponse?.caughtFish?.name ?? null,
    rarity: caughtResponse?.caughtFish?.rarity ?? null,
  };
}

export interface FishingRollup {
  totalCasts: number;
  caught: number;
  catchRatePct: number;
  totalByName: Record<string, number>;
}

export function summarizeFishingRollup(records: FishingCastRecord[]): FishingRollup {
  const totalByName: Record<string, number> = {};
  let caught = 0;
  for (const r of records) {
    if (r.caught) {
      caught++;
      const name = r.fishName ?? "unknown";
      totalByName[name] = (totalByName[name] ?? 0) + 1;
    }
  }
  return {
    totalCasts: records.length,
    caught,
    catchRatePct: records.length > 0 ? (caught / records.length) * 100 : 0,
    totalByName,
  };
}

export interface FishingMarkdownOptions {
  generatedAt?: string;
}

/** Renders the committed `handoff/reports/fishing-casts.md` from a set of records. Deterministic given the same input. */
export function buildFishingMarkdown(records: FishingCastRecord[], opts: FishingMarkdownOptions = {}): string {
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const rollup = summarizeFishingRollup(records);
  const lines: string[] = [];

  lines.push("# Fishing casts");
  lines.push("");
  lines.push(
    `Regenerated from \`data/run-reports/fishing.jsonl\` by \`scripts/fishingReport.ts\` — do not hand-edit. Last generated ${generatedAt}.`,
  );
  lines.push("");
  lines.push(`${rollup.totalCasts} recorded casts — ${rollup.caught} caught (${rollup.catchRatePct.toFixed(1)}%).`);
  lines.push("");

  const names = Object.keys(rollup.totalByName).sort((a, b) => rollup.totalByName[b]! - rollup.totalByName[a]!);
  if (names.length > 0) {
    lines.push("## Fish caught, by name");
    lines.push("");
    for (const name of names) {
      lines.push(`- ${name}: ${rollup.totalByName[name]}`);
    }
    lines.push("");
  }

  lines.push("## Per-cast detail");
  lines.push("");
  lines.push("| docId | caught | fish |");
  lines.push("|---|---|---|");
  for (const r of records) {
    const fish = r.caught ? `${r.fishName ?? "unknown"}${r.rarity != null ? ` (rarity ${r.rarity})` : ""}` : "—";
    lines.push(`| ${r.docId} | ${r.caught ? "yes" : "no"} | ${fish} |`);
  }
  lines.push("");

  return lines.join("\n");
}
