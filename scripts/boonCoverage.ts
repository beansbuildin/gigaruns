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
 * [session 54, brief §5] The room-1 gap is now EMPTY (0 of 17) and the real
 * untested surface is the opposite one: 36 types offered with no
 * `BOON_MODELS` entry. Modelling stays opportunistic — a boon offered once
 * every forty runs costs more than it returns — so this now ranks the gap by
 * OFFER FREQUENCY and calls out the SHALLOW subset (rooms 1-3) separately.
 * That subset is the one with leverage: session 53's own corpus growth
 * dropped a sim arm's `deepestScorableRoom` from 5 to 4 purely because three
 * new unmodelled types landed at rooms 3/4, so an unmodelled type at room 2
 * costs far more simulated depth than the same type at room 9.
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
  /**
   * [session 54] The same gap, ranked. `offers` is how many captured offers
   * contained the type; `shallowestRoom` is the earliest room it has ever
   * been offered in, which is what determines how much simulated depth it
   * costs — see this file's header.
   */
  unmodelledDetail: { type: string; offers: number; shallowestRoom: number }[];
  room1OfferCount: number;
  totalOfferCount: number;
  modelledCount: number;
}

export function boonCoverage(): BoonCoverage {
  const modelled = Object.keys(BOON_MODELS).sort();
  const inRoom1 = new Set<string>();
  const anywhere = new Set<string>();
  const offerCounts = new Map<string, number>();
  const shallowest = new Map<string, number>();
  let room1OfferCount = 0;

  for (const offer of OBSERVED_OFFERS) {
    if (offer.room === 1) room1OfferCount++;
    // A type offered twice in one offer still counts as one offer containing it.
    for (const type of new Set(offer.options.map((o) => o.type))) {
      anywhere.add(type);
      if (offer.room === 1) inRoom1.add(type);
      offerCounts.set(type, (offerCounts.get(type) ?? 0) + 1);
      shallowest.set(type, Math.min(shallowest.get(type) ?? Infinity, offer.room));
    }
  }

  const unmodelled = [...anywhere].filter((t) => !(t in BOON_MODELS)).sort();
  const unmodelledDetail = unmodelled
    .map((type) => ({ type, offers: offerCounts.get(type) ?? 0, shallowestRoom: shallowest.get(type) ?? Infinity }))
    // Frequency first (what modelling it buys), then depth (how much it costs
    // to leave unmodelled), then name so the output is stable run to run.
    .sort((a, b) => b.offers - a.offers || a.shallowestRoom - b.shallowestRoom || a.type.localeCompare(b.type));

  return {
    neverOfferedInRoom1: modelled.filter((m) => !inRoom1.has(m)),
    neverOfferedAnywhere: modelled.filter((m) => !anywhere.has(m)),
    offeredButUnmodelled: unmodelled,
    unmodelledDetail,
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

  console.log(`\n  OFFERED but NOT modelled (${c.offeredButUnmodelled.length}) — the opposite gap, ranked by offer frequency:`);
  if (c.unmodelledDetail.length === 0) console.log(`    (none)`);
  for (const u of c.unmodelledDetail) {
    console.log(`    ${u.type.padEnd(24)} ${String(u.offers).padStart(3)} offer(s)   shallowest room ${u.shallowestRoom}`);
  }

  // The subset with leverage — see this file's header.
  const shallow = c.unmodelledDetail.filter((u) => u.shallowestRoom <= 3);
  console.log(`\n  ...of which SHALLOW (first offered in rooms 1-3): ${shallow.length} of ${c.unmodelledDetail.length}`);
  console.log(`    These are the ones the sim's deepestScorableRoom actually chokes on.`);
  for (const u of shallow) {
    console.log(`    ${u.type.padEnd(24)} ${String(u.offers).padStart(3)} offer(s)   room ${u.shallowestRoom}`);
  }
  console.log();
}

const isMain = process.argv[1] && process.argv[1].endsWith("boonCoverage.ts");
if (isMain) main();
