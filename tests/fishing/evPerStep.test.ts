/**
 * tests/fishing/evPerStep.test.ts — [session 98 §C] pins for the ΔEV-per-step
 * report (`scripts/evPerStepDistribution.ts`, QUESTIONS.md §27).
 *
 * ## The two things worth pinning, and why the second one matters more
 *
 * 1. **The arithmetic**, on a corpus small enough to compute by hand. `ev` is
 *    `pCrit*crit + pHit*hit - mpm*miss*(1 - pHit - pCrit)` (`evaluateCardAtFocus`),
 *    so a distribution with all its mass on one cell makes every candidate's
 *    EV a two-term expression that can be written out in the assertion rather
 *    than recomputed by the code under test.
 *
 * 2. ⚠ **The DRIFT GUARD.** The report enumerates the candidate surface
 *    itself instead of calling `bestFocusForCard`, because it needs the losing
 *    candidates and that function returns only a winner. Two enumerations of
 *    "the same" surface are exactly the construction that silently diverges —
 *    a changed search space, a new eligibility filter, a different affordability
 *    rule, and the report would be describing a chooser that no longer exists.
 *    So: at `focusReserveWeight = 0` the score IS the EV, and the report's
 *    argmax must be the cell `chooseCard` actually picks. `NEVER_LETHAL` is
 *    passed because lethality is an OVERRIDE that outranks score entirely
 *    (`cardChoice.ts`'s five exemption paths) — comparing argmaxes through it
 *    would be comparing two different questions.
 */
import { describe, expect, it } from "vitest";

import { cellKey, manhattan, type Cell } from "../../src/sim/fishing/geometry.js";
import {
  NEVER_LETHAL,
  chooseCard,
  evaluateCardAtFocus,
  type Distribution,
  type FishingCardLike,
} from "../../src/strategy/fishing/cardChoice.js";
import { MOVEMENT_TAX_PER_STEP, evCandidatesAt, type EvPerStepInput } from "../../scripts/evPerStepDistribution.js";

/** Cells are 1-indexed, `1..gridSize` — see `geometry.ts`; (0,0) is off-grid. */
const GRID = 4;
const FISH: Cell = { x: 2, y: 2 };

const card = (o: Partial<FishingCardLike> = {}): FishingCardLike => ({
  id: 1,
  manaCost: 1,
  hitZones: [5],
  critZones: [],
  hitEffects: [{ amount: 10 }],
  missEffects: [{ amount: 2 }],
  critEffects: [{ amount: 10 }],
  ...o,
});

/** All the mass on one cell, so every candidate's EV is hand-computable. */
const distAt = (cell: Cell, p = 1): Distribution => new Map([[cellKey(cell), { cell, p }]]);

const input = (o: Partial<EvPerStepInput> = {}): EvPerStepInput => ({
  hand: [card()],
  manaBefore: 10,
  dist: distAt(FISH),
  gridSize: GRID,
  focusBefore: { current: { x: 4, y: 4 }, remaining: 3 },
  ...o,
});

describe("§C — the tax constant is DERIVED, not written down", () => {
  it("is w / FOCUS_METER_MAX = 1.00 at the shipped weight", () => {
    // Session 95 §G's identity. If either constant moves, the report's
    // threshold must move with it — a literal 1.00 would outlive the identity.
    expect(MOVEMENT_TAX_PER_STEP).toBeCloseTo(1, 12);
  });
});

describe("§C — ΔEV/step on a hand-computable surface", () => {
  /**
   * Zone 5 is the template's centre, so a card placed AT a cell covers that
   * cell. With all the mass on the fish, a placement on the fish hits with
   * p = 1 and every other placement hits with p = 0.
   *
   *   ev(on the fish)  = 1 * 10 - 1 * 2 * (1 - 1) = 10
   *   ev(anywhere else) = 0 * 10 - 1 * 2 * (1 - 0) = -2
   *
   * The marker starts at (4,4), manhattan 4 from the fish — OUT of a 3-point
   * reach — so the best mover is the closest placement to the fish that the
   * meter can reach, and every candidate scores -2. ΔEV is then 0.
   */
  it("returns 0 when the surface is flat — the tax binds by definition there", () => {
    const s = input();
    const p = evCandidatesAt(s)!;
    expect(p.stayEv).toBeCloseTo(-2, 12);
    expect(p.moverEv).toBeCloseTo(-2, 12);
    expect(p.deltaPerStep).toBeCloseTo(0, 12);
    expect(p.deltaPerStep).toBeLessThan(MOVEMENT_TAX_PER_STEP);
  });

  it("prices a reachable fish at exactly (10 - -2) / d", () => {
    // Marker two steps from the fish, so the best mover IS the fish's cell.
    const s = input({ focusBefore: { current: { x: 4, y: 2 }, remaining: 3 } });
    const p = evCandidatesAt(s)!;
    expect(p.moverD).toBe(2);
    expect(p.moverEv).toBeCloseTo(10, 12);
    expect(p.stayEv).toBeCloseTo(-2, 12);
    expect(p.deltaPerStep).toBeCloseTo(12 / 2, 12);
    // 6.00 per step against a 1.00 tax: the tax cannot flip this decision.
    expect(p.deltaPerStep).toBeGreaterThan(MOVEMENT_TAX_PER_STEP);
  });

  it("`bestByD` holds the best EV at each exact distance, against one stayer", () => {
    const s = input({ focusBefore: { current: { x: 4, y: 2 }, remaining: 3 } });
    const p = evCandidatesAt(s)!;
    // d=2 reaches the fish; d=1 and d=3 do not, so they are flat at -2.
    expect(p.bestByD.get(2)).toBeCloseTo(10, 12);
    expect(p.bestByD.get(1)).toBeCloseTo(-2, 12);
    expect(p.bestByD.get(3)).toBeCloseTo(-2, 12);
  });

  it("prefers the SHORTER move when two distances tie on EV", () => {
    // Understating `d` would understate ΔEV/step and overstate how often the
    // tax binds, so the tie-break direction is load-bearing, not cosmetic.
    const s = input({ focusBefore: { current: { x: 4, y: 4 }, remaining: 3 } });
    const p = evCandidatesAt(s)!;
    expect(p.moverD).toBe(1);
  });
});

describe("§C — the exclusions are exclusions, not zeros", () => {
  it("returns null when the meter is empty — no `d > 0` candidate exists", () => {
    expect(evCandidatesAt(input({ focusBefore: { current: FISH, remaining: 0 } }))).toBeNull();
  });

  it("returns null when no card is affordable", () => {
    expect(evCandidatesAt(input({ hand: [card({ manaCost: 5 })], manaBefore: 1 }))).toBeNull();
  });

  it("counts only AFFORDABLE cards, the way `chooseCard` does", () => {
    // An unaffordable monster card must not inflate the mover's EV.
    const s = input({
      hand: [card({ manaCost: 1, hitEffects: [{ amount: 10 }] }), card({ manaCost: 99, hitEffects: [{ amount: 999 }] })],
      manaBefore: 1,
      focusBefore: { current: { x: 4, y: 2 }, remaining: 3 },
    });
    expect(evCandidatesAt(s)!.moverEv).toBeCloseTo(10, 12);
  });
});

describe("§C — DRIFT GUARD: the report's argmax is what `chooseCard` picks at weight 0", () => {
  /**
   * At `focusReserveWeight = 0` the score is the EV, so the winner of the
   * report's enumeration and the winner of `chooseCard` must be the same
   * (card, focus). Checked over a spread of marker positions, meter levels and
   * hands rather than one state, because a divergence in the SEARCH SPACE
   * (which is what would actually drift) only shows up at particular
   * `remaining` values.
   */
  const hands: FishingCardLike[][] = [
    [card()],
    [card({ id: 1, manaCost: 1, hitEffects: [{ amount: 10 }] }), card({ id: 2, manaCost: 2, hitZones: [1, 5, 9], hitEffects: [{ amount: 6 }] })],
    [card({ id: 3, manaCost: 1, hitZones: [4, 5, 6], hitEffects: [{ amount: 7 }], missEffects: [{ amount: 5 }] })],
  ];

  for (const remaining of [1, 2, 3]) {
    for (const current of [{ x: 4, y: 4 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 1 }]) {
      for (const [i, hand] of hands.entries()) {
        it(`remaining ${remaining}, marker (${current.x},${current.y}), hand ${i}`, () => {
          const s = input({ hand, focusBefore: { current, remaining }, dist: distAt(FISH, 0.8) });
          const point = evCandidatesAt(s)!;
          const chosen = chooseCard(
            s.hand,
            s.manaBefore,
            s.dist,
            s.gridSize,
            1,
            /* fishHp */ 99, // high, so nothing is lethal under any predicate
            s.focusBefore,
            /* heuristicsEnabled */ true,
            /* focusReserveWeight */ 0,
            undefined,
            undefined,
            NEVER_LETHAL,
            s.focusBefore.current,
          )!;
          // The chooser's own EV must be the best EV the enumeration found —
          // over BOTH arms, since `chooseCard` does not care about distance at
          // weight 0.
          const bestEv = Math.max(point.stayEv, point.moverEv);
          expect(chosen.ev).toBeCloseTo(bestEv, 12);
          // And the enumeration's own numbers must agree with the shipped EV
          // function evaluated at the chooser's cell.
          const atChosen = evaluateCardAtFocus(chosen.card, chosen.focus, s.dist, s.gridSize, 1).ev;
          expect(atChosen).toBeCloseTo(chosen.ev, 12);
          // The arm the chooser landed in must be the arm holding that EV.
          const d = manhattan(s.focusBefore.current, chosen.focus);
          expect(d === 0 ? point.stayEv : point.moverEv).toBeCloseTo(bestEv, 12);
        });
      }
    }
  }
});
