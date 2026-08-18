# STATE — session 26 — 2026-08-17 — commit 928c870

## Status
No TASKS.md gate was targeted this session — session 25's brief asked for an
investigation (fishing's `nextPosition`/`nextMovePath` field) ahead of Task
13, plus Task 13's own non-gated infrastructure piece. Both done; **Task 10
stays the last GATE PASS** (session 25, unchanged).
Investigation outcome: **the field is real but does NOT hold up as the
"bigger lever than `mineFishPatterns.ts`" session 25 hoped for.** Checked
against all 30 committed live fishing-cast fixtures (225 turns), zero new
live casts spent. The field appears on only 8/225 turns across 2/30 casts —
neither terminal-only (the original catch-resolution guess) nor every-turn
(the hopeful look-ahead reading). One checkable prediction matched exactly;
n=1 doesn't establish a mechanic. No candidate trigger field explains the
2/30 rate. Full derivation: QUESTIONS.md §12, DECISIONS.md 2026-08-17
(session 26).
Next per TASKS.md: **Task 13's scoring logic** (deck-composition
`chooseNewCard` replacement) is the next unblocked task — its
infrastructure prerequisite (deck-aware `simulateCast`) is now built, but
the task's own gate still needs more real card-choice data than exists
today (1 live choice on record) before a sim-vs-live comparison means
anything; see TASKS.md Task 13 for the full validation-floor reasoning,
unchanged this session. Task 14 (bot-initiated juiced `start_run`) stays
BLOCKED on a live DevTools capture. Task 11's dungeon half stays PARKED.
Overall: this was a narrowing/infrastructure session, not a gate session —
no regression, no new capability shipped to live play, one real finding
that closes off a hoped-for shortcut and one small reusable building block
for whenever Task 13 actually unparks.

## What works
- Everything from session 25 (Task 10 orchestrator gate) is unchanged —
  not re-verified live this session, no reason to expect regression (no
  code touched that path).
- `src/sim/fishing/castSim.ts`'s `simulateCast` now accepts an optional
  `deckIds` (real card ids resolved against `loadDendrenDeck()`'s catalog)
  instead of always drawing a fresh random sample of the whole catalog —
  verified by 4 new tests (deterministic-given-fixed-deck, throws on an
  unknown id, actually changes what's drawable). Nothing calls it with a
  real deck yet — infrastructure only, `chooseNewCard`'s scoring logic is
  untouched.
- `scripts/liveFishing.ts`'s unknown-doc-field detector now fires on EVERY
  `play_cards` turn, not just the cast's terminal doc — verified by
  existing `unknownDocKeys` unit tests (function itself unchanged) plus a
  full-suite pass; no live cast run this session to confirm the widened
  call site end-to-end (next live fishing session will).
- Full test suite + typecheck, re-run against the final commit:
  **408/408, `tsc --noEmit` clean.**

## What's broken
- Nothing broken by this session's changes.
- Unchanged from session 25, not touched this session: the scheduler still
  cannot learn about energy gained outside its own tracking, and a single
  SIGINT during an energy-regen sleep still ends the whole session (not
  just that wait) — `shutdown.ts`'s known gap, still just a documented
  workaround (full restart), not fixed.

## Corrections to SPEC.md
- None this session — `nextPosition`/`nextMovePath` were never documented
  in SPEC.md or SPEC-fishing.md in the first place, so there was no claim
  to contradict; the finding lives in QUESTIONS.md/DECISIONS.md until (if
  ever) it's confirmed enough to promote into the spec proper.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
- None new this session. The investigation's own negative-shaped result
  (the field is too rare to be a standing per-turn signal) is a finding,
  not a dead end in the "tried an approach and abandoned it" sense — no
  code was built and reverted; the widened detector that came out of it is
  kept and useful regardless of how rare the field turns out to be.

## Metrics
- No new live dungeon runs or fishing casts this session (0 network calls
  made — everything came from replaying already-committed fixtures).
  Real daily caps are whatever they were left at by session 25 (both
  exhausted at that session's end: 12/12 dungeon, 20/20 fishing).
- Fixture-corpus audit only: 30 live fishing casts / 225 turns inspected,
  8 turns with the `nextPosition` key present, 2 with a non-null value, 1
  checkable prediction (correct).
- Tests: 408/408 at final commit (+4 from session start's 404: the new
  `deckIds` describe block). `npx tsc --noEmit` clean throughout.

## Open questions for Claude
1. Task 13's scoring logic still needs "enough real catches that the '1
   live choice' validation floor becomes double digits" (its own gate,
   TASKS.md) before a sim-vs-live comparison would mean anything — the
   deck-aware `simulateCast` infrastructure built this session removes one
   of the two prerequisites the session-22 scoping named, but the data
   floor is unchanged. Is it worth a session spent purely accumulating
   live fishing casts (no code) to grow that number, or should Task 13
   keep waiting on volume that accrues naturally from ordinary play?
2. The widened per-turn unknown-field detector (this session) has never
   fired live yet — it's only been verified against replayed fixtures. Is
   there a preference for how the next live fishing session should treat
   a NEW `nextPosition` sighting: just log it and keep playing normally
   (current behavior), or pause/flag it more loudly given how rare it is?
3. Unchanged from session 25: should `shutdown.ts` grow a way to skip the
   current energy-regen sleep without ending the whole session, or does a
   full restart (already documented as safe) stay the accepted answer?

## Files changed
```
$ git diff --stat 1a50a9f..HEAD
QUESTIONS.md                  | 119 ++++++++++++++++++++++--------------------
handoff/DECISIONS.md          |   1 +
scripts/liveFishing.ts        |  22 +++++---
src/sim/fishing/castSim.ts    |  29 +++++++++-
tests/fishing/castSim.test.ts |  40 ++++++++++++++
5 files changed, 145 insertions(+), 67 deletions(-)
```
No new fixture directories — this session made zero live API calls.
