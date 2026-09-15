# BRIEF — session 132 — the THIRD gold point, 4 Tier-3 runs stopping ONLY after run 1, and 30 casts the rod cannot currently reach

**This document replaces the session-131 `next.md`, which is spent.** Session 131
spent a full live day, took the **second gold point** (dow 3 → **Archon 247**,
killing the shifted-silver candidate), ran the **first Golkan batches since the
revert**, and left the suite green (2752/2752).

---

## ⏱️ TWO THINGS TO SETTLE IN THE FIRST MESSAGE, BEFORE ANYTHING IS SPENT

### 1. ⚠ THE WINDOW IS ~58 MINUTES AND THE SCOPE DOES NOT FIT IT

At this brief's writing (**2026-09-15T17:02Z**) day **20710 (dow 4)** closes at
**18:00Z** — about **58 minutes**. Day **20711 (dow 5)** then opens with a full
24 hours.

**Both days are unmeasured gold days**, so the rotation gate is available on
either — there is no reason to prefer the sliver *for the measurement*.

Last session's shape, for calibration: four runs took **~21 minutes**, and 20
casts in two batches took the rest of the hour. **4 runs + up to 24 casts + a
stop-and-report after run 1 does not comfortably fit in 58 minutes**, and
session 127 and 131 both had batches straddle the 18:00Z rollover — which
**resets the cap mid-batch** and, in 131, made a mid-batch instruction
unactionable.

**Recommend waiting for the rollover; do not decide it.** The user chose not to
wait on 2026-09-10 and that was their call to make. **Put the choice in the
first message with the runway and the gear reading**, then follow the answer.
⚠ **If the window closes mid-session, STOP** — day 20711 is a fresh day, a
different gold faction, and needs its own authorization.

### 2. ⚠ 30 CASTS IS NOT REACHABLE ON THE CURRENT ROD. IT IS AT 24.

**[USER] NEW RULE, 2026-09-14: FISHING STOPS ONLY ON A BROKEN ROD.** Slot-15
lures at 0 do **not** halt fishing and do **not** size the batch. **The cap is
`min(rod, ledger, authorized)`.** CLAUDE.md rule 11. ⛔ Re-opens as *"size
castCap to the slot-15 gear"* or *"the lure at 0 halts fishing"* — both now
wrong.

So, with the user's 30-cast authorization:

| term | value | caps |
|---|---|---|
| **rod 812** | **24** | **PLAYED casts — the hard gate** |
| game ledger | 20/day | **CHARGED** casts only |
| authorized | 30 | — |

**Maximum plays today: 24, of which at most 20 charge.** Casts 25–30 do not
exist unless the rod is repaired first.

**Ask the user whether to repair the rod before the batch** — STATE 131's own
open question 2. It is the one repair that changes what the day can do, and it
is a single question, not a gear table.

⛔ **A batch must NEVER exceed the rod's remaining durability.** That is the
dry-rod `BASE_DECK` hazard: the rod is read at preflight and after the batch,
never between casts, so a batch that outruns it injects a foreign deck mid-batch
unnoticed. Size each batch to what remains — session 131 ran 10 + 10 on a rod at
44; at 24 that would be 10 + 10 + 4, or 12 + 12.

---

## ⭐ [USER] SCOPE — 4 TIER-3 RUNS, STOPPING ONLY AFTER RUN 1

**The user's words: *"4 tier 3 dungeon runs, stop only after the first one."***

**This is exactly the right shape and the brief should say why**, so it is not
"simplified" into four consecutive runs later: **all the rotation's diagnostic
value is in run 1's isolated balance diff.** The charged faction does not change
within a day, so runs 2–4 confirm the shape but cannot re-test the order. A stop
after run 1 reads the third gold point clean; a stop after run 4 reads it
muddied by three more charges.

**So:**

1. `--dry-run` once (rule 4). **Confirm it prints `index 3`.**
2. **Run 1.** `--runs=1 --juiced --juiced-index=3`.
3. **STOP. Read all fourteen balances, twice. Report which gold faction moved,
   by how much, and the verdict against the pre-registration.**
4. **Then runs 2, 3 and 4 back to back — no further pauses.**

⛔ **This brief does not carry the authorization.** [USER] approval is **per
session, in session**; the scope above is the user's stated *plan*, and one
authorization in chat then covers all four runs. **A brief may never manufacture
it — ask once.**

**What "no further pauses" does not suspend:** **rule 5** fail-closed (unknown
enum, 5xx, three consecutive action failures, a cap hit → stop, log, exit
non-zero), **rule 13** (read the ledger before believing a denial; never retry on
one), **rule 8** on in-room picks, and the **dungeon gear halt**.

---

## Step 0 — the JWT, and a correction to the last brief

**JWT `exp` = 2026-09-20T16:32:40Z** — roughly **120 hours** out. It will not
bind; the day will.

⚠ **The last brief said to verify it with `doctor.ts`. `doctor.ts` does NOT print
JWT expiry.** Session 131 decoded `exp` from the token file instead. **Do that,
and record expiry and runway in the recap and STATE** — or, better, teach
`doctor.ts` to print it, which is a five-minute fix that would stop this
recurring.

---

## Step 1 — read everything, before the first `start_run`

`checkDungeonToday.ts` · `checkEntryTiers.ts` (rollover clock; it now prints both
gold points and no runway line) · **all FOURTEEN ring balances, both metals** ·
`checkFishingCaps.ts` · **`npx tsx scripts/checkGear.ts`**.

### Claims to verify — rule 9

| # | Claim | value |
|---|---|---|
| A | Day / dow — **20710, dow 4** at writing; **20711, dow 5** after 18:00Z | per the clock |
| B | **GOLD** totals **224**: Archon **28**, Foxglove 19, Overseer 25, Crusader 25, Athena 35, Chobo 44, Summoner 48 | read live |
| C | **SILVER** totals **159** and should be **untouched** by a Tier-3 entry | read live |
| D | Tier **3** offered; `entryData[].tier === 3` carries GOLD ids | read live |
| E | Run-units fresh **0 of 12** | `dayProgressEntities` |
| F | Fishing ledger fresh **0/20 charged** | `checkFishingCaps.ts` |
| G | **Rod 812 at 24** — the only fishing gate | `checkGear.ts` |

⛔ **`index` is the TIER, not an array position.** `entryData` comes back ordered
**tier 2, 1, 3**; **`entryData[3]` does not exist.** Match on
`entryData[].tier === 3`. `liveRun.ts` sends `index` straight to the server —
keep it that way.

⚠ **Do not print ring balances with positional `awk` columns** — faction names
shift the fields, and session 130 lost a gold reading that way. Use `sed` on the
`balance N` token, or read the JSON.

⚠ **Gold item ids known so far: Foxglove 248, Archon 247.** The other five are
**not** in this brief — read them off `entryData`.

---

## Step 2 — gear: read it live. SEVENTH session, and repairs now land MID-session.

**STATE 131:** *"A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT — SEVENTH session,
and repairs now land MID-SESSION too. Read `checkGear.ts` at open AND before
each batch."*

**So this brief publishes no gear table for the dungeon arm.** Read it at open,
and again before each fishing batch.

**What can be said without a table, because it follows from the rules:**

- **Pieces at 0 at session OPEN are GRANDFATHERED** and do not block runs. If
  641 or 901 read 0, the dungeon arm is **not** halted.
- **A piece reaching 0 DURING the session halts the dungeon arm after that run.**
  On session 131's closing path (640 24, 905 14), **four runs at −3 would leave
  640 at 12 and 905 at 2 — no halt.** Verify against the live read; do not
  assume it.
- ⚠ **`checkGear.ts`'s DUNGEON HALT banner still fires permanently on
  grandfathered item 50 (slot 8).** Check WHICH slot before believing it. The
  fishing verdict now correctly reads slot 14 only.

---

## Step 3 — pre-register, then spend

**Eleventh session running**, split per arm (`8a273d55`, `c3a29c3b`, `b36f1eaf`
last time — each before its own spend). Write `handoff/scratch-session-132.md`,
`git commit`, quote the hash. No addresses, no usernames, no JWT fragments.

### ⭐ THE GATE: the THIRD gold point

**Two points measured: dow 2 → Foxglove (248), dow 3 → Archon (247).** Shape
(one gold faction × 3, six gold and all seven silver untouched) stands at
**8/8**.

- **⭐ Under a 7-permutation, this day must charge NEITHER Foxglove nor Archon.**
  That is the sharp falsifier: **a repeat kills the permutation hypothesis**,
  exactly as it would have for silver.
- **Pre-register the five-faction SET** — Overseer, Crusader, Athena, Chobo,
  Summoner. **Name which you expect and why, then report what came.**
- ⛔ **Do NOT predict from the silver dow map** (falsified session 130) **or from
  "gold = silver shifted by one day"** (falsified session 131 — it predicted
  Summoner and Archon came). Both are in the do-not-re-open digest.
- **n=2 separates nothing about order.** Say so; a third point narrows the set,
  it does not solve it.

### Also pre-register

- **The gold path**: the charged faction's opening balance, **−3 per run**, six
  gold untouched, **all seven silver untouched**.
- **The Tier-3 shape count 8/8 → 12/12.**
- **Hard Core as a RATIO.** Pooled Tier-3 across two days: **969/room, ×1.98** of
  Tier 2's 490/room, band [1.6, 2.4]. Predict the ratio, not a total — death
  room dominates.
- ⛔ **Dendren Root (846) is a function of the DEATH ROOM, not the tier** —
  per-room identity now **8/8** across two Tier-3 days. **Compare per room,
  never totals.**
- **The gear path** per run at −3, from the LIVE read.
- **The fishing batch sizes**, each ≤ the rod's remaining durability.

---

## Step 4 — fishing on Golkan

- **Set `castCap` per batch to `min(remaining rod, remaining ledger, remaining
  authorized)`**, as `SESSION_131_LIMITS` did at 10 — add `SESSION_132_LIMITS`
  the same way. ⛔ **`--casts=N` is silently overridden by `--oil-batch`** while
  the banner still prints `args.casts`.
- **Report played and charged separately.** The game ledger **lagged the repo
  ledger by one mid-session** last time (8 vs 9 after batch 1) and converged at
  17/17 after batch 2 — **that is not a rule-13 event**; note it and continue.
- Oils **Relaxing-only** (17 held); Focus off the allowlist, triggers log
  **policy-withdrawn**.

### ⚠ THE REVERT HAS NOT YET RESTORED ~60%, AND THE RECAP SHOULD SAY SO PLAINLY

**The first 20 Golkan casts after the revert read 9/20 = 45.0%** (batches 5/10
and 4/10) — **not** the ~59.6% the revert was argued on. **n=20 is small and
this is not a reason to reverse anything**, but it is exactly the kind of number
that gets quietly dropped, and the revert's own case was built on a catch-rate
comparison.

- **Golkan cumulative is now 192/327 = 58.7%** — ⚠ **but that figure is
  ARITHMETIC on carried numbers (183/307 + 9/20), not recomputed from the
  corpus.** **Recompute it properly this session**: `loadCastTraces()` →
  `splitByDealtDeck(...).rod` → `deckOf()` from `scripts/redrawDeckSlice.ts`,
  then count `t.caught`. ⛔ Do not use `loadFishingCorpus()` (no `.turns`) or
  `fishBatchReport.ts` (session-scoped).
- **Report the post-revert Golkan casts as their own sub-slice** alongside the
  cumulative, and flag the era: these follow a policy era and two rod swaps.
- Other slices unchanged: **Puppeteer 11/27 = 40.7%**, **Dendren 54/104 =
  51.9%**. ⛔ Never pool across rods.
- ⛔ **Do not re-derive a drift table to argue about any of this.** **Deck
  arithmetic has not predicted live catch rate — twice**, and that is settled.

---

## Carry forward — name each in the recap

1. **⭐ THE FISHING ROD CARRIES NO DUNGEON STAT LINE — ANSWERED.** Golkan
   openings read **50/17, rock 26, ×4** — identical to rod 924. The cause of the
   2026-09-12 `hpMax` 51→50 / rock ATK 27→26 drop is **unknown and nothing
   currently tests it. Low priority; do not spend a run on it.** Re-opens as
   *"swap to 923 to test the rod stat line"*.

2. **⭐ `blockedMove`'s wiring stays FALSIFIED, now 27 procs.** Current **8/27**
   vs 9.01 (P ≈ 0.43 — chance); next **2/27** (P ≈ 0.0018). **A soft prior, not
   an exclusion — two counterexamples stand.** Consumed nowhere. ⛔ **Do not
   commission runs for it**; it accrues for free.

3. **⭐ "cards.json holds 8 of Golkan's 10 cards" was FALSE and is retired** —
   10/10 present, drift **0.400 exactly**; the −0.389 figure is retired and its
   source unknown. ⛔ **Do not try to reproduce −0.389** (grant list, 80–89 and
   74+80–88 all miss) and **do not add cards 82/83 to the fixture** — they are
   not Golkan cards.

4. **⛔ PIN AFTER ALL CASTS, NOT AFTER THE FIRST BATCH.** A re-pin pass started
   before the day's last batch **had to be redone** — batch 2 landed mid-pass and
   moved **62 pins again**. Pin in-session, but only once every arm is closed.
   190 annotated sites last time, green same-session.

5. **⛔ Four fresh tooling traps.** Do not end a background loop with
   `[ $rc -ne 0 ] && break` — **the task reports exit 1 on a clean run**; read
   each run's own exit line. Do not let a blanket patcher write
   `toBeCloseTo(x, 1)` sites — it writes full precision into a 1-digit pin;
   **round those by hand**. **The vitest JSON reporter carries no diff for
   arrays/objects** — use the default reporter to read received values. And the
   patcher that **parses every failure before writing**, with `tests/`
   snapshotted first, ran 8 rounds with 0 bad writes — **keep that shape**.

6. **⚠ `KNOWN_CRIT_ANOMALIES` went 20 → 21** (Golkan card 86, 6 → 9). The
   fish-HP interval is unchanged at **[1.500, 1.5625)**. Report a new one; do not
   fit.

7. **⭐ [USER] RING BALANCES ARE NOT A CONSTRAINT.** The runway line is now
   **deleted** from `checkEntryTiers.ts`. ✅ Still read **all fourteen** before
   and after every run — the debit is not on the wire, so that read is the only
   check on the charge shape.

8. **Cleanup, no user question needed:** `factionDayRunway` is exported and
   tested but **printed by nothing** since the runway line went. STATE calls it
   "cleanup, not a decision the user needs to make" — **delete it and
   `tests/entryTierRunway.test.ts` with it**, or leave both and say why. Do not
   spend a user question on it.

9. **⚠ THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE** —
   `liveRun.ts`, `liveFishing.ts`, `orchestrator.ts`. Directed cleared
   2026-09-11; did not block anything last session. **The user's edit; an agent
   cannot make it.** Mention once, do not re-litigate.

10. **Carried:** never read consecutive captures as consecutive **EXCHANGES**;
    **`loadCorpus()` drops `data.events`**; ratio pins need **both halves**;
    **[USER] other dungeons are OUT OF SCOPE** (ledger per-dungeon); the
    **Tier-1/Tier-3 income baseline stays RETIRED BY NAME**; the **orchestrator's
    dungeon arm stays CLOSED**; **`web/`** untouched since session 120;
    **§0a NOT lifted — +19.40pp and +17.74pp MAY NOT BE QUOTED.**

---

## Recap — lead with these

- **The window decision**: whether the session ran in the 58-minute sliver or
  waited for 18:00Z, and which day it actually spent.
- **The rod-repair answer**, and the resulting real cast ceiling — **24 without a
  repair, not the 30 authorized.**
- **⭐ THE THIRD GOLD POINT, read after run 1 IN ISOLATION**: which faction, by
  how much, whether it was Foxglove or Archon (killing the permutation), and how
  it scored against the pre-registered five-faction set.
- **That runs 2–4 then ran back to back** with no further pauses, and that ONE
  authorization covered the session, given in chat.
- **Whether any SILVER moved on a Tier-3 entry** — it should not — and the
  Tier-3 shape count at **12/12**.
- **Hard Core as a ratio** against ×1.98, and **846 per death room**, never
  totals.
- **The live gear reading at open and before each batch** — never a forecast.
- **Fishing: played vs charged separately**, batch sizes against remaining rod,
  **the post-revert Golkan sub-slice reported alongside a cumulative RECOMPUTED
  from the corpus**, and the 45.0% stated plainly rather than folded away.
- **All ten carry-forward items by name.**

Closeout: **stage first, then** `npx tsx scripts/secretScan.ts` **quoted
verbatim** (plus `--scope=diff` as an addition, never a substitute); suite
`vitest run --maxWorkers=4` **UNSANDBOXED and GREEN**; `tsc --noEmit`;
`git diff --cached --check`; `discoveredShipsClean` 8/8. **Never trust a
`tail`-piped or notification exit code** — capture to a file and read `$?`.
