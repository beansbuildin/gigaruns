/**
 * tests/fishing/meterZero.test.ts — [session 63 §4] the `focusPoint: [0,0]`
 * trap, guarded rather than merely tidied.
 *
 * ## The trap
 *
 * `src/sim/fishing/geometry.ts`'s `allCells` is **ONE-indexed** — it walks
 * `x = 1..gridSize`, `y = 1..gridSize`. So `[0,0]` is not the origin, it is off
 * the board. The live wire agrees: `cast-2026-08-21-14-46-13/state-000` reports
 * `focusPoint: [2,2]` on a `gridSize: 4` board.
 *
 * Off-grid is HARMLESS at a full meter, because `reachableCells` with a
 * distance budget of 3 still returns most of the board from a point just
 * outside it, and one of those placements gets chosen. It is FATAL at
 * `focusMeter: 0`: the reachable set is every cell within Manhattan distance
 * **0** of `[0,0]`, which is the empty set, so `bestFocusForCard` finds no
 * candidate, no `bestStay`, and throws `"gridSize must be >= 1"` — an error
 * message naming the one thing that is not actually wrong.
 *
 * ## Why this is worth a file of its own
 *
 * **The Focus Oil's entire trigger is meter zero.** `on-demand` fires it at
 * `focusMeter === 0` and nowhere else, so the next person to write a test for
 * the oil policy's own trigger condition walks straight into this. Session 62
 * shipped that policy live and its tests never drove the meter to zero, which
 * is the only reason the three `[0,0]` mocks in `tests/liveFishing.test.ts`
 * survived as long as they did. They are on-grid as of this session.
 *
 * The throwing test below is deliberate and is the point of the file: it pins
 * the failure mode so that a future reader who "fixes" the crash by clamping
 * `[0,0]` onto the grid has to come here and say why. Clamping would be the
 * wrong fix — the board never sends `[0,0]`, so a state carrying it is a
 * FABRICATED state, and silently repairing fabricated input is how a test
 * suite stops testing the server's actual behaviour.
 */

import { describe, expect, it } from "vitest";

import type { Cell } from "../../src/sim/fishing/geometry.js";
import { cellKey, reachableCells } from "../../src/sim/fishing/geometry.js";
import {
  bestFocusForCard,
  type Distribution,
  type FishingCardLike,
} from "../../src/strategy/fishing/cardChoice.js";

function dist(entries: Array<[Cell, number]>): Distribution {
  const m = new Map<string, { cell: Cell; p: number }>();
  for (const [cell, p] of entries) m.set(cellKey(cell), { cell, p });
  return m;
}

const card: FishingCardLike = {
  id: 999,
  manaCost: 1,
  hitZones: [5],
  critZones: [],
  hitEffects: [{ amount: 10 }],
  missEffects: [{ amount: -4 }],
  critEffects: [],
};

const GRID = 4;
const d = dist([[{ x: 2, y: 2 }, 1]]);

describe("the one-indexed grid", () => {
  it("puts [0,0] off the board and [1,1] on it", () => {
    expect(reachableCells(GRID, { x: 0, y: 0 }, 0)).toEqual([]);
    expect(reachableCells(GRID, { x: 1, y: 1 }, 0)).toEqual([{ x: 1, y: 1 }]);
  });

  it("still reaches the board from [0,0] while the meter has points to spend", () => {
    // This is exactly why the bug hid: off-grid is survivable at meter 3.
    expect(reachableCells(GRID, { x: 0, y: 0 }, 3).length).toBeGreaterThan(0);
  });
});

describe("bestFocusForCard at focusMeter 0 — the Focus Oil's own trigger state", () => {
  it("chooses the stay-put placement on an ON-GRID focus point", () => {
    const best = bestFocusForCard(card, 0, d, GRID, 1, 10, { current: { x: 2, y: 2 }, remaining: 0 });
    expect(best).not.toBeNull();
    // With zero budget the only legal placement is where the focus already is.
    expect(best!.focus).toEqual({ x: 2, y: 2 });
  });

  it("works from every on-grid corner and centre at zero budget", () => {
    for (const current of [
      { x: 1, y: 1 },
      { x: 1, y: GRID },
      { x: GRID, y: 1 },
      { x: GRID, y: GRID },
      { x: 2, y: 2 },
    ]) {
      const best = bestFocusForCard(card, 0, d, GRID, 1, 10, { current, remaining: 0 });
      expect(best!.focus, `from ${cellKey(current)}`).toEqual(current);
    }
  });

  it("THROWS on the off-grid [0,0] — the trap, pinned", () => {
    expect(() =>
      bestFocusForCard(card, 0, d, GRID, 1, 10, { current: { x: 0, y: 0 }, remaining: 0 }),
    ).toThrow("gridSize must be >= 1");
  });

  it("does NOT throw on [0,0] while the meter is full, which is why it hid", () => {
    expect(() =>
      bestFocusForCard(card, 0, d, GRID, 1, 10, { current: { x: 0, y: 0 }, remaining: 3 }),
    ).not.toThrow();
  });
});
