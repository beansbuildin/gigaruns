# session 121 — 2026-09-03/04 — day-20699 rotation point — GATE PASS (weakly)

## The gate, and why the pass is worth less than it looks

The brief set one gate: measure day 20699's charged faction and see whether
hypothesis (a) — a fixed 7-permutation with the observed fragment 5→6→7→3 —
survives. Under (a), day 20699 had to charge one of **f1 Crusader, f2 Overseer,
f4 Archon**.

**The prediction was committed to git BEFORE `start_run`** (`f35602e0`),
together with its falsifiers and an explicit advance statement that a pass would
be weak. That commit is the reason this is a test rather than a story.

**Result: Archon (138) 30→27.** Sole mover, exactly −3, read twice and stable.

```
134 Chobo    30 -> 30    135 Crusader 39 -> 39    136 Overseer 51 -> 51
137 Athena   21 -> 21    138 Archon   30 -> 27  <-- the ONLY mover
139 Foxglove 45 -> 45    140 Summoner 42 -> 42
```

**(a) survives. The charge SHAPE also survives, now 20/20 after the day's four
runs.** But under (b) — per-day pseudo-random — a draw lands in a 3-of-7 set
43% of the time, so this is a **Bayes factor of about 2.3**. A FAIL would have
been decisive; a pass is not. The honest summary is that the order went from
**6 candidate permutations to 2**, not that the rotation is solved.

The full map, five days:

```
day 20695  dow 3 -> f5 Foxglove
day 20696  dow 4 -> f6 Summoner
day 20697  dow 5 -> f7 Chobo
day 20698  dow 6 -> f3 Athena     <- killed "faction = dayOfWeek + 2"
day 20699  dow 7 -> f4 Archon     <- this session
```

Remaining: dow 1 and dow 2 take {f1 Crusader, f2 Overseer} in one of two orders.
**Day 20700 (dow 1) settles it either way** — whichever it charges, dow 2 takes
the other.

## The brief was wrong about the calendar, and it was caught before spending

The brief and `scripts/checkEntryTiers.ts` both stated day 20699 would be
`dayOfWeek 0`. **The server returned 7.** `dow = day mod 7` with 0 mapped to 7
(20699 = 7 × 2957 exactly). So the series is 1-indexed, the observed dows are
3,4,5,6,7, and the two open slots are dow 1 and dow 2 — **there is no dow 0 and
never was**.

This changed no logic, but it is the **fourth consecutive session in which a
stale or wrong PRINTED CAPTION was a defect** (115, 116, 118, and now 121). The
caption is rewritten with all five points, the falsification, the Bayes-factor
caveat, and the next test named.

## The rod label, and the real bug underneath it

The user directed that the long-flagged rod-durability print label be fixed.
The cosmetic complaint was right — `0 (before: 13, casts this batch: 18)` mixed
a play-driven delta with a session-cumulative count. **What was underneath it
was worse.**

`appendRodDurability` writes `castsSoFar: 0` on every `before` row and
`guards.runCount` on every `after` row — and `guards.runCount` is the guard's
**DAY-cumulative CHARGED** total, loaded from the persisted budget file at
process start. So `after.castsSoFar - before.castsSoFar`, the arithmetic
`RodDurabilityRecord`'s own doc comment presents as the measurement the ledger
exists for, yields the day's charged count and not the batch's play. They
coincide only on a day's first batch.

Verified against the real `data/rodDurability.jsonl`, not inferred:

| batch | before | after | ledger implies | truth |
|---|---|---|---|---|
| 1st of day | 21 @ 0 | 13 @ 7 | 8/7 = 1.14/cast | correct |
| 2nd | 13 @ 0 | 0 @ 18 | 13/18 = 0.72 | ~13/11 ≈ 1.2 |
| 3rd | 50 @ 0 | 48 @ 20 | 2/20 = **0.10** | 2/2 = **1.0** |

**A 10x error on the most recent pair.** The fix adds an unconditional
`batchCastsPlayed` counter, incremented after the dry-run and shutdown breaks so
neither can enter a denominator; the print now names each number's basis; and
the record carries `batchCastsPlayed` as **optional**, so the 47 pre-existing
rows still load and read `undefined` rather than 0.

**The lesson is CLAUDE.md rule 11's, on a different field.**
`tests/fishing/rodDurability.test.ts`'s round-trip test asserted this exact
arithmetic and **passed the whole time**, on invented numbers (20 casts, a
20-point drop) chosen so the answer came out a tidy 1. A green test proves the
code computes what the test says, never that the test says the right thing. The
real 10x-wrong pair is now pinned as a regression test **including an explicit
assertion of the wrong figure the old denominator gives**.

## ⭐ And the fix immediately paid: the decrement rate, measured

```
▸ rod durability after: 38 (before: 48, delta -10 over 10 cast(s) played this batch = 1.00/cast; day charged total 20)
▸ rod durability after: 28 (before: 38, delta -10 over 10 cast(s) played this batch = 1.00/cast; day charged total 20)
```

**Two independent clean 10-cast brackets, both exactly 1.00 durability/cast.**
This is what the paired ledger has existed for since session 100 and had never
produced. QUESTIONS §52 forbade assuming a rate; it no longer has to be assumed.

## Live work

Four juiced Tier-2 runs (12/12 run-units) and 20 fishing casts (20/20 cap). The
first run was the measurement; the other three and all 20 casts were authorized
by the user mid-session ("approved to do more casts and more dungeon runs").
Every run was issued `--runs=1` and reported between, per rule 11.

| run | death | Hard Core | Root | first-attempt failures |
|---|---|---|---|---|
| 25324264 | room 9 | 4368 | 546 | 0/61 |
| 25325352 | room 8 | 3696 | 420 | 0/56 |
| 25326311 | room 7 | 3312 | 309 | 0/42 |
| 25326514 | room 4 | 1656 | 84 | 0/28 |
| | | **13,032** | **1,359** | **0/187** |

Archon 30→18, exactly 12 = 3/run, sole mover every time. `dayProgressEntities`
read 12 afterwards.

Fishing: **11/20 = 55% caught**, below the user's 60–70% framing but inside
binomial noise at n=20 (P(≤11 | p=0.65) ≈ 22%). Rod 48→38→28. **3 Relaxing Oil
(937)** spends on lethal triggers; **28 Focus triggers policy-withdrawn**, Focus
being off the allowlist.

**A correction made in-session:** I first reported "zero oils consumed" from a
grep that matched the wrong event names. The bot had in fact POSTed
`use_fishing_item` with `itemId: 937, slotIndex: 0` three times, and the server
recorded `consumablesUsed: 1` with `fishingConsumableSlotUsed [true,false,false]`
on the three corresponding casts. All three reconcile against the corpus's
`oilEra` set growing by exactly 3.

## Two census signals chased rather than re-pinned

**1. `64/17` and `64/25` entered the loadout census.** hpMax jumping 50→64 looks
exactly like a level-up, and the session-104 user directive says a new combo is
now a SIGNAL to chase. Chased: **both runs 3 and 4 START at 50/17** with empty
`pickedBoons`, so the starting loadout is unchanged, `PLAYER` needs no edit, and
there was no re-spec. `64/17` is 50/17 after `AddMaxHealth(14)` at state-036;
`64/25` is that after `AddMaxArmor(8)` at state-046. Both mid-run.

**2. Modal LIVE damage flipped 5 → 6.** The comment ties mode 5 to the card
catalog, and the user replaced the rod in session 119, so a deck change was the
obvious worry. Checked: `splitByDealtDeck` puts **zero** traces in `unknown` —
same known rod deck. What actually happened is that **the pin was a coin-flip**:
before today 5 appeared 155 times and 6 appeared 149 over 345 traces, a 4% gap;
today's 20 casts dealt 16 sixes and 3 fives, giving 165 vs 158. The mode flipped
on a margin of 7 and should be expected to flip back. Documented as such.

## Two new boon types, both held

`RegenMastery` (run 2 room 1) and `VulnerableMastery` (run 2 room 7) were
**PICKED for the first time**. Both verified LATENT no-ops against the fixtures
— hp/hpMax/armor/armorMax unchanged, all ROLLED stats unchanged,
`rock`/`paper`/`scissor` byte-identical, `pickedBoons` +1. Both added to
`AWAITING_MODEL_DIRECTIVE`, **neither modelled**: from n=1 that needs a user
directive, now the fifth such case.

**Neither is a first SIGHTING.** RegenMastery had been offered and declined at
least 7 times and VulnerableMastery at least twice — which is exactly why
neither had a pair until now. `selectedVal1` does not roll in either
(`val1Min === val1Max`, 1 and 10 respectively). `VulnerableMastery`'s **10**
against the modelled `Vulnerable` family's small integers is a reason for care,
not a reason to guess.

## Corpus pins

~160 re-derived across 12 test files. Every set change verified purely ADDITIVE
by **multiset diff both ways** — 24 `OBSERVED_OFFERS` rows added, **0 removals**.

Held, and worth recording as held: the **zone template is still exceptionless**,
1600/1600 scored and correct across 78 new plays; `preOil`/`oilSupplied` cast
counts byte-identical for a **sixteenth** consecutive batch (expected — Focus
can never be supplied under the standing directive, so no cast can leave the
`focusDry` era).

Ended, and recorded as ended rather than silently overwritten: redraw b10
`sacrifices` 7→8 and `wasted` 12→13 (STATE tracked both as stable), the
`|rescues − sacrifices|` numerator 21→25, and `rescueCostHist` buckets 2 and 3.

`LIVE.drift` moved a **fourth** consecutive time, −0.6850 → −0.6882, and is
named explicitly per the brief. Still negative and short of −1, so the written
response is a pin update — but the walk is monotone over four sessions and
today's 20 casts alone read −0.7436.

## A tooling note worth carrying

A background-task completion notification reported **"exit code 0"** for a suite
run that had **exit 1 and 2 real failures** — because the command was
`npx vitest run ... ; echo "EXIT=$?"` and the notification reports the compound.
This is the session-118 `vitest | tail` lesson in a new costume. Every exit code
in this recap was read from a captured file, not from a notification or a pipe.

## Verification

```
npx vitest run --maxWorkers=4    2391 passed (2391), 116 files, exit 0
npx tsc --noEmit                 clean, exit 0
git diff --check                 clean, exit 0
discoveredShipsClean             8 passed (8)
.gitignore                       all seven paths verified present

> secret scan — scope: tracked
  files scanned:        11946
  CONTROL A (read):     11549 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS — no unexplained hits, both controls healthy.
```

## ⚠ The thing the next brief must lead with

**The JWT expires 2026-09-04T18:48:43Z.** Day 20700 — the last test needed to
solve the rotation under (a) — opens at 11:00 PT = 18:00Z. **That is a
~48-minute live window, and only if the user has not refreshed the token.**
Refreshing it is a user action and needs to be the first line of the next brief,
not a carry-forward bullet.
