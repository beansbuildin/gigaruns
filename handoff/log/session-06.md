# STATE — session 06 — 2026-08-16 — commit 536fac6

## Status
Task 5 "Dungeon strategy": **GATE PASS.**
Next per TASKS.md: Task 2 (auth + API client) — still unbuilt, and now the only
thing between a working strategy engine and a live run.
Overall: the EV engine beats always-Sword 81.8% vs 67.9% on room-1 battle win
rate with non-overlapping CIs; three supervised captures overturned two claims
the last two sessions were built on, and `deepestScorableRoom` is **still 1**.

## What works
- `npx tsc --noEmit` — clean, exit 0.
- `npx vitest run` — **127 tests, 8 files, all pass** (91 → 127; `tests/strategy.test.ts`
  is new with 32).
- `npm run sim` — replay, three baselines, the Task 4.5 report, the **Task 5 gate**,
  a full EV-table log, and the threshold check. Exit 0.
- `src/strategy/` — opponent model (30-obs floor, Laplace, charge pruning,
  first-order transitions), §4b utility, depth-2 expectimax EV engine, §4c loot
  ranking. Pure: `decide(state, model, cfg, prev)` has no I/O, the model holds
  counts in memory with `toJSON`/`fromJSON`, and all per-run state lives in the
  `strategyPolicy` adapter. **Room-agnostic** — nothing hardcodes room 1; a test
  asserts it decides at rooms 1–4.
- `simulate()` now returns `battlesByRoom` — scored/unscorable/won and a binomial
  CI per room depth, so a result is quoted at the depth it was measured at.
- `Policy` gained optional `onBattleStart` / `observe` hooks, so a model can learn
  inside the sim from exactly what a live bot sees (`lastMove` on both sides).
- Capture tooling unchanged and working: `scripts/watch.ts` recorded 35 states
  across 3 supervised runs, redacted, committed.

## What's broken
- **`deepestScorableRoom` is still 1.** The gate did not ask for it to move and
  it did not move. Coverage actually *fell* (49% → 39%) because a better policy
  survives room 1 more often and every recorded room-1 boon is unscorable.
- **037→038 is now explained by NOTHING.** Both candidate rules are eliminated:
  die-on-a-tie is refuted by observation, and evasion at 1% makes a dodge inside
  nine opportunities an 8.6% event. Worse than the confound it replaced.
- **`enemies.ts` room-3 and room-4 profiles are Dangerous-tier instances** stored
  as if they were the enemies themselves. Flagged in comments, **not fixed** —
  no Safe-tier capture of enemies 65/66 exists to re-derive them from.
- `scripts/chargeTable.ts` and `scripts/verifyCombatModel.ts` still lack the
  phase filter and over-count. Superseded; do not cite their numbers.
- `src/api/`, `src/orchestrator/` are still empty. Nothing has ever POSTed.

## Corrections to SPEC.md
All fixed in SPEC.md this session. New **§3e** documents the tier surface.

- **`enemyPathOptions[]` carries `rolledEnemyStats` AND `enemyBuff` PER TIER.**
  Tier 0 "Safe" is all zeros with a null buff; both tier-2 "Dangerous" options
  carry non-zero rolls. So session 05's "enemies 65/66 are unscorable *innately*"
  is **retracted** — those profiles are tiers the user picked. This was **wall 2
  behind the Task 4.5 gate retirement**. The retirement stands on its other two
  reasons. Confirmed end-to-end in run 3: picked Safe, and the room-2 enemy came
  in with rolled stats all zero, `statusEffects []`, `activeEnemyBuff null`.
- **The `lootTable` is IDENTICAL across all three tiers** (same table, item 846,
  weight 1, amount 9), in both samples. Resolves QUESTIONS §6: **always Safe** —
  higher tiers are pure added risk with zero loot upside, and they are the sole
  source of the mechanics that make a battle unscorable.
- **Rolled stats are PERCENT PROC CHANCES, not points.** Client option text reads
  `+5% intuition` / `+1% luck`, and `selectedVal1` lands verbatim in `.current`.
  Every sample-size argument in §4e was an order of magnitude off: `evasion 1` is
  **1%**, not ~10%, so reading one needs *hundreds* of observations, not 30.
- **"A side that dies on an exchange deals no damage" is REFUTED.** run-…-03-26-57
  `004→005`: the enemy died on a tie and dealt its full 16 anyway, inside the
  clean model. The session-06 brief §4 asked for this behind a flag on parsimony
  grounds; it was not built, because it is false.
- **Burn's declared `amount` is 2** on `perpetual_firebrand`, not 3 — breaking the
  single-observation coincidence keeping `BURN_PER_EXCHANGE` off. Duration is
  still unknown, so the flag stays off.
- **`enemyBuff` is machine-readable**, with typed `effects`
  (`onEnemyWinExchange_applyStatus`, `onEnemyWinExchange_corrode`), `moveType`,
  `amount`, `minTier`.
- **Player `armorMax` 15 → 16** — the user changed gear. `PLAYER` now tracks the
  newest capture; a test asserts the distinct-loadout count so drift is visible.
- Resolved IDs: **forbiddenWoods=5**, **dendren=NOT FOUND** (not re-probed).
- Move charges: **PRESENT**, enemy's fully visible, rule unchanged.

## Dead ends
- **Building the die-on-a-tie flag the brief asked for.** Refuted before it was
  written. Don't re-propose it without a counter-observation.
- **Concluding "evasion probably fires" once die-on-a-tie fell.** I wrote this,
  then the percentage units arrived and killed it. Corrected in SPEC §4e with an
  explicit warning not to adopt evasion by elimination — it is the last
  hypothesis standing only because no third has been proposed.
- **Chasing rolled-stat semantics with human play.** Session 05 called it the top
  blocker; it is now downgraded twice (avoidable via Safe tier, and needs
  hundreds of observations at 1–5%). It is Task 6 machine-speed work.
- **Depth-3 expectimax.** Measures 84.2% vs depth-2's 82.0%, but the CIs overlap
  and it costs 7× the time. Not adopted — the difference is not established.
- **A test asserting a specific exchange by `label` alone.** `label` is
  `state-NNN→state-NNN` and is not unique across runs; the phantom-pickup
  assertion silently began matching a legitimate pair in the new capture.

## Metrics
- **Task 5 gate**, 1000 runs each vs random, room-1 battle win rate, scored subset:
  `always-Sword 67.9% ± 2.9 [65.0, 70.8]` vs `ev-engine 81.8% ± 2.4 [79.4, 84.2]`.
  Non-overlapping. **PASS.**
- Reported, not gated: mean rooms cleared `1.038 ± 0.059` vs `1.616 ± 0.072`;
  battle coverage `49%` vs `39%`; `deepestScorableRoom` **1** for both.
- Ablations (1000 runs, seed 1): depth1 78.3% · depth2 82.0% · depth3 84.2%;
  learning on 82.3% vs off 81.3%. Stable across seeds 1/77/12345.
  `determinism()` found **nothing** over 5447 observations — correct, the sim's
  opponent is uniform.
- Corpus grew: **66 → 92 exchanges**, 132 → 184 side-updates, **179/184 matched,
  0 clean-model failures**, 4 → 7 boon pickup pairs, 4 → 6 offer triples.
- Live: **3 supervised runs, ~60 energy, 0 actions POSTed by the bot.** Deepest
  reached: room 2. All three died in room 2.
- Tests: 127 passed, 0 skipped, 0 failed.

## Open questions for Claude
1. **`Regen` is offered at room 1 and is the highest-value unmodelled boon.**
   Option text: "start each battle with 2 regen, decreases by 1 per turn until
   0", `val1 2`. §4b's central asymmetry is that HP is *not* renewable in combat.
   A per-battle regenerating resource changes the **shape** of the utility
   function, not its weights. Should a capture be spent taking it, and should
   §4b be re-derived rather than retuned if it lands?
2. **Does `intuition` reveal the enemy's next move?** (QUESTIONS §5a-bis.) The
   user reports it has a visible client trigger. §4a's entire edge is predicting
   that move, so a 5% chance of a *certain read* is worth far more than a 5%
   dodge. Costs no energy — just one question to the user.
3. **Task 2 next, or one more capture first?** `AddMaxArmor` was offered at room 1
   and not taken; taking it would likely give the first clean room-1 boon and let
   the sim finally score past room 1. But Task 2 is the step that makes captures
   free, and three human runs this session produced two rooms of depth. My read:
   **build Task 2**, and stop spending human clicks on coverage.
4. **Should `enemies.ts` become tier-aware?** Enemy profiles are currently
   `(room) → enemy`, but the truth is `(room, tier) → enemy`. Restructuring
   without a Safe-tier capture of enemies 65/66 would mean inventing rows, so I
   left it. Worth doing when the data exists?

## Files changed
```
 CLAUDE.md                     |  13 +      (§6, the gate-setting rule)
 QUESTIONS.md                  | 120 +--    (capture checklist; §6 resolved)
 SPEC.md                       | 148 ++     (new §3e; §4e, §4f corrections)
 TASKS.md                      |  75 +--    (4.5 retired; Task 5 restated + PASS)
 handoff/DECISIONS.md          |  14 +
 handoff/scratch-session-06.md | 205 ++++   (new, S1–S9)
 scripts/sim.ts                | 150 ++     (Task 5 gate + EV-table log)
 src/sim/boons.ts              |  47 +      (AddTenacity, AddIntuition, 2 offers)
 src/sim/dungeonSim.ts         |  86 ++     (observe/onBattleStart, battlesByRoom)
 src/sim/enemies.ts            |  38 +-     (loadout; tier corrections)
 src/sim/scenarios.ts          |   7 +-
 src/strategy/*.ts             | 875 +++++  (new: config, opponentModel, utility,
                                             decide, loot, policy)
 tests/strategy.test.ts        | 396 +++++  (new)
 tests/{boons,combat,enemies,replay,scenarios}.test.ts | 73 +-
 fixtures/dungeon-runs/run-2026-08-14-03-26-57/*.json  | 35 files, redacted
 58 files changed, 14416 insertions(+), 96 deletions(-)
```

---

# Verbose appendix — session 06

## The Task 5 gate, verbatim from `npm run sim`

```
TASK 5 GATE — EV engine vs always-Sword, 1000 runs each

  ROOM-1 BATTLE WIN RATE, scored subset, 95% CI
    always-Sword   67.9% ± 2.9  [65.0, 70.8]  (679/1000 scored)
    ev-engine      81.8% ± 2.4  [79.4, 84.2]  (818/1000 scored)

  REPORTED, NOT GATED — the blind spot stays visible
    mean rooms cleared     always-Sword 1.038 ± 0.059   ev-engine 1.616 ± 0.072
    battle coverage        always-Sword 49%   ev-engine 39%
    deepestScorableRoom    always-Sword 1   ev-engine 1

✓ GATE MET — the intervals do not overlap.
```

Replay against ground truth, same run:

```
exchanges replayed: 92
side-updates matched: 179/184
mismatches inside the clean model: 0
mismatches on unscorable exchanges: 5
```

## Ablations — where the edge actually comes from

1000 runs, seed 1, room-1 battle win rate on the scored subset:

```
always-Sword                       67.9% ± 2.9   rooms 1.018 ± 0.058   cov 50%
random                             60.6% ± 3.0   rooms 0.859 ± 0.052   cov 54%
ev d1 λ0                           77.6% ± 2.6   rooms 1.435 ± 0.071   cov 42%
ev d1 λ0.15                        78.3% ± 2.6   rooms 1.453 ± 0.069   cov 41%
ev d2 λ0                           81.5% ± 2.4   rooms 1.581 ± 0.072   cov 40%
ev d2 λ0.15                        82.0% ± 2.4   rooms 1.585 ± 0.071   cov 40%
ev d3 λ0.15                        84.2% ± 2.3   rooms 1.683 ± 0.072   cov 38%
```

Depth is worth ~4 points from 1→2 and ~2 more from 2→3, but the d2/d3 intervals
overlap and d3 costs 2041ms vs 298ms per 1000 runs. Default stays 2.

λ (ambiguity aversion) is worth nothing measurable at d2 — 81.5 / 82.0 / 81.7 for
λ = 0 / 0.15 / 0.5. It is kept at 0.15 on the SPEC §4a argument that a fixed
response to a read is maximally exploitable if the server ever adapts, not
because the sim rewards it. Say so if it is ever reported as a tuned value.

Stability across seeds (d2, λ0.15):

```
seed      always-Sword   ev learn=true   ev learn=false
1         67.9% ± 2.9    82.3% ± 2.4     81.3% ± 2.4
77        67.2% ± 2.9    82.4% ± 2.4     81.6% ± 2.4
12345     71.5% ± 2.8    78.6% ± 2.5     80.9% ± 2.4
```

Non-overlapping at every seed. Learning is worth ~1 point and is *negative* at
seed 12345 — consistent with there being nothing to learn, since the opponent is
uniformly random. `determinism()` returns `[]` after 5447 observations of enemy
63, which is the correct answer and a live check that the detector does not
hallucinate structure.

Move mix over 16290 plays: `rock 37.0%  paper 30.4%  scissor 32.6%` — a real
mix, not a degenerate policy that rediscovered always-Sword.

## The tier surface — full option dump (run 1, state-006)

All three options are `enemyId: 64`. Abridged to the fields that matter:

```json
{ "index": 0, "tier": 0, "tierName": "Safe", "enemyBuff": null,
  "rolledEnemyStats": { "evasion": 0, "block": 0, "lck": 0, "tenacity": 0 },
  "lootTable": { "NAME_CID": "LT_D5_Room_2", "ID_CID": 95,
                 "GAME_ITEM_ID_CID_array": [846], "WEIGHT_CID_array": [1],
                 "LOOT_AMOUNT_CID_array": [9] } }

{ "index": 1, "tier": 2, "tierName": "Dangerous",
  "rolledEnemyStats": { "evasion": 1, "block": 2, "lck": 1, "tenacity": 1 },
  "enemyBuff": { "id": "corrosiveShield", "name": "Miasmaguard", "minTier": 2,
    "description": "Reduces 3 max armor on Shield wins",
    "effects": [{ "kind": "onEnemyWinExchange_corrode",
                  "amount": 3, "moveType": "paper" }] },
  "lootTable": { ...identical to index 0... } }

{ "index": 2, "tier": 2, "tierName": "Dangerous",
  "rolledEnemyStats": { "evasion": 1, "block": 1, "lck": 3, "tenacity": 3 },
  "enemyBuff": { "id": "perpetual_firebrand", "name": "Perpetual Firebrand",
    "minTier": 2, "perpetual": true,
    "description": "Applies 2 Burn on Sword wins",
    "effects": [{ "kind": "onEnemyWinExchange_applyStatus",
                  "statusType": "Burn", "amount": 2, "moveType": "rock" }] },
  "lootTable": { ...identical to index 0... } }
```

Verification that Safe actually delivers, run 3 `state-030.json`, `players[1]`:
`evasion 0, block 0, lck 0, tenacity 0`, `statusEffects []`,
`activeEnemyBuff null`.

## The die-on-a-tie refutation, worked

`run-2026-08-14-03-26-57` `004→005`, me=Spell foe=Spell, tie:

```
before  me HP 20/32 ARM 0/16   foe HP  4/30 ARM 0/12
after   me HP 12/32 ARM 0/16   foe HP  0/30 ARM 0/12

foe: tie -> regen own DEF 4 -> armor 4; takes our ATK 12 -> 4-12 = -8
     -> HP 4-8 -> 0, DEAD
me:  tie -> regen own DEF 8 -> armor 8; takes foe ATK 16 -> 8-16 = -8
     -> HP 20-8 = 12  ✓ exact
```

The enemy died on the tie **and dealt its full 16 anyway**. Inside the clean
model, no reason codes, arithmetic exact on both sides.

## All 7 boon pickup pairs, re-derived from fixtures

```
AddLuck        room 1  v1=1   lck       0->1     run-23-29-39 008->009
AddEvasion     room 1  v1=1   evasion   0->1     run-01-00-08 021->022
Heal           room 2  v1=16  hp       15->31    run-01-00-08 027->028
AddBurnSword   room 3  v1=3   NO CHANGE          run-01-00-08 038->039
AddTenacity    room 1  v1=2   tenacity  0->2     run-03-26-57 005->006
AddLuck        room 1  v1=1   lck       0->1     run-03-26-57 016->017
AddIntuition   room 1  v1=5   intuition 0->5     run-03-26-57 028->029
```

`selectedVal1` lands verbatim in `.current` at three distinct values (1, 2, 5),
so "rolled boons add `selectedVal1`" no longer fits by coincidence with "add 1".

## All 6 recorded offer triples

```
room 1  AddLuck(1) | CorrosiveShield(2) | UpgradePaper(0,4)
room 1  AddEvasion(1) | AddTenacity(2) | AddBlock(2)
room 1  AddTenacity(2) | AddLuck(2) | AddBlock(2)
room 1  AddMaxArmor(2) | AddLuck(1) | UpgradeScissor(0,4)     <- AddMaxArmor, not taken
room 1  AddIntuition(5) | AddLuck(1) | Regen(2)               <- Regen, not taken
room 2  Heal(16) | UpgradeScissor(4) | AddIntuition(1)
room 3  AddBurnSword(3) | TieDamageReduction(8) | AddEvasion(1)
```

15 of 15 room-1 options are unmodelled or grant a rolled stat. `AddMaxArmor` and
`Regen` are the two that would most likely come back clean if taken.

## EV table — one full room-1 battle, warmed model, seed 20260816

Printed by `npm run sim`. Abridged to the decision line per turn:

```
[turn 1] me HP 32 ARM 15 | foe HP 30 ARM 12   model: marginal n=5447 conf=high
  ▶ rock    score 0.35   ev 0.38    worst  0.16
    paper   score 0.15   ev 0.19    worst -0.08
    scissor score 0.21   ev 0.24    worst  0.06
  played rock vs rock -> tie, dealt 16 took 12

[turn 3] me HP 27 ARM 0  | foe HP 26 ARM 2    model: first-order n=1551
  ▶ rock    score  91.61  ev  107.82  worst   -0.27
    paper   score -184.64 ev -144.37  worst -412.82
    scissor score  82.71  ev   97.37  worst   -0.40
  played rock vs rock -> tie, dealt 16 took 12

[turn 5] me HP 15 ARM 8  | foe HP 6 ARM 0
    paper   score 262.23  ev 376.31  worst -384.19
  ▶ scissor score 527.10  ev 640.37  worst -114.77
  played scissor vs scissor -> tie, dealt 12 took 16

  outcome: enemy dead — me HP 14 ARM 0, foe HP 0 ARM 0
```

Every chosen move is the argmax of its own row, and the shape is the one §4b
predicts: Sword while the pools are healthy and the worst case is survivable,
Shield/Spell once a single lost exchange would end the run. The `paper` row at
turn 3 shows the machinery working — its worst case is −412 because losing to
Spell at 27 HP with no armor leads to a likely death two plies out.

## Note on how the numbers were produced

The gate re-measures **both** policies in the same process, at the same loadout,
on the same seed. This matters more than usual this session: the user's
`armorMax` changed 15 → 16 mid-project, so any baseline quoted from a session-04
or session-05 recap is not comparable to one measured now. Session 05's
"always-Sword 67.9%" and this session's "67.9%" agreeing is a coincidence of
rounding, not evidence that the loadout change had no effect — mean rooms
cleared moved 1.018 → 1.038 on the same policy.
