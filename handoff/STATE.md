# STATE — session 31 — 2026-08-18 — commit 4136064

## Status
No TASKS.md gate was targeted this session — the brief was the CODEXREVIEW/
CODEXIMPROVE queue: §1 (split committed-vs-observed energy accounting,
CODEXREVIEW #8), §2 (resource-conserving fishing tie-breaks, CODEXIMPROVE
#2), §3 (doc sync bundle, CODEXREVIEW #9/#10 + session-30 open question 1),
§4 (wire standalone report regeneration, session-30 open question 4). Task
10 stays the last GATE PASS (session 25, unchanged); this session touched
none of that path. CODEXIMPROVE #1 (opponent-model persistence) was
deliberately NOT started, per the brief — queued for session 32.
Overall: §1, §2, and §4 landed exactly as briefed. §3 landed with two
corrections: CODEXREVIEW #10 (remove unused `viem`) was NOT implemented —
`viem` is actually used live — and one of the two reward-field findings the
brief asked to fold into SPEC.md (the fishing catch-source claim) turned
out to be FALSE on direct fixture verification and was corrected rather
than propagated. No live play this session — pure engineering, all four
items are instrumentation/refactoring/doc work.

## What works
- **The daily-budget guard now enforces off COMMITTED energy spend, not the
  observed before/after account delta** (CODEXREVIEW #8).
  `guards.recordEnergySpent(config.energyCostPerRun)` (dungeon) /
  `dendren.energyCostPerCast` (fishing) is called the moment `start_run`
  succeeds, persisted immediately. The before/after read is now a
  diagnostic only, reconciled by new `src/orchestrator/energyAccounting.ts`
  (`reconcileEnergyAccounting`/`describeEnergyAccounting`) — never fed back
  into the guard. Closes the real gap: an external top-up (a ROM claim
  landing mid-run) could previously mask real spend to a smaller number or
  zero. Verified by unit test: `guards.spentEnergy` equals the configured
  cost immediately after a mocked `runOnce`/`runOneCast` success, using a
  mock client that never implements `getEnergy` at all — proves the commit
  path has zero dependency on any energy read.
- **Fixed a real, live bug found while doing the above**: three tests
  (`tests/sim/fishingCorpus.test.ts`, two in `tests/liveFishing.test.ts`)
  never set `guardStatePath` on a real, non-dry-run `runOneCast` call, so
  every run of those tests silently overwrote the real `data/
  guard-budget.json` — the DUNGEON guard file, not fishing's. Confirmed
  live by diffing that file before/after running just those tests
  (`energySpent` 0 → 12). All three now point at their existing temp dir;
  the real file was restored and a full suite run afterward left it
  untouched (verified by checksum).
- **Fishing card/focus tie-breaks now conserve the scarce, non-regenerating
  focus-movement budget** (CODEXIMPROVE #2), provably EV-neutral (only
  exact EV ties are affected). `bestFocusForCard` breaks a tie in favor of
  the placement closer to the current focus; `chooseCard`'s cross-card
  choice goes through a shared `isPreferred` comparator: lethal before
  non-lethal, then EV (or EV/mana when mana-constrained), then lower focus
  movement cost, then lower mana cost, then hand order. Verified by 2 new
  unit tests + all 15 pre-existing `cardChoice.test.ts` tests unchanged.
- **CLAUDE.md §8 reworded** to match what `src/strategy/enemyTier.ts`
  actually implements and `liveRun.ts` actually calls
  (`pickLowestTier()`), not the stricter `pickSafeTier()` the doc used to
  name — session 09 already found Safe isn't always offered; the doc was
  stale, not the code.
- **Dungeon reward-item crediting folded into SPEC.md as new §3f**,
  verified against the cited fixtures before writing: both Hard Core (845)
  and "Dendren Root"/wire "Dendren Remnant" (846) are credited via a
  top-level `gameItemBalanceChanges` array (not nested under `data`).
- **Standalone `liveRun.ts`/`liveFishing.ts` invocations now regenerate
  `handoff/reports/*.md`** at the end of `main()`, same non-fatal behavior
  as `orchestrator.ts`'s end-of-session rollup, via new shared
  `scripts/regenerateReports.ts`. Smoke-tested directly: reproduces session
  30's exact backfill numbers (47 dungeon attempts, 50 fishing casts), and
  a real `liveFishing.ts --dry-run` invocation reaches the new call and
  regenerates cleanly end to end (only the "Last generated" timestamp
  changed in the committed markdown).

## What's broken
Nothing newly broken by this session's changes — 488/488 tests pass (up
from 479/479 at session 30's end), `npx tsc --noEmit` clean, both verified
against this session's final commit. Unchanged, pre-existing open items:
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends the
  whole session (unchanged since session 25).

## Corrections to SPEC.md
- New §3f added (dungeon reward-item crediting, confirmed): Hard Core
  (845) and "Dendren Root"/"Dendren Remnant" (846) both credited via a
  top-level `gameItemBalanceChanges` array. See DECISIONS 2026-08-18.
- SPEC-fishing.md was NOT amended — session 30's claim that
  `doc.data.caughtFish` is "never populated" (which this session's brief
  asked to fold in as a `[VERIFY]` resolution) was checked directly against
  the fixtures and found FALSE: `caughtFish` is reliably populated and
  actually persists across MORE responses than the one-shot `FISH_DIED`
  event. Root cause: session 30's own verification script read one `.data`
  level too shallow. Full correction in DECISIONS.md 2026-08-18 (session
  31); SPEC-fishing.md's existing session-15 documentation was correct all
  along and needed no fix.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
None this session. Two brief items were deliberately NOT implemented as
stated, which is different from a dead end (no code was written and
discarded — the check happened before any implementation):
- CODEXREVIEW #10 (remove `viem` from `package.json`) — checked first per
  CLAUDE.md §9, found `viem` IS used (`scripts/probe.ts`'s `authFromEoa()`,
  Path B EOA auth, gated behind `AUTH_MODE=eoa`, a real reachable call
  site even though Path A is the path actually used). Left in place.
- The fishing half of session-30 open question 1 (fold "catch source is
  `FISH_DIED` not `caughtFish`" into SPEC-fishing.md) — checked first, the
  underlying claim was wrong (see Corrections above). Not written into
  SPEC.md; corrected in DECISIONS.md instead.

## Metrics
No live play this session (no dungeon runs, no fishing casts sent) — pure
engineering, consistent with the brief's scope. One real, read-only network
call was made (`liveRun.ts --dry-run`, per CLAUDE.md's documented dry-run
usage) purely to smoke-test the report-regeneration wiring; it found the
real dungeon cap already at 12/12 for today (server-confirmed, not
bot-caused) and correctly guard-tripped before sending anything — 0 energy
spent, confirmed by the before/after print.
- Tests: 488/488 passing (+9 new since session 30's 479: 7 for §1's
  committed-spend behavior + reconciliation, 2 for §2's tie-breaks).

## Open questions for Claude
1. Same as session 30's open question 2 (unchanged): which CODEXREVIEW/
   CODEXIMPROVE items are worth queuing after CODEXIMPROVE #1 (session 32,
   already queued)? Remaining: CODEXIMPROVE #3 (previous-direction
   contextual fishing fallback, needs its own cross-validation pass),
   #4/#5 (dungeon charge-reserve tie-breaking, boon valuation), #9/#10 from
   the doc-cleanup list (docs/dependency cleanup, lower priority — #10
   itself is now resolved as "not applicable," see Corrections).
2. This session found and fixed a live bug (tests silently overwriting the
   real `data/guard-budget.json`) purely because it happened to sit in the
   exact code path §1 was touching. Worth considering whether a project-
   wide grep for other `LiveFishingDeps`/`LiveRunDeps` test constructions
   missing `guardStatePath`/isolated paths is worth a dedicated pass, or
   whether this was the last instance (this session's search found and
   fixed all 3 then-known offenders, but wasn't an exhaustive repo-wide
   audit beyond the files `runOnce`/`runOneCast` tests actually live in).
3. Should `CLAUDE.md`'s working-style section note the tests-never-touch-
   real-committed-paths discipline explicitly? It's been the convention all
   along and was the root cause of two now-fixed pollution bugs across two
   consecutive sessions (session 30's `9001`/`9002` mystery, this session's
   `guard-budget.json` leak) — writing it down as an explicit rule (not
   just a pattern to infer from existing tests) might catch a third
   instance before it ships rather than after.
4. Operator note, not a Claude(chat) planning question: this session
   accidentally deleted all `.jsonl` files in the gitignored `logs/`
   directory via an overly broad `rm` while cleaning up a smoke-test
   artifact (`rm -f logs/*.jsonl` matched more than intended). Not
   recoverable via git (the directory is untracked). The `.json` diagnostic
   dumps and `.log` files were unaffected, and nothing in `logs/` is a
   source of truth (fixtures/, DECISIONS.md, and the committed reports are
   canonical) — practical impact should be low, but flagging it plainly
   rather than omitting it.

## Files changed
```
 CLAUDE.md                            |  15 +-
 SPEC.md                              |  22 +++
 handoff/DECISIONS.md                 |   6 +
 handoff/reports/dungeon-runs.md      |   2 +-
 handoff/reports/fishing-casts.md     |   2 +-
 scripts/liveFishing.ts               |  31 +++-
 scripts/liveRun.ts                   |  44 ++++--
 scripts/orchestrator.ts              |  58 ++++----
 scripts/regenerateReports.ts         |  36 +++++
 src/orchestrator/energyAccounting.ts |  53 +++++++
 src/sim/fishingCorpus.ts             |  17 ++-
 src/strategy/fishing/cardChoice.ts   |  62 +++++++-
 tests/fishing/cardChoice.test.ts     |  44 ++++++
 tests/liveFishing.test.ts            |  45 ++++++
 tests/liveRun.test.ts                |  81 ++++++++++
 tests/sim/fishingCorpus.test.ts      |   8 +
 16 files changed, 526 insertions(+), 206 deletions(-)
```
(handoff/next.md, this session's own brief, is excluded from this stat —
consumed as input, not a work product of this session.)
