# STATE — session 27 — 2026-08-17/18 — commit (pending, see below)

## Status
No TASKS.md gate was targeted this session — the session-27 brief asked for
four investigations (focus-point mechanic, Fintuition/`nextPosition`,
Task 13 heuristic sourcing, Dual Yield) ahead of any code work. **Task 10
stays the last GATE PASS** (session 25, unchanged). All four investigations
are done, fully checked against the fixture corpus and, where useful, a
live server response — not just re-reading session 26's notes.
**Two of the brief's own framings did not survive the check**: the
Fintuition/`nextPosition` "confirmed mechanic" claim is REJECTED (see
Corrections below — the brief's own arithmetic was wrong, and the one
candidate trigger field is constant across the entire 225-turn corpus, so
it can neither confirm nor deny anything). The "is the focus point a
no-op" concern is answered directly: **no**, it's genuinely working, and
that's not why catch rate is low — the real explanation is prediction
quality (matcher starts blind every cast), already understood since
session 14, just under-emphasized in a later DECISIONS entry that quoted
the wrong sim baseline.
No live fishing casts completed this session — see What's broken.
Next per TASKS.md: unchanged from session 26. Task 13's scoring logic
still needs a real data floor (now has a real first candidate to test,
sourced from the user — see Corrections). Task 14 stays BLOCKED. Task 11's
dungeon half stays PARKED.

## What works
- Everything from session 25 (Task 10 orchestrator gate) is unchanged —
  not re-verified live this session, no code touched that path.
- **Focus-point repositioning is CONFIRMED genuinely active in live
  play**, both in code (`bestFocusForCard` searches every cell
  `reachableCells()` allows under the live `focusBudget` and argmax raw EV
  against the predicted distribution — not a stub) and in data (`focusPoint`
  changes value within-cast in 29/30 committed live-cast fixtures, meter
  decrementing in lockstep). This was the brief's top-priority question;
  answer is a clean "yes, working as designed."
- `mineFishPatterns.ts` (Task 11 infra) still functions correctly against
  the growing real transition log — re-run this session: 169 transitions /
  50 real casts (up from 102/30 at session 18), now **2 patterns promoted**
  (`perimeterWalk(cw)` support=4, `perimeterWalk(ccw)` support=3, both ≥
  the 3-cast threshold), up from 1 at session 18. `data/minedFishPatterns.json`
  regenerated with both.

## What's broken
- **No live fishing casts completed this session.** The local guard budget
  (`data/guard-budget-fishing.json`) correctly rolled to a fresh 0/20 at
  UTC midnight, but the REAL server rejected the very first `start_run`
  attempt (2026-08-18 03:33 UTC) with `"Player has reached max runs for
  fishing"` — the real daily reset boundary is NOT UTC midnight (or is a
  rolling window). Fail-closed worked correctly (guard tripped cleanly, 0
  energy spent, confirmed by the accounting print). Corroborated read-only
  on the dungeon side too: `GET /game/dungeon/today` still shows 12/12
  (session 25's exhausted value) at the same 03:33 UTC timestamp,
  `updatedAt` 21:17 UTC the day before — same mismatch, same direction,
  both modes. See QUESTIONS.md §13 — needs the user to say what the real
  boundary actually is.
- Unchanged from session 25/26, not touched this session: the scheduler
  still cannot learn about energy gained outside its own tracking, and a
  single SIGINT during an energy-regen sleep still ends the whole session.

## Corrections to SPEC.md
- None to SPEC.md/SPEC-fishing.md this session (findings live in
  QUESTIONS.md/DECISIONS.md, same as session 26, until confirmed enough to
  promote).
- **Correction to the session-27 BRIEF, not the spec**: its claim that
  8/225 turns (3.56%) of `nextPosition` sightings "matches" a stated 3%
  Fintuition proc rate is WRONG on its own terms — 8/225 counts turns
  where the key merely persists as `null` after one real firing; the real
  firing count is **2/225 (0.89%)**, which undershoots 3%, not matches it.
  Separately, `activeFintuitionTurns`/`fintuitionOilBoostPercent` — the
  only candidate trigger fields this project has — are constant `0`/`null`
  across ALL 225 turns of the corpus, not just at the 2 sightings, so they
  cannot discriminate the hypothesis either way. Fintuition-as-cause is
  **not confirmed**; status is unchanged from session 26 in substance
  (real, rare, cause unknown), just more precisely quantified. Full
  derivation: QUESTIONS.md §12, DECISIONS.md 2026-08-17 (session 27).
- **Correction to a prior DECISIONS.md entry, not SPEC**: the "~70% sim
  catch-rate baseline" restated in the 2026-08-17 (session 21) entry is the
  MATCHER-OMNISCIENT ceiling (matcher can always identify the true
  pattern), not a live-comparable number — this distinction already existed
  in the 2026-08-15 (session 14) entry but got lost in restatement. The
  correct live-comparable baseline is the MATCHER-BLIND figure, re-run this
  session at **6.6%** (500 sim casts, `matcherPool: []`) or **20.8%** with
  the current 2-pattern mined library seeded. Real observed catch rate
  across the 30 committed live fixtures is **4/30 (~13.3%)** — consistent
  with this regime, not anomalously low. See DECISIONS.md 2026-08-17
  (session 27) for the full writeup.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
- Planned a 10-cast live fishing batch to grow Task 13's data floor and
  pattern-mining support, since fresh local budget appeared available and
  CLAUDE.md pre-authorizes autonomous fishing play — stopped after the
  first attempt when the REAL server (not the local guard) rejected it.
  Not a wasted attempt in the useful sense: it's what surfaced the real
  daily-reset-boundary mismatch (see What's broken / QUESTIONS.md §13),
  which is a real finding, but zero new cast data resulted.

## Metrics
- No new live casts completed (1 `start_run` attempted, rejected by the
  real server before any energy was spent — guard-tracked spend stayed at
  0/240 for fishing today).
- Fixture-corpus audit only for the four investigations: 30 committed live
  casts / 225 turns re-examined field-by-field (not just re-reading past
  summaries); `mineFishPatterns.ts` re-run against the full 50-cast local
  transition log (169 transitions, gitignored `data/fish-patterns.jsonl` —
  ahead of the 30 committed fixture dirs, as expected since that log
  persists across sessions independent of what gets committed).
- Real catch rate from the 30 committed fixtures: 4 caught / 30 (~13.3%).
- Tests: 408/408 unchanged (no code touched this session — investigation
  and documentation only). `npx tsc --noEmit` clean.

## Open questions for Claude
1. QUESTIONS.md §13 (new): what is fishing's real daily-reset boundary,
   given it's confirmed NOT UTC midnight (still capped 6+ hours past UTC
   midnight, both fishing and dungeon)? Worth asking the user directly —
   they may simply know their local timezone's midnight, or another fixed
   reference. Until answered, a future session should read-check (or just
   accept the risk of one wasted `start_run` attempt) before assuming a
   fresh UTC day means fresh live budget.
2. Task 13 now has a real, user-sourced first candidate (grid-coverage
   scoring, TASKS.md Task 13's new note) instead of an invented
   alternative — but the task's OWN data-floor gate (needs double-digit
   real card choices, currently has 1) is unchanged and this session made
   zero progress toward it (no live casts completed). Still open: is it
   worth a session spent purely accumulating live fishing casts once the
   real reset boundary is known, or keep waiting on volume from ordinary
   play?
3. Unchanged from session 25/26: should `shutdown.ts` grow a way to skip
   the current energy-regen sleep without ending the whole session?

## Files changed
```
$ git diff --stat aee2992..HEAD
QUESTIONS.md          | 93 +++++++++++++++++++++++++++++++++++++++++++++++-
TASKS.md              | 16 ++++++++
handoff/DECISIONS.md  |  5 +++
3 files changed, 113 insertions(+), 1 deletion(-)
```
No fixture or code changes — documentation/investigation only. Two empty
fixture directories created by the failed live-cast attempt (no state
files, git doesn't track empty dirs) were deleted before commit.
