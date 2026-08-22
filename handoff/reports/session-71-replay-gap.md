# Session 71 §1 — why `chooseCard` spent 1.08 live and 0.73 in replay

**Verdict up front: the replay was never broken. The comparison was.**

`1.08` is not one policy's opening focus spend. It pools **15 casts played
under the retired fixed-0.9 matcher weight** (which spent 1.667) with **35
played under today's posterior weighting** (which spent 0.829). Asked about the
policy that actually ships, the replay lands on **0.829 against live's 0.829**,
and reproduces the recorded opening move *exactly* on 30 of those 35 casts.

Reproduce with:

```bash
npx tsx scripts/replayGapDecomposition.ts
```

---

## 1. The decomposition, with its residual

Every row is a single toggle, measured rather than argued. The target is live's
pooled 1.080; the starting point is session 70's as-run arm.

| step | | Δ |
|---|---|---|
| session 70's as-run arm (all 123, re-mined library, posterior for all) | 0.732 | |
| + cast set: the 50 casts live actually logged | 0.760 | **+0.028** |
| + matcher library: live's loaded 3 patterns instead of a per-fold re-mine | 0.840 | **+0.080** |
| + matcher weighting: each cast under **its own era** | 1.060 | **+0.220** |
| target (live, pooled) | 1.080 | |
| **RESIDUAL, unexplained** | | **+0.020** |

The residual is 5.7% of the 0.348 gap. **It does not sum perfectly, and that is
the honest outcome** — the brief was right that a decomposition landing exactly
on the target on the first attempt should be distrusted.

### The named conservatisms are both ~nil

The brief's starting set was leave-one-out and truncation. Both were measured
by toggling them, and neither is the story:

| candidate | contribution |
|---|---|
| **leave-one-out** — the brief's *leading* hypothesis | **−0.020**, in the **wrong direction** |
| **truncation at the recorded length** | **exactly 0.000** |
| sticky switch probability (live estimates `s`, the replay took the constant) | +0.000 |

Truncation's zero is structural rather than lucky: **0 of 123** casts lose their
turn-0 observation to it. Truncation removes *tail* turns, and the opening move
is the one turn it cannot touch. That was worth measuring anyway — it converts
"probably irrelevant" into a number — but it was never going to be the cause,
and noticing why is cheaper than running it.

The switch probability was not on the brief's list. `liveFishing.ts` **estimates**
`s` from the clean corpus at load (0.0431) while the replay took the shipped
constant (0.05). A real live/replay difference; worth nothing here.

---

## 2. The 2×2 — policy, or cast set?

The obvious objection to an era split is that the two groups are *different
casts*. So each era's casts were replayed under **both** weightings:

| | replay w/ FIXED | replay w/ POSTERIOR |
|---|---|---|
| fixed-era casts (n=15) | **1.267** ← as played | 0.800 |
| posterior-era casts (n=35) | 1.114 | **0.743** ← as played |

Both rows move the same way under the same toggle. **It is the weighting, not
the cast set.** Reading down a column instead of across a row is what would
blame the casts.

---

## 3. Why the era marker is trustworthy

The marker is "does this `ringPrediction.jsonl` row carry a `matcherWeight`
field", and **that is exactly the trap CLAUDE.md rule 10 exists for** — a field
that first appears at date D makes any before/after comparison across D
suspect, because the discontinuity may be in the instrumentation rather than the
behaviour.

So it is corroborated on `ts`, a field that predates the instrumentation:

- all 15 legacy rows fall on or before **2026-08-19T22:23:49Z**
- all 35 posterior rows fall on or after **2026-08-20T18:27:39Z**
- **zero interleaving**

The split is temporal. The field's absence is a *symptom* of the era, not the
definition being tested.

---

## 4. The match is per-cast, not a coincidence of means

A mean that agrees while the individual moves disagree would be a coincidence
dressed as a result. It is not:

| arm | paired Δ (replay − live) | identical move cost |
|---|---|---|
| era-matched, posterior era | 0.000 [−0.16, 0.16] n=35 | **30/35 (86%)** |
| era-matched, fixed era | −0.067 [−0.20, 0.06] n=15 | **14/15 (93%)** |
| session 70's as-run arm | −0.320 [−0.53, −0.11] n=50 | 33/50 (66%) |

---

## 5. The same defect had failed the *other* gate too

`focusProfileCheck.ts` compared today's simulator against the pooled corpus.
That corpus is **three policy eras**:

| era | casts | opening spend | meter-out | catch |
|---|---|---|---|---|
| pre-logging (session 49's corpus) | 73 | 1.62 | 80.8% | 11.0% |
| retired fixed-0.9 weighting | 15 | 1.67 | 53.3% | 33.3% |
| **today's policy** | **35** | **0.83** | **34.3%** | **60.0%** |
| pooled — session 70's target | 123 | 1.40 | 64.2% | 27.6% |

The three eras disagree with each other far more than the sim disagrees with the
last of them. Against today's era the gate **PASSES**: sim 0.77 inside
[0.58, 1.08], meter-out 33.9% against 34.3%.

**Session 49's numbers were not stale.** 80.8% and 1.62 are *exactly* the
pre-logging era — correct for the corpus they were computed on. Session 70 was
right that they must not be quoted as today's fishery and wrong about why.

### Three caveats, printed by the script rather than buried here

1. **n=35 makes that interval 0.49 wide.** This is "not refuted at n=35", not
   "reproduced".
2. **The catch rate still disagrees badly** — sim 24.7% against today's era's
   60.0%. That is a *worse* disagreement than the one session 70 failed on, and
   it is now the open one. The simulator is not cleared.
3. **The comparison spans the Makeshift/Shroom deck break.** The sim arm is the
   Shroom deck as of this session's repoint; today's-era corpus is 20 Makeshift
   casts and 15 Shroom (opening spend 0.75 and 0.93 respectively). The verdict
   does not turn on which side you take, but the number is not deck-pure.

**An era is a BUNDLE, not a knob.** Between these groups the zone map was fixed,
the matcher weighting changed, lures were equipped and the rod was swapped. The
split establishes that the pooled comparison is *invalid*; it does not establish
that any one change caused the difference. §2's 2×2 is what isolates the
weighting, and it only does so for the replay.

---

## 6. What this licenses

**Does:** retire "the harness cannot see the phenomenon" as the reason the focus
sweep returned nulls. Establish that both offline instruments reproduce today's
policy's opening spend. Give the programme three numbers it did not have.

**Does not:** license quoting the sweep's ranking. The arms are still barely
exercised — but now for a *substantive* reason rather than an instrument fault:
today's policy really does spend only ~0.83 on the opening move, so `costCap(2)`
has nothing to cap. **"Inert because the policy does not need it" and "inert
because the harness cannot see it" are different findings**, and this is the
first. Nor does it clear the simulator generally (see caveat 2), nor rehabilitate
anything derived from the sim's bare-default oil arm — that is a different
instrument, still unfixed, and `+19.40pp` stays suspended.

**The through-line, updated.** The brief listed three sim-derived results that
failed against live and concluded no sim-derived policy claim has survived
contact. Two of those three — the focus profile and the replay gap — turn out to
have failed against *pooled targets* rather than against live. That makes the
tally less damning and the underlying lesson sharper: **the recurring defect in
this programme is not that the models are bad, it is that the comparisons are
built out of whatever data is on disk.** The oil arm's failure (caveat: catch
70% where the fishery catches 28%) is still a real model failure and is
untouched by any of this.
