# Session 70 §2 — the focus-meter policy sweep, and the gate it failed

**Verdict up front: no focus policy is recommended, and the sweep's ranking must
not be quoted.** Not because `{kind:"none"}` won — because both instruments that
could score these policies under-spend the focus meter by roughly half, which
makes the candidate policies *unexercised* rather than *ineffective*.

Reproduce with:

```bash
npx tsx scripts/focusProfileCheck.ts --runs=4000
```

```bash
npx tsx scripts/focusBudgetSweep.ts --matcher=loo
```

---

## 1. The corpus, recomputed — session 49's numbers are all stale

The brief quoted `focusBudget.ts`'s own header as the case for the module. Per
CLAUDE.md rule 9 those are hypotheses, and every one of them has moved. At 123
clean traces (was 73):

| statistic | session 49 | **now** |
|---|---|---|
| meter-out rate | 80.8% | **64.2%** |
| turns played at focus 0 | 50.4% | **43.9%** |
| spend on the opening move | 1.62 of 3 | **1.40 of 3**, 95% CI [1.23, 1.56] |
| profile by turn | 3.00 1.38 0.72 0.36 0.14 0.04 0.00 | **3.00 1.60 0.92 0.51 0.29 0.09 0.10** |

Meter-out is still the dominant loss (64.2%, against mana-out's 7.3%), so the
module's *premise* survives. But the fishery is measurably less meter-starved
than the module was designed against, and the profile declines more slowly.

**Anyone re-quoting "80.8%" or "1.62" from the module header is quoting a
73-cast corpus that no longer exists.** The header should be updated when a
focus policy is next worked on; it is left alone this session because nothing
about the module's code changed and rewriting a header to numbers that will move
again is not an improvement.

---

## 2. Gate 1 — the simulator does not reproduce the profile. FAIL.

Same statistic, measured the same way on both sides (mean `focusMeter` over
casts still alive at each turn, terminal state included). The sim arm is
`fishingEmpiricalAblation.ts`'s LIVE row — mined matcher over the contextual
fallback, empirical fish, real deck, real board.

```
  turn            0    1    2    3    4    5    6    7    8    9   10
  corpus       3.00 1.60 0.92 0.51 0.29 0.09 0.10 0.09 0.12 0.08 0.00
  sim (live)   3.00 2.23 1.31 0.56 0.26 0.12 0.07 0.02 0.01 0.05 0.00
  Δ            0.00 0.63 0.38 0.05-0.04 0.03-0.04-0.07-0.11-0.03 0.00
```

| | corpus | sim |
|---|---|---|
| opening spend | **1.40** [1.23, 1.56], n=123 | **0.77** [0.75, 0.79], n=4000 |
| meter-out rate | **64.2%** | **32.5%** |
| turns at focus 0 | 43.9% | 36.2% |
| catch rate | 27.6% | 20.7% |

The intervals do not overlap, and the Δ row localizes the disagreement further
than the summary does: **turns 3 onward agree closely (|Δ| ≤ 0.11), and the
entire divergence is turns 1 and 2.** The sim does not front-load the spend. It
reaches a comparable place by turn 3 and meter-outs at half the corpus's rate on
the way.

**So the sim does not reproduce the failure mode `focusBudget.ts` exists to
fix**, and it misses it precisely on the opening move that every candidate policy
is built to constrain.

### An instrumentation bug, found by its own test

The first version of `observeTurn` recorded once per loop iteration, and a
redraw or a turn-free oil consume re-enters the loop without advancing `turn` —
so it emitted `0 1 2 2 2 3` and every profile built from it was shifted from the
first repeat onward. That version put the sim's opening spend at 0.53. The
corrected one puts it at 0.77.

It was caught by `tests/fishing/focusProfile.test.ts`'s "consecutive turn
indices, no gap and no repeat" assertion, which was written because the two
profiles are averaged side by side and an instrumentation artefact would have
been indistinguishable from a finding. **The verdict did not change — it was
FAIL at 0.53 and it is FAIL at 0.77 — but the number quoted in a recap would
have been wrong by 45%.**

This is the fourth time in four sessions that the simulator has been caught
describing a fishery the server does not run (the oil gate's bimodality, the
`conserve` no-op, the missing mass in [0.833, 1), now this).

---

## 3. The sweep, and why its ranking says nothing

`focusBudgetSweep.ts` does **not** use `castSim` — it replays the corpus's own
real trajectories through `offPolicyReplay`, which is exactly the remedy the
brief proposed as the fallback. So the fishery is not modelled at all there; the
fish's actual movement is ground truth.

**It fails its own precondition anyway**, and it says so unprompted:

```
    TODAY's policy in the replay (corrected zone map, matcher tier LOO):
      mean spend on the FIRST move: 0.73 of 3
    => the replay's policy spends 52% of what the recorded one did.
    LIVE opening spend (ringPrediction.jsonl, n=50 casts): 1.08 of 3, 95% CI [0.82, 1.34]
    => PRECONDITION FAILED: the replay's 0.73 is OUTSIDE live's interval.
```

The table is what that failure predicts:

| policy | caught | Δ (casts) | McNemar p |
|---|---|---|---|
| `costCap(2)` | 40/123 = 32.5% | **+0 / −0** | 1.000 |
| `threshold(0.1)` … `threshold(1)` | 40/123 = 32.5% | **+0 / −0** | 1.000 |
| `costCap(1)` | 39/123 = 31.7% | +5 / −6 | 1.000 |
| `schedule(ceil(fishHp/bestHit))` | 39/123 = 31.7% | +0 / −1 | 1.000 |
| `schedule(3)`, `schedule(4)` | 37/123 = 30.1% | +0 / −3 | 0.250 |
| `threshold(2)` | 34/123 = 27.6% | +3 / −9 | 0.146 |
| `schedule(6)` | 26/123 = 21.1% | +4 / −18 | 0.004 |
| `schedule(8)` | 24/123 = 19.5% | +3 / −19 | 0.001 |
| `costCap(0)` | 12/123 = 9.8% | +3 / −31 | 0.000 |

**Every arm that could plausibly help is byte-for-byte inert. Every arm that
moves anything moves it down.** That is not a ranking, it is a description of an
un-exercised harness: a cap of 2 cannot bind on a policy whose mean opening
spend is 0.73, and a `threshold` of 0.1–1 cannot block a move the policy was not
going to make.

Session 50 diagnosed this same shape when the matcher tier was off entirely, and
`--matcher=loo` was the fix. **This is the loo arm.** The fix is not sufficient.

---

## 4. The causal story — and it localizes further than "the sim is wrong"

The replay takes the fish's **real recorded trajectory** as ground truth
(`offPolicyReplay.ts`'s licence section: the fish moves before the card, and
across-turn dependence is undetectable at n=211). So on the replay side the
fishery is not a model at all — it is the data.

Which means the divergence cannot be blamed on the fish model. Measured off the
same 123 traces:

- the **recorded** policy — what the bot actually did, live — spent **1.40** on
  the opening move;
- **today's** policy, replayed on those same traces, spends **0.73**.

Same casts, same fish, same board, half the spend. **The gap is in this repo's
model of its own policy, not in its model of the fishery.**

And the two instruments agree with each other while disagreeing with live:
`castSim` puts the opening spend at **0.77**, the replay at **0.73**. They share
no fish model — one samples empirical trajectories, the other replays recorded
ones — so their agreement is evidence that the shortfall lives in the shared
half, which is `chooseCard` and the distribution tiers feeding it.

The era split narrows it further. Session 47's zone-map fix landed mid-corpus:

- transposed-map era, 68 casts: opening spend **1.66**
- corrected-map era, 55 casts: opening spend **1.07**
- live, measured independently off `ringPrediction.jsonl`, n=50: **1.08**
  [0.82, 1.34]

The corrected era and the live measurement agree to within 0.01 — two
independent reads of the same quantity. The replayed policy's 0.73 agrees with
neither.

**So the open question is narrow and answerable offline: why does the same
`chooseCard` code spend 1.08 live and 0.73 in replay?** The candidates are the
conservatisms `offPolicyReplay.ts` already lists — leave-one-out weakening the
models the policy consults, and truncation at the recorded length — but which
one, and how much, is unmeasured. That measurement is the precondition for any
focus-policy decision, and it costs no casts.

---

## 5. What this does and does not license

**Does not:** recommend a focus policy; claim `{kind:"none"}` is correct; claim
the three families are ineffective; ship anything. `focusBudget.ts` remains
`{kind:"none"}` and `liveFishing.ts` still references none of it.

**Does:** establish that the meter-out premise is still real (64.2%), that
neither available instrument can currently score a fix for it, and that the
discrepancy is in the policy replay rather than the fishery data — which is a
smaller and more tractable problem than "the simulator is untrustworthy".

The honest reading of the last four sessions, stated so it is not softened
later: **sim-selected policy is not currently a reliable instrument for this
fishery.** Two of the three recent findings (the oil endpoints, this profile)
are the simulator disagreeing with live; the third is the replay disagreeing
with the record it replays. A policy recommendation is not blocked on more
sweeping — it is blocked on making one instrument reproduce a statistic that is
already measured on both sides.
