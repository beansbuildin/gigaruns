# BRIEF — session 87 — spend the budget: twenty casts, then runs one at a time

**This is a LIVE session.** Sessions 85 and 86 were both offline by user
directive and both were the right call. This one is not: the fishing batch is
the only instrument that answers §19, the corpus is the only instrument that
describes the bot, and **the budget that has now expired unspent twice is the
whole point of the session.**

---

## 0. Verification, the clock, and one thing that must land before the first cast

Fresh clone at `69721b9c`, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     expect clean
npx vitest run                       expect 99 files / 1666 passed
```

**Rule 9 applies to this whole brief.** I have opened `handoff/STATE.md`,
`handoff/next.md` (session 86), `handoff/log/session-86.md`,
`handoff/scratch-session-86.md`, `QUESTIONS.md` §19/§23/§28, `CLAUDE.md`,
`PROTOCOL.md`, `config/bot.json` and both generated reports. **I have NOT opened
`scripts/liveFishing.ts`, `scripts/liveRun.ts`, `scripts/matcherWeightReport.ts`
or `src/strategy/fishing/matcherVerdict.ts`.** Every claim below about what those
four do is second-hand from the recap and §19 — open them before acting on it.
Session 86's brief broke rule 9 on `redrawCounterfactual.ts`, and session 81's on
`policyApproved`, both on supporting claims rather than measurements. Naming my
own unread files up front is the cheap version of not making it three.

### The clock

Session 86 ran **11:37 → 15:16 PT on 2026-08-23**, after that day's 11:00
rollover, and spent **nothing**. So as this is written the ledgers hold **12
run-units and 20 casts, fresh and unspent, and they expire at 11:00 PT on
2026-08-24.** Unspent budget does not accumulate.

**That is a claim from the recap's wall clock, not from the server.** `doctor.ts`
wins, and so do:

```
npx tsx scripts/checkFishingCaps.ts      # dayDocs[pondId=2]
npx tsx scripts/checkDungeonToday.ts     # dayProgressEntities
```

**Rule 6 obligation:** §19's own scheduling precondition is that a fishing batch
is only schedulable in a session beginning after 11:00 PT on a day the caps have
not already been spent. If the caps read spent at minute one, **say so at the top
of the session and pivot to §5's offline item** — do not discover it at minute
five, and do not report it before running `--dry-run` (rule 12).

---

## 1. GATE 0 — freeze the memo's denominators BEFORE the first cast

**Offline, ~10 minutes, and it blocks everything live in this brief.**

Session 86's own scratch names the hazard precisely: *"The memo's numbers are
computed on the corpus AS IT STANDS (148 traces, 612 plays). That is a reason the
offline choice was the clean one: new casts would have moved every pinned corpus
figure in the same session the memo went out."*

**QUESTIONS §28 is OPEN and the user has not answered it.** The moment a cast
lands, the corpus is no longer 148/612/147, and every quantitative claim in
`handoff/reports/session-86-redraw-revisit.md` — 89.8% pooled mana slack, today's
88.9% / mean 6.26 / median 7, the 15/15 rescue at n=15, the 12.7% fire rate, the
11.8% dead-hand rate — is silently measured against a denominator the memo does
not describe. **A question asked on one corpus and read on another is not the
same question**, and the user is being asked to re-price a verdict on exactly
these numbers.

**What to do, and it is bookkeeping, not analysis:**

- Pin the corpus the memo was computed on as a **named snapshot** — the docId set
  or an `as-of` predicate, whichever the existing corpus loader already supports.
  Do not invent a new persistence path for it.
- Add one header line to the memo **and** to §28 naming that snapshot: *computed
  on 148 traces / 612 plays / 147 resolved, corpus as of 2026-08-23.*
- Nothing is recomputed. **Do not re-run the counterfactual, do not touch a
  number, do not "refresh" the memo.** The memo is delivered and awaiting an
  answer; this is a label on it, exactly as gate 1 last session was a label and
  not a fix.

**Do not** import `todaysEraCastIds()` into a committed test to do this — that
standing prohibition is unchanged and the snapshot lives beside the memo, not in
the suite.

---

## 2. The fishing batch — 20 casts, and the one thing they buy that nothing else can

Fishing is autonomous within budget (`dendren.maxCastsPerSession` 20). It does
not need per-cast approval and never has.

### 2a. §19, blocked five times, is now one command behind the batch

```
npx tsx scripts/matcherWeightReport.ts --last-casts=20
```

Everything except the twenty casts was built in session 55. §19 has been blocked
by the daily cap in sessions 51, 53, 54, 55 and 85/86's offline directive — **five
sessions, none of them on merit.** This session is the precondition.

Three things §19 already establishes, and each is a trap if forgotten:

- **`matcherWeight` is absent from all 129 pre-session-51 rows**, and
  `matcherWeightOf()` back-fills the old fixed `0.9` when it is missing —
  which reads as *"pi is high on every turn"*, **the exact conclusion §19 exists
  to test.** `matcherVerdict.ts` reads the raw field and treats absence as NOT
  MEASURED. **If the report returns `INSUFFICIENT_DATA`, that is the answer, not
  a reason to widen the window.** Rule 10 in its purest form.
- **Session 51's decision rule is CODE, not prose.** KEEP / DROP /
  `EARNED_BUT_UNPAID` come out of `matcherVerdict.ts`. Record what it returns.
  **Do not renegotiate the rule once the numbers are visible** — the honest answer
  may well be "drop the thing two sessions built", and that is why the rule was
  written down before the data existed.
- **Record the library's support at batch time.** It was 3 de-aliased patterns
  (perimeterWalk cw 4, ccw 4, bounce(2,0) 3), **11 of 88 clean casts**,
  pi_0 ≈ 0.133. `supportingCastCount`'s denominator is CLEAN casts, not traces —
  88, not 89.

### 2b. The oil capture: take it if it comes, do not arrange it

Oils are authorised — `dendren.oils.policyApproved` is now **true**, items 942
(Mid Focus) and 937 (Mid Relaxing), `maxPerCast` 3 with 937 capped at 2. Spending
them inside that budget is not a blocker and not a question.

**The standing capture is an oil consumed at a NON-ZERO meter**, which settles
add-2 versus restore-to-2. On-demand timing fires oils at meter-out, and today's
bot reaches meter 0 on ~**1.5%** of plays — so twenty casts are unlikely to
produce this by accident, and it is getting *harder*, not easier.

**Do not arrange it.** Forcing an oil at a non-zero meter is a live-policy
deviation and it is the user's call, not a setup an agent quietly performs. If it
happens, dump the full response. If it does not, say so in one line and leave
add-2-vs-restore-to-2 exactly where it is.

### 2c. What the twenty casts are worth beyond §19

Today's era is **54 casts**, and §2 of last session's memo rests on the **15 dead
hands** inside it. Twenty more casts is roughly a **37% increase in the era that
carries the whole redraw argument.** Session 86's own dead end — *"there is no sim
arm that could re-derive 43.9 honestly"* — is the reason: bare is the oracle arm
at +41.9pp, blind never aims, live-config is closest and still +4.0pp, and the two
candidates fail in opposite directions. **The corpus is the only instrument that
describes this bot.** Growing it is the highest-value thing 20 casts can do.

After the batch: `npx tsx scripts/regenerateReports.ts`, and if you re-read any
era-split figure, **report it as a NEW row beside the frozen one from gate 0,
never over it.**

### 2d. Fishing do-nots, all standing

- **No shadow instrumentation.** §26 is blocked behind §28 and §28 is unanswered.
  The order was the user's directive: revisit first, instrument second.
- `redrawEnabled` stays false. `REDRAW_THRESHOLD` stays 0 and untouched.
- Do not present 15/15 as 100%. n=15.
- Do not shuffle the random-sample deck. `DEFAULT_POTION_THRESHOLD` and
  `chooseNewCard` stay untouched.

---

## 3. The dungeon runs — after the fishing, one at a time, with two probes armed

**Rule 11 governs every clause of this and none of it is an agent's to relax:**
60-energy juiced Tier-3 entry (`--juiced --juiced-index=3`), 3× Big Heal Juice
(item 131, already permanent in `config/bot.json`), `--runs=1`, **a separate human
go-ahead for each run**, and stop and hand back when it finishes. Never chain.
Twelve run-units is **4 juiced runs**, ceiling, and the server enforces it.

**`--dry-run` first.** The dungeon path has not executed since session 82 — four
sessions — and twenty seconds of dry run is the difference between a real blocker
and an invented one (rule 12).

### 3a. Two instruments that ride free on the first run, and both are the point

**(1) `finishRun`'s `EV support: n/m` line has still never printed on a real
run.** Built session 78, found unreachable session 82, fixed session 84, never
exercised. One juiced run prints it.

⚠ **If run 1 completes and the line does not print, that is a FINDING — stop and
report it before asking for run 2.** A fix that was verified in test and stays
silent on the third live attempt is worth more as a stopped session than as a
retry.

**(2) §23's `start_run_energy_probe` is BUILT, ARMED, and has never fired.** Two
GETs around the `start_run` POST, zero energy, on every real run. Three
consecutive juiced runs logged `observedDelta` exactly 1 less than
`committedDelta`. Read `tightDelta`:

- **−59** → the CHARGE is 59 and the 3× multiplier is the suspect (20×3 − 1).
- **−60** → something inside the run credits 1 back — a different investigation.

**Do not fix the drift before the probe says which it is.** The error is
conservative in the safe direction; the guard enforces off committed spend.

**(3) Opportunistic:** one **base-6/8/10 crit** finishes the crit rule. Card 10
(crit 10) is in the deck — ×1.5 → 15 against ×1.6 → 16. `critEffects`, not
`hitEffects`. Take it if it appears; do not chase it.

### 3b. Rules that bind inside the run

- **Rule 8** for in-room tiers: highest tier among **non-Perpetual** options; at
  the **final room take no-modifiers**, keyed on the server's `maxRoom`
  (Forbidden Woods 16), never a hard-coded number. `src/strategy/enemyTier.ts` is
  the only call site that may choose a tier.
- **Rule 13, after every single run, unconditionally.** If any live command
  reports denied, blocked or interrupted, **read `checkDungeonToday.ts` before
  saying it did not run.** The classifier's denial has already raced execution
  once (run 24945829, found 25 minutes later by accident). Report any discrepancy
  in the recap with both numbers — do not reconcile it quietly.
- **Never allocate skill points.** The user does that between runs, and it is why
  runs do not chain.

### 3c. What a normal run looks like, so a bad one is not read as a regression

67 recorded attempts, **58 deaths, 0 cleared, 22 juiced.** Deaths cluster at rooms
3–5 (33 of 58). The four juiced runs on 08-23 died at rooms 8, 3, 7 and 7 for
8112 / 1824 / 6384 / 6336 Hard Core. **A room-4 death is the modal outcome, not a
failed session.** The gate below is on the instruments, not the depth.

---

## 4. Gate

Live, so rule 6 applies twice over: state at the top if either half is unreachable.

1. **FISHING.** Gate 0's corpus snapshot is pinned **before the first cast**;
   the batch is spent (or the number spent and the reason for any shortfall is
   stated); `matcherWeightReport.ts --last-casts=20` has been run and **its
   verdict recorded exactly as the code returns it**, including
   `INSUFFICIENT_DATA`. Support counts recorded at batch time.
2. **DUNGEON.** At least one juiced run, `--dry-run` first, per-run go-ahead
   obtained, and **both** the `EV support: n/m` line and the
   `start_run_energy_probe` `tightDelta` reported — **present or absent, stated
   either way.** A run that dies in room 2 meets this gate.

**What would make these unmeetable:** the caps reading spent at session start.
Nothing else — both halves are one command behind a budget that exists.

**What does NOT meet the gate:** a §19 verdict argued around rather than
reported; a second dungeon run started because the first was reported denied
without reading the ledger; any dungeon run without its own go-ahead.

---

## 5. Not gated — offline, only if there is room, and only after the batch

Open question 2 from the recap: **does the shipped EV trigger fire on the SAME
turns the dead hands occur on?** It fires at 12.7% against a dead-hand rate of
11.8% and **nothing establishes those are the same turns.** One script, offline,
no live spend.

If you run it, **label whether it is on the frozen corpus or the grown one**, and
prefer the frozen one so it is comparable to the memo §28 is asking about.

This is also the fallback if the caps are already spent.

---

## 6. Do not

- **Do not answer §28.** It is the user's to re-price, an agent must not answer
  it, and `redrawEnabled` / `REDRAW_THRESHOLD` stay untouched until it comes back.
- **Do not start the gate-1 re-audit** (the deck sweep's 36.42%, session 78's
  41.06%, the noise floor, the −4.6pp drift margin, all measured on the no-aim
  arm). It is real, it is bigger than one session, and this session's budget is
  live rather than offline. The pin and the label already exist; they are what
  make it possible later.
- **Do not read `SIM blind` as a live proxy on anything focus-related**, and do
  not restate session 86's finding without the word **UNIFORM** in it —
  `matcherPool: []` is necessary and not sufficient, and `ringModel` and
  `blindFallback` each restore aiming.
- **Do not un-suspend +19.40pp.** §0a stands.
- **Do not resume the off-policy replay** (§27 recommends holding it).
- **§25 stays PARKED** — recommended drop, not dropped unilaterally.
- Standing, none re-opened: no H2 proc model; no M4 lines; `boonCapture` OFF; no
  429 backoff without an observed 429; do not complete the corrode perpetual
  table; do not revert rule 8.
- **`npx tsx` and `git` fail under the command sandbox. Run unsandboxed.**

---

## Your task (session 87)

1. `doctor.ts`, `checkFishingCaps.ts`, `checkDungeonToday.ts`. **If the caps are
   already spent, say so at the top and go to §5.**
2. **§1 / gate 0** — freeze the memo's denominators. Before the first cast. It is
   a label, not a recomputation.
3. **§2 / gate 1** — the 20-cast batch, then `matcherWeightReport.ts
   --last-casts=20`. Report the verdict as the code returns it. Take the oil
   capture only if it arrives on its own.
4. **§3 / gate 2** — dungeon runs, `--dry-run` first, **one go-ahead per run**,
   never chained, rule 13 after each. Report the `EV support` line and the energy
   probe's `tightDelta` whether or not they appear.
5. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero vacuous, **`preflight.ts` after committing
   fixtures and before the push**, no test writes a real data path, secret scan.

**Honest expectation.** The satisfying version of this session is §19 answered
after five blocked sessions and the `EV support` line printing for the first time
in nine. The likely version is a `DROP` or an `INSUFFICIENT_DATA` and a room-4
death — and that is still the best available use of a budget that has now expired
unspent twice. **The one outcome that would waste the session is spending the
casts before gate 0 lands**, because that quietly changes the denominators of the
memo the user is currently being asked to rule on, and nothing in the recap would
show it happened.
