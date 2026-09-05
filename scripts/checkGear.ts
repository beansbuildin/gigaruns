/**
 * scripts/checkGear.ts — read-only durability census of every EQUIPPED gear
 * instance. Zero energy, zero POSTs, one GET.
 *
 * WHY THIS EXISTS. Session 122 discovered that gear WEARS OUT MID-SESSION and
 * that a worn piece changes the loadout: item 640 "Golkan Eradicator Head"
 * (slot 11) reached `DURABILITY_CID: 0` during run 3, and run 4 therefore
 * opened at hpMax 45 with Sword ATK 26 -> 16 and Shield ATK 11 -> 6. Runs 1-3
 * and run 4 are DIFFERENT ARMS, and nothing at the time said so — it was found
 * hours later in a census diff.
 *
 * `liveRun.ts`'s preflight (session 122) reports only pieces already AT ZERO,
 * which is the right trigger for the [USER] halt but cannot answer the other
 * question: **how fast does each piece wear?** That needs the full vector
 * before and after a run. This script prints it so a run can be bracketed:
 *
 *   npx tsx scripts/checkGear.ts   # before
 *   npx tsx scripts/liveRun.ts --juiced --juiced-index=2 --runs=1
 *   npx tsx scripts/checkGear.ts   # after  -> per-run wear rate, per slot
 *
 * ▸ [USER] RATIFIED 2026-09-05 — THE GEAR HALT. A run in progress is NEVER
 *   stopped for durability, not at 2, not at 1, not at 0. AFTER a run
 *   completes, if ANY equipped piece reads 0, STOP and hand back for a manual
 *   repair before the next run. The trigger is 0, checked after a completed
 *   run — never a pre-run threshold, never mid-run.
 *
 * ⚠ Every equipped piece is listed, deliberately. The slot taxonomy is NOT
 *   established: exactly ONE mapping is confirmed (item 640, slot 11, dungeon
 *   armour), and slots 8/14/15 hold fishing gear on the same account.
 *   Narrowing this to a dungeon-slot allowlist from n=1 is the inference this
 *   repo's boon precedent forbids — see STATE's Dead ends.
 *
 * Usage: npx tsx scripts/checkGear.ts [--json]
 */
import { GigaverseClient } from "../src/api/client.js";

interface Row {
  docId: string;
  itemId: number;
  slot: number;
  durability: number;
}

export function equippedRows(entities: unknown[]): Row[] {
  return (entities as Record<string, unknown>[])
    .map((e) => ({
      docId: String(e.docId ?? ""),
      itemId: Number(e.GAME_ITEM_ID_CID ?? -1),
      slot: Number(e.EQUIPPED_TO_SLOT_CID ?? -1),
      durability: Number(e.DURABILITY_CID ?? -1),
    }))
    .filter((r) => r.slot >= 0)
    .sort((a, b) => a.slot - b.slot);
}

async function main() {
  const asJson = process.argv.includes("--json");
  const client = new GigaverseClient();
  const me = await client.getMe();
  const gear = await client.getGearInstances(me.address);
  const entities = ((gear as unknown as { entities?: unknown[] }).entities ?? []) as unknown[];
  const rows = equippedRows(entities);

  if (asJson) {
    console.log(JSON.stringify({ readAt: new Date().toISOString(), rows }, null, 2));
    return;
  }

  console.log(`▸ equipped gear durability — ${rows.length} piece(s) of ${entities.length} instance(s)`);
  console.log(`  read at ${new Date().toISOString()}\n`);
  console.log(`  slot  item   durability  docId`);
  for (const r of rows) {
    const flag = r.durability === 0 ? "  <- ZERO" : "";
    console.log(
      `  ${String(r.slot).padStart(4)}  ${String(r.itemId).padStart(4)}   ${String(r.durability).padStart(10)}  ${r.docId}${flag}`,
    );
  }

  const worn = rows.filter((r) => r.durability === 0);
  console.log("");
  if (worn.length === 0) {
    console.log(`  ▸ all ${rows.length} equipped piece(s) have durability remaining.`);
  } else {
    console.log(
      `  ⚠ ${worn.length} equipped piece(s) at DURABILITY 0: ` +
        worn.map((w) => `item ${w.itemId} (slot ${w.slot})`).join(", "),
    );
    console.log(
      `  ⚠ [USER] HALT: after a completed run, any piece at 0 means STOP and hand back for a`,
    );
    console.log(`     manual repair. Do not start the next run. A run already in progress is NEVER aborted.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
