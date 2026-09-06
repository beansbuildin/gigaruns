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
 * confounded: the corpus the margin pools over now straddles a deck change,
 * and **a margin that closes across a deck change is the deck change until
 * shown otherwise**. §71 names the discriminator — recompute on post-swap
 * casts alone:
 *
 *  - margin STAYS at zero on Dendren-only casts  -> the collapse is the thesis
 *  - margin REOPENS on Dendren-only casts        -> the zero was the pooling
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

const DENDREN_IDS = new Set([91, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
const GOLKAN_IDS = new Set([80, 81, 84, 85, 86, 87, 74, 88, 89, 90]);

export type Deck = "dendren" | "golkan" | "unknown";

export function deckOf(t: CastTrace): Deck {
  let dendren = false;
  let golkan = false;
  for (const id of t.cards.keys()) {
    if (DENDREN_IDS.has(id)) dendren = true;
    if (GOLKAN_IDS.has(id)) golkan = true;
  }
  if (dendren && !golkan) return "dendren";
  if (golkan && !dendren) return "golkan";
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
  const dendren = all.filter((t) => deckOf(t) === "dendren");
  const golkan = all.filter((t) => deckOf(t) === "golkan");
  const unknown = all.filter((t) => deckOf(t) === "unknown");

  const rows = [
    sliceRow("POOLED (all decks)", all),
    sliceRow("LEGACY only (pre-Golkan)", unknown),
    sliceRow("GOLKAN only", golkan),
    sliceRow("DENDREN only (post-swap)", dendren),
  ];

  console.log("\n▸ K=10 redraw margin, sliced by DECK — QUESTIONS.md §71\n");
  console.log(`  corpus: ${all.length} trace(s) — golkan ${golkan.length}, dendren ${dendren.length}, unknown ${unknown.length}`);
  if (unknown.length > 0) {
    // [session 124] These are NOT an error. They are a THIRD, EARLIER deck —
    // base ids 1..7 plus looted cards — so the corpus spans at least three
    // decks, not the two §71 assumes. Summarised rather than listed one per
    // line, because 126 doc ids is noise, but the count is load-bearing.
    const sets = new Map<string, number>();
    for (const t of unknown) {
      const k = [...t.cards.keys()].sort((a, b) => a - b).join(",");
      sets.set(k, (sets.get(k) ?? 0) + 1);
    }
    console.log(`  ⚠ ${unknown.length} trace(s) on a THIRD, EARLIER deck (${sets.size} distinct card sets, base ids 1..7 + loot).`);
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
  console.log("  §71: margin ZERO on the Dendren-only slice -> the collapse is the thesis.");
  console.log("       margin POSITIVE on the Dendren-only slice -> the zero was the pooling.");
  console.log("  ⚠ This resolves the DISCRIMINATOR. It does not authorise retiring the claim — §71 needs a USER decision.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
