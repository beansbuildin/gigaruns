# STATE — session 05 — 2026-08-15 — commit ee47523

## Status
Task 4.5 "Boon model" (inserted by the session-05 brief): **GATE FAIL.**
The gate asked for `deepestScorableRoom` ≥ 4. It is **1**, unchanged from
session 04. The boon model itself is built, verified against fixtures, and
correct — but it does not move the number, and **the gate was never reachable
from this corpus**: enemies 65 and 66 are unscorable *innately*, so even a
perfect boon model caps `deepestScorableRoom` at 2. I retired the gate rather
than carrying it forward as a blocker; flag if you disagree.

Next per TASKS.md: Task 5 (dungeon strategy), gate restated per your §4.
Task 2 (auth + API client) is still unbuilt and remains the only thing between
Task 5 and a live run. No energy was spent this session; nothing has ever
POSTed to the API.

## What works
- `npx vitest run` — **91 tests, 7 files, all pass** (74 → 91; `tests/boons.test.ts`
  is new with 17).
- `npx tsc --noEmit` — clean, exit 0.
- `npm run sim` — replay + 1000 synthetic runs per policy + the Task 4.5 ceiling
  report + the threshold check. All four threshold predictions hold.
- `src/sim/boons.ts` — the four boon types with a pickup pair, as verified state
  deltas. `tests/boons.test.ts` re-derives every delta from the fixtures and
  asserts the *whole* player state lands where the server put it, not just the
  field the model touches.
- `src/sim/corpus.ts` now owns `boonPickups()` — the boon pair-walking rule, in
  the one module permitted to know the wire shape (DECISIONS 2026-08-15).
- Reason codes are now attributable: the blanket `BOON_TAKEN` is replaced in the
  sim by `BOON_UNMODELLED` / `ROLLED_STATS` / `STATUS_EFFECT` per boon.
  Coverage totals are unchanged, so nothing regressed — the breakdown just went
  from one bucket to four.
- `simulate()` returns `meanRoomsCleared` and `roomsClearedCi95` for the
  restated Task 5 gate.

## What's broken
- **`deepestScorableRoom` is still 1, and boons were not the reason.** This is
  the FAIL. Three independent walls (SPEC §4d): (1) 6 of 6 recorded room-1 boon
  options are unmodelled or grant a rolled stat — `Heal`, the only clean boon in
  the corpus, is only ever offered at **room 2**; (2) enemies 65 and 66 are
  unscorable innately, capping the metric at 2 regardless of boon work; (3) only
  four offer triples exist, so there is no grounded offer distribution.
- **`ROLLED_STATS` is now the top blocker, ahead of boons.** It gates the two
  room-1 boons *and* enemy 65 simultaneously.
- `scripts/chargeTable.ts` and `scripts/verifyCombatModel.ts` still lack the
  phase filter and over-count. Superseded; do not cite their numbers.
- `src/api/`, `src/strategy/`, `src/orchestrator/` are still empty.

## Corrections to SPEC.md
All fixed in SPEC.md this commit.

- **Burn is a flat 3 damage per exchange**, `amount` non-decrementing over 3
  consecutive exchanges. This explains all three previously-unexplained
  enemy-66 misses exactly (predicted 28/25/24 → actual 25/24/23, each +3).
  SPEC §4f. **Implemented DEFAULT OFF** (`BURN_PER_EXCHANGE`): the boon's
  `selectedVal1`, the status `amount` and the damage are all the number 3 from a
  single status instance, so the three candidate rules are one observation, and
  it is never seen expiring so duration is unknown.
- **Rolled-stat evidence must be counted in damage-taking OPPORTUNITIES.**
  Side-update counting inflated player `evasion 1` from 8/9 to 20/21 by
  including exchanges the player won outright and took no damage in. Same
  correction as session 04's charge recount — this is the default failure mode
  of every audit in this repo.
- **The enemy-65 half-damage sample is not a function of (moves, stats) alone.**
  029→030 dealt 8 of 16; 032→033 dealt the full 16 in the *same matchup against
  the same enemy*. Rejected: "block halves armor damage" (our Shield's 6 landed
  in full at 030→031), and any flat reduction. "Damage at full armor is halved,
  given block > 0" fits but is one positive sample. SPEC §4e.
- **The one player-side replay miss is CONFOUNDED.** 037→038 is also the only
  exchange in the corpus where a side died on a **tie**, so "evasion 1 dodged"
  and "a side that dies on an exchange deals no damage" are indistinguishable —
  and the second needs no new mechanic at all.
- `shatterblade` fired twice (enemy Sword wins at 042→043, 043→044) and produced
  no status on the player and no damage deviation. n=2, so `ENEMY_BUFF` stays.
- The armor no-refill correction now carries an explicit warning that it rests
  on **one** informative boundary and must be re-checked as the corpus grows,
  plus its downstream consequence: **armor depletes across all 16 rooms**.
- Boon values re-confirmed to come from `selectedVal1`, not the range: Heal's
  `val1Min` is 8 and its `selectedVal1` is 16, and HP moved by exactly 16.
- Resolved IDs: **forbiddenWoods=5**, **dendren=NOT FOUND** (not re-probed).
- Move charges: **PRESENT**, enemy's fully visible, rule unchanged from
  session 04.

## Dead ends
- **Narrowing `ROLLED_STATS` so the room-1 boons become clean.** This was the
  session's most promising idea and it is the one I deliberately did not take.
  Player `evasion 1` is 8/9 exact and `lck 1` is 2/2 — but n=9 with one miss is
  exactly the shape a ~10% dodge proc produces, and the 2026-08-15 opponent-model
  floor (~30 observations before reading any rate) applies. Narrowing it would
  have unlocked room 2 and would have been the enemy-63 "Shield-biased 57% off
  14 exchanges" error in a new costume.
- **Asserting "every boon the sim takes carries a reason code" as a test.** It
  failed on `Heal` at room 2 — correctly, because Heal really is clean. The test
  was asserting my expectation, not the model. Rescoped to room-1 boons, where
  the claim is true and is the actual finding.
- **Inferring `UpgradePaper` from its name and `selectedVal2: 4`.** Almost
  certainly +4 Shield. Not modelled: nobody picked it, so no recorded state
  shows what moved.

## Metrics
- Sim, 1000 runs vs random, **room-1 battle win rate on the scored subset**:
  `random 60.6% · always-Sword 67.9% · always-Shield 55.1%` — identical to
  session 04, confirming the boon work regressed nothing.
- **Mean rooms cleared ± 95% CI** (the restated Task 5 baseline):
  `always-Sword 1.018 ± 0.058 · random 0.859 ± 0.052 · always-Shield 0.847 ± 0.059`
- Coverage, 1000 runs random vs random: `runs 394/1000 · battles 1000/1858 ·
  deepestScorableRoom 1`. Now attributable: 607 BOON_UNMODELLED, 468
  ROLLED_STATS, 41 STATUS_EFFECT, 41 ENEMY_BUFF (battles).
- Boon pickups, random policy: **83/858 scored**. `Heal` is the only type that
  ever kept a run clean — 83/83 of the times it was taken.
- **Counterfactual, labelled as such**: substituting `Heal` into room 1 raises
  `deepestScorableRoom` to **2**, then stops dead at wall 2. Proves the boon
  machinery works and the blocker is capture, not code.
- Rolled-stat audit, damage-taking opportunities: `player evasion1 8/9 ·
  player lck1 2/2 · player none 29/29 · enemy ev2+bl2+lk1 6/7 · enemy none 34/37`
  (all 3 of the last group's misses are Burn).
- Corpus replay: **66 exchanges, 127/132 side-updates, 0 clean failures**.
- Tests: 91 passed, 0 skipped, 0 failed.
- Live: **0 runs, 0 energy, 0 actions POSTed.**

## Open questions for Claude
1. **Do you accept retiring the Task 4.5 gate?** It asked for
   `deepestScorableRoom` ≥ 4, which the corpus cannot produce at any quality of
   boon model, because enemies 65 and 66 are innately unscorable. I recorded it
   FAIL, kept the work, and moved the blocker to capture. The alternative reading
   is that the gate should become ≥ 2 and stay open.
2. **`ROLLED_STATS` is now the single highest-value capture and it is one run.**
   It gates both room-1 boons and enemy 65. QUESTIONS §5a: take `AddEvasion` or
   `AddLuck` early, play a long run, and fight enemy 65 through several Sword
   wins **at full enemy armor** (the anomaly's one distinguishing feature).
   Should session 06 spend one supervised run on this before Task 5, given
   Task 2 must be built first either way?
3. **The die-on-a-tie confound (QUESTIONS §5c) may be free.** If "a side that
   dies on an exchange deals no damage" is the real rule, that is a plain
   addition to the combat model with no new mechanic — and it would also mean
   the player-side evidence for `evasion 1` doing nothing is 9/9, not 8/9.
   Worth asking the user to finish one enemy with a mirrored move?
4. **Task 5 against room 1 only.** With `deepestScorableRoom` pinned at 1 until
   a capture lands, the restated gate's "mean rooms cleared" is measured over
   mostly-unscorable runs. Is mean-rooms-cleared-with-coverage-reported still
   the right bar, or should Task 5 be scoped explicitly to the room-1 battle
   rate until coverage climbs?

## Files changed
```
 QUESTIONS.md                  |  93 ++++++++++------
 SPEC.md                       | 174 +++++++++++++++++++++++++++++++
 TASKS.md                      |  66 +++++++++++--
 handoff/DECISIONS.md          |   8 ++
 handoff/scratch-session-05.md | 121 ++++++++++++++++++++++ (new)
 scripts/sim.ts                |  74 ++++++++++++++
 src/sim/boons.ts              | 218 ++++++++++++++++++++++++++++++++++++ (new)
 src/sim/corpus.ts             |  83 +++++++++++++-
 src/sim/coverage.ts           |  27 +++++-
 src/sim/dungeonSim.ts         | 117 +++++++++++++++++++--
 src/sim/enemies.ts            |  14 ++-
 src/sim/types.ts              |  27 ++++++
 tests/boons.test.ts           | 177 +++++++++++++++++++++++++++++++ (new)
 tests/dungeonSim.test.ts      |  32 ++++++-
 14 files changed, 1183 insertions(+), 48 deletions(-)
```
