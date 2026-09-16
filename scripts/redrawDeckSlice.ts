/**
 * scripts/redrawDeckSlice.ts — [session 124, QUESTIONS.md §71]
 *
 * The K=10 / all3 redraw margin, computed on a DECK-SLICED corpus.
 *
 * ## Why this exists
 *
 * Session 123's batch was the first played on the DENDREN rod, and the K=10
 * redraw margin collapsed to zero in the same session
 * (`tests/fishing/redrawCounterfactual.test.ts`). Those two facts are
 * confounded: the corpus the margin pools over straddles a deck change, and
 * **a margin that closes across a deck change is the deck change until shown
 * otherwise**. §71 names a discriminator — recompute on post-swap casts alone:
 *
 *  - margin STAYS at zero on Dendren-only casts  -> the collapse is the thesis
 *  - margin REOPENS on Dendren-only casts        -> the zero was the pooling
 *
 * ## ⚠ THAT DICHOTOMY IS FALSE, AND THIS FILE IS WHAT SHOWED IT
 *
 * Both branches presuppose that the PRE-swap corpus carried a POSITIVE margin
 * which the rod swap may or may not have destroyed. **It did not.** Sliced
 * here, GOLKAN alone — 307 traces, the largest single-deck cell — is already
 * NEGATIVE. There was no positive margin for the swap to destroy, so §71's
 * discriminator would have returned "margin <= 0" and been read as *"the
 * collapse is the thesis"*: the right words for the wrong reason.
 *
 * Deck and POLICY ERA (`castEra.ts`) are heavily confounded, and comparing
 * decks at CONSTANT era is what separates them: every deck is <= 0 within
 * `focusDry`, while the positive margin sits in the two older eras. So the
 * K=10 separation tracks the ERA, not the rod. A mechanism for that was
 * hypothesised, measured and REJECTED — see QUESTIONS.md §71's addendum.
 *
 * §71 remains OPEN by USER decision (2026-09-06, HOLD). Nothing here retires
 * or rescopes the claim; the pinned assertion stays a pin.
 *
 * ## The slice predicate, and why it is card ids and not dates
 *
 * A trace is DENDREN if its `cards` map carries any id in 91..100, GOLKAN if
 * any in 80..90. That reads the deck the server actually dealt, so it cannot
 * drift the way a date cutoff does when a fixture is backfilled or a cast is
 * replayed. The two id ranges are disjoint and every rod's deck is one of
 * them (session 123 read both off `fixtures/fishing-casts/cards.json`).
 *
 * Reads committed fixtures only. Writes nothing, touches no `data/` or
 * `logs/` path, makes no network call.
 */
import { loadCastTraces } from "../src/sim/fishing/castTrace.js";
import type { CastTrace } from "../src/sim/fishing/castTrace.js";
import { redrawCounterfactual, separability } from "../src/sim/fishing/redrawCounterfactual.js";
import { splitByDealtDeck } from "../src/sim/fishing/rodDeck.js";

const DENDREN_IDS = new Set([91, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
// [session 133] Card 74 is in BOTH the Shroom (811) and Golkan (812) grants
// (rodDeck.ts ROD_CARD_GRANTS), so a set that included it filed every Shroom
// cast under "golkan" — session 132 found the standing "Golkan 192/327" was an
// 811+812 pool (811 45/82, 812 147/245). Only 812-EXCLUSIVE ids count now, and
// Shroom gets its own slice, keyed on the ids it holds that Makeshift (922)
// does not (74/75/78).
const GOLKAN_IDS = new Set([80, 81, 84, 85, 86, 87, 88, 89, 90]);
const SHROOM_IDS = new Set([74, 75, 78]);

/**
 * ⚠ **`legacyRod` is NOT one deck.** It is "rod-dealt, but on neither of the
 * two rods whose card ids we know" — an earlier rod, or more than one. It is
 * named for what is known about it, not given a deck's name it has not earned.
 *
 * ⚠ **`baseDeck` is a SEPARATE axis and must not be folded into `legacyRod`.**
 * `splitByDealtDeck` already answers "did the rod grant apply at all"; a DRY
 * rod makes the server deal `BASE_DECK`. Those casts carry low card ids too,
 * so a card-id predicate alone lumps them in with the early rod — this file
 * did exactly that on its first pass, and the correction is kept visible
 * because the mistake is the natural one: **44 of the 126 low-id traces are
 * dry-rod base-deck casts, not an early rod at all.**
 */
export type Deck = "dendren" | "golkan" | "shroom" | "unknown";

export function deckOf(t: CastTrace): Deck {
  let dendren = false;
  let golkan = false;
  let shroom = false;
  for (const id of t.cards.keys()) {
    if (DENDREN_IDS.has(id)) dendren = true;
    if (GOLKAN_IDS.has(id)) golkan = true;
    if (SHROOM_IDS.has(id)) shroom = true;
  }
  if (dendren && !golkan) return "dendren";
  if (golkan && !dendren) return "golkan";
  if (shroom && !golkan && !dendren) return "shroom";
  return "unknown";
}

export interface SliceRow {
  label: string;
  traces: number;
  plays: number;
  b10: { fires: number; rescues: number; sacrifices: number; net: number };
  all3: { fires: number; rescues: number; sacrifices: number; net: number };
  margin: number;
}

export function sliceRow(label: string, traces: readonly CastTrace[]): SliceRow {
  const r = redrawCounterfactual(traces);
  const sep = separability(r);
  const b10 = sep.sweepWithBudget[10]!;
  const all3 = sep.sweep[3]!;
  const net = (x: { rescues: number; sacrifices: number }) => x.rescues - x.sacrifices;
  return {
    label,
    traces: traces.length,
    plays: r.perPlay.length,
    b10: { fires: b10.fires, rescues: b10.rescues, sacrifices: b10.sacrifices, net: net(b10) },
    all3: { fires: all3.fires, rescues: all3.rescues, sacrifices: all3.sacrifices, net: net(all3) },
    margin: net(b10) - net(all3),
  };
}

function main(): void {
  const all = loadCastTraces();
  // The grant axis FIRST: a dry rod is dealt BASE_DECK and is not an early rod.
  const byGrant = splitByDealtDeck(all as never) as unknown as Record<string, CastTrace[]>;
  const baseDeck = byGrant.base ?? [];
  const rodDealt = byGrant.rod ?? [];
  const dendren = rodDealt.filter((t) => deckOf(t) === "dendren");
  const golkan = rodDealt.filter((t) => deckOf(t) === "golkan");
  const shroom = rodDealt.filter((t) => deckOf(t) === "shroom");
  const legacyRod = rodDealt.filter((t) => deckOf(t) === "unknown");
  const unknown = legacyRod;

  const rows = [
    sliceRow("POOLED (everything, all decks)", all),
    sliceRow("BASE DECK (dry rod, no grant)", baseDeck),
    sliceRow("LEGACY ROD (rod-dealt, unknown rod)", legacyRod),
    sliceRow("SHROOM (811)", shroom),
    sliceRow("GOLKAN (812 only — Shroom no longer pooled in, session 133)", golkan),
    sliceRow("DENDREN (post-swap)", dendren),
  ];

  console.log("\n▸ K=10 redraw margin, sliced by DECK — QUESTIONS.md §71\n");
  console.log(
    `  corpus: ${all.length} trace(s) — baseDeck(dry rod) ${baseDeck.length}, ` +
      `legacyRod ${legacyRod.length}, shroom ${shroom.length}, golkan ${golkan.length}, dendren ${dendren.length}`,
  );
  if (unknown.length > 0) {
    // [session 124] These are NOT an error, and they are NOT one deck. They
    // are rod-dealt casts on an earlier rod (or rods) whose card ids this repo
    // has no fixture for — distinct again from the DRY-ROD base-deck casts,
    // which `splitByDealtDeck` has already removed above. Summarised rather
    // than listed one per line, because the doc ids are noise while the COUNT
    // is load-bearing: it is what shows the corpus spans more than one change.
    const sets = new Map<string, number>();
    for (const t of unknown) {
      const k = [...t.cards.keys()].sort((a, b) => a - b).join(",");
      sets.set(k, (sets.get(k) ?? 0) + 1);
    }
    console.log(`  ⚠ ${unknown.length} rod-dealt trace(s) on an EARLIER, UNIDENTIFIED rod (${sets.size} distinct card sets).`);
    console.log(`    Plus ${baseDeck.length} DRY-ROD base-deck trace(s), which are a different thing again.`);
    console.log(`    §71 frames the corpus as straddling ONE deck change. It straddles at least TWO.`);
  }
  console.log("");
  for (const r of rows) {
    console.log(`  ${r.label}`);
    console.log(`    traces ${r.traces}  plays ${r.plays}`);
    console.log(`    b10   fires ${r.b10.fires}  rescues ${r.b10.rescues} - sacrifices ${r.b10.sacrifices} = ${r.b10.net}`);
    console.log(`    all3  fires ${r.all3.fires}  rescues ${r.all3.rescues} - sacrifices ${r.all3.sacrifices} = ${r.all3.net}`);
    console.log(`    MARGIN (b10 net - all3 net) = ${r.margin}`);
    console.log("");
  }
  // ⚠ [session 124] DO NOT restore §71's own dichotomy here. It reads:
  //   "margin ZERO on Dendren-only -> the collapse is the thesis;
  //    margin POSITIVE on Dendren-only -> the zero was the pooling."
  // Both branches assume the PRE-swap corpus carried a positive margin. It did
  // not — GOLKAN alone is negative at n=307. Printing that dichotomy would make
  // this instrument assert a framing its own numbers refute, which is the same
  // defect session 124 found in checkEntryTiers.ts and fixed the same day.
  console.log("  §71 READING — the dichotomy in QUESTIONS.md is NOT the right one:");
  console.log("    Both of its branches presuppose a POSITIVE pre-swap margin. GOLKAN alone is");
  console.log(`    NEGATIVE (n=${golkan.length}), so there was never a positive margin for the swap to destroy.`);
  // [session 133] n=307 was the 811+812 pool. Split, SHROOM (811) reads +12 and
  // 812 alone -22 on the 606-trace corpus — reported, not ruled on (§71 HOLD).
  console.log("    Compare decks AT CONSTANT policy era (castEra.ts) before reading anything here.");
  console.log("  ⚠ POWER: the small cells fire only a handful of times; only GOLKAN carries weight.");
  console.log("  ⚠ The thresholds are fitted on the POOLED corpus with oracle labels. Slicing does NOT");
  console.log("    re-fit them: this shows 'these pinned thresholds do not separate', NOT 'none do'.");
  console.log("  ⚠ §71 is OPEN by USER decision (2026-09-06, HOLD). Nothing here retires or rescopes it.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
