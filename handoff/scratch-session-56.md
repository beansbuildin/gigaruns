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

10. **§2's "demote" needed an interpretation and I made one explicitly.** The
    directive names no penalty. Implemented as: inside rooms 1..8 a lifesteal
    type is not eligible for a priority match, so it always loses to the listed
    families while `rankBoons` still decides among leftovers. That is "ranks
    below the listed families" with no invented tie-break. NOT an exclusion —
    lifesteal can still be taken by the fallback. Stated in the module header.

11. **The brief's §2d premise failed: overlap is 1 of 5, not high.** So
    boonCapture is NOT retired. 7 of the 9 capture-room offers where it fires
    take a target no priority family reaches. Precedence needed instead:
    capture > priority > ranked, in one place, tested.

12. **§2e is a clean null.** Δ mean rooms cleared −0.001 vs combined half-width
    0.115. Coverage RISES 32%→35%. The comparison is biased AGAINST the
    directive (it picks types the sim fails closed on), which is stated in the
    script rather than left implicit.

13. **§3's biggest finding is a NULL that matters: modelling every enemy buff
    frees ZERO exchanges.** ENEMY_BUFF drops 256→184 but `scored` stays at
    64/1107, because ROLLED_STATS co-occurs on every one. 617 of 622 non-Safe
    paths carry non-zero rolled stats. After a rule-8 flip the sim scores
    almost nothing REGARDLESS of buff modelling. Brief 57 must plan for this.

14. **Room 9 does NOT become modellable.** bloodthirsty is statOnly so
    ENEMY_BUFF clears, but evasion 3 / block 1 / lck 2 / tenacity 2 keep
    ROLLED_STATS. Answered the brief's question directly: no.

15. **§4 inheritance is 87/87 = 100%.** Session 09's one instance fully
    generalises. Reward tier of room N+1 == fight tier of room N.

16. **The `gigusOrbAmount` gap is the session's best un-asked-for find.**
    Per-option Hard Core payout, differs across options in 136 of 138 offers,
    and BOTH `pickBoon` and `pickBoonWithPriority` are blind to it. Independent
    of rule 8. This is the nearest thing in data to "harder cores payout".

17. **USER DIRECTIVE mid-session: never take a `Perpetual` card as the
    hardest option.** Implemented as a within-tier tie-break so it cannot
    change the tier fought (rule 8 intact). 47 of 134 offers put a perpetual on
    the top tier — post-flip this fires on ~35% of rooms, a substantial
    carve-out. Only 4 offers are all-one-tier with a perpetual (the only shape
    reachable today) and all 4 have a clean alternative. 0 offers are entirely
    perpetual. Fails OPEN — a preference among equals must not strand a run.

18. **`maxRoom` is a real SERVER field and it is per-dungeon.** Forbidden Woods
    16, Void Dungeon 17. So the user's "room 16" is server-confirmed, not
    inferred, and hard-coding it would be wrong for another dungeon.

19. **My own test guard caught a real corpus shape.** The unjoined-offer
    assertion failed on `run-2026-08-14-22-02-31/state-000.json`, a capture
    that OPENS at room 4. Legitimate (mid-run capture), so the assertion names
    that reason explicitly rather than being loosened.
