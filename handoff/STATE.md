# STATE — session 04 — 2026-08-15 — commit 30f8896

## Status
Task 4 "Simulator + fixtures": **GATE PASS.**
Next per TASKS.md: Task 5 (dungeon strategy). Task 2 (auth + API client) is
still unbuilt and is the only thing between Task 5 and a live run.
Overall: `src/sim/` exists and works, 74 tests pass, the combat model is exact
on every clean recorded exchange, and the sim can score 1000 runs — but it can
only *score* room 1, because everything past the first reward phase touches a
mechanic we cannot model. No energy was spent this session.

## What works
- `npx vitest run` — **74 tests, 6 files, all pass.** This was the failing gate
  from sessions 02 and 03 ("No test files found"); it is fixed with real tests.
- `npx tsc --noEmit` — clean, exit 0.
- `npm run sim` (`scripts/sim.ts`) — replays the corpus, then runs 1000
  synthetic runs for three policies and prints win rate with coverage beside it.
- `npm run charges` (`scripts/chargeRecount.ts`) — the actor-split charge
  recount. Read-only, no network.
- `src/sim/combat.ts` — the single implementation of the exchange model.
  **127/132 side-updates against recordings, 0 failures inside the clean model**
  (41/41). All 5 misses land on exchanges already flagged unscorable.
- `src/sim/coverage.ts` — fail-closed reason codes. No approximations, no
  hardcoded zeros; anything unmodelled is excluded from every reported rate.
- `src/sim/corpus.ts` — the only module that knows the wire shape. Both older
  analysis scripts had independently-shipped pair-walking bugs; this exists so
  those rules are stated once.
- `tests/enemies.test.ts` re-derives every enemy stat from the fixtures, so the
  sim's stat block cannot drift from the responses it claims to come from.

## What's broken
- **`deepestScorableRoom` is 1.** This is the project's main constraint now.
  Clearing a room means taking a boon, so a scored *run* is by construction a
  room-1 death — the run win rate is 0% and carries no information. Only the
  room-1 battle rate has content. Raising this is a capture problem, not a code
  problem (QUESTIONS.md §5).
- `scripts/chargeTable.ts` and `scripts/verifyCombatModel.ts` both still lack
  the phase filter and will over-count. Superseded by `chargeRecount.ts` and
  `tests/replay.test.ts`; left in place but do not cite their numbers.
- `src/api/`, `src/strategy/`, `src/orchestrator/` are still empty. Nothing has
  ever POSTed to the API.
- Two damage mechanics remain unexplained and are deliberately unmodelled:
  enemy-65 half-damage, and Burn's tick rate. One sample each.

## Corrections to SPEC.md
All fixed in SPEC.md this commit. Three of these refute things previously
recorded as CONFIRMED — in each case the live data was right.

- **Armor does NOT refill at room transitions** (reverses DECISIONS 2026-08-14).
  The corpus has **four** room boundaries; **three crossed with the player
  already at the armor cap (15/15)**, where "refilled" and "unchanged" are the
  same observation. The one informative boundary — `run-23-29-39 009→010` —
  crossed at **ARM 4/15 and stayed at 4/15**. HP, armor and charges all cross
  unchanged. What refills is the *enemy*, because the transition swaps in a new
  entity at full pools. The §4b guidance built on this ("per-room budget, free
  to spend late") was backwards.
- **Net damage is not `max(0, ATK − restore)`** (rejects the session-04 brief
  §1). A **loser regenerates nothing**, so an outright win lands full ATK. The
  offset exists only on a **tie**, where it is exact: `max(0, ATK − foeMoveDEF)`.
  Verified in sim across all four enemies — our Shield's ATK 6 clears DEF 2 and
  4, and makes literally zero progress at DEF 6 and 8.
- **"Enemy 63's armor fully restores on any win" is also wrong.** Regen is the
  played move's DEF, capped. Observed `6 → 12` on a Sword win whose DEF is
  exactly 6, and `12 + 2` capped back to 12 on a Shield tie. Session 03's lost
  run was a **rate race**, not a flat threshold.
- **The charge counts were inflated by a phantom exchange.** `chargeTable.ts`
  admitted `run-01-00-08 027→028`, which is the **boon pickup after a kill**:
  `lastMove` persists on both sides, the enemy id has not changed, and a Heal
  boon moved HP 15 → 31 so a "did anything change" test passes. Corrected:
  **132 played moves, 116 at −1, 14 exceptions ALL from exactly 1 with no
  residue, 264/264 unplayed as specified.** The old claim that all 16 exceptions
  were plays from exactly 1 was false — two of them were not plays at all.
- Move charges: **PRESENT**, enemy's fully visible, rule confirmed with zero
  unexplained deltas after the correction above.
- Rolled stats must be read from `.current`, never `.starting` — `starting` is 0
  even when `current` is 2 (enemy 65). A check written against `starting`
  reports a clean corpus and is wrong.
- Resolved IDs: **forbiddenWoods=5**, **dendren=NOT FOUND** (not re-probed).

## Dead ends
- **Asserting the brief's §1 rule as a test.** I wrote a threshold check
  expecting always-Shield to win 0 room-1 battles; it won 99/200, because
  against a *random* opponent the enemy only regenerates on exchanges it wins,
  and our clean wins land in full. The test was asserting the brief rather than
  the model. Corrected to the tie-mirror case, which holds exactly.
- **Predicting "STALL" for zero-net-damage matchups.** Enemy 65's mirror is
  zero-net *and* lethal to us (its Shield ATK 15 > our 12 regen), so it ends in
  death, not stall. The testable claim is "never clears", not "stalls".
- Reading the brief's `p ≈ 1e-4` for charge legality at face value. It assumed
  every opportunity offered all three moves; most offer one non-positive move,
  so per-turn avoidance is 2/3 and the real figure is **p ≈ 0.012**. Still
  one-sided, an order of magnitude weaker.

## Metrics
- Sim, 1000 runs vs a random-move opponent, **battle win rate on the scored
  subset** (all room 1, n=1000 scorable battles each):
  `random 60.6% · always-Sword 67.9% · always-Shield 55.1%`
  Run win rate is 0.0% for all three, by construction — not a strategy result.
- Coverage, 1000 runs random vs random:
  `runs 394/1000 scored · battles 1000/1858 scored · deepestScorableRoom 1`
  Unscorable causes: 606 BOON_TAKEN, 205 ROLLED_STATS, 47 STATUS_EFFECT,
  47 ENEMY_BUFF.
- Corpus replay: **66 exchanges, 127/132 side-updates, 0 clean failures**,
  41/66 exchanges scorable.
- Charge legality, enemy-only (clean) rows: **11 opportunities, 0 taken**,
  expected 3.67 if uniform, `p ≈ 0.012` under the soft-cost null. Player rows
  (12 opportunities, 0 taken) excluded as policy-contaminated.
- Live: **0 runs, 0 energy, 0 actions POSTed this session** — the brief
  forbade it and the existing 72-state corpus was sufficient.
- Tests: 74 passed, 0 skipped, 0 failed.

## Open questions for Claude
1. **Boon stat effects are the single highest-value capture available and need
   no new tooling.** They are the wall: 606 of 1000 unscorable runs are
   BOON_TAKEN alone. `pickedBoons` carries the full object with
   `selectedVal1`/`selectedVal2`; if the player's move ATK/DEF and HP/armor
   maxima diff by exactly those values across a reward phase, boons stop being
   unmodelled and rooms 2+ open up in one step. `scripts/watch.ts` already
   records every state. Should session 05 spend one run on this before Task 5,
   or build Task 5 against room 1 only and capture later?
2. **Charge legality is one browser click from settled** and costs no energy:
   drive a move to −1 in the client and try to select it (QUESTIONS.md §1). I
   defaulted `chargesAreHardLimit` to `true` on `p ≈ 0.012` plus the cost
   asymmetry, reversing the 2026-08-14 decision. Worth asking the user directly?
3. **Task 5's gate needs restating.** It says "beats always-Sword by ≥15% win
   rate over 1000 runs", but run win rate is 0% by construction under
   fail-closed coverage. The workable substitute is room-1 **battle** win rate,
   where always-Sword is the baseline at **67.9%** — note that is *higher* than
   random (60.6%), so a 15% margin over it means clearing ~78%. Is that the
   right bar, or should the gate move to items-per-energy once coverage climbs?
4. Enemy-65 half-damage and Burn's tick rate are still one sample each and stay
   unmodelled per your §4 call. Worth one targeted run, or leave until boons
   are resolved?

## Files changed
```
 QUESTIONS.md                  |  97 +++++++------
 SPEC.md                       | 239 +++++++++++++++++++++++++-------
 handoff/DECISIONS.md          |   7 +
 handoff/scratch-session-04.md |  53 ++++++++
 package.json                  |   4 +-
 scripts/chargeRecount.ts      | 193 ++++++++++++++++++++++++++ (new)
 scripts/sim.ts                | 122 +++++++++++++++++ (new)
 src/sim/combat.ts             | 224 ++++++++++++++++++++++++++++++ (new)
 src/sim/corpus.ts             | 228 +++++++++++++++++++++++++++++++ (new)
 src/sim/coverage.ts           | 173 ++++++++++++++++++++++++ (new)
 src/sim/dungeonSim.ts         | 307 ++++++++++++++++++++++++++++++++++++++++++ (new)
 src/sim/enemies.ts            | 113 ++++++++++++++++ (new)
 src/sim/replay.ts             |  98 ++++++++++++++ (new)
 src/sim/rng.ts                |  32 +++++ (new)
 src/sim/scenarios.ts          | 186 +++++++++++++++++++++++++ (new)
 src/sim/types.ts              |  61 +++++++++ (new)
 tests/*.test.ts               | 789 ++++++++++++ (6 new files, 74 tests)
 22 files changed, 2840 insertions(+), 86 deletions(-)
```
