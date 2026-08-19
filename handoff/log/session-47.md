# STATE — session 47 — 2026-08-19 — commit <SHA>

## Status
Session-47 brief (offline-only): **ALL SIX ITEMS DELIVERED.** No gate was set —
the brief explicitly stated no cast would be played, so there is nothing here
to pass or fail. No live call of any kind was made this session.

**The headline is not on the brief's list.** `src/sim/fishing/geometry.ts`'s
`ZONE_OFFSET` — the card hitbox template, marked CONFIRMED since session 12 —
was the **TRANSPOSE** of the truth and had been for eleven sessions. Found
while validating §1b's replay against recorded outcomes. Fixed, with two
independent lines of evidence and a regression test.

Next per TASKS.md: the 5-cast live batch, unchanged, and it now goes in with a
corrected aiming map and a real prior instead of a hope.

## What works
- **The zone fix, verified two independent ways.** `scripts/auditZoneTemplate.ts`
  scores a template against every recorded play (focus submitted, card played,
  cell the fish occupied → did it predict the server's own hit/miss?):
  corrected **282/282**, session 12's **228/282**. Separately, `position[0]` is
  the **ROW** — `doc.data.lastMovePath` carries 1-based cell indices and
  `index === (position[0]-1)*gridSize + position[1]` holds **289/289**.
  `tests/fishing/zoneTemplate.test.ts` is the regression guard, pinned to the
  corpus rather than to one capture.
- **§1a energy preflight** (`src/orchestrator/energyPreflight.ts`) — reads the
  real pool, and if short reads the ROM bank, refuses BEFORE claiming if
  pool+bank can't fund the batch, claims biggest-first only to the deficit, then
  verifies against the MEASURED pool. Fails closed with the numbers in
  `.detail`. Network-free; 11 tests. Wired into `liveFishing.ts`, `liveRun.ts`
  (×3 under `--juiced`) and `orchestrator.ts`. `--no-rom-claim` opts out.
- **§1b off-policy replay** (`src/sim/fishing/offPolicyReplay.ts` +
  `scripts/offPolicyReplay.ts`), gated on its precondition passing.
- **§1b precondition** (`scripts/auditMovementIndependence.ts`) — stratified
  permutation tests, hit labels shuffled within `(k, prevDelta)` strata. No
  dependence at n=211: 6 tests, smallest raw p = 0.021, Bonferroni 0.13, stable
  across seeds 1/7/99. Failure to detect, NOT proof — it prints the Wilson
  intervals so what it could rule out is legible.
- **§1c** — `w=3` still the focus-reserve plateau; sweep now prints hit rate
  beside catch rate.
- **§1d/§1e** — dungeon side had the SAME swallowed-error-body bug in **three**
  places; `serverErrorDetail` moved to `src/api/errors.ts`. Stuck-doc warning
  reworded. The `.message` grep found no third instance repo-wide.
- **§1f** — scheduler energy gap CLOSED (claim before you sleep); charge-reserve
  plateau formally PARKED in TASKS.md with its unpark condition.
- **FACT 1 unchanged**: 0/279 off-ring, 66/66 casts class-consistent.
- Suite **688/688**, `tsc --noEmit` clean, `git diff --check` clean, all re-run
  at the final commit. No `data/` file has an mtime inside the session window.

## What's broken
- **The zone bug's live cost was paid for eleven sessions and is unrecoverable.**
  Every live cast to date aimed with the transposed map while the server
  resolved with the true one. The replay prices it at 42.8% → 50.9% per-turn hit
  rate, same predictor and trajectories.
- **The ring model's live transfer is STILL unconfirmed.** Unchanged since
  session 45: n=18 scored turns, both casts k=2, top-1 27.8%. No new live data.
- **The replay is a counterfactual and cannot be validated externally.** Its
  three conservatisms are stated, not buried, but 29 of 68 casts were truncated
  at the record's length while still live (mean fish HP 43.3% of max).
- **`data/ringPrediction.jsonl`'s 20 existing rows were logged under the wrong
  zone map.** Their *predictions* are unaffected (movement is independent of
  zones) but any hit/EV field on them reflects mis-aimed shots.
- `data.nextMovePath` — unmodelled, unchanged. QUESTIONS.md §17.

## Corrections to SPEC.md
- **SPEC.md §5 / SPEC-fishing.md §4 — the zone-offset table was TRANSPOSED.**
  Correct: `offset(z) = (floor((z-1)/3) - 1, (z-1)%3 - 1)`, i.e. `1=(-1,-1)
  2=(-1,0) 3=(-1,1) 4=(0,-1) 5=(0,0) 6=(0,1) 7=(1,-1) 8=(1,0) 9=(1,1)`. Session
  12 derived it from one hit with card 79, `hitZones [2,4,6,8]` — a
  **transpose-symmetric** set that could not discriminate the two tables. Fixed
  in both specs and in `geometry.ts`.
- **SPEC.md said the hand refills "drawn from `fullDeck` via `nextCardIndex`".
  FALSE.** 0 of 56 refills and 1 of 69 opening hands match a `fullDeck` slice.
  `fullDeck` is a canonical sorted list; the draw ORDER is a hidden server
  shuffle. `nextCardIndex` counts draws (and reconciles with `cardInDrawPile`)
  but predicts nothing. Fixed, with what IS reconstructible in its place.
  **The session-47 brief built its replay design on the false version.**
- Newly confirmed corpus-wide, 282/282, zero exceptions: a play removes exactly
  one card by hand index; the hand refills to 3 exactly when emptied (61/61);
  `playerHp(t+1) = playerHp(t) - manaCost(played)`.
- Turn event order is **FISH_MOVED → CARD_PLAYED → HIT** — the fish moves
  before the card resolves. Crits fire a `HIT` event with `critEffects` damage;
  there is no `CRIT` event type (3 in corpus).
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged — no dungeon play, fifth session running).

## Dead ends
- **Do not derive a mechanic from a sample that could not have falsified it.**
  Third instance in two sessions: heuristic (d)'s displacement-vs-class guard,
  the `.message` server-cap classifier, now the zone table. All three had a real
  mechanism and an evidence base blind to the specific error. The cheap guard is
  re-scoring against the corpus once it is big enough to bite — not more care at
  derivation time.
- **Do not trust a brief's claim about what the corpus contains.** CLAUDE.md §9,
  third recorded instance. The `fullDeck` draw-reconstruction premise was the
  whole basis of §1b's proposed harness and is false.
- **Do not conclude "the sim is fine" from the sim being self-consistent.** The
  zone bug was invisible in-sim for eleven sessions precisely because the sim
  applies the table on both sides. Sim numbers moved <0.5pp after the fix.
- **Do not re-sweep the charge-reserve plateau.** PARKED with its unpark
  condition in TASKS.md: only if the utility function around it changes.
- Deck thread stays CLOSED (session 46). Heuristic (d) stays retired.

## Metrics
- **Zone template**: corrected 282/282 vs transposed 228/282 recorded plays;
  `lastMovePath` row-major 289/289.
- **Off-policy replay**, 68 clean casts, leave-one-cast-out, matcher tier off:
  catch **19/68 = 27.9%** [18.7%, 39.6%] vs actual **7/68 = 10.3%**;
  per-turn hit **111/218 = 50.9%** [44.3%, 57.5%] vs actual **60/218 = 27.5%**;
  McNemar 73 new-hit/old-miss vs 22 old-hit/new-miss;
  paired ΔLL (baseline − ring) **2.115**, 95% CI [1.364, 2.866], n=218.
  Decomposition: hit rate 27.5% actual → **42.8%** new predictor + OLD geometry
  → **50.9%** corrected. Catch 10.3% → 20.6% → 27.9%. The predictor is the
  larger term; the zone fix adds ~8pp on top.
- **Movement independence**: 211 pairs (62 after a hit, 149 after a miss),
  6 tests, smallest raw p = 0.021, Bonferroni-adjusted 0.13.
- **Focus reserve** (N=8000×2 seeds, empirical fish, real deck): ring w=3
  35.1/34.0 catch · 49.9/49.4 hit (peak); ring+mined w=4 40.0/39.6 · 49.0/48.7;
  live config w=3 29.6/29.9 · 45.6/46.1. w=3 and w=4 indistinguishable.
- **Sim after the zone fix** (essentially unmoved, as predicted): ring
  32.3/32.1, ring+mined 37.1/37.3, live config 26.4/26.5.
- **Live: 0 casts, 0 runs played.** All-time unchanged at 7/69 = 10.1%.
- Suite 688 (663 → 688: +11 preflight, +5 zone/corpus, +8 replay, +1 dungeon
  error-body).

## Open questions for Claude
1. **The 5-cast batch is now materially more informative than it was.** The
   §0b checkpoint discipline stands unchanged and the paired-ΔLL power
   calculation is unaffected. But the batch is now also the first live test of
   the corrected zone map, and the replay gives it a genuine prior: ~50% per-turn
   hit rate, versus 27.5% realized historically. **Ask for per-turn hit rate as
   a first-class checkpoint metric alongside paired ΔLL** — it is the statistic
   the zone fix moves most directly and it accumulates far faster than catch rate.
2. **Should `data/ringPrediction.jsonl`'s 20 pre-fix rows be marked?** Their
   predictions are still valid (movement is zone-independent), but they were
   logged by a policy aiming with the wrong map. Left untouched — a decision,
   not an oversight, and reversible either way.
3. **Is anything ELSE marked CONFIRMED on a single non-discriminating capture?**
   The zone table was found by accident. A deliberate pass — enumerate every
   `[CONFIRMED]` in SPEC.md/SPEC-fishing.md, ask what sample established it and
   whether that sample could have falsified it — is a small session and would
   have caught this one eleven sessions ago.
4. `data.nextMovePath` (QUESTIONS.md §17) — unchanged, one non-null observation.
5. §0a/§0b from the session-47 brief are now STANDING POLICY and are recorded
   here and in TASKS.md so session 48 inherits them without rediscovery.

## Files changed
```
 23 files changed, 2260 insertions(+), 82 deletions(-)

     src/sim/fishing/offPolicyReplay.ts         | 336  (the replay harness)
     scripts/auditMovementIndependence.ts       | 325  (the precondition test)
     src/sim/fishing/castTrace.ts               | 268  (third corpus view, full per-turn state)
     src/orchestrator/energyPreflight.ts        | 230  (§1a, ROM-aware)
     tests/orchestrator/energyPreflight.test.ts | 183
     tests/fishing/offPolicyReplay.test.ts      | 163
     scripts/offPolicyReplay.ts                 | 114  (the report + zone-fix decomposition)
     scripts/liveFishing.ts                     | 106  (preflight wiring, §1d reword, serverErrorDetail moved)
     src/sim/fishing/zoneAudit.ts               | 101
     SPEC.md                                    |  81  (zone table + fullDeck corrections)
     tests/fishing/zoneTemplate.test.ts         |  72  (the missing regression guard)
     src/sim/fishing/geometry.ts                |  57  (ZONE_OFFSET TRANSPOSE FIX)
     scripts/auditZoneTemplate.ts               |  50
     TASKS.md                                   |  42  (§1f close + park)
     scripts/liveRun.ts                         |  38  (preflight, 3x error-body fix)
     src/api/errors.ts                          |  37  (serverErrorDetail moved here)
     scripts/orchestrator.ts                    |  34  (claim before you sleep)
     tests/liveRun.test.ts                      |  31
     src/orchestrator/scheduler.ts              |  24  (targetEnergy on sleep)
     SPEC-fishing.md                            |  22
     scripts/focusReserveAblation.ts            |  14  (hit rate beside catch rate)
     tests/orchestrator/scheduler.test.ts       |   7
     tests/fishing/cardChoice.test.ts           |   7  (zone-dependent scenario repaired)
```

---

# Verbose appendix — session 47

## A. How the zone transpose was actually found

Not by looking for it. §1b's replay needs to resolve a counterfactual shot
against a recorded fish cell, so the first thing built was a check that the
existing geometry reproduces the SERVER's own hit/miss on plays that really
happened. It did not: 228 of 282.

```
A committed  : 228 ok / 54 mismatched
      12923189#2 card 5 zones [2,5,8] focus 1,2 fish 1,3 pred true actual false
      12923265#1 card 3 zones [7,8,9] focus 1,2 fish 2,2 pred false actual true
      12923274#3 card 2 zones [4,5,6] focus 2,2 fish 3,2 pred true actual false
      12923274#6 card 1 zones [1,2,3] focus 3,2 fish 2,2 pred false actual true
B transposed : 282 ok / 0 mismatched
```

Every mismatch involves a row-or-column zone set. Every card with a
transpose-symmetric set (`[5]`, `[1,5,9]`, `[2,4,6,8]`) agrees under both
tables — which is exactly why session 12's single-capture derivation, done
against card 79's `hitZones [2,4,6,8]`, could not have caught it.

The second, independent line of evidence removes any doubt about WHICH table is
right rather than merely which fits better. `doc.data.lastMovePath` carries
1-based cell indices:

```
prev [2,3] -> pos [1,4], path [8,4]     f(a,b) = (a-1)*4 + b  ->  f(1,4) = 4  ✓
prev [1,4] -> pos [2,3], path [3,7]                               f(2,3) = 7  ✓
prev [2,1] -> pos [4,1], path [9,13]                              f(4,1) = 13 ✓
prev [4,1] -> pos [3,2], path [14,10]                             f(3,2) = 10 ✓
```

`index === (position[0]-1)*gridSize + position[1]` holds 289/289 corpus-wide —
row-major over `position`, so `position[0]` is the ROW. `lastMovePath[0]`
decodes as the k=2 move's intermediate waypoint: `[2,1]→[4,1]` has path
`[9,13]` and `f(3,1) = 9`. Third consistency check, same conclusion.

## B. Why the sim never noticed

`castSim.ts` calls `zonesToCells` twice per turn: once inside
`bestFocusForCard` to score a focus placement, once in `resolveOutcome` to
decide whether the shot landed. Both used the same wrong table, so the sim was
internally consistent and its catch rates were "correct" for a game whose zone
template is the transpose of Dendren's. Live, only the policy half was wrong.

Measured: sim figures moved by less than half a point after the fix (ring
32.5/32.3 → 32.3/32.1; live config 26.3/26.0 → 26.4/26.5). The residual drift is
real, not noise — the empirical fish's movement distribution is not
transpose-symmetric — but it is tiny, which is precisely why eleven sessions of
sim work gave no signal.

## C. The brief's replay premise, and what replaced it

Brief §1b: "Draws are deterministic — `fullDeck` plus `nextCardIndex`
reconstructs the exact sequence." Checked before building on it:

```
casts: 69   turn0 hand == sorted(fullDeck[:nci]):  1
refills: 56  match fullDeck slice (as a set):      0
distinct fullDecks: 10   e.g. (1,2,3,4,5,6,7,76,77,79)
```

`fullDeck` is a canonical sorted list. The draw pile is a server-side shuffle
that never appears on the wire.

What IS true, checked across all 282 plays with zero exceptions:

```
hand sizes at decision time: {3: 120, 2: 101, 1: 61}
violations of "one card out by hand index":  0
refills matching the NEW_HAND event:        61 / 61
mana: playerHp(t+1) == playerHp(t) - manaCost(played):  282 / 282
```

So the block structure is pinned even though the shuffle is hidden: every turn
plays exactly one card, so a counterfactual policy empties its hand on the SAME
turn no matter which card it picks, and the recorded `NEW_HAND` is the correct
refill. Only the ORDER within each 3-card block is free — which is exactly the
degree of freedom the replay needs.

A fourth fact fell out while validating the HP arithmetic: 3 plays in the corpus
deal `critEffects[0].amount` rather than `hitEffects[0].amount`. There is no
`CRIT` event type — a crit fires an ordinary `HIT` event. Full event-type
census over the corpus:

```
FISH_MOVED 282, CARD_PLAYED 282, FISH_HP_DIFF 282, HIT 73, NEW_HAND 61,
FISH_ESCAPED 61, FISH_DIED 7, PLAYER_0_MANA 5, PREDICT_NEXT_MOVE 5
```

## D. Movement-independence audit, full output (seed 1)

```
  corpus: 69 casts, 68 clean (start_run present + position-continuous)
  usable (hit_t, move_{t+1}) pairs with a known previous displacement: 211
    after a HIT: 62    after a MISS: 149

  ── class k=1 — 112 pairs (34 after a hit, 78 after a miss)
    P(repeat prev delta)       after HIT   10/34  =  29.4% [16.8%, 46.2%]
                               after MISS  21/78  =  26.9% [18.3%, 37.7%]
                               stratified permutation p = 0.1277  (4/4 informative strata)
    P(exact reversal)          after HIT    0/34  =   0.0% [0.0%, 10.2%]
                               after MISS   0/78  =   0.0% [0.0%,  4.7%]
                               stratified permutation p = 1.0000  (4/4 informative strata)

  ── class k=2 — 99 pairs (28 after a hit, 71 after a miss)
    P(repeat prev delta)       after HIT    3/28  =  10.7% [3.7%, 27.2%]
                               after MISS   1/71  =   1.4% [0.2%,  7.6%]
                               stratified permutation p = 0.0212  (6/8 informative strata)
    P(exact reversal)          after HIT   11/28  =  39.3% [23.6%, 57.6%]
                               after MISS  28/71  =  39.4% [28.9%, 51.1%]
                               stratified permutation p = 0.4153  (6/8 informative strata)

  ── full next-delta table, stratified permutation G-test (20000 iters)
    strata = (k, prevDelta)            G = 54.177   p = 0.1073   (10/12 informative, n = 211)
    strata = (k, prevDelta, fromCell)  G = 49.835   p = 0.8972   (31/88 informative, n = 211)

  ── verdict
    6 tests run; smallest raw p = 0.0212 (k=2 P(repeat)); Bonferroni-adjusted p = 0.1275.
```

The k=2 P(repeat) row is the one worth naming honestly: 3/28 vs 1/71 looks
striking and is the smallest raw p in the family, but it rests on four events
total. Seeds 7 and 99 give raw p 0.0237 and 0.0221 (adjusted 0.143 and 0.133),
so it is stable but stably unconvincing. **If a future batch grows k=2's n, this
is the specific cell to re-check first.**

## E. Off-policy replay, full report

```
▸ off-policy replay — today's stack against 68 real recorded casts
  focus-reserve weight 3; ring model + contextual fallback, matcher tier OFF;
  every cast scored against models refit WITHOUT it.

  ── catch rate
    counterfactual : 19/68 = 27.9%  [18.7%, 39.6%]
    actually played:  7/68 = 10.3%  [ 5.1%, 19.8%]

  ── per-turn hit rate, on exactly the same turns
    counterfactual : 111/218 = 50.9%  [44.3%, 57.5%]
    actually played:  60/218 = 27.5%  [22.0%, 33.8%]
    discordant turns: new hit / old missed = 73; old hit / new missed = 22

  ── paired per-turn log loss, baseline (contextualFallback) minus ring policy
    2.115 ± 0.751  95% CI [1.364, 2.866]  (n = 218, sd 5.658)

  ── outcome mix
    caught                19
    escaped (meter maxed) 20
    TRUNCATED at record   29   <- would have played on; scored as not caught
    hand exhausted         0
    no affordable card     0

  ── decomposition
    catch rate     actually played  10.3%
                -> new predictor, OLD (transposed) zone geometry  20.6%
                -> new predictor, corrected zone geometry         27.9%
    hit rate       actually played  27.5%
                -> new predictor, OLD (transposed) zone geometry  42.8%  (92/215)
                -> new predictor, corrected zone geometry         50.9%  (111/218)

  ── of the 29 casts cut short, 29 were still live when the record ran out.
     mean fish HP at cutoff: 43.3% of max (100% = escaped).
```

Reading the decomposition honestly: "actually played" is itself a MIX of
predictors — most of the 69 casts predate the ring model, a few (sessions 45-46)
used it. So the 27.5% → 42.8% step overstates the ring model's marginal
contribution over the *current* live config and understates nothing. The
42.8% → 50.9% step is clean: identical predictor, identical trajectories,
identical policy, only the zone template differs.

The mismatched-zone arm is implemented as a reflection of the fish's cell about
the focus point's diagonal. That is exact rather than approximate: the two
templates differ by `swap`, an involution, so "plan with `swap∘true`, resolve
with `true`" and "plan with `true`, resolve with `swap∘true`" are the same
mismatch with the sign flipped. It avoids threading an alternative zone map
through `chooseCard`/`bestFocusForCard` — i.e. avoids surgery on shipped
strategy code for a diagnostic.

## F. Focus-reserve sweep, full output

```
  A. RING model (the §1 policy) vs empirical fish
    weight          seed 1                 seed 500000
             catch% / hit% / fishHP    catch% / hit% / fishHP
         0     31.8% / 47.7% / 9.50      31.9% / 47.9% / 9.51
         1     31.8% / 48.3% / 9.18      31.9% / 48.3% / 9.26
         2     32.9% / 49.0% / 8.93      32.5% / 48.8% / 9.09
         3     35.1% / 49.9% / 8.53      34.0% / 49.4% / 8.82   <- peak
         4     34.2% / 49.9% / 8.64      33.1% / 49.2% / 8.96
         6     27.8% / 48.8% / 9.70      27.9% / 48.7% / 9.75
         8     23.5% / 48.5% /10.34      23.4% / 48.4% /10.43
        12     16.5% / 45.5% /11.25      16.6% / 45.1% /11.37

  B. RING + mined matcher, ring-intersected:  peak w=4 (40.0/39.6), w=3 39.7/39.1
  C. today's live config:                     peak w=3 (29.6/29.9)

  focus-budget exhaustion — RING model
    weight    % casts exhausting   median turn
         0                 75.5%             4
         3                 64.1%             5
         8                 15.7%             6
```

`DEFAULT_FOCUS_RESERVE_WEIGHT` stays 3. Catch rate and hit rate agree on the
plateau in all three arms, which was worth confirming rather than assuming —
the two axes are separable (session 46's HIGH deck arm has the lowest hit rate
AND a higher catch rate than MID).

## G. §1e — the exact three dungeon sites

`UnexpectedResponseError.message` is only `"Unexpected response from <path>:
HTTP <status>"`. Sites that logged only `(e as Error).message`:

- `scripts/liveRun.ts` `runOnce` — `fail(guards, log, "start_run rejected", ...)`
- `scripts/liveRun.ts` `runOnce` — `fail(..., "dungeon action rejected", ...)`
- `scripts/liveRun.ts` `postWithVerifiedRetry` — `post_attempt_failed`

Verified the new regression test is not vacuous by reverting just the first
line; the log then contained only:

```
{"event":"action_failed","reason":"start_run rejected",
 "detail":{"error":"Unexpected response from /game/dungeon/action: HTTP 400"}}
```

The repo-wide grep for any other classifier testing a pattern against
`.message` returned exactly one hit — the fishing server-cap one, already fixed
in session 46. No third instance.

## H. What was NOT done, deliberately

- **No live call of any kind.** The brief forbade playing even if the cap reset
  mid-session, and nothing here needed one.
- **No re-sweep of the charge-reserve plateau** — parked instead, with its
  unpark condition written into TASKS.md.
- **`data/ringPrediction.jsonl` left untouched.** Its 20 rows were logged by a
  policy aiming with the transposed map. The *predictions* remain valid, so
  deleting them would destroy good data; but any hit/EV field on them reflects
  mis-aimed shots. Flagged as an open question rather than decided unilaterally.
- **The pattern-matcher tier is off in the replay.** Its candidates are mined
  from the same corpus, and leave-one-cast-out on the ring table would not undo
  that leakage. This makes the replay understate the live stack.
