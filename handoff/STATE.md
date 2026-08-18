# STATE — session 37 — 2026-08-18 — commit b46631b (pre-session HEAD)

## Status
Task "CODEXAUDIT #5: centralize durable atomic writes with a real fsync"
(finishes CODEXREVIEW #2, open since session 28): **GATE PASS**, the
session's whole required scope. Stretch item CODEXAUDIT #6 (opponent-model
schema tightening — non-negative-int counts, transition-row-vs-marginal
constraint) also done. No `TASKS.md` gate targeted, same as sessions 31-36 —
this is Codex-backlog cleanup, not a numbered project task.
Not attempted, per explicit brief scope: CODEXAUDIT #2 (fishing calibration)
and CODEXAUDIT #4 (`nextPosition` gate) — both queued, neither started.

## What works
- **CODEXREVIEW #2 is now genuinely finished, not just partially** — the
  temp-file+rename half shipped session 28; the flush half never did, across
  any of the three persistence modules that copied the pattern since. New
  `src/orchestrator/atomicWrite.ts` exports one shared `atomicWriteJson(path,
  body)`: builds the same `${path}.tmp-${pid}-${Date.now()}-${rand}` name
  every module already used, opens it with `openSync`/`writeSync` (not
  `writeFileSync`, which never hands back a file descriptor to fsync),
  `fsyncSync`s that descriptor, `closeSync`s it, `renameSync`s it into place,
  then best-effort `fsyncSync`s the parent directory (own try/catch —
  directory-fsync isn't supported everywhere, and a platform that can't do
  it shouldn't fail the whole write). Any failure before the rename
  completes cleans up the temp file before rethrowing.
  `guardPersistence.ts`'s `saveGuardBudget`, `opponentModelPersistence.ts`'s
  `saveOpponentModelAtomically`, and `playCountsPersistence.ts`'s
  `savePlayCounts` all now call this one helper — mechanical extraction
  only, no module-specific body-construction logic (`schemaVersion`, the
  `bootstrapImportedIds` sort, etc.) touched. Grep-confirmed: the
  `.tmp-${pid}` write pattern now exists in exactly one place in
  `src/`/`scripts/` — `atomicWrite.ts` itself.
- **What's actually proven vs. what's trusted, stated plainly, per the
  brief's explicit instruction not to overclaim durability**: a unit test
  cannot prove a write survives a real power loss — that stays a
  filesystem/OS-level guarantee this project is trusting, not something it
  can independently verify. What the new 8-test
  `tests/orchestrator/atomicWrite.test.ts` DOES prove: `fsyncSync` is
  actually invoked during a real save (spy-confirmed — the concrete gap
  CODEXREVIEW #2 named, since the old code never even had a file descriptor
  to fsync); a failed rename or a failed fsync both clean up the temp file
  and rethrow, no orphaned `.tmp-*`; a failed *directory* fsync does NOT take
  down an otherwise-good write; and all pre-existing round-trip/
  corruption/atomic-write tests in the three original modules' test files
  pass completely unchanged after the refactor (no behavioral regression).
  Note on test mechanics: `vi.spyOn` cannot target Node's built-in ESM
  module exports directly ("module namespace is not configurable") — used
  `vi.mock("node:fs", { spy: true })` instead (auto-spies every export,
  calls through to the real implementation by default).
- **Opponent-model persistence schema tightened (CODEXAUDIT #6, stretch)**:
  per-move counts are now `z.number().int().nonnegative()` (was bare
  `z.number()`), and `CountsSchema` gained a `.refine()` rejecting any key
  where a transition row's sum exceeds its marginal predecessor count — a
  transition FROM move X can only be recorded on a turn where X was ALSO the
  move actually played, so a row exceeding X's own marginal count is
  structurally impossible under `OpponentModel.observe()`'s own accounting,
  not an unusual-but-valid read. Both fail closed with
  `OpponentModelPersistenceError`. 4 new tests (negative count, fractional
  count, a violating row, and the exact-equality boundary case confirmed to
  NOT throw).
- Tests: **545/545 passing** (533 baseline + 8 new `atomicWrite.test.ts` + 4
  new schema tests in `opponentModelPersistence.test.ts`). `npx tsc --noEmit`
  clean, `git diff --check` clean, both checked at this session's final
  commit. No real `data/*.json` path touched by any test — isolated
  `mkdtempSync` + explicit path param throughout, same convention as every
  prior persistence test file.
- Full detail (the exact refine logic, the vi.mock rationale, the file-by-
  file diff) is in `handoff/DECISIONS.md`'s two 2026-08-18 (session 37)
  entries — read those before writing the next brief, not this summary.

## What's broken
Nothing this session's changes broke — full suite green, tsc clean, diff
clean, at the actual final commit. Two real gaps from the independent audit
remain OPEN and unattempted this session, by explicit brief scope:
CODEXAUDIT #2 (fishing contextual fallback's log-loss regression) and
CODEXAUDIT #4 (`nextPosition` override gate counts raw hits, not
hits-out-of-attempts). Other pre-existing items, unchanged since session 25:
the scheduler can't learn about energy gained outside its own tracking, and
a SIGINT during an energy-regen sleep still ends the whole session.
QUESTIONS.md §15 (stuck fishing account) NOT re-checked this session — no
live calls made at all, pure code/test work per the brief's explicit scope,
same as sessions 35-36.

## Corrections to SPEC.md
None. Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
Move charges: unchanged, PRESENT.

## Dead ends
None. One deliberate design choice worth recording: the new
`atomicWriteJson` helper lives in its own module
(`src/orchestrator/atomicWrite.ts`) rather than being bolted onto
`guardPersistence.ts` with the other two importing cross-module — avoids a
circular-import risk between the three persistence modules and matches the
brief's own stated preference. Verified with a grep-based test
(`does not throw if the best-effort directory fsync fails`) that uses
`vi.importActual` for selective real-passthrough rather than mocking the
entire `node:fs` module wholesale for that one test — kept the blast radius
of that specific mock as small as the test needed, not module-wide.

## Metrics
No sim runs, no live dungeon or fishing calls this session — brief scoped to
pure code/test work only, explicitly, same as sessions 35-36. Test-count
delta: 533 -> 545 (+12: 8 atomicWrite + 4 schema-tightening).

## Open questions for Claude
1. Two real gaps from the independent audit are STILL open, neither
   attempted this session by explicit brief scope: **CODEXAUDIT #2**
   (fishing contextual fallback's log-loss regression — shrink toward
   cell-only instead of hard-switching at `minIndependentCasts`,
   `src/strategy/fishing/contextualFallback.ts`); **CODEXAUDIT #4**
   (`nextPosition` override gate counts raw hits, not hits-out-of-attempts,
   needs a real accuracy/confidence-bound gate plus schema and grid-bounds
   validation on the loader, `scripts/liveFishing.ts`). Both are real,
   neither as mechanical or as broadly-leveraged as this session's scope —
   recommend picking one as next session's spine. Session 36's own
   recommendation logic (pick the oldest, most-leveraged item first) no
   longer applies cleanly since both remaining items are roughly comparable
   in age and neither touches multiple modules at once the way #5 did — a
   genuinely open choice for the next brief, not a forced one.
2. Standing since sessions 30-36: QUESTIONS.md §15 (stuck fishing account
   after an escape) still needs a human DevTools capture. Not blocking any
   dungeon work.
3. Also standing: Task 14 (bot-initiated juiced `start_run`) blocked on a
   live DevTools capture, not code. The charge-reserve plateau
   (0.4/0.5/0.6 mutually indistinguishable) — not urgent.

## Files changed
```
 handoff/DECISIONS.md                              |   4 +
 src/orchestrator/atomicWrite.ts                   |  69 ++++++ (new)
 src/orchestrator/guardPersistence.ts               |  15 +-
 src/orchestrator/opponentModelPersistence.ts       |  47 ++--
 src/orchestrator/playCountsPersistence.ts          |  18 +-
 tests/orchestrator/atomicWrite.test.ts             | 118 ++++++++ (new)
 tests/orchestrator/opponentModelPersistence.test.ts|  51 ++++
 7 files changed
```
(`handoff/next.md`, this session's own brief, is excluded per convention.)
