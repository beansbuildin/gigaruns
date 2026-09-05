# BRIEF — session 123 — the dow-2 CONFIRMATION, 4 juiced runs, and the rod halt that lands almost immediately

**This document replaces the session-122 `next.md`, which is spent — session 122
worked it end to end, closed the day fully spent (dungeon 12/12, fishing 20/20
charged / 23 played), and SOLVED the rotation.** Read `handoff/STATE.md`'s
"Settled — do not re-open" digest before doing anything below.

**Session 122 got all five of its checkable claims right — the first session in
five with no wrong printed caption. Do not read that as licence to skip the
checks.** It is one sample against a four-session run of the opposite.

---

## ⛔ [USER DIRECTIVE, 2026-09-05] DUNGEON 3 AND "ANOTHER PLAYER" ARE OUT OF SCOPE. DO NOT LOOK.

**The user's instruction, and it is not a preference to be balanced against
curiosity:** stop mentioning "another player" and "dungeon 3". It is irrelevant
to this project and **is not to be looked at whatsoever**.

Concretely, and all of it:

- **Do not query, count, read, or report `Dungeon#3`** — not its `DayCount`, not
  its timestamps, not "just to confirm nothing changed". Not looking is the
  instruction; a fresh reading is a violation of it even if the number is then
  discarded.
- **Do not speculate, in prose or in a commit message, about who or what else
  is on this account.** No "another player", no "something else is playing", no
  "not this bot". The account's other activity is not this project's subject.
- **Delete the existing traces rather than carrying them forward.** STATE 122's
  "What's broken" bullet about a `Dungeon#3` DayCount, and STATE 122's **open
  question 6**, are both CLOSED by this directive. Remove them; do not restate
  them as "closed per user" in a way that reproduces the content.
- **Record it** in `DECISIONS.md` dated 2026-09-05, marked `[USER]`, and add it
  to STATE's **"Settled — do not re-open"** digest. Re-opens as: *"something
  else is playing dungeon 3"*, *"worth one question to the user about the other
  dungeon"*, or any request to re-check that counter.

**The one thing to KEEP, because it is a technical fact about our own
accounting and not about anything else on the account:** the run-unit ledger is
**per-dungeon**, measured — `Dungeon#5` moved while a sibling counter did not.
That fact stays pinned wherever it already lives. State it as "the ledger is
per-dungeon" and stop there. It needs no sibling, no number, and no story.

**If `checkDungeonToday.ts` or any other script prints a sibling dungeon's
counter as part of its normal output, that is a caption/reporting change worth
making** — narrow the print to dungeon 5 — so the number stops arriving in front
of a reader who has been told not to look at it. That is in scope; investigating
what the number means is not.

---

## Step 0 — the JWT, and a gap session 122 left

The token was refreshed by the user between sessions 121 and 122 — session 122
ran four live runs, so it was valid. **But session 122's recap and STATE record
no expiry for the new token anywhere.** The previous runway figure
(`2026-09-04T18:48:43Z`) belongs to the OLD token and is dead; do not quote it,
and do not carry it forward as if it still described anything.

1. `npx tsx scripts/doctor.ts` — read the expiry and the remaining runway live,
   **and write both into the recap and STATE**, so the next brief is not doing
   this again. This is the only new hygiene item in this brief and it exists
   because the last one silently dropped a number it had been tracking for three
   sessions.
2. If the runway is under a few hours, say so plainly to the user in chat before
   spending, not in the recap.

---

## What this brief ASSERTS and you must VERIFY — rule 9

Check each before spending anything. Report any that came back wrong; that
report is the point of the table.

| # | Claim | How to check |
|---|---|---|
| A | The game day is **20701**, **`dayOfWeek 2`**, rolling to 20702 at 2026-09-06T18:00Z | `checkDungeonToday.ts` — `currentDay` / `currentDayOfWeek` |
| B | Ring balances are session 122's close (below), total **234** | read all seven live |
| C | Run-units are a fresh **0 of 12** (day 20700's 12/12 reset at 18:00Z) | `dayProgressEntities` |
| D | The fishing ledger is a fresh **0/20 charged** | `checkFishingCaps.ts`, `dayDocs[pondId]` |
| E | Rod 812 (slot 14) durability is **5** | gear read / rod preflight |
| F | Slot 11 (item 640, the repaired head) is at or near **70** | `GET /gear/instances/{address}` |

Session 122's closing balances:

| faction | item | name | balance |
|---|---|---|---|
| 4 | 138 | Archon   | **18** |
| 3 | 137 | Athena   | 21 |
| 1 | 135 | Crusader | **27** |
| 7 | 134 | Chobo    | 30 |
| 6 | 140 | Summoner | 42 |
| 5 | 139 | Foxglove | 45 |
| 2 | 136 | Overseer | **51** |

Total **234**. Archon is scarcest at 18, then Athena at 21.

---

## Step 1 — read the day live and branch

- **`currentDay` = 20701 (`dayOfWeek 2`)** → proceed to Step 2. This is the
  target.
- **`currentDay` = 20702 (`dayOfWeek 3`)** → the dow-2 window closed. dow 3 is
  **Foxglove (139)**, already measured, so a run on it confirms the *shape*
  (22/22) but adds nothing to the order. **Say that plainly and ask before
  spending**, rather than dressing a routine income day as a measurement. The
  next dow-2 day is **20708** (2026-09-12T18:00Z).
- **Anything else** → report the reading against Claim A and stop before
  spending; the brief's arithmetic, not the server, is what was wrong.

In the same pass, before any spend: the seven balances (B), the run-unit ledger
(C), the fishing ledger (D), and **a full gear-durability read** (E, F, and the
preflight below).

---

## Step 2 — pre-register in a git commit, BEFORE `start_run`

Twice now this is what turned a spend into a test (`f35602e0` session 121,
`4d68bc84` session 122). Write `handoff/scratch-session-123.md` with the Step-1
readings and the prediction, `git commit` it, and quote the hash in the recap.
Nothing is spent before that commit exists.

**⚠ And this time, keep the prose clean.** Session 122's pre-registration
committed a bare wallet address and a real username; the secret scan caught both
after the fact. **No addresses, no usernames, no JWT fragments in scratch
files** — the pre-registration's whole value is being a tamper-evident artifact
you do not want to rewrite later.

### The prediction — this is CONFIRMATION, not discovery

**The rotation is SOLVED and the brief must not present it as open.** Six slots
are measured; dow 2 was **forced by elimination, never observed**:

```
dow1 Crusader(135)   dow2 Overseer(136)  <- FORCED, unmeasured — this is the one
dow3 Foxglove(139)   dow4 Summoner(140)
dow5 Chobo(134)      dow6 Athena(137)     dow7 Archon(138)
```

**Under the solved map, day 20701 MUST charge Overseer (136), 51 → 48.**

Do not write this up as narrowing hypotheses. It is a single named prediction
with a high prior, and its value is asymmetric:

- **PASS** → the last cell moves from *forced* to *measured*. All seven
  observed. **The rotation then needs no further runs at all**, and the next
  session's gate is something else entirely — say so, so nobody schedules an
  eighth rotation run.
- **FAIL** → far more consequential than it looks. The dow-2 cell was derived by
  elimination *from* hypothesis (a); if it fails, (a) fails, and **every other
  cell's status is downgraded with it** — six measurements would still stand as
  observations, but the *permutation* claim that binds them would not. Stop
  immediately, spend nothing further, and report.

### Falsifiers, stated in advance

1. **The ORDER claim dies** if the mover is any faction other than Overseer.
2. **The SHAPE claim dies separately** — currently **21/21** — if more than one
   faction moves, or if the amount is anything other than exactly 3.
3. **No prediction is made about run-to-run variance**, deaths, or income. Those
   are not what this run is for.

---

## Step 3 — run 1 alone, then report

**The user has authorized 4 juiced Tier-2 runs (12 of 12 run-units) for this
session, in advance.** That does not repeal rule 11's stop-and-report between
runs, and does not extend to a fifth run or a different entry tier.

All the diagnostic value is in run 1 in isolation — the charged faction does not
change mid-day (**sixteen** same-day charges across four days, in the
do-not-reopen list). Read balances after run 1 *before* run 2 exists.

1. `--dry-run` first (rule 4), and read its **gear-durability preflight** output
   — new in `liveRun.ts` this session, reports but never blocks.
2. `--runs=1 --juiced --juiced-index=2`. No chaining (rule 11).
3. **Read all seven balances again, twice, report both reads.** Report the sole
   mover, the amount, the live day/dow, and the verdict.
4. Rule 8 governs in-room picks — highest non-Perpetual tier, except the final
   room, keyed on the server's `maxRoom`.
5. **Report before run 2.** On a FAIL, stop entirely.

## Step 4 — runs 2, 3 and 4, with gear read between each

1. `--dry-run`, then `--runs=1 --juiced --juiced-index=2`, one at a time, stop
   and report between each.
2. **Confirm Overseer moves again by exactly 3 each time.** Expected close:
   **51 → 39**.
3. Rule 13 on any denied / blocked / interrupted run — read the ledger before
   believing it, never retry on a denial, and report a denial that raced
   execution with both numbers.

### ▸ Gear durability: read it around EVERY run, and halt at zero BETWEEN runs

Session 122 discovered that **gear wears out mid-session and a worn piece
changes the loadout**: item 640 (slot 11, "Golkan Eradicator Head") hit 0 during
run 3, and run 4 opened at hpMax 45 with Sword ATK 26→16 and Shield ATK 11→6.
That run was also the shallowest of the four (room 7 against 9/11/10).

**`n=1` and NOT attributable — do not report the depth as caused by the gear.**
But it is also not variance within the same arm: **runs 1–3 and run 4 are
different arms**, and STATE says so. The corpus cost of not noticing is silent
pollution.

So, this session:

1. **Read every equipped piece's durability BEFORE and AFTER each of the four
   runs** and print both. The after-read is what the halt in (3) keys on; the
   pair also gives a free measurement of the **per-run wear rate**, currently
   unknown — the same shape as the rod rate session 121 bought by fixing a
   denominator. Pre-register the expectation as unknown rather than guessing a
   number.
2. **Do not narrow the preflight to a dungeon-slot allowlist** — exactly one
   slot mapping is confirmed (11), and slots 8/14/15 are fishing gear. In the
   Dead ends list.
3. **▸ [USER] RATIFIED 2026-09-05 — THE GEAR HALT, AND IT NEVER INTERRUPTS A
   RUN.** Two clauses, and the first one is the load-bearing half:

   - **⛔ NEVER stop a dungeon run in progress for durability.** A run that has
     started finishes. Gear durability is **not** a reason to abort mid-run, not
     at 2, not at 1, not at 0. If a piece wears out mid-run, the run plays on to
     its own end.
   - **AFTER a run completes, read every equipped piece. If ANY reads 0, STOP
     and hand back for a manual repair** before the next run. Do not start the
     next run. On the user's confirmation, re-read durability live — do not
     assume a value — and continue.

   **This supersedes the "≤ 2 before a run" gate this brief proposed earlier;
   that gate is WRONG and must not be implemented.** The trigger is **0, checked
   after a completed run** — never a pre-run threshold, never mid-run.

   **Why the user's rule still gets the corpus benefit.** Session 122's item 640
   hit 0 *during* run 3, and **run 4 opened fully degraded** — hpMax 45, Sword
   ATK 26→16, Shield ATK 11→6 — which is the arm change that pollutes the
   corpus. Under this rule run 3 finishes untouched, the post-run check fires at
   0, and **run 4 never starts on broken gear**. The one thing no rule can
   prevent is the partial degradation inside run 3 itself; note that honestly in
   the recap rather than claiming the arms are clean.

   Same shape as the rod directive — finish the unit of work, check the gauge,
   halt at zero, hand back, resume on confirmation — so write it up beside that
   one. Record in `DECISIONS.md` dated 2026-09-05, marked `[USER]`, and add to
   STATE's **"Settled — do not re-open"** digest. Re-opens as: *"abort the run,
   the gear is about to break"*, *"gate the run on a durability threshold"*, or
   *"the preflight only reports, it never blocks"* — the preflight still only
   reports, and **it reports; it does not gate a run's start.**

---

## Step 5 — fishing: the rod halt lands almost immediately

**[USER] Standing directive, ratified 2026-09-05 and NOT exercised last session
(the rod finished at 5, not 0): fish the rod to zero, HALT, hand back, and wait
for a manual repair before continuing.** The standing budget is 360 energy / 30
casts.

**The rod decrements per PLAYED cast — MEASURED, 28→5 over 23 played / 20
charged.** Per-charged would have predicted 8; it read 5. That question is
settled and in the do-not-reopen list.

So the arithmetic is short and the halt is the first thing that happens:

- **Rod at 5 → cast 5 takes it to 0.** Halt there.
- Report durability 0, casts played, casts charged, catch rate so far, and how
  many of the 30 remain. **Hand back and wait.** Do not end the session; do not
  treat the halt as a failure.
- On the user's confirmation, **re-read durability live — do not assume 50 or
  70** — then continue toward the 30-cast budget.
- **The server enforces its own 20-charged cap and will refuse the cast beyond
  it.** Session 122 hit exactly this at cast 24 and the guard tripped closed,
  which is the correct behaviour. Report played and charged **separately**;
  never report 30 charged.

Oils stay **Relaxing-only** — the double-lethal override is DISABLED and Focus
Oil is off the allowlist, standing [USER] directive. Focus triggers log
**policy-withdrawn**, not dry-bag. Oils spend autonomously inside
`config/bot.json`'s `dendren.oils` block with `policyApproved` true; fishing does
not become per-cast approval.

### ⛔ Do NOT raise the catch rate as a concern

**It is ANSWERED and resolves benignly. Retire it.** 14/23 = **60.9%**, back
inside the user's 60–70% framing after two readings at or below the floor
(65.2% → 55% → 60.9%); pooled over the last three batches **40/66 = 60.6%**,
also inside. Raise it again only if a batch lands below ~55% with **n ≥ 25**.

**But fix the instrument if you touch the number.** That 60.9% was counted from
the batch log's `cast_over` events, **not** from the committed corpus:
`loadFishingCorpus`'s records carry `caughtFish` as `null` on the states
inspected, so the obvious corpus-side computation returns **0/433 and is wrong**.
Anyone recomputing the catch rate needs the right field first. A few minutes,
not chased last session.

---

## Carry forward — address each BY NAME

1. **⚠ FIRST, A FILING DEFECT: THE NEW QUESTION IS NUMBERED §67 AND §67 ALREADY
   EXISTS. RENUMBER IT TO §70.** `QUESTIONS.md` line 5353 is
   *"§67 OPEN [session 113] — `Vengeance`: the first quantitative observation"*,
   and session 122 appended a second `## §67` at line 5460 for the drift ratio.
   The file already runs to §69. **Renumber the session-122 entry to §70**,
   update every reference to it (STATE 122's "Settled" and "What's broken"
   bullets, `handoff/log/session-122.md`, and `damageEconomy.test.ts` if it
   cites a section number), and say in the recap that the collision existed —
   two open questions sharing a number is exactly how one of them stops being
   findable. Do NOT renumber the session-113 `Vengeance` entry; it is the
   incumbent.

2. **▸ [USER] ANSWERED 2026-09-05 — "DIFFERENT FISHERIES" IS RETIRED AS
   PHRASING. THE CONCLUSION STANDS ON THE TWO BIG GAPS INSTEAD.**

   The `bare / LIVE` drift ratio crossed its pre-registered bar — **4.83 against
   a bar of 5** — after falling 17x → 9.97x → 8.48x → 4.83x. Session 102
   pre-registered that a further fall means re-examining the conclusion, not
   moving the bar. **The user has now made that call.** Do it, do not re-ask it.

   **What changes — the wording, and only the wording:**

   - **Stop using "different fisheries"** as the name of the claim, anywhere it
     is stated in the present tense.
   - **The CONCLUSION is unchanged: a simulator result does not transfer to
     live.** Nothing about how the bot runs changes.
   - **Rest it on the two gaps `OIL-POLICY.md` §0a actually cites** —
     **meter-out 1.0% sim against 64.2% live**, and **catch ~70% against 27.6%**.
     Session 90 already verified §0a's text never cited the drift at all, so this
     is restoring the real basis, not inventing a new one. Both gaps are
     untouched by anything measured since, and both are far larger than a drift
     ratio.

   **What does NOT change, and an agent may not do quietly:**

   - **Keep the pin at `4.830349605884868` in `damageEconomy.test.ts`. Do not
     delete it** — deleting hides a falsification. Restate what it is evidence
     *of*: it is now a tracked measure of **live-vs-sim convergence**, not the
     basis of any claim. Rename the assertion accordingly so the test says what
     it now means.
   - **Do not lower the bar to 4.5.** Still forbidden, still in Dead ends, moot
     but not deleted.
   - **§0a is NOT lifted and +19.40pp still MAY NOT BE QUOTED.**

   **Scope the sweep carefully — do not rewrite history.** Change the phrase only
   at **live claim sites**: the test name/docblock, `STATE.md`, and any
   present-tense assertion in `OIL-POLICY.md` or a source docblock. **Leave
   `handoff/log/*` and existing `QUESTIONS.md` entries exactly as written** —
   they are a record of what was believed when, and editing them destroys the
   provenance that makes the reversal auditable. Mark the renumbered **§70
   ANSWERED [user, 2026-09-05]** with the resolution appended, and add to STATE's
   **"Settled — do not re-open"**. Re-opens as: *"the falling ratio shows sim and
   live are the same fishery"*, *"restore the `> 5` assertion"*, or *"different
   fisheries"* itself.

   **One line of context worth keeping in the recap:** `bare` never moved. The
   ratio fell entirely because LIVE's own drift grew (fifth consecutive
   same-direction move, −0.6882 → −0.7230) — the live arm converging on the sim
   because the bot is playing better. A measurement broke because performance
   improved, which is the benign reading and the reason retiring the phrasing
   costs nothing.

3. **`LIVE.drift` is now on a FIVE-step monotone walk and was RE-DERIVED**
   (−0.6417 → −0.6593 → −0.6850 → −0.6882 → **−0.7230**) under the ratified
   [USER] threshold — `|drift| ≥ 1.0` **OR** five consecutive same-direction
   moves. The direction arm fired; the magnitude arm did not. **A sixth
   same-direction move fires it again.** The phrasing *"still short of −1, so
   pin"* is now wrong on its own.

4. **⚠ An assertion ordered after a failing one is not a passing assertion.**
   `PLAYER` was stale for a whole session and the staleness was MASKED:
   `rock.def` 9→10 and `paper.def` 16→17 landed between sessions, but the
   assertion pinning them sits after an `hpMax` assertion that failed first, so
   it never ran. **When a test file has a failing assertion, treat every later
   assertion in that block as UNRUN, not as passing.** This is a general lesson
   about this suite, not a one-off fix.

5. **[USER] `PLAYER.hpMax` HOLDS AT 50.** The degraded run is excluded by name in
   `tests/enemies.test.ts`. Do not re-pin `PLAYER` to the newest opening (45) —
   that opening is the broken-gear arm.

6. **Six latent boons now await a user directive**, not five: `CritHeal`,
   `Intimidating`, `BurningTenacity`, `RegenMastery`, `VulnerableMastery`, and
   NEW `WeakeningBlock`. **Default is HOLD**; a new boon type from n=1 needs a
   USER DIRECTIVE. `WeakeningBlock`'s name suggests an on-block effect, so
   measuring it needs post-pickup exchanges **where a block lands** — not a guess
   from `selectedVal1: 4`. `Intimidating` still cannot separate "heals its
   amount" from "heals a flat 2"; all observations remain at amount 2.

7. **Multi-session HOLDS that ENDED and must not be re-quoted as stable:** b6's
   `rescues − sacrifices` 12→14 (its line literally read "UNMOVED"), b10 31, the
   `all3` numerator 25→29, and `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` "2.3"→"2.5".

8. **The `web/` front end has still never spawned a real script** — untouched
   since session 120. Only if the day's live budget is spent and time remains:
   `cd web/server && npm install && npm run dev` against the Setup/Status tabs.

9. **Carried, unchanged:** §0a is NOT lifted, and **+19.40pp and +17.74pp MAY
   NOT BE QUOTED.**

---

## Recap — state these explicitly, at the top

- **Step 0: the JWT expiry and runway, as a recorded number**, since session 122
  dropped it.
- **Step 1: the live day and dow**, and each of Claims A–F checked, with any
  wrong one named.
- **Step 2: the pre-registration commit hash**, confirmed to predate
  `start_run`, and confirmation the scratch file carries no address or username.
- **Step 3: the sole mover and amount**, the verdict, and — on a PASS — the
  statement that **all seven cells are now measured and the rotation needs no
  further runs**.
- **Step 4: per-run detail**, same-faction/same-amount confirmation, and the
  **four gear-durability readings with the per-run wear rate they imply**.
- **Step 5: casts played vs charged, separately**; whether the rod reached 0 and
  the session handed back for a repair; casts remaining against the 30; catch
  rate reported but NOT raised as a concern; oil spends and policy-withdrawn
  counts.
- **The dungeon-3 directive: confirm it was recorded in DECISIONS and STATE, and
  that the two existing STATE traces were removed** — without restating their
  content.
- **All nine carry-forward items by name.** Item 1 (the §67 → §70 renumber) and
  item 2 (retiring the "different fisheries" phrasing) are both WORK TO DO, not
  notes to repeat — confirm each landed, and confirm the sweep did not touch
  `handoff/log/*` or existing `QUESTIONS.md` entries.

Standard closeout: full suite `vitest run --maxWorkers=4` **UNSANDBOXED**
(`tsx` and `git` both fail sandboxed — session 122 hit it on its very first
command), `tsc --noEmit`, `git diff --check`, and the secret scan
(`npx tsx scripts/secretScan.ts`) with its summary **quoted verbatim**.

**Do not trust a `tail`-piped or task-notification exit code** — a notification
reports the COMPOUND command, so an `; echo` after `vitest` masks its status.
Capture to a file and read `$?` directly.
