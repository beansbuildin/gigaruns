# STATE — session 88 — 2026-08-23/24 (PT) — code at commit 94f9a6e4 (this commit; line stamped by its child)

## Status
**GATE PASS.** Three juiced Forbidden Woods runs, one at a time, each with its
own human go-ahead and a real pause between. `tsc --noEmit` clean,
`git diff --check` clean, `discoveredShipsClean` 8/8, secret scan clean.

**⚠ THE SUITE IS STILL RED AND IS NOW REDDER: 72 failed / 1618 passed / 1
skipped (1691), 11 failed files of 99.** It was inherited red at 70/1602/1673
by session 87's user directive. **+2 failures and +18 tests are ENTIRELY this
session's three dungeon fixtures** — attributed by moving the three new fixture
dirs aside and re-running (4 failures without them, 6 with).

- **The day's dungeon budget is now fully spent: `dayProgressEntities` 12/12.**
  Rolls over 11:00 PT. Fishing was already 20/20 before the session began.
- **Fishing was NOT touched, by design** — a scope choice from the brief, not a
  shortfall.
- **No fourth run was started**, per the brief. None was available anyway.

## What works
- **§1 / GATE — three juiced runs, each separately authorised, each followed by
  a rule-13 ledger read and a stop.** No two runs were chained.
  | run | result | Hard Core | orbs | ledger | tightDelta | EV support |
  |-----|--------|-----------|------|--------|-----------|------------|
  | `25036015` | death @ room 7 | 5952 | 309 | 3 → 6 | **−60 ✓** | 0/46 (100% unsup.) |
  | `25036128` | death @ room 5 | 4176 | 141 | 6 → 9 | **−60 ✓** | 0/39 (100% unsup.) |
  | `25036263` | death @ room 9 | 8160 | 546 | 9 → 12 | **−60 ✓** | 0/50 (100% unsup.) |
  - Every ledger read moved by **exactly 3**. Nothing was denied, blocked or
    interrupted, so there is **no rule-13 discrepancy to reconcile** this session.
  - **First-attempt failures 0/162** across all three runs, every action class.
  - Rule 8 held on **18/18 TIER-CHECKs, all `OK`**. The never-a-Perpetual clause
    was load-bearing **4 times** (run 1 rooms 5+6, run 3 rooms 7+9); at run 1
    room 6 it pushed the pick down to tier 0. No final-room case arose (deepest
    room 9 of `maxRoom` 16).
  - Rule 11 satisfied in every clause on all three: `--juiced --juiced-index=3
    --runs=1`, 3× itemId 131 from `config/bot.json` (stock 20 → 11).
- **`tightDelta -60, matchesCommitted true` on 3/3** — with session 87 that is
  **four consecutive runs**. The 3x multiplier stays exonerated (§23 branch 2).
- **`EV support` printed on 3/3** (0/135 pooled, 100% unsupported). EXPECTED
  under rule 8, not a fault. Session 84's `finishRun` fix is now verified live
  four times over.
- **Rule 12's energy path exercised and correct.** Run 1 preflighted `pool 36
  short of the planned 60`, read the ROM bank (37 ROMs / 2369 claimable),
  claimed **one** ROM (+170, **claim audit drift +0**) and proceeded. Runs 2 and
  3 needed no claim. A raw `energyValue` of 36 would have looked like a blocker.

## What's broken
- **The suite is red — 72 failures — and the six session-87 reversals were NOT
  touched**, per the brief and DECISIONS. Unchanged and still the user's to rule
  on: `neither = 0` → 6, dead hands 15 → 32, `wasted` 0 → 3, "thirtyfold" →
  ~6.5x, SPEC-fishing §4's `fishHp` exceptions 3 → 6, `REAL_DECK` vs the rod.
- **THE +2 IS TWO NEW FIRST-EVER BOON PAIRS, and they are a CAPTURE, not a
  defect:** run `25036263` picked **`AddVulnerableSword`** (state-105→106) and
  **`AddBurnShield`** (state-123→124), both with a pair and **no model** in
  `BOON_MODELS`. `boon_run_coverage` recorded it independently and agrees:
  `firstEverCandidates: 2`, `unmodelledPicked: ["AddBurnShield",
  "AddVulnerableSword"]`. Runs 1 and 2 recorded `firstEver 0`.
  - ⚠ **Read the assertion, not the `describe` name.** These fail under a block
    titled *"every modelled boon reproduces its recorded delta"*, but the
    assertion that fires is `has a pair but no model`. They are the **same class
    as session 87's `WeakeningMastery`**, NOT model mismatches. Session 87's
    `WeakeningMastery` failure is still there, so **three unmodelled pairs now sit
    in the corpus, from two consecutive sessions.**
  - The other +2-adjacent failures are mechanical pins: `OBSERVED_OFFERS` and
    `enemies.test.ts`'s distinct-loadout count.
- **`scripts/assertionCoverage.ts` COULD NOT RUN — it fails closed on a red
  suite** (*"the suite did not pass. Fix that first"*). The brief's "zero vacuous"
  check is therefore **BLOCKED, not passed**, and stays blocked for exactly as
  long as the suite is red by directive. Not worked around.
- **`scripts/preflight.ts` FAILS — the repo is currently NOT shareable, and the
  cause is the red suite.** It exports 304 tracked files to a clean tree, runs
  `npm install` + vitest there, and gets **72 failed / 1604 passed / 15 skipped
  (1691)** — the same 72. Its verdict: *"RED in a stranger's tree. Fix it or tell
  friends before they run it — a red suite on first contact is the single most
  likely reason someone quietly gives up."* Everything else in preflight is
  GREEN: exactly one `✗` in the empty-HOME `doctor.ts` run and it is the expected
  missing JWT, and the **secret scan of the exported tree is clean**. This is a
  real, previously unstated consequence of the leave-it-red directive and it is
  the user's to weigh — not an agent's to resolve by editing pins.
- **The energy-drift warning string names the wrong suspect** — see below. Not
  reworded (§23 says don't fix the drift), but it is now known to be misleading.
- Carried, untouched: the gate-1 re-audit; the two unpaid redraw correctness
  gaps (`liveFishing.ts:2471`, `:1526`); the pacing term's cause; H2's proc
  model; `play_cards`/redraw/`use_fishing_item` unrouted; §0a NOT lifted,
  **+19.40pp MAY NOT BE QUOTED**; §28 still OPEN and still blocking §26; Focus
  Oil stock still 0.

## Corrections to SPEC.md
- **None this session.** No live response contradicted SPEC; the three runs
  exercised already-documented shapes.
- **Carried and still unpaid from session 87:** SPEC-fishing §4's "three
  documented exceptions" to the `fishHp` rule is **six**, and the three new ones
  are still uncharacterised. This was session 87's stated first item for session
  88 and was **NOT done — the brief scoped this session to dungeon runs only.**
  It is still the first fishing-side item outstanding.
- **Two corrections to the session-88 brief, rule 9, both minor:**
  - The brief expects `1603 passed / 70 failed`. The real inherited shape is
    **1602 passed + 1 SKIPPED**, 1673 total. Same failure count; the brief folded
    the skip into the pass column.
  - The brief says the 3-run budget "could be a fresh 12 if the day rolled over."
    It had not: the session ran 17:45–18:15 PT on 2026-08-23 and session 87
    recapped ~17:30 PT the **same day**. Confirmed against the server, not assumed.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **None newly discovered.** The session ran the documented path three times.
- Session 87's lesson was **applied, not re-learned**: each run was issued as its
  own `--runs=1` command and backgrounded, so a stop had three places to land.
- Session 87's over-wide `find -empty` was **avoided**: the one dry-run stub
  (`fixtures/dungeon-runs/run-2026-08-24-00-47-25`, empty, untracked by git) was
  removed by **exact path**. `git status` unaffected.
- Standing, none re-opened: redraw CLOSED; energy is never a blocker; `--dry-run`
  before claiming a blocker; do not revert rule 8; +19.40pp SUSPENDED;
  `boonCapture` OFF; no H2 proc model; no M4 lines; no 429 backoff without an
  observed 429; do not shuffle the random-sample deck; do not import
  `todaysEraCastIds()` into a committed test; do not read `SIM blind` as a live
  proxy; do not restate session 86's finding without the word **UNIFORM**.

## Metrics
- **Live: 3 juiced dungeon runs (180 energy committed), 0 fishing casts.**
  `dayProgressEntities` **3 → 12 (12/12, day closed)**. Fishing 20/20, untouched.
- Deaths at rooms **7 / 5 / 9** (deepest 9). Hard Core **5952 + 4176 + 8160 =
  18288**; orbs **309 + 141 + 546 = 996**. All inside the documented juiced
  spread (rooms 3–10) — no run was anomalously short.
- First-attempt failures **0/162**. Boons picked 6 / 4 / 7 distinct types;
  `UNMODELLED_TYPES` 24 at the start of all three.
- Corpus: dungeon attempts **68 → 71**. Fishing unchanged at 168 casts.
- Suite **1602 passed / 70 failed (1673) → 1618 passed / 72 failed (1691)**;
  99 files, 11 failed, both before and after. `tsc` clean. **No source file was
  edited this session.**

## Open questions for Claude
1. **The red suite is still the user's to rule on and is now 8 sessions-worth of
   pins stale in places.** Session 87 offered (a)/(b)/(c) and the user chose (c).
   Nothing has changed that. Session 88 added only fixture-driven counts plus the
   two new boon pairs.
2. **Three unmodelled boon pairs are now on disk across two sessions** —
   `WeakeningMastery` (s87), `AddVulnerableSword` and `AddBurnShield` (s88). All
   three have a recorded before→after state pair, so building the models is a
   pure offline read with no live spend. This is the cheapest real work available
   and it shrinks the red suite by 3 legitimately, without renegotiating anything.
3. **§23 is now essentially closed and wants one cheap confirmation** — see below.
   The remaining unknown is the tick PHASE, measurable offline from timestamps
   across the four runs that now carry the probe.
4. **§28 is still OPEN and still blocks §26.** Untouched, as directed.
5. **Standing captures:** a base-6/8/10 crit (`critEffects` appears **0 times**
   in all three run logs — still not seen after 4 juiced runs); an oil consumed
   at a NON-ZERO meter (**impossible while Focus Oil stock is 0**).

## §23's remaining half — substantially ANSWERED, at zero extra cost
The open question was what credits energy back DURING a run. Three converging
pieces, all from runs that were being made anyway:
1. **ROM claim is FALSIFIED as the cause.** Run `25036128` made **no claim**
   (pool 148 already covered 60) and still drifted −1. The drift warning's own
   suggested culprit — *"Possible external balance change (e.g. a ROM claim)
   landed mid-run"* — is wrong.
2. **The pool was caught ticking mid-run, DIRECTLY.** Run `25036263`'s
   `energy_accounting` recorded `before: 90`; its own `start_run_energy_probe`,
   seconds later, recorded `energyBefore: 91`. **+1 between two reads inside one
   run's startup, with no claim in between.** An observation, not an inference.
3. **Drift tracks wall-clock DURATION in the right direction:**
   | run | duration | credited back |
   |-----|----------|---------------|
   | `25036128` | 2m43s | 1 |
   | `25036015` | 3m25s | 1 |
   | `25036263` | 4m06s | 2 |
   At 18/hr an integer pool ticks once per ~200s; windows of 163/205/246s hold
   0–1 / 1–2 / 1–2 ticks, so 1/1/2 is consistent under phase dependence.

**VERDICT: regen is strongly supported; ROM-claim is out. NOT proven** — n=3,
and the tick phase is unmeasured. **The drift was still NOT fixed** (§23 says
don't), but the warning STRING is now known to name the wrong suspect.

## Files changed
```
 1 commit.

  A  fixtures/dungeon-runs/run-2026-08-24-00-49-12   run 25036015 (death @ 7)
  A  fixtures/dungeon-runs/run-2026-08-24-00-56-03   run 25036128 (death @ 5)
  A  fixtures/dungeon-runs/run-2026-08-24-01-04-21   run 25036263 (death @ 9)
  A  handoff/scratch-session-88.md                   surprises as they landed
  M  handoff/reports/dungeon-runs.md, fishing-casts.md    regenerated (71 attempts)
  M  handoff/STATE.md, handoff/DECISIONS.md, handoff/log/session-88.md
```
