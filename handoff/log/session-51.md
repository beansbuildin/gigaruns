# Session 51 — fishing calibration fixes + the pre-dungeon dry-run

Commit range: `6237853..<SHA>`. Six brief items, all delivered. **0 energy
spent** — no fishing casts (cap was already 20/20 for 2026-08-19 at session
start) and no dungeon runs (§5 was explicitly a dry run).

Everything in `handoff/STATE.md` plus the detail that did not fit.

---

## §2 — per-class `shrinkageK`. GATE PASS.

### The brief's baseline was the wrong constant

The brief's table swept "the shipped `shrinkageK = 1`". The shipped value is
**3**. `DEFAULT_SHRINKAGE_K = 1` is `contextualFallback.ts`'s constant — a
different knob on a different model. Every figure in the brief's §2 table is
therefore against a baseline that does not exist in the ring model, including
its headline "0.34 nats".

### The sweep, re-derived

Scored under the **shipped sticky path** (`stickyStepDistribution` +
`lastStepClass` + a per-fold `estimateSwitchProbability`), not `runFold`'s
pre-session-49 mode+hard-ring form. `runFold` is left alone deliberately so
session 45's gate stays reproducible — but a knob tuned there would be tuned on
a model that no longer ships.

88 clean casts, 300 scored transitions, exactly 150 per class:

```
  k=1 turns only (n=150)              k=2 turns only (n=150)
  K        top1     logLoss           K        top1     logLoss
  0.1      50.0%    1.040  <- PICK    0.1      34.0%    1.856
  0.25     50.0%    1.042             0.25     34.0%    1.842
  0.5      50.0%    1.045             0.5      34.0%    1.821
  1        50.0%    1.051             1        34.0%    1.790
  2        50.0%    1.062             2        34.0%    1.747
  3        50.0%    1.072  (shared)   3        34.0%    1.718  (shared)
  5        50.0%    1.090             5        34.0%    1.680
  8        50.0%    1.114             8        34.0%    1.649  <- PICK
  16       49.3%    1.161             16       31.3%    1.614
  32       46.0%    1.218             32       29.3%    1.596
  64       38.7%    1.272             64       28.7%    1.590
  128      43.3%    1.314             128      25.3%    1.589  (bare argmin)
  512      35.3%    1.358             512      27.3%    1.590
  Infinity 25.3%    1.376             Infinity 28.0%    1.591
```

Two things the proposal did not predict, both of which changed the decision:

1. **k=2's log loss is flat from K=64 to K=∞** — 1.590 / 1.589 / 1.590 / 1.591,
   a spread of 0.002 at n=150. K=∞ *is* the "conditional tier off" arm
   (`n/(n+K) → 0`). The grid was extended to Infinity precisely so that
   candidate could be NAMED; a grid ending at 64 cannot distinguish "smooth a
   lot" from "drop it". The bare argmin at 128 is noise picking a plateau
   point.
2. **k=2's conditional buys top-1 and costs calibration** — 34.0% at every
   K ≤ 8, falling to 25–29% out on the plateau. So the tier is not
   sparse-and-worthless (the brief's mechanism); it is
   sparse-and-overconfident: right about the mode (FACT 2's reversal) and wrong
   in the tail. Different diagnosis, different fix.

The brief's specific claim "k=2 top-1 RISES 40.5% → 42.9% at K=16" is refuted:
it falls to 31.3%.

### Selection rule and the gate

Rule: **log-loss argmin subject to top-1 no worse than the shared value.** Two
reasons from this repo's own history — session 45's gate on this same model
required BOTH columns, and `DEFAULT_RING_MODEL_OPTIONS`'s own comment says not
to take a point on a plateau.

Stability across corpus prefixes (the re-fit pick at each size):

| casts | k=1 pick | k=2 pick | k=2 bare argmin |
|---|---|---|---|
| 55 | 0.1 | 16 | 32 |
| 66 | 0.1 | 16 | 16 |
| 73 | 0.1 | 512 | 64 |
| 80 | 0.1 | 512 | 32 |
| 88 | 0.1 | 8 | 128 |

k=1 is rock solid. **k=2's value is NOT identified by the data** — only its
direction is. So the gate was run on a FIXED pair at five prefixes it was not
chosen on:

| candidate | 55 | 66 | 73 | 80 | 88 | top-1 |
|---|---|---|---|---|---|---|
| `{0.1, 8}` **SHIPPED** | −0.063 | −0.047 | −0.054 | −0.047 | −0.047 | never worse |
| `{0.1, 16}` | −0.071 | −0.052 | −0.067 | −0.059 | −0.064 | **worse at 80 and 88** |
| `{1, 8}` | −0.053 | −0.039 | −0.047 | −0.041 | −0.044 | never worse |
| `{0.1, 3}` only | −0.030 | −0.023 | −0.019 | −0.018 | −0.012 | never worse |
| `{3, 8}` only | −0.033 | −0.023 | −0.035 | −0.029 | −0.034 | never worse |

CI excludes zero at every size for every row. Both halves contribute roughly
additively. `{0.1, 16}` is rejected by the dominance rule.

### What it does NOT do

Replay, paired, 88 traces, matcher LOO: caught 19/88 both arms, hit
147/326 → 144/321, **+0/−0 casts, +1/−1 turns.** Behaviourally inert, exactly
as session 49's sticky latent was. Measured gain is **0.047 nats pooled**
(0.062 on k=2 turns), not the brief's 0.34.

### Incidental

`fishingRingCV.ts` invoked `main()` from the middle of the file and threw a TDZ
`ReferenceError` against module-level consts declared below it. Invisible to an
importing runner — only running the script as a script finds it. Entry point
moved to the end.

---

## §3 — the matcher posterior mixture. GATE PASS, and the largest finding.

### It was never an "override"

Both `liveFishing.ts` and `offPolicyReplay.ts` already mixed the
ring-intersected matcher distribution with the ring model, at a **fixed weight
of `1 - ringFloor` = 0.9** (session 45). The defect is not a missing floor — it
is that **0.9 is a constant where a belief belongs.**

Instrumented on the 88-cast replay (`ReplayTurn.matcherWeight`, new):

| arm | matcher-active turns | median weight | casts ever >0.5 |
|---|---|---|---|
| fixed 0.9 | 134 | 0.900 | **88/88** |
| posterior | 132 | **0.135** | **4/88** |

The shipped tier committed 90% of the mass to the perimeter-walk hypothesis on
every cast in the corpus, on turn 1, before that hypothesis had survived a
single prediction — against a library supported by **8 of 88** casts. The
posterior identifies 4.

### The construction

```
P(next) = pi * P_matcher + (1 - pi) * P_ring
logit(pi_t) = logit(pi_0) + sum_t [ log P_matcher(obs_t) - log P_ring(obs_t) ]
```

- `pi_0` = the LOADED library's support rate (`supportingCastCount`, 8/88,
  Laplace +1/+2 → 0.100). Deliberately the loaded library, not a fresh mine:
  live reads `data/mined-patterns.json`, which can be older than the corpus,
  and the prior must describe the library in use.
- One turn's ratio clamped at 3 nats (an unbounded per-turn influence would
  reintroduce, one level up, the failure the mixture removes).
- Refutation is **absorbing** and NOT clamped — a dead candidate set is a
  logical impossibility, not a surprise, and pins the weight at 0.
- Weight capped at `1 - ringFloor`, keeping session 45's floor guarantee.

### The gate, and the arm that beat it

Paired per turn, cluster-bootstrapped over casts, 88 clean traces, matcher LOO:

| comparison | ΔlogLoss (per-cast mean) | Δcaught | Δhit turns |
|---|---|---|---|
| posterior − fixed 0.9 | **−0.632 [−0.760, −0.504]** | +11/−4 | +34/−35 |
| matcher OFF − fixed 0.9 | −0.667 [−0.808, −0.527] | +12/−6 | +46/−40 |
| **posterior − matcher OFF** | **+0.030 [+0.015, +0.044]** | +2/−1 | +11/−14 |

Absolutes: fixed 19/88 caught, posterior 26/88, off 25/88.

**The brief's "the mixture cannot lose to either arm, so the measurement stops
being decision-relevant" is REFUTED.** It loses to dropping the tier, by a
small amount whose CI excludes zero. Dominance holds for a mixture whose
posterior is CORRECT; this one carries two named approximations (per-turn
likelihoods treated as independent given the hypothesis; a point-estimate
prior). Gating it empirically was necessary and is why this is known.

The caught difference +11/−4 is McNemar **p ≈ 0.12** — suggestive, not
significant. The log-loss difference is the result.

Third independent measurement in the same direction: session 49's +1.337 nats
at n=15, session 50's shadow tier +1.300 [0.006, 2.593] at n=6, and now −0.632
offline at n=285 turns.

### Replay default deliberately broken with convention

`matcherWeighting` defaults to `"posterior"`, not to the old constant, against
this file's usual "defaults preserve published numbers" rule. That rule guards
against a stale default invalidating figures; here the competing risk is the
one this repo keeps getting bitten by — a future session runs
`matcherTier: "loo"`, believes it is measuring live, and is measuring a
weighting live abandoned. Reproducibility preserved by NAMING the old arm
(`matcherWeighting: "fixed"`); a test pins both.

Verified behaviour-preserving: the `"fixed"` arm reproduces session 50's LOO
numbers exactly (19/88 caught, 144/321 hit).

---

## §4 — the `nextPosition` override, floored and armed.

`NEXT_POSITION_OVERRIDE_WEIGHT = 0.99`. Does not reverse QUESTIONS.md §18's
arming decision; makes the armed behaviour survive its first miss.

**What the floor bounds, precisely** (not the brief's quoted "~5 nats", which
this construction does not give): the residual 0.01 is spread by the RING
model, so the worst case is `-log(0.01 * p_ring(actual))`. With
`ringFloor = 0.1` over a ring of at most 8 cells a legal cell gets ≥ ~0.0125,
capping a wrong override near **9 nats** against 20.7 unfloored. It does NOT
rescue a cell the ring model itself assigns zero — that is the ring's own
residual exposure, which the sticky chain handles and which has produced 0
zero-probability events across five live batches. The test asserts this
limitation explicitly rather than leaving it implied.

Cost when right: 0.01 nats.

**The paired comparison, taken for free.** Shadow dual-logging widened from
"the MATCHER overrode the ring" to "ANYTHING overrode the ring". Every such
turn now records what the ring alone would have predicted, so the first armed
batch gets before/after on the SAME fish rather than two batches on different
ones.

**The selection bug this closes.** Every ring comparator in
`ringPredictionReport.ts` filters on `tier`, so `tier: "override"` rows left the
ring model's sample entirely — selection on an outcome-adjacent variable, since
the override fires exactly on turns the server told us the answer. The fix is
NOT relabelling. New section pools ring rows scored on their own prediction
with overridden rows scored on their SHADOW:

```
── the RING MODEL on every turn (override rows re-entered via their shadow) ──
  100 row(s) where the ring model shipped, + 6 overridden row(s) recovered
  from their shadow, 23 row(s) NOT recoverable (written before dual-logging)
  ring model, ALL turns   n=106  top1=24.5%  logLoss=2.263
```

Unrecoverable rows are COUNTED and printed, not dropped.

**For the next reader: there are still ZERO `tier: "override"` rows.** The
override has never fired. All 29 currently-overridden rows are matcher rows.

---

## §5 — the dungeon dry-run. Found a real defect.

### The preflight was not reachable from a dry run

`--dry-run` sat in the skip condition. The one step the brief most wanted
vouched for was the one step the dry run stepped over. `ensureEnergyFor` gains
`{ readOnly }` — every read, every verdict, no claim — and `liveRun.ts` passes
`readOnly: args.dryRun`.

```
▸ liveRun.ts — STAGE 1 dry-run
  account <USER> noobId <NOOB>
  · --juiced: next genuinely new start_run will send isJuiced:true, index 3.
  · potions: NOT configured -> loading 0. This is the safe default, not a bug.
  ▸ energy preflight: pool 270 covers the planned 60 — no ROM claim needed.
▸ run 1/1
  [dry-run] would POST start_run (dungeonId 5, juiced)
  · no active run — nothing further to decide against, stopping.
▸ done. energy spent (guard-tracked) 0, runs 0
```

That short-circuits at the first branch, so the ROM-bank half was forced
read-only at two required amounts:

```
── requiring 400 energy (read-only) ──
  ▸ pool 270 short of the planned 400 (deficit 130) — reading the ROM bank.
  ▸ ROM bank: 37 ROMs, 27 with energyCollectable > 0, 2480 energy claimable.
  ▸ [read-only] would claim 1 ROM(s) for a snapshot total of 315/130;
    claiming NOTHING.

── requiring 100000 energy (read-only) ──
  HALTED (correct, fail-closed): pool 270 + ROM bank 2480 cannot fund the
  planned 100000
  detail: {"requiredEnergy":100000,"poolBefore":270,"bankTotal":2480,
           "romsWithBalance":27}
```

Bank read, deficit arithmetic, claim selection and fail-closed halt all
verified live. Nothing claimed.

### The defect: `serverErrorDetail` dropped `TokenExpiredError`'s body

Corrupting the JWT and reading what the log would carry:

```
before: {"message":"Auth rejected (HTTP 401). The JWT is expired or invalid
         — refresh it."}
after:  {"message":"... — {\"error\":\"Unauthorized\"}",
         "body":"{\"error\":\"Unauthorized\"}"}
```

`serverErrorDetail` handled `UnexpectedResponseError` and not
`TokenExpiredError`, which carries a `.body` with the identical meaning. So
every auth failure on both the dungeon and fishing sides logged this repo's own
summary string and nothing the server said — and an expired token, a revoked
session and a rate-limited auth all produced the same line while wanting
different responses.

**Fourth instance of the shape SPEC-fishing.md §4 catalogues:** a fix applied
to one class and the sibling with the same field never re-scored.
`tests/api/errors.test.ts` (the function had NO test at all) now pins every
body-carrying class in the module, so a fifth instance fails the suite.

### SIGINT

`shutdown.ts`'s header said the real `process.on` wiring was "thin enough not
to need its own test". With the handler eight sessions unexercised and a dry
run unable to press Ctrl-C, that stopped being good enough. Two tests raise a
real in-process SIGINT: the shared flag flips, the disposer genuinely
unsubscribes, and a leaked listener cannot keep a stale run's signal alive.
`forceExit` deliberately not raised — it calls `process.exit` and would take
the runner with it.

Also confirmed: `--juiced` without `--juiced-index=N` refuses to guess and
halts with the reason. Directly relevant to session 52.

### NOT covered, stated plainly

Tier enumeration and the first in-run decision point. Both need an ACTIVE run,
which needs the 60-energy juiced entry. **No dry run can reach them.** Session
52's first run is their first live exercise.

---

## §6 — spec, and the brief's own claim refuted

The brief asked me to record a rejected idea (a per-cast adaptive reversal
parameter), killed on a dispersion ratio of 0.80. Re-scored at 88 casts:

| | brief, as written | measured, 88 clean casts |
|---|---|---|
| k=2 casts with ≥2 comparable hop pairs | 15 | **24** |
| pooled reversal | 32/69 = 46.4% | **43/124 = 34.7%** |
| dispersion ratio (χ²/df) | 0.80 | **1.452** (χ²=33.39, df=23, **p=0.0746**) |
| casts that ALWAYS reverse | 1 | 2 |
| casts that NEVER reverse | 0 | **3** |

0.80 means "less spread than chance — nothing to model". 1.452 means the
opposite direction. At p=0.075 it is **suggestive, not established**, so the
practical instruction ("do not build it yet") is unchanged — but the REASON is
now "p=0.075 at n=24", not "there is no heterogeneity". Anyone citing the
brief's reason would be citing a number the corpus does not support.

`scripts/reversalDispersion.ts` committed so the claim is re-runnable on
whatever corpus the next reader has. Its hand-rolled χ² tail is pinned against
standard-table critical values; its corpus assertion tests the DIRECTION
(ratio > 1), not today's 1.452, so a future flip fails loudly rather than
silently reverting the finding.

Also: the pooled k=2 reversal rate has **drifted down** — FACT 2 recorded 41.7%
(35/84) at 66 casts; the comparable figure is now 34.7% (43/124).

SPEC-fishing.md §9 gains three sections: the override-vs-mixture principle
(with the three instances as a table, the tell — **a constant standing in for a
belief** — and two explicit limits on the frame), the corrected per-cast
reversal status, and the per-class smoothing result with its two transferable
sweep cautions.

---

## Meta

Three of the brief's checkable corpus claims were wrong this session (the
shipped shrinkage constant, the k=2 top-1 direction, the dispersion ratio),
after session 50 had one and sessions 06/07 had two. CLAUDE.md §9 says to treat
a third time as expected; it is now routine. Raised as open question 3 —
whether anything about how briefs assert corpus facts is worth changing, given
the author has no fixture access.

## Verification at the final commit

```
npx tsc --noEmit     clean
npx vitest run       46 files, 786 tests passed (was 750, +36)
git diff --check     clean
secret scan          no matches for 0x[a-fA-F0-9]{4,}, noobId, eyJ, PRIVATE
data/ mtimes         all predate the session — no test wrote a real data path
```
