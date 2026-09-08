# BRIEF — session 125 — day 20703 (dow 4, Summoner), ~12h left on it, and TWO REPAIRS the user should be asked for BEFORE the day starts

**This document replaces the session-124 `next.md`, which is spent.** Session 124
closed the day fully spent (dungeon 12/12, fishing 20/20 charged / 26 played),
answered §71 for **zero casts**, and landed **11 of 11 pre-registered forecasts
exactly**. Read `handoff/STATE.md`'s "Settled — do not re-open" digest first.

**⚠⚠ THE WINDOW IS SHORT AND THE DAY IS ALREADY HALF GONE.** Day **20703**
opened 2026-09-07T18:00Z and closes **2026-09-08T18:00Z**. At the time of
writing (2026-09-08T05:45Z) that leaves about **12 hours**, and the day is
UNSPENT — no session ran on it. If the session starts after 18:00Z the day is
**20704 (dow 5, Chobo 134)** instead; both are fine, but say which.

---

## ⚠ FIRST — ASK THE USER FOR TWO REPAIRS, BEFORE SPENDING ANYTHING

Both are **forecastable from measured wear rates**, which is exactly what last
session's finding was for. Raising them at the top costs one message; discovering
them mid-day costs a hand-back in the middle of a 12-hour window.

**1. The slot-15 fishing pair is at `0 / 0` and was NOT covered by last
session's repair.** The user repaired the **rod only** (923: 0 → 40). STATE's own
open question 4 says this pair "must be repaired before fishing, or the rod-only
repair leaves them broken." **Ask for it before the batch starts.** Read what a
broken slot-15 piece actually does — block or merely degrade — and report it,
rather than assuming either.

**2. Item 905 (slot 13) is at durability 6 and BREAKS ON RUN 2.** At the
measured −3 per run: 6 → 3 after run 1 → **0 after run 2**. Under the standing
gear halt that stops the dungeon arm after run 2 and hands back for a repair.
**Tell the user up front** so they can repair it before the session if they want
four uninterrupted runs — a pre-emptive repair is the user's choice and is not
the same thing as gating a run on a threshold, which remains forbidden.

The other three dungeon pieces are comfortable: **901 at 17** (5 runs), **641 at
24** (8 runs), **640 at 46** (15 runs).

---

## Step 0 — the JWT. THIRD ASK.

Sessions 123 and 124 both closed with **no token expiry recorded**, and the last
two briefs both asked for it. **Do not simply ask a third time.** Run `npx tsx
scripts/doctor.ts`, record the expiry and runway **in the recap and in STATE**,
and **name the omission as a process failure** — two consecutive sessions
dropped a number the brief explicitly requested. If there is a reason
`doctor.ts` does not surface it, say that instead; a third silent pass is the
thing to prevent.

If the runway is under a few hours, tell the user in chat before spending.

---

## What this brief ASSERTS and you must VERIFY — rule 9

Session 124 swept all six. **That is one clean sweep against three prior
sessions with failures — do not skip the checks.**

| # | Claim | How to check |
|---|---|---|
| A | Game day **20703**, `dayOfWeek` **4** → **Summoner (140)**; rolls to 20704 / dow 5 / **Chobo (134)** at 2026-09-08T18:00Z | `checkDungeonToday.ts` |
| B | ⚠ **Ring balances do not reconcile — see below.** Total **213** per STATE | read all seven live |
| C | Run-units are a fresh **0 of 12** | `dayProgressEntities` |
| D | The fishing ledger is a fresh **0/20 charged** | `checkFishingCaps.ts` |
| E | Rod **923** (slot 14) is at durability **30** | `checkGear.ts` |
| F | Dungeon pieces: **905 = 6**, 901 = 17, 641 = 24, 640 = 46 | `checkGear.ts` |
| G | The **slot-15 fishing pair reads `0 / 0`** | `checkGear.ts` |

### ⚠ Claim B is a REPORTING DEFECT, not a balance table — resolve it live

**The arithmetic does not close.** Session 123 closed at **231**. Session 124
spent **12 Foxglove** (45 → 33, sole mover, confirmed four times). That gives
**219**. STATE 124's metrics say **213**. **Six rings are unaccounted for.**

What STATE 124 does assert, and what it does not:

- **Asserted:** total **213**, **Athena 21** (still scarcest), **Archon 24**,
  Foxglove **33** after the day's spend.
- **NOT determined:** the split across **Crusader, Chobo, Summoner, Overseer**.
  They must sum to **135** (213 − 21 − 24 − 33); session 123's close had those
  four at 27 / 30 / 42 / 42 = **141**.

**So: read all seven live, report the full table, and say explicitly whether the
missing 6 is (a) a real out-of-band movement — balances have risen out of band
before, Archon 18→24 and Overseer 51→54 in session 123 — or (b) an arithmetic
error in STATE 124's metrics line.** Either answer is worth having; **do not
paper over it by quoting 213 and moving on.** Correct STATE in place with the
live reading.

**Compute every predicted balance from the LIVE read, never from this brief.**

---

## Step 1 — read the day, all seven rings, both ledgers, and a full gear census

`checkDungeonToday.ts`, the seven balances, `checkFishingCaps.ts`, and
**`npx tsx scripts/checkGear.ts`** — bracket every run and every batch with the
last of these; it is what made all eleven of last session's forecasts checkable.

⚠ **A repair MINTS A NEW `docId`** — item 901 went `…_cffcabf3` → `…_373feb7b`
across the user's repair. **Anything keyed on docId across a repair mis-tracks
the piece as new.** If either repair above happens mid-session, key on SLOT, not
docId, and say so.

---

## Step 2 — pre-register in a git commit, BEFORE anything is spent

**Four sessions running, 11/11 last time.** Write
`handoff/scratch-session-125.md`, `git commit`, quote the hash, confirm it
predates the spend. **No addresses, no usernames, no JWT fragments.**

Pre-register these, with the arithmetic shown:

1. **The gear break.** 905 at 6, −3/run → **breaks after run 2**. Name the run
   number. ⚠ **Durability CLAMPS at 0**, so `floor(dur / rate)` gives the right
   break EVENT and the wrong final READING — predict the event, not the number.
2. **The rod.** 923 at 30, **−1.00 per PLAYED cast** → reaches 0 at **cast 30**.
3. **The server's cast refusal.** It has landed at **24, 25, 27** on the last
   three days — drifting up, not fixed. **Pre-register a RANGE, not a point**,
   and note that whichever of (2) and (3) fires first ends the batch. At 30
   casts authorized these are close enough that either could bind.
4. **The charge shape**, currently **29/29**: one faction, exactly 3, six
   untouched. Four runs takes it to **33/33**.

**Do NOT pre-register the faction as a discovery.** The rotation is fully
measured; naming Summoner is bookkeeping.

---

## Step 3 — the four dungeon runs, and the halt that is expected after run 2

**The user has authorized 4 juiced Tier-2 runs (12 of 12 run-units).** Rule 11's
stop-and-report between runs still applies; this does not extend to a fifth run
or another entry tier.

1. `--dry-run` first (rule 4), reading the gear preflight each time.
2. `--runs=1 --juiced --juiced-index=2`, one at a time, report between each.
3. **Read all seven balances after each run.** Confirm one faction, exactly 3,
   six untouched — **29/29 → 33/33**.
4. **Re-read the four wearing pieces after every run** against the Step-2
   forecast.
5. Rule 8 governs in-room picks — highest non-Perpetual tier, except the final
   room, keyed on the server's `maxRoom`. The **Perpetual filter fired live** at
   room 14 last session, so it is load-bearing, not theoretical.
6. Rule 13 on any denied / blocked / interrupted run: read the ledger before
   believing it, never retry on a denial.

### The halt — [USER], settled, per-ARM, and it is a HAND-BACK not an ending

- **⛔ NEVER abort a run in progress for durability.** A started run finishes.
- **After a COMPLETED run, any equipped piece at 0 stops that ARM** for a manual
  repair. Pieces already at 0 when the session opens are **GRANDFATHERED**.
- **The halt is PER-ARM** — confirmed live and by the user's own actions last
  session. A broken slot-13 (dungeon) piece did **not** block fishing, and
  broken slot-15 (fishing) pieces did **not** block dungeon runs.
- **⭐ When the halt fires after run 2, do not idle — run the fishing batch while
  waiting for the repair.** Session 124's own correction: *do not fold a
  "therefore we cannot learn X" onto a correct prediction — a halt is a
  hand-back, not the end of the day.* The user repaired and authorised the rest
  of the day, and the session got its third refusal data point because of it.

**Expected close** — compute from the LIVE read: if dow 4 and Summoner opens at
42, four runs take it to **30**; if the day has rolled to dow 5, Chobo at 30 goes
to **18**, which would make **Chobo the scarcest ring**, not Athena. Flag that if
it happens.

---

## Step 4 — fishing: 30 casts authorized, and the RUN SHAPE matters more than the count

### ⛔ Run fishing as REPEATED SMALL `--oil-batch` INVOCATIONS. Not one long batch.

**Two faces of one mechanism, both measured last session:**

- **Rod durability is read at PREFLIGHT and after the batch — never between
  casts.** A long `--casts=N` batch would play **past zero onto a dry rod** and
  inject `BASE_DECK` mid-batch, silently polluting the corpus with a third deck.
- **`--casts=N` is SILENTLY OVERRIDDEN by `--oil-batch`** —
  `authorizedCasts = batchLimits.castCap ?? args.casts` — **while the banner
  still prints `args.casts`.** That is why `--casts=15` played 2.

**`castCap: 2` is what makes the fish-to-zero halt safe**, and the halt fired
correctly for the first time ever last session because of it. **Do not "fix" this
by running the whole day in one batch** — it is in the do-not-reopen list.

### The counts

- **30 casts authorized** (standing 360-energy / 30-cast budget).
- **The rod reaches 0 at cast 30** (30 durability, 1.00 per played cast).
- **The server has refused the extra play at cast 24, 25, and 27** — drifting
  upward. Expect the refusal somewhere in that neighbourhood; **halt cleanly when
  it comes, do not push past it**, and **report the exact cast number** — a
  fourth data point on a moving boundary is worth having.
- **Report played and charged SEPARATELY. Never report 30 charged**; the server
  charges 20/day.
- If the rod reaches 0 first: **halt, hand back, wait for the repair**, resume on
  confirmation with a **fresh live durability read** — do not assume 40.

### Oils

Relaxing-only. Double-lethal DISABLED, Focus Oil off the allowlist. Focus
triggers log **policy-withdrawn**. Oils spend autonomously inside
`config/bot.json`'s `dendren.oils` with `policyApproved` true.

### ⛔ Do NOT raise the catch rate, and do NOT commission a study

Last session read **13/26 = 50.0%**; pooled Dendren-only **24/50 = 48.0%**.
**Neither is a concern or a regression.** The sim already settled the deck
question: **Dendren is BETTER**, +3.23pp [2.92, 3.55] at n=40k/arm.

**The tripwire, not a study:** it arms at **n ≈ 100 Dendren casts**. The corpus
is at **50**; this session takes it to roughly **76–80**, so it still does not
arm. Below ~50% pooled at n≈100 is a real signal; 48.0% at n=50 is not.
**Detecting the 3pp effect live would need ~87 sessions.** Use
`scripts/fishBatchReport.ts`; do not hand-count.

---

## Carry forward — address each BY NAME

1. **⚠ QUESTIONS §71 is on [USER] HOLD, and its own framing was WRONG.** The
   dichotomy is false — both branches presupposed a positive pre-swap margin,
   and the pre-swap **Golkan slice (307 traces, the largest single-deck cell) is
   already at −5**. There was never a positive margin for the rod swap to
   destroy; **the separation tracks the ERA, not the rod.** A mechanism was
   hypothesised, measured and **rejected** (budget-zero 41.2% / 0.7% / 30.2%,
   non-monotone). **Do NOT re-commission the Dendren-only discriminator — it is
   answered.** The only open part is whether the claim is retired or rescoped to
   the older eras, and **an agent may not retire it.** Accumulate Dendren data;
   report the slice; do not decide.

2. **⭐ The `LIVE.drift` monotone streak is BROKEN and the counter RESETS.**
   The walk went −0.6417 → −0.6593 → −0.6850 → −0.6882 → −0.7230 → **−0.7010** —
   the sixth move **reversed direction**. Under the ratified [USER] threshold
   (`|drift| ≥ 1.0` **OR** five consecutive same-direction moves) **neither arm
   is armed**: the magnitude is nowhere near 1.0 and the streak is back to 1.
   **Say this explicitly** rather than letting the next session re-count from
   five. And quote it **both ways** — see item 3.

3. **⚠ Quote pooled AND Dendren-only, never pooled alone.** The corpus straddles
   **at least TWO deck changes, not one**, and "low card ids" is **two
   populations**: 44 DRY-ROD `BASE_DECK` casts (use `splitByDealtDeck`) and 82
   rod-dealt casts on an earlier, unidentified rod. Conflating them is the
   natural error and session 124 made it first. Current readings:
   **`LIVE.drift` −0.7010 pooled / −0.5765 Dendren**; **`damageHist` mode 5
   pooled / 7 Dendren**.

4. **⚠ `Thorns` needs a USER DIRECTIVE — the SEVENTH held boon.** Verified
   latent no-op at pickup (hp/hpMax/armor/armorMax and all ROLLED
   byte-identical; `selectedVal1` 5, Rare, TokenId 123). It had been OFFERED
   since 2026-08-27 and never picked until now. **The name suggests retaliation
   and the name is not evidence.** The other six also await a directive:
   `CritHeal`, `Intimidating`, `BurningTenacity`, `RegenMastery`,
   `VulnerableMastery`, `WeakeningBlock`. **Default HOLD.** `Intimidating` still
   cannot separate "heals its amount" from "heals a flat 2".

5. **⚠ When a measurement lands, grep the SCRIPTS that print claims about it,
   not just the markdown.** `checkEntryTiers.ts` printed *"dow2 … FORCED BY
   ELIMINATION, NOT MEASURED"* for a **full session** after session 123 measured
   it — a live instrument contradicting the settled record. Apply this to any
   new tool this session writes, immediately.

6. **⚠ `$TMPDIR` DIFFERS between sandboxed and unsandboxed runs.** A file written
   in one mode is not there in the other; this cost session 124 a debugging
   cycle. Combined with the standing rule: **run the suite UNSANDBOXED** —
   `tsx` and `git` both fail sandboxed.

7. **Do not "fix" the source labels in `OBSERVED_OFFERS` by using the AFTER
   state.** Rows are keyed to the **BEFORE** label; using `after` turned all 35
   new rows into `sourceMisses` (17 → 52).

8. **Do not update corpus pins mid-session.** Session 124 pinned only after
   12/12 run-units and 20/20 casts were spent. Do the same; live runs write
   fixtures while tests read them.

9. **Two crit anomalies stand, and neither tightens the bound** — card **18**
   (first on a low-id base/legacy card) and card **96** (Dendren, repeating
   session 123's card-91 ratio exactly). Neither is a new base. Report if a third
   appears; do not fit.

10. **[USER] Other dungeons on this account are OUT OF SCOPE** — not queried, not
    counted, not reported, not "just to confirm". The one technical fact kept:
    the 12-run-unit ledger is **per-dungeon**.

11. **The `web/` front end has still never spawned a real script** — untouched
    since session 120. Only if the live budget is spent and time remains.

12. **Carried, unchanged:** §0a is NOT lifted, and **+19.40pp and +17.74pp MAY
    NOT BE QUOTED.**

---

## Recap — state these explicitly, at the top

- **Step 0: the JWT expiry and runway as a recorded number**, plus a plain note
  that two consecutive sessions dropped it.
- **The two repairs**: whether they were asked for up front, whether the user did
  them, and what a broken slot-15 piece actually does to a cast.
- **Step 1: the live day and faction, all seven balances, both ledgers, the full
  gear census**, and Claims A–G each marked pass or fail — **with Claim B's
  6-ring discrepancy resolved and STATE corrected in place.**
- **Step 2: the pre-registration commit hash**, confirmed to predate the spend
  and clean of addresses and usernames.
- **Step 3: per-run detail**, the shape count at **33/33**, the four wearing
  pieces read after every run, and **whether the gear break landed on run 2 as
  forecast**. If the halt fired, say whether the fishing arm was run during the
  wait.
- **Step 4: casts played vs charged separately**, the **exact cast the server
  refused at** (fourth data point), the rod's durability path and whether
  fish-to-zero fired, and the Dendren-only catch rate reported **without** being
  raised as a concern.
- **All twelve carry-forward items by name**, with item 2 (the drift streak
  reset) stated so the next session does not re-count from five.

Standard closeout: full suite `vitest run --maxWorkers=4` **UNSANDBOXED**,
`tsc --noEmit`, `git diff --check`, and the secret scan
(`npx tsx scripts/secretScan.ts`) **quoted verbatim**.

**Do not trust a `tail`-piped or task-notification exit code** — it reports the
COMPOUND command. Capture to a file and read `$?` directly.
