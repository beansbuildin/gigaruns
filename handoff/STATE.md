# STATE — session 77 — 2026-08-22 (PT 2026-08-22) — code at commit 7d09fd3

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1443/1443**, `tsc --noEmit` clean,
`git diff --check` clean, secret scan clean across the session diff,
`assertionCoverage` **0 vacuous tests**, CI **green on a real run**.

- **⚠ EVERY COMMIT SHA IN THIS REPO CHANGED TODAY.** History was rewritten and
  force-pushed by user directive (§3). `main` is 380 commits; **old SHAs from
  session 76 and earlier no longer exist**. The 140 SHA citations in this
  repo's own markdown were remapped in the same pass, so citations at the TIP
  resolve; copies inside older commits still carry old hashes.
- **Offline session.** Opened 08:32 PT, `doctor.ts` read dungeon **12/12**,
  fishing **20/20**, rollover 11:00 PT. **0 runs, 0 casts, 0 energy.**
- **Ship-nothing posture still HOLDS** (session 76, unchanged).

## What works
- **§1 GATE 1 — `scripts/assertionCoverage.ts`, and the count went 1 → 0**,
  demonstrated by running it before and after:

  ```
  before   1442 test(s) counted    ★★★ 1 asserted NOTHING    exit 1
  after    1443 test(s) counted    ✓ every one called expect()   exit 0
  ```

- **§1 the brief's clone-derived count of ONE holds in the author's tree too**,
  where the 13 export-skipped suites actually run. 1442 counted, one at zero.
  That is open question 1's local-vs-export diff, answered from the other side.
- **§1 the runtime count is the right instrument and the grep is not.** The
  static version (an `it` whose only `expect` sits behind an `if`) returns
  **three** candidates here; two of them assert on every run. A ratchet pinned
  at 3 would ratchet two false positives into permanence.
- **§2 GATE 2 — CI exists and is GREEN on a real run.** `.github/workflows/ci.yml`,
  push and pull_request only: `npm ci`, `tsc --noEmit`, the suite,
  `assertionCoverage`, `preflight.ts`. **`✓ offline-checks in 1m44s`**, all
  five steps. Green again on the force-pushed history (run 32584246490).
- **§2 offline by construction, not merely by policy** (user directive): no
  credentials, no live game API, no autobattler, no deploy, **no `schedule:`**.
  `doctor.ts`'s single network call is guarded by `if (jwt)` and a runner has
  no `~/.secrets`, so it is never reached.
- **§3 the public repo is verified sanitized, on a fresh clone**: 380 commits,
  **0** files containing the macOS username or the in-game handle in any case,
  **0** revisions carrying `.claude/settings.local.json.bak`, **0** wallet
  addresses, **0** JWTs.

## What's broken
- **`tests/dungeonSim.test.ts:177` was a TRAP, not merely vacuous, and the
  vacuity hid it.** It asserted only inside `if (r.outcome === "halted")`.
  `outcome === "halted"` **does** occur — 8204 of 64,000 runs, for
  `NO_TIER_CAPTURE` and `DEPTH_BEYOND_CORPUS` — so had that guard ever been
  entered the assertion would have **failed**: `CHARGES_ALL_LOCKED` is not the
  only way to halt.
- **Its premise was false.** "A policy that only ever plays one move drives it
  to −1 and then has nothing legal left once the others also run down" — the
  others do not run down, they **regenerate**.
- **`CHARGES_ALL_LOCKED` is unreachable, by arithmetic.** `chargesAfterPlay`
  sends a move played from 1 to −1 and never to 0; `chargesAfterRest` gives
  every unplayed move +1; one move is played per exchange. So a move sits at
  −1 for one exchange and 0 for one more on the way up: **at most ONE move is
  ever ≤ 0 at a time**, and two would have to reach −1 in the same exchange.
  Measured at 0/64,000. **The branch is KEPT** — it refuses an unobserved
  server rule and a charge-model change could make it live.
- **Old commit SHAs are dead references outside the tip.** Session logs 01–76
  quote hashes that no longer exist, in their own historical copies. Only the
  current checkout is remapped.
- **The `.bak` is gone from git but still on disk**, untracked and matched by
  `.claude/*.bak`. Deliberate — it is the author's local settings backup and
  deleting a local file was not required to stop publishing it.
- Carried, all untouched: the `nextPosition` tripwire has still never met a
  real miss; the oil row of session 72's gate 1 still fails (50.1% sim vs
  78.6% live, n=14) and **no oil payload has ever been measured**; the
  shrinkage re-fit is unstable and unadopted; `pConnect` is still optimistic
  at +9.38pp and closed BY IRRELEVANCE.

## Corrections to SPEC.md
- **None this session.** No live response was read — the ledgers were spent
  before the session opened.
- **`src/sim/dungeonSim.ts`'s halt branch is documented as DEAD CODE** against
  the current charge model, with the derivation and the 64,000-run measurement,
  and with an explicit instruction not to delete it on coverage grounds.
- **The class sessions 68 and 76 were guarding is WIDER than they scoped it.**
  Both framed it as *shipping* — a stranger's clone going red or silently
  green. That was the visible cause. **The class is "an assertion that does not
  run"**, and a missing author file is one way in; an untaken branch is another
  and has no filesystem call to grep for, identical test counts in export and
  at home, and passes in both.
- **Credential scan of the five username-bearing files, run before any
  rewrite: NO credentials.** 0 JWTs, 0 addresses, 0 private keys, 0 API keys,
  0 emails. `.claude/settings.local.json.bak` is a permission allow-list whose
  hits are command TEMPLATES (a curl with `Authorization: Bearer $(cat
  ~/.secrets/…)`, greps whose pattern is the literal `PRIVATE KEY`) —
  shapes recorded, no values. `session-01.md` is prose about the scan itself.
  Sessions 15/35/37: zero hits of any kind.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Both of the brief's two options for `dungeonSim.test.ts:177`.**
  Constructing the halt is impossible from `simulateRun`'s public surface —
  the state is unreachable, not merely unconstructed. Deleting throws away a
  real, provable fact. Pinned the fact instead: 720 runs asserting
  unconditionally that it never fires, plus a unit test that `legalMoves`
  still returns `[]` for a state no play can produce.
- **`git filter-repo` is not installed and cannot be fetched** (the sandbox
  allows only gigaverse.io, github.com, registry.npmjs.org).
  `git filter-branch --index-filter` over the union of 11 affected paths did
  the job in ~90 seconds for 379 commits.
- **`--force-with-lease` with no explicit value fails after `reflog expire`**
  ("stale info") — the lease has nothing to compare against. `git fetch`, then
  `--force-with-lease=main:<sha>`.
- Standing, none re-opened: never report energy as a blocker; `--dry-run`
  before claiming a blocker; do not revert rule 8; **redraw CLOSED on price,
  not effect**; +19.40pp SUSPENDED; do not re-run the oil sweep on the current
  instrument; `boonCapture` OFF; `shrinkageK` inert.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.

## Metrics
- **Live: 0 dungeon runs, 0 fishing casts, 0 energy.** 12/12 and 20/20 at open
  and close.
- `assertionCoverage`: **1 of 1442 → 0 of 1443.**
- Halt-branch probe: **0 `CHARGES_ALL_LOCKED` in 64,000 runs** (4 policies ×
  4 opponents × 200 seeds × 5 depths × 4 start rooms); 8204 `halted` from other
  reasons; 28,487 cleared / 27,309 died.
- CI: 2 runs, both success, 1m44s and 1m13s.
- Rewrite: 379 commits filtered, 11 paths touched, **map validated on all 379
  pairs (0 subject/date mismatches)**; **225 citations in 68 files remapped**;
  140 distinct hex tokens resolve in the new history — the same 140 that
  resolved before.
- Suite **1442 → 1443** (−1 vacuous, +2 honest). 87 files. Hardcoded-path
  ratchet **25**, unchanged.

## Open questions for Claude
1. **What else does the assertion counter make possible?** It is now in CI and
   pinned at zero, but the class it belongs to is bigger than vacuity: it also
   records **per-test assertion counts**. A test asserting once about a
   thirty-line behaviour is not vacuous and is not good either. **Is a
   low-assertion review worth one pass**, or is that a metric that will rot into
   a target?
2. **The oldest unspent item is now five sessions old.** The forced Relaxing
   consume (session 73/74 §4, design untouched and still valid) plus the era
   batch. `OIL-POLICY.md` §1's two load-bearing live questions — does
   `use_fishing_item` advance the fish, and does it cost mana — are answerable
   by **one** deliberate cast. **12 run-units and 20 casts at 11:00 PT.**
3. **Historical SHA citations inside old session logs are now dead.** The tip is
   remapped; the copies in commits are not, and cannot be without changing the
   hashes being cited. **Is a one-line note in each affected log worth it, or
   does DECISIONS.md's record suffice?**
4. Carried: separate the crit source with one-lure-only casts? What re-derives
   +19.40pp (still SUSPENDED, do not quote)?

## Files changed
```
 4 commits (338d859, aba7cf5, 55f6633, 7d09fd3) + a full history rewrite.
 74 files, +529 -181 in the session diff.

  NEW  scripts/assertionCoverage.ts       118  GATE 1 — the instrument
  NEW  tests/helpers/assertionCount.ts     46  the vitest setup hook
  NEW  vitest.assertions.config.ts         21  shipped config + the counter
  NEW  .github/workflows/ci.yml            83  GATE 2 — offline only, no schedule
       tests/dungeonSim.test.ts           +94  the trap, replaced by two honest tests
       src/sim/dungeonSim.ts              +14  the dead branch, documented
       package.json                        +1  npm run test:assertions
       68 .md files                      ±225  SHA citations remapped
  GONE .claude/settings.local.json.bak         removed from all 379 commits
```
