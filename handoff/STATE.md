# STATE — session 91 — 2026-08-24 (PT) — code at commit b5d59393

## Status
**GATE PASS — all three brief items delivered, plus the pin regeneration the
live batch forced.** §1 (§29 recorded), §2 (the `damageEconomy` reversal), §3
(the 10-cast batch and all three of its required reports). One live spend, and
it was the authorized one: **10 fishing casts, 4 oils, 0 dungeon runs.**

**Suite went 4 failed → 2 failed** (1730 → 1744 passed; 1735 → 1746 tests).
`tsc --noEmit` clean, `git diff --check` clean, `discoveredShipsClean` 23/23,
secret scan clean, preflight's exported tree matches the working tree exactly.

**One of the two remaining failures is RED ON PURPOSE and is the session's
most important finding** (§32, below). The other is the carried `boons.test.ts`
staleness that sessions 89 and 90 verified inert and declined. Not re-opened.

## What works
- **§1 — `QUESTIONS.md` §29 is ANSWERED, by the user, in their own words.**
  The base-deck casts were a **Shroom Rod out of DURABILITY**, unnoticed.
  Eliminates the other three hypotheses and explains the tight counterexample:
  durability belongs to the ROD INSTANCE, not the equip state, so
  `GEAR_CID_array` was never wrong — it answers a different question. **It will
  recur** (~40-cast horizon). **Nothing in this repo can SEE durability** — no
  such field exists in the fixtures or the live doc shape — so the account
  owner is the only sensor there is, and "~40 casts" is their report, not a
  repo measurement.
- **§2 — the headline damage finding is REVERSED, not retired.** `LIVE` is now
  the **rod-dealt** arm. Measured, not extrapolated:
  ```
    arm                    casts plays hit%  meanDmg meanHeal   drift
    LIVE (rod-dealt)         123   539 39.3%   5.146    3.009  -0.1985
    LIVE, UNCLAMPED          123   539 39.3%   5.434    3.180  -0.2078
    SIM bare arm (n=400)       —     — 81.6%   5.012    3.225  -3.4925
  ```
  "The fish gains HP in expectation" was carried **entirely** by the excluded
  base-deck windows. **"Not the same fishery" survives on the MAGNITUDE (~17.6x),
  not the sign — both arms are negative now.** The clamp claim came out
  **STRONGER**: −0.1985 vs −0.2078 agree to a hundredth, where pooled they were
  −0.0316 vs −0.0014 (twenty-fold apart, both ~zero).
- **§2 — ONE split, shared.** `dealtDeck` / `traceDealtDeck` / `splitByDealtDeck`
  on `rodDeck.ts`, called by both `damageEconomy.test.ts` and
  `scripts/damageEconomy.ts`. Structurally typed, so `rodDeck.ts` still imports
  nothing from this repo. Non-vacuous by mutation: removing base detection
  turns **8 tests red across two files**.
- **§3 — the batch ran to completion.** 10/10 casts, **4 caught / 6 escaped**,
  120 energy. Ledgers agree exactly: `dayDocs[pond 2]` 0/20 → **10/20**, repo
  ledger 10 casts. Rule 13 has nothing to reconcile.
- **§3c-1 — THE DOUBLE-LETHAL TRIGGER FIRED LIVE, TWICE, AND BOTH CAUGHT.**
  Casts `13068171` (fish 4/29) and `13068190` (fish 4/17). Each sent **two
  `use_fishing_item(937)` POSTs in one turn at DISTINCT slots 0 and 1**, took
  the fish **4 → 2 → 0**, cast ended CAUGHT. **No third POST was possible** —
  `oilWanted` is evaluated once per turn and held exactly two elements, so the
  `COMPLETE_CID` break was never the thing that saved it. **Zero
  `oil_trigger_threw`**: `bestKillProbability`/`buildHand` ran on the live path
  across all 52 card decisions without once hitting session 90's fallback.
  The Relaxing per-cast cap of 2 was **REACHED for the first time and still did
  not BIND** — the policy wanted two, never three.
- **§3c-3 — ZERO of the 10 new casts were dealt `BASE_DECK`.** All ten opened on
  the Shroom grant, consistent with the repair.

## What's broken
- ⚠ **`castEra.test.ts` — 1 test RED ON PURPOSE. DO NOT WIDEN THE BOUND.**
  `|before.meanOptimal − today.meanOptimal|` went **0.0062 → 0.0250 against a
  0.01 bound**. Session 89 called this "the single most important thing in the
  file that did NOT move." It is a **PREMISE**, not a description — the section
  argues the eras do not differ in difficulty, therefore the entire difference
  is overspend. It is also the **fourth** claim in that file to move the same
  way across three batches (ratio ~30x → 6.48x → **3.92x**; rescue rate 15/15
  100% → 26/32 81% → **30/42 71%**; `wasted` {0} → {0,3,4,5,6} →
  **{0,3,6,7,9,10,11,12}**). **`QUESTIONS.md` §32 asks for the ruling and offers
  three options.**
- **`boons.test.ts` — 1 failure, `OBSERVED_OFFERS` stale.** Unchanged since
  session 89, which verified it INERT and declined it. Not re-opened.
- **`scripts/assertionCoverage.ts` STILL CANNOT RUN** — fails closed on a red
  suite. The "zero vacuous" check is **BLOCKED, not passed**, now by 2 failures
  rather than 4.
- **`scripts/preflight.ts` STILL FAILS, same cause, and the number now matches
  the working tree exactly:** 2 failed / 1728 passed / 16 skipped (1746) in the
  exported tree, one expected `✗` (missing JWT in the empty-HOME `doctor.ts`
  run), **secret scan clean**.
- Carried, untouched: the gate-1 re-audit; the two unpaid redraw correctness
  gaps (`liveFishing.ts:2471`, `:1526`); the pacing term's cause; H2's proc
  model; `play_cards`/redraw/`use_fishing_item` unrouted; §0a NOT lifted,
  **+19.40pp MAY NOT BE QUOTED**; Focus Oil stock **0**.

## Corrections to SPEC.md
- **None this session.** No live response contradicted the spec; `SPEC.md` and
  `SPEC-fishing.md` are untouched.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Rule 9 — THREE corrections, all measured, two of them to session 90:**
  1. **`CastTrace.fullDeck` DOES NOT EXIST.** `fullDeck` is a field of
     **`CastTurn`**. The brief placed it on the trace (citing `castTrace.ts`
     line 107, which sits inside the `CastTurn` interface); a split written that
     way classifies **0 of 167 traces, SILENTLY**, because the property is
     `undefined` rather than absent-and-loud. The split reads
     `trace.turns[0].fullDeck`.
  2. **Session 90's split table does not reproduce.** It read base 22/74 and
     non-base 145/622; recomputed it is **44/157 and 123/539**. POOLED totals
     agree exactly (167/696), so the **SPLIT** was wrong, not the corpus, and
     session 90's base row is internally inconsistent with any single
     classification — its play count matches only the 2026-08-24 window while
     its hit rate and drift match only the 2026-08-17 one.
  3. **The base arm is not one population either.** 2026-08-17: 27 casts /
     15.7% hit / **+1.735**. 2026-08-24: 17 casts / 50.0% hit / **−0.797**.
     "The base deck drifts positive" is a pooling artefact one level down, and
     the later window landed shots MORE often than the rod-dealt corpus.
     **`BASE_ARM.drift` may not be quoted as a property of playing without a
     rod bonus.**
- **The brief's §2c was WRONG and no edit was made.** `OIL-POLICY.md` §0a never
  cited the drift — "drift", "damageEconomy", "gains HP" and "opposite sign"
  appear **nowhere** in the file. §0a rests on meter-out (1.0% vs 64.2%) and
  catch (~70% vs 27.6%), untouched by this ruling. **§0a NOT lifted.**
- **The brief's §3c-2 was WRONG about the batch summary.** All four
  `batchRedrawShadow*` accumulators and the `redraw_shadow_batch` event sit
  inside `if (args.oilBatch)`, which `--casts=10` does not set — **the summary
  never ran.** Per-turn records are unconditional, so nothing was lost. **A
  future batch wanting the summary must pass `--oil-batch`.**

## Dead ends
- **Widening `castEra`'s 0.01 bound — considered and REFUSED.** It would convert
  a falsified premise into a passing test, which is what session 90 refused on
  `damageEconomy.test.ts`. Left red; §32 opened instead.
- **Deleting `rodDeck.test.ts`'s base-window pin to stop it alternating —
  REFUSED.** The alternation IS the durability sensor this repo otherwise does
  not have. Repinned `false` with the failure message rewritten as the
  instruction for when the rod next runs dry.
- **Bulk-regenerating the 8 pin files the batch moved — REFUSED.** Each was
  checked individually and three turned out to be findings, not drift (below).
- Standing, none re-opened: redraw CLOSED; energy is never a blocker;
  `--dry-run` before claiming a blocker; do not revert rule 8; +19.40pp
  SUSPENDED; `boonCapture` OFF; no H2 proc model; do not read `SIM blind` as a
  live proxy; do not restate session 86's finding without the word **UNIFORM**.

## Metrics
- **Live: 10 fishing casts, 4 caught (40%), 4 Relaxing Oils consumed, 120
  energy. ZERO dungeon runs.** Ledger `dayDocs[pond 2]` 0/20 → 10/20, repo
  ledger agrees. Oil stock 57 → 53 Relaxing; **Focus 0 throughout** (19
  `oil_trigger_no_stock` events).
- **§3c-2 — redraw shadow, first live output: 52 decisions, 0 fires, 2 blind,
  0 sanity/error. Live rate 0.0% against the in-sample 2.7%.** This does NOT
  refute the candidate: at 2.7% over 52 decisions **P(zero fires) ≈ 0.24**. What
  the records DO show is mechanical — `coverageBelowK` fired on 14 of 52 turns
  and `conditionMet` on 33 of 52, but **on ZERO turns together**: every one of
  the 14 low-coverage turns had `budget: 0`, and `conditionMet` requires
  budget > 0. The two halves were anti-correlated across the whole batch.
  `liveRedrawEnabled` `false` on all 52 rows.
- Suite **4 failed / 1730 passed (1735) → 2 failed / 1744 passed (1746)**.
  Files 2 failed of 103 → 2 of 103.
- Corpus: **168 → 178 casts (167 → 177 clean)**. Rod-dealt arm 123 → 133; the
  drift moved −0.1985 → **−0.1895**, well inside its band.
- **Three pin files were FINDINGS, not drift:** `stateFields` — two new crit
  anomalies, both shapes already present, so the solved multiplier interval is
  **STILL exactly [1.5, 1.5833)**; `redrawCounterfactual` — the K=6-with-budget
  row the redraw shadow is fitted on is **UNCHANGED in every term**
  ({12, 8, 0, 2}) while the corpus grew 6%; `oilReachability` — the relaxing
  numerator is **STILL 13** across a THIRD consecutive batch (+30 casts).

## Open questions for Claude
1. **§32 is the one that needs a ruling.** Four claims in `castEra.test.ts`
   degrading monotonically over three batches, one of them a broken premise.
   Hypothesis recorded but NOT implemented: `today` is a frozen-vs-accumulating
   split whose "today" arm has grown 54 → 84 casts and now spans the oil era,
   the double-lethal wiring, and the rod durability window — so it may no longer
   be a policy era at all. **That is the same pooling problem §31 just ruled on,
   one file over.** Three options in §32.
2. **The redraw shadow needs a bigger batch, and it needs `--oil-batch`.** 52
   decisions could not have refuted a 2.7% rate. The anti-correlation finding
   (low coverage only ever at budget 0) is more informative than the zero and is
   the thing worth re-measuring.
3. **The rod will run dry again, on the user's ~40-cast horizon from
   2026-08-24, and 10 of those are already spent.** `rodDeck.test.ts` will go
   red when it happens; that is designed. **Ask the user to repair it before the
   next batch**, or expect the batch to produce base-deck casts that
   `splitByDealtDeck` will correctly exclude from the headline figures.
4. **Standing captures, both still unmet:** a base-6/8/10 dungeon crit
   (`critEffects` still never observed); an oil consumed at a NON-ZERO meter —
   still **24 of 24** at meter 0, impossible while Focus stock is 0.
5. **A NARROWER path to the crit multiplier now exists.** Eight anomalies fit
   one multiplier in [1.5, 1.5833), and the interval is set by the **lone
   base-6 row**. More observations at bases already seen (3, 5) will not narrow
   it. **A new BASE would.**

## Files changed
```
 3 commits, 16 files.

  M  src/sim/fishing/rodDeck.ts            §2, the shared split + §29 answered
  M  tests/fishing/rodDeck.test.ts         §2, split unit+corpus tests; tripwire repinned
  M  tests/fishing/damageEconomy.test.ts   §2, LIVE repointed; 3 tests rewritten
  M  scripts/damageEconomy.ts              §2, same split; stale sign prose retired
  M  scripts/liveFishing.ts                §3, names WHICH trigger fired (labels only)
  M  QUESTIONS.md                          §29 ANSWERED, §31 ANSWERED, §32 OPENED
  M  handoff/DECISIONS.md                  7 entries
  M  tests/fishing/castEra.test.ts         RED ON PURPOSE + 3 degrading claims
  M  tests/fishing/{redrawCounterfactual,oilReachability,matcherHeadroom}.test.ts
  M  tests/fishing/{zoneTemplate,stateFields}.test.ts
  M  tests/sim/fishingCorpus.test.ts
  A  fixtures/fishing-casts/live/cast-2026-08-24-19-1*  (10 new casts)
  M  handoff/STATE.md, handoff/log/session-91.md
```
