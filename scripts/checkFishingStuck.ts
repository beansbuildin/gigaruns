/**
 * Read-only check: is the fishing account still stuck ("Player is already
 * in a game", QUESTIONS.md §10)? Prints gameState.COMPLETE_CID/SUCCESS_CID
 * and whether cardsToAdd ever merged into fullDeck. No POST sent.
 */
import { GigaverseClient } from "../src/api/client.js";

async function main() {
  const client = new GigaverseClient();
  const me = await client.getMe();
  const state = await client.getFishingState(me.address);
  if (!state.gameState) {
    console.log("gameState: null — no game on record, start_run should be clean.");
    return;
  }
  console.log(`docId: ${state.gameState.docId}`);
  console.log(`COMPLETE_CID: ${state.gameState.COMPLETE_CID}`);
  console.log(`SUCCESS_CID: ${state.gameState.SUCCESS_CID}`);
  console.log(`fullDeck length: ${state.gameState.data.fullDeck?.length ?? "n/a"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
