# BRIEF — session 124 — the FIRST session with no rotation gate: a Dendren-only fishing batch is the experiment, 4 runs are income

**This document replaces the session-123 `next.md`, which is spent.** Session 123
closed the day fully spent (dungeon 12/12, fishing 20/20 charged / 24 played) and
**measured the last rotation cell**. Read `handoff/STATE.md`'s "Settled — do not
re-open" digest before doing anything below.

**⭐ THE ROTATION IS FULLY MEASURED — ALL SEVEN CELLS, NONE FORCED. There is no
rotation work left, and a brief proposing any is wrong.** For seven sessions the
gate was "which faction". This session it is not, and the dungeon runs are
**income plus a shape check**, not a measurement. Say so; do not dress them up.

```
dow1 Crusader(135)   dow2 Overseer(136)   dow3 Foxglove(139)   dow4 Summoner(140)
dow5 Chobo(134)      dow6 Athena(137)     dow7 Archon(138)
```

**⚠ Session 123's brief was WRONG on two of six checkable claims, and one of
them is a standing lesson: RING BALANCES CAN RISE BETWEEN SESSIONS.** Archon
18→24 and Overseer 51→54 moved *up* out of band (total 243, not the predicted
234), which changed the prediction's arithmetic. **Compute every predicted
balance from the LIVE read, never from this brief's table.**

---

## Step 0 — the JWT

Session 123's STATE again records **no token expiry**. `npx tsx
scripts/doctor.ts`, read the expiry and runway, **and write both into the recap
and STATE.** This is the second brief in a row asking; if it lapses again, say
so as a process failure rather than repeating the request a third time.

If the runway is under a few hours, tell the user in chat before spending.

---

## What this brief ASSERTS and you must VERIFY — rule 9

**Two of six failed last session. Assume this table is wrong somewhere.**

| # | Claim | How to check |
|---|---|---|
| A | Game day **20702**, `dayOfWeek` **3** → **Foxglove (139)**; rolls to 20703 / dow 4 / **Summoner (140)** at 2026-09-07T18:00Z | `checkDungeonToday.ts` |
| B | Ring balances are session 123's close (below), total **231** — ⚠ **and this claim FAILED last session because balances ROSE** | read all seven live |
| C | Run-units are a fresh **0 of 12** | `dayProgressEntities` |
| D | The fishing ledger is a fresh **0/20 charged** | `checkFishingCaps.ts` |
| E | The equipped rod is **Dendren (923)**, slot 14 — **not** 812, which was swapped out | `checkGear.ts` |
| F | Item 50 (slot 8) is the **superseded Stone Rod** and is not to be repaired or resolved against | `checkGear.ts` + [USER], settled |

Session 123's closing balances — **a starting point for a live read, not an
input to any prediction:**

| faction | item | name | balance |
|---|---|---|---|
| 3 | 137 | Athena   | **21** ← scarcest |
| 4 | 138 | Archon   | 24 |
| 1 | 135 | Crusader | 27 |
| 7 | 134 | Chobo    | 30 |
| 6 | 140 | Summoner | 42 |
| 2 | 136 | Overseer | 42 |
| 5 | 139 | Foxglove | 45 |

Total **231**. **Athena is the scarcest ring now, not Archon** — that flipped
last session and any note saying otherwise is stale.

---

## Step 1 — read the day, the rings, the ledgers, AND a full gear census

`npx tsx scripts/checkDungeonToday.ts`, all seven balances, `checkFishingCaps.ts`,
and — new and load-bearing this session — **`npx tsx scripts/checkGear.ts`**.

Branch on the day:

- **20702 (dow 3)** → the charged faction is **Foxglove (139)**.
- **20703 (dow 4)** → **Summoner (140)**.
- **Either is fine.** Neither is a measurement. State which day it actually is
  and take the faction from the measured table, not from this brief's guess.

---

## Step 2 — ⭐ THE GEAR-BREAK FORECAST. This is new, and it is the most
## predictive thing available this session.

**Session 123 MEASURED the wear rate: exactly −3 durability per dungeon run, on
exactly FOUR pieces — slots 11, 12, and two pieces in slot 13. The other six do
not move.** n=4. STATE's own words: this **makes a break FORECASTABLE**.

So forecast it, in the pre-registration commit, before any run:

1. From `checkGear.ts`, take each of the four wearing pieces' current durability.
2. **Runs until zero = `floor(durability / 3)`.** Any piece below **12** will
   reach 0 within this session's four runs.
3. **State in advance which run number the gear halt is expected to fire on**, or
   state that no piece breaks inside four runs. Then check it against what
   happens. This is a free, genuinely predictive test that costs nothing and did
   not exist before last session.
4. If the forecast is wrong, that is a finding about the wear rate at n=4 —
   report it as one rather than adjusting the rate quietly.

### The halt rule itself — [USER], settled, and it never interrupts a run

- **⛔ NEVER abort a dungeon run in progress for durability.** Not at 2, not at
  1, not at 0. A started run finishes.
- **After a COMPLETED run, if any equipped piece reads 0, STOP and hand back for
  a manual repair.** Do not start the next run.
- **Pieces already at 0 when the session OPENS are GRANDFATHERED** — they do not
  trigger a halt. Only a piece that reaches 0 *during* this session does.
- **Interpretation to confirm, flagged rather than assumed: the halt stops the
  DUNGEON arm, not the session's fishing.** The four wearing pieces are dungeon
  slots; fishing uses slots 8/14/15. Proceeding with fishing after a dungeon gear
  halt looks correct, but say so explicitly and let the user correct it.

---

## Step 3 — pre-register in a git commit, BEFORE anything is spent

Three sessions running, this is what turns a spend into a test (`f35602e0`,
`4d68bc84`, `ccb5f123`). Write `handoff/scratch-session-124.md`, `git commit`,
quote the hash. **No addresses, no usernames, no JWT fragments** — session 122
leaked both into exactly this file.

Pre-register **three** things, and be honest about which carry uncertainty:

1. **The gear-break forecast** (Step 2). Real uncertainty. The interesting one.
2. **The K=10 Dendren-only discriminator** (Step 4). Real uncertainty, and it is
   this session's GATE.
3. **The charge SHAPE** — currently **25/25**: exactly one faction moves, exactly
   3 per run, six untouched. Four runs takes it to **29/29**. Low uncertainty;
   pre-register it anyway because it is cheap and it is the claim that would
   matter most if it ever broke.

**Do NOT pre-register the faction as a discovery.** It is read off a measured
table. Naming it is bookkeeping.

---

## Step 4 — ⭐ THE GATE: fishing first, because it carries this session's experiment

**Run the fishing batch BEFORE the dungeon runs**, or at least do not leave it
until after all four. The gear halt can end the dungeon arm early, and this
session's actual experiment lives in the casts — stranding it behind four runs
risks losing the only thing here that answers an open question.

### The experiment — QUESTIONS §71, the K=10 margin collapse

**The K=10 redraw margin COLLAPSED to zero** (b10 32, all3 32; the margin went
4 → 2 → 0). The assertion session 122 nominated to catch it did catch it, and it
was **pinned, not relaxed**. It is **confounded by the rod swap**, because the
pooled corpus now spans two decks.

**STATE's own framing of the cheapest discriminator, and it is exactly one
ordinary fishing day:**

- **If the margin stays at ZERO on Dendren-only casts** → the collapse is the
  thesis. The separation claim does not survive.
- **If the margin REOPENS on Dendren-only casts** → the zero was an artifact of
  pooling across the deck change, and the claim survives.

**Pre-register both outcomes and which one you expect, before the casts.** Then
compute the margin on the **Dendren-only slice** — this session's casts plus
session 123's 24 — and report it beside the pooled figure, never instead of it.

⚠ **This resolves a QUESTION; it does not authorize retiring the claim.** §71
needs a **USER decision**, same as §70 did. Report the discriminator's answer and
put the decision to the user.

### The Dendren-only recount owed on OTHER pooled numbers

STATE open question 4: **`LIVE.damageHist`'s mode and `LIVE.drift` now pool
across two decks.** Do not quote either as a single figure. Report each as
**pooled and Dendren-only, side by side**, and say plainly that the pooled
version spans a deck change. The `bare`/LIVE mean-damage gap crossing 0.7136 has
the same explanation — `bare` is `BASE_DECK` and frozen by construction, so the
gap moved because LIVE's deck changed, not because anything drifted.

### The casts — 30 authorized, and the server will refuse before that

**The user has authorized 30 casts** (the standing 360-energy / 30-cast budget).
**The server's own cap will stop it first, and that is correct behaviour, not a
failure:** it charges 20/day and has refused the extra play at **cast 24**
(session 122) and **cast 25** (session 123). Expect the guard to trip closed
around there.

- **Report played and charged SEPARATELY. Never report 30 charged.**
- When the server refuses, halt cleanly — do not push past it — and report the
  cast number it refused at. Three data points on where that refusal lands is
  itself worth having.

### The rod halt — read the NEW rod's durability, do not carry 812's numbers

**[USER] standing: fish the rod to zero, HALT, hand back, and wait for a manual
repair.** It has still never been exercised.

**The rod is now Dendren (923) in slot 14. Rod 812's durability figures are
dead.** Read the current rod's durability live in Step 1 and **forecast the cast
it reaches 0** at the measured **1.00 per PLAYED cast** — the same forecast shape
as the gear one. If it lands inside this batch, say which cast, then halt there,
report, hand back, and resume on the user's confirmation with a fresh live read.

**Item 50 (slot 8) is the superseded Stone Rod. Do not repair it, do not resolve
against it, do not treat it as a fishing blocker** — [USER], settled, and
session 123's fishing hold built on the opposite premise was lifted.

### Oils, and the catch rate

Oils stay **Relaxing-only**; double-lethal DISABLED, Focus Oil off the
allowlist. Focus triggers log **policy-withdrawn**. Oils spend autonomously
inside `config/bot.json`'s `dendren.oils` with `policyApproved` true.

**⛔ Do NOT raise the catch rate as a concern, and do NOT commission a study.**
The live 45.8% (11/24) is **not** a regression — p = 0.103 against the 60.6%
baseline, on a deck that had just changed. The sim already settled the deck
question without a live cast: **Dendren is BETTER**, +3.23pp [2.92, 3.55] at
n=40k/arm on identical seeds. **Detecting that 3pp effect live would need ~87
sessions.**

**The tripwire, not a study:** after ~3 more fishing days (**n ≈ 100 Dendren
casts**), a pooled Dendren-only rate **below ~50%** is a real signal; 50–65% is
noise. This session takes the Dendren corpus to roughly **48**, so the tripwire
does **not** arm yet. Report the pooled Dendren-only rate and move on.

**Use `scripts/fishBatchReport.ts`** — new last session, reads catch rate,
species, tier and Hard Core off `gameItemBalanceChanges`. It **discharges session
122's hand-counting caveat**; do not hand-count and do not recompute from
`loadFishingCorpus`'s `caughtFish`.

---

## Step 5 — the four dungeon runs

**The user has authorized 4 juiced Tier-2 runs (12 of 12 run-units).** That does
not repeal rule 11's stop-and-report between runs, and does not extend to a fifth
run or a different entry tier.

1. `--dry-run` first (rule 4), reading the gear preflight each time.
2. `--runs=1 --juiced --juiced-index=2`, one at a time, stop and report between
   each. No chaining.
3. **Read all seven balances after each run.** Confirm the shape: **one faction,
   exactly 3, six untouched**, taking 25/25 to **29/29**.
4. **Re-read the four wearing pieces after each run** and check them against the
   Step-2 forecast. Halt per the rule above if one reaches 0.
5. Rule 8 governs in-room picks — highest non-Perpetual tier, except the final
   room, keyed on the server's `maxRoom`.
6. Rule 13 on any denied / blocked / interrupted run: read the ledger before
   believing it, never retry on a denial, report a denial that raced execution
   with both numbers.

**Expected ring close** — compute from the LIVE read, not from here. If the day
is dow 3 and Foxglove opens at 45, four runs take it to **33**; if dow 4 and
Summoner opens at 42, to **30**.

---

## Carry forward — address each BY NAME

1. **⚠ QUESTIONS §71 needs a USER DECISION** once Step 4's discriminator
   reports: does the K=10 separation claim survive at a margin of zero? **The
   assertion is PINNED, not relaxed — do not relax it, and do not retire the
   claim.** An agent may not retire a finding; §70 is the precedent for how this
   goes.

2. **QUESTIONS §70 is ANSWERED.** "Different fisheries" is retired as phrasing,
   the conclusion is unchanged and rests on §0a's two larger gaps (meter-out
   1.0% vs 64.2%, catch ~70% vs 27.6%), and the **4.83 pin STAYS** as a
   convergence measure. **Listed only so it is not re-raised.** Re-opens as
   *"restore the `> 5` assertion"* or *"different fisheries"*.

3. **⚠ `dungeonSim`'s non-degeneracy band took a THIRD widening** (0.95 → 0.96,
   measured 0.9520) and **its own re-derive trigger (~0.97) is about one gear
   step away**. A third widening of anything is the shape §70 just resolved. If
   it moves again this session, **do not widen it a fourth time** — say so and
   escalate it as a question, with the ratified drift threshold as the model.

4. **Do not update corpus pins mid-session.** `OBSERVED_OFFERS` moved 560 → 562
   between two test invocations while live runs were still writing fixtures.
   Pin after the last fixture lands, not between runs.

5. **Do not add the three legacy rods (49/50/336) to `ROD_CARD_GRANTS`.** Filling
   the table broke `rodDeck.test.ts` exactly as that test's own comment
   predicted; the revert is correct and the read is preserved in a comment.
   **Resolve by SLOT first** — the gear array carries Stone Rod (50) beside the
   active rod, so a complete table makes "exactly one KNOWN rod" ambiguous.

6. **⚠ Before declaring a field unobservable, enumerate the endpoints this repo
   already has fixtures for.** Session 123 claimed the Dendren geometry needed a
   live cast; it was sitting in `fixtures/fishing-casts/cards.json` the whole
   time. **Three-for-three now** — sessions 70, 99, 123, the same "right endpoint
   is one over" error. Treat a fourth as expected, not exceptional.

7. **Six latent boons await a user directive**: `CritHeal`, `Intimidating`,
   `BurningTenacity`, `RegenMastery`, `VulnerableMastery`, `WeakeningBlock`.
   **Default HOLD**; a new boon type from n=1 needs a USER DIRECTIVE.
   `Intimidating` still cannot separate "heals its amount" from "heals a flat
   2" — all observations remain at amount 2.

8. **The `web/` front end has still never spawned a real script** — untouched
   since session 120. Only if the live budget is spent and time remains:
   `cd web/server && npm install && npm run dev` against the Setup/Status tabs.

9. **[USER] Other dungeons on this account are OUT OF SCOPE and are not to be
   looked at** — not queried, not counted, not reported, not "just to confirm".
   `checkDungeonToday.ts` now filters to the requested dungeonId; keep it that
   way. The one technical fact kept: **the 12-run-unit ledger is per-dungeon.**

10. **Carried, unchanged:** §0a is NOT lifted, and **+19.40pp and +17.74pp MAY
    NOT BE QUOTED.**

---

## Recap — state these explicitly, at the top

- **Step 0: the JWT expiry and runway, as a recorded number** — second ask.
- **Step 1: the live day, faction, all seven balances, both ledgers, and the
  full gear census**, with each of Claims A–F marked pass or fail. **Expect a
  failure and name it**; two of six failed last session.
- **Step 2: the gear-break forecast, stated in advance**, and whether it held.
- **Step 3: the pre-registration commit hash**, confirmed to predate any spend,
  and confirmed clean of addresses and usernames.
- **Step 4: the K=10 margin on the Dendren-only slice against the pooled
  figure**, which outcome fired, and **§71 put to the user as a decision**.
  Casts played vs charged separately, the cast number the server refused at,
  the rod's durability path and whether the fish-to-zero halt fired,
  `LIVE.drift` and `LIVE.damageHist` reported pooled AND Dendren-only, and the
  Dendren-only catch rate reported **without** being raised as a concern.
- **Step 5: per-run detail**, the shape count at **29/29**, and the four wearing
  pieces read after every run against the forecast.
- **All ten carry-forward items by name.**

Standard closeout: full suite `vitest run --maxWorkers=4` **UNSANDBOXED**
(`tsx` and `git` both fail sandboxed), `tsc --noEmit`, `git diff --check`, and
the secret scan (`npx tsx scripts/secretScan.ts`) **quoted verbatim**.

**Do not trust a `tail`-piped or task-notification exit code** — a notification
reports the COMPOUND command. Capture to a file and read `$?` directly.
