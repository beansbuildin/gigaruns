/**
 * src/sim/boonRunCoverage.ts — [session 61 §5] per-run boon-coverage
 * instrumentation. Pure: types in, snapshot out, no I/O.
 *
 * ## The question this exists to make answerable, and does NOT answer
 *
 * Session 60's wide orb rule shrank `UNMODELLED_TYPES` by two **at once** — a
 * first — because choosing by orb payout reaches boons the ranked policy
 * structurally avoids (`rankBoons` floors every unmodelled type at score 10,
 * so it top-ranked one on 0 of 540 decisions; see `boonCapture.ts`). Depth got
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
 */

import { UNMODELLED_TYPES } from "./boons.js";

export interface BoonRunCoverage {
  /** Size of `UNMODELLED_TYPES` as this run's code sees it. The "before" of the before/after pair. */
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
 * `unmodelled` is injected rather than read from the import so a test can pin
 * the logic against a fixed list instead of against a module constant that
 * legitimately changes every time a boon is modelled — which would make any
 * assertion here a tripwire on unrelated progress.
 */
export function summarizeBoonRunCoverage(
  offered: readonly string[],
  picked: readonly string[],
  unmodelled: readonly string[] = UNMODELLED_TYPES,
): BoonRunCoverage {
  const unmodelledSet = new Set(unmodelled);
  const typesOffered = [...new Set(offered)].sort();
  const typesPicked = [...new Set(picked)].sort();
  const unmodelledOffered = typesOffered.filter((t) => unmodelledSet.has(t));
  const unmodelledPicked = typesPicked.filter((t) => unmodelledSet.has(t));
  return {
    unmodelledTypesAtRunStart: unmodelled.length,
    typesOffered,
    typesPicked,
    unmodelledOffered,
    unmodelledPicked,
    firstEverCandidates: unmodelledPicked.length,
  };
}
