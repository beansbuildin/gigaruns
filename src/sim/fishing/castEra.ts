/**
 * src/sim/fishing/castEra.ts — [session 84, brief §1 / GATE 1] the policy ERA
 * a cast was played in, and what conditioning on it does to the focus budget.
 *
 * ## Why this module exists at all
 *
 * The fishing corpus pools several policy eras, and this repo has known that
 * since session 71 — `scripts/focusProfileCheck.ts` carries the comment *"the
 * corpus pools THREE policy eras and the oldest two are 88 of its 123 casts"*.
 * Every instrument built since has pooled them anyway. Session 83's redraw
 * counterfactual is the expensive instance: its headline result — that a
 * decision-time signal finds dead hands a redraw cannot fix, because 74 of 101
 * are firing from an exhausted focus meter — is **true of the pooled corpus and
 * false of the bot that plays today**, where an exhausted meter is a 1.5%
 * event rather than a 44.9% one.
 *
 * So the era split is a module rather than a line in a report: it is the thing
 * that has to go into the next instrument too.
 *
 * ## The era predicate — THREE eras, and the middle boundary is a SUPPLY event
 *
 * [session 92, QUESTIONS.md §32 ANSWERED — option (b), user directive
 * 2026-08-24] **This module used to carry two eras, `before` and `today`, and
 * the second one was wrong in a way that took three batches to see.** Four
 * era-conditioned claims in `castEra.test.ts` degraded monotonically across
 * three consecutive batches — the budget-zero ratio ~30x -> 6.48x -> 3.92x,
 * the redraw rescue rate 15/15 -> 26/32 -> 30/42, `wasted` {0} -> {0,3,4,5,6}
 * -> {0,3,6,7,9,10,11,12}. §32 offered two readings: converging small-sample
 * estimates, or a predicate that had stopped naming one population. **It is
 * the second, and the pooled thing is not a policy — it is the FOCUS OIL
 * STOCK.**
 *
 * The three eras, and what each one IS:
 *
 *  - **`preOil`** — before `POLICY_ERA_BOUNDARY` (2026-08-21, UTC, day
 *    precision). No oil policy at all; fires zero oils, which is what makes it
 *    the restore-free control `assertCastEraSound` pins.
 *  - **`oilSupplied`** — on/after that boundary and before `FOCUS_DRY_BOUNDARY`.
 *    The oil policy is live AND Focus Oil (itemId 942) is in stock.
 *  - **`focusDry`** — on/after `FOCUS_DRY_BOUNDARY`. The oil policy is still
 *    live and unchanged; **Focus Oil stock is zero**, so the meter-restoring
 *    half of it cannot fire.
 *
 * ## Why the second boundary is where it is — measured, to 5.6 seconds
 *
 * `logs/fishing-*.jsonl` records every `use_fishing_item` POST and every
 * `oil_trigger_no_stock` refusal with its itemId. The last Focus Oil (942)
 * POST that succeeded is **2026-08-24T00:02:51.543Z**; the first
 * `oil_trigger_no_stock` for 942 is **2026-08-24T00:02:57.148Z**, 5.6 seconds
 * later, and 942 never fires again — 36 further no-stock refusals follow, 17
 * in that batch and 19 in the next. The boundary literal is that first
 * refusal. This is a far tighter bracket than the first boundary's 20.3-hour
 * gap, which is why it is stated to the millisecond and why `eraOf` compares
 * the FULL timestamp here rather than the date.
 *
 * ⚠ **Day precision genuinely cannot express this boundary** — it falls inside
 * a single 20-cast batch (2026-08-24T00:01:04 -> 00:05:48), splitting it 8/12.
 * That is why the second comparison is a full-string one. The first boundary
 * stays at day precision because its 20.3-hour empty gap makes every literal
 * inside it equivalent; nothing is gained by pretending to more resolution
 * than the corpus has.
 *
 * ## The evidence that the cut is real, and it is DECK-CONTROLLED
 *
 * The budget-zero rate against Focus Oil supply is a clean dose-response, and
 * the last row is the one that carries the causal claim:
 *
 * ```
 *   era / cluster              Focus POSTs   plays   budget-0   rate
 *   preOil (no oil policy)               0     410        184   44.9%
 *   2026-08-21                          13     110          2    1.8%
 *   2026-08-22                           7      70          1    1.4%
 *   2026-08-23                           3      22          0    0.0%
 *   2026-08-24 00:0x (dries mid-batch)   3      87         17   19.5%
 *   2026-08-24 19:1x (dry throughout)    0      52         19   36.5%
 *   2026-08-24 22:3x (dry throughout)    0      24          2    8.3%
 * ```
 *
 * **`focusDry` is not a new policy behaving worse; it is the OLD regime
 * returning because the consumable ran out.** 28.5% against `preOil`'s 44.9%.
 *
 * The confound has to be named: 12 of `focusDry`'s 32 casts are BASE-DECK
 * casts from the §29 rod-durability window, and a base deck could explain a
 * worse budget on its own. **It does not explain this one, because the
 * comparison survives holding the deck fixed** — restricted to rod-dealt casts
 * only, `oilSupplied` reads 3 budget-zero plays of 215 (**1.4%**) and
 * `focusDry` reads 21 of 76 (**27.6%**), a factor of ~20 with the same deck,
 * the same policy and the same code.
 *
 * ⚠ **`focusDry` IS ITSELF HETEROGENEOUS, and the last row above is why.**
 * [session 92 §2] The 2026-08-24 22:3x batch was Focus-dry throughout — two
 * `oil_trigger_no_stock` refusals for 942, zero 942 POSTs — and still read only
 * **8.3%**, against the 19:1x batch's 36.5% under identical supply. The
 * difference is CAST LENGTH: 22:3x averaged 2.4 card decisions per cast against
 * 19:1x's 5.2, because five of its ten casts were killed early (three by the
 * double-lethal oil trigger). A meter that is never drawn down cannot reach
 * zero. **So "Focus-dry" sets the CEILING on budget-zero, not its level** —
 * quote the arm's rate as a range across batches, never as a constant, and do
 * not read a low focusDry rate as the supply having been restored. Check the
 * 942 POST count, which is the actual predicate.
 *
 * ## What the corrected split does to the four §32 claims
 *
 * Every one of them was contaminated rather than converging — session 89's
 * "~30x" was RIGHT for the oil-supplied era and decayed only because dry casts
 * were being pooled into it:
 *
 * ```
 *   claim                          2-era `today`      3-era `oilSupplied`
 *   budget-zero ratio                     3.92x                  26.37x
 *   budget-zero rate                      11.4%                    1.7%
 *   redraw rescue rate                30/42 71%              21/22 95.5%
 *   redrawCounterfactual.neither             12                       1
 * ```
 *
 * ✅ **[session 92 §2] CONFIRMED OUT OF SAMPLE, and this is the strongest
 * evidence the re-specification is right.** A ten-cast batch landed after the
 * ruling was written. All ten classified as `focusDry`, and **every figure
 * above is byte-identical afterwards** — the ratio is still 26.3659, the
 * rescue interval still [0.782, 0.992], `neither` still 1, `wasted` still
 * {0, 1}. Under the old two-era model those ten casts would have diluted
 * `today` for a FOURTH consecutive batch. The predicate now puts new casts
 * where they belong instead of into the arm that describes the policy.
 *
 * ⚠ **The `meanOptimal` bound is a SEPARATE defect and this split does not fix
 * it — see `openingOverspendSplit`.** Do not read the table above as rescuing
 * that assertion too.
 *
 * ## Why the predicate is still a DATE LITERAL and not a stock reading
 *
 * The supply itself is not in the committed fixtures — it is in gitignored
 * `logs/`. So the module does what it already did for the first boundary: it
 * commits the INSTANT as a literal, justified by evidence cited here, and
 * classifies casts using only `doc.createdAt`, which is committed and constant
 * within a cast. A fresh clone reproduces every era-conditioned number in this
 * file without `logs/` present. **The literal is a measurement, not a
 * preference; if the user restocks Focus Oil, that opens a FOURTH era and a
 * new boundary — do not silently widen `focusDry` to cover it.**
 *
 * ## Why it is a date off the FIXTURES (the first boundary's original case)
 *
 * A cast belongs to a post-`preOil` era when its `doc.createdAt` falls on or
 * after `POLICY_ERA_BOUNDARY` (2026-08-21, UTC). Three things justify that
 * reading over the alternatives, all of them measured rather than assumed:
 *
 *  1. **`doc.createdAt` is constant across a cast's states** — 148 of 148 on
 *     the corpus as committed — so it dates the CAST, not the response. This
 *     is emphatically not session 84's brief §0b hazard, which is about
 *     ordering STATES within a cast: there the timestamps tie and file order is
 *     the sequence. Dating a whole cast is a different use, and it is safe.
 *  2. **It reads committed fixtures only.** The obvious alternative,
 *     `todaysEraCastIds()` in `scripts/focusProfileCheck.ts` and
 *     `scripts/oilArmCatchCheck.ts`, reads `data/ringPrediction.jsonl` — which
 *     is gitignored, absent from a fresh clone, and knows only **81 of the
 *     corpus's 148 casts**. An era predicate that cannot classify 45% of the
 *     corpus, in a tree that does not ship the file it needs, cannot be the
 *     one a committed test pins.
 *  3. **It names a different boundary, and the difference was measured, not
 *     waved away.** `todaysEraCastIds()` keys on `matcherWeight`, i.e. the
 *     matcher-weighting era the repo dates at 2026-08-20T18:27Z. Against this
 *     module's date literal the two sets differ by **exactly five casts, all
 *     stamped 2026-08-20T18:27–18:28Z** — precisely the interval between the
 *     two boundaries. Those five read **7 of 19 plays at focus budget 0
 *     (36.8%)**, which is the OLD regime, and folding them into today's era
 *     would take its rate from 1.5% to 4.5%. The date literal is therefore not
 *     merely the portable choice, it is the correct one.
 *     `assertEraPredicatesAgree` below states the comparison so a future
 *     session re-checks it instead of re-litigating it.
 *
 * ⚠ **The FIRST boundary is a bracket, not a moment.** The corpus's last
 * `preOil` cast is 2026-08-20T18:28:24Z and its first oil-era cast is
 * 2026-08-21T14:46:17Z — a 20.3-hour gap with no casts in it. Any date literal
 * inside that gap gives identical answers. 2026-08-21 is chosen because it is
 * the one the session-84 brief used and because a date is legible; nothing
 * measured here depends on it being exact to the hour.
 *
 * Pure: reads committed fixtures, writes nothing, no network, no `data/`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CastTrace, CastTurn, TraceCard } from "./castTrace.js";
import { budgetBefore, cardCovers } from "./matcherHeadroom.js";
import { allCells, cellKey, manhattan, zonesToCells } from "./geometry.js";

/**
 * The date, UTC, on and after which the oil policy is live. Day precision.
 * See the header: it is a bracket midpoint, not a measured instant — the
 * corpus has a 20.3-hour hole around it.
 */
export const POLICY_ERA_BOUNDARY = "2026-08-21";

/**
 * [session 92] The INSTANT, UTC, at and after which Focus Oil (itemId 942) is
 * out of stock, so the meter-restoring half of the oil policy cannot fire.
 *
 * Unlike `POLICY_ERA_BOUNDARY` this is a measured moment, not a bracket
 * midpoint: it is the first `oil_trigger_no_stock` for 942 in
 * `logs/fishing-*.jsonl`, 5.6 seconds after the last 942 POST that succeeded
 * (2026-08-24T00:02:51.543Z). It is compared at FULL timestamp precision
 * because it falls inside a single 20-cast batch, which a date cannot split.
 */
export const FOCUS_DRY_BOUNDARY = "2026-08-24T00:02:57.148Z";

/**
 * The focus meter's per-cast pool. `focusMeterMax` reads 3 on **all 148**
 * corpus casts, both eras, so the counterfactual in `budgetZeroDecomposition`
 * can treat it as a constant — and `assertCastEraSound` fails if that ever
 * stops being true rather than letting a silent 3 leak into a changed game.
 */
export const FOCUS_POOL = 3;

/**
 * ── [session 93 §2] THE ONE preOil CAST THAT SPENT A CONSUMABLE ────────────
 *
 * Surfaced by §33's ruling, and it is a finding rather than a nuisance:
 * repointing `oilsConsumed` at `fishingCorpus.ts`'s reader made this module
 * see something the corpus reader has flagged since session 61 and the
 * trace-side reader never could.
 *
 * `12975152` reads `consumablesUsed: 1` on **all four** of its captured
 * states, every one a `play_cards` — the cast has no `start_run` response, so
 * capture began mid-cast and the consumable was spent before the window
 * opened. `fishingCorpus.ts`'s own docblock names this exact cast as the one
 * the retroactive flag "immediately found".
 *
 * **Exempt, explicitly, rather than by loosening the check** — and for a
 * reason, not for convenience. `assertCastEraSound` asks whether `preOil` is
 * a restore-free CONTROL, i.e. whether a meter restore happened inside the
 * window the counterfactual measures. Here it provably did not: the count is
 * flat across every captured turn, so no restore is visible to any
 * trace-derived quantity. The cast also predates the oil policy entirely —
 * whatever was spent, this bot did not spend it under a policy.
 *
 * The two readers still disagree about this cast **on purpose**: the corpus
 * reader answers "did this cast spend a consumable" (yes) and the control
 * asks "did a restore occur in the measured window" (no). Any SECOND id
 * arriving here is a different fact and must be investigated, not appended.
 */
export const PRE_OIL_CONSUMABLE_EXEMPT: ReadonlySet<string> = new Set(["12975152"]);

/**
 * [session 92] Three eras, not two. `preOil` fires no oils at all;
 * `oilSupplied` has the oil policy AND Focus Oil stock; `focusDry` has the
 * same policy with the stock exhausted. The old two-era `"before" | "today"`
 * model pooled the last two and that pooling is what §32 was about.
 */
export type Era = "preOil" | "oilSupplied" | "focusDry";

/** The eras in chronological order — for iteration and table rendering. */
export const ERAS: readonly Era[] = ["preOil", "oilSupplied", "focusDry"] as const;

/**
 * Every cast's `doc.createdAt`, off the committed fixtures.
 *
 * Walks the same tree `loadCastTraces` does, with the same `raw/` exclusion
 * (those mirror every file unredacted, and counting both double-counts), and
 * takes the FIRST state's value per `docId`. Constant within a cast on the
 * corpus as committed, which `assertCastEraSound` re-checks.
 */
export function loadCastCreatedAt(root: string = join("fixtures", "fishing-casts")): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): string[] => {
    const found: string[] = [];
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return found;
    }
    for (const e of entries) {
      if (e.name === "raw") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) found.push(...walk(full));
      else if (e.name.startsWith("state-") && e.name.endsWith(".json")) found.push(full);
    }
    return found;
  };
  for (const file of walk(root).sort()) {
    let doc: { docId?: unknown; createdAt?: unknown } | undefined;
    try {
      doc = (JSON.parse(readFileSync(file, "utf8")) as { data?: { doc?: typeof doc } })?.data?.doc;
    } catch {
      continue;
    }
    if (typeof doc?.docId === "string" && typeof doc.createdAt === "string" && !out.has(doc.docId)) {
      out.set(doc.docId, doc.createdAt);
    }
  }
  return out;
}

/**
 * A cast's era. Throws on an undated cast rather than defaulting it — a cast
 * silently binned as "before" is exactly the failure this module exists to
 * stop, and every corpus cast is dated.
 */
export function eraOf(docId: string, created: ReadonlyMap<string, string>): Era {
  const at = created.get(docId);
  if (at === undefined) {
    throw new Error(
      `castEra: cast ${docId} has no doc.createdAt in the committed fixtures, so its era is unknown. ` +
        `Do not default it — find the timestamp or exclude the cast explicitly.`,
    );
  }
  if (at.slice(0, 10) < POLICY_ERA_BOUNDARY) return "preOil";
  // Full-timestamp comparison, deliberately: this boundary falls INSIDE one
  // batch and day precision would put all 20 of its casts on the same side.
  return at < FOCUS_DRY_BOUNDARY ? "oilSupplied" : "focusDry";
}

/** Split traces into the two eras, preserving order within each. */
export function splitByEra(
  traces: readonly CastTrace[],
  created: ReadonlyMap<string, string>,
): Record<Era, CastTrace[]> {
  const out: Record<Era, CastTrace[]> = { preOil: [], oilSupplied: [], focusDry: [] };
  for (const t of traces) out[eraOf(t.docId, created)].push(t);
  return out;
}

/**
 * A cast fired a Focus or Relaxing oil, read off the server's own running
 * `consumablesUsed` count rather than off the focus meter.
 *
 * ⚠ **The meter is the wrong detector and gives a different answer.**
 * `castTrace.ts` deliberately skips the `use_fishing_item` response (it
 * re-reports its predecessor's move fields, so counting it breaks position
 * continuity), which means the meter jump visible across two real turns is
 * `restore MINUS the move spent on the same transition`. Detecting on the
 * meter finds 11 casts and 16 jumps with deltas of both +1 and +2; detecting
 * on `consumablesUsed` finds **13 casts and 21 oils**, which is what actually
 * happened.
 */
export function firedOil(t: CastTrace): boolean {
  return oilsConsumed(t) > 0;
}

/**
 * How many consumables this cast spent.
 *
 * ── [session 93 §2 — QUESTIONS.md §33 ANSWERED, option (b)] ────────────────
 *
 * **This used to read `turns`' first-to-last delta, and that reader was blind
 * to any oil that fired on a cast's CLOSING turn.** `castTrace` correctly
 * skips the `use_fishing_item` response (it re-reports its predecessor's move
 * fields), so when the oil lands the kill there is no later real turn to carry
 * the incremented count. Harmless for four years of shapes where a cast ended
 * on a card; not harmless since session 90 wired the double-lethal trigger,
 * which fires exactly there by construction. Measured undercount: **15 casts /
 * 24 oils against a truth of 21 / 35** — 40% of casts in the current regime.
 *
 * The fix is to read the reader that was already right, not to write a new
 * one: `src/sim/fishingCorpus.ts` takes the MAX of `consumablesUsed` over
 * every board state and got all six known-missed casts exactly. `castTrace`
 * now carries that same number as `consumablesUsedMax`, and
 * `tests/sim/oilCensusAgreement.test.ts` pins the two readers to the same
 * value on every cast in the corpus, so they cannot drift apart again.
 *
 * ⚠ **Turn semantics are deliberately untouched.** Making the item response a
 * turn was option (a) and was NOT chosen — it would break position continuity
 * and drop every oil cast from the movement corpus (`castTrace.ts`'s
 * `ITEM_MESSAGE`).
 */
export function oilsConsumed(t: CastTrace): number {
  return t.consumablesUsedMax;
}

/** Plays in a cast — transitions that resolved a card. */
export function playCount(t: CastTrace): number {
  let n = 0;
  for (let i = 1; i < t.turns.length; i++) if (t.turns[i]!.play) n++;
  return n;
}

/** Focus cells this play moved through, i.e. what it SPENT off the meter. */
function moveSpend(prev: CastTurn, cur: CastTurn): number {
  return manhattan(prev.focusPoint, cur.focusPoint);
}

/**
 * Plays fired at focus budget 0 — the meter empty AND no move made, so the
 * shot came from whichever cell the policy last occupied with no choice about
 * it. The budget is `budgetBefore`, i.e. spent-plus-remaining reconstructed
 * from the transition, never the stale pre-play `focusMeter` (session 81).
 */
export function budgetZeroPlays(t: CastTrace): number {
  let n = 0;
  for (let i = 1; i < t.turns.length; i++) {
    if (!t.turns[i]!.play) continue;
    if (budgetBefore(t.turns[i - 1]!, t.turns[i]!) === 0) n++;
  }
  return n;
}

/**
 * What this cast's budget-0 count WOULD have been with no focus restore at
 * all: the pool is `FOCUS_POOL`, it never refills, and a play is frozen once
 * cumulative spend has reached it.
 *
 * This is the instrument that separates the oil from everything else, and its
 * validity is checkable rather than assumed — run it over the BEFORE era,
 * which fired no oils, and it must reproduce the observed count. It does, at
 * 183 against 184; the single difference is the one before-era cast that
 * opened at `focusMeter` 2 instead of 3.
 */
export function budgetZeroPlaysWithoutRestore(t: CastTrace): number {
  let spent = 0;
  let frozen = 0;
  for (let i = 1; i < t.turns.length; i++) {
    if (!t.turns[i]!.play) continue;
    if (FOCUS_POOL - spent <= 0) frozen++;
    spent += moveSpend(t.turns[i - 1]!, t.turns[i]!);
  }
  return frozen;
}

// ── §1a  THE ERA SPLIT ──────────────────────────────────────────────────────

export interface FocusEraArm {
  era: Era | "all";
  casts: number;
  plays: number;
  budgetZero: number;
  /** `budgetZero / plays`. */
  rate: number;
  /** Mean focus spent on a cast's FIRST play — the proximate mechanism, see §2. */
  meanFirstPlaySpend: number;
  /** Largest first-play spend seen. 3 means some cast emptied the meter before its second play. */
  maxFirstPlaySpend: number;
  meanPlaysPerCast: number;
  /** Casts that ever fired at budget 0 — the frozen-tail incidence. */
  castsEverFrozen: number;
  resolved: number;
  caught: number;
}

/**
 * The §1a table: plays at focus budget 0, one arm per era plus pooled.
 *
 * [session 92] Three arms now. `oilSupplied` is the arm that answers "how does
 * the bot play when the policy can actually fire"; `focusDry` is the same
 * policy starved of Focus Oil, and it reverts most of the way to `preOil`.
 * **Quoting `all` as "the bot today" pools all three and is what §32 was.**
 */
export function focusEraSplit(
  traces: readonly CastTrace[],
  created: ReadonlyMap<string, string>,
): { preOil: FocusEraArm; oilSupplied: FocusEraArm; focusDry: FocusEraArm; all: FocusEraArm } {
  const split = splitByEra(traces, created);
  return {
    preOil: armOf("preOil", split.preOil),
    oilSupplied: armOf("oilSupplied", split.oilSupplied),
    focusDry: armOf("focusDry", split.focusDry),
    all: armOf("all", traces),
  };
}

function armOf(era: Era | "all", ts: readonly CastTrace[]): FocusEraArm {
  let plays = 0;
  let budgetZero = 0;
  let firstSum = 0;
  let firstMax = 0;
  let firstN = 0;
  let castsEverFrozen = 0;
  let resolved = 0;
  let caught = 0;
  for (const t of ts) {
    const n = playCount(t);
    const z = budgetZeroPlays(t);
    plays += n;
    budgetZero += z;
    if (z > 0) castsEverFrozen++;
    if (t.caught || t.escaped) {
      resolved++;
      if (t.caught) caught++;
    }
    for (let i = 1; i < t.turns.length; i++) {
      if (!t.turns[i]!.play) continue;
      const s = moveSpend(t.turns[i - 1]!, t.turns[i]!);
      firstSum += s;
      firstMax = Math.max(firstMax, s);
      firstN++;
      break;
    }
  }
  return {
    era,
    casts: ts.length,
    plays,
    budgetZero,
    rate: plays === 0 ? 0 : budgetZero / plays,
    meanFirstPlaySpend: firstN === 0 ? 0 : firstSum / firstN,
    maxFirstPlaySpend: firstMax,
    meanPlaysPerCast: ts.length === 0 ? 0 : plays / ts.length,
    castsEverFrozen,
    resolved,
    caught,
  };
}

// ── §2  THE DECOMPOSITION ───────────────────────────────────────────────────

export interface EraDecomposition {
  /** Crude before-era rate. */
  beforeRate: number;
  /** Crude today rate. */
  todayRate: number;
  /**
   * Before-era per-cast-length rates applied to today's length mix — what
   * today WOULD have read if only the distribution of cast lengths had
   * changed. Direct standardisation, one stratum per play count.
   */
  standardisedRate: number;
  /**
   * Today's rate with every focus restore removed (`budgetZeroPlaysWithoutRestore`),
   * i.e. today's policy playing today's casts off an un-refilled pool.
   */
  noRestoreRate: number;
  /** `beforeRate - standardisedRate`: the part cast length explains. */
  lengthTerm: number;
  /** `standardisedRate - noRestoreRate`: what is left once length and the oil are held out. */
  pacingTerm: number;
  /** `noRestoreRate - todayRate`: what the focus oil's restores buy. */
  oilTerm: number;
  /** Today plays with no length-matched before-era stratum to standardise against. */
  unmatchedPlays: number;
}

/**
 * The 44.9% -> 1.5% drop, split three ways — [session 84, brief §2 / GATE 2].
 *
 * ## The three terms, and how each one is identified
 *
 *  - **length** — today's casts are shorter (4.36 -> 3.74 plays), and budget 0
 *    is a TAIL state, so a shorter cast meets it less often for free.
 *    Identified by direct standardisation on play count.
 *  - **pacing** — the residual, and the interesting one. Identified on the 41
 *    casts that fired NO oil, where the no-restore counterfactual is exact by
 *    construction: they read 1.7% against a length-standardised before-era
 *    expectation of 27.8%. Its proximate mechanism is the first play — mean
 *    first-play spend fell 1.553 -> 0.852 and today never reaches 3, where 17
 *    of 94 before-era casts emptied the whole meter before their second play.
 *  - **oil** — identified by the within-cast no-restore counterfactual. Strip
 *    the restores from the 13 oil casts and they revert to 47.1%, against a
 *    length-standardised before-era 54.9%; the oil does essentially all the
 *    work on that arm.
 *
 * ## ⚠ Two things this is not
 *
 * **It is not an orthogonal decomposition.** The terms are applied in the order
 * length -> pacing -> oil and each takes the residual of the ones before it, so
 * the pacing/oil split depends on that order. The order-free statement is the
 * one to quote: on the restore-free arm the pacing effect is 27.8% -> 1.7%
 * with no oil involved at all, and on the oil arm the restores move 47.1% ->
 * 1.1%. Both hold whichever way the sequential attribution is run.
 *
 * **It does not name a cause for the pacing term.** The corpus brackets the
 * change to 2026-08-20T18:28:24Z -> 2026-08-21T14:46:17Z, a 20.3-hour gap with
 * no casts, and the only code that landed in it is sessions 61 and 62 — whose
 * `scripts/liveFishing.ts` diff is oil plumbing and touches neither focus nor
 * card selection, with `focusReserveWeight` defaulting to 0 and `costCap`
 * documented inert. It is also not a gear effect: the decks did get bigger
 * (11.4 -> 15.4 cards) and crit-richer (18.5% -> 34.2%), but their intrinsic
 * reach is unchanged (15.3% vs 15.1% of focus/target pairs one card covers)
 * and the era effect survives deck-size matching. **The mechanism is measured
 * and the cause is not identified.** What would settle it is an off-policy
 * replay of the corpus's own decision points through the session-60 and
 * session-62 policies, comparing the focus move each one chooses —
 * `scripts/offPolicyReplay.ts` is the existing instrument for that shape.
 */
export function budgetZeroDecomposition(
  traces: readonly CastTrace[],
  created: ReadonlyMap<string, string>,
): EraDecomposition {
  const split = splitByEra(traces, created);
  const before = armOf("preOil", split.preOil);
  // [session 92] The decomposition explains the IMPROVEMENT, so its second arm
  // is `oilSupplied`, not every post-boundary cast. `focusDry` is the same
  // policy with the consumable exhausted — it is the improvement being
  // WITHDRAWN, and folding it in here would net the two against each other.
  const today = armOf("oilSupplied", split.oilSupplied);

  const { rate: standardisedRate, unmatchedPlays } = standardise(split.preOil, split.oilSupplied);

  let noRestore = 0;
  for (const t of split.oilSupplied) noRestore += budgetZeroPlaysWithoutRestore(t);
  const noRestoreRate = today.plays === 0 ? 0 : noRestore / today.plays;

  return {
    beforeRate: before.rate,
    todayRate: today.rate,
    standardisedRate,
    noRestoreRate,
    lengthTerm: before.rate - standardisedRate,
    pacingTerm: standardisedRate - noRestoreRate,
    oilTerm: noRestoreRate - today.rate,
    unmatchedPlays,
  };
}

/**
 * Direct standardisation: `reference`'s per-play-count budget-0 rates, applied
 * to `target`'s play-count mix. Target plays whose length has no reference
 * stratum are excluded from both numerator and denominator and reported, so a
 * thin stratum cannot silently become a zero.
 */
export function standardise(
  reference: readonly CastTrace[],
  target: readonly CastTrace[],
): { rate: number; expected: number; denominator: number; unmatchedPlays: number } {
  const strata = new Map<number, { plays: number; zero: number }>();
  for (const t of reference) {
    const len = playCount(t);
    const s = strata.get(len) ?? { plays: 0, zero: 0 };
    s.plays += len;
    s.zero += budgetZeroPlays(t);
    strata.set(len, s);
  }
  let expected = 0;
  let denominator = 0;
  let unmatchedPlays = 0;
  for (const t of target) {
    const len = playCount(t);
    const s = strata.get(len);
    if (s === undefined || s.plays === 0) {
      unmatchedPlays += len;
      continue;
    }
    expected += len * (s.zero / s.plays);
    denominator += len;
  }
  return { rate: denominator === 0 ? 0 : expected / denominator, expected, denominator, unmatchedPlays };
}

// ── §3  THE INTERVAL, BECAUSE 15/15 IS NOT 100% ─────────────────────────────

/**
 * Wilson score interval. Here because today's era rescues **15 of 15** dead
 * hands and the point estimate is the one number in this session that must
 * never be quoted alone: 15/15 has a 95% lower bound near 0.78, and the brief
 * says so in its own §1c.
 */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

// ── §4  THE ASSERTIONS ──────────────────────────────────────────────────────

/**
 * The three assumptions the era split rests on, checked rather than trusted:
 *
 *  1. every trace is dated, and `doc.createdAt` is constant within a cast;
 *  2. `focusMeterMax` is `FOCUS_POOL` on every cast, so the no-restore
 *     counterfactual's constant is the game's;
 *  3. the before era fired no oils — which is what makes it the control the
 *     counterfactual is validated against.
 */
export function assertCastEraSound(
  traces: readonly CastTrace[],
  created: ReadonlyMap<string, string>,
): void {
  for (const t of traces) {
    if (!created.has(t.docId)) {
      throw new Error(`castEra: trace ${t.docId} is undated. Every corpus cast carries doc.createdAt.`);
    }
    for (const turn of t.turns) {
      if (turn.focusMeterMax !== FOCUS_POOL) {
        throw new Error(
          `castEra: ${t.docId} turn ${turn.index} has focusMeterMax ${turn.focusMeterMax}, not ${FOCUS_POOL}. ` +
            `The no-restore counterfactual's pool constant is wrong for this corpus — fix the constant, ` +
            `do not adjust the numbers it produces.`,
        );
      }
    }
  }
  const split = splitByEra(traces, created);
  const oiledBefore = split.preOil.filter(firedOil).filter((t) => !PRE_OIL_CONSUMABLE_EXEMPT.has(t.docId));
  if (oiledBefore.length > 0) {
    throw new Error(
      `castEra: ${oiledBefore.length} before-era cast(s) fired an oil (${oiledBefore
        .slice(0, 5)
        .map((t) => t.docId)
        .join(", ")}). The preOil era is the restore-free control the no-restore counterfactual is ` +
        `validated against; it no longer is.`,
    );
  }
}

/**
 * Compare this module's date predicate against `todaysEraCastIds()`'s
 * `matcherWeight` one — session 84 gate 1 asks for the comparison to be stated
 * either way rather than for one to be assumed.
 *
 * Takes the other predicate's cast ids as an argument rather than reading
 * `data/ringPrediction.jsonl` itself, because that path is gitignored and a
 * fresh clone has none: the caller decides whether the file is there, and this
 * stays pure.
 */
export function compareEraPredicates(
  traces: readonly CastTrace[],
  created: ReadonlyMap<string, string>,
  otherEraCastIds: ReadonlySet<string>,
): { agree: boolean; dateOnly: string[]; otherOnly: string[]; otherOnlyPlays: number; otherOnlyBudgetZero: number } {
  const byId = new Map(traces.map((t) => [t.docId, t]));
  // [session 92] The matcherWeight comparison is about the FIRST boundary only,
  // so the date arm is "not preOil" — both post-boundary eras. Keying it on
  // `=== "oilSupplied"` would silently move 22 focusDry casts into the
  // disagreement set and break a comparison that has nothing to do with them.
  const dateEra = new Set(traces.filter((t) => eraOf(t.docId, created) !== "preOil").map((t) => t.docId));
  const other = new Set([...otherEraCastIds].filter((d) => byId.has(d)));
  const dateOnly = [...dateEra].filter((d) => !other.has(d)).sort();
  const otherOnly = [...other].filter((d) => !dateEra.has(d)).sort();
  let otherOnlyPlays = 0;
  let otherOnlyBudgetZero = 0;
  for (const d of otherOnly) {
    const t = byId.get(d)!;
    otherOnlyPlays += playCount(t);
    otherOnlyBudgetZero += budgetZeroPlays(t);
  }
  return { agree: dateOnly.length === 0 && otherOnly.length === 0, dateOnly, otherOnly, otherOnlyPlays, otherOnlyBudgetZero };
}

// ── §5  THE GEAR CONTROL ────────────────────────────────────────────────────

/**
 * A deck's INTRINSIC reach: over every (focus cell, target cell) pair on the
 * grid, the fraction one uniformly-drawn distinct card of the deck covers.
 *
 * Policy-free and fish-free by construction — it uses no hand, no focus point,
 * no meter and no fish position — which is exactly what makes it the control
 * for "did the focus budget improve because the DECK got better". On the
 * corpus the answer is no: 15.0% before against 15.2% today, while the decks
 * grew from 11.4 to 15.4 cards and from 18.5% to 34.2% crit-bearing. The gear
 * changed a great deal and its reach did not.
 */
export function deckIntrinsicReach(t: CastTrace): number {
  const first = t.turns[0];
  if (!first) return 0;
  const g = first.gridSize;
  let covered = 0;
  let total = 0;
  for (const id of new Set(first.fullDeck)) {
    const card = t.cards.get(id);
    if (!card) continue;
    for (let fx = 1; fx <= g; fx++) {
      for (let fy = 1; fy <= g; fy++) {
        for (let x = 1; x <= g; x++) {
          for (let y = 1; y <= g; y++) {
            total++;
            if (cardCovers({ x: fx, y: fy }, card, { x, y }, g)) covered++;
          }
        }
      }
    }
  }
  return total === 0 ? 0 : covered / total;
}

/** Distinct deck cards bearing at least one crit zone, as a fraction of the deck. */
export function deckCritFraction(t: CastTrace): number {
  const first = t.turns[0];
  if (!first) return 0;
  const ids = [...new Set(first.fullDeck)].filter((id) => t.cards.has(id));
  if (ids.length === 0) return 0;
  return ids.filter((id) => t.cards.get(id)!.critZones.length > 0).length / ids.length;
}

// ── §6  THE OVERSPEND CONTROL ───────────────────────────────────────────────

/**
 * [session 85 §1 / GATE 1] **The bot stopped OVERSHOOTING; the target never
 * moved.**
 *
 * Session 84 named the proximate mechanism of the 44.9% -> 1.5% collapse as
 * mean first-play focus spend falling 1.553 -> 0.852. That is one number and
 * it does not separate two very different stories: *the fish got easier to
 * reach* from *the bot aimed more cheaply*. This is the second half.
 *
 * For each cast's OPENING play, three quantities measured the same way in both
 * eras:
 *
 *  - **actual** — `manhattan(prev.focusPoint, cur.focusPoint)`, what the bot
 *    spent. Identical to `FocusEraArm.meanFirstPlaySpend`'s per-cast term, and
 *    it must reproduce it.
 *  - **optimal** — the SMALLEST move distance from the opening focus at which
 *    some card in the HELD hand covers the cell the fish actually resolved on.
 *    The cheapest move that could have worked.
 *  - **overspend** — actual minus optimal.
 *
 * `optimal` is ORACLE-LENSED: it uses `cur.fishPosition`, which no policy knows
 * at decision time. That is deliberate and it is why it is a CONTROL and not a
 * policy — it is applied identically to both eras, so the *comparison* is
 * sound even though neither arm's level is achievable. Same posture as
 * `matcherHeadroom.ts`'s oracles: a ceiling to score against, never a target.
 *
 * The measured answer, on the corpus as committed:
 *
 * ```
 *                 casts  hand footprint  actual  optimal  OVERSPEND
 *   preOil           94      7.38 cells   1.553    0.656      +0.90
 *   oilSupplied      62      7.19 cells   0.807    0.645      +0.16
 *   focusDry         32      7.09 cells   0.906    0.625      +0.28
 * ```
 *
 * **The optimal move is unchanged across all three eras** — 0.656 / 0.645 /
 * 0.625 — and so is its whole distribution. What collapsed is the overspend.
 *
 * This closes three doors at once, which is more than intrinsic reach did:
 * the targets did not get closer, the hands did not get wider (7.38 vs 7.20
 * cells), and the opening focus point is pinned at (2,2) by
 * `assertOpeningFocusPinned`. Whatever changed, it changed how far the bot
 * CHOOSES to move — nothing about what it was moving toward.
 *
 * ## ⚠ [session 92] HOW "unchanged" MAY AND MAY NOT BE TESTED
 *
 * This premise used to be pinned as `|preOil.meanOptimal − today.meanOptimal|
 * < 0.01`, and §32 opened because that assertion went red (0.0062 -> 0.0250).
 * **The assertion was the defect, not the premise, and re-specifying the era
 * predicate does not fix it** — on the corrected split the gap is 0.0108,
 * which still fails a 0.01 bound.
 *
 * `optimal` is a per-cast integer in {0, 1, 2} with a standard deviation of
 * about 0.66. At n≈94 and n≈62 the standard error of each arm's mean is ~0.07
 * to ~0.09, so **the standard error of the DIFFERENCE is ~0.11**. A 0.01 bound
 * is one tenth of one standard error: it asserts agreement roughly twenty
 * times finer than this corpus can resolve. Session 89's 0.0062 reading was
 * therefore not evidence of anything — it was a coincidence with a ~7% chance
 * of landing that small — and calling it "the single most important thing in
 * the file that did NOT move" over-read it. It was always going to break.
 *
 * The premise itself is in excellent shape, and holds pairwise across all
 * three eras rather than merely across two:
 *
 * ```
 *   comparison                  gap     SE(diff)   gap/SE   verdict
 *   preOil vs oilSupplied    0.0108      0.1120     0.10    indistinguishable
 *   preOil vs focusDry       0.0650      0.1428     0.46    indistinguishable
 *   oilSupplied vs focusDry  0.0543      0.1543     0.35    indistinguishable
 * ```
 *
 * So the test is stated at the resolution the data has: the gap must sit
 * inside the 95% interval around zero (|gap| < 1.96·SE). **That is NOT a
 * widened bound, and the distinction is the whole point.** A widened bound is
 * a constant chosen after the fact to admit the reading you got; this one is
 * derived from the corpus's own dispersion, TIGHTENS automatically as the
 * corpus grows, and still fails loudly if difficulty genuinely diverges — a
 * half-move shift would land at gap/SE ≈ 2.7 and go red. What the syllogism
 * needs is also asserted directly and separately: the overspend gap must
 * DWARF the optimal gap (0.736 against 0.011, a factor of ~68), because that
 * ratio is the actual claim — "the difference is overspend, not difficulty".
 *
 * ⚠ **It still does not name the cause.** Rule 6. See `openingOverspendByDay`.
 */
export interface OverspendRow {
  docId: string;
  era: Era;
  /** `YYYY-MM-DD` off `doc.createdAt`, for the daily series. */
  day: string;
  /** Move distance the bot actually spent on its first play. */
  actual: number;
  /**
   * Cheapest move distance at which the held hand covers the resolution cell,
   * or `null` when NO focus placement on the grid does. Null on exactly one
   * corpus cast — see `assertOpeningFocusPinned` for why it is the same cast
   * that fails the (2,2) pin, and why both have one cause.
   */
  optimal: number | null;
  /** Distinct grid cells the held hand covers fired from the OPENING focus point. */
  handFootprint: number;
  /** `budgetBefore(prev, cur)` — reconstructed, never the stale pre-play meter. */
  budget: number;
}

/**
 * The opening-play row for one cast, or `null` when the cast records no play.
 *
 * The "first play" predicate is the FIRST turn bearing a `play`, matching
 * `armOf`'s exactly so `meanActual` below reproduces
 * `FocusEraArm.meanFirstPlaySpend` rather than merely resembling it.
 */
export function openingOverspend(
  t: CastTrace,
  created: ReadonlyMap<string, string>,
): OverspendRow | null {
  let i = -1;
  for (let k = 1; k < t.turns.length; k++) {
    if (t.turns[k]!.play) {
      i = k;
      break;
    }
  }
  if (i < 0) return null;
  const prev = t.turns[i - 1]!;
  const cur = t.turns[i]!;
  const grid = cur.gridSize;
  const target = cur.fishPosition;
  const hand = prev.hand.map((id) => t.cards.get(id)).filter((c): c is TraceCard => c !== undefined);

  const footprint = new Set<string>();
  for (const card of hand) {
    for (const c of zonesToCells(prev.focusPoint, card.hitZones, grid)) footprint.add(cellKey(c));
    for (const c of zonesToCells(prev.focusPoint, card.critZones, grid)) footprint.add(cellKey(c));
  }

  let optimal: number | null = null;
  for (const f of allCells(grid)) {
    if (!hand.some((card) => cardCovers(f, card, target, grid))) continue;
    const d = manhattan(prev.focusPoint, f);
    if (optimal === null || d < optimal) optimal = d;
  }

  return {
    docId: t.docId,
    era: eraOf(t.docId, created),
    day: (created.get(t.docId) ?? "").slice(0, 10),
    actual: manhattan(prev.focusPoint, cur.focusPoint),
    optimal,
    handFootprint: footprint.size,
    budget: budgetBefore(prev, cur),
  };
}

export interface OverspendArm {
  era: Era | "all";
  casts: number;
  /** Casts with a covering focus somewhere on the grid — the denominator for `meanOptimal`. */
  scored: number;
  meanHandFootprint: number;
  /** Reproduces `FocusEraArm.meanFirstPlaySpend`. Over ALL casts, not just scored ones. */
  meanActual: number;
  meanOptimal: number;
  /**
   * [session 92] Sample standard deviation of `optimal` over the scored rows.
   * Carried because `meanOptimalGap` needs it: the era-difficulty premise has
   * to be tested against this corpus's own dispersion, never a fixed literal.
   * `NaN` when fewer than two rows are scored.
   */
  optimalSd: number;
  /** `meanActual - meanOptimal`. */
  overspend: number;
  /** Counts of `optimal`, keyed by distance. The distributions, not just their means. */
  optimalHistogram: ReadonlyMap<number, number>;
  actualHistogram: ReadonlyMap<number, number>;
}

function overspendArmOf(era: Era | "all", rows: readonly OverspendRow[]): OverspendArm {
  const scored = rows.filter((r) => r.optimal !== null);
  const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const hist = (xs: readonly number[]): Map<number, number> => {
    const m = new Map<number, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const meanActual = mean(rows.map((r) => r.actual));
  const meanOptimal = mean(scored.map((r) => r.optimal!));
  const sd = (xs: readonly number[]): number => {
    if (xs.length < 2) return Number.NaN;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
  };
  return {
    era,
    casts: rows.length,
    scored: scored.length,
    optimalSd: sd(scored.map((r) => r.optimal!)),
    meanHandFootprint: mean(rows.map((r) => r.handFootprint)),
    meanActual,
    meanOptimal,
    overspend: meanActual - meanOptimal,
    optimalHistogram: hist(scored.map((r) => r.optimal!)),
    actualHistogram: hist(rows.map((r) => r.actual)),
  };
}

/** The §1 table: opening overspend, before / today / pooled. */
export function openingOverspendSplit(
  traces: readonly CastTrace[],
  created: ReadonlyMap<string, string>,
): {
  rows: OverspendRow[];
  preOil: OverspendArm;
  oilSupplied: OverspendArm;
  focusDry: OverspendArm;
  all: OverspendArm;
} {
  const rows = traces
    .map((t) => openingOverspend(t, created))
    .filter((r): r is OverspendRow => r !== null);
  return {
    rows,
    preOil: overspendArmOf("preOil", rows.filter((r) => r.era === "preOil")),
    oilSupplied: overspendArmOf("oilSupplied", rows.filter((r) => r.era === "oilSupplied")),
    focusDry: overspendArmOf("focusDry", rows.filter((r) => r.era === "focusDry")),
    all: overspendArmOf("all", rows),
  };
}

/**
 * [session 92] The `meanOptimal` comparison between two overspend arms, stated
 * at the resolution the corpus actually has.
 *
 * Returns the gap, the standard error of that gap, and `indistinguishable` —
 * `|gap| < z·SE`. See `openingOverspendSplit`'s header for why a fixed 0.01
 * bound was the wrong instrument and why this is not merely a wider one: the
 * threshold here is derived from the arms' own dispersion, so it tightens as
 * the corpus grows instead of being re-chosen whenever it goes red.
 *
 * ⚠ **`optimalSd` is the sample sd of the SCORED rows**, so an arm with fewer
 * than two scored casts has no defined error and this throws rather than
 * returning a comparison that cannot mean anything.
 */
export function meanOptimalGap(
  a: OverspendArm,
  b: OverspendArm,
  z = 1.96,
): { gap: number; se: number; ratio: number; halfWidth: number; indistinguishable: boolean } {
  for (const arm of [a, b]) {
    if (arm.scored < 2) {
      throw new Error(
        `castEra: arm ${arm.era} has ${arm.scored} scored cast(s); a mean-optimal gap needs at least 2 ` +
          `to have a standard error at all. Do not compare it — say the arm is too thin.`,
      );
    }
  }
  const se = Math.sqrt(a.optimalSd ** 2 / a.scored + b.optimalSd ** 2 / b.scored);
  const gap = Math.abs(a.meanOptimal - b.meanOptimal);
  const halfWidth = z * se;
  return { gap, se, ratio: se === 0 ? Number.POSITIVE_INFINITY : gap / se, halfWidth, indistinguishable: gap < halfWidth };
}

/**
 * [session 85 §1a] The overspend by calendar day — **and the reason this is
 * reported rather than merely computed.**
 *
 * If the cause of the collapse were a learned model sharpening as the mined
 * corpus grew, overspend should DECLINE GRADUALLY. It does not. It STEPS:
 *
 * ```
 *   08-15 +1.00 (n=5)    08-19 +0.84 (n=38)   08-22 +0.25 (n=16)
 *   08-16 +0.80 (n=5)    08-20 -0.40 (n=5)    08-23 +0.50 (n=8)
 *   08-17 +1.15 (n=40)   08-21 +0.10 (n=30)
 *   08-18  n=1, unscored
 * ```
 *
 * and inside today's era it drifts back UP (+0.10 -> +0.25 -> +0.50) rather
 * than continuing down, which is what a still-improving model would do. That
 * argues against the learned state (`data/opponent-model.json`,
 * `data/minedFishPatterns.json`) and FOR a discrete change.
 *
 * ⚠ **AND IT IS WHY THE 20.3-HOUR GAP IS NOT A CLEAN BRACKET.** `castEra.ts`'s
 * header calls the boundary a bracket rather than a moment, and the daily
 * series says something sharper: **the five 08-20 casts already read -0.40,
 * i.e. the NEW regime, and they are stamped BEFORE sessions 61/62's commits**
 * (11:27 PT against 13:33 and 15:59 PT). At n=5 that is not evidence. But it
 * means the corpus **cannot date the change more precisely than "between 08-19
 * and 08-21"**, and the 61/62 window is not as clean as the empty gap makes it
 * look. Session 84's open question 1 proposes replaying those two commits'
 * policies; **say this before spending a session on it** — the commits may sit
 * on the wrong side of the change they are being asked to explain.
 */
export function openingOverspendByDay(
  rows: readonly OverspendRow[],
): { day: string; n: number; scored: number; meanActual: number; meanOptimal: number; overspend: number }[] {
  const days = [...new Set(rows.map((r) => r.day))].sort();
  return days.map((day) => {
    const all = rows.filter((r) => r.day === day);
    const scored = all.filter((r) => r.optimal !== null);
    const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
    const meanActual = mean(all.map((r) => r.actual));
    const meanOptimal = mean(scored.map((r) => r.optimal!));
    return {
      day,
      n: all.length,
      scored: scored.length,
      meanActual,
      meanOptimal,
      overspend: scored.length === 0 ? Number.NaN : meanActual - meanOptimal,
    };
  });
}

/**
 * The whole overspend control rests on both eras opening from the SAME focus
 * cell — if they did not, "optimal move distance" would be measured from two
 * different origins and the comparison would be meaningless. So it is pinned
 * rather than assumed.
 *
 * **The honest form of the claim is 147 of 147, not 147 of 148.** Every trace
 * with a recorded `start_run` opens at (2,2) with a full `focusMeter` of 3 —
 * no exceptions, both eras. The 148th trace (`12975152`) has `hasStart` false:
 * its turn 0 is a MID-CAST RESUME, already bearing a `play`, with the meter at
 * 2 and the hand down to a single card. It is not a counterexample to "casts
 * open at (2,2)"; its opening was simply never recorded.
 *
 * That same cast is also the ONLY one in the corpus with no covering focus for
 * its first play — a one-card hand cannot cover the fish wherever it went. Two
 * apparent anomalies, one cause, and worth stating because a reader who meets
 * them separately will look for two explanations.
 */
export function assertOpeningFocusPinned(traces: readonly CastTrace[]): void {
  const recorded = traces.filter((t) => t.hasStart);
  for (const t of recorded) {
    const first = t.turns[0];
    if (!first) throw new Error(`castEra: ${t.docId} claims hasStart but has no turns.`);
    if (first.focusPoint.x !== 2 || first.focusPoint.y !== 2) {
      throw new Error(
        `castEra: ${t.docId} opens at (${first.focusPoint.x},${first.focusPoint.y}), not (2,2). ` +
          `The overspend control measures optimal move DISTANCE from the opening focus and is only ` +
          `era-comparable while that origin is shared — re-derive the control, do not rebase the numbers.`,
      );
    }
    if (first.focusMeter !== FOCUS_POOL) {
      throw new Error(
        `castEra: ${t.docId} opens at focusMeter ${first.focusMeter}, not ${FOCUS_POOL}.`,
      );
    }
  }
}
