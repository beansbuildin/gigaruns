# STATE — session 12 — 2026-08-15 — commit bc58822

## Status
Task 8 "Fishing strategy": **GATE PASS.** Task 6's live-run capability:
exercised again (2 more runs, 0 clean-model failures, 0 HTTP 500s, deaths at
rooms 3/4). Task 11's dungeon gate: unchanged this session (still the
session-10/11 null result — not re-attempted; see Open Questions).
Next per TASKS.md: Task 9 (live fishing, supervised — needs a real Dendren
cast, blocked on user availability the same way Task 6 was) or Task 12
(potion timing, newly restored — blocked on a `use_item` confirmation that
needs a live run reached to certain death, not yet attempted).
Overall: fishing's core algorithm (matcher, EV card-choice, cast sim) is
built and gate-passing, grounded in the one real captured cast rather than
guesswork — replaying that cast turn-by-turn caught two real spec-vs-corpus
contradictions, both corrected. A convergence measurement answered SPEC.md's
open policy-shape question (hedge-throughout, not identify-then-exploit, is
the right default). A gear-upgrade sweep gives the user a concrete
progression ranking. Potion timing is restored as a real task after a user
correction reversed session 11's downgrade.

## What works
- **Task 8 (fishing strategy): GATE MET.** `src/strategy/fishing/matcher.ts`
  (hypothesis elimination), `src/strategy/fishing/cardChoice.ts` (re-derived
  `(card, focus)` EV per the corrected SPEC.md §5), `src/sim/fishing/`
  (geometry, synthetic pattern library, deck loader, cast simulator).
  Verified by: `npx vitest run tests/fishing` (18/18 pass) —matcher narrows
  monotonically and predicts the real cast's actual next cell correctly once
  `|H| == 1`; 500-synthetic-cast sim, matcher-EV policy 19.0% catch rate vs
  random 7.8% (caught 95/500 vs 39/500); empty-`|H|` fallback tested
  directly and shown to trigger for real when the actual cast is replayed
  against the synthetic pool. `npx tsc --noEmit` clean throughout.
- **Two real corpus-vs-spec corrections**, found by replaying
  `fixtures/fishing-casts/cast.json` against `SPEC.md`/`SPEC-fishing.md`'s
  own claims before writing strategy code (CLAUDE.md §9): the catch meter's
  direction was backwards in `SPEC.md` (a hit decreases `fishHp` toward 0,
  the catch; a miss increases it toward `fishMaxHp`, the escape — confirmed
  directly, the real cast's escape fires exactly at `fishHp == fishMaxHp`
  with mana still 5/10, not 0), and `CARD_PLAYED`'s `value` field is the
  hand index played, not a hit/miss flag as `SPEC-fishing.md` claimed (the
  real cast's one genuine hit has `value: 0`; three of its misses have
  `value: 1`). Hitbox geometry upgraded from `[VERIFY, but very likely
  correct]` to `[CONFIRMED]` by the same replay.
- **Fish-convergence measurement** (`scripts/fishConvergence.ts`, session-12
  brief §2): against a documented synthetic stand-in library (the real
  pattern set is still unknown), convergence is bimodal — fast (median 1-2
  turns) when it happens, but up to 58% of trials never converge at the
  largest pool swept. Decides SPEC.md §5's open question: hedge-throughout
  is the default policy shape, identify-then-exploit is a bonus, not an
  assumption. Written into `SPEC.md §5`.
- **Gear-upgrade sweep** (`scripts/gearSweep.ts`, session-12 brief §5): all 8
  single-stat +4 upgrades ranked by mean rooms cleared, 1000 runs each,
  ev-engine policy, real `PLAYER` baseline. Sword ATK tops the list (+0.305),
  consistent with session 11's own live gear change already being the
  biggest lever found this project. Required adding an optional `player`
  override to `SimOptions`/`simulateRun` (`src/sim/dungeonSim.ts`),
  documented diagnostic-only like the existing `offers` override.
- **Task 6 (live dungeon), exercised again**: 2 more live 20-energy runs (not
  this session's focus — ran in the background to use the day's remaining
  budget rather than leave it idle), rooms reached 3 and 4 (both deaths). 0
  HTTP 500s, 0 guard trips, exit 0. 0 clean-model failures across the now-
  larger corpus. Verified by: `logs/run-2026-08-15-18-10-20.jsonl`,
  `fixtures/dungeon-runs/run-2026-08-15-18-10-21/`.
- `npx tsc --noEmit` — clean, exit 0.
- `npx vitest run` — **272 tests, 21 files, all pass** (267 → 272 this
  session's fishing build, then 4 corpus-total assertions re-derived — not
  just bumped — after the 2 new live runs; see Corrections).
- `npx tsx scripts/sim.ts` — Task 5's gate report still passes (500 runs,
  intervals non-overlapping), `deepestScorableRoom` still 4, re-measured
  against the now-larger corpus.

## What's broken
- **Task 11's dungeon gate: still NOT MET, not re-attempted this session.**
  Session 10/11's null result (weight-tuning the current utility form moves
  nothing) stands unchanged. The 2 new live runs this session (died rooms 3,
  4) are a THIRD independent confirmation of the death-room histogram's even
  spread across rooms 2-4 (now 0/3/4/4 at n=11, was 0/3/3/3 at n=9) — still
  no shift toward early rooms, still reads as single-battle lethality
  scaling with depth, not cross-room HP mismanagement. No code changed here
  this session.
- **Task 12 (potion timing)'s Stage A blocker is unresolved.** `use_item` is
  still `[VERIFY]` and the live loop doesn't send it — confirming it needs a
  live run reached to certain death, which didn't come up in this session's
  2 background runs (both died mid-fight, not spotted as "certain" in
  advance by the current loop, which has no such detection). Needs either
  code to detect a doomed state and attempt the confirmation, or a
  supervised session watching for the moment.
- **Task 9 (live fishing) hasn't started.** The matcher/EV code is built and
  gate-passing in sim, but has never been run against a real cast — needs a
  real Dendren cast (dry-run, then real, then five) same as Task 6's staging.
- The fish-convergence numbers in `scripts/fishConvergence.ts` are against a
  SYNTHETIC stand-in library (documented as such throughout) — real
  convergence behavior is unknown until Task 9's transition log exists.

## Corrections to SPEC.md
- §5: "Hit → catch meter rises. Miss → catch meter falls. Fill the meter to
  catch. Run out of mana, or let the meter hit zero, and the fish escapes"
  was BACKWARDS on every count. Real: hit decreases `fishHp` toward 0 (the
  catch), miss increases it toward `fishMaxHp` (the escape). Confirmed
  directly against the real cast's own `fishHp` trajectory and its
  `FISH_ESCAPED` firing point.
- §5: hitbox geometry upgraded `[VERIFY, but very likely correct]` →
  `[CONFIRMED]` — the 1-9 zone template, focus-relative, scored against the
  fish's POST-move cell, re-derived exactly from the real cast's one genuine
  hit (turn 3).
- §5: Card choice re-derived for the confirmed movable-focus mechanic — the
  action is now a `(card, focus)` pair, EV maximized over both, per the full
  formula in `SPEC.md §5`. The old fixed-hitbox formula is retired.
- §5: added a convergence-vs-affordance section answering whether hypothesis
  elimination is even the right frame — see `scripts/fishConvergence.ts`.
- SPEC-fishing.md §4: `CARD_PLAYED`'s `value` field is the hand index
  played, not "0 (miss) or 1 (hit)" as previously written. The real hit/miss
  flag is `data.result` (1/0). `FISH_MOVED`'s `data.path` decoded as a
  1-based column-major cell index. `NEW_HAND` fires when the hand is played
  down to empty, not "when the hand changes" generally.
- Resolved IDs unchanged: **forbiddenWoods=5**, **dendren nodeId="5" /
  pondId=2** (still two separately-recorded identifiers, not confirmed
  interchangeable).
- Move charges: unchanged, PRESENT, hard-pruned.

## Dead ends
- None new on the strategy side. The session-10/11 dungeon-tuning dead end
  (utility-weight amplification moves nothing) stands, untouched this
  session — Task 11 was not re-attempted.

## Metrics
- Fishing sim: 500 synthetic casts, matcher-EV policy catch rate 19.0% (95/500)
  vs random 7.8% (39/500). Convergence sweep (400 trials/library size,
  synthetic pool): converged fraction ranges 42.3%-84.5% within a 5-turn
  affordance depending on library size (4-23 patterns); never-converged
  fraction ranges 15.5%-57.8% at 40-turn cutoff.
- Gear sweep: 1000 runs/candidate, ev-engine policy. Top upgrade Sword ATK
  +4: mean rooms cleared 2.408 ± 0.069 vs baseline 2.103 ± 0.070 (+0.305).
  Full ranking in `scripts/gearSweep.ts` output.
- Live dungeon: 2 runs this session, 20 energy each, rooms reached 3 and 4
  (both deaths). 176/240 energy spent today, 10/12 runs. 0 HTTP 500s, 0
  guard trips. Death-room histogram (corpus-wide, 11 confirmed deaths):
  room 1 ×0, room 2 ×3, room 3 ×4, room 4 ×4.
- Tests: 272 passed, 0 skipped, 0 failed (267 → 272 net; 18 new fishing
  tests, 4 corpus-total assertions re-derived to match the larger corpus).
- Replay: 602 side-updates (up from 528), 0 clean failures, 22 unscorable
  mismatches (all reason-coded, none unexplained).

## Open questions for Claude
1. **Task 9 (live fishing) vs Task 12 Stage A (potion `use_item`
   confirmation) — which gets the next session's live-play attention?** Both
   need a supervised live session to make progress: Task 9 needs a real
   Dendren cast start-to-finish (dry-run, then real, then five, same staging
   as Task 6). Task 12 needs a dungeon run watched to a certain-death state
   so `use_item` can be sent once, safely, per CLAUDE.md §4/§7. Fishing has
   more code riding on it (Task 8's full matcher/EV engine is built and
   idle until Task 9 runs), but potion timing is the largest identified
   dungeon lever (+4/+8/+20 flat heals against a ~32 HP pool, deaths
   currently spread evenly across rooms 2-4). Worth deciding which is the
   spine rather than splitting a session thin across both, same reasoning
   as the session-12 brief's own Task 8-vs-Task 11 call.
2. **Task 11's dungeon gate is now doubly stale** — untouched for two
   sessions running while the corpus grew from n=9 to n=11 confirmed deaths,
   still 0/3/4/4 across rooms 1-4. The session-10/11 finding (weight-tuning
   the current utility form moves nothing; the real lever is either potion
   timing or a genuine opponent-model/depth-of-capture change) stands
   unchallenged. Worth deciding whether Task 11 stays parked until Task 12
   lands, or whether the opponent-model-read option (rooms 2-4, still thin)
   is worth a dedicated look now that n=11 exists.
3. **The convergence numbers in `scripts/fishConvergence.ts` are the
   algorithm's behavior against a documented STAND-IN library, not a claim
   about real Dendren.** Once Task 9 produces real transition logs, this
   measurement should be re-run against `data/fish-patterns.jsonl`-derived
   patterns and the SPEC.md §5 policy-shape conclusion (hedge-throughout as
   default) should be checked against real data, not assumed to transfer.

## Files changed
```
22 non-fixture files changed, 1742 insertions(+), 60 deletions(-)
(+96 new fixture files under fixtures/dungeon-runs/run-2026-08-15-18-10-21/;
+9 new source files: scripts/fishConvergence.ts, scripts/gearSweep.ts,
src/sim/fishing/{castSim,deck,geometry,patterns}.ts,
src/strategy/fishing/{cardChoice,matcher}.ts;
+4 new test files under tests/fishing/)

QUESTIONS.md                       |  40 +++++++
SPEC-fishing.md                    |  33 +++---
SPEC.md                            | 144 +++++++++++++++++++++----
TASKS.md                           | 107 ++++++++++++++----
handoff/DECISIONS.md               |   5 +
scripts/fishConvergence.ts         | 190 ++++++++
scripts/gearSweep.ts               | 113 ++++++
src/sim/boons.ts                   |  34 ++++
src/sim/dungeonSim.ts              |  13 ++-
src/sim/fishing/castSim.ts         | 216 +++++++
src/sim/fishing/deck.ts            |  28 +++
src/sim/fishing/geometry.ts        |  66 ++++
src/sim/fishing/patterns.ts        | 187 ++++++
src/strategy/fishing/cardChoice.ts | 163 ++++++
src/strategy/fishing/matcher.ts    |  98 +++++
tests/boons.test.ts                |  11 +-
tests/dungeonSim.test.ts           |  16 ++-
tests/fishing/cardChoice.test.ts   | 149 +++++
tests/fishing/castSim.test.ts      |  36 +++
tests/fishing/geometry.test.ts     |  41 +++
tests/fishing/matcher.test.ts      | 105 +++
tests/replay.test.ts               |   7 +-

full stat: `git diff 7f5b070..HEAD --stat` (before this commit)
```
