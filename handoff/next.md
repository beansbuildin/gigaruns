# BRIEF — session 76

## 0. How this brief was written, stated first because it changes how you read it

**Every claim below about what a file contains was checked by opening it**, per
session 74's §7 rule. The checking was done in a **fresh `git clone` of
`beansbuildin/gigaruns` at `1ebdbfb`** with `npm ci`, on a machine that has
**no `data/`, no `logs/`, and no `~/.secrets`** — i.e. as a stranger sees it.

That is a feature for §1 and a limit everywhere else:

- **Anything I report as reproduced, I reproduced in that clone.** File contents,
  line numbers, fixture cids, the armor re-spec, the redraw branch, GATE 1's
  replay direction, the suite's total test count.
- **Anything derived from `data/` or `logs/` I could NOT check at all** — the
  27,552 HC / 1,491 DR totals, tier gate 38/38, first-attempt 0/216, GATE 1's
  live half (73 `oil_shadow`), and **GATE 2's headline 43.9 / 87.9%**. Those live
  only on the user's machine. §2 is about what that means.

Nothing in STATE.md that I could check came back wrong. The four run cids,
the four death rooms, the re-spec numbers, the `observe`/`turn++` fix, the SPEC
retraction, `discoveredShipsClean` 8/8, the re-pinned `turnsPerCast <= 4` — all
confirmed verbatim. **Session 75's report is accurate.** The findings below are
about things it did not look at, not corrections to it.

---

## The clock and the ledger

Written **2026-08-22, 07:00 PT**. *Source: session 75's live reads, plus
arithmetic — NOT a live read of my own.*

The four runs of session 75 were played 03:51–04:27 PT **today**, which puts them
inside the game-day that opened 11:00 PT on 08-21. That day is **exhausted:
`dayProgressEntities` 12/12, fishing 20/20.** Both roll at **11:00 PT today**.

**So before 11:00 PT there is ZERO live budget of either kind, and after it there
is a full day of both** — 12 run-units (4 juiced runs) and 20 casts.

**Read both ledgers with `doctor.ts` before believing any of that.** It is
derived, not observed, and rule 13's whole point is that derived ledger state is
not authority. If you open before 11:00, §1–§4 are all offline and none of them
needs the ledger.

*Environment, sessions 66–75: `npx tsx` and `git` both fail under the command
sandbox. Run unsandboxed. Not a repo problem.*

---

## 1. A clean clone of the shared repo is RED — and one assertion cannot ever pass

**This is the session's first item because the repo is public and every new
reader's first command hits it.**

```
git clone https://github.com/beansbuildin/gigaruns && npm ci && npx vitest run
  Test Files  1 failed | 85 passed (86)
       Tests  1 failed | 1421 passed | 11 skipped (1433)

FAIL tests/sim/fishingCorpus.test.ts:128
  > reconciles with the fixture tree: distinct docIds, NOT directories
  AssertionError: expected 109 to be greater than 109
```

The 11 skips are correct — author-data suites announcing themselves loudly, the
designed outcome of session 68's `tests/helpers/authorData.ts`. The failure is
not.

**The mechanism, and it is worse than "author data is missing."** Line 128 asserts
`dirs.length > withStates.length` — strictly more `cast-*` directories than
directories containing `state-*` files — on the reasoning that dry-runs and
halted invocations leave directories holding only `raw`. **`.gitignore` line
`fixtures/**/raw/` excludes exactly those files, and git does not track empty
directories.** So those ~23 directories cannot exist in any clone, of any commit,
ever. In the clone both counts are 109 and the assertion is **structurally
unsatisfiable**, not merely unmet.

The second assertion on the next line (`withStates.length < casts.length`) is fine
and is the half that carries the session-68 §4 lesson. Only the first is broken.

Three things follow, and I would take them in this order:

1. **Fix the assertion, don't skip the file.** `tests/helpers/authorData.ts`'s own
   docstring says program logic ships with synthetic fixtures and always runs.
   The docId-uniqueness and batch-packing claims are program logic and must keep
   running for a stranger. Only the empty-directory count is unshippable.
2. **`tests/sim/fishingCorpus.test.ts` is the FIFTH file of this class and the
   only one undeclared.** The four that use `probeAuthorData` are
   `reversalDispersion`, `matcherVerdict`, `rejectionAudit`, `redact`. Whatever
   you do to line 128, the question worth answering is why the guard did not
   reach this one.
3. **Run `npx tsx scripts/preflight.ts`.** It exports the ships list, runs the
   suite against the export, and secret-scans it. Last run **session 68**, eight
   sessions ago, reporting `1279 passed | 13 skipped`. It is the instrument that
   would have caught this, it takes minutes, and DISTRIBUTION.md says to run it
   *before every invite*. **"Should `preflight.ts` run in CI?" has been open since
   session 68** (STATE.md open question 5) — this is the evidence for answering
   yes.

---

## 2. GATE 2's numbers cannot be re-checked by anyone but the author, because the script fails OPEN

**I am not disputing 43.9. I am reporting that I cannot get to it, and that the
instrument does not say so.**

`scripts/redrawBlastRadius.ts:113` reads
`loadTransitionRecords(join(profile.dataRoot, "fish-patterns.jsonl"))`, and
`src/sim/fishing/transitionCorpus.ts:108` opens with
**`if (!existsSync(path)) return [];`**. With `data/` absent the whole "live
config" — `empiricalFish`, `blindFallback`'s two maps, `matcherPool` — is built
from an empty corpus. The script then **runs to completion and prints a full,
confident report**:

```
§3  matcherFishPolicy   casts with >=1 redraw   4000 / 4000   100.0%     (recorded: 3515 / 4000  87.9%)
§4  NEVER (0)        shots 27451  hit rate 34.1%  catch 0.0%  turns/cast 6.86
    derived (.339)   shots  8000  hit rate 34.7%  catch 0.0%  turns/cast 5.00
                                                  (recorded: 24.9% -> 32.5%, 35.6% -> 45.4%)
```

Catch **0.0% on both arms** is the tell that the run is degenerate — and the
script prints the same §4 prose about the mechanism underneath it, unchanged, with
no warning anywhere.

**Compare `scripts/liveGateFiringRates.ts` in the same clone.** It prints §1 and
§2, then dies at §3 with a raw `ENOENT: scandir 'logs'` stack trace. Loud, ugly,
and — importantly — **after** publishing a §2 that is itself silently computed on
a degraded corpus (420 turns, not 440; era 0 turns, not 134).

Two scripts, one session, opposite failure modes, neither one right. CLAUDE.md
rule 5 ("fail closed... never guess to keep going") is written for the live loop;
**the analysis scripts were never held to it, and this is the cost.**

**What I would ask for.** A single shared preflight that both scripts call: name
the inputs, `existsSync` them, and **exit non-zero with the missing path** rather
than degrade. It is small, it is testable, and it converts "the numbers are
unreproducible" into "the numbers are reproducible or the script says why."

**The consequence for the record, stated plainly:** until that exists, GATE 2's
43.9 / 87.9% / 32.5% / 45.4% are **author-only figures**. That is not a reason to
doubt them — it is a reason not to let them be re-quoted by anyone who cannot
re-run them, which now includes every reader of the public repo.

---

## 3. The retracted claim survives verbatim, at the fix site

`src/sim/fishing/castSim.ts:620–626`, inside the redraw branch that session 75
fixed:

```
// The direction of the old error is worth keeping: a free step made the
// redraw strictly CHEAPER in sim than in play, so session 72's "263 mana
// per extra fish" and its `escaped_mana` 18.8% -> 39.8% were both
// UNDERSTATEMENTS. Correcting it therefore STRENGTHENS the CLOSED verdict
// on redraw and cannot reopen it.
```

§3 measured **263.0 → 43.9**. The cost went DOWN. `SPEC-fishing.md` §7a carries
the retraction and the before/after table — I opened it, it is there and it is
good. **The code comment is now the only surviving copy of the claim the spec
retracts, and it sits at the top of the branch a reader opens to understand the
fix.** It also quotes `escaped_mana` 18.8% → 39.8% where the re-derivation reads
18.5% → 39.4%.

This is the same failure session 75 named and caught one file over —
`redrawTriggerCalibration.ts` §6's "not distinguishable from zero", true at
|t| = 1.4 and false at |t| = 7.6, baked into a format string. The enumeration
found the format string and did not look at the comment.

Also stale, lower stakes: `tests/fishing/pConnectConsumers.test.ts:200` still
reads *"(session 72: 263 mana per extra fish)"* — and STATE.md instructs the next
reader to **cite that file with the verdict**, so it will be opened.

**Rewrite both to the measured direction.** The durable sentence is already
written in SPEC-fishing and in the session log: *a `continue` skips everything
below it, not the one thing you were thinking about* — the branch was not merely
time-free, it was information-free, and the information term is the larger one.

---

## 4. DISTRIBUTION.md describes a distribution that did not happen

**This section is FYI and a documentation fix. Steps 3–6 are the user's by
standing decision and no agent touches them.**

`handoff/DISTRIBUTION.md` still reads as the live plan: **private repo**,
collaborators only, **"ship from a fresh repo with squashed history,"** and a
does-not-ship list covering `handoff/`, `QUESTIONS.md`, `TASKS.md`, `CODEX*` and
`.claude/`.

What exists: `github.com/beansbuildin/gigaruns`, **public** (cloned with no
credentials), **369 commits of full history**, with `handoff/`, `QUESTIONS.md`,
`TASKS.md`, `CODEXAUDIT`, `CODEXIMPROVE`, `CODEXREVIEW` and `.claude/` all
present. `data/`, `logs/` and `profiles/` are correctly absent.

**This is a known state, not a discovery.** `src/api/redact.ts:18–26` says so
explicitly — "on a PUBLIC repo", "this repo's public git HISTORY" — and
`fixtures/README.md` §"What the redaction does NOT achieve" documents the noob
token in history as an accepted exposure. **DISTRIBUTION.md is simply the one
document nobody reconciled**, and it now reads as instructions for a
distribution that was superseded.

**What is actually published, measured rather than feared:**

| scan (working tree + all 369 commits) | result |
|---|---|
| `0x[a-fA-F0-9]{40}` in any file | **0 files** |
| `0x[a-fA-F0-9]{40}` in any commit, `--all` | **0 commits** |
| `eyJ[A-Za-z0-9_-]{30,}` in any commit, `--all` | **0 commits** |
| `eyJ…` in the tree | **1**, a synthetic literal in `tests/api/client.test.ts:359` |
| `PRIVATE KEY` | **1**, a grep pattern string inside `.claude/settings.local.json.bak` |

Smaller than the doc feared. The residue is two items, both the user's call:

- **The macOS username appears in 5 files** — `handoff/log/session-{01,15,35,37}.md`
  (vitest `RUN` header lines) and `.claude/settings.local.json.bak`. Note
  `session-15.md` is the log of the incident that produced CLAUDE.md's
  filesystem-scope rule, and it names the path that caused it.
- **`.claude/settings.local.json.bak` is committed.** `.gitignore` covers
  `.claude/settings.local.json`; the `.bak` is not matched. It is ~70 lines of the
  author's local Claude Code allow-list, including absolute
  `Read(/Users/<name>/Downloads/**)` entries. `.claude/` is on the does-not-ship
  list, so this is a gap in the ignore rule rather than a decision.

**Agent action: reconcile DISTRIBUTION.md with what shipped, and add
`.claude/settings.local.json.bak` (or `.claude/*.bak`) to `.gitignore`. Do not
rewrite history, do not touch the remote, do not delete committed files without
the user saying so.**

---

## 5. CLAUDE.md and TASKS.md still contradict CLAUDE.md rule 3

Rule 3 says Path B is **retired, not deferred**, and instructs: *"Delete it rather
than leaving it as future work someone tries to finish."* Two documents still
carry it:

- **`CLAUDE.md`, "Working style", first bullet:** *"TypeScript, Node 20+, `viem`
  for signing."* `viem` was dropped in session 59 — verified: absent from
  `package.json`, imported nowhere in `src`/`scripts`/`tests`, and pinned by
  `tests/clientSurface.test.ts:129–132`. The rule's own document contradicts it.
- **`TASKS.md:1612`, under "Later, if the user wants it":** *"Path B — bot-owned
  EOA with full sign-in, so the JWT self-renews."* This is precisely the "future
  work someone tries to finish" the rule says to delete.

Both are one-line edits. They matter more than their size because rule 3 is the
rule that keeps *"the bot asks for a session token, not custody of a wallet"*
true, and it is the sentence the README puts in front of anyone deciding whether
to run this on their own account.

---

## 6. The live budget, if you are past 11:00 PT

**Nothing in §1–§5 needs it. Treat this section as optional and subordinate.**

Rule 11 terms, unchanged and non-negotiable: **60-energy juiced,
`--juiced-index=3`, 3× Big Heal Juice, `--runs=1`, stop and hand back. Each run
needs its own go-ahead; approval for one is never approval for the next.** Rule
13 after every run — read `checkDungeonToday.ts` and confirm
`dayProgressEntities` moved by exactly 3, **including after a run the harness
reports as denied.**

- **Dungeon.** Session 75's runs bought a lot: boon coverage orb 6→7 / priority
  2→5 after three frozen sessions, and §23's predictor re-fit at n=11. More runs
  extend both. **Do not present them as evidence about rule 8** — that programme
  is CLOSED (DECISIONS 2026-08-21). **Do not read run 4 against runs 1–3**: the
  armor re-spec landed between them and they are not the same arm.
- **Fishing.** Two items have now carried unspent for three sessions: the forced
  Relaxing consume and the era batch (session 73/74 §4 designs, untouched and
  still valid). The oil row of session 72's gate 1 still fails (50.1% sim vs
  78.6% live, n=14) and **no oil payload has ever been measured, because no oil
  cast exists.** Oils are permitted within `config/bot.json`'s `dendren.oils`
  budget — but `policyApproved` ships **false** and authorising the budget is not
  authorising the timing.

---

## 7. On STATE.md's five open questions

**Q1 (what replaces the `pConnect` thread) is the user's, not mine.** It is a
posture decision, the other frozen items are unblocked by the diagnosis, and no
amount of repo-reading answers it. Ask it directly at the top of the session
rather than inferring an answer.

**Q2 (re-derive the pre-2026-08-22 sim figures in bulk?) — largely already
answered by the repo, and the answer is NEITHER.** `handoff/OIL-POLICY.md` §0a
has been **SUSPENDED since session 71**: every `Δ` in it, +19.40pp included, was
computed on `castSim`'s bare default arm, which reads meter-out 1.0% / catch ~70%
against the real fishery's 64.2% / 27.6%. The redraw fix is a **second**
invalidation of numbers that were already unquotable for a different and larger
reason. §0a also says explicitly: *do not re-run the oil sweep on the current
instrument to "check" — that produces a second unsupported number.*

So: **mark, do not re-derive.** A batch re-derivation on an instrument that has
not passed a profile check spends the session and produces figures no more
quotable than the ones it replaces. **The gating question is the instrument, not
the batch.** If anything gets re-derived, it should be preceded by the profile
check that §0a names as the precondition.

**Q3 (does 43.9 reopen redraw?) — the honest verdict is already written and I
would adopt it as-is.** Closed on **price**, not on **effect**: 43.9 mana per
extra fish against a cast holding 10 total is unaffordable, `escaped_mana` still
roughly doubles, and rule 4 bars a live change on a sim result regardless. The
7.6pp gain at |t| = 7.6 is real and is not noise, and the record should say so.
**§2 above adds one line to that verdict: the price itself is currently
author-only.**

**Q4/Q5 carry.** They cost nothing to defer and have survived three sessions.

---

## 8. Gate

**Set on things you control, per rule 6. Every one is offline, deterministic, and
needs no live budget and no `data/`.** If any turns out to be unreachable, say so
at the top of the session, not in the recap.

1. **A fresh clone's suite is green.** `tests/sim/fishingCorpus.test.ts:128` no
   longer asserts a count that git cannot carry, and its program-logic assertions
   still run for a stranger. Demonstrated by running the suite with `data/` and
   `logs/` moved aside — **not** by reasoning about it. *Meetable now: needs
   nothing but the repo.*
2. **`redrawBlastRadius.ts` and `liveGateFiringRates.ts` both fail closed on a
   missing input**, naming the path, exiting non-zero, printing no report.
   Demonstrated the same way. *Meetable now.*
3. **The retracted "understatement" claim is gone from `castSim.ts` and from
   `pConnectConsumers.test.ts`**, replaced by the measured direction. *Meetable
   now.*

Gates 1 and 2 are the session. Gate 3 is a five-minute edit and is grouped with
them because it is the same class of defect: **a conclusion that outlived its
evidence because nobody re-read the place it was written down.**

Not gated, do if there is room: §4's `.gitignore` line and DISTRIBUTION.md
reconciliation, §5's two one-line contradictions.

---

## 9. Do not

- **Do not start a dungeon run without its own explicit go-ahead**, and never
  chain. Do not start one at all before `doctor.ts` confirms the ledger rolled.
- **Do not re-derive OIL-POLICY.md's Δ figures on the current instrument** (§7,
  Q2). §0a forbids it by name.
- **Do not treat §2 as a claim that 43.9 is wrong.** It is a claim about
  reproducibility. Re-run it on the author's machine before changing any number.
- **Do not rewrite git history, create or push a repo, or delete committed
  files** (§4). Steps 3–6 are the user's.
- **Do not skip `tests/sim/fishingCorpus.test.ts` wholesale** to get gate 1 —
  that trades a red suite for a vacuously green one, which
  `tests/helpers/authorData.ts` exists to prevent.
- **Do not read run 4 against runs 1–3** (armor re-spec), and do not present any
  run as evidence about rule 8.
- Do not quote +19.40pp. Do not present a `castSim` result as evidence about live
  play. Do not report energy as a blocker. Do not tune the necessity thresholds.
- Do not give a new I/O-owning test construction a real data path.

---

## 10. Corrections to me, and one thing I got wrong before I started

- **I initially read STATE.md through `raw.githubusercontent.com` via a
  summarising fetch, and what came back was a paraphrase** — plausible, roughly
  right, and not the document. Numbers survived; structure, the "What's broken"
  section and all five open questions did not. **I only noticed because I then
  opened the local file.** If a future brief of mine cites STATE.md, it was read
  from disk or from the raw file in a clone, and I will say which.
- **I cannot see `data/` or `logs/`, and I should not have needed telling.** Two
  of my first three verification attempts were of figures that live only there.
  §0 states the boundary up front so you can discount the right claims rather
  than all of them.
- **§1, §2 and §3 are findings about what session 75 did not look at, not
  corrections to it.** Everything it reported that I could check was accurate, in
  every particular I tested. That is worth saying plainly, because a brief that
  opens with three defects reads like a rebuttal and this one is not.
- **Rule 9 still applies to this document.** If anything above is wrong against
  the corpus or a live response, **the corpus wins**, the claim does not get
  implemented as stated, and the correction goes in the recap so my next brief
  does not repeat it. That has happened twice; treat a third as expected.

---

## Your task (session 76)

1. `doctor.ts` first. Report both ledgers. If it is before 11:00 PT, say so and
   proceed offline — §1–§5 need nothing.
2. **§1 / gate 1** — clone-clean the suite. Fix `fishingCorpus.test.ts:128`,
   answer why the author-data guard missed a fifth file, and run
   `preflight.ts`.
3. **§2 / gate 2** — make both analysis scripts fail closed on a missing input.
4. **§3 / gate 3** — delete the retracted claim from `castSim.ts` and
   `pConnectConsumers.test.ts`.
5. **§4, §5** — if there is room: the `.gitignore` line, the DISTRIBUTION.md
   reconciliation, and the two rule-3 contradictions.
6. **§6** — only past 11:00 PT, only with a per-run go-ahead, only rule 11 terms.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** §1 and §2 are small in code and large in what they mean:
the repo is public and the two headline instruments of the last session cannot be
run by anyone who reads it — one fails silently and one produces a red suite on
the first command. Neither is a bug in the *conclusions*; both are bugs in the
*evidence being checkable*, which is the property this repo has spent seventy-five
sessions building. **The satisfying version of this session is that a stranger can
clone, run, and reproduce.** The unsatisfying version — and the likelier one — is
that §1's fix surfaces a sixth file of the same class, and then the honest finding
is the class, not the count.
