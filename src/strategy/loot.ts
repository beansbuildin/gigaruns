/**
 * src/strategy/loot.ts — SPEC §4c boon ranking. Pure.
 *
 * ⚠ **UNVALIDATED, and it cannot be validated yet.** Every other module in this
 * directory is checked against sim outcomes. This one is not, because a boon is
 * only ever offered *after* a room is cleared and `deepestScorableRoom` is 1 —
 * so no scored run in the corpus ever reaches a second boon decision, and there
 * is no outcome to fit the ranking to. It is written from SPEC §4c's intuition
 * and nothing else. Do not report a number that depends on it.
 *
 * **On reading boon names.** DECISIONS 2026-08-15 forbids inferring a boon's
 * EFFECT from its name — `UpgradePaper` says what it does, has `selectedVal2: 4`,
 * and stays unmodelled because nobody picked it. That rule is about modelling,
 * and it is not relaxed here: `src/sim/boons.ts` still fails closed and this
 * module cannot change a single state delta. Choosing between three options is a
 * different act from claiming what they do, and a chooser has to use the only
 * information the offer carries. So names are read HERE and only here, the
 * ranking is a preference and never a claim, and everything it picks is still
 * scored fail-closed downstream.
 *
 * **What is deliberately NOT in the ranking: whether a boon is modelled.**
 * Preferring modelled boons would raise `deepestScorableRoom` and coverage
 * without the bot playing any better — it would be tuning the metric instead of
 * the game, and the metric is our only honest read on the blind spot.
 *
 * **[session 35, CODEXIMPROVE #5]** The `pool` and `upgrade` scores used to be
 * flat category constants, blind to `option.val1`/`val2` — a +2 max-armor
 * offer and a +8 one scored identically, and an ATK upgrade and a DEF upgrade
 * of the same move did too. Both now scale by the real confirmed delta,
 * normalised against the ONE clean corpus sample of that boon shape
 * (`src/sim/boons.ts`'s evidence), so the magnitude responds to the real
 * offer while the existing `roomsRemaining` shape is unchanged. `AddMaxHealth`
 * is also split out of the generic `pool` bucket it used to share with
 * `AddMaxArmor` — `boons.ts`'s `maxHealth` effect moves current HP WITH the
 * new ceiling, so none of it is ever wasted the way an unfilled armor pool is,
 * and it is scored with the same "usable, not raw" formula `heal` uses below.
 */

import type { BoonOption } from "../sim/boons.js";
import { MAX_ROOM } from "../sim/enemies.js";
import { MOVES, type Combatant, type MoveKey } from "../sim/types.js";

/**
 * Coarse buckets, keyed off the option `type` string. Name-derived — see the
 * header for why that is allowed for ranking and still forbidden for effects.
 */
export type BoonCategory = "heal" | "pool" | "upgrade" | "rolled" | "unknown";

const UPGRADE_PREFIX = "Upgrade";
const ROLLED_TYPES = new Set(["AddLuck", "AddEvasion", "AddTenacity", "AddBlock", "AddIntuition"]);
/**
 * SPEC §4c rank 3, "Max HP / armor, weighted up in early rooms where a long run
 * is still ahead". The tier was in the spec from the start; the type name
 * `AddMaxArmor` was not observed until session 06, so until then everything in
 * this tier fell through to `unknown` and scored below a rolled stat.
 */
const POOL_PREFIX = "AddMax";

/**
 * [session 35, CODEXIMPROVE #5] Reference magnitudes the pool/upgrade scores
 * normalise against — each is the ONE confirmed clean corpus sample of that
 * boon shape (`src/sim/boons.ts`'s evidence), not a guess. Multiplying the old
 * flat constant by `(actual delta / this reference)` keeps the heuristic's
 * calibration unchanged for an offer at the reference magnitude, while making
 * the score respond to a bigger or smaller real one.
 */
const POOL_REFERENCE_DELTA = 4; // AddMaxArmor's selectedVal1, session-11 pair (armorMax 16 → 20)
const UPGRADE_REFERENCE_DELTA = 4; // UpgradeRock/UpgradeScissor's selectedVal1+val2, session-09 pairs (both +4 DEF)

/** `UpgradePaper` -> `paper`. Null when the suffix is not a move we know. */
export function upgradeTarget(type: string): MoveKey | null {
  if (!type.startsWith(UPGRADE_PREFIX)) return null;
  const suffix = type.slice(UPGRADE_PREFIX.length).toLowerCase();
  return (MOVES as readonly string[]).includes(suffix) ? (suffix as MoveKey) : null;
}

export function categorise(type: string): BoonCategory {
  if (type === "Heal") return "heal";
  // Checked before the rolled set so a future `AddMaxLuck` could not be
  // mistaken for a rolled stat on its prefix.
  if (type.startsWith(POOL_PREFIX)) return "pool";
  if (upgradeTarget(type)) return "upgrade";
  if (ROLLED_TYPES.has(type)) return "rolled";
  return "unknown";
}

export interface RankOptions {
  /**
   * How often we have actually played each move, from our own logged
   * distribution — SPEC §4c is explicit that this is read off real play, "not
   * off a guess about what's theoretically strongest".
   */
  playCounts?: Partial<Record<MoveKey, number>>;
  /**
   * Rooms left in the run. An upgrade needs rooms remaining to pay off, and
   * §4c weights survival up "in early rooms where a long run is still ahead".
   * Defaults to `MAX_ROOM - room` — the real dungeon's 16, from
   * `config/discovered.json`, not the shorter run the sim can play.
   */
  roomsRemaining?: number;
}

export interface RankedBoon {
  option: BoonOption;
  score: number;
  category: BoonCategory;
  /** Why it scored what it did, for `data/loot-log.jsonl` and for review. */
  rationale: string;
}

/**
 * §4c rank 1's "usable, not raw" formula, factored out so `AddMaxHealth`
 * (below) can share it rather than a second heal-shaped formula being
 * invented for it. `usable` is the caller's job to compute correctly for the
 * boon's actual mechanic — see the two call sites for why a capped `Heal` and
 * an uncapped `AddMaxHealth` arrive here with different `usable` amounts.
 */
function usableHealScore(usable: number, hpMax: number, hpFraction: number, roomsRemaining: number): number {
  return 100 * (usable / hpMax) + (roomsRemaining > 0 ? 60 * (1 - hpFraction) : 0);
}

/**
 * Rank an offer, best first. Ties break by the order offered, so the choice is
 * reproducible.
 */
export function rankBoons(
  player: Combatant,
  offered: readonly BoonOption[],
  room: number,
  opts: RankOptions = {},
): RankedBoon[] {
  const hpFraction = player.hp / player.hpMax;
  const roomsRemaining = opts.roomsRemaining ?? Math.max(0, MAX_ROOM - room);
  const counts = opts.playCounts ?? {};
  const totalPlays = MOVES.reduce((a, m) => a + (counts[m] ?? 0), 0);

  return offered
    .map((option, i) => {
      const category = categorise(option.type);
      let score = 0;
      let rationale = "";

      switch (category) {
        case "heal": {
          // §4c rank 1, and the strongest claim in the section: this card is the
          // ONLY way HP is ever restored (no in-combat healing, CONFIRMED
          // 2026-08-13), so passing one up at low HP is choosing to end the run.
          // Scaled by how much of the heal is actually usable — at full HP it is
          // worth nothing, and the cap wastes the excess.
          //
          // [session 10] The urgency bonus used to be a step function (+60 below
          // 50% HP, +0 at or above it) — a heal offered at 51% HP scored the same
          // as one at 100%, which undervalues it: HP does not regenerate between
          // rooms (DECISIONS 2026-08-17) or in combat, so HP banked now is HP
          // available several rooms later regardless of which side of 50% it sits
          // on. Made continuous in `(1 - hpFraction)` so the bonus tracks how much
          // HP is actually missing, not which side of one threshold it's on.
          const usable = Math.min(option.val1, player.hpMax - player.hp);
          score = usableHealScore(usable, player.hpMax, hpFraction, roomsRemaining);
          rationale = `heals ${usable} usable of ${option.val1} at HP ${player.hp}/${player.hpMax}`;
          break;
        }
        case "pool": {
          if (option.type === "AddMaxHealth") {
            // [session 35, CODEXIMPROVE #5] `boons.ts`'s `maxHealth` effect
            // moves current HP WITH the new ceiling (`hpMax += val1; hp +=
            // val1`) — unlike AddMaxArmor, none of it is ever wasted against
            // an unfilled pool, so every point of val1 is usable regardless of
            // current HP. Scored with the SAME formula `heal` uses above, not
            // a new one — this boon delivers HP exactly like a heal does, it
            // just also raises the ceiling permanently.
            const usable = option.val1;
            score = usableHealScore(usable, player.hpMax, hpFraction, roomsRemaining);
            rationale = `raises max HP by ${option.val1} (current HP moves with the new ceiling — all ${usable} usable), at HP ${player.hp}/${player.hpMax}`;
            break;
          }
          // §4c rank 3, and the user's own read from playing: max HP and max
          // armor above stat boons. Weighted by rooms remaining, since a bigger
          // pool only pays across the rooms you go on to fight.
          //
          // Held BELOW `heal` deliberately, and the reason is the 2026-08-15
          // reversal: armor does NOT refill at a room boundary. +2 max armor is
          // +2 only once you have regenerated into it through a won or tied
          // move's DEF, whereas a heal is HP in hand immediately and HP is the
          // one resource combat cannot renew at all.
          //
          // [session 35, CODEXIMPROVE #5] Scaled by the boon's own val1 against
          // the one confirmed real sample (AddMaxArmor +4, see the reference
          // constant above) — a +2 offer and a +8 one no longer score the same.
          score = 25 * (option.val1 / POOL_REFERENCE_DELTA) * Math.min(1, roomsRemaining / 8);
          rationale = `raises a max pool by ${option.val1}, ${roomsRemaining} rooms left to use it`;
          break;
        }
        case "upgrade": {
          // §4c rank 2: upgrade the move actually played most. With no logged
          // distribution yet, every move shares the prior equally — which is the
          // honest state before Task 6 produces real play data.
          //
          // [session 35, CODEXIMPROVE #5] Scaled by the offer's own ATK+DEF
          // delta against the one confirmed real sample (UpgradeRock/
          // UpgradeScissor, both +4 DEF — see the reference constant above),
          // so a bigger stat upgrade outscores a smaller one of the same move.
          const target = upgradeTarget(option.type)!;
          const share = totalPlays === 0 ? 1 / MOVES.length : (counts[target] ?? 0) / totalPlays;
          const delta = option.val1 + option.val2;
          score = 40 * share * (delta / UPGRADE_REFERENCE_DELTA) * Math.min(1, roomsRemaining / 4);
          rationale =
            `upgrades ${target} by +${option.val1} ATK/+${option.val2} DEF, played ${((share * 100) | 0)}% of ${totalPlays} logged moves` +
            (totalPlays === 0 ? " (no play log yet — flat prior)" : "");
          break;
        }
        case "rolled": {
          // §4c ranks stat boons below upgrades. Independently of that, these are
          // the boons whose damage effect is unexplained (§4e) — which is a
          // reason to be UNCERTAIN about them, not a reason to avoid them, and
          // the score does not encode coverage either way.
          score = 15;
          rationale = "rolled stat; effect on damage unexplained (SPEC §4e)";
          break;
        }
        case "unknown": {
          score = 10;
          rationale = "no category; nothing in the corpus shows what it does";
          break;
        }
      }

      return { option, score, category, rationale, i };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ option, score, category, rationale }) => ({ option, score, category, rationale }));
}

/** The top-ranked option. Throws on an empty offer — no recorded offer is empty. */
export function pickBoon(
  player: Combatant,
  offered: readonly BoonOption[],
  room: number,
  opts: RankOptions = {},
): BoonOption {
  const ranked = rankBoons(player, offered, room, opts);
  if (ranked.length === 0) throw new Error("pickBoon() called with an empty offer");
  return ranked[0]!.option;
}
