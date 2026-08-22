# SESSION 69 LOG — 2026-08-21 (PT) — commit 00684e4

## Status
**BOTH GATES PASS.** Suite **1328/1328** (1293 → 1328, +35), `tsc --noEmit`
clean, secret scan clean across the whole session diff, no `raw/` file
committed, `discoveredShipsClean` 8/8.

- **Gate 1 PASS, both ways.** The `dist` pipeline is hoisted above the oil
  block. Shadow now records the RELAXING arm at its firing moment
  (**demonstrated failing 3-of-6 on the pre-hoist placement**), AND live play
  is byte-identical to a golden captured BEFORE the hoist.
- **Gate 2 PASS.** The probabilistic threshold is `1 - v` off a measured
  exchange rate, pre-registered before the batch, pinned at both degeneracies.
  Nothing was swept.

**TEN LIVE CASTS RUN**, halted on `cast_cap`, 8 caught / 2 escaped, 10 oils.

**NOTHING NEW IS SHIPPED.** `liveFishing.ts` still plays `onDemandTriggers`;
both gates are observational. The one behaviour change is §4's Relaxing cap,
which is a user directive and can only ever REFUSE a spend.

## What works
- **§1 THE HOIST, validated against a real server.** 42 shadow records over 10
  casts, **10 at a firing moment, 5 of them RELAXING, `bestKillProbability`
  populated on every one**. Session 68: 13 records, 1 firing moment, null on
  all 13. 0 sanity violations, 0 throws, `haltOnShadowBlind` never fired.
  `hand`/`mana`/`fishHp` deliberately did NOT move — they read the POST-consume
  doc and belong to the card policy.
- **The golden.** `tests/fishing/hoistInvariant.test.ts` freezes the full POST
  sequence + result across six scenarios (no-authorization refusal, focus
  consume, terminal relaxing consume, dual trigger, empty bag, plain 3-turn
  cast). Generated pre-hoist, committed with the hoist, matches byte-for-byte
  after. Rewriting needs `UPDATE_LIVE_DECISION_GOLDEN=1`.
- **§2b `scripts/oilMomentAudit.ts`** — replays a real cast out of `logs/` and
  rebuilds the live distribution at every consume. Profile-resolved, so the
  hardcoded-paths ratchet stayed at 25.
- **§3 the derived threshold** + `§4` the per-item cap + `§5` the scoped crit
  rate. All measured, all pinned.

## What's broken
- **THE FISHING LEDGERS DISAGREE BY ONE.** Game `dayDocs[pond 2]` = **14**,
  repo = **15**, after a batch that sent exactly 10 `start_run`s with 10
  distinct docIds and no resumes. Both said 5 beforehand; the log and the
  corpus (114 → 124) also say +10. Read twice a minute apart, stable, so not
  lag. **Direction is safe** — the authoritative game ledger says SIX casts
  remain where the repo says five. Cause unknown. Do not spend casts chasing
  it; read both ledgers at next session start and see if the gap survives the
  11:00 PT rollover.
- **`strict.relaxingReachable` has stopped being a usable firing rate.** It is
  unmoved at 12 while live fired the Relaxing trigger 5 times this batch; the
  lax-vs-strict Relaxing gap went 4 → 10. Correct behaviour (a lethal oil ends
  the cast, so there is no later `play_cards`), but the number now understates
  live firing badly. Use shadow records instead.
- Carried: 25 analysis scripts hold hardcoded paths; the nextPosition tripwire
  has still never met a real miss; distribution steps 3/4/6 remain the user's.

## Corrections to SPEC.md
- **The crit rate is now datable and CONSISTENT with the stated 3%.**
  *User-stated: the Steady Lure was equipped before 2026-08-21's casts.* Scoped
  to that day: **1/73 all plays = 1.37%, 95% Wilson [0.24%, 7.36%]**; **1/39
  connecting plays = 2.56%, [0.45%, 13.18%]**. Both contain 3%. **Both
  denominators are reported because n=1 cannot choose between them** — "3% crit
  chance" could mean 3% of plays or 3% of connecting plays, different
  mechanics. **The damage rule stays OPEN at n=1.** SPEC-fishing updated.
- **HIT and CRIT_HIT are DISJOINT**, confirmed per play over a full day: 38
  HIT-only, 1 CRIT-only, 34 neither, 0 both. Exactly what session 68's
  `castTrace.ts` fix assumed.
- **THE SIM'S BIMODALITY DOES NOT REPRODUCE LIVE.** All nine Relaxing
  `bestKillProbability` values on the entire live record — 0.400 0.481 0.505
  0.506 0.580 0.587 0.690 0.964 0.975 — and all seven Focus `bestConnect`
  values are **strictly between 0 and 1**. The sim says 34.3% exactly 0 /
  55.8% exactly 1. That sim measurement is the evidence session 67's
  "threshold 1 is zero-parameter" argument rests on.
- **"Exactly one caught cast is in the lax-vs-strict gap" is superseded: there
  are now two** (13022748, 13024562), both oil-ended. One was a falsification;
  two from independent batches is the oil era's ordinary behaviour.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **`scripts/oilReachability.ts --gap` printed "(0 can be in the gap)" directly
  above a table listing the counterexample.** Fixed. A summary line that
  contradicts its own data is worse than no summary.
- **The sim cannot distinguish the derived threshold from 1** — 3809 oils /
  88.38% for both at n=8000, because it has no `bestKillProbability` mass in
  [0.833, 1). So gate 2's degeneracy pins are STATE-level; an aggregate over a
  distribution with a hole in it proves nothing about the hole. The absence of
  a sim saving is itself pinned so a future report cannot invent one.
- **Do not fold stock into the threshold.** Scarcity is not efficacy, neither
  shadow price is measured, and a third unmeasured constant would undo the
  point of deriving the first two.
- Standing: never report energy as a blocker; exercise `--dry-run` before
  claiming a blocker; do not revert rule 8; do not loosen the `fakeDoc`
  observability guard; §19, rule 8 and corrode-in-`dungeonSim` are CLOSED;
  `boonCapture` settled OFF.
- **`npx tsx` and `git` both fail under the command sandbox** on this machine.
  Run unsandboxed. Not a repo problem.

## Metrics
- **Live: 10 casts**, halted `cast_cap`. **8 caught / 2 escaped.** 10 oils —
  4 Relaxing (all lethal), 6 Focus. 4 clean casts. 120 energy.
- **Shadow: 42 records, 10 firing moments (5 relaxing / 7 focus), 0 null,
  0 sanity violations, 0 throws, `wouldSkip` 0.**
- **The certainty gate has NEVER held a Relaxing Oil live** — 0 of 9 firings on
  the whole record. The exchange threshold would have held **2 of 9**.
- **Corpus 114 → 124 casts.** caught 26 → 34, escaped 87 → 89, playTurns
  484 → 521, responseDocs 631 → 696, focus gap 15 → 16, oil casts 8 → 14.
- **Suite 1293 → 1328.** New files: `oilShadowRelaxingArm` 6, `hoistInvariant`
  2, `oilExchangeRate` 13, `oilPerItemCap` 9, `oilBatch` +5.
- Sim unchanged: `conserve(r=1,f=1)` and `exchange{0.833,1}` both 88.38% /
  3809 oils at n=8000.

## Open questions for Claude
1. **The live inputs are unimodal and the sim's are bimodal. Which one is the
   threshold argument allowed to rest on?** Session 67 chose 1 because the
   SIM's inputs are bimodal; live says otherwise at n=16 firing moments. This
   is the load-bearing question for whether either gate should ship.
2. **Should the exchange-rate threshold be shadowed alongside `conserve(r=1,f=1)`
   rather than only computed offline?** Today only the certainty gate runs in
   shadow, and it has now provably never fired — so the shadow is spending
   records on the one rule known to do nothing.
3. **The ledger gap of one.** Persist across the rollover, or one-off?
4. **Is "2 Relaxing per fishing run" really per CAST?** Shipped as per cast
   because `start_run` is the server's own action for a cast. A per-SESSION
   reading is far tighter and one word from the user settles it.
5. Still open from session 68: **should `preflight.ts` run in CI?**

## Files changed
```
 5 commits (a6eea01, 77e46f2, e6e3ac9, fd126e2, 00684e4). 91 files, 10 new casts.

     scripts/oilMomentAudit.ts                 | 320  (new — §2b)
     scripts/liveFishing.ts                    | 280  (the hoist + cap + halt)
     tests/fishing/hoistInvariant.test.ts      | 265  (new — GATE 1b)
     handoff/reports/session-69-oil-threshold.md | 240 (new)
     tests/fishing/oilPerItemCap.test.ts       | 224  (new — §4)
     tests/fishing/oilExchangeRate.test.ts     | 214  (new — GATE 2)
     tests/fishing/oilShadowRelaxingArm.test.ts| 190  (new — GATE 1a)
     src/strategy/fishing/oilTiming.ts         | 105  (the derivation)
     src/strategy/fishing/oilShadow.ts         |  95  (header rewritten)
     src/strategy/fishing/oilBatch.ts          |  78  (SESSION_69_LIMITS)
     tests/fishing/oilReachability.test.ts     |  76  (census + 2nd caught gap member)
     tests/fishing/oilBatch.test.ts            |  52  (shadow-blind halt)
     src/strategy/fishing/oilPolicy.ts         |  48  (perItemMaxPerCast)
     SPEC-fishing.md                           |  40  (the scoped crit rate)
     tests/sim/fishingCorpus.test.ts           |  24  (census)
```

---

# Verbose appendix

## The pre-hoist failure, in full (GATE 1a demonstrated failing)

`npx vitest run tests/fishing/oilShadowRelaxingArm.test.ts` on the PRE-hoist
placement:

```
 Tests  3 failed | 3 passed (6)

 × records the firing moment — a record exists at all, which pre-hoist it did not
   AssertionError: expected 0 to be greater than 0
 × the record is at a RELAXING firing moment with the gate's own input populated
   AssertionError: expected 0 to be greater than 0
 × the record is taken on the PRE-consume state, not the corpse the oil left
   TypeError: Cannot read properties of undefined (reading 'fishHp')
```

The two that PASSED are the anti-vacuity pair: the premise test (`start_run`,
`use_fishing_item`, no `play_cards` — the cast really is ended by the oil) and
the shadow-off test. So the cast shape was right and the record genuinely did
not exist. Post-hoist: 6 passed.

## The golden's six scenarios (GATE 1b)

Each captured pre-hoist, unchanged post-hoist. The `play_cards` bodies carry
the chosen card index and `focusPoint`, which is precisely what `dist` drives —
a hoist that changed the distribution would surface here.

```
no-authorization — trigger fires, mayConsumeOil refuses
    [start_run, play_cards, play_cards]                  escaped, 0 oils, 0 dry
focus oil spent on an empty meter, then play continues
    [start_run, use_fishing_item, play_cards, play_cards] escaped, 1 oil
lethal relaxing oil ENDS the cast before any card
    [start_run, use_fishing_item]                         caught, 1 oil
both triggers on one turn — only the lethal one may be sent
    [start_run, use_fishing_item]                         caught, 1 oil
both triggers against an EMPTY bag — OIL-POLICY-DRY
    [start_run, play_cards, play_cards]                  escaped, 0 oils, 4 dry
plain multi-turn cast — no trigger ever fires
    [start_run, play_cards, play_cards, play_cards]      escaped, 0 oils
```

## §2b — the user's cast, cast 13022748, turn by turn

```
turn action              fishHp  playerHp  meter   focus  fishPos hand        draw
  -  start_run            11/18     10/10    3/3  [2,2]   [2,4]  [2,3,74]      7
  0  play_cards  HIT       4/18      9/10    2/3  [2,3]   [3,4]  [2,3]         7
  1  play_cards  MISS      7/18      8/10    2/3  [2,3]   [4,4]  [2]           7
  2  play_cards  HIT       2/18      7/10    0/3  [4,3]   [4,3]  [6,75,4]      4
  3  use_fishing_item 937  0/18      7/10    0/3  [4,3]   [4,3]     —          —
```

The board at the decision (`oilMomentAudit --cast=13022748`):

```
card   6  cost 1  hit 5 (LETHAL)  zones [3,6,9]    covers 2/16  p 0.0253
card  75  cost 1  hit 6 (LETHAL)  zones [2,4,6,8]  covers 3/16  p 0.9752
card   4  cost 1  hit 5 (LETHAL)  zones [1,4,7]    covers 2/16  p 0.6754
bestKillProbability 0.975217  certain? no
fish-move dist top: [4,2] 0.667  [3,3] 0.290  [4,4] 0.017  [3,2] 0.008
```

Answer: **no card could kill with certainty; one came within 2.5pp.** All three
were lethal on DAMAGE — the constraint was connecting, with the meter at 0 and
exactly one placement available. Miss effects on that deck heal 3–6, which
lifts a 2-HP fish clear of the oil's 2 damage, so a miss would have destroyed
the oil's lethality for the rest of the cast.

## The full live consume census (`oilMomentAudit`, no filter)

Nine real consumes plus one sent against an already-complete doc (session 68's
fixed defect; flagged, not counted).

```
13019015 t7  focus     bestKill 0.032
13019665 t4  RELAXING  bestKill 0.587
13019677 t3  focus     bestKill 0.027
13019682 t2  focus     bestKill 0.000
13019682 t3  focus     bestKill 0.714
13019682 t2  RELAXING  bestKill 0.400
13022748 t3  RELAXING  bestKill 0.975   <- the user's cast
13022748 t3  focus     ★ POST-TERMINAL, server rejected
13022874 t2  focus     bestKill 0.000
13022876 t2  RELAXING  bestKill 0.580
```

## The batch's shadow records (session 69)

```
RELAXING firings, bestKillProbability:  0.505  0.506  0.690  0.964  0.481
FOCUS  firings, bestConnectProbability: 0.231  0.413  0.563  0.906  0.690  0.049  0.481
records 42 | firing moments 10 | null 0 | sanity 0 | throws 0 | wouldSkip 0
```

Combined with the historical four, all NINE Relaxing values ever observed:
`0.400 0.481 0.505 0.506 0.580 0.587 0.690 0.964 0.975`. Buckets: 0 zero,
0 one, **9 between**. Focus: 0 / 0 / **7 between**.

## §3 — the sim table the threshold does NOT move (n=8000/arm, paired on seed)

```
never                  oils     0   caught 68.71%
on-demand              oils  5578   caught 88.11%
conserve{1,1}          oils  3809   caught 88.38%
exchange{0.833,1}      oils  3809   caught 88.38%   <-- IDENTICAL
exchange-lo{0.333,1}   oils  3618   caught 88.33%
exchange-hi{0.95,1}    oils  3809   caught 88.38%
```

## §6 — batch tail

```
· batch state: cast 10, oils consumed 10, clean 4, ledger 6 left, held Focus 13 / Relaxing 49
▸ BATCH HALT (cast_cap) — 10 of 10 casts completed — the intended exit.
▸ §2c clean-cast tripwire: 4 clean cast(s) of 10, 10 oil(s) consumed. Threshold 6 — not reached.
▸ done. energy spent (guard-tracked) 180, casts 15
```

Rule 13 ledger read afterwards:

```
GAME ledger  (dayDocs pond 2):  14 / 20
REPO ledger  (guard-budget-fishing): 15 casts, 180 energy
LEDGERS DISAGREE: game 14 vs repo 15.
VERDICT: 6 cast(s) available this guard-day.
```

Ten distinct docIds were started (`13024476 13024510 13024527 13024544
13024550 13024562 13024567 13024574 13024579 13024581`), zero
`resuming_existing_cast` events. Reported, not reconciled.

## Census deltas, with the two that are findings rather than bookkeeping

```
traces           114 -> 124      clean            113 -> 123
playTurns        484 -> 521      responseDocs     631 -> 696
caught            26 ->  34      escaped           87 ->  89
card crits        17 ->  22      focus oilSkipped    6 ->  11
lax focusReach    76 ->  80      focus gap          15 ->  16
strict relaxReach 12 ->  12      lax-strict relax    4 ->  10   <- FINDING
caught casts in the gap  1 -> 2                                 <- FINDING
```

`strict.relaxingReachable` unmoved while live fired the trigger five times is
the strict definition working correctly and the metric becoming useless as a
firing rate. The second caught gap member turns session 68's falsification into
a repeatable mechanism.
