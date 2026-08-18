# Session 40 — 2026-08-18 — commit dff0176

## Brief
Session 39 closed the entire Codex-derived backlog but, while doing so,
found the real `data/nextPositionValidation.jsonl` already contaminated
with 35 fake "hit" records — byte-for-byte a `tests/liveFishing.test.ts`
mock fixture, leaked because one `runOneCast` test constructed
`LiveFishingDeps` inline without overriding `nextPositionLogPath`/`logsDir`,
falling back to the real default paths. This is the SAME bug class CLAUDE.md
already documents shipping twice before (sessions 30, 31) — a third
occurrence, in the file that records the first two. Session 40's brief:
close this bug class structurally, not just fix the third instance —
consolidate every `LiveFishingDeps`/`LiveRunDeps` test construction through
one helper per file, with a signature that makes omitting a known isolated
I/O path a compile error. No `TASKS.md` work this session even though the
Codex backlog is closed.

## What actually happened, in order

### 1. Read the live `LiveFishingDeps` interface and every construction site
`scripts/liveFishing.ts:722-742`. Four optional path fields:
`transitionsPath?`, `guardStatePath?`, `nextPositionLogPath?`, `logsDir?`,
plus `shutdownSignal?` (not a path, left alone). Grepped
`tests/liveFishing.test.ts` for every `LiveFishingDeps`/`makeDeps` mention —
found FIVE independent inline object literals (lines ~472, 513, 545, 783,
820 pre-edit) plus one narrower `makeDeps(client, guardStatePath)` wrapper
(line 635) used by only two tests in one describe block. Confirmed by
reading `runOneCast`'s body (`transitionsPath = deps.transitionsPath ??
DEFAULT_TRANSITIONS_PATH`, same pattern for the other three) that all four
optional fields silently fall back to a real project path when omitted —
this is the exact mechanism of session 39's leak.

### 2. Built one consolidated helper for the fishing test file
Added `makeLiveFishingDeps()` at module scope (before the first `describe`),
typed as:

```ts
type LiveFishingIsolatedPaths = Required<
  Pick<LiveFishingDeps, "transitionsPath" | "guardStatePath" | "nextPositionLogPath" | "logsDir">
>;

function makeLiveFishingDeps(
  overrides: Omit<
    LiveFishingDeps,
    "transitionsPath" | "guardStatePath" | "nextPositionLogPath" | "logsDir" | "fixtures" | "log" | "address" | "dryRun"
  > &
    LiveFishingIsolatedPaths &
    Partial<Pick<LiveFishingDeps, "fixtures" | "log" | "address" | "dryRun">>,
): LiveFishingDeps { ... }
```

`client`, `config`, `guards` stay required (inherited, unchanged from the
base interface); the four isolated paths are required via the intersection;
`fixtures`/`log`/`address`/`dryRun` get sensible test defaults but remain
overridable, since every existing call site used the same values anyway
(`"0xUSER"`, `false`, the same two stub objects) and defaulting them cut
real boilerplate without touching the dangerous fields.

Replaced all five inline literals and the narrow `makeDeps` wrapper (which
now delegates to `makeLiveFishingDeps`, taking `dir` instead of a lone
`guardStatePath` so it can supply all four isolated paths). One follow-on
fix: the second "unrelated start_run rejection" test had a `guardStatePath`
local variable that became unused once `makeDeps` started deriving it
internally from `dir` — `tsc --noEmit` caught this immediately (`TS6133:
'guardStatePath' is declared but its value is never read`), removed the
now-dead line.

Verified with `grep -n "LiveFishingDeps = {"` → zero matches; every
construction goes through `makeLiveFishingDeps` (7 call sites total,
counting the internal one inside the `makeDeps` wrapper).

### 3. Checked `LiveRunDeps` before doing the identical mechanical thing
The brief asked to "apply the identical treatment," but flagged verifying
first whether `tests/liveRun.test.ts` already has one consolidated
construction site (DECISIONS 2026-08-18 session 32 claimed it did — that
claim needed reconfirming live, same discipline as the rest of this
project). Grepped `: LiveRunDeps = {` — every hit spreads `...makeDeps(...)`
with per-test overrides layered on top (`probeUseItem`, `potionPolicy`,
`opponentModelPersistence`); zero bare literals bypass the helper. The
session-32 claim held up under direct inspection.

Read `LiveRunDeps`'s full field list (`scripts/liveRun.ts:370-450`):
`guardStatePath?`, `probeUseItem?`, `startConsumables?`, `potionPolicy?`,
`shutdownSignal?`, `opponentModelPersistence?: {path, ...}`,
`playCountsPersistence?: {path}`. Rather than mechanically requiring every
optional field with a `path`-shaped value (which the brief's own §4
explicitly warns against — "a compile-time guarantee isn't something you
write a runtime test to prove passing," same spirit applies to over-claiming
what needs guarding), read every use site of each field in `runOnce`:

- `guardStatePath` (`liveRun.ts:735`) → `saveGuardBudget(..., guardStatePath)`
  → `guardPersistence.ts:164`'s default param is
  `path: string = DEFAULT_GUARD_STATE_PATH` (`data/guard-budget.json`).
  Omitting it silently writes the real file. Dangerous.
- `opponentModelPersistence` (`liveRun.ts:912-914`) → guarded by
  `if (deps.opponentModelPersistence && exchangeId !== null && !alreadyObserved)`
  — undefined means "skip the whole block," not "fall back to a default
  path." Safe by omission.
- `playCountsPersistence` (`liveRun.ts:760, 779, 823, 919`) → same shape,
  every use gated by `if (deps.playCountsPersistence && ...)`. Safe by
  omission.

So only `guardStatePath` has the dangerous-default shape session 39's bug
depended on. Requiring the other two structurally would have been
over-fitting the mechanical pattern from the fishing fix onto a file where
it doesn't apply the same way — the honest fix here is narrower.

### 4. Made `makeDeps()` compile-enforce `guardStatePath`
Changed its return type from `LiveRunDeps` to `LiveRunDeps &
Required<Pick<LiveRunDeps, "guardStatePath">>` — the existing body (which
already always sets `guardStatePath` from the per-test `guardStateTestDir`,
itself set in `beforeEach`/torn down in `afterEach`) needed no other change.
Left a comment explaining explicitly why `opponentModelPersistence`/
`playCountsPersistence` are NOT part of the required intersection, so a
future reader doesn't "fix" this by mechanically adding them.

### 5. Verification
```
$ npx tsc --noEmit
(clean, one round-trip catch of the dead guardStatePath var, fixed)

$ npx vitest run
 Test Files  32 passed (32)
      Tests  559 passed (559)
   Duration  886ms

$ git diff --check
(clean, no output)

$ grep -n "LiveFishingDeps = {" tests/liveFishing.test.ts
(no matches)
$ grep -n ": LiveRunDeps\s*=\s*{" tests/liveRun.test.ts
(7 matches, all "{ ...makeDeps(...), <per-test override> }")
```

Live gitignored-path check (brief §1.5) — ran AFTER the full suite, checked
by `stat -f "%Sm"` against the test run's start time (09:19-09:24 PDT):

```
data/nextPositionValidation.jsonl   0 bytes, mtime 08:10:17 (before run)
data/guard-budget.json              mtime 00:25:19 (before run, prior day's play)
data/guard-budget-fishing.json      mtime Aug 17 20:33:26 (before run)
logs/*                              newest file mtime 03:12-03:13 (before run)
```
Nothing in `data/` or `logs/` has an mtime inside the test-run window —
confirms this session's test runs wrote to none of them. (These files are
gitignored real state from the user's actual play/prior sessions, not
committed — read directly off disk, not from git.)

## Corrections to SPEC.md
None this session — no live capture, no SPEC-contradicting behavior found.

## Dead ends
Considered requiring `opponentModelPersistence`/`playCountsPersistence` on
`LiveRunDeps` via the same `Required<Pick<...>>` pattern as `guardStatePath`,
purely for mechanical consistency with the fishing-side fix. Rejected after
reading every call site — both are no-op-safe when undefined, so requiring
them would add boilerplate to every future test without closing any real
gap, and would misstate (in the type signature itself) that they're as
dangerous as `guardStatePath` when they aren't.

## Metrics
No sim runs, no live dungeon or fishing calls. Pure test/type refactor.
Test count: 559 -> 559 (unchanged; this session added no new test cases,
only restructured how existing ones construct their dependencies).

## Files changed
```
 tests/liveFishing.test.ts | 145 ++++++++++++++++++++++++----------------------
 tests/liveRun.test.ts     |  15 ++++-
 2 files changed, 90 insertions(+), 70 deletions(-)
```
