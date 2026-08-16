/**
 * src/strategy/potions.ts — Task 12 Stage B timing rule. Pure; no I/O.
 *
 * One rule, chosen from `scripts/potionTimingSweep.ts`'s sweep: fire the
 * next potion the instant own HP fraction drops to/below the threshold.
 * 0.5 is the sweep's best-performing threshold among {0.2, 0.34, 0.5} at
 * every loadout size tested (2000 runs each) — proactive healing beats
 * waiting for "already critical," because a single lethal exchange can
 * cross a low threshold and end the battle before the check ever fires.
 */
export const DEFAULT_POTION_THRESHOLD = 0.5;

export function shouldUsePotion(hp: number, hpMax: number, potionsRemaining: number, threshold: number): boolean {
  if (potionsRemaining <= 0) return false;
  return hp / hpMax <= threshold;
}
