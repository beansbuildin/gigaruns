# session 04 — 2026-08-15 — Task 4, Simulator + fixtures — GATE PASS

Commit `2ff8c3b`. No energy spent, no live runs, nothing POSTed.

---

## Gate evidence

```
$ npx tsc --noEmit
(exit 0)

$ npx vitest run
 Test Files  6 passed (6)
      Tests  74 passed (74)
```

```
$ npx tsx scripts/sim.ts 1000

REPLAY — combat model vs every recorded exchange
exchanges replayed: 66
side-updates matched: 127/132
mismatches inside the clean model: 0
mismatches on unscorable exchanges: 5

scored 41 / 66 exchanges — 25 unscorable
      25  BOON_TAKEN
       3  STATUS_EFFECT
      25  ROLLED_STATS
       9  ENEMY_BUFF

every mismatch, with the mechanic that explains it:
  run-01-00-08 029→030  rock/scissor  [ENEMY_BUFF, BOON_TAKEN, ROLLED_STATS]
      foe: predicted HP 37 ARM 0 — actual HP 38 ARM 7
  run-01-00-08 037→038  rock/rock     [ENEMY_BUFF, BOON_TAKEN, ROLLED_STATS]
      me:  predicted HP 22 ARM 5 — actual HP 22 ARM 15
  run-01-00-08 045→046  rock/scissor  [BOON_TAKEN, ROLLED_STATS, STATUS_EFFECT]
      foe: predicted HP 28 ARM 0 — actual HP 25 ARM 0
  run-01-00-08 046→047  paper/paper   [BOON_TAKEN, ROLLED_STATS, STATUS_EFFECT]
      foe: predicted HP 25 ARM 2 — actual HP 24 ARM 0
  run-01-00-08 047→048  paper/paper   [BOON_TAKEN, ROLLED_STATS, STATUS_EFFECT]
      foe: predicted HP 24 ARM 2 — actual HP 23 ARM 0
```

The last three are the Burn fight: the enemy loses 1 extra HP per exchange and
regenerates no armor, exactly as session 03 recorded. Left unmodelled on
purpose — one sample is an anecdote, not a mechanic.

### 1000 synthetic runs, three policies, vs a random-move opponent

| policy | battle win rate (scored) | scored battles | scored runs | mean rooms |
|---|---|---|---|---|
| random | **60.6%** (606/1000) | 1000/1858 | 394/1000 | 0.86 |
| always-Sword | **67.9%** (679/1000) | 1000/2023 | 321/1000 | 1.03 |
| always-Shield | **55.1%** (551/1000) | 1000/1745 | 449/1000 | 0.75 |

Run win rate is **0.0% for all three**, by construction. Every scored battle is
a room-1 battle; `deepestScorableRoom` is 1 for all three.

### Threshold check (brief §1, corrected) — our Shield 6/12 mirrored

```
enemy 63  Shield DEF 2  net-on-tie 4  → predicted clears,      actual cleared 100/100  ✓
enemy 64  Shield DEF 4  net-on-tie 2  → predicted clears,      actual cleared 100/100  ✓
enemy 65  Shield DEF 6  net-on-tie 0  → predicted NEVER clears, actual died    100/100  ✓
enemy 66  Shield DEF 8  net-on-tie 0  → predicted NEVER clears, actual stalled 100/100  ✓
```

One point of DEF separates a winnable grind from an unwinnable one.

---

## The charge recount (brief §2), in full

```
CHARGE RECOUNT — 66 exchanges, 132 played moves

Q1a. delta of the PLAYED move, by actor and by charges-before
  actor  before  delta  count
  foe    1       -2     7
  foe    2       -1     16
  foe    3       -1     43
  me     1       -2     7
  me     2       -1     20
  me     3       -1     39

Q1b. delta of UNPLAYED moves
  already at max:  160   (delta 0: 160)
  below max:       104   (delta +1: 104)
  ever exceeded max: 0

Q2. opportunities to play a non-positive move, and how many were taken

  PLAYER (contaminated — followed a guide)
    opportunities (held a move at <=0):       12
    times a non-positive move was played:      0
    times the play was forced:                 0
    expected plays if selection were uniform: 4.00
    P(0 plays | soft cost + uniform selection): 7.71e-3

  ENEMY (clean)
    opportunities (held a move at <=0):       11
    times a non-positive move was played:      0
    times the play was forced:                 0
    expected plays if selection were uniform: 3.67
    P(0 plays | soft cost + uniform selection): 1.16e-2

VERDICT
  H1 (hard prune) SUPPORTED — 11 clean enemy opportunities, 0 taken.
```

**The delta table has no residue.** Every played move is −1, or −2 from exactly
1. That is a change from the previously recorded 134/118/16 — see below.

The brief estimated `p ≈ (2/3)^23 ≈ 1e-4`. That assumes every opportunity
offered all three moves as non-positive candidates. Most offer exactly one, so
per-turn avoidance under the soft-cost null is 2/3, not 1/3, and the correct
figure is `p ≈ 0.012` on the clean enemy rows. One-sided, but an order of
magnitude weaker than the brief supposed. I still flipped the default to prune,
on the asymmetry argument the brief makes: wrongly pruning costs one option in
the EV table; wrongly permitting corrupts every prediction against that enemy.

---

## The three corrections, with the data

### 1. Armor does not refill at room transitions

Every room boundary in the corpus (`players[1].id` changes under one
`DUNGEON_ID_CID`) — there are exactly four:

```
run-23-29-39  009→010  63→64  me ARM  4/15 →  4/15   HP  2→ 2  ch [2,0,3]→[2,0,3]
run-01-00-08  022→023  63→64  me ARM 15/15 → 15/15   HP 15→15  ch [2,2,2]→[2,2,2]
run-01-00-08  028→029  64→65  me ARM 15/15 → 15/15   HP 31→31  ch [2,2,3]→[2,2,3]
run-01-00-08  039→040  65→66  me ARM 15/15 → 15/15   HP 22→22  ch [2,1,3]→[2,1,3]
```

Three of four crossed **at the armor cap**, where "refilled to max" and
"unchanged" are indistinguishable. The single informative boundary stayed at
4/15. Session 03 read the *enemy's* fresh pools (`HP 40/40 ARM 16/16` — a new
entity) as a global rule and applied it to the player as well.

This is the same failure shape as the enemy-63 "Shield-biased 57%" call and the
Shield-heavy advice: a confident rule drawn off samples that could not
discriminate. Worth noticing that it happened three sessions running.

### 2. Net damage — the brief's §1 rule is wrong

Working the lost run (`run-2026-08-13-23-21-36`) exchange by exchange against
the confirmed model:

```
000  me HP32 ARM15                    | foe HP30/30 ARM12/12
001  me HP32 ARM 7  lm=rock           | foe HP30/30 ARM12/12  lm=paper
002  me HP23 ARM 0  lm=paper          | foe HP30/30 ARM12/12  lm=scissor
003  me HP23 ARM12  lm=paper          | foe HP30/30 ARM 6/12  lm=rock
004  me HP23 ARM 0  lm=scissor        | foe HP30/30 ARM12/12  lm=rock     ← 6→12 on a DEF-6 Sword win
005  me HP15 ARM 0  lm=rock           | foe HP30/30 ARM12/12  lm=paper
006  me HP15 ARM 4  lm=paper          | foe HP30/30 ARM 6/12  lm=paper
007  me HP11 ARM 0  lm=rock           | foe HP30/30 ARM 8/12  lm=paper
```

At 003→004 the enemy's armor goes `6 → 12` on a Sword win. Its Sword DEF is
exactly 6. That is the ordinary capped regen rule — **not** "restores to full".
At 005→006 it goes `12 + 2` and stays capped at 12.

So the run was lost to a *rate race*: 6 damage per landed Shield hit against a
12-armor pool topped up 2–6 at a time. Enemy HP never moved off 30/30 across
seven exchanges, which is what session 03 correctly observed and incorrectly
explained.

The real threshold lives on **ties only**, because a loser regenerates nothing.
`netDamageOnWin(atk) = atk`; `netDamageOnTie(atk, foeMoveDef) = max(0, atk − foeMoveDef)`.

**How this was caught:** I wrote the brief's rule into a test asserting
always-Shield wins 0 room-1 battles. It won 99/200. The brief itself said that
if the threshold scenario doesn't show zero progress, "the armor model is wrong
and that's a more important finding than the gate" — it turned out the *brief's
rule* was wrong rather than the armor model, but the instruction to investigate
rather than adjust the test is what surfaced it.

### 3. The phantom exchange

```
026  me HP15 ARM 9 ch[1,3,3] lm=rock  | foe 64 HP 5 ARM0 ch[3,3,2] lm=scissor
027  me HP15 ARM15 ch[2,2,3] lm=paper | foe 64 HP 0 ARM0 ch[2,3,3] lm=rock    REWARD
028  me HP31 ARM15 ch[2,2,3] lm=paper | foe 64 HP 0 ARM0 ch[2,3,3] lm=rock    ENEMYPATH  boons 1→2
029  me HP31 ARM15 ch[2,2,3] lm=paper | foe 65 HP38 ARM15 ch[3,3,3] lm=
```

`027→028` is the **Heal boon landing** (HP 15 → 31). `lastMove` still names the
killing blow on both sides, the enemy id has not changed, and HP moved — so a
"did anything change?" test admits it as an exchange, and it contributes two
bogus `2 → 2 (delta 0)` played moves. Those two are precisely the reason the
earlier count claimed 16 odd deltas "all from exactly 1" while listing two that
were not.

Filter now required of any analysis script, in `src/sim/corpus.ts`: both sides
alive in the `before` state, and no `rewardPathPhase`/`enemyPathPhase` active on
it. Read the phase flags directly rather than inferring the state machine.

Corrected totals: **132 played moves, 116 at −1, 14 exceptions all from exactly
1, 264/264 unplayed transitions as specified — zero residue.**

---

## Coverage: the shape of the blind spot

The contamination is a wall, not a gradient. Room 1 is clean in every capture;
every contaminant enters at the first `rewardPathPhase`:

```
run-01-00-08 state-021  REWARD_PHASE
run-01-00-08 state-022  me lck=1 | me boons=1 | ENEMY_PHASE
...
run-01-00-08 state-029  Enemy Room 65 evasion=2, block=2, lck=1
run-01-00-08 state-046  Enemy Room 66 statusEffects=[{Burn, 3}]
             (run-level activeEnemyBuff "shatterblade": Vulnerable on Sword wins)
```

A gotcha worth carrying forward: rolled stats are `{current, starting}` pools
and **`starting` stays 0 even when `current` is 2**. A coverage check written
against `starting` reports a clean corpus and is silently wrong.

---

## Dead ends

- **Asserting the brief's §1 rule as a test.** Expected always-Shield to win 0;
  it won 99/200 against a random opponent, because the enemy regenerates only on
  exchanges it wins and our clean wins land in full. The test was asserting the
  brief, not the model.
- **Predicting "STALL" for zero-net-damage matchups.** Enemy 65's mirror is
  zero-net *and* lethal to us (its Shield ATK 15 > our 12 regen), so it ends in
  death. The testable claim is "never clears", not "stalls".
- **Taking `p ≈ 1e-4` at face value.** Recomputed at `p ≈ 0.012`; see above.

## Branches the corpus still cannot exercise

- Any move played from ≤0 charges (H1 vs H2 — one browser click settles it).
- Boon stat effects — 606 of 1000 unscorable runs are BOON_TAKEN alone.
- Burn's tick rate and its armor-regen interaction.
- Rolled-stat damage (the enemy-65 half-damage case).
- The `enemyPathOptions` Safe/Risky/Dangerous tier choice.
- Any room past 4. `maxRoom` is 16.
