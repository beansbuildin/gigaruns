# STATE — session 106 — 2026-08-28 — code at commit <SHA>

## Status
Brief had two parts. **Part A (1 fishing cast) NOT RUN — blocked, correctly, by
the repo's own budget. Part B (up to 4 Tier-1 dungeon runs) GATE PASS.**
Live spend: **4 juiced Tier-1 dungeon runs, 12/12 run-units, 240 energy, 0 gold
or silver rings, 0 fishing casts, 0 oils.**

**The pre-registered Tier-1 Hard Core measurement is EXECUTED and ANSWERED: H1
CONFIRMED.** `dropMultiplier` governs Hard Core (845) and only Hard Core.
Two of the four runs met the `r >= 6` validity bar and both scored H1; the two
that did not are recorded and were NOT scored.

Suite **2092 passed / 2092, 111 files** (`vitest run --maxWorkers=4`; the
default over-subscribes this machine and produces FALSE timeouts — session 100,
unchanged). `tsc --noEmit` clean, secret scan **0 hits on all four patterns over
the whole 451-file staged diff, fixtures included**, `discoveredShipsClean` 8/8.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten (see `/recap` step 3). Entries marked
**[USER]** are user directives an agent may not re-open at all.

**Dropped this session** (folded into self-enforcing artifacts, per `/recap`
step 3): rule 8 and rule 12 — both stated in full in CLAUDE.md, which is
mandatory reading at session start; and Auth Path B / EOA / `viem`, enforced
twice over by CLAUDE.md rule 3 and a failing `tests/clientSurface.test.ts`.

- **Tier-1 Hard Core payout.** MEASURED, not derived: `dropMultiplier` governs
  item 845 ONLY, at an **exact 4:1 quantum**. Dendren Root (846) unmoved.
  DECISIONS 2026-08-28. Re-opens as: *"measure the first live Tier-1 run"* or
  *"the ~quarter figure is still a derivation."* It is no longer a derivation.
- **Proc effect sizes.** `block` = `floor(ATK/2)`, `evasion` = full negate,
  `lck` = `2 x ATK` — MEASURED, exact, control 0/4111. §58, §62. Re-opens as:
  *"diff the HP deltas on fired vs unfired exchanges."*
- **The no-proc null.** Damage = attacker's `currentATK` on **1645/1645
  status-clean exchanges, full corpus, zero misses ever.** DECISIONS
  2026-08-28. Re-opens as: *"the null rate is falling"* — a MIXED-population
  rate is composition-bound and falling is expected; the clean one is exact.
- **`tenacity` / `intuition` as damage mitigation.** RULED OUT, both, with no
  positive mechanic. §58, §62. Re-opens as: *"find what tenacity does."* What
  is genuinely open is the heal AMOUNTS — and ONLY that; pick-order closed
  below.
- **Tenacity PICK-ORDER.** RETIRED — redundant given the stat by construction,
  not merely underpowered. §63. Re-opens as: *"test whether tenacity's rate
  depends on where AddTenacity was picked"* or *"session 103 saw pick order
  matter."*
- **The six statuses.** `Burn`/`Weak`/`Vulnerable`/`Regen`/`SecondWind` exact;
  **`lifesteal` DOES NOT EXIST**; `amount: 0` is INERT. §59. Re-opens as:
  *"measure the status effects"* or any task listing lifesteal.
- **`triggeredBoons`.** CLOSED as an evidence channel — 0 non-empty of 10,616.
  DECISIONS 2026-08-26. Re-opens as: *"settle whether triggeredBoons populates."*
  **No runs may be spent on it.**
- **`SecondWind` / `Steadfast`.** Ordinary volume WILL NOT settle these — that
  is a positive finding, not missing data. DECISIONS 2026-08-27. Re-opens as:
  *"grow n on SecondWind/Steadfast through normal play."*
- **Redraw.** CLOSED — `redrawEnabled` stays false, the counterfactual bound is
  retired, and §28's gap 1 is STRUCTURALLY unreachable from a shadow at any
  volume. §49, §51. Re-opens as: *"run more redraw shadow analysis."*
- **JEBAITOR.** CLOSED — a ~9% skill making a cast not count against the daily
  ledger; it explains the `lowered` direction of a repo-vs-game cast
  disagreement and ONLY that. §34. Re-opens as: *"the cast ledgers disagree."*
- **[USER] Rule 11 — entry tier is Tier-1 (`--juiced-index=1`), 0 rings.**
  Session 104, EXERCISED LIVE 4/4 this session. `data.index` is the TIER;
  `entryData` is ordered 2, 1, 3, so array position is NOT tier. Re-opens as:
  *"correct the juiced index"* — a positional 'fix' selects Tier 2 and spends
  silver rings.
- **[USER] The rod.** Golkan, REPAIRED not replaced — 2026-08-28, 18 -> 40, and
  read **37** at session-106 preflight. `CORPUS_DECK` stays Shroom until the
  corpus is majority-Golkan. §53, §61.3. Re-opens as: *"repoint CORPUS_DECK"*
  or *"pick a new rod."*
- **[USER] Unspent skill XP.** CLOSED, not deferred. §61.1. Re-opens as:
  *"the account has unallocated skill points worth spending."*
- **Suite invocation.** `vitest run --maxWorkers=4`; the default
  over-subscribes this machine and produces FALSE timeout failures.
  DECISIONS 2026-08-26. Re-opens as: *"the suite is red."*

## What works
- **The four runs, one arm, zero waste.** Runs 25165690 / 25165963 / 25166186 /
  25166314, deaths at rooms 5 / 6 / 7 / 10, so **r = 4 / 5 / 6 / 9**. Ledger read
  before and after every run: **0 -> 3 -> 6 -> 9 -> 12**, exactly +3 each.
  **212 POSTs, 0 first-attempt failures (0/208 scored action classes).**
  12/12 potions used.
- **`start_run` sent `index: 1`, `isJuiced: true`, `consumables [131,131,131]`
  on all four**, verified against the logged request body, not the flag.
  **Zero negative `gameItemBalanceChanges` anywhere — nothing was debited**,
  which is the real proof no rings were spent.
- **H1 CONFIRMED on both valid runs.** H/r **260.0** (r=6) and **252.0** (r=9)
  against a pre-registered `< 500 -> H1` and an H1 prediction of 266. Pooling
  checked before doing it, as the plan demanded: the two sit **3.1%** apart
  against a 300% hypothesis gap. **Pooled valid H/r = 255.2.**
- **The exact result, which removes depth entirely.** Payout is
  `base x 12 x dropMultiplier`. Dividing the quantum out: Tier-3 29 rooms =
  30,960 = **48 x 645** (mean base **22.24**); Tier-1 24 rooms = 6,432 =
  **12 x 536** (mean base **22.33**). **The base draw is the same to within
  0.4%; the whole difference is the multiplier.** Naive HC/room 1,067.6 vs
  268.0 -> **3.984**.
- **The matched pair.** s103 run 4 and s106 run 3: both r=6, both gear 50/17,
  both 3/3 potions, both juiced, differing ONLY in entry tier.
  **HC 6,096 -> 1,560 (3.908x down); Root 309 -> 309, unchanged to the unit.**
- **Negative control passes on all four runs and it is EXACT.** Root per room is
  the same depth-indexed sequence in BOTH tiers — 5, 9, 14, 19, 25, 31, 37, 42,
  **47** — credited 3x per room. Run 4's room 9 EXTENDS it one room past
  anything Tier-3 ever captured.
- **Loadout held: 50/17 with `pickedBoons: []` on all four `start_run`
  responses.** First positive confirmation of DECISIONS 2026-08-27's
  "steady going forward" ruling. The five new census combos were chased as the
  signal that ruling demands and every one is boon growth off 50/17.
- **Rule 12 exercised for real.** Run 3's preflight found pool **35 < 60**,
  claimed 1 ROM doc for **352**, and continued at 387. A raw endpoint read would
  have called that blocked.

## What's broken
- **Nothing is red.** Three suite failures were found and all three were
  resolved by re-deriving, not by bumping:
- ⚠ **`procEffectSize`'s null floor FAILED at 604/688 = 87.8% against `> 0.9`
  — and the mechanic is fine.** On status-CLEAN exchanges the null is
  **280/280 = 100%** in-slice and **1645/1645 = 100%** full-corpus, zero misses
  ever; every miss is status-carrying, exactly as the old comment claimed. The
  old number was measuring SLICE COMPOSITION (dirty share 59.3% in-slice vs
  37.9% full) because this session's boons were status-heavy. Assertion replaced
  with the EXACT `cleanMisses === []`, which is strictly stronger.
- ⚠ **`OBSERVED_OFFERS` +24, `UNMODELLED_TYPES` 15 -> 16.** One type moved IN
  (`VulnerableTenacity`, run 4 room 3, offered not picked), none moved out. The
  four runs offered unmodelled types at Tier-3's sort of rate — the entry tier
  does not appear to narrow the reward pool.
- ⚠ **Enemy census +5 combos, NO new starting loadout.** 50/25, 50/27, 58/17,
  58/27, 64/27, all traced to their pickup. **`AddMaxArmor` is NOT a flat +2** —
  +8 and +10 both appear; `AddMaxHealth` shows +8 and +14. Read `selectedVal1`.
- **Part A never ran.** Repo `dendren.dailyEnergyBudget` 252 was exhausted at
  252/252 while `dayDocs[pond 2]` still showed 19/20. Correct fail-closed
  behaviour, surfaced not bypassed. See open question 2.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Corrections to SPEC.md
- **None. `SPEC.md` and `SPEC-fishing.md` were not touched, and SPEC §3c was
  CONFIRMED rather than contradicted** — `dropMultiplier` governs 845 only.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **`handoff/TIER1-MEASUREMENT.md` §5 IS WRONG and is corrected in this
  commit's log, not in the plan document** (a pre-registration is not edited
  after the fact). It fixed the control as "Root flat at ~62/room". **Root is
  NOT flat — it grows with room index**; 62 was a depth-average, confounded the
  same way §2 warned HC-per-run was. The control still passes, far more sharply.
- **`inputItems` IS NOT A REQUEST FIELD.** The brief and TIER1-MEASUREMENT §6.3
  both ask to confirm `inputItems: []` in the `start_run` body; no such key
  exists there. It lives on `entryData[].inputItems` (Tier 1 `[]`, Tiers 2 and 3
  seven ids each). Confirm zero rings via absent negative balance changes.
- **`dropMultiplier` is NOT returned on any run response** — 0 occurrences
  across all four logs. §6.4's "don't assume 1 because the flag said 1" cannot
  be met from the run; it is met from `entryData` plus the payout itself.

## Dead ends
- **Do not "fix" a falling MIXED-population null rate in `procEffectSize`.**
  It is composition-bound by construction and will move whenever the last 20
  runs' boon mix does. The clean-population invariant is the one that means
  something and it is exact.
- **Do not re-run the Tier-1 measurement.** Two valid runs, agreeing to 3.1%,
  with an exact 4:1 quantum underneath and a matched pair. More runs add corpus,
  not evidence.
- **Do not score a run with `r <= 5`.** Runs 1 and 2 read H/r 288.0 and 290.4 —
  the right answer — and were still not scored, because the pre-registration
  says so and a rule kept only when it agrees with you is not a rule.
- **Do not read `Dungeon#3` at 9 as our spend.** It is the user's manual play in
  another dungeon (cap 9). `findRealRunsToday` keys on `#Dungeon#5`.
- **Do not re-brief tenacity pick-order.** §63 retires it structurally.
- **Empty `run-` fixture dirs from `--dry-run` are expected, not corpus
  pollution.**

## Metrics
- **Live: 4 juiced Tier-1 dungeon runs, 12/12 run-units, 240 energy committed
  (236 observed, 4x the 1-unit regen drift), 0 rings, 0 fishing casts, 0 oils.**
- **Hard Core (845) 6,432 over 24 rooms = 268.0/room.** Tier-3 baseline
  30,960 over 29 = 1,067.6/room. Ratio **3.984**; quantum ratio **exactly 4**.
- **Dendren Root (846) 1,353** — per-room sequence identical to Tier-3.
- **Pre-registered scoring: 2 valid (r=6, r=9) -> H/r 260.0 and 252.0, both H1.
  2 invalid (r=4, r=5) -> recorded, not scored.**
- Rooms cleared 4 / 5 / 9 / 6 = **24**; boons taken 24; tier choices 24.
  Perpetual offered **12 of 24 (50.0%)**, cost a tier 7.
- Corpus **100 -> 104 dungeon run dirs; 83 -> 87 dungeon attempts.** Fishing
  unchanged at 251 casts.
- Suite **2068 -> 2092** (+24, all from the new corpus feeding `boons.test.ts`'s
  per-offer cases; no test was added by hand).

## Open questions for Claude
1. **The `nextPosition` override is LIVE and steering fishing card choice** and
   still has no user sign-off — it armed itself by accumulating validation data
   (22/22, Wilson lower bound 85.1%, threshold 10). Carried UNCHANGED from
   session 105; this session did not fish, so nothing new was learned. Is it
   wanted?
2. **The 252-energy fishing budget is now the binding constraint and it cost a
   real cast today.** 252 = 21 x 12 was set so it could "never buy a cast the
   server would not already refuse", but JEBAITOR makes casts free at ~9%, so
   the game offered a 20th cast the repo could not fund. Raise it, or accept
   losing ~1-2 casts/day? **Ask-first either way — not touched.**
3. **Is the Tier-1 arm now the baseline for everything downstream?** Session
   103's Tier-3 numbers are no longer comparable on any payout statistic, and
   several reports still quote them. Nothing was rewritten this session.
4. Unchanged and still deferred: session 100's open question 2 (should the live
   loop read the dungeon proc booleans in real time).

## Files changed
```
  A  fixtures/dungeon-runs/run-2026-08-28-16-24-42   run 1, r=4  (76 files)
  A  fixtures/dungeon-runs/run-2026-08-28-16-47-36   run 2, r=5  (106 files)
  A  fixtures/dungeon-runs/run-2026-08-28-17-10-28   run 3, r=6  (122 files)
  A  fixtures/dungeon-runs/run-2026-08-28-17-23-12   run 4, r=9  (144 files)
  M  src/sim/boons.ts                +24 OBSERVED_OFFERS (first Tier-1 offers)
  M  tests/boons.test.ts             UNMODELLED_TYPES 15->16, roomOne 231->243
  M  tests/enemies.test.ts           +5 census combos, no new starting loadout
  M  tests/procEffectSize.test.ts    null invariant RE-DERIVED onto clean set
  A  handoff/TIER1-RESULT.md         the measurement, executed
  M  handoff/reports/*.md            regenerated
  A  handoff/scratch-session-106.md
```
