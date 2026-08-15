/**
 * tests/fishing/cardChoice.test.ts — (card, focus) EV per SPEC.md §5,
 * re-derived session 12 for the confirmed movable-focus mechanic.
 */

import { describe, expect, it } from "vitest";

import type { Cell } from "../../src/sim/fishing/geometry.js";
import { cellKey } from "../../src/sim/fishing/geometry.js";
import {
  bestFocusForCard,
  chooseCard,
  evaluateCardAtFocus,
  shouldRedraw,
  type Distribution,
  type FishingCardLike,
} from "../../src/strategy/fishing/cardChoice.js";

function dist(entries: Array<[Cell, number]>): Distribution {
  const m = new Map<string, { cell: Cell; p: number }>();
  for (const [cell, p] of entries) m.set(cellKey(cell), { cell, p });
  return m;
}

const centerOnlyCard: FishingCardLike = {
  id: 999,
  manaCost: 1,
  hitZones: [5],
  critZones: [],
  hitEffects: [{ amount: 10 }],
  missEffects: [{ amount: -4 }],
  critEffects: [],
};

// Real card id 79 (fixtures/fishing-casts/cards.json): mana 1, hit [2,4,6,8],
// hitEffect +5, missEffect -4 — the card actually played on the real cast's
// one genuine hit (turn 3, focus [3,3], landed [3,4]).
const realCard79: FishingCardLike = {
  id: 79,
  manaCost: 1,
  hitZones: [2, 4, 6, 8],
  critZones: [],
  hitEffects: [{ amount: 5 }],
  missEffects: [{ amount: -4 }],
  critEffects: [],
};

describe("evaluateCardAtFocus", () => {
  it("computes EV from the card's own real miss amount, not a global constant", () => {
    const d = dist([
      [{ x: 2, y: 2 }, 0.7],
      [{ x: 1, y: 1 }, 0.3],
    ]);
    const { ev, pHit } = evaluateCardAtFocus(centerOnlyCard, { x: 2, y: 2 }, d, 4, 1);
    expect(pHit).toBeCloseTo(0.7);
    // 0.7*10 - 1*4*0.3 = 7 - 1.2 = 5.8
    expect(ev).toBeCloseTo(5.8);
  });

  it("scores crit cells with critEffect and excludes them from the plain-hit term", () => {
    const card: FishingCardLike = {
      id: 1,
      manaCost: 1,
      hitZones: [2, 4, 6, 8],
      critZones: [5],
      hitEffects: [{ amount: 5 }],
      missEffects: [{ amount: -3 }],
      critEffects: [{ amount: 12 }],
    };
    const focus = { x: 2, y: 2 };
    const d = dist([
      [{ x: 2, y: 2 }, 0.5], // crit cell (zone 5)
      [{ x: 2, y: 1 }, 0.3], // hit cell (zone 2)
      [{ x: 1, y: 1 }, 0.2], // miss
    ]);
    const { ev, pHit, pCrit } = evaluateCardAtFocus(card, focus, d, 4, 1);
    expect(pCrit).toBeCloseTo(0.5);
    expect(pHit).toBeCloseTo(0.3);
    // 0.5*12 + 0.3*5 - 1*3*0.2 = 6 + 1.5 - 0.6 = 6.9
    expect(ev).toBeCloseTo(6.9);
  });

  it("reproduces the real cast's actual hit as an argmax focus choice", () => {
    // Degenerate distribution: certain the fish lands on [3,4] (the real
    // post-move cell). bestFocusForCard should find a focus placing card
    // 79's hitbox over it, exactly like the real play at focus [3,3].
    const d = dist([[{ x: 3, y: 4 }, 1]]);
    const best = bestFocusForCard(realCard79, 0, d, 4, 1, 20);
    expect(best.pHit).toBeCloseTo(1);
    expect(best.ev).toBeCloseTo(5); // certain hit, no miss term
  });
});

describe("lethal check", () => {
  it("flags lethal only when every live outcome is a guaranteed finishing hit", () => {
    const d = dist([[{ x: 2, y: 2 }, 1]]);
    const best = bestFocusForCard(centerOnlyCard, 0, d, 4, 1, /* fishHp */ 3);
    expect(best.lethal).toBe(true); // 3 - 10 <= 0, certain hit
  });

  it("does not flag lethal when a miss is still possible", () => {
    const d = dist([
      [{ x: 2, y: 2 }, 0.9],
      [{ x: 1, y: 1 }, 0.1],
    ]);
    const best = bestFocusForCard(centerOnlyCard, 0, d, 4, 1, 3);
    expect(best.lethal).toBe(false);
  });

  it("chooseCard picks the lethal option even over a higher EV/mana non-lethal one", () => {
    const weakButCertain: FishingCardLike = {
      id: 1,
      manaCost: 2,
      hitZones: [5],
      critZones: [],
      hitEffects: [{ amount: 2 }],
      missEffects: [{ amount: -1 }],
      critEffects: [],
    };
    const strongButLethal: FishingCardLike = {
      id: 2,
      manaCost: 1,
      hitZones: [5],
      critZones: [],
      hitEffects: [{ amount: 50 }],
      missEffects: [{ amount: -1 }],
      critEffects: [],
    };
    const d = dist([[{ x: 2, y: 2 }, 1]]);
    const choice = chooseCard([weakButCertain, strongButLethal], 5, d, 4, 1, /* fishHp */ 4);
    expect(choice?.card.id).toBe(2);
    expect(choice?.lethal).toBe(true);
  });

  it("chooseCard returns null with no affordable card", () => {
    const d = dist([[{ x: 2, y: 2 }, 1]]);
    expect(chooseCard([centerOnlyCard], /* mana */ 0, d, 4, 1, 20)).toBeNull();
  });
});

describe("shouldRedraw", () => {
  it("redraws only when EV is weak AND mana comfortably covers the cost", () => {
    const weak = { evPerMana: 0.5 } as ReturnType<typeof bestFocusForCard>;
    expect(shouldRedraw(weak, 3, 10, 3)).toBe(true);
    expect(shouldRedraw(weak, 3, 2, 3)).toBe(false); // not enough mana
    const strong = { evPerMana: 5 } as ReturnType<typeof bestFocusForCard>;
    expect(shouldRedraw(strong, 3, 10, 3)).toBe(false);
  });
});
