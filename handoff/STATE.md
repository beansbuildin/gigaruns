# STATE — session 32 — 2026-08-18 — commit 6fc3b94

## Status
No TASKS.md gate was targeted this session — same as session 31, the brief
was the CODEXIMPROVE queue: §1 (persist and bootstrap the dungeon opponent
model, CODEXIMPROVE #1 — queued twice, session 30 and 31, finally built)
and §2 (test-isolation hygiene: write the isolated-test-path rule into
CLAUDE.md, then one grep audit pass). Task 10 stays the last GATE PASS
(session 25, unchanged); this session touched none of that path.
Overall: both items landed exactly as briefed, live-verified (not just
unit-tested), 500/500 tests passing (+12 from session 31's 488).

## What works
- **The dungeon opponent model now persists across restarts** (CODEXIMPROVE
  #1). New `src/orchestrator/opponentModelPersistence.ts` mirrors
  `guardPersistence.ts`'s already-established patterns rather than
  reinventing them: `schemaVersion` (zod `z.literal`, rejects on mismatch —
  nothing to migrate yet at version 1), atomic temp-file+rename save, and
  `acquireGuardLock` reused directly against the model's own path for a
  single writer (no second locking mechanism built). `OpponentModel` itself
  stays pure — only its internal `Counts` type gained an `export` keyword so
  the persistence layer can type against the exact `toJSON`/`fromJSON`
  shape; no I/O was added to the strategy module.
- **Bootstrap from the fixture corpus, idempotent across launches.** Folds
  every clean (`reasons.length === 0`) historical dungeon exchange into the
  model, gated by a persisted `bootstrapImportedIds` set keyed on
  `${run}::${label}` (a label alone isn't unique across runs, DECISIONS
  2026-08-15) — safe to call on every launch: already-imported exchanges are
  skipped, newly grown corpus is picked up automatically. Wired into both
  `scripts/liveRun.ts` and `scripts/orchestrator.ts` (load+bootstrap+lock at
  startup; save after every real `model.observe()` via a new opt-in
  `opponentModelPersistence` field on `LiveRunDeps`, `undefined` by default
  so no existing test touches the real file).
- **Live-verified, not just unit-tested**: a real `npx tsx scripts/
  liveRun.ts --dry-run` invocation bootstrapped 64 real clean room-1
  exchanges (enemy "Enemy Room 63") on its first run, correctly wrote
  `data/opponent-model.json` (schemaVersion 1, one key
  `"Enemy Room 63|room1"`, 64 total observations split 23/24/17 across
  rock/paper/scissor), and a second invocation immediately afterward
  imported 0 new exchanges — the dedup holds live, not just in the unit
  tests. No `.lock` file was left behind after either run.
- **Regression tests cover exactly what CODEXIMPROVE #1 asked for by name**
  (`tests/orchestrator/opponentModelPersistence.test.ts`, 12 tests): a
  model's predictions survive a simulated restart (save, "restart" via a
  fresh `loadOpponentModel`, `predict()` output identical — including
  `confidence: "high"`, so the comparison isn't vacuously below the
  30-observation floor); a corrupt file on disk fails closed (throws
  `OpponentModelPersistenceError`) rather than silently resetting to a
  blank model — the same fail-OPEN bug class CODEXREVIEW #2 already fixed
  for guard-budget persistence; a `schemaVersion` mismatch is rejected the
  same way; atomic-write leaves no temp file; bootstrap against the real
  corpus imports >0 the first call and exactly 0 the second (both in-memory
  and across a simulated restart).
- **CLAUDE.md's working-style section now states the isolated-test-path
  rule explicitly** (CODEXIMPROVE queue §2), instead of leaving it as
  unwritten convention. Grep audit for other `LiveFishingDeps`/
  `LiveRunDeps` test constructions missing an isolated path: **none found
  beyond the 3 already-fixed session-31 offenders** — every construction in
  `tests/liveRun.test.ts` and `tests/liveFishing.test.ts` goes through a
  single `makeDeps()` helper per file that always sets `guardStatePath`, so
  this is a genuine "last instance" result, not a padded clean one. No test
  anywhere opts into the new `opponentModelPersistence` dep, so §1 didn't
  introduce a new pollution risk either.

## What's broken
Nothing newly broken by this session's changes — 500/500 tests pass (up
from 488/488 at session 31's end), `npx tsc --noEmit` clean, both verified
against this session's final commit. Unchanged, pre-existing open items:
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends the
  whole session (unchanged since session 25).
- The real dungeon cap was already 12/12 for today at the start of this
  session too (server-confirmed carryover from session 31's own dry-run,
  not bot-caused) — both this session's `--dry-run` smoke tests guard-
  tripped cleanly on it, 0 energy spent either time.

## Corrections to SPEC.md
None this session — no live gameplay data was captured (both real API
calls this session were the same read-only `--dry-run` smoke-test pattern
session 31 used, purely to verify the new persistence/bootstrap wiring end
to end). Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/
pondId=2. Move charges: unchanged, PRESENT.

## Dead ends
None this session.

## Metrics
No live play this session (no dungeon runs started, no fishing casts sent)
— pure engineering plus two read-only `--dry-run` smoke tests, consistent
with the brief's scope. Both dry-run invocations correctly guard-tripped
before sending anything (real dungeon cap 12/12), 0 energy spent, confirmed
by console output both times.
- Tests: 500/500 passing (+12 new since session 31's 488, all in the new
  `opponentModelPersistence.test.ts`).
- Bootstrap: 64 clean room-1 exchanges imported from the real fixture
  corpus on first launch; 0 on the immediately-following second launch
  (idempotent, live-confirmed).

## Open questions for Claude
1. Same as session 30/31's open question 2 (unchanged): which CODEXREVIEW/
   CODEXIMPROVE items are worth queuing next? CODEXIMPROVE #1 is now DONE.
   Remaining: CODEXIMPROVE #3 (previous-direction contextual fishing
   fallback, needs its own cross-validation pass), #4/#5 (dungeon
   charge-reserve tie-breaking, boon valuation), #9/#10 from the older
   doc-cleanup list (lower priority — #10 was already resolved
   "not applicable" in session 31).
2. The bootstrap only ever found clean exchanges at room 1 (enemy "Enemy
   Room 63") in the real corpus — all 64 imported observations landed in a
   single `(enemyId, room)` key. This isn't a bug (rooms 2+ mostly carry
   unmodelled mechanics per the corpus's history, so `reasons.length === 0`
   correctly excludes most of them), but it means the model's live-usable
   advantage from bootstrapping is currently concentrated entirely at room
   1, where the model was already well-observed within a single long
   session anyway (session 25's 2-hour run alone generated comparable
   volume). The deeper-room, sparser-evidence case CODEXIMPROVE #1's
   rationale specifically named ("every restart throws away exactly the
   evidence that matters most in deeper, sparser rooms") won't visibly pay
   off until the corpus has more clean exchanges at rooms 2+, which is a
   capture question, not a code question — worth noting in the next brief
   rather than assuming the mechanism's value is fully realized yet.
3. Operator note, not a Claude(chat) planning question: this session's two
   `--dry-run` smoke tests each created an empty, untracked
   `fixtures/dungeon-runs/run-2026-08-18-*/` directory (no files inside —
   dry-run halts before any real capture) — harmless, git doesn't track
   empty directories, nothing to clean up, just noted for completeness
   since session 31 flagged a similar (unrelated, more consequential)
   cleanup mistake and this recap's discipline is to over-report rather
   than under-report incidental filesystem side effects.

## Files changed
```
 CLAUDE.md                                    | 14 ++++++++
 scripts/liveRun.ts                           | 40 +++++++++++++++++++++-
 scripts/orchestrator.ts                      | 21 +++++++++--
 src/orchestrator/opponentModelPersistence.ts | (new, 216 lines)
 src/strategy/opponentModel.ts                |  3 +-
 tests/orchestrator/opponentModelPersistence.test.ts | (new, 176 lines)
 6 files changed, 464 insertions(+), 4 deletions(-)
```
(handoff/next.md, this session's own brief, is excluded — consumed as
input, not a work product of this session.)
