/**
 * src/sim/enemyBuffs.ts — the enemy-buff table, and the one distinction that
 * decides whether a buffed battle is scorable.
 *
 * ── WHY THIS EXISTS NOW ────────────────────────────────────────────────────
 *
 * CLAUDE.md rule 8 ("always choose the lowest tier actually offered") is under
 * review for a session-57 reversal. Measured on the corpus, that reversal
 * changes what the simulator sees on EVERY fight:
 *
 *     tier 0 (Safe)       188 / 188 offered paths — enemyBuff null, rolled all zero
 *     tier 1 (Risky)      298 / 298 carry a buff; 293 also carry non-zero rolled stats
 *     tier 2 (Dangerous)  324 / 324 carry both
 *
 * So after a flip, 100% of fights are buffed. If a buff always meant
 * "unscorable", the sim would go permanently blind and nobody would notice for
 * several sessions. Hence this table.
 *
 * ── THE FINDING THAT MAKES MOST BUFFS FREE ─────────────────────────────────
 *
 * **A stat-modifying buff is ALREADY BAKED INTO the numbers the wire reports.**
 * This is not an assumption; the corpus contains a natural experiment. Four
 * enemies (Rooms 64, 65, 66, 67) were captured both clean (`enemyBuff: null`)
 * and under several buffs, and the buff's own declared `effects[]` predict the
 * buffed `startingATK` / `startingDEF` / `health.starting` / `shield.starting`
 * **exactly, 30 of 30, with zero mismatches** — see `scripts/enemyBuffAudit.ts`,
 * which re-derives that number rather than quoting it.
 *
 *     Enemy Room 64 base rock ATK 14 -> `bloodthirsty` 18  (+4, as declared)
 *     Enemy Room 64 base hp 35 / armor 14 -> `hardy` 38 / 16  (+3 / +2)
 *     Enemy Room 64 base hp 35 / armor 14 -> `overgrown` 46 / 19  (+30%, CEILING)
 *
 * The consequence inverts the obvious plan. The session-56 brief asked to
 * "extend the enemy model to APPLY `rolledEnemyStats` and a known `enemyBuff`".
 * Applying a stat buff would **double-count it** — it is already in the stats
 * the combat model reads. What is actually required is the opposite: recognise
 * that such a buff changes no combat RULE, only numbers already read, and
 * therefore stop marking the battle unscorable for it.
 *
 * `applyStatBuff()` below exists for VERIFICATION (predict a buffed stat block
 * from a clean baseline and check it), never to mutate a combatant during a
 * battle. Combat must not call it.
 *
 * ── WHAT STAYS UNSCORABLE, AND WHY THE LINE IS THE EFFECT KIND ─────────────
 *
 * A `mechanic` buff adds something the clean exchange model has no rule for —
 * a status application (Burn / Weak / Vulnerable), a lifesteal on win, a max-
 * armor corrode, a status the battle starts with. Those are genuinely new
 * mechanics, and SPEC §4e/`coverage.ts` already fail closed on statuses. They
 * keep raising `ENEMY_BUFF`.
 *
 * The line is drawn on the effect KIND rather than the buff id deliberately.
 * There are 46 ids in the corpus but only 12 effect kinds, ids are added by the
 * game far faster than mechanics are, and a NEW id built entirely from kinds we
 * already understand should be handled correctly on sight rather than halting.
 * An unrecognised KIND is what must fail closed — that is where the real
 * unknown lives. `classifyBuff` returns `"unknown"` for both an unrecognised
 * kind and an id absent from this table, and both make the battle unscorable.
 *
 * ── WHAT THIS DOES NOT FIX, AND IT IS THE BIGGER HALF ──────────────────────
 *
 * `rolledEnemyStats` remains unmodelled and is NOT touched here. SPEC §4e is
 * explicit that evasion/block/lck/tenacity are **percent proc chances of 1-5%**,
 * and that reading a proc that small needs hundreds of observations. Modelling
 * buffs therefore removes ONE of the two blockers on a non-Safe fight, and the
 * corpus says it is the smaller one: of the 622 non-Safe paths ever offered,
 * **617 also carry non-zero rolled stats**. Only 5 would become fully scorable
 * from this change alone.
 *
 * Room 9 (`Enemy Room 71`) is the concrete case and it does NOT come free:
 * `bloodthirsty` is `statOnly` and clears, but evasion 3 / block 1 / lck 2 /
 * tenacity 2 keep `ROLLED_STATS` raised. It stays unscorable. See the recap.
 */

/** The twelve effect kinds observed across all 46 corpus buff ids. */
export const STAT_ONLY_KINDS = new Set([
  "flatAtk",
  "flatDef",
  "flatHP",
  "flatShield",
  "pctAtk",
  "pctDef",
  "pctHP",
  "pctShield",
]);

export const MECHANIC_KINDS = new Set([
  "onEnemyWinExchange_applyStatus",
  "onEnemyWinExchange_lifesteal",
  "onEnemyWinExchange_corrode",
  "startBattleStatus",
]);

export interface BuffEffect {
  kind: string;
  amount?: number;
  percent?: number;
  statusType?: string;
  /** The ACTION vocabulary — `rock`/`paper`/`scissor`. See SPEC §3g. */
  moveType?: string;
}

export type BuffClass = "statOnly" | "mechanic" | "unknown";

export interface EnemyBuffModel {
  id: string;
  name: string;
  /** The game's own text, colour markup stripped. Not modelled from — checked against. */
  description: string;
  minTier: number;
  kind: Exclude<BuffClass, "unknown">;
  effects: readonly BuffEffect[];
}

/**
 * Every `enemyBuff.id` in `fixtures/dungeon-runs/`, transcribed from the wire —
 * the definitions are self-describing, so nothing here is inferred from a name.
 *
 * **24 base ids and 22 `perpetual_` twins** — 46 entries, but NOT a mirror.
 * [session 63 CORRECTION: this said "23 plus 23", which implied a symmetry the
 * corpus does not have.] `perpetual_corrosiveShield` and
 * `perpetual_corrosiveMagic` are the two missing twins.
 *
 * [session 82 CORRECTION: `perpetual_corrosiveShield` no longer appears zero
 * times — run `25011957` offered it in room 2 and it is now in `fixtures/` 4
 * times. `perpetual_corrosiveMagic` is still at zero.] **The table is still
 * NOT completed, and that is the finding rather than an omission.** The twin
 * arrived exactly as this comment predicted it would: inline on the wire,
 * carrying its own `effects: [{ kind: onEnemyWinExchange_corrode, amount: 3,
 * moveType: "paper" }]`, and it classified correctly with no entry present. So
 * the capture that would license "completing" the table is also the capture
 * proving the entry buys nothing. Do not add it without a reason beyond
 * symmetry — that is still the inference rule 1 forbids.
 * `tests/corrode.test.ts` pins the gap, and its synthetic wire-shaped case
 * turned out to match the real one field for field.
 *
 * The `perpetual_` prefix is a DELIVERY difference (the buff persists across the
 * run rather than sitting on one path) and not an effect difference, so the
 * twins classify identically. Regenerated by `scripts/enemyBuffAudit.ts`,
 * which also asserts this table still matches the corpus.
 */
export const ENEMY_BUFFS: Record<string, EnemyBuffModel> = {
  "armored": {
    id: "armored",
    name: "Armored",
    description: "+4 DEF on all moves",
    minTier: 1,
    kind: "statOnly",
    effects: [
      { kind: "flatDef", amount: 4 },
    ],
  },
  "bloodguard": {
    id: "bloodguard",
    name: "Bloodguard",
    description: "Heals 4 HP on Shield wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_lifesteal", amount: 4, moveType: "paper" },
    ],
  },
  "bloodthirsty": {
    id: "bloodthirsty",
    name: "Bloodthirsty",
    description: "+4 ATK on all moves",
    minTier: 1,
    kind: "statOnly",
    effects: [
      { kind: "flatAtk", amount: 4 },
    ],
  },
  "corrosiveMagic": {
    id: "corrosiveMagic",
    name: "Miasmagem",
    description: "Reduces 3 max armor on Magic wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_corrode", amount: 3, moveType: "scissor" },
    ],
  },
  "corrosiveShield": {
    id: "corrosiveShield",
    name: "Miasmaguard",
    description: "Reduces 3 max armor on Shield wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_corrode", amount: 3, moveType: "paper" },
    ],
  },
  "corrosiveSword": {
    id: "corrosiveSword",
    name: "Miasmablade",
    description: "Reduces 3 max armor on Sword wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_corrode", amount: 3, moveType: "rock" },
    ],
  },
  "crushing": {
    id: "crushing",
    name: "Crushing",
    description: "Applies 1 Vulnerable on wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Vulnerable" },
    ],
  },
  "Cursing": {
    id: "Cursing",
    name: "Cursing",
    description: "Applies 1 Vulnerable on Magic wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Vulnerable", moveType: "scissor" },
    ],
  },
  "ferocious": {
    id: "ferocious",
    name: "Ferocious",
    description: "+50% ATK on all moves",
    minTier: 2,
    kind: "statOnly",
    effects: [
      { kind: "pctAtk", percent: 50 },
    ],
  },
  "firebrand": {
    id: "firebrand",
    name: "Firebrand",
    description: "Applies 2 Burn on Sword wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 2, statusType: "Burn", moveType: "rock" },
    ],
  },
  "hardy": {
    id: "hardy",
    name: "Hardy",
    description: "+3 max HP and +2 armor",
    minTier: 1,
    kind: "statOnly",
    effects: [
      { kind: "flatHP", amount: 3 },
      { kind: "flatShield", amount: 2 },
    ],
  },
  "hemomancer": {
    id: "hemomancer",
    name: "Hemomancer",
    description: "Heals 4 HP on Magic wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_lifesteal", amount: 4, moveType: "scissor" },
    ],
  },
  "ironhide": {
    id: "ironhide",
    name: "Ironhide",
    description: "+50% DEF on all moves",
    minTier: 2,
    kind: "statOnly",
    effects: [
      { kind: "pctDef", percent: 50 },
    ],
  },
  "mangleblade": {
    id: "mangleblade",
    name: "Bladebreaker",
    description: "Applies 1 Weak on Sword wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Weak", moveType: "rock" },
    ],
  },
  "overgrown": {
    id: "overgrown",
    name: "Overgrown",
    description: "+30% HP and +30% shield",
    minTier: 2,
    kind: "statOnly",
    effects: [
      { kind: "pctHP", percent: 30 },
      { kind: "pctShield", percent: 30 },
    ],
  },
  "perpetual_armored": {
    id: "perpetual_armored",
    name: "Perpetual Armored",
    description: "+4 DEF on all moves",
    minTier: 1,
    kind: "statOnly",
    effects: [
      { kind: "flatDef", amount: 4 },
    ],
  },
  "perpetual_bloodguard": {
    id: "perpetual_bloodguard",
    name: "Perpetual Bloodguard",
    description: "Heals 4 HP on Shield wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_lifesteal", amount: 4, moveType: "paper" },
    ],
  },
  "perpetual_bloodthirsty": {
    id: "perpetual_bloodthirsty",
    name: "Perpetual Bloodthirsty",
    description: "+4 ATK on all moves",
    minTier: 1,
    kind: "statOnly",
    effects: [
      { kind: "flatAtk", amount: 4 },
    ],
  },
  "perpetual_corrosiveSword": {
    id: "perpetual_corrosiveSword",
    name: "Perpetual Miasmablade",
    description: "Reduces 3 max armor on Sword wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_corrode", amount: 3, moveType: "rock" },
    ],
  },
  "perpetual_crushing": {
    id: "perpetual_crushing",
    name: "Perpetual Crushing",
    description: "Applies 1 Vulnerable on wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Vulnerable" },
    ],
  },
  "perpetual_Cursing": {
    id: "perpetual_Cursing",
    name: "Perpetual Cursing",
    description: "Applies 1 Vulnerable on Magic wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Vulnerable", moveType: "scissor" },
    ],
  },
  "perpetual_ferocious": {
    id: "perpetual_ferocious",
    name: "Perpetual Ferocious",
    description: "+50% ATK on all moves",
    minTier: 2,
    kind: "statOnly",
    effects: [
      { kind: "pctAtk", percent: 50 },
    ],
  },
  "perpetual_firebrand": {
    id: "perpetual_firebrand",
    name: "Perpetual Firebrand",
    description: "Applies 2 Burn on Sword wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 2, statusType: "Burn", moveType: "rock" },
    ],
  },
  "perpetual_hardy": {
    id: "perpetual_hardy",
    name: "Perpetual Hardy",
    description: "+3 max HP and +2 armor",
    minTier: 1,
    kind: "statOnly",
    effects: [
      { kind: "flatHP", amount: 3 },
      { kind: "flatShield", amount: 2 },
    ],
  },
  "perpetual_hemomancer": {
    id: "perpetual_hemomancer",
    name: "Perpetual Hemomancer",
    description: "Heals 4 HP on Magic wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_lifesteal", amount: 4, moveType: "scissor" },
    ],
  },
  "perpetual_ironhide": {
    id: "perpetual_ironhide",
    name: "Perpetual Ironhide",
    description: "+50% DEF on all moves",
    minTier: 2,
    kind: "statOnly",
    effects: [
      { kind: "pctDef", percent: 50 },
    ],
  },
  "perpetual_mangleblade": {
    id: "perpetual_mangleblade",
    name: "Perpetual Bladebreaker",
    description: "Applies 1 Weak on Sword wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Weak", moveType: "rock" },
    ],
  },
  "perpetual_overgrown": {
    id: "perpetual_overgrown",
    name: "Perpetual Overgrown",
    description: "+30% HP and +30% shield",
    minTier: 2,
    kind: "statOnly",
    effects: [
      { kind: "pctHP", percent: 30 },
      { kind: "pctShield", percent: 30 },
    ],
  },
  "perpetual_pyromancer": {
    id: "perpetual_pyromancer",
    name: "Perpetual Pyromancer",
    description: "Applies 2 Burn on Magic wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 2, statusType: "Burn", moveType: "scissor" },
    ],
  },
  "perpetual_regenerating": {
    id: "perpetual_regenerating",
    name: "Perpetual Regenerating",
    description: "Starts battle with 8 Regen",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "startBattleStatus", amount: 8, statusType: "Regen" },
    ],
  },
  "perpetual_searing": {
    id: "perpetual_searing",
    name: "Perpetual Searing",
    description: "Applies 2 Burn on Shield wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 2, statusType: "Burn", moveType: "paper" },
    ],
  },
  "perpetual_shatterblade": {
    id: "perpetual_shatterblade",
    name: "Perpetual Sharpened",
    description: "Applies 1 Vulnerable on Sword wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Vulnerable", moveType: "rock" },
    ],
  },
  "perpetual_Stalwart": {
    id: "perpetual_Stalwart",
    name: "Perpetual Stalwart",
    description: "Applies 1 Weak on Shield wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Weak", moveType: "paper" },
    ],
  },
  "perpetual_vampiric": {
    id: "perpetual_vampiric",
    name: "Perpetual Vampiric",
    description: "Heals 4 HP on Sword wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_lifesteal", amount: 4, moveType: "rock" },
    ],
  },
  "perpetual_warden": {
    id: "perpetual_warden",
    name: "Perpetual Warden",
    description: "Applies 1 Vulnerable on Shield wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Vulnerable", moveType: "paper" },
    ],
  },
  "perpetual_weakening": {
    id: "perpetual_weakening",
    name: "Perpetual Weakening",
    description: "Applies 1 Weak on wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Weak" },
    ],
  },
  "perpetual_withering": {
    id: "perpetual_withering",
    name: "Perpetual Withering",
    description: "Applies 1 Weak on Magic wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Weak", moveType: "scissor" },
    ],
  },
  "pyromancer": {
    id: "pyromancer",
    name: "Pyromancer",
    description: "Applies 2 Burn on Magic wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 2, statusType: "Burn", moveType: "scissor" },
    ],
  },
  "regenerating": {
    id: "regenerating",
    name: "Regenerating",
    description: "Starts battle with 8 Regen",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "startBattleStatus", amount: 8, statusType: "Regen" },
    ],
  },
  "searing": {
    id: "searing",
    name: "Searing",
    description: "Applies 2 Burn on Shield wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 2, statusType: "Burn", moveType: "paper" },
    ],
  },
  "shatterblade": {
    id: "shatterblade",
    name: "Sharpened",
    description: "Applies 1 Vulnerable on Sword wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Vulnerable", moveType: "rock" },
    ],
  },
  "Stalwart": {
    id: "Stalwart",
    name: "Stalwart",
    description: "Applies 1 Weak on Shield wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Weak", moveType: "paper" },
    ],
  },
  "vampiric": {
    id: "vampiric",
    name: "Vampiric",
    description: "Heals 4 HP on Sword wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_lifesteal", amount: 4, moveType: "rock" },
    ],
  },
  "warden": {
    id: "warden",
    name: "Warden",
    description: "Applies 1 Vulnerable on Shield wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Vulnerable", moveType: "paper" },
    ],
  },
  "weakening": {
    id: "weakening",
    name: "Weakening",
    description: "Applies 1 Weak on wins",
    minTier: 2,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Weak" },
    ],
  },
  "withering": {
    id: "withering",
    name: "Withering",
    description: "Applies 1 Weak on Magic wins",
    minTier: 1,
    kind: "mechanic",
    effects: [
      { kind: "onEnemyWinExchange_applyStatus", amount: 1, statusType: "Weak", moveType: "scissor" },
    ],
  },};

/**
 * The `perpetual_` prefix. 23 of the 46 corpus ids carry it, each an exact
 * effect-twin of a base id — it is a DELIVERY difference, not an effect one:
 * the buff persists for the rest of the run rather than applying to the one
 * path it was offered on.
 *
 * **[USER DIRECTIVE, 2026-08-20]** That persistence is why the user does not
 * want one taken: on the hardest enemy card, a `perpetual_` condition is
 * refused and the next-best option is taken by the existing criteria. See
 * `src/strategy/enemyTier.ts`, which applies it as a WITHIN-TIER tie-break —
 * the chosen tier is never changed by it, so CLAUDE.md rule 8 is untouched.
 */
export const PERPETUAL_PREFIX = "perpetual_";

/** True for a buff whose effect persists past the path it was offered on. */
export function isPerpetualBuff(buff: unknown): boolean {
  if (!buff || typeof buff !== "object") return false;
  const id = (buff as { id?: unknown }).id;
  return typeof id === "string" && id.startsWith(PERPETUAL_PREFIX);
}

/** A stat block as the combat model reads it — the four things a buff can move. */
export interface BuffableStats {
  atk: Record<"rock" | "paper" | "scissor", number>;
  def: Record<"rock" | "paper" | "scissor", number>;
  hp: number;
  shield: number;
}

/**
 * `statOnly` when every effect is a stat modifier, `mechanic` when any effect
 * adds a rule the combat model has none for, `unknown` when the id is absent
 * from the table or ANY effect kind is unrecognised.
 *
 * Fail-closed by construction: an unrecognised kind loses to nothing, it wins.
 * A buff quietly treated as zero is worse than a battle honestly marked
 * unscorable, because the first produces a confident number.
 */
export function classifyBuff(buff: unknown): BuffClass {
  if (buff === null || buff === undefined) return "statOnly";
  if (typeof buff !== "object") return "unknown";
  const id = (buff as { id?: unknown }).id;
  if (typeof id !== "string") return "unknown";
  const known = ENEMY_BUFFS[id];
  if (!known) return "unknown";

  // Classified off the LIVE effects, not off the table's stored `kind`, so a
  // buff whose definition changed server-side is caught rather than trusted.
  const live = (buff as { effects?: unknown }).effects;
  const effects: readonly BuffEffect[] = Array.isArray(live) ? (live as BuffEffect[]) : known.effects;
  if (effects.length === 0) return "unknown";

  let sawMechanic = false;
  for (const e of effects) {
    if (STAT_ONLY_KINDS.has(e.kind)) continue;
    if (MECHANIC_KINDS.has(e.kind)) {
      sawMechanic = true;
      continue;
    }
    return "unknown";
  }
  return sawMechanic ? "mechanic" : "statOnly";
}

/** True when the buff changes no combat RULE — see the header's natural experiment. */
export const isScorableBuff = (buff: unknown): boolean => classifyBuff(buff) === "statOnly";

/**
 * Predict a buffed stat block from a CLEAN baseline. **Verification only** —
 * combat must never call this, because the wire already reports buffed stats
 * and applying them again double-counts. Returns `null` when the buff cannot
 * be modelled, never a silently-unchanged block.
 *
 * Percentage effects round UP: `overgrown` (+30%) takes 35 hp -> 46 and 14
 * armor -> 19, and 14 * 1.3 = 18.2 rules out round-half and floor.
 */
export function applyStatBuff(base: BuffableStats, buff: unknown): BuffableStats | null {
  if (buff === null || buff === undefined) return base;
  if (classifyBuff(buff) === "unknown") return null;

  const effects = (buff as { effects?: BuffEffect[] }).effects ?? [];
  const out: BuffableStats = {
    atk: { ...base.atk },
    def: { ...base.def },
    hp: base.hp,
    shield: base.shield,
  };
  const MOVES = ["rock", "paper", "scissor"] as const;
  const scale = (v: number, pct: number) => Math.ceil(v * (1 + pct / 100));

  for (const e of effects) {
    switch (e.kind) {
      case "flatAtk": for (const m of MOVES) out.atk[m] += e.amount ?? 0; break;
      case "flatDef": for (const m of MOVES) out.def[m] += e.amount ?? 0; break;
      case "flatHP": out.hp += e.amount ?? 0; break;
      case "flatShield": out.shield += e.amount ?? 0; break;
      case "pctAtk": for (const m of MOVES) out.atk[m] = scale(out.atk[m], e.percent ?? 0); break;
      case "pctDef": for (const m of MOVES) out.def[m] = scale(out.def[m], e.percent ?? 0); break;
      case "pctHP": out.hp = scale(out.hp, e.percent ?? 0); break;
      case "pctShield": out.shield = scale(out.shield, e.percent ?? 0); break;
      default:
        // A mechanic effect moves no stat. Unknown kinds never reach here —
        // `classifyBuff` above already returned `unknown` and we bailed.
        if (!MECHANIC_KINDS.has(e.kind)) return null;
    }
  }
  return out;
}

/**
 * ── CORRODE: the one mechanic buff this sim models ─────────────────────────
 *
 * `onEnemyWinExchange_corrode` reduces the PLAYER's max armor
 * (`shield.currentMax`, the sim's `Combatant.armorMax`) when the enemy wins an
 * exchange **with the buff's own declared move**. Three base ids carry it, plus
 * their `perpetual_` twins:
 *
 *     corrosiveSword   "Miasmablade"  rock      amount 3   minTier 2
 *     corrosiveShield  "Miasmaguard"  paper     amount 3   minTier 2
 *     corrosiveMagic   "Miasmagem"    scissor   amount 3   minTier 2
 *
 * ── WHY THIS ONE AND NOT THE OTHER MECHANICS ───────────────────────────────
 *
 * Unlike `rolledEnemyStats` — 1-5% proc chances needing hundreds of
 * observations (SPEC §4e) — corrode is deterministic arithmetic on a named move
 * win. Under CLAUDE.md rule 8 every fight is tier 2, and corrode is `minTier:
 * 2`, so it is now on essentially every run.
 *
 * ── CONFIRMED AGAINST THE CORPUS, NOT ASSUMED [session 63] ─────────────────
 *
 * `fixtures/dungeon-runs/` contains a natural experiment, found by scanning
 * every consecutive same-room state pair for a `shield.currentMax` decrease:
 *
 *     foe won   move matches   exchanges   observed delta
 *     yes       yes            4           -3, -3, -3, -3   (4 of 4)
 *     yes       no             19          0
 *     no        yes            8           0
 *     no        no             25          0
 *
 * All three base ids fired at least once (`corrosiveSword` twice in room 3 of
 * run-2026-08-20-20-04-37, 17->14->11; `corrosiveMagic` room 5 of the same run;
 * `corrosiveShield` room 5 of run-2026-08-20-22-46-26). **Both gates are
 * measured, not declared** — the move gate by the 19 same-buff exchanges the
 * enemy won on a NON-matching move and corroded nothing, and the win gate by
 * the 8 matching-move exchanges the enemy did not win.
 *
 * One trap on the way, worth recording because it looked like a counter-example
 * for a while: a state that reports the SAME `lastMove` pair as its predecessor
 * is the same exchange re-reported, not a second one. Counting those naively
 * put five spurious zero-deltas in the firing cell. Dedupe on the `lastMove`
 * pair before reading a delta. (This is session 56's cross-attempt trap in a
 * different costume — a state boundary is not an exchange boundary.)
 *
 * ── WHAT IS **NOT** ESTABLISHED: the clamp ─────────────────────────────────
 *
 * No corpus exchange has current armor ABOVE the corroded max afterwards, so
 * whether the server clamps `current` down to the new `currentMax` is
 * **unobserved**. This function therefore does not clamp, and neither does
 * `resolveExchange` — inventing a clamp would be exactly the name-based
 * inference DECISIONS 2026-08-15 refused. The state is not left unbounded: the
 * regen line in `applyOutcome` is already `Math.min(armorMax, armor + def)`, so
 * an over-max armor pool converges down at the next win or tie instead. If a
 * live capture ever shows `current` dropping in the same exchange as the
 * corrode, this is the assumption to revisit.
 */
export const CORRODE_KIND = "onEnemyWinExchange_corrode";

/**
 * Max-armor reduction the enemy's buff inflicts on the player for ONE exchange.
 * `0` whenever the enemy did not win, the played move does not match, or the
 * buff carries no corrode effect.
 *
 * **Reads `amount` and `moveType` off the buff's own live effects**, never a
 * constant — a corrode that fires on any enemy win, or that always shreds 3, is
 * wrong on both counts and is what the negative controls in
 * `tests/enemies.test.ts` and `tests/corrode.test.ts` exist to catch.
 *
 * Effects are summed rather than short-circuited, so a future id carrying two
 * corrode effects is handled on sight — the same reasoning that makes
 * `classifyBuff` key on the effect KIND rather than the id.
 */
export function corrodeOnEnemyWin(buff: unknown, foeMove: string, foeWon: boolean): number {
  if (!foeWon) return 0;
  if (buff === null || typeof buff !== "object") return 0;

  // Same precedence as `classifyBuff`: the LIVE effects win over the stored
  // table, so a server-side redefinition is honoured rather than overridden.
  const id = (buff as { id?: unknown }).id;
  const known = typeof id === "string" ? ENEMY_BUFFS[id] : undefined;
  const live = (buff as { effects?: unknown }).effects;
  const effects: readonly BuffEffect[] = Array.isArray(live)
    ? (live as BuffEffect[])
    : (known?.effects ?? []);

  let total = 0;
  for (const e of effects) {
    if (e.kind !== CORRODE_KIND) continue;
    if (e.moveType !== foeMove) continue;
    total += e.amount ?? 0;
  }
  return total;
}
