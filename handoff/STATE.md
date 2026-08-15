# STATE — session 11 — 2026-08-15 — commit 52d8e0a

## Status
Task 7 "Fishing API discovery": **GATE PASS.** Task 11 "Tuning" (dungeon
half, live objective since session 10): **live confirmation gathered, still
no positive result** — three more retuned-config runs replicate session 10's
null finding exactly. Task 6's live-run capability: exercised again cleanly
(3/3 runs, 0 clean-model failures, 0 HTTP 500s).
Next per TASKS.md: two independent unblocked directions — Task 8 (fishing
strategy, now unblocked by Task 7) and Task 11's own open question (the
retune lever is exhausted; needs an opponent-model read at rooms 2-4 or
capture past room 4, not more weight-tuning). See Open Questions below for
the tradeoff.
Overall: this session did NOT touch strategy code. It (a) got the human
sign-off session 10 was blocked on and ran the live confirmation batch that
sign-off unblocked, (b) closed out the entire fishing-discovery half of the
project via the user's HAR capture, and (c) picked up two new clean boon
models plus a real gear change that the new live captures forced into the
corpus. No regressions; 249/249 tests pass.

## What works
- **Task 7 (fishing API): GATE MET.** `SPEC-fishing.md` documents the full
  endpoint map from a real captured cast; `src/api/fishing.ts` implements
  every schema (zod, same `.passthrough()` convention as the dungeon side);
  `scripts/parseHar.ts` (new) extracts it from any `fixtures/**/*.har`;
  `tests/api/fishing.test.ts` (new, 6 tests) verifies the schemas against
  the redacted fixtures. Verified by: `npx vitest run tests/api/fishing.test.ts`.
- **Task 6 (live dungeon), exercised again**: 3 more live 20-energy runs,
  retuned config from session 10, rooms reached 4/3/2 (all deaths). 0 clean
  combat-model failures across all of them, 0 HTTP 500s. Verified by:
  `logs/session11-liverun.log`, `npm run sim`'s replay report
  (`513/528 matched, 0 cleanFailures`).
- **Item metadata resolved** — the other half of `QUESTIONS.md §3`, found
  opportunistically while parsing the fishing HAR. `GET /offchain/static`'s
  `gameItems[]` gives names, descriptions, AND a structured `itemEffect` —
  the three heal potions are confirmed flat heals (+4/+8/+20 HP), not
  percentage. Verified by: `tests/api/fishing.test.ts`'s item-metadata test.
- **Two new clean+modelled boon types** from this session's live picks:
  `AddMaxArmor` (`armorMax += val1`, current armor untouched — the boon
  `QUESTIONS.md §5b` called the highest-value capture left) and
  `CorrosiveShield` (latent, zero delta like `AddBurnSword`). Verified by:
  `npx vitest run tests/boons.test.ts` (35/35 pass).
- `npx tsc --noEmit` — clean, exit 0.
- `npx vitest run` — **249 tests, 15 files, all pass** (+13 vs session 10's
  236: 6 new fishing schema tests, plus corpus-total assertions that
  shifted with the new live captures and had to be re-derived, not just
  bumped — see Corrections).
- `npx tsx scripts/sim.ts` — Task 5's gate report still passes, re-measured
  against the new gear loadout (see Metrics; do not compare its win-rate
  numbers to session 10's without accounting for the gear change).

## What's broken
- **Task 11's dungeon gate: still NOT MET, and now doubly confirmed.** The
  three new live runs replicate session 10's finding exactly — deaths still
  spread evenly across rooms 2/3/4 (now 3 each, was 2 each), not clustering
  early. The retuned utility function did not shift the distribution. This
  is the SAME conclusion as session 10, now with independent live
  confirmation rather than resting on the sim + a thin n=6 histogram alone.
  Retuning the current utility form is a dead end; the next lever has to be
  a better opponent-model read at rooms 2-4 or capture past room 4 (both
  still thin), not more weight sweeps.
- **The `reward_*`/`path_*` 500 pattern from sessions 08/09 (2, then 17
  occurrences) did not recur at all this session — 0/3 runs.** Genuinely
  ambiguous whether this means the earlier 500s were transient server noise
  (as the session-10 brief's own fallback anticipated) or this batch was
  lucky; 3 runs is too thin to call it either way. The §3 envelope test
  (`QUESTIONS.md §9`) stays queued, unexercised for a second session running
  — not blocked this time, just no opportunity arose.
- **Potion trigger mechanism still unconfirmed.** Flat heal amounts are now
  known (+4/+8/+20), but whether `OnUseBattle` means an automatic HP-
  threshold proc or a manual mid-battle action is not settled by this
  capture (a fishing cast, not a dungeon battle) — needs a live dungeon run
  with a non-empty `consumables` loadout, or a direct user answer.

## Corrections to SPEC.md
- §5 (fishing) said "3×3 grid" as an unverified guess. Live capture: Dendren
  is a **4×4 grid with the bobber/focus mechanic ENABLED** — card hitboxes
  are relative to a movable `focusPoint`, not absolute cells. Corrected in
  SPEC.md with the real capture cited; `SPEC-fishing.md §4` has the detail.
  The simpler 3×3/focus-off pond this text originally described may still
  exist but was never captured — not this bot's target.
- `src/api/fishing.ts`'s `FishingCardSchema`: `startingAmount`/`unlockLevel`
  are NOT always numbers — `isDayCard: true` entries carry explicit `null`
  in the live board state, and the same fields are entirely ABSENT (not
  even `null`) on some entries of the full card catalog. Two different wire
  shapes for "no fixed value", not one; schema now `.nullable().optional()`
  on both fields.
- Resolved IDs: `forbiddenWoods=5` (unchanged, session 03).
  `dendren`: **two separately-recorded identifiers, not one** — `nodeId:
  "5"` (the value sent on the captured `start_run`, confirmed only by
  working) and `pondId: 2` (independently confirmed by
  `pondEntryTiers[]` naming its entries `"dendrenpond-tier1/2/3"`). Do not
  assume they're interchangeable without a second pond's capture. Both in
  `config/discovered.json`'s new `dendren` block.
- Move charges: unchanged this session — PRESENT, hard-pruned
  (`chargesAreHardLimit: true`), per session 04/05.

## Dead ends
- None new this session on the strategy side — no strategy code was
  touched. The session 10 dead end (utility-weight amplification up to 10×
  moves nothing) stands, and is now reinforced by live data rather than
  contradicted or resolved.

## Metrics
- Live: **3 runs this session**, 20-energy, retuned config. Rooms reached
  4, 3, 2 — all deaths, no full clear. 137 total energy spent today (78
  carried in from sessions 09/10 + 59 this session), 8 total runs today.
  0 HTTP 500s (vs 17 across session 09's 5 runs). 0 clean combat-model
  failures.
- Death-room histogram (whole corpus, 9 confirmed deaths, `scripts/deathRooms.ts`):
  room 1 ×0, room 2 ×3, room 3 ×3, room 4 ×3 — exactly even, exactly the
  same shape as session 10's n=6 read, now at n=9.
- Sim, N=1000, seed 1, retuned config, **NEW gear loadout (Sword ATK
  16→20)** — room-1 battle win rate: always-Sword 85.6% ± 2.2, ev-engine
  92.9% ± 1.6 (both scored subsets). **Not comparable to session 10's
  86.4%/86.5% figures** — those were measured under the OLD Sword ATK 16
  loadout; this jump is gear, not model. Mean rooms cleared: always-Sword
  1.632 ± 0.066, ev-engine 2.103 ± 0.070. `deepestScorableRoom` 4 for both
  (MAX_OBSERVED_ROOM, unchanged — a gear or boon-model change doesn't raise
  the corpus's depth ceiling). Gate intervals still non-overlapping — GATE
  MET, re-confirmed post-gear-change.
- Fishing: 1 cast (the HAR capture), 0 catches (fish escaped after 5
  card plays) — insufficient signal to measure a catch rate or pattern
  convergence. Not a live-loop run; Task 9 hasn't started.
- Tests: 249 passed, 0 skipped, 0 failed (+13 vs session 10's 236).

## Open questions for Claude
1. **Two independent unblocked directions exist now, and this session
   didn't pick one.** Task 8 (fishing strategy — matcher, EV-per-mana) is
   newly unblocked by Task 7's gate passing. Task 11's dungeon diagnostic
   (opponent-model read at rooms 2-4, or capture past room 4) is still the
   live objective from session 10's promotion and now has doubly-confirmed
   evidence the current lever is exhausted. Both are legitimate next moves;
   worth deciding which one gets the next session rather than splitting
   effort thin across both.
2. **The `reward_*`/`path_*` 500 pattern went silent for a full 3-run
   batch after being frequent for two sessions running (2, then 17
   occurrences).** Worth deciding whether to keep the opportunistic
   envelope test queued indefinitely, or treat 0/3 as enough evidence to
   write it off as transient server flakiness and stop tracking it
   explicitly.
3. **Potion trigger mechanism (auto-proc vs manual) is the one piece of
   the loadout policy still missing**, now that heal amounts are known.
   Worth asking the user directly rather than waiting for a live dungeon
   capture to maybe show it — a direct answer is cheap and this has been
   open since session 10.

## Files changed
```
12 files changed, 349 insertions(+), 74 deletions(-)
(+1 new file: SPEC-fishing.md; +3 new fixture files under fixtures/fishing-casts/;
+1 new fixture directory under fixtures/dungeon-runs/; +3 new source files:
scripts/parseHar.ts, src/api/fishing.ts, tests/api/fishing.test.ts)

QUESTIONS.md             | 44 +++++++++++++++++++---
SPEC.md                  | 51 ++++++++++++++++++++-----
TASKS.md                 | 54 ++++++++++++++++++++++++++
config/bot.json          |  6 +--
handoff/DECISIONS.md     |  9 +++++
src/sim/boons.ts         | 98 ++++++++++++++++++++++++++++++++++++++++++++----
src/sim/enemies.ts       | 37 +++++++++---------
tests/boons.test.ts      | 29 ++++++++++----
tests/combat.test.ts     | 10 +++--
tests/dungeonSim.test.ts | 47 +++++++++++++++--------
tests/enemies.test.ts    | 28 +++++++++++++-
tests/replay.test.ts     | 10 ++++-

full stat: `git diff e3b21b7..HEAD --stat` (before this commit)
```
