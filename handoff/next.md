# BRIEF — session 41

Session 40 landed the structural fix cleanly: `tests/liveFishing.test.ts`'s
five inline `LiveFishingDeps` literals collapsed into one
`makeLiveFishingDeps()` helper whose parameter type requires
`transitionsPath`/`guardStatePath`/`nextPositionLogPath`/`logsDir`
explicitly — dropping any of the four is now a compile error, not a silent
fallback to a real path. It re-confirmed `tests/liveRun.test.ts` live
(grep, not assumed) rather than trusting the session-32 decision-log
entry, and correctly declined to over-apply the fix: it read every call
site of `opponentModelPersistence`/`playCountsPersistence` before deciding
NOT to require them the same way, since both are safe-by-omission
(no-ops when undefined) rather than defaulting to a real path — requiring
them would have misrepresented the actual risk. 559/559 tests (unchanged —
pure refactor), `tsc` clean, `git diff --check` clean, and it directly
`stat`-checked that every real data/log path was untouched after the test
run rather than assuming the refactor worked.

It also found a live loose end and was honest that it didn't fix it:
`scripts/liveRun.ts`'s `RunLog` class has no injectable path at all
(hardcoded `mkdirSync("logs")` in its constructor) — currently harmless
only because no test constructs a real one, but the exact same shape as
the `dumpUnknownTerminal` bug session 39 fixed on the fishing side.

---

## Correcting my own prior brief before assigning new work

Session 40's brief (mine) queued "Task 13's deck-aware `simulateCast`
prerequisite" as the next TASKS.md pick, describing it as buildable,
no-capture-needed work. **That was wrong, and I should have caught it by
reading the code, not just TASKS.md's own top-of-section text.** I read
`src/sim/fishing/castSim.ts` directly this time: the `deckIds` option on
`CastOptions` already exists, with a header comment reading
`[ADDED session 26, Task 13 infrastructure]` — the deck-aware prerequisite
was built three sessions before session 22's scoping text (which
TASKS.md's Task 13 "What would unpark it" section still describes as an
open condition) even mentions it. TASKS.md's own session-27 addendum,
later in the SAME section, already correctly treats this infrastructure as
existing ("the deck-aware `simulateCast` infrastructure (session 26)") —
so the document contradicts itself between an unrevised session-22
paragraph and a correct session-27 one, and I repeated the stale half.

**Consequence: there is no ready, code-shaped Task 13 work right now.**
The infra prerequisite is done; the only remaining blocker is the real
validation floor (double-digit real card-choice observations — currently
one), which is a capture question, not a code question, same shape as
QUESTIONS.md §15 and Task 14. Task 11 stays parked on its own unmet
revival conditions. This session's actual scope is smaller and more
honest than last brief's framing suggested.

---

## 1. Close the `RunLog` gap on both entry points (small, primary)

Relevant code, confirmed against the current tree:

- `scripts/liveRun.ts:352-364` — `RunLog`. Constructor takes no
  parameter; `mkdirSync("logs", ...)` and `join("logs", 'run-${stamp()}.jsonl')`
  both hardcoded. Constructed once, at `:1218` (`main()`).
- `scripts/liveFishing.ts:627-639` — a SEPARATE `RunLog` class, same
  shape, same bug: hardcoded `"logs"`, `fishing-${stamp()}.jsonl`. Session
  40's open question only named the dungeon-side one — this session found
  the fishing side has the identical gap, unfixed for the same reason
  (no test currently constructs a real one there either).
- Both classes are imported into `scripts/orchestrator.ts` under aliases
  (`RunLog as DungeonRunLog`, `RunLog as FishingRunLog`,
  `:71-72`) and constructed there too (`:273, :313`) — the same "check
  every entry point" lesson CODEXAUDIT #1 already taught this project
  applies here: both `main()`s AND `orchestrator.ts` need the fix, not
  just whichever one a session happens to be looking at.

**Implementation:**

1. Give both `RunLog` classes an optional constructor parameter (e.g.
   `constructor(dir: string = "logs")`), defaulting to today's real path
   so behavior is byte-for-byte unchanged for every existing caller that
   doesn't pass one.
2. Nothing currently NEEDS to pass a non-default value in production —
   this is purely closing the gap before a future test (or future
   feature) reaches for `new RunLog()` directly and reintroduces exactly
   the bug class sessions 30/31/39 already shipped. Don't invent a reason
   to thread a real override through `LiveRunDeps`/`LiveFishingDeps`
   right now if nothing needs one.
3. Add ONE regression test per file proving the constructor parameter
   actually works (writes into the passed directory, not `"logs"`) — this
   makes it possible for a FUTURE test that legitimately wants a real
   `RunLog` to do so safely via `new RunLog(isolatedTempDir)`, with a
   working example already in the test file, instead of reaching for the
   no-argument constructor the way the bug always started.
4. Grep-confirm (same discipline session 40 used) that no other file
   constructs either `RunLog` class without checking whether it should
   now pass a path — there should be exactly the production call sites
   named above, unchanged, plus whatever new test(s) this session adds.

---

## 2. Fix TASKS.md's stale Task 13 section

Small, but real — this project treats TASKS.md as shared memory across
sessions specifically because a contradiction in it "invites a future
incorrect fix" (the same reasoning CLAUDE.md already states for other
sections). Update Task 13's "What would unpark it" list so it doesn't
contradict its own later session-27 addendum: state plainly that
condition (1), the deck-aware `simulateCast` prerequisite, was built
session 26 (cite the `deckIds` option directly), and only condition (2)
(double-digit real card-choice data) remains outstanding. Don't rewrite
the rest of Task 13's scoping — the validation-floor reasoning and the
grid-coverage candidate-heuristic sketch are still accurate — just correct
the one paragraph that's now out of sync with reality.

---

## Your task

1. §1 (both `RunLog` fixes) is the primary code work.
2. §2 (TASKS.md correction) is required, not optional — same standard this
   project applied to DECISIONS.md corrections after sessions 35/36's
   overclaims.
3. There is no other ready TASKS.md work this session, per the correction
   above — don't invent scope to fill the session. If §1 and §2 land with
   time to spare, that's a legitimate short session; say so plainly rather
   than manufacturing additional work.
4. Recap normally, full suite + `tsc` + `git diff --check` against the
   final commit, plus a live check (same as session 40's `stat` approach)
   that no real `logs/` file was touched by the new regression tests.

---

## Queued, not this session

- Task 13's scoring logic itself — genuinely blocked on more real fishing
  catches (double-digit card-choice observations), not code. Revisit once
  that data exists.
- Task 11 (dungeon utility tuning) — PARKED, unmet revival conditions
  unchanged.
- QUESTIONS.md §15 (stuck fishing account after an escape) and Task 14
  (bot-initiated juiced `start_run`) — both still need a human DevTools
  capture, not code.
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends
  the whole session (unchanged since session 25).
- The charge-reserve plateau (0.4/0.5/0.6, mutually indistinguishable) —
  not urgent.
