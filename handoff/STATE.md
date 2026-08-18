# STATE — session 29 — 2026-08-18 — commit (pending, see below)

## Status
No TASKS.md gate was targeted this session — the session-29 brief was two
Tier 2 items promoted out of the CODEXREVIEW queue: #5 (resumed fishing
casts corrupting transition numbering) and #6 (server-side daily caps not
used as real scheduling state). Task 10 stays the last GATE PASS (session
25, unchanged); this session touched none of that path. Both brief items are
implemented with regression tests, per the brief's own instruction not to
start CODEXIMPROVE items or CODEXREVIEW #8 this session.

## What works
- **Resumed-cast transition numbering (CODEXREVIEW #5) is fixed.**
  `scripts/liveFishing.ts`'s `runOneCast` now derives the next turn to log
  from `lastRecordForCast()` (new) instead of always restarting a resumed
  cast at turn 0, and validates the resumed doc's real position against the
  log's last entry before trusting it enough to keep appending — a mismatch
  disables further logging for that cast this run rather than risking a
  second wrong write. `scripts/mineFishPatterns.ts`'s `groupByCast` now
  flags turns with conflicting duplicate records and gapped trajectories;
  `testPrimitives` REJECTS both categories from exact-match testing entirely
  (reported as `excluded`, with reasons) rather than the old behavior of
  skipping gaps mid-loop and still calling the result an exact full match.
- **Both promotions survive, confirmed by direct re-run against the real
  corpus**: `perimeterWalk(cw)` (support=4) and `perimeterWalk(ccw)`
  (support=3) are unchanged after cast `12923189` (the exact bug CODEXREVIEW
  #5 named — two turn-0 records ~5 minutes apart) is correctly excluded as a
  duplicate. See "Dead ends / surprises" below for a THIRD candidate that
  the fix also correctly prevented from being falsely promoted.
- **Dungeon-side server-cap reconciliation (CODEXREVIEW #6) is live.**
  `scripts/liveRun.ts`'s `runOnce` now calls `assertDungeonCapNotExhausted()`
  (new) right before any genuinely NEW `start_run` — checks the local guard
  cheaply first (no network if already tripped locally), then
  `GET /game/dungeon/today`'s real count. A confirmed server-side exhausted
  cap throws BEFORE the POST is ever attempted (never "attempt and eat a
  rejection") and marks the local guard exhausted for the rest of the
  persisted day via the new `GuardState.recordServerCapReached()`, so a
  later invocation the same day fails closed locally without a further
  round-trip. Never runs on a resume (resuming costs no new run slot).
- **Guard-budget date-keying now rolls over at 11am Pacific, not UTC
  midnight, for BOTH modes** — `guardPersistence.ts`'s `todayKey()` is
  DST-aware via `Intl`/`America/Los_Angeles` (no hardcoded UTC offset),
  per direct user confirmation this session (QUESTIONS.md §13, now
  resolved) that both dungeon and fishing reset at 11am Pacific. This is the
  root-cause fix behind session 24's dungeon drift and session 27's wasted
  fishing `start_run` attempt.
- **Fishing's confirmed server-cap rejection is now a backstop, not a
  whole-process killer.** `scripts/liveFishing.ts`'s `start_run` rejection
  handler detects the real message (`"Player has reached max runs for
  fishing"`, session 27) and reclassifies it via `recordServerCapReached()`
  into a budget-type `GuardTrip` (`isBudgetGuardTrip` now recognizes it),
  persisted immediately — so a real cap hit on one mode no longer risks
  taking the orchestrator's OTHER mode down with it. Fishing still has no
  authoritative pre-check endpoint (per the brief, this stays fail-closed
  on rejection rather than proactive, unlike dungeon).

## What's broken
Nothing newly broken by this session's changes — 454/454 tests pass (up
from 428/428 at session 28's end, +26), `npx tsc --noEmit` clean, verified
against this session's final commit. Unchanged, pre-existing open items:
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends the
  whole session (unchanged since session 25).
- CODEXREVIEW #8 (split committed-vs-observed energy accounting) and every
  CODEXIMPROVE item remain queued, not started this session, per the brief.

## Corrections to SPEC.md
None to SPEC.md/SPEC-fishing.md this session — both fixes are bot-internal
bookkeeping (transition logging, guard scheduling), not corrections to a
modeled game mechanic.

## Dead ends / surprises
- **`data/fish-patterns.jsonl` (gitignored local data, not the committed
  corpus) is under ACTIVE concurrent write from an unidentified process.**
  While re-running the miner to verify the CODEXREVIEW #5 fix, I found 8
  records with castId `"9001"`/`"9002"` — a 4-digit shape never seen
  anywhere else in this project's real corpus (real docIds are always
  8 digits) — all `from:[0,0]`/`to:[0,0]` (zero movement). I treated this as
  one-off test pollution and removed it, then re-ran the miner (both
  promotions confirmed clean). Before this session's other work finished,
  the SAME castIds reappeared with NEW timestamps and incrementing turn
  numbers (0→1→2→3) spread across real wall-clock minutes — meaning
  something was actively writing to this file DURING this session, not a
  stale artifact I'd already found. I could not identify the source
  (`ps aux` from this sandbox showed nothing matching) and have NOT touched
  the file again since. Full writeup and the open question: QUESTIONS.md §14.
  This does not affect anything committed to git or any of this session's
  code/tests — it only affects the live-runtime `data/minedFishPatterns.json`
  a real `liveFishing.ts` invocation would currently seed from, which right
  now (as of this recap) has a THIRD pattern (`twoCellCycle(0,-1)`)
  promoted on the strength of those unexplained 9001/9002 casts plus one
  real one (12945319) — do not trust that third promotion until §14 is
  resolved; the two `perimeterWalk` promotions do not depend on it.
- The `9001`/`9002` question is exactly the kind of thing CLAUDE.md §1
  ("discover, don't assume") wants surfaced rather than silently
  papered over — flagging it here and in QUESTIONS.md rather than guessing
  at a heuristic to filter it in the miner.

## Metrics
- No live play this session (no dungeon runs, no fishing casts sent by
  this session's own code) — pure bug-fix session, consistent with the
  brief's scope.
- Tests: 454/454 passing (+26 new regression tests: `lastRecordForCast` ×3,
  `mineFishPatterns` groupByCast/testPrimitives/12923189-scenario ×9,
  `GuardState.recordServerCapReached` ×3, `todayKey` Pacific-rollover/DST
  ×5, dungeon-cap-reconciliation ×5, fishing server-cap backstop ×2, minus
  1 pre-existing stage-2 test count-assertion updated in place). `npx tsc
  --noEmit` clean, verified against this session's final commit.
- Real fishing corpus (`data/fish-patterns.jsonl`, corrected): 50 real
  casts, 169 real turns, `12923189` now correctly excluded from mining as a
  duplicate rather than silently miscounted — see `data/minedFishPatterns.json`
  caveat above re: the unresolved `9001`/`9002` question.

## Open questions for Claude
1. QUESTIONS.md §14 (new, this session): what's writing castId `9001`/`9002`
   into `data/fish-patterns.jsonl`? Worth asking the user directly at the
   top of next session — it's cheap to ask and currently taints one mined
   pattern's promotion status.
2. Unchanged from session 28: which CODEXREVIEW/CODEXIMPROVE items are
   worth queuing next? Remaining after this session: CODEXREVIEW #8 (split
   committed-vs-observed energy accounting), CODEXIMPROVE #1 (persist/
   bootstrap the dungeon opponent model), CODEXIMPROVE #2 (resource-
   conserving fishing tie-breaks), #9/#10 (docs/dependency cleanup, lower
   priority).
3. Session 30's three queued items (run-visibility reporting, acting on
   `nextPosition` when it fires, Dual Yield forward detection) are still
   queued and unscoped in detail, per session 28's next.md — untouched
   this session, not superseded by anything found here.
4. `assertDungeonCapNotExhausted`'s new `GET /game/dungeon/today` call
   happens on every genuinely-new `start_run` attempt now (not just once
   per invocation like the existing `main()`-level drift print) — this is
   an extra GET per dungeon run started, within the existing rate limiter,
   not yet live-verified beyond unit tests against a mocked client. Worth a
   deliberate live check next time `liveRun.ts`/`orchestrator.ts` runs for
   real, not urgent enough to block on.

## Files changed
```
$ git diff --cached --stat
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
 handoff/STATE.md                            | (this file, not counted below)
 11 code/doc files changed, 879 insertions(+), 158 deletions(-)
```
