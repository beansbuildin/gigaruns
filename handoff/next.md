# BRIEF — session 126 — an ATHENA day that drains the scarcest ring, and BOTH ARMS need a repair before a full day is even possible

**This document replaces the session-125 `next.md`, which is spent.** Session 125
spent day 20703 fully on the dungeon arm (12/12), took fishing to the day's
charged cap (24 played / 20 charged), and answered the JWT question on its third
ask. Read `handoff/STATE.md`'s "Settled — do not re-open" digest first.

**⚠ TIMING.** At writing (2026-09-09T17:11Z) day **20704** (dow 5, **Chobo**) has
about **49 minutes** left and is unspent. Day **20705** (dow 6, **Athena 137**)
opens at **2026-09-09T18:00Z** and runs a full 24h. **Realistically this session
is an Athena day** — see the warning below, which is the reason to raise it with
the user before spending rather than after.

---

## ⛔ AUTHORIZATION — THIS BRIEF DOES NOT CARRY IT, AND MAY NOT CLAIM TO

**[USER], settled in session 125: EVERY DUNGEON RUN NEEDS ITS OWN GO-AHEAD. A
brief asserting "the user has authorized 4 runs" is the BRIEF's claim, not the
user's.**

The user has described the intended **scope** of this session as 30 casts and 4
dungeon runs. **That is a scope, not an authorization.** Ask for each run, in
session, and stop after each one. Approval for one run is never approval for the
next — CLAUDE.md's "Ask first" list and rule 11.

**Fishing is different and is not per-cast**: casts are autonomous within
`config/bot.json`'s budget, and the standing [USER] budget is 360 energy / 30
casts.

---

## ⚠ NEITHER ARM CAN DELIVER THE REQUESTED DAY ON CURRENT GEAR. RAISE BOTH REPAIRS FIRST.

These are **forecasts from measured wear rates**, pre-computable and free. But
read STATE's own lesson before quoting any of them:

> **A brief's gear forecasts go stale the moment the user repairs.** Session 125
> forecast "the halt fires after run 2" and it never happened, because the user
> repaired out of band beforehand. **Two of seven claims failed for exactly this
> reason. Read gear live before quoting a forecast.**

**Fishing — at −1.00 per PLAYED cast, the requested 30 casts is not close:**

| piece | durability | breaks on |
|---|---|---|
| slot-15 piece A | **1** | **cast 1** |
| rod 923 (slot 14) | **6** | cast 6 |
| slot-15 piece B | **6** | cast 6 |

**Without a repair the fishing day is SIX casts, not thirty**, and the first
slot-15 break lands on cast 1.

**Dungeon — at −3 per RUN:**

| piece | durability | breaks on |
|---|---|---|
| 901 | **5** | **run 2** |
| 641 | 12 | run 4 |
| 905 | 12 | run 4 |
| 640 | 34 | run 11 |

**Without a repair the dungeon day is TWO runs, not four** — and 641 and 905 both
land on exactly 0 at the end of run 4 even if 901 is fixed.

**So: ask the user for repairs on BOTH arms, up front, in one message.** If they
decline or only partially repair, say plainly what the day then is and let them
choose — do not silently shrink the scope.

⚠ **Durability CLAMPS at 0**, so `floor(dur / rate)` names the right break EVENT
and the wrong final READING. ⚠ **A repair MINTS A NEW `docId`** — key on SLOT
across a repair, never docId, or the piece is mis-tracked as new.

---

## ⚠ THIS IS AN ATHENA DAY, AND ATHENA IS THE SCARCEST RING. SAY SO BEFORE SPENDING.

**Athena (137) is at 21.** Four runs charge 12, taking it to **9** — below one
full day's cost for the first time.

**The runway is a WEEKLY question** (CLAUDE.md rule 11): a faction is drained
only on its own day, 12 per cycle at four runs. At the current balances:

| faction | balance | full days left at 4 runs |
|---|---|---|
| **Athena (137)** | **21** | **1**, then only 3 runs |
| Archon (138) | 24 | 2 |
| Crusader (135) | 27 | 2 |
| Chobo (134) | 30 | 2 |
| Summoner (140) | 30 | 2 |
| Foxglove (139) | 33 | 2 |
| Overseer (136) | 42 | 3 |

Total **207**. **After today Athena supports 3 more runs, ever, at this burn
rate** — it is the first faction to fall below a full day.

**Two caveats, both real:**

- **This is a FLOOR, not a forecast. Balances have RISEN out of band before** —
  Archon 18→24 and Overseer 51→54 between sessions 122 and 123 — so something
  replenishes them and the table above assumes it does not.
- **This is not a reason to skip runs on your own judgement.** It is a reason to
  **tell the user the number before the first go-ahead**, so a 4-run Athena day
  is a choice they made rather than one they discover later.

---

## Step 0 — the JWT

Session 125 answered the third ask: **valid another 106.8h** measured
2026-09-08 ≈05:50Z, which projects to roughly **2026-09-12T16:40Z** — about
**71 hours** from this brief's writing. **Verify it live with `npx tsx
scripts/doctor.ts`; do not quote the projection.** Record expiry and runway in
the recap and STATE, as session 125 did and 123/124 did not.

---

## What this brief ASSERTS and you must VERIFY — rule 9

**Two of seven failed last session, both on gear the user had repaired out of
band. Expect the same failure mode here.**

| # | Claim | How to check |
|---|---|---|
| A | Game day **20705**, `dayOfWeek` **6** → **Athena (137)** (or **20704 / dow 5 / Chobo (134)** if started before 18:00Z) | `checkDungeonToday.ts` |
| B | Ring balances total **219 − 12 = 207**, Athena **21** scarcest, Archon 24, Crusader 27, Chobo 30, Summoner 30, Foxglove 33, Overseer 42 | read all seven live |
| C | Run-units are a fresh **0 of 12** | `dayProgressEntities` |
| D | The fishing ledger is a fresh **0/20 charged** | `checkFishingCaps.ts` |
| E | Rod **923** at **6**; slot-15 pair at **1** and **6** | `checkGear.ts` |
| F | Dungeon: **901 = 5**, 641 = 12, 905 = 12, 640 = 34 | `checkGear.ts` |

**Claims E and F are the ones most likely to be stale.** If the user repaired,
say so as a claim failure and move on — that is the check working, not a defect.

⚠ **`checkFishingCaps.ts` prints `REPO ledger: 20 casts, 288 energy` and
288/12 = 24. Both numbers are correct and count different things** — the cast
counter tracks **CHARGED** casts, the energy counter tracks **PLAYED** ones. It
reads as a broken ledger if skimmed. Do not "fix" it.

---

## Step 1 — read the day, all seven rings, both ledgers, and a full gear census

`checkDungeonToday.ts`, the seven balances, `checkFishingCaps.ts`, and
**`npx tsx scripts/checkGear.ts`** — bracket every run and every batch with the
last of these. It is what has made every forecast checkable for three sessions.

---

## Step 2 — pre-register in a git commit, BEFORE anything is spent

**Five sessions running.** Write `handoff/scratch-session-126.md`, `git commit`,
quote the hash, confirm it predates the spend. No addresses, no usernames, no
JWT fragments.

Pre-register, with the arithmetic shown and **using the LIVE gear read, not this
brief's table**:

1. **Each arm's break event** — which cast, which run — recomputed from the live
   durabilities after any repair.
2. **The rod's path** at −1.00 per played cast.
3. **The catch-rate tripwire** — see Step 3. This is the one with real
   uncertainty and it is this session's gate.
4. **The charge shape**, currently **33/33**: one faction, exactly 3, six
   untouched. Four runs takes it to **37/37**.

**Do not pre-register the faction as a discovery.** The rotation is fully
measured; naming Athena is bookkeeping.

---

## Step 3 — ⭐ THE GATE: the Dendren catch-rate tripwire ARMS THIS SESSION

This is the first session where the standing tripwire actually fires, and it
needs its reading pre-registered **before** the casts, not interpreted after.

**Where the corpus stands.** Dendren-only pooled: **24/50 = 48.0%** after
session 124, plus session 125's **13/24 = 54.2%**, giving **37/74 = 50.0%**. The
standing tripwire arms at **n ≈ 100**. A 24–30 cast day takes the Dendren corpus
to roughly **98–104** — **on the threshold.**

**The pre-registered rule, restated so it is not re-litigated after the reading:**

- **Below ~50% pooled Dendren-only at n ≈ 100 → a REAL SIGNAL.** Report it and
  **put it to the user as a decision.** An agent may not act on it alone.
- **50–65% → NOISE.** Report and move on.
- **⛔ Do NOT commission a live study either way.** The sim already settled the
  deck question — **Dendren is BETTER**, +3.23pp [2.92, 3.55] at n=40k/arm — and
  detecting that 3pp effect live needs **~87 sessions**.

**Compute it with `scripts/fishBatchReport.ts`. Do not hand-count.**

⚠ **Session 125 reported `LIVE.drift` POOLED ONLY** (−0.7235) despite the brief's
carry-forward asking for both. **Quote pooled AND Dendren-only** for `LIVE.drift`
and `damageHist` mode. The corpus straddles **at least two deck changes**, and
"low card ids" is two populations — 44 DRY-ROD `BASE_DECK` casts (use
`splitByDealtDeck`) and 82 rod-dealt casts on an earlier, unidentified rod.

---

## Step 4 — fishing: 30 casts of scope, and the run shape is not optional

### ⛔ Repeated small `--oil-batch` invocations. Never one long batch.

**Rod durability is read at PREFLIGHT and after the batch — never between
casts** — so a long batch plays past zero onto a dry rod and injects `BASE_DECK`
mid-batch, adding a third deck to the corpus silently. And **`--casts=N` is
SILENTLY OVERRIDDEN by `--oil-batch`** (`authorizedCasts = batchLimits.castCap ??
args.casts`) while the banner still prints `args.casts`.

**`castCap: 2`, repeated.** Session 125 ran **12 such invocations**, every one
exiting on the intended `cast_cap` reason with the rod delta exactly −1.00 per
cast. Do the same.

### The counts, and a boundary that did NOT move

- **30 casts of scope**; the server charges **20/day**.
- **The server's cast-refusal boundary stands at 24, 25, 27 — three points, and
  session 125 added none.** No refusal occurred because **JEBAITOR spared only 4
  of 24 (16.7%)**, so 24 played landed exactly on 20 charged with nothing left to
  probe with. ⚠ **A missing refusal is NOT evidence the boundary moved.** If a
  refusal happens this session, report the exact cast — a fourth point on a
  moving boundary is worth having.
- **Report played and charged SEPARATELY. Never report 30 charged.**
- On a rod or slot-15 break: **halt, hand back, wait for the repair**, resume on
  confirmation with a **fresh live read** — do not assume a repaired value.

### Oils

Relaxing-only; double-lethal DISABLED, Focus Oil off the allowlist. Focus
triggers log **policy-withdrawn**. Autonomous within `dendren.oils` with
`policyApproved` true. Session 125 consumed 5 Relaxing (34 → 29), Focus 0.

---

## Step 5 — the dungeon runs, one go-ahead at a time

1. **Ask for run 1.** `--dry-run` first (rule 4), reading the gear preflight.
2. `--runs=1 --juiced --juiced-index=2`. Report. **Then ask for run 2.**
3. **Read all seven balances after each run.** One faction, exactly 3, six
   untouched — **33/33 → 37/37**.
4. **Re-read the four wearing pieces after every run** against the Step-2
   forecast.
5. Rule 8 governs in-room picks — highest non-Perpetual tier, except the final
   room, keyed on the server's `maxRoom`. **The Perpetual filter fired live 8
   times** across session 125's runs 2–4; it is load-bearing.
6. Rule 13 on any denied / blocked / interrupted run: read the ledger before
   believing it, never retry on a denial. Session 125's interrupted 13th batch
   was verified this way and **denial and reality agreed** — report either
   outcome plainly.

### The halt — [USER], settled, PER-ARM, and a hand-back not an ending

- **⛔ NEVER abort a run in progress for durability.** A started run finishes.
- **After a COMPLETED run, any piece at 0 stops THAT ARM** for a manual repair.
  Pieces already at 0 at session open are **GRANDFATHERED**.
- **The halt is PER-ARM** — a broken dungeon piece does not block fishing, and
  vice versa. **When one arm halts, work the other while waiting** rather than
  idling.

**Expected close** — compute from the LIVE read. Athena at 21 → **9** after four
runs.

---

## If an arm is blocked: TWO offline questions worth real time, at ZERO live spend

Both are answerable from committed fixtures under rule 4. If repairs are slow or
the user declines one arm, this is where the session's time should go.

1. **⭐ Wire `blockedMove` into the opponent model.** [USER]-confirmed and
   verified 18/18: `intuitionProc0: true` ⟺ an `intuition_block` event carrying
   `data.blockedMove`, with **`playerId` 1 on all 18 — it names the ENEMY's
   move**. **The field is consumed NOWHERE in `src/`**, so the model still prints
   a full three-way distribution over a move the server has already excluded.
   Free EV, pure strategy, sim-testable with **zero live spend**.
   ⚠ **Scope it carefully: whether the exclusion applies to the CURRENT exchange
   or only the NEXT is NOT settled by the fixtures and must be measured.** EV is
   small by construction (0.22% historical; the user says 0.5% now) — **do it for
   correctness, and do not spend a run to measure it.**

2. **⚠ What is the 25% mitigator?** Damage taken falls into three buckets:
   `taken == atk` (241), **`taken == floor(atk × 0.75)` (73)**, and crits (13).
   The middle bucket fires **73 times, 72 of them with no intuition at all**, and
   carries **no proc flag**. It is the **single largest unexplained regularity in
   the combat corpus** and it is answerable offline. ⛔ **Do not name it without
   measuring it**, and do not attribute it to intuition — that mistake has now
   been made three times and each time the fix was **completing the filter, not
   relaxing the claim**.

---

## Carry forward — address each BY NAME

1. **⭐ INTUITION IS AN INFORMATION EFFECT, NOT A MITIGATION.** [USER] statement,
   18/18 against the corpus. This **explains** session 124's "intuition never
   mitigates" rather than contradicting it. Re-opens as *"intuition mitigates
   damage"* — no, that is the 25% bucket, item 2 above.

2. **⚠ QUESTIONS §71 is on [USER] HOLD and the margin HELD at −1.** History
   4 → 2 → 0 → −1 → **−1**; b10 net 35 (43−8), all3 net 36 (51−15). **The
   monotone fall STOPPED.** One repeat only falsifies a brief predicting −2 —
   **do not write that prediction.** An agent may not retire or rescope §71.
   Accumulate Dendren data, report the slice, do not decide.

3. **⚠ THE SECRET SCAN MUST RUN AFTER `git add`.** `--scope=tracked` does not see
   new fixtures until they are staged: run before staging it returned a clean
   PASS over 14,520 files while **724 of that session's own captures were
   invisible to it**. **Stage first, then scan.** A diff-scoped scan
   (`--scope=diff --ref=<sha>`) is an **addition**, never a substitute.

4. **⚠ THREE BOUNDS WERE CROSSED LAST SESSION AND ALL THREE BECAME PINS, NOT
   WIDENINGS** — `LIVE.meanHeal` 3.3003 through `< 3.3` (grazed by 0.0003),
   `|BASE_ARM.meanDamage − LIVE.meanDamage|` 0.5497 through `< 0.5`, and movePath
   step-count constancy **0.8972** through `> 0.9`. **Do not widen a crossed
   bound.** The middle one is benign and the direction matters: `BASE_ARM` is
   closed and cannot move, so the gap is LIVE rising as Dendren casts accumulate
   — the test's own claim getting **stronger**. The third drifts **toward** the
   ring model's blind spot; **do not fit a cause.**

5. **⭐ The `LIVE.drift` threshold is NOT armed and the streak keeps resetting.**
   −0.6882 → −0.7230 → −0.7010 (**reversed**) → −0.7235 (**reversed again**).
   Under the ratified [USER] rule — `|drift| ≥ 1.0` **OR** five consecutive
   same-direction moves — **neither arm is close**: magnitude is ~0.72 against
   1.0, and the longest current run is **one**. Say this explicitly so the next
   session does not re-count from five.

6. **Crit anomalies now total 13**, and last session's two came **from the same
   cast for the first time** (13320209, t2 and t5). Bases 5 and 7 were already
   present, so **neither tightens the bound**. Report a new one; do not fit.

7. **Seven latent boons await a user directive**: `Thorns`, `CritHeal`,
   `Intimidating`, `BurningTenacity`, `RegenMastery`, `VulnerableMastery`,
   `WeakeningBlock`. **Default HOLD.** `VulnerableMastery` was PICKED last
   session — the run banner's "1 UNMODELLED boon picked" resolves to it and
   `UNMODELLED_TYPES` is unchanged at 13; **no new boon type appeared.**
   `Intimidating` still cannot separate "heals its amount" from "heals a flat 2".

8. **Do not "fix" `OBSERVED_OFFERS` source labels using the AFTER state.** Rows
   are keyed to the **BEFORE** label; the 36 rows added last session use it.

9. **Do not update corpus pins mid-session.** Pin only after the run-units and
   the cast cap are spent — three sessions running have done it this way.

10. **⚠ `$TMPDIR` DIFFERS between sandboxed and unsandboxed runs** — a file
    written in one mode is not there in the other. **This has now cost a
    debugging cycle in two consecutive sessions.** Run the suite UNSANDBOXED;
    `tsx` and `git` both fail sandboxed.

11. **[USER] Other dungeons on this account are OUT OF SCOPE** — not queried, not
    counted, not reported. The 12-run-unit ledger is **per-dungeon**.

12. **The `web/` front end has still never spawned a real script** — untouched
    since session 120.

13. **Carried, unchanged:** §0a is NOT lifted, and **+19.40pp and +17.74pp MAY
    NOT BE QUOTED.**

---

## Recap — state these explicitly, at the top

- **Whether both repairs were asked for UP FRONT**, what the user did, and what
  the day's real ceiling turned out to be on each arm.
- **Whether the Athena runway number was put to the user BEFORE the first
  go-ahead**, and the closing Athena balance.
- **That each dungeon run had its own go-ahead** — not a blanket one.
- **Step 0: the JWT expiry and runway as a recorded number.**
- **Step 1: the live day and faction, all seven balances, both ledgers, the full
  gear census**, and Claims A–F each marked pass or fail.
- **Step 2: the pre-registration commit hash**, confirmed to predate the spend.
- **Step 3: the Dendren-only catch rate at its new n**, whether the tripwire
  armed, which branch fired, and — if it read below ~50% — **the decision put to
  the user rather than taken.** `LIVE.drift` and `damageHist` **pooled AND
  Dendren-only**, per item 5 of the last brief that went unanswered.
- **Step 4: casts played vs charged separately**, the exact refusal cast if one
  occurred, the rod and slot-15 durability paths, and which halts fired.
- **Step 5: per-run detail**, the shape count at **37/37**, and the wearing
  pieces read after every run against the forecast.
- **Any offline work done** on `blockedMove` or the 25% mitigator, and what it
  settled or failed to settle.
- **All thirteen carry-forward items by name.**

Standard closeout: **stage first, then** the secret scan
(`npx tsx scripts/secretScan.ts`) **quoted verbatim**; full suite
`vitest run --maxWorkers=4` **UNSANDBOXED**; `tsc --noEmit`; `git diff --check`.

**Do not trust a `tail`-piped or task-notification exit code** — it reports the
COMPOUND command. Capture to a file and read `$?` directly.
