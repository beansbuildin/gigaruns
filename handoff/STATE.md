# STATE — session 101 — 2026-08-26 (PT) — code at commit 808e7a1c

## Status
Brief items **§A: DONE. §B: DONE. §C: BLOCKED — ledger not reset (expected).**
Plus **§D: DONE — an extra section the USER chose mid-session** in place of
idling until 11:00 PT (see "Dead ends" for why that mattered).
**GATE PASS** on everything this session could reach.

Suite **2023 passed / 2023, 111 files** (`vitest run --maxWorkers=4`; the
default over-subscribes this machine and produces FALSE timeout failures —
session 100's finding, unchanged and still load-bearing). `tsc --noEmit` clean,
`git diff --check` clean, secret scan **0 hits on all four patterns**,
`discoveredShipsClean` 8/8.

**Live spend: ZERO.** No casts, no runs, no energy, no oils. All three sections
were offline against the committed corpus. The only live traffic was one
`--dry-run` and two ledger reads.

§C was blocked on arrival and stayed blocked: `checkFishingCaps.ts` read
**20/20 spent** at 09:54 PT, 1.1h to the 11:00 PT window. Not attempted.

## What works
- **§A — the capture path is COMPLETE. `n = 1919` is not an undercount.**
  Session 100's open question 3 is closed. The 5308 canonical states partition
  exactly, no remainder: **2687** `GET` reads (`actionToken == 0`, **0 carry
  events, no exceptions**), **265** enemyPath offers, **263** path-SELECTION
  responses reporting a fresh un-acted enemy, **66** `dungeon_started`, **108**
  potion `use_item`, **1919** exchanges (2 `use_move` each = 3838 rows).
  **Decisive: every POST response in which an exchange resolved carries its
  events — 1919/1919.** The eventless share is flat across every capture date
  (17-24%), so this is structural, not a regression.
- **The classifier needed no new capture.** `scripts/liveRun.ts:1191` writes the
  loop's `GET` read before every POST, and `client.getDungeonState` documents
  that the GET reports `actionToken: 0` regardless of run state.
- **§B — `scripts/procEffectSize.ts` + `tests/procEffectSize.test.ts` are new.**
  Effect sizes for three of the five rolled stats, exact. Re-runnable.
- **§D — `scripts/statusEffects.ts` + `tests/statusEffects.test.ts` are new.**
  Four of the six statuses, exact. Re-runnable.
- **The instrument for both: `OnDamage` rows in the same `data.events[]`.**
  `playerId` names the **VICTIM** (verified against a state diff, not assumed),
  and `data.source` separates combat (`""`, 2591) from burn (`"burn"`, 522).

## What's broken
- ⚠ **`data.prevent` is NOT the block instrument, despite the name.** It reads
  **0 on all 2591 combat damage rows**, including all 76 on which a block
  procced. Anyone reaching for the obvious field finds nothing; the effect is
  in `value`. This will be re-discovered unless it is read here first.
- ⚠ **`amount` in `statusEffects` means THREE different things**, and the
  obvious reading is wrong on half the types. Magnitude for `Burn`/`Regen`/
  `SecondWind`; a countdown for `Weak`/`Vulnerable` whose multiplier is FIXED
  (identical at amount 1, 2, 3 and 4).
- ⚠ **`amount: 0` means INERT, not present-and-cleared** — 59/59, 37/37, 25/25
  land at exactly 1.00x ATK, indistinguishable from absent. **Zero is the most
  common value on four of the six types.** Anything testing `"Weak" in
  statusEffects` rather than the amount is wrong on the MAJORITY of occurrences.
- ⚠ **CAPTURE-1's list was wrong in both directions.** `SecondWind` (223) and
  `Steadfast` (65) are not in it; **`lifesteal` is in it and does not exist** —
  no such status, and no proportional heal anywhere in the corpus.
- ⚠ **Fourth instance of "a field's absence from the payload this repo happens
  to read is not its absence from the API."** s70 (`/gear/items`), s99
  (`/gear/instances`), s100 (`data.events`), now the statuses. A TASKS entry
  saying "we need to capture X" is a claim about this repo's reading habits.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED**; `CORPUS_DECK` still Shroom; the 0.85 necessity gate still never
  observed live (four batches); `triggeredBoons` still never populates.

## Corrections to SPEC.md
- **None to `SPEC.md` or `SPEC-fishing.md` — neither file was touched.**
  Nothing in any live response contradicted either.
- **SPEC §4e's "unknown semantics" list is now four shorter, recorded in
  TASKS.md rather than SPEC:** `block` = `floor(ATK/2)`, `evasion` = full
  negate, `lck` = crit at exactly `2 x ATK` (session 100 gave it the rate;
  this gives the magnitude), and the four status rules below.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- Corrections to REPO DOCS: `TASKS.md` CAPTURE-1 rewritten twice (§B, §D),
  including its closing prohibition, whose rationale had gone stale.

## Dead ends
- **Do not reach for `data.prevent` to measure block.** It is 0 everywhere.
- **Do not measure `Burn` against the BEFORE state.** It reads 303/522 with two
  families of exception (burn applied the same exchange; burn stacking 4->8,
  6->12). Against the AFTER state it is 522/522. **The order is apply, then
  tick.**
- **Do not report Regen as 88.3%.** The 7 misses were ALL lethal exchanges — a
  dead unit does not regenerate, though its counter still decays. Excluding
  them gives 53/53. Checking a residual beat rounding a percentage, twice.
- **Do not set a per-flag floor on a control denominator in a bounded-slice
  test.** `evasion` is 0 on the player side for most of a run, so a 20-run
  slice gives `evadeProc0` a control of ~14. That is CLAUDE.md rule 6 — a gate
  on something the slice does not control. Assert the denominator in aggregate.
- **Do not fit a rule to `SecondWind`'s trigger at n=10.** It is not lethality
  and not a fixed HP threshold: fired at 40/40 HP against 10 incoming, held at
  40/40 against 14.
- **Do not read `Steadfast`'s debuff-immunity signal as established.** 0 of 11
  gained a `Weak`/`Vulnerable` while active, but the expected count under NO
  effect is ~0.3. Underpowered; proves nothing.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED; §50's "don't shape a batch
  toward the 0.85 gate"; §56's depth-confidence gap stays open.

## Metrics
- **Live: 0 casts, 0 runs, 0 energy, 0 oils, 0 deaths.** Corpus unchanged at
  79 dungeon attempts / 210 fishing casts.
- **The null that makes every number below a measurement:** damage taken ===
  attacker `currentATK` on **2211 / 2285 (96.8%)** no-proc exchanges.
- **§B — proc effect sizes**, n = 1919 exchanges (`scripts/procEffectSize.ts`):

```
  flag          predicts       status-clean         all      control (stat>0, unfired)
  blockProc0    floor(ATK/2)   33/33  [90-100%]   53/56              0/1041
  blockProc1    floor(ATK/2)    8/8   [68-100%]   19/19               0/619
  evadeProc0    0               2/2   [34-100%]     4/4               0/149
  evadeProc1    0               9/9   [70-100%]   22/22               0/605
  critProc0     2*ATK           9/9   [70-100%]   13/14               0/558
  critProc1     2*ATK          11/11  [74-100%]   16/17               0/605
```

  `block` = partial reduction, **never a negate** (0 of 76 took 0 damage).
  `evasion` = **full negate**, 26/26. `lck` = crit, exactly `2 x ATK`.
  `tenacity` and `intuition` are **ruled OUT as damage mitigation** and have no
  positive mechanic.
- **The control column is the claim, not the intervals.** Across **3577**
  matched exchanges — same stat non-zero, flag unfired — the rule matched
  **zero** times. The per-flag CIs are wide and are reported wide; 2/2 is not
  100%, and `evadeProc0`'s interval starts at 34%.
- **§D — status mechanics** (`scripts/statusEffects.ts`). Six exist, not four:
  `Burn` 1388, `Weak` 477, `Vulnerable` 427, `SecondWind` 223, `Regen` 176,
  `Steadfast` 65.

```
  Burn        tick === AFTER-state amount               522/522
  Weak        damage dealt === floor(ATK * 0.75)          33/33   amount-independent
  Vulnerable  damage taken === floor(ATK * 1.25)          34/34   amount-independent
  Regen       heals its amount unless the unit died       53/53
              then decays by 1, same exchange             60/60
  SecondWind  one-shot stored heal of exactly `amount`    10/10
              while held, does nothing                    28/28
  Steadfast   no damage effect; UNDETERMINED at n=23
```

- **Residual before §D: statuses accounted for ALL of it.** Every exchange that
  missed the null, and every proc exchange that missed its rule, carried a
  non-empty `statusEffects` array. Status-clean, §B's rules held **72/72**.
- **Found in passing:** `crit x block` composes **multiplicatively**
  (`2 x 0.5 = 1.0`), n=1 — mechanism, not a measured rule.
- **Rod durability reads 38, unchanged from session 100's preflight** —
  independent confirmation that zero casts have been spent since.

## Open questions for Claude
1. **§C is still owed and is now the ONLY thing standing between this repo and
   a fresh fishing measurement** (§55's 20-cast batch). It is also still the
   first real chance at a durability bracket the instrument took itself at
   BOTH ends. Nothing else blocks it; the ledger clock does.
2. **CAPTURE-1's remaining list is now four small items, not five broad ones.**
   `tenacity`'s mechanic, `intuition`'s mechanic, `SecondWind`'s trigger,
   `Steadfast`'s mechanic — plus the 22 flat run-scoped heals of 2 or 4 that
   are NOT lifesteal. **All four are volume problems, not capture problems**:
   each fires 6-23 times in 1919 exchanges. Is that worth live runs, or does it
   wait for volume to accumulate from runs played for other reasons?
3. **Should CAPTURE-1's prohibition now be re-scoped rather than merely
   restated?** The damage NUMBER is close to fully accounted for. The specific
   danger this session flagged in TASKS.md: `block`, `evasion` and `lck` are
   the easy three, and wiring only those yields a simulator that is **biased**,
   not merely incomplete, because every mechanic left out also moves damage.
   That is a judgement call about `src/sim/types.ts:31-36`'s contract and it is
   the user's, not an agent's.
4. **STATE.md session 100's open question 2 is now unblocked and still
   deferred.** Effect sizes exist, so "should the live loop read the proc
   booleans in real time" can finally be asked. This session did not touch it.
5. **The 0.85 necessity gate has now gone four batches with zero
   opportunities.** Unchanged from sessions 99 and 100; §50 still stands.

## Files changed
```
 2 commits (this recap makes 3). No new fixtures — zero live play.

  A  scripts/statusEffects.ts        +281  §D's instrument
  A  scripts/procEffectSize.ts       +274  §B's instrument
  A  tests/statusEffects.test.ts     +134  every exact rule + inert-at-zero
  A  tests/procEffectSize.test.ts    +131  null, 3 rules, zero-matching control
  M  QUESTIONS.md                    +297  §58 (§A+§B), §59 (§D)
  M  TASKS.md                         +76  CAPTURE-1 rewritten twice
  M  tests/noHardcodedPaths.test.ts    +5  ratchet 26 -> 27
```
