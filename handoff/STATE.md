# STATE — session 40 — 2026-08-18 — commit dff0176

## Status
Task "Structurally prevent test-constructed Deps from omitting an isolated
I/O path" (session-40 brief §1): **GATE PASS**. No `TASKS.md` gate targeted —
this is the structural fix session 39's own open question asked for, after
finding a real mock-fixture leak into `data/nextPositionValidation.jsonl`
caused by exactly this class of gap. No TASKS.md work was started this
session, per the brief's explicit instruction.
Next per TASKS.md: no numbered task is active — Codex backlog is closed
(session 39), this structural fix is closed (this session). Queued next:
Task 13's deck-aware `simulateCast` prerequisite (see Open questions), or
capture-blocked items.

## What works
- `tests/liveFishing.test.ts`: five inline `LiveFishingDeps` object literals
  and one narrower `makeDeps()` wrapper collapsed into a single
  `makeLiveFishingDeps()` helper (module scope) — the ONLY place the file
  constructs `LiveFishingDeps` now, confirmed by grep (zero remaining
  `LiveFishingDeps = {` literals). Its parameter type requires
  `Required<Pick<LiveFishingDeps, "transitionsPath" | "guardStatePath" |
  "nextPositionLogPath" | "logsDir">>` explicitly — confirmed by reading
  `runOneCast`/`dumpUnknownTerminal` that all four fall back to a real
  project path when omitted (`DEFAULT_TRANSITIONS_PATH`,
  `DEFAULT_GUARD_STATE_PATH`, `DEFAULT_NEXT_POSITION_LOG_PATH`, hardcoded
  `"logs"`). Dropping any of the four at the one call site is now a compile
  error, not a silent fallback.
- `tests/liveRun.test.ts`: reconfirmed live (not assumed from the session-32
  decision log entry) that every `LiveRunDeps` construction already routes
  through one `makeDeps()` helper — grep found zero inline `LiveRunDeps = {`
  literals outside it (every other site spreads `...makeDeps(...)`).
  `makeDeps()`'s return type now intersects `Required<Pick<LiveRunDeps,
  "guardStatePath">>`, so dropping that line is a compile error. Deliberately
  did NOT require `opponentModelPersistence`/`playCountsPersistence` the
  same way: read every call site in `scripts/liveRun.ts` and confirmed both
  are opt-in no-ops when undefined (`if (deps.opponentModelPersistence &&
  ...)`), not a fallback to a real path — `guardStatePath` is the only field
  on this interface with the dangerous-default shape.
- Tests: **559/559 passing**, unchanged from session 39's baseline — this
  session is a pure refactor of test construction, no new test cases added
  or needed (the fix's guarantee is compile-time, not runtime-assertable;
  see Open questions). `npx tsc --noEmit` clean, `git diff --check` clean,
  both at this session's final commit.
- Live-path check (brief §1.5): after the full test run, `data/
  nextPositionValidation.jsonl` (0 bytes), `data/guard-budget.json`, `data/
  guard-budget-fishing.json`, and every file under `logs/` all had mtimes
  strictly older than the test run's start time — confirmed by `stat -f
  "%Sm"`, not assumed. No real path was touched by this session's test runs.

## What's broken
Nothing shipped this session broke anything — full suite green, tsc clean,
at the actual final commit. Unchanged since session 25: scheduler can't
learn energy gained outside its own tracking; a SIGINT during an
energy-regen sleep ends the whole session. Unnoted risk found but NOT fixed
this session (out of scope, see Open questions): `scripts/liveRun.ts`'s
`RunLog` class writes unconditionally to real `logs/` with no path override
at all (same shape as the fishing-side `dumpUnknownTerminal` bug session 39
fixed) — currently harmless only because `tests/liveRun.test.ts` never
constructs a real `RunLog` (always injects a fake `{write, filePath}` stub),
confirmed by grep (`new RunLog` appears zero times in the test file).

## Corrections to SPEC.md
None this session. Resolved IDs unchanged: forbiddenWoods=5, dendren
nodeId="5"/pondId=2. Move charges: PRESENT (unchanged).

## Dead ends
None — the planned structural fix landed as scoped. Considered and rejected:
requiring `opponentModelPersistence`/`playCountsPersistence` on `LiveRunDeps`
the same way as `guardStatePath` — rejected after reading their call sites,
since unlike `guardStatePath` they're safe-by-omission (no write at all when
undefined), so requiring them would misrepresent the actual risk rather than
close a real gap.

## Metrics
No sim runs, no live dungeon or fishing calls this session — pure test/type
refactor, per explicit brief scope (§2: "Do not start any TASKS.md work this
session"). Test-count delta: 559 -> 559 (0 net — refactor only).

## Open questions for Claude
1. **`scripts/liveRun.ts`'s `RunLog` class has no injectable path at all**
   (unconditional `mkdirSync("logs")` / write into `logs/run-<stamp>.jsonl`
   in its constructor) — currently not a live bug because
   `tests/liveRun.test.ts` never constructs a real one, always injecting a
   fake `log` object into `LiveRunDeps` directly. This is exactly the shape
   of gap that bit fishing's `dumpUnknownTerminal` in session 39, just not
   yet triggered on the dungeon side. Worth a small follow-up (give `RunLog`
   an optional constructor path, defaulted to `"logs"` in `main()`) so the
   invariant is enforced structurally rather than resting on "no test
   currently does this" — a future test that legitimately wants to exercise
   the real `RunLog` (rather than stub it) would silently write to the real
   project `logs/` with nothing to catch it.
2. **Be honest about what's provable here (per the brief's own §4):** the
   guarantee this session shipped is a compile-time one — inspected by
   reading the two helper signatures, not proven by a runtime test. No test
   asserts "the helper's parameter type has no optional path fields left";
   that's a code-review-level claim, stated plainly here rather than implied
   by a passing suite. The runtime-checkable half (zero inline literals
   outside the helpers, real paths untouched after a full test run) IS
   verified above, by grep and by `stat`, not assumed.
3. **Where the spine goes next** (queued in the session-39 recap, still
   accurate — TASKS.md read directly, not guessed): Task 13's
   deck-composition scoring is NOT STARTED, but its own scoping already
   named a buildable prerequisite — `src/sim/fishing/castSim.ts`'s
   `simulateCast` draws a fresh random deck sample per simulated cast
   (`~castSim.ts:186`) instead of drawing from an explicit passed-in deck;
   making it deck-aware needs no new live capture and is "the one piece of
   this task that COULD be built today" per Task 13's own notes. The FULL
   scorer stays gated behind real validation data Task 13 says doesn't exist
   yet. Task 11 (dungeon utility tuning) stays PARKED, unmet revival
   conditions. QUESTIONS.md §15 and Task 14 both still need a human DevTools
   capture, not code.
4. Also standing: charge-reserve plateau (0.4/0.5/0.6 mutually
   indistinguishable) — not urgent.

## Files changed
```
 tests/liveFishing.test.ts | 145 ++++++++++++++++++++++++----------------------
 tests/liveRun.test.ts     |  15 ++++-
 2 files changed, 90 insertions(+), 70 deletions(-)
```
