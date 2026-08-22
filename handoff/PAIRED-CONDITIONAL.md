# The paired prev-delta-conditional comparison — DESIGN, not yet run

**Written session 74 (2026-08-21), per brief §5. Nothing here has been
executed.** The brief asked for the design to be written down this session so
it is not improvised later, and for it to be written *after* §1's shrinkage
result, because a shrinkage answer changes how the comparison should be set up.
§1 has now run — see below for what it changed.

---

## 1. What is being re-done, and why the first attempt does not count

Session 73 §6 re-planned today's era with the prev-delta conditional switched
off (`shrinkageKByClass` → ∞, i.e. fall back to the class marginal). The
observed per-turn hit rate went **40.3% → 51.2%** and the `pConnect` gap flipped
from +9.38pp to −2.51pp. It is the largest effect anywhere in that session.

**It is not a result, and the reason is not "n is small".** The two arms ran
**125 turns against 134**. A policy that aims somewhere else catches and escapes
on different turns, so *which turns exist at all* is an OUTCOME of the arm.
Comparing per-turn rates across arms therefore conditions on a post-treatment
variable, and the direction of that bias is not knowable from the numbers: an
arm that ends its good casts early (a catch) removes exactly the turns that were
going well, and an arm that survives longer in bad casts adds exactly the turns
that were going badly.

So the defect is **structural, not statistical**. Running the same comparison on
more casts would make a biased estimate more precise.

## 2. The thing that has to change: the per-turn hit rate is not a valid endpoint

This is the whole design decision, and everything below follows from it.

**A per-turn rate has a denominator the arm chooses. A per-cast outcome does
not.** The cast set is fixed by the corpus — every era cast is replayed by both
arms, whatever either arm does inside it — so a cast-level endpoint is paired by
construction and needs no repair.

Note what this rules out. "Restrict to the turns both arms reached" is **not** a
fix; it is the same selection wearing a filter's clothes, because reaching turn
*k* is itself post-treatment. Neither is truncating each cast at the first
divergent choice: the arms' prefixes are identical up to that point by
definition, so that comparison has no signal in it at all.

## 3. Design

### 3.1 Unit and arms

- **Unit: the CAST.** Every clean cast in today's policy era (currently 39;
  `eraCasts` in `scripts/pConnectBiasDecomposition.ts` is the definition).
- **Arm A — SHIPPED.** `ERA_OPTS()`, `DEFAULT_RING_MODEL_OPTIONS` unmodified.
- **Arm B — CONDITIONAL OFF.** Identical, with
  `shrinkageKByClass: {1: ∞, 2: ∞}`.
- Both arms replay the **same** cast with the **same** leave-one-out matcher
  library and the **same** held-out training set. One seed; the replay is
  deterministic.

**Arm B is defined at the SHIPPED shrinkage, not at §1's re-fit optimum.** §1
found the re-fit pick unstable — it sits on a 0.006-logLoss plateau and moved
only because the top-1 tiebreak column reversed sign — and it is not adopted. A
comparison run against a parameter that does not ship would answer a question
nobody is asking. The re-fit pair `{1: 0.1, 2: 64}` may be added as a **third,
clearly secondary arm**; it must not replace arm A.

### 3.2 Endpoints, declared before the run

**Primary: caught or not, per cast.** Binary, one observation per cast, paired.
Analysed on the **discordant pairs only** (casts one arm catches and the other
does not) — an exact McNemar / binomial test on `b` successes out of `b + c`
discordant pairs — and reported with the discordant count in the same sentence
as the p-value. **A paired comparison whose discordant count is not stated is
not reportable**, because 39 casts can easily produce single-digit discordance
and a proportion out of 5 is not evidence.

**Secondary, in this order:**

1. **Turns to outcome**, paired difference per cast, cluster bootstrap over
   casts (`clusterCI` in `scripts/fishingRingCV.ts` is the existing
   implementation — reuse it rather than writing a second one).
2. **Mana at outcome**, same treatment. Session 72's redraw work established
   mana as the scarce quantity a policy can quietly burn.
3. **`pConnect` calibration**, reported PER ARM against that arm's own turns —
   as a description of each arm, never as a cross-arm difference. This is the
   quantity session 73 §6 compared across arms, and it is kept here purely so
   the earlier number has a successor that is labelled correctly.

**Not an endpoint: the per-turn hit rate compared across arms.** §2. If it is
printed at all it must carry the turn counts and the words "not comparable".

### 3.3 Which casts each arm may drop, and why

**Neither arm may drop any cast.** All 39 enter both arms. Three dispositions,
and the third is the only judgement call:

- `caught` — a success.
- `escaped_meter` / `escaped_mana` — a failure.
- **`hand_exhausted` — CENSORED, never a failure.** This is not a game outcome;
  it is the corpus running out of recorded hand refills, i.e. a limit of the
  data rather than of the policy. Counting it as an escape would penalise
  whichever arm survives longer, which is precisely the confound §2 exists to
  remove.

Because censoring is a judgement, the primary analysis is run **both ways** and
**both are reported**: (a) censored casts excluded from the discordant-pair
count, and (b) censored casts counted as failures. If the two disagree in
direction, the comparison is inconclusive and must be reported as such rather
than resolved by picking the friendlier one.

### 3.4 The assumption this rests on, stated rather than assumed

Off-policy replay treats **the fish's recorded trajectory as exogenous** — the
same path is dealt to both arms regardless of what either plays. If a play can
influence where the fish goes, both arms are being scored against a
counterfactual that never existed.

`scripts/auditMovementIndependence.ts` is the existing check. **Re-run it and
quote its current number in the comparison's own output**, rather than citing
the session that first ran it. A design that depends on an assumption should
print the assumption's evidence next to the result.

### 3.5 Power, before rather than after

At 39 casts and a 59.0% era catch rate, state the detectable effect **before
looking at the answer**: enumerate, for discordant counts of 5, 10, 15 and 20,
the split that would reach p < 0.05 two-sided. If the observed discordance falls
below the smallest of those, the honest report is "underpowered, here is the
point estimate and its interval", and the conditional stays open rather than
being exonerated by a null.

## 4. The gate, set on something the agent controls

CLAUDE.md rule 6: a gate must not require data that does not exist yet. A gate
of the form "the conditional is shown to be the cause" is unreachable at n=39
and would be a capture request wearing a gate's clothes.

**The gate is that the comparison is RUN under this design and REPORTED with
its discordant-pair count, both censoring treatments, the movement-independence
number, and the pre-computed power table — whatever it concludes.** A null
result meets this gate. A significant result that omits the discordant count
does not.

## 5. What this does not do

It does not license shipping a change. The ship-nothing posture
(`DECISIONS.md`, 2026-08-21) names this comparison as one of three exit
conditions, not as the exit itself.

---

### Changelog

- **session 74** — written. §1's shrinkage result changed one thing: arm B is
  pinned to the SHIPPED shrinkage rather than to a re-fit optimum, because the
  re-fit optimum turned out to sit on a plateau and is not adopted.
