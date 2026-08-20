# SESSION 52 — 2026-08-19 — dungeon live: the energy claim, then two juiced runs

## Status
Session-52 brief: **all six items delivered.** The two things this session
existed to prove both PASS: the ROM-claim path executed against the live API
for the first time (clean, twice), and two juiced Tier-3 runs exercised the
tier enumeration and in-run decision points that nine sessions of drift had
never touched.

Next: **a server-side change is rejecting every path-selection POST on its
first attempt, and it is invisible unless you read the log by hand.**

## What works
- **§1 the ROM-claim path, LIVE, twice, drift 0.** Wired in session 47, never
  once executed until now. Run 1: pool 8, deficit 52, bank 2499 across 27/37
  ROMs; claimed 3777(13) + 7959(26) + 2114(30) ascending → pool 77, **measured
  delta +69 == snapshot total 69**, all three ROMs read `energyCollectable: 0`
  after. Run 2: pool 22, deficit 38, one claim (2097, snapshot 50) → pool 72,
  **delta +50, drift 0**. No under-credit, no zero-credit claim.
- **§1a `ensureEnergyFor(required, deps, { order, maxClaims })`.** Default
  `"descending"`; omitting both is byte-for-byte session-47 behaviour
  (`maxClaims` defaults to `Infinity`, so its `>=` never fires and the fallback
  is unreachable). Bounded-and-still-short claims the LARGEST remaining ROM and
  logs the fallback. `liveRun.ts --claim-order=ascending|descending`.
- **§1c claim audit** in `liveRun.ts`: measured delta vs snapshot total, the
  drift between them, an explicit warning on NEGATIVE drift, and per-ROM
  post-claim `energyCollectable` re-read from the bank. Logged as `claim_audit`.
- **§3 two juiced Tier-3 runs, 3 heal juices each, all 6 consumed.**
  Run 1: **death @ room 8**, score 6864, loot 420 — deepest and
  highest-scoring run in this corpus (prior best: room 7, 6048/309).
  Run 2 (after the user's manual level-up): **death @ room 7**, score 4896,
  loot 309. `dayProgressEntities` Dungeon#5 0 → 3 → 6; a juiced run costs 3 of
  the daily 12. Guard ledger 120 energy / 6 runs of 240 / 12.
- **TIER ENUMERATION IS EXERCISED — eight sessions of drift discharged.**
  13/13 rooms routed through `pickLowestTier()`; tier taken == lowest offered
  in all 13. **4 of those rooms offered NO Safe tier at all**, where the STRICT
  `pickSafeTier()` would have halted the run for zero loot benefit. CLAUDE.md
  §8's other claim also re-held: `lootTable` is byte-identical across all three
  offered tiers in all 13 rooms (same NAME_CID / ID_CID / item 846 / weight /
  amount).
- **§4 re-mined library shipped** (2 → 4 patterns) with the gate the brief
  asked for — after building the arm that made it measurable at all.
- Suite **806/806** (was 786), `tsc --noEmit` clean, `git diff --check` clean,
  all at the final commit. No test writes to a real data path.

## What's broken
1. **Every path-selection POST is rejected on first attempt — 26/26 — and it
   is NEW.** `reward_*`/`path_*` send the DevTools-confirmed `actionToken: ""`
   and get `HTTP 500 "Invalid action token  != <outstanding numeric token>"`;
   the **byte-identical retry ~1.5s later always succeeds**. Combat moves
   (numeric token) succeed first time, always. The four 2026-08-18 run logs
   have 40 path-selection decisions and **zero** rejections, and no envelope
   code changed in between — so the server changed. Runs still complete, but
   it wastes a request per decision and eats `maxConsecutiveActionFailures`
   (3), of which a reward→path boundary already consumes 2. **Not fixed** —
   changing a confirmed envelope on a guess is what CLAUDE.md §2 forbids.
   QUESTIONS.md §21, SPEC.md correction committed.
2. **The re-mined library is not measurably better than the one it replaced.**
   ΔlogLoss −0.0041, 95% cluster CI **[−0.0355, +0.0177]** — includes zero.
   Shipped per the brief's own rule (don't ship only if WORSE with a CI
   excluding zero), not because it was shown to help.
3. **The two new patterns are exact aliases.** `bounce(2,0)` and `bounce(-2,0)`
   produce byte-identical trajectories on all three supporting casts (on a
   4-wide grid a ±2 step reflects immediately). The library doubled but added
   ONE hypothesis, and the matcher now holds two identical candidates, so that
   hypothesis takes 2/4 of the initial mass instead of 1/3. QUESTIONS.md §22.
4. **A rejection-rate blind spot.** Item 1 was found by reading a JSONL log by
   hand. Nothing in the run summary reports that 100% of a decision class
   failed on first attempt. A run that "succeeded" can hide anything the retry
   loop absorbs.

## Corrections to SPEC.md
- **SPEC §2 "path-selection actions don't use a numeric token at all" is now
  contradicted by the server.** The empty string is rejected on first attempt,
  26/26. Correction block committed to SPEC.md with the timeline and the
  before/after rejection rates. Envelope deliberately unchanged.
- **The brief's "pool at 3/420" was wrong** — live read **8/420** at run 1 and
  22/420 at run 2 (regen 18/hr since the user's drain). The bank was **2499**,
  not the 2480 session 51 recorded. CLAUDE.md §9: the read won, and the deficit
  arithmetic followed the read.
- **The brief's §4 gate was NOT MEASURABLE as specified.** It asked to pair the
  re-mined library "against the current 2-pattern library on the same 88
  traces". No such arm existed: `matcherTier: "loo"` re-mines from `otherCasts`
  every fold and **never reads `data/minedFishPatterns.json`**. Every
  session-50/51 replay figure therefore describes a LOO-mined library, not the
  one live loads. Built `ReplayOptions.matcherLibrary` +
  `scripts/minedLibraryGate.ts` to make the gate runnable.
- **The brief names the file `data/mined-patterns.json`; it is
  `data/minedFishPatterns.json`.** `patternMining.ts:158`'s comment has the
  wrong name too.
- **Wall 1 gained a FIFTH hole.** `AddMaxHealth` has been in `BOON_MODELS`
  since session 23, but no room-1 offer had ever CONTAINED it, so the sim could
  never pick it there. Run 1's room-1 offer did. Same retroactive mechanic as
  session 11's AddMaxArmor and 43's UpgradePaper.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: **PRESENT** — re-confirmed live, `currentCharges`/`maxCharges`
  on every move of both combatants across both runs.

## Dead ends
- **Do not dedupe the mined library on this evidence.** The 3-pattern deduped
  variant scores ΔlogLoss −0.0056 [−0.0312, +0.0121] and catches 24/88 vs the
  4-pattern's 27 and the 2-pattern's 26. All three are indistinguishable; a
  3-catch spread on 88 casts is noise. The real fix is upstream — stop
  `buildPatternPool()`/`promotePatterns` from offering provably-identical
  primitives — and that needs its own gate.
- **Never pipe a live run to a truncating reader.** `head -30` SIGPIPE'd run 2
  mid-battle in room 2 with 60 energy already committed. `--resume-existing
  --potions=3 --potions-used=0` recovered it with nothing lost, but redirect to
  a file and tail it.
- **Checked and NOT claimed:** `deepestScorableRoom` is 4 both before and after
  this session's corpus growth — verified by re-running `npm run sim` on the
  stashed tree. The new room 5/6/7/8 captures did not move it.
- Standing, unchanged: do not rebuild the expected-coverage focus objective
  (50); do not tune focus spend quantity again (48, 49, 50); replay for
  DIFFERENCES never absolutes (48); do not take the bare log-loss argmin on a
  smoothing sweep (51).

## Metrics
- **Live dungeon: 2 juiced Tier-3 runs, 120 energy, 0 clears.**
  | run | death | score | loot (item 846) | juices | rooms w/ no Safe offered |
  |---|---|---|---|---|---|
  | 1 | room 8 | 6864 | 420 | 3/3 | 1 of 7 |
  | 2 | room 7 | 4896 | 309 | 3/3 | 3 of 6 |
- **ROM claims: 4 claims, 119 energy, measured drift 0 on both runs.**
- **§4 replay, 88 clean traces, 292 paired turns, cluster bootstrap over casts:**
  | library | ΔlogLoss vs 2-pattern | 95% CI | caught/88 | matcher-active turns |
  |---|---|---|---|---|
  | 4-pattern (SHIPPED) | −0.0041 | [−0.0355, +0.0177] | 27 | 136 |
  | 3-pattern (deduped) | −0.0056 | [−0.0312, +0.0121] | 24 | — |
  | 2-pattern (before) | — | — | 26 | 129 |
- **Mined support at 89 casts** (so session 53 reads its batch against a known
  library): perimeterWalk(cw) 4, perimeterWalk(ccw) 4, bounce(2,0) 3,
  bounce(-2,0) 3 → **11 distinct supporting casts of 89, prior 0.133**.
- **Live fishing this session: 0 casts** (cap was 20/20 for 2026-08-19).
- Corpus: dungeon 51 → **53 attempts**; fishing unchanged at 89 traces.
- Suite 786 → **806** (+6 claim order, +14 corpus pin updates).

## Open questions for Claude
1. **QUESTIONS.md §21 — the path-selection token rejection.** The preferred
   resolution costs no energy: a fresh DevTools capture of the browser making a
   reward pick, today. That settles the envelope with no run. The alternative
   is a one-line experiment (send `client.getActionToken()` instead of `""`)
   that needs a 60-energy juiced entry to observe, so it should ride along with
   a run that was going to happen anyway.
2. **Should the retry path log a WARN and a running count?** A decision class
   failing 100% of the time on first attempt was invisible in a run that
   otherwise reported success. This is cheap and would have caught it on run 1.
3. **QUESTIONS.md §22 — fix the aliasing upstream?** Neither shipping nor
   deduping is supported by the replay. Making `buildPatternPool()` or
   `promotePatterns` incapable of offering provably-identical primitives makes
   the question moot instead of arguable. Worth its own gate?
4. **§19 (matcher drop-vs-mix) is still open and still needs a batch, not an
   argument.** Session 51's decision rule stands and the instrumentation
   shipped; the library it will run against is now the 4-pattern one recorded
   above. Fishing was capped out today, so nothing was collected.
5. **Was ascending the right call, and should it stay?** It is now proven — but
   the descending rationale (an interrupted pass made the most progress it
   could) is the better steady-state one, which is why the default was left
   alone. Is there a reason to keep passing `--claim-order=ascending`?

## Files changed
```
 14 files changed, 659 insertions(+), 30 deletions(-)   (+ 106 new fixtures)

     src/orchestrator/energyPreflight.ts        | 128  (§1a order/maxClaims/fallback)
     QUESTIONS.md                               | 106  (§21, §22)
     scripts/minedLibraryGate.ts                | 109  (§4 gate, new)
     tests/orchestrator/energyPreflight.test.ts |  87
     src/sim/boons.ts                           |  79  (13 new offers, rooms 1-7)
     scripts/liveRun.ts                         |  75  (--claim-order, §1c audit)
     src/sim/fishing/offPolicyReplay.ts         |  28  (§4 matcherLibrary arm)
     tests/boons.test.ts                        |  25  (corpus pins)
     src/sim/enemies.ts                         |  23  (room 8 / Enemy Room 70)
     tests/dungeonSim.test.ts                   |   7  (AddMaxHealth clean)
     tests/enemies.test.ts                      |   7  (loadout 54/17)
     config/bot.json                            |   2  (potions re-added, removed)
     SPEC.md                                    |  +26 (§2 token correction)
```

---

# Appendix — full dumps

## A1. The path-selection token rejection, verbatim

Run 1, `logs/run-2026-08-20-00-30-48.jsonl`, rooms 1→2 boundary:

```
00:31:08.580 POST start_run      dungeonId=5 token='' idx=3
00:31:10.007 RESP ok actionToken='1787185870449'
00:31:11.138 POST rock           dungeonId=5 token=1787185870449 idx=0
00:31:12.535 RESP ok actionToken='1787185873239'
00:31:13.950 POST scissor        dungeonId=5 token=1787185873239 idx=0
00:31:15.123 RESP ok actionToken='1787185876034'
00:31:16.448 POST rock           dungeonId=5 token=1787185876034 idx=0
00:31:17.774 RESP ok actionToken='1787185878470'
00:31:18.995 POST reward_two     dungeonId=0 token='' idx=1
00:31:20.241 FAIL "Invalid action token  != 1787185878470"
00:31:21.773 POST reward_two     dungeonId=0 token='' idx=1     <- byte-identical
00:31:23.304 RESP ok actionToken='1787185883981'
00:31:24.656 POST path_one       dungeonId=0 token='' idx=0
00:31:25.886 FAIL "Invalid action token  != 1787185883981"
00:31:27.348 POST path_one       dungeonId=0 token='' idx=0     <- byte-identical
00:31:28.846 RESP ok actionToken='1787185889016'
```

Full body: `{"success":false,"message":"Error tracking action","error":"Invalid
action token  != 1787185878470","actionToken":""}`

Pacing is identical between the classes that fail and the class that doesn't —
1.13s after the previous response for `rock`, 1.22s for `reward_two`. So this
is not "too fast". The retry lands 1.53s after the rejection, i.e. 4.0s after
the token was issued — inside any plausible ~5s window. So it is not "the token
went stale" either. The only difference between the succeeding and failing
classes is which token the envelope carries.

Rejection rates by run log (path-selection decisions = tier_choice + boon_choice):

| run log | decisions | rejections |
|---|---|---|
| run-2026-08-18-19-50-13 | 12 | 0 |
| run-2026-08-18-21-15-24 | 10 | 0 |
| run-2026-08-18-22-00-26 | 10 | 0 |
| run-2026-08-18-22-07-12 | 8 | 0 |
| run-2026-08-20-00-30-48 (run 1) | 14 | **14** |
| run-2026-08-20-00-45-19 + -00-46-46 (run 2) | 12 | **12** |

## A2. The claim audit, both runs

Run 1 (`event: claim_audit`):
```json
{ "measuredDelta": 69, "snapshotTotal": 69, "drift": 0,
  "perRom": [ { "docId": "3777", "snapshot": 13, "postClaimCollectable": 0 },
              { "docId": "7959", "snapshot": 26, "postClaimCollectable": 0 },
              { "docId": "2114", "snapshot": 30, "postClaimCollectable": 0 } ] }
```

Run 2: one claim, `2097` snapshot 50, measured delta +50, drift 0, post-claim 0.

Session 20's observed +1 accrual drift (romId 689 crediting +12 against a
snapshot of 11) did **not** reproduce at either scale. Drift was exactly 0 on
all four claims.

The full ascending bank at run 1, for reference — this is the ordering the
`order` option controls:
```
3777:13  7959:26  2114:30  7210:50  2097:50  3754:57  5345:67  689:67
4586:75  2768:75  4720:78  4950:79  5996:79  8156:79  3196:79  2201:79
2671:79  6541:79  2493:84  2696:85  741:92   2894:104 7246:120 7033:185
6096:185 5446:185 4543:315
```
Descending would have claimed `4543` alone — one claim, 315 energy against a
53-energy deficit, and the account's largest single accrual pointed at a code
path that had never executed.

## A3. §1b — the overflow test was NOT performed

The brief made this discretionary and said to ask first. It was not needed for
either run (headroom was 413 and 398; nothing came near the 420 cap) and it is
the one action in the brief that can destroy value, so it was skipped rather
than run without an answer. The claim that overflow past 420 is non-wasting
still rests on two ~12-energy verification claims from sessions 21/22 and
remains untested at magnitude.

## A4. §4 — why the gate needed new machinery

`src/sim/fishing/offPolicyReplay.ts:407` under `matcherTier: "loo"` called
`promotedSupport(otherCasts)` — it re-mines the library from the held-out casts
on every fold. It has never read `data/minedFishPatterns.json`. So:

- The brief's ask ("pair the re-mined library against the current 2-pattern
  library on the same 88 traces") had no arm to pair against.
- More importantly: **every session-50 and session-51 replay figure involving
  the matcher describes a LOO-mined library, not the one `liveFishing.ts`
  loads.** That is a live-vs-replay divergence nobody had noticed, and it is
  independent of whether the file was stale.

`ReplayOptions.matcherLibrary` holds the patterns fixed (as live holds them
fixed between re-mines) and re-derives only the PRIOR per fold via
`supportingCastCount`, which already took an explicit library.
`scripts/minedLibraryGate.ts` pairs two libraries per turn with a cluster
bootstrap over casts.

## A5. §4 — the alias proof

```
12944936  start (3,1) grid 4   bounce(2,0): (3,1) (1,1) (3,1) (1,1)   bounce(-2,0): identical
12991310  start (3,2) grid 4   bounce(2,0): (3,2) (1,2) (3,2) (1,2)   bounce(-2,0): identical
12992271  start (2,4) grid 4   bounce(2,0): (2,4) (4,4) (2,4) (4,4)   bounce(-2,0): identical
```

Mining output at 89 casts:
```
perimeterWalk(cw)   support=4  casts=[12923267,12925773,12942030,12945319]
perimeterWalk(ccw)  support=4  casts=[12945306,12956727,12957096,12975736]
bounce(2,0)         support=3  casts=[12944936,12991310,12992271]
bounce(-2,0)        support=3  casts=[12944936,12991310,12992271]   <- same three
```
Union = 11 distinct casts of 89. `supportingCastCount` breaks on first match, so
the prior (0.133) is correct despite the aliasing; only the candidate-set mass
is affected.

Sim cross-check from `mineFishPatterns.ts` (500 synthetic casts):
matcher blind 34/500 = 6.8%; matcher with the 4-pattern library 148/500 = 29.6%.

## A6. Corpus growth, both runs

New in `OBSERVED_OFFERS` — 13 offers total, and the first room-7 offer this
corpus has ever held:

```
run 1 (died room 8):
  1: AddBlock(2) | AddMaxHealth(14) | AddTenacity(2)        <- Wall 1's fifth hole
  2: AddBurnMagic(5) | UpgradeScissor(0,4) | AddLuck(1)
  3: AddIntuition(1) | AddBurnShield(3) | VulnerableBlock(4)
  4: UpgradeRock(4) | AddBlock(2) | UpgradePaper(0,8)
  5: UpgradeRock(0,8) | BurningCrit(3) | AddBlock(2)
  6: AddBlock(2) | AddTenacity(2) | AddLuck(5)
  7: LossIntuitionUp(5) | AddLuck(1) | AddEvasion(1)        <- first-ever room 7
run 2 (died room 7):
  1: AddBurnSword(5) | UpgradeRock(8) | AddLuck(1)
  2: AddEvasion(1) | TieVulnerable(1) | UpgradeRock(4)
  3: UpgradeScissor(0,6) | UpgradePaper(4) | TieWeak(1)
  4: AddLuck(1) | UpgradeRock(4) | TieWeak(1)
  5: Thorns(5) | AddTenacity(2) | AddEvasion(1)
  6: WeakeningTenacity(4) | UpgradeRock(12) | AddMaxHealth(24)   <- largest roll yet
```

New unmodelled types (no before/after pair, failing closed per SPEC §4d):
`AddBurnMagic`, `VulnerableBlock`, `BurningCrit`, `LossIntuitionUp`, `Thorns`,
`WeakeningTenacity`.

New in `ROOM_ENEMIES` — room 8, Safe tier, first-ever:
```
Enemy Room 70: hp 52/52, armor 20/20,
  rock 22/4, paper 12/12, scissor 18/4, rolled all zero, enemyBuff null
```
Opening state only — the run entered room 8 at 11/54 HP and died on the first
exchange. No post-exchange sample and no Risky/Dangerous capture for room 8.

New loadout: `54/17` = the 40/17 starting loadout + run 1's room-1
`AddMaxHealth(14)`. Starting loadout itself unchanged at 40/17.

## A7. My error, in full

I invoked run 2 as `npx tsx scripts/liveRun.ts ... 2>&1 | head -30`. Once the
process wrote past `head`'s buffer, SIGPIPE killed it — mid-battle in room 2,
with the 60-energy `start_run` already committed and 3 heal juices loaded.

Recovery: the run was still active server-side. `--resume-existing --potions=3
--potions-used=0 --runs=1` picked it up and played it to death in room 7. All 3
juices were used by the resumed process, so nothing was lost but the
interruption. The guard ledger accounted correctly throughout (`energy spent
120, runs 6`), because the commit happened at `start_run`, not at completion.

Rule going forward: redirect a live run to a file and read the file. Never pipe
it to `head`, `grep -m`, or anything else that closes the pipe early.
