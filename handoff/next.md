# BRIEF — session 33

Session 32 landed clean: 500/500 tests (+12), `tsc` clean. It closed
CODEXIMPROVE #1 (dungeon opponent-model persistence + idempotent bootstrap,
live-verified against the real fixture corpus — 64 room-1 exchanges
imported once, zero on the second launch) and the test-isolation hygiene
pass CODEXIMPROVE queue §2 asked for (CLAUDE.md now states the
isolated-test-path rule explicitly; grep audit found no violations beyond
the 3 already-fixed session-31 offenders).

This session's brief was prepared by re-reading both source Codex
documents (`CODEXREVIEW` and `CODEXIMPROVE`) fresh against the actual
current code and cross-referencing every numbered item against
`DECISIONS.md`, `STATE.md`, and the live files themselves — not just
against the running "remaining items" list carried in STATE.md's open
questions, which undersells how much is actually done. Full status below;
this replaces the shorthand "#3/#4/#5, #9/#10" note session 32 left,
which was correct as far as it went but never spelled out that literally
everything else on both lists already has a matching fix.

---

## Cross-reference: full CODEXREVIEW / CODEXIMPROVE status

**CODEXREVIEW — all 10 items resolved.** Verified against the live code,
not just recalled from memory:

1. Fishing fixture directories miscounted as casts — DONE session 28
   (`src/sim/fishingCorpus.ts` canonical `docId`-based loader; DECISIONS
   2026-08-18 session 28).
2. Guard/budget persistence fail-open, non-atomic, no single-writer — DONE
   session 28 (`guardPersistence.ts` atomic temp+rename,
   `acquireGuardLock()` held for full process lifetime, DECISIONS session
   28).
3. Orchestrator skipped energy accounting after unexpected post-spend
   errors — DONE session 28. Confirmed live in `scripts/orchestrator.ts`
   right now: both the dungeon and fishing branches route through
   `runWithGuaranteedAccounting()`, with an inline comment citing
   CODEXREVIEW #3 by name.
4. `getDungeonState()` converted every 5xx into "no active run" — DONE
   session 28. Confirmed live in `src/api/client.ts`: one 5xx retries
   once, a second consecutive 5xx now throws `UnexpectedResponseError`
   ("...not an idle account (CODEXREVIEW #4)" — inline comment, same
   file).
5. Resumed fishing casts reset transition numbering, could promote false
   patterns — DONE session 29 (`liveFishing.ts`'s `lastRecordForCast` +
   resume-position validation; `mineFishPatterns.ts` rejects gapped/
   duplicate-conflicting trajectories). Verified against the exact bug
   case named (cast `12923189`), confirmed excluded post-fix.
6. Server-side daily caps observed but not used as scheduling state —
   DONE session 29 (`assertDungeonCapNotExhausted` reconciles against
   `GET /game/dungeon/today` before a new dungeon `start_run`; fishing's
   real-rejection path reclassified as a budget trip so it can't take the
   other mode down with it).
7. JWT redaction only given the token's first 8 characters — DONE.
   Confirmed live: `GigaverseClient.redactSecrets()` exists on the client
   itself (`src/api/client.ts:130`) and both live fixture writers in
   `orchestrator.ts` call it directly, matching the doc's exact suggested
   fix shape.
8. Net energy delta undercounted committed spend — DONE session 31
   (`src/orchestrator/energyAccounting.ts`; guard now enforces off
   committed spend recorded the moment `start_run` succeeds, before/after
   read demoted to diagnostic-only).
9. CLAUDE.md contradicted live tier behavior (`pickSafeTier` vs. the
   generalized `pickLowestTier`) — DONE, further back than either doc's
   framing suggested (session 09). Confirmed live: CLAUDE.md §8 already
   reads "Always choose the lowest tier actually offered" and names
   `pickLowestTier()`.
10. `viem` unused — RESOLVED NOT APPLICABLE, session 31. Checked before
    acting per CLAUDE.md §9: `viem` IS used live, `scripts/probe.ts`'s EOA
    auth path (`AUTH_MODE=eoa`). Correctly NOT removed.

**CODEXIMPROVE — #1, #2, #6 resolved; #3, #4, #5 open.**

1. Persist/bootstrap dungeon opponent model — DONE session 32 (above).
2. Fishing tie-breaks conserve focus/mana — DONE session 31
   (`bestFocusForCard`'s Manhattan-distance tie-break, `chooseCard`'s full
   lexicographic `isPreferred` comparator — lethal, EV, focus cost, mana
   cost, hand order). Provably EV-neutral, no sim re-validation needed
   per that session's own reasoning.
3. **Previous-direction contextual fishing fallback — OPEN. This
   session's primary work; see §1 below.**
4. Charge-reserve continuation value for carried dungeon move charges —
   OPEN, queued.
5. Boon valuation using real confirmed deltas + persisted per-run
   `playCounts` — OPEN, queued.
6. Gate/validate `nextPosition` before a live override — DONE session 30,
   exactly as scoped ("add a validation-only mode... promote to a live
   override only after repeated exact agreement, not from two sightings").
   `liveFishing.ts` logs predicted-vs-actual to
   `data/nextPositionValidation.jsonl` every checkable turn; the override
   path is wired but gated behind `NEXT_POSITION_OVERRIDE_THRESHOLD = 10`
   confirmed hits, unreached at 2 sightings project-wide. Correctly not
   promoted further — nothing to do here until more live data accumulates
   on its own; not a code task.

So the actual remaining backlog, full stop, is CODEXIMPROVE #3, #4, #5.
Per CODEXIMPROVE's own suggested implementation order (§3 before §4/§5),
and because #3 is the strongest empirical fishing predictor Codex found
in the corpus, this session scopes #3 alone — same one-item-at-a-time
discipline session 32 used for #1.

---

## 1. Condition the fishing fallback on previous movement direction (CODEXIMPROVE #3)

Relevant code, re-checked against the current tree (line numbers below
are current, not the doc's original review-commit numbers, which have
drifted since sessions 29/30/31 touched these same files for CODEXREVIEW
#5 and the `nextPosition` work):

- `src/strategy/fishing/matcher.ts:79-98` — `emptyFallback()`. Its `log`
  parameter is `ReadonlyMap<string, readonly Cell[]>` keyed ONLY on
  `cellKey(fromCell)` — confirmed live, no previous-direction context
  reaches it today.
- `scripts/liveFishing.ts:264-292` — `TransitionRecord`/
  `loadTransitionLog()`. The record already carries `castId`, `turn`,
  `from`, `to` (and `gridSize`) per entry — the context CODEXIMPROVE #3
  wants is already captured on disk, just not used when building the
  empirical map.
- `scripts/liveFishing.ts:697, 710-725, 752` — where the log is loaded,
  where resumed-cast numbering is validated (CODEXREVIEW #5's fix,
  already landed — reuse its cast-grouping discipline rather than
  duplicating it), and where `emptyFallback()` is actually called each
  turn.
- `data/fish-patterns.jsonl` — the real transition corpus. Same file
  `mineFishPatterns.ts` reads; consider sharing one cast-grouping helper
  between that script and whatever builds the new contextual map, rather
  than writing a second grouping implementation.

Codex's leave-one-cast-out evaluation (49 clean casts / 165 transitions,
the corrupted resumed sequence from CODEXREVIEW #5 excluded) found:

| Predictor | Held-out next-cell top-1 accuracy | Feature coverage |
| --- | ---: | ---: |
| Current cell only | 16.4% | 100.0% |
| Current cell + turn number | 16.4% | 82.4% |
| Current cell + previous movement direction | 33.9% | 75.2% |
| Current cell + turn + previous direction | 24.2% | 49.1% |

Previous direction more than doubled top-1 accuracy; turn number added
nothing and cost coverage. This is a diagnostic, not a proven catch-rate
gain — card hitboxes consume a full probability distribution, not just
the top-1 cell, so the eventual gate is a simulator catch-rate ablation,
not this table by itself.

**Implementation requirements, per CODEXIMPROVE's spec:**

1. Build the contextual empirical map keyed on
   `${cellKey(from)}|${previousDx},${previousDy}` — group the real corpus
   by `castId` first (reuse `mineFishPatterns.ts`'s existing
   `groupByCast`-style logic rather than re-deriving it), sort each
   cast's transitions by `turn`, and compute each hop's previous
   displacement from the prior hop in the SAME cast. A cast's first
   transition (turn 0) has no previous displacement — it can only ever
   fall back to the cell-only key.
2. Do NOT include `turn` in this first version — Codex's own ablation
   found it added nothing to top-1 accuracy and sharply cut coverage
   (100% → 82.4% → 49.1% as more features stack).
3. Use a hierarchical distributional backoff, most-specific first:
   1. current cell + previous displacement, gated on a minimum
      independent-cast support threshold (pick a small, defensible
      floor — e.g. require at least 2-3 independent casts contributing
      to that key, not just 2-3 raw transitions from possibly-related
      turns in one cast; document whatever threshold you land on and
      why, same as `NEXT_POSITION_OVERRIDE_THRESHOLD`'s existing
      documented-reasoning pattern).
   2. current cell only (today's existing `emptyFallback` behavior,
      unchanged, as the fallback's fallback).
   3. uniform over the grid (today's existing last resort, unchanged).
4. Evaluate with held-out log loss / Brier score in addition to top-1
   accuracy — top-1 alone doesn't capture whether the fuller distribution
   is better calibrated, which is what `chooseCard`'s EV computation
   actually consumes.
5. Keep CASTS, not individual transitions, as the cross-validation unit
   (leave-one-cast-out, matching Codex's own methodology) — splitting on
   transitions would leak information across turns of the same cast.
6. After the offline held-out evaluation looks good, run a catch-rate
   ablation through the existing fishing simulator before calling this
   done — this project's own standing rule (CLAUDE.md, restated in both
   Codex docs) is not to treat simulator output as live evidence until
   it's calibrated in the same domain, so frame the simulator result as
   "does this look like a real improvement in the model that already
   exists," not as a live catch-rate promise.
7. Add regression tests: a synthetic multi-cast corpus where previous
   direction is genuinely predictive vs. one where it isn't (contextual
   backoff should only fire when it has support); a turn-0 transition
   correctly skips straight to the cell-only tier; the existing
   cell-only/uniform fallback tiers stay byte-for-byte unchanged when the
   new context tier has zero matching support (no regression to
   CODEXREVIEW #5's already-fixed resumed-cast/duplicate-trajectory
   handling). Route any test-constructed transitions file through an
   isolated temp path per CLAUDE.md's now-explicit rule — this is exactly
   the kind of new fixture-shaped test data the rule was written for.

---

## Your task

1. §1 (CODEXIMPROVE #3, contextual fishing fallback) is the whole scope
   this session — offline cross-validation first, matching Codex's
   reported numbers on the real corpus close enough to trust the
   methodology, THEN the simulator catch-rate ablation, THEN wire it into
   live `liveFishing.ts` only if both clear.
2. Don't start CODEXIMPROVE #4 or #5 this session — both still queued,
   not now, same discipline session 32 used.
3. If the offline cross-validation on the real corpus does NOT reproduce
   numbers in the same ballpark as Codex's table (33.9% vs. 16.4%
   top-1), stop and report that honestly rather than shipping a fallback
   tier that isn't actually earning its complexity — CLAUDE.md §9 applies
   to this brief's inherited numbers exactly as it's applied to every
   other prior claim this project has re-checked.
4. Recap normally, full suite + `tsc` against the final commit as usual.

---

## Queued, not this session

- **CODEXIMPROVE #4** (dungeon charge-reserve continuation value) — tie-
  break carried move charges into leaf/terminal utility scoring first,
  then ablate a small continuation-value term; well-scoped, not urgent.
- **CODEXIMPROVE #5** (boon valuation using real confirmed deltas +
  persisted per-run `playCounts`) — well-scoped, not urgent.
- Task 14 (bot-initiated juiced `start_run`) still BLOCKED on a live
  DevTools capture — still needs a manual juiced run captured whenever
  convenient, not code work.
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends
  the whole session (unchanged since session 25, not re-queued as an
  action item, just still true).
