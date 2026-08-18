# BRIEF — session 32

Session 31 landed clean: 488/488 tests (+9), `tsc` clean. Notably, it
checked two of its own brief's claims before implementing them and found
both wrong: `viem` IS used live (`probe.ts`'s EOA auth path, gated behind
`AUTH_MODE=eoa`) so it was NOT removed; and the claim that
`doc.data.caughtFish` is "never populated" (which session 30 asked to fold
into SPEC-fishing.md) was checked directly against fixtures and found
FALSE — it's reliably populated, session 30's own verification script read
one `.data` level too shallow. Neither got written into the spec as a
result — correct outcome, this is CLAUDE.md §9 working as intended for a
third time. It also found and fixed a live bug as a side effect: three
tests were silently overwriting the real `data/guard-budget.json` (not
gitignored corpus data — the actual dungeon spend ledger) because they
never set an isolated `guardStatePath`. Fixed; file restored; verified
untouched by a full suite run afterward.

Operator notes from that session, not action items: the real dungeon cap
is already 12/12 for today per a dry-run smoke test (server-confirmed, not
bot-caused — nothing to spend there today regardless of what this session
does). Also, an overly broad `rm -f logs/*.jsonl` during cleanup wiped the
gitignored `logs/` directory; nothing canonical lives there, low impact,
just noted for completeness.

This session: the item queued twice now and deliberately not squeezed in
either time — opponent-model persistence — plus a small test-isolation
hygiene pass prompted directly by session 31's `guard-budget.json` bug.

---

## 1. Persist and bootstrap the dungeon opponent model (CODEXIMPROVE #1)

Relevant code: `src/strategy/opponentModel.ts:1-7, 34, 218-227`,
`scripts/liveRun.ts:795-803, 1041`, `scripts/orchestrator.ts:168`.

`OpponentModel` already exposes `toJSON()`/`fromJSON()` specifically for
an I/O-owning caller to persist it, and `SPEC.md` names
`data/opponent-model.json` as the intended location — neither live entry
point actually does this; both construct a blank model every launch.
Predictions stay uniform until 30 observations accumulate for a given
`(enemyId, room)` key, so every restart throws away exactly the evidence
that matters most in deeper, sparser rooms. A long-running orchestrator
session learns within itself, but standalone sessions and new days start
from zero every time.

Implementation requirements, per CODEXIMPROVE's spec:

1. Let the orchestrator/live runner own the I/O; keep `OpponentModel`
   itself pure (no direct file access inside the strategy module — same
   API/strategy separation CLAUDE.md's working-style section already
   requires).
2. Validate and version the serialized schema — a `schemaVersion` field,
   rejected/migrated on mismatch rather than silently misread.
3. Save through a sibling temp file plus atomic rename — same pattern
   already used in `guardPersistence.ts` since session 28's Tier 1 fixes;
   reuse that pattern rather than reinventing it.
4. Prevent concurrent writers — reuse `acquireGuardLock()` or the
   equivalent single-writer discipline from `guardPersistence.ts`, don't
   build a second locking mechanism.
5. Bootstrap once from clean historical dungeon exchanges in the fixture
   corpus, recording an import version or exchange identity so the same
   fixtures can't be double-counted on every future launch.
6. Add restart and corrupt-model regression tests: model persists across a
   simulated restart; a corrupt/malformed file fails closed (per CLAUDE.md
   §5) rather than silently resetting to a blank model — this is the same
   fail-open bug class CODEXREVIEW #2 fixed for guard-budget persistence,
   don't reintroduce it here.

```ts
const model = loadOpponentModel("data/opponent-model.json");

// After each confirmed enemy exchange:
model.observe(modelKey(enemyId, room), foeMove, previousFoeMove);
saveOpponentModelAtomically("data/opponent-model.json", model.toJSON());
```

This is the strongest currently-supported dungeon improvement per Codex's
review: the decision engine already knows how to exploit a learned
distribution, live startup just throws the evidence away every time.

## 2. Test-isolation hygiene (prompted by session 31's guard-budget.json bug)

Two small, related fixes — session 31 found the SAME bug class (a test
writing to a real committed/gitignored path instead of an isolated temp
path) as session 30's `9001`/`9002` corpus pollution, two sessions in a
row, by accident both times rather than by a deliberate check.

1. **Write the rule down.** Add an explicit line to `CLAUDE.md`'s working
   style section: tests must never write to real data paths — anything
   under `data/`, `logs/`, or any file `guardPersistence.ts`/report
   scripts treat as ground truth — always construct an isolated temp
   path for test I/O. This has been the working convention all along but
   was never stated; write it down so a third instance gets caught by a
   reviewer reading the rule, not by accident during unrelated work.
2. **One deliberate grep pass**, not necessarily exhaustive: search the
   repo for `LiveFishingDeps`/`LiveRunDeps` test constructions (and
   `OpponentModel`/`opponent-model.json` once §1 lands) that don't set an
   isolated path, beyond the 3 already-fixed offenders from session 31.
   Report the result honestly either way — "found and fixed N more" or
   "none found, this was the last instance" both count as done; don't
   pad a clean result into something it isn't.

---

## Your task

1. §1 (opponent-model persistence) is the primary work this session — it's
   been queued twice already, give it the room it needs.
2. §2 (test-isolation hygiene) is small — do it, but don't let it crowd
   out §1's regression-test requirements.
3. Don't start CODEXIMPROVE #3/#4/#5 this session — still queued, not now.
4. Recap normally, full suite + tsc against the final commit as usual.

---

## Queued, not this session

- **CODEXIMPROVE #3** (previous-direction contextual fishing fallback) —
  strongest empirical fishing predictor Codex found, needs its own
  cross-validation + simulator ablation pass.
- **CODEXIMPROVE #4** (dungeon charge-reserve tie-breaking) and **#5**
  (boon valuation using real deltas + persisted `playCounts`) — both
  well-scoped, neither urgent.
- Task 14 (bot-initiated juiced `start_run`) still BLOCKED on a live
  DevTools capture — still needs you to do a manual juiced run and capture
  the request whenever convenient, not code work.
