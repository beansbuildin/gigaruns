/**
 * src/strategy/fishing/matcherVerdict.ts — QUESTIONS.md §19's decision rule,
 * as CODE. Pure: rows in, verdict out, no I/O.
 *
 * ## Why this is a module and not a paragraph in a script
 *
 * §19 ("should the matcher tier be DROPPED rather than mixed?") has been open
 * since session 51 and unmeasured for four sessions. The failure mode a rule
 * written as prose invites is renegotiation after the numbers are in — and
 * that is a real risk here, because the honest answer may well be "drop the
 * thing we spent two sessions building". Encoding the rule means the verdict
 * is computed before anyone has an opinion about it.
 *
 * ## The rule (session 51)
 *
 *   DROP  — pi never exceeds 0.5 on any cast in the batch.
 *   KEEP  — pi exceeds 0.5 on at least one cast AND that cast's turns hit
 *           above the batch's own base rate.
 *
 * Session 51 named exactly those two. A third case is reachable and is NOT
 * folded silently into either: pi exceeds 0.5 on some cast, but no such cast
 * beats the base rate. That is `EARNED_BUT_UNPAID` — the matcher won belief
 * and then did not convert it — and it is reported under its own name so
 * nobody has to guess which way session 51 would have called it. Practically
 * it points the same direction as DROP; it is separated because the evidence
 * is different and a future session may want to tell them apart.
 *
 * A fourth outcome is about the DATA, not the tier: `INSUFFICIENT_DATA`.
 *
 * ## The trap this module refuses to fall into (CLAUDE.md rule 10)
 *
 * `matcherWeight` is instrumentation that FIRST APPEARS in session 51. Every
 * row written before it lacks the field, and `liveFishing.ts`'s
 * `matcherWeightOf()` fills those in with the fixed 0.9 that was genuinely in
 * force at the time — correct for reading history, and catastrophic here,
 * because 0.9 is a CONSTANT and would be read as "pi is high on every turn",
 * i.e. the exact conclusion §19 is trying to test. That is rule 10's shape
 * precisely: a field that first appears at date D, counted as if it described
 * the period before D.
 *
 * So this module reads `rec.matcherWeight` DIRECTLY and treats an absent field
 * as "not measured", never as 0.9. A batch of pre-instrumentation rows returns
 * `INSUFFICIENT_DATA` with the count, rather than a confident wrong verdict.
 */

/**
 * The subset of `liveFishing.ts`'s `RingPredictionRecord` this rule needs.
 * Structural, so a test can build a row without importing the live script.
 */
export interface MatcherWeightRow {
  castId: string;
  turn: number;
  tier: string;
  hit: boolean;
  /** Absent = written before session 51's instrumentation. NEVER defaulted here. */
  matcherWeight?: number;
  /** Turn-0 focus spend, session 50's live-vs-replay comparison. */
  focusMoveCost?: number;
}

export type MatcherVerdict = "KEEP" | "DROP" | "EARNED_BUT_UNPAID" | "INSUFFICIENT_DATA";

/** The threshold session 51 named. Here so the rule has exactly one number in it. */
export const PI_DECISION_THRESHOLD = 0.5;

/**
 * Session 50/51's REPLAY figures, carried as reference constants so the live
 * distribution can be read against the thing it is supposed to be compared to
 * rather than against a memory of it. These describe the replay arm, not live.
 */
export const REPLAY_REFERENCE = {
  medianPi: 0.135,
  fractionBelow: 0.705,
  belowThreshold: 0.15,
  /** Session 50: opening focus spend, replayed vs live with the matcher off. */
  openingFocusReplayed: 0.71,
  openingFocusLiveMatcherOff: 1.8,
} as const;

export interface PiDistribution {
  n: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  /** Fraction at or below `REPLAY_REFERENCE.belowThreshold` — the replay's own headline shape. */
  fractionBelowReference: number;
  fractionAboveDecisionThreshold: number;
}

export interface CastSummary {
  castId: string;
  turns: number;
  maxPi: number;
  hits: number;
  hitRate: number;
}

export interface MatcherWeightReport {
  verdict: MatcherVerdict;
  /** One sentence saying why, in the rule's own terms. */
  rationale: string;
  /** Rows the matcher was actually in play on AND that carry a real weight. */
  activeTurns: number;
  /** Rows the matcher was in play on but which predate the instrumentation. */
  unmeasuredTurns: number;
  distribution: PiDistribution | null;
  casts: CastSummary[];
  /** Every turn in the batch, matcher or not — the bar a qualifying cast has to clear. */
  baseHitRate: number;
  baseHitTurns: number;
  /** Casts that crossed the threshold, whether or not they then paid. */
  crossingCastIds: string[];
  openingFocus: { n: number; mean: number; lo: number; hi: number } | null;
}

/** A turn where the matcher tier contributed to the shipped distribution. */
function isMatcherTier(tier: string): boolean {
  return tier === "matcher" || tier === "matcher_ring";
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

function meanAndCi(xs: number[]): { n: number; mean: number; lo: number; hi: number } {
  const n = xs.length;
  if (n === 0) return { n: 0, mean: NaN, lo: NaN, hi: NaN };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { n, mean, lo: mean, hi: mean };
  const varr = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(varr / n);
  return { n, mean, lo: mean - 1.96 * se, hi: mean + 1.96 * se };
}

export function buildMatcherWeightReport(rows: readonly MatcherWeightRow[]): MatcherWeightReport {
  const matcherRows = rows.filter((r) => isMatcherTier(r.tier));
  const measured = matcherRows.filter((r) => typeof r.matcherWeight === "number");
  const unmeasuredTurns = matcherRows.length - measured.length;

  // The base rate is the WHOLE batch, matcher turns included — "did the cast
  // where the matcher earned belief do better than this batch normally does".
  const baseHitTurns = rows.length;
  const baseHits = rows.filter((r) => r.hit).length;
  const baseHitRate = baseHitTurns === 0 ? NaN : baseHits / baseHitTurns;

  // Per-cast summaries over the WHOLE cast's turns, not only its matcher
  // turns: the rule asks whether the cast hit above base rate, and a cast is
  // the unit a fish is drawn in.
  const byCast = new Map<string, MatcherWeightRow[]>();
  for (const r of rows) {
    const list = byCast.get(r.castId);
    if (list) list.push(r);
    else byCast.set(r.castId, [r]);
  }
  const casts: CastSummary[] = [...byCast.entries()]
    .map(([castId, castRows]) => {
      const weights = castRows
        .filter((r) => isMatcherTier(r.tier) && typeof r.matcherWeight === "number")
        .map((r) => r.matcherWeight as number);
      const hits = castRows.filter((r) => r.hit).length;
      return {
        castId,
        turns: castRows.length,
        maxPi: weights.length === 0 ? NaN : Math.max(...weights),
        hits,
        hitRate: castRows.length === 0 ? NaN : hits / castRows.length,
      };
    })
    .sort((a, b) => (Number.isNaN(b.maxPi) ? -1 : b.maxPi) - (Number.isNaN(a.maxPi) ? -1 : a.maxPi));

  const weights = measured.map((r) => r.matcherWeight as number).sort((a, b) => a - b);
  const distribution: PiDistribution | null =
    weights.length === 0
      ? null
      : {
          n: weights.length,
          min: weights[0]!,
          p25: quantile(weights, 0.25),
          median: quantile(weights, 0.5),
          p75: quantile(weights, 0.75),
          max: weights[weights.length - 1]!,
          fractionBelowReference:
            weights.filter((w) => w <= REPLAY_REFERENCE.belowThreshold).length / weights.length,
          fractionAboveDecisionThreshold:
            weights.filter((w) => w > PI_DECISION_THRESHOLD).length / weights.length,
        };

  const openingSpends = rows
    .filter((r) => r.turn === 0 && typeof r.focusMoveCost === "number")
    .map((r) => r.focusMoveCost as number);
  const openingFocus = openingSpends.length === 0 ? null : meanAndCi(openingSpends);

  const crossing = casts.filter((c) => !Number.isNaN(c.maxPi) && c.maxPi > PI_DECISION_THRESHOLD);
  const crossingCastIds = crossing.map((c) => c.castId);

  // ── The rule ──────────────────────────────────────────────────────────────
  let verdict: MatcherVerdict;
  let rationale: string;
  if (measured.length === 0) {
    verdict = "INSUFFICIENT_DATA";
    rationale =
      unmeasuredTurns > 0
        ? `${unmeasuredTurns} matcher turn(s) in this batch, but NONE carries a real matcherWeight — every one predates ` +
          `session 51's instrumentation. Reading them through matcherWeightOf() would report the fixed 0.9 that was in ` +
          `force at the time, which is a constant, not a measurement (CLAUDE.md rule 10). §19 stays unmeasured.`
        : `no matcher turns in this batch at all — the tier never fired, so there is nothing to judge.`;
  } else if (crossing.length === 0) {
    verdict = "DROP";
    rationale =
      `pi never exceeded ${PI_DECISION_THRESHOLD} on any of ${casts.length} cast(s) (max observed ` +
      `${Math.max(...casts.map((c) => (Number.isNaN(c.maxPi) ? 0 : c.maxPi))).toFixed(3)}). Session 51's rule: drop the tier.`;
  } else {
    const paying = crossing.filter((c) => c.hitRate > baseHitRate);
    if (paying.length > 0) {
      verdict = "KEEP";
      rationale =
        `pi exceeded ${PI_DECISION_THRESHOLD} on ${crossing.length} cast(s), and ${paying.length} of those hit above the ` +
        `batch base rate ${(baseHitRate * 100).toFixed(1)}% (${paying.map((c) => `${c.castId} ${(c.hitRate * 100).toFixed(1)}%`).join(", ")}). ` +
        `Session 51's rule: keep the tier.`;
    } else {
      verdict = "EARNED_BUT_UNPAID";
      rationale =
        `pi exceeded ${PI_DECISION_THRESHOLD} on ${crossing.length} cast(s) but NOT ONE of them hit above the batch base ` +
        `rate ${(baseHitRate * 100).toFixed(1)}%. Session 51 named only DROP and KEEP; this is the third case, reported ` +
        `under its own name rather than folded into either. It points the same way as DROP, on different evidence.`;
    }
  }

  return {
    verdict,
    rationale,
    activeTurns: measured.length,
    unmeasuredTurns,
    distribution,
    casts,
    baseHitRate,
    baseHitTurns,
    crossingCastIds,
    openingFocus,
  };
}
