# BRIEF — session 37

Session 36 landed clean and, more importantly, landed HONESTLY: 533/533
tests (+1), `tsc` clean, `git diff --check` clean. It fixed the opponent-
model live-observe double-count bug in both real entry points (one root-
cause fix in shared `runOnce()`, since `orchestrator.ts` calls the same
function `liveRun.ts` does), added the exact regression test the audit
named — and manually confirmed that test actually FAILED against the
reverted pre-fix code before trusting it as a real guard, not just a new
test that happens to pass. It also closed CODEXIMPROVE #5's real remaining
gap (`playCountsPersistence` wired into `orchestrator.ts` too) as a
stretch item, and explicitly flagged what it could NOT verify (no
orchestrator-level test exists, because `main()` isn't structured for unit
testing — said plainly rather than glossed over). `DECISIONS.md` carries a
full, honest correction of session 35's overclaim. This is exactly the
standard this project should hold going forward.

Three real gaps from the independent Codex audit are still open, all
deliberately unattempted last session: CODEXAUDIT #2 (fishing calibration),
#4 (`nextPosition` gate), #5 (durable fsync), plus #6 (schema tightening,
low priority). Session 36's own recap recommended #5 as the next spine —
"the one CODEXREVIEW item that's been open longest and touches all three
persistence modules at once." That reasoning holds up: it's the oldest
unresolved item on either doc (open since session 28), it's mechanical and
contained (one new helper, three call sites), and it protects the guard
budget specifically — the one file whose corruption has real-money
consequences. This session takes that recommendation.

---

## 1. Centralize durable atomic writes with a real fsync (CODEXAUDIT #5)

This finishes CODEXREVIEW #2 for real — CODEXREVIEW #2 asked for "write
sibling temporary file, **flush it**, then atomically rename it" back in
session 28; the temp-file+rename half shipped then, the flush half never
did, across any of the three persistence modules that copied the pattern
since.

Relevant code, confirmed against the current tree — all three are
byte-for-byte the same shape, which is exactly why a shared helper is the
right fix rather than patching each separately:

- `src/orchestrator/guardPersistence.ts:162-168` — `saveGuardBudget()`.
  `mkdirSync` → build `body` → `tmp = ${path}.tmp-${pid}-${Date.now()}-${rand}`
  → `writeFileSync(tmp, json)` → `renameSync(tmp, path)`. No `fsync`
  anywhere in this file.
- `src/orchestrator/opponentModelPersistence.ts:154-168` —
  `saveOpponentModelAtomically()`. Identical shape, confirmed live —
  `writeFileSync` at `:166`, `renameSync` at `:167`.
- `src/orchestrator/playCountsPersistence.ts:128-138` — `savePlayCounts()`.
  Identical shape again — `writeFileSync` at `:136`, `renameSync` at `:137`.

**Implementation, per the audit's own suggested recipe:**

1. Add one new shared helper — a new small module (e.g.
   `src/orchestrator/atomicWrite.ts`) is cleaner than bolting it onto
   `guardPersistence.ts` and having the other two import cross-module;
   your call if there's a better existing home, but don't create a
   circular import between the three persistence modules to get it.
   Signature roughly `atomicWriteJson(path: string, body: unknown): void`:
   1. `mkdirSync(dirname(path), { recursive: true })` (unchanged).
   2. Build the same `${path}.tmp-${pid}-${Date.now()}-${rand}` temp name
      every module already uses — keep it identical, don't invent a new
      naming scheme for this refactor.
   3. Open the temp file (`openSync`), write the JSON (`writeSync`),
      `fsyncSync` it, then `closeSync` it — this is the actual fix; the
      current code's `writeFileSync` never gives you a file descriptor to
      fsync.
   4. `renameSync(tmp, path)`.
   5. Best-effort flush the parent directory too (open the directory,
      `fsyncSync`, close) — wrap this step in its own try/catch, since
      directory-fsync isn't supported on every platform/filesystem, and a
      platform that can't do it shouldn't make the whole write throw.
   6. On any failure before the rename completes, clean up the temp file
      (`rmSync` with `{ force: true }`) before rethrowing, so a failed
      write doesn't leave orphaned `.tmp-*` files behind the way a crash
      already wouldn't have.
2. Replace each of the three modules' inline write blocks with a call to
   this one helper, passing the SAME `body` each already constructs — this
   is a mechanical extraction of the write step only. Don't touch
   `schemaVersion`, the `bootstrapImportedIds` sort, or any other
   module-specific body-construction logic; those stay exactly as they
   are today, in each module.
3. Be honest in tests about what's actually provable. A unit test cannot
   prove a real power-loss survives this — that's not testable in CI. What
   IS testable and worth asserting: the temp file is cleaned up on a
   simulated write failure (e.g. mock `renameSync` to throw, confirm the
   `.tmp-*` file doesn't linger); the existing round-trip/corruption/
   atomic-write tests for all three modules still pass unchanged after the
   refactor (confirms no behavioral regression); and, if practical, a spy
   confirming `fsyncSync` is actually invoked during a real save call
   (confirms the code path exists and runs, which is the concrete claim
   CODEXREVIEW #2 asked for — durability itself is a filesystem/OS
   guarantee this project is trusting, not one it can independently
   verify). State this distinction plainly in the recap rather than
   implying the tests prove durability they can't prove.
4. Double check the `guard-*.json`/`opponent-model.json`/`play-counts-*.json`
   real committed data files aren't touched by any new test — same
   isolated-test-path rule this project wrote into CLAUDE.md after two
   separate real-file-pollution incidents (sessions 30 and 31).

---

## Your task

1. §1 (CODEXAUDIT #5, durable atomic writes) is the whole required scope.
2. If it lands cleanly with time to spare: CODEXAUDIT #6 (opponent-model
   schema too permissive — `CountSchema` should be
   `z.number().int().nonnegative()`, and a transition row's sum shouldn't
   be allowed to exceed its marginal predecessor count) is small and
   low-risk, a reasonable stretch item in the same spirit as session 35's
   step 4 and session 36's #3. Don't let it crowd out §1's test coverage
   or the honesty-about-what's-provable point above.
3. Do NOT attempt CODEXAUDIT #2 (fishing calibration) or #4 (`nextPosition`
   gate) this session — both queued below, both real, neither as
   mechanical or as broadly-leveraged as this session's scope.
4. Recap plainly. If the fsync fix genuinely closes CODEXREVIEW #2, say so
   — but don't declare victory on "durability" itself; say what was
   actually verified (the fsync call happens, temp files clean up on
   failure, no regression) versus what's a filesystem/OS-level guarantee
   this project is trusting rather than independently proving. That
   distinction is exactly the kind of precision session 35's overclaim was
   missing.

---

## Queued, not this session

- **CODEXAUDIT #2** (fishing contextual fallback's log-loss regression) —
  shrink the contextual estimate toward the cell-only distribution
  (mixture weighted by support) instead of hard-switching at
  `minIndependentCasts`. Relevant code: `src/strategy/fishing/
  contextualFallback.ts:169-183`, `scripts/fishingContextualCV.ts:223-247`
  (verify current line numbers on open).
- **CODEXAUDIT #4** (`nextPosition` override gate counts raw hits, not
  hits-out-of-attempts) — needs a real accuracy/confidence-bound gate plus
  schema and grid-bounds validation on the loader. Relevant code:
  `scripts/liveFishing.ts:365, 399-415, 779-795` (verify current line
  numbers on open).
- **QUESTIONS.md §15** (stuck fishing account after an escape) — still
  needs a human DevTools capture, not code. Not re-checked since session
  33; worth a cheap read-only `scripts/checkFishingStuck.ts` look if any
  future session plans a real live fishing cast.
- Task 14 (bot-initiated juiced `start_run`) — still BLOCKED on a live
  DevTools capture, not code work.
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends
  the whole session (unchanged since session 25).
- The charge-reserve plateau (0.4/0.5/0.6, mutually indistinguishable at
  the N run so far) — not urgent.
