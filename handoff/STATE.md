# STATE — session 76 — 2026-08-22 (PT 2026-08-22) — code at commit 8bb7988

## Status
**GATE 1 PASS. GATE 2 PASS. GATE 3 PASS.** Suite **1442/1442** (1433 → 1442,
+9), `tsc --noEmit` clean, `git diff --check` clean, secret scan clean across
the whole session diff, `discoveredShipsClean` 8/8.

- **Offline session by arithmetic, not by choice.** Opened 07:22 PT; both
  ledgers were exhausted by session 75 and roll at 11:00 PT. `doctor.ts` plus
  both server checks: dungeon **12/12**, fishing **20/20**, game and repo agree.
  **0 dungeon runs, 0 casts, 0 energy spent.**
- **The session is about the repo being CHECKABLE by a stranger, not about
  play.** Its three defects are one class: *a claim that outlived the place it
  was written down.*
- **Ship-nothing posture HOLDS** — user decision this session, answering
  STATE.md's open question 1. The frozen items stay frozen.

## What works
- **§1 GATE 1 — a clone's suite is green, demonstrated by running it.**
  `npx tsx scripts/preflight.ts`, before → after:

  | | before | after |
  |---|---|---|
  | test files | **1 failed** \| 85 passed | **86 passed** (87 at final commit) |
  | tests | 1 failed \| 1419 passed \| 13 skipped | 1427 passed \| **15 skipped** |
  | verdict | ★★★ RED in a stranger's tree | **PREFLIGHT PASSED** |

  Reproduced twice. 272 files exported, one `✗` (the JWT), secret scan clean.
- **§1 the assertion was UNSATISFIABLE, not merely unmet.**
  `tests/sim/fishingCorpus.test.ts:128` asserted strictly more `cast-*`
  directories than directories holding `state-*`. Measured: author's tree
  **133 dirs / 109 with state**; git tracks **109 / 109**. The ~24 raw-only
  directories are empty once `fixtures/**/raw/` is ignored, and **git carries
  no empty directories** — so `expect(109).toBeGreaterThan(109)` in every clone
  of every commit.
- **§1 SPLIT, not skipped.** docId-uniqueness and the batch-packing inequality
  are computed entirely from tracked files and still run for a stranger; only
  the empty-directory half moved behind `probeAuthorData`. This is what
  `tests/helpers/authorData.ts` asks for, and the brief's "do not skip the file
  wholesale" is honoured.
- **§2 GATE 2 — both analysis scripts fail closed**, demonstrated in a
  clone-shaped export (`git checkout-index`, no `data/`, no `logs/`): each
  prints the missing paths and **what each was for**, exits **2**, prints no
  report. `scripts/lib/requireInputs.ts`, 8 new tests, temp paths only.
- **§2 POSITIVE CONTROLS — both instruments intact, and session 75's headline
  figures reproduce exactly on this machine.**

  | script | figure | session 75 | re-run today |
  |---|---|---|---|
  | `liveGateFiringRates` | era / clean turns | 134 / 440 | **134 / 440** |
  | | RELAXING, FOCUS held | 0/20, 0/80 | **0/20, 0/80** |
  | | corpus maxima | 0.991 / 0.967 | **0.991 / 0.967** |
  | `redrawBlastRadius` | branch incidence | 3515/4000 = 87.9% | **3515/4000 = 87.9%** |
  | | hit rate per shot | 35.6% → 45.4% | **35.6% → 45.4%** |
  | | catch | 24.9% → 32.5% | **24.9% → 32.5%** |

- **§3 GATE 3 — the retracted claim is gone from both sites it survived at.**
- **§4 the published scans re-run here, not transcribed:** working tree AND all
  **370** commits — **0** wallet addresses, **0** JWTs, **0** hex private keys.

## What's broken
- **The author-data guard is a ONE-SHOT SWEEP and guards nothing written after
  the day it was applied.** This is the finding, and it is bigger than the two
  files. The offending assertion landed in **`f93d9a6` — the same commit that
  added `scripts/preflight.ts`.** Session 68's own preflight reports
  `1279 passed | 13 skipped (1292)` against a tree that ended at **1293**: the
  export is taken from the git INDEX, so a test written after the last run is
  invisible to it. **Eight sessions ran with a stranger's first command red.**
- **A SIXTH file of the class, in the harder-to-see direction.**
  `tests/discoveredShipsClean.test.ts` had `if (!existsSync("data/roms.json"))
  return;` inside an `it`, under a comment saying it was *"skipped in a fresh
  clone, which is correct"*. **It was not skipped — it PASSED, asserting
  nothing.** Now declared. The guard reaches whatever goes RED; a silent early
  return never does. **Assume a seventh exists** — nothing yet searches for
  this shape.
- **`.claude/settings.local.json.bak` is still committed and still published.**
  `.gitignore` now carries `.claude/*.bak`, which stops the next one; it does
  **not** untrack the copy in history. ~70 lines of local allow-list including
  absolute home paths. **The user's call, not an agent's.**
- **The macOS username is published in 5 files** —
  `handoff/log/session-{01,15,35,37}.md` (vitest `RUN` header lines) and that
  `.bak`. Note `session-15.md` is the log of the incident that produced
  CLAUDE.md's filesystem-scope rule, and it names the path that caused it.
- Carried, all untouched: the `nextPosition` tripwire has still never met a
  real miss; the oil row of session 72's gate 1 still fails (50.1% sim vs
  78.6% live, n=14) and **no oil payload has ever been measured**; distribution
  steps 3/4/6 remain the user's; the shrinkage re-fit is unstable and
  unadopted; `pConnect` is still optimistic at +9.38pp and closed BY
  IRRELEVANCE, not by explanation.

## Corrections to SPEC.md
- **None this session.** No live response was read — the ledgers were spent
  before the session opened. `SPEC-fishing.md` §7a already carried session 75's
  retraction and was verified correct; what changed is the two places OUTSIDE
  it that still carried the retracted claim.
- **`handoff/DISTRIBUTION.md` described a distribution that did not happen**,
  and is now reconciled. Verified from this tree: `origin` is
  `github.com/beansbuildin/gigaruns`, **public**, **370 commits of full
  history**, with `handoff/` (102 files), `QUESTIONS.md`, `TASKS.md`, `CODEX*`
  and `.claude/` all tracked. The plan said private, collaborators only, and
  *"ship from a fresh repo with squashed history"*. `data/`, `logs/`,
  `profiles/` are correctly absent. **The does-not-ship table is now labelled as
  the EXPORT's list — what `preflight.ts` prunes — not the repo's.**
- **CLAUDE.md's own "Working style" contradicted its rule 3**: *"`viem` for
  signing"*. `viem` was dropped in session 59, is imported nowhere, and is
  pinned absent by `tests/clientSurface.test.ts`. Fixed. `TASKS.md`'s "Path B —
  bot-owned EOA" line deleted, which is what rule 3 says to do with it.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, not re-measured this session.

## Dead ends
- **Demonstrating a clone's behaviour with a scratch-directory export.**
  `git checkout-index` into a non-repo directory makes `tests/profile.test.ts`
  fail — it shells out to `git check-ignore`, which answers "no" outside a
  repo. A real artefact of the method, not of the code. **Use `preflight.ts`**,
  whose `dist-preflight/` sits inside the working tree and is git-aware. The
  scratch tree is still the right instrument for running a SCRIPT with no
  `data/`.
- Standing, all re-affirmed and none re-opened: never report energy as a
  blocker; `--dry-run` before claiming a blocker; do not revert rule 8;
  **redraw is CLOSED — on PRICE, not on effect**; +19.40pp stays SUSPENDED and
  unquotable; do not re-run the oil sweep on the current instrument; do not
  loosen the `fakeDoc` guard; `boonCapture` settled OFF; the matcher is not
  `pConnect`'s cause; `shrinkageK` is inert.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.

## Metrics
- **Live: 0 dungeon runs, 0 fishing casts, 0 energy.** Ledgers 12/12 and 20/20
  at open and at close; rollover 11:00 PT.
- Clean-export suite: **1419 → 1427 passed, 13 → 15 skipped, 1 → 0 failed.**
- Local suite **1433 → 1442** (+9: `requireInputs` 8, the `fishingCorpus`
  split 1). 87 files.
- Both GATE-2 instruments re-run at full n and reproduce session 75 exactly
  (table above). Nothing was re-derived; this is a control, not a measurement.
- Published-history scan: **0 / 0 / 0** over 370 commits.
- Corpus unchanged at 128 casts (127 clean) / 537 `playTurns`. Hardcoded-path
  ratchet **25**, unchanged.

## Open questions for Claude
1. **Nothing yet detects the vacuous-pass shape.** A test that early-returns on
   a missing author path reports GREEN, so neither the suite nor `preflight.ts`
   can see it — both count it as a pass. Two were found by reading. **Is a
   ratchet worth building** (grep for `existsSync(...)) return` inside an `it`,
   or a per-file test-count diff between the local run and the export), or is
   reading enough?
2. **`preflight.ts` in CI — this session is the evidence, and the question is
   now four sessions old.** It was RED for eight sessions and the instrument
   that would have said so existed the whole time, unrun. Note the sharper
   version: preflight reads the git INDEX, so **CI on a push is exactly the
   trigger that closes the gap**, and a pre-commit hook would not.
3. **`.claude/settings.local.json.bak` and the username in 4 session logs are
   published.** Both are the user's call and no agent may act. Is the answer
   "accepted exposure, recorded" like the noob token in `fixtures/README.md`,
   or is there an action wanted?
4. **Carried, still unspendable:** the forced Relaxing consume and the era batch
   (session 73/74 §4 designs, untouched and still valid); the oil row of
   session 72's gate 1. **12 run-units and 20 casts at 11:00 PT.**
5. Carried: separate the crit source with one-lure-only casts? What re-derives
   +19.40pp (still SUSPENDED, do not quote)?

## Files changed
```
 4 commits (8008140, f575dcd, 9fc7a66, 8bb7988). 13 files, +468 -27

  NEW  scripts/lib/requireInputs.ts        119  GATE 2's shared fail-closed check
  NEW  tests/requireInputs.test.ts         101  8 tests, mkdtemp paths only
       tests/sim/fishingCorpus.test.ts     +94  GATE 1 — the split
       handoff/DISTRIBUTION.md             +73  reconciled with what shipped
       src/sim/fishing/castSim.ts          +32  GATE 3 — the retraction
       tests/discoveredShipsClean.test.ts  +27  the sixth file, declared
       scripts/liveGateFiringRates.ts      +15  fails closed on 3 inputs
       scripts/redrawBlastRadius.ts        +14  fails closed on 2 inputs
       .gitignore                           +6  .claude/*.bak
       CLAUDE.md                            +6  rule 3 vs its own working style
       tests/fishing/pConnectConsumers.test.ts +5  263 -> 43.9
       scripts/liveFishing.ts               +2  export MINED_PATTERNS_PATH
       TASKS.md                             -1  Path B deleted
```
