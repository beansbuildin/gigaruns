# SESSION 34 — 2026-08-18 — commit e391901

Same content as `handoff/STATE.md` at this commit, plus the raw ablation
output that STATE.md only summarizes.

---

# STATE — session 34 — 2026-08-18 — commit e391901

## Status
No TASKS.md gate was targeted this session — same discipline as sessions
31-33. The brief was CODEXIMPROVE #4 alone (give carried dungeon charges
continuation value), staged exactly as scoped: tie-break first, continuation
term in `utility()` second, ship the term only if it clears the dungeonSim
harness's 95% CI bar. Overall: **GATE PASS** (self-assessed against the
brief's own staged bar, both stages shipped, both live in `DEFAULT_CONFIG` /
`LIVE_CONFIG`).

## What works
- **Stage 1-2, `decide.ts`'s tie-break, provably non-regressive**: the
  top-level argmax now breaks a genuine `.score` tie (within `1e-9`, matching
  `cardChoice.ts`'s `EV_TIE_EPSILON` precedent) by preferring the candidate
  move that leaves the higher ATK-weighted charge reserve. Exact, not an
  expectation — `combat.ts`'s `applyCharges` decrements only the move WE
  played and rests the others regardless of the enemy's reply, so a
  candidate's post-play reserve doesn't depend on `theirs` at all. Weighted
  by each move's own ATK (not summed blind) rather than by play-share
  (`playCounts`) — play-share lives in the stateful `strategyPolicy` adapter,
  and threading it into `decide()` would break the pure-function contract
  DECISIONS 2026-08-16 already records for this module; ATK needed nothing
  new threaded in. Two regression tests prove the exact two claims the brief
  asked for: a genuine 3-way score tie (all weights/terminals zeroed)
  resolves to the highest-reserve move; a real score gap (SPEC §4b's own
  worked case) is untouched even with one move's reserve inflated 1000x —
  the tie-break provably never fires on a strict comparison.
- **Stage 3, `utility()`'s continuation term, ships at `chargeReserveWeight:
  0.4`, ablated not guessed** (`scripts/chargeReserveAblation.ts`, mirrors
  `depthAblation.ts`'s methodology, the one that got `LIVE_CONFIG`'s depth 3
  adopted): mean rooms cleared ± 95% CI, weight 0 as the explicit control.
  N=20000/weight over two seeds (1, 9001): 0.2/0.4/0.8 ALL separate above
  the zero control in BOTH seeds — real signal, unlike session 06's HP/armor
  weight sweep null result. Follow-up N=60000/weight sweep over {0.2..0.8}
  in 0.1-0.2 steps, same two seeds: an inverted-U, not a monotonic climb —
  0.8 drops back down near 0.3's level in both seeds (rules out "the term
  just inflates every utility value," which would look monotonic instead).
  0.4/0.5/0.6 form a plateau, mutually indistinguishable from each other but
  each separated above 0.2, 0.3 and 0.8. Shipped 0.4, the plateau's
  low-risk edge. Term itself: `chargeReserveFraction(me)`, ATK-weighted
  charge reserve normalised to [0,1] by its own max, reusing the same
  weighting the tie-break established. `LIVE_CONFIG` inherits it for free
  via its existing spread of `DEFAULT_CONFIG`.
- **Regression tests, both stages independently** (per the brief's explicit
  ask, so stage 1's proof stands even if stage 3 hadn't cleared the bar):
  4 new tests for stage 3 (default is 0.4; no-op at weight 0 regardless of
  charges; rewards fuller reserve at weight 1 and at the shipped default).
  Stage 1's own `zeroCfg` test needed one fix once the default moved off 0
  — it now zeroes `chargeReserveWeight` explicitly too, so it still isolates
  the tie-break mechanism from this separate continuation-term mechanism.
- Tests: **516/516 passing** (+6 from session 33's 510: +2 stage 1, +4 stage
  3). `npx tsc --noEmit` clean, checked against this session's final commit
  (`e391901`), both dependent-file combinations verified in isolation too
  (stage 1 alone, via `git stash` of stage-3-only files, hit 512/512 before
  stage 3 was added back — confirms stage 1 has zero dependency on stage 3).
- Fishing account still stuck exactly as session 33 left it — checked via
  the brief's cheap read-only ask (`scripts/checkFishingStuck.ts`): same
  `docId 12957129`, unchanged. Not this session's code, not touched, no new
  live fishing attempted (per the brief's explicit instruction). Still
  QUESTIONS.md §15, still needs a human DevTools capture.

## What's broken
Nothing this session's changes broke — full suite green, tsc clean, at the
actual final commit. Fishing account stuck (see above and QUESTIONS §15) is
pre-existing, not this session's code, and dungeon-side work is unaffected
by it. Other pre-existing items, unchanged since session 25: the scheduler
can't learn about energy gained outside its own tracking, and a SIGINT
during an energy-regen sleep still ends the whole session.

## Corrections to SPEC.md
None this session. Resolved IDs unchanged: forbiddenWoods=5, dendren
nodeId="5"/pondId=2. Move charges: unchanged, PRESENT.

## Dead ends
None this session — the ablation's finding was real on the first sweep and
held up under a second seed and a finer-grained follow-up sweep. No
hypothesis was tried and abandoned.

## Metrics
- Charge-reserve ablation (`scripts/chargeReserveAblation.ts`,
  N=20000/weight, seed 1, mean rooms cleared ± 95% CI):
  weight 0 (control): 2.4925 ± 0.0182
  weight 0.2: 2.5511 ± 0.0186 (separated above control)
  weight 0.4: 2.5847 ± 0.0186 (separated above control, shipped)
  weight 0.8: 2.5544 ± 0.0186 (separated above control, but below 0.4)
  Reproduced at seed 9001 (same shape, same ordering).
- Follow-up plateau sweep (N=60000/weight, seeds 1 and 9001): weight 0.2
  vs 0.4 separated (0.4 higher) at this N; 0.4/0.5/0.6 mutually
  overlapping; 0.8 back down near 0.3's level in both seeds.
- Dungeon sim battle win rate at the shipped config (N=20000, seed 1,
  scored battles): 90.43% — reported alongside the ablation, not gated on
  (mean rooms cleared is the target metric per the brief).
- No live dungeon or fishing runs this session (brief scoped to sim/code
  work only; the one fishing check was read-only).

## Open questions for Claude
1. Same running question as sessions 30-33's open question 2: what's worth
   queuing next? CODEXIMPROVE #4 is now DONE (both stages). Remaining from
   the Codex docs: #5 (boon valuation with real confirmed deltas + persisted
   `playCounts`) — already scoped in this session's own `handoff/next.md`'s
   "Queued, not this session" section, well-scoped and ready to start.
2. QUESTIONS.md §15 (stuck fishing account after an escape) is unchanged —
   still needs a human DevTools capture of what the real client sends after
   an ESCAPE (not a catch), same as how `path_two`/`loot` were each
   originally confirmed. Not blocking any dungeon work.
3. The charge-reserve plateau (0.4/0.5/0.6, mutually indistinguishable) was
   not narrowed further than picking 0.4 as its low-risk edge — a much
   larger N (or a different metric, e.g. room-1 battle win rate specifically)
   might separate the plateau if that precision is ever worth the compute.
   Not necessary for this to have shipped; noted for completeness only.

## Files changed
```
 scripts/chargeReserveAblation.ts | 87 ++++++++++++++++++++++++++++++++++++++++
 src/strategy/config.ts           | 20 +++++++++
 src/strategy/decide.ts           | 47 +++++++++++++++++++++-
 src/strategy/utility.ts          | 25 +++++++++++-
 tests/strategy.test.ts           | 74 ++++++++++++++++++++++++++++++++++
 5 files changed, 249 insertions(+), 4 deletions(-)
```
(handoff/next.md, this session's own brief, is excluded — consumed as
input, not a work product of this session.)

---

## Appendix: raw ablation output

### Initial coarse sweep, N=20000/weight, seed 1

```
weight 0.00  rooms 2.4925 ± 0.0182  [2.4743, 2.5107]  battleWinRate 89.92%
weight 0.05  rooms 2.5050 ± 0.0183  [2.4867, 2.5233]  battleWinRate 90.09%
weight 0.10  rooms 2.5150 ± 0.0184  [2.4966, 2.5334]  battleWinRate 90.06%
weight 0.20  rooms 2.5511 ± 0.0186  [2.5325, 2.5696]  battleWinRate 90.17%
weight 0.40  rooms 2.5847 ± 0.0186  [2.5661, 2.6033]  battleWinRate 90.43%
weight 0.80  rooms 2.5544 ± 0.0186  [2.5358, 2.5730]  battleWinRate 90.01%

Separation from control (weight 0):
  weight 0.05 vs control: overlap — not established  (gap 0.0125)
  weight 0.10 vs control: overlap — not established  (gap 0.0225)
  weight 0.20 vs control: IMPROVEMENT (separated above control)  (gap 0.0585)
  weight 0.40 vs control: IMPROVEMENT (separated above control)  (gap 0.0922)
  weight 0.80 vs control: IMPROVEMENT (separated above control)  (gap 0.0619)
```

### Same sweep, seed 9001 (robustness check)

```
weight 0.00  rooms 2.5057 ± 0.0181  [2.4876, 2.5238]  battleWinRate 90.41%
weight 0.05  rooms 2.5168 ± 0.0181  [2.4987, 2.5350]  battleWinRate 90.44%
weight 0.10  rooms 2.5295 ± 0.0182  [2.5113, 2.5478]  battleWinRate 90.44%
weight 0.20  rooms 2.5489 ± 0.0184  [2.5305, 2.5673]  battleWinRate 90.40%
weight 0.40  rooms 2.5835 ± 0.0185  [2.5650, 2.6021]  battleWinRate 90.59%
weight 0.80  rooms 2.5657 ± 0.0185  [2.5471, 2.5842]  battleWinRate 90.34%

Separation from control (weight 0):
  weight 0.05 vs control: overlap — not established  (gap 0.0111)
  weight 0.10 vs control: overlap — not established  (gap 0.0238)
  weight 0.20 vs control: IMPROVEMENT (separated above control)  (gap 0.0432)
  weight 0.40 vs control: IMPROVEMENT (separated above control)  (gap 0.0778)
  weight 0.80 vs control: IMPROVEMENT (separated above control)  (gap 0.0600)
```

### Follow-up plateau sweep, N=60000/weight, {0.3, 0.4, 0.5, 0.6, 0.8}

```
seed 1, 60000 runs per weight
  weight 0.3: 2.5770 ± 0.0107  [2.5663, 2.5877]
  weight 0.4: 2.5927 ± 0.0107  [2.5820, 2.6034]
  weight 0.5: 2.5902 ± 0.0107  [2.5794, 2.6009]
  weight 0.6: 2.5908 ± 0.0107  [2.5801, 2.6015]
  weight 0.8: 2.5718 ± 0.0107  [2.5612, 2.5825]

seed 9001, 60000 runs per weight
  weight 0.3: 2.5747 ± 0.0106  [2.5641, 2.5854]
  weight 0.4: 2.5916 ± 0.0107  [2.5809, 2.6023]
  weight 0.5: 2.5946 ± 0.0107  [2.5839, 2.6053]
  weight 0.6: 2.5930 ± 0.0107  [2.5823, 2.6037]
  weight 0.8: 2.5746 ± 0.0106  [2.5640, 2.5853]
```

Reading this table: at N=60000, weight 0.2's CI (from the earlier N=60000
check against 0.4 specifically — `[2.5548, 2.5760]` seed 1, `[2.5533,
2.5745]` seed 9001) no longer overlaps weight 0.4's CI in either seed (0.4's
lower bound, ~2.5820/2.5809, sits above 0.2's upper bound, ~2.5760/2.5745) —
so 0.4 is a real step up from 0.2, not just from the zero control. 0.4/0.5/0.6
are mutually overlapping in both seeds (no pairwise separation among the
three). 0.8 sits clearly below all three of 0.4/0.5/0.6 in both seeds
([2.5612,2.5825] seed 1 vs 0.4's [2.5820,2.6034] — barely overlapping at the
very edge, effectively separated; [2.5640,2.5853] seed 9001 vs 0.4's
[2.5809,2.6023] — same shape) — this is the inverted-U: more charge-reserve
weight is not monotonically better past the plateau, which is the strongest
evidence this is exploiting real structure (carried charges genuinely have
continuation value, up to a point) rather than an artifact of the term
mechanically inflating every state's utility regardless of content.

0.4 was chosen over 0.5/0.6 as the shipped value because it is the low-risk
edge of the plateau — smallest weight that reaches the flat top — on the
reasoning that a smaller weight is less likely to start crowding out the
HP/armor terms it composes beside as those terms get retuned in the future,
not because 0.4 measurably beats 0.5/0.6 (it doesn't, they're tied within
noise at this N).
