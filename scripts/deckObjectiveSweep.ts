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
 * ## THE RESULT OF 2026-08-22 (session 78), AND WHY IT NO LONGER STANDS
 *
 * This script first returned a null with a diagnosis: all 80 appended
 * candidates byte-identical to the baseline, the same cards prepended moving
 * hit rate by up to +19.91pp. The diagnosis was that `castSim`'s `drawHand`
 * walked the deck from index 0, so a card appended to a 23-card deck was never
 * drawn inside a ~5-turn cast. That was correct about the simulator.
 *
 * It was then generalised into a claim about the GAME — that an appended card
 * is "unreachable by construction" on the real deck — and **that claim is
 * false.** Session 79 measured every committed live fishing state: 129 opening
 * hands, ZERO equal to `fullDeck[0..2]`, roster tail positions drawn as often
 * as the head. The server deals from a shuffled pile. `castSim` now shuffles
 * once per cast (`src/sim/fishing/drawModel.ts`, and
 * `tests/fishing/deckShuffle.test.ts` fails the old model on the live data).
 *
 * **So the APPENDED column is the live one now**, and it is what this script
 * ranks on: appending is what a loot pick does. The PREPENDED column is kept
 * as a control rather than as the headline — under a shuffle the two arms are
 * the same multiset AND the same distribution, so a large systematic gap
 * between them would mean the shuffle is not doing what it claims. Watch it,
 * do not quote it.
 *
 * **The null check below is now a TRIPWIRE.** If every appended arm ever comes
 * out identical to the baseline again, the sequential pile is back and nothing
 * printed here means anything.
 *
 * A consequence that survives from session 78 with its reason replaced: **the
 * cache still keys on the ORDERED deck.** Not because order changes the
 * distribution any more — it does not — but because each cast shuffles from
 * the order it was handed, so `[...deck, id]` and `[id, ...deck]` still
 * produce different concrete piles at a given seed. A normalized cache would
 * hand one arm's numbers to the other.
 *
 * ## Why the pairing here is exact rather than approximate
 *
 * `simulateCast` consumes no MAIN-stream rng while building the deck when
 * `deckIds` is supplied: the ids map through the catalog, and the pile's
 * shuffle draws from its own salted stream precisely so that deck LENGTH
 * cannot shift the fish (session 79 §1 — this script's arms differ by one
 * card, so a shared stream would have put a trajectory difference inside every
 * Δ below). The start cell and the true fish pattern are drawn immediately
 * after. So at a given seed, **every arm faces the identical fish trajectory**
 * — the arms differ only in what the deck could do about it.
 * `simulateCasts(runs, opts, seed)` walks `seed + i`, so passing one base seed
 * to every arm pairs the whole batch, not just one cast.
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
    `  pairing     exact — the pile shuffles off its own rng stream, so deck length cannot\n` +
      `              move the fish and every arm faces the identical trajectory at a seed.\n`,
  );
  console.log(
    `  draw model  SHUFFLED pile, once per cast (session 79 §1, measured 129/129 live).\n` +
      `              Ranked on the APPENDED arm — that is what a loot pick does.\n`,
  );

  // `matcherPool: []` — the blind matcher. Session 14 established this as the
  // condition representative of real Dendren play: the real pattern is not in
  // the synthetic library, and the matcher has never once identified it live.
  const opts = { policy: matcherFishPolicy, matcherPool: [] as [] };

  /**
   * Cached on the ORDERED deck. M3 advises caching "by normalized deck
   * composition" and that advice is still wrong here, for a weaker reason than
   * session 78's: the two orderings are now the same DISTRIBUTION, but each
   * cast shuffles from the order it was handed, so at a given seed they are
   * different concrete piles. A normalized cache would return one arm's
   * numbers for the other and make the append/prepend control below vacuous.
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

  // [session 79] On the APPENDED arm — the one a loot pick actually produces.
  // Session 78 ranked on `front` because `summary` was inert; it is not any
  // more, and ranking on the prepend arm now measures a deck nobody builds.
  arms.sort(
    (a, b) =>
      b.summary.hitRate - a.summary.hitRate ||
      b.summary.catchRate - a.summary.catchRate ||
      a.summary.meanFinalFishHp - b.summary.meanFinalFishHp,
  );

  console.log(
    `\n  baseline (deck unchanged):  catch ${(baseline.catchRate * 100).toFixed(1)}%  ` +
      `hit ${(baseline.hitRate * 100).toFixed(2)}%  meanTurns ${baseline.meanTurns.toFixed(2)}  ` +
      `meanFinalFishHp ${baseline.meanFinalFishHp.toFixed(2)}`,
  );

  if (appendInert) {
    console.log(rule("★ TRIPWIRE — THE SEQUENTIAL PILE IS BACK"));
    console.log(
      `\n  All ${arms.length} appended arms are IDENTICAL to the baseline, to full precision.\n` +
        `  Under a shuffled pile that cannot happen: an appended card is drawn as often as any\n` +
        `  other, so it must move SOMETHING at ${RUNS} casts an arm.\n\n` +
        `  This was session 78's result and it was a property of \`drawHand\` walking the roster\n` +
        `  from index 0. Session 79 replaced that with a per-cast shuffle, measured against 129\n` +
        `  live opening hands (0 of which were fullDeck[0..2]). If this block prints, either\n` +
        `  the shuffle has been removed or \`sequentialDrawPile\` is set — and NOTHING BELOW\n` +
        `  MEANS ANYTHING until that is fixed. See tests/fishing/deckShuffle.test.ts.\n`,
    );
  }

  /**
   * [session 79] The append/prepend control, which replaces session 78's
   * headline. Under a shuffle the two arms hold the same multiset AND draw it
   * the same way, so they should agree up to Monte Carlo noise. A systematic
   * gap means the shuffle is not doing what this script says it does — the
   * same check, pointed at the new model instead of at the old one's damage.
   */
  const gaps = arms.map((a) => Math.abs(a.summary.hitRate - a.front.hitRate));
  const meanGap = gaps.reduce((x, y) => x + y, 0) / gaps.length;
  const maxGap = Math.max(...gaps);
  const spread = Math.max(...arms.map((a) => a.summary.hitRate)) - Math.min(...arms.map((a) => a.summary.hitRate));
  console.log(rule("CONTROL — append vs prepend, which the shuffle should have made equivalent"));
  console.log(
    `\n  mean |append − prepend| hit rate   ${(meanGap * 100).toFixed(2)}pp\n` +
      `  max                                ${(maxGap * 100).toFixed(2)}pp\n` +
      `  spread across appended arms        ${(spread * 100).toFixed(2)}pp\n\n` +
      `  These are the SAME deck under the session-79 draw model, so the first two ARE the\n` +
      `  harness's own noise at ${RUNS} casts — measured, not assumed, which is the useful\n` +
      `  part. **Read the mean as a floor: any Δhit below ${(meanGap * 100).toFixed(2)}pp in the table below is\n` +
      `  indistinguishable from zero**, and so is any rank difference between two such arms.\n\n` +
      `  Session 78 measured this pair at 0.00pp and up to 19.91pp respectively — that\n` +
      `  asymmetry was the sequential pile, and it is gone. If the mean gap ever approaches\n` +
      `  the spread, the arms are not exchangeable and the ranking is measuring deck POSITION\n` +
      `  again rather than deck composition.\n`,
  );

  console.log(`\n  Ranked by APPENDED hit rate — what a loot pick produces. SUSPENDED under OIL-POLICY §0a.\n`);
  console.log(`  rank  card                        appended hit%    Δhit   prepended Δhit   mana`);
  console.log(`  ${"─".repeat(84)}`);
  for (const [i, a] of arms.entries()) {
    const c = byId.get(a.id!)!;
    console.log(
      `  ${String(i + 1).padStart(4)}  ${a.label.slice(0, 26).padEnd(26)} ` +
        `${(a.summary.hitRate * 100).toFixed(2).padStart(12)}  ` +
        `${((a.summary.hitRate - baseline.hitRate) * 100).toFixed(2).padStart(6)}  ` +
        `${((a.front.hitRate - baseline.hitRate) * 100).toFixed(2).padStart(15)}  ` +
        `${String(c.manaCost).padStart(4)}`,
    );
  }

  /**
   * The comparison that is actually the point of M3: does the placeholder's
   * answer differ from the composition-aware one? If it never does, M3 is a
   * documentation fix. If it does, that difference is the finding — still
   * suspended, but a finding.
   */
  const aboveFloor = arms.filter((a) => a.summary.hitRate - baseline.hitRate > meanGap).length;
  console.log(
    `\n  ${aboveFloor} of ${arms.length} arms beat the baseline by more than the ${(meanGap * 100).toFixed(2)}pp control gap.\n` +
      `  The rest are inside the harness's own noise and their ORDER means nothing.\n`,
  );

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
      `  They DISAGREE. The placeholder's pick ranks ${arms.indexOf(ph) + 1}/${arms.length} by APPENDED hit rate,\n` +
        `  ${((best.summary.hitRate - ph.summary.hitRate) * 100).toFixed(2)}pp behind the composition argmax — ` +
        `${((best.summary.hitRate - ph.summary.hitRate) / meanGap).toFixed(1)}x the ${(meanGap * 100).toFixed(2)}pp control gap.\n` +
        `  (The RANK is the weaker half of that sentence: only ${aboveFloor} of ${arms.length} arms clear the\n` +
        `  control gap, so two ranks inside it are the same measurement. The pp deficit is not.)\n\n` +
        `  This is the disagreement M3 predicted, now measured in the arm a loot pick actually\n` +
        `  produces — session 78's version of this line was measured in the prepended arm and\n` +
        `  was doubly suspended for that reason. ONE of those two suspensions is lifted. The\n` +
        `  other is not: it is still a castSim result, and OIL-POLICY.md §0a suspends every Δ\n` +
        `  measured in this simulator because it does not reproduce the fishery (sim catch\n` +
        `  ~70% vs a real 27.6%, meter-out 1.0% vs 64.2%). It is NOT a reason to change\n` +
        `  chooseNewCard — that is CLAUDE.md rule 4, and the ship-nothing posture holds.\n`,
    );
  }

  console.log(`  cache: ${cache.size} distinct compositions simulated for ${candidates.length + 1} arms.\n`);
}

main();
