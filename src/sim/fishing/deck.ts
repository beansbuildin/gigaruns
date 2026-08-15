/**
 * src/sim/fishing/deck.ts — the real Dendren card catalog off disk.
 *
 * Read-only, no network — same convention as `src/sim/corpus.ts`. Sourced
 * from `fixtures/fishing-casts/cards.json` (the real `GET /fishing/cards`
 * capture, Task 7), validated through `src/api/fishing.ts`'s zod schema so
 * a shape drift fails loudly here rather than silently in the sim.
 */

import { readFileSync } from "node:fs";

import { FishingCardsSchema, type FishingCard } from "../../api/fishing.js";

export const CARD_CATALOG_PATH = "fixtures/fishing-casts/cards.json";

/** The Dendren pond id — SPEC-fishing.md §3, CONFIRMED by `pondEntryTiers[]` naming. */
export const DENDREN_POND_ID = 2;

let cached: FishingCard[] | null = null;

/** Every card `foundInPonds` includes Dendren (pondId 2). */
export function loadDendrenDeck(): FishingCard[] {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(CARD_CATALOG_PATH, "utf8"));
  const parsed = FishingCardsSchema.parse(raw);
  cached = parsed.entities.filter((c) => c.foundInPonds.includes(DENDREN_POND_ID));
  return cached;
}
