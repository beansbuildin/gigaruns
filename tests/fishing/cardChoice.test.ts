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
  chooseNewCard,
  evaluateCardAtFocus,
  focusReserveFraction,
  shouldRedraw,
  type Distribution,
  type FishingCardLike,
  type FocusBudget,
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

describe("FocusBudget — session 13, live [CONFIRMED]", () => {
  it("restricts the focus search to cells within Manhattan distance of the current focus", () => {
    const d = dist([[{ x: 4, y: 4 }, 1]]); // fish certainly at the far corner
    // realCard79 hits [2,4,6,8] around its focus — only reachable from [4,4]
    // itself or its immediate neighbours would put [4,4] in range, but a
    // focus pinned at [1,1] with 0 remaining meter can never reach it.
    const pinned = bestFocusForCard(realCard79, 0, d, 4, 1, 20, { current: { x: 1, y: 1 }, remaining: 0 });
    expect(pinned.focus).toEqual({ x: 1, y: 1 });
    expect(pinned.pHit).toBe(0); // can't reach anywhere near the fish

    const free = bestFocusForCard(realCard79, 0, d, 4, 1, 20, { current: { x: 1, y: 1 }, remaining: 6 });
    expect(free.pHit + free.pCrit).toBeGreaterThan(0); // enough budget to reach the fish's corner
  });

  it("chooseCard threads the budget through to every affordable card", () => {
    const d = dist([[{ x: 1, y: 1 }, 1]]);
    const choice = chooseCard([realCard79], 5, d, 4, 1, 20, { current: { x: 4, y: 4 }, remaining: 0 });
    expect(choice?.focus).toEqual({ x: 4, y: 4 }); // pinned — can't move toward the fish
  });
});

describe("argmax EV, not argmax P_hit — session 15 [RE-DERIVED]", () => {
  // Session 13's `argmax P_hit` was an overcorrection (SPEC.md §5): it's
  // blind to damage/miss-penalty differences between cards. Card A is wide
  // (2 hit zones) and safe but weak (P_hit 0.9, hitEffect 2, missEffect 1):
  // EV = 0.9*2 - 1*0.1 = 1.7. Card B is narrow (1 hit zone) but strong
  // (P_hit 0.6, hitEffect 10, missEffect 3): EV = 0.6*10 - 3*0.4 = 4.8.
  // Old P_hit-argmax picks A (0.9 > 0.6); correct EV-argmax picks B (4.8 > 1.7).
  const safeButWeak: FishingCardLike = {
    id: 1,
    manaCost: 1,
    // (0,0) and (0,-1) relative to focus. [session 47] Was `[5, 2]`, written
    // against the TRANSPOSED `ZONE_OFFSET` this project shipped until this
    // session — zone 2 is (-1, 0), not (0, -1). Zone 4 is the offset this
    // scenario always meant; the scenario itself (wide-and-weak vs
    // narrow-and-strong) is unchanged, and so are both expected EVs.
    hitZones: [5, 4],
    critZones: [],
    hitEffects: [{ amount: 2 }],
    missEffects: [{ amount: -1 }],
    critEffects: [],
  };
  const riskyButStrong: FishingCardLike = {
    id: 2,
    manaCost: 1,
    hitZones: [5],
    critZones: [],
    hitEffects: [{ amount: 10 }],
    missEffects: [{ amount: -3 }],
    critEffects: [],
  };
  const d = dist([
    [{ x: 2, y: 2 }, 0.6],
    [{ x: 2, y: 1 }, 0.3],
    [{ x: 1, y: 1 }, 0.1],
  ]);

  it("bestFocusForCard finds each card's own EV-maximizing focus, not P_hit-maximizing", () => {
    const bestA = bestFocusForCard(safeButWeak, 0, d, 4, 1, 20);
    expect(bestA.pHit).toBeCloseTo(0.9);
    expect(bestA.ev).toBeCloseTo(1.7);

    const bestB = bestFocusForCard(riskyButStrong, 1, d, 4, 1, 20);
    expect(bestB.pHit).toBeCloseTo(0.6);
    expect(bestB.ev).toBeCloseTo(4.8);
  });

  it("chooseCard picks the higher-EV card even though it has lower P_hit", () => {
    const choice = chooseCard([safeButWeak, riskyButStrong], 5, d, 4, 1, /* fishHp */ 20);
    expect(choice?.card.id).toBe(2); // riskyButStrong — EV 4.8 beats safeButWeak's EV 1.7
    expect(choice?.pHit).toBeCloseTo(0.6); // lower P_hit than the rejected option, by design
  });
});

describe("chooseNewCard — session 17, QUESTIONS.md §10", () => {
  it("picks the offer with the highest hit-power per mana", () => {
    const cheapWeak: FishingCardLike = { ...realCard79, id: 7, manaCost: 1, hitEffects: [{ amount: 3 }] };
    const pricedStrong: FishingCardLike = { ...realCard79, id: 14, manaCost: 2, hitEffects: [{ amount: 8 }] }; // 4/mana
    const pricedWeak: FishingCardLike = { ...realCard79, id: 23, manaCost: 3, hitEffects: [{ amount: 3 }] }; // 1/mana
    expect(chooseNewCard([cheapWeak, pricedStrong, pricedWeak]).id).toBe(14);
  });

  it("uses critEffect when it beats hitEffect", () => {
    const hitCard: FishingCardLike = { ...realCard79, id: 1, manaCost: 1, hitEffects: [{ amount: 5 }], critEffects: [{ amount: 5 }] };
    const critCard: FishingCardLike = { ...realCard79, id: 2, manaCost: 1, hitEffects: [{ amount: 5 }], critEffects: [{ amount: 20 }] };
    expect(chooseNewCard([hitCard, critCard]).id).toBe(2);
  });

  it("throws on an empty offer list rather than picking nothing", () => {
    expect(() => chooseNewCard([])).toThrow(/no offers/);
  });
});

describe("resource-conserving tie-breaks — session 31, CODEXIMPROVE #2", () => {
  it("bestFocusForCard: an equal-EV stationary focus beats a moving focus", () => {
    // centerOnlyCard only hits its own focus cell (zone 5), so placing focus
    // AT a cell with probability mass p gives ev = p*10 - 1*4*(1-p) at that
    // cell and nowhere else — two cells with equal probability mass give
    // exactly equal EV, a real tie, not a rounding artifact.
    const d = dist([
      [{ x: 2, y: 2 }, 0.5],
      [{ x: 3, y: 3 }, 0.5],
    ]);
    const current = { x: 2, y: 2 };
    // remaining=5 is enough to reach {3,3} (Manhattan distance 2) — the old
    // behavior would resolve the EV tie by grid enumeration order, which
    // could land on either cell regardless of movement cost.
    const best = bestFocusForCard(centerOnlyCard, 0, d, 4, 1, 20, { current, remaining: 5 });
    expect(best.focus).toEqual(current); // stays put — zero focus-movement cost
    expect(best.ev).toBeCloseTo(3); // 0.5*10 - 1*4*0.5 = 3, same at either tied cell
  });

  it("chooseCard: an equal-EV cheaper card beats a costlier one", () => {
    const cheap: FishingCardLike = {
      id: 1,
      manaCost: 1,
      hitZones: [5],
      critZones: [],
      hitEffects: [{ amount: 5 }],
      missEffects: [{ amount: -3 }],
      critEffects: [],
    };
    const costly: FishingCardLike = { ...cheap, id: 2, manaCost: 3 };
    // Degenerate distribution (fish certainly at one cell) makes both cards'
    // best-focus EV identical (5) — same hit/miss effects, same hitZones,
    // only manaCost differs. fishHp=20 with mana=10 keeps isManaConstrained
    // false (turnsNeeded 4 * cheapestMana 1 = 4 <= 10), so this exercises the
    // raw-EV tie-break, not the EV/mana objective (which would already
    // prefer the cheap card on EV/mana alone and wouldn't prove the
    // tie-break fires).
    const d = dist([[{ x: 2, y: 2 }, 1]]);
    const choice = chooseCard([costly, cheap], /* mana */ 10, d, 4, 1, /* fishHp */ 20);
    expect(choice?.ev).toBeCloseTo(5);
    expect(choice?.card.id).toBe(1); // cheap — hand order alone would have picked costly (index 0)
  });
});

describe("coverage and centering tie-breaks — session 43, heuristics (a)/(f)", () => {
  it("chooseCard: an equal-EV card covering more distinct cells beats one covering fewer", () => {
    const narrow: FishingCardLike = {
      id: 1,
      manaCost: 1,
      hitZones: [5], // just the focus cell itself
      critZones: [],
      hitEffects: [{ amount: 5 }],
      missEffects: [{ amount: -4 }],
      critEffects: [],
    };
    const spread: FishingCardLike = {
      id: 2,
      manaCost: 1,
      hitZones: [1, 9], // two opposite corners relative to focus
      critZones: [],
      hitEffects: [{ amount: 5 }],
      missEffects: [{ amount: -4 }],
      critEffects: [],
    };
    // At focus (2,2): narrow's zone 5 hits (2,2) itself, P=0.4. spread's
    // zones 1/9 hit (1,1) and (3,3), P=0.2 each, same 0.4 total — same
    // hitEffect on both cards, so raw EV is a genuine tie: 0.4*5 - 4*0.6 =
    // -0.4 for both. But spread's mass comes from TWO distinct cells
    // (coverage 2) vs. narrow's ONE (coverage 1).
    const d = dist([
      [{ x: 2, y: 2 }, 0.4],
      [{ x: 1, y: 1 }, 0.2],
      [{ x: 3, y: 3 }, 0.2],
      [{ x: 4, y: 4 }, 0.4],
    ]);
    const focus = { x: 2, y: 2 };
    const evNarrow = evaluateCardAtFocus(narrow, focus, d, 4, 1).ev;
    const evSpread = evaluateCardAtFocus(spread, focus, d, 4, 1).ev;
    expect(evSpread).toBeCloseTo(evNarrow); // confirms the EV tie is real, not asserted blind

    const choice = chooseCard([narrow, spread], /* mana */ 10, d, 4, 1, /* fishHp */ 100);
    expect(choice?.card.id).toBe(2); // spread — hand order alone would have picked narrow (index 0)
  });

  it("bestFocusForCard: an equal-EV, equal-coverage focus in the central 2x2 beats an edge one", () => {
    const centerOnlyCard: FishingCardLike = {
      id: 1,
      manaCost: 1,
      hitZones: [5],
      critZones: [],
      hitEffects: [{ amount: 10 }],
      missEffects: [{ amount: -4 }],
      critEffects: [],
    };
    // Two cells with equal probability mass, one central (2,2), one a
    // corner (1,1) — placing focus directly on either gives the same EV
    // (0.5*10 - 4*0.5 = 3) and the same coverage (1, the focus cell
    // itself), a genuine double tie. No focusBudget, so movement cost
    // cannot be the tie-break either — isolates the centering preference.
    const d = dist([
      [{ x: 2, y: 2 }, 0.5],
      [{ x: 1, y: 1 }, 0.5],
    ]);
    const best = bestFocusForCard(centerOnlyCard, 0, d, 4, 1, 100);
    expect(best.ev).toBeCloseTo(3);
    expect(best.focus).toEqual({ x: 2, y: 2 });
  });

  it("heuristicsEnabled: false disables the coverage tie-break — session 44, for scripts/fishingHeuristicAblation.ts", () => {
    const narrow: FishingCardLike = {
      id: 1,
      manaCost: 1,
      hitZones: [5],
      critZones: [],
      hitEffects: [{ amount: 5 }],
      missEffects: [{ amount: -4 }],
      critEffects: [],
    };
    const spread: FishingCardLike = {
      id: 2,
      manaCost: 1,
      hitZones: [1, 9],
      critZones: [],
      hitEffects: [{ amount: 5 }],
      missEffects: [{ amount: -4 }],
      critEffects: [],
    };
    const d = dist([
      [{ x: 2, y: 2 }, 0.4],
      [{ x: 1, y: 1 }, 0.2],
      [{ x: 3, y: 3 }, 0.2],
      [{ x: 4, y: 4 }, 0.4],
    ]);
    // Pinned to a single focus (remaining: 0) — unlike the test above, this
    // stops `bestFocusForCard`'s own free search from finding spread a
    // STRICTLY better focus elsewhere (it can: at focus (3,3), spread's
    // zones would hit (2,2)+(4,4), both p=0.4, a real 0.8 combined hit
    // chance beating either card's best at a fixed (2,2) — that's a real EV
    // win, not a coverage tie, so it must be pinned out to isolate the
    // tie-break this test actually targets).
    const focusBudget = { current: { x: 2, y: 2 }, remaining: 0 };
    const choice = chooseCard([narrow, spread], 10, d, 4, 1, 100, focusBudget, false);
    expect(choice?.card.id).toBe(1);
  });

  it("heuristicsEnabled: false disables the centering tie-break — session 44", () => {
    const centerOnlyCard: FishingCardLike = {
      id: 1,
      manaCost: 1,
      hitZones: [5],
      critZones: [],
      hitEffects: [{ amount: 10 }],
      missEffects: [{ amount: -4 }],
      critEffects: [],
    };
    const d = dist([
      [{ x: 2, y: 2 }, 0.5],
      [{ x: 1, y: 1 }, 0.5],
    ]);
    const best = bestFocusForCard(centerOnlyCard, 0, d, 4, 1, 100, undefined, false);
    expect(best.ev).toBeCloseTo(3);
    // No centering preference and no focusBudget movement-cost tie-break
    // either — falls through to grid enumeration order (allCells' x-major,
    // y-minor raster: (1,1) is hit before (2,2)).
    expect(best.focus).toEqual({ x: 1, y: 1 });
  });
});

describe("shouldRedraw", () => {
  // [session 13] Reads `best.ev`, not `.evPerMana` — SPEC.md §5 always said
  // raw EV; the old evPerMana read was a real bug, not a rename (see
  // cardChoice.ts's doc comment and src/sim/fishing/castSim.ts's
  // REDRAW_THRESHOLD re-tuning for why it mattered).
  it("redraws only when EV is weak AND mana comfortably covers the cost", () => {
    const weak = { ev: -0.5 } as ReturnType<typeof bestFocusForCard>;
    expect(shouldRedraw(weak, 3, 10, 0)).toBe(true);
    expect(shouldRedraw(weak, 3, 2, 0)).toBe(false); // not enough mana
    const strong = { ev: 5 } as ReturnType<typeof bestFocusForCard>;
    expect(shouldRedraw(strong, 3, 10, 0)).toBe(false);
  });
});

// ── [session 45] focus-reserve continuation term ─────────────────────────

describe("focusReserveFraction", () => {
  it("is 0 with no budget to conserve", () => {
    expect(focusReserveFraction(undefined, { x: 1, y: 1 })).toBe(0);
  });

  it("rewards what a placement LEAVES, normalized by the full meter", () => {
    const budget: FocusBudget = { current: { x: 2, y: 2 }, remaining: 3 };
    expect(focusReserveFraction(budget, { x: 2, y: 2 })).toBeCloseTo(1, 10); // stay put: all 3 left
    expect(focusReserveFraction(budget, { x: 2, y: 3 })).toBeCloseTo(2 / 3, 10);
    expect(focusReserveFraction(budget, { x: 3, y: 3 })).toBeCloseTo(1 / 3, 10);
    expect(focusReserveFraction(budget, { x: 4, y: 3 })).toBeCloseTo(0, 10);
  });

  it("never goes negative when a caller overspends the budget", () => {
    const budget: FocusBudget = { current: { x: 1, y: 1 }, remaining: 1 };
    expect(focusReserveFraction(budget, { x: 4, y: 4 })).toBe(0);
  });
});

describe("bestFocusForCard with a focus-reserve weight", () => {
  const budget: FocusBudget = { current: { x: 2, y: 2 }, remaining: 3 };
  // Two live cells: one right under the current focus, one two moves away and
  // slightly better. Weight 0 must take the better cell; a large weight must
  // refuse to pay for it.
  const d = dist([
    [{ x: 2, y: 2 }, 0.45],
    [{ x: 3, y: 4 }, 0.55],
  ]);
  const centerCard: FishingCardLike = {
    id: 1001,
    manaCost: 1,
    hitZones: [5],
    critZones: [],
    hitEffects: [{ amount: 5 }],
    missEffects: [{ amount: -3 }],
    critEffects: [],
  };

  it("weight 0 leaves behavior exactly as it was — the greedy pick", () => {
    const best = bestFocusForCard(centerCard, 0, d, 4, 1, 20, budget, true, 0);
    expect(cellKey(best.focus)).toBe("3,4");
    expect(best.score).toBeCloseTo(best.ev, 12);
  });

  it("a large weight declines to spend the whole budget for a small EV edge", () => {
    const best = bestFocusForCard(centerCard, 0, d, 4, 1, 20, budget, true, 12);
    expect(cellKey(best.focus)).toBe("2,2");
  });

  it("keeps raw ev for reporting even when score drives the pick", () => {
    const best = bestFocusForCard(centerCard, 0, d, 4, 1, 20, budget, true, 12);
    // score carries the reserve bonus; ev is still the plain expected damage
    expect(best.score).toBeGreaterThan(best.ev);
    const { ev } = evaluateCardAtFocus(centerCard, best.focus, d, 4, 1);
    expect(best.ev).toBeCloseTo(ev, 12);
  });

  it("never lets the reserve term outrank a lethal option", () => {
    // A lethal placement two moves away vs. a comfortable non-lethal one at home.
    const lethalDist = dist([[{ x: 3, y: 4 }, 1]]);
    const best = bestFocusForCard(centerCard, 0, lethalDist, 4, 1, 3, budget, true, 1000);
    expect(best.lethal).toBe(true);
    expect(cellKey(best.focus)).toBe("3,4");
  });
});

describe("chooseCard with a focus-reserve weight", () => {
  it("threads the weight through to every card's focus search", () => {
    const budget: FocusBudget = { current: { x: 2, y: 2 }, remaining: 3 };
    const d = dist([
      [{ x: 2, y: 2 }, 0.45],
      [{ x: 3, y: 4 }, 0.55],
    ]);
    const greedy = chooseCard([centerOnlyCard], 10, d, 4, 1, 20, budget, true, 0);
    const reserved = chooseCard([centerOnlyCard], 10, d, 4, 1, 20, budget, true, 12);
    expect(cellKey(greedy!.focus)).toBe("3,4");
    expect(cellKey(reserved!.focus)).toBe("2,2");
  });
});

describe("[session 50, brief §2] focusCandidates — restricting the placement search", () => {
  // The fish is certainly at (3,3) — two points from the starting focus, so
  // it is inside the 3-point meter. Unrestricted, the single-cell card aims
  // there; restricted to (1,1) it must aim at (1,1) and eat the miss.
  const d = dist([[{ x: 3, y: 3 }, 1]]);

  it("is undefined by default and leaves the search space exactly as it was", () => {
    const free = bestFocusForCard(centerOnlyCard, 0, d, 4, 1, 50, { current: { x: 2, y: 2 }, remaining: 3 });
    expect(free.focus).toEqual({ x: 3, y: 3 });
  });

  it("confines the placement to the listed cells even when EV is worse there", () => {
    const pinned = bestFocusForCard(
      centerOnlyCard,
      0,
      d,
      4,
      1,
      50,
      { current: { x: 2, y: 2 }, remaining: 3 },
      true,
      0,
      undefined,
      [{ x: 1, y: 1 }],
    );
    expect(pinned.focus).toEqual({ x: 1, y: 1 });
    expect(pinned.pHit).toBe(0);
  });

  it("still picks the best CARD at the pinned focus — that separation is the point", () => {
    // At focus (3,2) the ring card 79 covers (3,3) through zone 6; the
    // centre-only card does not cover it at all.
    const pinned = chooseCard(
      [centerOnlyCard, realCard79],
      10,
      d,
      4,
      1,
      50,
      { current: { x: 2, y: 2 }, remaining: 3 },
      true,
      0,
      undefined,
      [{ x: 3, y: 2 }],
    );
    expect(pinned!.focus).toEqual({ x: 3, y: 2 });
    expect(pinned!.card.id).toBe(79);
  });

  it("never returns null just because the constraint forbids the only listed cell", () => {
    // A cost-2 move under a cost-cap of 0: the placement is blocked, but the
    // search space must not collapse to nothing.
    const pinned = chooseCard(
      [centerOnlyCard],
      10,
      d,
      4,
      1,
      50,
      { current: { x: 2, y: 2 }, remaining: 3 },
      true,
      0,
      { maxMoveCost: 0, moveEvThreshold: 0 },
      [{ x: 3, y: 3 }],
    );
    expect(pinned).not.toBeNull();
    expect(pinned!.focus).toEqual({ x: 3, y: 3 });
  });
});
