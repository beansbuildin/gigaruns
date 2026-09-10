# BRIEF — session 127 — ON THE CLOCK: an ATHENA day by the user's explicit call, ~40 minutes wide

**Short by design.** Session 126 proved 4 runs fit inside a 44-minute window.
This brief is ordered so the first 200 words are the only ones needed before
`start_run`. Everything below Step 3 can be read while runs are in flight.

---

## ⏱️ STEP 0 — THE DAY IS DECIDED. CONFIRM THE CLOCK, THEN GO.

**Run `npx tsx scripts/checkEntryTiers.ts` and read `next day in HH:MM:SS`
BEFORE anything else.** This is settled, it is [NEW] in STATE 126, and it is the
single highest-value habit this project has:

> **THE FACTION IS A FUNCTION OF THE ROLLOVER CLOCK, AND A BRIEF WRITTEN HOURS
> EARLIER WILL NAME THE WRONG ONE.** Session 126's brief said "Athena day". The
> clock said 44 minutes. It was a **Chobo** day, and reading the clock saved 12
> Athena.

### ⭐ [USER] DECIDED 2026-09-10: **DO NOT WAIT FOR THE ROLLOVER. RUN NOW, ON ATHENA.**

The tradeoff was put to the user and answered: *"we are not waiting for the
rollover."* **This is settled — do not re-raise it, do not stall for 18:00Z, and
do not propose Archon as the cheaper spend.**

| | day | dow | faction | balance | after 4 runs |
|---|---|---|---|---|---|
| ⭐ **THIS SESSION — window closes 2026-09-10T18:00Z** | **20705** | **6** | **Athena (137)** | **21** | **9** |
| (for reference only — not this session) | 20706 | 7 | Archon (138) | 24 | — |

**⚠ Athena is the SECOND-scarcest ring, and after these four runs it becomes the
scarcest at 9.** Chobo is scarcest right now at 18 — it fell there last session,
and any note calling Athena scarcest *today* is stale. **The user knows this and
chose to spend it. Do not re-litigate the choice mid-session.**

**⏱ THE WINDOW IS THE CONSTRAINT, NOT THE DECISION.** Session 126 fit four runs
into 44 minutes (62 + 63 + 58 + 97 actions, 0/280 first-attempt failures), so it
is achievable — but only if Step 1's reads are quick and the pre-registration is
four lines, not four paragraphs.

**Still verify the clock in the first two minutes anyway.** Not to reopen the
choice — to confirm which day the server thinks it is before charging a ring. If
`checkEntryTiers.ts` says the rollover already passed, **you are on Archon, not
Athena**; say so and carry on rather than treating it as a problem.

**⚠ If the window closes mid-session, STOP.** Do not roll straight into day
20706's run-units on the assumption that more runs are wanted — that is a fresh
day and a different ring, and every run needs its own go-ahead.

---

## Step 1 — reads, before the first `start_run`

`checkDungeonToday.ts`, all seven balances, `checkFishingCaps.ts`,
`npx tsx scripts/checkGear.ts`.

**Claims to verify — rule 9. TWO have failed on out-of-band user repairs in each
of the last TWO sessions. Expect a third.**

| # | Claim | value |
|---|---|---|
| A | Day / dow / faction | **per the clock, Step 0** |
| B | Rings total **195**: Chobo 18, Athena 21, Archon 24, Crusader 27, Summoner 30, Foxglove 33, Overseer 42 | read live |
| C | Run-units fresh **0 of 12** | `dayProgressEntities` |
| D | Fishing ledger fresh **0/20 charged** | `checkFishingCaps.ts` |
| E | Dungeon gear: 640 = **22**, 641 = **0**, 901 = **14**, 905 = **0** | `checkGear.ts` |
| F | Fishing gear: rod 923 = **38**, slot-15 pair = **18 / 18** | `checkGear.ts` |

⚠ **`checkFishingCaps.ts`'s cast counter tracks CHARGED casts and its energy
counter tracks PLAYED ones** (2 casts / 24 energy, 24÷12 = 2). Both correct.
Reads as broken if skimmed. Do not "fix" it.

---

## Step 2 — ⚠ 641 AND 905 ARE ALREADY AT 0. FOUR RUNS ARE POSSIBLE ON BROKEN GEAR.

**They are GRANDFATHERED** — pieces at 0 when the session opens do not trigger
the halt — so the arm is **not blocked** and 901 (14) and 640 (22) both survive
four runs at −3 each.

**But those runs happen on a degraded loadout, and that is a corpus problem, not
a safety one.** Session 122's broken-gear run opened at hpMax 45 with Sword ATK
26→16 and was the shallowest of its day; **runs on repaired and unrepaired gear
are different arms and nothing downstream separates them after the fact.**

**The user has authorized the runs on this gear and the clock is short, so
RUN — do not stop to ask for a repair.** They are grandfathered. **But say in the
recap, in these words, that these four runs are a BROKEN-GEAR ARM**, and do not
let it pass unlabelled. A one-line mention that a repair would clean up future
runs is worth making at the END, not before the first run.

**Fishing:** rod 38 is comfortable and **cannot reach 0 in 25 casts** (ends at
13); **the slot-15 pair at 18 breaks on cast 18.** At −1.00 per PLAYED cast that
is the binding limit, not the rod — see the fishing section for why this makes a
long batch safe today.

⚠ **A gear forecast goes stale the moment the user repairs — read live, then
quote.** Two consecutive sessions failed exactly these two claims.

---

## Step 3 — pre-register, then run

**Six sessions running, and every dungeon forecast landed exactly last time.**
Write `handoff/scratch-session-127.md`, `git commit`, quote the hash, confirm it
predates the spend. No addresses, no usernames, no JWT fragments.

**Keep it to four lines if the clock is tight** — the commit's value is the
timestamp, not the prose:

1. **The day, dow and faction, read off the clock** (Step 0).
2. **The ring path**: **Athena 21 → 18 → 15 → 12 → 9**, sole mover, six untouched.
3. **The gear path**: 901 and 640 per run; 641/905 already 0 and grandfathered.
4. **The charge shape, currently 37/37 → 41/41** after four runs.

### ⭐⭐ [USER] EXPLICIT AUTHORIZATION, 2026-09-10 — RUN ALL FOUR WITHOUT PAUSING

**The user's words, given in session and governing this session:** *"explicitly
allow the bot to run 4x consecutive dungeon runs without pausing in between,
followed by up to 25 fishing casts (18/20 available) without stopping."*

**This is a real authorization, not a scope.** It supersedes, FOR THIS SESSION
ONLY, the standing rule that every dungeon run needs its own go-ahead.

- **Run all four back to back. Do not stop to ask between runs. Do not ask for
  run 1 either** — it is already given.
- **⚠ SESSION-SCOPED. It does NOT amend the standing [USER] rule.** The next
  brief may **not** carry this forward, and a brief that says "the user has
  authorized 4 runs" without a fresh statement is making the BRIEF's claim
  again. That entry stays in the do-not-re-open digest exactly as written.

**What "without pausing" does NOT suspend — all of it still binds:**

- **Rule 5, fail closed.** Unknown enum, HTTP 5xx, three consecutive action
  failures, a daily cap hit → **stop the loop, log the body, exit non-zero.**
  "No approval pause" is not "no safety halt".
- **Rule 13.** On any denied / blocked / interrupted run, read the server ledger
  before believing it and **never retry on the strength of a denial.**
- **Rule 8** on in-room picks: highest non-Perpetual tier, except the final room,
  keyed on the server's `maxRoom`. The Perpetual filter fired live 7 times last
  session.
- **Rule 4:** `--dry-run` once before run 1. One dry-run, not four.

**Then:** `--runs=1 --juiced --juiced-index=2`, four times, consecutively.

**Read all seven balances after each run** — one faction, exactly 3, six
untouched — but **read and continue; do not wait for a reply.** Report the four
reads together at the end.

**The gear halt should not fire on the dungeon arm this session:** 641 and 905
are already 0 and **grandfathered**, and 901 (14) and 640 (22) both survive four
runs at −3. **If something unexpectedly reaches 0, the user's "without pausing"
governs these four runs — finish them and report it**, rather than halting on a
piece the forecast did not name.

### ⭐⭐ Fishing — UP TO 25 CASTS, NO STOPPING, and the dry-rod hazard does NOT apply today

**Authorized in the same breath: up to 25 casts, without stopping. 18 of 20
charged casts remain** (the ledger is at 2/20 from session 126).

**⚠ THE MECHANICS WILL SILENTLY BETRAY A 25-CAST INTENT IF YOU USE `--casts`.**
`authorizedCasts = batchLimits.castCap ?? args.casts` — so **`--casts=N` is
overridden by `--oil-batch`'s `castCap` while the banner still prints
`args.casts`.** This is why `--casts=15` once played 2. **Set the batch's
`castCap` to the number you actually intend; do not rely on `--casts`,** and
check played-vs-intent afterward rather than trusting the banner.

**⭐ Why running long is SAFE this session, stated so it is not mistaken for
overriding a safety rule.** The `castCap: 2` convention exists because rod
durability is read **at preflight and after the batch, never between casts**, so
a long batch could play past zero onto a dry rod and inject `BASE_DECK`
mid-batch. **That hazard requires the rod to reach 0. It cannot today:** rod 923
is at **38**, and 25 casts at −1.00 per played cast leaves it at **13**. The
rod-to-zero halt is not reachable. **Run long.**

**⚠ What DOES break: the slot-15 pair is at 18 and reaches 0 on cast 18.** Casts
**19–25 are a broken-slot-15 arm.** The user has authorized running through it,
so **do not stop** — but **label those casts explicitly in the recap.** Nothing
downstream separates the arms after the fact.

**Pre-register the refusal.** The server's refusal boundary has landed at day-cast
**24, 25 and 27**. With 2 already charged, this session's cast 18 is the day's
20th charged and plays 19+ are uncharged, putting the day total at 27 if all 25
run — **the top of the observed range. Expect a refusal somewhere around session
cast 22–25.** If one comes, **halt cleanly on it, do not push past**, and report
the exact number: it is the fourth point on that boundary and session 125 got
none.

**Report played and charged SEPARATELY.** Never report 25 charged; only 18 can
charge. Oils **Relaxing-only**; Focus off the allowlist, triggers log
**policy-withdrawn**; autonomous within `dendren.oils` with `policyApproved`
true.

---

## The open gate, carried from a session that could not reach it

**⭐ THE DENDREN CATCH-RATE TRIPWIRE STILL HAS NOT ARMED.** Session 126 played
**2 casts of a 30-cast scope**, so the corpus reached **n = 76**, not ~100.
**GATE UNMET, still open.**

Current readings, and **quote all three or none** — the pooled figure alone is
misleading:

- **Dendren-only 38/76 = 50.0%**
- **Golkan 183/307 = 59.6%**
- **Pooled 255/509 = 50.1%**

**The pre-registered rule, unchanged:** below **~50% Dendren-only at n ≈ 100** is
a **real signal** → report it and **put it to the user as a decision**; 50–65% is
noise; **⛔ no live study either way** — the sim settled it (Dendren +3.23pp
[2.92, 3.55], n=40k/arm) and detecting 3pp live needs **~87 sessions**.

⚠ **STATE 126 recorded that Dendren catches WORSE than Golkan in live play
(50.0% vs 59.6%). That is an OBSERVATION, not a re-opening of the settled sim
result** — it is confounded by era and by small n. Do not re-litigate it.

⛔ **Do not read `fishBatchReport.ts` for a corpus-wide Dendren rate** — it is
**session-scoped** and printed `catch rate 0.0%` before any cast last session.
The Dendren slice comes from `scripts/redrawDeckSlice.ts` / `splitByDealtDeck`.

---

## Carry forward — name each in the recap

1. **⚠ A REPAIR DOES NOT ALWAYS MINT A NEW `docId` — the settled claim has a
   clean counterexample.** Rod 923 read 6 at 17:14:57Z and 40 at 17:33:22Z under
   a **byte-identical** docId. **Keying on SLOT is still correct; the MECHANISM
   claim is falsified.** Only the rod is clean — 901 and the slot-15 pair were
   repaired before the first read, so their docIds cannot be compared.

2. **⛔ THREE NEW LATENT BOONS IN ONE SESSION — the roster is now TEN, not
   seven.** New: `LossLuckUp`, `IntuitionArmor`, `AddWeakShield`. Existing:
   `Thorns`, `CritHeal`, `Intimidating`, `BurningTenacity`, `RegenMastery`,
   `VulnerableMastery`, `WeakeningBlock`. **Default HOLD; n=1 needs a [USER]
   directive.** `IntuitionArmor` **ROLLS** (`val1Min` 7, `val1Max` 10, drew 7),
   so a single pickup cannot pin even its magnitude.

3. **⭐ THE FIRST-EVER `Vulnerable` FLOOR-MULTIPLIER EXCEPTION, and it is a
   BOON.** atk 39, Vulnerable 1, no proc flags, expected `floor(39×1.25)` = 48,
   server dealt **52**. Splitting on `VulnerableMastery` separates it perfectly:
   **ABSENT 84/84 obey, ACTIVE 0/1.** ⛔ **Not modelled and NOT NAMEABLE** — 4/3,
   1.35 and "+4" all reproduce 52 at atk 39. *"Vulnerable is exceptionless"* is
   no longer true.

4. **⚠ `deckShuffle`'s sequential bound was CROSSED (6 of 515) and THE TWO NULLS
   NOW DISAGREE** — ordered-uniform P(≥6) ≈ 5.2e-6, SET null ≈ 3.5%. **Pinned,
   not widened.** The session-79 falsification is **untouched** (1.17% against a
   2% bar). Not *"raise the bound to 7"*; not *"the loader serves the pile
   sequentially"* — that would show 515, not 6.

5. **⚠ TWO DRIFTING BOUNDS RE-PINNED, both continuing their direction.**
   `|BASE_ARM.meanDamage − LIVE.meanDamage|` 0.5497 → **0.5566** — **benign**,
   `BASE_ARM` is closed so the whole move is LIVE rising, i.e. the test's own
   claim getting **stronger**. movePath step-count constancy 0.8972 → **0.8957**,
   a **second consecutive fall** toward the ring model's blind spot. **Do not fit
   a cause. Do not widen a crossed bound** — three became pins last session.

6. **`LIVE.drift` REVERSED AGAIN** (−0.7235 → **−0.7199**), so the streak resets
   to **one**. Under the ratified [USER] rule — `|drift| ≥ 1.0` **OR** five
   consecutive same-direction moves — **neither arm is close.** Say so, so the
   next session does not re-count from five.

7. **§71 K=10 — quote BOTH slices.** **Pooled margin −1, HELD for a third
   session**, components byte-identical (b10 124/43/8 = 35; all3 160/51/15 = 36).
   **Dendren-only margin −3** at n=76. **[USER] HOLD — an agent may not retire or
   rescope it.** Do not write a brief predicting −2.

8. **Two offline questions, zero live spend, if an arm stalls.** (a) **Wire
   `blockedMove` into the opponent model** — the server names the ENEMY's
   excluded move, `playerId` 1 on all 18, and the field is consumed **nowhere in
   `src/`**; scope whether the exclusion binds the CURRENT or only the NEXT
   exchange, which the fixtures do **not** settle. (b) **The 25% mitigator** —
   73 exchanges take `floor(atk × 0.75)` with no proc flag, 72 with no intuition
   at all. ⛔ **Do not name either without measuring.**

9. **⚠ `$TMPDIR` DIFFERS between sandbox modes — THIRD consecutive session it
   cost a cycle.** Sandboxed `tsx` also fails outright (EPERM on its IPC socket).
   **Run the suite UNSANDBOXED.**

10. **JWT: valid to ≈ 2026-09-12T16:40Z** — roughly **47h** from this writing.
    Verify with `doctor.ts`; record expiry and runway in the recap and STATE.

11. **Do not "fix" `OBSERVED_OFFERS` source labels using the AFTER state**; the
    rows use the BEFORE label. **Do not update corpus pins mid-session.**

12. **[USER] Other dungeons on this account are OUT OF SCOPE.** The 12-run-unit
    ledger is per-dungeon. **The `web/` front end** is still untouched since
    session 120. **§0a NOT lifted; +19.40pp and +17.74pp MAY NOT BE QUOTED.**

---

## Recap — lead with these

- **The rollover clock reading, the day, and the Athena close** (21 → 9 if all
  four ran), and whether the window closed before the runs did.
- **Whether the gear repair was raised**, and — if the runs went ahead on 641/905
  at 0 — **the words "this is a broken-gear arm"**, explicitly.
- **That the four runs used the user's EXPLICIT session-scoped authorization**,
  and a note that it does **not** carry to the next session.
- Claims A–F each marked pass or fail; the pre-registration hash; per-run detail;
  the shape count at **41/41**.
- **Fishing: casts played vs charged separately** (max 18 charged), the exact
  refusal cast if one came, **which casts were the broken-slot-15 arm (19+)**,
  the Dendren-only n and rate, and whether the tripwire armed at n ≈ 100.
- **All twelve carry-forward items by name.**

Closeout: **stage first, then** `npx tsx scripts/secretScan.ts` **quoted
verbatim**; suite `vitest run --maxWorkers=4` **UNSANDBOXED**; `tsc --noEmit`;
`git diff --check`. **Never trust a `tail`-piped or notification exit code** —
capture to a file and read `$?`.
