# BRIEF — session 28

The user brought in a second reviewer (Codex) for a read-only pass against
commit `f04f5ae`, producing two documents: `CODEXREVIEW` (bugs/safety) and
`CODEXIMPROVE` (performance opportunities). Both are high quality — specific
line numbers, honest about proven vs. speculative, respectful of this
project's fail-closed/regression-test discipline. Full documents available
from the user if needed; this brief carries forward only the parts to act
on this session.

**First, a correction to carry forward:** Codex's review found session 27's
own fishing-corpus counting used the wrong unit (fixture directories/response
docs, not distinct `docId` casts/turns) — see §5 below. This means session
27's "Fintuition REJECTED" conclusion was itself too strong: real counts are
2/169 turns (1.18%), and a binomial test against a 3% base rate doesn't
reject that at n=169 (P≈11.5% under the null). Correct status: **Fintuition
as the `nextPosition` cause remains unconfirmed, not rejected.** Fix the
stats first (§5), the conclusion follows from the corrected numbers.

This session is entirely bug fixes in already-shipped code — no new
capability, no unvalidated performance claims. That's deliberate: these five
are the safety-critical tier out of 16 total findings across both documents;
the rest are queued for later sessions per the reasoning below each item.

---

## 1. Fix JWT redaction — only the first 8 characters are currently stripped

`FixtureWriter` expects a secret-removal function; callers pass
`client.maskedJwt().split("...")[0]` — the truncated display prefix, not the
real token. If any live response ever echoes the bearer token in full, only
those 8 characters get replaced and most of a real credential could land in
a committed "redacted" fixture on this public repo. Hasn't fired yet (no
known response currently echoes the token), but it's cheap to close now and
expensive to discover after the fact. Add `GigaverseClient.redactSecrets(text)` that removes the FULL token internally without ever
returning it to callers. Add a regression test using a response containing
the complete test token, confirm zero characters of it survive redaction.

## 2. Guard persistence: fail closed on corruption, make writes atomic

Currently: malformed existing JSON silently returns a zero budget (fails
OPEN, not closed — direct contradiction of CLAUDE.md's core rule), writes
are a direct overwrite with no atomic rename, and nothing prevents two
concurrent processes from racing past the configured daily budget. Fix:
missing file = first init (fine); a file that EXISTS but fails to parse/
validate throws a `GuardTrip` or dedicated persistence error instead of
silently zeroing. Save via sibling temp file + atomic rename. Add a lock (or
equivalent) across the full load→assert→increment→save sequence, not just
around the write call. Add corruption, interrupted-write, and two-writer
regression tests. Note: `tests/orchestrator/guardPersistence.test.ts`
currently enshrines the UNSAFE behavior as expected — that test needs to
flip, not just gain a new case.

## 3. Orchestrator: guarantee energy accounting on every exit path

Both the dungeon and fishing branches rethrow unexpected errors before
reaching the after-energy read and persistent accounting step. If
`start_run` already spent energy and something fails afterward, a restart
forgets that real spend happened — a fail-closed violation by omission.
`liveRun.ts`/`liveFishing.ts` already have the correct pattern (capture
error → always account/persist → rethrow original error) — port that
structure into `orchestrator.ts`'s two branches. Add a test for each mode:
runner starts successfully, then throws — confirm accounting still runs.

## 4. `getDungeonState()`: stop converting every 5xx into "no active run"

A transient server outage currently reads identically to a genuinely idle
account. Worse: after a failed action POST, `postWithVerifiedRetry()` sees
the state-read 5xx as null, concludes the action isn't pending anymore, and
can report it as applied when it wasn't — risking an abandoned or
duplicated run. Fix: treat 5xx as `UnexpectedResponseError` by default. If
the historical "ended run returns 500" behavior needs to keep working,
retry the read and only return null on the authoritative HTTP-200
`data.run:null` shape or a narrowly verified idle signature — never on a
bare server failure. Add a test: failed POST followed by a transient 500 on
the state read must halt, not report the action as applied.
`tests/api/client.test.ts:70-77` currently enshrines the blanket behavior —
same note as §2, flip it rather than just adding around it.

## 5. Correct the fishing corpus unit error and its downstream conclusions

Direct recount by `docId` (not fixture directories): 30 committed
directories, **50 distinct casts, 225 response documents, 169 actual
card-play turns, 7 catches (14%)**. Focus changed within 48/50 casts, not
29/30. `nextPosition` fired non-null in 2/169 turns (1.18%), not 2/225
(0.89%). Fix:

1. `FixtureWriter`: construct a new one per cast inside the CLI loop (or
   rename the current abstraction to session/batch level with per-`docId`
   subdirectories) — directories currently don't correspond to casts 1:1.
2. Add one canonical fishing-corpus loader that groups response documents
   by `docId` and distinguishes `start_run`/`play_cards`/`loot`. All future
   audits should use this loader, not directory or raw file counts.
3. Correct the session-26/27 claims in `STATE.md`, `QUESTIONS.md`,
   `DECISIONS.md` — keep "focus movement is genuinely active" (that
   conclusion holds), revise Fintuition to "compatible but unconfirmed,"
   not "rejected."
4. Add a regression test: one `--casts=2` invocation should produce
   fixtures that the new loader correctly counts as 2 casts.

---

## Your task

1. Implement §1-5 in order, each with its own regression tests, per the
   project's existing standard (tsc clean, full suite green, before
   declaring any one done).
2. Two existing tests currently enshrine unsafe/wrong behavior
   (`guardPersistence.test.ts`'s corrupt-file case, `client.test.ts`'s
   blanket-5xx case) — update what they assert, don't just add alongside.
3. Correct the STATE.md/QUESTIONS.md/DECISIONS.md fishing-corpus numbers
   and the Fintuition conclusion per §5.3.
4. Recap normally. Note in the recap which of Tier 2/3 (full lists in
   `CODEXREVIEW`/`CODEXIMPROVE`, available from the user) seem worth
   queuing next, but don't start them this session.
