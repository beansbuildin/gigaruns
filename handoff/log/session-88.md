# session 88 — 2026-08-23/24 (PT) — three juiced runs, one pause each — GATE PASS

Ran 17:45–18:15 PT on 2026-08-23. Scope was exactly the brief's: three juiced
Forbidden Woods runs, one at a time, human go-ahead before each, nothing else
live. Fishing untouched by design.

## §0 — verification and the clock

The brief allowed for the day having rolled over. **It had not.** Session 87
recapped ~17:30 PT on 2026-08-23; this session started 17:45 PT the same day,
and the 11:00 PT rollover sits between them in neither direction. Confirmed
against the server rather than assumed:

```
dungeonId 5 dayProgressEntities (real runs today): 3      # 3 of 12 -> 9 units -> exactly 3 runs
guard day (11:00 PT rollover): 2026-08-23
hours until next reset:        17.25
GAME ledger  (dayDocs pond 2):  20 / 20                   # fishing already spent
VERDICT: BLOCKED — cap spent.
```

`doctor.ts` all green (Node 24.13.1, token valid 113.2h, account `<USER>`
`<ADDR>`, dungeon 5 / 20 energy per run / budget 240 / 12 runs).
`tsc --noEmit` exit 0.

Suite baseline: **11 failed files / 99; 70 failed, 1602 passed, 1 skipped
(1673).** Matches session 87's inherited red.

### Rule 9 — two brief corrections, both minor
- The brief expects `1603 passed / 70 failed`. Real shape is **1602 passed + 1
  SKIPPED** (1673 total). Same failure count — the brief folded the skip into
  the pass column. Not a regression.
- The brief's "could be a fresh 12 if the day rolled over" did not apply; see above.

### The dry run
```
npx tsx scripts/liveRun.ts --dry-run     # exit 0
  · potions: config has forbiddenWoods.potions, but --juiced was not passed -> loading 0.
  ▸ energy preflight: pool 36 covers the planned 20 — no ROM claim needed.
  [dry-run] would POST start_run (dungeonId 5)
```
Note the preflight reads against **20**, not 60, because `--dry-run` alone does
not pass `--juiced`; the potions line says the same thing in its own words. Both
are correct behaviour, not a discrepancy — the real runs preflighted against 60.

It wrote an empty stub `fixtures/dungeon-runs/run-2026-08-24-00-47-25`, removed
at recap **by exact path** (session 87's over-wide `find -empty` deliberately
not repeated). Empty and untracked; `git status` unaffected.

## §1 — the three runs

Each issued as its own `--runs=1` command, backgrounded so a stop had somewhere
to land (session 87's dead end, applied rather than re-learned). A separate
human go-ahead preceded each. No two runs were chained.

| # | run | result | Hard Core | orbs | ledger | tightDelta | EV support | 1st-attempt |
|---|-----|--------|-----------|------|--------|-----------|------------|-------------|
| 1 | `25036015` | death @ room 7 | 5952 | 309 | 3 → 6 | −60 ✓ | 0/46 | 0/55 |
| 2 | `25036128` | death @ room 5 | 4176 | 141 | 6 → 9 | −60 ✓ | 0/39 | 0/44 |
| 3 | `25036263` | death @ room 9 | 8160 | 546 | 9 → 12 | −60 ✓ | 0/50 | 0/63 |

Every ledger read moved by **exactly 3**. Nothing was denied, blocked or
interrupted at any point, so there is **no rule-13 discrepancy** this session —
stated explicitly because rule 13 requires it either way.

### The probes, verbatim
```
{"event":"start_run_energy_probe","energyBefore":206,"energyAfter":146,"tightDelta":-60,"estimatedCost":60,"matchesCommitted":true}
{"event":"start_run_energy_probe","energyBefore":148,"energyAfter":88, "tightDelta":-60,"estimatedCost":60,"matchesCommitted":true}
{"event":"start_run_energy_probe","energyBefore":91, "energyAfter":31, "tightDelta":-60,"estimatedCost":60,"matchesCommitted":true}
```
Three for three, four counting session 87. §23's second branch holds.

### EV support
```
run 1: 0/46 decisions fully modelled; 46 (100.0%) unsupported
run 2: 0/39 decisions fully modelled; 39 (100.0%) unsupported
run 3: 0/50 decisions fully modelled; 50 (100.0%) unsupported
```
Pooled **0/135, 100% unsupported** — EXPECTED under rule 8, which selects
modified enemies. The line printed on every run; session 84's `finishRun` fix is
now verified live four times.

### Rule 8 — 18/18 TIER-CHECKs OK
Perpetual filter load-bearing **4 times**: run 1 rooms 5 and 6, run 3 rooms 7
and 9. At run 1 room 6 the offer was `[0,2,2]` with `eligibleTop=0` — both
tier-2 options were Perpetual, so the pick fell all the way to tier 0. No
final-room case arose (deepest room 9 against `maxRoom` 16).

Run 1 also fired one `boon_priority_conflict`: `AddLifestealSword` demoted at
room 6 inside the rooms-1..8 window (`earlyGameMaxRoom: 8`), `AddLuck` taken.

### Rule 12's energy path, exercised
```
run 1: energy preflight: pool 36 short of the planned 60 (deficit 24) — reading the ROM bank.
       cap headroom: largest single ROM snapshot 170, pool headroom 384. overflow unreachable.
       ROM bank: 37 ROMs, 27 with energyCollectable > 0, 2369 energy claimable
       · claimed 6096 (snapshot 170); running total 170/24
       energy preflight: pool 36 -> 206 after 1 claim(s) (measured +170).
       claim audit: 1 claim(s) descending, snapshot total 170, measured pool delta +170 (drift +0)
run 2: energy preflight: pool 148 covers the planned 60 — no ROM claim needed.
run 3: energy preflight: pool 90 covers the planned 60 — no ROM claim needed.
```
A raw `energyValue` of 36 against a 60-energy run is exactly the reading that
cost session 58 thirteen hours. The loop resolved it in one claim with zero drift.

## §3 (bonus) — §23's remaining half, substantially answered at no extra cost

The open question: what credits energy back DURING a run?

**1. ROM claim is FALSIFIED as the cause.** Run 2 made no claim and still
drifted −1. The drift warning's own suggested culprit is wrong:
```
⚠ energy accounting drift — committed 60 vs observed 59; ... Possible external
  balance change (e.g. a ROM claim) landed mid-run.
```

**2. The pool was caught ticking mid-run, directly.** Run 3:
```
{"event":"start_run_energy_probe","energyBefore":91,...}   # 01:04:33.898Z
{"event":"energy_accounting","before":90,"after":32,"observedDelta":58,"committedDelta":60,"drifted":true}
```
`energy_accounting` opened at **90**; the probe, seconds later, read **91**. +1
between two reads inside one run's own startup, no claim in between. An
observation, not an inference.

**3. Drift tracks wall-clock duration in the right direction.**
| run | first ts | last ts | duration | credited |
|-----|----------|---------|----------|----------|
| `25036128` | 00:56:08.122Z | 00:58:51.714Z | 2m43s (163s) | 1 |
| `25036015` | 00:49:21.098Z | 00:52:46.821Z | 3m25s (205s) | 1 |
| `25036263` | 01:04:25.353Z | 01:08:30.997Z | 4m06s (246s) | 2 |

At 18/hr an integer pool ticks once per ~200s. Windows of 163/205/246s contain
0–1 / 1–2 / 1–2 ticks, so 1/1/2 is consistent under phase dependence.

**VERDICT: regen is strongly supported; ROM-claim is out. NOT proven** — n=3 and
the tick phase is unmeasured. **The drift was still NOT fixed**, per §23. The
warning STRING is now known to name the wrong suspect; rewording it is a
separate, tiny change nobody has authorised.

## The suite, and what the +2 actually is

Final: **11 failed files / 99; 72 failed, 1618 passed, 1 skipped (1691).**
Inherited was 70/1602/1673. **+2 failures, +18 tests, all from this session's
three dungeon fixtures** — attributed by moving the three new fixture dirs aside
and re-running `boons.test.ts` + `enemies.test.ts`: **4 failures without them,
6 with.**

The two new failures are **two first-ever boon pairs with no model**, from run 3:
```
FAIL tests/boons.test.ts > AddVulnerableSword — run-2026-08-24-01-04-21 state-105.json→state-106.json
FAIL tests/boons.test.ts > AddBurnShield      — run-2026-08-24-01-04-21 state-123.json→state-124.json
AssertionError: <Type> has a pair but no model: expected undefined to be defined
```

⚠ **Read the assertion, not the `describe` name.** The block is titled *"every
modelled boon reproduces its recorded delta"*, which reads like a model
mismatch. The assertion that actually fires is `has a pair but no model`. These
are the **same class as session 87's `WeakeningMastery`**. I initially misread
this and corrected it against the assertion text.

`boon_run_coverage` recorded it independently and agrees:
```
run 1: picked 6 | firstEver 0 | unmodelledPicked []
run 2: picked 4 | firstEver 0 | unmodelledPicked []
run 3: picked 7 | firstEver 2 | unmodelledPicked ["AddBurnShield","AddVulnerableSword"]
```

So **three unmodelled boon pairs now sit in the corpus across two consecutive
sessions** — `WeakeningMastery` (s87), `AddVulnerableSword` + `AddBurnShield`
(s88). All three have a recorded before→after state pair, so modelling them is a
pure offline read costing no run-unit. That is the cheapest real work available
next, and it legitimately shrinks the red suite by 3 without renegotiating any
pinned claim.

The remaining two of the six adjacent failures are mechanical count pins
(`OBSERVED_OFFERS`, `enemies.test.ts`'s distinct-loadout count).

**The six session-87 reversals were NOT touched**, per the brief and DECISIONS.

## `assertionCoverage.ts` — BLOCKED, not passed

```
★★★ the suite did not pass. Fix that first — counts from a partial run mean nothing.
```
It fails closed on a red suite. The brief asked for "zero vacuous"; that check
**cannot run** while the suite is red by user directive, and I did not work
around it. It stays blocked for as long as the red stands.

## Verification at the final commit
```
npx tsc --noEmit                          clean (exit 0)
git diff --check                          clean
npx vitest run tests/discoveredShipsClean.test.ts    8 passed
npx vitest run                            72 failed | 1618 passed | 1 skipped (1691), 99 files
secret scan (0x{4,}, noobId, eyJ, PRIVATE) across all changed paths   clean
.gitignore                                .env, *.key, data/, logs/, profiles/,
                                          fixtures/**/raw/, fixtures/**/*.har all PRESENT
                                          config/discovered.json deliberately NOT ignored
scripts/assertionCoverage.ts              BLOCKED by the red suite (see above)
```
No source file was edited this session. No test writes a real data path — no
test construction was added or changed.

## Standing captures, unchanged
- **Base-6/8/10 crit: still not seen.** `critEffects` appears **0 times** in all
  three run logs. Four juiced runs now without it.
- **Oil at a non-zero meter: still impossible** — Focus Oil stock is 0, and it is
  unreachable from the dungeon side regardless.
- `WeakeningMastery` did **not** recur in any of the three runs.
