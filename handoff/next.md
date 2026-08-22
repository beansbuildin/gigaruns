# BRIEF — session 77

## 0. How this brief was written

Same method as session 76's, and the same limits. **Every claim below about what
a file contains or does was produced by running it**, in a fresh
`git clone` of `beansbuildin/gigaruns` checked out at **`26a3404`**, `npm ci`, on
a machine with **no `data/`, no `logs/`, no `~/.secrets`** — a stranger's tree.

That is now the right instrument for most of this brief, because §1 and §2 of
session 76 were *about* that tree. It is still no help at all for anything
derived from `data/` or `logs/`, and I have not tried.

**All three gates PASS on independent re-run. Verbatim:**

```
npx tsc --noEmit                          clean
npx vitest run     Test Files  87 passed (87)
                        Tests  1429 passed | 13 skipped (1442)
npx tsx scripts/redrawBlastRadius.ts      ✗ 2 required inputs unusable   EXIT=2
npx tsx scripts/liveGateFiringRates.ts    ✗ 3 required inputs unusable   EXIT=2
```

**GATE 1 PASS** — a stranger's first command is green, and I am the stranger.
**GATE 2 PASS** — both scripts name the missing paths, say what each was for,
print no report, exit 2. **GATE 3 PASS** — the retracted claim is gone from both
sites and restated in the measured direction at `castSim.ts:620–655`.

*One number to not misread: I see **13** skips where the export table says 15.
That is correct in both. The export prunes `handoff/`, so the suites that assert
over it skip there and RUN here. Same code, different tree, different denominator
— which is the whole lesson of §1 and is worth stating so nobody files it as a
discrepancy.*

---

## The clock and the ledger

Written **2026-08-22, 08:15 PT**. *Derived from session 76's reads, not observed.*

Both ledgers were exhausted before session 75 closed and roll at **11:00 PT
today** — **~2h45m out at the time of writing**. Session 76 opened 07:22 and shut
at 08:05, both inside the dead window.

**If you open after 11:00 PT you have a full day: 12 run-units and 20 casts.**
If you open before it, §1 and §2 are the session and need nothing.

**`doctor.ts` first, both ledgers, report them.** This paragraph is arithmetic
and rule 13 exists because arithmetic about ledgers is not authority.

*Environment, sessions 66–76: `npx tsx` and `git` both fail under the command
sandbox. Run unsandboxed. Not a repo problem.*

---

## 1. The seventh file exists. I found it, and it is not the shape you were looking for

STATE.md open question 1 asks whether a ratchet for the vacuous-pass shape is
worth building, or whether reading is enough, and says **"assume a seventh
exists — nothing yet searches for this shape."**

**I built the ratchet. It took fifteen lines and one suite run. There is exactly
one, and reading would not have found it — because it has nothing to do with
author data.**

### 1a. The instrument

Vitest already tracks assertion counts per test; nothing needs to be written but
the reporting. A setup file, added via a throwaway config so the repo is
untouched:

```ts
// vacuous-setup.ts
import { afterEach, expect } from "vitest";
import { appendFileSync } from "node:fs";

afterEach((ctx) => {
  const calls = (expect.getState() as { assertionCalls?: number }).assertionCalls ?? 0;
  appendFileSync(process.env.VACUOUS_OUT!, JSON.stringify({
    file: (ctx.task as any)?.file?.name,
    name: (ctx.task as any)?.name,
    mode: (ctx.task as any)?.mode,
    calls,
  }) + "\n");
});
```

```ts
// vitest.vacuous.config.ts — the shipped config plus:
setupFiles: ["./vacuous-setup.ts"],
fileParallelism: false,
```

Result over the whole suite in a stranger's clone: **1429 tests recorded, exactly
ONE with zero assertions.** Skipped tests never run the hook, so the 13 declared
skips do not pollute it.

### 1b. What it found

```
tests/dungeonSim.test.ts:177
  "halts rather than inventing a move when every move is locked"
```

```ts
const r = simulateRun({ policy: fixedPolicy("rock"), opponent: fixedPolicy("rock"),
                        chargesAreHardLimit: true, seed: 1, maxRooms: 1 });
if (r.outcome === "halted") expect(r.reasons).toContain("CHARGES_ALL_LOCKED");
```

**I probed the branch. It never runs.** Same call, seeds 1, 2, 3, 7, 42, 99:

```
seed=1  outcome=cleared reasons=[]     seed=7   outcome=cleared reasons=[]
seed=2  outcome=cleared reasons=[]     seed=42  outcome=cleared reasons=[]
seed=3  outcome=cleared reasons=[]     seed=99  outcome=cleared reasons=[]
```

**`outcome` is `cleared` every time. `CHARGES_ALL_LOCKED` is asserted by nothing,
and has never been asserted by this test.** A fixed-rock policy at `maxRooms: 1`
clears the room long before the other two moves run down, so the state the test
is named for is not constructed. The test has been green and empty since it was
written.

### 1c. Why this is the important half, and why it changes the class

**It is not author-data-dependent.** No `data/`, no `logs/`, no `existsSync`. It
is vacuous in your tree exactly as it is in mine. So:

- **Neither detector open question 1 proposes would find it.** Not a grep for
  `existsSync(...)) return` inside an `it` — there is no filesystem call. Not a
  test-count diff between the local run and the export — the count is *identical*
  in both, because the test runs in both and passes in both.
- **`probeAuthorData` has no bearing on it.** The guard session 68 built and
  session 76 extended is the right guard for its class and cannot reach this.
- **Sessions 68 and 76 both scoped the class to shipping hygiene.** That was the
  visible cause, not the class. **The class is "an assertion that does not run",
  and a missing author file is only one way to get there.** A conditional with no
  else is another. An empty loop body is a third and nothing yet looks for it.

### 1d. And the grep would have ratcheted on false positives

I also ran the static version — every `it` whose *only* `expect` sits behind an
`if`. It returns **three**:

```
tests/noHardcodedPaths.test.ts:168              the three entry points are NOT in the unconverted set
tests/dungeonSim.test.ts:177                    halts rather than inventing a move when every move is locked
tests/orchestrator/dungeonArmClosed.test.ts:140 never sleeps waiting for dungeon energy it will never spend
```

The runtime instrument shows the other two **do** assert — their conditions hold,
so they are conditionals that happen to be live. **Three candidates, one real.** A
grep ratchet pinned at three would ratchet two false positives into permanence and
teach the next reader to ignore it. The runtime count has no false positives by
construction: it measures the thing itself.

### 1e. What to do with `dungeonSim.test.ts:177` — and what NOT to do

**Do not make the assertion unconditional.** That converts a vacuous pass into a
red suite without testing anything, because the state still is not constructed.

Two honest options, and picking is part of the work:

1. **Construct the state.** Raise `maxRooms`, or drive charges down with a policy
   that actually exhausts them, until `outcome === "halted"` and
   `CHARGES_ALL_LOCKED` is in `reasons`. Then assert unconditionally. This is the
   better outcome: the halt path is real code and `chargesAreHardLimit` is a
   guard that matters.
2. **Delete it and record the gap.** If the halt path cannot be reached from the
   sim's public surface, say so in `TASKS.md` or `QUESTIONS.md` rather than
   leaving a test that claims coverage it does not have.

Either way the test's *name* stops being a claim nothing supports.

---

## 2. `preflight.ts` in CI — the question is five sessions old and there is no CI at all

**`ls -a` at the repo root: there is no `.github/` directory.** No workflows, no
Actions, nothing. So this is not "should preflight run in CI" — it is "should
this repo have CI", and the answer has been deferred since session 68.

Session 76's STATE.md sharpens it correctly and the sharpening is the argument:
**`preflight.ts` exports from the git INDEX, so a test written after the last
manual run is invisible to it. Push-triggered CI is exactly the trigger that
closes that gap, and a pre-commit hook is not.** That is why eight sessions ran
with a stranger's first command red while the instrument that would have said so
sat in the tree.

A minimal workflow does four things, all of which are already scripted:

```
on: push
  npm ci
  npx tsc --noEmit
  npx vitest run                      # the stranger's view — no data/, no logs/
  npx tsx scripts/preflight.ts        # the export's view, plus the secret scan
```

Two notes that matter for getting it right:

- **A CI runner IS the stranger.** It has no `data/`, no `logs/`, no
  `~/.secrets`. That is a feature: the author-data suites will announce their
  skips there exactly as designed, and the green/red signal is precisely the one
  §1 of last session was about. Do not add author data to CI to make more tests
  run — that destroys the property being tested.
- **Add §1's assertion-count check to the same job.** It costs one setup file and
  one run, it is the only thing that sees the shape `preflight.ts` structurally
  cannot, and CI is where a ratchet belongs.

**If the answer is no, close it as a decision with its reason rather than
carrying it a sixth time.** Either is a legitimate outcome; carrying is not, and
the carrying has itself now cost eight sessions of red.

---

## 3. The published-exposure items — a distinction session 76's wording blurs

**No agent action. This is the user's call and stays the user's call.** It is
here because STATE.md open question 3 asks it, and because the answer depends on
a distinction that got compressed.

STATE.md says `.gitignore` now carries `.claude/*.bak` but that this "does not
untrack the copy in history." **Those are three different things, not two:**

1. **Stop the next one.** `.gitignore` — done, session 76.
2. **Stop publishing this one.** `git rm --cached .claude/settings.local.json.bak`
   plus a commit. **This is not a history rewrite**, invalidates no clone, changes
   no hash. The file leaves the working tree of every future commit; it remains in
   the old ones.
3. **Remove it from history.** A rewrite. Invalidates every clone and commit hash,
   and `fixtures/README.md` already argues at length why this repo declined that
   for the noob token.

Session 76 did 1, and correctly did not do 2 or 3 without the user. **Worth
knowing that 2 exists and is cheap**, because the wording reads as though the only
alternative to `.gitignore` were a rewrite. The same applies to the username in
`handoff/log/session-{01,15,35,37}.md` — those are four `RUN` header lines and can
be edited in place going forward at no cost to anything.

The precedent for the third option is on the record and is good: `romId` in
`SPEC.md`, and the noob token — **accepted exposure, deliberate, recorded**. If
that is the answer here too, record it the same way, in `fixtures/README.md` or
`DISTRIBUTION.md`, so it is not rediscovered as a finding in six sessions.

---

## 4. The live budget, if you are past 11:00 PT

**Nothing above needs it. This section is subordinate and every item in it needs
its own go-ahead.**

Rule 11 terms unchanged: **60-energy juiced, `--juiced-index=3`, 3× Big Heal
Juice, `--runs=1`, stop and hand back. Each run needs its own go-ahead; approval
for one is never approval for the next.** Rule 13 after every run, including one
the harness reports as denied. `--dry-run` first if the dungeon path has not run
since session 75.

**The item I would spend the budget on, and the reason:**

> **The forced Relaxing consume.** *Carried unspent since session 73 — four
> sessions.* The record says, in STATE.md after STATE.md: **"no oil payload has
> ever been measured, because no oil cast exists."** The oil row of session 72's
> gate 1 still fails (50.1% sim vs 78.6% live, n=14) and cannot be re-checked. And
> the two live questions `OIL-POLICY.md` §1 names as *load-bearing* — does
> `use_fishing_item` advance the fish, and does it cost mana — are both answerable
> by **one** deliberate cast.

Four sessions of "it costs nothing to defer" is true item-by-item and false in
aggregate: it is now the oldest unspent thing on the board, and every session that
defers it re-quotes a suspended figure it could have started to unstick.
**Deferring a fifth time is a decision worth making explicitly rather than by
default.** The era batch (session 73/74 §4) is the natural companion and its
design is still valid and untouched.

Dungeon runs are the alternative use and are worth less right now: boon coverage
moved last session (orb 6→7, priority 2→5), §23 is re-fit at n=11, and rule 8's
programme is CLOSED. **Do not read run 4 of session 75 against runs 1–3** — the
armor re-spec landed between them.

---

## 5. Gate

**Both gates are offline, deterministic, need no live budget and no `data/`.**
Set on what you control, per rule 6. If either turns out unreachable, say so at
the top of the session.

1. **Nothing in the suite asserts zero.** The assertion-count check from §1a runs
   as part of the repo — a script, or the shipped config — and reports **0**
   zero-assertion tests where it reports 1 today. `tests/dungeonSim.test.ts:177`
   either constructs the halt it is named for and asserts unconditionally, or is
   deleted with the coverage gap recorded. **Demonstrated by running the check
   before and after, not by reasoning about it.**
2. **The CI question is CLOSED**, either by a workflow that runs `npm ci`,
   `tsc --noEmit`, the suite, `preflight.ts` and §1's check on push — **verified
   green on a real run, not just committed** — or by a recorded decision not to,
   with its reason, in `DECISIONS.md`. Five sessions open is long enough that
   "still open" is no longer an acceptable end state.

Not gated, do if there is room: §3 is the user's; §4 needs the ledger and a
go-ahead.

---

## 6. Do not

- **Do not make `dungeonSim.test.ts:177`'s assertion unconditional without
  constructing the halt** (§1e). That trades a vacuous pass for a false failure.
- **Do not ratchet on the grep.** Three candidates, one real (§1d). Pinning the
  count teaches the next reader to ignore the alarm.
- **Do not put `data/` or `logs/` into CI** to make more tests run (§2). The
  stranger's view is the thing being tested.
- **Do not rewrite git history, create or push a repo, or delete committed files**
  (§3). Steps 3–6 remain the user's.
- **Do not start a live run without `doctor.ts` confirming the ledger rolled**,
  and never chain runs (§4).
- **Do not re-derive `OIL-POLICY.md`'s Δ figures on the current instrument.** §0a
  forbids it by name. **Do not quote +19.40pp.**
- Do not present a `castSim` result as evidence about live play. Do not report
  energy as a blocker. Do not tune the necessity thresholds. Do not read run 4
  against runs 1–3. Do not give a new I/O-owning test construction a real data
  path.

---

## 7. Corrections to me

- **My session-76 brief scoped the vacuous-pass problem wrongly, and session 76
  inherited the error.** I framed §1 and §2 entirely as *distribution* defects —
  "a stranger can clone, run, and reproduce". Session 76 executed that framing
  exactly and its open question 1 asks for detectors shaped to it: `existsSync`
  greps and export-vs-local count diffs. **Both are shipping detectors, and the
  seventh instance is not a shipping defect.** The class is an assertion that does
  not run; shipping is one cause of it. I gave the frame and the frame was too
  narrow.
- **I asserted "assume a seventh exists" was worth acting on but did not act on
  it, and it cost one suite run to settle.** Fifteen lines and sixty-five seconds.
  If a brief of mine says something is worth checking and the check is cheap,
  **the check belongs in the brief, not the recommendation.**
- **§1's numbers are from a clone, so one thing is untested:** whether the same
  detector finds *more* zero-assertion tests in your tree, where the 13 skipped
  suites actually run. **It might.** Run it there before concluding the count is
  one — that run is the first thing gate 1 should do, and it is also the exact
  local-vs-export diff open question 1 asked for, arriving from the other side.
- **Rule 9 still applies to this document.** If anything above is wrong against
  the corpus or a live response, the corpus wins, the claim is not implemented as
  stated, and the correction goes in the recap.

---

## Your task (session 77)

1. `doctor.ts` first. Report both ledgers. Before 11:00 PT this is an offline
   session and §1–§2 are the whole of it.
2. **§1 / gate 1** — run the assertion-count check **in your tree first** (it may
   find more than my one), then resolve `dungeonSim.test.ts:177` by constructing
   the halt or deleting it, then wire the check into the repo.
3. **§2 / gate 2** — close the CI question in one direction or the other, and if
   it is a workflow, prove it green on a real push.
4. **§3** — user's call; ask it, do not act on it.
5. **§4** — only past 11:00 PT, only with a per-run go-ahead, only rule 11 terms.
   The forced Relaxing consume is the item I would put the budget on.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** §1 is a small edit sitting on top of a finding that is
larger than the edit: **the repo has spent three sessions building guards for
tests that go quiet when a file is missing, and the one test that was actually
silent went quiet for a reason none of those guards can see.** The satisfying
version of this session is that the check goes into CI and the count is pinned at
zero. The unsatisfying and likelier one is that running it in your tree finds two
or three more, and then the finding is not the seventh file — it is that
**nothing in this repo has ever asked whether an assertion ran**, and the number
was never one.
