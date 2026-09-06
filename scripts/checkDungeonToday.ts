/**
 * scripts/checkDungeonToday.ts — session 42, read-only baseline/diff helper
 * for Task 14's gate: prints the current `dayProgressEntities` row for a
 * given dungeonId (default 5, Forbidden Woods) so it can be read before and
 * after resuming the live juiced run and diffed by hand. No POST, no game
 * state mutation.
 *
 * ▸ [USER] DIRECTIVE 2026-09-05 — THIS SCRIPT PRINTS DUNGEON 5 AND NOTHING
 *   ELSE. `dayProgressEntities` is returned by the server as a whole-account
 *   array, and dumping it raw put OTHER dungeons' counters in front of a
 *   reader who has been instructed not to look at them. The rows are now
 *   FILTERED to the requested dungeonId before printing.
 *
 *   The one technical fact this preserves, because it is about our own
 *   accounting: **the 12-run-unit daily ledger is PER-DUNGEON** (measured).
 *   That is why filtering is safe — the requested dungeon's row is the whole
 *   answer for the requested dungeon, and no sibling row informs it.
 *
 * Usage: npx tsx scripts/checkDungeonToday.ts [dungeonId]
 */
import { GigaverseClient } from "../src/api/client.js";
import { findRealRunsToday } from "./liveRun.js";

/**
 * Keep only the rows belonging to `dungeonId`. The `docId` is shaped
 * `DayCount#<address>#Dungeon#<id>`, so the id is its last `#`-separated
 * segment — matched exactly rather than by substring, so dungeon 1 never
 * matches dungeon 15.
 */
export function rowsForDungeon(entities: unknown, dungeonId: number): unknown[] {
  if (!Array.isArray(entities)) return [];
  return entities.filter((e) => {
    const docId = String((e as { docId?: unknown })?.docId ?? "");
    return docId.split("#").pop() === String(dungeonId);
  });
}

async function main() {
  const dungeonId = Number(process.argv[2] ?? 5);
  const client = new GigaverseClient();
  const today = await client.getDungeonToday();
  const real = findRealRunsToday(today, dungeonId);
  console.log(`dungeonId ${dungeonId} dayProgressEntities (real runs today): ${real}`);

  const mine = rowsForDungeon(today.dayProgressEntities, dungeonId);
  if (mine.length === 0) {
    console.log(`(no dayProgressEntities row for dungeon ${dungeonId} today — 0 run-units used)`);
  } else {
    console.log(JSON.stringify(mine, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
