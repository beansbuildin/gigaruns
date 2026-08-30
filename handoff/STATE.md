# STATE — session 112 — 2026-08-30 — code at commit b0d9b6a7

## Status
Brief was **offline wrap-up + three user decisions + two carried fixes**, with
a Tier-2 dungeon run only opportunistically at the end. **All four steps done.**

- **Step 1, three user decisions recorded: GATE PASS.** 21 DECISIONS entries.
- **Step 2, the oil-trigger gap: GATE PASS**, and the answer is neither of the
  brief's two hypotheses. **No oil waste found.**
- **Step 3, two carried fixes: one GATE PASS, one GATE FAIL-BY-DESIGN.** The
  fishing guard over-count is FIXED. **TASKS §13 is NOT met and could not be** —
  its gate is parked on a DATA floor (CLAUDE.md rule 6). The first candidate is
  built, tested and deliberately NOT wired.
- **Step 4, one Tier-2 run: RAN, with explicit per-run user go-ahead. The
  brief's own gate was UNMEETABLE AS WORDED** — the field it names does not
  exist — but the substance was measured a better way, and **it falsified
  CLAUDE.md rule 11's cost paragraph.**

**Live spend: 1 dungeon run (3 of 12 run-units), 3 Foxglove Silver rings, 60
energy, 0 fishing casts.** Reached **room 13**, the deepest ever.

Suite **2226 passed / 2226, 114 files** (2195 → 2226, +31). `tsc --noEmit`
clean, `git diff --check` clean, `discoveredShipsClean` 8/8, `.gitignore`
verified on all seven required paths.

⚠ **Re-run the suite unsandboxed.** `tests/profile.test.ts` shells out to git
and FALSELY fails under the sandbox. It cost a diagnostic cycle this session.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        9121
  CONTROL A (read):     8759 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS
```

At `--scope=diff --ref=5e815aa2`: **246 files, 0 unexplained**, control A 231.
The recap's four literal patterns over the session's added lines: `0x…{4,}` 0,
`noobId\s*\d+` 0, `eyJ` 0, `PRIVATE` 0. The 222 new fixture states redacted
clean.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. Entries marked **[USER]** are user
directives an agent may not re-open at all.

**Dropped this session:** the guard-budget straddle (now enforced by
`guardPersistence.test.ts`), and `LossBlockUp` (now enforced by `boons.test.ts`
— an unlisted type with a pair and no model still fails). Both are
self-enforcing; the digest rule says drop what a test already catches.

- **[USER] Rule 11 entry tier is Tier-2 (`--juiced-index=2`).** STANDING,
  2026-08-30. `data.index` is the TIER; `entryData` is ordered 2, 1, 3, so
  match on `.tier`, never on position. **Exercised live 1/1.** Re-opens as:
  *"switch the entry tier back"* or *"correct the juiced index"*.
- ⚠ **Tier-2 costs ONE faction x3 per run, NOT one of each of seven.**
  MEASURED live: only Foxglove moved (57→54); six factions untouched. The
  runway printed anywhere is a **LOWER BOUND**. DECISIONS 2026-08-30. Re-opens
  as: *"Tier 2 costs one of each of the seven silver rings"* or *"the ring
  runway is 30 runs / 7.5 days"*. **Both are wrong.**
- **No ring debit appears on the wire, anywhere.** `start_run` has no
  `gameItemBalanceChanges` field at all. Re-opens as: *"check the ring debit on
  the start_run response."* There is nothing there to check — read balances.
- **The fishing guard over-count is FIXED**, and was a SCOPE conflation, not
  the day-key straddle. Exhaustion is now its own persisted flag. DECISIONS
  2026-08-30. Re-opens as: *"the fishing guard counter over-counts"*.
- **[USER] `nextPosition` override is KEPT ACTIVE and formally approved**,
  2026-08-30, closing seven sessions of open question. Re-opens as: *"the
  nextPosition override is live with no sign-off."* It has one now.
- **[USER] Oil policy: re-derive on-demand, do NOT adopt the double-lethal
  override.** 2026-08-30. Target framing: 60-70% catch rate, oils not wasted.
  Re-opens as: *"adopt the double-lethal override"* or *"decide the oil
  policy"*.
- **The oil-trigger gap is EXPLAINED and NO WASTE WAS FOUND.** Focus arm 32/32
  withdrawn by `allowedItemIds`; relaxing arm arose once and was correctly
  gated. Re-opens as: *"find out why the on-demand oil trigger never fires"*.
- **TASKS §13 is parked on DATA, not code.** First candidate built and NOT
  wired. Re-opens as: *"implement the chooseNewCard deck-composition term"* —
  it cannot be gated until real card choices reach double digits.
- **No fishing card is footprint-less; the guaranteed-miss set is a CENSUS.**
  16 of 80 catalog cards sit at reachability 2/3. Re-opens as: *"card 84 cannot
  hit anything"* or *"the guaranteed-miss set grew again"*.
- **[USER] Chaining is a ONE-TIME, DATED exception.** Rule 11 pins `--runs=1`.
  DECISIONS 2026-08-29. Re-opens as: *"chain the runs like last time."*
- **Fishing's Hard Core income is TRACKED and BACKFILLED, and NOT a constant.**
  Tracks rarity, base 0→80 … 4→480. DECISIONS 2026-08-29. Re-opens as: *"add a
  Hard Core column to the fishing report"* or *"is it 320 per catch"*.
- **A fishing batch is sized to WHICHEVER of rod durability and the cast cap
  binds first.** DECISIONS 2026-08-29. Re-opens as: *"run the full 20/25 casts"*.
- **JEBAITOR, and its gap, MEASURED.** ~9% of casts do not tick `dayDocs`.
  Re-opens as: *"the cast ledgers disagree."* **A sub-25-cast batch is NOT
  evidence the budget is too low.**
- **`triggeredBoons`.** CLOSED — 0 non-empty of 10,616. DECISIONS 2026-08-26.
  **No runs may be spent on it.**
- **`tenacity` / `intuition` as damage mitigation RULED OUT.** §58, §62, §63.
  Re-opens as: *"find what tenacity does"* — heal AMOUNTS are what is open.
- **[USER] Unspent skill XP.** CLOSED, §61.1 forbids re-raising it.
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **The oil-gap answer, measured off live logs rather than a replay.**
  `oil_shadow` already records `onDemandTriggers`' verdict every turn. 22 casts,
  96 decision turns, **63.6% catch rate (14/22)** — inside the user's 60-70%
  target. Focus arm fired 32 and was withdrawn 32/32 by config; relaxing arm
  fired ONCE (`fishHp` 1) and the necessity gate withheld it at
  `bestKillProbability` 0.9913 vs the 0.85 threshold. **14 of 14 oils spent
  came from the override, 0 from the approved policy.**
- **Double-lethal does not intercept on-demand's decision point** — disjoint
  `fishHp` bands, proved three ways. The real interception is **TEMPORAL**: the
  override kills at 3-4 HP so the fish never reaches the 1-2 band. Histogram
  1:1, 2:0, 3:4, 4:5.
- **The guard fix.** `GuardState.serverCapReached` + `capReachedByServer`,
  persisted as an optional boolean, reported on its own line by `--status` and
  `checkFishingCaps`. `assertCanStartRun` checks it first, so protection is
  identical. Session 107's numbers replayed as a regression test.
- **`positionalReachability` / `meanZoneCoverage`** — pure geometry, tested
  against the real catalog, NOT wired. A test fails if anyone wires them in.
- **One Tier-2 run, room 13.** 108 actions, **0 first-attempt failures**,
  energy 78→20 (committed 60, observed 58 = passive regen). Corpus gained
  enemies 74/75, 12 offer rows, `VulnerableTenacity` modelled latent.

## What's broken
- ⚠ **The Tier-2 ring cost model in every doc was WRONG and the corrected one
  is n=1.** The `3` matches `JUICED_COST_MULTIPLIER` exactly, but "3 = the
  multiplier" and "3 = a flat per-entry amount" are **UNSEPARATED**. Separating
  them, and learning whether the charged faction rotates, needs **a run on a
  different faction day**. Until then the runway is a lower bound of unknown
  slack.
- ⚠ **The approved on-demand oil policy is effectively UNREACHABLE.** Its focus
  arm is 100% withdrawn by `allowedItemIds: [937]`; its relaxing arm is starved
  by the override killing fish one HP band above it. **The policy the user
  approved is not the policy spending their oils.** Neither is a bug; changing
  either is a user decision.
- ⚠ **The in-memory half of the guard straddle is unfixed, deliberately**, and
  the new cap flag inherits the same limitation (suppressed after a rollover).
  Both fail-safe.
- ⚠ **`chooseNewCard` has a CURRENCY flaw**, newly characterised: it compares a
  one-zone crit against a five-zone hit as the same event. Not fixed — §13's
  gate is parked on data.
- **The JWT expires and blocks the whole session.** Valid to 2026-09-04T18:48Z.
  Manual copy from the browser; no renewal path in-repo.

## Corrections to SPEC.md
- **`SPEC.md` was not touched — but CLAUDE.md was, and that is the bigger
  correction.** Rule 11's cost paragraph asserted Tier 2 spends one of each of
  the seven silver rings and derived a 30-run runway from it. **Both are
  falsified by measurement.** The paragraph is corrected in place, with the
  wrong claim kept and struck through per its own convention.
- **`start_run`'s response carries NO `gameItemBalanceChanges`.** Keys are
  `success, actionToken, message, data{run, events, entity}`; `data.events` is
  `[{"type":"dungeon_started",...}]`. The brief's gate assumed otherwise.
- **STATE.md's own "card 84 has no on-grid footprint" was wrong** — card 84 is
  `hitZones: [7,8,9]`, hit 6, mana 1. `matcherHeadroom`'s set is per-play and
  positional.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Do not compute the ring cost from `entryData`'s `inputItems` length.**
  Seven ids with `inputAmounts: [1,…]` reads as a seven-ring bill and is not
  one. `inputsBasedOnFactionDay: true` is the tell that was there all along.
- **Do not look for the ring debit in `gameItemBalanceChanges`.** It is not
  there on any of the run's 452 log lines — only 845 and 846 appear. Read
  balances before and after.
- **Do not add a new `GuardTrip` reason without adding it to
  `BUDGET_GUARD_REASONS`.** A designed daily stop then reads as an anomaly and
  takes the whole orchestrator down over one exhausted mode.
- **Do not let the server-cap flag cross the 11:00 PT rollover.** It is
  cumulative in memory and cannot say which day it belongs to; a surviving
  `true` opens the new day already blocked.
- **Do not trust an assertion whose expected value is a CONFIG CONSTANT.**
  `tests/liveFishing.test.ts` asserted the forged count as correct from session
  29 to now — the tests did not miss the bug, they encoded it.
- **Do not run the suite sandboxed** — `profile.test.ts` fails falsely.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Metrics
- **Live: 1 dungeon run, room 13 (deepest ever), 108 actions, 0 first-attempt
  failures.** 3 of 12 run-units, 60 energy, **3 Foxglove Silver**. Hard Core
  **+6768**, Dendren Root **+1179** — a Tier-2 anchor, **not comparable** to
  session 103's Tier-3 figures. 0 fishing casts.
- Suite **2195 → 2226 (+31)**, files 113 → 114.
- Secret scan: **9121 files (tracked), 0 unexplained, 14 allowlisted**; 246
  files (diff scope), 0 unexplained.
- Silver rings 294 → 291. Runway ≥30 runs (lower bound, see above).
- Oil corpus: 22 casts, 96 decision turns, 63.6% catch rate, 14 oils, 0 waste.
- Card catalog: 80 cards, reachability bands 0.667 ×16, 0.889 ×12, 1.000 ×52.

## Open questions for Claude
1. **The Tier-2 ring cost needs a SECOND run on a DIFFERENT faction day.** That
   is the only thing that separates "3 = juiced multiplier" from "3 = flat
   per-entry", and the only thing that shows whether the charged faction
   rotates. Until it happens the runway is unknown-but-larger-than-30. **This
   is the highest-value live measurement available.**
2. **The approved on-demand oil policy is unreachable in the current config.**
   Does the user want (a) Focus Oil added to `allowedItemIds`, (b) the
   double-lethal override turned off so on-demand's band is actually reached,
   or (c) neither — accept that the override is the de facto policy? A user
   decision under rule 4 / §30.
3. **Is the Tier-1 arm now the baseline for anything downstream?** Session
   103's Tier-3 numbers are not comparable to Tier-1 or Tier-2 on any payout
   statistic, and reports still quote them. **Eighth session unactioned** —
   there is now a Tier-2 anchor (6768) to hang a fix on.
4. **The fishing guard counter fix is untested against a live batch.** It is
   pinned by a regression test replaying session 107, but no fishing has run
   since. Direction is safe either way.
5. **Should `chooseNewCard`'s currency flaw be fixed independently of §13?**
   Comparing a one-zone crit against a five-zone hit is wrong regardless of
   deck composition, and fixing it does not need §13's data floor.
6. **`LossEvasionUp` / `LossLuckUp` remain unmodelled** — offered, never
   picked. No action needed; noted so a brief does not read the now-empty
   `AWAITING_MODEL_DIRECTIVE` as "all boons are modelled".

## Files changed
```
 CLAUDE.md                                   |  36 +-   (rule 11 cost CORRECTED)
 QUESTIONS.md                                |  25 +-   (§64 ANSWERED)
 TASKS.md                                    |  47 +-   (§13 candidate built)
 handoff/DECISIONS.md                        |  21 +    (21 entries)
 handoff/scratch-session-112.md              | 210 +    (new)
 scripts/checkEntryTiers.ts                  |  25 +    (runway = lower bound)
 scripts/checkFishingCaps.ts                 |  10 +    (cap flag line)
 scripts/liveFishing.ts                      |  34 +-   (cap flag, --status)
 scripts/liveRun.ts                          |  11 +-   (cap flag)
 src/orchestrator/guards.ts                  |  90 +-   (serverCapReached)
 src/orchestrator/guardPersistence.ts        |  84 +-   (persisted flag)
 src/sim/boons.ts                            | 155 +-   (LossBlockUp, VulnTen, offers)
 src/sim/enemies.ts                          |  58 +    (rooms 12, 13)
 src/strategy/fishing/cardChoice.ts          |  69 +    (reachability, coverage)
 tests/  (7 files)                           | 446 +-   (+31 tests)
 fixtures/dungeon-runs/run-2026-08-30-18-30-25/  222 new states
 246 files changed, 163010 insertions(+), 96 deletions(-)
```
