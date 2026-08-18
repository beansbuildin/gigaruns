# BRIEF — session 38

Session 37 landed clean: 545/545 tests (+12), `tsc` clean, `git diff
--check` clean. It closed CODEXREVIEW #2 for real — one shared
`atomicWriteJson()` helper (new `src/orchestrator/atomicWrite.ts`) now
backs all three persistence modules (`guardPersistence.ts`,
`opponentModelPersistence.ts`, `playCountsPersistence.ts`), with a spy
confirming `fsyncSync` actually fires on save, not just that the code
compiles — and it was honest in the recap about the boundary of what a
unit test can prove (the syscall fires; real power-loss durability is a
filesystem/OS guarantee this project is trusting, not independently
verifying). It also shipped the CODEXAUDIT #6 stretch item (opponent-model
schema tightened to reject negative/fractional counts and impossible
transition sums). One reusable finding worth carrying forward: `vi.spyOn`
can't target Node's built-in ESM module exports directly ("module
namespace is not configurable in ESM") — use `vi.mock("node:fs", { spy:
true })` instead, which auto-spies every export while still calling
through to the real implementation.

Two real gaps remain from the independent Codex audit: CODEXAUDIT #2
(fishing contextual fallback's log-loss regression) and #4 (`nextPosition`
override gate). Session 37's own recap called these "genuinely comparable
in scope/age" — not a forced pick the way #5 was. This session picks #2.

---

## Why #2 over #4

`nextPosition`'s override (#4) sits behind `NEXT_POSITION_OVERRIDE_THRESHOLD
= 10` confirmed hits, and this project has 2 confirmed sightings in its
entire history — that gate is DORMANT, not currently influencing any live
decision. The contextual fallback's shrinkage-vs-hard-switch problem (#2)
is the opposite: per session 33/34's own numbers, the real corpus already
has 10 context keys clearing `minIndependentCasts=3` and the tier is LIVE
in `scripts/liveFishing.ts` today — every time one of those 10 keys fires
in a real cast, it's using a distribution CODEXAUDIT #2 already showed has
worse held-out log loss than just falling back to cell-only. That's an
active, currently-shipped miscalibration, not a dormant one. Fix the live
one first.

---

## 1. Shrink the contextual fishing fallback instead of hard-switching (CODEXAUDIT #2)

Relevant code, confirmed against the current tree (unchanged since session
33 — these files' mtimes predate this whole audit-response run):

- `src/strategy/fishing/contextualFallback.ts:169-184` — `contextualFallback()`,
  confirmed live: a hard `if (stats && stats.castIds.size >=
  opts.minIndependentCasts) return distributionFromMultiset(stats.observations);`
  — a raw empirical distribution over however many observations exist at
  that key, with ZERO probability on any cell not in that thin sample the
  instant the threshold clears. `DEFAULT_MIN_INDEPENDENT_CASTS = 3` is
  documented (`:125-138`) as chosen by a log-loss/Brier sweep — but the
  sweep it was chosen from already showed 6.151 vs. the cell-only
  baseline's 5.860 (worse), and it shipped anyway on the strength of the
  top-1/synthetic-ablation numbers. That's the actual bug: the wrong
  metric governed the ship decision.
- `src/strategy/fishing/matcher.ts:78-114` — `distributionFromMultiset()`,
  `uniformDistribution()`, `emptyFallback()` all confirmed present and
  unchanged; `emptyFallback` is the cell-only tier `contextualFallback`
  already calls. No `mixDistributions`-shaped helper exists yet — this is
  new.
- `scripts/fishingContextualCV.ts:1-60+` — already has the exact harness
  this fix needs: leave-one-cast-out CV, log loss + Brier + top-1 per
  evaluated variant, and an existing sweep loop over
  `minIndependentCasts` values that this session should extend (or
  replace) with a `shrinkageK` sweep, rather than writing a second CV
  script from scratch.

**Implementation, per the audit's suggested fix:**

1. Add a shared `mixDistributions(a, b, weight)` helper — same home as
   `distributionFromMultiset`/`uniformDistribution`
   (`src/strategy/fishing/matcher.ts`, since it's a generic distribution
   operation other callers may want later, not something specific to the
   contextual-fallback module). `weight` is how much of `a` to keep;
   union the two maps' keys, renormalize so probabilities still sum to 1.
2. In `contextualFallback()`, replace the hard threshold-gated return with
   continuous shrinkage: `const n = stats?.castIds.size ?? 0; const weight
   = n / (n + shrinkageK);` then mix the context-tier distribution and the
   cell-only distribution by that weight. At `n = 0` this naturally
   collapses to pure cell-only (weight 0) — which raises a real design
   question worth resolving deliberately rather than by accident: does
   continuous shrinkage REPLACE `minIndependentCasts` entirely (the
   audit's own snippet has no hard gate left), or does the hard gate stay
   as a "don't even bother mixing below N" floor with shrinkage softening
   only what's above it? The audit's suggested fix reads as a full
   replacement — recommend going that way (one smoothing mechanism, not
   two overlapping ones) unless the CV sweep below shows a reason not to.
   Document whichever you land on, same as every other threshold decision
   in this codebase.
3. Sweep `shrinkageK` via `fishingContextualCV.ts`'s existing harness —
   reuse its log-loss/Brier/top-1 infrastructure rather than duplicating
   it. Report ALL three metrics per value swept, same as the original
   `minIndependentCasts` sweep did.
4. **The actual gate, stated plainly because it's the whole point of this
   fix**: keep the context tier's effective contribution at (or ship a
   configuration that keeps it at) zero unless some `shrinkageK` value
   beats the cell-only baseline's log loss (5.860) and Brier (0.932) on
   the REAL corpus CV — not the synthetic catch-rate ablation alone. The
   audit is explicit about this: "keep the context tier disabled unless it
   beats the baseline without relying solely on the synthetic catch
   simulator." If nothing clears that bar with the corpus this project
   currently has, the honest outcome is disabling the context tier's live
   contribution (effectively `shrinkageK → very large`, or an explicit
   feature flag defaulting off) and saying so — not shipping the
   best-of-a-bad-set value the way session 33 effectively did. Keep
   cell-only-forever as the explicit control, same discipline as the
   charge-reserve and boon-ranking ablations already used.
5. If a `shrinkageK` DOES clear the bar: the synthetic simulator ablation
   (`scripts/fishingContextualAblation.ts`) can still be re-run as a
   secondary "does this look like it exploits real structure" check, same
   framing session 33 used — but it is not a substitute for the real-corpus
   CV result, only a supplement to it.
6. Regression tests: a case where `n` is small enough that shrinkage should
   dominate toward cell-only (mixed distribution close to the pure
   cell-only one); a case where `n` is large enough that shrinkage should
   favor context (mixed distribution close to the pure context one);
   `mixDistributions` itself renormalizes correctly when the two inputs
   have non-overlapping cell sets. Update or replace whatever regression
   tests session 33 wrote against the old hard-threshold behavior — check
   `tests/fishing/contextualFallback.test.ts` for what needs to change vs.
   what still holds (the turn-0/no-previous-displacement case should be
   unaffected by this change either way).
7. `scripts/liveFishing.ts`'s live call site passes through whatever
   `contextualFallback()`'s new signature needs — check it still compiles
   and still reads correctly (it currently just calls `contextualFallback`
   with the default options object; verify current line numbers on open,
   this file has shifted since session 33/34's fishing work).

---

## Your task

1. §1 (CODEXAUDIT #2) is the whole scope this session.
2. Resolve the `minIndependentCasts`-vs-shrinkage design question in step 2
   above deliberately, and document the choice — don't let two competing
   smoothing mechanisms coexist by accident.
3. The gate in step 4 is not optional: if the real-corpus CV can't beat
   the cell-only baseline at any `shrinkageK`, ship the context tier
   disabled and say so plainly, rather than shipping the least-bad option.
   This session exists specifically to not repeat that mistake.
4. Do NOT attempt CODEXAUDIT #4 (`nextPosition` gate) this session — still
   queued, still real, still dormant (2/10 confirmed hits) so not as
   urgent as fixing a tier that's live today.
5. Recap normally, full suite + `tsc` + `git diff --check` against the
   final commit as usual.

---

## Queued, not this session

- **CODEXAUDIT #4** (`nextPosition` override gate counts raw hits, not
  hits-out-of-attempts) — needs a real accuracy/confidence-bound gate plus
  schema and grid-bounds validation on the loader. Relevant code:
  `scripts/liveFishing.ts:365, 399-415, 779-795` (verify current line
  numbers on open). Dormant (2/10 confirmed hits), not urgent, but real.
- **QUESTIONS.md §15** (stuck fishing account after an escape) — still
  needs a human DevTools capture, not code. Not re-checked since session
  33.
- Task 14 (bot-initiated juiced `start_run`) — still BLOCKED on a live
  DevTools capture, not code work.
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends
  the whole session (unchanged since session 25).
- The charge-reserve plateau (0.4/0.5/0.6, mutually indistinguishable at
  the N run so far) — not urgent.
