# session 114 — 2026-08-31 — Tier-2 faction rotation measured on a second day; 4 runs, 24 casts

Full STATE.md for this session is reproduced below, followed by the
verbose material that does not fit there: the per-run and per-batch
detail, the surprise log, and the test re-baseline account.

---

# STATE — session 114 — 2026-08-31 — commit <SHA>

## Status
Brief was three steps: confirm the day rolled, spend ONE juiced Tier-2 run to get
a second point on the day→faction map, then stop. **Steps 0 and 1: GATE PASS.**
The user then authorized three more runs and 24 fishing casts in chat.

- **Step 0, day rollover: GATE PASS.** `currentDay` 20695 → **20696**,
  `dayOfWeek` 3 → 4, run-unit cap reset to 0/12.
- **Step 1, the rotation measurement: GATE PASS.** Day 20696 charged
  **Summoner (140)**, not Foxglove. The faction DOES rotate — measured, not
  assumed.
- **Steps 2–3 (authorized in chat): 3 more runs + 24 fishing casts.** Both
  daily caps now exhausted.

**Live spend: 4 dungeon runs (12/12 run-units), 12 Summoner Silver, 240 energy;
24 fishing casts played / 20 charged, 288 energy, 6 Mid Relaxing Oils.**

Suite **2297 passed / 2297, 115 files** (2262 → 2297). `tsc --noEmit` clean,
`git diff --check` clean, `.gitignore` verified on all seven required paths,
`config/discovered.json` still tracked.

⚠ **Re-run the suite UNSANDBOXED** — sandbox breaks `tsx` (EPERM on its IPC
socket) and `git` (`.gitconfig`). Use `--maxWorkers=4`.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        10523
  CONTROL A (read):     10160 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS — no unexplained hits, both controls healthy.
```

At `--scope=diff --ref=501fadd1`: **745 files, 0 unexplained**, control A 737.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session:** the "rotation order is unmeasurable from here" entry
(superseded — it is now n=2, see below); "today's faction is not knowable in
advance" (folded into `checkEntryTiers.ts`'s own printed warning, which
enforces itself); the `nextPosition`/fishing-guard entries (already enforced by
tests). The Tier-2 ring-cost entry is KEPT because a brief could still restate
the retired model.

- **[USER] Tier 2 costs 3 rings of ONE faction per juiced run, rotating daily.**
  Now **8 for 8 across TWO faction days**. DECISIONS 2026-08-30/31. Re-opens as:
  *"Tier 2 costs one of each of the seven silver rings"* or *"the charged
  faction is fixed"* — the latter is now disproven day-to-day and CONFIRMED
  within a day.
- ⚠ **The rotation ORDER is n=2 and NOT solved.** 20695→Foxglove(5),
  20696→Summoner(6). Candidate `faction = ((dayOfWeek + 1) mod 7) + 1` fits both
  but they are ADJACENT days — 120 permutations fit equally. Re-opens as: *"the
  day→faction map is solved"*. **Day 20697 predicts Chobo (134); a
  NON-adjacent point is worth more than another adjacent one.**
- **TODAY'S FACTION IS NOT KNOWABLE IN ADVANCE — search COMPLETE.** Do not
  re-hunt. Learn it from a balance diff.
- **[USER] The double-lethal oil override is DISABLED; Focus Oil off the
  allowlist.** Four consecutive batches now: 0 override firings, 0 sirens.
  Re-opens as: *"turn the double-lethal band back on"*.
- **[USER] Oil target framing: 60-70% catch rate, oils not wasted.** ⚠ Re-opens
  as: *"the disable cost us catch rate"* — **63.6 / 60.0 / 58.3% across three
  batches are NOT distinguishable**; today's CI is [39%, 76%].
- **A new boon type from n=1 needs a USER DIRECTIVE.** Precedent used four
  times. `CritHeal` (§66) and `BurningTenacity` (§69) are held. Re-opens as:
  *"model the remaining latent boons"*.
- **TASKS §13 is parked on DATA, not code.** First candidate built, NOT wired.
- **[USER] Chaining is a ONE-TIME, DATED exception.** Rule 11 pins `--runs=1`.
  Approval for one run is never approval for the next.
- **`triggeredBoons`.** CLOSED — 0 non-empty of 10,616. No runs may be spent.
- **`tenacity` / `intuition` as damage mitigation RULED OUT.** §58, §62, §63.
- **[USER] Unspent skill XP.** CLOSED, §61.1 forbids re-raising it.
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **The faction rotation, MEASURED on two days.** Summoner 54→51→48→45→42 across
  four runs, every other faction 0 at every step. `currentDayOfWeek ===
  currentDay mod 7` confirmed on both days.
- **Four Tier-2 runs, rooms 6/7/10/14, 281 actions, 0 first-attempt failures
  (0/281).** Rule 8 **33 of 33**; its Perpetual clause fired **9/33 = 27%**
  against CLAUDE.md's stated 35% — first live check of that figure.
- ⭐ **Room 14 is the deepest run in corpus history** (101 attempts checked).
  Rule 8's final-room clause has still never fired live.
- ⭐ **A FIVE-run same-arm set** — s113 run 3 + today's four, all
  `rock 26/9 paper 11/16 scissor 12/8 hpMax 50`, depths 9/6/7/10/14.
- **`Intimidating` heals**, found by SecondWind's pinned rule breaking as
  designed. Miss census exactly `{Regen: 4, Intimidating: 12}`; excluding both,
  SecondWind is **19/19 spent and 44/44 held** — larger than s113's clean set.
- **`BurnMastery` x2 survived a doubling of its evidence** (4 pairs, all x2).
- **`LossBlockUp`'s n=1 directive held out of sample** at n=2.
- **The fishing ledger guard's DISAGREE branch, first live exercise** — game 10
  vs repo 11, deferred to the game, named JEBAITOR.
- **Rod durability: 1 per cast PLAYED**, measured over 40 casts.

## What's broken
- ⚠ **The rotation ORDER is a 2-point fit on ADJACENT days.** Not a map.
- ⚠ **`Intimidating` cannot separate "heals its amount" from "heals a flat 2"**
  — all 12 observations are at amount 2. Same trap `BurnMastery` sat in.
  Its TRIGGER is also unseparated (all 12 are consecutive in one fight).
- ⚠ **`chooseNewCard`'s CURRENCY flaw is unfixed** — a one-zone crit scored
  against a five-zone hit. Carried, unactioned, **fifth session**.
- ⚠ **`LIVE.drift` has moved monotonically more negative across seven pins.**
  Explained (player ATK rising), band widened to the order of magnitude. **If
  the sign flips or it reaches -1, re-derive — do not widen again.**
- ⚠ **`redrawCounterfactual`'s K=6 arm is no longer frozen**; only
  `sacrifices: 0` is durable. K=10 still carries the thesis.
- ⚠ **A cosmetic label nit in `liveFishing.ts`**, deliberately NOT fixed: the
  rod-durability line pairs a play-driven delta with a charge-driven count.
- **The JWT expires and blocks the whole session.** Valid to 2026-09-04T18:48Z.

## Corrections to SPEC.md
- **`SPEC.md` was not touched, and neither was CLAUDE.md rule 11** — this
  session CONFIRMED rule 11's third-version cost paragraph rather than
  revising it. First session since 111 that rule 11 did not need editing.
- **`/gear/instances` represents a rod REPLACEMENT as a mutation of the
  existing instance** — same `docId` and `_id`, `createdAt` six days stale,
  durability 0 → 60. Not previously modelled anywhere.
- **Max durability on rod item 812 is ≥ 60**, so s113's opening 33 was a
  partly-drained rod.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Do not treat the day→faction formula as solved.** Two adjacent points.
- **Do not re-hunt the advance faction-indicator field.** Search complete.
- **Do not look for the ring debit on the wire.** Read balances before/after.
- **Do not "fix" `readRodDurability`'s same-item-id instance blindness** — no
  observation motivates it; the identity check did NOT fail this session.
- **Do not infer `BurningTenacity` from its name** — it gestures at `Burn`
  (a STATUS, not this) and `tenacity` (ruled out as mitigation).
- **Do not widen a SecondWind/scaleRule exclusion ad hoc.** The exclusion is a
  two-member CENSUS asserted by composition; that is how `Intimidating` surfaced.
- **Do not pin an "EVER" claim on a bounded slice.** It answers "recently", and
  the two diverge silently — `procEvidence` lost a pinned fact this way.
- **Do not run the suite sandboxed** — `tsx` and `git` both fail under it.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Live dungeon: 4 runs, rooms 6/7/10/14, 281 actions, 0 first-attempt
  failures.** 12/12 run-units, 240 energy, **12 Summoner Silver** (54→42).
  Hard Core **+18,144**, Dendren Root **+2,574**. All four ONE ARM.
- **Live fishing: 24 played / 20 charged**, 288 energy, catch **14/24 = 58.3%**
  (Wilson 95% CI ≈ [39%, 76%]). **6 oils, all approved-policy, 0 override.**
  Hard Core **+3,120**. JEBAITOR gap **4/24 = 16.7%**. Rod 13→0→[replaced 60]→49.
- Suite **2262 → 2297 (+35)**, files 115. ~110 census assertions re-baselined
  across 13 files; era control (`preOil`/`oilSupplied`) BYTE-IDENTICAL, 11th batch.
- Secret scan: **10,523 files (tracked), 0 unexplained, 14 allowlisted**;
  745 files (diff scope), 0 unexplained.
- Silver rings 288 → 276. Corpus: 101 dungeon attempts, 339 fishing casts.
- Offer table +33 rows; room-max 12 → 13. `Enemy Room 76` added at room 14.

## Open questions for Claude
1. **The rotation map needs a THIRD point, ideally NON-adjacent.** Day 20697
   predicts **Chobo (134)** — free on any authorized run that day. A day skipped
   and resumed later is worth more than another consecutive one.
2. **`Intimidating` (§68): model it as a per-exchange heal, or hold?** The
   evidence is 12/12 — far stronger than the usual n=1 boon case — but a single
   observation at a different amount separates the two readings. Default: hold.
3. **`BurningTenacity` (§69) and `CritHeal` (§66) both await directives.**
   `LossBlockUp` holding at n=2 is evidence the `latent` default is usually
   right; it is NOT licence to apply it unasked.
4. **Is the Tier-1/Tier-3 arm a baseline for anything downstream?** **TENTH
   session — but materially changed.** There is now a five-run same-arm Tier-2
   anchor, so a single Tier-1 or Tier-3 run on THIS loadout would give the first
   clean cross-tier read. This is now a cheap, well-defined experiment.
5. **`chooseNewCard`'s currency flaw** — fifth session unactioned. Wrong
   regardless of deck composition; needs a directive to fix independently of §13.
6. **`BurnMastery` floor-vs-round** still needs an ODD plain amount. Named by
   session 113 as the next informative capture; four pairs later, still absent.

## Files changed
```
 QUESTIONS.md                          | 100 +   (§68 Intimidating, §69 BurningTenacity)
 handoff/DECISIONS.md                  |  20 +
 handoff/STATE.md                      | rewritten
 handoff/scratch-session-114.md        | 260 +
 src/sim/boons.ts                      | 250 +   (+33 offer rows)
 src/sim/enemies.ts                    |  36 +   (Enemy Room 76, room 14)
 tests/  (13 files)                    | ~400 +- (~110 census re-baselines + 3 correctness fixes)
 fixtures/  4 dungeon runs + 24 fishing casts
```

---

# Verbose appendix — scratch notes taken during the session

# scratch — session 114

## Step 0 (2026-08-31, live)
- game day **20696** (was 20695), week 86, dayOfWeek **4** (was 3), next day in 23:46:29.
- `dayProgressEntities` = null/[] -> 0 of 12 run-units used. Cap RESET with the day.
- JWT valid to 2026-09-04T18:48Z.

### PRE-RUN silver ring balances (checkEntryTiers.ts, live)
| faction | id | balance | s113 close |
|---|---|---|---|
| 7 Chobo    | 134 | 39 | 39 |
| 1 Crusader | 135 | 39 | 39 |
| 2 Overseer | 136 | **48** | 45 |
| 3 Athena   | 137 | **33** | 30 |
| 4 Archon   | 138 | 30 | 30 |
| 5 Foxglove | 139 | 45 | 45 |
| 6 Summoner | 140 | 54 | 54 |
total 288 (s113 closed 282)

⚠ SURPRISE: +6 out-of-band since session 113 — Overseer +3 and Athena +3.
Rings only ever DECREASE from bot activity, so this is user/game activity
between sessions. Consequence: read the post-run diff as "which faction went
DOWN by exactly 3", not "which faction moved".

### Gold rings (tier 3, not being spent — recorded for completeness)
243 Chobo 37 · 244 Crusader 21 · 245 Overseer 19 · 246 Athena 28 ·
247 Archon 29 · 248 Foxglove 26 · 249 Summoner 43

## Surprises log
- Sandbox blocks tsx IPC (`EPERM listen /tmp/claude-501/tsx-501/*.pipe`) and
  git (`.gitconfig` EPERM). Both need dangerouslyDisableSandbox. Known, memory.

## Step 1 — THE MEASUREMENT (run 2026-08-31-18-16-05)

`start_run` body verbatim:
```json
{"action":"start_run","dungeonId":5,"actionToken":"","data":{"consumables":[131,131,131],"isJuiced":true,"index":2,"itemId":0,"expectedAmount":0,"gearInstanceIds":[],"devBoons":[]}}
```
Tier 2 by `index`, juiced, 3x Big Heal Juice. Rule 11 satisfied.

### POST-RUN balances — exactly ONE faction moved, by exactly -3
| faction | id | pre | post | delta |
|---|---|---|---|---|
| 7 Chobo    | 134 | 39 | 39 | 0 |
| 1 Crusader | 135 | 39 | 39 | 0 |
| 2 Overseer | 136 | 48 | 48 | 0 |
| 3 Athena   | 137 | 33 | 33 | 0 |
| 4 Archon   | 138 | 30 | 30 | 0 |
| 5 Foxglove | 139 | 45 | 45 | 0 |
| 6 Summoner | 140 | 54 | **51** | **-3** |

**The session-113 model HOLDS on a second faction day**: one faction, three of it.
Now 5 for 5 across two days.

### ⭐ THE SECOND POINT ON THE DAY->FACTION MAP
```
day 20695  dayOfWeek 3  ->  faction 5  Foxglove (139)   [sessions 112/113, n=4]
day 20696  dayOfWeek 4  ->  faction 6  Summoner (140)   [this run,        n=1]
```
- **The faction DID change with the day.** That is now MEASURED, not the user's
  model taken on trust. Session 113 could not say this.
- `currentDayOfWeek` == `currentDay mod 7`: 20695 mod 7 = 3, 20696 mod 7 = 4.
  (7*2956 = 20692.) So the map can be stated on either.
- **The step observed is +1 faction per +1 day.** Candidate closed form:
  `faction = ((dayOfWeek + 1) mod 7) + 1`
  which fits BOTH points and nothing else has been observed.

### ⚠ WHAT THIS DOES **NOT** ESTABLISH
- The two days are **ADJACENT**, so this pins ONE transition, not the cycle.
  5 of 7 faction-days remain unobserved. Any permutation that happens to place
  faction 5 immediately before faction 6 fits the data equally well — there are
  5! = 120 such permutations. The sequential reading is the natural one, not
  the determined one. **Do not report the map as solved.**
- The PERIOD is unconfirmed. Nothing yet excludes a cycle longer than 7 days,
  or a faction repeating.
- The uniform-7-day runway model (~56 runs) gains support but is still the
  user's model, not a measurement.

### ⭐ THE FALSIFIABLE PREDICTION — cheapest possible next test
Under `faction = ((dayOfWeek + 1) mod 7) + 1`, the next six days are:
```
day 20697  dow 5  -> faction 7  Chobo    (134)   <-- TOMORROW, the live test
day 20698  dow 6  -> faction 1  Crusader (135)
day 20699  dow 0  -> faction 2  Overseer (136)
day 20700  dow 1  -> faction 3  Athena   (137)
day 20701  dow 2  -> faction 4  Archon   (138)
day 20702  dow 3  -> faction 5  Foxglove (139)
```
**Any run on day 20697 that debits Chobo (134) confirms; anything else falsifies.**
A third point that is NOT adjacent would be worth more than a third adjacent one.

## Run outcome
- Died **room 6** of 16. 46 actions, **0 first-attempt failures** (0/46).
- Hard Core (845) **+2952**; Dendren Root (846) **+216**.
- `dayProgressEntities` 0 -> **3** of 12 (juiced entry = 3 run-units, re-confirmed).
- Energy 93 -> 34: observed delta 59 vs committed 60. Script flags it; in-run
  passive regen (18/hr) is the standing explanation. Not asserted.
- Rule 8: **5 of 5 tier decisions compliant.**
  | room | offered | taken | note |
  |---|---|---|---|
  | 2 | [0,2,2] | 2 | highest |
  | 3 | [1,0,2] | 2 | highest |
  | 4 | [2,0,1] | 2 | highest |
  | 5 | [2,1,0] | 1 | **`perpetualFilteredTop: true`** — the tier-2 option was a Perpetual, correctly filtered; took highest non-Perpetual |
  | 6 | [2,1,2] | 2 | highest |
  Room 5 is the first time this session's log shows the Perpetual clause of
  rule 8 actually FIRING rather than being inert.
- Boons: 5 types picked, 0 first-ever candidates, 2 unmodelled types offered,
  UNMODELLED_TYPES still 13.
- EV support 0/39 fully modelled (100% unsupported) — EXPECTED under rule 8,
  per CLAUDE.md's accepted cost. Not a regression.

## Step 2 — run 2 (run-2026-08-31-18-38-03), authorized in chat
`"isJuiced":true,"index":2` confirmed on the wire.

### Balances — prediction CONFIRMED
Summoner (140) **51 -> 48, -3**; all six others flat
(Archon 30, Athena 33, Chobo 39, Crusader 39, Foxglove 45, Overseer 48).

**The charged faction is FIXED WITHIN the calendar day** — now n=2 on day 20696,
same faction both times. This was the thing the brief said would be a bigger
finding than the rotation if it broke. It did not break.

Ring model overall: **6 for 6** (4 on day 20695 + 2 on day 20696).

### Outcome
- Died **room 7** of 16. 47 actions, **0 first-attempt failures** (0/47).
- Hard Core (845) **+3096**; Dendren Root (846) **+309**.
- `dayProgressEntities` 3 -> **6** of 12.
- Energy 394 -> 335 (observed 59 vs committed 60 — same standing regen note).
  Pool was 394 because the preflight claimed 1 ROM (354) to cover a 21 deficit.
- Boons: 6 types picked, 0 first-ever, 1 unmodelled offered, UNMODELLED_TYPES 13.
- EV support 0/38 — expected under rule 8.

### Rule 8: 6 of 6 compliant
| room | offered | taken | perpetualFilteredTop |
|---|---|---|---|
| 2 | [1,2,0] | 2 | false |
| 3 | [0,2,1] | 1 | **true** |
| 4 | [2,0,2] | 2 | false |
| 5 | [0,1,2] | 1 | **true** |
| 6 | [0,1,2] | 1 | **true** |
| 7 | [1,0,2] | 2 | false |

⭐ **The Perpetual clause fired 4 times in 11 offers today (36%)** — run 1 room 5,
run 2 rooms 3/5/6. CLAUDE.md rule 8 predicted "fires on **35%** of offers under
this rule"; 4/11 is dead on it. That figure was a corpus estimate at the time it
was written and had not been checked against a live day. It holds.

## Running totals, session 114
- 2 runs, rooms 6 and 7. 93 actions, **0 first-attempt failures**.
- Hard Core **+6048**, Dendren Root **+525**.
- 6 of 12 run-units. 6 Summoner Silver spent (54 -> 48). 120 energy.

## Step 2 — run 3 (run-2026-08-31-18-44-19), authorized in chat
`"isJuiced":true,"index":2` confirmed on the wire.

### Balances — prediction CONFIRMED again
Summoner (140) **48 -> 45, -3**; all six others flat
(Archon 30, Athena 33, Chobo 39, Crusader 39, Foxglove 45, Overseer 48).

**Ring model now 7 for 7** (4 on day 20695 + 3 on day 20696).
Within-day fixity now n=3 on day 20696. Summoner 54 -> 45 across the day.

### Outcome — DEEPEST run of the session
- Reached **room 10** of 16 (deepest room in the log = 10; tier choices run 2..10).
- **74 actions, 0 first-attempt failures** (0/74).
- Hard Core (845) **+4944**; Dendren Root (846) **+687**.
- `dayProgressEntities` 6 -> **9** of 12.
- Energy 336 -> 277 (observed 59 vs committed 60 — same standing regen note,
  now 3 for 3 this session at exactly 59).
- EV support 0/59 — expected under rule 8.

### Rule 8: 9 of 9 compliant
| room | offered | taken | perpetualFilteredTop |
|---|---|---|---|
| 2 | [0,2,1] | 1 | **true** |
| 3 | [1,0,1] | 1 | false |
| 4 | [2,2,2] | 2 | false |
| 5 | [0,1,2] | 2 | false |
| 6 | [1,0,1] | 1 | false |
| 7 | [1,2,1] | 2 | false |
| 8 | [1,1,2] | 1 | **true** |
| 9 | [1,0,1] | 1 | false |
| 10| [2,1,1] | 2 | false |

Room 4 offered **[2,2,2]** — an all-tier-2 offer, and NOT all-Perpetual
(perpetualFilteredTop false), so CLAUDE.md rule 8's fail-closed case
("fail closed if one ever is" entirely Perpetual) still has not been triggered.

## Running totals, session 114 (3 runs)
- Rooms **6 / 7 / 10**. **167 actions, 0 first-attempt failures.**
- Hard Core **+10,992**; Dendren Root **+1,212**.
- 9 of 12 run-units. **9 Summoner Silver** (54 -> 45). 180 energy.
- Rule 8: **20 of 20 tier decisions compliant.** Perpetual clause fired
  **6 of 20 = 30%**, against rule 8's stated 35%. Consistent.
- ⚠ Unlike session 113, NO gear/level change has been detected mid-session --
  worth re-checking `state-000` across the three runs at recap time before
  pooling them.

### ⭐ SAME-ARM CHECK — passed, unlike session 113
`state-000` player statline across all three runs, read off the fixtures:
```
run-2026-08-31-18-16-05  rock 26/9  paper 11/16  scissor 12/8  hpMax 50
run-2026-08-31-18-38-03  rock 26/9  paper 11/16  scissor 12/8  hpMax 50
run-2026-08-31-18-44-19  rock 26/9  paper 11/16  scissor 12/8  hpMax 50
```
BYTE-IDENTICAL. **No gear/level change landed mid-session**, so session 114's
three runs ARE one arm and may be pooled. They also match session 113's RUN 3
(`rock 26/9, paper 11/16`), which means:

**There is now a 4-run same-arm set**: s113 run 3 (room 9) + s114 runs 1/2/3
(rooms 6, 7, 10). Depths 9, 6, 7, 10 -- mean 8.0. This is the first time this
repo has had more than one run on a single known-constant loadout, and it is a
direct partial answer to STATE.md open question 3 (the tier-comparability
problem, unactioned for nine sessions): the blocker there was never only tier,
it was that no two runs shared an arm. Now four do.
⚠ Still NOT a Tier-1/Tier-3 comparison -- all four are Tier 2. It makes the
Tier-2 baseline solid; it does not create the cross-tier baseline.

## Step 2 — run 4 (run-2026-08-31-19-12-22), authorized in chat. CAP NOW FULL.
`"isJuiced":true,"index":2` confirmed on the wire.

### Balances — prediction CONFIRMED a fourth time
Summoner (140) **45 -> 42, -3**; all six others flat.
**Ring model 8 for 8.** Within-day fixity n=4 on day 20696 (Summoner 54 -> 42).

### ⭐⭐ DEEPEST RUN IN THE CORPUS'S HISTORY — room 14 of 16
Checked against every run fixture (101 attempts), not assumed:
```
room 14  run-2026-08-31-19-12-22   <-- THIS RUN
room 13  run-2026-08-30-18-30-25   (session 112, previous record)
room 11  run-2026-08-29-20-04-50
room 10  x5 (incl. this session's run 3)
```
Two rooms short of `maxRoom` 16. **Rule 8's final-room clause has still never
fired live** — it keys on room 16 and nothing has reached it.

### Outcome
- **114 actions, 0 first-attempt failures** (0/114).
- Hard Core (845) **+7152**; Dendren Root (846) **+1362** -- both the largest
  single-run figures of the session by a wide margin.
- `dayProgressEntities` 9 -> **12 of 12. TODAY'S CAP IS FULL.** No further
  dungeon runs are possible until 11:00 Pacific.
- Energy 284 -> 226 (observed 58 vs committed 60 -- first time the drift was 2
  rather than 1 this session; a longer run means more in-run passive regen,
  which is the direction the standing explanation predicts. Not asserted.)
- Statline `rock 26/9 paper 11/16 scissor 12/8 hpMax 50` -- **same arm as runs
  1-3.** The four-run same-arm set is now a FIVE-run set with s113 run 3.

### Rule 8: 13 of 13 compliant
| room | offered | taken | perpFiltered |   | room | offered | taken | perpFiltered |
|---|---|---|---|---|---|---|---|---|
| 2 | [1,2,1] | 2 | false |   | 9  | [2,2,0] | 2 | false |
| 3 | [0,1,2] | 1 | **true** |   | 10 | [0,1,2] | 2 | false |
| 4 | [2,2,1] | 2 | false |   | 11 | [1,0,1] | 1 | false |
| 5 | [1,0,2] | 1 | **true** |   | 12 | [0,1,2] | 1 | **true** |
| 6 | [1,0,1] | 1 | false |   | 13 | [0,1,1] | 1 | false |
| 7 | [1,1,2] | 2 | false |   | 14 | [2,0,1] | 2 | false |
| 8 | [2,0,1] | 2 | false |   |    |         |   |       |

## FINAL TOTALS, session 114 (4 runs, cap exhausted)
- Rooms **6 / 7 / 10 / 14**. **281 actions, 0 first-attempt failures (0/281).**
- Hard Core **+18,144**; Dendren Root **+2,574**.
- **12 of 12 run-units.** **12 Summoner Silver** (54 -> 42). 240 energy.
- Rule 8: **33 of 33 tier decisions compliant.** Perpetual clause fired
  **9 of 33 = 27%** against rule 8's stated 35%.
- **All four runs one arm** (statline byte-identical), pooling with s113 run 3
  for a FIVE-run same-arm set at depths 9, 6, 7, 10, 14 (mean 9.2).

## Step 3 — fishing, 5 casts (user asked live; pause for approval after 5)

Config verified BEFORE spending: `allowedItemIds [937]` (Focus 942 still
withdrawn), `policyApproved: true`, `perItemMaxPerCast {937: 2}`, and **no
`doubleLethalOverride` key -> override DISABLED**, exactly as session 113 left it.

### Outcome
- **5 casts PLAYED, 4 CHARGED.** Catch **3/5 = 60.0%** (outcomes in the log:
  3 `caught`, 2 `escaped`).
- **1 oil**, itemId 937, from the **APPROVED on-demand policy**:
  `★ necessity-gated LETHAL trigger: fish at 1/16 HP`. **0 from the override**
  (disabled). Relaxing stock 60 -> 59.
- Hard Core (845) **+400**. Also 935 x4, and one each of 515 / 516 / 519.
- Energy 60 (5 x 12). Rod durability **13 -> 8**.
- `oil_trigger_policy_withdrawn` x11 — Focus triggers correctly dropped before
  the spend loop (the session-93 fix), so those casts are NOT flagged
  OIL-POLICY-DRY and stay in both outcome arms. Working as designed.
- `nextPosition` override validated HIT again (was 34/34 before this batch).

### Ledger reconciliation — AGREE
```
GAME ledger  (dayDocs pond 2):  4 / 20
REPO ledger  (guard-budget-fishing.json): 4 casts, 60 energy
ledgers agree at 4 cast(s) spent today.   VERDICT: 16 available
```
**JEBAITOR gap this batch: 1 of 5 = 20%**, against the ~9% standing estimate
and session 113's 5%. n=5, so this is noise around a small number, not a shift.

### ⚠ MINOR INSTRUMENT NIT (new, cosmetic, worth one line in a recap)
The closing console line reads:
```
▸ rod durability after: 8 (before: 13, casts this batch: 4)
```
The durability delta is **5** (one per cast PLAYED) while the count printed
beside it is **4** (casts CHARGED). Both numbers are individually correct — the
repo ledger is *supposed* to mirror the game's charged count, which is the
session-113 fix working — but pairing a play-driven delta with a charge-driven
count in one parenthesis invites exactly the "did a cast go missing?" read. Same
shape in `▸ done. energy spent 60, casts 4`: 60 energy is 5 plays, 4 is charges.
Session 113 had the identical pattern (20 played / 19 charged / 240 energy) and
it was reported correctly there, so this is a LABELLING issue only. **Not a bug;
do not "fix" the counter.** If anything is changed it should be the label.

### Oil spend rate across three batches (do NOT read as a trend)
```
session 110  14 oils / 22 casts = 0.64/cast   override ARMED
session 113   2 oils / 20 casts = 0.10/cast   override DISABLED
session 114   1 oil  /  5 casts = 0.20/cast   override DISABLED
```
Catch rate: 63.6% (14/22) -> 60.0% (12/20) -> 60.0% (3/5).
⚠ **n=5 here. A 5-cast batch cannot separate anything from anything** — its
Wilson 95% CI is roughly [23%, 88%]. This is a third data point only in the
weakest sense; it is consistent with the other two and that is all that may be
said. STATE.md's "a third batch is the first point that could separate them"
anticipated a batch of ~20, not 5.

## Step 3 (cont) — fishing batch 2, 8 casts. ROD NOW DRY.

### Outcome
- **8 casts PLAYED. Catch 4/8 = 50.0%** (4 `caught`, 4 `escaped`).
- **2 oils**, both itemId 937, both from the **APPROVED on-demand policy**
  (`★ necessity-gated LETHAL trigger` at fish 2/23 HP and one earlier).
  **`oil_double_lethal_fired` count: 0** — and that grep also covers
  `oil_double_lethal_fired_while_disarmed`, so neither the band nor its
  anomaly siren fired. Third consecutive live confirmation of the disable.
- Hard Core (845) **+1120**; also 935 x19 and one each of 514/515/517/525.
- `oil_trigger_policy_withdrawn` x8 — Focus still correctly dropped pre-loop.
- Rod durability **8 -> 0.**

### ⚠ THE ROD IS DRY — fishing is now BLOCKED until it is repaired/replaced
`readRodDurability` returns `status: "halt"`, `stop: true` at 0, and the
preflight throws `GuardTrip("rod durability preflight HALT: ...")` BEFORE any
cast is posted. So the next `liveFishing.ts` invocation — including a
`--dry-run` — will refuse to start. This is the guard working as designed
(session 100 §A / QUESTIONS §52), not a fault. A dry rod also makes the server
deal `BASE_DECK` instead of the rod's grant, which is the exact state sessions
89-91 reverse-engineered from the decks they were dealt.
**This was flagged to the user BEFORE the batch was run**, and the batch was
authorized with that consequence stated.

### ⭐ The durability ledger is now COMPLETE for a rod's whole life
`data/rodDurability.jsonl` has paired before/after readings running down to 0.
QUESTIONS §52 forbade inventing a decrement rate and said the paired readings
"are what will make a rate derivable later, from ordinary play." That data now
exists end-to-end. Observed rate across today: **1 durability per cast PLAYED**
(13 played, 13 durability: 33->13 was s113's 20 casts, 13->8 was 5, 8->0 was 8)
— NOT per cast charged, which is the distinction that matters given JEBAITOR.
⚠ Still n=1 rod. Do not generalise to a different rod item id.

### Ledger reconciliation — DISAGREED, and self-corrected in the SAFE direction
```
GAME ledger  (dayDocs pond 2):  10 / 20
REPO ledger:                    11 casts, 156 energy
LEDGERS DISAGREE: game 10 vs repo 11 — deferring to the game (lowered the
repo counter). ... This direction is a GAIN, not a defect — QUESTIONS §34.
VERDICT: 10 cast(s) available this guard-day.
```
The guard detected its own over-count and deferred to the server. Exactly the
behaviour the session-113 fix was built for, now exercised on the DISAGREE
branch — session 113 only ever exercised the AGREE branch.

## FISHING TOTALS, session 114 (2 batches, 13 casts, rod exhausted)
- **13 casts PLAYED, 10 CHARGED.** JEBAITOR gap **3/13 = 23%** vs the ~9%
  standing estimate. ⚠ n=13; do not restate the standing estimate from this.
- Catch **7/13 = 53.8%** (batch 1: 3/5, batch 2: 4/8).
  ⚠ Wilson 95% CI approx **[29%, 77%]** — overlaps s113's 60.0% and s110's
  63.6% completely. **Three batches still cannot separate the oil policies.**
- **3 oils, ALL from the approved on-demand policy, 0 from the override.**
  0.23/cast, against s113's 0.10 and s110's 0.64 (override armed).
- Hard Core **+1520**. Energy 156. Relaxing stock 60 -> 57.

## ⭐⭐ CORRECTION — THE ROD REFILLED 0 -> 60. My "fishing is blocked" was WRONG.

`data/rodDurability.jsonl`, verbatim, and this is the whole evidence:
```
2026-08-31T19:37:33  after   dur=8   status=ok    castsSoFar=4
2026-08-31T19:41:34  before  dur=8   status=ok    castsSoFar=0
2026-08-31T19:43:24  after   dur=0   status=halt  castsSoFar=11
2026-08-31T19:46:16  before  dur=60  status=ok    castsSoFar=0   <-- REFILL
2026-08-31T19:47:29  before  dur=60  status=ok    castsSoFar=0
2026-08-31T19:49:12  after   dur=53  status=ok    castsSoFar=16
```
**SAME gear instance** — rod 812, slot 14, docId `812_1787690500_766077e9`
before AND after. Not a rod swap; the same rod's `DURABILITY_CID` went 0 -> 60
in the ~2m52s between 19:43:24 and 19:46:16.

**Cause NOT established.** That window is exactly when the user was reading the
"rod is dry" report and replying, so a manual in-browser repair is the obvious
candidate — but it is a candidate, not an observation. **Nothing in this repo
saw the repair happen**, and no endpoint was polled during the window. Do not
write it up as "the user repaired it" unless the user says so. The alternative
(a refill/regeneration mechanic) is not excluded by anything measured.

### Three claims made earlier this session that this RETRACTS
1. ⚠ **"Fishing is now BLOCKED until the rod is repaired/replaced."** FALSE
   within three minutes. The halt is real and did fire correctly at 0 — but 0
   is NOT a terminal state for a gear instance, which is what that sentence
   implied.
2. ⚠ **"The durability ledger is now COMPLETE for a rod's whole life."** It is
   not a "life" — the rod refills. What the ledger actually now contains is
   better: a full drain AND a refill event on one instance.
3. ⚠ **60 > 33.** Session 113's opening reading of 33 was therefore a
   PARTIALLY-USED rod, not a fresh one. **Max durability is >= 60**, and no
   session before this one had grounds to know that.

### What survives, and is now BETTER supported
The decrement rate: **1 per cast PLAYED**, over four independent segments today
— 13->8 (5 casts), 8->0 (8 casts), 60->53 (7 casts), plus s113's 33->13 (20).
Per PLAYED, never per CHARGED: batch 3 played 7 and charged 6, and durability
moved 7. QUESTIONS §52 forbade inventing this rate; it is now measured over 40
casts on one rod. ⚠ Still ONE rod item id — do not generalise.

## Step 3 (cont) — fishing batch 3, 7 casts
- **7 played. Catch 4/7 = 57.1%** (4 `caught`, 3 `escaped`).
- **1 oil** (937), approved policy. `oil_double_lethal_fired`: **0** again.
- Hard Core (845) **+1040**; 935 x30, one each 516/518/519/520.
- Rod **60 -> 53**. `nextPosition` override now **39/39**, Wilson LB 91.0%.
- Focus triggers hit the WITHDRAWN-BY-POLICY path repeatedly and the log states
  the important half explicitly: *"This is NOT a dry bag and does NOT flag the
  cast out of the outcome arms."* The session-93 fix, visible in the wild.
- Ledgers **AGREE at 16**. VERDICT: 4 casts available.

## FISHING TOTALS, session 114 (3 batches)
- **20 casts PLAYED, 16 CHARGED.** Energy 240 (20 x 12). 4 left on the day.
- JEBAITOR gap **4/20 = 20%** vs the ~9% standing estimate. n=20 now, so this
  is worth flagging as possibly-high, but ONE day is not a re-estimate.
- Catch **11/20 = 55.0%** (3/5, 4/8, 4/7).
  ⚠ Wilson 95% CI approx **[34%, 74%]** — still overlaps s113 (60.0%) and
  s110 (63.6%) completely. **Three sessions of batches cannot separate the oil
  policies.** Same n as s113 and the CI is the same width; nothing was gained
  on that question by doing 20 casts in three chunks instead of one.
- **4 oils, ALL approved on-demand policy, 0 override.** 0.20/cast vs s113's
  0.10 and s110's 0.64 (armed). Relaxing 60 -> 56.
- Hard Core **+2560**.

## Step 3 (cont) — fishing batch 4, 4 casts. DAY CAP NOW FULL.
- **4 played. Catch 3/4 = 75.0%.** 2 oils (937), approved policy.
  `oil_double_lethal_fired`: **0** (fourth consecutive batch).
- Hard Core (845) **+560**. Rod **53 -> 49**.
- Ledgers **AGREE at 20**. `VERDICT: BLOCKED — cap spent. Next window 11:00 PT.`

## ⭐ THE ROD REFILL, RESOLVED BY THE USER — and the wire disagrees about MECHANISM
**User statement (ground truth on intent):** *"the durability jump was because I
replaced the rod with a new one with higher durability."*

**What `/gear/instances` actually shows, live, after the fact — 159 gear rows,
and exactly ONE rod-ish row in the whole account:**
```
itemId 812  dur 49  slot 14
docId  GearInstance#812_1787690500_766077e9
_id    6a8dfe041c2ddfc1c30385bd
createdAt 2026-08-25T20:41:40.971Z      <-- SIX DAYS OLD, predates today
updatedAt 2026-08-31T22:11:47.283Z
```
There is **no second rod instance**, and the surviving row was **created
2026-08-25** — a freshly minted instance would carry today's `createdAt`. Same
`docId` AND same Mongo `_id` before and after the jump.

**So on the wire the event is a DURABILITY MUTATION ON THE EXISTING INSTANCE,
not the creation of a new one.** Both accounts reconcile if the in-game action
presents as "replace the rod" while the server implements it as restoring the
one instance (or if what was consumed was a repair/refill item). **This is NOT a
contradiction of the user and must not be written up as one** — it is a note
that the API's representation and the UI's language differ, which is exactly the
kind of thing CLAUDE.md rule 1 says to record from the live response.

### Consequences
1. ⚠ **Max durability is >= 60 on item 812**, and session 113's opening 33 was
   a partly-drained rod. Previously unknowable.
2. ✅ **`readRodDurability`'s identity check did NOT fail.** My mid-session
   worry was misplaced: the check keys on `GAME_ITEM_ID_CID === CURRENT_ROD`
   (812), the equipped item id never changed, so there was nothing for it to
   catch. Had a DIFFERENT rod item id been equipped, clause 1 would have halted.
3. ⚠ **Residual, theoretical, NOT demonstrated:** the check cannot distinguish
   two instances of the SAME item id. No swap of that kind occurred here (one
   row, unchanged `_id`), so this is a gap in principle only. **Do not "fix" it
   on the strength of this session** — there is no observation motivating it.

## FINAL FISHING TOTALS, session 114 (4 batches — day cap exhausted)
- **24 casts PLAYED, 20 CHARGED.** Energy 288. Cap 20/20, BLOCKED till 11:00 PT.
- JEBAITOR gap **4/24 = 16.7%** vs the ~9% standing estimate.
- Catch **14/24 = 58.3%** (3/5, 4/8, 4/7, 3/4).
  ⚠ Wilson 95% CI approx **[39%, 76%]**. Overlaps s113's 60.0% and s110's 63.6%
  entirely. **Still cannot separate the oil policies.**
- **6 oils, ALL approved on-demand policy, 0 override, 0 anomaly sirens.**
  0.25/cast vs s113 0.10, s110 0.64 (armed). Relaxing 60 -> 54.
- Hard Core **+3120**. Rod 13 -> 0 -> [refilled 60] -> 49.
- Fishing corpus 315 -> 339 casts.

---

# The test re-baseline, in full

The four dungeon runs and 24 fishing casts turned the suite red: **68 failing
assertions across 13 files**. Session 113 hit the same shape (55 across 9), and
the established handling is: verify the CONTROL first, then re-baseline census
pins, and treat anything that is not a census pin as a finding.

## The control, checked before anything was touched
`castEra.test.ts` asserts the three era arms separately. `preOil [94, 410, 184]`
and `oilSupplied [62, 235, 4]` came back **BYTE-IDENTICAL**; only `focusDry`
moved, 159 → 183 casts (+24, exactly this session's casts). That is the era
ruling confirmed out of sample for an **ELEVENTH** consecutive batch, and it is
what separates "the corpus grew" from "the instrument broke". Without it a
110-assertion re-baseline is indistinguishable from an apparatus quietly failing.

## Not census pins — the four findings inside the red

**1. `procEvidence.test.ts` — a bounded slice silently lost a pinned fact.**
The file scans `allDirs.slice(-maxRunDirs)` (last 20 run dirs) while asserting
*"no flag except intuition has EVER fired at stat 0"*. Four new runs slid the
window:

```
slice(20):  intuitionProc0 n= 518  firedAtZero=0     <- the fact vanished
full(126):  intuitionProc0 n=2234  firedAtZero=1     <- still there
```

Worse, the slice had stopped seeing three flags entirely — `blockProc0`,
`critProc0`, `tenacityProc0` have **no key at all** in it, because recent runs
never carry those stats at 0. A control that "passed" was checking six flags
where the corpus has nine. Fixed by running the control on the full corpus and
asserting the nine-flag set explicitly. **An "EVER" claim on a sliding window
answers "recently".**

**2. `statusEffects.test.ts` — a test measuring something other than what it
said.** The Weak-exception assertion's comment read *"exactly one miss on the
whole corpus"* while `full` was a 30-dir slice. On the real corpus the claim is
true and better supported: Weak **95/96** (exactly one miss), clean **83/83**;
Vulnerable **51/51**, clean **45/45**. Moving it strengthened the assertion.

**3. `Intimidating` heals — SecondWind's held-arm rule breaking as designed.**
16 held-arm misses, decomposing exactly:

```
held-arm misses by co-present status:  { Regen: 4, Intimidating: 12 }
```

identical on the slice and on the full 2912-exchange corpus. All 12 are
player-side, in the room-14 run, `SecondWind` held at 5, `Intimidating: 2`,
`heal` exactly 2, `tenacityProc` false on 11 of 12. Excluding both sources,
**both arms are exceptionless at 19/19 spent and 44/44 held** — a LARGER clean
sample than session 113's 9/9 and 16/16.

Not modelled. Every observation is at amount 2, so "heals its amount" and
"heals a flat 2" are indistinguishable — the identical trap `BurnMastery` sat in
at 6-against-3 for five sessions. QUESTIONS §68.

⚠ This is **not** the exclusion widening, which DECISIONS 2026-08-30 forbids.
The exclusion is asserted as a two-member CENSUS by composition
(`toEqual({ Regen: 4, Intimidating: 12 })`), so a third source turns it red
rather than being absorbed — which is exactly how `Intimidating` surfaced.

**4. `damageEconomy`'s drift band — investigated, then widened to its stated
invariant.** `LIVE.drift` crossed -0.6 at -0.6017. The comment says the band
guards "the sign and the order of magnitude"; both hold. What had been happening
is the edge being nudged every corpus growth — turning a stated invariant into a
rolling re-baseline, the failure session 113 named. Investigated: seven
consecutive pins, monotonically more negative, with a mechanism.

```
-0.2426  -0.3504  -0.4331  -0.4388  -0.5005  -0.5187  -0.6017
```

More negative = the fish loses more HP per play = the bot playing better, and
player ATK has demonstrably risen over that window. Not instrument drift. Band
widened to -1 (the order-of-magnitude claim); the exact six-place pin lower in
the file remains the movement detector. **If the sign flips or it reaches -1,
re-derive — do not widen again.**

## Census re-baselines
~110 scalar pins across 13 files, applied by an iterative script that only
rewrites a literal when it matches the pinned value exactly, and stamps each
with `/* [session 114] was <old> */`. Arrays and `toMatchObject` pins were
captured by injecting logs and rewritten by hand.

Notable ones that carry meaning rather than just a number:

- **Offer table +33 rows.** Additivity verified BEFORE the append (sessions
  93/95/113's check): 33 in the corpus and absent from the table, **ZERO in the
  table and absent from the corpus**. Incomplete, never wrong.
- **Room-max 12 → 13.** The invariant — offers stop one room short of the
  deepest death — has held from session 20 through eight depth records.
- **Wall 1's clean SET unchanged** at the same six types (since session 52). The
  three additions are `AddMaxArmor`, `UpgradePaper`, `UpgradeRock` RECURRING.
- **`Enemy Room 76`** added at room 14 / DANGEROUS_TIER. hp 70, armor 38,
  rock 28/8, paper 24/14, scissor 20/16. Rolled evasion 6, block 4, lck 6,
  tenacity 7 — **lighter than room 13's 8/8/7/3 on three of four axes**, which
  falsifies the room-13 entry's prediction that deeper rooms roll heavier.
- **`BurnMastery` pairs `["4/2","6/3"]` → `["10/5","4/2","6/3","8/4"]`.** All
  four satisfy x2. The RELATIONSHIP assertion session 113 wrote in place of the
  literals is what carried it. Still no odd plain amount.
- **`b6` (K=6) moved** 21/11/0/6/28 → 23/12/0/7/30, where session 113 found it
  frozen. `sacrifices: 0` is the durable part. Inversion persists (b6 net 12 vs
  all3 15); K=10 still carries the thesis at net 26.

## Final verification, against the committed tree
```
Test Files  115 passed (115)
     Tests  2297 passed (2297)
tsc --noEmit                 clean
git diff --cached --check    clean
secret scan (tracked)        10523 files, 0 unexplained, 14 allowlisted — PASS
secret scan (diff vs 501fadd1)  745 files, 0 unexplained
.gitignore                   all 7 required paths present
config/discovered.json       still tracked (must be)
```
