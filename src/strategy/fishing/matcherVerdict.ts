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
 * ## THE RULE IN FORCE — session 61, superseding session 51's
 *
 * **Read `SESSION_51_VERDICT` below first.** Session 51's rule was applied as
 * written, on 2026-08-20, to 7 instrumented turns, and it returned **DROP**.
 * That verdict is preserved verbatim in this file. The user then decided to
 * gather more turns before acting on it, and this rule is that decision made
 * explicit: **a pre-registered rule renegotiated after its result was
 * visible.** That is the honest description and it is written the same way in
 * DECISIONS.md. It is not "refining the threshold".
 *
 * What makes this the strongest available version of that decision rather
 * than the weakest: it was written in session 61, a session that ran **zero
 * casts**, with the fishing programme paused on the user's oil crafting. No
 * new data was in hand and none was arriving, so the replacement could not be
 * tuned to a result already seen. If a pre-registration has to be redone, that
 * is the moment to redo it.
 *
 *   DROP  — >= MIN_INSTRUMENTED_TURNS accrued AND pi never exceeded 0.5 on any
 *           cast. **The minimum-n clause gates THIS ARM ONLY** — see below.
 *   KEEP  — pi exceeded 0.5 on at least one cast AND that cast's turns hit
 *           above the batch's own base rate. Fires at ANY n.
 *   INSUFFICIENT_DATA — below the minimum with no crossing seen.
 *
 * ## Why the minimum-n clause is ASYMMETRIC, which is the whole design
 *
 * Session 51's rule had only a drop arm, which is why hitting it felt like a
 * trap rather than an answer: a rule that can only fire one way never ends.
 * This one ends in both directions, and the two arms need different amounts of
 * evidence because they are different KINDS of claim:
 *
 *   - **DROP is an absence claim** ("no turn ever crosses 0.5"). Absence of
 *     evidence is only evidence of absence with power behind it, so DROP waits
 *     for N.
 *   - **KEEP is an existence claim** ("some turn does"). One crossing settles
 *     the existence half outright — no sample size makes an observed event
 *     less observed — so KEEP is not gated on N at all.
 *
 * The catch, stated rather than hidden: KEEP's SECOND half ("and it hit above
 * base rate") is a noisy sampled comparison, and at small n it is weak. So the
 * report carries `verdictIsPowered`, false whenever the verdict landed below
 * N, and a KEEP at n=3 must be read as "the matcher can reach high confidence,
 * and the payoff half is unpowered", not as a settled result.
 *
 * ## N is denominated in TURNS, and must never be converted to casts
 *
 * `MIN_INSTRUMENTED_TURNS` counts instrumented MATCHER TURNS. It is deliberately
 * not a cast count, because Mid Relaxing Oil (itemId 937, `FishingDamageFish`
 * +2) makes fish die sooner and therefore yields FEWER turns per cast. Any
 * conversion using the pre-oil turns-per-cast rate would silently inflate
 * progress once oils land. `turnsRemaining` below reports turns, and nothing
 * in this module divides by a cast rate.
 *
 * ## Oil-era turns COUNT toward N (session 61 §4b)
 *
 * Both oils change **what we spend**, not what the fish does — Mid Focus Oil
 * (942) restores focus, Mid Relaxing Oil (937) damages the fish — and pi is a
 * MOVEMENT-model quantity, so the dead-era precedent applies in the pooling
 * direction: outcome metrics split by arm, movement-model quantities pool.
 * Oil casts therefore accrue toward N exactly like any other.
 *
 * **The caveat travels with the conclusion, per the brief.** +2 damage reaches
 * low-HP fish states EARLIER in a cast, so if anything downstream conditions on
 * fish HP, oil casts do not invalidate transitions — they REWEIGHT which states
 * get observed. A conditional transition model survives that untouched; a
 * marginal or shrinkage-fitted parameter can drift on it. When oil casts start
 * landing, check the per-class shrinkage `{1: 0.1, 2: 8}` and pi_0 = 0.133 for
 * that drift specifically. Check and report — do not pre-emptively re-derive.
 *
 * ## The third outcome, carried over unchanged from session 51's encoding
 *
 * pi exceeds 0.5 on some cast, but no such cast beats the base rate. That is
 * `EARNED_BUT_UNPAID` — the matcher won belief and then did not convert it —
 * reported under its own name so nobody has to guess which way session 51
 * would have called it. Practically it points the same direction as DROP; it
 * is separated because the evidence is different. Like KEEP it is an existence
 * claim about pi, so it too fires at any n, with `verdictIsPowered` telling
 * the reader how much weight the payoff half can bear.
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
 * ── SESSION 51'S VERDICT, PRESERVED ────────────────────────────────────────
 *
 * Not erased, not "superseded" in the sense of deleted. Session 51's rule was
 * applied exactly as pre-registered, on the date below, and returned DROP.
 * Anyone reading this file later is entitled to see the result that the
 * renegotiation was a response to, with its own sample and its own numbers.
 */
export const SESSION_51_VERDICT = {
  verdict: "DROP" as const,
  date: "2026-08-20",
  measuredInSession: 60,
  activeTurns: 7,
  minPi: 0.13,
  medianPi: 0.138,
  maxPi: 0.255,
  fractionAtOrBelow015: 0.714,
  fractionAboveDecisionThreshold: 0,
  priorPi0: 0.137,
  libraryPatterns: 3,
  librarySupport: "12/93",
  supersededBy:
    "session 61's MIN_INSTRUMENTED_TURNS rule — the user's decision to gather more turns before " +
    "acting, taken AFTER this verdict was visible. A renegotiation, named as one.",
} as const;

/**
 * ── DERIVING N ─────────────────────────────────────────────────────────────
 *
 * **N = 32 instrumented matcher turns.** Derived from the REPLAY REFERENCE
 * (session 50/51), never from the 7 turns already observed — deriving a
 * minimum from the sample that triggered the renegotiation is the exact
 * circularity the exercise exists to avoid.
 *
 * **Step 1 — the parametric route, and why it is REJECTED.** The replay gives
 * two quantiles of pi: median 0.135 and P(pi <= 0.15) = 0.705. Two points fix a
 * two-parameter fit. Both natural choices agree, and both are devastating:
 *
 *   logit-normal  mu=-1.8575 sigma=0.2280  ->  P(pi > 0.5) = 2.2e-16
 *   lognormal     mu=-2.0025 sigma=0.1955  ->  P(pi > 0.5) = 1.1e-11
 *
 * Under either, a crossing is ~8 sigma out and no achievable N would ever
 * observe one; the rule would be unfalsifiable at any sample size this project
 * can reach. **That reading is not trusted, and it should not be**: it
 * extrapolates a far tail from two CENTRAL quantiles, which is precisely the
 * kind of inference this repo has been burned by before. It is recorded
 * because it is informative in one honest direction — the prior strongly
 * favours DROP being correct, so N is about being ABLE TO SAY SO, not about
 * expecting a reversal.
 *
 * **Step 2 — N as a SENSITIVITY FLOOR, which is what is actually used.**
 * Instead of predicting the rate, state the rate we are willing to be blind
 * to. For a per-turn crossing rate p, the chance of seeing at least one in N
 * turns is 1-(1-p)^N; N = ln(0.20)/ln(1-p) gives 80% power.
 *
 *   p >= 0.100 -> N = 16      p >= 0.050 -> N = 32      p >= 0.020 -> N = 80
 *   p >= 0.075 -> N = 21      p >= 0.030 -> N = 53      p >= 0.010 -> N = 161
 *
 * **THE ASSUMED RATE, STATED EXPLICITLY AS THE BRIEF REQUIRES: p = 5%.** That
 * number is not invented for this rule — it is this repo's OWN established
 * floor of measurability. SPEC section 4e puts the dungeon's rolled-stat proc
 * chances at 1-5% and concludes they need hundreds of observations, which is
 * why the simulator gave up on them. Adopting the same floor here keeps one
 * standard across both halves of the project instead of two.
 *
 * So N = 32: at 80% power this detects a crossing rate of 5% or higher. The
 * session-61 brief offered 25 as a sanity check; 25 corresponds to p >= 6.2%,
 * coarser than the repo's own floor, so 32 lands just the conservative side of
 * it — same order of magnitude, which is the check passing.
 *
 * **What a DROP at N=32 therefore MEANS, and this is the sentence to quote:**
 * not "pi never crosses 0.5", but "if crossings happen at all, they happen on
 * fewer than ~5% of instrumented turns, and a tier that earns high confidence
 * that rarely is not worth its complexity." A rule cannot prove a rare event
 * absent. It can bound the rate, and this one says what bound it bought.
 */
export const MIN_INSTRUMENTED_TURNS = 32;

/** The per-turn crossing rate N=32 gives 80% power against. See the derivation above. */
export const DETECTABLE_CROSSING_RATE = 0.05;

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
  /**
   * [session 61] Instrumented matcher turns still needed before the DROP arm
   * may fire. **In TURNS, never converted to casts** — oils shorten casts, so
   * a cast-denominated count would silently inflate once they land. Zero once
   * the minimum is reached; also zero on an existence verdict, which is not
   * gated on N at all.
   */
  turnsRemaining: number;
  /**
   * [session 61] False when the verdict landed below `MIN_INSTRUMENTED_TURNS`.
   * A KEEP or EARNED_BUT_UNPAID can fire at any n (both are existence claims
   * about pi), but their payoff half is a noisy sampled comparison, so this
   * flag says how much weight it can bear. DROP and INSUFFICIENT_DATA are
   * never reported unpowered — the minimum is what separates them.
   */
  verdictIsPowered: boolean;
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
  const turnsRemaining = Math.max(0, MIN_INSTRUMENTED_TURNS - measured.length);
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
  } else if (crossing.length === 0 && measured.length < MIN_INSTRUMENTED_TURNS) {
    // [session 61] THE MINIMUM-N CLAUSE, and the ONLY arm it gates. No
    // crossing seen, but not enough turns to call its absence meaningful —
    // this is where session 51's rule would have returned DROP on 7 turns.
    verdict = "INSUFFICIENT_DATA";
    rationale =
      `${measured.length} instrumented matcher turn(s), below the minimum ${MIN_INSTRUMENTED_TURNS} — ` +
      `${turnsRemaining} more needed (TURNS, not casts; oils shorten casts). No cast has crossed pi ` +
      `${PI_DECISION_THRESHOLD} yet, but DROP is an ABSENCE claim and absence needs power: N=${MIN_INSTRUMENTED_TURNS} ` +
      `buys 80% power against a crossing rate of ${(DETECTABLE_CROSSING_RATE * 100).toFixed(0)}%, and below it a ` +
      `"never crossed" reads the same whether the tier is worthless or merely rare. Session 51's rule returned DROP ` +
      `here on ${SESSION_51_VERDICT.activeTurns} turns; that verdict is preserved in SESSION_51_VERDICT and this ` +
      `rule supersedes it by the user's decision of 2026-08-20.`;
  } else if (crossing.length === 0) {
    verdict = "DROP";
    rationale =
      `pi never exceeded ${PI_DECISION_THRESHOLD} on any of ${casts.length} cast(s) across ${measured.length} ` +
      `instrumented turn(s) — at or above the minimum ${MIN_INSTRUMENTED_TURNS}, so the absence is powered (max ` +
      `observed ${Math.max(...casts.map((c) => (Number.isNaN(c.maxPi) ? 0 : c.maxPi))).toFixed(3)}). This does NOT ` +
      `assert pi never crosses; it bounds the rate: if crossings occur at all they occur on fewer than about ` +
      `${(DETECTABLE_CROSSING_RATE * 100).toFixed(0)}% of instrumented turns, and a tier that earns high confidence ` +
      `that rarely is not worth its complexity. Drop the tier.`;
  } else {
    const paying = crossing.filter((c) => c.hitRate > baseHitRate);
    if (paying.length > 0) {
      verdict = "KEEP";
      rationale =
        `pi exceeded ${PI_DECISION_THRESHOLD} on ${crossing.length} cast(s), and ${paying.length} of those hit above the ` +
        `batch base rate ${(baseHitRate * 100).toFixed(1)}% (${paying.map((c) => `${c.castId} ${(c.hitRate * 100).toFixed(1)}%`).join(", ")}). ` +
        `KEEP is an EXISTENCE claim, so it fires at any n — but the payoff half is a sampled comparison, and at ` +
        `${measured.length} instrumented turn(s) it is ` +
        `${measured.length >= MIN_INSTRUMENTED_TURNS ? "powered" : `UNPOWERED (minimum ${MIN_INSTRUMENTED_TURNS})`}. ` +
        `Keep the tier.`;
    } else {
      verdict = "EARNED_BUT_UNPAID";
      rationale =
        `pi exceeded ${PI_DECISION_THRESHOLD} on ${crossing.length} cast(s) but NOT ONE of them hit above the batch base ` +
        `rate ${(baseHitRate * 100).toFixed(1)}%. Session 51 named only DROP and KEEP; this is the third case, reported ` +
        `under its own name rather than folded into either. It points the same way as DROP, on different evidence — ` +
        `and unlike DROP it needs no minimum n, because a crossing that happened is not made less real by a small ` +
        `sample. At ${measured.length} instrumented turn(s) the payoff half is ` +
        `${measured.length >= MIN_INSTRUMENTED_TURNS ? "powered" : `UNPOWERED (minimum ${MIN_INSTRUMENTED_TURNS})`}.`;
    }
  }

  return {
    verdict,
    rationale,
    activeTurns: measured.length,
    unmeasuredTurns,
    turnsRemaining,
    verdictIsPowered: measured.length >= MIN_INSTRUMENTED_TURNS,
    distribution,
    casts,
    baseHitRate,
    baseHitTurns,
    crossingCastIds,
    openingFocus,
  };
}
