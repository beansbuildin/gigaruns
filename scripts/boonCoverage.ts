/**
 * scripts/boonCoverage.ts — which `BOON_MODELS` entries have never actually
 * been OFFERED, and where.
 *
 * [session 53, brief §6] "Wall 1" has now gained a hole five separate times
 * by the same route: a boon sits in `BOON_MODELS` for many sessions, no
 * captured room-1 offer happens to CONTAIN it, so the sim can never pick it
 * there — and then one live run offers it and the hole appears retroactively.
 * Session 11's `AddMaxArmor`, session 43's `UpgradePaper`, session 52's
 * `AddMaxHealth`. Three times is a pattern, not an accident.
 *
 * A known list of untested boons is worth more than discovering the sixth one
 * by surprise, so this enumerates the gap instead of waiting for it.
 *
 * Usage: npx tsx scripts/boonCoverage.ts [--json]
 */

import { BOON_MODELS, OBSERVED_OFFERS } from "../src/sim/boons.js";

export interface BoonCoverage {
  /** Modelled boons that have never appeared in a ROOM-1 offer. */
  neverOfferedInRoom1: string[];
  /** Modelled boons that have never appeared in ANY captured offer, at any depth. */
  neverOfferedAnywhere: string[];
  /** Types seen in a captured offer with no `BOON_MODELS` entry — the opposite gap. */
  offeredButUnmodelled: string[];
  room1OfferCount: number;
  totalOfferCount: number;
  modelledCount: number;
}

export function boonCoverage(): BoonCoverage {
  const modelled = Object.keys(BOON_MODELS).sort();
  const inRoom1 = new Set<string>();
  const anywhere = new Set<string>();
  let room1OfferCount = 0;

  for (const offer of OBSERVED_OFFERS) {
    if (offer.room === 1) room1OfferCount++;
    for (const option of offer.options) {
      anywhere.add(option.type);
      if (offer.room === 1) inRoom1.add(option.type);
    }
  }

  return {
    neverOfferedInRoom1: modelled.filter((m) => !inRoom1.has(m)),
    neverOfferedAnywhere: modelled.filter((m) => !anywhere.has(m)),
    offeredButUnmodelled: [...anywhere].filter((t) => !(t in BOON_MODELS)).sort(),
    room1OfferCount,
    totalOfferCount: OBSERVED_OFFERS.length,
    modelledCount: modelled.length,
  };
}

function main(): void {
  const c = boonCoverage();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(c, null, 2));
    return;
  }
  console.log(`\n▸ boon coverage — ${c.modelledCount} modelled, ${c.room1OfferCount} room-1 offers of ${c.totalOfferCount} total\n`);

  const seenLater = new Set(c.neverOfferedInRoom1.filter((b) => !c.neverOfferedAnywhere.includes(b)));
  console.log(`  MODELLED but never offered in ROOM 1 (${c.neverOfferedInRoom1.length}) — wall-1 holes waiting to happen:`);
  if (c.neverOfferedInRoom1.length === 0) console.log(`    (none — every modelled boon has appeared in a room-1 offer)`);
  for (const b of c.neverOfferedInRoom1) {
    console.log(`    ${b.padEnd(24)} ${seenLater.has(b) ? "seen in a LATER room" : "never offered anywhere"}`);
  }

  console.log(`\n  MODELLED but never offered ANYWHERE (${c.neverOfferedAnywhere.length}):`);
  console.log(`    ${c.neverOfferedAnywhere.join(", ") || "(none)"}`);

  console.log(`\n  OFFERED but NOT modelled (${c.offeredButUnmodelled.length}) — the opposite gap:`);
  console.log(`    ${c.offeredButUnmodelled.join(", ") || "(none)"}\n`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("boonCoverage.ts");
if (isMain) main();
