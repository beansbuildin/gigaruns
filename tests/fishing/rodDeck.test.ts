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
  dealtDeck,
  gearItemIds,
  grantedPrefix,
  latestRodObservation,
  splitByDealtDeck,
  traceDealtDeck,
} from "../../src/sim/fishing/rodDeck.js";
import { isCleanTrace, loadCastTraces } from "../../src/sim/fishing/castTrace.js";

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

describe("dealtDeck — [session 91 §2] the base/rod split, on hand-built decks", () => {
  // Pure-function half. The corpus half is below; this half is what says the
  // classifier is right rather than merely self-consistent, because these
  // inputs are constructed to be unambiguous.
  const loot = [29, 31];

  it("names the un-bonused deck, in the order the server actually sends it", () => {
    expect(dealtDeck([...BASE_DECK])).toBe("base");
    expect(dealtDeck([...BASE_DECK, ...loot])).toBe("base");
  });

  it("names every rod grant it knows, and does not care about grant ORDER", () => {
    for (const grant of Object.values(ROD_CARD_GRANTS)) {
      expect(dealtDeck([...grant, ...loot])).toBe("rod");
      // The Shroom grant arrives upgraded-cards-first on the wire
      // (`[74,75,76,78,1,2,3,4,5,6,...]`), so a classifier that compared the
      // raw prefix would miss it. Reversing is the cheapest proof it sorts.
      expect(dealtDeck([...[...grant].reverse(), ...loot])).toBe("rod");
    }
  });

  it("refuses to guess — an unseen deck, a short deck and a missing deck are all `unknown`", () => {
    // This is the assertion that keeps the split fail-closed. A new rod must
    // NOT be silently folded into either arm; it must show up as a third
    // bucket a caller has to deal with.
    expect(dealtDeck([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])).toBe("unknown");
    expect(dealtDeck([1, 2, 3])).toBe("unknown");
    expect(dealtDeck([])).toBe("unknown");
    expect(dealtDeck(undefined)).toBe("unknown");
  });

  it("reads the OPENING state, not the trace — the field lives on the turn", () => {
    // `fullDeck` is a field of `CastTurn`, not of `CastTrace`; a split written
    // against `trace.fullDeck` classifies nothing and does it silently, because
    // the property is `undefined` rather than absent-and-loud. Session 91's
    // brief made exactly that mistake.
    const trace = { turns: [{ fullDeck: [...BASE_DECK, ...loot] }, { fullDeck: [...BASE_DECK, ...loot, 40] }] };
    expect(traceDealtDeck(trace)).toBe("base");
    expect(traceDealtDeck({ turns: [] })).toBe("unknown");
    expect(traceDealtDeck({ turns: [{}] })).toBe("unknown");
  });

  it("splitByDealtDeck partitions — every item lands in exactly one bucket", () => {
    const mk = (deck: readonly number[]) => ({ turns: [{ fullDeck: [...deck] }] });
    const items = [mk(BASE_DECK), mk(REAL_DECK), mk(ROD_CARD_GRANTS[MAKESHIFT_ROD]!), mk([90, 91, 92, 93, 94, 95, 96, 97, 98, 99])];
    const out = splitByDealtDeck(items);
    expect(out.base).toHaveLength(1);
    expect(out.rod).toHaveLength(2);
    expect(out.unknown).toHaveLength(1);
    expect(out.base.length + out.rod.length + out.unknown.length).toBe(items.length);
  });
});

describe("dealtDeck — against the corpus itself", () => {
  const traces = loadCastTraces().filter(isCleanTrace);
  const split = splitByDealtDeck(traces);

  it("classifies every clean trace, leaving nothing unknown", () => {
    // The ratchet, at the point the split is used: a non-empty `unknown` means
    // a new rod or a new mechanic, and no figure computed off `rod` or `base`
    // is trustworthy until someone has looked at it.
    expect(traces.length).toBeGreaterThan(100);
    expect(split.unknown).toHaveLength(0);
    expect(split.base.length + split.rod.length).toBe(traces.length);
  });

  it("both arms are non-empty — the split is doing work, not passing vacuously", () => {
    expect(split.base.length).toBeGreaterThan(0);
    expect(split.rod.length).toBeGreaterThan(split.base.length);
  });

  it("a cast's dealt deck never changes mid-cast", () => {
    // Measured at 0 of 167 in session 91, and it is the assumption that makes
    // reading turn 0 equivalent to reading any other turn. If a cast could
    // switch decks partway — a rod expiring mid-cast, say — every per-cast
    // figure in `damageEconomy.test.ts` would need re-deriving per PLAY.
    for (const t of traces) {
      const seen = new Set(t.turns.map((turn) => dealtDeck(turn.fullDeck)));
      expect(seen.size, `trace ${t.docId} changed deck mid-cast`).toBe(1);
    }
  });
});
