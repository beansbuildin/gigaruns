# The probabilistic hold threshold — session 69, 2026-08-21

**Status: DERIVED, PRE-REGISTERED, SHADOWED. NOT SHIPPED.**
`scripts/liveFishing.ts` still plays `onDemandTriggers`;
`dendren.oils.policyApproved` governs the budget, not this timing rule.

---

## 1. The cast the user watched

**Cast `13022748`**, 2026-08-21 19:58 PT. Cards on turns 0, 1, 2; a Mid
Relaxing Oil on turn 3 that finished the fish. Caught.

| turn | action | fish | player | meter | focus | fish pos | hand | draw |
|---|---|---|---|---|---|---|---|---|
| — | `start_run` | 11/18 | 10/10 | 3/3 | [2,2] | [2,4] | 2, 3, 74 | 7 |
| 0 | `play_cards` — HIT | 4/18 | 9/10 | 2/3 | [2,3] | [3,4] | 2, 3 | 7 |
| 1 | `play_cards` — MISS | **7/18** | 8/10 | 2/3 | [2,3] | [4,4] | 2 | 7 |
| 2 | `play_cards` — HIT | 2/18 | 7/10 | **0/3** | [4,3] | [4,3] | 6, 75, 4 | 4 |
| 3 | `use_fishing_item` 937 | 0/18 | 7/10 | 0/3 | [4,3] | [4,3] | — | — |

**The board at the oil decision** (`npx tsx scripts/oilMomentAudit.ts
--cast=13022748`), with the fish-movement distribution rebuilt from the same
pipeline the live loop used and the cast's own corpus rows excluded:

| card | dmg | zones | cells covered (of 16) | p(kill) |
|---|---|---|---|---|
| 6 | 5 | 3, 6, 9 | 2 — {[3,4] [4,4]} | 0.0253 |
| **75** | 6 | 2, 4, 6, 8 | 3 — {[3,3] [4,2] [4,4]} | **0.9752** |
| 4 | 5 | 1, 4, 7 | 2 — {[3,2] [4,2]} | 0.6754 |

`bestKillProbability` **0.975217**. Fish-move distribution, top cells:
[4,2] 0.667, [3,3] 0.290, [4,4] 0.017.

### The answer to the question the user actually asked

**Was there a card in hand that would have killed the fish with certainty?
No — but one came within 2.5 percentage points.** All three cards were lethal
on damage (the fish was at 2 HP and the weakest card deals 5); the constraint
was CONNECTING, not killing.

Two facts sharpen this, and neither was in the brief:

- **The focus meter was at 0/3.** The marker was frozen at [4,3] and there was
  exactly ONE placement available. The bot had cards in hand and no ability to
  aim them. It had spent the meter on turn 2 moving the marker two cells to set
  up the shot that took the fish from 7 to 2.
- **A miss would not have been a free re-roll.** Miss effects on that deck heal
  the fish by 3 to 6, which lifts it clear of the oil's 2 damage — so a miss
  does not merely cost a turn, it *destroys the oil's lethality for the rest of
  the cast*. Holding the oil here saves it for a later CAST, not for later in
  this one.

**So the certainty gate already shipped in shadow — `conserve(r=1,f=1)` —
would have spent this oil too.** The user's concern lands on the probabilistic
band, which is where §3 is aimed.

## 2. The whole live record, for scope

`scripts/oilMomentAudit.ts` with no filter audits every consume in `logs/`:
**9 real consumes plus 1 that session 68 sent against an already-complete doc**
(the defect fixed that session; flagged, not counted).

Relaxing (lethal) firings — `bestKillProbability` at the moment of the spend:

| cast | turn | p |
|---|---|---|
| 13019682 | 2 | 0.400 |
| 13022876 | 2 | 0.580 |
| 13019665 | 4 | 0.587 |
| **13022748** | **3** | **0.975** |

**Not one is exactly 0 or exactly 1.** The simulator's measured bimodality —
34.3% at 0, 55.8% at 1, 9.9% between — does not reproduce live. At n=4 that is
a signal and not a refutation, but it is the exact kind of contradiction shadow
mode exists to surface, and it is the reason the threshold below can matter
live while being invisible in sim.

## 3. The derivation

A lethal-band oil converts an uncertain catch into a certain one. With `p` the
chance of taking the fish without it:

    spend when  (1 - p) > v      hold when  p >= 1 - v

where `v` is what one oil is worth **in fish**. Nothing is fitted; the only
input is `v`.

**`v` is measured, not chosen.** Session 66, corpus-derived over 109 casts:
holding zero Mid Relaxing Oil costs an expected +1.83pp of catch rate, 95%
Wilson [0.5pp, 6.4pp] — **~6 oils per extra fish**, interval ~1.5 to ~20
(`handoff/reports/session-66-relaxing-cost.md`).

| oils per extra fish | v | hold threshold |
|---|---|---|
| 1.5 (interval low) | 0.667 | **0.333** |
| **6 (point estimate)** | **0.167** | **0.8333** |
| 20 (interval high) | 0.05 | **0.95** |

**PRE-REGISTERED: `{ relaxing: 0.8333, focus: 1 }`**
(`PREREGISTERED_EXCHANGE_THRESHOLDS`), fixed before this session's batch was
cast. The interval must travel with the point estimate — its numerator is TWO
casts, and 0.33 and 0.95 are genuinely different policies.

### Why the Focus arm keeps threshold 1

Not an omission. The derivation prices an oil that converts an uncertain catch
into a certain one, so `(1 - p)` is a number of fish. **A Mid Focus Oil does no
such thing** — it restores two points of meter, changing which cells are
reachable later, and buys no catch directly.
`bestConnectProbabilityFromFrozenCell` is not a `p` this arithmetic can use,
and no corpus-measured oils-per-extra-fish exists for the Focus trigger.
Borrowing the Relaxing number would be the fitted constant this whole
construction exists to avoid, wearing a derivation's clothes.

Stock is a SECOND reason the arms should differ and is deliberately excluded:
live on 2026-08-21 the account held Relaxing 56 / Focus 19, so the scarce oil
is the Focus one and its shadow price is higher — but scarcity is not efficacy,
neither shadow price has been measured, and inventing one would be a third
unmeasured constant.

## 4. What it costs, and the scope it actually touches

**In simulation it costs and saves nothing, because the simulator cannot see
it.** n=8000/arm, paired on seed:

| policy | oils | caught |
|---|---|---|
| never | 0 | 68.71% |
| on-demand | 5578 | 88.11% |
| conserve{1,1} | 3809 | 88.38% |
| **exchange{0.833,1}** | **3809** | **88.38%** |
| exchange-lo{0.333,1} | 3618 | 88.33% |

The sim puts no `bestKillProbability` mass in [0.833, 1), so the derived
threshold is byte-identical to the certainty gate there. **No sim-derived
saving may be quoted for it** — `tests/fishing/oilExchangeRate.test.ts` pins
that absence so a future report cannot invent one, and separately pins that the
dial is not inert (at the interval's low end it does move: 3618 vs 3809).

**On the live record it changes ONE decision in four** — cast 13022748, the
one the user watched. The other three Relaxing firings (0.400, 0.580, 0.587)
sit below 0.833 and are spent under both rules.

Reported against the right denominators, because the difference matters:

| denominator | changed |
|---|---|
| all live consumes (9) | 1 — **11%** |
| live Relaxing firings (4) | 1 — **25%** |
| corpus firing moments in the [0,1) band | ~9.9% is the sim's estimate; live says 4/4, n=4 |

**Escapes, not just oils saved.** Holding the oil at p = 0.9752 accepts a
**2.5% chance of losing that fish**. Over the four firings on record the rule
saves 1 oil and risks 0.025 fish. At the measured exchange rate an oil is worth
0.167 fish, so the trade is favourable by roughly 7x on the point estimate —
and unfavourable at the interval's low end, where an oil is worth 0.667 fish
and the hold threshold would be 0.333 instead. That is what the interval is
for.

## 5. The proxy, and which way it is wrong

The derivation wants `P(catch EVENTUALLY without the oil)`.
`bestKillProbability` is `P(kill THIS TURN with an affordable card)`, which is
**smaller** — the cast can go on and land the fish two turns later.

So the proxy **understates `p`**, the gate holds **less** often than the
exchange rate says it should, and every oil this rule saves is an oil the
correctly-specified rule would also have saved. **It errs toward spending.**
Quote that whenever the saving is quoted.

The bias is bounded in the one place it can be reasoned about — the lethal
band. A miss heals the fish clear of the oil's damage, so the trigger does not
simply recur next turn, and the held oil is held for a later cast rather than
for later in this one. Which is precisely what the directive asked for.

---

## 6. The ten-cast batch — what the hoist bought, measured against a real server

`npx tsx scripts/liveFishing.ts --oil-batch --casts=10`, 2026-08-21 21:59–22:02
PT. Halted on `cast_cap`, the intended exit. **8 caught / 2 escaped**, 10 oils
consumed (4 Relaxing, 4 Focus + 2 more Focus on one cast), 4 clean casts.

### The shadow, before and after the hoist

| | session 68 (pre-hoist, 5 casts) | session 69 (post-hoist, 10 casts) |
|---|---|---|
| shadow records | 13 | **42** |
| at a FIRING moment | 1 | **10** |
| Relaxing firings observed | **0** | **5** |
| `bestKillProbability` null | 13 of 13 | **0 of 5** |
| `bestConnectProbability` null | — | **0 of 7** |
| sanity violations / throws | 0 / 0 | **0 / 0** |

**The Relaxing arm is now observed live**, five times, with the gate's own
input populated on every one. That is the observation session 68 could not buy
at any number of casts, and the `haltOnShadowBlind` tripwire armed for this
batch never fired.

### The live inputs, and what they say about the sim

Relaxing `bestKillProbability`, all nine firings on the entire live record:

    0.400  0.481  0.505  0.506  0.580  0.587  0.690  0.964  0.975

Focus `bestConnectProbabilityFromFrozenCell`, this batch:

    0.049  0.231  0.413  0.481  0.563  0.690  0.906

**Every single one is strictly between 0 and 1.** Buckets: Relaxing 0 zero /
0 one / **9 between**; Focus 0 / 0 / **7 between**. The simulator's measured
bimodality — 34.3% at exactly 0 and 55.8% at exactly 1 — **does not appear in
live play at all.**

That is not a small discrepancy in a nuisance parameter. **It is the evidence
the whole "threshold 1 is zero-parameter and everything else is a plateau"
argument rested on** (session 67, `oilConserveSweep.ts` §2b), and live says the
distribution has no mass at either endpoint.

### What each rule would have done, on the live record

| rule | Relaxing oils held, of 9 firings |
|---|---|
| `on-demand` (shipped) | 0 |
| `conserve{1,1}` (certainty gate, shadowed) | **0** |
| `exchange{0.8333, 1}` (this report) | **2** — the 0.964 and 0.975 firings |

**The certainty gate has never once held a Relaxing Oil live**, across every
firing on record. Shadowed over ten casts it recorded `wouldSkip` on **zero**
of forty-two records. On this evidence, shipping it would change nothing —
which is a much stronger statement than the sim could make, and it is an
argument for the exchange-rate threshold rather than against gating.

**Cost of the two holds, stated as escapes and not only as oils.** Holding at
p = 0.964 and p = 0.975 accepts 0.036 + 0.025 = **0.061 expected fish** to save
2 oils. At the measured rate of 6 oils per extra fish those 2 oils are worth
0.33 fish, so the trade is favourable by ~5x on the point estimate. **At the
interval's low end (1.5 oils/fish) it is not** — there an oil is worth 0.667
fish, the threshold would be 0.333, and eight of the nine firings would be
held. This is exactly why the interval must be quoted with the number.

**Still NOT SHIPPED.** `liveFishing.ts` plays `onDemandTriggers`; both gates are
observational.
