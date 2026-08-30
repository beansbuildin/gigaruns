# STATE — session 110 — 2026-08-29 — code at commit 77de83c6

## Status
Brief was **fishing only, two steps: (0) fix fishing's never-tracked Hard Core
income and backfill it, then (1) the fishing batch. GATE PASS on both.** No
dungeon work was authorized and none was done — today's dungeon ledger was
already 12/12 from session 109.

**[session 110b] The user repaired the rod (0 -> 40) and authorized the day's
remaining 7 casts, which ran clean. The guard-day is now FULLY SPENT at 20/20.**

Live spend, both halves: **22 fishing casts played / 20 charged, 264 energy,
14 Relaxing Oils, 22 rod durability, 0 dungeon runs.** Fishing ledger **20/20 —
exhausted**, next window 11:00 Pacific. Rod ends the day at **33**, so the next
fishing session is NOT durability-blocked.

Suite **2147 passed / 2147, 111 files** (re-run against the final commit) (`vitest run --maxWorkers=4`; the
default over-subscribes this machine and produces FALSE timeouts — unchanged).
`tsc --noEmit` clean, `git diff --check` clean, secret scan **0 hits on all
four patterns over 117 files with a positive control (127 `docId` hits) proving
the scan actually read them**, `discoveredShipsClean` 8/8, `.gitignore` verified
on all seven required paths.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. Entries marked **[USER]** are user
directives an agent may not re-open at all.

**Dropped this session** (all four now self-enforcing, none at risk of being
re-proposed): **`AddLifestealSword` is modelled** and **room 11 / `Enemy Room
73`** (both are in `src/sim/` with tests that fail if removed); **the loadout
holds steady**; and **consumables are debited at `start_run`** (measured, quiet
for two sessions).

- **Fishing's Hard Core income is TRACKED and BACKFILLED, and the amount is
  NOT a constant.** It tracks fish rarity — base 0→80, 1→160, 2→320, 3→400,
  4→480 — and 15 of 129 catches paid an exact 2x or 4x multiple with no
  distinguishing field on the response. Escaped casts pay 0 (measured, 159/159).
  DECISIONS 2026-08-29. Re-opens as: *"add a Hard Core column to the fishing
  report"*, *"measure what fishing pays per catch"*, or *"is it 320 per catch"*
  — the last is the session-15/16 single data point and is rarity 2 only.
- **A fishing batch must be sized to ROD DURABILITY, not to the cast cap.** The
  durability preflight runs ONCE before the batch, never per cast, so a batch
  longer than the rod does not halt — it drives the rod past 0. 1.00/cast is a
  closed bracket (now n=75 over four batches). Re-opens as: *"run the full
  20/25 casts"* when the rod reads less than that.
- **`damageEconomy`'s meanDamage band was WIDENED 5.5 → 6.0 on a mechanism,
  not ratcheted.** Looted cards run 5–11 damage against a base deck of 5s, and
  the deck has grown 10 → 18, so the mean rises monotonically with play.
  Re-opens as: *"mean damage is drifting, find the bug"* — check deck size
  first. It is a magnitude band and must not become a re-derived pin.
- **[USER] Chaining is a ONE-TIME, DATED exception, not a rule change.**
  Rule 11 pins `--runs=1` with a stop between runs. DECISIONS 2026-08-29.
  Re-opens as: *"chain the runs like last time."*
- **The guard-budget day-key straddle, FIXED IN DATA not in code.** A process
  crossing 11:00 PT stamps its CUMULATIVE counters onto the new day.
  DECISIONS 2026-08-29, QUESTIONS §65. Re-opens as: *"the guard ledger and the
  server disagree"* — the correction is done; the CODE FIX is genuinely open
  and is the one carried task.
- **`BurnMastery` amplifies the burn TICK, not the recorded amount.** 719/719
  exact without it, 0/12 with. **x2 vs +3 is UNSEPARATED.** DECISIONS
  2026-08-29. Re-opens as: *"burn has exceptions again"* — *"BurnMastery
  doubles burn"* is NOT settled.
- **The zero-stat proc control is falsified for `intuitionProc0` ONLY**, 1 event
  in 1716, and **the mapping SURVIVES** on a dose-response. DECISIONS
  2026-08-29. Re-opens as: *"a proc flag fired at stat 0, the mapping is
  broken."* It is a base rate.
- **JEBAITOR, and its gap, MEASURED.** ~9% of casts do not count against
  `dayDocs` (this session: 2 of 15 = 13.3%). Re-opens as: *"the cast ledgers
  disagree."* **A sub-25-cast batch is NOT evidence the budget is too low.**
- **Tier-1 Hard Core payout.** MEASURED, not derived: `dropMultiplier` governs
  item 845 ONLY, at an exact 4:1 quantum. DECISIONS 2026-08-28. Re-opens as:
  *"measure the first live Tier-1 run."*
- **The no-proc null.** Damage = attacker's `currentATK` on 1645/1645
  status-clean exchanges. DECISIONS 2026-08-28. Re-opens as: *"the null rate is
  falling"* — a MIXED-population rate is composition-bound.
- **`tenacity` / `intuition` as damage mitigation RULED OUT, and tenacity
  PICK-ORDER RETIRED.** §58, §62, §63. Re-opens as: *"find what tenacity
  does"* — heal AMOUNTS are what is open.
- **`triggeredBoons`.** CLOSED — 0 non-empty of 10,616. DECISIONS 2026-08-26.
  Re-opens as: *"settle whether triggeredBoons populates."* **No runs may be
  spent on it.**
- **`SecondWind` / `Steadfast`.** Ordinary volume WILL NOT settle these — a
  positive finding, not missing data. DECISIONS 2026-08-27.
- **[USER] Rule 11 entry tier is Tier-1 (`--juiced-index=1`), 0 rings.**
  `data.index` is the TIER; `entryData` is ordered 2, 1, 3. Exercised live
  **10/10**. Re-opens as: *"correct the juiced index"* — a positional 'fix'
  selects Tier 2 and spends silver rings.
- **[USER] Unspent skill XP.** CLOSED, not deferred. §61.1 forbids re-raising
  it. Re-opens as: *"report the accumulated unspent skill XP."*
- **Suite invocation.** `vitest run --maxWorkers=4`. DECISIONS 2026-08-26.

## What works
- **Step 0 — Hard Core tracking, built on the dungeon side's own split.**
  `fishingCorpus.ts` carries the wire's top-level `gameItemBalanceChanges`
  verbatim (same field and placement as `CorpusState`); `fishingReport.ts` is
  the layer that knows 845 means Hard Core, importing `ITEM_HARD_CORE` from
  `dungeonReport.ts` rather than re-declaring it. Backfilled the whole corpus
  with **no new spend** and cross-checked against an independent Python
  aggregation — both give **19,520 over 273 casts** pre-batch.

  | population | casts | caught | Hard Core | per catch | per cast |
  |---|---|---|---|---|---|
  | **session 102** (2026-08-26 PT) | 20 | 14 | **2,560** | 182.9 | 128.0 |
  | **session 105** (2026-08-28 PT) | 21 | 14 | **3,360** | 240.0 | 160.0 |
  | **this session, batch 1** | 15 | 9 | **2,640** | 293.3 | 176.0 |
  | **this session, batch 2** | 7 | 5 | **640** | 128.0 | 91.4 |
  | **this session, whole day** | 22 | 14 | **3,280** | 234.3 | 149.1 |
  | **full corpus, now** | 295 | 134 | **22,800** | 170.1 | 77.3 |

- **Step 1 — the batch, in two authorized halves.** `--casts=15` then, after
  the user repaired the rod, `--casts=7`. Both clean exits, **22/22 played,
  139 POSTs, 0 first-attempt failures, 0 sanity rows**, no fail-closed stop.
  Day catch rate **14/22 = 63.6%**, 95% Wilson **[43.0%, 80.3%]** — overlapping
  sessions 102 (70.0%), 105 (66.7%) and 107 (54.5%) at every point.
- **Sized to the rod and it was the right call.** Batch 1: 20 casts available
  and the budget allows 25, but durability read **15** live, so 15 was the
  size. **1.00/cast re-confirmed twice more** — 15 → 0, then 40 → 33 over 7 —
  making it a fifth and sixth confirming batch.
- **The cast cap, not the rod, closed the day.** With a 40-durability rod the
  binding constraint reverted to `dayDocs`, and all 7 remaining casts charged
  (**no JEBAITOR proc in the second half**, against 2 of 15 in the first).
- **The oil policy behaved exactly as shipped.** 14 Relaxing (937) over the
  day, **0.64/cast**, all fourteen in **seven double-lethal firings** (2 each).
  The per-cast cap of 2 was reached without binding again; **0
  `oil_trigger_no_stock`**, so no cast left the outcome arms; 32 Focus triggers
  correctly dropped as WITHDRAWN-BY-POLICY.
- **Rule 13 exercised after each half.** `dayDocs[pond 2]` 13/20 then 20/20,
  repo ledger agreeing at both, and all 22 reconcile events accounted for.

## What's broken
- ⚠ **The APPROVED on-demand single-lethal trigger did not fire once in 22
  casts.** Every one of the day's 14 oils came from the **double-lethal**
  band — the user override the sim does not recommend (QUESTIONS §30). The
  policy the user actually approved (rule 4) has now gone a full day
  unexercised while the override did all the work. Not a malfunction; the
  `fishHp <= 2` condition simply never arose. But it means the oil arm's
  outcome data is measuring the override, not the approved policy.
- ⚠ **Oil stock rose 14 → 23 between the two halves without the bot moving
  it** — the user crafted more. Recorded so a future reader does not read it
  as an accounting error.
- ⚠ **The guard-budget day-key straddle is UNFIXED IN CODE**, and
  `liveFishing.ts:1799` uses the identical pattern while running autonomously.
  Failure direction is SAFE (over-counts → blocks casts, never over-spends).
  QUESTIONS §65 has the fix design. Carried UNCHANGED from session 109.
- ⚠ **`LossBlockUp` has a live pickup pair and no model** — deliberately.
  QUESTIONS §64 asks for the directive. **Third session blocking**, carried
  unchanged from 108 and 109.
- ⚠ **Card 84 has no on-grid footprint and the bot may still loot it.** It
  JOINED the guaranteed-miss set this batch (was `[1,3,4,6,35]`).
  `chooseNewCard` has no deck-composition term — TASKS.md §13, still NOT
  STARTED. This is the second observed instance of the shape §13 exists to
  price, not a quantified cost.
- **The JWT expires and blocks the whole session.** Valid to 2026-09-04T18:48Z.
  No renewal path in-repo; manual copy from the browser.

## Corrections to SPEC.md
- **None. `SPEC.md` and `SPEC-fishing.md` were not touched** — nothing in the
  live responses contradicted them. `SPEC-fishing.md` §4's claim that fishing
  credits Hard Core on every catch was CONFIRMED at corpus scale (129/129
  catches, 0/159 non-catches), not corrected.
- **A brief correction, not a spec one:** the brief dated session 102 to
  2026-08-25; the log header and the fixtures both say **2026-08-26 PT**.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Do not key the Hard Core credit on the terminal response or on one
  `message`.** It arrives on `"Cards played successfully."` 68 times and on
  `"Item used successfully."` 52 times (an oil that landed the kill in the same
  action). `summarizeFishingCast` SUMS over the cast's responses for exactly
  this reason.
- **Do not hardcode the rarity ladder into report prose.** Step 0 did, writing
  "all 120 caught casts"; the batch made it stale **within the same session**.
  It is derived from the records now.
- **Do not read the non-1x Hard Core multiples as an era change.** They are
  absent before 2026-08-21 (0/14) and 12/106 after, which is not separable from
  a flat ~10% rate at that n. This batch's 3-of-9 has P=0.053 against that base
  rate — suggestive, not a finding.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Metrics
- **Live: 22 fishing casts played / 20 charged, 264 energy, 14 Relaxing Oils,
  3,280 Hard Core, 0 dungeon runs, 0 rings.** Day closed at 20/20.
- Catch rate **63.6%** (14/22), 95% Wilson [43.0%, 80.3%]. By half: 9/15 =
  60.0%, then 5/7 = 71.4%.
- **0 first-attempt failures / 139 POSTs.** JEBAITOR **2 of 22 = 9.1%** — 2 in
  the first half, **0 in the second**, landing exactly on §34's ~9%.
- Rod durability **15 → 0**, repaired to 40, then **40 → 33**. 1.00/cast on
  both, n=22 this session, fifth and sixth confirming batches.
- Corpus **273 → 295 fishing casts, 120 → 134 caught**; dungeon unchanged at 93.
- Suite **2138 → 2147** (+9: 7 Hard Core regression cases, 2 ladder-derivation
  cases). **114 pre-existing assertions re-derived** across 9 files, in two
  passes (58 after the first batch, 56 after the second).

## Open questions for Claude
1. **Should the approved on-demand oil policy be re-derived, or the
   double-lethal override formally adopted?** 22 casts produced **zero**
   single-lethal firings and 7 double-lethal ones. The oil arm is measuring the
   override, and the approved policy is effectively dormant. This is a user
   decision (rule 4 — timing policy needs approval), not an agent one.
   **New this session.**
2. **Fix the guard-budget rollover straddle in code?** QUESTIONS §65 has the
   design. It bit twice in two sessions and reaches autonomous fishing.
   **The one concrete carried task.**
3. **`LossBlockUp` — may it be modelled as `latent` from n=1?** QUESTIONS §64.
   Same n and measurement as session 99's `LossIntuitionUp`, which the user
   approved. **Third session blocking.**
4. **The `nextPosition` override is LIVE and steering fishing card choice**
   with still no user sign-off. Carried UNCHANGED from sessions 105–109 —
   **sixth session**. It logged `ARMED (no miss on record)` again this batch.
5. **Is the Tier-1 dungeon arm now the baseline for everything downstream?**
   Session 103's Tier-3 numbers are not comparable on any payout statistic and
   several reports still quote them. **Sixth session unactioned.**
6. **Should `chooseNewCard` get a deck-composition term (TASKS.md §13)?** Card
   84 joined the no-on-grid-footprint set this batch, and the bot has now been
   observed looting a guaranteed-miss card twice.
7. **BurnMastery: x2 or flat +3?** Unseparable; arrives on its own through
   play. Spend no runs on it.
8. **The fishing guard counter over-counts**, separately from the straddle
   (session 107 saw `runsStarted` 25 on a 22-played / 20-charged batch).
   Carried from 107.

## Files changed
```
 src/sim/fishingCorpus.ts                   |  21 +
 src/sim/fishingReport.ts                   |  90 +-
 scripts/liveFishing.ts                     |   2 +-
 tests/sim/fishingReport.test.ts            | 172 +-
 tests/fishing/{castEra,damageEconomy,matcherHeadroom,oilReachability,
   redrawCounterfactual,redrawShadowAnalysis,stateFields,zoneTemplate}.test.ts
                                            | 316 +-   (the ratchet)
 tests/sim/fishingCorpus.test.ts            |  20 +-
 handoff/reports/fishing-casts.md           | 584 +-
 fixtures/fishing-casts/live/cast-2026-08-30-*  | 97 files (new, 15 casts)
 117 files changed, 64272 insertions(+), 530 deletions(-)
```
