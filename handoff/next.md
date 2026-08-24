# BRIEF — session 88 — three juiced dungeon runs, one pause each, nothing else live

**Scope, stated plainly up front:** this session's only live task is three juiced
Forbidden Woods runs, one at a time, with an explicit stop after each one so the
user can allocate skill points before the next go-ahead. That is not a subset of
a bigger plan — it is the whole plan. **Fishing's budget is left unspent by
design**, not because it ran out of room; say that once in the recap and move on,
it is not a shortfall to apologize for.

Why three: session 87 closed with `dayProgressEntities` **3 of 12 — 9 units / 3
juiced runs remaining today.** Three is exactly what was left, which is probably
why the user asked for three rather than four. §0 below is what confirms that is
still true when this session actually starts, rather than assuming it.

---

## 0. Verification, the clock, and rule 9

Fresh clone, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     expect clean
npx vitest run                       expect 99 files / 1603 passed / 70 failed
```

**The 70 failures are RED BY USER DIRECTIVE, not a regression to chase.** Session
87 offered the user three ways to handle a batch that falsified several pinned
claims (mechanical-counts-only, update-everything, or leave-red-and-recap) and
they chose the third. `handoff/STATE.md`'s "What's broken" names the six that are
findings rather than count drift (`neither = 0` → `6`, dead hands 15 → 32,
`wasted` 0 → 3, the "thirtyfold" budget-zero drop → ~6.5x, SPEC-fishing §4's
`fishHp` exceptions 3 → 6, `REAL_DECK` no longer matching the account's rod) plus
one that's neither (`WeakeningMastery`'s new, unmodelled boon pair). **Do not
"fix" any of these to make the suite green.** Rewriting a pinned structural claim
to match new data is the renegotiation `matcherVerdict.ts` exists to prevent —
it's the user's call, not an agent's, exactly as session 87 left it.

**Rule 9 applies to this whole brief.** I have read `handoff/STATE.md` (session
87), `handoff/next.md` (session 87's brief, superseded by this one),
`handoff/scratch-session-87.md`, `handoff/reports/dungeon-runs.md` (regenerated
post-batch: 68 recorded attempts, 59 deaths, 0 cleared, 9 incomplete/stopped, 23
juiced), `QUESTIONS.md` §23, `CLAUDE.md` rules 6/8/11/12/13, `PROTOCOL.md`,
`config/bot.json`, and the DECISIONS.md entries for sessions 82 and 87 covering
the energy probe and `WeakeningMastery`. **I have NOT opened
`scripts/liveRun.ts` beyond its CLI surface (`parseArgs`/`USAGE`),
`src/strategy/enemyTier.ts`, or `src/sim/boons.ts`.** Every claim below about
what those do is second-hand from the recap and QUESTIONS.md — open them before
acting on any of it.

### The clock and the ledger — read before assuming the budget is what it was

Session 87's 9-units/3-runs figure is a claim from that session's wall clock, not
from the server, and it rolls over at 11:00 PT. Depending on what time this
session actually starts, the real remaining budget could be that same carried 9
units, or a fresh 12 (4 juiced runs) if the day has already turned over. Don't
assume either — read it:

```
npx tsx scripts/doctor.ts
npx tsx scripts/checkDungeonToday.ts       # dayProgressEntities
npx tsx scripts/checkFishingCaps.ts        # dayDocs[pondId=2], for completeness only — not spending it
```

**Rule 6 obligation:** if the dungeon ledger reads fewer than 9 units remaining
(i.e., fewer than 3 full juiced runs are actually available), that is an
unreachable gate — say so **at the top of the session**, run as many complete
juiced cycles as the real budget allows, and stop short rather than improvising
a partial run. If it reads a fresh 12/4 instead (the day rolled over), that's
comfortably inside three — proceed as below, and **leave the fourth run
unspent, on purpose.** The user asked for three, not four; record that as a
decision, not an oversight, exactly the way session 87 recorded not spending
fishing's budget in session 85.

---

## 1. The three runs

### 1a. Before run 1 — one dry run

`--dry-run` first, always (rule 12). The dungeon path executed cleanly as
recently as session 87, so this is not expected to surface anything new, but
skipping it is exactly how an invented blocker gets discovered the hard way if
`config/discovered.json` or the potions config has drifted since.

```
npx tsx scripts/liveRun.ts --dry-run
```

### 1b. Each of the three runs, identically, one at a time

```
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1
```

**Rule 11's four conditions bind on every one of the three, with no exceptions
for "we already did this once this session":**

- 60-energy juiced Tier-3 entry (`--juiced --juiced-index=3`). Charges 3 of the
  daily 12 run-units, same as always.
- 3× Big Heal Juice (itemId 131), already permanent in `config/bot.json`'s
  `forbiddenWoods.potions` — nothing to add or remove.
- `--runs=1`, every time. One run per invocation.
- **A separate human go-ahead before each of the three runs.** Approval for run
  1 is not approval for run 2, and approval for run 2 is not approval for run 3.

**After EACH run, before asking for the next go-ahead:**

1. **Rule 13, unconditionally.** Read `checkDungeonToday.ts`'s
   `dayProgressEntities` and confirm it moved by exactly 3. If any command
   reports denied, blocked, or interrupted, read the ledger before believing
   it — the classifier's denial has raced execution before (run 24945829,
   session 61). Report any discrepancy in the recap with both numbers; don't
   reconcile it quietly.
2. **Record the `EV support: n/m` line and the `start_run_energy_probe`'s
   `tightDelta`, for every run, present or absent.** Both instruments are
   confirmed working now — session 87 was the first time either ever fired —
   so silence from either one this time is itself a finding worth stopping on,
   not a shrug. It's informative either way if `tightDelta` keeps reading -60
   across all three, or doesn't.
3. **Rule 8** governs in-room tier choice on every run: highest tier among
   non-Perpetual options, no-modifiers at the final room, keyed on the
   server's `maxRoom` (Forbidden Woods 16), never a hard-coded number.
4. **Then stop.** Hand back for the user to allocate skill points. Do not
   issue the next run's command until that go-ahead is given — this is the
   pause the user asked for, and it is also just rule 11 as written.

### 1c. What a normal run looks like, so a short one isn't read as a regression

68 recorded attempts as of the post-batch regeneration: 59 deaths, 0 cleared, 23
juiced. Juiced deaths since rule 11 shipped span rooms 3–10, with the most
recent (25035508) at room 8. A room-3 or room-4 death is within the normal
spread, not a sign anything is wrong with the harness — the gate below is on
the instruments firing, not on depth reached.

---

## 2. Opportunistic — take, don't chase

- **One base-6/8/10 crit still outstanding.** Card 10 (crit 10) is in the deck
  — ×1.5 → 15 against ×1.6 → 16. `critEffects`, not `hitEffects`. Take it if
  it appears in one of these three runs; don't engineer for it.
- **An oil consumed at a non-zero meter remains impossible** while Focus Oil
  stock is 0 (unchanged since session 87) — not reachable from the dungeon
  side at all regardless. Listed only so a future brief doesn't re-flag it as
  newly open.
- If `WeakeningMastery`'s pair (first captured run 25035508, states 059→060)
  recurs, that's just more of the same fixture — nothing to do differently in
  the run itself.

---

## 3. Not gated — offline, only if there's room, only after all three runs

Two small items, zero live spend, using material already on disk. Neither
blocks the gate below.

- **§23's remaining half.** The charge is confirmed 60 and something inside the
  run credits 1 back during it (regen at 18/hr against an integer pool is the
  leading candidate, not asserted). Run 25035508's own log has every state —
  this is a read, not a run.
- **`WeakeningMastery` has a pair and no model** (`boons.test.ts` fails on it).
  Whether to build the model from the existing fixture is small and
  self-contained. If there's no room, flag it in the recap rather than starting
  it and leaving it half-done.

If there's no room for either, they carry to session 89 exactly as §23's other
half carried out of session 87.

---

## 4. Gate

1. The ledger was checked **before** assuming the 3-run budget exists (§0).
2. Three juiced runs, `--dry-run` before the first, **a separate human
   go-ahead before each**, rule 13 read after each, and the `EV support` line
   plus `tightDelta` reported for every run — present or absent, stated either
   way.
3. A pause after each run with **no next-run command issued** until the user
   has confirmed skill points are allocated and given the go-ahead.

**What would make this unmeetable:** the ledger reading fewer than 3 full
juiced runs' worth of budget at session start. Say so at the top, run what the
budget allows, and don't fudge a partial run to hit the number three.

**What does NOT meet the gate:** any run started without its own go-ahead; two
runs chained without a reported pause between them; a shallow death used as a
reason to stop early without asking the user first; a fourth run started
because a fresh day's ledger happened to allow one.

---

## 5. Do not

- **Do not allocate skill points yourself.** That is the user's action between
  runs and the entire reason the pause exists.
- **Do not touch fishing this session.** The 20-cast budget is left unspent by
  design — note it once in the recap as a scope choice, not a shortfall.
- **Do not "fix" any of the six flagged red-suite reversals** from session 87
  (`neither = 0` → 6, dead hands 15 → 32, etc.) to turn the suite green. They
  are the user's to rule on.
- **Do not answer §28** or touch `redrawEnabled` / `REDRAW_THRESHOLD` — still
  open, still the user's.
- **Do not start a fourth run**, even if the ledger shows a fresh day's 4
  available. The user asked for three.
- Standing, none re-opened: `boonCapture` OFF; no H2 proc model; no M4 lines;
  no 429 backoff without an observed 429; do not shuffle the random-sample
  deck; do not revert rule 8; do not un-suspend +19.40pp; §25 stays PARKED.
- **`npx tsx` and `git` fail under the command sandbox. Run unsandboxed.**

---

## Your task (session 88)

1. `doctor.ts`, `checkDungeonToday.ts`, `checkFishingCaps.ts`. State the real
   remaining dungeon budget before doing anything else.
2. `--dry-run` once.
3. Three juiced runs, one at a time: go-ahead → run → rule 13 check + `EV
   support` line + `tightDelta` reported → **stop and wait for the user's
   skill-point allocation and next go-ahead** → repeat, twice more.
4. If there's room after all three: the two offline items in §3, clearly
   labelled as bonus, not gating.
5. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit, `assertionCoverage` at zero vacuous, `preflight.ts` after
   committing fixtures and before the push, no test writes a real data path,
   secret scan. State plainly that the suite is still red for the reasons
   pinned in session 87, unless the user has ruled on them by then.

**Honest expectation.** The satisfying version of this session is three clean
pauses, three `EV support` lines, and three `tightDelta` reads that agree with
session 87's −60 — and the user leaving with three skill-point allocations
banked. The likely version includes at least one death before room 5 along the
way, and that is still exactly the budget being spent as intended. **The one
outcome that would waste the session is chaining two runs without the pause**,
because that is the specific thing rule 11 and this brief both exist to
prevent, and nothing in the recap would show it happened until the user asks
why they never got a chance to spend their skill points.
