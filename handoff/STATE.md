# STATE — session 45 — 2026-08-18 — commit 1c86561

## Status
Task 11 (fishing half), session-45 brief §1: **GATE PASS.**
Brief §2/§3/§5/§6 all delivered; **§4 REFUTED** (the brief's claim does not
reproduce — see below). Next per TASKS.md: a real live batch under the ring
model, 20-30 casts, which is the only remaining question the corpus cannot
answer by itself.

Overall: the fish's movement rule is now largely solved. It walks a
Manhattan-`k` ring (`k ∈ {1,2}`, fixed per cast) with **zero counterexamples in
279 clean transitions**, and within a class its next move is strongly
conditioned on its previous one in **opposite directions per class**. Every
predictor this project shipped before today was class-blind, so it put
probability mass on cells the fish provably could not reach, and `chooseCard`
consumes the whole distribution. A class-aware ring model beat the shipped
predictor on leave-one-cast-out log loss 1.118 vs 3.536 and top-1 46.4% vs
42.7%, and is now live-wired and default-on.

## What works
- **`src/strategy/fishing/stepClass.ts`** — the ring model. Gate verified twice:
  once at 66 clean casts, again at 68 after this session's live batch.
  `scripts/fishingRingCV.ts` re-runs it. SPEC-fishing.md §9.
- **`scripts/auditStepClass.ts`** — re-derives FACTS 1/2/3 from
  `data/fish-patterns.jsonl` + `cards.json`. Re-runnable as the corpus grows;
  prints the brief's claimed number beside every measured one.
- **`src/sim/fishing/empiricalFish.ts`** — sim fish sampled from the real
  corpus instead of `patterns.ts`'s synthetic pool. Opt-in; omit it and the sim
  is byte-for-byte what it was.
- **Focus-reserve term** (`cardChoice.ts`'s `focusReserveFraction`,
  `DEFAULT_FOCUS_RESERVE_WEIGHT = 3`) — fixes SPEC-fishing.md §4c. Swept
  N=12000 × 2 seeds. Defaults to 0 for every non-live caller.
- **Per-turn prediction logging** — `data/ringPrediction.jsonl` +
  `scripts/ringPredictionReport.ts`. One row per TURN, so an affordable batch
  produces a usable number where catch rate cannot.
- **Graceful SIGINT in both direct-CLI entry points** (Task 10's open item).
  Verified live: `kill -INT` on a real dry-run PID printed the graceful message
  and exited through the normal path. Session 44 could not get this check.
- Test suite **664/664**, `tsc --noEmit` clean, `git diff --check` clean, all
  re-run at the final commit `1c86561`.

## What's broken
- **The account is stuck in the completed-but-unresolved doc state**
  (QUESTIONS.md §10). It killed cast 3 of this session's batch — `start_run`
  rejected HTTP 400, guard tripped, batch stopped (fail-closed, correct). Still
  stuck as of the last dry run. **Anything that wants to fish must clear this
  first.** Session 44 saw a fresh `start_run` succeed past this shape twice, so
  it is not reliably fatal, but it was fatal today.
- **The empirical-fish sim is NOT calibrated to live.** It puts today's live
  config at ~24.8% against a live all-time 10.1% — over-predicting ~2.4x — and
  is in-sample twice over (its predictor and its fish are both fitted to the
  same corpus). No catch-rate number from `fishingEmpiricalAblation.ts` or
  `focusReserveAblation.ts` is a live promise. The leave-one-cast-out table is
  the only out-of-sample evidence this session produced.
- **Live transfer of the ring model is unconfirmed**, not confirmed and not
  refuted. n=18 scored turns, both casts `k=2`: top-1 27.8% vs the
  class-matched offline 38.2%. 95% CI on 5/18 ≈ [12%, 51%], which contains
  38.2%. This needs 20-30 casts.
- **Heuristic (d) `pruneReturnToPrevious` is a proven no-op for `k=2`** — its
  guard tests `|prev.dx|+|prev.dy| === 1` (displacement length, not step class)
  so it never fires on the one class where reversal is the most likely move
  (39.2%). Left in place deliberately; retiring it should be its own change.
- `data.nextMovePath` — new unknown wire field, unmodelled. QUESTIONS.md §17.

## Corrections to SPEC.md
- **SPEC.md §5** said the fish moves "per its own deterministic pattern" with
  no characterisation. It now points at SPEC-fishing.md §9, which describes the
  actual rule.
- **SPEC.md §5's standing 22.4% sim figure** was being read as a live
  prediction. It was measured against the synthetic fish at *default* deck and
  params; at the real deck it is 13.3-13.6%, against the empirical fish ~24.8%,
  and live is 10.1%. Corrected in place.
- **SPEC.md §5, checked not inherited:** `perimeterWalk`'s support is **7**
  casts (cw 4, ccw 3), not the brief's 8 (cw 4, ccw 4) — verified against the
  seven cast ids the file already names. **All seven are `k=1` casts**, every
  hop at Manhattan distance 1. The mined library is a strict subset of one step
  class and says nothing about the corpus's 33 `k=2` casts.
- **SPEC-fishing.md §8**: heuristic (d)'s "~2pp regression" verdict corrected
  to **NEUTRAL** (24.8/24.6 off vs 24.6/24.6 on, N=20000, two seeds).
- **SPEC-fishing.md §4c**: marked FIXED, with the honest **+1.6pp, not the
  ~+5pp projected**.
- **New SPEC-fishing.md §9**: the whole movement model.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged — no dungeon work this session).

### Corrections to the session-45 brief itself (CLAUDE.md §9)
- FACT 1 is exceptionless on the **`isCleanCast`-filtered** corpus, not the raw
  log the brief quoted. Every apparent counterexample (1 zero-length move, 2
  off-ring, 1 `k`-inconsistent cast) comes from a single cast, `12923189`, with
  two disagreeing turn-0 records — the session-29 CODEXREVIEW #5 logging
  artifact. **Any restatement of FACT 1 must carry this exclusion.**
- The brief's baseline of **logLoss 2.070 does not reproduce**; measured 3.536.
  Its ring-model projection (1.123 / 47.4%) came in slightly *better* than
  measured at the time (1.074 / 48.2%). Both divergences favour the model.
- "At Chebyshev distance 2 a `k=1` cast is a guaranteed miss" is too broad. It
  holds for the **diagonal-2** offsets (±2,±2), measured 0.0%; offset (2,0) is
  also Chebyshev 2 and scores 41.1%.

## Dead ends
- **Brief §4, deck composition — REFUTED, do not rerun as specified.** Projected
  shape-matched decks at 55.5%/79.0% vs the real deck's 32.2%. Measured (ring
  model on, N=20000, two seeds): real deck **33.2%/32.9%**, shape-matched MID
  `[7,79,76]` **15.2%/14.7%**, shape-matched HIGH `[107,108,25]` (same three
  templates at 10-11 damage) **22.0%/21.9%**. The real deck wins. The premise is
  wrong: cards 7, 79 and 76 — one of each key template — are **already in the
  real deck**, so a "shape-matched" deck is the real deck with seven cards
  removed. Reviving this needs a new premise, not a rerun. Confound to carry
  forward: `drawHand` cycles sequentially, so a 3-card-repeated deck yields one
  fixed hand and loses all draw variety.
- **A sim arm labelled "today's live config" that wasn't one.** Both new
  ablation scripts initially omitted `blindFallback`, so the sim fell to
  hardcoded uniform where live wires `contextualFallback`. Uniform makes every
  focus placement EV-identical, so the tie-break never moves the focus and the
  budget is never spent — the opposite of live. This flipped two conclusions
  (baseline 5.5% → 24.8%; heuristic (d) +1.7pp → neutral) before it was caught.
  Don't trust a "live config" arm that hasn't been diffed against the live call
  path tier by tier.
- **2-ply focus lookahead** — not built. The brief tested it against the flat
  reserve term at matched N and it lost (32.4% vs 33.6%) at a large constant
  factor. Recorded so nobody rebuilds it.

## Metrics
- **Leave-one-cast-out**, 68 clean casts / 211 scored transitions:
  cell-only 19.4% / 3.912 · cell+prev (shipped) 42.7% / 3.536 · ring FACT-1-only
  26.1% / 1.287 · **ring+conditional 46.4% / 1.118** (k=1 54.1% / 0.803;
  k=2 38.2% / 1.455). Ring model has **0** zero-probability events vs the
  baseline's 23 — structural, from the ring floor.
- **Sim** (empirical fish, real deck/params, N=20000, two far-apart seeds):
  blind 0.0% · mined matcher only 5.5% · live config 24.8%/24.6% · ring model
  33.2%/32.9% · ring + mined intersected 38.3%/37.5%. All in-sample; see
  What's broken.
- **Focus reserve sweep** (N=12000 × 2 seeds, ring+mined arm): peak **w=3** at
  40.0%/39.2% vs w=0's 38.6%/37.4% — **+1.6pp**. Exhaustion 79.5% → 69.5% of
  casts (live config), median turn 4.
- **Live**: 2 casts (day's remaining budget after session 44's 16 of 20), both
  escaped, 0 caught. All-time **7/69 = 10.1%**. 20 scored prediction turns;
  ring tier top-1 **27.8%**, logLoss **1.594**, both casts `k=2`.
- **FACT 1 out-of-sample**: the batch's 20 new transitions, 0 counterexamples.

## Open questions for Claude
1. **Top priority: a 20-30 cast live batch under the ring model** (it is
   default-on now). Report per-turn top-1 **split by step class** against the
   offline 54.1% (k=1) / 38.2% (k=2) — not the mixed 46.4%. `scripts/
   ringPredictionReport.ts` prints exactly this. Blocker: the account's stuck
   doc state must clear first.
2. Should heuristic (d) be **removed**? It is a proven no-op for `k=2` and
   redundant for `k=1` under §9's conditional table. Left in place so retiring
   it is deliberate.
3. `data.nextMovePath` (QUESTIONS.md §17) — is it ever an actual multi-cell
   path, or always a one-cell duplicate of `nextPosition`? One non-null
   observation, where the two were identical. A DevTools capture over several
   consecutive turns would settle it.
4. Standing, unaddressed: scheduler energy-tracking gap, charge-reserve plateau
   (sessions 40-42). No dungeon work this session.

## Files changed
```
 47 files changed, 13820 insertions(+), 89 deletions(-)

 new src/strategy/fishing/stepClass.ts          | 330
 new src/sim/fishing/empiricalFish.ts           | 190
 new scripts/auditStepClass.ts                  | 280
 new scripts/fishingRingCV.ts                   | 230
 new scripts/fishingEmpiricalAblation.ts        | 190
 new scripts/focusReserveAblation.ts            | 160
 new scripts/ringPredictionReport.ts            |  75
 new tests/fishing/stepClass.test.ts            | 210 (18 tests)
 new tests/fishing/empiricalFish.test.ts        | 105 (6 tests)
 new tests/helpers/liveFishingDeps.ts           |  60
     src/strategy/fishing/cardChoice.ts         | +95
     src/sim/fishing/castSim.ts                 | +120
     src/sim/fishing/geometry.ts                | +15
     scripts/liveFishing.ts                     | +170
     scripts/liveRun.ts                         | +25
     tests/fishing/cardChoice.test.ts           | +85 (8 tests)
     SPEC-fishing.md / SPEC.md / TASKS.md
     QUESTIONS.md / handoff/DECISIONS.md
   + fixtures/fishing-casts/live/ (22 files, 2 casts)
```
