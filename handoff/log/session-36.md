# STATE — session 36 — 2026-08-18 — commit 34dfbc7

## Status
Task "CODEXAUDIT #1: opponent-model live-observe double-count fix": **GATE
PASS** (self-assessed against the brief's own bar — required scope fixed in
both real entry points, named regression test added and confirmed to fail
against the pre-fix code, full suite + tsc clean at the final commit).
Stretch item (CODEXAUDIT #3, `playCountsPersistence` wired into
`scripts/orchestrator.ts`) also done. No `TASKS.md` gate targeted, same as
sessions 31-35.
This session's real headline: **session 35's "both Codex docs fully closed"
claim did NOT hold** — an independent audit (`CODEXAUDIT`, untracked file at
repo root) found real gaps, three of which are confirmed and detailed in
DECISIONS.md. Next: the Codex-derived backlog is genuinely smaller now but
NOT empty — three items queued below, none attempted this session per the
brief's explicit scope.

## What works
- **The opponent-model live-observe double-count bug is fixed in both real
  entry points** (`scripts/liveRun.ts` and `scripts/orchestrator.ts` — the
  latter calls the SAME shared `runOnce()`, so one fix covers both). Root
  cause: the live-observe call site called `model.observe()` and saved the
  model on every combat exchange, but never marked that exchange's identity
  into `bootstrapImportedIds` — so a restart's `bootstrapFromCorpus()` found
  the fixture the live session had just written, saw its id absent from the
  persisted ledger, and re-imported (double-counted) it. Fixed by giving the
  live call site the SAME identity derivation `bootstrapFromCorpus()` already
  used, via two new shared helpers in `src/sim/corpus.ts` (the sole
  wire-shape-owning module): `exchangeLabel(beforeFile, afterFile)` and
  `exchangeIdentity(run, label)`. `FixtureWriter.write()` now RETURNS the
  file name it just wrote (was `void`) and gained a `runName` getter, so the
  live call site can build `${runName}::${beforeTag}→${afterTag}` from its
  own two most recent writes (GET-state "before", POST-response "after" —
  always consecutive within one loop iteration; a probe/potion detour always
  `continue`s back to a fresh GET before either tag is used, so it's never
  stale). Verified: a NEW `runOnce()`-level regression test in
  `tests/liveRun.test.ts` — real `FixtureWriter` against a temp dir, real
  `loadOpponentModel`/`bootstrapFromCorpus`/`loadCorpus` (no mocks for any of
  these) — drives one live combat exchange, confirms it's marked into the
  ledger, simulates a restart's bootstrap pass against the SAME fixture root,
  confirms the observation count is UNCHANGED (not doubled), and confirms a
  genuinely new canary corpus exchange in a separate run directory still
  imports normally. This test was manually confirmed to FAIL against the
  pre-fix code (temporarily reverted the fix, re-ran, saw the expected
  failure, restored the fix) before being trusted as a real regression guard.
- **`scripts/orchestrator.ts` now wires `playCountsPersistence`** into its
  `runOnce()` call, mirroring `liveRun.ts`'s `main()` exactly (same
  `DEFAULT_PLAY_COUNTS_PATH`, same `acquireGuardLock` pattern) — closes
  CODEXIMPROVE #5's actual remaining gap (session 35 shipped this only for
  `liveRun.ts`, and overclaimed it as closing the whole item). No dedicated
  orchestrator-level test exists for this — `orchestrator.ts`'s `main()`
  isn't structured for unit testing (its own header already documents this:
  scheduler/shutdown are unit-tested, `main()` is smoke-tested via
  `--dry-run`/`--hours=`) — flagged honestly rather than claimed as covered.
  The wiring itself routes through the same already-tested `runOnce()` and
  the same `playCountsPersistence` shape `liveRun.ts` already exercises.
- Tests: **533/533 passing** (+1 from session 35's 532: the new
  double-count regression test). `npx tsc --noEmit` clean, `git diff --check`
  clean, both checked at this session's final commit.
- `handoff/DECISIONS.md` carries a full correction entry for session 35's
  overclaim — see "Corrections" below, this is the load-bearing record.

## What's broken
Nothing this session's changes broke — full suite green, tsc clean, diff
clean, at the actual final commit. Three real gaps from the audit remain
OPEN and unattempted this session, by explicit brief scope (see "Open
questions" below) — not broken by this session, just not yet fixed:
CODEXREVIEW #2's fsync gap, CODEXIMPROVE #3's fishing calibration
regression, CODEXIMPROVE #6's `nextPosition` gate weakness. Other
pre-existing items, unchanged since session 25: the scheduler can't learn
about energy gained outside its own tracking, and a SIGINT during an
energy-regen sleep still ends the whole session. QUESTIONS.md §15 (stuck
fishing account) NOT re-checked this session — no live calls made at all,
pure code/test work per the brief's explicit scope.

## Corrections to SPEC.md
None to SPEC.md this session. But a real correction to a PRIOR SESSION's own
claim, recorded in DECISIONS.md rather than SPEC.md (this was a status claim
about Codex-backlog completeness, not a wire-shape fact SPEC.md tracks):
session 35's STATE.md said "both Codex docs' standing backlog is now fully
closed." An independent audit found this false in three confirmed places —
CODEXREVIEW #2 (fsync), CODEXIMPROVE #1 (the double-count bug this session
fixed), CODEXIMPROVE #3 (fishing calibration), CODEXIMPROVE #5 (orchestrator
half, also fixed this session), CODEXIMPROVE #6 (nextPosition gate). Full
detail in DECISIONS.md's 2026-08-18 (session 36) correction entry — read
that entry, not this summary, before writing the next brief.
Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2. Move
charges: unchanged, PRESENT.

## Dead ends
None — the fix landed on its first design (reuse the existing
`bootstrapImportedIds` set as a unified ledger rather than inventing a
parallel structure, per the audit's own suggested shape). One deliberate
scope decision, not a dead end: `bootstrapImportedIds` was NOT renamed to
something like `observedExchangeIds` despite now covering both live and
corpus paths — a rename would need a schema-version bump for a purely
cosmetic change, since the field is persisted to disk. Documented in the
module's header comment instead.

## Metrics
No sim runs, no live dungeon or fishing calls this session — brief scoped to
pure code/test work only, explicitly, same as session 35. The only
"metric" this session produced is test-count delta (532 -> 533) and the
manual before/after regression-test confirmation described above (test
fails against reverted pre-fix code, passes against the fix) — not a sim or
live run number.

## Open questions for Claude
1. Three real gaps from the independent audit are STILL open, none attempted
   this session by explicit brief scope: **CODEXAUDIT #2** (fishing
   contextual fallback's log-loss regression — shrink toward cell-only
   instead of hard-switching, `src/strategy/fishing/contextualFallback.ts`);
   **CODEXAUDIT #4** (`nextPosition` override gate counts raw hits, not
   hits-out-of-attempts, `scripts/liveFishing.ts`); **CODEXAUDIT #5**
   (centralize a durable `atomicWriteJson()` with real `fsync` across all
   three persistence modules — this is what actually finishes CODEXREVIEW #2,
   which has been sitting "partial" since session 28). **CODEXAUDIT #6**
   (opponent-model schema too permissive — negative/fractional counts) is
   low priority, queued last. Recommend picking ONE of these as next
   session's spine rather than spreading thin — CODEXAUDIT #5 (fsync) is
   arguably highest-leverage since it's the one CODEXREVIEW item that's been
   open longest and touches all three persistence modules at once.
2. Standing since sessions 30-35: QUESTIONS.md §15 (stuck fishing account
   after an escape) still needs a human DevTools capture. Not blocking any
   dungeon work.
3. Also standing: Task 14 (bot-initiated juiced `start_run`) blocked on a
   live DevTools capture, not code. The charge-reserve plateau
   (0.4/0.5/0.6 mutually indistinguishable) — not urgent.

## Files changed
```
 handoff/DECISIONS.md                         |   3 +
 scripts/liveRun.ts                           |  56 ++++++++++--
 scripts/orchestrator.ts                      |  11 +++
 src/orchestrator/opponentModelPersistence.ts |  24 ++++-
 src/sim/corpus.ts                            |  24 ++++-
 tests/liveRun.test.ts                        | 128 ++++++++++++++++++++++++++-
 6 files changed, 229 insertions(+), 17 deletions(-)
```
(`CODEXAUDIT`, the untracked audit doc this session worked from, is committed
alongside these as input/record, not counted as a work product above.
`handoff/next.md`, this session's own brief, is excluded per convention.)

---

## Verbose detail (session log only — not in STATE.md)

### The audit's own findings, verbatim summary

`CODEXAUDIT` (repo root, committed this session) was a read-only review
performed against commit `b8ecd83` (matched `origin/main` at review time),
independently re-verifying 532/532 tests, `tsc --noEmit`, and `git diff
--check` all passing before making any claims. Its completion audit:

- CODEXREVIEW: items 1, 3-9 implemented. Item 2 only partially complete
  (atomic writes not flushed to durable storage — no `fsync` anywhere in
  `guardPersistence.ts`, `opponentModelPersistence.ts`, or
  `playCountsPersistence.ts`). Item 10 correctly closed as invalid
  (`viem` genuinely used by `scripts/probe.ts`).
- CODEXIMPROVE: items 2 and 4 complete. Items 1, 3, 5, 6 have material gaps.
  Item 5's boon-scoring half complete; orchestrator persistence half not.

High priority (the one fixed this session):

> ### 1. Live opponent observations are imported a second time after restart
>
> After a combat action, the response is written into the fixture corpus and
> immediately learned through `model.observe()`. The model is saved, but its
> exchange identity is not added to `bootstrapImportedIds`.
>
> On the next launch, `bootstrapFromCorpus()` discovers that newly written
> fixture. Because its ID is absent from `bootstrapImportedIds`, the same
> enemy move is observed again.
>
> Potential impact: every post-feature live observation eventually receives
> twice its proper weight. Sample and Markov floors can be reached with
> roughly half the independent evidence. Marginal and transition
> probabilities become biased toward recent live sessions.

Medium priority (not attempted this session, queued as CODEXAUDIT #2-#5):

- #2 fishing contextual fallback shipped despite worse held-out log loss
  (cell-only baseline 5.860 vs. context-threshold-3 6.151).
- #3 play-count persistence not wired into the orchestrator (this session's
  stretch item fixed this).
- #4 `nextPosition` activates after ten hits regardless of interleaved
  misses; loader also skips schema/grid-bounds validation.
- #5 atomic persistence across all three modules never actually flushes
  (`fsync`) before rename — this is what finishes CODEXREVIEW #2 for real.

Low priority (queued as CODEXAUDIT #6): opponent-model schema accepts
negative/fractional counts (`z.number()` unrestricted, should be
`z.number().int().nonnegative()`).

### Verifying the double-count fix actually catches the bug

Before trusting the new regression test, its bug-catching power was checked
directly rather than assumed from reading the code:

1. `git stash` to snapshot the session's uncommitted work, confirmed clean
   working tree.
2. `git stash pop` to restore it (this was just a checkpoint, not meant to
   discard anything).
3. Copied `scripts/liveRun.ts` to a scratch backup.
4. Edited the live fix in place to reproduce the EXACT pre-fix bug shape:
   `const exchangeId = null;` / `const alreadyObserved = false;`, always
   calling `model.observe()` unconditionally and never marking
   `bootstrapImportedIds`, matching what the code looked like before this
   session's fix.
5. Ran `npx vitest run tests/liveRun.test.ts -t "double-count"` against
   this deliberately-reintroduced bug: **FAILED** as expected —
   `expected +0 to be 1` on `bootstrapImportedIds.size`, i.e. the ledger
   never got marked, exactly the mechanism of the real bug.
6. Restored the real fix from the scratch backup (`cp` back).
7. Re-ran the full suite: 533/533 passing, confirming the fix (not the
   test infrastructure) is what makes the difference.

This is the same discipline CLAUDE.md §4 asks for ("no strategy code gets
tested against the live API until it passes against recorded fixtures") —
applied here as "no regression test gets trusted until it's confirmed to
fail against the bug it claims to catch."

### Exact regression-test scenario (why it needed 2 GETs for the active run)

The test's mock `fetch` handler initially returned the active combat run
only on GET call 1, then "no active run" (`data: {run: null, entity:
null}`) for every subsequent GET. This made the test's OWN assertions fail
first — `model.observations(key)` was 0, not from the fix being wrong but
from the test never reaching the combat POST at all.

Root cause: `runOnce()` calls `client.getDungeonState()` TWICE before any
combat action can happen — once in a pre-loop "is a run already active"
check (`scripts/liveRun.ts:659`, `const existing = ...`), and again as the
main loop's own first state read (`scripts/liveRun.ts:748`, inside
`for (;;) { state = await client.getDungeonState(); ... }`). The mock
needed to return the active combat run for BOTH of the first two GET calls,
not just the first — fixed by changing the dispatch condition from
`getCount === 1` to `getCount <= 2`. This is now documented inline in the
test itself so a future reader doesn't rediscover it from scratch.

### FixtureWriter.write() signature change — call-site audit

`write()`'s return type changed from `void` to `string`. Every existing
call site that ignores the return value continues to compile and behave
identically (TypeScript permits discarding a non-void return). Confirmed by
`npx tsc --noEmit` passing clean across the whole repo, not just the two
call sites this session's diff touches directly
(`scripts/liveRun.ts:763,883` — the new `beforeTag`/`afterTag` captures) —
other call sites at lines 616, 737, 947, 988 (start_run response, probe
response, reward/enemy-path responses) were left as bare `fixtures.write(x)`
statements, unchanged, and still compile.
