# BRIEF — session 40

Session 39 closed the entire Codex-derived backlog — 22 items across
CODEXREVIEW, CODEXIMPROVE, and CODEXAUDIT, first opened session 28 — and
this time the "fully closed" claim is actually trustworthy: it re-verified
the other four previously-claimed-fixed items live in the tree (grep-
confirmed file/line, not assumed) before writing that sentence, per the
prior brief's explicit instruction not to repeat sessions 35/36's
overclaims. The planned work itself (the `nextPosition` gate) landed
cleanly: a real Wilson-score lower-confidence-bound gate replacing the old
raw-hit-count one, schema-validated log records, grid-bounds checking.
559/559 tests, `tsc` clean, `git diff --check` clean.

**The more important thing that happened this session wasn't the planned
work.** While building the gate, session 39 found the real
`data/nextPositionValidation.jsonl` already contaminated with 35 fake
"hit" records — byte-for-byte a test fixture that had leaked into
production data. Root cause: a `runOneCast` test constructed
`LiveFishingDeps` without overriding `nextPositionLogPath`, falling back
to the real default path, and a separate hardcoded `logs/` write in
`dumpUnknownTerminal()` had no override mechanism at all. This is the SAME
bug class CLAUDE.md already documents as having shipped twice before
(sessions 30, 31) — a third occurrence, in the very file that records the
first two. Consequence, if uncaught: the override this session was fixing
would have been armed in live play from zero real evidence before the fix
even landed.

This session's primary work is closing that bug class structurally, not
just fixing the third instance of it.

---

## 1. Structurally prevent test-constructed Deps from omitting an isolated I/O path

**Root cause, confirmed by reading the actual test file, not assumed:**
`tests/liveFishing.test.ts` has TWO independent patterns for constructing
`LiveFishingDeps` today. A shared `makeDeps(client, guardStatePath)`
helper (`:635`) is used by SOME tests (the guard-trip tests around
`:651, 670`). But the `nextPosition`/dual-yield tests (`:460-580`ish)
build `LiveFishingDeps` object literals INLINE, independently setting
`nextPositionLogPath`/`logsDir` by hand each time — and it was exactly one
of these ad-hoc literals that missed a field. Two independently-maintained
construction sites is precisely how this drifts: a new optional path field
gets added to the interface, one site is updated, the other isn't, and
nothing catches it until the real file shows contamination.

**The fix is to make it impossible to construct test Deps without every
known isolated path, not to fix this one instance and hope the next
session remembers.**

1. Consolidate every `LiveFishingDeps` construction in
   `tests/liveFishing.test.ts` — and, same bug class, every `LiveRunDeps`
   construction in `tests/liveRun.test.ts` — through exactly ONE per-file
   helper. No inline object literals left outside it; every test that
   currently builds one inline gets refactored to call the helper instead
   (passing whatever per-test overrides it actually needs on top of the
   isolated defaults).
2. Give that helper a signature that REQUIRES every currently-known
   isolated-path field explicitly — not defaulted inside the helper, not
   optional. Something in the shape of a dedicated parameter object typed
   against `Required<Pick<LiveFishingDeps, "transitionsPath" |
   "guardStatePath" | "nextPositionLogPath" | "logsDir">>` (confirm the
   exact current field list against the live interface, `:722` onward —
   don't hardcode this brief's list if the interface has grown since).
   The point: when a FUTURE session adds a new optional I/O-path field to
   `LiveFishingDeps`, the helper fails to typecheck until someone updates
   it — a compile error the moment the interface changes, not a silent
   default three sessions later. This is the concrete version of what
   session 39's own open question asked for.
3. Apply the identical treatment to `LiveRunDeps`/`tests/liveRun.test.ts`
   — check whether it already has a single consolidated helper (DECISIONS
   2026-08-18 session 32 describes one existing at the time, but confirm
   it's still the ONLY construction site today, the same way this session
   found `liveFishing.test.ts` wasn't).
4. Be honest about what's actually provable here, same discipline as
   session 37's fsync work: a compile-time guarantee isn't something you
   write a runtime test to prove passing. What IS worth asserting: that
   the helper's parameter type, read by inspection, genuinely has no
   optional/defaulted path fields left (a code-review-level claim, state
   it plainly in the recap rather than implying a test proves it); and a
   grep confirming zero remaining inline `LiveFishingDeps`/`LiveRunDeps`
   object-literal constructions exist in either test file outside the one
   helper each.
5. Before finishing: run the full suite and then directly check the real
   `data/nextPositionValidation.jsonl` and `logs/` (gitignored, real
   paths) are untouched — a live check, not just trusting the refactor
   fixed it. Session 39 already cleaned the 35 fake records and 45 stray
   dump files with user approval; don't reintroduce them while testing
   this fix.

---

## Your task

1. §1 is the whole scope this session — it's small in surface area but
   matters more than another feature session would, given this is the
   THIRD time this exact bug class has shipped.
2. Do not start any TASKS.md work this session even though the Codex
   backlog is closed — this structural fix comes first, precisely because
   it's what would keep corrupting whatever TASKS.md work comes next.
3. Recap normally, full suite + `tsc` + `git diff --check` against the
   final commit, plus the live gitignored-path check in step 5 above.

---

## Queued, not this session — where the spine goes after this

The Codex backlog is closed; TASKS.md is genuinely next. I read TASKS.md
directly rather than guessing at its state:

- **Task 13** (`chooseNewCard` deck-composition scoring) is scoped but
  explicitly NOT STARTED (session 22) — and its own scoping already found
  a real prerequisite gap worth building on its own, separate from the
  full scoring task: `src/sim/fishing/castSim.ts`'s `simulateCast` draws a
  fresh RANDOM deck sample every simulated cast (`deck.push(rng.pick(catalog))`,
  `~castSim.ts:186`), with no concept of a specific held deck that grows
  the way a real account's does. Making `simulateCast` (or a sibling
  function) draw from an explicit passed-in deck instead is, per Task 13's
  own scoping, "well-scoped, needs no new live capture... the one piece of
  this task that COULD be built today." The FULL deck-composition scorer
  stays gated behind a real validation floor Task 13 itself states
  (needs the deck-aware infra AND double-digit real card-choice data, not
  today's single data point) — don't build the scorer itself yet, just
  the deck-aware sim infrastructure, if a future session picks this up.
- **Task 11** (dungeon utility tuning) is PARKED with explicit, unmet
  revival conditions (a materially different utility form, not magnitude;
  the death-room histogram shifting shape past n=11; or Task 12 Stage B
  moving mean-rooms-cleared) — not resumable without one of those, so not
  a natural next pick without new evidence.
- QUESTIONS.md §15 (stuck fishing account after an escape) and Task 14
  (bot-initiated juiced `start_run`) both still need a human DevTools
  capture, not code.
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends
  the whole session (unchanged since session 25).
