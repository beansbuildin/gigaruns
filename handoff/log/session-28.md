# Session 28 — 2026-08-18

Brief: `handoff/next.md` (session-28 brief) — implement the five
safety-critical items from a second reviewer's (Codex) read-only review of
commit `dedbe78` (`CODEXREVIEW`, plus `CODEXIMPROVE` for a separate
performance-opportunity pass, both now committed to the repo root), and
correct session 27's fishing-corpus stats/Fintuition conclusion, which
Codex's review found used the wrong counting unit.

No TASKS.md gate targeted. This was entirely bug fixes in already-shipped
code, deliberately scoped that way by the brief ("no new capability, no
unvalidated performance claims").

## §1 — JWT redaction (CODEXREVIEW #7)

**Finding:** `FixtureWriter` (both `scripts/liveRun.ts` and
`scripts/liveFishing.ts`) expected a secret-removal function but every
caller passed `client.maskedJwt().split("...")[0]` — the truncated 8-char
DISPLAY prefix, not the real token. If any live response ever echoed the
bearer token in full, only 8 characters would have been redacted and most
of a real credential could have landed in a committed "redacted" fixture
on this public repo. Hadn't fired yet (no known response echoes the
token), but cheap to close now.

**Fix:** `GigaverseClient.redactSecrets(text: string): string` (new,
`src/api/client.ts`) — `text.split(this.jwt).join("<JWT>")`. The real jwt
stays private to the client instance; the method never returns it, only
uses it internally. `FixtureWriter`'s constructor now takes a
`redactSecrets: (text: string) => string` instead of a raw jwt string;
every call site (`liveRun.ts`, `liveFishing.ts`, `orchestrator.ts` ×2)
updated to `(text) => client.redactSecrets(text)`.

**Test:** `tests/api/client.test.ts`'s new `describe("redactSecrets")` —
a synthetic 300+ character test token embedded in a fake echoed response,
asserts zero characters of it (not just the display prefix) survive
redaction, plus a no-op case.

## §2 — Guard persistence (CODEXREVIEW #2)

**Finding:** three separate problems in `src/orchestrator/
guardPersistence.ts`:
1. `loadGuardBudget` treated a genuinely CORRUPT existing file (bad JSON,
   wrong shape) identically to "nothing on disk yet" — silently returning
   a zero seed. This fails OPEN, the opposite of CLAUDE.md §5: a corrupted
   record of real spend gets forgotten and a restart can spend right past
   the real daily budget.
2. `saveGuardBudget` did a direct `writeFileSync` on the real path — no
   atomicity, so a crash mid-write could leave a truncated/corrupt file.
3. Nothing prevented two live processes from both loading the same seed,
   both passing their guards, and overwriting each other's update.

**Fix:**
1. A MISSING file still returns `{0,0}` (legitimate first-init). An
   EXISTING file that fails `JSON.parse` or the zod shape check now throws
   `GuardPersistenceError` (new class).
2. `saveGuardBudget` now writes to a sibling temp file
   (`${path}.tmp-${pid}-${timestamp}-${random}`) and `renameSync`s it into
   place — atomic on the same filesystem.
3. New `acquireGuardLock(path)`: exclusive `wx`-flag lockfile
   (`${path}.lock`) held for the WHOLE PROCESS LIFETIME, not just around
   one write — chosen over a narrower per-transaction lock because the
   real load→assert→increment→save sequence isn't contiguous in this
   codebase (assert happens in memory, the save happens after a whole
   dungeon run's worth of network calls). A lockfile from a crashed
   process (PID no longer alive, checked via `process.kill(pid, 0)`) is
   reclaimed automatically rather than requiring manual cleanup. Wired
   into `liveRun.ts`/`liveFishing.ts`/`orchestrator.ts`'s `main()` via
   `process.once("exit", acquireGuardLock(path))` (orchestrator acquires
   BOTH the dungeon and fishing locks, since it manages both files).

**Tests:** `tests/orchestrator/guardPersistence.test.ts` — the corrupt-JSON
case FLIPPED from "returns zero seed" to "throws GuardPersistenceError"
(per the brief's explicit instruction to flip, not just add alongside),
plus a new wrong-shape case, an atomic-write test (no `.tmp-*` leftover
after a clean save), and four `acquireGuardLock` tests (clean acquire/
release, refuses concurrent acquire, reclaims a stale lock from a dead
PID, release is idempotent).

## §3 — Orchestrator accounting on every exit path (CODEXREVIEW #3)

**Finding:** both `scripts/orchestrator.ts` branches (dungeon and fishing)
`throw e` for any non-budget error BEFORE reaching the after-energy-read/
`saveGuardBudget` call below the try/catch. If `start_run` (or fishing's
start action) had already spent real energy and something failed
afterward — an unexpected response shape, a genuine anomaly — the restart
forgot that real spend ever happened. `liveRun.ts`/`liveFishing.ts`
already had the correct shape (capture error → always account → rethrow
last); `orchestrator.ts` didn't.

**Fix:** extracted the correct shape into
`src/orchestrator/runWithAccounting.ts`'s `runWithGuaranteedAccounting()`
— runs `action`, and UNCONDITIONALLY runs `account` before ever letting an
anomaly propagate; a recognized budget trip is swallowed after
`onBudgetTrip` runs. Both `orchestrator.ts` branches now go through this
one function instead of two independent (and, it turned out, buggy)
try/catch copies.

**Tests:** `tests/orchestrator/runWithAccounting.test.ts` — clean success,
budget-trip swallowed (both "dungeon mode" and "fishing mode" reason
strings, same `isBudgetGuardTrip` contract), the actual regression (a
runner that starts successfully then throws a genuine anomaly — accounting
still runs, THEN the original error rethrows), an unrecognized GuardTrip
reason treated as an anomaly not silently swallowed, and an explicit
ordering assertion (action → account → rethrow).

## §4 — `getDungeonState()` 5xx handling (CODEXREVIEW #4)

**Finding:** `src/api/client.ts`'s `getDungeonState()` converted EVERY 5xx
into "no active run" (`return null`). This conflated two different things:
the historical "a run that just ended returns an HTML 500" shape (session
08) and a genuine transient server outage — indistinguishable under the
old rule. Worse: after a failed action POST, `postWithVerifiedRetry()`
(`scripts/liveRun.ts`) reads a null state-check as "the action is no
longer pending" and can report it as applied when it never did — risking
an abandoned or duplicated run on nothing more than a blip.

**Fix:** split into `getDungeonStateOnce()` (one read attempt, returns
`{kind:"5xx"}` on a server failure instead of `null`) and
`getDungeonState()` (calls it up to twice — the existing rate limiter
already spaces the two calls by the usual 1200ms+jitter gap, no extra
delay needed — and only reads as idle if EITHER attempt reaches the
authoritative HTTP-200 shape; a SECOND consecutive 5xx now throws
`UnexpectedResponseError`).

**Tests:** `tests/api/client.test.ts` — the enshrined blanket-5xx test
FLIPPED (persistent 5xx now expects a throw, not `resolves.toBeNull()`),
plus two new tests (5xx-then-200-idle resolves null, 5xx-then-200-run
resolves the run). `tests/liveRun.test.ts`'s `postWithVerifiedRetry`
describe block gained the brief's specifically-requested case: a failed
POST followed by a PERSISTENT state 500 now rejects with
`UnexpectedResponseError` rather than silently returning null (which
would previously have read as "applied despite the error").

## §5 — Fishing corpus unit error (CODEXREVIEW #1, CODEXIMPROVE evidence
base)

**Finding:** session 26/27's fishing-corpus audits counted fixture
DIRECTORIES (30) and raw response-document FILES (225) as if they were
casts and turns. They aren't: `scripts/liveFishing.ts`'s `main()`
constructed ONE `FixtureWriter` outside its `--casts=N` loop and reused it
across every cast in the invocation, so a multi-cast invocation's fixtures
all landed in one directory. Direct recount by the real stable identity
(`data.doc.docId`) found: **50 distinct casts, 225 response documents,
169 actual `play_cards` turns, 7 caught casts (14%)**. The
`nextPosition`-firing rate is 2/169 = 1.18%, not 2/225 = 0.89% as session
27 computed — and at n=169 a binomial test against the stated 3%
Fintuition base rate does NOT reject (P≈11.5%), so "compatible with 3%,
unconfirmed" is the correct read, not "the numbers argue against it."

**Fix:**
1. `scripts/liveFishing.ts`: `FixtureWriter`'s constructor now takes an
   optional `root` parameter (default unchanged); `main()`'s per-cast loop
   now constructs a FRESH `FixtureWriter` each iteration instead of one
   reused across the whole invocation.
2. New `src/sim/fishingCorpus.ts` — the canonical loader.
   `loadFishingCorpus(root)` walks every `state-*.json` under `root`
   (skipping `raw/` and non-response fixtures like `cards.json`/
   `cast.json`/`*.har`), groups by `data.doc.docId`, classifies each
   response's action kind by its `message` field (`"Game started
   successfully."` → start_run, `"Cards played successfully."` →
   play_cards, `"Card added to deck successfully."` → loot — confirmed
   these three strings cover the entire real corpus, nothing classified
   `"unknown"`). `summarizeFishingCorpus()` turns a loaded corpus into the
   headline numbers.
3. Verified directly against the real committed corpus
   (`npx tsx -e "...loadFishingCorpus()..."`): reproduces CODEXREVIEW's
   50/225/169/7/43/0 exactly.
4. Corrected `handoff/STATE.md` (both the live version and the version
   inline in this recap), `QUESTIONS.md §12` (new session-28 addendum
   appended, not editing the session-27 prose in place), and
   `handoff/DECISIONS.md` (new 2026-08-18 append-only entry, correcting
   the 2026-08-17 session-27 entry per the file's own append-only rule —
   never edit/delete a prior line).

**Tests:** `tests/sim/fishingCorpus.test.ts` — two real-corpus assertions
(exact 50/225/169/7/43/0 reproduction, every cast has a start_run) and the
brief's specifically-requested synthetic regression: a real
`GigaverseClient` + real `runOneCast` + real `FixtureWriter` (mocked
`fetch`, two synthetic docIds `9001`/`9002`) run through a manual two-
iteration loop mirroring `main()`'s per-cast-fresh-writer shape, then
`loadFishingCorpus()` against the resulting tmp-dir tree confirms exactly
2 casts, each with exactly one start_run and one play_cards response.

## Verification

`npx tsc --noEmit`: clean.
`npx vitest run`: **428/428 passing** (up from 408/408 at session 27's
final commit — +20 new tests this session, 0 removed, 2 enshrined-wrong
tests flipped in place per the brief's explicit instruction).
Verified against this session's actual final working tree, not a
mid-session snapshot.

## Dead ends

None — every CODEXREVIEW item attempted (all 5 assigned) landed cleanly on
the first implementation. No approach was tried and abandoned this
session.

## Not started (explicitly, per the brief's own instruction)

Tier 2/3 items from both documents — CODEXREVIEW #5 (resumed-cast
transition-numbering bug, arguably should have been Tier 1 given it's a
DEMONSTRATED bug — cast `12923189` genuinely has two turn-0 transitions
from two different process runs), #6 (reconcile server-side daily caps as
scheduling state), #8 (split committed-vs-observed energy accounting), #9
(CLAUDE.md §8 wording vs `pickLowestTier`), #10 (unused `viem` dependency);
CODEXIMPROVE #1 (persist/bootstrap the dungeon opponent model — has
`toJSON`/`fromJSON` but no production caller), #2 (fishing tie-break
resource-conservation), #3 (contextual fishing fallback using previous
movement direction), #4 (charge-reserve continuation value), #5 (boon
valuation using confirmed deltas), #6 (`nextPosition` validation-only
mode). See STATE.md's Open Questions for a priority read on which of these
seem worth queuing next.
