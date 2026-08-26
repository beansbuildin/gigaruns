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
 * applying.
 *
 * ## ✅ [session 91] THE CAUSE IS NOW KNOWN: THE ROD RAN OUT OF DURABILITY
 *
 * User answer, 2026-08-24 (`QUESTIONS.md` §29 ANSWERED): *"my shroom rod ran
 * out of durability and I didnt notice. Rod has been repaired and will be good
 * for another 40 casts."* That eliminates the other three candidates §29 listed
 * — a per-day grant allowance, a server-side equip desync, a plain bug — and
 * explains the counterexample above exactly: durability belongs to the ROD
 * INSTANCE, not to the equip state, so `GEAR_CID_array` was never wrong. It was
 * answering "is this rod equipped", and the deck answers "does it still have
 * charges".
 *
 * Two things follow, both load-bearing:
 *
 * - **It will recur**, on the user's own ~40-cast horizon from 2026-08-24.
 *   `BASE_DECK` stays an intermittent STATE, so `REAL_DECK` stays pointed at
 *   the rod.
 * - ~~**Nothing here can SEE durability.**~~ **[session 99 §1] FALSE, and it
 *   was false when it was written.** `GET /gear/instances/{address}` carries
 *   **`DURABILITY_CID`** on every row, alongside `EQUIPPED_TO_SLOT_CID`. Read
 *   on 2026-08-26 it says exactly what three sessions of inference had to
 *   reconstruct from dealt decks: Shroom (811) sits at `DURABILITY_CID: 0`
 *   and `EQUIPPED_TO_SLOT_CID: -1`, and the newly-equipped Golkan (812) at
 *   `DURABILITY_CID: 40`, slot 14. The user's "~40 casts" was not an
 *   unverifiable owner report — it is a number the server publishes.
 *
 *   **This is the session-70 mistake repeated exactly.** That one concluded
 *   rod `itemEffects` were empty because `/gear/items` did not carry the
 *   grant, when `/offchain/static` did — *"the wrong place to look, not the
 *   wrong question."* This file then made the identical error one endpoint
 *   over: durability was looked for in the FISHING doc and in the fixtures,
 *   found absent, and declared nonexistent. The GEAR endpoint was never
 *   asked. **A field being absent from the payloads a repo happens to record
 *   is not evidence it does not exist**, and this file has now been wrong
 *   that way twice.
 *
 *   The consequence is that a base-deck window is no longer detectable only
 *   AFTER the fact. `DURABILITY_CID` on the equipped rod is a forward-looking
 *   read, so the ~40-cast horizon is checkable before a batch rather than
 *   reconstructed from the decks it was dealt. Nothing in this repo consumes
 *   it yet — that is a wiring job, not a discovery one.
 *
 * Two smaller corrections fall out of the same read, both of which made the old
 * claim look better-supported than it was:
 *
 * - **`GEAR_CID_array` holds more than one rod.** Every recent cast lists both
 *   Stone Rod (50) and Shroom Rod (811). The array therefore never identified
 *   the ACTIVE rod; `latestRodObservation`'s `known` filter hid that, because
 *   50 is absent from `ROD_CARD_GRANTS`.
 * - **44 of the corpus's 167 clean casts were dealt `BASE_DECK`**, in two
 *   windows (27 on 2026-08-17, 17 on 2026-08-24). [session 91] These counts are
 *   recomputed through `splitByDealtDeck` below; session 89's "38 of 149 (21 +
 *   17)" and session 90's "22" were both counted by hand and neither
 *   reproduces. Those casts are neither Makeshift-era-with-a-rod nor
 *   Shroom-era-with-a-rod traces, and until session 91 no figure in this repo
 *   said so.
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
 * ## ⚠ [session 99 §1] THE SHROOM/GOLKAN BREAK — A ROD CHANGE THAT IS **NOT**
 * ## A GEOMETRY CHANGE, WHICH MAKES IT MUCH SOFTER THAN THE ONE BELOW
 *
 * The account swapped to **Golkan (812)** at 2026-08-26T02:27:20Z. Nine of
 * the ten granted ids are new, so a count of changed card ids makes this look
 * like the largest deck break yet. It is not, and reporting it that way would
 * be wrong: **the two decks are positionally IDENTICAL.**
 *
 * ```
 *   zones            Shroom            Golkan          delta
 *   [1,2,3]          1  (+5/-3)        80 (+6/-3)      hit +1
 *   [4,5,6]          2  (+5/-3)        81 (+6/-3)      hit +1
 *   [7,8,9]          3  (+5/-3)        84 (+6/-3)      hit +1
 *   [1,4,7]          4  (+5/-3)        85 (+6/-3)      hit +1
 *   [2,5,8]          5  (+5/-3)        86 (+6/-3)      hit +1
 *   [3,6,9]          6  (+5/-3)        87 (+6/-3)      hit +1
 *   [1,3,7,9]        74 (+7/-4)        74 (+7/-4)      SAME CARD
 *   [2,4,6,8]        75 (+6/-4)        88 (+8/-4)      hit +2
 *   ring (8 cells)   76 (+3/-3)        89 (+4/-4)      hit +1, MISS -1
 *   centre crit      78 (crit+11/-3)   90 (crit+12/-3) crit +1
 * ```
 *
 * Same ten hit-zone sets, same mana cost (1) on all ten, one card literally
 * shared. So it is the same relationship `BASE_DECK` has to the rod grants —
 * *"positionally the same deck, one tier worse"* — running in the other
 * direction: Golkan is the same deck one tier BETTER.
 *
 * **What that means for the pinned numbers, stated so nobody re-derives it.**
 * Anything keyed to GEOMETRY — zone coverage, the ring/contextual predictors,
 * the mined pattern library, the matcher, focus movement — is keyed to
 * quantities this swap does not touch, and transfers. Anything keyed to
 * DAMAGE MAGNITUDE — EV per card, lethality bands, `fishMaxHp` turn counts,
 * the necessity gate's `fishHp <= 2` arm — is on a deck that now hits harder
 * on every single card, and does not transfer unexamined. Card 89 is the one
 * genuine regression (miss -4 against 76's -3) and is the only place the new
 * deck is worse than the old one.
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
/** [session 99 §1] The rod the account swapped to at 2026-08-26T02:27:20Z. */
export const GOLKAN_ROD = 812;

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
  // [session 99 §1] Re-read live off `/offchain/static` on 2026-08-26, and
  // CONFIRMED AGAINST PLAY the same session: both casts of the two-cast batch
  // opened on exactly this prefix. The other six rods' grants were re-read in
  // the same call and none of them changed.
  [GOLKAN_ROD]: [74, 80, 81, 84, 85, 86, 87, 88, 89, 90],
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

/**
 * The rod the account holds. Repointed from Makeshift on 2026-08-21 (session
 * 71 §2), and from Shroom to **Golkan on 2026-08-26** (session 99 §1).
 *
 * The Golkan repoint is made on BOTH halves of the evidence this file requires
 * — `/offchain/static`'s payload AND play — rather than on the payload alone,
 * because session 89's counterexample is precisely a rod being equipped while
 * its grant is not dealt. Both casts of session 99's batch opened on the
 * Golkan prefix, and `GEAR_CID_array` carries 812 with 811 gone.
 */
export const CURRENT_ROD = GOLKAN_ROD;

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
 * **[session 99 §1] The deck the COMMITTED CORPUS was played on — which is no
 * longer the deck the account holds.**
 *
 * Several tests and scripts run a SIM arm and compare it against a quantity
 * derived from the live corpus: `damageEconomy.test.ts` asserts the sim
 * "reproduces live's per-card AMOUNTS", `focusMovement.test.ts` pins turn
 * counts against corpus-shaped casts, `fishMaxHp.test.ts` pins a default path.
 * Every one of those built its sim arm from `REAL_DECK`.
 *
 * **That was only ever correct by coincidence.** `REAL_DECK` means "the deck
 * the account holds right now"; those call sites need "the deck the thing I am
 * comparing against was played on". The two were the same constant from
 * session 71 until 2026-08-26, so nothing distinguished them — and the moment
 * the rod changed, three tests started comparing a Golkan sim to a Shroom
 * capture and failing on the difference. `damageEconomy`'s `meanHeal` gap went
 * to 0.765 against a 0.5 tolerance, which is almost exactly the +1 hit that
 * every Golkan row-and-column card carries over its Shroom counterpart: the
 * tests were not wrong, they were correctly detecting a comparison that had
 * become invalid.
 *
 * So this constant is Shroom, and it stays Shroom until the corpus itself is
 * majority-Golkan. It is deliberately NOT an alias for `REAL_DECK`:
 *
 * - **Widening those tolerances would have been the wrong fix** — it would
 *   have thrown away a working cross-check between sim and live to paper over
 *   a deck mismatch, and it would have had to be widened again on the next
 *   rod.
 * - **Re-blessing those pins to their Golkan values would have been worse** —
 *   the pinned numbers would then describe a sim on a deck the corpus they are
 *   compared against was never played on.
 *
 * The corpus is 210 casts of which **2** are Golkan. When that ratio inverts,
 * repoint this at `REAL_DECK` and re-bless the pins in one deliberate pass —
 * that is a re-baselining, and it should look like one.
 */
export const CORPUS_DECK: readonly number[] = ROD_CARD_GRANTS[SHROOM_ROD]!;

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

/**
 * Which of the two known regimes a cast was actually DEALT — the split
 * `QUESTIONS.md` §29 opened and §31 ruled on.
 *
 * - `"base"` — the un-bonused `[1..10]`. **[session 91] The cause is now known:
 *   the account's Shroom Rod had run out of DURABILITY, unnoticed.** It is an
 *   equipment-failure interval, not a second fishery, and it is expected to
 *   recur every time the rod runs dry again (see `QUESTIONS.md` §29 ANSWERED).
 * - `"rod"` — any grant in `ROD_CARD_GRANTS`. Deliberately not split further
 *   into Makeshift and Shroom: that break is real and is stated separately (see
 *   THE MAKESHIFT/SHROOM BREAK above), but it is a different question from
 *   "was a rod bonus applying at all", which is the one this answers.
 * - `"unknown"` — a prefix outside `KNOWN_DEALT_DECKS`, INCLUDING a cast whose
 *   opening state carried no `fullDeck` at all. Genuinely new; the ratchet in
 *   `tests/fishing/rodDeck.test.ts` fails on it. Callers must not silently fold
 *   this into either arm, which is why the third case is a named value and not
 *   a `null` that a filter would drop by accident.
 *
 * ONE definition, shared by `tests/fishing/damageEconomy.test.ts` and
 * `scripts/damageEconomy.ts`, for the same reason `REAL_DECK` is one
 * definition: three scripts carrying their own copy of the deck is how the
 * stale Makeshift value survived 110 traces.
 */
export type DealtDeck = "base" | "rod" | "unknown";

const sameSet = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const SORTED_BASE_DECK: readonly number[] = [...BASE_DECK].sort((a, b) => a - b);

/**
 * `fullDeck`'s opening grant, classified. `grantSize` defaults to the current
 * rod's grant length — every known deck, base included, is that long, so a
 * caller has no reason to pass it and the parameter exists only so a future rod
 * with a different grant size does not need this function rewritten.
 */
export function dealtDeck(
  fullDeck: readonly number[] | undefined,
  grantSize: number = REAL_DECK.length,
): DealtDeck {
  if (!fullDeck || fullDeck.length < grantSize) return "unknown";
  const prefix = grantedPrefix(fullDeck, grantSize);
  if (sameSet(prefix, SORTED_BASE_DECK)) return "base";
  for (const grant of Object.values(ROD_CARD_GRANTS)) {
    if (sameSet(prefix, [...grant].sort((a, b) => a - b))) return "rod";
  }
  return "unknown";
}

/**
 * ⚠ **`fullDeck` lives on the TURN, not on the trace.** The session-91 brief
 * placed it on `CastTrace` (citing `castTrace.ts` line 107, which is inside the
 * `CastTurn` interface); `loadCastTraces` populates it on **0 of 167** traces
 * because no such trace field exists. Read it off the OPENING state, before any
 * loot has been appended to the tail.
 *
 * Structurally typed rather than taking `CastTrace` so `rodDeck.ts` keeps
 * importing nothing from this repo — the sim/api separation stays intact and
 * there is no cycle to reason about.
 */
export interface HasOpeningDeck {
  turns: readonly { fullDeck?: readonly number[] }[];
}

/** The deck a recorded cast was dealt, read off its opening state. */
export function traceDealtDeck(trace: HasOpeningDeck, grantSize: number = REAL_DECK.length): DealtDeck {
  return dealtDeck(trace.turns[0]?.fullDeck, grantSize);
}

/**
 * Partition recorded casts by the deck they were dealt. The one implementation
 * of the split — `tests/fishing/damageEconomy.test.ts` and
 * `scripts/damageEconomy.ts` both call this rather than each filtering their
 * own way, so the test and the report it backs cannot drift apart.
 */
export function splitByDealtDeck<T extends HasOpeningDeck>(
  traces: readonly T[],
  grantSize: number = REAL_DECK.length,
): Record<DealtDeck, T[]> {
  const out: Record<DealtDeck, T[]> = { base: [], rod: [], unknown: [] };
  for (const t of traces) out[traceDealtDeck(t, grantSize)].push(t);
  return out;
}
