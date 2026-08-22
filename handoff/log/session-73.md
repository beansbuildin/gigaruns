# STATE — session 73 — 2026-08-21 (PT) — code at commit c8f007f

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1391/1391** (1375 → 1391, +16),
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean across the
whole session diff, `discoveredShipsClean` 8/8. **0 fishing casts, 0 dungeon
runs — and that was forced, not chosen.**

- **The session ran at 18:31 PT with fishing already at 20/20.** Both ledgers
  read first: game `dayDocs[2]` 20/20 and repo 20 casts AGREE; dungeon
  `dayProgressEntities` null / 0 of 12. Rollover 11:00 PT, 16.47h out. So the
  brief's §2 (forced Relaxing consume) and §3 (cast batches) had **no casts to
  spend** and were not attempted. The brief anticipated exactly this.
- **Gate 1 PASS. `pConnect`'s optimism is the RING TIER'S CORPUS SHARPENING**,
  and specifically the **prev-delta conditional**. The matcher is not the cause
  and is in fact the *under*-confident tier.
- **Gate 2 PASS.** Every connect-probability consumer classified, ratcheted, and
  both failure modes demonstrated then restored.

**NOTHING IS SHIPPED TO THE LIVE LOOP.** No default is touched, no threshold
moved, no strategy behaviour changed. `offPolicyReplay.ts` gains only an opt-in
`onTurn` diagnostic tap guarded by `if (opts.onTurn)`.

## What works
- **§1b GATE 1 — `scripts/pConnectBiasDecomposition.ts`.** Era-matched replay,
  39 casts / 134 turns, **placement HELD FROZEN** — same chosen cells, same
  actual cell, so `hit` cannot move and observed is pinned while only predicted
  mass varies. That is the only clean single toggle this corpus admits.

  | rung | predicted | step | gap vs observed |
  |---|---|---|---|
  | nothing at all (uniform grid) | 22.6% | — | −17.72pp |
  | + ring geometry (uniform on ring) | 33.4% | +10.85pp | −6.88pp |
  | + the corpus delta table (ring tier) | 49.1% | **+15.69pp** | +8.81pp |
  | + the matcher tier (SHIPPED) | 49.7% | +0.57pp | **+9.38pp** |

  Ring geometry alone is **PESSIMISTIC by −6.88pp** — the policy's placements
  genuinely beat their share of the legal ring. The corpus delta table then
  **claims +15.69pp and delivers +6.88pp: a 43.8% delivery ratio**, which is
  **93.9% of the whole gap.** The matcher adds +0.57pp.
- **§1b the residual is stated and deliberately not attributed.** Switching the
  prev-delta conditional off removes **+4.79pp** of the ring tier's +8.81pp.
  What remains is **+4.02pp = 0.95 SE at n=134** — no longer distinguishable
  from zero. Naming a second cause under 1 SE would be fitting noise.
- **§1b two named structural candidates measured at EXACTLY ZERO.** No-move
  turns **0/134**; off-both-rings class switches **0/134**. `ringCells` is
  Manhattan distance exactly k, so either would spend a whole turn's `pConnect`
  on an outcome the model calls impossible. Neither happens.
- **§1b the two perfect sums are labelled as arithmetic, not evidence.** The
  channel split closes to 1.1e-16 because `pConnect` is a linear functional of a
  linear mixture; the ladder telescopes. Both say so in the output, up front.
- **§1a GATE 2 — `tests/fishing/pConnectConsumers.test.ts`, 16 tests.** Six
  files allowlisted with a per-file site ratchet (cardChoice 18, oilShadow 10,
  liveFishing 10, oilTiming 8, offPolicyReplay 5, oilBatch 1), plus the
  level-based expressions named individually and asserted by their own text.
- **§1a the four LIVE level-based gates**, which is the gate's real deliverable:
  `isLethal`'s `pAnyHit < 0.999999`; the **Focus** oil necessity gate; the
  **Relaxing** oil necessity gate; the shadow's two `>= 1` certainty checks.
  Everything else is RANK (argmax over cards/placements — uniform optimism
  cancels) or pure reporting, **including the whole of `scripts/liveFishing.ts`**.
- **§1a both ratchet failure modes demonstrated, then restored.** A read added
  to an unclassified file (`coverageFocus.ts`) fails test 1; a read added inside
  an already-classified file fails its count (19 vs 18). Restored, 16/16.
- **§4 the `schedule` deferral recorded in `DECISIONS.md` with its reasoning**,
  as a dependency (estimator → EV → placement → schedule) rather than a
  priority call.

## What's broken
- **`isLethal` is the most consequential live level consumer and nobody had
  listed it.** A `lethal` placement is exempt from the focus spend constraint
  (`bestFocusForCard`: "A LETHAL placement is never blocked") and short-circuits
  the oil gates, so an optimistic p=1 claim buys an override — and it sits at
  the top of the range, where reliability is worst: the [0.50, 1.01) bucket
  predicts **72.2%** and observes **60.3%**.
- **The prev-delta conditional may be actively MISDIRECTING the aim, not merely
  over-claiming.** Re-planned with it off (§6), the policy's observed hit rate
  goes **40.3% → 51.2%** and the gap flips to −2.51pp. **This is NOT a clean
  result**: the re-planned arm runs 125 turns against 134, so the observed
  columns are unpaired and contaminated by which turns exist at all. It is a
  hypothesis with a large effect size, not a finding.
- **`pConnect` is still optimistic and nothing was fixed.** Diagnosis only, per
  brief §1c. Every live level-based gate still reads the biased quantity.
- **A self-inflicted near-miss, recorded because it nearly became a finding.**
  The first draft scaled `shrinkageK` and reported the conditional tier at
  **+0.00pp**. `shrinkageFor` resolves `shrinkageKByClass[k] ?? shrinkageK` and
  the shipped default sets BOTH classes, so that was an **unread knob wearing a
  measured zero's clothes**. `scaleShrinkage` now scales the field that is read.
- Carried: the `nextPosition` tripwire has still never met a real miss;
  distribution steps 3/4/6 remain the user's; the oil row of session 72's gate 1
  still fails (50.1% sim vs 78.6% live, n=14) and no oil payload was measured
  this session because no cast existed to measure it on.

## Corrections to SPEC.md
- **The session-73 brief's `pConnect` figures were STALE BY SESSION 72'S OWN
  BATCH.** It quotes 118 turns at 50.0% vs 39.8%; those predate the four casts
  session 72 then played and appended. `redrawTriggerCalibration.ts`,
  **unmodified**, now prints 39 casts / 134 turns / **49.7% vs 40.3%** — exactly
  what the new script prints. The finding is unchanged (optimistic, monotone,
  every bucket); the size moved **10.2pp → 9.38pp, 2.2 SE**.
- **STATE's "hardcoded-path ratchet is 26" is a doc drift.**
  `tests/noHardcodedPaths.test.ts` asserts **25** and passes. The number was
  carried wrong; the test is the authority.
- No SPEC section was contradicted this session — no live call was made.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.
- Corpus unchanged at 128 casts / 537 `playTurns` — no casts played.

## Dead ends
- **Blaming the matcher for `pConnect`'s optimism.** On its own 62 turns it
  predicts 51.9% and observes 48.4% (+3.51pp) against the ring channel's
  +8.81pp, and carries **5.1%** of the total at mean `w = 0.1013`. Session 51's
  posterior weighting is already suppressing the old fixed-0.9 arm, which
  measures at **+19.13pp**. Do not reopen this as the cause.
- **The 0.05 switch probability as a correction.** §4 measured zero class
  switches on this era, so `switch 0.50`'s apparent −9.73pp is information
  destruction, not a fix.
- **Toggling `shrinkageK`.** Inert — `shrinkageKByClass` overrides it for both
  classes. Scale the per-class overrides or measure nothing.
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; redraw is CLOSED; +19.40pp stays SUSPENDED; do
  not loosen the `fakeDoc` observability guard; `boonCapture` settled OFF; do not
  fold stock into the oil threshold.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.

## Metrics
- **Live: 0 fishing casts, 0 dungeon runs.** Fishing **20/20** at session start
  (game and repo agree), dungeon **0/12**. Rollover 11:00 PT.
- Replay, today's era: **39 casts, 134 turns**; predicted 49.7%, observed 40.3%,
  gap **+9.38pp at 2.2 SE**, observed 95% Wilson [32.4%, 48.8%].
- Reliability by bucket (turns / predicted / observed): 13 / 2.2% / 0.0% ·
  3 / 16.4% / 0.0% · 11 / 25.6% / 18.2% · 44 / 39.7% / 31.8% ·
  63 / 72.2% / 60.3%. **Monotone; optimistic in every bucket.**
- Ring-knob sweep, frozen placement, gap vs shipped +8.81pp: ringFloor 0.2
  −0.75pp · 0.3 −1.50pp · 0.5 −2.99pp · shrinkage ×4 −0.83pp · ×16 −1.50pp ·
  **conditional OFF −4.79pp** · switch 0.20 −3.24pp · switch 0.50 −9.73pp.
- **Suite 1375 → 1391.** New: `pConnectConsumers` 16.

## Open questions for Claude
1. **The §6 result is the loudest thing here and it is not clean.** Re-planned
   with the prev-delta conditional off, observed hit goes **40.3% → 51.2%** and
   the gap flips negative — but on 125 turns against 134, unpaired. Is the next
   session's job to make that comparison PAIRED (same turn set, or a cast-level
   bootstrap), and what gate would be set on it that the agent controls?
2. **Does the level-based correction belong at `isLethal` first?** It is the one
   live gate that grants an override rather than declining an action, and it
   reads the worst-calibrated end of the range. A correction there is far
   narrower than one at `evaluateCardAtFocus`.
3. **The conditional's 43.8% delivery ratio may be a SHRINKAGE problem rather
   than a conditional-tier problem.** `shrinkageKByClass` is `{1: 0.1, 2: 8}`,
   swept on log loss at 88 casts; the corpus is now 128. Is re-running
   `fishingRingCV.ts` at the current size the cheaper first move?
4. **Carried and unanswered because no cast existed:** the oil row of session
   72's gate 1 (50.1% sim vs 78.6% live, n=14) and the forced Relaxing consume
   that would inform it. §2 and §3 of the session-73 brief are untouched and
   still valid — 20 casts become available at 11:00 PT.
5. Carried: separate the crit source with one-lure-only casts? Should
   `preflight.ts` run in CI (open since session 68)? What re-derives +19.40pp
   (still SUSPENDED, do not quote)?

## Files changed
```
 1 commit (c8f007f). 4 files, +786 -0.

  NEW  scripts/pConnectBiasDecomposition.ts    377  GATE 1
  NEW  tests/fishing/pConnectConsumers.test.ts 290  GATE 2, both modes demoed
       src/sim/fishing/offPolicyReplay.ts     +107  opt-in `onTurn` diagnostic tap
       handoff/DECISIONS.md                    +12  the schedule deferral + 8 settlements
```

---

## Appendix A — how the session actually went

Wall clock at start: **18:31 PT, 2026-08-21**. The brief was written at 18:20
PT the same evening. `doctor.ts` first, then both ledgers, before any code.

```
▸ doctor — profile "default"
  ✓ Node 24.13.1
  ✓ token present and valid for another 160.4h
  ✓ config valid — dungeon 5, 20 energy/run, budget 240/day, 12 runs
  ✓ fishing configured — node 5, 20 casts/session
  ✓ authenticated as <USER> — <ADDR>
  today's local ledgers (roll over at 11:00 Pacific, 16.5h from now):
    dungeon: 0 runs / 0 energy recorded
    fishing: 20 casts / 228 energy recorded
```

```
GAME ledger  (dayDocs pond 2):  20 / 20
REPO ledger  (data/guard-budget-fishing.json): 20 casts, 228 energy
  dayDocs[pondId 1] = 0
  dayDocs[pondId 2] = 20
ledgers agree at 20 cast(s) spent today.
VERDICT: BLOCKED — cap spent. Next window opens at 11:00 PT (16.47h).

dungeonId 5 dayProgressEntities (real runs today): null
[]
```

No live command was issued after this point, so **rule 13 has nothing to
reconcile** — there was no denial, no interruption, and no spend.

## Appendix B — the full gate-1 output

```

▸ pConnectBiasDecomposition.ts — SESSION 73 GATE 1
  Era-matched replay, TODAY'S POLICY ERA ONLY: 39 casts, 134 turns.
  An era is a BUNDLE, not a knob (session 71). Everything below is a claim
  about today's era and nothing else. DIAGNOSIS ONLY — no correction ships.

── §1  THE GAP, RE-MEASURED, AND WHAT IT CAN AND CANNOT BE ──
  predicted 49.7%   observed 40.3%   GAP +9.38pp   (2.2 SE, n=134 turns)
  observed 95% Wilson [32.4%, 48.8%]

  THE BRIEF'S NUMBERS ARE STALE BY SESSION 72'S OWN BATCH. It quotes 118 turns
  at 50.0% vs 39.8%; those were computed BEFORE the four casts session 72 then
  played were appended to the corpus. `redrawTriggerCalibration.ts`, unmodified,
  now prints the same 134 turns and the same 49.7% / 40.3% as this file. The
  FINDING is unchanged — still optimistic, still every bucket — the SIZE moved.

  `hit` is DETERMINISTIC here — the card's zones over the chosen focus either
  contain the fish's recorded cell or do not. No server roll enters, so the gap
  is exactly one statement: the distribution puts too much mass on the cells the
  policy aims at. And it cannot be "global overconfidence" — the model's error
  field sums to zero over the grid by construction. Only the AIMED-AT SUBSET can
  be wrong, which means any fix moves mass between cells and never scales it.

  reliability, the session-72 table reproduced as the precondition:
  pConnect bucket    turns   predicted   observed hit   95% Wilson
  [0.00, 0.10)        13        2.2%           0.0%   [0.0%, 22.8%]
  [0.10, 0.20)         3       16.4%           0.0%   [0.0%, 56.2%]
  [0.20, 0.30)        11       25.6%          18.2%   [5.1%, 47.7%]
  [0.30, 0.50)        44       39.7%          31.8%   [20.0%, 46.6%]
  [0.50, 1.01)        63       72.2%          60.3%   [48.0%, 71.5%]

── §2  THE LADDER — WHERE THE PREDICTED MASS IS ADDED, AND WHAT IT BUYS ──
  Placement HELD FIXED throughout: same chosen cells, same actual cell, so `hit`
  cannot move and observed is PINNED at 40.3% in every row. Only the predicted
  column varies, which isolates the estimator from the policy's choices.

  rung                                   predicted   step      gap vs observed
  nothing at all (uniform grid)            22.6%          —    -17.72pp   the aimed cells' share of the board
  + ring geometry (uniform on ring)        33.4%   +10.85pp     -6.88pp   the fish must be at distance 1 or 2
  + the corpus delta table (ring tier)     49.1%   +15.69pp     +8.81pp   conditional/marginal displacements
  + the matcher tier (SHIPPED)             49.7%    +0.57pp     +9.38pp   what live consults

  The steps sum to the gap by telescoping — that part is arithmetic. THE FINDING
  IS WHICH STEP IS BIG:

    ring geometry alone is PESSIMISTIC by -6.88pp — the policy's placements
      connect that much MORE than their share of the legal ring. Real skill, and
      the corpus is what supplies it.
    the corpus delta table then CLAIMS a further +15.69pp of connect mass.
    it DELIVERS +6.88pp — the whole excess of the aimed cells over ring-uniform.

    DELIVERY RATIO 43.8% — the ring model's corpus sharpening is worth
    about 0.44x what it says it is. That single step is 93.9% of the whole gap.

    the matcher tier adds +0.57pp on top. It is NOT the cause.

── §3  THE CHANNEL SPLIT — EXACT BY ARITHMETIC, SO IT IS NOT EVIDENCE ──
  `dist = w * matcherOnRing + (1-w) * ring` and `pConnect` is a SUM of mass over a
  fixed cell set — a linear functional — so this closes to machine epsilon no
  matter what the tiers do. Session 71's lesson says distrust a decomposition
  that sums perfectly; stated up front, here is WHY this one does. Accounting
  identity, not a finding.

  turns with a live matcher tier   62 / 134   mean w over ALL turns = 0.1013
  ON ITS OWN TURNS the matcher predicts 51.9% and observes 48.4% — gap +3.51pp.
  It is the UNDER-confident tier. The optimism is not coming from here.

  contribution to the +9.38pp gap:
    matcher channel   w * (matcher - hit)        +0.48pp     5.1% of it
    ring channel      (1-w) * (ring - hit)       +8.91pp    94.9% of it
    SUM                                          +9.38pp   identity residual 1.1e-16

── §4  TWO NAMED CANDIDATES, MEASURED AT EXACTLY ZERO ──
  `ringCells` is Manhattan distance EXACTLY k, so two whole outcome classes carry
  probability ZERO under every arm above — including the two uninformed ones. If
  either happened, its entire `pConnect` would be spent on an impossibility.

    fish did not move (actual == current)         0 / 134 turns
    actual off BOTH rings (class switch)          0 / 134 turns

  Both are zero on this era. A structural zero-probability event is NOT what is
  wrong with `pConnect`, and the 0.05 switch probability is not being spent on
  anything here. Two candidates eliminated by measurement rather than argument.

── §5  INSIDE THE RING TIER — WHICH KNOB OVER-CLAIMS ──
  §2 puts the whole gap in one step: the corpus delta table's sharpening. That
  step has three knobs. Each row below changes ONE of them against the identical
  leave-one-out table, placement still frozen.

  ring knob            predicted        gap   vs shipped   note
  SHIPPED                49.1%     +8.81pp            —   the ring tier as it runs
  ringFloor 0.2          48.4%     +8.06pp      -0.75pp   flatten toward ring-uniform
  ringFloor 0.3          47.6%     +7.31pp      -1.50pp
  ringFloor 0.5          46.1%     +5.82pp      -2.99pp
  shrinkage x4           48.3%     +7.98pp      -0.83pp   trust the conditional less
  shrinkage x16          47.6%     +7.31pp      -1.50pp
  conditional OFF        44.3%     +4.02pp      -4.79pp   class marginal only
  switch 0.20            45.9%     +5.57pp      -3.24pp   mix in the other ring harder
  switch 0.50            39.4%     -0.92pp      -9.73pp

  THE RESIDUAL, STATED. The prev-delta CONDITIONAL is the single largest cause
  identified anywhere in this file: switching it off removes +4.79pp of the ring
  tier's +8.81pp, i.e. 51.0% of the whole +9.38pp gap.
  What is LEFT is +4.02pp, which at n=134 is 0.95 SE and no longer
  distinguishable from zero. That residual is REPORTED, NOT EXPLAINED — and it is
  deliberately not attributed further, because naming a second cause under 1 SE
  would be fitting noise and calling it a decomposition.

  `switch 0.50` is listed for the axis, not as a candidate: §4 measured ZERO class
  switches on this era, so that knob is not correcting a real event — it is simply
  dumping half the mass onto a ring the fish never used. It flattens the number
  by destroying information, which is exactly the failure mode §6 tests for.

  THIS IS A DIAGNOSIS, NOT A TUNING. Brief §1c: a calibration fitted on 134 turns
  of ONE era is a claim about that era, and five buckets on 134 turns is enough to
  SEE a bias and not enough to fit a curve. No default here is touched. What the
  rows establish is WHICH knob the level error lives behind, not what to set it to.

── §6  POLICY-FOLLOWING ARMS, AND THE RESIDUAL THAT IS NOT ARITHMETIC ──
  Everything above froze the placement. Here the replay RE-PLANS under each
  toggle, so the distribution AND the chosen cells move, and `hit` moves with
  them. For each component:
      d_score  = gap(shipped) - gap(toggle, placement frozen)
      d_total  = gap(shipped) - gap(toggle, policy re-planned)
      RESIDUAL = d_total - d_score   <- the policy aiming somewhere else

  toggle                        turns   predicted   observed        gap    d_score    d_total   RESIDUAL
  matcher tier off              128       50.5%      47.7%     +2.83pp    +0.57pp    +6.55pp    +5.98pp
  matcher weight fixed at 0.9   128       59.0%      39.8%    +19.13pp    +0.98pp    -9.75pp   -10.72pp
  prev-delta conditional off    125       48.7%      51.2%     -2.51pp    +5.36pp   +11.89pp    +6.53pp

  CAVEAT, and it is not small: the re-planned arms run a DIFFERENT NUMBER OF
  TURNS (a policy that aims elsewhere catches and escapes on different turns), so
  their observed column is not paired with the frozen arms' 40.3%. The residual is
  therefore an upper bound on the policy-choice effect, contaminated by which
  turns exist at all. It is reported because it is large enough to matter and
  because pretending the toggles decompose cleanly is the failure the brief names.
```

## Appendix C — the gate-2 demonstrations, in full

Both were run against the real test, then reverted; `git diff --stat`
afterwards showed only the intended `offPolicyReplay.ts` change.

**(1) a new consumer in an UNCLASSIFIED file** — appended to
`src/strategy/fishing/coverageFocus.ts`:

```ts
export function demoUnclassified(pHit: number, pCrit: number): boolean {
  return pHit + pCrit > 0.5;
}
```

```
× every file reading a connect probability is a classified one
  Tests  1 failed | 15 passed (16)
```

**(2) a new consumer inside an ALREADY-CLASSIFIED file** — appended to
`src/strategy/fishing/cardChoice.ts`:

```ts
export function demoLevelSite(c: CardFocusChoice): boolean {
  return c.pHit + c.pCrit > 0.42;
}
```

```
× src/strategy/fishing/cardChoice.ts has exactly its recorded number of sites
AssertionError: ... the connect-probability read count moved. A new read is a
new consumer and needs a class. ... expected 19 to be 18
  Tests  1 failed | 15 passed (16)
```

Restored: **16/16 passed.** The second mode matters more than the first — a
new consumer is far likelier to land inside `cardChoice.ts`, which already
holds 18 of the 52 sites, than in a file that reads none today.

## Appendix D — surprises, logged as they happened

1. **The brief's headline number was stale, and the instrument that produced
   it says so itself.** Not a disagreement between tools: `redrawTriggerCalibration.ts`
   is unmodified and now prints 134 turns where session 72's recap recorded 118.
   The cause is session 72's OWN four-cast batch landing in the corpus after the
   figure was computed. This is a variant of the repo's recurring trap — a number
   quoted forward from a recap that the corpus has since moved underneath.
2. **The decomposition's two exact sums are exact for structural reasons, and
   saying why was more valuable than the numbers.** `pConnect` is a *linear
   functional* (a sum of mass over a fixed cell set) of a *linear mixture*, so the
   matcher/ring channel split cannot fail to close. The brief said distrust a
   perfect sum; the honest response was not to manufacture a residual but to name
   the arithmetic that forces it, and then to go find a residual somewhere it
   could genuinely be nonzero (§5's knob sweep, §6's re-planned arms).
3. **The candidate list held loosely paid off in the negative direction.** I
   went in expecting one of two crisp structural causes — the fish standing still
   (probability zero under every ring, since `ringCells` is distance *exactly* k)
   or a step-class switch landing off the intersected ring. Both measured
   **0/134**. That is worth as much as a positive: it retires the 0.05 switch
   probability as a lever on this era and explains why `switch 0.50` "helps" (it
   dumps mass on a ring the fish never used).
4. **I nearly published an unread knob as a measured zero.** The first draft's
   `shrinkage x4` and `x16` rows both read `+0.00pp`, which I took at face value
   for one beat before it looked too clean. `shrinkageFor` resolves
   `shrinkageKByClass[k] ?? shrinkageK`, and `DEFAULT_RING_MODEL_OPTIONS` sets
   both classes — so scaling the shared field is a no-op. Had it shipped, the
   session's conclusion would have been "the conditional tier contributes
   nothing", which is the exact opposite of what it does contribute (+4.79pp, the
   largest single identified cause). **The tell was an exact zero on a knob that
   ought to do something.** `scaleShrinkage` now carries that story in its doc
   comment so the trap is not re-set.
5. **The matcher turned out to be the under-confident tier**, which inverts the
   intuition the brief's §1 opens with. It predicts 51.9% and observes 48.4% on
   its own turns; the posterior weighting holds mean `w` at 0.1013, so it reaches
   only 5.1% of the total gap. The old fixed-0.9 weighting measures at +19.13pp —
   session 51's change was already doing most of the mitigation nobody had
   credited it with.
6. **§6's conditional-off arm is the loudest result and the least trustworthy.**
   Observed hit 40.3% → 51.2% when the policy re-plans without the prev-delta
   conditional. If that survives a paired comparison it is not a calibration
   story at all — it is the conditional aiming the focus at the wrong cells. But
   125 turns against 134 is not a paired comparison, and the whole discipline of
   this file is that a frozen placement is what makes a toggle mean one thing.
   Recorded as a hypothesis with a big effect size, deliberately not as a finding.

## Appendix E — what the brief asked for that was not done, and why

- **§2, the single forced Relaxing consume: NOT ATTEMPTED.** Fishing was at
  20/20 when the session opened. There was no cast to carry the instrumentation.
  Nothing was substituted for it.
- **§3, the day's cast allowance: NOT ATTEMPTED**, same reason. The era catch
  rate is unchanged at 23/39 = 59.0%, and both oil arms' n are unchanged at
  no-oil 23 / oil 14. **Gate 1 of session 72 still rests on a 0.9pp margin** and
  nothing this session moved it either way.
- Both are still exactly as the brief specifies them and can be taken up
  unmodified after 11:00 PT.
