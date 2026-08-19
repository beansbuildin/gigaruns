# STATE — session 48 — 2026-08-19 — commit 5f698c5

## Status
Session-48 brief: **BATCH GATE FAILED — and correctly, on its own terms.**
One 5-cast batch ran. **Two independent §1c stop conditions fired**, so
batches 2 and 3 were NOT started and 15 of the day's 20 casts are unspent.
Everything offline (§2, §3, §5a, §5b, §5c) was delivered.

**The headline: FACT 1 is wrong, and the batch is what found it.** The very
first cast ran step class `k = 1,2,1,2,1,2`. `data.lastMovePath` — on the wire
since the first capture, never once read — shows the fish only ever walks UNIT
steps. What FACT 1 calls a "step class" is a **step COUNT**, and it is not
constant per cast.

Next per TASKS.md: **the focus budget** (§5c below). Do NOT run another batch
until the ring model's hard-zero constraint is dealt with.

## What works
- **The FACT 1 correction, scored three ways, zero exceptions.**
  `scripts/auditMovePaths.ts`: `len(lastMovePath) == manhattan(prev,pos)`
  **312/312**; `lastMovePath[last] == fishPosition` **312/312**; every hop a
  UNIT step **312/312**. Steps-per-turn is only ever 1 or 2. Constant per cast
  is **72/73**. `tests/fishing/movePath.test.ts` pins it — including a test
  that fails if someone re-asserts constancy.
- **§2 the `[CONFIRMED]` falsifiability audit** — `handoff/CONFIRMED-AUDIT.md`,
  one table, four columns, prioritised by `[n1]` / `[sym]`. Everything
  re-scorable was re-scored:
  - focus-meter spend rule (was n=1, distances 0,1,1 — degenerate): **308/308**,
    within-cast regeneration **0/308**.
  - `fishHp` arithmetic (was sign-agreement only): **308/308** on amounts.
    Scoring amounts found **4 crits** nothing had ever scored — and that is a
    second, INDEPENDENT confirmation of session 47's zone fix, on a different
    zone set (`critZones`) and a different observable (damage magnitude).
    It **discriminates**: corrected 308/308 with 4 crits, transposed 305/308
    with 1.
  - `enemyPathOptions[].lootTable` identical across tiers — the claim
    **CLAUDE.md §8** rests on, never quantified: **440/440**.
- **§5c the loss decomposition, and it is decisive** (`scripts/lossDecomposition.ts`).
- **§5b both reachable knobs are INERT** — null results, no defaults changed.
- **QUESTIONS.md §17 ANSWERED** — `nextMovePath` is a genuine multi-cell path.
- **§3** `zoneMapVersion` on ring-prediction rows; replay-gating rule in
  SPEC-fishing.md §9 **with the caveat this session's data forces**.
- Suite **697/697**, `tsc --noEmit` clean, `git diff --check` clean, all at the
  final commit. Verified no test mutates a real data path (checksums on
  `fish-patterns.jsonl` and `ringPrediction.jsonl` unchanged across the run).

## What's broken
- **The ring model treats step class as a HARD constraint — off-ring cells get
  probability exactly zero — and that is now known false.** Cast `12988700`
  locked `k=1` off its first move, then landed off that ring three times:
  logLoss **11.316** with 3 zero-probability events, against a corpus LOO of
  0.803 for k=1. Unguarded, not fixed. This is the thing to fix first.
- **The zone fix did NOT transfer to a live hit-rate improvement.** Per-turn
  hit **8/29 = 27.6%** [14.7%, 45.7%] — indistinguishable from the 27.5%
  historical baseline (z=+0.01, **p=0.99**) and the replay's 50.9% prior sits
  OUTSIDE the interval (z=−2.51, **p=0.012**). Excluding the alternating cast
  does not rescue it (30.4%, p=0.050).
- **The replay's absolute levels are not trustworthy.** Its 50.9% is
  numerically ~the mean `pHitPredicted` (0.515) the policy assigned to the same
  shots — the same movement model on both sides. Use it for DIFFERENCES.
- **The focus budget is the binding constraint and its knob does nothing.**
  80.8% of casts escape on meter-out at mean final `focusMeter` 0.25; **50.4%
  of ALL turns (192/381) are played at `focusMeter` 0**; 56/73 casts reach 0.
  And `focusReserveWeight` **w=0 performs identically to the shipped w=3**.
- `data/nextPositionValidation.jsonl` stands at 3 attempts / 3 hits / Wilson
  lower bound 0.438 — override correctly NOT ready (needs 10).

## Corrections to SPEC.md
- **SPEC-fishing.md §9 FACT 1 — the "`k` is constant per cast" half is FALSE.**
  Corrected: the fish always walks unit steps; `lastMovePath` is the path, one
  index per step; the count is 1 or 2 and is constant in 72/73 casts, not all.
- **SPEC-fishing.md §4 focus-meter and `fishHp` claims** upgraded from
  nominally to genuinely confirmed, with counts and `critEffects` added.
- **QUESTIONS.md §17 — `nextMovePath` is NOT a `nextPosition` duplicate.** The
  §17 reading was a **type confusion**: `nextMovePath [1,2]` is two row-major
  INDICES (→[1,1],[1,2]); `nextPosition [1,2]` is a coordinate. 6/6 decode to
  unit-step paths ending on `nextPosition`; 4/4 realized exactly, path included.
- **SPEC-fishing.md §9 FACT 3** re-derived under the corrected map. Its
  structure was never at risk — every set it names is transpose-symmetric.
  Two absolutes moved (k=1 at (0,0) 100.0%→99.4%; diagonal-2 (+2,−2) 0.0%→3.2%),
  both from cast `12988700` alone.
- **`scripts/ringPredictionReport.ts` took `argv[2]` as the log path
  unconditionally**, so the brief's own `--since=<t>` was swallowed as a
  filename and printed "nothing logged yet". Fixed. Same defect class as the
  dead `.message` guard: a silent empty result reading as a real answer.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged — no dungeon play, sixth session running).

## Dead ends
- **Do not re-sweep `focusReserveWeight`.** w=0..3 indistinguishable on 73 real
  trajectories; w≥4 monotonically worse. The term is inert. It is NOT the lever
  for the focus-budget problem even though it was built for it.
- **Do not re-sweep `missPenaltyMultiplier`.** Flat 0.5..5; only 0 is worse. 1 stands.
- **Do not quote a replay ABSOLUTE rate as a forecast.** Refuted live, p=0.012.
- **Do not conclude a mechanic from `data/fish-patterns.jsonl` alone.** It
  projects each turn to `from`/`to` and discards the path between them — the
  corpus view used to FIT the movement model could not represent what breaks it.
- `REDRAW_THRESHOLD` and the mined-matcher tier: not swept. Not on
  `ReplayOptions`; plumbing them is real surgery on `replayCast`, and it is
  low-value while the constraint sits elsewhere.

## Metrics
- **Live batch 1**: 5 casts, **1 caught** (cast 2, 4 turns). All-time
  **8/74 = 10.8%** (was 7/69 = 10.1%). Catch rate at n=5 is noise — do not
  read it as a verdict either way.
- **Per-turn hit 8/29 = 27.6%** [14.7%, 45.7%]. Mean predicted P(hit) on those
  same shots **0.515**.
- **Movement top-1 live 4/29 = 13.8%** against an offline LOO of **46.4%**.
- **Paired ΔLL (ring − baseline), n=29: −2.481 [−6.098, +1.136] — inconclusive**
  (negative favours ring in the tool's convention; note the brief's §1b(3) has
  this sign backwards). Split: k=2 −7.358 [−11.960, −2.756] ring better;
  k=1 +4.633 inconclusive; unknown-k +1.745 [0.249, 3.241] ring WORSE.
- **Terminal reasons, 73 clean casts**: escaped/meter-out 59 (80.8%), caught 8
  (11.0%), mana-out 5 (6.8%), truncated 1.
- **Focus by turn**: 3.00 1.38 0.72 0.36 0.14 0.04 0.00 0.00 0.00.
- **Replay sweeps** (73 traces, LOO, unpaired): `focusReserveWeight` w=0 catch
  30.1%/hit 50.8%, w=3 30.1%/51.1%, w=12 26.0%/41.8%. `missPenaltyMultiplier`
  m=0 26.0%/47.8%, m=1 30.1%/51.1%, m=3 31.5%/52.0%.
- Suite 697 (688 → 697: +5 movePath, +4 stateFields).
- Energy: preflight claimed one ROM (540) to cover a 13 deficit, pool 47→420.
  Re-probed ROM 6096 afterward: **168** banked (predicted 167; the 1 is accrual).

## Open questions for Claude
1. **The ring model's hard zero is the first thing to fix, and the fix is not
   obvious.** Options: (a) floor off-ring cells instead of zeroing them,
   (b) model the step count per TURN rather than per cast, (c) re-classify
   whenever an off-ring landing is observed. Only one cast in 73 alternates, so
   the corpus cannot choose between these — say which you want and why.
2. **The focus budget is session 49's §1, and `focusReserveWeight` is not the
   lever.** 50.4% of turns are played with a bobber that cannot move. The real
   question is whether the policy should be spending focus at all early, or
   banking it — n=1, but the only cast that caught anything is the only one
   that held a point in reserve all cast.
3. **Should the 4th `nextPosition` observation be backfilled?** Cast `12956718`
   t1 predicted `[2,4]`, realized `[2,4]`, and predates the validation ledger.
   Backfilling moves a live gate with data its author never sanctioned, so it
   was left alone. 4/4 would put the bound at 0.51 — still short of 10 attempts.
4. **The live/offline movement gap is unexplained**: top-1 13.8% live vs 46.4%
   leave-one-cast-out. FACT 1 explains part of one cast, not 29 turns.
5. 15 of today's 20 casts are unspent. The cap resets 11:00 Pacific.

## Files changed
```
 54 files changed, 18371 insertions(+), 24 deletions(-)
 (35 of those are the batch's new redacted cast fixtures)

     src/sim/fishing/movePathAudit.ts    | 218  (FACT 1's correction + §17)
     src/sim/fishing/stateFieldAudit.ts  | 134  (§2 re-scoring)
     SPEC-fishing.md                     | 245  (FACT 1, FACT 3, §5b, §5c, gating)
     scripts/lossDecomposition.ts        |  98  (§5c)
     tests/fishing/movePath.test.ts      |  83
     scripts/auditMovePaths.ts           |  76
     handoff/CONFIRMED-AUDIT.md          |  75  (§2's table)
     tests/fishing/stateFields.test.ts   |  57
     scripts/auditStateFields.ts         |  56
     QUESTIONS.md                        |  52  (§17 answered)
     scripts/ringPredictionReport.ts     |  36  (--since fix, zone-map split)
     scripts/liveFishing.ts              |  33  (zoneMapVersion)
     src/sim/fishing/castTrace.ts        |  26  (lastMovePath/nextMovePath/critEffects)
     ... + offPolicyReplay.ts 11, zoneTemplate.test.ts 15, fishingCorpus.test.ts 12
```
