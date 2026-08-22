# STATE — session 72 — 2026-08-21 (PT) — code at commit 8dae6e1

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1375/1375** (1368 → 1375, +7),
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean across the
whole session diff, `discoveredShipsClean` 8/8, new fixtures 0 raw identifiers
/ 25 redaction markers. **4 fishing casts, 0 dungeon runs.**

- **Gate 1 PASS, and the headline is a RETRACTION of session 71's headline.**
  The sim's catch gap was an **oil** gap. Session 71's "the simulator's catch
  rate is the open disagreement, worse than the focus profile" is withdrawn.
- **Gate 2 PASS. The redraw trigger was re-derived and the answer is STILL NO** —
  263 mana per extra fish against a cast holding 10. Both degeneracies pinned
  at predicate *and* outcome, each demonstrated failing then restored.
- **The brief's §2b instrument was unavailable** and that is structural, not a
  shortfall — the replay cannot score a redraw's consequence. See below.

**NOTHING NEW IS SHIPPED TO THE LIVE LOOP.** `liveFishing.ts` untouched;
`redrawEnabled` still false; `REDRAW_THRESHOLD` untouched; `focusBudget.ts`
still `NO_FOCUS_POLICY`. Every change is analysis scripts, two sim/strategy
additions used only offline, tests, and documentation.

## What works
- **§1 GATE 1 — `scripts/oilArmCatchCheck.ts`.** The live-config sim arm does
  **not** enable oils: `focusProfileCheck.ts` builds both arms as
  `{empiricalFish, matcherPool, deckIds, blindFallback}` with no `oils` key,
  and `castSim`'s oil block is opt-in. So 24.7% was a **no-oil simulator**
  measured against today's era **pooled**, 12 of whose 35 casts spent an oil.
  Like for like (n=4000/arm, after the 4-cast batch):

  | arm | live (today's era) | 95% Wilson | sim | |
  |---|---|---|---|---|
  | no-oil | 43.5% (10/23) | [25.6%, 63.2%] | 26.5% | **INSIDE** |
  | oil | 78.6% (11/14) | [52.4%, 92.4%] | 50.1% | OUTSIDE |

  mean oils/cast — sim OFF 0.00 (that is the proof), sim ON 1.16, live 1.36.
- **§1 the margin is the number to quote, not the PASS.** The sim clears the
  live arm's lower bound by **0.9pp** (0.2pp before the batch). One more
  escaped no-oil cast flips the verdict. The script prints the margin with the
  verdict so the PASS cannot be quoted alone.
- **§1 the user's other hypothesis is ruled out BY CONSTRUCTION**, not measured:
  the sim plays forward and produces its own rate; the corpus enters only as a
  movement model, never as an outcome. Pre-fix casts cannot drag it down.
- **§2 GATE 2 — `shouldRedrawOnConnect` + `scripts/redrawTriggerCalibration.ts`
  + `tests/fishing/redrawTrigger.test.ts`.** Not a re-tune. `shouldRedraw`
  tests `best.ev`; `chooseCard` stopped maximizing EV in session 13. The
  re-derived trigger fires when the hand **cannot connect**:
  `pConnect < pFresh − manaPrice`, both terms measured, threshold **0.3428**.
- **§2 `pConnect` is calibrated enough to threshold on** — monotone across five
  buckets on 118 era-matched turns, though **optimistic throughout** (predicts
  50.0%, observes 39.8%).
- **§2 the verdict, in `castSim` (n=4000/arm, live config, Shroom deck):**

  | threshold | catch | mana/cast | escaped_mana | turns/cast | mana/fish |
  |---|---|---|---|---|---|
  | NEVER (0) | 24.8% | 0.00 | 18.8% | 6.17 | — |
  | derived (0.343) | 26.2% | 3.68 | 39.8% | 4.38 | **263.0** |
  | ALWAYS (2) | 0.0% | 9.00 | 100.0% | 1.00 | — |

  +1.4pp is **1.4 SE** — not distinguishable from zero.
- **§2 both degeneracies pinned at predicate AND outcome, demonstrated.**
  NEVER broken (`<`→`<=`): 2 tests fail. ALWAYS broken (threshold clamped ≤1):
  1 test fails. Restored, 7/7. The ALWAYS **outcome** pin asserts against
  `cardChoice.ts` §5's recorded disaster (78% `escaped_mana`, 1.29 turns/cast);
  the harness reproduces 100% at 1.00.
- **§3 4 casts sent, 2 caught.** Rule 13 honoured: game ledger 16 → 20, exactly
  the casts sent; repo agrees at 20.

## What's broken
- **THE OIL ROW DID NOT PASS.** `castSim`'s modelled oil block under-delivers
  against the real oil arm — **50.1% vs 78.6%**. At n=14 against **assumed**
  payloads (`FishingRestoreFocus` +2 / `FishingDamageFish` +2, never observed)
  this neither establishes the payloads are wrong nor clears them.
- **Gate 1's PASS rests on a 0.9pp margin against a 37.6pp-wide interval.**
  "Not refuted at n=23" is not "reproduced". Do not read the axis as settled.
- **The era-matched replay CANNOT score a redraw's consequence, and no care
  fixes it.** Its licence to refill is "one card per turn means the
  counterfactual empties the hand on the SAME turn as the record"; a redraw is
  exactly the move that breaks that invariant, and the draw pile never appears
  on the wire (**0/56** refills match a `fullDeck` slice). The brief's §2b asked
  for the whole calibration there and that half was unavailable.
- **30% of the derived trigger's firings could not pay for themselves even with
  a PERFECT redraw** (`ReplayTurn.pConnectCeiling`, §4 of the script) — and the
  ceiling picks the best card in the whole deck, so the true waste is higher.
- **The redraw failure was never only the currency.** The new trigger fires 4x
  less often than the old one and still lands in the same failure — mana
  exhaustion replacing meter exhaustion.
- **`pConnect` is optimistic in every bucket** (50.0% predicted vs 39.8%
  observed). Unmeasured whether that is the matcher, the ring model, or both.
- Carried: the `nextPosition` tripwire has still never met a real miss;
  distribution steps 3/4/6 remain the user's; the hardcoded-path ratchet is
  **26**, unchanged.

## Corrections to SPEC.md
- **Session 71's "the sim's catch rate is the open disagreement" is RETRACTED**,
  in place, in `focusProfileCheck.ts` §4 — the line that produced it now prints
  the retraction and points at `oilArmCatchCheck.ts`. The defect was session
  71's OWN defect one level down: it split the corpus by **era** and then
  pooled the **oil arms** inside the era it kept.
- **`13025987` spent TWO FOCUS oils (942), not Relaxing.** I wrote the opposite
  into two test comments before checking the log, and corrected both before
  commit. The Relaxing per-cast cap of 2 **has still never bound.**
- **Oil stock is now Relaxing 48 / Focus 11**, against `config/bot.json`'s note
  describing "fewer oils than a batch needs... runs out MID-batch". That note
  is what PRODUCED the `policy-dry` arm; with 48 held the policy cannot run
  dry, so casts that would have landed there now land in the oil arm. Not an
  era break, but a composition change in the split gate 1 rests on.
- **`costCap`'s inertness is a FINDING about the fishery, not a measurement
  failure.** Today's policy spends 0.83 of a 3-point meter on the opener, so
  `costCap(2)` has nothing to bind on and `+0/−0` is correct. The user's
  opening-turn directive is substantially already satisfied.
- Corpus 124 → 128 casts, 521 → 537 `playTurns`, 34 → 36 caught. Twelve pinned
  assertions across four test files updated with the move recorded inline. **No
  assertion was loosened.**
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Redraw, at any threshold in this currency.** Do not reopen expecting a
  better number to rescue it — a redraw costs 30% of the mana budget and a
  fresh 3-card hand is not 30% better. The measurement is in
  `redrawTriggerCalibration.ts` §5/§6.
- **Calibrating a redraw's VALUE on the replay.** Structurally impossible, see
  above. Only `castSim` can deal replacement cards.
- **Rebuilding `costCap`.** Inert because unneeded. But **do NOT retire
  `focusBudget.ts` wholesale** — the meter still empties in 34.3% of casts,
  which is a CUMULATIVE drain that `costCap` cannot bound and `schedule` can.
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; do not loosen the `fakeDoc` observability
  guard; §19, rule 8 and corrode-in-`dungeonSim` are CLOSED; `boonCapture`
  settled OFF; do not fold stock into the oil threshold; leave-one-out and
  truncation are closed as replay-gap causes.
- **`npx tsx` and `git` both fail under the command sandbox** on this machine.
  Run unsandboxed. Not a repo problem.

## Metrics
- **Live: 4 fishing casts, 0 dungeon runs.** Fishing ledger **16 → 20/20**
  (cap spent, rollover 11:00 PT); dungeon **0/12** throughout.
- Batch: 2/4 caught — escaped(2 turns), escaped(10, two Focus oils),
  caught(2, lethal Relaxing), caught(2, no oil).
- **Today's era running: 23/39 = 59.0%, 95% [43.4%, 72.9%]** (was 21/35 =
  60.0%, [43.6%, 74.4%]). Interval 30.8pp → 29.5pp. ~90 casts reads it to ±10pp.
- Corpus: **128 casts / 127 clean traces / 537 `playTurns`**.
- Replay, today's era: 35 casts, 118 turns; `pFresh` 0.4897 (n=50 fresh hands);
  derived threshold fires on 25.4% of turns.
- **Suite 1368 → 1375.** New: `redrawTrigger` 7.

## Open questions for Claude
1. **The oil row is the one that did not pass — 50.1% sim vs 78.6% live (n=14).**
   `castSim`'s oil payloads are ASSUMED, never observed. Is measuring them the
   next session's work, and what gate would be set on something the agent
   controls (rule 6) given no cast supplies an oil outcome?
2. **`pConnect` is optimistic in every bucket (50.0% predicted, 39.8%
   observed).** That is the policy's own distribution being overconfident, and
   it is upstream of card choice, focus placement and every EV number in the
   repo. Worth a session on its own?
3. **Is `schedule` worth sweeping?** It is the one focus arm §4 did NOT retire,
   and the cumulative-drain premise (34.3% meter-out) is live-measured.
4. **Casts: 20 available after 11:00 PT.** Continuing to 90 in this era takes
   ~3 more days at 20/day. Is that the plan, or is the ±15pp interval good
   enough for the decisions actually pending?
5. Carried: separate the crit source with one-lure-only casts? Should
   `preflight.ts` run in CI (open since session 68)? What re-derives +19.40pp
   (still SUSPENDED, do not quote)?

## Files changed
```
 5 commits (544d872, 2c3658f, 2016f6e, 7b919b6, 8dae6e1).
 40 files, +22755 -41 (21,689 of the insertions are 25 new fixture files).

  NEW  scripts/redrawTriggerCalibration.ts    319  GATE 2
  NEW  scripts/oilArmCatchCheck.ts            281  GATE 1
  NEW  tests/fishing/redrawTrigger.test.ts    154  GATE 2, both pins
       src/sim/fishing/offPolicyReplay.ts     +74  pConnect, handSize, ceiling
       src/strategy/fishing/cardChoice.ts     +74  shouldRedrawOnConnect + bounds
       src/sim/fishing/castSim.ts             +65  connect policy, redrawMana
       tests/fishing/oilReachability.test.ts  +34  corpus pins 124 -> 128
       scripts/focusProfileCheck.ts           +22  catch-rate verdict RETRACTED
       src/strategy/fishing/focusBudget.ts    +21  costCap answered, schedule kept
       tests/sim/fishingCorpus.test.ts        +20  corpus pins, oil ids
       handoff/DECISIONS.md                   +12  eleven settlements
       tests/{stateFields,zoneTemplate}.test.ts +18  corpus pins
```
