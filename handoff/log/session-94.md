# Session 94 — 2026-08-24 (PT) — four juiced dungeon runs

**Task (brief):** four 60-energy juiced Tier-3 Forbidden Woods runs, structured
as two pairs with a hard pause after the first two.
**Result: GATE PASS on the task — four runs delivered.
⚠ SUITE RED AT HANDOFF — 6 failed / 1773 passed (1779).**

---

## 1. §1 preflight — every gate exercised, not reasoned about

| Check | Reading | Verdict |
|---|---|---|
| `dayProgressEntities` (dungeon 5) | **null → 0 of 12** | full 4-run allowance |
| Big Heal Juice (131) | **54**, need 12 | ample |
| Energy pool | 156 → **315** after ROM claim | covers run 1's 60 |
| `forbiddenWoods.dailyEnergyBudget` | **240**; 4 x 60 = **240** | fits EXACTLY |
| `liveRun.ts --dry-run`, exact run-1 flags | clean, no guard trips | PASS |

`guards.ts:89` trips on `energySpent + estimatedEnergyCost > dailyEnergyBudget`
— **strictly greater** — so run 4 lands at exactly 240 and passes. Zero headroom
remained for any other dungeon spend today. This was surfaced at the top of the
session rather than discovered at run 4, per the brief's §1 ask.

The guard ledger (`data/guard-budget.json`) read `date: 2026-08-23,
energySpent: 240, runsStarted: 12` at session start, and reset for the new date
as designed.

## 2. The four runs

| # | cid | outcome | Hard Core | Dendren Root | energy | actions | EV support |
|---|---|---|---|---|---|---|---|
| 1 | 25066942 | death @ room 8 | 7,776 | 420 | 60 | 0/60 fail | 0/49 |
| 2 | 25067064 | death @ room 4 | 3,024 | 84 | 60 | 0/34 fail | 0/31 |
| 3 | 25067282 | death @ room 7 | 6,912 | 309 | 60 | 0/50 fail | 0/41 |
| 4 | 25067399 | death @ room 7 | 5,952 | 309 | 60 | 0/52 fail | 0/43 |

**Totals: 23,664 Hard Core, 1,122 Dendren Root, 4 deaths, 0 cleared, 240 energy,
0 failures across 196 posted actions.** Potions 54 → 42, exactly 3/run.

Rule 11's four conditions held on every run: `--juiced`, `--juiced-index=3`,
3x itemId 131, `--runs=1`. Rule 8's `TIER-CHECK` printed `OK` in every room,
e.g. run 1 room 8: `rule=highest offered=[1,0,1] taken=1 eligibleTop=1
perpetualFilteredTop=false OK`.

**Rule 13 discharged after runs 1, 3 and 4** — server `dayProgressEntities`
read **3 → 9 → 12**. No denial/interruption occurred this session, but the
ledger was read anyway rather than inferred from tool output.

### 2a. Deviation from the brief's structure — user override, recorded

The brief specified run 1 → stop → run 2 → **hard pause** → runs 3 and 4 on a
fresh go-ahead. What actually happened:

1. Run 1: plan presented, **separate explicit go-ahead**, executed, reported,
   stopped for skill points. **As briefed.**
2. The user then said, verbatim: *"you are authorized for this session
   specifically to complete to more runs back to back without a pause for my
   approval… proceed with runs 2 and 3 back to back then report the results
   before run 4."*
3. Runs 2 and 3 executed back to back on that authorization, reported together.
4. Run 4: **its own separate go-ahead** (*"run 4 go ahead"*), executed, reported.

**This is a user decision, taken explicitly, scoped to this session, and it does
NOT generalise.** Rule 11's per-run gate is untouched for every future session.
One consequence was flagged to the user before running: back-to-back runs 2 and
3 gave up the skill-point allocation window between them.

## 3. What the runs surfaced

### 3a. The energy-drift warning names the wrong cause (fired 4/4)

```
⚠ energy accounting drift — committed 60 vs observed 59; guard enforced off
committed spend (CODEXREVIEW #8), not the observed delta. Possible external
balance change (e.g. a ROM claim) landed mid-run.
```

**No ROM claim happened during any run** — the only claim was ~2 minutes before
run 1's `start_run`. The delta was 59-vs-60 on **all four** runs, and pool
readings rise between runs unaided: 256→257, 198→200, 141→142. Passive regen is
18/hr = 0.3/min; a run takes ~5–7 minutes ⇒ ~+1.5 energy recovered mid-run.
**The drift is in-run regen.** It is systematic, not exceptional, and will fire
on every run of nontrivial length. Enforcement is correct (committed spend);
only the warning's suggested cause is wrong.

### 3b. Three first-ever boon pickup pairs — via a KNOWN mechanism

Run 4, room 7:
```
▸ reward: ORB FALLBACK — no priority family on offer; taking "Regen" (index 1)
  for 28 Hard Core out of [22, 28, 19] instead of ranked "AddBlock".
```
`Regen` is one of the five `boonCapture.targets`, and `boonCapture` is **OFF**.
So the wide orb rule bought — at **zero deliberate quality cost** — a pickup
pair that `boonCapture` exists to buy by deliberately taking a worse boon.

⚠ **I nearly recapped this as a discovery.** It is not:
`src/sim/boons.ts:1600` records it from **session 60** ("two of these four
offers produced first-ever pickup pairs … because the orb rule took the richest
Hard Core payout where no priority family was on offer"), and `:1865` records
session 82 seeing it again. **Third occurrence of a documented mechanism.**
Rule 9 applies to the agent's own inferences, not only to the brief's claims.

⚠ **A pickup pair is raw data CAPTURED, not a type MODELLED.**
`UNMODELLED_TYPES` is still 21 and `boonCoverage.ts` still lists `Regen` at 8
offers unmodelled.

⚠ **Stale cost model in config.** `_boonCaptureComment` prices boonCapture at
"~27 runs to model all five", reasoning from session 55's measurement that
`pickBoon` top-ranks an unmodelled type **0 times in 540 decisions**. That
measurement predates the wide orb rule (session 58). It is not wrong about
session 55; it is wrong as a current forecast.

### 3c. `scripts/claimRoms.ts` ignores `--dry-run`

There is no `dryRun`/`--dry-run` handling anywhere in the file. Invoking
`npx tsx scripts/claimRoms.ts --dry-run` performed the **real** claim: 4 ROMs,
energy 156 → 315 (+159). No harm — a claim is a gain, and `liveRun.ts`'s own
preflight performs it autonomously under rule 12 — but **an unknown flag was
accepted silently**, which is a fail-closed violation (rule 5). Reported to the
user in-session rather than absorbed.

### 3d. Instrument discrepancy — 2 vs 3

Run 4 stdout: *"6 type(s) picked, **2** of them still UNMODELLED (first-ever
candidates)"*. `tests/boons.test.ts` finds **3** run-4 pairs with no model
(`AddWeakMagic` 009→010, `VulnerableCrit` 055→056, `Regen` 105→106).
`src/sim/boonRunCoverage.ts:79` sets `firstEverCandidates: unmodelledPicked.length`
per-run; the test extracts pairs corpus-wide. One reader is missing a pick.
**Same class as session 93's open question 3** — an end-of-run instrument never
checked against the shape the current policy produces. Third such reader.

## 4. Verification

```
tsc --noEmit                    clean (exit 0)
git diff --check                clean
secret scan (0x[a-fA-F0-9]{4,} | noobId \d | eyJ | PRIVATE)
                                422 files staged, 0 matches on all four
git check-ignore raw/           .gitignore:28 fixtures/**/raw/  — MATCHED, not committed
redaction spot-check            27x 0xUSER in run-4 state-000.json
tests/discoveredShipsClean      8/8 passed
handoff/reports/dungeon-runs.md regenerated, 71 -> 75 attempts, all 4 cids present
vitest run                      ⚠ 6 failed | 1773 passed (1779), 2 files failed
```

### 4a. The six failures, each diagnosed

| test | nature | additive? |
|---|---|---|
| `AddWeakMagic` pair | `has a pair but no model` | new pair, needs modelling |
| `VulnerableCrit` pair | `has a pair but no model` | new pair, needs modelling |
| `Regen` pair | `has a pair but no model` | new pair, needs modelling |
| `covers every boon type…` | aggregate of the above three | — |
| `OBSERVED_OFFERS is exactly…` | table **227** vs corpus **249** (+22) | ⚠ **UNVERIFIED** |
| `enemies.test.ts` loadouts | +`40/24`, +`40/26`, +`40/28`, 0 removals | **purely additive** |

**No existing model's recorded delta broke.** All three boon failures are
`expected undefined to be defined` at `tests/boons.test.ts:60` — the type has a
pair and no `BOON_MODELS` entry, which is the designed signal for a first-ever
capture.

Suite was **1757/1757 green** at the handoff commit. The **+16 new passing
tests** are per-pair cases the new fixtures generated.

### 4b. Why the suite was left red

Three of the six need a `BOON_MODELS` entry derived from a single before/after
pair. **Inventing one at the tail of a session poisons the sim** — session 93
refused hand-editing pins on exactly this reasoning, and sessions 89/90/91 each
handed off a red wall test and were judged correct to.

Because those three cannot close without modelling work, **the suite could not
reach green this session regardless of what was done to `OBSERVED_OFFERS`**. A
partial, unverified regeneration of a table carrying per-entry annotations back
to session 03 would have bought nothing and risked real damage. Left red, fully
diagnosed, with session 93's additivity check named as the required first step.

## 5. Ledger at handoff

- **Run-units 12 / 12** — the day's entire dungeon allowance, exactly spent.
  Resets 11:00 Pacific.
- **Repo energy budget 240 / 240** — zero headroom.
- Energy pool **83**; ROMs remain in the bank.
- Big Heal Juice **42**.
- Fishing untouched: 189 casts, the 10-cast batch still owed.
