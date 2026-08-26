# OIL CONSERVATION POLICY — APPROVED (§39), SHIPPED (§40), AND NOW AT THE USER'S THRESHOLD OF 0.85 (§43)

Session 67, 2026-08-21. Brief §1. **Shipped 2026-08-25, session 97 §1d.
Threshold lowered `1` → `0.85` the same day, session 98 §A, by user directive
(QUESTIONS.md §43) — §8 is the current status and supersedes §7's "no-op".**

> **STATUS, because this document said "nothing here is shipped" for 29
> sessions and that is the failure QUESTIONS.md §39 exists to stop.**
>
> - The user **approved the direction** (QUESTIONS.md §39, 2026-08-25).
> - `scripts/liveFishing.ts` now plays **`necessityGatedDoubleLethalTriggers`**
>   — the Relaxing-only necessity gate composed under the double-lethal band
>   (session 97 §1b, `tests/fishing/oilNecessityComposition.test.ts`).
> - ⚠ **AT THRESHOLD `1` IT CHANGED NOTHING LIVE** — 18 replayed evaluations
>   and 24 live observations, maximum `bestKillProbability` **0.991**, zero at
>   1. See §7. **That is no longer the shipped configuration:** the user set the
>   Relaxing threshold to **0.85** on 2026-08-25 (QUESTIONS.md §43) and on the
>   same 24 observations the gate now holds **9 — 37.5%**. §8.
> - ⚠ **§2–§5's tables are `castSim` output and are SUSPENDED** under
>   `handoff/OIL-POLICY.md` §0a. They are kept as the derivation's record.
>   **Do not quote "88.38%", "+19.66pp" or "32% less oil" as live evidence** —
>   §7 explains why the mechanism behind them does not exist live.

**Do NOT reproduce this with `npx tsx scripts/oilConserveSweep.ts`.**
`OIL-POLICY.md` §0a forbids re-running the oil sweep on that instrument by
name — "that produces a second unsupported number" — and `runArm` uses
`castSim`'s bare default arm, which is the arm §0a suspends. The live
re-derivation is `npx tsx scripts/liveGateFiringRates.ts`.

---

## 0. The directive this answers

> Keep crafting, but use oils only on an as-needed basis. If the autofisher
> believes it can catch the fish without oil, don't use the oil — conserve
> inventory for future casts. The priority is to use mana to get the fish as
> close as possible to caught, with the oils as a backup to guarantee a catch
> if need be.
>
> — user, 2026-08-21

---

## 1. THE RECOMMENDATION

> **Keep `on-demand`'s two triggers exactly as they are, and add a necessity
> condition to each: skip the oil when the bot can already GUARANTEE the
> outcome without it.**
>
> - **Relaxing Oil** — fires at `fishHp <= 2` as today, *unless* an affordable
>   card in hand kills the fish with certainty from a reachable focus cell.
> - **Focus Oil** — fires at `focusMeter == 0` as today, *unless* an affordable
>   card already connects with certainty from the cell the marker is frozen on.

It is `conservingOil({ relaxing: 1, focus: 1 })` in
`src/strategy/fishing/oilTiming.ts`. Approving it means setting
`policyApproved: true` and swapping the trigger call in `liveFishing.ts`; the
code is written and tested, and deliberately not wired.

**There is no tuned constant in it.** §4 explains why that is available rather
than lucky.

---

## 2. THE ANSWER TO THE BRIEF'S OWN QUESTION: no, it is not "switch to
focus-only"

The brief asked for the existing arms to be re-ranked under the new objective
first, and to say plainly if that settled the question. **It does not, and the
re-rank alone would have given the wrong answer.**

The re-rank reproduces exactly (byte-for-byte against `handoff/OIL-POLICY.md`
at n=8000, `costsTurn=false`, amount 2), and on **oils per extra fish** it does
reverse the old ranking:

| policy | catch | Δ vs never | oils | **oils per extra fish** |
|---|---|---|---|---|
| focus-when-empty-only | 86.45% | +17.74pp | 3515 | **2.48** |
| on-demand (SHIPPED) | 88.11% | +19.40pp | 5578 | 3.59 |
| lethal-relaxing-only | 73.19% | +4.47pp | 1821 | 5.09 |
| heuristic-c | 73.22% | +4.51pp | 2630 | 7.29 |
| start | 74.38% | +5.66pp | 16000 | 35.32 |
| never (control) | 68.71% | — | 0 | — |

And the **marginal** step is worse than the average column suggests:
`on-demand` over `focus-when-empty-only` buys 133.0 extra fish for 2063 extra
oils = **15.51 oils per extra fish**. That margin *is* the Relaxing trigger.

**Two cautions on this table, because a ratio invites both mistakes.**

- **`never` is not the winner.** Taken literally, "fewest oils per fish" is
  optimised by spending none, at 0/0. The directive says *backup*, not
  *abstain*, so `never` is the control and the ranking is over arms that
  actually spend.
- **Those CIs are the SIM's precision, not the world's.** They are ±0.01
  because n=8000 paired on seed. Session 66 priced the same Relaxing trigger
  from the corpus at ~6 oils per extra fish with a 95% interval of roughly
  **1.5–20**. That interval is the honest one for a real decision; this table's
  is a statement about how repeatable the simulation is.

**Why the re-rank is not the answer.** It ranks only policies that were already
written. The necessity gate beats the best of them on **both** axes at once:

| policy | catch | Δ vs never | oils | oils per extra fish |
|---|---|---|---|---|
| on-demand | 88.11% | +19.40pp | 5578 | 3.59 |
| focus-when-empty-only | 86.45% | +17.74pp | 3515 | 2.48 |
| **conserve(r=1, f=1)** | **88.38%** | **+19.66pp** | **3809** | **2.42** |

It catches slightly more than the shipped policy and spends **32% less oil**
doing it. Recommending "switch to focus-only" would have thrown away 1.9pp of
catch rate for nothing.

---

## 3. WHY IT WINS — the causal story, which matters more than the ranking

Score each gate alone, leaving the other on `on-demand`'s ungated trigger:

| arm | catch | Δ vs never | oils |
|---|---|---|---|
| on-demand (neither gated) | 88.11% | +19.40pp | 5578 |
| conserve(r=1, f=**2**) — only the RELAXING gate | **88.11%** | **+19.40pp** | 4396 |
| conserve(r=**2**, f=1) — only the FOCUS gate | 88.46% | +19.75pp | 4853 |

Two clean, separate mechanisms:

**The Relaxing gate is free.** Its catch rate is *identical* to on-demand's —
88.11%, +19.40pp, on the same seeds — for **1182 fewer oils (−21%)**. It costs
literally nothing because of what it skips: on 55.8% of the turns the lethal
trigger fires, an affordable card kills the fish with probability exactly 1
(§4). Spending an oil to convert a certainty into a certainty buys nothing, and
that is the majority of the trigger's firings.

**This is the same finding session 66 got from the corpus, by a different
instrument.** There, the lethal trigger was reachable on 12 of 109 real casts
and **10 of the 12 were caught anyway**. Two independent measurements — one on
109 live casts, one on 8000 simulated ones — agree that roughly five of every
six Relaxing spends are the "would have caught it without the oil" case the
directive names.

**The Focus gate is not free — it is positive.** It gains +0.35pp of catch rate
*and* saves 725 oils. The mechanism is within-cast, and it is the part the
directive did not anticipate: the account holds a small number of oils, so a
cast that spends its Focus Oil on the first turn the meter empties has none for
the turn three moves later when the frozen cell genuinely covers nothing.
Skipping the unnecessary spend **defers** the oil to the turn that needs it.
The meter never regenerates through card play (CONFIRMED session 13), so those
later turns are all played from one frozen square and their quality varies a
great deal.

**Mana first is structural, not a promise.** The brief asked for a check that
the gate does not make the bot hold mana back in anticipation of an oil. It
cannot. The oil decision is taken in `castSim.ts` before `policy.act`, and the
context the card policy receives (`FishPolicyContext`) carries no oil field of
any kind — `["dist","fishHp","focusBudget","gridSize","hand","mana"]`, pinned
on the key set itself in `tests/fishing/oilNecessity.test.ts`. The card policy
is a pure function of state that does not mention oils, so no policy
expressible in `oilTiming.ts` can change which card it plays.

---

## 4. THE THRESHOLD IS NOT A FITTED PARAMETER, and that is a measurement

"Believes it can catch the fish" had to become a number, and a number invented
to make a table look good is worth very little. So the quantity the gate reads
was measured at the moments the triggers actually fire (n from 8000 casts):

| | exactly 0 | (0, 0.25) | [0.25, 0.5) | [0.5, 0.75) | [0.75, 1) | **exactly 1** |
|---|---|---|---|---|---|---|
| `bestKillProbability` (n=2097) | 34.3% | 0.0% | 2.2% | 7.1% | 0.6% | **55.8%** |
| `bestConnectProbability` (n=3481) | 59.8% | 0.0% | 6.6% | 5.8% | 0.1% | **27.8%** |

**Both are bimodal.** 90% of Relaxing decisions and 88% of Focus decisions land
on exactly 0 or exactly 1, because the matcher's distribution frequently
collapses onto a single cell and a card then either covers it or does not.

The consequence is that the dial has a plateau, not a peak:

| thresholds | catch | oils | oils per extra fish |
|---|---|---|---|
| r=2, f=2 (always-fire = on-demand) | 88.11% | 5578 | 3.59 |
| r=1, f=1 **(recommended)** | 88.38% | 3809 | 2.42 |
| r=0.75, f=0.5 | 88.46% | 3675 | 2.33 |
| r=0.5, f=0.5 | 88.42% | 3548 | 2.25 |
| r=0.25, f=0.25 | 88.29% | 3420 | 2.18 |
| r=0, f=0 (never-fire) | 68.71% | 0 | — |

Everything from 0.25 to 1 sits inside 0.17pp of catch and 2.18–2.42 oils per
fish. **A tuned pair buys ~0.08pp over the zero-parameter one** — on a
simulator whose control arm catches 68.71% against a real fishery's 25.9%. That
is far below the model's own calibration error, so the tuned constant would be
a number someone has to defend forever in exchange for nothing measurable.

`1` is chosen because it is the plateau's endpoint AND because it reads back as
the directive's own sentence: *if the bot can guarantee the outcome without the
oil, don't spend the oil.*

---

## 5. THE FINITE-STOCK DAY — the only table that models "future casts"

Every number above hands each cast a fresh oil, so no policy is ever punished
for running dry. That is right for pricing a trigger and wrong for the
directive, whose premise is a shared stock. Here one pool is drawn down across
a 20-cast day (the server's cap), 400 days per cell:

| stock (focus, relaxing) | never | on-demand | focus-when-empty-only | **conserve(r=1,f=1)** |
|---|---|---|---|---|
| **18 focus, 0 relaxing** *(what you hold today)* | 13.74f / 0.0o | 18.12f / 11.0o | 18.12f / 11.0o | **18.14f / 8.6o** |
| 8 focus, 8 relaxing | 13.74f / 0.0o | 17.14f / 12.8o | 16.82f / 7.8o | **17.63f / 9.5o** |
| 4 focus, 4 relaxing | 13.74f / 0.0o | 15.71f / 7.6o | 15.35f / 4.0o | **16.29f / 6.1o** |
| 2 focus, 2 relaxing | 13.74f / 0.0o | 14.85f / 4.0o | 14.58f / 2.0o | **15.29f / 3.6o** |
| 40 focus, 40 relaxing *(effectively unlimited)* | 13.74f / 0.0o | 18.19f / 16.2o | 18.13f / 11.0o | **18.20f / 11.0o** |

**The conserving policy dominates the shipped one at every stock level, on both
axes.** The scarcer the stock, the bigger the gap: at 4 and 4 it catches 0.58
more fish per day on 1.5 fewer oils, because on-demand has run dry by the time
the hard casts arrive.

At your **current** 18 Focus and 0 Relaxing it is a pure saving — same fish,
**2.4 fewer oils per day**, which is roughly one extra day of stock per four
days played.

---

## 6. Standing caveats, restated because they bound everything above

- **MODELLED, NOT OBSERVED.** The corpus has one fully-captured oil cast
  (13019015). It confirms the mechanics — the +2, the slot, no turn cost, no
  mana cost — and cannot score an effect: n=1, and the cast is selected by its
  own state rather than sampled.
- **Do not read +19.66pp as a forecast.** The sim's control arm catches 68.71%;
  the real fishery catches 25.9% (dead-era-excluded). This is a
  policy-comparison instrument, not a calibrated model of Dendren.
- **The Relaxing arm is scored on 0 held stock.** You hold no Relaxing Oil
  today, so its half of this recommendation is inert until crafting finishes.
  Session 66's separate report prices whether that crafting is worth doing;
  this document does not re-answer it.
- **Approving this is a separate act from approving the budget.**
  `mayConsumeOil` enforces the distinction in code and will refuse every spend
  until `policyApproved` is true.


---

## 7. ⚠ [session 97 §1a] THE GATE IS A MEASURED LIVE NO-OP, AND §4'S JUSTIFICATION IS A `castSim` ARTEFACT

**This section supersedes §3's "the Relaxing gate is free… for 1182 fewer oils
(−21%)" as a statement about live play.** It does not retract §3 as a statement
about the simulator, which is what §3 measured and all it ever measured.

The session-97 brief asked for the Relaxing-only gate to be re-swept. It was
re-derived instead on the instrument that resolves against **real fish
trajectories** — `scripts/liveGateFiringRates.ts`, built in session 75 — because
§0a forbids the sweep and because the corpus is simply the better evidence:

| source | Relaxing gate evaluated | gate HELD (withheld an oil) | max `bestKillProbability` | at exactly 1 |
|---|---|---|---|---|
| replay, whole clean corpus (684 turns) | **18** | **0 — 0.0%** | 0.990 | **0** |
| the live loop's own record | **20** | **0 — 0.0%** | 0.991 | **0** |
| union of every Relaxing observation ever | **24** | **0** | 0.991 | **0** |

**§4's threshold argument does not survive this.** §4 chose `1` because the
gate's input is bimodal with **55.8% of Relaxing decisions at exactly 1** — "no
constant to defend" between the spikes. That upper spike is a property of
`castSim` and of nothing else. Two independent instruments that resolve against
real movement put **no mass at 1 at all**; live, the top of the range is
approached (0.991) and never reached.

So the mechanism §3 credits the saving to — *"on 55.8% of the turns the lethal
trigger fires, an affordable card kills the fish with probability exactly 1…
spending an oil to convert a certainty into a certainty buys nothing"* — is a
description of the simulator. Live, that case has occurred **zero times in 24
observations**. The −21% does not transfer.

**And the direction of the residual error makes this stronger, not weaker.**
`pConnect` is optimistic (+9.38pp, session 73). Correcting it moves these inputs
**DOWN**, i.e. further from the only boundary they are compared against. A
better estimator cannot make this gate fire; it can only make it fire less.
That argument does not depend on the sample size, which is what makes it worth
more than "it has not fired yet".

### Why it shipped anyway

Three reasons, and none of them is "the numbers held up":

1. **It is the user's approved policy** (§39), and leaving an approved
   directive unwired for another 29 sessions is the exact failure that audit
   found.
2. **It is provably safe.** A gate that never fires cannot cost a catch, and
   the composition with the live double-lethal band has no interaction term at
   any `fishHp` (session 97 §1b, proved by partition rather than swept).
3. **It is correctly positioned for the day the estimator changes.** If
   anything ever does put mass at certainty, the directive is already wired.

### The open decision, which is the user's and NOT an agent's

**Should the threshold be lowered so the gate actually bites?** At `1` it is
inert. The live observations cluster below it — 0.991 is the maximum and the
shadow's own exchange-rate arm already uses **0.8333**, which WOULD have fired.
Lowering it would start conserving oil and would start risking catches, and
`oilTiming.ts`'s standing rule against tuning the necessity thresholds means no
agent may pick that number. It needs a user directive, and it is the real
question this document now leaves open.

---

## 8. ⚠ [session 98 §A] THE THRESHOLD IS NOW `0.85`, AND THE GATE IS NO LONGER A NO-OP

**§7's open decision was decided by the user, not by an agent.** QUESTIONS.md
§43, 2026-08-25: `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` moves from `1` to
**0.85**, which sits just above the pre-registered exchange-rate threshold
(0.8333, session 69 §3) and well below the live maximum (0.991) — deliberately
near the aggressive end of the range that was on the table.

### What it does on the corpus, measured rather than swept

`npx tsx scripts/liveGateFiringRates.ts` §3c — a block added this session so
the question is answered by running the instrument, not by reading a table.
`OIL-POLICY.md` §0a forbids the sim table as a source for this, so it is not
cited here.

| observations | n | held at `1` | held at `0.85` | newly held |
|---|---|---|---|---|
| the live loop's own record | 20 | 0 | **8 — 40.0%** | 8 |
| pre-hoist, recovered offline (session 69) | 4 | 0 | 1 — 25.0% | 1 |
| **UNION — every Relaxing observation ever** | **24** | **0** | **9 — 37.5%** | **9** |
| replay, whole clean corpus (684 turns) | 18 | 0 | 4 — 22.2% | 4 |

The nine newly-held values are `0.857, 0.914, 0.925, 0.945, 0.961, 0.964,
0.971, 0.975, 0.991`. **So roughly three of every eight Relaxing spends the
old policy would have made are now withheld** — the tradeoff the user accepted,
stated as the number rather than as a direction.

### Three consequences that are easy to re-discover as bugs

1. **This gate is not a "certainty gate" any more.** Prose in this repo that
   calls it one is describing the retired configuration. It withholds on
   *confidence*, not certainty.
2. **`NECESSITY_EPSILON` is inert on the Relaxing arm** — `0.9999999999999999`
   clears `0.85` under a bare `>=` too. It is kept (the Focus arm is still at
   `1`, and `meetsThreshold` takes arbitrary thresholds), and the assertions
   that actually exercise it were re-pointed at an explicit threshold of `1`.
3. ⚠ **`liveGateFiringRates.ts` §4's standing verdict does not survive for this
   arm.** *"`pConnect`'s +9.38pp optimism reaches NO live level gate — CLOSED BY
   IRRELEVANCE"* held because every level gate sat at `p = 1` and no observation
   ever reached it. The corpus has mass on **both sides** of 0.85, so correcting
   an optimistic estimator now moves observations across the boundary and
   changes gate verdicts. The claim still holds for the FOCUS arm. The script
   says this itself; it is repeated here because §7 above quotes the old
   direction argument as a strength.

### And what §7's direction argument becomes

§7 argued that because `pConnect` is optimistic, a better estimator "cannot
make this gate fire; it can only make it fire less". At `1` that was a safety
argument. At `0.85` it is a **risk** argument pointing the other way: a
correction moves inputs down across the boundary, so the gate would withhold
FEWER oils, not more. Same fact, opposite consequence — which is exactly why
§0a's suspension of the sim and this document's separation of derivation from
live measurement matter.
