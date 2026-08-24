/**
 * tests/fishing/rodDeck.test.ts — [session 71 §2] the ratchet on `REAL_DECK`.
 *
 * The user chose a repointed CONSTANT over a per-cast deck read. That choice is
 * only safe if the constant cannot go stale silently, and it already did once:
 * the account swapped rods on 2026-08-21 and three sim scripts kept simulating
 * the Makeshift deck, unnoticed, until session 70 went looking for something
 * else. This file is what makes the next rod change fail the build instead.
 *
 * Read-only: it reads `fixtures/`, and writes nothing anywhere.
 */

import { describe, expect, it } from "vitest";
import {
  BASE_DECK,
  CURRENT_ROD,
  KNOWN_DEALT_DECKS,
  MAKESHIFT_ROD,
  REAL_DECK,
  ROD_CARD_GRANTS,
  SHROOM_ROD,
  gearItemIds,
  grantedPrefix,
  latestRodObservation,
} from "../../src/sim/fishing/rodDeck.js";

const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

describe("REAL_DECK tracks the rod the account actually holds", () => {
  const latest = latestRodObservation();

  it("finds a most-recent cast to check against", () => {
    // A corpus that has stopped yielding an observation would make every
    // assertion below vacuously pass, which is the one way this guard could
    // fail open.
    expect(latest).not.toBeNull();
    expect(latest!.fullDeck.length).toBeGreaterThanOrEqual(REAL_DECK.length);
  });

  it("the latest cast holds exactly one rod ROD_CARD_GRANTS knows", () => {
    // Zero means the account is on a rod nobody has resolved against
    // `/offchain/static` yet — the failure message has to say that, because
    // "add it to the table" and "the constant is stale" are different jobs.
    //
    // [session 89] Read the title literally: this is one KNOWN rod, not one
    // rod. The unfiltered `GEAR_CID_array` carries Stone Rod (50) as well, so
    // widening `ROD_CARD_GRANTS` to all eight rods would make this fail —
    // which is itself the point that `GEAR_CID_array` cannot name the ACTIVE
    // rod, and the reason the PLAY check below no longer asserts equality.
    expect(
      latest!.rodIds,
      `no known rod in the latest cast's GEAR_CID_array (${JSON.stringify(latest!.rodIds)}). ` +
        `Read /offchain/static's gameItems[].CARD_CID_array for the new rod and add it to ROD_CARD_GRANTS.`,
    ).toHaveLength(1);
  });

  it("CURRENT_ROD is that rod", () => {
    expect(
      latest!.rodIds[0],
      `the account is holding rod ${latest!.rodIds[0]} as of cast ${latest!.docId} (${latest!.createdAt}), ` +
        `but CURRENT_ROD is ${CURRENT_ROD}. Repoint it — and date every figure computed on the old deck ` +
        `as pre-repoint rather than restating it as current.`,
    ).toBe(CURRENT_ROD);
  });

  it("REAL_DECK is that rod's CARD_CID_array", () => {
    expect(sorted(REAL_DECK)).toEqual(sorted(ROD_CARD_GRANTS[latest!.rodIds[0]!]!));
  });

  it("PLAY dealt a deck this repo has seen before", () => {
    // The independent half, and [session 89] the only form of it that survives.
    // `CARD_CID_array` is what the static payload claims; `fullDeck`'s opening
    // entries are what the server actually dealt. This used to assert the two
    // are EQUAL. They are not: 38 of 149 casts were dealt `BASE_DECK` with the
    // rod still sitting in `GEAR_CID_array`, twice flipping between consecutive
    // casts 15s apart with a byte-identical gear array. So the ratchet now
    // guards the half that is still true — an UNRECOGNISED deck is a finding —
    // and the equality claim is recorded as falsified in `rodDeck.ts` and
    // `QUESTIONS.md` §29 rather than quietly relaxed to a tolerance.
    const dealt = grantedPrefix(latest!.fullDeck, REAL_DECK.length);
    expect(
      KNOWN_DEALT_DECKS.map((d) => JSON.stringify(sorted(d))),
      `cast ${latest!.docId} (${latest!.createdAt}) was dealt ${JSON.stringify(dealt)}, which is not a deck ` +
        `this repo knows. Read /offchain/static's gameItems[].CARD_CID_array — if it is a rod's grant, add ` +
        `the rod to ROD_CARD_GRANTS; if it is not, it is a second BASE_DECK-class finding and §29 wants it.`,
    ).toContain(JSON.stringify(sorted(dealt)));
  });

  it("says out loud whether the account is currently IN a base-deck window", () => {
    // Not a pass/fail on which deck it is — both are legitimate states. This
    // exists so the fact is asserted somewhere rather than inferred, because a
    // sim figure quoted against a base window is a Makeshift/Shroom-class
    // mistake and nothing else in the suite would catch it.
    const dealt = grantedPrefix(latest!.fullDeck, REAL_DECK.length);
    const onBase = JSON.stringify(dealt) === JSON.stringify(sorted(BASE_DECK));
    // As of the corpus this test was last regenerated against, the account's
    // most recent 17 casts are base-deck. If this flips, the rod grant came
    // back — update the constant below and re-read §29, which may have its
    // answer in the timing of the flip.
    expect(
      onBase,
      onBase
        ? "the latest cast is BASE_DECK — REAL_DECK is the rod's grant and does NOT describe current play"
        : "the latest cast is the rod's grant again — the base window ended; note when, it is §29 evidence",
    ).toBe(true);
  });
});

describe("the rod table itself", () => {
  it("records both rods this account has played, ascending", () => {
    expect(ROD_CARD_GRANTS[MAKESHIFT_ROD]).toEqual([1, 2, 3, 4, 5, 6, 7, 76, 77, 79]);
    expect(ROD_CARD_GRANTS[SHROOM_ROD]).toEqual([1, 2, 3, 4, 5, 6, 74, 75, 76, 78]);
    for (const grant of Object.values(ROD_CARD_GRANTS)) {
      expect(grant, "grants are stored sorted so comparisons never depend on payload order").toEqual(sorted(grant));
    }
  });

  it("the two rods really are different decks", () => {
    // Guards the guard: if someone repoints by copying the wrong array, every
    // assertion above still passes and nothing has been ratcheted.
    expect(ROD_CARD_GRANTS[MAKESHIFT_ROD]).not.toEqual(ROD_CARD_GRANTS[SHROOM_ROD]);
  });

  it("BASE_DECK is [1..10] and is no rod's grant", () => {
    // [session 89] The second half is the load-bearing one. All eight rods in
    // `/offchain/static` (49, 50, 336, 811, 812, 922, 923, 924) were checked and
    // none grants this set, which is what rules out "a third rod got equipped"
    // as the explanation for the base windows.
    expect(BASE_DECK).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const [rod, grant] of Object.entries(ROD_CARD_GRANTS)) {
      expect(sorted(grant), `rod ${rod} must not grant BASE_DECK`).not.toEqual(sorted(BASE_DECK));
    }
  });

  it("KNOWN_DEALT_DECKS is every grant plus the base deck, and nothing else", () => {
    expect(KNOWN_DEALT_DECKS).toHaveLength(Object.keys(ROD_CARD_GRANTS).length + 1);
    expect(KNOWN_DEALT_DECKS).toContain(BASE_DECK);
  });
});

describe("gearItemIds", () => {
  it("reads the item id and ignores the mint stamp", () => {
    // The suffix is a MINT stamp, not an equip stamp (session 70) — parsing it
    // as a time is the mistake this signature exists to prevent.
    expect(gearItemIds(["GearInstance#811_1787332895_d777fbaa", "GearInstance#951_1787254688_dab73d91"])).toEqual([811, 951]);
    expect(gearItemIds(["GearInstance#109_1752766722"])).toEqual([109]);
    expect(gearItemIds(undefined)).toEqual([]);
    expect(gearItemIds(["nonsense"])).toEqual([]);
  });
});
