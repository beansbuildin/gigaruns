# BRIEF — session 36

Session 35 self-assessed a GATE PASS and claimed both Codex docs' entire
backlog was closed. An independent follow-up audit (`CODEXAUDIT`, run
against the actual `origin/main` commit `b8ecd83`, 532/532 tests / `tsc` /
`git diff --check` all independently re-verified passing) found that claim
does **not** fully hold. This session starts by correcting the record, then
fixes the one item the audit rates a genuine correctness defect.

---

## The claim didn't fully hold — cross-referenced against the live code

I re-checked the audit's two most consequential findings directly against
the current tree before trusting them (same discipline this project has
always applied to Codex's own claims):

- **CODEXIMPROVE #1 (opponent-model persistence) has a real regression,
  confirmed live.** `scripts/liveRun.ts:832` calls `model.observe()` on
  every live exchange and immediately saves via
  `saveOpponentModelAtomically()` at `:839-841` — but nothing adds that
  exchange's identity to `deps.opponentModelPersistence.bootstrapImportedIds`
  before or after the save. `src/orchestrator/opponentModelPersistence.ts`'s
  `bootstrapFromCorpus()` (`:207-220`) gates purely on membership in that
  same set. So: play live, observe an exchange, save — then restart, and
  `bootstrapFromCorpus()` finds the fixture `fixtures.write()` already
  wrote for that same exchange, sees its ID absent from
  `bootstrapImportedIds` (nothing ever added it), and imports it again.
  Every live observation this feature was built to persist gets double
  counted on the very next restart. This is real, not a false positive.
- **CODEXIMPROVE #5's orchestrator half is genuinely missing.**
  `playCountsPersistence` is wired into `scripts/liveRun.ts`'s `runOnce()`
  exactly as session 35's STATE.md described — but session 35's own status
  line ("this closes CODEXIMPROVE's entire backlog") overstated it:
  `scripts/orchestrator.ts`, the primary unattended long-running entry
  point, never acquires the play-counts lock or passes
  `playCountsPersistence` into its own `runOnce()` call. An orchestrator
  session interrupted mid-run and resumed forgets every move played before
  the restart — exactly the resume gap CODEXIMPROVE #5 was written to
  close, still open in the entry point that matters most for it.

Full picture, cross-referencing the audit against both original Codex docs:

**CODEXREVIEW**: 1, 3-9 hold. **2 is only partial** — atomic temp-file+
rename is in place (confirmed: `guardPersistence.ts:166-167`,
`writeFileSync`+`renameSync`, no `fsync` anywhere in the file), but
CODEXREVIEW #2 explicitly asked for "write sibling temporary file, **flush
it**, then atomically rename it" — the flush step was never added, so a
power loss or filesystem crash (not just a process crash) can still lose a
supposedly-committed guard-budget write. 10 remains correctly resolved
not-applicable.

**CODEXIMPROVE**: 2 and 4 hold. **1 has the live-observe double-count bug
above.** **3 (contextual fishing fallback)** shipped with a real, previously
un-flagged calibration cost: leave-one-cast-out log loss got WORSE at the
shipped threshold (6.151 vs. the cell-only baseline's 5.860), because the
tier hard-switches to a raw empirical distribution after only 3 casts,
assigning exactly zero probability to any cell not in that thin sample —
`chooseCard()` consumes the whole distribution, not just top-1, so this can
aim focus away from plausible cells even while the top-1 metric looks
better. **5's boon-scoring half is solid; its orchestrator persistence half
is not**, per above. **6 (`nextPosition` override gate)** counts only hits
(`confirmedHitCount()`), not hits-out-of-attempts — ten hits and ninety
misses would still satisfy the threshold and flip on a one-hot override
that's actually right 10% of the time; the loader also skips schema/
grid-bounds validation.

---

## 1. Fix opponent-model live-observe double-counting (CODEXAUDIT #1, HIGH)

This is the session's primary and only required scope — a real correctness
defect actively biasing the model this project's decision engine already
trusts, not a documentation gap.

Relevant code, confirmed against the current tree:

- `src/orchestrator/opponentModelPersistence.ts:207-220` —
  `bootstrapFromCorpus()`, gated purely on `bootstrapImportedIds`.
- `scripts/liveRun.ts:832, 839-841` — the live-observe-and-save call site;
  confirmed it never touches `bootstrapImportedIds`.
- `scripts/liveRun.ts:1106-1133` — the startup path that loads the model,
  loads/creates `bootstrapImportedIds`, and runs the initial bootstrap; the
  live-observe fix needs to write into the SAME set this path persists,
  not a second one.
- `scripts/orchestrator.ts:189-195` — the equivalent startup wiring on the
  orchestrator side; verify current line numbers on open (this file has
  been touched by several sessions since the audit's review commit).
- `scripts/liveRun.ts:302-317` — `FixtureWriter`, whose `write()` currently
  returns `void`. The identity needed (`${run}::${label}`) can't be built
  by the live-observe call site today because nothing tells it what
  filename/label the fixture it just wrote actually got.

**Implementation, per the audit's suggested fix:**

1. Replace the bootstrap-only `bootstrapImportedIds` set with a single
   unified ledger of every observed exchange ID — live-observed AND
   corpus-imported both mark the same set, so either path seeing an ID
   already present is a no-op. Don't build a second, parallel tracking
   structure; there is exactly one question ("has this exchange already
   been folded into the model") and it should have one answer.
2. Give `FixtureWriter.write()` a way to report what it just wrote —
   returning the run/label identity (or enough to construct it the same
   way `collectBootstrapObservations`/`exchanges()` in `src/sim/corpus.ts`
   already does for corpus replay) so the live call site can compute the
   exact same `${run}::${label}` key bootstrap uses. Reuse that existing
   derivation rather than inventing a second identity scheme that could
   drift out of sync with it.
3. At the live-observe call site (`liveRun.ts:832-841`): compute the
   exchange's identity, check it against the unified ledger before calling
   `model.observe()`, add it to the ledger, and save — mirroring the
   pattern the audit's snippet shows. Order matters: mark-then-save (or an
   equivalent atomic-enough sequencing) so a crash between observe and mark
   can't reopen the same gap from the other direction.
4. Add the regression test the audit names explicitly: live observe → save
   → simulated restart → corpus bootstrap of that same now-on-disk fixture
   → observation count for that `(enemyId, room)` key is UNCHANGED, not
   doubled. Also add the inverse sanity check: a genuinely new corpus
   exchange (never seen live this process) still imports normally.
5. Do this for BOTH real entry points, `liveRun.ts` and `orchestrator.ts` —
   this is exactly the class of gap that let CODEXIMPROVE #5's
   orchestrator half go unwired last session while `liveRun.ts`'s half
   looked complete. Before calling this done, grep both files for every
   call site that constructs or threads `bootstrapImportedIds`/the new
   unified ledger, not just the one this session happens to be looking at.

---

## Required this session regardless of scope: correct the record

Add a `DECISIONS.md` entry, same format and honesty standard as every
prior self-correction in this project's history (e.g. session 31's viem
correction, session 28's fishing-corpus-unit correction): session 35's
STATE.md claim that "both Codex docs' standing backlog is now fully
closed" is corrected by an independent audit — CODEXREVIEW #2 is partial
(no durable flush), and CODEXIMPROVE #1, #3, #5 (orchestrator half), and #6
each have a material gap, detailed above. Don't hand-edit session 35's own
STATE.md; let this session's STATE.md carry the correction forward, per
this project's existing convention.

Also worth naming plainly, once, as a process note rather than blame: the
last several sessions' GATE PASS self-assessments checked the code paths
each session's own brief and tests happened to exercise, not every real
entry point a fix was supposed to cover. That's how #5's orchestrator half
and #1's live-observe path both went unchecked while their sibling paths
looked done. Going forward, before this project declares a Codex item
fully resolved, grep every entry point that's supposed to use the changed
code — not just the one path the session's own smoke test touched.

---

## Your task

1. §1 (CODEXAUDIT #1, opponent-model double-count) is the required scope —
   fix it in BOTH `liveRun.ts` and `orchestrator.ts`, with the regression
   test named above.
2. Write the `DECISIONS.md` correction entry described above — this is not
   optional busywork, it's this project's own standing discipline for a
   corrected prior claim.
3. If time remains after §1 is fully tested: CODEXAUDIT #3 (wire
   `playCountsPersistence` into `scripts/orchestrator.ts`, closing
   CODEXIMPROVE #5's actual remaining gap) is small and self-contained —
   take it as a stretch item, same spirit as session 35's own optional
   step 4, but don't let it crowd out §1's regression coverage or the
   correction entry.
4. Do NOT attempt CODEXAUDIT #2 (fishing shrinkage), #4 (`nextPosition`
   gate fix), #5 (durable fsync across all three persistence modules), or
   #6 (schema tightening) this session — all queued below, all real, none
   as urgent as an active double-counting bug in live-trusted data.
5. Recap honestly. If §1's fix doesn't fully close the gap in one session,
   say so and leave the rest queued — this project already has one
   overclaimed GATE PASS to correct; don't produce a second one in the act
   of fixing the first.

---

## Queued, not this session

- **CODEXAUDIT #2** (fishing contextual fallback's log-loss regression) —
  shrink the contextual estimate toward the cell-only distribution
  (mixture weighted by support, e.g. `n / (n + shrinkageK)`) instead of
  hard-switching to a raw empirical distribution at `minIndependentCasts`.
  Select `shrinkageK` by held-out log loss/Brier, same discipline session
  33 already used once. Relevant code: `src/strategy/fishing/
  contextualFallback.ts:169-183`, `scripts/fishingContextualCV.ts:223-247`,
  `scripts/fishingContextualAblation.ts:38-92` (verify line numbers on
  open).
- **CODEXAUDIT #4** (`nextPosition` override gate) — `confirmedHitCount()`
  needs to require every recent validation to be a hit within the window
  (or a real accuracy threshold with a confidence bound), not just ten
  cumulative hits regardless of interleaved misses; also add schema and
  grid-bounds validation to the loader. Relevant code:
  `scripts/liveFishing.ts:365, 399-415, 779-795` (verify line numbers on
  open — this file has shifted since session 33/34's fishing work).
- **CODEXAUDIT #5** (durable atomic writes) — centralize a shared
  `atomicWriteJson()` helper (write temp, `fsyncSync`, close, rename,
  flush parent dir where supported, clean up temp on failure) and have
  `guardPersistence.ts`, `opponentModelPersistence.ts`, and
  `playCountsPersistence.ts` all route through it instead of each calling
  `writeFileSync`+`renameSync` directly. This completes CODEXREVIEW #2 for
  real.
- **CODEXAUDIT #6** (opponent-model schema too permissive) — tighten
  `CountSchema` to `z.number().int().nonnegative()` and validate that a
  transition row's sum can't exceed its marginal predecessor count. Low
  priority, cheap, do after the above.
- **QUESTIONS.md §15** (stuck fishing account after an escape) — still
  needs a human DevTools capture, not code.
- Task 14 (bot-initiated juiced `start_run`) — still BLOCKED on a live
  DevTools capture, not code work.
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends
  the whole session (unchanged since session 25).
- The charge-reserve plateau (0.4/0.5/0.6, mutually indistinguishable at
  the N run so far) — not urgent.
