# scratch — session 85 — surprises as they land

## S0 (10:01 PT) — ledgers, as the brief predicted
`doctor.ts`: dungeon 12/12, fishing 20/20, both spent, roll at 11:00 PT (1.0h out).
`data/` IS present in this tree, so gate 2's live-config arm is NOT blocked —
the brief's "if it cannot run in your tree" caveat does not apply.

## S1 — RULE 9: the brief's §2b claim "nobody has asked what it reads at w = 3"
## is WRONG, and the file that disproves it is `scripts/focusReserveAblation.ts`.
Session 45 shipped a whole ablation that sweeps
`WEIGHTS = [0, 0.5, 1, 2, 3, 4, 6, 8, 12]` through
`makeMatcherFishPolicy(REDRAW_THRESHOLD, true, w)` against the empirical fish,
with a LIVE_FALLBACK live-config arm and an exhaustion diagnostic.
So w=3 HAS been swept — on catch% / hit% / meanFinalFishHp.

What has NOT been asked is what the three arms the brief names
(`focusProfileCheck`, `damageEconomy`, `redrawCounterfactual`) read at w=3.
Gate 2 is still meetable and still worth running; the FRAMING is what needs
correcting, not the task.

## S2 — the divergence is DOCUMENTED AND DELIBERATE, not an oversight.
`cardChoice.ts`'s docblock above `DEFAULT_FOCUS_RESERVE_WEIGHT = 3` says:
"NOT the default of `bestFocusForCard`/`chooseCard` — those default to `0` so
every pre-session-45 caller, test and sim script stays byte-for-byte unchanged.
`scripts/liveFishing.ts` is what passes this."
So the brief's headline ("the sim has never run the shipped policy") is TRUE as
a fact and MISLEADING as a discovery: session 45 chose it on purpose and wrote
down why. That strengthens the brief's own "do not change the default" rule.

## S3 — RULE 9 again: `redrawCounterfactual.ts` IS NOT A SIM ARM.
The brief's §2 table lists `scripts/redrawCounterfactual.ts  same  → w = 0`.
It calls `makeMatcherFishPolicy` ZERO times, `simulateCast` zero times, and
contains no simulator at all — it is a pure corpus instrument. The only
occurrence of the string `focusReserveWeight` in the whole file is at :460,
INSIDE A PRINTED PROSE PARAGRAPH (the §2 caveat session 84 wrote).
So "run it at both weights" is a category error: there is no arm to run.
Gate 2's real membership is `focusProfileCheck` and `damageEconomy` — plus
six arms the brief did not name (`fishingEmpiricalAblation`,
`fishingHeuristicAblation`, `fishingContextualAblation`, `oilArmCatchCheck`,
`redrawThresholdSweep`, `redrawBlastRadius`).

## S4 — GATE 1 REPRODUCES CELL FOR CELL, first run, no predicate search.
Unlike the play counts (which failed three briefs running), every §1 number
landed exactly: footprint 7.38/7.20, actual 1.553/0.852, optimal 0.656/0.648,
hist 44/46/10 and 48/39/13, and all nine daily rows including -0.40 at 08-20.
Only cosmetic difference: overspend is 1.553-0.656 = 0.897, i.e. +0.90, where
the brief writes +0.89. Same number, displayed differently.

## S5 — the (2,2) claim is TRUE BUT UNDERSTATED, and the exception has ONE cause.
`hasStart` is true on 147 of 148 traces, and ALL 147 open at (2,2) with
`focusMeter` 3 — no exceptions. The 148th (docId 12975152) has hasStart=false:
its turn 0 is a MID-CAST RESUME (already `play`-bearing, meter 2, hand down to
one card [4]). It is therefore not an exception to "casts open at (2,2)" — its
opening was never recorded.
And it is ALSO the single cast with no covering focus for its first play (a
one-card hand cannot cover the fish at (4,3)). Two apparent anomalies, one
cause. The honest form of the assumption is **147/147 recorded openings**, not
"147 of 148".

## S6 — GATE 2 RESULT: the weight is FAR from inert, and it moves different
## gate statistics in OPPOSITE directions. Neither of the brief's two
## predicted outcomes.

### focusProfileCheck — opening spend (THE verdict statistic): toward live, hard
```
                              w=0     w=3     corpus gate
  sim opening spend           1.27    1.07    0.85  CI [0.64, 1.06]  (portable, n=54)
  miss past interval top     0.207   0.004
```
w=3 closes **98% of the miss**. It still FAILS — by four thousandths.
Robust to the boundary: on the matcher-weight set (n=59, CI top 1.03) it is
0.033 past, on castEra.ts's date set 0.004 past. FAIL either way, but the
margin is a different animal at w=3.

### focusProfileCheck — per-turn focus profile: AWAY from live
```
  turn            1     2     3     4     5     6     7     8
  Δ at w=0     +0.03 -0.04 -0.07 -0.17 -0.11 -0.11 -0.24 -0.37
  Δ at w=3     +0.24 +0.30 +0.24 +0.09 +0.07 +0.01 -0.16 -0.33
```
Session 79 called this profile "essentially closed" at w=0 (worst |Δ| 0.16 over
turns 1-3). At w=3 turns 1-3 read +0.24/+0.30/+0.24 — the sim now HOLDS more
focus than the corpus early. The late tail improves slightly.
Also away: fish-at-full 27.1% -> 26.5% against a corpus 32.2%;
turns at focus 0 54.2% -> 44.2% against a corpus 19.3%(that one moves toward).

### damageEconomy — the margin (its own stated gate): AWAY from live
```
                    hit%          h*      margin           drift
  LIVE (corpus)     36.5                   -0.7pp         +0.059
  SIM live-config   42.6 -> 44.7   38.7->38.6  +4.0 -> +6.1pp   -0.319 -> -0.490
  SIM bare          80.8 -> 85.1              +41.9 -> +46.3pp  -3.437 -> -3.783
  SIM blind         42.7 -> 42.7              -4.6 -> -4.6pp    +0.317 -> +0.317
```
live-config's distance from live's margin widens 4.7pp -> 6.8pp.
⚠ SIM blind is byte-identical at both weights — worth one line of curiosity,
not chased this session.

### The reading
The brief offered "satisfying" (sim moves toward live) vs "unsatisfying" (w=3
is nearly inert). It is NEITHER. The term is powerful — it moves opening spend
by 0.20 and hit rate by 2.1pp — and it moves the gates in opposite directions.
So "just set w=3 in the sim" is NOT an unambiguous improvement, which is
exactly why the brief's own "do not change the default" is the right call and
now has evidence behind it rather than caution.

## S7 (10:17 PT) — final ledger read, rule 13 posture
SERVER ledgers, not the local ones:
  dungeon `DayCount#...#Dungeon#5` UINT256_CID = 12  → 12/12
  fishing `dayDocs[pondId 2]` = 20                   → 20/20
Both spent BEFORE the session began; 0.78h to the 11:00 PT rollover.
**ZERO live spend this session.** No dungeon run, no cast, no on-chain call.
Nothing was denied or interrupted, so there is no rule-13 discrepancy to
reconcile — the ledgers were read because the rule says read them, not because
something looked wrong.

## S8 — verification at the final commit
  npx tsc --noEmit          clean
  git diff --check          clean
  npx vitest run            98 files, 1656 passed (was 1652, +4)
  assertionCoverage         1656 counted, 0 vacuous
  preflight.ts              PASSED — 1641 passed / 15 author-data skips,
                            302 tracked files exported, secret scan CLEAN
