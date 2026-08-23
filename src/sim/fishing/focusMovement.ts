/**
 * src/sim/fishing/focusMovement.ts — [session 86, brief §1 / GATE 1] does a
 * simulator arm ever AIM? A direct probe of the focus meter and of the focus
 * DECISION, run on the same cast the economy figures are computed from.
 *
 * ## The question this answers, and why a summary statistic could not
 *
 * Session 85 noticed that `damageEconomy.ts`'s `SIM blind` arm is byte-
 * identical at `focusReserveWeight` 0 and 3 — same plays, same hits, same
 * modes, to every printed digit — while the bare arm moves with the weight,
 * and asked whether that invariance is a real structural fact or a wiring bug.
 * The answer cannot be read off `CastResult`: it reports end-of-cast
 * aggregates, and "did the policy ever move its focus point" is a question
 * about the DECISIONS inside the cast.
 *
 * So this instruments the two places the answer can show up, and reports both
 * rather than picking one:
 *
 *  - **the meter**, through `castSim.ts`'s `observeTurn` hook — a turn moved
 *    focus when `focusRemaining` fell across the two states that bracket it;
 *  - **the decision**, by wrapping the policy — a play AIMED when the focus
 *    cell it chose differs from `ctx.focusBudget.current` at the moment it
 *    chose.
 *
 * The two are different measurements of the same event and they should agree:
 * a chosen cell that differs from the current one is at distance >= 1, so it
 * costs meter, and (absent an oil) nothing else spends meter. **They are both
 * reported precisely so a divergence is visible instead of averaged away.** A
 * divergence would mean one of those two sentences is false — most likely on
 * an arm supplying `oils`, where a restore can mask a spend inside one turn —
 * and it is a reason to distrust the numbers, not to pick the friendlier one.
 *
 * ## The answer, for the reader who does not want to run it
 *
 * 400 casts per arm, `REAL_DECK`, seed base 1, no `data/` needed:
 *
 * ```
 *   arm                        turns   moved   spent   plays  aimed  cells used
 *   BLIND (matcherPool: [])  w=0  1963      0       0     763      0  (2,2) only
 *   BLIND (matcherPool: [])  w=3  1963      0       0     763      0  (2,2) only
 *   BARE  (default pool)     w=0  1823    752    1047    1328    752  15 of 16
 *   BARE  (default pool)     w=3  1669    713     913    1284    713  15 of 16
 * ```
 *
 * **Not one focus move in 1,963 turns, and all 763 plays fired from the
 * opening cell (2,2).** A term that prices focus MOVEMENT cannot bind on a
 * policy that never moves, so session 85's invariance is a tautology rather
 * than a bug — and its "away" readings on the other arms are unaffected by it.
 * The bare arm is the control: the same probe on the same code sees 752 moves
 * and 1047 points spent, which is what makes "0" a measurement instead of a
 * broken instrument. **A pin without that control has not shown the probe can
 * see movement at all.**
 *
 * The mechanism is in `castSim.ts`'s own comment on `blindFallback`: with
 * `matcherPool: []` the sim falls back to a UNIFORM distribution, hardcoded,
 * regardless of any real transition data. Uniform makes EV identical at every
 * focus cell of the same footprint, so the argmax never has a reason to prefer
 * a different cell — and never does.
 *
 * ## ⚠ THE CONDITION IS "UNIFORM", NOT "BLIND" — measured, because the loose
 * version of this finding would be false
 *
 * "A blind arm never aims" is the wrong generalisation. `matcherPool: []` is
 * necessary and not sufficient: what suppresses aiming is that NOTHING supplies
 * a non-uniform distribution. Probed on the same 400 casts:
 *
 * ```
 *   matcherPool: []                              0 moves / 1963 turns
 *   matcherPool: [] + empiricalFish              0 moves / 1963 turns
 *   matcherPool: [] + ringModel                824 moves / 2492 turns
 *   matcherPool: [] + blindFallback            838 moves / 2443 turns
 *   mined matcher + blindFallback (live cfg)   829 moves / 2346 turns
 * ```
 *
 * So **`scripts/focusReserveAblation.ts`'s sweep is NOT vacuous** — its arm A
 * is `matcherPool: []` but supplies `ringModel`, and it aims on a third of its
 * turns. The arms that never aim are the ones with no distribution at all:
 * `damageEconomy.ts`'s `SIM blind` and `deckObjectiveSweep.ts`'s baseline. The
 * three rows needing `data/` are measured but not test-pinned, because a
 * committed test may not read a gitignored corpus; `ringModel` IS pinned, on a
 * synthetic table built in the test.
 *
 * ## The stronger form: the no-aim arm's whole decision sequence is fish-blind
 *
 * At uniform, the policy's choices do not depend on where the fish is, and the
 * consequence shows up as an exact identity rather than an approximation:
 * turning `empiricalFish` on changes which shots LAND (313 -> 353 hits of 763)
 * and does not move the turn count, the play count, or the redraw count by one.
 * The arm plays the same cast against any fish.
 *
 * Param-independent, so it is not an artefact of `PROBE_PARAMS`: on `castSim`'s
 * own defaults — `deckObjectiveSweep.ts`'s configuration — the same arm reads
 * **0 moves in 1944 turns, 840 plays, all at (2,2)**.
 *
 * ## What this does NOT license
 *
 * It does not rename, fix, or re-tune anything. `SIM blind` stays exactly the
 * arm it was; the deck sweep's baselines stay comparable to each other. What
 * changes is what may be CLAIMED for it: it is a **no-aim** arm, not a
 * weak-predictor arm, and it must not be read as a live proxy on anything
 * focus-related — live spends 0.85 of its meter on the opening play alone in
 * today's era (`castEra.ts`), and 1.55 before it.
 *
 * ## A correction to the session-86 brief, recorded rather than absorbed
 *
 * The brief reports **2363 turns** per blind arm. 2363 is the number of STATES
 * `observeTurn` emits over 400 casts — one per turn taken PLUS the terminal
 * state — so the turn count is 1963, exactly 400 lower, and the same offset
 * applies to the bare arm's 2223/2069. Every movement figure (0/0, 752/1047,
 * 713/913) reproduces the brief exactly, which is what identifies this as the
 * same measurement with a different denominator rather than a near miss. The
 * terminal state cannot move focus — it is the state the cast ended in — so
 * counting it in the denominator understates the rate. At a numerator of zero
 * it changes nothing; it is corrected because the next reader will divide.
 */

import {
  simulateCast,
  makeMatcherFishPolicy,
  REDRAW_THRESHOLD,
  type CastOptions,
  type FishPolicy,
} from "./castSim.js";

/** One arm's focus-movement probe. Counts only; no rates, so a caller cannot quote a ratio this module did not choose a denominator for. */
export interface FocusMovementProbe {
  label: string;
  /** The `focusReserveWeight` the wrapped policy ran under. */
  weight: number;
  casts: number;
  /**
   * `observeTurn` emissions: one per turn taken plus the terminal state, so
   * `states === turns + casts`. Reported because the brief this pins counted
   * these and called them turns — see the header.
   */
  states: number;
  /** Turns taken = intervals between consecutive states. THE denominator for `turnsThatMoved`. */
  turns: number;
  /** Turns across which `focusRemaining` FELL. */
  turnsThatMoved: number;
  /** Total meter points spent, summed over those falls. */
  focusSpent: number;
  /** Turns across which `focusRemaining` ROSE. Nonzero only on an arm with oils; a surprise anywhere else. */
  turnsThatRestored: number;
  /** Play actions the policy returned. */
  plays: number;
  /** Plays whose chosen focus cell differed from `focusBudget.current`. Should equal `turnsThatMoved` — see the header. */
  playsThatAimed: number;
  /** Every distinct focus cell the policy ever chose, as `"x,y"`, sorted. Length 1 is the no-aim signature. */
  focusCells: string[];
}

/**
 * The live-shaped cast parameters. Byte-identical to the `REAL_PARAMS` literal
 * in `scripts/damageEconomy.ts` — and to the six other scripts that each keep
 * their own copy, which is this repo's standing convention for it. Repeated
 * here rather than imported because `src/` does not import from `scripts/`;
 * **if this ever diverges from `damageEconomy.ts`'s copy, this probe stops
 * describing the arm whose economy figures are published.**
 */
export const PROBE_PARAMS = {
  fishMaxHp: 21,
  startFishHpRatio: 13 / 21,
  startMana: 10,
  handSize: 3,
  gridSize: 4,
} as const;

/**
 * Run one arm and count. `extra` is the arm's shape exactly as
 * `scripts/damageEconomy.ts` writes it (`{ deckIds, matcherPool: [] }` for
 * blind, `{ deckIds }` for bare), so the arms this probes are the arms whose
 * economy figures are published — not lookalikes.
 *
 * The policy is WRAPPED, not reimplemented: `inner.act` decides and this only
 * watches, so a probed run makes the same decisions an unprobed one would.
 * `observeTurn` is likewise documented as purely observational.
 */
export function measureFocusMovement(
  label: string,
  extra: Omit<CastOptions, "seed" | "policy">,
  weight: number,
  runs = 400,
  seed = 1,
): FocusMovementProbe {
  const inner = makeMatcherFishPolicy(REDRAW_THRESHOLD, true, weight);
  const cells = new Set<string>();
  let plays = 0;
  let playsThatAimed = 0;

  const policy: FishPolicy = {
    name: inner.name,
    act(ctx, rng) {
      const action = inner.act(ctx, rng);
      if (action.type === "play") {
        plays++;
        cells.add(`${action.focus.x},${action.focus.y}`);
        const cur = ctx.focusBudget.current;
        if (action.focus.x !== cur.x || action.focus.y !== cur.y) playsThatAimed++;
      }
      return action;
    },
  };

  let states = 0;
  let turns = 0;
  let turnsThatMoved = 0;
  let turnsThatRestored = 0;
  let focusSpent = 0;

  for (let i = 0; i < runs; i++) {
    const focus: number[] = [];
    simulateCast({
      policy,
      ...PROBE_PARAMS,
      ...extra,
      seed: seed + i,
      observeTurn: (s) => focus.push(s.focusRemaining),
    });
    states += focus.length;
    for (let j = 1; j < focus.length; j++) {
      turns++;
      const spent = focus[j - 1]! - focus[j]!;
      if (spent > 0) {
        turnsThatMoved++;
        focusSpent += spent;
      } else if (spent < 0) {
        turnsThatRestored++;
      }
    }
  }

  return {
    label,
    weight,
    casts: runs,
    states,
    turns,
    turnsThatMoved,
    focusSpent,
    turnsThatRestored,
    plays,
    playsThatAimed,
    focusCells: [...cells].sort(),
  };
}

/** One row, aligned with the header table's columns. */
export function formatFocusMovement(p: FocusMovementProbe): string {
  const cells =
    p.focusCells.length === 1
      ? `(${p.focusCells[0]}) ONLY`
      : `${p.focusCells.length} of ${PROBE_PARAMS.gridSize * PROBE_PARAMS.gridSize}`;
  return (
    `  ${p.label.padEnd(26)}w=${p.weight}  ` +
    `turns ${String(p.turns).padStart(5)}  moved ${String(p.turnsThatMoved).padStart(4)}  ` +
    `spent ${String(p.focusSpent).padStart(5)}  plays ${String(p.plays).padStart(5)}  ` +
    `aimed ${String(p.playsThatAimed).padStart(4)}  cells used ${cells}`
  );
}
