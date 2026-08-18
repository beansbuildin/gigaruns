# BRIEF — session 39

Session 38 landed clean: 548/548 tests (net +3), `tsc` clean, `git diff
--check` clean. It fixed CODEXAUDIT #2 for real — the live fishing
contextual-fallback tier's hard `minIndependentCasts` threshold is fully
retired, replaced by continuous shrinkage (`weight = n / (n +
shrinkageK)`, `DEFAULT_SHRINKAGE_K = 1`), and — critically — the fix is
proven against the REAL corpus CV (log loss 5.700 / Brier 0.852, both
beating the cell-only baseline's 5.860 / 0.932), not shipped on the
synthetic ablation alone. That was the actual bug behind session 33's
original miscalibration: the wrong metric governed the ship decision. This
time the gate held.

**CODEXAUDIT #4 is the only item left in the entire Codex backlog**
(CODEXREVIEW's 10 + CODEXIMPROVE's 6 + CODEXAUDIT's 6, all traced from
session 28 through now). Session 38's own recap flagged something worth
taking seriously: the last two "backlog fully closed" claims (sessions 35
and 36) both had to be walked back. This brief scopes #4, AND a
verification pass before anyone writes "fully closed" a third time.

---

## 1. Fix the `nextPosition` override gate (CODEXAUDIT #4)

Relevant code, confirmed against the current tree (line numbers below are
current — this file has shifted since the audit's original citation):

- `scripts/liveFishing.ts:376` — `NEXT_POSITION_OVERRIDE_THRESHOLD = 10`.
- `scripts/liveFishing.ts:410-422` — `loadNextPositionValidations()`.
  Confirmed live: `JSON.parse(line) as NextPositionValidation` — a bare
  type assertion, zero runtime shape validation beyond the try/catch that
  only guards against literally-invalid JSON. A well-formed but WRONG
  record (missing field, `hit` as a string, `predicted` with 3 elements,
  coordinates outside the real grid) parses cleanly and is trusted.
- `scripts/liveFishing.ts:425-426` — `confirmedHitCount()`: `.filter((v)
  => v.hit).length` — literally every hit ever logged, all-time, no
  relationship to how many total attempts (hits + misses) produced them.
  Confirmed exactly as the audit described: ten hits and ninety
  interleaved misses would satisfy `>= 10` just as easily as ten hits and
  zero misses.
- `scripts/liveFishing.ts:397-403` — `extractNextPosition()`: reads
  `data.nextPosition` off the raw wire doc with a type check
  (`typeof x/y === "number"`) but no bounds check against the real
  `gridSize` the doc itself carries (`doc.data.gridSize`, read live at
  `:723`). An out-of-range prediction would flow straight into a logged
  validation record un-flagged.
- `scripts/liveFishing.ts:791-796` — the live gate check itself:
  `confirmedHitCount(nextPositionLogPath) >= NEXT_POSITION_OVERRIDE_THRESHOLD`
  flips `certainDistribution()` on, a one-hot override that fully replaces
  the matcher/contextual-fallback distribution for that turn.

**This is still dormant** — 2 confirmed hits in this project's entire
history, nowhere near even the current (broken) threshold of 10 — so
there's no live-behavior urgency the way #2 had. It's worth fixing
correctly anyway, since a threshold this permissive could silently arm a
bad override the day this project's fishing corpus grows enough to
accidentally clear it, and nobody would notice until catch rate dropped.

**Implementation, per the audit's suggested fix, with a design choice to
make deliberately (same pattern as session 38's shrinkage-vs-threshold
call):**

1. Add real schema validation to `loadNextPositionValidations()` — a zod
   schema (this project's established validation tool everywhere else:
   `guardPersistence.ts`, `opponentModelPersistence.ts`,
   `playCountsPersistence.ts` all use it) checking `ts`/`castId` are
   strings, `turn` is a non-negative integer, `predicted`/`actual` are
   2-tuples of numbers within `[1, gridSize]` (thread `gridSize` in as a
   parameter — this project reads it live off each doc, there's no fixed
   grid constant to import instead), `hit` is a boolean. A record that
   fails validation is skipped, same "one bad line shouldn't lose the
   whole log" convention `loadTransitionLog` already established — don't
   throw on a single bad line, but don't silently trust it either.
2. Fix the actual gate. The audit's minimum-safe snippet is a real
   improvement over today's code:
   ```ts
   const valid =
     validations.length >= NEXT_POSITION_OVERRIDE_THRESHOLD &&
     validations.every((v) => v.hit);
   ```
   — but think about whether "every hit, ever, forever" is the right
   long-term shape before shipping it as-is: a single early miss (which
   this project WILL have, this is a genuinely noisy rare signal) would
   permanently disable the override for the rest of the project's
   history, even after years of subsequent perfect hits. The audit itself
   names the more robust alternative: "a prespecified accuracy threshold
   with a conservative confidence bound" — e.g. a Wilson-score lower
   bound on hit rate, gated on both a minimum sample size (total
   attempts, not just hits) and the lower-bound accuracy clearing some
   target (meaningfully above chance, not just "not terrible"). Recommend
   building the confidence-bound version since this project already has a
   pattern for "don't trust a raw rate without accounting for sample
   size" (the boon-ranking rollout's CI-based gating, the charge-reserve
   ablation's explicit 95% CI bar) — but the audit's simpler snippet is an
   acceptable fallback if the confidence-bound math doesn't fit this
   session's time. Document whichever you ship and why, same as every
   other threshold in this codebase.
3. Validate grid bounds at the point `extractNextPosition()` reads the raw
   field too, not just in the historical-log loader — defense in depth,
   since a live out-of-bounds sighting would otherwise get logged clean
   and only get caught later by the loader's new validation.
4. Regression tests: a malformed-but-JSON-valid record (missing field,
   wrong type, out-of-bounds coordinate) is skipped by the loader and
   doesn't count toward anything; a synthetic validation history with many
   hits but interleaved misses does NOT clear the new gate (this is the
   exact bug being fixed — assert it explicitly); a synthetic history that
   SHOULD clear the new gate (however you define it) does. If you build
   the confidence-bound version, test the boundary case directly (just
   below vs. just at the required lower bound).
5. This override has never fired live and isn't expected to for a long
   time — there is no real live behavior to regression-test beyond the
   pure functions above. Don't manufacture a live smoke test for a
   feature that's dormant by design; the unit tests are the actual
   coverage here.

---

## Required before declaring the Codex backlog closed

Once #4 lands, this closes the entire Codex-derived backlog that's been
this project's spine since session 28. Before writing that in STATE.md:
re-verify, don't just assume, that the OTHER previously-claimed-fixed
items are still actually fixed in the tree right now — a quick grep-
confirmation pass, not a re-audit:

- CODEXIMPROVE #1: `bootstrapImportedIds` (or its unified-ledger
  successor) is still marked at the live-observe call site in
  `scripts/liveRun.ts`, not just at bootstrap.
- CODEXIMPROVE #5: `playCountsPersistence` is still wired into BOTH
  `scripts/liveRun.ts` and `scripts/orchestrator.ts`.
- CODEXIMPROVE #6: the opponent-model schema still rejects negative/
  fractional counts.
- CODEXREVIEW #2: all three persistence modules
  (`guardPersistence.ts`/`opponentModelPersistence.ts`/
  `playCountsPersistence.ts`) still route through `atomicWriteJson()`.

This is a five-minute grep pass, not a rebuild — the point is that the
last two "fully closed" claims both had a real gap underneath them, and a
third overclaim would cost more credibility than five minutes of checking
saves. If everything checks out, say so plainly and specifically (which
files, what you grepped for) rather than a bare "confirmed" — that
specificity is what let session 36's audit actually verify session 35's
claim instead of just trusting it.

---

## Your task

1. §1 (CODEXAUDIT #4) is the primary scope.
2. Run the verification pass above before writing any "backlog fully
   closed" language in STATE.md. If something doesn't check out, that's
   real news — report it the same way session 36 did, don't quietly
   patch it and pretend it was never wrong.
3. If the backlog is genuinely closed after this session: say so, note it
   as a real milestone, and use the "Open questions" section to propose
   what the project's spine should be next (session 38 already suggested
   returning to the numbered TASKS.md list — Task 11 tuning, Task 13
   deck-composition scoring, or the capture-blocked items).
4. Recap normally, full suite + `tsc` + `git diff --check` against the
   final commit as usual.

---

## Queued, not this session

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
