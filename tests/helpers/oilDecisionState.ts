/**
 * tests/helpers/oilDecisionState.ts — [session 67 §1] the ONE builder for an
 * `OilDecisionState` in tests.
 *
 * Same rationale as `liveFishingDeps.ts` and as §2's `fakeDoc` consolidation:
 * a builder that omits a field the decision path reads is a DIFFERENT GAME,
 * and N copies are N chances to drift into being one. `OilDecisionState`
 * arrived with `board` required precisely so the compiler would refuse a state
 * built without it; scattering per-file literals would hand that guarantee
 * back one file at a time.
 *
 * The default board is deliberately INERT, not empty: an empty hand and an
 * empty distribution both make every necessity probability 0, which silently
 * turns the gate into always-fire — one of the two degeneracies the design
 * exists to avoid. A test that wants that must ask for it.
 */
import { FOCUS_METER_MAX } from "../../src/sim/fishing/castSim.js";
import { cellKey, type Cell } from "../../src/sim/fishing/geometry.js";
import type { Distribution, FishingCardLike } from "../../src/strategy/fishing/cardChoice.js";
import type { OilBoardView, OilDecisionState } from "../../src/strategy/fishing/oilTiming.js";

export const GRID = 4;

/** A card with the shape the real Dendren deck uses — zones are 1-indexed offsets, see `geometry.zoneToCell`. */
export function card(o: Partial<FishingCardLike> = {}): FishingCardLike {
  return {
    id: 1,
    manaCost: 1,
    hitZones: [5],
    critZones: [],
    hitEffects: [{ amount: 5 }],
    missEffects: [{ amount: 3 }],
    critEffects: [{ amount: 8 }],
    ...o,
  };
}

/** A distribution putting all of `p` on `cell` and the remainder nowhere — the plainest way to make a probability legible. */
export function distAt(cell: Cell, p = 1): Distribution {
  return new Map([[cellKey(cell), { cell, p }]]);
}

export function board(o: Partial<OilBoardView> = {}): OilBoardView {
  return { hand: [card()], dist: distAt({ x: 2, y: 2 }), gridSize: GRID, ...o };
}

export function oilState(o: Partial<OilDecisionState> = {}): OilDecisionState {
  return {
    turn: 3,
    fishHp: 10,
    fishMaxHp: 20,
    mana: 5,
    focusRemaining: 2,
    focusMax: FOCUS_METER_MAX,
    focusOilHeld: 1,
    relaxingOilHeld: 1,
    focusCell: { x: 2, y: 2 },
    board: board(),
    ...o,
  };
}
