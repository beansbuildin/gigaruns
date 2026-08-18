# STATE — session 39 — 2026-08-18 — commit c627c69

## Status
Task "CODEXAUDIT #4: fix the `nextPosition` override gate": **GATE PASS**.
No `TASKS.md` gate targeted — Codex-backlog cleanup, same framing as
sessions 31-38. **This closes the entire Codex-derived backlog**
(CODEXREVIEW's 10 + CODEXIMPROVE's 6 + CODEXAUDIT's 6, first opened
session 28) — the other four previously-claimed-fixed items were
re-verified live in the tree this session (grep-confirmed, not assumed),
per the brief's explicit request not to repeat sessions 35/36's overclaims.
Next per TASKS.md: no numbered task is active. See Open questions for a
recommendation on where the spine goes next.

**A second, unplanned finding this session was arguably bigger than the
planned one**: a real, currently-live data-corruption bug was found and
fixed before CODEXAUDIT #4 could even be trusted — see below.

## What works
- `scripts/liveFishing.ts`'s `nextPositionOverrideStats()`: replaces the
  old raw-hit-count gate (`NEXT_POSITION_OVERRIDE_THRESHOLD = 10`, counted
  ALL-time hits with no denominator) with a Wilson-score 95%-confidence
  lower bound on hits/attempts. Requires BOTH
  `NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS` (10 total attempts, not just hits)
  AND the lower bound clearing `NEXT_POSITION_OVERRIDE_MIN_LOWER_BOUND`
  (0.5). Verified directly: 10 hits buried in 90 interleaved misses (the
  audit's exact adversarial case) does NOT clear the gate (lower bound
  ~5.5%); a single early miss among later hits lowers but does not
  permanently zero out the bound (per-test: 1 miss + 19 hits still clears).
- `loadNextPositionValidations()` now schema-validates every line via zod
  (`NextPositionValidationSchema`) instead of a bare `JSON.parse(line) as
  NextPositionValidation` type assertion — a well-formed-but-wrong record
  (string `hit`, missing `gridSize`, out-of-`[1,gridSize]` coordinate,
  negative `turn`) is skipped, not trusted. One bad line doesn't lose the
  rest of the log (same convention as `loadTransitionLog`).
- `NextPositionValidation` now carries `gridSize` per-record (matching
  `TransitionRecord`'s existing convention — `gridSize` is read live per
  doc, never assumed constant). `extractNextPosition()` also bounds-checks
  the raw wire coordinate against the doc's own `gridSize` when present —
  defense in depth so an out-of-range sighting never reaches the log.
- Tests: **559/559 passing** (548 baseline, +11 new: schema-skip test,
  3 `wilsonLowerBound` tests, 5 `nextPositionOverrideStats` gate tests
  including the exact adversarial case, 2 `extractNextPosition` bounds
  tests). `npx tsc --noEmit` clean, `git diff --check` clean, both at this
  session's final commit.

## What's broken
Nothing shipped this session broke anything — full suite green, tsc clean,
at the actual final commit. Unchanged since session 25: scheduler can't
learn energy gained outside its own tracking; a SIGINT during an
energy-regen sleep ends the whole session.

## Corrections to SPEC.md
None this session. Resolved IDs unchanged: forbiddenWoods=5, dendren
nodeId="5"/pondId=2. Move charges: PRESENT (unchanged).

## Dead ends
None — the planned CODEXAUDIT #4 work landed as scoped.

## Metrics
No sim runs, no live dungeon or fishing calls this session — pure
code/test work, per explicit brief scope, same as sessions 35-38.
Test-count delta: 548 -> 559 (+11 net, all new).

## Open questions for Claude
1. **The Codex-derived backlog (22 items, sessions 28-39) is now genuinely
   closed** — re-verified this session, not just assumed:
   CODEXIMPROVE #1 (`bootstrapImportedIds` marked at the live-observe call
   site, `scripts/liveRun.ts:913`), CODEXIMPROVE #5 (`playCountsPersistence`
   wired into both `liveRun.ts` and `orchestrator.ts`), CODEXIMPROVE #6
   (`NonNegIntSchema` still rejects negative/fractional counts), CODEXREVIEW
   #2 (all three persistence modules route through `atomicWriteJson()`).
   **Recommend returning to the numbered `TASKS.md` list next** — Task 11
   tuning (parked, needs a materially different utility form or the
   histogram shifting shape — see TASKS.md's own revival conditions), Task
   13 deck-composition scoring, or the capture-blocked items (QUESTIONS.md
   §15, Task 14). This project has been on Codex-backlog cleanup for nine
   straight sessions (31-39); the backlog closing is a real inflection
   point to actually act on, not just note.
2. **A real, currently-live bug was found and fixed this session, outside
   the brief's original scope — flag this prominently, it's not a minor
   footnote.** The real `data/nextPositionValidation.jsonl` already
   contained 35 fake "hit" records (`castId: "99999999"`, `predicted ==
   actual == [2,2]`, all dated today) — byte-for-byte the mock fixture
   from `tests/liveFishing.test.ts`. Root cause: one of the three
   `runOneCast` tests never set `nextPositionLogPath` (falling back to the
   real default path), and `dumpUnknownTerminal()` was hardcoded to write
   into the real `logs/` with no override at all for ANY caller. This is
   the SAME "test writes to a real data path" bug class CLAUDE.md already
   documents as having shipped twice (sessions 30, 31) — a third
   occurrence, this time in the file that documents the first two.
   Consequence, if it hadn't been caught: the `nextPosition` override gate
   this session was fixing was already effectively armed in production,
   from zero real evidence, before the fix even landed. Fixed by threading
   an isolated `logsDir` through `LiveFishingDeps`; all three affected test
   constructions now isolate every I/O path. **Worth a standing instruction
   or a lint/CI check** (not built this session, out of scope) — this
   pattern (a new `LiveFishingDeps`/`LiveRunDeps` construction that omits
   one of N optional path overrides) has now cost three separate sessions
   to discover after the fact; a single test asserting "constructing deps
   without an explicit override for every I/O path is a compile error, or
   at minimum a runtime assertion" would catch it structurally instead of
   by accident.
3. Standing since sessions 30-38: QUESTIONS.md §15 (stuck fishing account
   after an escape) still needs a human DevTools capture.
4. Also standing: Task 14 (bot-initiated juiced `start_run`) blocked on a
   live DevTools capture, not code. Charge-reserve plateau (0.4/0.5/0.6
   mutually indistinguishable) — not urgent.

## Files changed
```
 scripts/liveFishing.ts          | 199 ++++++++++++++++++++++++++++++++++------
 tests/liveFishing.test.ts       | 136 ++++++++++++++++++++++++++-
 tests/sim/fishingCorpus.test.ts |   8 ++
 3 files changed, 308 insertions(+), 35 deletions(-)
```
(data/nextPositionValidation.jsonl and 45 logs/fishing-unknown-midcast-*.json
files were also cleaned of confirmed test pollution this session — both
paths are gitignored, so this does not appear in the diff above. User
approved before cleanup.)
