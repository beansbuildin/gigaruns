# STATE — session 56 — 2026-08-19 (PT) — code at commit 8ec7520

> The five code commits end at **8ec7520**; the scratch-notes commit and this
> recap sit on top of it. All verification below was run AT 8ec7520 and again
> at the scratch commit, neither of which touches source after 8ec7520.

## Status
Session-56 brief: **all seven items (§2a, §2, §2d, §2e, §3, §4, §5) delivered**,
plus one user directive given mid-session. **No gate was set by the brief**, and
per CLAUDE.md rule 6 none is invented here — the bar was full suite + `tsc` +
`git diff --check`, all clean.

**Zero energy spent. Zero casts. Zero dungeon runs.** §19 was verified BLOCKED
live as the first action (one GET, free): session began 22:31 PT — after the
11:00 PT rollover but inside the day session 55 exhausted. Game ledger 20/20,
repo ledger 20, agreeing, 12.48h to reset.

**Rule 8 remained in force all session.** No `pickHighestTier` exists; no tier
was raised anywhere. The two selection changes that DID land are strictly
within-tier or tier-lowering — see "What works".

**The single most important finding is §3's, and it is a NULL that changes
brief 57:** modelling every enemy buff frees **ZERO** exchanges.

## What works
- **§2a SPEC §3g — the Rosetta stone, user-confirmed.** Rock=Sword,
  Paper=Shield, Scissor=Spell, plus the third label nobody names: boon type
  strings use **`Magic`** for the scissor arm. Cross-checked against
  `enemyBuff.effects[].moveType` (action vocabulary) vs its `description`
  (human vocabulary) — holds on all 46 buff ids.
- **§2 `src/strategy/boonPriority.ts`** — the directive as a literal five-step
  total order ABOVE `rankBoons`, which is untouched and becomes both the
  fallback and the within-tier tie-break. Sword family matched by SUFFIX (a
  synthetic never-offered `*Sword` type is covered, pinned by test).
  `AddVulnerableSword` is in two families and resolves to 4 deterministically.
  ON by default live, OFF by default in the sim. Logs
  `boon_priority_burnmastery` and `boon_priority_conflict`.
- **§3 `src/sim/enemyBuffs.ts`** — all 46 corpus buff ids with structured
  effects; 12 statOnly / 34 mechanic. `coverage.ts` raises `ENEMY_BUFF` only
  for a mechanic buff, unknown id, or unrecognised effect KIND.
- **§4 `scripts/rewardTierAudit.ts`** + `tests/rewardTier.test.ts` — reward
  tier inheritance **87/87 = 100%**.
- **§5 `pickTierForRoom`/`pickFinalRoomTier`** — the final-room no-modifiers
  exception, keyed on the SERVER's per-dungeon `maxRoom`. Inert under rule 8.
- **USER DIRECTIVE (mid-session): never take a `Perpetual` card as the hardest
  option.** Implemented as a strict WITHIN-TIER tie-break in `pickLowestTier`,
  so it cannot change which tier is fought.
- Suite **988/988** (was 931), `tsc --noEmit` clean, `git diff --check` clean.
  No test writes a real data path; the three new I/O-touching liveRun tests all
  use `mkdtempSync` fixture roots.

## What's broken
1. **Modelling enemy buffs frees ZERO exchanges, and this is the headline for
   brief 57.** `ENEMY_BUFF` drops 256 → 184 exchanges, but `scored` stays at
   **64/1107** — `ROLLED_STATS` co-occurs on every freed one. Of 622 non-Safe
   paths ever offered, **617 (99.2%)** carry non-zero rolled stats, and SPEC
   §4e establishes those are 1–5% proc chances needing hundreds of
   observations. **After a rule-8 flip the simulator scores almost nothing
   regardless of how well buffs are modelled.** Not a fixable gap; a fact.
2. **Room 9 does NOT become modellable** — the brief's direct question,
   answered no. `bloodthirsty` is statOnly so `ENEMY_BUFF` clears, but
   evasion 3 / block 1 / lck 2 / tenacity 2 keep `ROLLED_STATS` raised.
3. **`gigusOrbAmount` is a live strategy gap nobody has ever looked at.**
   Hard Core (item 845) payout is carried PER REWARD OPTION and differs across
   the three options in **136 of 138 offers** (e.g. `[23,16,21]`). Both
   `pickBoon` and `pickBoonWithPriority` are completely blind to it.
4. **§19 is UNMEASURED for a sixth session.** Unchanged, still purely a
   scheduling block. Precondition: a session BEGINNING after 11:00 PT on a day
   the caps are unspent.
5. **§23's −1 energy drift is still unexplained.** Probe armed, never fired —
   no run happened. Unchanged from sessions 54 and 55.
6. Carried, unchanged: the git HISTORY still holds the noob token and the three
   documents' identifiers (deliberate, `fixtures/README.md`).

## Corrections to SPEC.md
- **SPEC gains §3g (move names) and §3h (enemyBuff), both new, both CONFIRMED.**
  No live response contradicted an existing SPEC claim — there was no live play.
- **§3h corrects the session-56 BRIEF, not SPEC**: the brief said "at least one
  buff is legible". All 46 are — every `enemyBuff` carries structured
  `effects[]`. And the brief's "APPLY `rolledEnemyStats` and a known
  `enemyBuff`" would **double-count**: a stat buff is ALREADY inside the wire's
  numbers, verified 30/30 against clean baselines.
- Percentage buff effects round **UP**: 14 × 1.3 = 18.2 → 19 rules out floor
  and round-half.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
  **`maxRoom` is a real server field and is PER DUNGEON** — Forbidden Woods 16,
  Void Dungeon 17.
- Move charges: PRESENT — unchanged, no new capture this session.

## Dead ends
- **Do not "apply" a stat-only `enemyBuff` to a combatant.** It is already in
  `startingATK`/`startingDEF`/`health.starting`/`shield.starting`. Applying it
  double-counts. `applyStatBuff()` exists for VERIFICATION only and says so.
- **Do not draw the buff fail-closed line on the buff ID.** 46 ids, 12 effect
  kinds; the game adds ids far faster than mechanics. Key on the KIND.
- **Do not join reward offers to fights per run DIRECTORY.** A directory holds
  MULTIPLE attempts and `entity.ID_CID` is literally 5 (the dungeon id), not a
  run id. Attempts are delimited by `ROOM_NUM_CID` DECREASING. Without this,
  5 bogus inheritance "exceptions" appear — every one a cross-attempt join.
- **`ROOM_NUM_CID` lives on `data.entity`, NOT `data.entity.data`.** Read off
  the inner object it is `undefined` silently and every room-controlled
  comparison collapses into one bucket.
- **Do not expect the priority list to subsume `boonCapture`.** The brief did;
  the overlap is **1 of 5**. 7 of the 9 capture-room offers where it fires take
  a target no priority family reaches. It is NOT retired.
- **Do not write a liveRun `runOnce` test without `vi.runAllTimersAsync()`.**
  The suite uses fake timers; three new tests timed out at 10s until fixed.
- Standing, unchanged: do not read `matcherWeight` through `matcherWeightOf()`
  for §19 (55); do not write a real identifier into a test (54); do not re-run
  the numeric-token experiment (§21); do not gate a de-aliasing change without
  `--before-raw` (53); `npx tsx -e` cannot resolve this project's relative
  imports; do not tune focus spend quantity again (48–50); never pipe a live
  run to a truncating reader (52).

## Metrics
- **Live dungeon: 0 runs. Live fishing: 0 casts. Energy spent: 0.**
- **Cap ledgers, verified live 22:31 PT and agreeing:** game
  `dayDocs[pondId 2]` = 20 of 20; repo guard 20 casts. 12.48h to rollover.
- **§2e sim head-to-head, 2000 runs each:** room-1 win rate 98.5% ± 0.5 both
  arms; mean rooms cleared rankBoons 3.286 ± 0.057 vs directive 3.285 ± 0.058;
  **Δ −0.001 against a combined 95% half-width of 0.115 — NOT SEPARATED.**
  Battle coverage 32% → **35%**; `deepestScorableRoom` 5 → 5.
- **§2d firing rate, 540 decisions (135 offers × 4 HP fractions):** matches on
  236 (43.7%), CHANGES the pick on 140 (25.9%); room-1 21 of 49 (42.9%).
  By rank: 4 / 52 / 12 / 112 / 56.
- **By-product capture: the directive picks 10 unmodelled types** that session
  55 measured `rankBoons` reaching **0 times in 540 decisions** —
  VulnerableBlock 16, TieVulnerable 12, AddWeakSword 8, AddVulnerableMagic 8,
  BurnMastery 4, VulnerableMastery 4, AddVulnerableShield 4, CorrosiveSword 4,
  AddVulnerableSword 4, ArmorDepletedVulnerable 4.
- **§3 buffs:** 46 ids (23 base + 23 `perpetual_` twins), 12 effect kinds,
  12 statOnly / 34 mechanic. Natural experiment **30/30 exact, 0 mismatches**.
  Tier composition: tier 0 = 188 paths, 0 buffed, 0 rolled; tier 1 = 298, 298,
  293; tier 2 = 324, 324, 324.
- **§4:** 138 offers; within-offer tier uniform 138/138; inheritance 87/87
  (100%); 24 non-Safe offers (17%) across 9 rooms, 5 rooms with a within-room
  contrast. meanOrb by room: r3 Safe 17.3 (n=25) / Risky 19.6 (n=10) /
  Dangerous 21.5 (n=2) Δ+4.21; r4 Δ+0.66; r5 Δ+1.30; r6 Δ−1.53 (n=1);
  r7 Δ+2.17 (n=2). Positive in 4 of 5 contrasts. **Suggestive, not established.**
- **Perpetual directive:** 47 of 134 offers (35%) put a perpetual on the top
  tier; 4 offers are all-one-tier with a perpetual among them (the only shape
  reachable under rule 8), all 4 have a clean alternative; **0 offers are
  entirely perpetual.**
- Suite 931 → **988**. Corpus unchanged (nothing captured this session).

## Open questions for Claude
1. **The rule-8 flip needs a decision about the SIMULATOR, not just the game.**
   §4 corroborates the user's mechanism strongly (inheritance 100%), and rule
   8's own evidence does not refute it — rule 8 measured `lootTable` identity
   IN THE ENEMY OFFER (440/440), while reward quality is downstream of WINNING.
   The claims are orthogonal. **But §3 measured the cost: post-flip the sim
   scores almost nothing (617/622 non-Safe paths carry unmodellable rolled
   stats).** Brief 57 should say explicitly whether that is accepted. It is not
   avoidable by more capture.
2. **Do you want `gigusOrbAmount` in the boon ranking?** It is a real per-option
   Hard Core payout the bot has always ignored, differing in 136 of 138 offers.
   This is independent of rule 8 and probably the cheapest live gain available.
   It needs a user directive on how to trade orbs against boon quality.
3. **`boonCapture` should stay armed-able but the calculus changed.** The
   directive now reaches 10 unmodelled types free. The remaining capture-only
   targets are TieWeak(11 offers), AddBurnShield(8), AddLifestealShield(5),
   Regen(4). Ask the user whether to arm `--boon-capture` on the next run.
4. **§19 needs a session that STARTS after 11:00 PT on an unspent day.** Sixth
   session blocked. `npx tsx scripts/checkFishingCaps.ts` first, then 20 casts,
   then `npx tsx scripts/matcherWeightReport.ts --last-casts=20`.
   **Put the precondition in the brief's first paragraph.**
5. **§23 stays open until the armed probe fires.** Unchanged.
6. **Room 9 still needs a SAFE capture** to become modellable — buff modelling
   did not free it. Rule 8 means you cannot choose it; a flip would make it
   reachable but also make every other room dirty.

## Files changed
```
 6 commits.  18 files, +3,075 / −22.  No fixtures written (zero live play).

     src/sim/enemyBuffs.ts         | 698  (§3, new — 46 ids + classification)
     src/strategy/boonPriority.ts  | 302  (§2, new — the directive as code)
     scripts/rewardTierAudit.ts    | 289  (§4, new)
     tests/enemyBuffs.test.ts      | 285  (§3 + §5)
     scripts/enemyBuffAudit.ts     | 229  (§3, new)
     tests/boonPriority.test.ts    | 229  (§2, new)
     scripts/boonPriorityReport.ts | 207  (§2d/§2e, new)
     scripts/liveRun.ts            | 160  (§2/§5 wiring, perpetual directive)
     tests/rewardTier.test.ts      | 133  (§4, new)
     src/strategy/enemyTier.ts     | 126  (perpetual tie-break, §5)
     tests/liveRun.test.ts         | 119  (§2 live path)
     SPEC.md                       | 107  (§3g, §3h — both new)
     src/sim/coverage.ts           |  43  (ENEMY_BUFF now kind-aware)
     src/sim/enemies.ts            |  22  (room 9 re-check)
     src/strategy/policy.ts        |  21  (sim opt-in arm)
     src/orchestrator/config.ts    |  18  (boonPriority knob)
     config/bot.json               |  10  (boonPriority block)
```

---

# VERBOSE APPENDIX — session 56

## Timeline
- 22:31 PT — session start. First action: `npx tsx scripts/checkFishingCaps.ts`
  (read-only, one GET, zero energy). VERDICT BLOCKED, 20/20, 12.48h to reset.
  §19 not attempted. No other live call was made all session.

## §2e — full sim head-to-head output (2000 runs each arm)
```
  ROOM-1 BATTLE WIN RATE, scored subset, 95% CI
    rankBoons (control)   98.5% ± 0.5  (1970/2000 scored)
    directive             98.5% ± 0.5  (1970/2000 scored)

  mean rooms cleared      rankBoons 3.286 ± 0.057   directive 3.285 ± 0.058
  battle coverage         rankBoons 32%   directive 35%
  deepestScorableRoom     rankBoons 5   directive 5

  Δ mean rooms cleared: -0.001  (combined 95% half-width 0.115)
  → NOT SEPARATED: the sim cannot distinguish the two arms at this n.
```
The script prints, and this log repeats, the reason the number is weak: the
directive deliberately picks types `src/sim/boons.ts` fails closed on, so those
boons apply NOTHING in the sim and something real in the game. The comparison
is biased AGAINST the directive. A null here is this instrument's ceiling, not
a verdict, and explicitly not a reason to tune the ordering.

## §3 — the natural experiment, in full
Four enemies were captured BOTH clean (`enemyBuff: null`) and under buffs.
Predicting the buffed stat block from the clean baseline plus the buff's own
declared `effects[]`:

```
  distinct (enemy, buff, stats) triples with a clean baseline: 30
  predicted == observed: 30
  mismatches:            0
  buffed sightings with no clean baseline for that enemy: 18
```

Worked examples:
```
  Enemy Room 64  base rock/paper/scissor ATK 14/10/8
                 + bloodthirsty (+4 ATK all moves) -> 18/14/12   ✓
  Enemy Room 65  base 10/15/12  + bloodthirsty     -> 14/19/16   ✓
  Enemy Room 67  base 15/12/18  + bloodthirsty     -> 19/16/22   ✓
  Enemy Room 64  base hp 35 / armor 14
                 + hardy     (+3 max HP, +2 armor) -> 38 / 16    ✓
                 + overgrown (+30% HP, +30% shield)-> 46 / 19    ✓
```
`overgrown` fixes the rounding: 35 × 1.3 = 45.5 → 46 and 14 × 1.3 = 18.2 → 19.
Ceiling. Floor and round-half both give 18 for the second.

### Effect kinds — the fail-closed line
```
  stat modifiers : flatAtk flatDef flatHP flatShield pctAtk pctDef pctHP pctShield
  mechanics      : onEnemyWinExchange_applyStatus onEnemyWinExchange_lifesteal
                   onEnemyWinExchange_corrode startBattleStatus
```
46 ids, 12 kinds, 23 base + 23 `perpetual_` twins with byte-identical effects.
`classifyBuff` reads the LIVE `effects[]`, not the table's stored class, so a
server-side redefinition of a familiar id is caught rather than trusted.

### Tier composition — why this matters for the rule-8 flip
```
  tier    paths    with buff   rolled != 0
  0       188      0           0
  1       298      298         293
  2       324      324         324

  non-Safe paths offered: 622
  ...still blocked by ROLLED_STATS after every buff is modelled: 617  (99.2%)
  ...freed by this change alone:                                 5  (0.8%)
```
And measured end to end on the real replay, which is the number that settles it:
`ENEMY_BUFF` 256 → 184 exchanges, `scored` **64/1107 before and after**.
Zero exchanges freed.

## §4 — reward tier audit, full quality table
```
  room  tier         n   meanOrb   unmodelled%   priority-target%
  2     Safe         50    18.22           16%               42%
  3     Safe         25    17.29           13%               44%
  3     Risky        10    19.63           27%               50%
  3     Dangerous     2    21.50           33%               50%
  4     Safe         21    18.21           27%               38%
  4     Risky         5    18.87           27%               60%
  5     Safe          9    18.37           22%               44%
  5     Risky         2    19.67            0%               50%
  6     Safe          5    17.87           33%               60%
  6     Risky         1    16.33           33%                0%
  7     Safe          2    18.83           17%                0%
  7     Risky         2    21.00           33%              100%
  8     Safe          2    18.00           33%                0%
  9     Risky         1    20.67           67%              100%
  10    Risky         1    18.00            0%                0%
```
Within-room contrasts (the only comparisons that control for depth):
```
  room 3: Safe 17.3 (n=25)  Risky 19.6 (n=10)  Dangerous 21.5 (n=2)  Δ +4.21
  room 4: Safe 18.2 (n=21)  Risky 18.9 (n=5)                         Δ +0.66
  room 5: Safe 18.4 (n=9)   Risky 19.7 (n=2)                         Δ +1.30
  room 6: Safe 17.9 (n=5)   Risky 16.3 (n=1)                         Δ -1.53
  room 7: Safe 18.8 (n=2)   Risky 21.0 (n=2)                         Δ +2.17
```
Positive in 4 of 5, largest where n is largest. **Suggestive, not established.**

Roll values on matched types cut BOTH ways and should not be over-read:
```
  AddMaxHealth    Safe={8,14}          Risky={24}
  AddBurnMagic    Safe={3}             Risky={5}
  AddMaxArmor     Safe={2,8}  Risky={10}  Dangerous={4}   <- against the trend
  UpgradeRock     Safe={0/4,0/6,0/8,4,6,8,12}  Risky={4,8,12}
```

## §4 — the two corpus traps, verbatim
1. A run DIRECTORY holds multiple attempts. `entity.ID_CID` is literally `5`,
   the DUNGEON id, so it cannot separate them. Attempts are delimited by
   `ROOM_NUM_CID` DECREASING. Example, `run-2026-08-15-15-38-09`: rooms go
   2,2,3,3,4,4 … then state-077 is room 2 again — a new attempt. Joining
   per-directory produced 5 bogus "reward tier != preceding fight tier"
   exceptions, all cross-attempt.
2. `ROOM_NUM_CID` is on `data.entity`, NOT `data.entity.data`. The inner object
   holds `activePath`, `rewardPathOptions`, `enemyPathOptions`, `invader`,
   `nerfCost`, `roomNerfCount`, `gearInstances`, `playerEquipment` — and no
   room. Reading room off it returns `undefined` silently.

The inheritance chain, read off one attempt, is unambiguous:
```
  room 2 reward tier 0 -> enemy offer [1,1,1], fought tier 1 -> room 3 reward tier 1
  room 3 reward tier 1 -> enemy offer [1,1,2], fought tier 1 -> room 4 reward tier 1
  room 2 reward tier 0 -> enemy offer [2,2,2], fought tier 2 -> room 3 reward tier 2
```

## The perpetual directive — measurement behind the implementation
User, mid-session 2026-08-20: "if the red/hardest/highest risk enemy card
contains the condition Perpetual do NOT select that, go with the next best
option based on existing criteria."
```
  distinct enemy offers:                                    134
  top tier carries a perpetual:                              47  (35%)
  ...with a strictly lower tier available:                   43
  ...all options at ONE tier (the only shape reachable
     under rule 8):                                           4
  offers where EVERY option is perpetual:                     0
```
All 4 of the reachable-today cases have a non-perpetual option at the same
tier, e.g. room 2 `[(2,'overgrown'), (2,'perpetual_ferocious'),
(2,'perpetual_mangleblade')]`. Implemented as a WITHIN-TIER tie-break in
`preferNonPerpetual`, so `chooseTier`'s minimum is never disturbed. Fails OPEN
if every option at the tier is perpetual — a preference among equals must not
strand a 60-energy run, unlike the tier rule itself which still fails closed.

## §5 — the index-scheme check, in full
`fixtures/probe/dungeon-today.json`, container objects:
```
  ID_CID 1  Dungetron 5000   maxRoom 16   CHECKPOINT_CID -1
  ID_CID 3  Underhaul        maxRoom 16   CHECKPOINT_CID  2
  ID_CID 4  Void Dungeon     maxRoom 17   CHECKPOINT_CID -1
  ID_CID 5  Forbidden Woods  maxRoom 16   CHECKPOINT_CID -1
```
So the user's "room 16" is a SERVER-published number for this dungeon, not an
inference from "floor 4, room 4". There is no `floor` field anywhere in the
corpus. `maxRoom` is per-dungeon, so it is passed as a parameter.

## Test-suite note
The three new `runOnce` tests initially timed out at 10s each. The liveRun
suite runs on FAKE timers and the rate limiter sleeps inside the client; the
pattern is `const p = runOnce(deps); await vi.runAllTimersAsync(); await
expect(p).resolves.toBeUndefined();`. All three use `mkdtempSync` fixture roots
per CLAUDE.md's isolated-path rule.

`tests/rewardTier.test.ts`'s unjoined-offer guard failed during development on
`run-2026-08-14-22-02-31/state-000.json`, which OPENS at room 4 — a capture
that began mid-run. Legitimate corpus shape, so the assertion now names that
reason (`firstCapturedState`) and caps it at 3 rather than being loosened to
`room > 2` unconditionally.
