/**
 * tests/fishing/lethalOverride.test.ts — [session 74, brief §2b / GATE 2]
 *
 * **The `isLethal` tightening is built, and this file is what keeps it OFF.**
 *
 * The session-74 brief asked for two things that pull against each other: do
 * the work on `isLethal` now, and ship nothing until the `pConnect` diagnosis
 * settles (§3). The resolution is `STRICT_LETHALITY` — a real, strictly
 * narrower predicate, wired through `bestFocusForCard` and `chooseCard`, whose
 * default is the SHIPPED predicate everywhere. This file fails if that stops
 * being true, in the same shape as `redrawEnabled` and `policyApproved`.
 *
 * ── Three things are asserted, and the third is the one that matters ───────
 *
 *  1. **The default is `DEFAULT_LETHALITY`**, in the source text of both
 *     signatures AND behaviourally — a no-argument call must agree with an
 *     explicit `DEFAULT_LETHALITY` call on a case where the two predicates
 *     DISAGREE. Text alone would pass if the parameter were shadowed; behaviour
 *     alone would pass if a future edit changed the text and the behaviour
 *     together. Both, on a discriminating case, is the pin.
 *
 *  2. **No shipped call site passes `STRICT_LETHALITY`.** `src/` plus
 *     `scripts/liveFishing.ts`, which is the live loop. Analysis scripts may
 *     name it freely — measuring the tightening is the whole point of
 *     `scripts/isLethalBlastRadius.ts`.
 *
 *  3. **`STRICT_LETHALITY` is NOT INERT.** Session 73 shipped a knob sweep
 *     whose first draft scaled a field nothing read and reported the result as
 *     a measured zero — "an unread knob wearing a measured zero's clothes". A
 *     flag defaulted off is exactly the construction where that can happen
 *     again unnoticed, because nothing exercises it. So this file requires a
 *     concrete case where the two predicates give different answers, and would
 *     fail if `STRICT_LETHALITY` were quietly reduced to an alias.
 *
 * Note what is deliberately NOT asserted: that the tightening improves
 * anything. `scripts/isLethalBlastRadius.ts` measures it at inert on this
 * corpus (0 no-move turns in 440), and a test claiming a benefit would be
 * asserting a result the evidence does not support.
 *
 * Reads source text and calls pure functions. Writes nothing.
 */
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { cellKey, type Cell } from "../../src/sim/fishing/geometry.js";
import {
  bestFocusForCard,
  DEFAULT_LETHALITY,
  NEVER_LETHAL,
  STRICT_LETHALITY,
  type Distribution,
  type FishingCardLike,
} from "../../src/strategy/fishing/cardChoice.js";

const GRID = 4;
const FOCUS: Cell = { x: 2, y: 2 };

/** Zones 4 and 6 are the focus's left and right neighbours; zone 5 IS the focus cell. */
const CARD_MISSES_CENTRE: FishingCardLike = {
  id: 901,
  manaCost: 1,
  hitZones: [4, 6],
  critZones: [],
  hitEffects: [{ amount: 5 }],
  missEffects: [{ amount: -3 }],
  critEffects: [],
};

const CARD_COVERS_CENTRE: FishingCardLike = { ...CARD_MISSES_CENTRE, id: 902, hitZones: [4, 5, 6] };

/**
 * All the mass on the two cells zone 4 and zone 6 reach from `FOCUS`, so
 * `pAnyHit` is exactly 1 for BOTH cards. Nothing on the fish's own cell — which
 * is precisely the ring model's own shape, since `ringCells` is Manhattan
 * distance exactly 1 or 2 and never includes the current cell.
 */
const DIST: Distribution = new Map([
  [cellKey({ x: 2, y: 1 }), { cell: { x: 2, y: 1 }, p: 0.5 }],
  [cellKey({ x: 2, y: 3 }), { cell: { x: 2, y: 3 }, p: 0.5 }],
]);

/** Low enough that the damage half of `isLethal` passes on a 5-damage hit. */
const FISH_HP = 3;

/** One placement only, so the argmax cannot wander and the assertion is about the predicate. */
const at = (card: FishingCardLike, lethality?: Parameters<typeof bestFocusForCard>[11], currentCell?: Cell) =>
  bestFocusForCard(card, 0, DIST, GRID, 1, FISH_HP, { current: FOCUS, remaining: 3 }, true, 0, undefined, [FOCUS], lethality, currentCell);

describe("STRICT_LETHALITY is a real predicate, not an alias", () => {
  it("discriminates: the shipped predicate says lethal where the strict one does not", () => {
    // The whole test file rests on this case actually discriminating. If it
    // stops doing so, every "the default is DEFAULT_LETHALITY" assertion below
    // becomes vacuous — it would pass against an alias.
    expect(at(CARD_MISSES_CENTRE, DEFAULT_LETHALITY, FOCUS).lethal, "shipped predicate should certify this").toBe(true);
    expect(at(CARD_MISSES_CENTRE, STRICT_LETHALITY, FOCUS).lethal, "strict predicate should refuse: the fish's own cell is uncovered").toBe(false);
  });

  it("agrees with the shipped predicate when the card DOES cover the fish's current cell", () => {
    expect(at(CARD_COVERS_CENTRE, DEFAULT_LETHALITY, FOCUS).lethal).toBe(true);
    expect(at(CARD_COVERS_CENTRE, STRICT_LETHALITY, FOCUS).lethal).toBe(true);
  });

  it("fails closed without a current cell — an override is never granted on missing information", () => {
    expect(at(CARD_COVERS_CENTRE, STRICT_LETHALITY, undefined).lethal).toBe(false);
  });

  it("is strictly narrower: it never certifies something the shipped predicate refuses", () => {
    for (const card of [CARD_MISSES_CENTRE, CARD_COVERS_CENTRE]) {
      for (const cell of [FOCUS, { x: 1, y: 1 }, undefined]) {
        if (at(card, STRICT_LETHALITY, cell).lethal) {
          expect(at(card, DEFAULT_LETHALITY, cell).lethal, `strict certified ${card.id} where shipped did not`).toBe(true);
        }
      }
    }
  });

  it("NEVER_LETHAL is the diagnostic floor and certifies nothing", () => {
    expect(at(CARD_COVERS_CENTRE, NEVER_LETHAL, FOCUS).lethal).toBe(false);
  });
});

describe("the tightening's default is OFF — this is the pin", () => {
  it("a no-argument call behaves as DEFAULT_LETHALITY on a case where the two predicates DISAGREE", () => {
    // Not `toBe(true)` against a constant — compared against the explicit
    // DEFAULT arm, on the discriminating case, so this fails if the default
    // ever becomes STRICT_LETHALITY.
    expect(at(CARD_MISSES_CENTRE).lethal).toBe(at(CARD_MISSES_CENTRE, DEFAULT_LETHALITY, FOCUS).lethal);
    expect(at(CARD_MISSES_CENTRE).lethal).not.toBe(at(CARD_MISSES_CENTRE, STRICT_LETHALITY, FOCUS).lethal);
  });

  it("both signatures default the parameter to DEFAULT_LETHALITY in source", () => {
    const src = readFileSync("src/strategy/fishing/cardChoice.ts", "utf8");
    const defaults = [...src.matchAll(/lethality: LethalityPolicy = (\w+)/g)].map((m) => m[1]);
    expect(defaults.length, "both `bestFocusForCard` and `chooseCard` should declare the parameter").toBe(2);
    expect(new Set(defaults)).toEqual(new Set(["DEFAULT_LETHALITY"]));
  });

  it("DEFAULT_LETHALITY is the shipped predicate, unmodified", () => {
    const src = readFileSync("src/strategy/fishing/cardChoice.ts", "utf8");
    expect(src, "the shipped certainty test must still be the one DEFAULT_LETHALITY calls").toContain(
      "if (pAnyHit < 0.999999) return false;",
    );
    expect(src).toContain('name: "certainty",');
  });

  it("no shipped call site passes STRICT_LETHALITY", () => {
    // `src/` plus the live loop. Analysis scripts are excluded on purpose:
    // `scripts/isLethalBlastRadius.ts` exists to score the tightening and must
    // be free to name it.
    const out = execSync(`grep -rn --include='*.ts' -e STRICT_LETHALITY src scripts/liveFishing.ts || true`, { encoding: "utf8" });
    const callSites = out
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        const [file, , ...rest] = l.split(":");
        return { file: file!, text: rest.join(":").trim() };
      })
      // The definition and its doc block are where the name is supposed to be.
      .filter((h) => !h.text.startsWith("*") && !h.text.startsWith("//") && !h.text.startsWith("/*"))
      .filter((h) => !h.text.startsWith("export const STRICT_LETHALITY"));
    expect(callSites, `STRICT_LETHALITY reached shipped code: ${JSON.stringify(callSites)}`).toEqual([]);
  });

  it("the replay's lethality option also defaults to the shipped predicate", () => {
    const src = readFileSync("src/sim/fishing/offPolicyReplay.ts", "utf8");
    expect(src).toContain("lethality: LethalityPolicy = opts.lethality ?? DEFAULT_LETHALITY");
  });
});
