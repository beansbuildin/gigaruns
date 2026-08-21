/**
 * scripts/critByGear.ts — [session 70 §5a] the crit rate, scoped to the gear
 * that was actually equipped, read off each cast's own document.
 *
 * ## Why session 69's denominator has to move
 *
 * Session 69 scoped the one observed `CRIT_HIT` to all of 2026-08-21 — 1/73
 * plays — on a user-stated recollection that a Steady Lure was equipped before
 * that day's casts. CLAUDE.md rule 9 applies to a user-stated claim exactly as
 * it applies to a brief's, and the claim is checkable: every fishing document
 * carries `GEAR_CID_array`, so **every cast in `fixtures/` records what was
 * equipped while it was played.** There is no need to remember it.
 *
 * The classification is EXACT rather than bounded, and for a reason worth
 * stating: gear can only change between casts as far as this data is concerned,
 * and plays only happen during casts. So a cast's own `GEAR_CID_array` is
 * authoritative for every play in it, and no play falls in an unclassifiable
 * gap.
 *
 * ## What the data says, and where it contradicts the session-70 brief
 *
 * The brief read the numeric suffix on a `GearInstance#<id>_<n>` entry as an
 * EQUIP timestamp. It is not, and the fixtures show it plainly:
 *
 *   - `#951_1787254688` decodes to 2026-08-20 12:38 PT, but first appears on a
 *     cast at 2026-08-21 09:47 PT — 21 hours later.
 *   - `#811_1787332895` and `#952_1787332903` decode to 2026-08-21 10:21 PT,
 *     and first appear on a cast at 2026-08-21 12:58 PT.
 *
 * A suffix that predates first appearance by a variable margin is an instance
 * mint/creation stamp, not an equip stamp. **So dating the lure from the suffix
 * would have put the crit era 2h37m too early.** First appearance in a cast's
 * own array is the observable, and it is the one used here.
 *
 * ## The 3% is not confirmable from `/offchain/static`
 *
 * Read live 2026-08-21: `gameItems` entries 951 (Steady Lure) and 952 (Sticky
 * Lure) carry `NAME_CID`, `RARITY_CID`, `TYPE_CID: "Gear"` and image URLs —
 * **and no effect field of any kind.** Neither a crit percentage nor any other
 * stat. The "3% crit chance" therefore remains user-stated and unverified from
 * the API; it is not contradicted either. Do not cite `/offchain/static` as its
 * source.
 *
 * Usage: npx tsx scripts/critByGear.ts [--profile=NAME]
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { profileArg, resolveProfile } from "../src/profile.js";

/** Gear ids this script reasons about, resolved live against `/offchain/static` 2026-08-21. */
const STEADY_LURE = 951;
const STICKY_LURE = 952;
const SHROOM_ROD = 811;
const MAKESHIFT_ROD = 922;

interface CastRecord {
  docId: string;
  createdAt: string;
  gearIds: number[];
  plays: number;
  hits: number;
  crits: number;
}

/** `GearInstance#<itemId>_<mintStamp>[_<hash>]` — the id is the part that resolves against `gameItems`. */
function gearItemIds(arr: unknown): number[] {
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((e) => {
    const m = /^GearInstance#(\d+)_/.exec(String(e));
    return m ? [Number(m[1])] : [];
  });
}

interface Doc {
  docId?: string;
  createdAt?: string;
  updatedAt?: string;
  GEAR_CID_array?: unknown;
}

function docOf(json: unknown): Doc | null {
  const j = json as { gameState?: Doc; data?: { doc?: Doc } };
  return j.gameState ?? j.data?.doc ?? null;
}

function eventsOf(json: unknown): { type?: string }[] {
  const j = json as { data?: { events?: { type?: string }[] } };
  return j.data?.events ?? [];
}

/**
 * Keyed by docId, NOT by directory. A fixture directory is created per
 * INVOCATION of `liveFishing.ts` and several hold more than one cast — session
 * 68 §4b, pinned in `fishingCorpus.test.ts`. Counting per directory would merge
 * casts that may have been played on different gear.
 */
function collect(liveRoot: string): CastRecord[] {
  const byDoc = new Map<string, CastRecord>();
  for (const dir of readdirSync(liveRoot)) {
    let files: string[];
    try {
      files = readdirSync(join(liveRoot, dir)).filter((f) => f.startsWith("state-")).sort();
    } catch {
      continue; // a `raw`-only directory from a --dry-run
    }
    for (const f of files) {
      let json: unknown;
      try {
        json = JSON.parse(readFileSync(join(liveRoot, dir, f), "utf8"));
      } catch {
        continue;
      }
      const doc = docOf(json);
      if (!doc?.docId) continue;
      let rec = byDoc.get(doc.docId);
      if (!rec) {
        rec = {
          docId: doc.docId,
          createdAt: doc.createdAt ?? doc.updatedAt ?? "",
          gearIds: gearItemIds(doc.GEAR_CID_array),
          plays: 0,
          hits: 0,
          crits: 0,
        };
        byDoc.set(doc.docId, rec);
      }
      const evs = eventsOf(json);
      if (evs.some((e) => e.type === "CARD_PLAYED")) rec.plays++;
      if (evs.some((e) => e.type === "HIT")) rec.hits++;
      if (evs.some((e) => e.type === "CRIT_HIT")) rec.crits++;
    }
  }
  return [...byDoc.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Wilson score interval — the same one session 69 reported, so the numbers are comparable. */
function wilson(k: number, n: number): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 0 };
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: Math.max(0, (c - s) / d), hi: Math.min(1, (c + s) / d) };
}

function report(label: string, casts: CastRecord[]): void {
  const plays = casts.reduce((a, c) => a + c.plays, 0);
  const hits = casts.reduce((a, c) => a + c.hits, 0);
  const crits = casts.reduce((a, c) => a + c.crits, 0);
  // Two denominators, both reported: session 69's reason still holds at n=1 —
  // "3% crit chance" could mean 3% of plays or 3% of plays that CONNECT, and
  // those are different mechanics. Choosing one would be an assumption dressed
  // as a measurement.
  const connecting = hits + crits;
  const a = wilson(crits, plays);
  const b = wilson(crits, connecting);
  console.log(`  ${label}`);
  console.log(`    casts ${String(casts.length).padStart(3)}   plays ${String(plays).padStart(4)}   connecting ${String(connecting).padStart(4)}   crits ${crits}`);
  if (plays > 0) {
    console.log(
      `    all plays        ${crits}/${plays} = ${((crits / plays) * 100).toFixed(2)}%   95% Wilson [${(a.lo * 100).toFixed(2)}%, ${(a.hi * 100).toFixed(2)}%]`,
    );
  }
  if (connecting > 0) {
    console.log(
      `    connecting plays ${crits}/${connecting} = ${((crits / connecting) * 100).toFixed(2)}%   95% Wilson [${(b.lo * 100).toFixed(2)}%, ${(b.hi * 100).toFixed(2)}%]`,
    );
  }
  console.log("");
}

function main(): void {
  const profile = resolveProfile(profileArg(process.argv));
  const liveRoot = join(profile.fixtureRoot, "fishing-casts", "live");
  const all = collect(liveRoot);

  console.log(`\n▸ critByGear.ts — ${all.length} cast(s) with a readable document, profile ${profile.name}`);
  console.log(`  gear read off each cast's own GEAR_CID_array. 951 Steady Lure, 952 Sticky Lure, 811 Shroom Rod, 922 Makeshift Rod.\n`);

  console.log("── §1  WHEN EACH LURE FIRST APPEARS ON A CAST ──");
  for (const id of [STEADY_LURE, STICKY_LURE, SHROOM_ROD, MAKESHIFT_ROD]) {
    const first = all.find((c) => c.gearIds.includes(id));
    const last = [...all].reverse().find((c) => c.gearIds.includes(id));
    const n = all.filter((c) => c.gearIds.includes(id)).length;
    console.log(
      `  item ${id}: ${n} cast(s)` +
        (first ? `   first ${first.createdAt} (cast ${first.docId})   last ${last?.createdAt}` : "   never seen"),
    );
  }

  console.log("\n── §2  THE CRIT RATE, BY WHAT WAS ACTUALLY EQUIPPED ──");
  const withSteady = all.filter((c) => c.gearIds.includes(STEADY_LURE));
  const noLure = all.filter((c) => !c.gearIds.includes(STEADY_LURE) && !c.gearIds.includes(STICKY_LURE));
  const bothLures = all.filter((c) => c.gearIds.includes(STEADY_LURE) && c.gearIds.includes(STICKY_LURE));
  const steadyOnly = all.filter((c) => c.gearIds.includes(STEADY_LURE) && !c.gearIds.includes(STICKY_LURE));

  report("NO LURE at all — the control", noLure);
  report("STEADY LURE equipped (951), any other gear", withSteady);
  report("  ...of those, STEADY ONLY (no Sticky yet)", steadyOnly);
  report("  ...of those, STEADY + STICKY both equipped", bothLures);

  console.log("── §3  THE CRITS THEMSELVES ──");
  for (const c of all.filter((x) => x.crits > 0)) {
    console.log(`  cast ${c.docId}  ${c.createdAt}  crits ${c.crits}  plays ${c.plays}  gear [${c.gearIds.join(", ")}]`);
  }
  console.log("");
}

main();
