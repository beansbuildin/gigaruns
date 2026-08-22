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
