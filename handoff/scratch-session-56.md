# scratch — session 56 surprises (write as they happen)

1. **§19 confirmed BLOCKED live at session start**, 22:31 PT 2026-08-19.
   `checkFishingCaps.ts`: game 20/20, repo 20 casts, 12.48h to reset. Ledgers
   agree. Session began after 11:00 PT but on a SPENT day — the brief's
   precondition is "after 11:00 PT on an UNSPENT day". Zero energy spent.

2. **`rewardPathOptions[]` carries `tier`/`tierName` AND
   `gigusOrbItemId`/`gigusOrbAmount`.** `WireRewardOption` in corpus.ts declares
   only `index` + `boon`. Brief §4's premise CONFIRMED.

3. **Within-offer reward tier is 100% UNIFORM (137/137 offers).** The tier is a
   property of the OFFER, not of the option — there is no tier to choose among
   reward options. Brief §4 framed it as "does a higher-tier reward offer
   contain better boons", which is the right question; "compare options by
   tier" within an offer is not possible.

4. **`gigusOrbAmount` DIFFERS across the three options in 135 of 137 offers**
   (e.g. room 2 tier 0: [20,15,15]; room 3 tier 0: [23,16,21]). So picking a
   reward option ALSO picks a Hard Core (item 845) payout, and `pickBoon` is
   completely blind to it. Not in the brief. Live strategy gap.

5. **Run directories hold MULTIPLE attempts.** `entity.ID_CID` is literally 5
   (the dungeon id), NOT a run id — useless as a discriminator. Attempts are
   delimited by `ROOM_NUM_CID` DECREASING. A naive per-directory join produced 5
   bogus "reward tier != preceding fight tier" cases; all 5 were cross-attempt.

6. **`ROOM_NUM_CID` lives on `data.entity`, NOT `data.entity.data`.** Reading it
   off `entity.data` yields None silently.

7. **§3 is far more tractable than the brief assumed: 46 distinct `enemyBuff`
   ids, EVERY ONE self-describing on the wire** via structured `effects[]`
   (`kind`/`amount`/`percent`/`statusType`/`moveType`). 23 base + 23
   `perpetual_` twins with identical effects. The brief's "at least one is
   legible (bloodthirsty +4 ATK)" understates it enormously. Consequence: the
   fail-closed boundary should be the effect KIND, not the buff id.
   Kinds seen: flatAtk flatDef flatHP flatShield pctAtk pctDef pctHP pctShield
   onEnemyWinExchange_applyStatus onEnemyWinExchange_lifesteal
   onEnemyWinExchange_corrode startBattleStatus.

8. **`rolledEnemyStats` is always exactly {evasion, block, lck, tenacity}**,
   1687 occurrences, one shape.

9. **No `floor` field exists anywhere in the corpus.** §5's "room 16 = floor 4
   room 4" mapping is UNVERIFIABLE from data. But `src/sim/enemies.ts` already
   has `MAX_ROOM = 16`, and boon rows carry `MinRoom`/`MaxRoom` (1..17 and
   1..12). Encode against the flat `ROOM_NUM_CID`.
