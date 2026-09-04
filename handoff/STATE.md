# STATE — session 121 — 2026-09-03/04 — commit 4b8eafc2

## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data (§13). The
session worked `handoff/next.md`'s session-121 brief, which was CURRENT (session
119 wrote it) — unlike last cycle.

**The gate the brief set: the day-20699 rotation measurement. GATE PASS.** The
prediction was committed to git (`f35602e0`) BEFORE `start_run`; the server
charged **Archon (138) 30→27**, inside the predicted set. Hypothesis (a) — a
fixed 7-permutation — survives.

**⚠ The pass is WEAK and was pre-registered as weak.** Under hypothesis (b)
(pseudo-random) a draw lands in a 3-of-7 set 43% of the time: a Bayes factor of
~2.3. A FAIL would have been decisive. **This is not a solve.** What it bought is
real but bounded: the order is down from **6 candidate permutations to 2**.

**EVERYTHING SPENDABLE IS SPENT.** Dungeon **12/12** run-units (4 juiced Tier-2
runs), fishing **20/20** casts. All authorized by the user in-session.

Suite **2391 passed / 2391, 116 files, exit 0**. `tsc --noEmit` clean,
`git diff --check` clean, `discoveredShipsClean` 8/8, all seven `.gitignore`
paths verified.

⚠ **Re-run the suite UNSANDBOXED** — sandbox breaks `tsx` (EPERM on its IPC
pipe, reproduced again) and `git`. Use `--maxWorkers=4`.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        11946
  CONTROL A (read):     11549 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS — no unexplained hits, both controls healthy.
```

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session:** **`BurnMastery` floor-vs-round** (vacuous, closed, and
quiet for many sessions) and the standalone **rod-recovery** entry, folded into
the two new rod entries below.

- ⭐ **[NEW] Hypothesis (a) SURVIVED day 20699 — and a pass is NOT a solve.**
  dow7 → f4 Archon, inside the pre-registered {f1,f2,f4}. Order now down to **2**
  candidate permutations, not 1. DECISIONS 2026-09-04. Re-opens as: *"the
  rotation is solved"* or *"confirm the rotation with one more run"* — the
  confirming run is worth doing, but it is day **20700** specifically, see open
  question 2.
- ⭐ **[NEW] `dayOfWeek` is 1-INDEXED. MEASURED, not assumed.** The brief and
  `checkEntryTiers.ts` both said day 20699 would be `dayOfWeek 0`; the server
  returned **7**. `dow = day mod 7` with 0 mapped to 7. Re-opens as: *"day 20699
  is dow 0, so the remaining slots are dow 0/1/2"* — there is no dow 0.
- ⭐ **[NEW] The rod decrement rate IS MEASURED: 1.00 durability/cast.** Two
  independent clean 10-cast brackets, 48→38→28, both exactly 1.00. DECISIONS
  2026-09-04. Re-opens as: *"the rod decrement rate has never been measured"* —
  it had not been, until the denominator was fixed this session.
- ⭐ **[NEW] [USER] The rod-durability LABEL is FIXED, and the bug under it was
  a 10x wrong decrement rate.** `castsSoFar` holds the day's CHARGED total, not
  batch play. Re-opens as: *"fix the misleading rod label"* or *"the ledger can
  finally give a rate"*.
- ⭐ **[NEW] [USER] The Tier-1/Tier-3 whole-run income baseline is RETIRED BY
  NAME** after thirteen sessions. Abandoned as underpowered against a ~3x
  within-arm spread; `dropMultiplier` was already measured at an exact 4:1
  (session 106). Re-opens as: *"one cross-tier run gives the first clean read"*
  or *"the Tier-1/Tier-3 baseline is still unmeasured"*.
- ⭐ **[NEW] Modal LIVE damage 5→6 is a NEAR-TIE FLIP, not a deck change.**
  `splitByDealtDeck` puts 0 traces in `unknown`; 5 and 6 were 155 vs 149 before
  today. Re-opens as: *"the rod replacement changed the deck"*.
- **The ARITHMETIC rotation map stays FALSIFIED.** `faction = dayOfWeek + 2`
  died at day 20698. Re-opens as: *"faction = dayOfWeek + 2"*.
- **The charged faction does NOT change mid-day.** Now **four** same-day charges
  in each of three sessions. Re-opens as: *"check whether the faction rotates
  within a day"*.
- **`data.nextPosition` / `data.nextMovePath` are NOT a server change.**
  Known-but-rare since `e5f43cfa` (session 26). Re-opens as: *"investigate the
  new unknown fields the fishing loop is dumping"*.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.** Re-opens as:
  *"the fishing budget is 300/25"*.
- **[USER] The double-lethal oil override is DISABLED; Focus Oil off the
  allowlist.** Re-opens as: *"turn the double-lethal band back on"*.
- **[USER] Oil target framing: 60–70% catch rate.** This session 11/20 = 55%.
  Re-opens as: *"the disable cost us catch rate"*.
- **Evade DOMINATES crit; `critProc`'s exclusion list was the defect.** Re-opens
  as: *"critProc's 2×ATK rule has exceptions"*.
- **A new boon type from n=1 needs a USER DIRECTIVE.** Now **five** held:
  `CritHeal`, `Intimidating`, `BurningTenacity`, and NEW this session
  `RegenMastery`, `VulnerableMastery`. Re-opens as: *"model the remaining latent
  boons"*.
- **TASKS §13's SWAP is parked on DATA, not code.** Re-opens as: *"wire in the
  reachability/coverage scoring"*.
- **`tenacity`/`intuition` as damage mitigation RULED OUT.** §58, §62, §63.
- **[USER] Unspent skill XP.** CLOSED, §61.1 forbids re-raising it.
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **Pre-registration as a git commit, not a scratch note.** The prediction and
  its falsifiers were committed (`f35602e0`) before any spend, so the test is
  verifiable from history rather than asserted afterwards. Repeat this.
- **`scripts/liveRun.ts` end to end, four times.** **0/187 first-attempt action
  failures** across the day (61 + 56 + 42 + 28).
- **`scripts/liveFishing.ts`, 20 casts in two batches.** Oils Relaxing-only on
  lethal triggers (3 fired); 28 Focus triggers correctly logged
  policy-withdrawn, NOT dry-bag.
- **The corrected rod label, exercised live twice**, and it immediately produced
  the decrement rate the ledger has wanted since session 100.
- **Chasing a census signal instead of re-pinning it, twice** — the `64/17`
  loadout and the modal-damage flip both looked like real changes and both
  resolved benign, on evidence, before any pin moved.
- **Rule 13 discipline held**: every live command's effect read back off the
  server ledger.

## What's broken
- ⚠ **The rotation order is NOT solved — 2 permutations remain**, and the
  discriminating day is **20700**, which the JWT barely reaches (below).
- ⚠ **THE JWT EXPIRES 2026-09-04T18:48:43Z.** At recap it had **~13h**. The
  daily reset is 11:00 PT = 18:00Z, so day 20700 opens **~48 minutes before the
  token dies**. That is the entire remaining live window.
- ⚠ **`LIVE.drift` moved a FOURTH consecutive time, −0.6850 → −0.6882**, and is
  now a monotone four-step walk. Today's 20 casts alone read **−0.7436**. Still
  negative and short of −1, so STATE's own rule says pin, not re-derive — but
  the direction is no longer obviously noise.
- ⚠ **Several multi-session HOLDS ended together** and must not be re-quoted as
  stable: redraw b10 `sacrifices` 7→8 and `wasted` 12→13, the
  `|rescues − sacrifices|` numerator 21→25, `rescueCostHist` buckets 2 and 3.
- ⚠ **Catch rate 11/20 = 55%**, below the user's 60–70% framing. Inside binomial
  noise at n=20 (P(≤11 | p=0.65) ≈ 22%), so not yet a signal — but it is the
  second reading in a row at or below the band's floor.
- ⚠ **`Intimidating` still cannot separate "heals its amount" from "heals a flat
  2"** — all observations remain at amount 2.

## Corrections to SPEC.md
- **`SPEC.md` was not touched and needed no change.** No live response
  contradicted it; `dayOfWeek` is not a field SPEC documents.
- ⭐ **The BRIEF was wrong that day 20699 is `dayOfWeek 0`** — the server returned
  **7**. Flagged at the top of the session, before spending, per the standing
  rule that a brief's checkable claims are hypotheses.
- ⭐ **`scripts/checkEntryTiers.ts` printed "for dow 0/1/2"** on the same wrong
  assumption. Corrected to dow 7/1/2 with the measurement beside it. **Fourth
  consecutive session in which a stale or wrong PRINTED CAPTION was the defect**
  (115, 116, 118, 121).
- **`RodDurabilityRecord.castsSoFar`'s doc comment was wrong** — it claimed
  "casts this process had actually played" and holds the day's CHARGED total.
  Corrected in place rather than redefined, so the 47 existing rows stay
  comparable.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged.

## Dead ends
- **Do not re-fit an arithmetic rotation rule to the five points.** Three
  consecutive +1 steps already produced a confident wrong answer once.
- **Do not treat hypothesis (a)'s survival as a solve.** BF ≈ 2.3.
- **Do not re-hunt the advance faction-indicator field.** CLAUDE.md rule 11.
- **Do not look for the ring debit on the wire.** Read balances before/after.
- **Do not fit a rod decrement rate off `castsSoFar`.** Use `batchCastsPlayed`;
  a test asserts the wrong figure the old denominator gives.
- **Do not call the Tier-1/Tier-3 baseline cheap — it is RETIRED.**
- **Do not run the suite sandboxed** — `tsx` and `git` both fail.
- **Do not trust a `tail`-piped exit code**, and note a background-task
  "exit code 0" notification reports the COMPOUND command: a `; echo` after
  `vitest` masks its status. Capture to a file and read `$?` directly.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Dungeon, live: 4 juiced Tier-2 runs, 12/12 run-units, 240 energy.** Deaths
  rooms **9/8/7/4**. Hard Core **13,032**, Dendren Root **1,359**. Rings: 12
  Archon (30→18). **0/187 first-attempt action failures.**
- **Fishing, live: 20 casts, the full daily cap. 11/20 = 55% caught.** 240
  energy. Rod **48→38→28**, exactly **1.00/cast** on both brackets. 3 Relaxing
  Oil (937) spends; 28 Focus triggers policy-withdrawn.
- Suite **2391 passed / 2391**, files 116 (was 2364/116).
- Corpus: **113 dungeon attempts** (was 109), **410 fishing casts** (was 390).
- Silver rings **246** (was 258). Archon now second-scarcest at 18; Athena 21.
- **~160 corpus pins re-derived across 12 test files.** Every set change
  verified purely ADDITIVE by MULTISET diff both ways (24 `OBSERVED_OFFERS`
  rows, **0 removals**).

## Open questions for Claude
1. ⚠⚠ **THE JWT EXPIRES 2026-09-04T18:48:43Z and that is a USER action.** Day
   20700 opens at 18:00Z. **The next session has a ~48-minute live window unless
   the user refreshes the token first.** Say this at the TOP of the next brief,
   not in a carry-forward list.
2. **Day 20700 (dow 1) is the LAST test needed under (a), and it is decisive
   either way.** Under (a) it MUST charge **Crusader (135) or Overseer (136)** —
   and whichever it is, dow 2 takes the other, so **the order is solved**.
   Anything else kills (a) outright. Pre-register it in a commit again; that is
   what made this session's result a test.
3. **Is a 55% catch rate worth raising with the user?** Second consecutive
   reading at or below the 60–70% band's floor, but n=20 and n=23 are both far
   too small to distinguish 55% from 65%. Probably "note, don't act" — but it
   should be the user's call, not another silent pass.
4. **`LIVE.drift`'s fourth consecutive move.** STATE's rule still says pin. Does
   a monotone four-step walk with today's batch at −0.7436 change that? This
   needs a threshold stated in advance, or it will be re-asked every session.
5. **`RegenMastery` and `VulnerableMastery` join the latent set**, making five
   awaiting a directive. `VulnerableMastery` carries `selectedVal1: 10` where
   the modelled `Vulnerable` family carries small integers — that is a reason to
   be careful, not a reason to guess. Default: hold.
6. **The `web/` front end from session 120 has still never spawned a real
   script.** Its own recap says the next real-repo check is
   `cd web/server && npm install && npm run dev` against the Setup/Status tabs.
   Not touched this session.

## Files changed
```
 scripts/checkEntryTiers.ts        |  rotation caption -> 5 points + falsification
 scripts/liveFishing.ts            |  batchCastsPlayed; rod label; in-sample 2.5 -> 2.3
 src/sim/boons.ts                  |  +24 OBSERVED_OFFERS rows (2 blocks)
 tests/ (12 files)                 |  ~160 corpus pins; +3 rodDurability tests
 handoff/TIER1-RESULT.md           |  baseline experiment RETIRED banner
 handoff/DECISIONS.md              |  entries appended
 handoff/STATE.md                  |  rewritten
 handoff/scratch-session-121.md    |  new — the pre-registration + result
 handoff/log/session-121.md        |  new
 fixtures/dungeon-runs/ (6 dirs)   |  4 runs + 2 dry-runs
 fixtures/fishing-casts/live/      |  21 casts (20 + 1 dry-run)
 532 files changed, 327715 insertions(+), 187 deletions(-)
```
