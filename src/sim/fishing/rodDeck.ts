/**
 * src/sim/fishing/rodDeck.ts — [session 71 §2] the account's starting deck, and
 * the ratchet that makes the next rod change loud.
 *
 * ## A rod grants the starting deck — CONFIRMED (session 70 §5a)
 *
 * `/offchain/static`'s `gameItems[].CARD_CID_array` carries the grant;
 * `/gear/items` does not, which is why session 15 concluded rod `itemEffects`
 * were empty. That was the wrong place to look, not the wrong question.
 *
 * Confirmed against PLAY rather than only against the payload: the account
 * swapped Makeshift Rod (922) for Shroom Rod (811) at **2026-08-21T19:58:29Z**,
 * and `GEAR_CID_array` swaps the rod on the same cast the deck flips.
 *
 * ## ⚠ [session 89] THE STRONGER READING OF THAT IS FALSIFIED: A ROD BEING IN
 * ## `GEAR_CID_array` DOES NOT MEAN ITS GRANT IS DEALT
 *
 * The claim this file used to carry — *"every cast's `fullDeck` opens with
 * exactly the granted set"* — is not true of the corpus, and the counterexample
 * is as tight as one can get. Two consecutive casts **15 seconds apart** with a
 * **byte-identical `GEAR_CID_array`** (same instances, same mint stamps) were
 * dealt different decks:
 *
 * ```
 *   2026-08-24T00:01:31.205Z   [74,75,76,78,1,2,3,4,5,6,29]   <- Shroom grant
 *   2026-08-24T00:01:46.915Z   [ 1, 2, 3, 4,5,6,7,8,9,10,29]   <- BASE_DECK
 * ```
 *
 * Same node (5), same level (20), same `day` (20688), same juice, same looted
 * tail (`29`). It had happened once before — 2026-08-17T05:57:37.799Z, also
 * gear-identical across the flip — and that window ENDED, the rod deck coming
 * back on 2026-08-18. So `BASE_DECK` is an intermittent STATE, not a new
 * baseline, which is why `REAL_DECK` is deliberately NOT repointed to it.
 *
 * **`BASE_DECK` is not any rod's grant.** All eight rods in `/offchain/static`
 * were checked (49, 50, 336, 811, 812, 922, 923, 924) and none carries
 * `[1..10]`, so this is not a third rod being read — it is the rod bonus not
 * applying. The cause is UNKNOWN and deliberately not guessed at; see
 * `QUESTIONS.md` §29.
 *
 * Two smaller corrections fall out of the same read, both of which made the old
 * claim look better-supported than it was:
 *
 * - **`GEAR_CID_array` holds more than one rod.** Every recent cast lists both
 *   Stone Rod (50) and Shroom Rod (811). The array therefore never identified
 *   the ACTIVE rod; `latestRodObservation`'s `known` filter hid that, because
 *   50 is absent from `ROD_CARD_GRANTS`.
 * - **38 of the corpus's 149 casts were dealt `BASE_DECK`**, in two windows
 *   (21 on 2026-08-17, 17 on 2026-08-24). Those are neither Makeshift-era nor
 *   Shroom-era traces, and no figure in this repo has ever said so.
 *
 * ## Why a CONSTANT and not a per-cast read
 *
 * User decision, 2026-08-21: repoint and re-baseline, rather than teach every
 * sim script to resolve the deck per cast. The cost of that choice is that the
 * constant can go stale silently — which is exactly what happened, unnoticed,
 * through 110 traces. `tests/fishing/rodDeck.test.ts` is the price of the
 * choice: it fails when `REAL_DECK` no longer matches the rod the account is
 * actually holding in the most recent recorded cast.
 *
 * ## ⚠ THE MAKESHIFT/SHROOM BREAK
 *
 * 110 of the corpus's 123 clean traces were played on **Makeshift**. Any number
 * in `handoff/reports/`, `SPEC-fishing.md` or a script header computed before
 * 2026-08-21 is a Makeshift-era number. Do not restate one as current, and if a
 * comparison spans the break, say that it spans the break.
 *
 * Pure apart from reading the recorded fixtures — no network (CLAUDE.md's
 * sim/api split).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MAKESHIFT_ROD = 922;
export const SHROOM_ROD = 811;

/**
 * `gameItems[].CARD_CID_array`, read live off `/offchain/static` on 2026-08-21.
 * Sorted ascending so comparisons never depend on the payload's own order.
 *
 * A rod absent from this table is not an error in the table — it is a rod
 * nobody has read `/offchain/static` for yet. The guard test says so rather
 * than guessing.
 */
export const ROD_CARD_GRANTS: Readonly<Record<number, readonly number[]>> = {
  [MAKESHIFT_ROD]: [1, 2, 3, 4, 5, 6, 7, 76, 77, 79],
  [SHROOM_ROD]: [1, 2, 3, 4, 5, 6, 74, 75, 76, 78],
};

/**
 * The deck dealt when NO rod grant applies — `[1..10]`, the six base cards plus
 * the four unupgraded variants a rod replaces.
 *
 * Positionally it is the same deck the rods grant, one tier worse: 7/8/9/10
 * cover exactly the hit zones 74/75/76/78 do (`[1,3,7,9]`, `[2,4,6,8]`, the
 * eight-cell ring, and the centre-crit card) with lower hit and worse miss
 * numbers. That is what identifies it as the un-bonused deck rather than a
 * ninth rod — and `/offchain/static` confirms it: none of the eight rods grants
 * this set.
 */
export const BASE_DECK: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The rod the account holds. Repointed from Makeshift on 2026-08-21 (session 71 §2). */
export const CURRENT_ROD = SHROOM_ROD;

/**
 * The deck every sim script starts from. ONE definition — three scripts
 * declared their own copy of this before session 71, which is how the stale
 * Makeshift value survived the rod change.
 *
 * ⚠ [session 89] This is the CURRENT ROD'S GRANT, and the account's most recent
 * 17 casts were not dealt it — they were dealt `BASE_DECK`. It is left pointing
 * at the rod because the base window is intermittent (the 2026-08-17 one ended)
 * and because repointing would silently re-baseline every pinned sim number in
 * `tests/fishing/`. Any sim figure quoted against play from a base window must
 * say which deck it used, exactly as the Makeshift/Shroom break requires.
 */
export const REAL_DECK: readonly number[] = ROD_CARD_GRANTS[CURRENT_ROD]!;

/**
 * Every starting deck this repo has SEEN DEALT — the rod grants it knows, plus
 * the un-bonused `BASE_DECK`. A dealt prefix outside this set is a genuinely new
 * deck and `tests/fishing/rodDeck.test.ts` fails on it, which is the half of the
 * old ratchet that survives session 89 intact.
 */
export const KNOWN_DEALT_DECKS: readonly (readonly number[])[] = [
  ...Object.values(ROD_CARD_GRANTS),
  BASE_DECK,
];

/** `GearInstance#<itemId>_<mintStamp>[_<hash>]`. The suffix is a MINT stamp, never an equip time (session 70). */
export function gearItemIds(arr: unknown): number[] {
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((e) => {
    const m = /^GearInstance#(\d+)_/.exec(String(e));
    return m ? [Number(m[1])] : [];
  });
}

export interface RodObservation {
  docId: string;
  createdAt: string;
  /**
   * Every rod id present in that cast's own `GEAR_CID_array` **that `known`
   * lists**. [session 89] The unfiltered array really does hold more than one
   * rod — Stone (50) sits alongside Shroom (811) on every recent cast — so this
   * being length 1 is a property of the filter, not of the account.
   */
  rodIds: number[];
  /** `doc.data.fullDeck`, verbatim — starting grant first, then everything looted since. */
  fullDeck: number[];
}

interface DocShape {
  docId?: string;
  createdAt?: string;
  updatedAt?: string;
  GEAR_CID_array?: unknown;
  data?: { fullDeck?: unknown };
}

function docOf(json: unknown): DocShape | null {
  const j = json as { gameState?: DocShape; data?: { doc?: DocShape } };
  return j.gameState ?? j.data?.doc ?? null;
}

/**
 * The most recently created cast in the corpus, and the gear it was played on.
 *
 * Keyed on the doc's own `createdAt` rather than on directory name ordering: a
 * fixture directory is one INVOCATION of `liveFishing.ts` and several hold more
 * than one cast (session 68 §4b), so directory order is not cast order.
 *
 * `known` is the set of rod ids to look for. Passing it in keeps this function
 * from deciding what counts as a rod — the caller owns that, and the guard test
 * wants to distinguish "the rod changed" from "the rod is one we have never
 * resolved against `/offchain/static`".
 */
export function latestRodObservation(
  root: string = join("fixtures", "fishing-casts"),
  known: readonly number[] = Object.keys(ROD_CARD_GRANTS).map(Number),
): RodObservation | null {
  let best: RodObservation | null = null;
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(dir, name);
      if (name.startsWith("state-") && name.endsWith(".json")) {
        let doc: DocShape | null;
        try {
          doc = docOf(JSON.parse(readFileSync(p, "utf8")));
        } catch {
          continue;
        }
        const deck = doc?.data?.fullDeck;
        if (!doc?.docId || !Array.isArray(deck)) continue;
        const createdAt = doc.createdAt ?? doc.updatedAt ?? "";
        if (best !== null && createdAt <= best.createdAt) continue;
        best = {
          docId: doc.docId,
          createdAt,
          rodIds: gearItemIds(doc.GEAR_CID_array).filter((id) => known.includes(id)),
          fullDeck: deck.map(Number),
        };
      } else if (!name.includes(".")) {
        walk(p);
      }
    }
  };
  walk(root);
  return best;
}

/**
 * The starting deck as PLAY reports it: the opening `|grant|` entries of
 * `fullDeck`, sorted. Everything after them is loot picked up during the cast.
 *
 * This is the half that reads the game rather than `/offchain/static`'s payload.
 * [session 89] It is no longer asserted to EQUAL the rod's grant — it does not,
 * in 38 of 149 casts — only to be one of `KNOWN_DEALT_DECKS`.
 */
export function grantedPrefix(fullDeck: readonly number[], grantSize: number): number[] {
  return [...fullDeck.slice(0, grantSize)].sort((a, b) => a - b);
}
