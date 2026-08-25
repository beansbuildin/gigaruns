# STATE — session 94 — 2026-08-24 (PT) — code at commit 4be8e2a9

## Status
**GATE PASS on the session's task — all four juiced runs delivered.**
**⚠ SUITE IS RED AT HANDOFF: 6 failed / 1773 passed (1779).** Both facts are
load-bearing; neither cancels the other. Every failure is the designed
new-fixture wall tripping on the runs this session was authorized to make, all
six are diagnosed below, and **no existing model was contradicted** — but the
suite is red and closing it is real modelling work, not a regeneration.
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean (422 files,
zero matches on all four patterns), `discoveredShipsClean` 8/8, no `raw/`
committed.

**The session ran 2+2 in a different shape than the brief specified, by explicit
user override mid-session** — see Dead ends. Rule 11 is untouched.

## What works
- **Four juiced Tier-3 runs, all four conditions held every time** — `--juiced`,
  `--juiced-index=3`, 3x Big Heal Juice (131), `--runs=1`. Deaths at rooms
  **8, 4, 7, 7**; zero cleared. `TIER-CHECK ... OK` in every room of every run.
- **ZERO action failures across all 4 runs — 0/196 posted actions**, no retries,
  no stale action tokens, no guard trips. Per-run: 0/60, 0/34, 0/50, 0/52.
- **Rule 13 discharged after every run.** `dayProgressEntities` read from the
  server after runs 1, 3 and 4: 3 → 9 → **12 of 12**. The day's dungeon
  allowance is fully and exactly spent; a 5th run is server-refused.
- **§1 preflight exercised the real gates, not raw endpoints** (rule 12).
  `liveRun.ts --dry-run` with the exact run-1 flags: clean. Potions 54 in stock
  against 12 needed. Run-units 0/12 at session start.
- **`handoff/reports/dungeon-runs.md` regenerated and picked up all four**
  (cids 25066942, 25067064, 25067282, 25067399). 75 recorded attempts, 30 juiced.

## What's broken
- **⚠ SUITE RED — 6 failures in 2 files. Diagnosed, NOT papered over:**
  - **3x `has a pair but no model`** (`tests/boons.test.ts`): `AddWeakMagic`,
    `VulnerableCrit`, `Regen` — all three from **run 4**
    (`run-2026-08-25-03-30-48`). These are **first-ever PICKUP PAIRS**. No
    modelled boon's recorded delta broke. Closing them means deriving each
    effect from its before/after pair — real modelling work, deliberately NOT
    attempted at the tail of this session, because inventing a `BOON_MODELS`
    entry poisons the sim (session 93 refused hand-editing pins for this reason).
  - **1x `covers every boon type the corpus has a pair for`** — the aggregate of
    those three. Goes green only when they are modelled.
  - **1x `OBSERVED_OFFERS is exactly what the corpus recorded`** — table **227**
    vs corpus **249**, i.e. **+22 offers** from today's four runs (session 82 saw
    +21 from its four). ⚠ **Additivity was NOT verified this session.** The next
    session must re-run session 93's check — rows in corpus absent from table
    vs **zero** the other way — BEFORE regenerating.
  - **1x `tests/enemies.test.ts` loadout combos** — **purely additive**, three
    additions (`40/24`, `40/26`, `40/28`), **zero removals**.
  - ⚠ Suite was 1757/1757 green at the handoff commit. The **+16 new passing
    tests** are per-pair cases the new fixtures generated; the 6 reds are the
    wall.
- **⚠ `scripts/claimRoms.ts` silently accepts and ignores `--dry-run`.** There is
  no `dryRun` handling in the file. Passing the flag performed the **real**
  claim: 4 ROMs, energy 156 → 315 (+159). Harmless — a claim is a gain, and
  `liveRun.ts`'s preflight does it autonomously under rule 12 — but the script
  accepts an unknown flag without erroring, which is a fail-closed violation.
- **⚠ The `energy accounting drift` warning names the WRONG CAUSE, and it fired
  4/4 runs.** It says *"possible external balance change (e.g. a ROM claim)
  landed mid-run"*; **no ROM claim happened during any run.** Observed delta was
  59 vs committed 60 on all four. Between-run readings rise unaided
  (256→257, 198→200, 141→142) = passive regen at 18/hr ≈ 0.3/min over a ~6-min
  run. **The drift is in-run regen and will fire on every run of nontrivial
  length.** Nothing is mis-budgeted (the guard enforces off committed spend,
  CODEXREVIEW #8); only the suggested cause is wrong.
- **⚠ Instrument discrepancy — the third of its class.** Run 4's stdout reported
  *"6 type(s) picked, **2** of them still UNMODELLED (first-ever candidates)"*,
  but `boons.test.ts` finds **3** unmodelled run-4 pairs.
  `boonRunCoverage.ts:79` sets `firstEverCandidates` per-run; the test extracts
  pairs corpus-wide. One reader is missing a pick. **This is exactly session
  93's open-question-3 class** (an end-of-run instrument unchecked against the
  shape the current policy produces).
- Carried, untouched: the 10-cast fishing batch still owed; gate-1 re-audit; the
  two unpaid redraw correctness gaps (`liveFishing.ts:2471`, `:1526`); pacing
  term's cause; H2's proc model; §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT
  BE QUOTED**.

## Corrections to SPEC.md
- **None this session.** No live response contradicted the spec; `SPEC.md` and
  `SPEC-fishing.md` are untouched.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Rule 9, applied to my OWN inference rather than to the brief.** Run 4's
  room-7 `ORB FALLBACK` took `Regen` (28 HC out of `[22,28,19]`) over ranked
  `AddBlock` — `Regen` being one of config's five `boonCapture.targets`, with
  boonCapture **OFF**. I nearly wrote this up as a discovery: the wide orb rule
  buying, at zero deliberate cost, a pair `boonCapture` exists to buy
  deliberately. **`src/sim/boons.ts:1600` already records it from session 60**,
  and session 82 saw it again at `:1865`. Third occurrence of a **known**
  mechanism, not a finding.

## Dead ends
- **Modelling the three new boon types — NOT ATTEMPTED, deliberately.** Deriving
  a `BOON_MODELS` entry from a single before/after pair at the tail of a session
  is how the sim gets poisoned. Left red with the diagnosis instead. Sessions 89,
  90 and 91 each handed off a red wall test and were judged correct to.
- **Regenerating `OBSERVED_OFFERS` — NOT ATTEMPTED.** Three of the six failures
  need modelling regardless, so the suite could not reach green this session
  whatever I did to the table; a partial, unverified regeneration would have
  bought nothing and risked the exact hand-editing session 93 refused.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED; `boonCapture` OFF;
  `dendren.dailyEnergyBudget` 252 STANDING.

## Metrics
- **Live: 4 juiced dungeon runs, 4 deaths, 0 cleared** — rooms **8, 4, 7, 7**.
  **23,664 Hard Core, 1,122 Dendren Root**, 240 energy committed (236 observed).
  Big Heal Juice **54 → 42**, exactly 3/run, 4/4. Energy 315 → 83.
- **Run-units 12 / 12 — the day's entire dungeon allowance, exactly.** Repo
  budget also landed on the nose: 240 of `forbiddenWoods.dailyEnergyBudget` 240.
  `guards.ts:89` trips on `spent + cost > budget`, so run 4 passed at exactly
  240 with **zero headroom** — no fifth run and no other dungeon spend today.
- **EV support 0/49, 0/31, 0/41, 0/43 — 100.0% unsupported, all four runs.**
  This is rule 8's accepted cost (SPEC §4e), flagged by the tool itself as
  *"EXPECTED, not a fault."* **Do not "fix" it.**
- Boon coverage after run 4: 34 modelled, **21 offered-but-unmodelled**, 65
  room-1 offers of 227. `UNMODELLED_TYPES` still **21** — ⚠ a pickup pair is
  raw data CAPTURED, not a type MODELLED.
- Today's depth profile (8, 4, 7, 7) is near-identical to session 82's four
  juiced runs (8, 3, 7, 7).
- Fishing: **untouched this session.** 189 casts, unchanged.
- Suite **1757/1757 green → 1773 passed / 6 failed (1779)**.

## Open questions for Claude
1. **The three unmodelled first-ever pairs are the obvious next task, and they
   are a modelling job, not a regeneration.** `AddWeakMagic`, `VulnerableCrit`,
   `Regen`, all in `run-2026-08-25-03-30-48` (states 009→010, 055→056,
   105→106). A brief should say explicitly whether to model from a single pair
   or wait for a second observation of each.
2. **`OBSERVED_OFFERS` is +22 and its additivity is UNVERIFIED.** Session 93's
   check is the precedent and must be re-run before regenerating.
3. **The 10-cast fishing batch is still owed** and is now two sessions old. The
   redraw-shadow puzzle (0/52, 4/24, 0/2 — Fisher p = 0.008) still needs volume.
4. **Two instrument bugs are worth one cheap brief between them**: the
   `firedOil`-class reader discrepancy in `boonRunCoverage.ts` (2 vs 3), and the
   energy-drift warning's wrong cause. Both are wrong *text and counts* on
   correct *enforcement* — low risk, high legibility payoff.
5. **`config/bot.json`'s `_boonCaptureComment` now carries a stale cost model.**
   It prices boonCapture at "~27 runs to model all five" from session 55's
   measurement that `pickBoon` top-ranks an unmodelled type **0/540** times.
   That measurement predates the **wide orb rule**, which demonstrably picks
   unmodelled types for free — three times today. The comment is not wrong about
   session 55; it is wrong as a current forecast.
6. **`scripts/claimRoms.ts` should reject unknown flags** (fail closed, rule 5).

## Files changed
```
 1 commit. 4 new live run fixtures (196 states), reports regenerated.

  A  fixtures/dungeon-runs/run-2026-08-25-03-07-57   run 1, death room 8, 60 states
  A  fixtures/dungeon-runs/run-2026-08-25-03-14-16   run 2, death room 4, 34 states
  A  fixtures/dungeon-runs/run-2026-08-25-03-25-26   run 3, death room 7, 50 states
  A  fixtures/dungeon-runs/run-2026-08-25-03-30-48   run 4, death room 7, 52 states
  M  handoff/reports/dungeon-runs.md                 71 -> 75 attempts
  M  handoff/reports/fishing-casts.md                regenerated, 189 casts unchanged
  M  handoff/STATE.md, handoff/log/session-94.md, handoff/DECISIONS.md
```
