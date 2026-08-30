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

import { ITEM_HARD_CORE } from "./dungeonReport.js";
import type { FishingCast } from "./fishingCorpus.js";

export interface FishingCastRecord {
  docId: string;
  caught: boolean;
  fishName: string | null;
  rarity: number | null;
  /**
   * ── [session 110] HARD CORE EARNED BY THIS CAST ───────────────────────────
   *
   * Summed over every response in the cast, exactly as
   * `summarizeDungeonAttempt` sums it over every state in a run — the item id
   * is the same one (`ITEM_HARD_CORE`, imported rather than re-declared, so
   * the two halves of the report cannot drift apart).
   *
   * **Summed, not read off the terminal response.** The credit does NOT
   * reliably land on the response the cast's grouping logic calls terminal:
   * across the 273-cast corpus it arrives on `"Cards played successfully."`
   * 68 times and on `"Item used successfully."` 52 times — the latter being a
   * turn that spent an oil and landed the kill in the same action. Keying on
   * one message, or on the `completeCid` response, would silently drop the
   * other population.
   *
   * `0` for an escaped cast, and that is a MEASURED zero, not a convention:
   * all 152 escaped casts and the 1 incomplete cast credit nothing, while all
   * 120 caught casts credit exactly one 845 entry each.
   */
  hardCore: number;
}

/** One cast's outcome — the terminal response (`completeCid: true`) decides caught vs. escaped, same rule as `summarizeFishingCorpus`. */
export function summarizeFishingCast(cast: FishingCast): FishingCastRecord {
  const terminal = cast.responses.find((r) => r.completeCid);
  const caughtResponse = cast.responses.find((r) => r.caughtFish !== null);
  const caught = terminal ? terminal.successCid === true : false;

  let hardCore = 0;
  for (const r of cast.responses) {
    for (const change of r.gameItemBalanceChanges) {
      if (change.id === ITEM_HARD_CORE) hardCore += change.amount;
    }
  }

  return {
    docId: cast.docId,
    caught,
    fishName: caughtResponse?.caughtFish?.name ?? null,
    rarity: caughtResponse?.caughtFish?.rarity ?? null,
    hardCore,
  };
}

export interface FishingRollup {
  totalCasts: number;
  caught: number;
  catchRatePct: number;
  totalByName: Record<string, number>;
  /** [session 110] Total item-845 credited across every cast in the set. */
  totalHardCore: number;
  /** [session 110] Mean Hard Core per CAUGHT cast — `0` when nothing was caught. The per-cast mean is `totalHardCore / totalCasts` and is a different, batch-composition-bound number; both are printed rather than picking one. */
  hardCorePerCatch: number;
}

export function summarizeFishingRollup(records: FishingCastRecord[]): FishingRollup {
  const totalByName: Record<string, number> = {};
  let caught = 0;
  let totalHardCore = 0;
  for (const r of records) {
    totalHardCore += r.hardCore;
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
    totalHardCore,
    hardCorePerCatch: caught > 0 ? totalHardCore / caught : 0,
  };
}

/**
 * ── [session 110] THE RARITY LADDER, DERIVED RATHER THAN WRITTEN ────────────
 *
 * The per-catch Hard Core amount is not a constant — it tracks the fish's
 * rarity, and a minority of catches pay an exact small multiple of that base.
 * Both halves are DERIVED from the records being rendered rather than quoted
 * from a session's measurement, because a hardcoded sentence about "all 120
 * caught casts" is wrong the moment the next batch lands. It was, within one
 * session of being written.
 *
 * The base for a rarity is the MINIMUM amount observed at that rarity. That is
 * a claim about the data in front of it, not a model: if a future batch ever
 * observes something below a current base, the base moves and the multiple
 * count moves with it, which is the correct behaviour for a report.
 */
function hardCoreLadderLines(records: FishingCastRecord[]): string[] {
  const caught = records.filter((r) => r.caught && r.rarity != null && r.hardCore > 0);
  if (caught.length === 0) return [];

  const base = new Map<number, number>();
  for (const r of caught) {
    const cur = base.get(r.rarity!);
    if (cur === undefined || r.hardCore < cur) base.set(r.rarity!, r.hardCore);
  }
  const ladder = [...base.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rarity, amount]) => `${rarity} -> ${amount}`)
    .join(", ");
  const multiples = caught.filter((r) => r.hardCore > base.get(r.rarity!)!);

  return [
    `**The per-catch amount is NOT a constant.** It tracks the fish's rarity — across all ${caught.length} ` +
      `caught casts the base is rarity ${ladder} — and ${multiples.length} of those ${caught.length} paid an ` +
      `exact small multiple of that base (up to ${Math.max(...multiples.map((r) => r.hardCore / base.get(r.rarity!)!), 1)}x) ` +
      "with no distinguishing field on the response. Both the ladder and the multiple count are derived from " +
      "the casts below, not quoted from a past measurement — see `src/sim/fishingReport.ts`.",
    "",
  ];
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
  lines.push(
    `Total Hard Core earned: ${rollup.totalHardCore} (${rollup.hardCorePerCatch.toFixed(1)} per catch, ` +
      `${(rollup.totalCasts > 0 ? rollup.totalHardCore / rollup.totalCasts : 0).toFixed(1)} per cast).`,
  );
  lines.push("");
  lines.push(...hardCoreLadderLines(records));

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
  lines.push("| docId | caught | fish | Hard Core |");
  lines.push("|---|---|---|---|");
  for (const r of records) {
    const fish = r.caught ? `${r.fishName ?? "unknown"}${r.rarity != null ? ` (rarity ${r.rarity})` : ""}` : "—";
    lines.push(`| ${r.docId} | ${r.caught ? "yes" : "no"} | ${fish} | ${r.hardCore} |`);
  }
  lines.push("");

  return lines.join("\n");
}
