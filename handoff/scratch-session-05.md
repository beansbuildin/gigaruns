# scratch — session 05

Surprises as they landed. Raw; the recap distils this.

## 1. The corpus HAS boon pairs — four of them, each isolating one boon

Brief §3 hedged that there might be none. There are four, and every one is a
clean single-boon before/after (`rewardPathPhase` state → `enemyPathPhase`
state), so no attribution ambiguity at all:

| pair | boon | selectedVal1 | observed delta |
|---|---|---|---|
| 23-29-39 008→009 | AddLuck | 1 | `lck.current` 0 → 1 |
| 01-00-08 021→022 | AddEvasion | 1 | `evasion.current` 0 → 1 |
| 01-00-08 027→028 | Heal | 16 | `health.current` 15 → 31 |
| 01-00-08 038→039 | AddBurnSword | 3 | **nothing** |

Re-confirms DECISIONS 2026-08-14 on `selectedVal1`: Heal's `val1Min/Max` is 8,
`selectedVal1` is 16, HP moved 16. Reading the range would have halved it.

AddBurnSword having a **zero pickup delta** is itself a verified result, not a
gap — it is a latent combat effect, not a stat change.

## 2. But the boon model does NOT move `deepestScorableRoom`. Three walls.

This is the session's real finding and it is a negative one.

**Wall 1 — every observed room-1 boon option is unscorable.** Both recorded
room-1 offer triples are one modellable-but-contaminating rolled-stat boon plus
two types with no pair at all:

- `AddLuck(1) | CorrosiveShield(2) | UpgradePaper(0,4)`
- `AddEvasion(1) | AddTenacity(2) | AddBlock(2)`

6 of 6 room-1 options unscorable. There is no clean choice to make.

**Wall 2 — rooms 3 and 4 are unscorable for reasons boons have nothing to do
with.** Enemy 65 carries evasion2/block2/lck1 innately; enemy 66 carries Burn
and the run carries `shatterblade`. So a *perfect* boon model caps
`deepestScorableRoom` at **2**. The brief's gate of ≥4 was never reachable from
this corpus — that is a property of the enemies, not of boons.

**Wall 3 — no grounded boon-offer distribution.** 4 offer triples total (2 at
room 1, 1 each at rooms 2 and 3). Inventing what gets offered is forbidden.

## 3. Burn is a flat 3/exchange and I can nearly close it

The three enemy-66 "unexplained" misses are all **exactly 3 damage**, and the
enemy's `statusEffects` is `[{Burn, amount: 3}]`:

- 045→046 rock/scissor: predicted HP 28, actual 25
- 046→047 paper/paper: predicted 25/2, actual 24/0 → total 9 taken = 6 ATK + 3
- 047→048 paper/paper: predicted 24/2, actual 23/0 → same

`amount` does **not** decrement across the three exchanges. Burn first appears
at 046, immediately after the player's first Sword win of that battle — which is
exactly what `AddBurnSword` should do.

Confounded three ways though: boon `selectedVal1` = 3, status `amount` = 3, and
damage = 3 are all the same number, from one status instance at one value. And
it is never observed expiring, so duration is unknown. Modelled behind a
default-off flag, same pattern as `chargesAreHardLimit`.

## 4. The enemy-65 half-damage sample has a confound I can rule OUT and a rule I can't

029→030: player Sword (16) wins, enemy takes **8**, exactly half.
032→033: **identical matchup**, same enemy, same stats — enemy takes the full 16.

So it is not a function of (moves, stats) alone. Hypotheses tested and rejected:

- *block halves damage landing on armor* — rejected by 030→031, where our
  Shield's 6 ATK landed in full on armor 7→1.
- *flat reduction* — rejected; every other enemy-65 exchange takes full ATK.
- *damage to a target at FULL armor is halved* — fits both samples (029 enemy
  ARM 15/15, 032 enemy ARM 0) and is NOT rejected by any enemy-65 row. But
  enemy 63 at full armor took full damage, so it would need to be conditional on
  `block > 0`, which is one positive sample. Not modellable.

Stays unmodelled. The capture that settles it is cheap: any run against enemy 65
that records several Sword wins at full enemy armor.

## 5. Rolled stats: opportunity-counted, the player-side evidence is too thin

Counted in **damage-taking opportunities**, not side-updates — the session-04
charge-recount lesson, and it matters a lot here:

```
player evasion1     8/9   exact     (side-update count flattered this to 20/21)
player lck1         2/2   exact
enemy  ev2+bl2+lk1  6/7   exact
enemy  none        34/37  exact     (all 3 misses are Burn)
player none        29/29  exact
```

I wanted to narrow `ROLLED_STATS` so that `AddEvasion`/`AddLuck` would become
clean and room 2 would open. **The data does not license it.** n=9 with one
miss is exactly the shape a ~10% dodge proc produces, and DECISIONS
2026-08-14/2026-08-15 both say not to read a rate off this few observations —
that is the enemy-63 "Shield-biased 57%" mistake in a new costume. Blocked
deliberately, not overlooked.

## 6. The one player-side miss is perfectly confounded

037→038 predicted player ARM 5, actual 15 — the player took 0 from a 10-ATK tie.
Two explanations, and the corpus cannot separate them:

- player `evasion 1` dodged, or
- **a side that dies on an exchange deals no damage** — and 037→038 is the
  *only* exchange in the entire corpus where a side died on a **tie**. Every
  other recorded kill is an outright win, where the loser already deals nothing.

Worth stating because the second reading is a plain combat rule that would need
no new mechanic at all, and one captured die-on-a-tie exchange settles it.

## 7. shatterblade fired twice and did nothing observable

`activeEnemyBuff` = shatterblade ("Applies 1 Vulnerable on Sword wins") was live
from state-029 on. The enemy won with Sword at 042→043 and 043→044. The player's
`statusEffects` stayed `[]` both times and took exactly the predicted damage.
n=2, so `ENEMY_BUFF` stays — but it is 2 opportunities, 0 observed effects, and
worth one line in the recap.
