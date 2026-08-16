/**
 * One-off, reasoned probe: the just-failed live use_item (itemId 131,
 * index 0) returned "Item not found in index" as the SECOND use in the same
 * battle, right after an IDENTICAL first call (itemId 131, index 0)
 * succeeded. Hypothesis: `index` addresses a POSITION in the run's
 * committed `consumables` loadout (2x itemId 131), not a stable itemId
 * lookup — the first 131 sits at index 0, consumed by the first use; the
 * second 131 sits at index 1. One reasoned parameter guess on an
 * already-confirmed action (CLAUDE.md §2's endpoint rule doesn't cover
 * this — same footing as how `path_two`/`reward_*` were originally
 * resolved), not a brute-force loop; stops after this one attempt either
 * way. Uses the actionToken from the failed response's own error body
 * (1786894104822) since this is a fresh process (getActionToken() would
 * otherwise start at 0, and a GET never refreshes it — DECISIONS
 * 2026-08-14).
 */
import { GigaverseClient } from "../src/api/client.js";
import { UnexpectedResponseError, TokenExpiredError } from "../src/api/errors.js";

async function main() {
  const client = new GigaverseClient();
  const body = {
    action: "use_item" as const,
    dungeonId: 5,
    actionToken: 1786894104822,
    data: { consumables: [], isJuiced: false, index: 1, itemId: 131 },
  };
  console.log("POST", JSON.stringify(body));
  try {
    const resp = await client.postDungeonAction(body);
    console.log("HTTP 200", JSON.stringify(resp, null, 2).slice(0, 2000));
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      console.log("token expired:", e.message);
      return;
    }
    if (e instanceof UnexpectedResponseError) {
      console.log(`HTTP ${e.status}`, e.body.slice(0, 500));
      return;
    }
    console.log("request failed:", (e as Error).message);
  }
}

main();
