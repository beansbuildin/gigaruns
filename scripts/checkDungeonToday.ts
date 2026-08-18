/**
 * scripts/checkDungeonToday.ts — session 42, read-only baseline/diff helper
 * for Task 14's gate: prints the current `dayProgressEntities` row for a
 * given dungeonId (default 5, Forbidden Woods) so it can be read before and
 * after resuming the live juiced run and diffed by hand. No POST, no game
 * state mutation.
 */
import { GigaverseClient } from "../src/api/client.js";
import { findRealRunsToday } from "./liveRun.js";

async function main() {
  const dungeonId = Number(process.argv[2] ?? 5);
  const client = new GigaverseClient();
  const today = await client.getDungeonToday();
  const real = findRealRunsToday(today, dungeonId);
  console.log(`dungeonId ${dungeonId} dayProgressEntities (real runs today): ${real}`);
  console.log(JSON.stringify(today.dayProgressEntities, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
