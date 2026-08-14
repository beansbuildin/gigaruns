# scratch — session 06

Surprises as they land. Raw; the recap compresses this.

---

## S1. Enemy rolled stats are a TIER CHOICE, not innate — wall 2 is wrong

`enemyPathOptions[]` carries `rolledEnemyStats` **and** `enemyBuff` **per tier**.
From run-2026-08-14-03-26-57 state-006, all three options are `enemyId: 64`:

```
index 0  tier 0  "Safe"        rolled {ev 0, bl 0, lck 0, ten 0}   enemyBuff null
index 1  tier 2  "Dangerous"   rolled {ev 1, bl 2, lck 1, ten 1}   corrosiveShield / Miasmaguard
index 2  tier 2  "Dangerous"   rolled {ev 1, bl 1, lck 3, ten 3}   perpetual_firebrand
```

`src/sim/enemies.ts` says enemy 65's `evasion 2 / block 2 / lck 1` is "Innate, not
boon-granted — which is why room 3 is unscorable no matter how well boons are
modelled. [session 05]". **That is false.** It was innate to *the enemy the user
chose*, and the user was choosing Dangerous tiers.

Consequences, in order of size:

1. **Wall 2 of the Task 4.5 analysis collapses.** SPEC §4d, TASKS §4.5, STATE
   session 05 and DECISIONS 2026-08-15 all assert enemies 65/66 are unscorable
   innately, capping `deepestScorableRoom` at 2. Under a Safe-tier policy they
   are clean. The retirement of the gate still stands — it was unreachable *from
   that corpus* — but the reason recorded for it is wrong and must be corrected.
2. **`ROLLED_STATS` stops being a wall and becomes a choice.** The bot can avoid
   it entirely by picking tier 0, which is also what §4c would pick anyway (see
   S2). Resolving rolled-stat semantics is now a nice-to-have, not the top
   blocker.
3. The room-3 enemy profile in `enemies.ts` is a Dangerous-tier instance
   mislabelled as the enemy itself. Same suspicion applies to room 4's
   `ENEMY_BUFF` (shatterblade) — almost certainly a tier-2 buff, not a property
   of enemy 66.

## S2. QUESTIONS §6 RESOLVED — loot is identical across tiers

All three options above carry the *same* `lootTable`: `LT_D5_Room_2`, `ID_CID 95`,
item `846`, weight 1, amount **9**. Identical across Safe and both Dangerous.

Second sample, and it agrees with the first. So higher tiers are **pure added
risk with zero loot upside**, and the tier rule is trivially "always Safe" —
which is also the coverage-preserving choice. Two independent reasons, same
answer.

Caveat kept: two samples, both at room 2. If a deeper room ever shows a tier
premium in `LOOT_AMOUNT_CID_array`, this reverses.

## S3. Enemy buffs have a machine-readable effect schema

Not prose — typed:

```json
{ "id": "perpetual_firebrand", "name": "Perpetual Firebrand",
  "description": "Applies 2 Burn on Sword wins", "minTier": 2, "perpetual": true,
  "effects": [{ "kind": "onEnemyWinExchange_applyStatus",
                "statusType": "Burn", "amount": 2, "moveType": "rock" }] }

{ "id": "corrosiveShield", "name": "Miasmaguard",
  "description": "Reduces 3 max armor on Shield wins", "minTier": 2,
  "effects": [{ "kind": "onEnemyWinExchange_corrode",
                "amount": 3, "moveType": "paper" }] }
```

Two things this buys:

- **Burn's `amount` is 2 here, not 3.** DECISIONS 2026-08-15 holds
  `BURN_PER_EXCHANGE` off because "the boon's `selectedVal1`, the status
  `amount` and the damage are all the number 3 from one status instance, so the
  three candidate rules are one observation". A second instance at amount 2
  breaks that coincidence — if a Firebrand enemy is ever observed dealing 2/turn,
  "ticks for `amount`" separates cleanly from "ticks for 3".
- `corrosiveShield` is the same id as the **boon** `CorrosiveShield` offered at
  room 1 (`src/sim/boons.ts`, unmodelled, `val1 2`). Same effect kind, player
  side. That is a *hypothesis* about what the boon does, not a model — the
  DECISIONS rule stands and it stays unmodelled until a pickup pair exists.
  But it tells us where to look.
- `ARMOR_REDUCTION` (`battleArmorReduction`, "semantics unknown" in
  `coverage.ts`) is very likely the Miasmaguard counter: max armor reduced by 3
  per enemy Shield win.

## S4. Player `armorMax` is 16, not 15

`me HP 32/32 ARM 16/16` on state-000. `src/sim/enemies.ts` PLAYER has
`armor: 15, armorMax: 15`. Gear changed between session 04's capture and now.

Not a bug in the model, but every armor-fraction number in sessions 04–05 was
computed against 15. `tests/enemies.test.ts` re-derives PLAYER from fixtures, so
it will now be re-derived across a corpus with two different loadouts in it —
check whether it takes the first, the last, or asserts consistency.

## S5. A side that DIES on a tie still deals full damage — §5c hypothesis REFUTED

The session-06 brief §4 said to prefer, on parsimony, "a side that dies on an
exchange deals no damage", and to add it as a default-off flag confounded with
`evasion 1`.

Run-2026-08-14-03-26-57 `004→005` refutes it outright, inside the clean model:

```
before  me HP 20/32 ARM 0/16   foe HP  4/30 ARM 0/12
after   me HP 12/32 ARM 0/16   foe HP  0/30 ARM 0/12    me=Spell foe=Spell, tie
```

- foe: tie → regen own DEF 4 → armor 4; takes my ATK 12 → 4−12 = −8 → HP 4−8 → **0, dead**
- me:  tie → regen own DEF 8 → armor 8; takes foe ATK 16 → 8−16 = −8 → HP 20−8 = **12** ✓

The enemy died on that tie **and dealt its full 16 anyway**. So the rule is
refuted, and the confound at 037→038 breaks the other way: the surviving
explanation for the player taking 0 from a 10-ATK tie is now `evasion`, i.e.
**evasion probably does dodge**, and the player-side evidence stays 8/9 rather
than becoming 9/9.

Do NOT implement the die-on-a-tie flag. Do NOT narrow `ROLLED_STATS` either —
8/9 is still n=9, still under the 30-observation floor. What changed is which
hypothesis is live, not whether we can read a rate off nine samples.

## S6. Watcher writes two runs into one directory

`scripts/watch.ts` fixes `OUT` per *process*, so a second dungeon run captured by
the same watcher lands in the same `run-<stamp>/` with continuing indices — the
exact hazard its own header warns about. `src/sim/corpus.ts` splits on
`DUNGEON_ID_CID` (DECISIONS 2026-08-14) so it is handled, but any new analysis
script that globs `state-NNN.json` and diffs neighbours will read the boundary
between two attempts as an exchange.
