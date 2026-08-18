# STATE — session 33 — 2026-08-18 — commit c5a2622

## Status
No TASKS.md gate was targeted this session — same discipline as sessions 31/32.
The brief was CODEXIMPROVE #3 (previous-direction contextual fishing
fallback) alone, scoped to stop and report honestly if the real corpus
didn't reproduce Codex's numbers before wiring anything live.
Overall: **GATE PASS.** Offline cross-validation reproduced the core
finding, the simulator ablation confirmed the algorithm exploits real
structure when present, and the tier is now live in `scripts/liveFishing.ts`.

## What works
- **Hierarchical contextual fallback, shipped** (`src/strategy/fishing/
  contextualFallback.ts`): tier 1 = current cell + previous movement
  displacement, gated on `DEFAULT_MIN_INDEPENDENT_CASTS = 3` distinct real
  casts supporting that exact `${cellKey}|${dx},${dy}` key; tier 2 = the
  existing cell-only `emptyFallback` (unchanged); tier 3 = uniform
  (unchanged). Turn number deliberately excluded, per Codex's own ablation.
- **Offline leave-one-cast-out CV reproduces the core finding**
  (`scripts/fishingContextualCV.ts`, real `data/fish-patterns.jsonl`, 49
  clean casts / 165 hops — exactly matches Codex's stated corpus size):
  cell-only 16.4% top-1 (EXACT match to Codex's 16.4%), cell+previous-
  direction 37.1% (vs Codex's 33.9% — both ~2.3x cell-only, same
  conclusion), cell+turn 13.3% vs Codex's 16.4% (both show turn adding
  nothing), cell+turn+prevdir 19.0% vs Codex's 24.2%. Coverage numbers are
  close but not identical (65.5% vs Codex's 75.2% on the prevdir row) —
  reported honestly, not silently rounded to a match. Verdict: reproduces
  in the same ballpark, methodology trusted.
- **`minIndependentCasts` chosen empirically, not guessed**: swept {2,3,4}
  with log loss + Brier (not just top-1) at each. Threshold 2 gives the
  biggest top-1 lift (24.8% vs 16.4% baseline) but its log loss (6.264)
  is WORSE than the cell-only baseline's (5.860) — confident-wrong
  predictions at thin support. Threshold 3: top-1 19.4%, log loss 6.151
  (smaller regression), Brier 0.927 (slightly BETTER than baseline's
  0.932). Threshold 4 never fires in this corpus (0% coverage, identical
  to baseline) — too small a corpus for 4+ independent casts on any one
  key yet. Shipped with 3.
- **Simulator ablation confirms the algorithm itself works**
  (`scripts/fishingContextualAblation.ts`, N=2000 synthetic casts,
  matcher-blind, training corpus mined from the same synthetic pattern
  pool the sim draws true movement from): uniform 7.9% → cell-only 33.8%
  → contextual 72.5%. Framed per CLAUDE.md's sim-authority rule as "does
  the algorithm exploit genuine structure when present," not a live
  Dendren catch-rate estimate — the synthetic patterns are far more
  deterministic than real Dendren is known to be.
- **Live-wired**: `scripts/liveFishing.ts`'s per-turn fallback now calls
  `contextualFallback()` instead of `emptyFallback()` directly, passing the
  existing `transitionLog` unchanged as the cell-only tier and a newly
  built `contextMap` (from clean, `isCleanCast`-filtered casts) as the
  context tier. The real corpus already has 10 context keys meeting the
  live threshold (checked directly, e.g. `"3,2|1,0"` at 4 casts,
  `"4,2|1,0"` at 4 casts) — the tier is reachable in live play now, not
  just in theory.
- **Shared code, not a third implementation**: `groupByCast`/`Cast`/
  `TransitionRecord`/`isCleanCast` extracted from `scripts/
  mineFishPatterns.ts` into `src/sim/fishing/transitionCorpus.ts` (byte-
  for-byte behavior preserved, re-exported so `mineFishPatterns.ts`'s
  public API and its existing tests are untouched); `previousDisplacement`
  shared between `castSim.ts` and `liveFishing.ts`; `distributionFromMultiset`
  extracted in `matcher.ts` and reused by both `emptyFallback` and the new
  context tier.
- **Regression tests, all of brief item 7's asks**: synthetic corpus where
  previous direction genuinely resolves cell-only ambiguity (50/50 →
  100/0 depending on arrival direction) vs. one where support never clears
  threshold (context tier provably never fires, byte-for-byte identical
  output to `emptyFallback` alone); turn-0 hops skip straight to cell-only;
  live-wiring smoke tests confirm a CODEXREVIEW #5 duplicate-turn conflict
  is excluded from context support the same way `testPrimitives` already
  excludes it. `tests/fishing/contextualFallback.test.ts` (13 tests) +
  2 new tests in `tests/liveFishing.test.ts`.
- Tests: **510/510 passing** (+10 from session 32's 500). `npx tsc --noEmit`
  clean, checked against this session's final commit.

## What's broken
Nothing this session's changes broke — full suite green, tsc clean. One
unrelated live-environment finding surfaced while smoke-testing (see Open
questions #1 below), not caused by this session's code. Pre-existing, still
true: the scheduler can't learn about energy gained outside its own
tracking, and a SIGINT during an energy-regen sleep still ends the whole
session (unchanged since session 25).

## Corrections to SPEC.md
None this session. Resolved IDs unchanged: forbiddenWoods=5, dendren
nodeId="5"/pondId=2. Move charges: unchanged, PRESENT.

## Dead ends
- Scoring top-1 accuracy with "first-observed" or "any-tied-cell-counts"
  tie-breaking on the offline CV script initially produced cell-only=23.0%
  or 29.1% — nowhere near Codex's 16.4%, and briefly looked like a
  methodology mismatch worth stopping over. Root cause found by testing a
  third tie-break (lowest x, then lowest y, among cells tied for max
  probability): reproduces Codex's 16.4% exactly (27/165). Codex's own
  evaluation evidently uses a deterministic positional tie-break, not
  insertion order — `scripts/fishingContextualCV.ts`'s `top1()` now uses
  this rule for evaluation only (never for the shipped `predict()`-style
  distribution, which downstream `chooseCard` consumes whole).

## Metrics
- Offline CV (leave-one-cast-out, real corpus, 49 clean casts / 165 hops):
  cell-only 16.4% top-1 / 100.0% coverage; cell+prevdir 37.1% / 65.5%;
  hierarchical@3 19.4% / 8.5% coverage, log loss 6.151, Brier 0.927 (vs
  cell-only baseline's log loss 5.860, Brier 0.932).
- Simulator ablation (N=2000/config, matcher-blind): uniform 7.9%,
  cell-only 33.8%, contextual 72.5%.
- Live: one `--dry-run` (clean, no crash, halted before start_run per
  normal dry-run behavior) and one real `--casts=1` attempt this session —
  the real attempt's `start_run` was rejected HTTP 400 by the server before
  any new code ran; guard fail-closed correctly, 0 energy spent (confirmed
  237→237 in the energy-accounting log). See Open questions #1.

## Open questions for Claude
1. **Live smoke test surfaced an unrelated finding, not a regression**:
   `start_run` rejected HTTP 400 on this session's one real live attempt.
   Read-only follow-up found the account carrying `docId 12957129`,
   `COMPLETE_CID: true`, `SUCCESS_CID: false` (an ESCAPE, not a catch —
   `fishHp`/`fishMaxHp` both at max) with no `cardsToAdd` and
   `cardChosenId: -1` (not the previously-documented `null`). Every prior
   "stuck account" finding (DECISIONS 2026-08-16 session 15, QUESTIONS §10)
   was CATCH-specific (`loot` resolves a pending card choice). This looks
   like it could be a different, previously-undocumented mechanic — an
   escape ALSO leaving the account needing something before a fresh
   `start_run`, or it could be unrelated stale state from earlier
   out-of-band play. Logged to QUESTIONS.md §15 rather than guessed at
   further (no confirmed action shape exists for resolving an escape).
   Worth a DevTools capture of what the real client does after an escape,
   if the user hits this in normal play.
2. Same running question as sessions 30/31/32's open question 2: what's
   worth queuing next? CODEXIMPROVE #3 is now DONE. Remaining from both
   Codex docs: #4 (dungeon charge-reserve continuation value), #5 (boon
   valuation with real confirmed deltas + persisted `playCounts`) — both
   already scoped in `handoff/next.md`'s "Queued, not this session"
   section from this session's own brief.
3. The context tier's live-usable value is still corpus-size-limited: only
   10 of 69 distinct context keys in the real corpus currently clear the
   `minIndependentCasts=3` bar. This will grow automatically as
   `data/fish-patterns.jsonl` accumulates more real casts (no code change
   needed) — worth re-running `scripts/fishingContextualCV.ts` periodically
   to see if the threshold itself should move, same as
   `mineFishPatterns.ts`'s `PROMOTION_THRESHOLD` reasoning.

## Files changed
```
 QUESTIONS.md                                  |  47 ++++++
 handoff/reports/dungeon-runs.md               |   2 +-
 handoff/reports/fishing-casts.md              |   2 +-
 scripts/fishingContextualAblation.ts          | (new, 97 lines)
 scripts/fishingContextualCV.ts                | (new, 251 lines)
 scripts/liveFishing.ts                        |  51 ++++++-
 scripts/mineFishPatterns.ts                   |  74 +---------
 src/sim/fishing/castSim.ts                    |  40 +++++-
 src/sim/fishing/transitionCorpus.ts           | (new, 119 lines)
 src/strategy/fishing/contextualFallback.ts    | (new, 184 lines)
 src/strategy/fishing/matcher.ts               |  42 ++++--
 tests/fishing/contextualFallback.test.ts      | (new, 147 lines)
 tests/liveFishing.test.ts                     | 168 ++++++++++++++++++-
 13 files changed, 1134 insertions(+), 90 deletions(-)
```
(handoff/next.md, this session's own brief, is excluded — consumed as
input, not a work product of this session.)
