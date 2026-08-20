/**
 * src/strategy/boonPriority.ts — the user's boon-selection directive, expressed
 * as a literal total order ABOVE the scorer. Pure; no network, no fs.
 *
 * ── WHY THIS IS A LAYER AND NOT A RE-WEIGHTING OF `rankBoons` ──────────────
 *
 * Session 55 measured the thing that decides the shape of this module: across
 * 135 captured offers x 4 HP fractions = 540 decisions, `pickBoon` top-ranked
 * an unmodelled boon **0 times**, because `loot.ts`'s `categorise()` drops all
 * 36 unmodelled types into `unknown`, which scores 10 — the lowest of the five
 * categories. That is a score FLOOR, not an exclusion (`pickBoon` never reads
 * `BOON_MODELS`), and the distinction is exactly why this module can exist.
 *
 * Most of what the user asked for is unmodelled: `BurnMastery`,
 * `VulnerableBlock`, `VulnerableMastery`, every `AddVulnerable*`,
 * `TieVulnerable`, and four of the five `*Sword` types. Only `AddMaxArmor`,
 * `AddMaxHealth`, `UpgradeRock`, `AddBurnSword`, `VulnerableEvade` and
 * `AddLifestealMagic` are modelled at all. So re-weighting inside `rankBoons`
 * could not express the directive — **the scorer has no model to weight.**
 * A priority layer above it can, and leaves the sim's EV path intact for
 * measurement while live play follows the directive.
 *
 * `rankBoons` is NOT modified. It becomes the fallback, and it is also the
 * within-tier tie-break (see `choosePriorityBoon`).
 *
 * ── THE ORDER (user directive, 2026-08-20; a total order, not heuristics) ───
 *
 *   1. `BurnMastery`            — enemy burn triggers twice. Outranks
 *                                 everything, MaxArmor included.
 *   2. `AddMaxArmor`            — the default first pick.
 *   3. `AddMaxHealth`
 *   4. The **Sword family**     — `UpgradeRock` plus every `*Sword` type.
 *   5. The **Vulnerable family** — converts the many combat ties.
 *
 * Plus one window rule: **lifesteal is demoted in rooms 1..8** (`earlyGameMaxRoom`,
 * user-confirmed, a real number and not a placeholder).
 *
 * If a future reader finds themselves weighing two of these against each other
 * at runtime, the implementation has drifted from the directive.
 *
 * ── THE NAMING MAPPING THAT MAKES "ANYTHING ON SWORD WIN" MECHANICAL ───────
 *
 * **Rock = Sword, Paper = Shield, Scissor = Spell** (user-confirmed; SPEC.md
 * §3g). The API's *action* names are `rock`/`paper`/`scissor`; the *boon type
 * strings* use `Sword`/`Shield`/`Magic` for the same three moves. So the Sword
 * family is matched on the `Sword` SUFFIX plus `UpgradeRock`, not hand-listed —
 * new `*Sword` types appear in this game and are covered automatically. The
 * five in the corpus today are `AddBurnSword`, `AddWeakSword`,
 * `AddVulnerableSword`, `AddLifestealSword`, `CorrosiveSword`.
 *
 * ── HOW "DEMOTE" IS IMPLEMENTED, AND WHY THAT READING ──────────────────────
 *
 * The directive says lifesteal is *overrated in early game — demote*. It does
 * not name a penalty, and inventing one would be inventing a tie-break the
 * directive does not contain. So the demotion is exactly this: **in rooms
 * 1..8 a lifesteal type is not eligible for a priority match at all.** It
 * therefore always loses to every listed family when both are on offer, and
 * among the leftovers `rankBoons` decides as it always has. That is "ranks
 * below the listed families", which is what demote means, with no new
 * mechanic. It is NOT an exclusion — a lifesteal boon can still be taken by
 * the fallback scorer when nothing on the list is offered.
 *
 * `AddLifestealSword` is the one type both rules touch: it is a `*Sword` type
 * (priority 4) and a lifesteal type. **User-confirmed: the demotion wins in
 * rooms 1..8**, because inside the early-game window the lifesteal rule is the
 * more specific one. **From room 9 on it is an ordinary priority-4 sword
 * boon** — the window has closed, and that follows from the two rules as
 * written without an extra case. It is logged either way (`conflictedTypes`).
 *
 * ── PRECEDENCE AGAINST `boonCapture.ts` — MEASURED, NOT ASSUMED ────────────
 *
 * The session-56 brief expected this list to subsume `boonCapture.ts`'s five
 * targets and asked for it to be retired if so. **It does not: the overlap is
 * 1 of 5.** Only `VulnerableBlock` is a priority family member; `TieWeak`(11
 * offers), `AddBurnShield`(8), `AddLifestealShield`(5) and `Regen`(4) — the
 * four most frequently offered, 28 of the 32 target offers — match no family
 * here. So both layers stay, and `scripts/liveRun.ts` gives `boonCapture`
 * strict precedence over this module: it is OFF by default and needs an
 * explicit `--boon-capture`, so arming it IS the choice to pay run quality for
 * a measurement on that run. `VulnerableBlock` needs no special case — this
 * layer will pick it as priority 5, which produces its pair, after which
 * `boonCapture`'s retire-once-modelled check drops it on its own.
 */

import type { BoonOption } from "../sim/boons.js";
import { rankBoons, type RankOptions } from "./loot.js";
import type { Combatant } from "../sim/types.js";

/**
 * User-confirmed, 2026-08-20: early game is rooms 1..8. A config knob for
 * legibility, but a real number — do not describe it as provisional.
 */
export const EARLY_GAME_MAX_ROOM = 8;

/** The one type at the top of the order. */
export const BURN_MASTERY = "BurnMastery";
/** The `Upgrade*` member of the Sword family; the rest match by suffix. */
export const SWORD_UPGRADE = "UpgradeRock";

const SWORD_SUFFIX = "Sword";
const VULNERABLE_MARKER = "Vulnerable";
const LIFESTEAL_MARKER = "Lifesteal";

/** 1 is the strongest. `null` means "no family — leave it to `rankBoons`". */
export type BoonPriority = 1 | 2 | 3 | 4 | 5;

export interface BoonPriorityConfig {
  /** Rooms `1..earlyGameMaxRoom` are the early game for the lifesteal rule. */
  earlyGameMaxRoom: number;
}

export const DEFAULT_BOON_PRIORITY: BoonPriorityConfig = {
  earlyGameMaxRoom: EARLY_GAME_MAX_ROOM,
};

/** `UpgradeRock` or any `*Sword` type. Suffix-matched — see the header. */
export function isSwordFamily(type: string): boolean {
  return type === SWORD_UPGRADE || type.endsWith(SWORD_SUFFIX);
}

/**
 * Any type naming Vulnerable. Substring rather than prefix/suffix because the
 * corpus spreads it across all three positions: `VulnerableEvade`,
 * `AddVulnerableShield`, `TieVulnerable`, `ArmorDepletedVulnerable`.
 */
export function isVulnerableFamily(type: string): boolean {
  return type.includes(VULNERABLE_MARKER);
}

/** `AddLifestealSword` / `AddLifestealShield` / `AddLifestealMagic`. */
export function isLifesteal(type: string): boolean {
  return type.includes(LIFESTEAL_MARKER);
}

/** True while the lifesteal demotion window is open. */
export function isEarlyGame(room: number, config: BoonPriorityConfig = DEFAULT_BOON_PRIORITY): boolean {
  return room <= config.earlyGameMaxRoom;
}

/**
 * The directive's rank for one boon type in one room, or `null` for "not on
 * the list". The lifesteal demotion is applied HERE rather than at the call
 * site so there is exactly one place the window rule lives.
 */
export function priorityOf(
  type: string,
  room: number,
  config: BoonPriorityConfig = DEFAULT_BOON_PRIORITY,
): BoonPriority | null {
  // The demotion, and the `AddLifestealSword` resolution with it: inside the
  // window a lifesteal type is not eligible for ANY priority match, so it
  // never reaches the priority-4 sword test below.
  if (isLifesteal(type) && isEarlyGame(room, config)) return null;

  if (type === BURN_MASTERY) return 1;
  if (type === "AddMaxArmor") return 2;
  if (type === "AddMaxHealth") return 3;
  // Checked before Vulnerable so `AddVulnerableSword` resolves to 4, the
  // stronger of the two families it belongs to. Deterministic, not a tie.
  if (isSwordFamily(type)) return 4;
  if (isVulnerableFamily(type)) return 5;
  return null;
}

export interface BoonPriorityDecision {
  /** The option the directive selects. */
  option: BoonOption;
  /** Position within `offered` as passed in. */
  index: number;
  priority: BoonPriority;
  /** Short label for the run summary and the log event. */
  label: string;
  reason: string;
  /**
   * True when priority 1 fired. The directive's whole point is "take it if you
   * ever see it", so every sighting gets a record — `liveRun.ts` writes
   * `boon_priority_burnmastery`.
   */
  burnMastery: boolean;
  /**
   * Lifesteal types present in this offer, with how the window resolved them.
   * Non-empty drives `boon_priority_conflict`, so the `AddLifestealSword` edge
   * has a record either way.
   */
  conflictedTypes: readonly LifestealSighting[];
  /**
   * [session 57] True when two or more options tied at the winning priority
   * rank AND the Hard Core payout narrowed that set. False when nothing tied,
   * when no payout was supplied, or when the tied options all paid the same.
   */
  orbTieBreak: boolean;
  /** The winner's Hard Core payout, when it was supplied; `null` otherwise. */
  orbs: number | null;
}

export interface LifestealSighting {
  type: string;
  /** True if the room-1..8 demotion applied to it. */
  demoted: boolean;
  /** The rank it holds outside the window; `null` if it has no family at all. */
  priorityOutsideWindow: BoonPriority | null;
}

const PRIORITY_LABEL: Record<BoonPriority, string> = {
  1: "BurnMastery",
  2: "AddMaxArmor",
  3: "AddMaxHealth",
  4: "Sword family",
  5: "Vulnerable family",
};

/** Every lifesteal type in the offer and how the window resolved it. */
export function lifestealSightings(
  offered: readonly BoonOption[],
  room: number,
  config: BoonPriorityConfig = DEFAULT_BOON_PRIORITY,
): LifestealSighting[] {
  return offered
    .filter((o) => isLifesteal(o.type))
    .map((o) => ({
      type: o.type,
      demoted: isEarlyGame(room, config),
      // Recomputed with the window forced shut, so the log says what was
      // given up rather than just that something was.
      priorityOutsideWindow: priorityOf(o.type, config.earlyGameMaxRoom + 1, config),
    }));
}

export interface BoonPriorityInput {
  player: Combatant;
  offered: readonly BoonOption[];
  room: number;
  config?: BoonPriorityConfig;
  /** Passed through to `rankBoons` for the within-tier tie-break. */
  rankOptions?: RankOptions;
  /**
   * **[USER DIRECTIVE, 2026-08-20 — session 57]** Per-option Hard Core payout
   * (`rewardPathOptions[].gigusOrbAmount`, itemId 845), PARALLEL TO `offered`
   * BY INDEX. Omitted means "not captured", and the tie-break simply does not
   * fire — never "zero orbs".
   *
   * The directive is strictly: **boon priority decides first; orbs break ties
   * within the same priority rank; orbs never override a higher-priority
   * boon.** So this is read ONLY among options that already tie at the best
   * matching priority, and `rankBoons` still decides below it.
   *
   * It is NOT read when no option matches a priority family at all. Every such
   * option shares an absent rank, so a wider reading is available and would
   * fire far more often — but it would let orb count override `rankBoons`'
   * modelled quality, which the directive does not authorise. The cost of the
   * narrow reading is measured rather than assumed: see
   * `scripts/orbTieBreakReport.ts`, which reports both.
   */
  orbs?: readonly (number | undefined)[];
}

/**
 * The directive's pick, or `null` when the offer holds nothing on the list and
 * the decision falls through to `rankBoons` unchanged.
 *
 * **Within-tier tie-break.** When two options share the best matching
 * priority (two Sword-family boons, say), the directive does not order them —
 * so `rankBoons` orders that subset and the top one wins. That is the module's
 * documented fallback doing the job it already does, not a new rule invented
 * here. Ties inside `rankBoons` still break on offer order, so the whole
 * decision stays reproducible.
 */
export function choosePriorityBoon(input: BoonPriorityInput): BoonPriorityDecision | null {
  const { player, offered, room } = input;
  const config = input.config ?? DEFAULT_BOON_PRIORITY;

  const matches = offered
    .map((option, index) => ({ option, index, priority: priorityOf(option.type, room, config) }))
    .filter((m): m is { option: BoonOption; index: number; priority: BoonPriority } => m.priority !== null);

  if (matches.length === 0) return null;

  const best = Math.min(...matches.map((m) => m.priority)) as BoonPriority;
  const tied = matches.filter((m) => m.priority === best);

  // ── priority rank -> ORBS -> rankBoons ──────────────────────────────────
  // [session 57, user directive] The Hard Core payout narrows the tied set
  // before `rankBoons` sees it, and only ever within one priority rank.
  //
  // It fires ONLY when every tied option carries a payout. A partial capture
  // would otherwise read an absent field as the worst payout and hand the pick
  // to whichever option happened to be recorded — a silent wrong answer in
  // exactly the direction the field was added to improve.
  let candidates = tied;
  let orbTieBreak = false;
  const orbOf = (i: number) => input.orbs?.[i];
  if (candidates.length > 1 && candidates.every((m) => typeof orbOf(m.index) === "number")) {
    const bestOrbs = Math.max(...candidates.map((m) => orbOf(m.index)!));
    const richest = candidates.filter((m) => orbOf(m.index) === bestOrbs);
    if (richest.length < candidates.length) {
      candidates = richest;
      orbTieBreak = true;
    }
  }

  let winner = candidates[0]!;
  if (candidates.length > 1) {
    const ranked = rankBoons(
      player,
      candidates.map((m) => m.option),
      room,
      input.rankOptions ?? {},
    );
    const top = ranked[0]!.option;
    winner = candidates.find((m) => m.option === top) ?? winner;
  }

  const conflictedTypes = lifestealSightings(offered, room, config);
  const steps: string[] = [];
  if (orbTieBreak) steps.push(`Hard Core payout ${orbOf(winner.index)} narrowed it`);
  if (candidates.length > 1 || !orbTieBreak) steps.push("rankBoons broke the tie");
  const tieNote = tied.length > 1 ? ` (${tied.length} options tied at this priority; ${steps.join("; ")})` : "";

  return {
    option: winner.option,
    index: winner.index,
    priority: best,
    label: PRIORITY_LABEL[best],
    burnMastery: best === 1,
    conflictedTypes,
    orbTieBreak,
    orbs: orbOf(winner.index) ?? null,
    reason:
      `boon-priority ${best} (${PRIORITY_LABEL[best]}): taking "${winner.option.type}" at room ${room}` +
      tieNote +
      ` — user directive 2026-08-20, src/strategy/boonPriority.ts`,
  };
}

/**
 * The composed pick: the directive when it matches, `rankBoons`' top choice
 * otherwise. Throws on an empty offer, matching `pickBoon`.
 */
export function pickBoonWithPriority(
  player: Combatant,
  offered: readonly BoonOption[],
  room: number,
  config: BoonPriorityConfig = DEFAULT_BOON_PRIORITY,
  rankOptions: RankOptions = {},
  orbs?: readonly (number | undefined)[],
): BoonOption {
  if (offered.length === 0) throw new Error("pickBoonWithPriority() called with an empty offer");
  const decision = choosePriorityBoon({ player, offered, room, config, rankOptions, orbs });
  if (decision) return decision.option;
  // No option matches a priority family, so there is no rank for orbs to break
  // a tie WITHIN. Falls through to `rankBoons` untouched — see `orbs`' doc
  // comment on the wider reading that was deliberately not taken.
  const ranked = rankBoons(player, offered, room, rankOptions);
  return ranked[0]!.option;
}
