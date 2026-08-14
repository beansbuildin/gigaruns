# session 05 — 2026-08-15 — Task 4.5 boon model — GATE FAIL

Commit `ee47523`. No live runs, no energy, nothing POSTed.

STATE.md holds the summary. This file holds the raw evidence behind it.

---

## Gate

**Asked:** `deepestScorableRoom` ≥ 4, matching corpus depth, with coverage.
**Got:** 1. **FAIL.**

The model was built and is correct. It does not move the number, and the gate
was not reachable from this corpus at any quality of boon model. Both facts
matter; neither cancels the other.

---

## 1. The four boon pickup pairs, in full

A pickup pair is a `rewardPathPhase` state followed by one where the player's
`pickedBoons` has grown by exactly one. All four in the corpus add exactly one
boon, so each isolates a single effect with no attribution ambiguity.

```
######### run-2026-08-13-23-29-39/state-008 -> state-009
PICKED:  AddLuck val1=1 val2=0  (range v1 1-1)
OPTIONS: AddLuck(1,0) | CorrosiveShield(2,0) | UpgradePaper(0,4)
 side0 (player)   lck: 0 => 1
 side1 (Enemy Room 63)  NO CHANGE

######### run-2026-08-14-01-00-08/state-021 -> state-022
PICKED:  AddEvasion val1=1 val2=0  (range v1 1-1)
OPTIONS: AddEvasion(1,0) | AddTenacity(2,0) | AddBlock(2,0)
 side0 (player)   evasion: 0 => 1
 side1 (Enemy Room 63)  NO CHANGE

######### run-2026-08-14-01-00-08/state-027 -> state-028
PICKED:  Heal val1=16 val2=0  (range v1 8-8)
OPTIONS: Heal(16,0) | UpgradeScissor(4,0) | AddIntuition(1,0)
 side0 (player)   health: 15/32 => 31/32
 side1 (Enemy Room 64)  NO CHANGE

######### run-2026-08-14-01-00-08/state-038 -> state-039
PICKED:  AddBurnSword val1=3 val2=0  (range v1 3-3)
OPTIONS: AddBurnSword(3,0) | TieDamageReduction(8,0) | AddEvasion(1,0)
 side0 (player)   NO CHANGE
 side1 (Enemy Room 65)  NO CHANGE
```

The diff above compares the **full** player object — both move triples' ATK/DEF/
charges, both pools and their maxima, all five rolled stats, `battleArmorReduction`,
and the four effect arrays. The listed field is the *only* one that moved.

`AddBurnSword`'s empty delta is therefore a result, not a gap.

Heal re-confirms DECISIONS 2026-08-14: `val1Min` 8, `selectedVal1` 16, HP moved
16. Reading the range would halve every boon in the game.

---

## 2. Why the gate failed — the three walls

### Wall 1 — no clean room-1 boon exists

Both recorded room-1 offer triples:

```
AddLuck(1)    | CorrosiveShield(2) | UpgradePaper(0,4)
AddEvasion(1) | AddTenacity(2)     | AddBlock(2)
```

Classify all six against the model:

| option | modelled? | clean? |
|---|---|---|
| AddLuck | yes | **no** — grants `lck`, damage effect unexplained |
| AddEvasion | yes | **no** — grants `evasion`, same |
| CorrosiveShield | no pair | — |
| UpgradePaper | no pair | — |
| AddTenacity | no pair | — |
| AddBlock | no pair | — |

**6 of 6 unscorable.** `Heal` — the only clean boon anywhere in the corpus — is
only ever offered at **room 2**, by which point the run is already contaminated.

### Wall 2 — rooms 3+ are unscorable for reasons unrelated to boons

`ROOM_ENEMIES` annotations, all read off recorded responses:

```
room 1  Enemy Room 63   unmodelled: []
room 2  Enemy Room 64   unmodelled: []
room 3  Enemy Room 65   unmodelled: [ROLLED_STATS]        evasion2 block2 lck1, INNATE
room 4  Enemy Room 66   unmodelled: [STATUS_EFFECT, ENEMY_BUFF]
```

So a **perfect** boon model caps `deepestScorableRoom` at **2**. The gate asked
for 4. That is a fact about the enemies and no boon work can change it.

### Wall 3 — no grounded offer distribution

Four offer triples exist: two at room 1, one each at rooms 2 and 3. The deepest
run died in room 4 without clearing it, so there is no room-4 offer. The sim
draws only from these; synthesising more would invent the single thing that
decides how a run develops, off a sample of four.

### The counterfactual that isolates the code from the corpus

`scripts/sim.ts` prints this, clearly fenced as NOT A RESULT:

```
    deepest scorable room under the hypothetical: 2
    battles scored: 1606/1957
```

Substituting `Heal` into room 1 raises the number to 2 and stops dead at wall 2.
The boon machinery is correct; the blocker is capture.

---

## 3. Burn — flat 3 per exchange (SPEC §4f)

The three enemy-66 misses the replay has always flagged as unexplained:

```
045->046  rock/scissor   predicted enemy HP 28 ARM 0, actual 25/0
046->047  paper/paper    predicted 25/2, actual 24/0
047->048  paper/paper    predicted 24/2, actual 23/0
```

Solving each for total damage taken:

- 046→047: enemy at HP 25 ARM 0; paper/paper tie regenerates paper DEF 8 → armor
  8; then `8 − X = 0` and `25 − (X−8) = 24` ⇒ **X = 9 = 6 ATK + 3**.
- 047→048: identical structure ⇒ **X = 9 = 6 + 3**.
- 045→046: +3 over the predicted 16.

`statusEffects` on the enemy reads `[{"type":"Burn","amount":3}]` at 046, 047 and
048 — **the amount does not decrement**. Burn first appears at 046, immediately
after the player's first Sword win of that battle, which is exactly what
`AddBurnSword` should do.

**Default OFF regardless.** The boon's `selectedVal1`, the status `amount` and
the damage are all `3`, from one status instance at one value, so "ticks for
`amount`", "ticks for 3" and "ticks for the boon's val1" are the same
observation. It is never seen expiring, so duration is unknown. Same treatment
as `chargesAreHardLimit`. Costs nothing today — the only burning enemy is in
room 4, unscorable for `ENEMY_BUFF` anyway.

---

## 4. Rolled stats — the audit, and why I did not act on it

Counted in **damage-taking opportunities**. This is the whole point: a side that
wins outright takes nothing and gives a damage-reduction stat no chance to fire,
so counting side-updates flatters every row.

```
=== side took NONZERO incoming damage ===
enemy evasion2+block2+lck1           6/7   exact
      MISS  01-00-08/029→030 rockvscissor inc=16 pred 37/0 act 38/7
enemy none                          34/37  exact
      MISS  01-00-08/045→046 rockvscissor inc=16 pred 28/0 act 25/0
      MISS  01-00-08/046→047 papervpaper  inc=6  pred 25/2 act 24/0
      MISS  01-00-08/047→048 papervpaper  inc=6  pred 24/2 act 23/0
player evasion1                      8/9   exact
      MISS  01-00-08/037→038 rockvrock    inc=10 pred 22/5 act 22/15
player lck1                          2/2   exact
player none                         29/29  exact

=== side took ZERO incoming damage (no opportunity) ===
enemy evasion2+block2+lck1           2/2
enemy none                          20/20
player evasion1                     12/12
player lck1                          2/2
player none                         12/12
```

Side-update counting reported `player evasion1` as **20/21**. Opportunity
counting reports **8/9**. Same data, and the second is the honest denominator.

**I wanted to narrow `ROLLED_STATS` here and did not.** If player `evasion 1`
and `lck 1` provably did nothing, both room-1 boons would become clean and room
2 would open in one step. But n=9 with one miss is exactly what a ~10% dodge
proc looks like, and DECISIONS 2026-08-14/2026-08-15 both forbid reading a rate
off this few observations — that is the enemy-63 "Shield-biased 57% off 14
exchanges" mistake in a new costume. Blocked deliberately, not overlooked.

### The enemy-65 anomaly, with hypotheses tested

Full battle trace (states 029–038, enemy 65):

```
029 | me HP 31 ARM 15 last=paper   | foe HP 38 ARM 15 last=-       | win me=T
030 | me HP 31 ARM 15 last=rock    | foe HP 38 ARM  7 last=scissor | win me=T
031 | me HP 31 ARM 15 last=paper   | foe HP 38 ARM  1 last=rock    | win me=T
032 | me HP 31 ARM 15 last=scissor | foe HP 27 ARM  0 last=paper   | win me=T
033 | me HP 31 ARM 15 last=rock    | foe HP 11 ARM  0 last=scissor | win me=T
034 | me HP 31 ARM  3 last=paper   | foe HP 11 ARM  4 last=scissor | win foe=T
035 | me HP 22 ARM  0 last=paper   | foe HP 11 ARM  8 last=scissor | win foe=T
036 | me HP 22 ARM 12 last=paper   | foe HP 11 ARM  2 last=rock    | win me=T
037 | me HP 22 ARM 15 last=scissor | foe HP  1 ARM  0 last=paper   | win me=T
038 | me HP 22 ARM 15 last=rock    | foe HP  0 ARM  0 last=rock    | TIE
```

- **029→030**: player Sword (16) wins vs enemy Spell. Enemy ARM 15 → 7. **8
  damage, exactly half.**
- **032→033**: the **same matchup against the same enemy**. Enemy HP 27 → 11.
  **Full 16.**

So it is **not a function of (moves, stats) alone**. Tested and rejected:

| hypothesis | verdict |
|---|---|
| block halves damage landing on armor | **rejected** — 030→031, our Shield's 6 ATK landed in full on armor 7 → 1 |
| flat reduction of N | **rejected** — every other enemy-65 exchange takes full ATK |
| damage at FULL armor is halved | fits both (029 ARM 15/15, 032 ARM 0) and no enemy-65 row rejects it — but enemy 63 at full armor took full damage, so it needs a `block > 0` condition. One positive sample. Not modellable. |

### The player-side miss is perfectly confounded

037→038: player at ARM 15/15, `rock` vs `rock` — a **tie**, confirmed by both
sides' `thisPlayerWin`/`otherPlayerWin` reading `false/false`. Model predicts
armor 15 + rock DEF 0 = 15, minus enemy rock ATK 10 = **5**. Actual: **15**. The
player took nothing.

Two readings, and the corpus cannot separate them:

1. `evasion 1` dodged, or
2. **a side that dies on an exchange deals no damage** — and 037→038 is the
   *only* exchange in the entire corpus where a side died on a **tie**. Every
   other recorded kill is an outright win, where the loser already deals nothing
   under the existing model.

Reading 2 needs no new mechanic and would be a plain addition to `combat.ts`. It
would also mean the player-side evidence is 9/9, not 8/9. One captured
die-on-a-tie exchange settles it (QUESTIONS §5c).

---

## 5. shatterblade fired twice and did nothing observable

`activeEnemyBuff` was live from state-029 onward:

```json
{"id":"shatterblade","name":"Sharpened",
 "description":"Applies 1 Vulnerable on Sword wins",
 "effects":[{"kind":"onEnemyWinExchange_applyStatus",
             "statusType":"Vulnerable","amount":1,"moveType":"rock"}]}
```

The enemy won with Sword at 042→043 and 043→044. Both times the player's
`statusEffects` stayed `[]` and the player took exactly the predicted damage
(both side-updates are `ok` in the replay). n=2, so `ENEMY_BUFF` stays as a
reason code — but 2 opportunities with 0 observed effects is worth recording.

---

## 6. Dead ends

- **Narrowing `ROLLED_STATS`.** See §4. The most promising idea of the session
  and correctly refused.
- **Asserting "every boon the sim takes carries a reason code."** Failed on
  `Heal` at room 2 — correctly, because Heal is genuinely clean. The test was
  asserting my expectation rather than the model, exactly the failure mode the
  session-05 brief §1 warned about. Rescoped to room-1 boons, where the claim is
  true *and* is the actual finding.
- **Inferring `UpgradePaper` from its name and `selectedVal2: 4`.** Almost
  certainly +4 to Shield. Not modelled — nobody picked it, so no recorded state
  shows what moved. Same for the other six unmodelled types.

---

## 7. Verification output

```
$ npx tsc --noEmit
(clean, exit 0)

$ npx vitest run
 Test Files  7 passed (7)
      Tests  91 passed (91)
   Duration  173ms

$ npm run sim
REPLAY — combat model vs every recorded exchange
exchanges replayed: 66
side-updates matched: 127/132
mismatches inside the clean model: 0
mismatches on unscorable exchanges: 5

SIM — 1000 runs — random vs random
  battle win rate:        60.6%  (606/1000)
  deepest scorable room:  1
  mean rooms cleared:     0.859 ± 0.052 (95% CI)
  BOONS: scored 83/858 pickups — Heal 83 taken, 83 kept the run clean;
         every other type 0.

SIM — always-rock  67.9% (679/1000)   mean rooms 1.018 ± 0.058
SIM — always-paper 55.1% (551/1000)   mean rooms 0.847 ± 0.059

TASK 4.5 — DEEPEST SCORABLE ROOM: 1   (gate asked for >= 4)
HYPOTHETICAL (Heal substituted into room 1): 2 — then capped by wall 2

THRESHOLD CHECK
  enemy 63  Shield DEF 2  net-on-tie 4  → clears        ✓
  enemy 64  Shield DEF 4  net-on-tie 2  → clears        ✓
  enemy 65  Shield DEF 6  net-on-tie 0  → NEVER clears  ✓
  enemy 66  Shield DEF 8  net-on-tie 0  → NEVER clears  ✓
```

Battle win rates are identical to session 04, confirming the boon work regressed
nothing — only the reason breakdown changed, from one bucket to four.
