/**
 * scripts/deckObjectiveSweep.ts — [session 78, §4 / CODEXAUG22REVIEW M3]
 * a full-deck-composition objective for permanent card additions.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SUSPENDED ON ARRIVAL. Read this before quoting a single number below.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This harness runs on `castSim`, and `castSim` has been shown not to reproduce
 * this fishery. `handoff/OIL-POLICY.md` §0a suspends every Δ measured in it for
 * exactly that reason: **sim catch ~70% against a real 27.6%, sim meter-out 1.0%
 * against a real 64.2%.** A deck objective derived on that instrument inherits
 * the suspension the day it is written, and this one does.
 *
 * So the output below is a RANKING, not a recommendation, and specifically not
 * a licence to change `chooseNewCard`. Changing live card selection on a sim
 * result is CLAUDE.md rule 4, and the ship-nothing posture holds.
 *
 * What the ranking IS good for: it says whether the placeholder's answer and a
 * composition-aware answer even differ, and whether the ordering is stable
 * across the parameters the profile mismatch most plausibly turns on. If the
 * ranking is robust, that is a real (if suspended) result. If it flips between
 * profiles, that is a MORE useful result — it says a deck objective cannot be
 * derived on this instrument at all, and the next step is the profile check
 * rather than more simulation.
 *
 * ## What is being replaced, and why it is worth replacing
 *
 * `src/strategy/fishing/cardChoice.ts`'s `chooseNewCard` is argmax
 * `max(hitEffect, critEffect) / manaCost`, and its own comment calls it a
 * "simple, defensible placeholder... Not sim-validated against a full-deck-
 * composition objective." It ignores the deck it is joining entirely: existing
 * hit/crit geometry, redundant coverage, miss penalties, draw probability, and
 * the mana curve. Each pick is PERMANENT and changes every future cast, so a
 * locally efficient card can lower whole-deck catch rate by duplicating
 * coverage the deck already had.
 *
 * ## THE RESULT, measured 2026-08-22: M3 CANNOT BE ANSWERED ON THIS INSTRUMENT
 *
 * Not because of the profile mismatch above — because of the DRAW MODEL.
 *
 * `castSim`'s `drawHand` is strictly sequential from index 0 and cycles with
 * `% deck.length`. A cast lasts ~5 turns, so with the account's real 23-card
 * deck only the first ~8 cards are ever seen. **A card appended to the end of
 * the deck is unreachable by construction.** Measured, not reasoned:
 *
 *     baseline (23 cards)         hit 41.06%   meanFinalFishHp 13.22
 *     card 17 APPENDED            hit 41.06%   13.22      (identical, 4 d.p.)
 *     card 17 PREPENDED           hit 39.56%   13.38      (−1.50pp)
 *     card 25 APPENDED            hit 41.06%   13.22      (identical)
 *     card 25 PREPENDED           hit 60.97%    9.94      (+19.91pp)
 *
 * Every appended arm is byte-identical to the baseline; the same cards moved to
 * the front swing hit rate by up to twenty points. So the whole answer to "which
 * card should I keep?" is dominated by WHERE the card lands in `fullDeck` — and
 * that is a server behaviour nobody has captured. It is the review's own fourth
 * listed missing input: *"Confirmation of draw/shuffle behavior when `fullDeck`
 * grows beyond the currently observed sizes."*
 *
 * **This is a capture request, not a modelling task** (CLAUDE.md rule 6). The
 * fix that suggests itself — shuffle the deck per cast so an added card can be
 * drawn — is rule 1 inverted: the entire ranking would then be an artifact of an
 * invented draw model, and it would look exactly as authoritative as a real one.
 * Not done. The script reports the null and says why.
 *
 * A second consequence, worth its own line because M3 explicitly advises the
 * opposite: **the cache must key on the ORDERED deck, not a normalized one.**
 * `[...deck, id]` and `[id, ...deck]` are the same multiset and, in this sim,
 * measurably different decks. Normalizing would have silently returned the
 * append arm's numbers for the prepend arm and hidden the entire finding.
 *
 * ## Why the pairing here is exact rather than approximate
 *
 * `simulateCast` consumes NO rng while building the deck when `deckIds` is
 * supplied (it maps ids through the catalog; the random-sample path that does
 * consume rng is the `deckIds`-absent branch). The start cell and the true fish
 * pattern are drawn immediately after. So at a given seed, **every arm faces
 * the identical fish trajectory** — the arms differ only in what the deck could
 * do about it. `simulateCasts(runs, opts, seed)` walks `seed + i`, so passing
 * one base seed to every arm pairs the whole batch, not just one cast.
 *
 * This is the property M3 asks for ("identical fish trajectories and seeds per
 * arm") and it is a fact about `castSim`, not something this script arranges.
 *
 * ## Offline, and it must stay that way
 *
 * Reads `fixtures/`, writes nothing, calls nothing. The review is right that a
 * deck simulation must never run inside the live loop — the action-token window
 * is ~5s (CLAUDE.md rule 7) and one arm here is thousands of casts.
 *
 * Usage:
 *   npx tsx scripts/deckObjectiveSweep.ts [runs=4000]
 *   npx tsx scripts/deckObjectiveSweep.ts 4000 --deck=74,75,76,...
 *   npx tsx scripts/deckObjectiveSweep.ts 4000 --offers=12,34,56
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { resolveProfile, profileArg, fixturePath } from "../src/profile.js";
import { simulateCasts, matcherFishPolicy, type CastSummary } from "../src/sim/fishing/castSim.js";
import { loadDendrenDeck } from "../src/sim/fishing/deck.js";
import { chooseNewCard } from "../src/strategy/fishing/cardChoice.js";

/**
 * Through the profile seam, not a hard-coded `fixtures/` — `tests/
 * noHardcodedPaths.test.ts`'s ratchet caught the first draft of this file doing
 * the latter, which is exactly what that ratchet is for. Its instruction is
 * "prefer the profile instead of raising the number", and this is that.
 */
const PROFILE = resolveProfile(profileArg(process.argv));
const LIVE_CASTS_DIR = fixturePath(PROFILE, "fishing-casts", "live");

const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const RUNS = Number(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : 4000);
const rule = (s: string) => `\n${"═".repeat(88)}\n${s}\n${"═".repeat(88)}`;

/**
 * The account's real deck, read off the most recent live capture that carries
 * one. Deliberately NOT a hand-written constant: a deck objective evaluated
 * against a deck the account does not hold is answering a different question,
 * and this file would be the last place anyone thought to update.
 */
function latestLiveDeck(): { ids: number[]; source: string } | null {
  if (!existsSync(LIVE_CASTS_DIR)) return null;
  const dirs = readdirSync(LIVE_CASTS_DIR)
    .filter((d) => d.startsWith("cast-"))
    .sort()
    .reverse();
  for (const d of dirs) {
    const dir = join(LIVE_CASTS_DIR, d);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const j = JSON.parse(readFileSync(join(dir, f), "utf8")) as {
          data?: { doc?: { data?: { fullDeck?: number[] } } };
        };
        const ids = j.data?.doc?.data?.fullDeck;
        if (Array.isArray(ids) && ids.length > 0) return { ids, source: join(d, f) };
      } catch {
        // Not a response envelope, or unreadable — keep looking.
      }
    }
  }
  return null;
}

interface Arm {
  label: string;
  id: number | null;
  /** The candidate APPENDED to the held deck — what a loot pick plausibly does. */
  summary: CastSummary;
  /** The same candidate PREPENDED. The gap between the two is the size of the unknown. */
  front: CastSummary;
}

function main(): void {
  const catalog = loadDendrenDeck();
  const byId = new Map(catalog.map((c) => [c.id, c]));

  const deckArg = arg("deck");
  const found = deckArg ? null : latestLiveDeck();
  const deck = deckArg ? deckArg.split(",").map(Number) : (found?.ids ?? []);
  const deckSource = deckArg ? "--deck argument" : (found?.source ?? "none");

  if (deck.length === 0) {
    console.log(
      "\n✗ No deck to evaluate. No live cast fixture carries a `fullDeck`, and no --deck was given.\n" +
        "  This script refuses to invent one: a deck objective evaluated against a deck the\n" +
        "  account does not hold answers a different question. Pass --deck=<ids>.\n",
    );
    process.exit(1);
  }

  const unknown = deck.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    // Fail closed (CLAUDE.md rule 5). A deck id outside the Dendren catalog
    // means either the catalog is stale or the deck is from another pond, and
    // silently dropping the card would quietly evaluate a different deck.
    console.log(
      `\n✗ ${unknown.length} deck id(s) are not in the Dendren catalog: ${unknown.join(", ")}\n` +
        `  Either fixtures/fishing-casts/cards.json is stale or this deck is not a Dendren deck.\n` +
        `  Refusing to evaluate a deck this script would have to modify to understand.\n`,
    );
    process.exit(1);
  }

  const offersArg = arg("offers");
  const candidates = offersArg
    ? offersArg.split(",").map(Number)
    : catalog.map((c) => c.id).sort((a, b) => a - b);

  console.log(rule(`DECK-COMPOSITION OBJECTIVE — ${RUNS} paired casts per arm`));
  console.log(
    `\n★★★ SUSPENDED — castSim does not reproduce this fishery (OIL-POLICY.md §0a: sim catch\n` +
      `    ~70% vs a real 27.6%, meter-out 1.0% vs 64.2%). Every number below is a RANKING\n` +
      `    under that suspension, NOT a recommendation, and NOT authorization to change\n` +
      `    chooseNewCard (CLAUDE.md rule 4).\n`,
  );
  console.log(`  held deck   ${deck.length} cards, from ${deckSource}`);
  console.log(`  candidates  ${candidates.length}`);
  console.log(
    `  pairing     exact — with deckIds supplied, deck construction consumes no rng, so every\n` +
      `              arm faces the identical fish trajectory at a given seed.\n`,
  );

  // `matcherPool: []` — the blind matcher. Session 14 established this as the
  // condition representative of real Dendren play: the real pattern is not in
  // the synthetic library, and the matcher has never once identified it live.
  const opts = { policy: matcherFishPolicy, matcherPool: [] as [] };

  /**
   * Cached on the ORDERED deck. M3 advises caching "by normalized deck
   * composition" and that advice is WRONG for this simulator: `drawHand` is
   * sequential, so `[...deck, id]` and `[id, ...deck]` are the same multiset and
   * measurably different decks. Normalizing would return the append arm's
   * numbers for the prepend arm and hide the finding this script exists to
   * report. See the header.
   */
  const cache = new Map<string, CastSummary>();
  const run = (ids: readonly number[]): CastSummary => {
    const key = ids.join(",");
    const hit = cache.get(key);
    if (hit) return hit;
    const s = simulateCasts(RUNS, { ...opts, deckIds: ids }, 1);
    cache.set(key, s);
    return s;
  };

  const baseline = run(deck);
  const arms: Arm[] = candidates.map((id) => ({
    // The catalog carries NO name field — ids and stats only — so the label is
    // the id plus what distinguishes it. Do not invent a display name here.
    label: `+${id} (r${byId.get(id)?.rarity ?? "?"}, ${byId.get(id)?.manaCost ?? "?"}m)`,
    id,
    summary: run([...deck, id]),
    front: run([id, ...deck]),
  }));

  /**
   * The null check, and it is the point of the script rather than a guard on it.
   * 80 rows of "Δ 0.00" look like "every card is equivalent" to a reader
   * skimming, and that reading is completely wrong — the arms are identical
   * because the added card is never DRAWN.
   */
  const identical = (a: CastSummary, b: CastSummary) =>
    a.catchRate === b.catchRate && a.hitRate === b.hitRate && a.meanFinalFishHp === b.meanFinalFishHp;
  const appendInert = arms.every((a) => identical(a.summary, baseline));

  arms.sort(
    (a, b) =>
      b.front.hitRate - a.front.hitRate ||
      b.front.catchRate - a.front.catchRate ||
      a.front.meanFinalFishHp - b.front.meanFinalFishHp,
  );

  console.log(
    `\n  baseline (deck unchanged):  catch ${(baseline.catchRate * 100).toFixed(1)}%  ` +
      `hit ${(baseline.hitRate * 100).toFixed(2)}%  meanTurns ${baseline.meanTurns.toFixed(2)}  ` +
      `meanFinalFishHp ${baseline.meanFinalFishHp.toFixed(2)}`,
  );

  if (appendInert) {
    console.log(rule("NULL RESULT — AND THE NULL IS THE FINDING"));
    console.log(
      `\n  All ${arms.length} appended arms are IDENTICAL to the baseline, to full precision.\n` +
        `  That does NOT mean every card is equivalent. It means the added card is never DRAWN.\n\n` +
        `  \`drawHand\` is sequential from index 0 and cycles with % deck.length. A cast lasts\n` +
        `  ${baseline.meanTurns.toFixed(2)} turns, so only the first ~${Math.ceil(baseline.meanTurns) + 3} of these ${deck.length} cards are ever seen —\n` +
        `  a card appended at position ${deck.length} is unreachable by construction.\n\n` +
        `  The PREPENDED column below is the same cards moved to the front. It moves, and by a\n` +
        `  lot. So the answer to "which card should I keep?" is dominated by WHERE the card\n` +
        `  lands in \`fullDeck\`, which is a server behaviour nobody has captured.\n\n` +
        `  ★ BLOCKED ON A CAPTURE, not on more simulation: the draw/shuffle behaviour when\n` +
        `    \`fullDeck\` grows. Do NOT "fix" this by shuffling the deck here — the ranking\n` +
        `    would become an artifact of an invented draw model and would look exactly as\n` +
        `    authoritative as a real one (CLAUDE.md rule 1).\n`,
    );
  }

  console.log(`\n  Ranked by PREPENDED hit rate — the only column that moves. See above.\n`);
  console.log(`  rank  card                        appended Δhit   prepended hit%    Δhit   mana`);
  console.log(`  ${"─".repeat(84)}`);
  for (const [i, a] of arms.entries()) {
    const c = byId.get(a.id!)!;
    console.log(
      `  ${String(i + 1).padStart(4)}  ${a.label.slice(0, 26).padEnd(26)} ` +
        `${((a.summary.hitRate - baseline.hitRate) * 100).toFixed(2).padStart(13)}  ` +
        `${(a.front.hitRate * 100).toFixed(2).padStart(15)}  ` +
        `${((a.front.hitRate - baseline.hitRate) * 100).toFixed(2).padStart(6)}  ` +
        `${String(c.manaCost).padStart(4)}`,
    );
  }

  /**
   * The comparison that is actually the point of M3: does the placeholder's
   * answer differ from the composition-aware one? If it never does, M3 is a
   * documentation fix. If it does, that difference is the finding — still
   * suspended, but a finding.
   */
  const offered = candidates.map((id) => byId.get(id)!).filter(Boolean);
  const placeholder = chooseNewCard(offered);
  const best = arms[0]!;
  console.log(rule("PLACEHOLDER vs COMPOSITION"));
  console.log(
    `\n  chooseNewCard (damage/mana):  card ${placeholder.id}\n` +
      `  composition argmax:           card ${best.id}\n`,
  );
  if (placeholder.id === best.id) {
    console.log(
      `  They AGREE over this candidate set. That is evidence FOR the placeholder on this\n` +
        `  deck — not proof, and not transferable to a different deck or a different offer.\n`,
    );
  } else {
    const ph = arms.find((a) => a.id === placeholder.id)!;
    console.log(
      `  They DISAGREE. The placeholder's pick ranks ${arms.indexOf(ph) + 1}/${arms.length} by prepended hit rate,\n` +
        `  ${((best.front.hitRate - ph.front.hitRate) * 100).toFixed(2)}pp behind the composition argmax.\n\n` +
        `  This is the disagreement M3 predicted, and it is DOUBLY suspended: it is a castSim\n` +
        `  result (OIL-POLICY.md §0a) AND it is measured in the prepended arm, which is not\n` +
        `  what a loot pick does — appending is, and appending measures nothing at all until\n` +
        `  the draw behaviour is captured. It is a reason to run that capture. It is NOT a\n` +
        `  reason to change chooseNewCard.\n`,
    );
  }

  console.log(`  cache: ${cache.size} distinct compositions simulated for ${candidates.length + 1} arms.\n`);
}

main();
