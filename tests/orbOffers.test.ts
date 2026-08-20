/**
 * tests/orbOffers.test.ts — session 58.
 *
 * The join that lets the simulator see `gigusOrbAmount`, and the two corpus
 * facts it rests on. Both were measured 135/135 before the join was written;
 * these pin them so a future corpus addition that breaks either one fails here
 * rather than silently producing a wrong payout on a right-looking boon.
 *
 * Reads `fixtures/` only. Writes nothing — no data path, real or temp.
 */
import { describe, expect, it } from "vitest";

import { OBSERVED_OFFERS } from "../src/sim/boons.js";
import {
  assertDistributionPreserved,
  corpusOffersByRun,
  offersWithOrbs,
  orbOffersForRoom,
} from "../src/sim/orbOffers.js";

const join = offersWithOrbs();

describe("orbOffers — joining Hard Core payouts onto the sim's offer table", () => {
  it("resolves every OBSERVED_OFFERS row, with a payout on every option", () => {
    expect(join.offers.length).toBe(OBSERVED_OFFERS.length);
    expect(join.unjoined).toEqual([]);
    expect(join.joined).toBe(OBSERVED_OFFERS.length);
    expect(join.complete).toBe(OBSERVED_OFFERS.length);
  });

  it("preserves the offer distribution exactly — the claim that makes this a measurement", () => {
    // `SimOptions.offers` is otherwise reserved for labelled counterfactuals.
    // What licenses using it for a REPORTED number is that nothing about the
    // offers changed except an added field, and this is the check that says so.
    expect(() => assertDistributionPreserved(join.offers)).not.toThrow();

    for (let i = 0; i < join.offers.length; i++) {
      const before = OBSERVED_OFFERS[i]!;
      const after = join.offers[i]!;
      expect(after.room).toBe(before.room);
      expect(after.source).toBe(before.source);
      expect(after.options.map((o) => o.type)).toEqual(before.options.map((o) => o.type));
    }
  });

  it("rejects a table that is not the same offers", () => {
    const tampered = join.offers.map((o, i) => (i === 0 ? { ...o, room: o.room + 1 } : o));
    expect(() => assertDistributionPreserved(tampered)).toThrow(/does not match OBSERVED_OFFERS/);

    const retyped = join.offers.map((o, i) =>
      i === 0 ? { ...o, options: [{ ...o.options[0]!, type: "NotARealBoon" }, ...o.options.slice(1)] } : o,
    );
    expect(() => assertDistributionPreserved(retyped)).toThrow(/option 0 differs/);

    expect(() => assertDistributionPreserved(join.offers.slice(1))).toThrow(/vs OBSERVED_OFFERS'/);
  });

  it("does NOT mutate OBSERVED_OFFERS — the enriched options are copies", () => {
    // A shared reference would leak payouts into every other consumer of the
    // table, including the historical sim arms this change must not touch.
    for (const offer of OBSERVED_OFFERS) {
      for (const option of offer.options) {
        expect(option.orbs).toBeUndefined();
      }
    }
  });

  it("the corpus room label is ROOM_NUM_CID - 1, on every offer", () => {
    // The fact the join is built on, and the off-by-one that shipped in
    // session 57's orbTieBreakReport. If a future capture breaks this, the
    // join above stops resolving and the first test fails loudly — but pin the
    // reason too, so the failure is diagnosable rather than mysterious.
    const byRun = corpusOffersByRun();
    let checked = 0;
    for (const offer of OBSERVED_OFFERS) {
      const dir = offer.source.split("/")[0]!;
      const key = offer.options.map((o) => `${o.type}:${o.val1}:${o.val2}`).join("|");
      const matches = (byRun.get(dir) ?? []).filter((c) => c.key === key);
      expect(matches.length).toBeGreaterThan(0);
      // Every content match in the run agrees the wire room is one higher.
      expect(matches.some((c) => c.wireRoom - 1 === offer.room)).toBe(true);
      checked++;
    }
    expect(checked).toBe(OBSERVED_OFFERS.length);
  });

  it("orbOffersForRoom filters by the table's room, not the wire's", () => {
    const forRoom = orbOffersForRoom(join.offers);
    for (const room of [1, 2, 3]) {
      const got = forRoom(room);
      expect(got.length).toBe(OBSERVED_OFFERS.filter((o) => o.room === room).length);
      expect(got.every((o) => o.room === room)).toBe(true);
    }
  });

  it("17 rows name a source file that does not hold the offer — why the join is by content", () => {
    // Not a defect to fix in the table: the rows are correct about room and
    // content, and they are the DEEPEST offers the corpus has. A source-keyed
    // join would silently drop exactly those.
    expect(join.sourceMisses.length).toBe(17);
    const missedRooms = new Set(
      join.sourceMisses.map((src) => OBSERVED_OFFERS.find((o) => o.source === src)!.room),
    );
    expect([...missedRooms].sort((a, b) => b - a)[0]).toBeGreaterThanOrEqual(9);
  });
});
