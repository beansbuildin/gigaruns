# BRIEF — session 109 — the remaining 2 Tier-1 dungeon runs, one at a time, standard rule 11

**This document replaces the session-108 `next.md`.** Session 108 is executed
and closed — 4 chained Tier-1 runs GATE PASS, but with a real cost: a
potion-policy sharing bug burned 9 Big Heal Juice across runs 2-4 (STATE.md
session 108, `DECISIONS.md` 2026-08-29). **The fix is already landed and
verified** (`runPotionPolicyFor` in `scripts/liveRun.ts`, regression test in
`tests/potions.test.ts`, full suite green 2121/2121) — this is not new work,
it's a precondition to check before spending anything.

**Before doing anything below, read STATE.md's "Settled — do not re-open"
digest.** Nothing in this brief should duplicate an entry in that digest — if
anything below looks like it might, that's this brief being wrong, not the
digest being stale.

**Chaining does NOT apply this session.** Session 108's `--runs=4` was a
one-time, dated exception and does not carry forward (DECISIONS 2026-08-29).
This brief authorizes **`--runs=1`, twice, separately, with a stop and a
fresh go-ahead between them** — standard rule 11.

---

## Step 0 — confirm the fix before spending anything

Do not run either dungeon run until this is confirmed on the actual code at
HEAD, not assumed from the recap:

1. Confirm `scripts/liveRun.ts` calls `runPotionPolicyFor(...)` **inside**
   the per-run loop (once per iteration), not once before it. The bug was a
   single shared, mutated object; the fix is a fresh object per run.
2. Run `tests/potions.test.ts` specifically and confirm all four
   `runPotionPolicyFor` cases pass, especially "hands each run its own
   object, so mutation cannot leak across runs."
3. If either check fails or looks different from what's described above,
   **stop and report it** — do not proceed to a live run on an unverified
   fix. This step exists because the last live batch is exactly what
   surfaced the bug; verifying in code, not by re-reading last session's
   recap, is the point.

## The 2 remaining runs

- **6 run-units are available in today's fresh window** (STATE.md session
  108: the chained batch straddled the 11:00 PDT reset, leaving runs 3-4's
  spend in a new window with 6/12 used) — confirm this with
  `npx tsx scripts/checkDungeonToday.ts` first rather than assuming the
  number is still 6; today may have moved on. **6 run-units / 3 = exactly 2
  more juiced runs**, which is what this brief sizes for.
- Each run is `--dry-run` first (rule 4), then `--runs=1 --juiced
  --juiced-index=1` (Tier-1, 0 rings — settled, exercised live 8/8 already;
  do not re-verify as if new).
- **Stop after run 1. Report it. Get a fresh explicit go-ahead before run
  2.** This is the standard rule-11 behavior session 108 was an exception
  to, not the exception itself.
- Between the two runs, the user may allocate skill points (never allocate
  them yourself) — that's the normal reason for the pause, distinct from
  the potion-policy fix, which is a code correctness issue, not a
  human-decision one.
- Still 60 energy, juiced, per run; still 3x Big Heal Juice (itemId 131)
  auto-loaded per run. Both unchanged by anything above.
- Rule 8 (highest non-Perpetual tier; lowest/no-modifiers at the final room)
  governs every in-room `enemyPathOptions` pick in both runs, as always.

## Report potion firing explicitly, this session especially

For each of the 2 runs, state: potions committed (should be 3, debited at
`start_run`), potions actually fired (`use_item` count), and confirm they
match. This is the exact number that silently diverged last session — make
it a named line in the report both times, not just in the aggregate metrics
table, so a recurrence would be caught immediately rather than at recap
time.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan. State explicitly, at the top of the recap:

- Step 0's confirmation result — the fix was verified in code before any
  spend, and how.
- Whether both runs happened, or only the first (because the user didn't
  reconvene, or a real block occurred) — either is a normal outcome, not a
  shortfall.
- Per run: potions committed vs. fired (the number above), rooms cleared,
  Hard Core and Dendren Root totals.
- **Carried forward, unresolved:** STATE.md's open question 1
  (`LossBlockUp` modelling from n=1 — flagged as "the one blocking
  question" last session; still needs a user directive, out of scope for
  this brief to decide unilaterally), open question 3 (`nextPosition`
  override live, no sign-off), and open question 5 (whether Tier-1 is now
  the baseline for downstream dungeon reports — fifth session unaddressed).
