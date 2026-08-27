# BRIEF — session 103 — dungeon batch: up to 4 juiced runs, one at a time, human go-ahead before each (rule 11)

**This document replaces the session-102 `next.md`.** Session 102 is executed
and closed — QUESTIONS.md §60, STATE.md session 102. §C (the 20-cast fishing
batch) is DONE. **This session's task is dungeon-side only — fishing is out of
scope**, whatever the fishing ledger reads.

**Confirm the reset before doing anything else — do not assume the clock.**
STATE.md session 102 is dated 2026-08-26 and read the dungeon corpus at 79
attempts, 0 runs that day. A day has passed and the 11:00 PT rollover has
very likely happened, but CLAUDE.md rule 13 discipline stands regardless of
how obvious the answer looks: run `npx tsx scripts/checkDungeonToday.ts`
first and go by what `dayProgressEntities` reports, not by elapsed
wall-clock time. If it reads anything other than 0/12, say so plainly before
doing anything else — that means runs already happened today outside this
brief's tracking, and the "up to 4" below shrinks by that many.

---

# The batch — up to 4 juiced Tier-3 runs, never chained

**Rule 11 governs this whole session, and this brief is not the go-ahead it
requires.** The Ask-first list is explicit: starting any dungeon run needs an
explicit human go-ahead **for that run**, and "approval for one run is never
approval for the next." This document scopes what the batch is and how to
report it — it does not pre-authorize any of the four runs. Get the go-ahead
live, from the user, in this session, before every single run, including the
first.

1. `checkDungeonToday.ts` first (above, non-negotiable). Then `--dry-run` per
   rule 4 — exercise the juiced-entry path, the potion auto-load, and the
   in-room tier gate dry before spending anything.
2. **Ask the user directly: "Ready for run 1 of up to 4?"** Do not proceed on
   the strength of this brief alone. Wait for an explicit yes — a denial, a
   "not yet," or silence is not one.
3. Run one juiced Tier-3 entry per rule 11's four conditions, all of them:
   60-energy juiced entry, `--juiced-index=3`, 3x Big Heal Juice auto-loaded
   from `config/bot.json`'s `forbiddenWoods.potions` (itemId 131), and
   `--runs=1` — never more than one run per go-ahead. Do not allocate skill
   points; that is the user's, between runs, per rule 11 and the standing
   "never allocate them yourself" instruction.
4. **Stop. Report the run before asking about the next one.** Room reached,
   outcome (death / clear / incomplete), Hard Core, Dendren Root, energy
   spent, boon picks taken (confirm rule 8: highest non-Perpetual tier
   in-room, no-modifiers at the final room — Forbidden Woods `maxRoom` is
   16), potions used, any status effects logged (`Burn` / `Weak` /
   `Vulnerable` / `Regen` / `SecondWind` / `Steadfast`, with `amount` — §59)
   and any of the five proc booleans that fired (`blockProc` / `evadeProc` /
   `critProc` / `intuitionProc` / `tenacityProc` — §57/§58).
5. **Ask again before the next run** — same question, same explicit wait.
   Repeat through run 4, or until the user says stop, or until
   `checkDungeonToday.ts` reports the daily cap reached
   (`dayProgressEntities` at 12), whichever comes first.

## Why these runs, beyond the daily allowance

The dungeon corpus has taken 0 live runs since session 99 — three sessions of
fishing-only work. Nothing here needs a fresh experimental design; a handful
of standing measurements from §58/§59 are thin specifically for lack of
volume, not for lack of a rule to test, and ordinary play adds to them for
free:

- **`SecondWind`'s trigger** — magnitude exact, trigger undetermined, n=10
  fires only.
- **`Steadfast` debuff immunity** — consistent (0/11 vs an expected ~0.3) but
  "underpowered and proves nothing" per §59 at that n.
- **`tenacity`/`intuition` mechanics** — still ruled out as damage
  mitigation, still no positive mechanic identified.
- **Room-10 opponent-model confidence** — reads `confidence=low` at n=5
  (§56 — left open, no action ordered, but every deep run adds to it
  passively).

**None of this licenses shaping a run toward anything.** Rule 8's
tier-taking, the boon-priority config (`orbRule: "wide"`), and rule 11's
juiced-entry are unchanged and un-gamed. Report whatever these four runs
produce as ordinary play at higher volume — the same posture session 102
took reporting the fishing necessity-gate's first firing (§55/§60), not a
targeted test of any of the four items above.

## After the batch, or after any run that comes back denied, blocked, or interrupted

- **Re-read `checkDungeonToday.ts` before reporting what happened.** CLAUDE.md
  rule 13: a permission denial racing execution is not proof nothing ran — go
  by the server's own `dayProgressEntities` count, never by what the harness
  said back, and never re-issue a denied run on the strength of the denial
  alone.
- Regenerate `handoff/reports/dungeon-runs.md` (`scripts/dungeonReport.ts`)
  and report the corpus deltas: attempt count (79 → ?), death-room
  histogram, total Hard Core / Dendren Root / energy.
- If the status-effect or proc-boolean counts moved enough to change §58's or
  §59's n's meaningfully, state the new n's explicitly — "more data" is not a
  number.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4` — the default over-subscribes this machine and
produces false timeout failures, session 100's finding), `tsc --noEmit`,
`git diff --check`, secret scan. State explicitly, at the top of the recap:
how many of the (up to) 4 runs actually happened and why it stopped where it
did (user said stop / ledger capped / a fail-closed condition tripped), each
run's room-reached and outcome, and the updated corpus totals. If the ledger
read anything other than 0/12 on arrival, say so plainly at the very top,
before anything else.
