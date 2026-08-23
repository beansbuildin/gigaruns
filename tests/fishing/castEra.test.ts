/**
 * tests/fishing/castEra.test.ts — [session 84, brief §3 / GATE 1 + GATE 2]
 *
 * Pins the policy-era split, the era-conditioned redraw counterfactual, and
 * the three-way decomposition of the focus-budget collapse.
 *
 * ## Why the era predicate is pinned before anything that uses it
 *
 * The same reason session 83 pinned the triple reconstruction separately: if
 * the predicate drifts, everything downstream shows up as a number that moved
 * a little, and a number that moved a little is the kind of change nobody
 * investigates. Here the predicate is also the SUBJECT of the session — the
 * finding is that pooling the eras was wrong — so it gets asserted from both
 * ends: the cast counts, and the fact that it disagrees with the other
 * candidate predicate in a specific, measured way.
 *
 * ## ⚠ Where this disagrees with the session-84 brief, and it is the same
 * shape as session 83's
 *
 * The brief counts **404 / 201 / 605** plays and **178 / 3 / 181** at focus
 * budget 0. This measures **410 / 202 / 612** and **184 / 3 / 187**. The CAST
 * counts agree exactly (94 / 54), 612 is STATE.md's own documented corpus
 * figure, and six play predicates were tried (clean traces, `hasStart`,
 * `continuous`, next-turn-exists, the stale pre-play meter) without landing on
 * 605. CLAUDE.md rule 9: the corpus wins.
 *
 * What DOES reproduce cell for cell is the half the session turns on —
 * **today's era: 127 / 109 / 3 / 15 / 0**, dead 15, cost 1.33, 88.2% ->
 * 97.6%. So session 83's unexplained 389-vs-387 residual lives entirely in the
 * BEFORE arm and does not touch the conclusion.
 *
 * Reads committed fixtures only. Writes nothing, touches no `data/` or `logs/`
 * path, makes no network call — in particular it does NOT read
 * `data/ringPrediction.jsonl`, which is gitignored and absent from a fresh
 * clone; the predicate comparison is expressed as a pure function taking the
 * other predicate's ids so this file stays portable.
 */
import { describe, expect, it } from "vitest";

import { loadCastTraces } from "../../src/sim/fishing/castTrace.js";
import {
  assertCastEraSound,
  budgetZeroDecomposition,
  budgetZeroPlays,
  budgetZeroPlaysWithoutRestore,
  compareEraPredicates,
  deckCritFraction,
  deckIntrinsicReach,
  eraOf,
  firedOil,
  focusEraSplit,
  loadCastCreatedAt,
  oilsConsumed,
  playCount,
  POLICY_ERA_BOUNDARY,
  splitByEra,
  standardise,
  wilson,
  FOCUS_POOL,
} from "../../src/sim/fishing/castEra.js";
import {
  assertRedrawCounterfactualSound,
  redrawCounterfactual,
  separability,
} from "../../src/sim/fishing/redrawCounterfactual.js";

const traces = loadCastTraces();
const created = loadCastCreatedAt();
const split = splitByEra(traces, created);

describe("the era predicate itself", () => {
  it("dates every cast off committed fixtures", () => {
    expect(traces.length).toBe(148);
    expect(created.size).toBe(148);
    for (const t of traces) expect(created.has(t.docId)).toBe(true);
  });

  it("splits 94 before / 54 today at the boundary — the one figure the brief and the corpus agree on", () => {
    expect(POLICY_ERA_BOUNDARY).toBe("2026-08-21");
    expect(split.before.length).toBe(94);
    expect(split.today.length).toBe(54);
  });

  it("passes its own soundness assertions", () => {
    expect(() => assertCastEraSound(traces, created)).not.toThrow();
  });

  it("refuses to default an undated cast rather than binning it as 'before'", () => {
    expect(() => eraOf("nope", new Map())).toThrow(/no doc.createdAt/);
  });

  it("holds focusMeterMax at FOCUS_POOL on every turn of both eras, which the counterfactual depends on", () => {
    expect(FOCUS_POOL).toBe(3);
    for (const t of traces) for (const turn of t.turns) expect(turn.focusMeterMax).toBe(FOCUS_POOL);
  });

  it("is bracketed by a 20-hour gap, so the exact date literal inside it does not matter", () => {
    const stamps = [...created.values()].sort();
    const lastBefore = stamps.filter((s) => s.slice(0, 10) < POLICY_ERA_BOUNDARY).at(-1);
    const firstToday = stamps.find((s) => s.slice(0, 10) >= POLICY_ERA_BOUNDARY);
    expect(lastBefore).toBe("2026-08-20T18:28:24.964Z");
    expect(firstToday).toBe("2026-08-21T14:46:17.309Z");
  });
});

describe("todaysEraCastIds() names a DIFFERENT boundary, and the difference was measured", () => {
  // The five casts stamped 2026-08-20T18:27-18:28Z: after the matcher-weighting
  // boundary the repo dates at 2026-08-20T18:27Z, before the oil-policy date.
  // `todaysEraCastIds()` calls them today's era; the date predicate does not.
  const MATCHER_WEIGHT_ONLY = ["13004295", "13004301", "13004305", "13004306", "13004315"];

  it("disagrees on exactly those five casts and on nothing else", () => {
    const other = new Set([...split.today.map((t) => t.docId), ...MATCHER_WEIGHT_ONLY]);
    const cmp = compareEraPredicates(traces, created, other);
    expect(cmp.agree).toBe(false);
    expect(cmp.dateOnly).toEqual([]);
    expect(cmp.otherOnly).toEqual(MATCHER_WEIGHT_ONLY);
  });

  it("and those five read the OLD regime, which is why the date predicate wins", () => {
    const other = new Set([...split.today.map((t) => t.docId), ...MATCHER_WEIGHT_ONLY]);
    const cmp = compareEraPredicates(traces, created, other);
    expect(cmp.otherOnlyPlays).toBe(19);
    expect(cmp.otherOnlyBudgetZero).toBe(7);
    // 36.8% — folding them into today's era would take it from 1.5% to 4.5%.
    expect(cmp.otherOnlyBudgetZero / cmp.otherOnlyPlays).toBeCloseTo(0.368, 3);
  });

  it("reports agreement honestly when the two predicates DO agree", () => {
    const cmp = compareEraPredicates(traces, created, new Set(split.today.map((t) => t.docId)));
    expect(cmp.agree).toBe(true);
    expect(cmp.otherOnlyPlays).toBe(0);
  });
});

describe("GATE 1a — the focus-budget era split", () => {
  const s = focusEraSplit(traces, created);

  it("reads 44.9% before / 1.5% today / 30.6% pooled", () => {
    expect([s.before.casts, s.before.plays, s.before.budgetZero]).toEqual([94, 410, 184]);
    expect([s.today.casts, s.today.plays, s.today.budgetZero]).toEqual([54, 202, 3]);
    expect([s.all.casts, s.all.plays, s.all.budgetZero]).toEqual([148, 612, 187]);
    expect(s.before.rate).toBeCloseTo(0.449, 3);
    expect(s.today.rate).toBeCloseTo(0.0149, 3);
    expect(s.all.rate).toBeCloseTo(0.306, 3);
  });

  it("is a THIRTYFOLD drop, which is the claim the finding rests on", () => {
    expect(s.before.rate / s.today.rate).toBeGreaterThan(28);
  });

  it("names the proximate mechanism: the first play stopped emptying the meter", () => {
    expect(s.before.meanFirstPlaySpend).toBeCloseTo(1.553, 3);
    expect(s.today.meanFirstPlaySpend).toBeCloseTo(0.852, 3);
    // 17 of 94 before-era casts spent the whole 3-point pool on play 1. Today: never.
    expect(s.before.maxFirstPlaySpend).toBe(3);
    expect(s.today.maxFirstPlaySpend).toBe(2);
  });

  it("shows the frozen tail is a CAST-level incidence, not a per-play one", () => {
    expect(s.before.castsEverFrozen).toBe(56);
    expect(s.today.castsEverFrozen).toBe(2);
  });

  it("records the catch rate that moved with it — 15.1% -> 63.0%, nowhere else written down", () => {
    expect([s.before.resolved, s.before.caught]).toEqual([93, 14]);
    expect([s.today.resolved, s.today.caught]).toEqual([54, 34]);
  });
});

describe("GATE 1b — the redraw counterfactual, conditioned on the era", () => {
  it("reproduces the session-84 brief CELL FOR CELL on today's era", () => {
    const r = redrawCounterfactual(split.today);
    assertRedrawCounterfactualSound(r);
    expect(r.plays).toBe(127);
    expect(r.bothReach).toBe(109);
    expect(r.sacrifice).toBe(3);
    expect(r.rescue).toBe(15);
    expect(r.meanRescueCost).toBeCloseTo(1.33, 2);
    expect(r.actualAvailability).toBeCloseTo(0.882, 3);
    expect(r.redrawAvailability).toBeCloseTo(0.976, 3);
  });

  it("pins `neither = 0` in today's era — the structural claim, not a statistical one", () => {
    expect(redrawCounterfactual(split.today).neitherReaches).toBe(0);
  });

  it("puts session 83's unexplained residual ENTIRELY in the before arm", () => {
    const before = redrawCounterfactual(split.before);
    const today = redrawCounterfactual(split.today);
    const pooled = redrawCounterfactual(traces);
    // The arms partition the pooled table, so the before arm carries the whole
    // 389-vs-387 gap the session-83 brief could not explain.
    expect(before.plays + today.plays).toBe(pooled.plays);
    expect(before.plays).toBe(262);
    expect(before.neitherReaches).toBe(56);
    expect(pooled.neitherReaches).toBe(56);
  });

  it("reports the rescue rate as an INTERVAL, because 15/15 is not 100%", () => {
    const r = redrawCounterfactual(split.today);
    const dead = r.rescue + r.neitherReaches;
    expect(dead).toBe(15);
    const [lo, hi] = wilson(r.rescue, dead);
    expect(lo).toBeGreaterThan(0.78);
    expect(lo).toBeLessThan(0.80);
    expect(hi).toBe(1);
  });

  it("wilson degrades sanely at the edges", () => {
    expect(wilson(0, 0)).toEqual([0, 1]);
    const [lo, hi] = wilson(1, 2);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeLessThan(1);
  });
});

describe("GATE 2 — the collapse, decomposed", () => {
  const d = budgetZeroDecomposition(traces, created);

  it("splits into three terms that sum to the observed drop", () => {
    expect(d.beforeRate).toBeCloseTo(0.449, 3);
    expect(d.standardisedRate).toBeCloseTo(0.395, 3);
    expect(d.noRestoreRate).toBeCloseTo(0.213, 3);
    expect(d.todayRate).toBeCloseTo(0.0149, 3);
    expect(d.lengthTerm + d.pacingTerm + d.oilTerm).toBeCloseTo(d.beforeRate - d.todayRate, 10);
  });

  it("says cast length explains only ~5pp of ~43pp — the drop is WITHIN length", () => {
    expect(d.lengthTerm).toBeCloseTo(0.054, 3);
    expect(d.lengthTerm).toBeLessThan(0.15 * (d.beforeRate - d.todayRate));
  });

  it("standardises every today play — no stratum silently becomes a zero", () => {
    expect(d.unmatchedPlays).toBe(0);
  });

  it("validates the no-restore counterfactual on the before era, which fired no oils", () => {
    const cf = split.before.reduce((s, t) => s + budgetZeroPlaysWithoutRestore(t), 0);
    const obs = split.before.reduce((s, t) => s + budgetZeroPlays(t), 0);
    expect(obs).toBe(184);
    expect(cf).toBe(183);
    // The one difference is the single before-era cast that opened at focusMeter 2
    // rather than 3 — a real feature of the corpus, not slack in the method.
    expect(split.before.filter((t) => t.turns[0]!.focusMeter !== FOCUS_POOL).length).toBe(1);
  });

  it("isolates the PACING term on the 41 restore-free casts, where the oil cannot be the cause", () => {
    const noOil = split.today.filter((t) => !firedOil(t));
    expect(noOil.length).toBe(41);
    const plays = noOil.reduce((s, t) => s + playCount(t), 0);
    const zero = noOil.reduce((s, t) => s + budgetZeroPlays(t), 0);
    expect([plays, zero]).toEqual([115, 2]);
    expect(standardise(split.before, noOil).rate).toBeCloseTo(0.278, 3);
    // No restore ever fired here, so the counterfactual equals the observation.
    // That is the self-check; the result is the gap to 27.8%.
    expect(noOil.reduce((s, t) => s + budgetZeroPlaysWithoutRestore(t), 0)).toBe(zero);
  });

  it("isolates the OIL term on the 13 oil casts, which revert to the old regime without it", () => {
    const oiled = split.today.filter(firedOil);
    expect(oiled.length).toBe(13);
    expect(oiled.reduce((s, t) => s + oilsConsumed(t), 0)).toBe(21);
    const plays = oiled.reduce((s, t) => s + playCount(t), 0);
    const zero = oiled.reduce((s, t) => s + budgetZeroPlays(t), 0);
    const cf = oiled.reduce((s, t) => s + budgetZeroPlaysWithoutRestore(t), 0);
    expect([plays, zero, cf]).toEqual([87, 1, 41]);
    // 47.1% stripped, against a before-era length-standardised 54.9%.
    expect(cf / plays).toBeCloseTo(0.471, 3);
    expect(standardise(split.before, oiled).rate).toBeCloseTo(0.549, 3);
  });

  it("detects oils on consumablesUsed, NOT on the focus meter — they give different answers", () => {
    // castTrace.ts skips the `use_fishing_item` response, so a meter jump seen
    // across two real turns is `restore minus the move spent on the same
    // transition`. Detecting on the meter finds 11 casts; the truth is 13.
    const meterDetected = traces.filter((t) => {
      for (let i = 1; i < t.turns.length; i++) if (t.turns[i]!.focusMeter > t.turns[i - 1]!.focusMeter) return true;
      return false;
    });
    expect(meterDetected.length).toBe(11);
    expect(traces.filter(firedOil).length).toBe(13);
  });

  it("rules the GEAR out: the decks changed a great deal and their reach did not", () => {
    const reach = (ts: readonly import("../../src/sim/fishing/castTrace.js").CastTrace[]) =>
      ts.reduce((s, t) => s + deckIntrinsicReach(t), 0) / ts.length;
    const crit = (ts: readonly import("../../src/sim/fishing/castTrace.js").CastTrace[]) =>
      ts.reduce((s, t) => s + deckCritFraction(t), 0) / ts.length;
    expect(reach(split.before)).toBeCloseTo(0.153, 3);
    expect(reach(split.today)).toBeCloseTo(0.151, 3);
    expect(Math.abs(reach(split.before) - reach(split.today))).toBeLessThan(0.01);
    // Meanwhile the decks really did change, which is what makes the null informative.
    expect(crit(split.before)).toBeCloseTo(0.185, 3);
    expect(crit(split.today)).toBeCloseTo(0.342, 3);
  });

  it("fires the before-era-is-oil-free assertion if that control ever stops holding", () => {
    const fake = new Map(created);
    // Re-date one oil cast into the before era: the control is now contaminated.
    const oiled = split.today.find(firedOil)!;
    fake.set(oiled.docId, "2026-08-19T00:00:00.000Z");
    expect(() => assertCastEraSound(traces, fake)).toThrow(/before-era cast\(s\) fired an oil/);
  });
});

/**
 * Not part of either gate — the brief's "do if there is room" item. It is
 * pinned anyway because it is the input QUESTIONS.md §26's shadow design rests
 * on, and an unpinned input to a design decision is how the +19.40pp figure
 * happened.
 */
describe("§3's heldCoverage signal, re-run per era", () => {
  it("SURVIVES the split — the dead hands changed, the separation did not", () => {
    const pooled = separability(redrawCounterfactual(traces));
    const today = separability(redrawCounterfactual(split.today));
    expect(pooled.coverageAuc).toBeCloseTo(0.922, 3);
    expect(today.coverageAuc).toBeCloseTo(0.907, 3);
    // The dead hands today are a DIFFERENT population, not a smaller version of
    // the old one: their mean coverage nearly doubles once the budget-0 hands
    // (which could barely cover anything, being frozen on one cell) are gone.
    expect(pooled.meanCoverageDead).toBeCloseTo(5.13, 2);
    expect(today.meanCoverageDead).toBeCloseTo(8.87, 2);
    expect(today.deadPlays).toBe(15);
    expect(today.livePlays).toBe(112);
  });

  it("makes `wasted` structurally zero at every threshold, because neither = 0", () => {
    const today = separability(redrawCounterfactual(split.today));
    for (const row of today.sweep) expect(row.wasted).toBe(0);
    // So the only trade a threshold makes is rescues against sacrifices — which
    // is what turns the trigger's job from selection into detection.
    const k7 = today.sweep.find((r) => r.threshold === 7)!;
    expect([k7.fires, k7.rescues, k7.sacrifices, k7.manaSpent]).toEqual([9, 7, 0, 11]);
  });
});
