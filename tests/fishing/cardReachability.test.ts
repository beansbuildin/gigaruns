/**
 * tests/fishing/cardReachability.test.ts — [session 112, TASKS.md §13]
 *
 * Pins `positionalReachability` / `meanZoneCoverage` against the REAL card
 * catalog, and pins the two corpus facts that motivated them.
 *
 * Neither function is wired into `chooseNewCard`. §13's gate is parked on a
 * DATA floor (real card choices reaching double digits), not on missing code,
 * so these ship as measured quantities for §13 to score when it unparks —
 * CLAUDE.md rule 6.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  chooseNewCard,
  meanZoneCoverage,
  positionalReachability,
  type FishingCardLike,
} from "../../src/strategy/fishing/cardChoice.js";

const CATALOG: FishingCardLike[] = JSON.parse(
  readFileSync(join("fixtures", "fishing-casts", "cards.json"), "utf8"),
).entities;
const BY_ID = new Map(CATALOG.map((c) => [c.id, c]));
const GRID = 3;
const card = (id: number): FishingCardLike => {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`card ${id} missing from the catalog fixture`);
  return c;
};

describe("positionalReachability — pure geometry, no model", () => {
  it("is 1 for a card whose zones cover the whole template", () => {
    // Card 16: hitZones 1..9. From any focus cell at least one zone lands.
    expect(positionalReachability(card(16), GRID)).toBe(1);
  });

  it("is 2/3 for a single row or column of three", () => {
    // Fired from the row/column at the board edge, all three zones translate
    // off-board — 3 of the 9 focus cells are dead. This is the shape behind
    // every member of `matcherHeadroom`'s guaranteed-miss set.
    for (const id of [1, 3, 4, 6, 84]) {
      expect(positionalReachability(card(id), GRID), `card ${id}`).toBeCloseTo(2 / 3, 10);
    }
  });

  it("counts crit zones too — card 35's lone crit zone buys back one cell", () => {
    // hitZones [1,4,7] alone would be 2/3; critZones [2] lifts it to 8/9.
    expect(positionalReachability(card(35), GRID)).toBeCloseTo(8 / 9, 10);
  });

  it("is 0 only for a card with no zones at all — and the catalog has none", () => {
    // ⚠ THE CORRECTION. STATE.md (session 110/111) carried card 84 as having
    // "no on-grid footprint". Card 84 is `hitZones: [7,8,9]`, hit 6, mana 1 —
    // strictly better than card 3, which has the same zones for 5.
    // `matcherHeadroom`'s set is PER PLAY and POSITIONAL ("could not hit from
    // the cell it was fired from"), not a property of the card.
    //
    // So a "never take a footprint-less card" rule would govern the EMPTY SET.
    // This assertion is what stops that rule being written.
    expect(CATALOG.filter((c) => positionalReachability(c, GRID) === 0)).toEqual([]);
    expect(positionalReachability({ ...card(84), hitZones: [], critZones: [] }, GRID)).toBe(0);
  });

  it("the whole catalog sits in exactly three bands", () => {
    const bands = new Map<string, number>();
    for (const c of CATALOG) {
      const k = positionalReachability(c, GRID).toFixed(3);
      bands.set(k, (bands.get(k) ?? 0) + 1);
    }
    // 16 of 80 cards — a FIFTH of the catalog — whiff from a third of the
    // board by construction. The guaranteed-miss set is therefore a census of
    // low-reachability cards that happened to be fired from a dead cell, not a
    // list of defective ones, and it will keep growing as more are played.
    expect([...bands.entries()].sort()).toEqual([
      ["0.667", 16],
      ["0.889", 12],
      ["1.000", 52],
    ]);
  });
});

describe("meanZoneCoverage — the user's own manual heuristic, TASKS.md §13", () => {
  it("separates the session-92 offer that reachability CANNOT", () => {
    // Offer {35, 30, 31}; the bot chose 35, and had already played 35 into a
    // guaranteed miss. `chooseNewCard` scores max(hit, crit)/mana, so card
    // 35's 8 — a crit on the SINGLE zone [2] — beat the 6 that cards 30 and
    // 31 deliver across five zones each.
    const offer = [card(35), card(30), card(31)];
    expect(chooseNewCard(offer).id, "the shipped heuristic still picks 35").toBe(35);

    // All three are equally REACHABLE, so reachability is silent here...
    for (const c of offer) expect(positionalReachability(c, GRID)).toBeCloseTo(8 / 9, 10);

    // ...and COVERAGE is what discriminates. This is why both quantities ship
    // rather than one: §13's gate has to be able to tell them apart, and the
    // one recorded bad choice is separated by the second, not the first.
    expect(meanZoneCoverage(card(35), GRID)).toBeCloseTo(20 / 9, 10);
    expect(meanZoneCoverage(card(30), GRID)).toBeCloseTo(24 / 9, 10);
    expect(meanZoneCoverage(card(31), GRID)).toBeCloseTo(24 / 9, 10);
  });

  it("is 0 for a zoneless card and rises with template size", () => {
    expect(meanZoneCoverage({ ...card(16), hitZones: [], critZones: [] }, GRID)).toBe(0);
    expect(meanZoneCoverage(card(16), GRID)).toBeGreaterThan(meanZoneCoverage(card(1), GRID));
  });
});

describe("chooseNewCard is UNCHANGED by this session", () => {
  it("still scores max(hit, crit) per mana, blind to both new quantities", () => {
    // The regression that matters: §13 is parked on data, so nothing here may
    // alter a live decision. If someone wires a reachability or coverage term
    // into `chooseNewCard`, this fails and sends them to §13's gate first.
    // Card 16: nine zones, hit 1 — reachability 1. Card 84: one row, hit 6 —
    // reachability 2/3. Power/mana picks the narrow one; both new quantities
    // say the opposite. (Card 110's lone crit zone is 5, the focus cell
    // itself, so it is reachable from EVERY cell — not the contrast wanted.)
    const lowPowerWideReach = { ...card(16), id: 9001 };
    const highPowerNarrow = { ...card(84), id: 9002 };
    expect(chooseNewCard([lowPowerWideReach, highPowerNarrow]).id).toBe(9002);
    expect(positionalReachability(highPowerNarrow, GRID)).toBeLessThan(
      positionalReachability(lowPowerWideReach, GRID),
    );
  });
});
