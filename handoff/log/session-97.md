# STATE — session 97 — 2026-08-25 (PT) — code at commit b44aaa26

## Status
Brief items §1a–§1d and §2a–§2e: **ALL CLOSED. GATE PASS.**
Suite **1860 passed / 1860, 105 files**. `tsc --noEmit` clean,
`git diff --check` clean, secret scan clean on all five patterns,
`discoveredShipsClean` 8/8.

**ZERO live spend this session** — 0 casts, 0 runs, both §1 and §2 forbade it.
No new fixtures; newest on disk are still session 96's.

Per-item status, as the brief demanded up front: §1a **done, but NOT as
specified** (the instrument it named is forbidden — see below); §1b done; §1c
done; §1d done; §2a done (**brief refuted**); §2b done; §2c done; §2d done
(**partly unanswerable, volume computed**); §2e done (**verdict: do not wire**).

## What works
- **§1d — the necessity gate is SHIPPED.** `scripts/liveFishing.ts` calls
  `necessityGatedDoubleLethalTriggers`. QUESTIONS.md §40.
- **§1b — the composition is PROVED, not swept.** Gate acts on
  `0 < fishHp <= D`, band on `D < fishHp <= 2D` — disjoint — and
  `conservingTriggers` can only REMOVE entries. **No interaction term at any
  HP.** A sweep of a provably-zero quantity returns "near zero, CI [-x,+y]",
  which is how a real interaction hides. Pinned exhaustively over both sides of
  every boundary: `tests/fishing/oilNecessityComposition.test.ts`, 91 assertions.
- **`conservingTriggers` is new** — the stock-blind sibling `conservingOil`
  never had. The live loop needs a TRIGGER (session 62 §1b's split); handing it
  a `decide` would have re-merged "did not fire" with "fired while dry".
- **§2b/§2c — `scripts/eraCatchRate.ts` is new** and is the era-segmented live
  catch rate that had never been measured. Live corpus only, by construction.

## What's broken
- ⚠ **THE NECESSITY GATE IS A MEASURED LIVE NO-OP, AND ITS JUSTIFICATION IS A
  `castSim` ARTEFACT.** Relaxing gate evaluated **18** times over 684 replayed
  turns and **20** more live: **HELD 0**, max `bestKillProbability` **0.991**,
  **zero at exactly 1**. `OIL-CONSERVE.md` §4 picked threshold 1 because 55.8%
  of decisions sit at exactly 1 — that spike exists only in `castSim`. **The
  "-21% oils" DOES NOT TRANSFER.** Shipped anyway (user-approved, provably
  safe); whether to lower the threshold is the USER's call, not an agent's.
- ⚠ **A LIVE EPSILON DIVERGENCE, SHIPPED SINCE SESSION 90, FOUND AND FIXED.**
  `doubleLethalTriggers` compared `bestKillProbability >= t` with a **bare
  `>=`** while the necessity gate — same quantity, same constant — went
  epsilon-tolerant in session 68. At threshold 1 a certain kill arrives as
  `0.9999999999999999` (session 68 **observed** this), so the bare form spent
  **two** oils on a turn the bot was already sure of. Now `meetsThreshold`.
- ⚠ **THE §2c TRIPWIRE'S OWN STATED RARITY IS MISCOMPUTED ~9x.** It prints
  "~1-in-900"; under its OWN ~0.70 oils/cast assumption the correct figure is
  **~1 in 98**. At the LIVE `focusDry` clean-cast rate (30/43 = 69.8%) it is
  **~1 in 7**. Three errors compounded: wrong instrument, wrong arithmetic,
  wrong conclusion. **It needs re-registering or retiring — user's call.**
- ⚠ **`tests/fishing/golden/liveDecision.golden.json` WAS RE-BLESSED.** That
  file's own rule says a diff is "a claim that live play was MEANT to change".
  It was, and the diff was inspected before acceptance: two `reason: "empty"`
  relaxing refusals disappear, one consume goes 937→942, and casts get LONGER
  because a withheld lethal oil no longer ends them. Recorded in the test header.
- Carried, untouched: H2's proc model still blocked on capture (`TASKS.md`
  CAPTURE-1); §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED**;
  §26's shadow evaluation still unstarted; §27 (ΔEV-per-step) still unstarted
  with a ready brief at `handoff/next-ev-per-step.md`.

## Corrections to SPEC.md
- **None this session.** No live responses were fetched — zero casts — so
  nothing could contradict the spec. `SPEC.md` and `SPEC-fishing.md` untouched.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Corrections to REPO DOCS, which did happen:** `handoff/OIL-CONSERVE.md`'s
  title and opening claimed "awaiting the user's approval" / "nothing here is
  shipped" — both false as of this session; rewritten, with a new §7 recording
  the no-op measurement. Its "reproduce with `oilConserveSweep.ts`" line is now
  an explicit **do NOT**, because §0a forbids that run by name.

## Dead ends
- **Do NOT re-run `scripts/oilConserveSweep.ts`.** `OIL-POLICY.md` §0a forbids
  it verbatim — *"Do not re-run the oil sweep on the current instrument to
  'check': that produces a second unsupported number"* — and `runArm`
  (`scripts/oilTimingSweep.ts:130`) uses `baseOpts() = { policy:
  matcherFishPolicy }`, the bare synthetic-pool arm §0a suspends. **The
  session-97 brief asked for this run; it was refused and re-derived on the
  live corpus instead.** A future brief asking again should be refused again.
- **Do not try to separate the shadow from the live policy on the RELAXING arm
  any more.** Shipping the gate made them agree; `oilShadowInert.test.ts`'s
  disagreement now comes from the FOCUS arm (shadow threshold 1 vs live
  `ALWAYS_FIRES`), which is a real and live-relevant divergence. An 8-of-9 hit
  template was tried first and does nothing — the distribution concentrates on
  the covered cell, so `bestKillProbability` stays exactly 1.
- **Do not wire `focusBudget.ts`'s guardrails, and retire `costCap`.** Opening
  spend 0.83 (n=35) → **0.82 (n=110)**, unmoved; a 2-point cap has nothing to
  bind on. The module's premise (meter-out dominant at 80.8%) is gone — today's
  era reads 38.2% fish-at-full, 23.0% turns at focus zero.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED; `dendren.dailyEnergyBudget`
  252 STANDING; `castSim` suspended for this fishery.

## Metrics
- **Live: 0 casts, 0 dungeon runs, 0 energy, 0 oils.** Nothing was spent.
- Suite **1769/1769 → 1860/1860**, 104 → 105 files. +91, all the new
  composition test's.
- **The gate, on every cast ever recorded:** replay 18 evaluations / 0 held /
  max 0.990; live 20 / 0 held / max 0.991; union 24 / 0 held / max 0.991;
  **at exactly 1: zero, in all three.**
- **Live catch rate by era** (new, `scripts/eraCatchRate.ts`, n=198):
  `preOil` 14/93 = **15.1%** [9.2, 23.7]; `oilSupplied` 39/62 = **62.9%**
  [50.5, 73.8]; `focusDry` 20/43 = **46.5%** [32.5, 61.1]; ALL 73/198 = 36.9%.
- **Session 96's batch:** 3/10 = 30.0%, EXACT 95% CI **[6.7%, 65.2%]** —
  contains all five baselines including today's era's 46.5%.
- **Oils/cast live:** `oilSupplied` 0.63, `focusDry` 0.44, all-time 0.30 —
  against the tripwire's assumed **~0.70**.
- **Opening focus spend:** today's era **0.82** [0.67, 0.97] at n=110 (was 0.83
  at n=35). Profile 3.00 2.18 1.49 1.01 0.93 0.70 0.36 — does not collapse.

## Open questions for Claude
1. **Should the necessity gate's relaxing threshold be LOWERED so it actually
   fires?** At `1` it is inert and measured so. The live maximum is 0.991 and
   the shadow's own exchange-rate arm already uses **0.8333**, which WOULD have
   fired. Lowering it starts conserving oil AND starts risking catches.
   `oilTiming.ts` forbids an agent picking that number — this needs a user
   directive. **This is the session's most consequential open item.**
2. **The §2c tripwire needs re-registering or retiring.** Its threshold came
   from `castSim` and its stated rarity is wrong by ~9x. 9-of-10 clean is ~1 in
   7 live. It is a pre-registered instrument, so an agent should not silently
   redefine it.
3. **The user's "~60%" was CORRECT and the brief was wrong to doubt it** —
   `oilSupplied` reads 62.9% on n=62. The honest answer to "is the autofisher
   broken" is: the batch proves nothing (CI [6.7, 65.2]), and the era-level
   −16.4pp decline is real in point estimate, unresolved statistically, and
   coincides with the user's OWN session-93 Focus Oil withdrawal. **Does the
   user want to reconsider that withdrawal?** That is the lever, not the code.
4. **The matcher-library question is expensive.** n=20 settles nothing (sign
   test p 0.25–0.45). Settling it needs **87–122 matcher-active turns ≈ 4–6
   ten-cast batches** — against a 20/day cap and a rod with ~9 casts of
   headroom. Choose it deliberately or drop it.
5. **The rod is still the nearest hard stop** — ~9 casts of headroom on the
   user's own ~40-cast estimate, unchanged since session 96 because nothing was
   cast. Worth a fresh durability read before any fishing brief.

## Files changed
```
 1 commit (this recap makes 2). 0 new fixtures — no live play.

  M  QUESTIONS.md                     +235  §40 (the gate) and §41 (catch rate)
  M  handoff/OIL-CONSERVE.md          +92   status rewritten, §7 = the no-op
  A  scripts/eraCatchRate.ts          +274  era catch rate + tripwire re-registration
  M  scripts/liveFishing.ts           +74   the wiring, and two stale messages
  M  src/strategy/fishing/oilTiming.ts +179 conservingTriggers, doubleLethalOver,
                                            RELAXING_ONLY_*, the epsilon fix
  A  tests/fishing/oilNecessityComposition.test.ts  +251  91 assertions
  M  tests/fishing/golden/liveDecision.golden.json  RE-BLESSED, diff inspected
  M  tests/helpers/fishingDoc.ts      +34   CANNOT_FINISH_CARD + why
  M  tests/fishing/{hoistInvariant,oilDoubleLethal,oilShadowInert,
       pConnectConsumers}.test.ts            the four that needed real thought
  M  tests/fishing/{oilFocusWithdrawn,oilLethalCompletes,oilPartialDry,
       oilPerItemCap,oilShadowExchangeArm,oilShadowRelaxingArm,
       oilStockExhaustion}.test.ts           CANNOT_FINISH_CARD, one line each
```

---
---

# VERBOSE APPENDIX — session 97

## A. `scripts/liveGateFiringRates.ts` — the §1a re-derivation, verbatim

```
── §2  THE REPLAY — 'WOULD IT FIRE', PAIRED AT THE TURN ──

  era only — 405 turns
    turns where the trigger wanted ANY oil      101
    RELAXING gate   evaluated    6   held (fired)    0   0.0%
    FOCUS    gate   evaluated   98   held (fired)    0   0.0%
    bestKillProbability    0.050 .. 0.868   exactly 1: 0

  whole clean corpus — 684 turns
    turns where the trigger wanted ANY oil      141
    RELAXING gate   evaluated   18   held (fired)    0   0.0%
    FOCUS    gate   evaluated  127   held (fired)    0   0.0%
    bestKillProbability    0.050 .. 0.990   exactly 1: 0

── §3  THE LIVE RECORD — 'DID IT FIRE' ──
  RELAXING arm evaluated live                         20   at >= 1: 0   max 0.991
  FOCUS    arm evaluated live                         73   at >= 1: 0   max 0.991
  Union of every Relaxing observation ever recorded: 24, at >= 1: 0, max 0.991.

── §3b  THE BIMODALITY THAT JUSTIFIED THE THRESHOLD, RE-ASKED ──
    replay  bestKillProbability     n  18   exactly 0   0 0.0%   exactly 1   0 0.0%
    live    bestKillProbability     n  20   exactly 0   0 0.0%   exactly 1   0 0.0%

  THE UPPER SPIKE IS A castSim ARTEFACT. Two independent sources that resolve
  against REAL fish trajectories put no mass at 1 at all.

  NOTE THE DIRECTION. `pConnect` is OPTIMISTIC, so a fitted correction moves
  these inputs DOWN, i.e. further from the only boundary they are compared
  against. Correcting the estimator cannot make these gates fire; it can only
  make them fire less. That is a stronger statement than "they never fired on
  this corpus" and it does not depend on the sample size.
```

**Note for the next reader:** `OIL-POLICY.md` §0a ALREADY recorded "the
certainty gate is a proven live no-op (0 of 9 Relaxing firings held)" — known
since session 70, at n=9. **Nobody ever connected it to `OIL-CONSERVE.md`'s
recommendation**, which went on being described as a −21% oil saving for 29
sessions. The failure was not measurement, it was two documents not being read
against each other.

## B. `scripts/eraCatchRate.ts` — the §2b measurement that had never been run

```
── §1  CATCH RATE BY ERA ──
  segment                caught/n      rate  95% Wilson         oils  oils/cast
  preOil                 14/93        15.1%  [9.2%, 23.7%]         1  0.01
  oilSupplied            39/62        62.9%  [50.5%, 73.8%]       39  0.63
  focusDry               20/43        46.5%  [32.5%, 61.1%]       19  0.44
  ALL                    73/198       36.9%  [30.5%, 43.8%]       59  0.30

── §2  THE MECHANICAL HYPOTHESIS: does `focusDry` catch LESS? ──
  focusDry 46.5% vs oilSupplied 62.9% — -16.4pp, intervals OVERLAP.
  ⇒ NOT SUPPORTED at this n.

── §3  SESSION 96'S BATCH IN CONTEXT (§2c) ──
  session 96: 3/10 = 30.0%   EXACT binomial 95% CI [6.7%, 65.2%]
    bare-arm real (§0a)     27.6%  INSIDE      all-time corpus  36.9%  INSIDE
    live-config pooled      28.3%  INSIDE      focusDry era     46.5%  INSIDE
    dead-era-excluded       25.9%  INSIDE

── §5  THE §2c TRIPWIRE, RE-REGISTERED AGAINST THE LIVE RATE (§1c) ──
  live CLEAN-cast rate   focusDry 30/43 = 69.8%   all-time 157/198 = 79.3%
  P(>= 9 clean of 10):
    under the sim's ~0.70 oils/cast   P(clean)=49.7%   =>   1.02%  (~1 in 98)
    under the LIVE focusDry rate      P(clean)=69.8%   =>  14.6%   (~1 in 7)
```

## C. Two bugs I introduced and caught, recorded so the next reader trusts the rest

1. **`FishingCast.oilEra` is a BOOLEAN, not a count** (`consumablesUsed > 0 ||
   slotsUsed.some(...)`). My first `eraCatchRate` run summed it as an oil count
   and tested `=== 0` for a clean cast — which never matches a boolean `false`,
   so it reported **clean 0/198**, an obviously impossible number that is what
   made me look. The count lives on `FishingCast.consumablesUsed`. The field
   name reads like a count; it is not.
2. **I inverted the necessity endpoints in the first draft of the composition
   test.** `NEVER_FIRES_THRESHOLD = 0` means the gate ALWAYS SKIPS, so the oil
   is never spent — it does not mean "the gate never intervenes". Two tests
   went red and the corrected semantics are now written into the test file so
   the next reader does not re-derive them.

## D. Why the composition was proved instead of swept — the argument in full

The brief asked for a sweep of the composed policy against (a) shipped
double-lethal and (b) the gate alone. The two layers partition on `fishHp`
with `D = e.fishDamage`:

| `fishHp` | `onDemandTriggers` relaxing? | gate can act? | band can act? |
|---|---|---|---|
| `<= 0` | no (guarded `fishHp > 0`) | no | no |
| `0 < hp <= D` | **yes** | **yes** | no — guard 2 returns base |
| `D < hp <= 2D` | no | nothing to remove | **yes** |
| `hp > 2D` | no | nothing to remove | no — guard 3 returns base |

Two facts close it: `conservingTriggers` only ever REMOVES entries (pinned as a
subsequence property over the whole partition), and the band's own guard
`fishHp <= D` returns the base untouched precisely where the gate acted. So the
band can never re-add an oil the gate skipped, and the gate can never remove one
the band added. **The difference is exactly zero at every HP, not
approximately zero.**

This is why a sweep would have been worse rather than merely slower: it would
have reported a near-zero difference with a confidence interval, and
"near-zero with a CI" is indistinguishable from a real interaction the sample
was too small to resolve. `tests/fishing/oilNecessityComposition.test.ts`
enumerates `[-1, 0, 1, D, D+1, 2D, 2D+1, 5, 18]` against stock `0..3` and both
certainty regimes.

## E. The full test-fallout account (16 failures, all resolved)

Changing the shipped trigger turned 16 tests red across 11 files. Categorised:

**Group A — source-text pins that SHOULD fire on this change (5).**
`pConnectConsumers.test.ts` ×3 (the level-based-consumer inventory: two
expressions moved into `conservingTriggers`, one changed `>=` →
`meetsThreshold`), `oilDoubleLethal.test.ts` ×1 (the wiring grep). These are
the tests doing their job; updated with the reason recorded inline.

**Group B — behavioural tests whose FIXTURES present a certain kill (11).**
`fakeCard`'s default is a FULL 3×3 template (`hitZones: [1..9]`) dealing 5,
against the `fishHp: 2` these tests use to arm the lethal trigger — so
`bestKillProbability` is exactly 1 and the new gate correctly withholds. Every
one of these files pins DOWNSTREAM machinery (the consume loop, the per-cast
cap, the dry path, shadow inertness) GIVEN a trigger fires; which trigger fires
is the composition test's question, not theirs. Fixed with one shared,
documented `CANNOT_FINISH_CARD` (`hitAmount: 1`) rather than nine local edits.

**This is not weakening tests to match new code, and the argument is a
measurement:** session 97 §1a found `bestKillProbability` never exceeds 0.991
on any real board, so a certain-kill fixture describes a state the fishery has
never produced and `CANNOT_FINISH_CARD` describes the one it always produces.

`oilShadowInert.test.ts` needed real thought rather than the shared card: its
whole point is that the shadow DISAGREES with live, and shipping the gate made
them agree on the relaxing arm. An 8-of-9 template was tried and failed (the
distribution concentrates on the covered cell, so `p` stays exactly 1). The fix
moves the disagreement to the FOCUS arm by emptying the meter — the shadow's
exchange thresholds carry `focus: 1` while live carries `ALWAYS_FIRES`, so at a
certain connect the shadow skips and live spends. Real, live-relevant, forced
by construction.
