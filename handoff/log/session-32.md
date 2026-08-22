# Session 32 — 2026-08-18 — commit 3a0e877

Brief: `handoff/next.md` at session start — CODEXIMPROVE #1 (persist and
bootstrap the dungeon opponent model, queued twice already, session 30 and
31) as the primary work, plus a small test-isolation hygiene pass (CLAUDE.md
rule + one grep audit) prompted directly by session 31's `guard-budget.json`
leak. No TASKS.md gate targeted, same framing as session 31.

Full content is in STATE.md (kept under the 150-line budget); this log adds
the verbose detail that didn't fit there.

---

## §1 — Opponent-model persistence (CODEXIMPROVE #1)

### Design decisions and why

**Where the code lives.** `src/orchestrator/opponentModelPersistence.ts`,
not inside `src/strategy/opponentModel.ts` — CLAUDE.md's working-style
section requires strategy modules stay free of network/disk I/O, and
`opponentModel.ts`'s own header comment already says `toJSON`/`fromJSON`
exist "so that `data/opponent-model.json` can improve across sessions
without this module ever knowing a file exists." The only concession made
to `opponentModel.ts` itself was exporting its previously-internal `Counts`
interface (just adding the `export` keyword) so the persistence module's
zod schema can be typed against the exact shape `toJSON`/`fromJSON` already
use, rather than either duplicating the type or using `any`. This is a
type-only export — no capability was added, so it doesn't compromise the
"no I/O" contract the brief asked to preserve.

**Reusing guardPersistence.ts's patterns, not inventing new ones.** The
brief was explicit about this (requirements 2-4), and it was the right
call — every mechanism guardPersistence.ts already has was directly
applicable:
- Schema validation: `PersistedGuardBudgetSchema` (zod object, `safeParse`,
  throw a typed error on failure) became `PersistedOpponentModelSchema`,
  same shape of code. The one addition beyond guard-budget's schema is
  `schemaVersion: z.literal(OPPONENT_MODEL_SCHEMA_VERSION)` — guard-budget
  has no schema version field at all (it's small enough that a shape
  mismatch alone has always been enough signal), but CODEXIMPROVE #1's
  requirement 2 asked for it explicitly, so the model file gets it even
  though guard-budget doesn't.
- Atomic save: byte-for-byte the same temp-file+`renameSync` pattern
  (`${path}.tmp-${pid}-${Date.now()}-${random}` then rename).
- Locking: **reused `acquireGuardLock` directly**, called against the
  model's own path (`data/opponent-model.json`) rather than the guard
  path. This works because `acquireGuardLock` was already written
  generically — it takes any path and creates `${path}.lock` next to it,
  nothing in its implementation actually assumes it's guard-specific
  beyond variable/error-message naming ("guard lock ... held by process").
  The messages read slightly oddly when triggered against the opponent
  model file (they still say "guard lock"), but this was a deliberate
  trade: the brief explicitly said "reuse `acquireGuardLock()` ... don't
  build a second locking mechanism," and a cosmetic message mismatch is a
  smaller cost than a second lock implementation. Not renamed/generalized
  this session — flagged here in case a future session wants to rename it
  to something path-generic like `acquireExclusiveLock`.

**Bootstrap identity and idempotency.** The brief's requirement 5 asked for
"an import version or exchange identity so the same fixtures can't be
double-counted on every future launch" — read as license to call bootstrap
on *every* launch (not just the very first one ever), since a
launch-scoped dedup set makes that safe even as the corpus grows across
sessions. Concretely:

```ts
const roomOf = (enemyId: string): number =>
  ROOM_ENEMIES.find((p) => p.enemy.id === enemyId)?.room ?? -1;

function collectBootstrapObservations(runs: CorpusRun[]): BootstrapObservation[] {
  // walks exchanges(runs) in recorded order, filtering reasons.length === 0
  // (clean only), resetting prevMove at every run/foeId boundary — the
  // exact same battle-boundary rule src/strategy/policy.ts's
  // onBattleStart() and scripts/liveRun.ts's live loop already apply to
  // real play, so a bootstrapped observation and a live-learned one are
  // evidentially identical, not two different kinds of data.
}
```

Exchange identity is `${run}::${label}` — `Exchange.label` alone
(`state-NNN→state-NNN`) is NOT unique across runs (DECISIONS 2026-08-15,
the exact bug that made `chargeTable.ts`'s old odd-delta count wrong), so
this qualifies it the same way `tests/replay.test.ts` already does for its
own exchange-identity assertions.

An enemy id absent from `ROOM_ENEMIES` (an uncatalogued capture) is skipped
rather than guessing a room number — CLAUDE.md §1, discover don't assume.
No such case was hit live this session (all 64 imported exchanges resolved
to the one catalogued room-1 enemy), so this branch is currently only
unit-implied, not directly observed live.

**Why only clean exchanges, and why that means only room 1 got imported.**
"Clean" here means `Exchange.reasons.length === 0` — no unmodelled
mechanic (rolled stats, uncovered boon, etc.) touching either side, before
or after. This is the same bar `tests/replay.test.ts`'s `cleanFailures`
uses and the same one Task 5's whole strategy gate was measured against.
The brief's own text said "clean historical dungeon exchanges," so this
wasn't a judgment call — but it's worth stating plainly what it produced:
of the corpus's several hundred exchanges (417+ per `replay.test.ts`'s own
floor), only 64 were both clean AND resolved to a catalogued enemy, and
all 64 landed on exactly one `(enemyId, room)` key: `"Enemy Room 63|room1"`.
This matches the project's long-running finding that most of the corpus's
depth (rooms 2-4) carries at least one unmodelled mechanic per capture
(rolled stats being the most common). See STATE.md's open question 2 for
what this implies about when the bootstrap's value at deeper rooms will
actually show up.

### Wiring into the two live entry points

Both `scripts/liveRun.ts`'s `main()` and `scripts/orchestrator.ts`'s
`main()` got the identical three-line pattern at startup, right where the
old `const model = new OpponentModel();` used to sit:

```ts
const { model, bootstrapImportedIds } = loadOpponentModel(DEFAULT_OPPONENT_MODEL_PATH);
const { imported } = bootstrapFromCorpus(model, bootstrapImportedIds);
if (imported > 0) {
  console.log(`  · opponent model: bootstrapped ${imported} new exchange(s) ...`);
  saveOpponentModelAtomically(model, bootstrapImportedIds, DEFAULT_OPPONENT_MODEL_PATH);
}
const opponentModelPersistence = { path: DEFAULT_OPPONENT_MODEL_PATH, bootstrapImportedIds };
```

plus a third `process.once("exit", acquireGuardLock(DEFAULT_OPPONENT_MODEL_PATH))`
line alongside the existing guard-file locks (orchestrator.ts already took
two — dungeon + fishing — so this is its third; liveRun.ts already took
one for its own guard file, so this is its second).

The actual per-observation save lives in exactly one place regardless of
caller — inside `runOnce()` in `scripts/liveRun.ts`, right after the
existing `model.observe(modelKey(foeWire.id, roomNum), foeMove, prevFoeMove)`
call:

```ts
if (deps.opponentModelPersistence) {
  saveOpponentModelAtomically(model, deps.opponentModelPersistence.bootstrapImportedIds, deps.opponentModelPersistence.path);
}
```

This is why `scripts/orchestrator.ts` didn't need its own save call: it
already calls the SAME `runOnce()` for every dungeon iteration
(`scripts/liveRun.ts`'s exported function, not a duplicate), so passing
`opponentModelPersistence` into that one call site covers both live
scripts' actual save behavior. The field is optional on `LiveRunDeps` and
`undefined` by default, so every existing test (none of which sets it)
keeps its old in-memory-only behavior exactly — no test touches the real
`data/opponent-model.json`, confirmed by grep (see §2 below).

### Live smoke test, verbatim

First invocation (`npx tsx scripts/liveRun.ts --dry-run`):

```
▸ liveRun.ts — STAGE 1 dry-run

  · resuming today's budget: 0 energy / 12 runs already spent
  · opponent model: bootstrapped 64 new exchange(s) from the fixture corpus (64 total imported)
  account <USER> noobId <NOOB>
  · real server runs today: 12/12  (matches bot-tracked count)
  · real server cap already reached today — any start_run will be rejected server-side.
  · potions: NOT configured (config/bot.json's forbiddenWoods.potions is absent) -> loading 0. This is the safe default, not a bug.

▸ run 1/1

✗ Guard tripped: session run cap reached {"attemptedRun":13,"cap":12}
  detail: {"attemptedRun":13,"cap":12}
```

`data/opponent-model.json` after this run (via a one-off `python3 -c`
inspection, not committed — this file is gitignored):
```
schemaVersion: 1
num keys: 1
bootstrapImportedIds count: 64
sample key: ('Enemy Room 63|room1', {'total': {'rock': 23, 'paper': 24, 'scissor': 17},
  'transitions': {'rock': {'rock': 9, 'paper': 6, 'scissor': 6},
                  'paper': {'rock': 6, 'paper': 8, 'scissor': 6},
                  'scissor': {'rock': 5, 'paper': 7, 'scissor': 4}}})
```

Second invocation, immediately after, same command — no "bootstrapped N
new" line printed at all (confirms `imported === 0`, so the
`saveOpponentModelAtomically` call inside the `if (imported > 0)` guard
correctly didn't fire a second time either):
```
▸ liveRun.ts — STAGE 1 dry-run

  · resuming today's budget: 0 energy / 12 runs already spent
  account <USER> noobId <NOOB>
  · real server runs today: 12/12  (matches bot-tracked count)
  · real server cap already reached today — any start_run will be rejected server-side.
  · potions: NOT configured (config/bot.json's forbiddenWoods.potions is absent) -> loading 0. This is the safe default, not a bug.

▸ run 1/1
```

Both runs correctly guard-tripped before sending any `start_run` (the real
server dungeon cap was already 12/12 today, carried over from session 31's
own dry-run smoke test the same calendar day — server-confirmed, not
bot-caused). 0 energy spent either time, confirmed by the guard trip firing
before any POST. `ls data/*.lock` after both runs showed nothing —
confirms `acquireGuardLock`'s `process.once("exit", ...)` released cleanly
both times, no orphaned lock.

This smoke test could only exercise the "load blank, bootstrap, save" path
and the "load already-bootstrapped, bootstrap again, no-op" path — it
could NOT exercise the per-turn `model.observe()` → save path (the guard
trip fires before any combat turn happens), since the real dungeon cap was
already exhausted for the day. That specific code path (the one inside
`runOnce`'s combat loop) is covered by the unit test suite
(`tests/liveRun.test.ts`'s existing `runOnce` integration tests exercise
combat turns against a mocked client) but not by this session's live
smoke test. Worth a future session re-verifying live once the daily cap
resets and a real run reaches combat.

### Regression tests

`tests/orchestrator/opponentModelPersistence.test.ts`, 12 tests, all
using `mkdtempSync` + explicit path params (never the real file):

1. `loadOpponentModel` returns a fresh blank model + empty bootstrap set
   when nothing is on disk.
2. Corrupt JSON → throws `OpponentModelPersistenceError`.
3. Wrong shape (parses, fails schema) → throws.
4. `schemaVersion` mismatch → throws.
5. `saveOpponentModelAtomically` round-trips through `loadOpponentModel`
   (model `toJSON()` equal, `bootstrapImportedIds` equal).
6. Creates the parent directory if missing.
7. No temp file survives a clean save.
8. **The named regression**: a model's `predict()` output survives a
   simulated restart (save → fresh `loadOpponentModel` → `predict()` on
   the same key returns an identical `Prediction` object, including
   `confidence: "high"` so the assertion isn't vacuously comparing two
   below-floor uniform reads).
9. **The other named regression**: a file that was legitimately saved once
   and then gets corrupted on disk (this test truncates the last 5 bytes
   of a valid save) throws on the next load rather than silently
   returning blank.
10. `bootstrapFromCorpus` against the REAL fixture corpus (`loadCorpus()`,
    not a synthetic fixture) imports >0 on the first call.
11. Idempotent — a second call against the same corpus imports exactly 0,
    set size unchanged.
12. Survives a restart specifically for bootstrap: import, save, "restart"
    via fresh `loadOpponentModel`, bootstrap again against the same
    corpus — 0 newly imported, and the reloaded model's `toJSON()` exactly
    equals the original (no double-observation drift from re-importing).

Chose to test bootstrap against the REAL corpus (`loadCorpus()`) rather
than a hand-built synthetic `CorpusRun` fixture — building a fully valid
synthetic `WireRun`/`WireSide` that satisfies `exchanges()`'s several
filters (DUNGEON_ID_CID match, both sides alive, no reward/enemy-path
phase active, `probeCombatant`/`probeRun`'s coverage-probe field
requirements) would have been substantial scaffolding for a test that the
real corpus already exercises correctly and cheaply (`loadCorpus()` reads
local fixture files, no network). One consequence: these three tests will
have a different `imported` count if the corpus grows in a later session
(not asserted as an exact literal, just `toBeGreaterThan(0)`/`toBe(0)` for
the delta) — same "floor, not exact count" convention `replay.test.ts`
already uses for exactly this reason (see that file's own comment on
`toBeGreaterThanOrEqual(417)`).

---

## §2 — Test-isolation hygiene

**CLAUDE.md edit.** Added one bullet to the Working style section (after
the existing API/strategy-separation bullet), stating explicitly: tests
must never write to a real `data/`/`logs/` path or anything a persistence
module/report script treats as ground truth; always an isolated temp path.
Cited both prior incidents by name (session 30's fishing-corpus 9001/9002
pollution, session 31's `guard-budget.json` leak) and named the specific
construction sites to watch (`LiveRunDeps`, `LiveFishingDeps`, anything
wired to the new `opponentModelPersistence.ts`).

**Grep audit.** Searched for every `LiveRunDeps`/`LiveFishingDeps`
construction across the test suite:

```
grep -rln "LiveRunDeps\|LiveFishingDeps" tests --include="*.ts"
  tests/liveFishing.test.ts
  tests/liveRun.test.ts
  tests/sim/fishingCorpus.test.ts
```

For each file, checked every object literal (not just the ones near a
`guardStatePath` grep hit) against its actual construction site:

- `tests/liveRun.test.ts`: single `makeDeps(dryRun: boolean): LiveRunDeps`
  helper (line 332) is the ONLY place a `LiveRunDeps` object is built from
  scratch; it unconditionally sets `guardStatePath` regardless of the
  `dryRun` argument. Every other call site in the file either calls
  `makeDeps(...)` directly or spreads it (`{ ...makeDeps(false), potionPolicy: ... }`,
  4 occurrences) — so isolation is structurally guaranteed by construction,
  not by each call site remembering to set it individually. This is
  actually a stronger guarantee than "checked and found nothing" — a
  future test added to this file would have to actively bypass `makeDeps`
  to reintroduce the bug.
- `tests/liveFishing.test.ts`: three ad-hoc `LiveFishingDeps` object
  literals (lines 360, 400, 431) plus one `makeDeps(client, guardStatePath)`
  helper (line 509) used for 2 more test cases. All three ad-hoc literals
  set `guardStatePath` inline (confirmed each one individually, not just a
  file-wide grep count match) and the helper takes it as a required
  parameter. No missing-isolation site found.
- `tests/sim/fishingCorpus.test.ts`: one `runOneCast({...})` call (line
  164), `guardStatePath` present inline. This was one of the 3 offenders
  session 31 fixed — confirmed still fixed, not re-broken.

Also checked (per the brief's explicit mention) for any test that opts
into the new `opponentModelPersistence` dep with a real path — none exist,
since no test sets that field at all (it's additive this session, and
`runOnce`'s save call is gated behind `if (deps.opponentModelPersistence)`,
so omitting it entirely, which every existing test does, is the same safe
default as before this session).

**Honest result: none found beyond the 3 already-fixed session-31
offenders.** Per the brief's own instruction ("report the result honestly
either way ... don't pad a clean result into something it isn't"), this is
reported as a genuine last-instance finding, not padded — the structural
reason (`makeDeps`-style single-source-of-truth helpers in both files) is
what makes this a low-risk area going forward, not just luck.

---

## Verification (final commit 3a0e877)

```
npx tsc --noEmit
  (clean, no output)

npx vitest run
  Test Files  29 passed (29)
  Tests       500 passed (500)
  Duration    ~1s
```

Re-run against the actual final commit (working tree was clean at commit
time — confirmed via `git status --short` immediately after `git commit`,
before writing this recap), not just a pre-commit check — per CLAUDE.md's
own session-18-derived instruction to re-run at recap time against the
final commit specifically.

## Files changed (full diff --stat)

```
 CLAUDE.md                                           | 14 ++++++++
 scripts/liveRun.ts                                  | 40 +++++++++++++++++++++-
 scripts/orchestrator.ts                             | 21 +++++++++--
 src/orchestrator/opponentModelPersistence.ts        | new file, 216 lines
 src/strategy/opponentModel.ts                        |  3 ++-
 tests/orchestrator/opponentModelPersistence.test.ts | new file, 176 lines
 6 files changed, 464 insertions(+), 4 deletions(-)
```
