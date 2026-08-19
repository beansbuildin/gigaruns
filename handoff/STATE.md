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
     src/sim/fishing/castTrace.ts               | 268  (3rd corpus view, full per-turn state)
     src/orchestrator/energyPreflight.ts        | 230  (§1a, ROM-aware)
     tests/orchestrator/energyPreflight.test.ts | 183
     tests/fishing/offPolicyReplay.test.ts      | 163
     scripts/offPolicyReplay.ts                 | 114  (report + zone-fix decomposition)
     scripts/liveFishing.ts                     | 106  (preflight, §1d reword, helper moved)
     src/sim/fishing/zoneAudit.ts               | 101
     SPEC.md                                    |  81  (zone + fullDeck corrections)
     tests/fishing/zoneTemplate.test.ts         |  72  (the missing regression guard)
     src/sim/fishing/geometry.ts                |  57  (ZONE_OFFSET TRANSPOSE FIX)
     scripts/auditZoneTemplate.ts               |  50
     TASKS.md                                   |  42  (§1f close + park)
     scripts/liveRun.ts                         |  38  (preflight, 3x error-body fix)
     src/api/errors.ts                          |  37  (serverErrorDetail moved here)
     scripts/orchestrator.ts                    |  34  (claim before you sleep)
     ... + tests/liveRun.test.ts 31, scheduler.ts 24, SPEC-fishing.md 22,
         focusReserveAblation.ts 14, scheduler.test.ts 7, cardChoice.test.ts 7
```
