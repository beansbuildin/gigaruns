# BRIEF — session 82 — the dungeon, after six sessions of unexercised change

## 0. Verification, and three corrections to me

Fresh clone at `1c18de1`, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     clean
npx vitest run   Test Files  95 passed (95)
                      Tests  1560 passed | 13 skipped (1573)
```

**Both gates hold**, and the two instruments were pinned *before* the live batch
and held on 22 plays they had never seen. That ordering is the strongest thing in
session 81 and it is worth keeping as a habit.

**Session 81 corrected me three times and was right each time.**

- **My 581 does not reproduce. The true count was 590.** I gated a session on a
  number I had not re-derived, for the second time. The session hunted four
  neighbouring predicates, found none, and time-boxed it. **Correct call.** The
  permanent fix — every count ships with the filter that produced it — is now in
  place and I should have shipped it, not asked for it.
- **My oracle had a real bug and an assertion I asked for is what caught it.**
  `prev.focusMeter` is the wrong focus budget: `castTrace.ts` skips
  `use_fishing_item`, so an oil restores the meter between recorded turns, and my
  ceiling called **6 server-scored hits unhittable** — a ceiling below its own
  floor. Reconstructing it as `spent + remaining` is right.
- **The resolver test I asked for already existed, from session 47.** What was
  actually missing was the other axis — *which two states* a shot resolves
  between. The session found that and pinned all four readings. **I asked for a
  test that existed and would have learned so by opening the file.**

---

## The clock and the ledger

Written **2026-08-22, 22:03 PT**.

```
  fishing      20 / 20 spent          rolls 11:00 PT
  dungeon      12 / 12 run-units UNSPENT, expiring 11:00 PT
```

**Twelve run-units is FOUR juiced runs** (rule 11: 60-energy juiced = 3 units).
If this session opens before 11:00 PT they are the ones about to expire; if after,
they are a fresh twelve. **Either way the number is four, and it is not eight** —
do not straddle the rollover to get a second allowance.

`doctor.ts` first, both ledgers, report them verbatim. This paragraph is
arithmetic; rule 13 exists because arithmetic about ledgers is not authority.

*⚠ `preflight.ts` (~90s) before the push. `npx tsx` and `git` fail under the
command sandbox — run unsandboxed.*

---

## USER DIRECTIVE — the dungeon programme is this session

**The user has authorised the dungeon runs for this session.** That settles
*whether*; it does not settle *each*.

**Rule 11 is unchanged and is not relaxed by a session-level authorisation:
60-energy juiced, `--juiced-index=3`, 3× Big Heal Juice, `--runs=1`, stop and
hand back. Each run needs its own go-ahead. Approval for one is never approval
for the next.** Rule 13 after every run — read `checkDungeonToday.ts` and confirm
`dayProgressEntities` moved by exactly 3, **including after a run the harness
reports as denied**.

Redirect and `tail`; never pipe a live run to a truncating reader.

```
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1 > logs/run-82-1.log 2>&1
```

---

## 1. §1a — the dry-run, and it matters more than it did in session 75

**The dungeon path has not executed since session 75. Six commits have touched
the code that spends run-units since, and four of them are structural.**

```
  d650e8e  session 80 §5   arg guard on liveRun.ts   — recap says NEVER EXERCISED
  4e20e91  session 78 §2c  combat moves join the transaction protocol
  774ab76  session 78 §5/6 L1–L4 (capture.ts — the shared FixtureWriter/RunLog)
  e248303  session 78 §3   probeDecision wired into every decision record
  a12e6b3  session 78 §2   runActionTransaction — start_run + reward/path
  0f5d61a  session 78 §1   raw() gains a 10s deadline, AbortController + race
```

Verified in the tree: `runActionTransaction` has **three dungeon call sites** —
`liveRun.ts:727` (`postWithVerifiedRetry`), **`:1052` (`start_run`)** and
`:1371` (combat moves). **None has ever run against a live dungeon.** Neither has
the request deadline on this path, nor `capture.ts`'s extracted writer, nor the
arg guard.

**Session 75's brief called the dry-run "the item most likely to surprise" after
twelve sessions of drift, and the surprise was that nothing had rotted.** That is
not the situation now. Then, the intervening work was elsewhere and the dungeon
path was merely stale. **This time the intervening work is ON it, on the exact
function that commits a run-unit.**

**Do this first and report what it prints. If it fails, that is the session's
finding and the runs wait.** `--dry-run` runs every guard, spends nothing, and
takes twenty seconds.

**One thing to check by eye in the dry-run output, because it is new since the
last one:** `start_run` now returns a transaction outcome rather than throwing.
Confirm the dry-run path still reports `would POST start_run` and exits 0 without
entering the transaction at all — a dry run that *enters* the reconciliation
would mean the guard moved.

---

## 2. What the runs are FOR — the `evSupported` telemetry is the deliverable

**This is the primary purpose and it should shape the reporting, not be a
by-product of it.**

Session 78 §3 wired `probeDecision` into every decision record
(`liveRun.ts:1283`). Each `event: "decision"` now carries `evSupported`,
`unmodelled` and `unmodelledBySide`, **in the same record as the EV** — and a
per-run `EV support: n/m decisions were fully supported` line at `:1241`.

**It has never run.** Four juiced runs are the first real data it would produce.

**Why it matters:** the coverage layer marks **617 of 622** non-Safe paths
unscorable on `ROLLED_STATS`, and rule 8 deliberately selects exactly those
fights. Today CAPTURE-1's implementation ordering — *which* of evasion, block,
lck, tenacity, intuition, Weak, Vulnerable, Burn, Regen, lifesteal to capture
first — is **guessed**, inherited from the Codex review's suggested order.

**These runs turn that ordering into a measurement.** Report:

1. **`EV support: n/m` per run**, and pooled across the four. A high unsupported
   fraction is EXPECTED — say so in the recap so nobody reads it as a regression.
2. **The co-occurrence table of `unmodelled` reasons** — which reasons appear
   together, and how often. `unmodelledBySide` splits me/foe/run, which is the
   part that says whether the gap is in the player's state or the enemy's.
3. **The reasons present on the decisions immediately preceding a death.** That
   is the ordering CAPTURE-1 wants: not which mechanic is most common, but which
   is present when the run ends.

**Do not build H2's proc model.** Unchanged and not reopened. This is the
capture that would eventually justify one; it is not one.

---

## 3. The other capture value, in the order I would rank it

- **Boon coverage.** Orb **7** / priority **5** since session 75, frozen for six
  sessions. Record first-ever pickup pairs and the `UNMODELLED_TYPES` delta. Diff
  the full player object across each `reward_*` POST, before → after, and **treat
  every zero as a measurement only if a control moved in the same run** — that is
  what made session 75's four latent models credible.
- **§23's `(elapsed, drift)` pair.** The predictor is passive regen ticks,
  `drift ∈ {floor(x), ceil(x)}` with `x = elapsed/3.33`, **11/11** at n=11. Four
  runs takes it to n=15 and is the cheapest increment available to it.
- **The in-loop tier gate.** `auditTierChoice` re-derives rule 8's answer from the
  raw offer and halts on disagreement. Last exercised **38/38**. Report the count.
- **Hard Cores per run and as a total.** It is the currency. Session 75's four
  runs returned 27,552 HC / 1,491 DR; run 3's 8,688 is the highest juiced run on
  record.
- **Potion use and at what HP.** M2 (potion timing) is recorded as blocked behind
  the H2 captures; the HP at each potion is the raw material for it. Session 75
  saw potions at 14/40, 3/40, 15/40 — the 3/40 is the case M2 exists for.

**Per-run report** (unchanged from session 75): tier offered vs taken per room;
Perpetual filter rate; `orbFallback` fire count and `narrowed`; orb sum; loot;
rooms; potion use and at what HP; first-attempt action failures; 429s; unknown
enums; guard trips.

---

## 4. The gear trap — read this before run 1, not after

**`src/sim/enemies.ts`'s `PLAYER` was captured from session 75's run 4**
(cid 24983279, 2026-08-22 04:27 PT): rock 25/8, paper 10/15, scissor 12/8,
armorMax 22, block 10.

**If the user's gear or level has changed since, `tests/enemies.test.ts` will go
RED on the first new capture — and that is the test working, not breaking.** It
pins to the NEWEST capture precisely so gear drift cannot go silent. Session 75
hit this and the recap's own extracted rule is the one to keep in front of you:

> **A test about a MODEL must not read the user's current gear.**

Session 75 also learned the harder half: a re-spec **mid-batch** splits the
batch. Runs 1–3 and run 4 of that session are not the same arm and nothing may
read run 4's depth or Hard Core against the others.

**So:** capture `PLAYER` from **run 1's own `start_run`**, diff it against
`enemies.ts` before run 2, and **report the diff whether or not it is empty.** If
it is non-empty, update the model once, before run 2, and say plainly that runs
under the old model are a different arm. **Do not let a re-spec land between runs
unremarked.**

**And do not present any of these runs as evidence about rule 8.** That programme
is CLOSED (DECISIONS 2026-08-21). Do not re-run the 4-vs-4, do not propose a new
comparison.

---

## 5. Fishing — secondary, and only if the rollover has happened

Casts are 20/20 spent until 11:00 PT. If the session runs past it and the user
gives a go-ahead, two targets are cheap and well-defined:

- **One crit on a base-6, base-8 or base-10 shot finishes the crit rule.** Two
  members survive: `hit × 1.5` round-half-up and `hit × 1.6` rounded. **Card 10
  crits for 10 and is in the deck** — ×1.5 → 15, ×1.6 → 16. Session 81 learned the
  method the hard way: the base is the card's **crit** amount, not its hit amount,
  and the two crit sources **compose**. Watch `critEffects`, not `hitEffects`.
- **An oil consumed at a NON-ZERO focus meter settles add-2 vs restore-to-2.**
  All 21 on record fired at meter 0, where the two are the same event.

Both are captures, not policy. Neither is gated.

---

## 6. Gate

**Rule 6: a gate must be set on something the agent controls. Live runs depend on
a per-run human go-ahead and on the server, so neither gate below is "four runs
played" — that would be a capture request wearing a gate's clothes.**

1. **The dry-run is executed BEFORE any live run and its output is reported
   verbatim**, including an explicit statement of whether the transaction
   protocol, the request deadline and the arg guard behaved as designed on the
   dungeon path (§1). **A dry-run failure IS this gate being met** — it is the
   finding, and the runs wait. *Meetable with zero run-units and no go-ahead.*
2. **For every run that is authorised and played, `EV support: n/m` and the
   `unmodelled` co-occurrence table are reported** (§2), plus rule 13's ledger
   check. **If no run is authorised, this gate is met by reporting that** — and
   by saying what the telemetry would have shown, i.e. nothing, because it has
   never run. *Unmeetable only if a run is played and the telemetry is not
   reported, which is entirely in your hands.*

Not gated: §3's capture list, §4's gear diff (do it regardless), §5.

---

## 7. Do not

- **Do not start a run before the dry-run passes** (§1), and **never chain
  runs** — each needs its own go-ahead, and the user's session-level
  authorisation is not that.
- **Do not straddle the 11:00 PT rollover to spend two allowances.**
- **Do not present these runs as evidence about rule 8**, and do not read runs
  either side of a gear change against each other (§4).
- **Do not "fix" a red `enemies.test.ts` by loosening it** — it is pinned to the
  newest capture on purpose (§4).
- **Do not build H2's proc-branch model.** These runs are the capture that would
  justify one; they are not one (§2).
- **Do not hard-code corrode's amount or complete its perpetual twin table** —
  `perpetual_corrosiveShield` and `perpetual_corrosiveMagic` still have zero
  observed appearances.
- **Do not report energy as a blocker** (rule 12). Do not claim a blocker without
  running `--dry-run` first.
- **Do not touch `DEFAULT_POTION_THRESHOLD`** — M2 stays blocked; these runs feed
  it, they do not resolve it.
- Standing, none re-opened: `chooseNewCard` UNTOUCHED; redraw CLOSED on price;
  **+19.40pp SUSPENDED, do not quote**; do not re-run the oil sweep on any
  current arm; `boonCapture` OFF; do not write M4's lines; no 429 backoff without
  an observed 429; do not shuffle the random-sample deck path.

---

## 8. Carried, unchanged

- **30.1pp of hit rate is on the table** with today's cards and budget, the miss
  is **structured** (48.0% at distance 1, stable across two batches), and nobody
  has proposed a mechanism. The headroom instrument now scores any attempt
  against a fixed ceiling — **ACTUAL is the only row a code change can move.**
- **The 23 no-footprint plays** (3.8%, 6 avoidable) are a live-policy bug worth
  ~1pp for no prediction improvement at all. Reported, not fixed; rule 4 says it
  needs a gate and nobody has proposed one.
- `play_cards`, redraw and `use_fishing_item` remain unrouted — blocked on a
  capture (session 65), not on effort.
- §0a is NOT lifted. `mana -= card.manaCost` still unconfirmed. H2's proc model
  does not exist. Shrinkage re-fit unstable. Per-cast vs per-draw shuffle
  undistinguished; reshuffle-at-wrap unobserved.

---

## 9. Corrections to me

- **Twice now I have gated a session on a count I did not re-derive**, and both
  times the session spent real effort failing to reproduce it. 543, then 581,
  against a true 590. **The rule I keep breaking is not about counts — it is that
  I quote my own previous output as though it were a measurement.** Session 80
  named it once; session 81 paid for it again.
- **I asked for a test that had existed since session 47.** One `grep` would have
  told me. This is the same failure as the `policyApproved` line: a claim about
  what the repo contains, written without opening it.
- **My oracle was wrong in the direction that matters** — a ceiling below its own
  floor — and it was found by the assertion I asked for rather than by me running
  it. **An instrument I hand over should come with the invariant that would catch
  me.**
- **This brief is deliberately thinner on measurement than the last four**, and
  that is the right shape: the session's value is a live capture, and the useful
  contribution is making sure the capture is not wasted — the dry-run first, the
  gear diff before run 2, and the telemetry reported in a form CAPTURE-1 can use.
- **Rule 9 applies.** Every claim above about the tree was checked at `1c18de1`;
  a live response that disagrees wins, and the correction goes in the recap.

---

## Your task (session 82)

1. `doctor.ts` first. Report both ledgers verbatim.
2. **§1 / gate 1** — `--dry-run`, before anything. Report what it prints and
   whether the three unexercised mechanisms behaved. If it fails, stop; that is
   the session.
3. **§4** — capture `PLAYER` from run 1's `start_run`, diff against
   `enemies.ts`, report the diff either way, and update once before run 2 if it
   is non-empty.
4. **§ runs** — up to four juiced runs, **one at a time, each stopping for its
   own go-ahead**. Full per-run report (§3); rule 13 after each.
5. **§2 / gate 2** — `EV support: n/m` per run and pooled, plus the `unmodelled`
   co-occurrence table and the reasons present before each death.
6. **§5** — only past 11:00 PT and only with a go-ahead: casts aimed at a base-6/
   8/10 crit, and an oil at a non-zero meter.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero, **`preflight.ts` before the push**, no
   test writes a real data path, secret scan before handoff.

**Honest expectation.** The dry-run is the item most likely to surprise, and
unlike session 75 there is a specific reason to expect one: three mechanisms that
commit a run-unit have been rewritten since the last live run and none has
executed. **The most valuable outcome of this session might be a twenty-second
dry-run that fails**, because the alternative way to discover that is with a
run-unit. If it passes, the runs are worth having for the `evSupported` telemetry
alone — six sessions of fishing work have left the dungeon model's biggest known
gap measured only in a coverage script nobody runs mid-session, and four runs turn
CAPTURE-1's ordering from a guess into a table.
