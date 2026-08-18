# STATE — session 29 — 2026-08-18 — commit c460b7c

## Status
No TASKS.md gate was targeted this session — the brief was two Tier 2
CODEXREVIEW items promoted out of the queue: #5 (resumed fishing casts
corrupting transition numbering) and #6 (server-side daily caps not used as
real scheduling state). Task 10 stays the last GATE PASS (session 25,
unchanged); this session touched none of that path.
Overall: both CODEXREVIEW items are implemented with regression tests, no
live play happened, and everything is committed and pushed.

## What works
- **Resumed-cast transition numbering (CODEXREVIEW #5) is fixed.**
  `scripts/liveFishing.ts`'s `runOneCast` derives the next turn to log from
  `lastRecordForCast()` (new) instead of always restarting a resumed cast at
  turn 0, and validates the resumed doc's real position against the log's
  last entry before trusting it enough to append further — a mismatch
  disables logging for that cast for the rest of this run instead of
  risking a second wrong write. Verified by unit test against a fabrication
  of the exact real bug (`tests/liveFishing.test.ts`).
- **`mineFishPatterns.ts` now REJECTS corrupted casts instead of silently
  miscounting them.** `groupByCast`/`testPrimitives` flag turns with
  conflicting duplicate records or gapped trajectories and exclude those
  whole casts from exact-match testing (reported as `excluded`, with
  reasons) — the old code skipped gaps mid-loop and still called the result
  an exact full match. Verified by re-running the miner against the real
  local corpus: cast `12923189` (the exact bug — two turn-0 records ~5
  minutes apart) is now correctly excluded, and both of session 28's
  promotions survive unchanged (`perimeterWalk(cw)` support=4,
  `perimeterWalk(ccw)` support=3). `tests/mineFishPatterns.test.ts` (new)
  reproduces the exact scenario.
- **Dungeon-side server-cap reconciliation (CODEXREVIEW #6) is live.**
  `scripts/liveRun.ts`'s `runOnce` now calls the new
  `assertDungeonCapNotExhausted()` right before any genuinely NEW
  `start_run` — checks the cheap local guard first, then
  `GET /game/dungeon/today`'s real count. A confirmed server-exhausted cap
  blocks BEFORE the POST (never "attempt and eat a rejection") and marks
  the local guard exhausted for the rest of the persisted day via the new
  `GuardState.recordServerCapReached()`. Never runs on a resume.
- **Guard-budget date-keying now rolls over at 11am Pacific, not UTC
  midnight, for both modes.** `guardPersistence.ts`'s `todayKey()` is
  DST-aware via `Intl`/`America/Los_Angeles` — user-confirmed real reset
  boundary (QUESTIONS.md §13, resolved this session). Root-cause fix for
  session 24's dungeon drift and session 27's wasted fishing `start_run`.
  Verified DST-safe across the 2026-11-01 PDT→PST boundary.
- **Fishing's confirmed server-cap rejection is now a backstop, not a
  whole-process killer.** `liveFishing.ts`'s `start_run` rejection handler
  detects the real message (`"Player has reached max runs for fishing"`,
  session 27) and reclassifies it into a budget-type `GuardTrip` via
  `recordServerCapReached()`, so hitting fishing's real cap no longer risks
  taking the orchestrator's dungeon side down with it. Fishing still has no
  authoritative pre-check endpoint, so it stays fail-closed on rejection
  rather than proactive, per the brief.

## What's broken
Nothing newly broken by this session's changes — 454/454 tests pass (up
from 428/428 at session 28's end), `npx tsc --noEmit` clean, both verified
against this session's final commit. Unchanged, pre-existing open items:
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends the
  whole session (unchanged since session 25).

## Corrections to SPEC.md
None this session — both fixes are bot-internal bookkeeping (transition
logging, guard scheduling), not corrections to a modeled game mechanic.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
- **Found, investigated, and deliberately left unresolved**: while
  re-running the miner, `data/fish-patterns.jsonl` (gitignored local data,
  not the committed corpus) turned out to have 8 records with castId
  `"9001"`/`"9002"` — a 4-digit shape never seen elsewhere in the real
  corpus, all zero-movement (`from`/`to` both `[0,0]`). Removed them as
  apparent one-off pollution, then found the SAME castIds reappear with new
  timestamps and incrementing turns WHILE this session was running —
  meaning an unidentified process is actively writing to this file
  concurrently. Stopped touching the file rather than guess further. Does
  not affect anything committed (data/ is gitignored) or this session's own
  code/tests. Full writeup: QUESTIONS.md §14 — needs the user to identify
  the source before `data/minedFishPatterns.json`'s third pattern
  (`twoCellCycle(0,-1)`) can be trusted.

## Metrics
- No live play this session (no dungeon runs, no fishing casts sent) —
  pure bug-fix session, consistent with the brief's scope.
- Tests: 454/454 passing (+26 new: `lastRecordForCast` ×3,
  `mineFishPatterns` groupByCast/testPrimitives/12923189-scenario ×9,
  `GuardState.recordServerCapReached` ×3, `todayKey` Pacific-rollover/DST
  ×5, dungeon-cap-reconciliation ×5, fishing server-cap backstop ×2, one
  pre-existing stage-2 count assertion updated in place).
- Real fishing corpus (`data/fish-patterns.jsonl`, corrected): 50 real
  casts, 169 real turns; `12923189` now correctly excluded from mining
  rather than silently miscounted.

## Open questions for Claude
1. QUESTIONS.md §14 (new): what's writing castId `9001`/`9002` into
   `data/fish-patterns.jsonl`? Worth asking the user directly at the top of
   next session — cheap to ask, currently taints one mined pattern.
2. Unchanged from session 28: which CODEXREVIEW/CODEXIMPROVE items are
   worth queuing next? Remaining: CODEXREVIEW #8 (split committed-vs-
   observed energy accounting), CODEXIMPROVE #1 (persist/bootstrap the
   dungeon opponent model), CODEXIMPROVE #2 (resource-conserving fishing
   tie-breaks), #9/#10 (docs/dependency cleanup, lower priority).
3. Session 30's three queued items (run-visibility reporting, acting on
   `nextPosition` when it fires, Dual Yield forward detection) are still
   queued and unscoped, per session 28's next.md — untouched this session.
4. `assertDungeonCapNotExhausted`'s new `GET /game/dungeon/today` call
   fires on every genuinely-new `start_run` attempt now, unit-tested only
   (mocked client) — worth a deliberate live check next time
   `liveRun.ts`/`orchestrator.ts` runs for real.

## Files changed
```
 QUESTIONS.md                                |  44 ++++-
 scripts/liveFishing.ts                      |  78 ++++++++-
 scripts/liveRun.ts                          |  36 ++++
 scripts/mineFishPatterns.ts                 |  90 ++++++++--
 src/orchestrator/guardPersistence.ts        |  49 +++++-
 src/orchestrator/guards.ts                  |  17 ++
 tests/guards.test.ts                        |  27 +++
 tests/liveFishing.test.ts                   | 129 ++++++++++++++
 tests/liveRun.test.ts                       | 148 +++++++++++++++-
 tests/mineFishPatterns.test.ts (new)        | 128 ++++++++++++++
 tests/orchestrator/guardPersistence.test.ts |  31 ++++
 11 files changed, 877 insertions(+), 157 deletions(-)
```
