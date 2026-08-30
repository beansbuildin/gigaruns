/**
 * scripts/checkEntryTiers.ts — session 111, read-only preflight for CLAUDE.md
 * rule 11's ENTRY TIER. No POST, no game state mutation.
 *
 * Rule 11's standing tier is 2 (silver rings) as of 2026-08-30, and both
 * gated tiers carry `inputsBasedOnFactionDay: true` — **the required item
 * list is not static and must never be cached**. This script reads it live,
 * alongside the balances, and prints the runway.
 *
 * The number that matters is NOT the ring total. Tier 2 costs one of EACH of
 * the seven silver rings per run, so the runway is the SCARCEST faction's
 * balance; a reader who sums the seven gets an answer ~9x too generous.
 * `minBalance` below is the whole point of the file.
 */
import { GigaverseClient } from "../src/api/client.js";

/** Faction ring ids, confirmed against `GET /offchain/static`'s `gameItems[]` (SPEC §3c, session 42). */
const RING_NAMES: Record<number, string> = {
  134: "Chobo Silver", 135: "Crusader Silver", 136: "Overseer Silver", 137: "Athena Silver",
  138: "Archon Silver", 139: "Foxglove Silver", 140: "Summoner Silver",
  243: "Chobo Gold", 244: "Crusader Gold", 245: "Overseer Gold", 246: "Athena Gold",
  247: "Archon Gold", 248: "Foxglove Gold", 249: "Summoner Gold",
};

/** Runs per day at rule 11's ceiling — 12 run-units / 3 per juiced run. */
export const RUNS_PER_DAY = 4;

export type TierCost = { id: number; amount: number };

/**
 * How many runs the held balances afford at this tier — the MINIMUM over the
 * required items, never the sum. Exported and pure so the one piece of
 * arithmetic anyone is likely to get wrong is pinned by a test rather than
 * only ever exercised against the live endpoint.
 *
 * Returns `null` for a free tier (`inputItems: []`), which has no runway
 * rather than an infinite one — the caller prints a different line for it.
 */
export function runwayRuns(cost: TierCost[], balances: Map<number, number>): { runs: number; scarcest: TierCost } | null {
  if (cost.length === 0) return null;
  let best: { runs: number; scarcest: TierCost } | null = null;
  for (const item of cost) {
    // `amount` is per RUN, so a hypothetical 2x cost halves the runway. Clamped
    // at 1 so a malformed 0 cannot divide by zero into an infinite runway.
    const runs = Math.floor((balances.get(item.id) ?? 0) / Math.max(1, item.amount));
    if (best === null || runs < best.runs) best = { runs, scarcest: item };
  }
  return best;
}

async function main() {
  const dungeonId = Number(process.argv[2] ?? 5);
  const client = new GigaverseClient();
  const today = await client.getDungeonToday();
  const dungeon = today.dungeonDataEntities.find((d) => d.ID_CID === dungeonId);
  if (!dungeon) throw new Error(`dungeonId ${dungeonId} not present in dungeonDataEntities`);

  const balancesRes = await client.getItemsBalances();
  const balances = new Map<number, number>();
  // `ID_CID` is a STRING on this endpoint (`"134"`), unlike the numeric `ID_CID`
  // on `dungeonDataEntities` — keying the map on it raw silently yields 0 for
  // every ring, which reads as "out of rings" rather than as a bug.
  for (const row of balancesRes.entities) balances.set(Number(row.ID_CID), row.BALANCE_CID);

  console.log(`\n▸ ${dungeon.NAME_CID} (dungeonId ${dungeonId}) — entry tiers, live\n`);

  // Array order is tier 2, 1, 3. Sort for READING only; every lookup below is
  // by `.tier`, never by position — `entryData[0]` is Tier 2 and
  // `entryData[1]` is Tier 1, two coincidences that make a positional read
  // look correct right up until it spends seven silver rings by mistake.
  for (const entry of [...dungeon.entryData].sort((a, b) => a.tier - b.tier)) {
    const cost = entry.inputItems.map((id, i) => ({ id, amount: entry.inputAmounts[i] ?? 1 }));
    console.log(`  tier ${entry.tier}  dropMultiplier ${entry.dropMultiplier}  ${JSON.stringify(entry.name)}`);
    if (cost.length === 0) {
      console.log(`    cost: none (inputItems: []) — no rings spent`);
    } else {
      for (const { id, amount } of cost) {
        console.log(`    cost: ${amount}x ${id} ${RING_NAMES[id] ?? "(unknown item)"} — balance ${balances.get(id) ?? 0}`);
      }
      const { runs, scarcest } = runwayRuns(cost, balances)!;
      const total = cost.reduce((n, { id }) => n + (balances.get(id) ?? 0), 0);
      console.log(
        `    ▸ RUNWAY ${runs} runs = ${(runs / RUNS_PER_DAY).toFixed(1)} days at ${RUNS_PER_DAY}/day — ` +
          `bound by ${scarcest.id} ${RING_NAMES[scarcest.id] ?? ""}`,
      );
      console.log(`      (the ${total} rings held in total is NOT the runway — one of each is spent per run)`);
    }
    if (entry.inputsBasedOnFactionDay) {
      console.log(`    ⚠ inputsBasedOnFactionDay: true — this list is per-day. Re-read it; never cache it.`);
    }
  }
  console.log("");
}

const isMain = process.argv[1] && process.argv[1].endsWith("checkEntryTiers.ts");
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
