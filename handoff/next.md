# BRIEF — session 122 — the rotation-solving day, 4 juiced Tier-2 runs + 30 fishing casts

**This document replaces the session-121 `next.md`, which is spent — session 121
worked it end to end and closed the day fully spent (dungeon 12/12, fishing
20/20). Read `handoff/STATE.md`'s "Settled — do not re-open" digest before
doing anything below; it is long, and several entries in it are exactly the
traps this brief exists to route around.**

Numbering assumes the next live session is 122. If an offline session lands
first, renumber and say so, as session 121's brief did.

---

## ⚠⚠ STEP 0 — THE JWT IS EXPIRED. THIS IS A USER ACTION AND IT BLOCKS EVERYTHING.

**The token recorded in STATE expired `2026-09-04T18:48:43Z`.** At the time this
brief was written (2026-09-05T16:35Z) that is **~22 hours ago**. Session 121's
open question 1 said to put this at the top of the next brief rather than in a
carry-forward list. It is at the top.

1. Read the JWT's real expiry live (`npx tsx scripts/doctor.ts`) — **do not
   hardcode the timestamp above from this brief**, confirm it, same as Step 1
   confirms the day.
2. **If it is still expired: stop. Spend nothing.** Report the expiry and tell
   the user directly, in chat, that `~/.secrets/gigaverse-jwt.txt` needs a fresh
   token copied from their browser. Do not bury it in a recap. Do not attempt
   any live call to "check" — a 401 is not more informative than `doctor.ts` and
   it costs the user a round trip.
3. **If it is refreshed and valid: note the runway in the recap** and proceed to
   Step 1.

There is no offline fallback in this brief. Everything below is live work.

---

## What this brief ASSERTS and you must VERIFY — rule 9

Session 121 caught this brief's predecessor asserting `dayOfWeek 0` for day
20699 when the server returned **7**, and flagged it before spending. That is
the standard. **Four consecutive sessions (115, 116, 118, 121) had a stale or
wrong PRINTED CAPTION as the defect.** Assume a fifth is available to be found.

The checkable claims below are hypotheses. Check each, in Step 1, before spend:

| # | Claim | How to check |
|---|---|---|
| A | The current game day is **20700** (dow 1) until 2026-09-05T18:00Z, then **20701** (dow 2) until 2026-09-06T18:00Z | `checkDungeonToday.ts` — read `currentDay` / `currentDayOfWeek` |
| B | Ring balances are unchanged from session 121's close (below) | read all seven live |
| C | Run-units are a fresh 0 of 12 | `dayProgressEntities` |
| D | The fishing ledger is fresh 0/20 | `checkFishingCaps.ts`, `dayDocs[pondId]` |
| E | Rod 812 durability is **28** | read it live |

**Claim A is derived arithmetic, not a measurement.** The derivation: day 20699
was live at 2026-09-04T04:32Z with "next day in 13:37:50", putting the rollover
at 18:00Z (11:00 PT), so game day N spans `[N·86400 + 64800, (N+1)·86400 +
64800)`. That is inference from one reading. **The server is the authority. If
it disagrees, the server wins and this table is the thing that was wrong.**

Session 121's closing balances, for the Step-1 diff:

| faction | item | name | balance |
|---|---|---|---|
| 3 | 137 | Athena   | 21 |
| 7 | 134 | Chobo    | 30 |
| 4 | 138 | Archon   | **18** |
| 1 | 135 | Crusader | 39 |
| 6 | 140 | Summoner | 42 |
| 5 | 139 | Foxglove | 45 |
| 2 | 136 | Overseer | 51 |

Total **246**. Archon fell 30→18 on session 121's four runs; it is now
second-scarcest behind Athena.

---

## Step 1 — read the day live, and branch on it

**Both open days are decisive. This brief works on either.** That is deliberate
— it protects the session against Claim A being wrong, and against the ~80
minutes that remained on day 20700 when this was written.

Run `npx tsx scripts/checkDungeonToday.ts` and read `currentDay` and
`currentDayOfWeek` before anything else. Then:

- **`currentDay` = 20700 (`dayOfWeek 1`)** → proceed to Step 2. This is the slot
  session 121 named as the last test needed.
- **`currentDay` = 20701 (`dayOfWeek 2`)** → **proceed to Step 2 anyway, with
  the identical pre-registration.** dow 2 is the *other* unobserved slot. Under
  hypothesis (a) it must charge Crusader or Overseer exactly as dow 1 must, and
  whichever it charges, the remaining faction takes the remaining slot. **The
  order is solved either way.** Say explicitly in the recap which day it
  actually was, and that day 20700 passed unmeasured.
- **`currentDay` = 20702 or later (`dayOfWeek 3`+)** → **both unobserved slots
  have now passed unmeasured, and dow 3+ are already-claimed factions.** Do NOT
  treat a dow-3 charge of Foxglove as a confirmation of anything — it is
  consistent with (a), (b) and (c) alike and buys nothing. Stop, report that the
  discriminating window closed, and note the next dow-1 day is **20707**
  (2026-09-11T18:00Z) and the next dow-2 day **20708**. Ask before spending the
  day's runs on a non-diagnostic point; the user may still want the Hard Core
  income, but that is their call and not this brief's.
- **`currentDay` = 20699 or earlier** → the rollover has not landed, or Claim A's
  arithmetic is wrong in a way worth reporting. Stop and report the countdown.

Also, in the same pass and before any spend: the seven ring balances (Claim B),
the run-unit ledger (C), the fishing ledger (D), and rod 812's durability (E).

---

## Step 2 — PRE-REGISTER IN A GIT COMMIT, BEFORE `start_run`

**This is the single practice that made session 121's result a test rather than
a story fitted afterwards, and STATE's "What works" says to repeat it.** The
prediction went into `handoff/scratch-session-121.md` and was committed
(`f35602e0`) *before* any spend, so it is verifiable from history.

Write `handoff/scratch-session-122.md` with the Step-1 readings and the
prediction below, `git commit` it, and quote the commit hash in the recap.
Nothing may be spent before that commit exists.

### The prediction — identical for dow 1 and dow 2

The observed fragment is now **dow 3→f5, 4→f6, 5→f7, 6→f3, 7→f4** — Foxglove,
Summoner, Chobo, Athena, Archon. Two slots and two factions remain.

**Under hypothesis (a) — a fixed 7-permutation — the day MUST charge exactly one
of:**

- **f1 Crusader (135), 39 → 36**
- **f2 Overseer (136), 51 → 48**

### Falsifiers, stated in advance

1. **(a) DIES** if the mover is Foxglove, Summoner, Chobo, Athena or Archon —
   any faction already claimed by dows 3–7. A repeat inside one cycle is not a
   permutation.
2. **The CHARGE SHAPE claim dies separately** (it is currently **17/17**) if more
   than one faction moves, or if the amount is anything other than exactly 3.
   Session 118 is the precedent for one claim dying without the other.
3. **No prediction is made about WHICH of the two it is.** That is the point:
   both branches solve the order.

### What this measurement CAN and CANNOT do — and it is different this time

**Unlike session 121, a PASS here is decisive.** Day 20699 landed in a 3-of-7
set, which a random draw does 43% of the time — Bayes factor ~2.3, and STATE
records that as explicitly **not a solve**. This day's predicted set is
**2 of 7**, which a random draw hits 29% of the time, and more importantly a
pass **completes the permutation**: the remaining slot is forced. So:

- **PASS** → hypothesis (a) survives *and* the 7-permutation is fully
  determined, for the first time. Write it out in full in the recap.
- **FAIL** → (a) is dead outright, same as the arithmetic rule died at day
  20698. Do not re-fit.

**Do not re-fit an arithmetic rule to six points.** STATE's Dead ends section
says this in as many words, and three consecutive +1 steps already produced one
confident wrong answer.

---

## Step 3 — run 1 IS the measurement. Run it alone and report.

The user has authorized **4 juiced Tier-2 runs (12 of 12 run-units)** for this
session, in advance. That authorization does not repeal rule 11's stop-and-
report between runs, and it does not extend to a fifth run or a different entry
tier.

**All the diagnostic value is in run 1 in isolation.** The charged faction does
not change mid-day — four same-day charges in each of three sessions, and STATE
lists it under "do not re-open" — so runs 2–4 confirm the shape but cannot
re-test the order. Read the balances after run 1 *before* run 2 exists.

1. `--dry-run` first. Standing rule 4, and rule 12's real lesson: exercise the
   gate before reporting a blocker.
2. One run: `--runs=1 --juiced --juiced-index=2`. No chaining — rule 11.
3. **Read all seven ring balances again. Twice, and report both reads.** Report
   which single faction moved and by how much (expect exactly one, exactly 3),
   the live `currentDay`/`currentDayOfWeek`, and the verdict against the
   pre-registration above.
4. Rule 8 governs in-room picks throughout — highest non-Perpetual tier, except
   the final room, keyed on the server's `maxRoom`. Unaffected by any of this.
5. **Report before run 2.** If (a) FAILED, stop entirely and go back to the user
   before spending three more runs — a falsification changes what the remaining
   runs are for.

## Step 4 — runs 2, 3 and 4

Only if (a) survived, or on explicit go-ahead if it didn't.

1. `--dry-run`, then `--runs=1 --juiced --juiced-index=2`, one at a time, stop
   and report between each.
2. **Confirm the SAME faction moves again by exactly 3 each time.** Expected
   close, if Crusader is the mover: **39 → 27**. If Overseer: **51 → 39**.
3. Rule 13 discipline on any denied, blocked or interrupted run — read
   `checkDungeonToday.ts` before believing a denial, and never retry on one.
   Report a denial that raced execution plainly, with both numbers.

---

## Step 5 — fishing: 30 casts authorized, and the rod cannot take 30

**The user has authorized 30 casts this session.** That is the standing
[USER] budget (360 energy / 30 casts). Two things stand between it and reality
and BOTH must be read live and reported before the batch starts.

### ⚠ [USER DIRECTIVE, 2026-09-05] Fish the rod to zero, HALT, and wait for a manual repair

**The user's instruction, verbatim in intent: "stop at the durability of the rod
and let me repair before continuing."** So the rod is not a reason to cut the
batch short and it is not to be conserved. Run casts until durability reaches
**0**, stop cleanly there, tell the user, and **wait** — do not end the session,
do not treat it as a failure, and do not continue to the remaining casts until
they confirm the repair.

The arithmetic going in: rod 812 closed session 121 at **durability 28**, and the
decrement rate is **MEASURED at 1.00 durability/cast** — two independent clean
10-cast brackets, 48→38→28, both exactly 1.00 (STATE, DECISIONS 2026-09-04).
That is not an assumption any more; it is what session 121 bought by fixing the
denominator.

A rod at 0 is a hard stop that needs the user — session 118 hit it mid-batch and
session 119 confirmed directly that the 0→50 recovery was a **manual repair, not
a timer** (DECISIONS 2026-09-03). There is nothing to wait out, which is exactly
why the halt is a handback and not a sleep.

**The sequence, and it branches on the measurement below:**

- **If the rod decrements on every PLAYED cast** — rod hits 0 on **cast 28**.
  Halt at 28. Report durability 0, casts played, casts charged, and the catch
  rate so far. **Hand back and wait for the user to repair.** On confirmation,
  re-read durability live (do not assume 50), then play casts **29 and 30** to
  complete the authorized 30.
- **If it decrements only on CHARGED casts** — rod reads **8** after cast 20 and
  **stops falling**; casts 21–30 cost nothing and all 30 complete with no halt
  and no repair. Say so explicitly rather than letting the absent halt pass
  unremarked; it is the answer to the open question below.

**Either way, read durability live before the batch (Claim E) and do not assume
28.** If it comes back repaired or otherwise different, the cast counts above
shift and the brief's arithmetic — not the rod — was what was wrong.

### ⚠ The GAME charges only 20 casts/day. 30 played ≠ 30 charged.

Rule 12 records the game ceiling as `dayDocs[pondId]` = **20/day**, and session
118 closed **23 played / 20/20 charged** — casts past the cap can be played but
are not charged. So:

- Read `npx tsx scripts/checkFishingCaps.ts` first and report the cap live.
- **Report played and charged separately, and never report 30 charged.** Say
  "N played, 20/20 charged" explicitly. `castsSoFar` holds the day's CHARGED
  total; `batchCastsPlayed` is the play count. STATE's Dead ends section says
  do not fit a rate off `castsSoFar`, and a test asserts the wrong figure the
  old denominator gives.

### ▸ A free measurement this batch makes available — pre-register it too

Crossing the 20-cast charge boundary discriminates something currently open:
**does the rod decrement on every PLAYED cast, or only on CHARGED casts?**
Session 121 played exactly 20 and charged exactly 20, so its brackets cannot
separate the two.

Put this in the Step-2 scratch commit alongside the rotation prediction:

- **If per PLAYED cast**: rod 28 → 8 after 20 casts, → 2 at cast 26.
- **If per CHARGED cast only**: rod 28 → 8 after 20 casts and **stops falling**;
  casts 21–26 cost nothing.

**Read durability at cast 19, at cast 20, at cast 21 and at the halt, and report
all four.** The 20→21 step is the whole discriminator — one point of decrement
across the charge boundary says PLAYED, zero says CHARGED. This costs nothing
extra and settles a question the 20-played/20-charged batches structurally
could not.

### Oils and the catch rate

- Oils stay **Relaxing-only**. The double-lethal override is DISABLED and Focus
  Oil is off the allowlist — standing [USER] directive, in STATE's do-not-reopen
  list. Focus triggers get logged **policy-withdrawn**, not dry-bag; session 121
  logged 28 of them correctly and that is the expected shape.
- Oils are permitted autonomously inside `config/bot.json`'s `dendren.oils`
  block, and `policyApproved` must be true. Fishing does not become per-cast
  approval.
- **Report the catch rate against the 60–70% framing** — see carry-forward
  below. Do not act on it; report it.

---

## Carry forward — address each BY NAME in the recap

1. **⚠ `LIVE.drift` needs a re-derive THRESHOLD stated in advance, and this
   session will produce the fifth move.**

   **What it is, stated once so the recap can stop being ambiguous about the
   sign.** `LIVE.drift` is `damageEconomy.ts`'s scalar
   `E[Δ fishHp per play] = P(hit)×(−damage) + P(miss)×(+heal)` — the mean
   clamped state-to-state change in the fish's HP per card played, pooled over
   **every clean trace on disk** (label: `LIVE — every clean trace on disk`).
   **Negative is net damage; MORE negative is more damage per play.** It exists
   to separate how often a shot lands from what a landed shot is worth.

   It has moved four consecutive times (−0.6417 → −0.6593 → −0.6850 → −0.6882),
   monotone, with session 121's batch alone reading **−0.7436**. STATE's rule
   says pin while it is short of −1, so it was pinned — but STATE's own open
   question 4 says this will be re-asked every session until a threshold exists.

   **▸ Report the tension, do not resolve it.** Drift has been getting MORE
   negative (more HP removed per play) across the same four sessions in which
   the catch rate fell to 65% then 55%. More damage per play alongside fewer
   catches is not a contradiction — the likely mechanisms are casts ending
   earlier (meter-outs, which session 48's loss decomposition already flags as
   dominant) or a different fish-HP composition, and the clamp hides overkill on
   terminal hits. **Both are hypotheses. Do not fit one.** Report drift, catch
   rate and the meter-out share side by side for this batch and say plainly that
   n is too small to separate them.

   **▸ [USER] THE THRESHOLD IS RATIFIED, 2026-09-05. It is no longer an open
   question and must not be re-asked.** The user approved it in chat **before**
   this session's casts run and before the fifth reading exists — which is the
   only thing that makes it a test rather than a story. It has two arms, either
   sufficient:

   > **Re-derive `LIVE.drift` if `|LIVE.drift| ≥ 1.0`** (STATE's existing rule,
   > unchanged), **OR if it moves five consecutive times in the same direction,
   > regardless of magnitude.**

   **This session's batch produces move number five**, and the walk is already
   monotone across four (−0.6417 → −0.6593 → −0.6850 → −0.6882). So unless this
   batch moves drift *upward* (less negative) or leaves it exactly unchanged,
   **the second arm fires and the correct response is RE-DERIVE, not another
   pin.** Do not reason around that at the moment it fires; that is precisely
   what setting it in advance was for.

   Obligations for this session, all of them:

   - **Write it into `DECISIONS.md`** dated 2026-09-05, marked `[USER]`, and add
     it to STATE's **"Settled — do not re-open"** digest with the re-open
     phrasing spelled out: *"does the drift walk justify a re-derive?"* is the
     question that is now answered. STATE open question 4 is CLOSED — say so by
     name rather than dropping it silently.
   - **Report the fifth reading, the direction, and which arm fired (or that
     neither did)** explicitly in the recap, with the four prior values quoted
     so the monotone count is auditable.
   - **If a re-derive fires**, it is a corpus-pin change like any other: verify
     the set change with a MULTISET diff both ways and report removals as
     removals. Quote the old and new value side by side; never overwrite the
     pinned number silently.
   - **A pin update is no longer the default response.** Any recap sentence of
     the form "still short of −1, so pinned" is now wrong on its own unless the
     direction arm also failed to fire.

2. **⚠ Catch rate — the user's call, and it has been silently passed once.**
   11/20 = **55%** last session, the **second consecutive reading at or below**
   the 60–70% band's floor. `P(≤11 | p=0.65) ≈ 22%` at n=20, so it is inside
   binomial noise and NOT yet a signal. STATE's open question 3 says the default
   is "note, don't act" but that it should be the user's call rather than
   another silent pass. **Raise it explicitly.** A 26–30 cast batch is the
   largest single sample yet; report the pooled rate across the last three
   sessions alongside this one's.

3. **Five latent boons now await a user directive, not four.** `CritHeal`,
   `Intimidating`, `BurningTenacity`, and NEW from session 121 `RegenMastery`
   and `VulnerableMastery`. **Default is HOLD; a new boon type from n=1 needs a
   USER DIRECTIVE** and that is in the do-not-reopen list. `BurningTenacity` has
   been offered and declined twice — say so plainly rather than letting it pass
   unmentioned a third time. `VulnerableMastery` carries `selectedVal1: 10`
   where the modelled `Vulnerable` family carries small integers; that is a
   reason to be careful, **not** a reason to guess. `Intimidating` still cannot
   separate "heals its amount" from "heals a flat 2" — all observations remain
   at amount 2.

4. **Several multi-session HOLDS ended together in session 121 and MUST NOT be
   re-quoted as stable:** redraw b10 `sacrifices` 7→8 and `wasted` 12→13, the
   `|rescues − sacrifices|` numerator 21→25, and `rescueCostHist` buckets 2 and
   3. If any of these appears in a recap sentence as "unchanged for N sessions",
   that sentence is wrong.

5. **The `web/` front end has still never spawned a real script** — untouched
   since session 120, and its own recap says the next real-repo check is
   `cd web/server && npm install && npm run dev` against the Setup/Status tabs.
   Not live work; only if the day's live budget is spent and time remains.

6. **Do not re-open**, and a brief proposing any of these as NEW work is wrong:
   the Tier-1/Tier-3 whole-run income baseline is **RETIRED BY NAME** by user
   directive after thirteen sessions; the rod-durability **label is FIXED**; the
   arithmetic rotation map stays **FALSIFIED**; `data.nextPosition` /
   `data.nextMovePath` are **not** a server change; the advance faction-indicator
   field is not to be re-hunted (rule 11); the ring debit is not on the wire —
   read balances before and after.

---

## Recap — state these explicitly, at the top

- **Step 0: the JWT.** Expiry, whether it was refreshed, and remaining runway.
- **Step 1: the live `currentDay` and `currentDayOfWeek`**, whether they matched
  Claim A, and the fresh run-unit / fishing-cap / rod-durability / seven-ring
  readings. Flag any of Claims A–E that came back wrong — that is the point of
  the table.
- **Step 2: the pre-registration commit hash**, quoted, with confirmation it
  predates `start_run`.
- **Step 3: which faction moved, by how much**, the verdict against the
  pre-registration, and — if (a) survived — **the full 7-permutation written
  out**, since this is the day it becomes determined.
- **Step 4: per-run detail** and same-faction/same-amount confirmation.
- **Step 5: casts played vs charged (stated separately)**, catch rate, rod
  durability at casts 19/20/21 and at the halt, the played-vs-charged decrement
  verdict, whether the rod hit 0 and the session handed back for a manual repair,
  how many casts remained at that point, oil spends and policy-withdrawn counts.
  Report `LIVE.drift`, the catch rate and the meter-out share together.
- **All six carry-forward items, by name.** Item 1's threshold is RATIFIED —
  report which arm fired and what was done, and confirm DECISIONS and STATE were
  updated. Item 2 (catch rate) is still the user's call and must be raised
  explicitly rather than deferred a third time.

Standard closeout: full suite `vitest run --maxWorkers=4` **UNSANDBOXED**
(`tsx` and `git` both fail sandboxed — EPERM on tsx's IPC pipe, reproduced
twice), `tsc --noEmit`, `git diff --check`, and the secret scan
(`npx tsx scripts/secretScan.ts`) with its summary **quoted verbatim**.

**Do not trust a `tail`-piped exit code**, and note that a background-task
"exit code 0" notification reports the COMPOUND command — an `; echo` after
`vitest` masks its status. Capture to a file and read `$?` directly.
