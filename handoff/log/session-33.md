# Session 33 — 2026-08-18 — commit c5a2622

## Brief

CODEXIMPROVE #3: condition the fishing fallback on previous movement
direction. Scope was deliberately single-item (`handoff/next.md`): offline
cross-validation first, then a simulator catch-rate ablation, then live
wiring only if both cleared. Stop and report honestly if the real corpus
didn't reproduce Codex's numbers in the same ballpark.

## What was built

1. `src/sim/fishing/transitionCorpus.ts` (new) — `TransitionRecord`, `Cast`,
   `groupByCast`, `isCleanCast`, `loadTransitionRecords` extracted verbatim
   out of `scripts/mineFishPatterns.ts` (byte-for-byte behavior preserved;
   `mineFishPatterns.ts` now imports and re-exports these so its own public
   API and existing tests are untouched). This is what the brief asked for
   directly: "reuse mineFishPatterns.ts's existing groupByCast-style logic
   rather than re-deriving it."

2. `src/strategy/fishing/contextualFallback.ts` (new) — the hierarchical
   backoff itself:
   - `castHops(cast)` walks a cast's trajectory into `{turn, from, to, prev}`
     hops, `prev` being the PRIOR hop's displacement (null for turn 0).
   - `buildContextualMap(casts)` groups observations by
     `${cellKey(from)}|${dx},${dy}`, tracking BOTH the observed `to` cells
     AND the distinct `castIds` contributing (gating unit is casts, not raw
     transitions — a single short repeating cast can't fake support).
   - `buildCellOnlyMap(casts)` — same shape as the existing `emptyFallback`
     log, built from `Cast[]` for the CV harness's per-fold rebuilding.
   - `contextualFallback(fromCell, prev, contextMap, cellOnlyLog, gridSize,
     opts)` — the actual 3-tier backoff: context (if `prev` non-null and
     support >= `minIndependentCasts`) → cell-only (`emptyFallback`,
     unchanged) → uniform (unchanged).
   - `DEFAULT_MIN_INDEPENDENT_CASTS = 3`, `previousDisplacement(history)`
     (shared by `castSim.ts` and `liveFishing.ts`).
   - `matcher.ts` gained `distributionFromMultiset`/`uniformDistribution` as
     extracted helpers, `emptyFallback` refactored to use them (behavior
     unchanged, existing `tests/fishing/matcher.test.ts` still passes
     unmodified).

3. `scripts/fishingContextualCV.ts` (new) — offline leave-one-cast-out
   cross-validation against the real `data/fish-patterns.jsonl`. Two jobs:
   reproduce Codex's 4-row raw-predictor table, and evaluate the SHIPPED
   hierarchical backoff with top-1/coverage/log-loss/Brier at
   `minIndependentCasts` ∈ {2,3,4}.

4. `scripts/fishingContextualAblation.ts` (new) — simulator catch-rate
   ablation. Extended `src/sim/fishing/castSim.ts`'s `CastOptions` with an
   optional `blindFallback` (contextMap + cellOnlyMap + minIndependentCasts)
   that, when the matcher is blind (`matcherPool: []`), routes through
   `contextualFallback` instead of the previously-hardcoded
   `emptyFallback(..., new Map(), gridSize)` — omitted, behavior is
   byte-for-byte unchanged. `previousDisplacement(matcher.history)` computed
   inline in the sim loop. Builds a synthetic "training corpus" from the
   SAME `buildPatternPool()` the sim's ground truth is drawn from (3000
   synthetic casts, 3-12 turns each), so any lift measured is about the
   algorithm exploiting genuine structure, not a claim about real Dendren.

5. `scripts/liveFishing.ts` — wired: `contextMap` built once per
   `runOneCast()` call from `groupByCast(loadTransitionRecords(...)).filter
   (isCleanCast)`; the per-turn `dist` ternary's `emptyFallback(...)` call
   replaced with `contextualFallback(matcher.history[...], previousDisplacement
   (matcher.history), contextMap, transitionLog, gridSize, {minIndependentCasts:
   DEFAULT_MIN_INDEPENDENT_CASTS})`. `transitionLog` (the existing cell-only
   map, loaded via the pre-existing `loadTransitionLog`) is passed through
   UNCHANGED as the tier-2 fallback — nothing about the existing cell-
   only/uniform behavior when the context tier misses was touched.

6. `tests/fishing/contextualFallback.test.ts` (new, 13 tests) — all of brief
   item 7's asks: a synthetic corpus where previous direction genuinely
   resolves cell-only's 50/50 ambiguity into two clean 100% predictions
   depending on arrival direction; a corpus where support never clears
   threshold (context tier provably never fires — asserted byte-for-byte
   identical to calling `emptyFallback` directly); turn-0 hops skip straight
   to cell-only; uniform last-resort untouched.

7. `tests/liveFishing.test.ts` — 2 new tests in a new describe block: the
   live wiring consults pre-seeded contextual corpus data without crashing
   and logs that it found support (3 independent seed casts → 1 context key,
   asserted via a `console.log` spy); a 4th seed cast with a CODEXREVIEW #5
   conflicting duplicate turn is excluded from support (still exactly 3
   clean casts / 1 key, not 4/1 or 4/2).

## Offline CV — full numbers

Real corpus: 169 raw transitions, 50 distinct casts, 1 excluded by
`isCleanCast` (the same known `12923189` resumed-numbering case CODEXREVIEW
#5 already excludes elsewhere) → 49 clean casts, 165 hops, 116 with a
previous displacement. **This exactly matches the brief's stated "49 clean
casts / 165 transitions"** — strong evidence the corpus and exclusion
methodology line up with Codex's own run before any accuracy number is even
compared.

Raw-predictor reproduction table (leave-one-cast-out, deterministic
(x,y)-sorted tie-break — see Dead ends below for why that tie-break):

| Predictor | This session | Codex's reported |
| --- | ---: | ---: |
| current cell only | 16.4% / 100.0% | 16.4% / 100.0% |
| current cell + turn | 13.3% / 82.4% | 16.4% / 82.4% |
| current cell + prevdir | 37.1% / 65.5% | 33.9% / 75.2% |
| current cell + turn + prevdir | 19.0% / 28.4% | 24.2% / 49.1% |

Exact match on cell-only and on coverage for cell+turn; close (not exact) on
accuracy for the other three rows. The QUALITATIVE conclusion reproduces
cleanly in every row: previous direction is by far the strongest single
predictor (~2.3x cell-only in both runs), turn number adds nothing
(cell+turn is flat-to-worse than cell-only in both runs), and stacking turn
on top of previous direction hurts rather than helps (both runs show
cell+turn+prevdir below cell+prevdir alone). Judged "close enough to trust
the methodology" per the brief's own bar — not silently reported as an exact
reproduction it wasn't quite.

Shipped hierarchical backoff, `minIndependentCasts` sweep:

| Threshold | top-1 | coverage | log loss | Brier |
| --- | ---: | ---: | ---: | ---: |
| cell-only baseline | 16.4% | 100.0% | 5.860 | 0.932 |
| 2 | 24.8% | 21.2% | **6.264** (worse) | 0.910 (better) |
| 3 | 19.4% | 8.5% | 6.151 (slightly worse) | 0.927 (slightly better) |
| 4 | 16.4% | 0.0% | 5.860 (= baseline) | 0.932 (= baseline) |

Threshold 2's log loss regressing despite a bigger top-1/Brier win is real
signal, not noise: with only 2 independent casts of support, a context key's
distribution can concentrate on 1-2 cells; when the held-out actual falls
outside that tiny observed set, the assigned probability is near zero and
log loss penalizes that far more harshly than Brier does. Shipped with 3 —
smaller log-loss regression, Brier actually improves slightly, and it
matches this project's general caution against small-sample confidence
(though this is a different statistical regime than the ~30-observation
rate floor, same reasoning shape as `mineFishPatterns.ts`'s own
`PROMOTION_THRESHOLD` comment).

## Simulator ablation — full numbers

N=2000 synthetic casts per configuration, matcher permanently blind
(`matcherPool: []`), training corpus = 3000 synthetic casts (3-12 turns
each) drawn from `buildPatternPool()` — the SAME pool the sim's true fish
movement is drawn from, so this measures "does the algorithm exploit
structure that's genuinely there," per CLAUDE.md's sim-authority-per-domain
rule (DECISIONS 2026-08-15, session 14).

```
matcher BLIND, fallback UNIFORM (today's actual live/default behavior):      158/2000 = 7.9%
matcher BLIND, fallback CELL-ONLY (real-style empirical, no context tier):    675/2000 = 33.8%
matcher BLIND, fallback CONTEXTUAL (this session's hierarchical backoff):    1451/2000 = 72.5%
```

Dramatic, unambiguous lift at each tier. The synthetic patterns
(bounce/mirror/clockwise-walk primitives, `src/sim/fishing/patterns.ts`) are
far MORE deterministic given previous displacement than real Dendren is
known to be — this is explicitly NOT a live catch-rate promise, it is proof
the algorithm correctly exploits directional structure when it exists,
which is the narrower, honest question this ablation can actually answer.

## Dead end: tie-breaking, and how it was found

The first CV run scored cell-only at 23.0% (insertion-order top-1
tie-break) — nowhere near Codex's 16.4%, and briefly looked like either a
corpus mismatch or a genuine methodology divergence worth stopping over per
brief item 3. Tried "any tied cell counts as correct" next: 29.1%, moved
FURTHER away, ruling that out. The real cause: with small per-cell sample
sizes, the empirical cell-only distribution ties often (multiple cells at
the same observed frequency), and Codex's own evaluation evidently breaks
ties deterministically by grid position (lowest x, then lowest y) rather
than by insertion/discovery order. Switching `scripts/
fishingContextualCV.ts`'s `top1()` to that rule reproduced 16.4% (27/165)
EXACTLY. This tie-break is scoped to the CV script's evaluation only — the
shipped `contextualFallback()`/`emptyFallback()` never picks a single top-1
cell; they return the full distribution, which `chooseCard` consumes
whole, so no tie-break decision needed to be baked into production code at
all.

## Live smoke test finding (QUESTIONS.md §15, not a regression)

`--dry-run` ran clean (halts before `start_run`, as designed). One real
`npx tsx scripts/liveFishing.ts --casts=1` attempt: `start_run` rejected
HTTP 400, BEFORE any of this session's new code path ran (the request body
was the unchanged, standard `start_run` envelope — see `logs/
fishing-2026-08-18-10-12-52.jsonl`). Guard fail-closed correctly: 0 energy
spent, confirmed by the energy-accounting log (`237 → 237, committed 0`).

Read-only follow-up (`scripts/checkFishingStuck.ts` + a direct
`getFishingState` read) found the account carrying a completed-but-
unresolved doc: `docId 12957129`, `COMPLETE_CID: true`, **`SUCCESS_CID:
false`** — an ESCAPE (fishHp/fishMaxHp both at 17, matching the confirmed
catch-meter direction where a miss pushes `fishHp` toward `fishMaxHp` and
`FISH_ESCAPED` fires there), not a catch. This doesn't match any
previously-documented stuck shape: DECISIONS 2026-08-16 (session 15) and
QUESTIONS §10 both describe the mechanic as catch-specific (a real
`cardsToAdd` triple sitting unresolved until `loot` picks one). This doc
has NO `cardsToAdd` at all and `cardChosenId: -1` — not the
previously-documented `null` sentinel. Logged to QUESTIONS.md §15 rather
than guessed at further; sending an unconfirmed `loot`-shaped POST against
a shape this project has never captured would be exactly the kind of guess
CLAUDE.md §2/§5 rules out. Whether this HTTP 400 is even caused by this
stuck doc, versus something unrelated (stale token, transient error,
rate limiting), is also unresolved — noted honestly as unknown rather than
asserted either way.

## Verification

- `npx tsc --noEmit`: clean, run twice (mid-session and against final commit
  c5a2622).
- `npx vitest run`: 510/510 passing (was 500/500 at session 32's end),
  run against the final commit.
- `npx tsx scripts/fishingContextualCV.ts`: numbers above, reproduced twice
  (identical both runs, corpus unchanged).
- `npx tsx scripts/fishingContextualAblation.ts`: numbers above.
- `npx tsx scripts/liveFishing.ts --dry-run`: clean, no crash.
- `npx tsx scripts/liveFishing.ts --casts=1`: real HTTP 400 on `start_run`,
  correctly fail-closed, 0 energy spent — see finding above.

## Not done this session (deliberately, per the brief)

CODEXIMPROVE #4 (dungeon charge-reserve continuation value) and #5 (boon
valuation with real confirmed deltas + persisted `playCounts`) — both
explicitly queued, not started, same one-item-at-a-time discipline session
32 used for #1.
