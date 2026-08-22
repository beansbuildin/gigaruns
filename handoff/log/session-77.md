# SESSION 77 — 2026-08-22 — the assertion that never ran, CI, and a history rewrite

**GATE 1 PASS. GATE 2 PASS.** Suite 1442 → **1443/1443**, `tsc --noEmit` clean,
`git diff --check` clean, secret scan clean, tree clean, CI green twice.
Four commits plus a full history rewrite: `338d859`, `aba7cf5`, `55f6633`,
`7d09fd3`.

**0 live actions.** Opened 08:32 PT; `doctor.ts` read dungeon 12/12, fishing
20/20, rollover 11:00 PT.

> **⚠ READ FIRST: every commit SHA in this repo changed today.** Sessions 01–76
> quote hashes that no longer exist. The 140 citations in the current checkout
> were remapped; the copies inside historical commits were not, and cannot be.

---

## 1. §1 / GATE 1 — the seventh file, and why it changes the class

### The instrument

`scripts/assertionCoverage.ts` + `tests/helpers/assertionCount.ts` +
`vitest.assertions.config.ts`. An `afterEach` hook reads vitest's own
`expect.getState().assertionCalls` and writes one JSON line per test to a temp
path; the script runs the suite against that config, tallies, and exits 1 if any
test called `expect()` zero times.

```
$ npx tsx scripts/assertionCoverage.ts        # before
  1442 test(s) ran and were counted.
  ★★★ 1 test(s) asserted NOTHING:
    tests/dungeonSim.test.ts
      "halts rather than inventing a move when every move is locked"
  exit 1

$ npx tsx scripts/assertionCoverage.ts        # after
  1443 test(s) ran and were counted.
  ✓ every one of them called expect() at least once.
  exit 0
```

**The brief's count of one holds here too.** Its number came from a clone; this
tree runs the 13 suites the export skips. Same answer. That is precisely the
local-vs-export diff STATE.md's open question 1 asked for, arriving from the
other direction and costing one run.

### Why runtime and not a grep

The static version — an `it` whose only `expect` sits behind an `if` — returns
**three** candidates in this repo. Two of them (`noHardcodedPaths.test.ts:168`,
`dungeonArmClosed.test.ts:140`) assert on every run; their conditions hold. A
ratchet pinned at 3 ratchets two false positives into permanence and teaches the
next reader to ignore the alarm. **The runtime count has no false positives by
construction — it counts calls that happened.**

### What the test actually was

```ts
const r = simulateRun({ policy: fixedPolicy("rock"), opponent: fixedPolicy("rock"),
                        chargesAreHardLimit: true, seed: 1, maxRooms: 1 });
if (r.outcome === "halted") expect(r.reasons).toContain("CHARGES_ALL_LOCKED");
```

Its stated premise — *"a policy that only ever plays one move drives it to −1 and
then has nothing legal left once the others also run down"* — **is false. The
others do not run down; they regenerate.**

**And it was a trap, not merely useless.** A sweep of 64,000 runs:

```
total runs 64000            (4 policies x 4 opponents x 200 seeds x 5 depths x 4 start rooms)
CHARGES_ALL_LOCKED:     0
outcomes:   cleared 28487   died 27309   halted 8204
```

`halted` occurs 8204 times — for `NO_TIER_CAPTURE` and `DEPTH_BEYOND_CORPUS`.
**Had the guard ever been entered under those, the assertion would have
FAILED.** The vacuity hid a wrong assertion, not just an absent one.

### The state is unreachable, and that is arithmetic

- `chargesAfterPlay(before)` = `before === 1 ? -1 : before - 1` — a move played
  from 1 lands on **−1** and never on 0.
- `chargesAfterRest` gives every **unplayed** move +1, capped at max.
- Exactly **one** move is played per exchange.

So a move sits at −1 for one exchange, then 0 for one more on its way back up.
A move reaches 0 only from −1. **At most ONE move is ever ≤ 0 at a time**, and
all-locked would need two moves to reach −1 in the same exchange, which one play
per exchange forbids. Boons touch no charges; no enemy defines a non-default
`maxCharges`. Derived and measured, agreeing.

### What replaced it, and why neither of the brief's options fit

Option 1 (construct the halt) is impossible from `simulateRun`'s public surface.
Option 2 (delete and record a gap) throws away a provable fact. So:

1. `it("never locks every move at once under a hard limit — measured, not assumed")`
   — 720 runs, asserting **unconditionally on every one** that
   `CHARGES_ALL_LOCKED` is absent, and asserting that `halted` IS reachable, so
   the trap is pinned too.
2. `it("but legalMoves DOES return the empty set the sim's guard is written for")`
   — the primitive, tested where the state CAN be built, plus the control that
   it is the hard limit doing it.

The branch in `dungeonSim.ts` is **kept** and documented as deliberately dead:
it refuses an unobserved server rule, and a charge-model change could make it
live.

### The class, restated

Sessions 68 and 76 scoped this to SHIPPING — a stranger's clone going red, or
silently green on a missing file. **That was the visible cause, not the class.**
This instance has no filesystem call, identical test counts in the export and at
home, and passes in both. **The class is "an assertion that does not run."**

---

## 2. §2 / GATE 2 — CI, closed after five sessions

`ls -a` confirmed the brief: **no `.github/` at all.** So the question was never
"should preflight run in CI".

`.github/workflows/ci.yml`, `on: push` and `pull_request`, **no `schedule:`**:
`npm ci` → `tsc --noEmit` → the suite → `assertionCoverage` → `preflight.ts`.

```
✓ offline-checks in 1m44s   (run 32583486394)
  ✓ npm ci   ✓ Type check   ✓ Test suite   ✓ Assertion coverage   ✓ Distribution preflight
```

Green again on the force-pushed history (run 32584246490).

**Why push-triggered is the argument, not an implementation detail:**
`preflight.ts` exports from the git **INDEX**, so a test written after the last
manual run is invisible to it. That is how session 68's own preflight reported
1292 tests against a tree ending at 1293, and how the suite stayed red for a
stranger for eight sessions. A pre-commit hook does not close that; a push does.

**Offline by construction (user directive, 2026-08-22):** no credentials, no
live game API, no autobattler, no deploy, no scheduled workflow. `doctor.ts`'s
one network call is guarded by `if (jwt)`; a runner has no `~/.secrets`, so it
is never reached — `preflight.ts` already depends on this, running doctor under
an empty HOME and expecting exactly one failure.

The first green run annotated `actions/checkout@v4` and `setup-node@v4` as
targeting deprecated Node 20; bumped to `@v5`.

---

## 3. §3 — the sanitization, by user directive

### The scan, run and reported BEFORE anything was rewritten

**No credentials in any of the five username-bearing files.** 0 JWTs, 0 wallet
addresses, 0 private keys, 0 API keys, 0 emails.

| file | what the pattern hits actually were |
|---|---|
| `.claude/settings.local.json.bak` | a Claude Code permission allow-list, 119 lines. Command **templates**: a curl carrying `Authorization: Bearer $(cat ~/.secrets/…)`, greps whose search pattern is the literal `PRIVATE KEY`, and `"allowRead": [".", "~/.secrets"]`. Shapes recorded, **no values**. |
| `handoff/log/session-01.md` | prose *about* the secret scan |
| `session-{15,35,37}.md` | zero hits of any kind |

**Two identifier classes found, one of which the directive did not name.** The
in-game handle appeared in 7 files across history (only the `.bak` in the tree).
Reported, and the user widened the scope to include it. The non-zero
`NOOB_TOKEN_CID` in 2,727 historical files was reported and deliberately left —
it is `fixtures/README.md`'s recorded accepted exposure and is not reopened.

### The rewrite

`git filter-repo` is unavailable and unfetchable (the sandbox allows only
gigaverse.io, github.com, registry.npmjs.org), so:
`git filter-branch -f --index-filter … --tag-name-filter cat -- --all` over the
**union of 11 affected paths** — 379 commits in ~90 seconds.

```
macOS username   -> <USER>      4 session logs (vitest RUN header lines)
in-game handle   -> <PLAYER>    6 files across history
.claude/settings.local.json.bak DELETED from every commit
```

A backup bundle (`git bundle create --all`, 9.4 MB) was written before the run.

### The 140 SHA citations

A rewrite changes every hash, and this repo cites its own commits constantly —
session 77 dated a defect by tracing one. Map built by pairing
`rev-list --reverse` before and after and **validated on all 379 pairs (0
subject/author-date mismatches)**, then applied to the tip:

```
files rewritten:           68
SHA citations remapped:   225
hex tokens resolving to no old commit (left alone): 233
```

Round-trip: **140 distinct hex tokens in the markdown resolve to a commit in the
new history — the same 140 that resolved before.** Spot check:
`02e7907 -> f93d9a6`, and `git log -1 f93d9a6` is still
*"session 68 §4: scripts/preflight.ts, and the '110th cast' was never missing"*.

Only the tip is remapped. Rewriting citations inside history would change the
hashes being cited — a fixed-point problem with no solution — so historical
copies keep old hashes. The tip is what anyone reads.

### Verification, on a fresh clone of the public repo

```
$ git clone https://github.com/beansbuildin/gigaruns
  HEAD=7d09fd3   commits=380
  macOS username (any case), all reachable history:   0
  in-game handle (any case), all reachable history:   0
  .claude/settings.local.json.bak in any revision:    0
  wallet addresses:                                   0
  JWTs:                                               0
```

**What I can and cannot certify.** Reachable history is clean, verified from
outside. GitHub may retain unreachable objects until its own GC, and forks or
third-party caches are outside anything I can inspect. The `.bak` remains on
disk locally, untracked and matched by `.claude/*.bak` — deliberate: deleting
the author's local settings backup was not required to stop publishing it.

---

## 4. Surprises

1. **The vacuous test was also WRONG**, and only the vacuity kept it green.
   8204 halted runs in the sweep would each have failed it.
2. **The unreachability is provable in three lines of arithmetic** and the
   64,000-run sweep merely confirms it. Worth doing both: the sweep is what made
   me look for the proof.
3. **`--force-with-lease` fails after `git reflog expire`** with "stale info" —
   the lease has no recorded remote state to compare. `git fetch` first, then
   `--force-with-lease=main:<sha>`.
4. **`git rev-list --all` includes `refs/original/*` after filter-branch**, so
   the first post-rewrite scan reported 1236 hits and looked like a failure. It
   was the backup refs. Scan `refs/heads/main` — what actually gets pushed — and
   verify from a fresh clone, which is the only check that answers the question
   asked.
5. **Two `refs/codex/turn-diffs/checkpoints/…` refs are not committish** and
   filter-branch skipped them with a warning. Local Codex tooling refs; not
   pushed, not part of the public repo.
