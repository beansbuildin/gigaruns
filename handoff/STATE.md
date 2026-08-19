# STATE — session 44 — 2026-08-18 — commit b75cfb2

## Status
Session-44 brief's task: "fishing's 14.0% live catch rate is not acceptable
— hammer out fishing refinements." **GATE FAIL, not softened.** The
all-time figure moved 14.0%(7/50) → 10.4%(7/67); today's own 16-cast batch
went 0/16 (0.0%). This is worse than the starting point, not better.
However, the session did not end in noise: a real, dominant, well-evidenced
root cause was found (focus-budget exhaustion, below) — confirmed in BOTH
live and sim domains, not attempted-and-abandoned. The brief's own honest-
expectations section anticipated a possible null result and asked for it to
be reported plainly if so; this went further than null, and that too is
reported plainly. Next per TASKS.md: Task 11's fishing half, revived with
a concrete fix candidate scoped and NOT yet implemented (see below) — this
is the clear top priority for the next fishing session, ahead of any other
fishing work.

## What works
- Pattern-mining ground truth reconfirmed, not stale: `mineFishPatterns.ts`
  re-run fresh against the real 169-transition/50-cast corpus (pre-session)
  confirms 2 patterns promoted (`perimeterWalk(cw)` support=4,
  `perimeterWalk(ccw)` support=3) — matches `data/minedFishPatterns.json`
  on disk exactly, and confirmed live-wired into `scripts/liveFishing.ts`'s
  `runOneCast`. SPEC.md §5 / TASKS.md's own prose was stale (still said "0
  promoted" from session 15) and is corrected in place.
- `use_fishing_item` action CONFIRMED via a user DevTools capture (item
  821, Lil Mana Oil) — same 6-field envelope as every other fishing
  action. Resolves QUESTIONS.md §16. Wired `oilPolicy.ts`'s
  `shouldConsiderRelaxingOil` into a real live call site in
  `scripts/liveFishing.ts` — reads the account's real Mid Relaxing Oil
  (937) balance once per cast, fires only when the heuristic's condition
  is met, fails closed (non-fatal) on a rejected `slotIndex` guess.
- QUESTIONS.md §15's open sub-question answered: a fresh `start_run`
  succeeds past the `COMPLETE_CID:true,SUCCESS_CID:false` "stuck" doc
  shape with no acknowledgment needed — confirmed TWICE live this session.
- Test suite: 632/632 passing, `tsc --noEmit` clean, `git diff --check`
  clean, all checked at this session's actual final commit (b75cfb2).

## What's broken
- **THE finding**: `chooseCard`/`bestFocusForCard` chronically burn the
  ENTIRE 3-point, non-regenerating focus budget within the first 2-4 turns
  of every cast, then play the rest of the cast — often 5-9+ more turns —
  from a frozen focus position while the fish drifts away. Confirmed
  16/16 in this session's live batch (every cast hit `focusMeter:0` by
  turn 1-4) AND in the sim (43% of N=300 simulated casts by median turn 2,
  direct instrumentation of the real decision code). Diagnosed FIRST by
  the user, off their own reading of the account's real mid-cast state
  (7/10 mana, 0/3 focus) — not found by this session's own analysis first.
  Root cause: the EV formula is purely single-turn-greedy, with zero cost
  on depleting a scarce multi-turn resource early. See SPEC-fishing.md §4c
  for the full writeup. **Not fixed this session** — asked the user
  directly (document-only vs. design-and-validate-a-fix-now); user chose
  document-only, consistent with CLAUDE.md §4 ("simulate first"). Proposed
  fix shape: a focus-reserve continuation term in `bestFocusForCard`'s
  scoring, mirroring the dungeon side's `chargeReserveWeight` precedent
  (2026-08-18 session 34) — sim-ablate at real N before any live wiring.
- Graceful SIGINT is NOT wired in either direct-CLI entry point
  (`scripts/liveRun.ts`, `scripts/liveFishing.ts`) — only
  `scripts/orchestrator.ts` installs the handler. Found live: stopping
  this session's batch via `kill -INT` fell through to Node's default
  immediate-termination instead of the documented graceful stop. Confirmed
  harmless THIS TIME (no orphaned/double-counted state), but that was
  circumstance. Not fixed this session (out of scope, found while
  diagnosing something else).
- Heuristic (d) `pruneReturnToPrevious` causes a real, reproducible ~2pp
  catch-rate REGRESSION in the sim (N=20000, two independent seeds),
  traced entirely to `patterns.ts`'s `bounceDelta` wall-reflection
  primitive doing exactly what the heuristic forbids on its bounce turn.
  Zero counterexamples found in the real corpus (67 casts, both before and
  after this session's live batch) — sim-domain-only finding, not acted
  on. Heuristics (a)/(f) show no measurable effect, exactly as their
  provably-EV-neutral tie-break design predicts.
- One cast (docId `12975755`) left mid-play at turn 3, unresolved —
  resumable, not force-completed, per the user's stop instruction.

## Corrections to SPEC.md
- §5: corrected from session-15/21's stale "0 primitives promoted, 1
  near-miss" framing to the real current state (2 promoted, reconfirmed
  fresh this session).
- New §4c (SPEC-fishing.md): the focus-budget-exhaustion finding, full
  writeup, not previously documented anywhere.
- §8 (SPEC-fishing.md): heuristic (d)'s sim-domain regression finding
  added, real-corpus audit result (0 counterexamples) added.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged, dungeon side untouched this session).

## Dead ends
None abandoned — every thread opened this session (pattern-mining
reverification, heuristic ablation, live batch, focus-budget diagnosis,
oil-use wiring) reached a concrete, documented conclusion.

## Metrics
- Sim: matcher BLIND 7.0-9.2% vs. MINED library 22.4-24.2% (N=500/3000,
  two independent seeds — note `simulateCasts`'s `seed+i` internal draw
  means two seed BASES must be far apart for genuine independence, a real
  gotcha found this session). Heuristic ablation (a,d,f) at N=20000, two
  seeds: all-on 21.9-22.1%, all-off 23.8-24.2% — (d) alone drives the
  entire ~2pp gap. Focus-budget exhaustion: 129/300 (43%) sim casts
  exhaust by median turn 2.
- Live (fishing only, no dungeon work this session): 16 completed casts
  today (15 new `start_run`s + 1 resumed pre-existing cast), 0 caught.
  192/240 daily energy spent. All-time: 67 casts, 7 caught (10.4%, down
  from 14.0%/50 pre-session).

## Open questions for Claude
1. **Top priority**: design + sim-validate a focus-budget-reserve
   continuation term for `bestFocusForCard` (SPEC-fishing.md §4c, mirrors
   `chargeReserveWeight`) — this is a code+sim task, not a capture
   question, and it's the clear next step before any more live fishing
   budget is spent.
2. Wire graceful SIGINT into `liveRun.ts`'s and `liveFishing.ts`'s own
   `main()` functions (TASKS.md Task 10) — small, low-risk, already-proven
   pattern from `orchestrator.ts`. Not urgent but a real gap.
3. Heuristic (d)'s sim-domain regression: worth deciding whether to gate
   it (e.g., skip pruning when the recent trajectory looks bounce-like) or
   leave as-is pending more real-corpus evidence — not urgent, no live
   counterexample yet.
4. Standing from session 40/41/42: scheduler energy-tracking gap,
   charge-reserve plateau — none addressed, none urgent.

## Files changed
```
 QUESTIONS.md                        |  16 ++
 SPEC-fishing.md                     | 125 +++++++++++++++++++++++++---
 SPEC.md                             |  32 +++++--
 TASKS.md                            |  72 ++++++++++++++
 handoff/DECISIONS.md                |   6 ++
 handoff/reports/dungeon-runs.md     |   2 +-
 handoff/reports/fishing-casts.md    |  21 +++-
 scripts/auditPruneCounterexample.ts |  71 (new)
 scripts/fishingHeuristicAblation.ts |  79 (new)
 scripts/liveFishing.ts              |  69 ++
 scripts/mineFishPatterns.ts         |  12 ++
 src/api/fishing.ts                  |  18 ++
 src/sim/fishing/castSim.ts          |  29 ++
 src/strategy/fishing/cardChoice.ts  |  41 ++
 src/strategy/fishing/oilPolicy.ts   |  25 ++
 tests/fishing/cardChoice.test.ts    |  59 (new tests)
 tests/liveFishing.test.ts           |   9 +
 tests/sim/fishingCorpus.test.ts     |  34 ++
 18 non-fixture files, 660 insertions, 60 deletions
 + fixtures/fishing-casts/live/cast-2026-08-19-*/ (110 files, 17 casts —
   today's live batch, one still incomplete at turn 3)
```
