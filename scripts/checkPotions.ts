/**
 * scripts/checkPotions.ts — Task 12 Stage B, session-14 brief §3: read-only
 * check for a real heal potion in the account's item balances before
 * attempting the `consumables` field-shape probe on `start_run`. IDs from
 * SPEC-fishing.md §5 (confirmed via `GET /offchain/static`, session 11):
 * Lil Heal Juice 151, Mid Heal Juice 155, Big Heal Juice 131.
 */
import { GigaverseClient } from "../src/api/client.js";

const HEAL_POTIONS: Record<number, string> = {
  131: "Big Heal Juice",
  151: "Lil Heal Juice",
  155: "Mid Heal Juice",
};

async function main() {
  const client = new GigaverseClient();
  const balances = await client.getItemsBalances();
  console.log(`${balances.entities.length} item balance rows total.`);
  for (const [id, name] of Object.entries(HEAL_POTIONS)) {
    const row = balances.entities.find((e) => e.ID_CID === id);
    console.log(`  itemId ${id} (${name}): ${row ? `balance ${row.BALANCE_CID}` : "no row (0)"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
