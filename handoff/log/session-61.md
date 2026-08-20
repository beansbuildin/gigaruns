# SESSION 61 — 2026-08-20 (PT) — commit 8329e0e

## Status
**BOTH GATE HALVES PASS.** Suite **1139/1139** at the final commit, `tsc
--noEmit` clean, `git diff --check` clean, secret scan clean across 3723 tracked
files, no test writes a real data path.

- **Gate 1 PASS** — a test in `tests/liveRun.test.ts` FAILS when the room-tier
  assertion is removed from `liveRun.ts`. Demonstrated failing (4 tests), then
  restored. Output in the commit message and the session log.
- **Gate 2 PASS** — `matcherVerdict` returns `INSUFFICIENT_DATA` on today's
  7-turn log, pinned on `n < MIN_INSTRUMENTED_TURNS`, never on the literal 7.

All brief items delivered: §1, §2 (one run), §3, §4a–§4e, §5, §6.

**Caps remaining: 6 dungeon run-units (2 juiced runs), 15 fishing casts.** Roll
at 11:00 PT. Zero casts were spent, per §4's hold.

**READ THIS FIRST — a tool-reporting failure, not a rule violation.** The
authorized juiced run was issued, the harness returned "Permission for this
action was denied by the Claude Code auto mode classifier", and I reported it
as blocked and moved on. **It had already run to completion.** Found ~25 minutes
later when new fixtures appeared in the boons tests. `dayProgressEntities` 3→6,
39 POSTs, run 24945829. Exactly one juiced run was authorized and exactly one
happened, so nothing was overspent — but **a denial message is not evidence
that nothing ran**, and the next session should verify against the ledger
before believing one.

## What works
- **§1's in-loop tier gate — LIVE on its first run, 4/4 correct.**
  `auditTierChoice` re-derives rule 8's answer from the RAW offer, independently
  of `pickTierForRoom` (a checker that calls the thing it checks can only agree
  with it), prints one greppable `TIER-CHECK` line per room, and HALTS on
  disagreement. It was wired before the run, so it got live exercise immediately.
- **§3's replacement rule.** N = **32 instrumented TURNS**, derived from the
  replay reference as a SENSITIVITY FLOOR at an explicitly stated p = 5%.
  Minimum-n gates the **DROP arm only** — absence needs power, existence does
  not. Session 51's DROP preserved verbatim in `SESSION_51_VERDICT` and
  asserted in the suite.
- **§4's oil groundwork, all of it.** Payloads re-verified; oil-era flag
  DERIVED from the server's own `consumablesUsed`; `dendren.oils` config with a
  structurally-enforced gate; CLAUDE.md Ask-first line; timing policy derived
  in sim; 60% dropped; tripwire now code.
- **`zeroStreak.ts`** — the 15-cast tripwire is CODE for the first time.
- Live mechanics: **0/39 first-attempt action failures**, 0 429s, 0 unknown
  enums, 0 guard trips, 0 tier-rule violations.

## What's broken
1. **`handoff/OIL-POLICY.md` is a recommendation AWAITING USER APPROVAL.**
   Nothing is consumed; `dendren.oils.policyApproved` ships **false**. Until the
   user approves, the oil work is inert by design.
2. **`liveFishing.ts` still plays session 43's heuristic (c), which the sweep
   shows is dominated** — same benefit as the lethal trigger for 44% more oil.
   Replacing it is a live-policy change and was deliberately NOT done.
3. **The sim cannot score the turn-cost branch.** Not a gap to close with more
   runs — turns are structurally not scarce in this cast model. Only a live oil
   cast can answer it, and the real question turns out to be MANA, not turns.
4. **§19 is written and waiting, not in progress.** 7 of 32 turns. Accrual is
   gated on the user's oil crafting, not on any agent's work.
5. **A new unexplained-until-now mechanic is now explained but unmodelled:**
   `onEnemyWinExchange_corrode` reduces `shield.currentMax` by 3 within a room.
   Captured, documented in `tests/enemies.test.ts`, **not** in the sim.
6. Carried: 25 analysis scripts hold hardcoded paths (ratcheted). The sim models
   a policy the bot does not play. Both deliberate.
7. The distribution repo still does not exist and must not be created by an
   agent. Steps 1–2 done in the tree; 3–6 are the user's.

## Corrections to SPEC.md
- **No live response contradicted SPEC this session.** Two corrections are to
  the BRIEF and one is to session 60's reading of its own data:
- **The brief's "the corpus contains zero oil casts" is FALSE.** Cast
  `12975152` (2026-08-19) carries `consumablesUsed: 1` and
  `fishingConsumableSlotUsed[0] === true` on its **first** captured state — a
  consumable spent at or before cast start by someone other than this bot. The
  item is unidentifiable (both oil-boost percents read 0, ruling out only
  Fintuition and Dual Yield). Found by the derived flag on its first run.
- **The brief's "§4a needs capturing" is FALSE — it was captured in session
  43.** Both payloads have been in `SPEC-fishing.md` §4a's addendum since
  2026-08-18, and `oilPolicy.ts` has held the ids since. The user's table is
  confirmed verbatim: 942 `FishingRestoreFocus` +2, 937 `FishingDamageFish` +2.
- **The brief's "`tier_choice` never reaches stdout" is HALF wrong.** The
  *event* is JSONL-only, but a readable decision line did print
  (`logs/run-60-1.log:33`). What was missing was the room index, the
  offered-tier list, and any assertion.
- **`dendrenRemnantEarned` is a DETERMINISTIC function of death depth**
  (12/12 juiced runs, four depths matched 2–3x each). So session 60's "the
  reading is only clean because depth *and* loot matched" overstates it —
  equal loot was implied by equal depth.
- **Session 60's +22% is NOT evidence.** The lowest-tier arm's own within-depth
  spread is 1.24x–4.51x. Session 61's second room-5 run scored 3840, putting
  the rule-8 mean at 4032 vs 3456 (+16.7%) — still inside the spread.
  Pre-registered NO READ, and it landed NO READ.
- **First live capture of `onEnemyWinExchange_corrode`** (`corrosiveSword`
  "Miasmablade", −3 max armor on Sword wins, `minTier: 2`). Structurally
  unreachable under the old lowest-tier rule.
- **`resolvePotionLoadout` was DELETED in session 54.** CLAUDE.md rule 11 and
  the brief both cite it as live code. The lesson survives; the referent does not.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Do not derive N parametrically from the replay reference.** Fitting its two
  quantiles gives logit-normal σ 0.228 → P(π>0.5) = 2.2e-16 and lognormal
  σ 0.196 → 1.1e-11 — ~8σ, so no achievable N could ever observe a crossing and
  the rule would be unfalsifiable. It extrapolates a far tail from two CENTRAL
  quantiles. Recorded in the file because it says the prior favours DROP being
  right; **not** used to set N.
- **Do not read the sim's `costsTurn=true` rows as a turn-cost model.** A
  consume turn plays no card, so it spends no mana, takes no miss, and gives
  the matcher a free observation — a benefit. `start` at `costsTurn=true`
  *raises* its catch rate 74% → 93%. An added cost that improves the outcome is
  an artifact; the rows are printed with a warning rather than deleted.
- **Do not write the oil flag from the live loop.** The server already puts
  `consumablesUsed` on every board state. A written flag would have started at
  zero and never found cast 12975152.
- **Do not gate an oils resolver on the config block alone.** `mayConsumeOil`
  takes every condition as a REQUIRED field so a caller cannot pass fewer, and
  a test reads the live call site to catch the reverse (hard-coding a value
  that typechecks). This is the structural fix for the bug the brief named.
- Standing: never report an energy number as a blocker (rule 12); exercise the
  real gate (`--dry-run`, free) before claiming a blocker; do not revert rule 8
  or the wide orb rule without a user directive; never pipe a live run to a
  truncating reader; do not put identifiers in a test that guards against them.
- **The recap checklist's `.gitignore` line is still stale.** It says to confirm
  `config/discovered.json` is ignored. It deliberately is NOT, per the
  2026-08-20 decision. Everything else on that list holds.

## Metrics
- **Live dungeon: 1 run** (24945829), juiced Tier-3, **died room 5**, score
  **3840**, loot **141**, 60 energy, 3 of 12 run-units. 3 potions used.
  **0/39 first-attempt failures.**
  - Tier: 4/4 taken == top non-Perpetual offered. Perpetual filtered the top
    choice **0 of 4** (session 60: 1 of 4); avoided at the same tier 1 of 4.
    No `final-room`, no `final-room-unreadable`.
  - Orb rule: run orb sum **80**. The load-bearing case fired **twice** — the
    orb rule declined to override a priority family, taking 20 over 22 and
    16 over 25.
  - **Room 5 now has 3 runs: lowest-tier 3456; rule 8 4224 and 3840.**
    Rule-8 mean 4032 = +16.7%. The two rule-8 runs differ from each other by
    10%. **NO READ**, pre-registered.
  - §2b: elapsed **2m20s**, `tightDelta` −60, `observedDelta` 60, **drift 0**.
    Regen hypothesis predicts `floor(2.33/3.33) = 0`. Confirmed, n=1.
- **Live fishing: 0 casts** (§4's hold). Corpus unchanged at 94, catches 14.
  Zero-streak **4** of 15 — now computed, not quoted.
- **§19: 7 of 32 instrumented turns.** π max 0.255, 0% above 0.5, π₀ 0.137.
- **Oil sweep**, n=8000/arm paired, `costsTurn=false`, amount 2: never 68.71%,
  **on-demand 88.11% (+19.40pp)**, focus-when-empty-only 86.45% (+17.74pp),
  start 74.38% (+5.66pp), heuristic-c 73.22% (+4.51pp), lethal-relaxing-only
  73.19% (+4.47pp). Winner unchanged at amounts 1 and 3.
- Suite 1072 → **1139** (+67).

## Open questions for Claude
1. **Approve, reject, or amend the oil policy in `handoff/OIL-POLICY.md`.**
   This is the top item and it blocks everything else in fishing. Approving
   means setting `policyApproved: true` AND replacing heuristic (c) in
   `liveFishing.ts` — the second half is a live-policy change and needs saying
   explicitly, not implying.
2. **Does `use_fishing_item` cost MANA?** The sweep reframed §4a's question:
   turns are not scarce in this fishery, mana is. This is now the single most
   valuable thing the first oil cast can measure, and it changes whether the
   Relaxing Oil is worth crafting more of.
3. **The denial-message failure (see Status).** Worth a line in the next brief
   telling the agent to check `checkDungeonToday.ts` after any live command
   that reports as blocked.
4. **Rule 8 needs a variance estimate before it needs more runs.** n=3 at room 5
   is not a step toward n mattering; the within-depth spread has to be estimated
   first. Consider whether that is worth 4 runs/day or whether rule 8 should
   simply stand on the user's directive without a measurement programme.
5. **Should `onEnemyWinExchange_corrode` be modelled in the sim?** It is now
   reachable on every run under rule 8, it is arithmetic (−3 max armor on a
   named move win), and unlike `rolledEnemyStats` it is not a proc chance.
6. **§5 has 2 data points and they point different ways.** Session 60's two new
   boon types came from the ORB rule; session 61's TieVulnerable came from the
   PRIORITY rule. Do not let either become a coverage argument yet.
7. `boonCapture` stays OFF — still zero ordinary runs since the directive.
8. `LICENSE` still reads `Copyright (c) 2026 Bean`. Unconfirmed since session 60.

## Files changed
```
 1 commit (8329e0e). 112 files, +51,352 / −68.
 83 are new redacted fixtures from run 24945829.

     src/strategy/fishing/matcherVerdict.ts  | 200  (§19's replacement rule)
     src/strategy/enemyTier.ts               | 150  (the in-loop tier gate)
     handoff/OIL-POLICY.md                   | 148  (new — awaiting approval)
     scripts/oilTimingSweep.ts               | 210  (new)
     src/strategy/fishing/oilTiming.ts       | 140  (new)
     src/strategy/fishing/oilPolicy.ts       | 145  (mayConsumeOil)
     tests/fishing/matcherVerdict.test.ts    | 130  (rewritten on the new rule)
     tests/liveRun.test.ts                   | 100  (the gate's test)
     tests/fishing/oilTiming.test.ts         | 130  (new)
     src/strategy/fishing/zeroStreak.ts      |  75  (new — tripwire as code)
     src/sim/boonRunCoverage.ts              |  80  (new — §5)
     src/sim/fishing/castSim.ts              |  90  (oils, opt-in and additive)
     src/sim/fishingCorpus.ts                |  75  (derived oil flag)
     src/sim/boons.ts                        |  60  (TieVulnerable + 4 offers)
     handoff/DECISIONS.md                    |  14  (13 entries)
     handoff/DISTRIBUTION.md                 |  45  (the romId decision)
     CLAUDE.md / config/bot.json             |  40  (oils permitted + budget)
```

---
---

# APPENDIX — verbose material

## A. Gate 1's demonstration, verbatim

With `assertTierChoiceOk(tierAudit);` removed from `scripts/liveRun.ts`:

```
##### WITH THE ASSERTION REMOVED FROM liveRun.ts #####
     × THROWS TierRuleViolationError when ROOM_NUM_CID is missing, because the flip is then silently inert
     × names the inert flip in the error, so the halt is diagnosable from the log alone
     × records the violation to the JSONL BEFORE throwing — the run exits non-zero but the log survives
     × LABELS an unreadable ROOM_NUM_CID and now HALTS on it, instead of quietly playing the run out
 Test Files  1 failed (1)
      Tests  4 failed | 101 passed (105)
```

Restored: `Tests 105 passed (105)`.

The error the gate raises:

```
TierRuleViolationError: Hard rule violated (CLAUDE.md rule 8) at room 0: room (0)
or maxRoom (16) is UNREADABLE, so rule 8's highest-tier clause is INERT and this
room silently took the conservative lowest-tier path. Room 16 has never been
reached (deepest ever: room 10), so this is ROOM_NUM_CID having moved, not a real
final room.
```

**Why that fault and not a tampered picker.** `pickTierForRoom` cannot be made
to return the wrong tier without reaching into it, and a test that reaches into
the thing it tests proves nothing. But rule 8 has a documented, already-observed
way of going inert with nobody touching the picker: session 56 found
`ROOM_NUM_CID` lives on `data.entity`, not `data.entity.data`, and
`liveRun.ts:1078` defaults an unreadable room to 0. The fixture is a real board
with the field where it isn't — no seams — and the loop picks tier 0 out of an
offer topping at 2.

**One pre-existing test changed contract** and was rewritten, not renumbered:
"falls back to no-modifiers, LABELLED, when ROOM_NUM_CID is unreadable" used to
end `await p` (fail-open). It now asserts the halt AND still asserts the label,
which was its original purpose.

## B. N's derivation, in full

Replay reference (session 50/51): median π 0.135, P(π ≤ 0.15) = 0.705.
z for the 0.705 quantile = 0.5388.

```
logit-normal     mu=-1.8575 sigma=0.2280  ->  P(pi>0.5) = 2.220e-16
lognormal        mu=-2.0025 sigma=0.1955  ->  P(pi>0.5) = 1.069e-11
```

N for a base rate p at 80% / 90% power, N = ln(1-power)/ln(1-p):

```
  p=0.150  N80=  10  N90=  15
  p=0.100  N80=  16  N90=  22
  p=0.075  N80=  21  N90=  30
  p=0.050  N80=  32  N90=  45
  p=0.030  N80=  53  N90=  76
  p=0.020  N80=  80  N90= 114
  p=0.010  N80= 161  N90= 230
```

What a given N rules out at 80% power:

```
  N= 25  detects p >= 0.0623      N= 32  detects p >= 0.0491
  N= 30  detects p >= 0.0522      N= 50  detects p >= 0.0317
```

**Chosen: N = 32 at p = 5%.** 5% is not invented for this rule — it is this
repo's own floor of measurability (SPEC §4e puts rolled-stat procs at 1–5% and
concludes they need hundreds of observations). The brief offered 25 as a sanity
check; 25 corresponds to p ≥ 6.2%, coarser than the repo's own floor, so 32
lands just the conservative side of it.

## C. The oil sweep, full output at n=8000/arm

```
── costsTurn=false   effect amount=2   n=8000/arm (the payload's own value) ──
  policy                    catch  Δ vs never             95% CI   oils  pp/oil  escMana  escMeter  stall
  never                    68.71%     +0.00pp [+0.00pp, +0.00pp]      0       —     2003       499      1
  start                    74.38%     +5.66pp [+5.66pp, +5.67pp]  16000   0.028     1739       310      1
  on-demand                88.11%    +19.40pp [+19.39pp, +19.41pp]   5578   0.278      568       382      1
  lethal-relaxing-only     73.19%     +4.47pp [+4.47pp, +4.48pp]   1821   0.197     1647       497      1
  focus-when-empty-only    86.45%    +17.74pp [+17.73pp, +17.75pp]   3515   0.404      701       382      1
  heuristic-c              73.22%     +4.51pp [+4.51pp, +4.52pp]   2630   0.137     1644       497      1

  costsTurn=false amount=2     -> on-demand (+19.40pp)
  costsTurn=false amount=1     -> on-demand (+13.89pp)
  costsTurn=false amount=3     -> on-demand (+21.99pp)
  costsTurn=true  amount=2     -> start (+23.88pp)   [ARTIFACT BRANCH]
  costsTurn=true  amount=1     -> start (+22.60pp)   [ARTIFACT BRANCH]
  costsTurn=true  amount=3     -> start (+24.99pp)   [ARTIFACT BRANCH]

  ROBUST WITHIN THE MODELLED BRANCH: on-demand wins at every effect amount.
```

The artifact diagnosis, from the sweep's own decomposition:

```
never              catch=68.33%  escMeter=259  escMana=1007  stalled=1  meanTurns=2.95
start/free         catch=74.15%  escMeter=165  escMana= 868  stalled=1  meanTurns=2.74
start/costsTurn    catch=93.00%  escMeter= 10  escMana= 270  stalled=0  meanTurns=2.97
```

`stalled` ≈ 0 proves `maxTurns` (40) never binds at mean 2.95 turns, so a turn
is not a scarce resource and a "turn cost" cannot register as one. The consume
turn plays no card → no mana spent, no miss taken, free matcher observation.

## D. The live run, room by room

Run **24945829**, juiced Tier-3, died room 5. `dayProgressEntities` 3 → 6.

```
  rule=highest offered=[1,2,0] taken=2 topOffered=2 perpCostATier=False perpAvoided=False audit=yes
  rule=highest offered=[1,2,2] taken=2 topOffered=2 perpCostATier=False perpAvoided=True  audit=yes
  rule=highest offered=[1,0,1] taken=1 topOffered=1 perpCostATier=False perpAvoided=False audit=yes
  rule=highest offered=[2,1,0] taken=2 topOffered=2 perpCostATier=False perpAvoided=False audit=yes
```

Buffs on the paths TAKEN — this is where the corrode finding comes from:

```
  tier 2  corrosiveSword  "Miasmablade"  "Reduces 3 max armor on Sword wins"
          effects [{kind: onEnemyWinExchange_corrode, amount: 3, moveType: rock}]  minTier 2
          rolled {evasion:2, block:1, lck:1, tenacity:2}
  tier 2  corrosiveSword  (same)         rolled {evasion:2, block:3, lck:2, tenacity:1}
  tier 1  hardy           "+3 max HP and +2 armor"  [{flatHP:3},{flatShield:2}]
  tier 2  corrosiveMagic  "Miasmagem"    "Reduces 3 max armor on Magic wins"  minTier 2
          rolled {evasion:1, block:5, lck:4, tenacity:1}
```

`shield.currentMax` trace across the run:

```
state-032: shield 9/17 -> 0/14   hp 39->38
state-036: shield 0/14 -> 0/11   hp 23->13
state-046: shield 0/11 -> 0/17   hp 28->28      <- restored at the room boundary
state-082: shield 0/17 -> 0/14   hp  4->0
```

Depletion alone does NOT cause it — the corpus has ~30 states sitting at 0/17
with no drop. It is the corrode buff firing on a Sword/Magic win, and it is a
WITHIN-ROOM shred that resets at the boundary.

Boon offers and choices, with orbs:

```
  UpgradePaper(20)      AddIntuition(19)      AddEvasion(21)   -> AddEvasion    orb rule, max
  AddLifestealShield(16) AddLuck(23)          WeakeningCrit(18)-> AddLuck       orb rule, max
  UpgradeRock(20)       WeakeningMastery(18)  AddBurnMagic(22) -> UpgradeRock   PRIORITY beat 22
  TieVulnerable(16)     AddIntuition(14)      UpgradePaper(25) -> TieVulnerable PRIORITY beat 25
```

Run orb sum 80. `boon_priority_conflict` logged once, room 3: `AddLifestealShield`
demoted by the early-game window (rooms 1..8).

Energy (§2b):

```
start_run_energy_probe  20:04:50.627  energyBefore 230  energyAfter 170  tightDelta -60  matchesCommitted true
energy_accounting       20:07:10.306  before 230  after 170  observedDelta 60  committedDelta 60  drifted false
elapsed 2m20s = 2.33 min   regen predicts floor(2.33/3.33) = 0   observed drift 0
```

## E. The TieVulnerable pair

`run-2026-08-20-20-04-37 state-063 → state-064`. Player diff is **empty** —
health, shield, all three moves and every rolled stat byte-identical. The only
change is the boon appearing in `pickedBoons`:

```json
{"BoonType":"TieVulnerable","Rarity":"Uncommon","val1Min":1,"val1Max":1,
 "TokenId":104,"UINT256_CID":39,"RARITY_CID":1,"selectedVal1":1,"selectedVal2":0,
 "MinRoom":1,"MaxRoom":17,"RestrictedToDungeons":["5"]}
```

Modelled `latent` with `contaminates: ["STATUS_EFFECT"]`. Per DECISIONS
2026-08-15 the effect is NOT inferred from the name — "Vulnerable applied on a
tie" is a plausible reading and it stays a reading.

**Credited to the boon-PRIORITY rule, not the orb rule.** Room 5 offered
TieVulnerable at 16 against UpgradePaper at 25; the orb rule would have taken
the 25. This matters because session 60's two new types DID come from the orb
rule, and it would be easy to write a tidy story in which the orb rule is
steadily clearing `UNMODELLED_TYPES`.

## F. Test-count reconciliation, 1072 → 1139

```
  +8   tests/enemyTier.test.ts        auditTierChoice, the pure half
  +4   tests/liveRun.test.ts          the gate, incl. 1 pre-existing rewritten
 +10   tests/fishing/matcherVerdict.test.ts   the session-61 rule
 +13   tests/fishing/oilPolicy.test.ts        mayConsumeOil + call-site pin
  +5   tests/fishing/oilPolicy.test.ts        zeroStreak
 +17   tests/fishing/oilTiming.test.ts        new file
  +3   tests/sim/fishingCorpus.test.ts        the derived oil flag
  +5   tests/boons.test.ts                    summarizeBoonRunCoverage
  +2   tests/boons.test.ts                    TieVulnerable recounts (net)
 ────
  +67
```

## G. What was NOT done, and why

- **Heuristic (c) was not replaced in `liveFishing.ts`.** The sweep dominates
  it, but swapping a live trigger is a policy change and §4d says the user
  approves the policy first.
- **`onEnemyWinExchange_corrode` was not modelled in the sim.** Captured and
  documented only. It is now reachable on every run under rule 8 and it is
  plain arithmetic, so it is a strong candidate — but modelling it was not in
  the brief and it would change sim numbers mid-session.
- **No replacement fishing target was derived.** §4e reserves that for the
  user, after oil casts exist.
- **No fishing casts, and 6 run-units left unspent.** §8's instruction.
- **The distribution repo was not created.** Steps 3–6 are the user's.
