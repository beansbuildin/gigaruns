# STATE — session 111 — 2026-08-30 — code at commit 3057aa95

## Status
Brief was **dungeon only: switch the standing entry tier Tier-1 → Tier-2 and
run up to 4 juiced runs, one at a time.**

- **The tier switch and its preflight: GATE PASS.** Documented in all three
  places the brief named, and the Tier-2 cost was read off the LIVE `entryData`
  before any spend.
- **The live-run half: DID NOT RUN, and its gate is UNMET.** The brief asked
  for the cost to be confirmed against the actual negative
  `gameItemBalanceChanges` on `start_run`. That requires a run, and no run was
  possible: `dayProgressEntities` for dungeon 5 read **12/12** all session (the
  11:00 Pacific reset had not yet arrived — session opened 08:50 PDT, closed
  10:16 PDT). Confirmed twice, by `checkDungeonToday.ts` and by a `--dry-run`
  that tripped `session run cap reached {"attemptedRun":15,"cap":12}`.
  **This is not a soft pass. The ring debit is UNVERIFIED against the wire.**

With the dungeon arm blocked, the user redirected the session to two code
tasks, both **GATE PASS**: the secret-scan instrument, and QUESTIONS §65.

**Live spend: 0 dungeon runs, 0 rings, 0 energy, 0 fishing casts.** Nothing was
played. Dungeon ledger 12/12; fishing 20/20 from session 110.

Suite **2195 passed / 2195, 113 files** (2147 → 2195, +48) (`vitest run --maxWorkers=4`; the
default over-subscribes this machine and produces FALSE timeouts — unchanged).
`tsc --noEmit` clean, `git diff --check` clean, `discoveredShipsClean` 8/8,
`.gitignore` verified on all seven required paths.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        9118
  CONTROL A (read):     8758 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS
```

Re-run at `--scope=diff --ref=389ed4d4~2`: **14 files, 0 unexplained.** The
recap's own four literal patterns over the session's added lines: `0x…{4,}` 0,
`noobId\s*\d+` 0, `eyJ` 0, `PRIVATE` 4 — all four the scanner's own rule text
and test sample, not a key.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. Entries marked **[USER]** are user
directives an agent may not re-open at all.

**Dropped this session:** none. **Two entries CHANGED STATE** rather than
leaving: the entry tier (Tier-1 → Tier-2, below) and the guard-budget straddle
(open task → fixed). The secret-scan work did NOT earn an entry — it is folded
into CLAUDE.md's working style, which every session reads, and the digest rule
says drop what a standing document already enforces.

- **The guard-budget day-key straddle is FIXED IN CODE.** `DAY_MEMO` in
  `guardPersistence.ts` rebases at the 11:00 PT boundary; 10 cases replay
  session 108's timestamps. QUESTIONS §65 ANSWERED, DECISIONS 2026-08-30.
  Re-opens as: *"fix the guard-budget rollover straddle"* — done. **The
  in-memory half is knowingly unfixed and is fail-safe; do NOT restore the
  backwards-move throw the first draft had, it crashes autonomous fishing.**
- **Fishing's Hard Core income is TRACKED and BACKFILLED, and the amount is
  NOT a constant.** It tracks fish rarity — base 0→80, 1→160, 2→320, 3→400,
  4→480 — and 16 of 134 catches paid an exact 2x or 4x multiple with no
  distinguishing field on the response. Escaped casts pay 0 (measured, 161/161).
  DECISIONS 2026-08-29. Re-opens as: *"add a Hard Core column to the fishing
  report"*, *"measure what fishing pays per catch"*, or *"is it 320 per catch"*
  — the last is the session-15/16 single data point and is rarity 2 only.
- **A fishing batch is sized to WHICHEVER of rod durability and the cast cap
  binds first.** The durability preflight runs ONCE before the batch, never per
  cast, so a batch longer than the rod does not halt — it drives the rod past 0.
  1.00 per cast PLAYED is a closed bracket (n=97 over six batches). Re-opens
  as: *"run the full 20/25 casts"* when the rod reads less than that.
- **[USER] Chaining is a ONE-TIME, DATED exception, not a rule change.**
  Rule 11 pins `--runs=1` with a stop between runs. DECISIONS 2026-08-29.
  Re-opens as: *"chain the runs like last time."*
- **`BurnMastery` amplifies the burn TICK, not the recorded amount.** 719/719
  exact without it, 0/12 with. **x2 vs +3 is UNSEPARATED.** DECISIONS
  2026-08-29. Re-opens as: *"burn has exceptions again"* — *"BurnMastery
  doubles burn"* is NOT settled.
- **The zero-stat proc control is falsified for `intuitionProc0` ONLY**, 1 event
  in 1716, and **the mapping SURVIVES** on a dose-response. DECISIONS
  2026-08-29. Re-opens as: *"a proc flag fired at stat 0, the mapping is
  broken."* It is a base rate.
- **JEBAITOR, and its gap, MEASURED.** ~9% of casts do not count against
  `dayDocs` (2 of 22 twice over). Re-opens as: *"the cast ledgers disagree."*
  **A sub-25-cast batch is NOT evidence the budget is too low.**
- **Tier-1 Hard Core payout.** MEASURED, not derived: `dropMultiplier` governs
  item 845 ONLY, at an exact 4:1 quantum. DECISIONS 2026-08-28. Re-opens as:
  *"measure the first live Tier-1 run."*
- **The no-proc null.** Damage = attacker's `currentATK` on 1645/1645
  status-clean exchanges. DECISIONS 2026-08-28. Re-opens as: *"the null rate is
  falling"* — a MIXED-population rate is composition-bound.
- **`tenacity` / `intuition` as damage mitigation RULED OUT, and tenacity
  PICK-ORDER RETIRED.** §58, §62, §63. Re-opens as: *"find what tenacity
  does"* — heal AMOUNTS are what is open.
- **`triggeredBoons`.** CLOSED — 0 non-empty of 10,616. DECISIONS 2026-08-26.
  Re-opens as: *"settle whether triggeredBoons populates."* **No runs may be
  spent on it.**
- **`SecondWind` / `Steadfast`.** Ordinary volume WILL NOT settle these — a
  positive finding, not missing data. DECISIONS 2026-08-27.
- **[USER] Rule 11 entry tier is Tier-2 (`--juiced-index=2`), one of EACH of
  the seven silver rings per run.** STANDING change 2026-08-30, superseding the
  Tier-1 setting that ran 2026-08-27 → session 110. `data.index` is the TIER;
  `entryData` is ordered 2, 1, 3, so **`entryData[0]` is Tier 2 by coincidence
  just as `entryData[1]` was Tier 1** — match on `.tier`, never on position.
  **Exercised live 0/0 at Tier 2.** Runway is set by the SCARCEST faction, not
  the ring total. Re-opens as: *"switch the entry tier back to Tier-1 to stop
  spending rings"* or *"correct the juiced index"*.
- **[USER] Unspent skill XP.** CLOSED, not deferred. §61.1 forbids re-raising
  it. Re-opens as: *"report the accumulated unspent skill XP."*
- **Suite invocation.** `vitest run --maxWorkers=4`. DECISIONS 2026-08-26.

## What works
- **Tier-2 is the standing entry tier, documented in all three places.**
  CLAUDE.md rule 11 amended in place with a dated `[2026-08-30]` note (the same
  shape as the `[2026-08-27]` one, which is kept and labelled superseded);
  STATE.md digest updated; three DECISIONS entries. Rule 11's heading also
  fixed — it still said "Tier-3 entry", stale since 2026-08-27.
- **The Tier-2 cost, read LIVE off `entryData` before any spend.**
  `inputItems: [134,137,138,135,136,139,140]`, `inputAmounts: [1,1,1,1,1,1,1]`,
  `dropMultiplier: 2`, `inputsBasedOnFactionDay: true`. That is **one of each
  of the seven silver rings per run** — session 106's "seven ids each" was read
  off Tier 3 and is right about the count, but the SHAPE is what matters.
- **The runway, and the trap in it.** Balances 33/39/42/30/30/57/54
  (Chobo/Crusader/Overseer/Athena/Archon/Foxglove/Summoner) = **285 rings but
  only 30 RUNS**, bound by Athena and Archon at 30 each. **7.5 days at 4
  runs/day**, against a Tier-2 offering window ending day 20731 (~37 days from
  today's 20694). Summing the balances is wrong by 9.5x. Gold, same reading:
  min 19 → 19 Tier-3 runs.
- **`scripts/checkEntryTiers.ts`** — read-only, prints the live per-tier cost,
  balances and runway, so rule 11's "re-read it, never cache it" is a command
  rather than a note. Its runway arithmetic is pure and pinned by
  `tests/entryTierRunway.test.ts`, including the sum-vs-min trap.
- **`scripts/secretScan.ts`** — the recap scan as one instrument. Names its
  scope beside the count, and fails closed on an unexplained hit, a zero-file
  sweep, or a matcher that stops matching its own sample. Rules are the inverse
  of `src/api/redact.ts`; samples are built at runtime so the scanner needs no
  exemption for itself.
- **QUESTIONS §65 fixed** — see the digest entry. `doctor.ts` and
  `liveRun.ts --status` both read the live ledgers correctly after the change,
  and `data/guard-budget*.json` were not touched.

## What's broken
- ⚠ **The Tier-2 ring debit is UNVERIFIED on the wire.** The cost is read from
  `entryData`; the brief's actual gate — matching it against the negative
  `gameItemBalanceChanges` on `start_run` — needs a run and is UNMET. **The
  first live Tier-2 run must check this**, the same discipline that confirmed
  zero rings for Tier-1, now run expecting a real debit.
- ⚠ **The in-memory half of the guard straddle is unfixed, deliberately.** A
  straddling process still counts the old day's spend against the new day's cap
  and stops early. Fail-safe; the next process reads a correct ledger.
- ⚠ **The APPROVED on-demand single-lethal oil trigger did not fire once in 22
  casts** (session 110). All 14 oils came from the double-lethal override the
  sim does not recommend. The oil arm is measuring the override, not the policy
  approved under rule 4. Carried unchanged.
- ⚠ **The fishing guard counter over-counts**, separately from the straddle
  just fixed (session 107 saw `runsStarted` 25 on a 22-played / 20-charged
  batch). Carried from 107, untouched.
- ⚠ **`LossBlockUp` has a live pickup pair and no model** — deliberately.
  QUESTIONS §64 asks for the directive. **Fourth session blocking.**
- ⚠ **Card 84 has no on-grid footprint and the bot may still loot it.**
  `chooseNewCard` has no deck-composition term — TASKS.md §13, still NOT
  STARTED. Second observed instance, not a quantified cost.
- **The JWT expires and blocks the whole session.** Valid to 2026-09-04T18:48Z
  (121.6h at 09:00 PDT). No renewal path in-repo; manual copy from the browser.

## Corrections to SPEC.md
- **None. `SPEC.md` was not touched** — nothing contradicted it. SPEC §3c's
  claim that tier 2 requires one Silver Ring per faction (items 134–140) was
  **CONFIRMED live**, not corrected, and so was the `entryData` ordering
  (tier 2, 1, 3).
- **Two corrections to other repo documents**, recorded rather than silently
  fixed: QUESTIONS §65 mis-cited `liveFishing.ts:1799` as a `saveGuardBudget`
  call (it builds the reconciler's input; the writes are 1804/1903/1969), and
  CLAUDE.md rule 11's heading had said "Tier-3" since 2026-08-27.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Do not allowlist the secret scanner against its own rules.** The obvious
  fix for a scanner holding literal sample secrets is an exemption for itself,
  and that creates the one file where a real secret could hide behind a
  legitimate one. Samples are concatenated at runtime instead. The self-check
  caught the TEST file twice: splitting the VALUE is not enough when the rule
  is keyed on a LABEL, because the code that builds the label matches it.
- **Do not write a literal NUL into TypeScript source.** The first draft split
  `-z` output on a raw NUL, which made git and grep treat the scanner as
  binary — so it would have skipped its own file. Use `"\x00"`. Pinned.
- **Do not compute allowlist staleness on a narrow scope.** On `--scope=diff`
  an exemption's file is usually just absent, and the naive check flagged all
  six and told the reader to delete live exemptions.
- **Do not throw when the guard counters move backwards.** The first draft did.
  `guards.adoptServerRunCount()` assigns the server's count ABSOLUTELY and can
  LOWER it, on the AUTONOMOUS fishing path — so the throw would have crashed a
  straddling batch at the moment it was healing itself.
- **Do not memoise the day boundary lazily at first save.** A process that
  loads a non-zero seed before 11:00 and does not write again until after has
  no pre-rollover save to learn the boundary from; the memo must be seeded at
  LOAD, and a second load must not re-seed it.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Metrics
- **Live: 0 dungeon runs, 0 rings, 0 energy, 0 fishing casts.** Nothing played.
  Dungeon ledger 12/12 all session; fishing 20/20 from session 110.
- Suite **2147 → 2195 (+48)**, files 111 → 113. Breakdown: +6 entry-tier
  runway, +32 secret scan, +10 guard straddle.
- Secret scan: **9118 files (tracked), 0 unexplained, 14 allowlisted**;
  14 files (diff scope), 0 unexplained. Control A 8758, control B all 8 rules.
- Silver rings 285 held / **30 runs** of runway; gold 200 held / **19 runs**.
- No sim runs, no fixtures added, no corpus change.

## Open questions for Claude
1. **The first live Tier-2 run still owes the wire check.** Confirm the seven
   negative `gameItemBalanceChanges` on `start_run` match
   `inputItems`/`inputAmounts` exactly, and re-read the balances after. **This
   is the brief's own unmet gate, not a nice-to-have.**
2. **The Tier-2 runway is 7.5 days against a ~37-day offering window.** Same
   arithmetic that drove Tier-3 → Tier-1. Not a blocker and not an agent's
   call, but the user should see it before day ~8.
3. **Is the Tier-1 arm now the baseline for anything downstream?** Session
   103's Tier-3 numbers are not comparable on any payout statistic and several
   reports still quote them — and Tier-1 is now itself superseded. **Seventh
   session unactioned**; raise it plainly rather than letting an eighth pass.
4. **The `nextPosition` override is LIVE and steering fishing card choice**
   with still no user sign-off. **Seventh session** carried unchanged.
5. **Should the approved on-demand oil policy be re-derived, or the
   double-lethal override formally adopted?** A user decision (rule 4), not an
   agent one. Carried from 110.
6. **`LossBlockUp` — may it be modelled as `latent` from n=1?** QUESTIONS §64.
   **Fourth session blocking.**
7. **Should `chooseNewCard` get a deck-composition term (TASKS.md §13)?**
8. **The fishing guard counter over-counts**, separately from the straddle
   fixed this session. Carried from 107.

## Files changed
```
 CLAUDE.md                                   |  68 +-   (rule 11 -> Tier-2; scan rule)
 QUESTIONS.md                                |  52 +-   (§65 ANSWERED)
 handoff/DECISIONS.md                        |  13 +    (13 entries)
 handoff/STATE.md                            |  13 +-
 scripts/checkEntryTiers.ts                  | 101 +    (new)
 scripts/secretScan.ts                       | 460 +    (new)
 scripts/doctor.ts                           |   2 +-   (Tier-2 hint)
 scripts/liveRun.ts                          |   7 +-   (USAGE: Tier-2)
 scripts/orchestrator.ts                     |  13 +-   (Tier-2 pointer)
 src/orchestrator/guardPersistence.ts        | 156 +-   (DAY_MEMO, §65)
 tests/entryTierRunway.test.ts               |  66 +    (new, 6)
 tests/secretScan.test.ts                    | 264 +    (new, 32)
 tests/orchestrator/guardPersistence.test.ts | 176 +-   (+10)
 tests/orchestrator/dungeonArmClosed.test.ts |  31 +-
 14 files changed, 1387 insertions(+), 35 deletions(-)
```
