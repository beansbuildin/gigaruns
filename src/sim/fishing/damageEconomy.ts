/**
 * src/sim/fishing/damageEconomy.ts — [session 80 §1, GATE 1] the per-play
 * `fishHp` drift, defined ONCE so the live corpus and the simulator are scored
 * by the same function.
 *
 * ## The quantity
 *
 *     E[Δ fishHp per play] = P(hit) × (−damage) + P(miss) × (+heal)
 *
 * A scalar that separates the two things an outcome rate confounds: **how
 * often a shot lands** and **what a landed shot is worth**. Session 48's
 * `lossDecomposition.ts` wrote the decision table that makes this the right
 * question — meter-outs dominating with the focus meter INTACT selects the
 * damage economy — and nothing measured the branch's own quantity for the
 * thirty-one sessions between.
 *
 * ## The predicate, stated so it can be audited
 *
 * BOTH halves measure the CLAMPED state-to-state delta — the change a reader
 * would see across two consecutive states — not the effect amount a card
 * claims:
 *
 *  - live: consecutive `castTrace.ts` turn states, on every turn carrying a
 *    `play`;
 *  - sim: consecutive states from `castSim.ts`'s `observeTurn`, which fires
 *    once per turn index plus the terminal state — the same shape a trace
 *    records, and the same hook `scripts/focusProfileCheck.ts` uses.
 *
 * Clamping both sides is the choice that makes the comparison honest rather
 * than the one that makes it convenient. The server clamps `fishHp` at
 * `fishMaxHp`, `castSim` clamps at the same place, and a terminal miss is the
 * single most common event in the fishery — measuring live unclamped against a
 * clamping sim would compare two different quantities on the event that
 * dominates. `corpusEconomyUnclamped` reports the other reading alongside so
 * the size of the clamp is visible rather than hidden.
 *
 * ## ⚠ ONE THING THIS FILE ASSERTS RATHER THAN ASSUMES
 *
 * The live corpus has no non-play turns — `redrawEnabled` is false in
 * `liveFishing.ts`, so all 548 live turns are card plays. The simulator's
 * policy DOES redraw, and a redraw leaves `fishHp` untouched, so sim turns are
 * filtered to the ones that moved HP. That filter is only correct if every
 * shot moves HP, which is NOT structurally guaranteed — card 78's `hitEffects`
 * is empty (it deals 11 on a crit and nothing on an ordinary hit). So the
 * denominator is checked against `CastResult.shots` and
 * `assertShotsAccountedFor` THROWS on a mismatch. A drift computed on the
 * wrong denominator is exactly the kind of number that gets quoted for three
 * sessions before anyone re-derives it.
 *
 * Pure apart from reading committed fixtures and running the seeded simulator:
 * no network, no `data/`, nothing written.
 */

import { simulateCast, type CastOptions, type CastResult } from "./castSim.js";
import type { CastTrace } from "./castTrace.js";

/** One side's per-play economy. Identical fields on both halves, by construction. */
export interface Economy {
  label: string;
  casts: number;
  plays: number;
  hits: number;
  misses: number;
  /** Plays whose clamped `fishHp` delta is exactly 0. Zero on both sides today — see the header. */
  unchanged: number;
  hitRate: number;
  meanDamage: number;
  meanHeal: number;
  /** P(hit)·(−damage) + P(miss)·(+heal) — the whole point of the file. */
  drift: number;
  damageHist: Map<number, number>;
  healHist: Map<number, number>;
}

/** A simulator arm: its economy plus the accounting that validates the economy's denominator. */
export interface SimArm {
  economy: Economy;
  /** Turn-to-turn transitions observed, plays and redraws alike. */
  turns: number;
  /** `CastResult.shots` summed — the independent count the denominator is checked against. */
  shots: number;
  hitsReported: number;
  /** `CastResult.redrawMana` summed. Live this is structurally 0: the bot cannot redraw. */
  redrawMana: number;
}

export function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function modeOf(h: ReadonlyMap<number, number>): { value: number; n: number } {
  let best = { value: 0, n: -1 };
  for (const [value, n] of h) if (n > best.n) best = { value, n };
  return best;
}

/**
 * The one place a sequence of per-play HP deltas becomes an economy. Both
 * halves call THIS — a second implementation, however faithful, would make the
 * comparison a comparison of two implementations.
 */
export function economyOf(label: string, casts: number, deltas: readonly number[]): Economy {
  const damages: number[] = [];
  const heals: number[] = [];
  const damageHist = new Map<number, number>();
  const healHist = new Map<number, number>();
  let unchanged = 0;
  for (const d of deltas) {
    if (d < 0) {
      damages.push(-d);
      damageHist.set(-d, (damageHist.get(-d) ?? 0) + 1);
    } else if (d > 0) {
      heals.push(d);
      healHist.set(d, (healHist.get(d) ?? 0) + 1);
    } else {
      unchanged++;
    }
  }
  const plays = deltas.length;
  return {
    label,
    casts,
    plays,
    hits: damages.length,
    misses: heals.length,
    unchanged,
    hitRate: plays === 0 ? 0 : damages.length / plays,
    meanDamage: mean(damages),
    meanHeal: mean(heals),
    // Straight off the deltas rather than re-multiplied out of the rounded
    // rates: the identity is exact, and printing a drift that disagrees with
    // its own three components by a rounding error invites the reader to
    // re-derive it and get a third answer.
    drift: plays === 0 ? 0 : deltas.reduce((a, b) => a + b, 0) / plays,
    damageHist,
    healHist,
  };
}

/**
 * The live half. Every turn carrying a `play`, delta taken against the state
 * before it — the same pair of numbers a reader watching two consecutive
 * responses would see.
 */
export function corpusEconomy(traces: readonly CastTrace[], label = "LIVE — every clean trace on disk"): Economy {
  const deltas: number[] = [];
  for (const t of traces) {
    for (let i = 1; i < t.turns.length; i++) {
      const cur = t.turns[i]!;
      if (!cur.play) continue;
      deltas.push(cur.fishHp - t.turns[i - 1]!.fishHp);
    }
  }
  return economyOf(label, traces.length, deltas);
}

/** The live half again, UNCLAMPED: the server's own `FISH_HP_DIFF` value. */
export function corpusEconomyUnclamped(
  traces: readonly CastTrace[],
  label = "LIVE — same plays, UNCLAMPED (server's FISH_HP_DIFF)",
): Economy {
  const deltas: number[] = [];
  for (const t of traces) {
    for (const turn of t.turns) {
      // `fishHpDiff` is POSITIVE on a hit (damage dealt) and negative on a
      // miss — the opposite sign convention to a state delta. Negated so both
      // economies are in "change in fishHp" units and `economyOf` can be shared.
      if (turn.play) deltas.push(-turn.play.fishHpDiff);
    }
  }
  return economyOf(label, traces.length, deltas);
}

/**
 * The sim half. `observeTurn` emits one state per turn index plus the terminal
 * state, so consecutive states bracket exactly one turn. Turns that did not
 * move `fishHp` are dropped as non-plays and the drop is validated by
 * `assertShotsAccountedFor` — see the header.
 */
export function simEconomy(
  label: string,
  opts: Omit<CastOptions, "seed">,
  runs: number,
  seed = 1,
): SimArm {
  const deltas: number[] = [];
  let turns = 0;
  let shots = 0;
  let hitsReported = 0;
  let redrawMana = 0;
  for (let i = 0; i < runs; i++) {
    const hp: number[] = [];
    const r: CastResult = simulateCast({ ...opts, seed: seed + i, observeTurn: (s) => hp.push(s.fishHp) });
    shots += r.shots;
    hitsReported += r.hits;
    redrawMana += r.redrawMana;
    for (let j = 1; j < hp.length; j++) {
      turns++;
      const d = hp[j]! - hp[j - 1]!;
      if (d !== 0) deltas.push(d);
    }
  }
  return { economy: economyOf(label, runs, deltas), turns, shots, hitsReported, redrawMana };
}

/**
 * The identity this arm's denominator depends on: every shot moved `fishHp`,
 * and every turn that did not was a non-play. Throws rather than warns.
 */
export function assertShotsAccountedFor(arm: SimArm): void {
  if (arm.economy.plays !== arm.shots) {
    throw new Error(
      `${arm.economy.label}: ${arm.economy.plays} non-zero deltas against ${arm.shots} shots reported by ` +
        `CastResult. A shot that moved fishHp by 0 (card 78's empty hitEffects) or a non-play that moved ` +
        `it would break the per-play denominator. Fix the predicate, do not adjust the number.`,
    );
  }
  if (arm.economy.hits !== arm.hitsReported) {
    throw new Error(
      `${arm.economy.label}: ${arm.economy.hits} negative deltas against ${arm.hitsReported} hits reported ` +
        `by CastResult.`,
    );
  }
}
