# STATE — session 10 — 2026-08-15 — commit b43e241

## Status
Task 5's gate: **RETIRED to reported-metrics** (per session-10 brief §2, not
re-run this session). Task 11's mean-rooms-cleared gate: **PROMOTED to the
live objective, attempted, GATE FAIL — and the failure is itself the
finding.** A structural utility fix and a loot-ranking fix both landed and are
validated harmless, but a 10x weight-amplification sweep found neither moves
`meanRoomsCleared` or room-1 win rate beyond noise. Five more live runs (asked
for in the brief) did **not** happen — blocked before the first action by
today's guard budget already being fully spent by session 09.
Next per TASKS.md: the five-run stage is still owed, now blocked on a human
budget decision (QUESTIONS.md #8) rather than on code. Task 7 (fishing) stays
blocked on the HAR capture, now bundled with item metadata (QUESTIONS.md #3).
Overall: this session did the diagnostic + retune work the brief asked for and
got a clean negative result — the evidence points at single-battle lethality
scaling with room depth as the real constraint, not cross-room HP
mismanagement, but nothing live confirms that yet because no live run
happened this session.

## What works
- Everything from session 09 (client, guards, persistence, `pickLowestTier`,
  the two new `moveDelta` boons) — unchanged, untouched this session.
- **`scripts/deathRooms.ts` (new)**: groups the corpus by `DUNGEON_ID_CID`
  across capture directories (one live run often spans several — each
  `npm run live` invocation writes its own dir) and counts only attempts
  ending at player HP 0, excluding pre-session-08 human research captures
  that were never played to a death. Verified against a hand-derived
  cross-check before being trusted.
- `npx tsc --noEmit` — clean, exit 0.
- `npx vitest run` — **236 tests, 14 files, all pass** (unchanged count from
  session 09 — one test rewritten, none added or removed).
- `npx tsx scripts/sim.ts` — Task 5's own gate report still prints and still
  passes (room-1 CIs still non-overlapping); the retune did not regress it.

## What's broken
- **The retune has no measured live confirmation.** Everything below is a sim
  result plus a corpus-derived histogram; zero live actions happened this
  session (see blocker below).
- 17 `reward_*`/`path_*` HTTP 500s per 5 runs (session 09) — the session-10
  brief's proposed envelope test (send the tracked `actionToken` and real
  `dungeonId` instead of `""`/`0`) was never attempted; no live reward pick
  occurred this session to test it on.
- Same open items as session 09: `path_one`/`path_three`,
  `reward_two`/`reward_four` still naming-pattern inferred only;
  `use_item`/`heal_or_damage`/`flee`/`cancel_run` still `[VERIFY]`; no
  item-metadata endpoint confirmed.

## Corrections to SPEC.md
- §4b: the win terminal's "Enemy dead → +1000" is no longer flat. Documented
  the new `winValue + base` form, the reasoning, and the sweep result that
  found it doesn't move `meanRoomsCleared`.
- §4c: Heal's urgency bonus corrected from a step function to continuous in
  `(1 - hpFraction)`.
- No ID/endpoint corrections this session — no live traffic occurred.

## Dead ends
- **Retuning the utility function's HP/armor weights and depth bonus to
  address cross-room attrition.** Tried amplifying `weights.hp` and
  `depthBonus` up to 10x (individually and combined, N=20000, seed 1) against
  `meanRoomsCleared` and room-1 win rate. Every result lands inside every
  other's 95% CI — no separation at any magnitude tested. Do not retry this
  specific lever (weight magnitude on the existing linear utility form)
  without new evidence; the game's discrete 3-move RPS structure with large
  ATK/DEF asymmetries appears to leave little near-tie EV gap for a margin
  term to break. The mechanistic fix (win margin, still a real bug) is kept
  because it's correct in isolation, not because it moved a number.

## Metrics
- Live: **0 runs this session** — blocked before the first action (see below).
- Death-room histogram (whole corpus, 6 confirmed deaths, via
  `scripts/deathRooms.ts`): room 1 x0, room 2 x2, room 3 x2, room 4 x2. Spread
  evenly across rooms 2-4, not clustered at 2-3 — reads as enemy scaling per
  the brief's own diagnostic, though n=6 is thin. 9 additional corpus captures
  (all pre-session-08) stopped without a death and are excluded, not folded
  in as false deaths.
- Sim, N=20000, seed 1, ev-engine vs random, retuned config: room-1 battle win
  rate 86.4% ± 0.5 [85.9, 86.9] (up from session 09's 81.8% ± 2.4 at N=1000 —
  same config, larger N, not attributable to the retune: the pre-retune
  baseline at the same N=20000 is also 86.4% ± 0.5, identical to three
  significant figures). Mean rooms cleared 1.946 ± 0.017, both before and
  after retune. `deepestScorableRoom` 3 at this seed (session 09 reported 4 at
  a different seed/N — both are real, `deepestScorableRoom` is sensitive to
  which boon offers get drawn).
- Weight sweep (N=20000 each, all figures mean rooms cleared ± 95% CI):
  baseline 1.946±0.017, hp×3 1.967±0.017, hp×10 1.945±0.017, depthBonus×5
  1.955±0.017, depthBonus×10 1.956±0.017, hp×3+depthBonus×5 1.975±0.017. No
  pair separates.
- Tests: 236 passed, 0 skipped, 0 failed (unchanged from session 09).

## Open questions for Claude
1. **The retune's null result plus the even death-room histogram both point
   at single-battle lethality (enemy scaling with depth) rather than
   cross-room HP mismanagement as the real constraint.** Worth deciding
   whether the next session's effort should go toward a better opponent-model
   read at rooms 2-4 (thin today, under the 30-observation floor per DECISIONS
   2026-08-15), toward capture past room 4, or toward something else entirely
   — weight-tuning the current utility form looks like a dead end at any
   magnitude, not a matter of finding the right number.
2. **This session got zero live confirmation of anything**, because the
   five-run stage was blocked before the first action by today's already-spent
   guard budget (QUESTIONS.md #8) — a state this session discovered, not one
   the brief could have anticipated. Needs a budget decision (raise
   `dailyEnergyBudget`/`maxRunsPerSession` for today, or accept a day's delay)
   before the brief's core ask (five more runs, the envelope test) can happen
   at all.
3. **`deepestScorableRoom` is seed/N-sensitive** (3 vs session 09's 4, same
   config) — worth deciding whether to report it as a range or pick a
   canonical N going forward rather than quoting whichever run happened to be
   on hand, since it reads as more volatile than a single number suggests.

## Files changed
```
8 files changed, 334 insertions(+), 20 deletions(-)
(no new fixture directories — no live traffic this session)

QUESTIONS.md            | 70 ++++++++++++++++++++++++++++++++----
SPEC.md                 | 40 ++++++++++++++++++---
TASKS.md                | 92 +++++++++++++++++++++++++++++++++++++++++++++++
handoff/DECISIONS.md    |  5 +++
scripts/deathRooms.ts   | 96 ++++++++++++++++++++++++++++++++++++++++ (new)
src/strategy/loot.ts    | 10 +++++-
src/strategy/utility.ts | 26 +++++++++++---
tests/strategy.test.ts  | 15 ++++++--

full stat: `git diff 1b0d77f..b43e241 --stat`
```
