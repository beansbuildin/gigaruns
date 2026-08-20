# STATE — session 51 — 2026-08-19 — commit af2c587

## Status
Session-51 brief: **all six items delivered.** Two gates PASS (§2, §3), one
correctness fix shipped (§4), one dry-run that found a real defect (§5), one
spec item where **the brief's own claim was refuted** (§6). No fishing casts —
the daily cap was already 20/20 spent when the session started.

Next: **the matcher tier's fixed 0.9 weight was the biggest thing wrong in the
stack, it is now a posterior — and dropping the tier entirely still scores
better than mixing it.**

## What works
- **§2 per-class `shrinkageK` — GATE PASS, shipped `{1: 0.1, 2: 8}`.** The two
  step classes want OPPOSITE smoothing; the single shared value was optimal for
  neither. `RingModelOptions.shrinkageKByClass` + `shrinkageFor()`; omitting it
  is byte-for-byte the old behaviour. Gated on a FIXED pair at five corpus
  prefixes it was not chosen on: paired ΔlogLoss −0.063 / −0.047 / −0.054 /
  −0.047 / −0.047 at 55 / 66 / 73 / 80 / 88 casts, CI excluding zero at every
  size, top-1 never worse. `scripts/fishingRingCV.ts perClassShrinkageSweep`.
- **§3 matcher posterior mixture — GATE PASS, shipped live and as the replay
  default.** `src/strategy/fishing/matcherPosterior.ts`. Paired on 88 clean
  traces: ΔlogLoss **−0.632 [−0.760, −0.504]** vs the shipped fixed weight,
  caught 19/88 → 26/88. Prior is the LOADED library's own support rate (8/88,
  Laplace → 0.100).
- **§4 `nextPosition` override FLOORED at 0.99/0.01 and still armed.** Caps a
  wrong override near 9 nats instead of 20.7; costs 0.01 nats when right.
  Shadow dual-logging widened from "the matcher overrode the ring" to
  "anything overrode the ring", so the first armed batch gets a paired
  before/after on the SAME turns.
- **§5 dungeon dry-run, zero energy.** Auth, state read, `--juiced` index
  refusal, and the energy preflight all verified live. Preflight ROM-bank
  branch forced read-only: 37 ROMs, 27 collectable, 2480 claimable, correct
  deficit arithmetic, correct fail-closed halt. Nothing claimed or started.
- **`ringPredictionReport.ts` new section "the RING MODEL on every turn"** —
  override/matcher rows re-enter the ring comparator via their SHADOW row
  instead of being silently dropped by a `tier` filter.
- Suite **786/786** (was 750), `tsc --noEmit` clean, `git diff --check` clean,
  all at the final commit. No test writes to a real data path (verified: every
  file in `data/` predates the session).

## What's broken
1. **The posterior mixture is measurably WORSE than dropping the matcher tier
   entirely** — +0.030 nats [+0.015, +0.044], CI excludes zero. Shipped anyway
   because it beats what was there by −0.632, but this refutes the brief's
   claim that a mixture "cannot lose to either arm". See QUESTIONS.md §19.
2. **`data/mined-patterns.json` is STALE.** Live loads 2 patterns explaining
   8/88 casts; re-mining at 88 promotes 4 (adds `bounce(2,0)`, `bounce(-2,0)`)
   explaining 11/88. NOT regenerated — it changes live matcher behaviour.
   QUESTIONS.md §20.
3. **Tier enumeration and the first in-run decision point are STILL
   unexercised** and cannot be reached by any dry run — both need an active
   run, which needs the 60-energy juiced entry. Session 52's first run is
   their first live exercise. Eight sessions of drift stands.
4. **k=2's shrinkage value is not identified by the data.** Its argmin wanders
   across corpus sizes (16, 16, 512, 512, 128); only the DIRECTION (much higher
   than k=1) is stable. Expect the shipped 8 to move.

## Corrections to SPEC.md
- **The brief's per-cast-reversal rejection is REFUTED and the conclusion
  flips.** Brief: 15 casts, 32/69 = 46.4%, dispersion **0.80** ("no
  heterogeneity"), 0 casts never reverse. Measured at 88 clean casts: **24
  casts, 43/124 = 34.7%, dispersion 1.452** (χ²=33.39, df=23, **p=0.0746**),
  **3 casts never reverse**. Status is OPEN-but-not-significant, not rejected.
  `scripts/reversalDispersion.ts` committed so it is re-runnable.
- **The brief's "shipped `shrinkageK = 1`" is wrong** — it confused
  `DEFAULT_RING_MODEL_OPTIONS.shrinkageK` (=3, the ring model) with
  `DEFAULT_SHRINKAGE_K` (=1, `contextualFallback.ts`, a different knob on a
  different model). Every number in the brief's §2 table is against the wrong
  baseline, including its claimed 0.34-nat gain (measured: 0.047 pooled).
- **The brief's "k=2 top-1 rises to 42.9% at K=16" is refuted**: top-1 is 34.0%
  at every K ≤ 8 and FALLS to 31.3% at 16. k=2's conditional buys top-1 and
  costs calibration — right about the mode, overconfident in the tail.
- **The k=2 reversal rate has drifted down**: FACT 2 recorded 41.7% (35/84) at
  66 casts; the comparable figure is now 34.7% (43/124).
- **`serverErrorDetail` dropped `TokenExpiredError`'s `.body`** — every auth
  failure logged this repo's own summary and nothing the server said. Found by
  the §5 dry-run with a corrupted JWT; real 401 body is `{"error":
  "Unauthorized"}`. Fixed; `tests/api/errors.test.ts` now pins every
  body-carrying class so a fifth instance of this shape fails the suite.
- **`liveRun.ts --dry-run` SKIPPED the energy preflight entirely** — the one
  step §5 most wanted vouched for was the one step the dry run stepped over.
  `ensureEnergyFor` gains `{ readOnly }`.
- **The matcher tier was never an "override"** as the brief called it — it was
  a fixed 0.9 mixture. The defect was a constant standing in for a belief, not
  a missing floor.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged — no dungeon play, ninth session running).

## Dead ends
- **Do not take the bare log-loss argmin on a smoothing sweep.** k=2's logLoss
  is FLAT from K=64 to K=∞ (spread 0.002 at n=150) and K=∞ IS the "tier off"
  arm — the argmin picks noise on a plateau and ships "drop the tier" labelled
  "smooth more". `{1: 0.1, 2: 16}` scores better ΔlogLoss and loses top-1 at
  the two largest corpus sizes; rejected.
- **Do not build a per-cast reversal parameter yet** — but cite p=0.075 at
  n=24, NOT the brief's "no heterogeneity", which does not replicate.
- Standing, unchanged: do not rebuild the expected-coverage focus objective
  (50); do not tune focus spend quantity again (48, 49, 50); replay for
  DIFFERENCES never absolutes (48).

## Metrics
- **Replay, 88 clean traces, matcher LOO, paired per turn, cluster bootstrap
  over casts:**
  | arm | ΔlogLoss vs shipped fixed 0.9 | caught/88 | per-turn hit |
  |---|---|---|---|
  | fixed 0.9 (before) | — | 19 | 144/321 = 44.9% |
  | posterior (SHIPPED) | −0.632 [−0.760, −0.504] | 26 | 141/296 = 47.6% |
  | matcher OFF | −0.667 [−0.808, −0.527] | 25 | 147/301 = 48.8% |
  | posterior − OFF | **+0.030 [+0.015, +0.044]** | +2/−1 | — |
- **Matcher weight, instrumented:** fixed arm gave 0.900 to all 134
  matcher-active turns across **88/88 casts**; the posterior's median is
  **0.135**, 70.5% of active turns below 0.15, and only **4/88** casts ever
  exceed 0.5.
- **Per-class shrinkage, LOO on 88 casts / 300 scored transitions (150 each):**
  k=1 K=0.1 → 1.040 vs shared 1.072; k=2 K=8 → 1.649 vs shared 1.718.
  Per-class shrinkage is behaviourally INERT on the replay (+0/−0 casts,
  +1/−1 turns) — a calibration fix, not a catch-rate one.
- **Live this session: 0 fishing casts, 0 dungeon runs, 0 energy spent.**
  Fishing cap was already 20/20 for 2026-08-19 when the session began.
- Corpus unchanged: 89 traces, 88 clean, 392 play turns, 13 catches.
- Suite 750 → **786** (+6 stepClass, +10 matcherPosterior, +4 replay,
  +5 floored override, +7 §5 error/SIGINT, +4 dispersion).

## Open questions for Claude
1. **QUESTIONS.md §19 — drop the matcher tier, or keep the mixture?** Keeping
   it costs 0.030 nats and buys the 4/88 casts the posterior identifies. The
   replay cannot see one thing that matters: session 50 measured that with the
   matcher OFF the replayed policy stops spending focus (0.71 vs live 1.80), so
   the tier is entangled with SPENDING, not only prediction. One live batch
   reading `matcherWeight` on the log rows settles it — the instrumentation
   shipped, it needs a batch not a decision.
2. **QUESTIONS.md §20 — re-mine `data/mined-patterns.json` first?** A re-mine
   doubles the library (2→4 patterns, 8→11 supporting casts) and raises the
   prior 0.100 → ~0.144 on its own. Asking "is the matcher worth keeping" of
   the stale library may be asking about the wrong tier.
3. **Three consecutive sessions have now had a brief's checkable corpus claim
   turn out wrong** (06/07, 50, 51 — and 51 had three separate ones: the
   shipped shrinkage value, the k=2 top-1 direction, and the dispersion
   ratio). Is there anything worth changing about how briefs assert corpus
   facts, given the author has no fixture access?
4. **The dispersion result is p=0.075 at n=24 k=2 casts.** How many more casts
   before the per-cast reversal question is worth re-asking, and is
   `reversalDispersion.ts`'s scored set (both hops 2-steps, ≥2 pairs per cast)
   the right one?
5. **Session 52 is dungeon-live and the path has nine sessions of drift.** The
   dry-run cleared everything reachable without spending; tier enumeration and
   the first in-run decision remain unexercised by construction.

## Files changed
```
 22 files changed, 1659 insertions(+), 38 deletions(-)

     scripts/fishingRingCV.ts                 | 233  (§2 per-class sweep + gate)
     src/strategy/fishing/matcherPosterior.ts | 161  (§3, new)
     scripts/reversalDispersion.ts            | 160  (§6, new)
     scripts/liveFishing.ts                   | 150  (§3 mixture, §4 floor)
     SPEC-fishing.md                          | 112  (§9: three new sections)
     tests/fishing/matcherPosterior.test.ts   | 110
     src/sim/fishing/offPolicyReplay.ts       | 103  (§3 arms, ringModelOptions)
     tests/fishing/stepClass.test.ts          |  90
     src/strategy/fishing/stepClass.ts        |  85  (§2 shrinkageKByClass)
     src/sim/fishing/patternMining.ts         |  59  (support counts for the prior)
     tests/fishing/reversalDispersion.test.ts |  60
     tests/api/errors.test.ts                 |  58  (new — the fn had none)
     scripts/ringPredictionReport.ts          |  54  (§4 ring-on-every-turn)
     QUESTIONS.md                             |  50  (§19, §20)
     tests/liveFishing.test.ts                |  48  (§4 floored override)
     tests/orchestrator/shutdown.test.ts      |  46  (§5 real SIGINT wiring)
     tests/fishing/offPolicyReplay.test.ts    |  44
     src/orchestrator/energyPreflight.ts      |  33  (§5 readOnly)
     src/api/errors.ts                        |  22  (§5 TokenExpiredError body)
     scripts/liveRun.ts                       |  15  (§5 preflight on dry-run)
```
