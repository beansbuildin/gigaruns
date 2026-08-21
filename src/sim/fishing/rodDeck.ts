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
 * Confirmed against PLAY rather than only against the payload: every cast's
 * `doc.data.fullDeck` opens with exactly the granted set, and the account
 * swapped Makeshift Rod (922) for Shroom Rod (811) at **2026-08-21T19:58:29Z**,
 * with `GEAR_CID_array` swapping the rod on the same cast the deck flips.
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

/** The rod the account holds. Repointed from Makeshift on 2026-08-21 (session 71 §2). */
export const CURRENT_ROD = SHROOM_ROD;

/**
 * The deck every sim script starts from. ONE definition — three scripts
 * declared their own copy of this before session 71, which is how the stale
 * Makeshift value survived the rod change.
 */
export const REAL_DECK: readonly number[] = ROD_CARD_GRANTS[CURRENT_ROD]!;

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
  /** Every rod id present in that cast's own `GEAR_CID_array`. More than one would be a finding. */
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
 * The starting grant as PLAY reports it: the opening `|grant|` entries of
 * `fullDeck`, sorted. Everything after them is loot picked up during the cast.
 *
 * This is the half that checks the table against the game rather than against
 * `/offchain/static`'s own payload — the two are independent observations and
 * the guard test asserts they agree.
 */
export function grantedPrefix(fullDeck: readonly number[], grantSize: number): number[] {
  return [...fullDeck.slice(0, grantSize)].sort((a, b) => a - b);
}
