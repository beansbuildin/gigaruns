/**
 * scripts/checkMaxRoom.ts — session 57, read-only. ONE GET, zero energy.
 *
 * The final-room no-modifiers exception (CLAUDE.md rule 8, third clause) is
 * keyed on the SERVER's per-dungeon `maxRoom`. Session 56 encoded that path
 * but it was INERT — under the old lowest-tier rule it could never change a
 * decision, so `maxRoom` had never governed anything and had never been read
 * from a live response by any code that depends on it.
 *
 * Session 57's brief asked for exactly this check before the field goes live:
 * print every dungeon's server-published `maxRoom` and diff it against what
 * `config/discovered.json` recorded at probe time (2026-08-13). A silent drift
 * between the two would move the final room without moving the rule.
 */
import { readFileSync } from "node:fs";
import { GigaverseClient } from "../src/api/client.js";

async function main() {
  const client = new GigaverseClient();
  const today = await client.getDungeonToday();
  const entities = (today as unknown as { dungeonDataEntities?: Array<Record<string, unknown>> })
    .dungeonDataEntities ?? [];

  console.log("LIVE dungeonDataEntities — ID_CID / NAME_CID / maxRoom:");
  const live = new Map<number, number | undefined>();
  for (const e of entities) {
    const id = e.ID_CID as number;
    const maxRoom = e.maxRoom as number | undefined;
    live.set(id, maxRoom);
    console.log(`  ${String(id).padStart(3)}  ${String(e.NAME_CID).padEnd(24)} maxRoom=${maxRoom ?? "(absent)"}`);
  }

  const discovered = JSON.parse(readFileSync("config/discovered.json", "utf8")) as {
    forbiddenWoods: { id: number; maxRoom: number };
  };
  const fwId = discovered.forbiddenWoods.id;
  const recorded = discovered.forbiddenWoods.maxRoom;
  const liveFw = live.get(fwId);

  console.log("");
  console.log(`Forbidden Woods (id ${fwId}):  live=${liveFw ?? "(absent)"}  discovered.json=${recorded}`);
  if (liveFw === undefined) {
    console.log("VERDICT: FAIL — the server no longer publishes `maxRoom` for this dungeon.");
    process.exit(1);
  }
  if (liveFw !== recorded) {
    console.log(`VERDICT: DRIFT — re-run scripts/probe.ts; the final-room rule is keyed on a stale ${recorded}.`);
    process.exit(1);
  }
  console.log("VERDICT: OK — live value matches config/discovered.json.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
