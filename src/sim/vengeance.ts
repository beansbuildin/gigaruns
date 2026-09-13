/**
 * `Vengeance` — the in-combat model. Pure; no I/O.
 *
 * [session 130, [USER] directive 2026-09-13 "Model it"]
 *
 * ## What it is — measured over the WHOLE corpus, not the n=2 the brief quoted
 *
 * Session 129 recorded Vengeance as "n=2, +6 at val1 25". That count came off
 * `inertAtZero`'s narrow filter. Asked directly, the corpus holds **29
 * damage-dealing exchanges with a Vengeance attacker across seven runs**, and
 * it answers the WHOLE mechanic, not only the magnitude:
 *
 * - **TRIGGER: the holder LOSES an exchange** (`outcome === -1` from its side).
 *   Every loss by a holder not already carrying the status gains
 *   `Vengeance: 25`; no win and no tie ever does. Taking HP damage is NOT the
 *   trigger — two losses that dealt the holder 0 still armed it.
 * - **HOLDS, does not stack.** A further loss while armed leaves it at 25.
 * - **CONSUMED by the next exchange in which the holder DEALS damage** (a win
 *   or a tie) — the status is absent on that exchange's after-state.
 * - **EFFECT: that damage is `floor(x * 1.25)`**, applied AFTER the crit
 *   doubling and BEFORE the attacker's `Weak` (x0.75), the victim's
 *   `Vulnerable` (x1.25) and the victim's block (halve). Each step floors.
 *   Applying Weak before Vengeance fails 3 of 29; a single floor over the
 *   combined product fails 2 of 29; no Vengeance effect at all fails 29 of 29.
 * - **INERT on the holder as VICTIM** — 8/8 otherwise-clean exchanges took
 *   exactly the attacker's ATK.
 *
 * ## What is NOT known, and is refused rather than extrapolated
 *
 * **Every armed status in the corpus reads 25, and every pickup that ever armed
 * was a `selectedVal1 25` pickup.** The one `val1 15` pickup
 * (`run-2026-08-20-22-46-26`) never lost an exchange afterwards, so it never
 * armed. "25 means +25%" is therefore the natural reading and NOT a
 * measurement: at a single value, "+amount%" and "+25% whatever the amount" are
 * the same prediction. `vengeanceMultiplier` returns `undefined` for any other
 * amount so a caller must treat it as unmodelled — fail closed, rule 5.
 *
 * Whether the composition order with Weak and Vulnerable is exactly as written
 * is established only where it separates: Weak-before-Vengeance is falsified
 * three times; the relative order of Weak and Vulnerable is NOT separated by any
 * exchange here (26 -> 32 -> 24 -> 30 either way).
 *
 * ## What this does NOT do
 *
 * `src/sim/combat.ts` is untouched. The clean exchange model tracks no status
 * at all, and `coverage.ts` refuses any state carrying one — so there is no
 * engine path a Vengeance multiplier could enter without Weak, Vulnerable, crit
 * and block entering with it. This module is consumed by
 * `scripts/statusEffects.ts` and pinned by `tests/statusEffects.test.ts`, the
 * same standing as `blockedMove.ts`. `BOON_MODELS.Vengeance` stays `latent`,
 * which is still exactly right about the PICKUP.
 */

/** The only armed amount the corpus has ever shown. */
export const VENGEANCE_ARMED_AMOUNT = 25;

/** Damage multiplier at the one observed armed amount. Floors. */
export const VENGEANCE_MULTIPLIER = 1.25;

/** `undefined` = unmodelled amount; do not extrapolate "+amount%". */
export function vengeanceMultiplier(amount: number): number | undefined {
  if (amount === 0) return 1;
  return amount === VENGEANCE_ARMED_AMOUNT ? VENGEANCE_MULTIPLIER : undefined;
}

export interface VengeanceDamageInput {
  /** The attacker's `currentATK` for the move it played. */
  atk: number;
  crit: boolean;
  /** The attacker's armed Vengeance amount (0 or absent = not armed). */
  vengeance: number;
  /** The attacker carries a non-zero `Weak`. */
  weak: boolean;
  /** The victim carries a non-zero `Vulnerable`. */
  vulnerable: boolean;
  /** The victim's block proc fired. */
  block: boolean;
}

/**
 * Combat damage dealt by a Vengeance holder, or `undefined` when the armed
 * amount is one the corpus has never shown.
 */
export function vengeanceDamage(i: VengeanceDamageInput): number | undefined {
  const mult = vengeanceMultiplier(i.vengeance);
  if (mult === undefined) return undefined;
  let x = i.crit ? 2 * i.atk : i.atk;
  x = Math.floor(x * mult);
  if (i.weak) x = Math.floor(x * 0.75);
  if (i.vulnerable) x = Math.floor(x * 1.25);
  if (i.block) x = Math.floor(x / 2);
  return x;
}

/**
 * The holder's Vengeance amount after an exchange, given the amount before it.
 * `outcome` is from the HOLDER's side: 1 won, 0 tie, -1 lost. `dealt` is
 * whether the holder dealt combat damage this exchange.
 */
export function vengeanceAfter(before: number | undefined, outcome: -1 | 0 | 1, dealt: boolean): number | undefined {
  const armed = before !== undefined && before > 0;
  if (outcome === -1) return armed ? before : VENGEANCE_ARMED_AMOUNT;
  if (armed && dealt) return undefined;
  return before;
}
