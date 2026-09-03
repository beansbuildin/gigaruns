# STATE — session 118 — 2026-09-02 — commit 3ee7c0f4

## Status
No numbered TASKS.md gate was worked; tasks 1–14 are all GATE MET or parked on
data (§13). **`handoff/next.md` was STALE** — it is the session-116 brief and
session 116 already closed against it — so per `/handoff` the session fell back
to TASKS.md, found nothing open, and took STATE 116's open question 2.

**The one real gate this session set itself: the day-20698 rotation WRAP test.
FAIL — and the failure is the finding.** The prediction was recorded in advance
and the server contradicted it.

- **Step 0 JWT: PASS.** Valid to **2026-09-04T18:48:43Z**, 41.5h at recap.
- **Step 1 day: PASS.** Day **20698**, `dayOfWeek 6`, fresh 0/12, no ring drift.
- **Step 2 wrap test: FAIL.** Predicted Crusader (135); **Athena (137)** charged.
- **Steps 3/4: 3 more runs and 21 fishing casts, each user-authorized.**

**Dungeon 12/12 run-units — day closed. Fishing 18/20 charged, but THE ROD IS AT
0 DURABILITY**, which blocks further fishing regardless of the 2 remaining casts.

Suite **2364 passed / 2364, 116 files**. `tsc --noEmit` clean, `git diff --check`
clean, `.gitignore` verified on all seven paths, `discoveredShipsClean` 8/8.

⚠ **Re-run the suite UNSANDBOXED** — sandbox breaks `tsx` (EPERM on its IPC
pipe, reproduced again this session) and `git`. Use `--maxWorkers=4`.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        11712
  CONTROL A (read):     11345 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS — no unexplained hits, both controls healthy.
```

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session:** the **Tier-2 ring-cost** entry and the **chaining
one-time-exception** entry — both are now written out at length in CLAUDE.md
rule 11, which is the stated drop criterion. Also dropped **`triggeredBoons`**:
closed at 0 non-empty of 10,616 and quiet for many sessions.

- ⭐ **[NEW] The ARITHMETIC rotation map is FALSIFIED at the wrap.** `faction =
  dayOfWeek + 2` predicted Crusader (f1) for day 20698 and the server charged
  **Athena (f3)**. Known map: dow 3→f5, 4→f6, 5→f7, **6→f3**. DECISIONS
  2026-09-02. Re-opens as: *"the rotation is solved, just confirm the wrap"* or
  *"faction = dayOfWeek + 2"* — it is **not** solved, and three consecutive +1
  steps did not survive contact with the fourth day.
- ⭐ **[NEW] The rod hit 0 DURABILITY.** Fishing is blocked on gear, not on the
  cast cap. Re-opens as: *"fish the remaining 2 casts"* — they are not
  reachable without the user repairing/replacing the rod, which is not an
  autonomous action.
- ⭐ **[NEW] `data.nextPosition` / `data.nextMovePath` are NOT a server change.**
  Known-but-rare since commit `e5f43cfa` (session 26); the 2026-08-31 log
  already shows 6 events in 7 casts. Only session 26's "~2/30 casts" rate
  characterisation is stale. Re-opens as: *"investigate the new unknown fields
  the fishing loop is dumping"*.
- ⭐ **[NEW] The Tier-1/Tier-3 baseline is NOT cheap — SECOND day of evidence.**
  Within-arm spread on one day, one loadout: **2.9x** (session 116 measured
  3.2x). Re-opens as: *"one cross-tier run gives the first clean read"* — it
  cannot; budget several runs per arm or retire the experiment.
- **[NEW] The charged faction does NOT change mid-day.** Now **four** same-day
  charges in each of two sessions. Re-opens as: *"check whether the faction
  rotates within a day"*.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.** Re-opens as:
  *"the fishing budget is 300/25"*.
- **[USER] The double-lethal oil override is DISABLED; Focus Oil off the
  allowlist.** Re-opens as: *"turn the double-lethal band back on"*.
- **[USER] Oil target framing: 60–70% catch rate.** This session 14/21 = 66.7%.
  Re-opens as: *"the disable cost us catch rate"*.
- **`BurnMastery` floor-vs-round is VACUOUS and CLOSED** — every burn amount is
  an integer and `floor(2p)===round(2p)`. Re-opens as: *"BurnMastery needs an
  odd plain amount"*.
- **Evade DOMINATES crit; `critProc`'s exclusion list was the defect.** Evade
  zeroes damage 56/56. Re-opens as: *"critProc's 2×ATK rule has exceptions"*.
- **A new boon type from n=1 needs a USER DIRECTIVE.** `CritHeal` (§66),
  `Intimidating` (§68), `BurningTenacity` (§69) all held; §69 was OFFERED twice
  this session and declined both times. Re-opens as: *"model the remaining
  latent boons"*.
- **TASKS §13's SWAP is parked on DATA, not code.** A test fails if anyone wires
  `positionalReachability`/`meanZoneCoverage` in. Re-opens as: *"wire in the
  reachability/coverage scoring"*.
- **`tenacity`/`intuition` as damage mitigation RULED OUT.** §58, §62, §63.
- **[USER] Unspent skill XP.** CLOSED, §61.1 forbids re-raising it.
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **The falsification itself, done properly.** The prediction (Crusader 39→36)
  was written to a scratch file with its falsifiers BEFORE `start_run`. The
  observation (Athena 33→30, sole mover, read twice and stable) is therefore a
  real test rather than a story fitted afterwards.
- **The ring CHARGE SHAPE at 16/16.** Four runs, four single-faction −3 charges,
  six factions untouched every time. Athena 33→21 is exactly 12 = 3/run. What
  broke was the ORDER, not the shape — the two are independent and only one died.
- **`scripts/liveRun.ts` end to end, four times.** Dry-run guards, juiced Tier-2
  entry, 3x Big Heal Juice, rule-8 tier picks. **0/255 first-attempt action
  failures** across the day (80 + 52 + 42 + 81).
- **`scripts/liveFishing.ts`, 21 casts over two batches.** Oils Relaxing-only on
  lethal triggers; 17 Focus triggers correctly logged policy-withdrawn, NOT
  dry-bag.
- **Rule 10 applied and it paid.** The `nextPosition` unknown-field flag looked
  like a server change; checking a log that predates the instrumentation showed
  it is years-old behaviour. No false finding was reported.
- **Rule 13 discipline held**: every live command's effect was read back off the
  server ledger (`checkDungeonToday`, `checkFishingCaps`), never inferred.

## What's broken
- ⚠ **The rotation ORDER is UNSOLVED again, and worse than before.** Three
  survivors: (a) a fixed 7-permutation with fragment 5→6→7→3, leaving {1,2,4}
  for dow 0/1/2 in one of 6 orders; (b) per-day pseudo-random, under which the
  three +1 steps were a ~2% coincidence; (c) a period that is not 7. **The
  runway figure printed by `checkEntryTiers.ts` assumes (a).**
- ⚠ **THE ROD IS AT 0 DURABILITY.** First time this repo has driven it to zero.
  Blocks all further fishing; 2 charged casts remain but are unreachable.
- ⚠ **The `liveFishing.ts` rod label is now at its worst**, printing
  `0 (before: 13, casts this batch: 18)` — a play-driven delta of 13 beside a
  charge-driven, session-cumulative count of 18. Carried unfixed for four
  sessions; hitting zero is exactly when it misleads most.
- ⚠ **`LIVE.drift` moved again, −0.6417 → −0.6593**, third consecutive move.
  Still negative, still short of −1, so a pin update per STATE's own rule.
- ⚠ **`Intimidating` still cannot separate "heals its amount" from "heals a flat
  2"** — all observations remain at amount 2.
- ⚠ **The out-of-band commit `0755d156` shipped untested.** Its own message said
  so ("not yet run against the real repo's suite"). It broke
  `tests/noHardcodedPaths.test.ts`; **this session discharged that debt**, but
  the pattern is worth naming: a commit that cannot run the suite should say so
  in STATE, not only in its own message.

## Corrections to SPEC.md
- **`SPEC.md` was not touched, and CLAUDE.md needed no change either.** No live
  response contradicted SPEC. CLAUDE.md rule 11 already says the rotation ORDER
  is unconfirmed and that the runway assumes a uniform cycle — both still exactly
  right. **It was STATE 116 that over-claimed**, not the rules doc.
- ⭐ **`scripts/checkEntryTiers.ts` printed a rotation caption stale by a whole
  session** — "[session 115] Two days are now on record, but they are ADJACENT"
  — while three days were on record and a fourth was being measured. Rewritten
  to print all four points and the falsification. **Third session running that a
  stale printed caption was the defect** (session 115's `checkEntryTiers.ts`,
  session 116's `statusEffects.ts`).
- **`tests/noHardcodedPaths.test.ts` ratchet 27 → 28**, for
  `scripts/lossDecompositionReport.ts`. Raised, not converted, on the exact
  sessions 100/101 terms: same `join("data", ...)` construction as its sibling
  `scripts/fishingReport.ts:18` which is already inventoried, and `writeReports()`
  takes both paths as parameters defaulting to those constants.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged.

## Dead ends
- **Do not re-fit an arithmetic rotation rule to the four points.** Three
  consecutive +1 steps already produced a confident wrong answer once.
- **Do not re-hunt the advance faction-indicator field.** CLAUDE.md rule 11.
- **Do not look for the ring debit on the wire.** Read balances before/after.
- **Do not investigate `nextPosition`/`nextMovePath` as new.** Pre-existing.
- **Do not call the Tier-1/Tier-3 baseline cheap.** Two days of spread evidence.
- **Do not widen `damageEconomy`'s clamp bar.** Pre-registered in the test.
- **Do not run the suite sandboxed** — `tsx` and `git` both fail.
- **Do not trust a `tail`-piped exit code.** A `vitest | tail` reported exit 0
  over 3 real failures this session; capture to a file and read `$?` directly.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Dungeon, live: 4 juiced Tier-2 runs, 12/12 run-units, 240 energy.** Deaths
  rooms **12/7/5/10**. Hard Core **15,576**, Dendren Remnant **2,142**. Rings:
  12 Athena (33→21). **0/255 first-attempt action failures.**
- **Within-arm spread, one day/loadout/tier: 2.9x** (5784/3168/1992/4632).
- **Fishing, live: 21 casts PLAYED, 18 CHARGED, 3 spared by JEBAITOR. 14/21 =
  66.7% caught.** 252 energy. Rod durability 13→0.
- Suite **2364 passed / 2364**, files 116 (was 2323/115 — the +1 file and +22
  tests are the out-of-band commit `0755d156`, not this session).
- Corpus: **109 dungeon attempts** (was 105), **388 fishing casts** (was 367).
- Silver rings **258** (was 270). Athena now scarcest at 21.
- **~150 corpus pins re-derived** across 11 test files, in two waves. Every
  integer count verified to move UPWARD; every set diff verified PURELY
  ADDITIVE by MULTISET diff, so a repeated row cannot mask a removal.

## Open questions for Claude
1. ⚠ **THE JWT EXPIRES 2026-09-04T18:48Z, 41.5h out.** It is a USER action. The
   next session is very likely the last one that can do live work.
2. ⚠ **THE ROD IS AT 0.** Fishing cannot resume until the user repairs or
   replaces it. Ask directly rather than planning casts that cannot happen.
3. **Day 20699 is the next rotation point and it is now worth MORE, not less.**
   It discriminates the three survivors: under (a) the fixed permutation it must
   be one of Crusader/Overseer/Archon (f1/f2/f4); anything else kills (a)
   outright. Say the prediction in advance again — it worked.
4. **Is the Tier-1/Tier-3 baseline worth carrying at all?** Thirteenth session.
   Two independent days now measure a ~3x within-arm spread. Either budget
   several runs per arm or retire it by name.
5. **The rod-durability label** has been declined before and is now actively
   harmful. It needs a decision, not another mention.
6. **`Intimidating` (§68), `BurningTenacity` (§69), `CritHeal` (§66)** all still
   await directives. §69 was OFFERED twice this session and declined both times.
   Default: hold.
7. **`next.md` was stale this cycle** — it was the previous session's brief.
   Worth checking the brief's own session number against STATE's before writing.

## Files changed
```
 scripts/checkEntryTiers.ts                 |  rotation caption -> falsification
 scripts/liveFishing.ts                     |  in-sample rate 2.6 -> 2.5
 src/sim/boons.ts                           |  +30 OBSERVED_OFFERS rows (4 blocks)
 tests/ (11 files)                          |  ~150 corpus pins, 2 waves
 tests/noHardcodedPaths.test.ts             |  ratchet 27 -> 28 (+ reason)
 handoff/DECISIONS.md                       |  entries appended
 handoff/STATE.md                           |  rewritten
 handoff/log/session-118.md                 |  new
 fixtures/dungeon-runs/ (5 dirs)            |  4 runs + 1 dry-run
 fixtures/fishing-casts/live/ (21 dirs)     |  21 casts
 667 files changed, 444446 insertions(+), 174 deletions(-)
```
