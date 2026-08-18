# STATE — session 28 — 2026-08-18 — commit (pending, see below)

## Status
No TASKS.md gate was targeted this session — the session-28 brief was five
safety-critical bug fixes from a second reviewer's (Codex) read-only pass
against commit `f04f5ae` (`CODEXREVIEW`/`CODEXIMPROVE`, both now committed
to the repo root), plus correcting session 27's fishing-corpus stats. **Task
10 stays the last GATE PASS** (session 25, unchanged); this session touched
none of that path. All five CODEXREVIEW items (#1 JWT redaction, #2 guard
persistence, #3 orchestrator accounting, #4 dungeon-state 5xx, #5 fishing
corpus unit error) are implemented with regression tests, per the brief's
own instruction not to start Tier 2/3 items this session (see Open
questions for what's queued next).
Next per TASKS.md: unchanged from session 27 — Task 13's data floor, Task
14 BLOCKED, Task 11 dungeon half PARKED. This session did no live play (no
casts, no runs) — pure bug-fix and documentation-correction session.

## What works
- **`GigaverseClient.redactSecrets(text)`** — strips the FULL jwt, never
  returns it. `FixtureWriter` (both dungeon and fishing) now takes a
  redaction function instead of the old `maskedJwt().split("...")[0]` (an
  8-char display prefix, not the real token) — verified by a regression
  test asserting zero characters of a full synthetic token survive.
- **Guard persistence fails closed on corruption** — an existing-but-
  corrupt `data/guard-budget*.json` now throws `GuardPersistenceError`
  instead of silently returning a zero seed (which used to let a restart
  spend past the real daily budget). Writes go through a sibling temp file
  + atomic rename. `acquireGuardLock()` enforces one live writer per
  guard-state file for the whole process lifetime (reclaims a stale lock
  from a dead PID automatically) — wired into `liveRun.ts`/`liveFishing.ts`/
  `orchestrator.ts`'s `main()` via `process.once("exit", ...)`.
- **Orchestrator accounting now guaranteed on every exit path** — both the
  dungeon and fishing branches used to `throw` an anomaly BEFORE the
  after-energy read/`saveGuardBudget` call, so a real spend from `start_run`
  could go unrecorded if something failed afterward. Extracted the fix into
  a shared, independently-tested `runWithGuaranteedAccounting()`
  (`src/orchestrator/runWithAccounting.ts`) used by both branches.
- **`getDungeonState()` no longer reads a persistent 5xx as idle** — retries
  once (the existing rate limiter already spaces the two calls), and only
  a second consecutive 5xx now throws `UnexpectedResponseError` instead of
  silently returning `null`. Closes the risk where `postWithVerifiedRetry()`
  could report an action as "applied" after a transient server outage.
- **`src/sim/fishingCorpus.ts`** (new) — the canonical fishing-corpus
  loader, groups response documents by `data.doc.docId` instead of trusting
  fixture-directory boundaries. Reproduces CODEXREVIEW's corrected numbers
  exactly against the real committed corpus: **50 distinct casts, 225
  response documents, 169 `play_cards` turns, 7 catches (14%)** — not "30
  casts / 225 turns" as session 26/27 assumed. `scripts/liveFishing.ts`'s
  `main()` now constructs a fresh `FixtureWriter` per cast (previously one
  writer reused across an entire `--casts=N` invocation) so directories and
  casts stay 1:1 going forward.

## What's broken
Nothing newly broken by this session's changes — 428/428 tests pass (up
from 408/408 at session 27 start), `npx tsc --noEmit` clean. Unchanged,
pre-existing open items:
- Fishing's real daily-reset boundary is still not known (QUESTIONS.md
  §13, from session 27) — not investigated this session.
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends the
  whole session (unchanged since session 25).

## Corrections to SPEC.md
- None to SPEC.md/SPEC-fishing.md this session.
- **Correction to session 27's STATE.md/QUESTIONS.md/DECISIONS.md, per
  Codex review (`CODEXREVIEW` #1):** session 27's fishing-corpus counts used
  fixture DIRECTORIES and raw response-document FILES as if they were casts
  and turns. Direct recount by `docId`: **50 distinct casts** (not 30),
  **225 response documents** (unchanged), **169 actual `play_cards` turns**
  (not "225 turns"), **7 catches / 14%** (not 4/30 ≈ 13.3%), focus point
  changed within **48/50 casts** (not 29/30). The `nextPosition`-firing rate
  is **2/169 = 1.18%**, not 2/225 = 0.89% — and at n=169 a binomial test
  against the stated 3% Fintuition base rate does NOT reject (P≈11.5%).
  **Session 27's "Fintuition-as-cause not confirmed" conclusion survives,
  but session 27's own STATE.md separately called it "REJECTED," which
  overstates what the corrected numbers support — corrected status is
  UNCONFIRMED, not rejected**: this project's data cannot yet confirm OR
  refute the hypothesis, only that it hasn't been confirmed. Full
  derivation: QUESTIONS.md §12's session-28 addendum, DECISIONS.md
  2026-08-18 (session 28).
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
None this session — every CODEXREVIEW item attempted landed.

## Metrics
- No live play this session (no dungeon runs, no fishing casts) — pure
  bug-fix/doc-correction session, consistent with the brief's own scope
  ("entirely bug fixes in already-shipped code — no new capability").
- Tests: 428/428 passing (+20 new regression tests: redactSecrets ×2,
  guardPersistence corruption/atomic-write/lock ×8, runWithAccounting ×6,
  client.ts 5xx-retry ×2 net, postWithVerifiedRetry persistent-5xx ×1,
  fishingCorpus ×3). `npx tsc --noEmit` clean, verified against this
  session's final commit (not a stale in-session check).
- Real fishing corpus (corrected units, via `loadFishingCorpus()`): 50
  casts / 225 response docs / 169 play turns / 7 caught (14%) / 43 escaped
  / 0 incomplete.

## Open questions for Claude
1. Which CODEXREVIEW/CODEXIMPROVE Tier 2/3 items are worth queuing next?
   Both documents are now committed to the repo root (`CODEXREVIEW`,
   `CODEXIMPROVE`) for direct reference. Candidates not started this
   session, in rough priority order: (a) CODEXREVIEW #5 — resumed fishing
   casts reset transition numbering and can promote false patterns (cast
   `12923189` has two turn-0 transitions ~5 min apart from two process
   runs — a real, demonstrated bug, arguably should have been Tier 1); (b)
   CODEXREVIEW #6 — reconcile server-side daily caps as real scheduling
   state instead of just printing drift; (c) CODEXIMPROVE #1 — persist and
   bootstrap the dungeon opponent model (`OpponentModel.toJSON()`/
   `fromJSON()` exist but have no production caller — every live process
   starts learning from zero); (d) CODEXIMPROVE #2 — resource-conserving
   fishing tie-breaks (equal-EV choices should prefer the nearer focus
   cell); (e) CODEXREVIEW #8 — split committed-vs-observed energy
   accounting (regen/external top-ups can mask real spend). Lower priority:
   CODEXREVIEW #7 (JWT redaction — DONE this session, listed here only
   because it's now closed), #9/#10 (docs/dependency cleanup).
2. Unchanged from session 27: fishing's real daily-reset boundary
   (QUESTIONS.md §13) is still unknown — worth asking the user directly.
3. `acquireGuardLock()` is new this session and only smoke-level exercised
   against a real `liveRun.ts`/`liveFishing.ts`/`orchestrator.ts` process —
   unit-tested thoroughly but not yet live-verified that two real
   concurrent invocations actually collide as designed. Worth a deliberate
   two-terminal live check next time either script runs, not urgent enough
   to block on.

## Files changed
```
$ git diff --cached --stat
 CODEXIMPROVE                                  |  296 ++++++++++
 CODEXREVIEW                                   |  261 +++++++++
 QUESTIONS.md                                  |   45 ++
 handoff/DECISIONS.md                          |    2 +
 handoff/STATE.md                              |   36 +-
 scripts/liveFishing.ts                        |   47 +-
 scripts/liveRun.ts                            |   19 +-
 scripts/orchestrator.ts                       |   68 ++-
 src/api/client.ts                             |   57 ++-
 src/orchestrator/guardPersistence.ts          |  113 +++-
 src/orchestrator/runWithAccounting.ts         |   50 ++
 src/sim/fishingCorpus.ts                      |  144 +++++
 tests/api/client.test.ts                      |   66 ++-
 tests/liveRun.test.ts                         |   27 +-
 tests/orchestrator/guardPersistence.test.ts   |   60 ++-
 tests/orchestrator/runWithAccounting.test.ts  |  112 ++++
 tests/sim/fishingCorpus.test.ts               |  188 +++++++
 17 files changed, 1612 insertions(+), 98 deletions(-)
```
