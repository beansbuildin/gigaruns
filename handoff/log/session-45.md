# session 45 — 2026-08-18 — step-class ring movement model — GATE PASS

Brief: `handoff/next.md` (session 45, fishing). Six sections asked for; §1's
gate is the one that ends the task.

- §0 re-derive the brief's facts — **done, confirmed with one correction**
- §1 build the ring model, gate on leave-one-cast-out — **GATE PASS**
- §2 empirical sim fish, re-run heuristic (d) — **done, verdict CORRECTED**
- §3 focus-reserve term, sweep it — **done, +1.6pp not the projected +5pp**
- §4 deck composition — **brief's claim REFUTED, left as a non-task**
- §5 small live validation — **done, 2 casts (budget), transfer unconfirmed**
- §6 stretch: graceful SIGINT — **done, verified live**

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
  re-run at the final commit `1719ab3`.

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

---

# Verbose appendix

## §0 — full audit output (`npx tsx scripts/auditStepClass.ts`)

Run against the corpus as it stood at session start (263 raw transitions,
67 casts, 66 clean). "brief" column is the session-45 brief's claimed value.

```
── FACT 1: every move lands on a fixed Manhattan-k ring ──   (ALL casts, unfiltered)
  transitions at Manhattan distance 1        measured 145    brief 148
  transitions at Manhattan distance 2        measured 116    brief 115
  transitions at any other distance          measured   1    brief   0
  casts with >=2 moves, every move same k    measured 64/65  brief 65/65
  moves off the legal in-grid k-ring         measured 2/262  brief 0/263
  k=1 casts                                  measured  35    brief  36
  k=2 casts                                  measured  31    brief  31

── same, restricted to isCleanCast() ──
  transitions at Manhattan distance 1        measured 144
  transitions at Manhattan distance 2        measured 115
  transitions at any other distance          measured   0    <-- exceptionless
  casts with >=2 moves, every move same k    measured 64/64  <-- exceptionless
  moves off the legal in-grid k-ring         measured 0/259  <-- exceptionless
```

Every discrepancy traces to ONE cast. Identified directly:

```
12923189  dupTurns [[0,["2,3","2,4"]]]  gaps false  maxTurn 2  records 4
```

Two disagreeing records at turn 0 — the session-29 CODEXREVIEW #5
resumed-numbering artifact. It fabricates a zero-length "move" and a
`k`-inconsistency that never happened. `isCleanCast` already excludes it
everywhere this project analyses trajectories.

FACT 2, clean corpus, at session start and after the live batch:

```
            P(repeat)  P(reversal)   n        (post-batch)
  k=1        28.4%      0.0%  0/109  109      unchanged, 0/109
  k=2         3.6%     41.7% 35/84    84      39.2%, 40/102
```

FACT 3, best hit rate over all card templates by (class, focus offset from the
fish's CURRENT cell). Focus co-location is the (0,0) cell:

```
 class k=1:
   (-2,-2)=  0.0%  (-1,-2)= 32.1%  (0,-2)= 32.8%  (1,-2)= 24.5%  (2,-2)=  0.0%
   (-2,-1)= 21.4%  (-1,-1)= 54.7%  (0,-1)= 83.8%  (1,-1)= 70.1%  (2,-1)= 44.7%
   (-2, 0)= 29.5%  (-1, 0)= 74.6%  (0, 0)=100.0%  (1, 0)= 80.6%  (2, 0)= 41.1%
   (-2, 1)= 30.1%  (-1, 1)= 53.2%  (0, 1)= 73.5%  (1, 1)= 59.0%  (2, 1)= 35.0%
   (-2, 2)=  0.0%  (-1, 2)= 24.6%  (0, 2)= 26.0%  (1, 2)= 27.1%  (2, 2)=  0.0%
   best at (0,0): 100.0% via template {2,4,6,8}  (n=144)

 class k=2:
   (-2,-2)= 11.5%  (-1,-2)= 37.5%  (0,-2)= 64.3%  (1,-2)= 51.1%  (2,-2)= 36.7%
   (-2,-1)= 44.4%  (-1,-1)= 47.8%  (0,-1)= 62.2%  (1,-1)= 51.5%  (2,-1)= 48.9%
   (-2, 0)= 58.3%  (-1, 0)= 56.3%  (0, 0)= 71.3%  (1, 0)= 53.8%  (2, 0)= 63.6%
   (-2, 1)= 37.0%  (-1, 1)= 45.5%  (0, 1)= 48.9%  (1, 1)= 41.2%  (2, 1)= 38.1%
   (-2, 2)= 20.6%  (-1, 2)= 36.2%  (0, 2)= 49.2%  (1, 2)= 31.8%  (2, 2)=  8.0%
   best at (0,0): 71.3% via template {1,3,7,9}  (n=115)
```

Note the four corners of the k=1 grid: the **diagonal-2** offsets are 0.0%,
a guaranteed miss with every card. (2,0) is also Chebyshev 2 and is 41.1% —
which is why the brief's "Chebyshev distance 2" phrasing is too broad.

Template id lists confirmed exactly as the brief stated:

```
  hitZones {2,4,6,8}:         ids 8, 14, 27, 75, 79, 88, 98, 108
  hitZones {1,3,7,9}:         ids 7, 13, 19, 38, 74, 97, 107
  hitZones {1,2,3,4,6,7,8,9}: ids 9, 12, 15, 18, 24, 25, 76, 89, 99, 109
```

## §1 — the gate, and the shrinkage sweep

`npx tsx scripts/fishingRingCV.ts`, post-batch corpus (69 casts, 68 clean,
211 scored transitions — hops with a previous displacement, so every
predictor is scored on the identical set):

```
  cell-only (today's tier 2)                   n=211  top1= 19.4%  logLoss= 3.912  brier=0.884  zeroP=23
  cell + prev-displacement (raw)               n=211  top1= 39.3%  logLoss= 6.791  brier=0.854  zeroP=63
  cell + prev-displacement (shipped backoff)   n=211  top1= 42.7%  logLoss= 3.536  brier=0.739  zeroP=23
  ring, class-aware (Fact 1 only)              n=211  top1= 26.1%  logLoss= 1.287  brier=0.712  zeroP=0
  ring + class-aware prev-delta (Facts 1+2)    n=211  top1= 46.4%  logLoss= 1.118  brier=0.624  zeroP=0
    ...on k=1 casts only                       n=109  top1= 54.1%  logLoss= 0.803  brier=0.501  zeroP=0
    ...on k=2 casts only                       n=102  top1= 38.2%  logLoss= 1.455  brier=0.756  zeroP=0
```

`zeroP` is the count of held-out cells the predictor assigned probability
exactly zero, each costing `-log(1e-9) = 20.72` under this project's standing
convention. The ring model's zero is structural — the ring floor guarantees a
nonzero probability on every legal cell — and it is most of why the log-loss
gap is so large.

Shrinkage sweep (pre-batch corpus, hence 1.06x rather than 1.11x figures).
Log loss is a broad flat plateau; top-1 is 48.2% at essentially every setting,
which is the tell that the ring CONSTRAINT buys top-1 and the smoothing knobs
only move calibration:

```
  shrinkageK  ringFloor    top1   logLoss    brier
         0.5       0.20   48.2%    1.092   0.613
           1       0.20   48.2%    1.082   0.608
           2       0.10   48.2%    1.074   0.606
           2       0.20   48.2%    1.073   0.602
           3       0.05   48.2%    1.069   0.604
           3       0.10   48.2%    1.068   0.602   <-- chosen
           3       0.20   48.2%    1.071   0.600
           5       0.00   48.2%    1.066   0.599
           5       0.02   48.2%    1.065   0.599   <-- global min, 0.003 better
           5       0.05   48.2%    1.065   0.598
          10       0.00   49.2%    1.074   0.598
```

`{3, 0.1}` is taken because it sits in the plateau's INTERIOR on both axes;
the global minimum is 0.003 better, which is noise at n=193. Same robustness
reasoning that picked `DEFAULT_SHRINKAGE_K = 1` in session 38.

## §2 — the empirical fish, in full

`npx tsx scripts/fishingEmpiricalAblation.ts 20000`, real deck
`[1,2,3,4,5,6,7,76,77,79]`, real parameters (fishHp 13/21, mana 10, focus 3,
hand 3), seeds 1 and 500000. Cells are `catch% / mean final fishHP`.

```
0. SIM-vs-LIVE calibration
  blind predictor, SYNTHETIC fish                        0.0% / 14.50    0.0% / 14.52
  mined matcher, SYNTHETIC fish                         13.3% / 13.42   13.6% / 13.39
  blind predictor, EMPIRICAL fish                        0.0% / 14.21    0.0% / 14.31
  mined matcher, EMPIRICAL fish                          5.5% / 14.24    5.5% / 14.20
  mined + contextual fallback, EMPIRICAL fish (= LIVE)  24.8% / 11.56   24.6% / 11.58

  Live reality: 7/69 = 10.1% all-time, 0/16 on session 44's batch.

1a. Heuristic (d), whole corpus
  live config (mined + contextual), (d) OFF             24.8% / 11.56   24.6% / 11.58
  live config (mined + contextual), (d) ON              24.6% / 11.60   24.6% / 11.66
  ring model, (d) OFF                                   33.2% /  9.08   32.9% /  9.11
  ring model, (d) ON                                    33.1% /  9.10   32.7% /  9.16

1b. Class-split — the brief's actual claim
  k=1 fish only, (d) OFF                                21.6% / 11.52   21.3% / 11.64
  k=1 fish only, (d) ON                                 21.4% / 11.58   20.9% / 11.72
  k=2 fish only, (d) OFF                                45.8% /  6.34   45.6% /  6.33
  k=2 fish only, (d) ON                                 45.8% /  6.34   45.6% /  6.33   <-- BYTE-IDENTICAL

  Same, SYNTHETIC fish (what session 44 measured)
  synthetic fish, mined matcher, (d) OFF                13.3% / 13.42   13.6% / 13.39
  synthetic fish, mined matcher, (d) ON                 12.6% / 14.18   13.1% / 14.11
  synthetic fish, LIVE config,   (d) OFF                14.3% / 14.99   15.1% / 14.86
  synthetic fish, LIVE config,   (d) ON                 14.0% / 15.28   14.8% / 15.13

2. Predictor comparison
  blind fallback                                         0.0% / 14.21    0.0% / 14.31
  mined matcher only, no fallback tier                   5.5% / 14.24    5.5% / 14.20
  LIVE config (mined + contextual fallback)             24.8% / 11.56   24.6% / 11.58
  RING model                                            33.2% /  9.08   32.9% /  9.11
  RING model + mined matcher, ring-intersected          38.3% /  9.31   37.5% /  9.41

3. Deck shape (brief §4) — REFUTED
  real deck  [1,2,3,4,5,6,7,76,77,79]                   33.2% /  9.08   32.9% /  9.11
  shape-matched MID  [7,79,76]                          15.2% / 13.45   14.7% / 13.56
  shape-matched HIGH [107,108,25]                       22.0% / 14.04   21.9% / 14.04
```

The k=2 byte-identical row is the mechanical proof that heuristic (d) never
fires for that class: its guard is `|prev.dx| + |prev.dy| === 1`, the
DISPLACEMENT's Manhattan length, which for a 2-step fish is always 2.

Card stats behind the §4 refutation (`fixtures/fishing-casts/cards.json`):

```
   id  mana  hitZones                crit   hit  miss
    1     1  [1,2,3]                 []       5    -3
    7     1  [1,3,7,9]               []       6    -3
   76     1  [1,2,3,4,6,7,8,9]       []       3    -3
   77     1  []                      [5]      -    -4   (crit 10)
   79     1  [2,4,6,8]               []       5    -4
  107     1  [1,3,7,9]               []      10    -5
  108     1  [2,4,6,8]               []      11    -5
   25     1  [1,2,3,4,6,7,8,9]       []      11   -10
```

Cards 7, 76 and 79 — one of each key template — are already in the real deck.

## §3 — the focus-reserve sweep, all three arms

`npx tsx scripts/focusReserveAblation.ts 12000`, seeds 1 / 500000.

```
A. RING model alone
  w        0     0.5      1      2      3      4      6      8     12
  s1   33.3%  33.7%  33.6%  34.8%  33.8%  30.7%  26.9%  20.8%  17.3%
  s2   32.5%  32.7%  32.7%  33.5%  32.5%  30.1%  26.6%  20.5%  16.6%

B. RING model + mined matcher, ring-intersected   <-- the arm that ships
  w        0     0.5      1      2      3      4      6      8     12
  s1   38.6%  38.4%  38.6%  39.5%  40.0%  39.6%  39.9%  38.4%  35.3%
  s2   37.4%  37.5%  37.9%  38.7%  39.2%  38.8%  39.3%  37.9%  35.4%

C. today's live config (mined + contextual, no ring)
  w        0     0.5      1      2      3      4      6      8     12
  s1   25.0%  25.8%  26.5%  26.6%  27.4%  27.2%  27.7%  27.8%  25.0%
  s2   24.2%  25.2%  26.2%  26.3%  27.2%  27.0%  27.6%  27.8%  24.6%

focus-budget exhaustion (N=3000)
  arm                 w=0                w=3               w=8
  RING model      73.9% (turn 5)    60.9% (turn 5)   13.0% (turn 7)
  live config     79.5% (turn 4)    69.5% (turn 4)   50.5% (turn 5)
```

Arm B peaks at w=3 on both seeds; w=3 also sits inside the real deck's
`hitEffect` range (3-6), the intended sanity check. Arm A peaks at w=2 and
falls off hard past 4 — worth knowing if the mined matcher is ever dropped.

The live-config exhaustion figure of 79.5% by median turn 4 is the check that
the simulated defect is session 44's real one (16/16 live at turns 1-4).

## §5 — the live batch, turn by turn

Two casts completed, both escaped after 10 turns. Cast 3 blocked:

```
▸ cast 3/4
  ★★★ UNKNOWN FIELD(S) on the existing completed-but-unresolved doc: data.nextPosition, data.nextMovePath
  ▸ energy: 133 -> 133  (observed delta 0; committed 0)
✗ Guard tripped: fishing start_run rejected {"error":"Unexpected response from /fishing/action: HTTP 400"}
```

Fail-closed behaved correctly: no energy spent on the rejected start, non-zero
exit, batch stopped.

`npx tsx scripts/ringPredictionReport.ts`:

```
  20 scored turn(s) across 2 cast(s)

── by predictor tier ──
  matcher            n=  2  top1=  0.0%  logLoss= 20.723  zeroP=2
  ring               n= 18  top1= 27.8%  logLoss=  1.594  zeroP=0

── ring tier, by step class (the class-matched comparison) ──
  k=1                (no rows)
  k=2                n= 18  top1= 27.8%  logLoss= 1.594  [offline LOO: top1 38.2%, logLoss 1.455]
  all classes        n= 18  top1= 27.8%  logLoss= 1.594  [offline LOO: top1 46.4%, logLoss 1.118]

── by cast ──
  cast 12978000 (k=2)  n= 10  top1= 40.0%
  cast 12978003 (k=2)  n= 10  top1= 10.0%
```

The two `matcher` rows are both turn 0, where the class is not yet known so no
ring intersection applies:

```
{"castId":"12978000","turn":0,"tier":"matcher","stepClass":null,"predicted":[2,1],"pPredicted":0.5,"pActual":0,"actual":[2,2]}
{"castId":"12978003","turn":0,"tier":"matcher","stepClass":null,"predicted":[4,1],"pPredicted":1,  "pActual":0,"actual":[2,3]}
```

The second is the bad one: a fully-converged mined candidate predicting a
single cell with **p=1**, wrong, giving the truth **p=0**. Fixed by mixing the
matcher tier with the ring model at `ringFloor` in both `castSim.ts` and
`liveFishing.ts`. Sim catch-rate effect is neutral within noise, and the
before/after is confounded anyway because the corpus grew mid-measurement.

## `data.nextMovePath` — the new wire field

Three docs carried it. All observed values:

```
  dump                fishPosition   nextPosition   nextMovePath
  midcast 05-14-28    [2,1]          [1,2]          [1,2]
  midcast 05-14-30    [1,2]          null           null
  terminal 05-14-32   [2,1]          null           null
```

One non-null sample, in which it is identical to `nextPosition` and is a single
cell despite the name. The fish did move [2,1] -> [1,2], Manhattan 2, so that
was a `k=2` cast and the server's own prediction was correct. QUESTIONS.md §17.

## The fourth data-path leak, in detail

Adding `ringPredictionLogPath` to `LiveFishingDeps` made session 40's
`Required<Pick<...>>` type guard fail all six deps constructions in
`tests/liveFishing.test.ts` — 12 compile errors, exactly as designed.

It did not catch the seventh. `tests/sim/fishingCorpus.test.ts` builds its deps
as a raw object literal and so bypassed the factory entirely, writing this into
the real `data/ringPrediction.jsonl` on every test run:

```
{"ts":"2026-08-19T05:19:14.719Z","castId":"9001","turn":0,...}
{"ts":"2026-08-19T05:19:20.724Z","castId":"9002","turn":0,...}
```

`9001`/`9002` are the same synthetic docIds as session 30's original fixture
pollution — in the file whose own comments document occurrences one through
three. The factory and its isolated-paths type moved to
`tests/helpers/liveFishingDeps.ts`; both files import it; the literal is gone.
Polluted rows removed and the log verified stable at 20 rows across two further
full-suite runs.

## §6 — SIGINT, verified live

```
▸ cast 1/1
▸ SIGINT received — finishing the current action, then stopping (press again to force-exit).
  ...
▸ done. energy spent (guard-tracked) 216, casts 18
```

`kill -INT` on the real PID of a `--dry-run` invocation (zero energy). The
handler fired, the process completed its in-flight action, and exited through
its normal end-of-run path rather than Node's default immediate termination.
Session 44 recorded this gap but could only confirm the failure, not the fix.

## Verification at the final commit

```
npx tsc --noEmit     clean
npx vitest run       36 files, 664 tests, 664 passing
git diff --check     clean
secret scan          0x[a-fA-F0-9]{4,}, noobId, eyJ, PRIVATE, ~/.secrets — no matches
                     22 new fixture files, all addresses redacted to 0xUSER
```
