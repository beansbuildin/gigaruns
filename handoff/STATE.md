# STATE — session 37 — 2026-08-18 — commit 7bd53b5

## Status
Task "CODEXAUDIT #5: centralize durable atomic writes with a real fsync"
(finishes CODEXREVIEW #2, open since session 28): **GATE PASS** — the
session's whole required scope. Stretch item CODEXAUDIT #6 (opponent-model
schema tightening) also done. No `TASKS.md` gate targeted, same as sessions
31-36 — this is Codex-backlog cleanup, not a numbered project task.
Next per TASKS.md: no numbered task is active; Codex backlog has two items
left (CODEXAUDIT #2, #4 — see Open questions).
Overall: the fsync gap CODEXREVIEW #2 asked for in session 28 is closed for
real across all three persistence modules, verified by a spy that the
syscall actually fires, not just that the code compiles.

## What works
- `src/orchestrator/atomicWrite.ts` (new): one shared `atomicWriteJson(path,
  body)` — sibling temp file, `openSync`/`writeSync`/`fsyncSync`/`closeSync`,
  `renameSync` into place, best-effort parent-dir fsync (own try/catch).
  Temp file cleaned up on any failure before rename. `guardPersistence.ts`,
  `opponentModelPersistence.ts`, `playCountsPersistence.ts` all route their
  save function through it now — mechanical extraction, no body-construction
  logic touched. Verified: `tests/orchestrator/atomicWrite.test.ts` (8
  tests) — `fsyncSync` spy-confirmed to fire on save, temp-file cleanup on
  simulated rename/fsync failure, directory-fsync failure doesn't throw, all
  pre-existing round-trip/corruption tests in the three original modules
  pass unchanged.
- Opponent-model persistence schema (CODEXAUDIT #6): counts are now
  `z.number().int().nonnegative()` (was bare `z.number()`); a new `.refine()`
  rejects a transition row whose sum exceeds its marginal predecessor count
  (structurally impossible under `OpponentModel.observe()`'s own
  accounting). Verified: 4 new tests (negative count, fractional count, a
  violating row, and the exact-equality boundary case confirmed NOT to
  throw) in `tests/orchestrator/opponentModelPersistence.test.ts`.
- Tests: **545/545 passing** (533 baseline + 8 + 4). `npx tsc --noEmit`
  clean, `git diff --check` clean, both at this session's final commit.

## What's broken
Nothing this session's changes broke — full suite green, tsc clean, at the
actual final commit. Two real gaps from the independent Codex audit remain
open, unattempted this session by explicit brief scope: CODEXAUDIT #2
(fishing calibration), CODEXAUDIT #4 (`nextPosition` gate). Unchanged since
session 25: scheduler can't learn energy gained outside its own tracking; a
SIGINT during an energy-regen sleep ends the whole session.

## Corrections to SPEC.md
None this session. Resolved IDs unchanged: forbiddenWoods=5, dendren
nodeId="5"/pondId=2. Move charges: PRESENT (unchanged).

## Dead ends
None. `vi.spyOn` cannot target Node's built-in ESM module exports directly
("module namespace is not configurable in ESM") — switched to
`vi.mock("node:fs", { spy: true })`, which auto-spies every export while
calling through to the real implementation by default. Recorded here so the
next session doesn't rediscover this the hard way when testing another
fs-touching module.

## Metrics
No sim runs, no live dungeon or fishing calls this session — pure code/test
work per explicit brief scope, same as sessions 35-36. Test-count delta: 533
-> 545 (+12).

## Open questions for Claude
1. Two real gaps from the independent audit remain open, neither attempted
   this session: **CODEXAUDIT #2** (fishing contextual fallback's log-loss
   regression — shrink toward cell-only instead of hard-switching at
   `minIndependentCasts`, `src/strategy/fishing/contextualFallback.ts`);
   **CODEXAUDIT #4** (`nextPosition` override gate counts raw hits, not
   hits-out-of-attempts, needs a real accuracy/confidence-bound gate plus
   schema/grid-bounds validation, `scripts/liveFishing.ts`). Both are real
   and roughly comparable in scope/age now — a genuinely open choice for the
   next brief, not a forced one the way #5 was (oldest + broadest-leverage).
2. Standing since sessions 30-36: QUESTIONS.md §15 (stuck fishing account
   after an escape) still needs a human DevTools capture.
3. Also standing: Task 14 (bot-initiated juiced `start_run`) blocked on a
   live DevTools capture, not code. Charge-reserve plateau (0.4/0.5/0.6
   mutually indistinguishable) — not urgent.

## Files changed
```
 handoff/DECISIONS.md                                |   4 +
 src/orchestrator/atomicWrite.ts                      |  69 ++ (new)
 src/orchestrator/guardPersistence.ts                 |  15 +-
 src/orchestrator/opponentModelPersistence.ts         |  47 ++--
 src/orchestrator/playCountsPersistence.ts            |  18 +-
 tests/orchestrator/atomicWrite.test.ts                | 118 ++ (new)
 tests/orchestrator/opponentModelPersistence.test.ts   |  51 ++
 7 files changed, ~380 insertions, ~150 deletions
```
