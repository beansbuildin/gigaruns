# STATE — session 74 — 2026-08-21 (PT) — code at commit 3b2a318

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1401/1401** (1391 → 1401, +10),
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean across the
whole session diff, `discoveredShipsClean` 8/8. **0 fishing casts, 0 dungeon
runs — forced, not chosen.**

- **Session ran 19:58–20:25 PT with fishing already at 20/20.** Both ledgers
  read at start and again at end: game `dayDocs[2]` 20/20 and repo 20 casts
  AGREE; dungeon `dayProgressEntities` null / 0 of 12. Rollover 11:00 PT. So
  brief §4 had no casts, exactly as the brief anticipated. Second session in a
  row this has happened.
- **Gate 1 PASS. Stale shrinkage is NOT the explanation** — re-fitting moves the
  delivery ratio 43.8% → 47.2% and removes **12.0%** of `pConnect`'s +9.38pp
  gap. The prev-delta conditional remains the prime suspect.
- **Gate 2 PASS, and it inverts the brief's premise.** `isLethal` has fired
  **once in 373 live decisions** and **never in 440 replayable turns**.
- **The user settled §5a directly, mid-session** (see Corrections).

**NOTHING IS SHIPPED.** No default touched, no threshold moved, no strategy
behaviour changed. Every new parameter and predicate is measured or defaulted
off.

## What works
- **§1 GATE 1 — `scripts/shrinkageDeliveryCheck.ts`.** Pooled over all 127 clean
  casts, with §1a's reasoning printed: outcome metrics split by era, the
  MOVEMENT MODEL pools.

  Picks: **k=1 unmoved at 0.1**; **k=2 moved 8 → 64** (bare argmin 128 → 64).
  Full grids in the session log. Delivery ratio, placement frozen, era-matched
  39 casts / 134 turns:

  | arm | predicted | gap | claim | DELIVERY |
  |---|---|---|---|---|
  | ring-uniform (floor) | 33.4% | −6.88pp | +0.00pp | — |
  | SHIPPED {1:0.1, 2:8} | 49.1% | +8.81pp | +15.69pp | **43.8%** |
  | re-fit {1:0.1, 2:64} | 48.0% | +7.68pp | +14.56pp | **47.2%** |
  | conditional fully OFF | 44.3% | +4.02pp | +10.90pp | 63.1% |

- **§1 the 88-cast arm is RE-DERIVED, not quoted.** `fish-patterns.jsonl` is
  append-ordered, so the first 88 clean casts ARE session 51's corpus — the
  prefix reproduces its recorded table **cell for cell**. Brief §8's rule.
- **§1 what moved the pick is NOT the logLoss curve.** k=2's **top-1 column
  reversed direction**: at 88 flat 34.0% to K=8 then falling to 28.0%; at 127
  it is 28.5% to K=5 then **rising to 35.3%** at K=32–64. So the selection
  rule's top-1 feasibility constraint bound from ABOVE at 88 (capping the pick
  at 8) and does not bind now. The plateau it lands on is worth **0.006 logLoss
  end to end**, 5 of 14 grid points within 0.010 of the minimum, spanning
  32..∞.
- **§1 the ratio's degeneracy is stated up front.** Under frozen placement the
  numerator (40.3% − 33.4% = +6.88pp) is a CONSTANT; only the denominator moves.
  A shrinkage that raises the ratio has made the model **claim less**, not be
  more right.
- **§2 GATE 2 — `scripts/isLethalBlastRadius.ts`.** The conjunction's two
  halves scored apart, which is what makes the zero informative:

  | | turns | certainty half | damage half | BOTH | flag |
  |---|---|---|---|---|---|
  | era only | 134 | 0 | 14 | 0 | 0 |
  | whole clean corpus | 440 | 0 | 50 | 0 | 0 |

  Live `decision` records: **373**, of which `"lethal": true` on **1** (0.3%) —
  2026-08-19, turn 3, card 79 @ [3,3], pHit 1. **It connected and the cast
  ended `caught`.**
- **§2 the instrument is PAIRED AT THE TURN.** The replay re-plans each turn
  with `NEVER_LETHAL` on the identical state and publishes `noOverride`, so the
  counterfactual shares the turn set by construction. The unpairing that made
  session 73 §6 uninterpretable cannot arise.
- **§2b the tightening, built and defaulted OFF.** `STRICT_LETHALITY` — certify
  lethal only if the card's connect cells also cover the fish's CURRENT cell;
  fails closed without one. `tests/fishing/lethalOverride.test.ts`, 10 tests,
  **both failure modes demonstrated then restored**: default flipped to STRICT
  → 3 fail; STRICT reduced to an alias → 3 fail.
- **§3 the ship-nothing posture recorded with a three-item exit condition**, one
  of which (blast radius measured) is now DONE. **§5**
  `handoff/PAIRED-CONDITIONAL.md` designed, not run. **§5a** `castSim`'s redraw
  audited against the user's confirmation.

## What's broken
- **`pConnect` is still optimistic at +9.38pp and nothing was fixed.** Both
  named suspects are now weaker than session 73 left them: stale shrinkage
  explains 12%, and `isLethal` — the correction target session 73 nominated —
  turns out to fire ~never. The conditional is the prime suspect **by
  elimination**, which is a weaker basis than it sounds.
- **`castSim` charges a redraw NO fish step.** The branch `continue`s past both
  `observe()` and `turn++`, so a redraw in the sim is time-free while the real
  one moves the fish. Mana (1 per card held) and damage (none) are correct.
  **Direction: session 72's 263 mana per extra fish and its `escaped_mana`
  18.8% → 39.8% are UNDERSTATEMENTS.** Not fixed, under ship-nothing.
- **The re-fit shrinkage optimum is unstable and must not be shipped.** Decided
  by a tiebreak column that flipped sign under 40 more casts, on a
  0.006-logLoss plateau.
- **Live fires once, replay fires never, on overlapping data.** Recorded, NOT
  explained. n=1 supports no rate.
- Carried: the `nextPosition` tripwire has still never met a real miss;
  distribution steps 3/4/6 remain the user's; the oil row of session 72's gate 1
  still fails (50.1% sim vs 78.6% live, n=14) and no oil payload was measured
  because no cast existed.

## Corrections to SPEC.md
- **A REDRAW DOES NOT DAMAGE OR HEAL THE FISH — user confirmation, 2026-08-21,
  mid-session, from their own play.** Complete cost: **mana equal to cards held,
  and the fish moves.** RETRACTS the brief's §5a, which read DevTools doc
  `13025041`'s `FISH_HP_DIFF: -3` / `result: 10` as a redraw healing 3. The
  brief flagged its own attribution gap — response and `cards: []` payload came
  from **different calls**, and a `CARD_PLAYED result 0` with a −3 heal is
  indistinguishable from an ordinary MISS carrying `missEffects`. That is the
  resolution. **Fixed in SPEC-fishing.md §7a** with the audit table.
- **`isLethal` DOES NOT SHORT-CIRCUIT THE OIL GATES.** Session 73's claim,
  written in `pConnectConsumers.test.ts`'s rationale → STATE.md → the brief.
  One call site; `onDemandTriggers` is `fishHp <= fishDamage` with **no
  estimator input at all**; the necessity gates read their own functions.
  Card-play and oil lethality were conflated. Corrected at its origin.
  **CLAUDE.md rule 9's third occurrence.** The five real override paths are
  listed in `cardChoice.ts` and in the script.
- No live API call was made this session, so no endpoint or field shape was
  re-verified.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.
- Corpus unchanged at 128 casts (127 clean) / 537 `playTurns` — no casts played.

## Dead ends
- **Tightening `isLethal` on its THRESHOLD.** There is no number above 1, and
  any calibration haircut on `pAnyHit` puts it under 0.999999 always — that is
  never-lethal, the degenerate reading. The optimism enters through the
  **support**, not the threshold. Don't propose a "corrected threshold" here.
- **`STRICT_LETHALITY` as a fix.** Measured INERT: the fish did not move on
  **0 of 440** turns. A result, not a failure — the override's optimism is not
  being spent on the no-move escape — but do not expect it to buy anything.
- **Correcting `isLethal` first because it is "narrower".** It is narrow enough
  to be empty (1 firing / 373). Measure the other three live level gates' firing
  rates before correcting any of them.
- **Restricting the paired comparison to "turns both arms reached".** Same
  selection wearing a filter's clothes — reaching turn *k* is post-treatment.
  Truncating at the first divergent choice is worse: identical prefixes, no
  signal. `PAIRED-CONDITIONAL.md` §2.
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; redraw is CLOSED (and §5a pushes its cost UP);
  +19.40pp stays SUSPENDED; do not loosen the `fakeDoc` observability guard;
  `boonCapture` settled OFF; do not fold stock into the oil threshold; the
  matcher is not `pConnect`'s cause; `shrinkageK` is inert (`shrinkageKByClass`
  overrides it); the 0.05 switch probability is not a correction.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.

## Metrics
- **Live: 0 fishing casts, 0 dungeon runs.** Fishing **20/20** at session start
  and end (game and repo agree), dungeon **0/12**. Rollover 11:00 PT.
- Shrinkage CV, 127 clean casts, 406 scored transitions (k=1 199, k=2 207).
  Paired vs the SHIPPED pair: ΔlogLoss **−0.027 [−0.056, −0.003]**, top1
  156/406 → 168/406 — optimistic by construction, the pair was chosen here.
- Delivery ratio **43.8% → 47.2%**, movement +3.40pp, **12.0% of the gap**.
- `isLethal`: **1 / 373** live decisions; **0 / 440** replay turns; certainty
  half **0 / 440**; damage half **50 / 440**; no-move turns **0 / 440**.
- Replay era unchanged: 39 casts, 134 turns, predicted 49.7%, observed 40.3%,
  gap +9.38pp at 2.2 SE.
- **Suite 1391 → 1401.** New: `lethalOverride` 10.
- Hardcoded-path ratchet **25**, unchanged — both new scripts resolve through
  the profile seam rather than adding to the debt list.

## Open questions for Claude
1. **Both of session 73's suspects just got weaker, and the next move is a
   choice between two.** (a) Run the paired comparison per
   `PAIRED-CONDITIONAL.md` — designed, gated on something the agent controls,
   but 39 casts and likely single-digit discordance. (b) Measure the firing
   rates of the **other three live level gates** (the two oil necessity gates,
   the shadow's `>= 1` checks) the way §2 did for `isLethal` — cheaper, and
   §2's result says the whole inventory may be mostly inert. **(b) first?**
2. **If every live level gate turns out to fire ~never, what is a `pConnect`
   correction FOR?** The estimator's optimism would then be affecting only rank
   consumers, where a uniform bias cancels. That would close the diagnosis by
   making it moot rather than by explaining it — is that an acceptable exit
   condition, or does it need to be explained anyway?
3. **Should `castSim`'s redraw be fixed to advance the fish?** It is a
   one-line-ish change plus re-deriving 263. Deferred under ship-nothing, but
   redraw is disabled live so it touches no live behaviour — is it inside or
   outside the freeze?
4. **Carried, still unspendable:** the oil row of session 72's gate 1 (50.1%
   sim vs 78.6% live, n=14) and the forced Relaxing consume. The session-73/74
   §4 designs are untouched and still valid — 20 casts at 11:00 PT.
5. Carried: separate the crit source with one-lure-only casts? Should
   `preflight.ts` run in CI (open since session 68)? What re-derives +19.40pp
   (still SUSPENDED, do not quote)?

## Files changed
```
 4 commits (622b901, 66e09c1, 109930e, 3b2a318). 12 files, +1257 -36.

  NEW  scripts/shrinkageDeliveryCheck.ts       276  GATE 1
  NEW  scripts/isLethalBlastRadius.ts          255  GATE 2
  NEW  tests/fishing/lethalOverride.test.ts    169  10 tests, both modes demoed
  NEW  handoff/PAIRED-CONDITIONAL.md           154  §5 design, not run
       src/strategy/fishing/cardChoice.ts     +166  LethalityPolicy seam
       scripts/fishingRingCV.ts                +82  `sweepClass` extracted; output identical
       src/sim/fishing/offPolicyReplay.ts      +54  lethality option + 6 diagnostic fields
       SPEC-fishing.md                         +47  §7a redraw retraction + castSim audit
       src/sim/fishing/castSim.ts              +28  the redraw audit at its branch
       scripts/pConnectBiasDecomposition.ts    +28  isMain guard, helpers exported
       tests/fishing/pConnectConsumers.test.ts +18  ratchet 18->20, oil claim corrected
       handoff/DECISIONS.md                    +16  8 settlements
```
