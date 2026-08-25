/**
 * src/sim/boonRunCoverage.ts — [session 61 §5] per-run boon-coverage
 * instrumentation. Pure: types in, snapshot out, no I/O.
 *
 * ## The question this exists to make answerable, and does NOT answer
 *
 * Session 60's wide orb rule shrank `UNMODELLED_TYPES` by two **at once** — a
 * first — because choosing by orb payout reaches boons the ranked policy
 * structurally avoids (`rankBoons` floors every unmodelled type at score 10,
 * so it top-ranked one on 0 of 540 decisions — the measurement that justified
 * the capture override deleted in session 96, QUESTIONS.md §37). Depth got
 * worse that run and coverage got better.
 *
 * Whether coverage is a **reason** for the wide orb rule or a **side effect**
 * of it is a real question, and n=1 cannot answer it. The session-61 brief is
 * explicit that this session must make it answerable and **must not decide
 * it** — and specifically must not let a coverage argument become a second,
 * unstated justification for a rule the user adopted for a different reason
 * (the Hard Core payout, measured at +6.3 orbs/run).
 *
 * So this module records and nothing else. In three or four runs the question
 * has data under it; today it has one point.
 *
 * ## Why it writes to the run's own JSONL and not a new ledger
 *
 * A new persistence path is a new way to violate CLAUDE.md's "tests must never
 * write to a real data path" rule, which has now shipped as a real bug four
 * times. The run logs already accumulate one file per run, they are already
 * the thing every other cross-run report reads, and a snapshot per run in them
 * is sufficient — `scripts/boonCoverage.ts` can aggregate across them without
 * anything new being persisted.
 *
 * ## [session 95] Why "unmodelled" is a PREDICATE here and not a list
 *
 * This module used to decide unmodelled-ness by membership in
 * `UNMODELLED_TYPES`, and that undercounted. Session 94's run 4 printed
 * *"6 type(s) picked, 2 of them still UNMODELLED"* while the corpus held
 * **three** first-ever pickup pairs from that run — `AddWeakMagic`,
 * `VulnerableCrit` and `Regen`.
 *
 * The cause is structural, not a missed pick, and it is worth stating because
 * the session-95 brief guessed otherwise (it expected a call-site bug at the
 * run's last room, on the pattern of the `oilsConsumed` closing-turn blind
 * spot). It is not that. `UNMODELLED_TYPES` is DERIVED FROM `OBSERVED_OFFERS`
 * — it lists types the OFFER TABLE has recorded and that have no model. At the
 * session-94 handoff commit the string `VulnerableCrit` did not appear
 * anywhere in `boons.ts`: its first and only offer row arrived with session
 * 95's +22 append. A type the table has never seen cannot be in
 * `UNMODELLED_TYPES`, so it could not be counted — and the very first pickup
 * of a brand-new type is EXACTLY the case this instrument exists to report.
 * The list was blindest precisely where it mattered most.
 *
 * `!BOON_MODELS[type]` has no such blind spot: it asks the only question that
 * was ever meant — does this type have a model — of the table that actually
 * answers it. `unmodelledTypesAtRunStart` still reports the LIST's size,
 * because that is a genuine table metric and its docstring now says so.
 */

import { BOON_MODELS, UNMODELLED_TYPES } from "./boons.js";

export interface BoonRunCoverage {
  /**
   * Size of `UNMODELLED_TYPES` as this run's code sees it. The "before" of the
   * before/after pair.
   *
   * ⚠ This is a TABLE metric and is reported as one: `UNMODELLED_TYPES` is
   * derived from `OBSERVED_OFFERS`, so it can only ever count types the offer
   * table has already recorded. It is NOT the number of unmodelled types in
   * the game, and the fields below deliberately no longer derive from it —
   * see the module header.
   */
  unmodelledTypesAtRunStart: number;
  /** Every distinct boon type OFFERED anywhere in the run. */
  typesOffered: string[];
  /** Every distinct boon type actually PICKED. */
  typesPicked: string[];
  /** Offered types that are currently unmodelled — the pool this run could have drawn coverage from. */
  unmodelledOffered: string[];
  /**
   * PICKED types that are currently unmodelled. These are the first-ever
   * pickup-pair candidates — a type only leaves `UNMODELLED_TYPES` once it has
   * been picked and its before/after pair captured.
   */
  unmodelledPicked: string[];
  /** `unmodelledPicked.length` — the headline the brief asked for, named so it cannot be confused with `typesPicked`. */
  firstEverCandidates: number;
}

/**
 * `offered` and `picked` are boon type strings in run order; duplicates are
 * fine and are collapsed here.
 *
 * `isModelled` is injected rather than read from the import so a test can pin
 * the logic against a fixed answer instead of against a module constant that
 * legitimately changes every time a boon is modelled — which would make any
 * assertion here a tripwire on unrelated progress. `unmodelledTableSize` is
 * injected for the same reason.
 */
export function summarizeBoonRunCoverage(
  offered: readonly string[],
  picked: readonly string[],
  isModelled: (type: string) => boolean = (t) => Boolean(BOON_MODELS[t]),
  unmodelledTableSize: number = UNMODELLED_TYPES.length,
): BoonRunCoverage {
  const typesOffered = [...new Set(offered)].sort();
  const typesPicked = [...new Set(picked)].sort();
  const unmodelledOffered = typesOffered.filter((t) => !isModelled(t));
  const unmodelledPicked = typesPicked.filter((t) => !isModelled(t));
  return {
    unmodelledTypesAtRunStart: unmodelledTableSize,
    typesOffered,
    typesPicked,
    unmodelledOffered,
    unmodelledPicked,
    firstEverCandidates: unmodelledPicked.length,
  };
}
