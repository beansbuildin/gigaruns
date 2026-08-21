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
  CURRENT_ROD,
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

  it("the latest cast holds exactly one KNOWN rod", () => {
    // Zero means the account is on a rod nobody has resolved against
    // `/offchain/static` yet — the failure message has to say that, because
    // "add it to the table" and "the constant is stale" are different jobs.
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

  it("the grant table agrees with PLAY, not just with /offchain/static", () => {
    // The independent half. `CARD_CID_array` is what the static payload claims;
    // `fullDeck`'s opening entries are what the server actually dealt. Session
    // 70 confirmed the rod->deck rule by checking both, and this keeps that
    // check running rather than trusting the payload alone.
    expect(grantedPrefix(latest!.fullDeck, REAL_DECK.length)).toEqual(sorted(REAL_DECK));
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
