# STATE — session 113 — 2026-08-30/31 — code at commit 5b160304

## Status
Brief was four steps: implement the Tier-2 ring rotation model, disable the
double-lethal oil override, fish, then three Tier-2 runs. **All four PASS.**

- **Step 1, the Tier-2 ring model: GATE PASS**, and confirmed live 4/4.
- **Step 2, disable the double-lethal override: GATE PASS**, mutation-verified.
- **Step 3, fishing: GATE PASS.** 20 casts. **The oil source INVERTED** — 2 of 2
  oils from the approved policy, 0 from the override, against session 112's
  14 of 14 the other way.
- **Step 4, three Tier-2 runs: GATE PASS.** Ring model held on every run.

**Live spend: 3 dungeon runs (12 of 12 run-units — today's cap now FULL), 9
Foxglove Silver rings, 180 energy, 20 fishing casts (19 charged), 240 energy,
2 Mid Relaxing Oils.**

Suite **2262 passed / 2262, 115 files** (2226 → 2262). `tsc --noEmit` clean,
`git diff --check` clean, `discoveredShipsClean` 8/8, `.gitignore` verified on
all seven required paths.

⚠ **Re-run the suite unsandboxed** — `tests/profile.test.ts` false-fails under
the sandbox (carried from session 112).

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        9793
  CONTROL A (read):     9430 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS
```

At `--scope=diff --ref=4bc18200`: **477 files, 0 unexplained**, control A 460.
The four literal patterns over the session's added lines: `0x…{4,}` **0**,
`noobId\s*\d+` **0**, `eyJ` **0**, `PRIVATE` **0**.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session:** the Tier-2 "one of each of seven" entry and the
"30 runs / 7.5 days" runway (both now corrected in CLAUDE.md rule 11 AND pinned
as failing regression cases in `tests/entryTierRunway.test.ts`); the
`nextPosition` sign-off and the fishing-guard over-count (both now enforced by
tests that fail). All four enforce themselves; the digest rule says drop them.

- **[USER] Tier 2 costs 3 rings of ONE faction per juiced run, and the faction
  ROTATES DAILY.** CONFIRMED LIVE 4/4 (Foxglove 57→54→51→48→45, six factions
  untouched every time). DECISIONS 2026-08-30. Re-opens as: *"Tier 2 costs one
  of each of the seven silver rings"* or *"the charged faction is fixed"*.
- ⚠ **The ROTATION ORDER is still n=1 and this session could not fix it.** All
  four observations are faction day 20695. Re-opens as: *"work out which
  faction is charged on which day"* — that needs a run after the day flips, and
  **is the highest-value cheap measurement available.**
- **TODAY'S FACTION IS NOT KNOWABLE IN ADVANCE — the search is COMPLETE.**
  Checked `/game/dungeon/today` (every key), `/account`, `/user/me`, all ~900KB
  of `/offchain/static`. Re-opens as: *"find the field that says which faction
  is charged today."* **Do not re-hunt it.**
- **[USER] The double-lethal oil override is DISABLED; Focus Oil stays off the
  allowlist.** 2026-08-30, reversing the 2026-08-24 override (§30). Re-opens
  as: *"turn the double-lethal band back on"* — needs a new user directive.
- **[USER] Oil target framing: 60-70% catch rate, oils not wasted.** Re-opens
  as: *"decide the oil policy"*. ⚠ Also: *"the disable cost us catch rate"* —
  **60.0% vs 63.6% is NOT distinguishable at n=20.**
- **TASKS §13 is parked on DATA, not code.** First candidate built, NOT wired.
  Re-opens as: *"implement the `chooseNewCard` deck-composition term"*.
- **No fishing card is footprint-less; the guaranteed-miss set is a CENSUS.**
  Card 87 joined this session at reachability 6/9, same zones as card 6.
  Re-opens as: *"the guaranteed-miss set grew again"*.
- **[USER] Chaining is a ONE-TIME, DATED exception.** Rule 11 pins `--runs=1`.
  Re-opens as: *"chain the runs like last time."*
- **Fishing's Hard Core income is TRACKED and is NOT a constant.** Re-opens as:
  *"add a Hard Core column to the fishing report"* or *"is it 320 per catch"*.
- **A fishing batch is sized to WHICHEVER of rod durability and the cast cap
  binds first.** Re-opens as: *"run the full 20/25 casts"*.
- **JEBAITOR gap MEASURED.** ~9% of casts do not tick `dayDocs` (5% this
  session). Re-opens as: *"the cast ledgers disagree."*
- **`triggeredBoons`.** CLOSED — 0 non-empty of 10,616. **No runs may be spent
  on it.**
- **`tenacity` / `intuition` as damage mitigation RULED OUT.** §58, §62, §63.
  Re-opens as: *"find what tenacity does"* — heal AMOUNTS are what is open.
- **[USER] Unspent skill XP.** CLOSED, §61.1 forbids re-raising it.
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **The ring model, confirmed 4/4 live.** Foxglove 57→54→51→48→45 across
  session 112's run and today's three; every other faction 0 at every step;
  total 294 → 282. `scripts/checkEntryTiers.ts` now models rotation:
  per-faction active-day capacity, scarcest/richest spread, and cycles-to-dry.
  Live: **2 cycles = 14 days = ~56 runs**, bound by Athena/Archon at 30 —
  roughly DOUBLE the retired 30-run figure, which is now a failing regression
  case.
- **`client.getGameDay()`** — narrow read of `/offchain/static`'s six day
  scalars (`currentDay` 20695, `secondsTillNextDay`). Tells you WHEN the
  faction flips, never WHICH. Allowlisted in `clientSurface.test.ts` as the
  conscious act that file's header demands.
- **The faction↔ring table**, published by the server itself in seven `500006`
  Hatchard Kit recipes: 1 Crusader 135 · 2 Overseer 136 · 3 Athena 137 ·
  4 Archon 138 · 5 Foxglove 139 · 6 Summoner 140 · 7 Chobo 134 (gold +109).
- **The override disable.** `dendren.oils.doubleLethalOverride`, **absent =
  DISABLED**, `=== true` to arm. Three locks (policy structurally incapable /
  config default / live loop sends zero POSTs), **mutation-verified**:
  loosening to `!== false` fails two of them.
- **The approved oil policy FIRING, for the first time since session 62.** Both
  at `fishHp` 1, `bestKillProbability` 0.5795 and 0.6298 (under the 0.85 gate).
  Oil spend fell **6.4x**: 0.64/cast → 0.10/cast.
- **The fishing guard fix, first live exercise, exact.** Game `dayDocs[2]` 19,
  repo 19 casts / 240 energy, "ledgers agree at 19".
- **Three Tier-2 runs, 0 first-attempt failures across 156 actions.** Rooms 7,
  6, 9. Rule 8: **19 of 19 TIER-CHECK lines OK.**

## What's broken
- ⚠ **The rotation ORDER is unmeasured and unmeasurable from here.** Four
  observations, one faction day. Every candidate offset still fits.
- ⚠⚠ **RUNS 1-2 AND RUN 3 ARE NOT THE SAME ARM.** A +1 ATK change to Sword and
  Shield landed in the ~22 minutes between runs 2 and 3. Run 3 went deepest
  (room 9 vs 7, 6) and paid most (+8800 vs +2976, +2496) and **none of that may
  be read as a tier or strategy effect.**
- ⚠ **`SecondWind`'s spent-arm exception is UNEXPLAINED.** `state-128`:
  SecondWind 10→0, Regen 1→0, recorded `heal` 1 — but HP moved 26→35 (+9),
  consistent with a full spend. **The `heal` FIELD under-reports when two heals
  land in one exchange.** A capture limit, not a mechanic claim.
- ⚠ **`chooseNewCard` has a CURRENCY flaw** — a one-zone crit scored against a
  five-zone hit as the same event. Not fixed; §13's gate is parked on data.
- ⚠ **The in-memory half of the guard straddle is unfixed, deliberately.**
  Fail-safe.
- ⚠ **`redrawCounterfactual`'s K=6 conditioning claim is FALSIFIED** (K=10
  still holds, wider). Not a bug — a measurement.
- **The JWT expires and blocks the whole session.** Valid to 2026-09-04T18:48Z.

## Corrections to SPEC.md
- **`SPEC.md` was not touched. CLAUDE.md rule 11 was, for the THIRD time** —
  the cost paragraph now reads "3 of ONE faction, rotating daily", with both
  prior versions kept, dated and struck through per its own convention.
- **`GET /offchain/static` publishes `currentDay` / `currentDayOfWeek` /
  `secondsTillNextDay`** — not previously modelled anywhere. `currentDay` is
  the same integer as `dayProgressEntities[].TIMESTAMP_CID` (both 20695).
- **`recipes[].FACTION_CID_array` is the ONLY `/faction/i` key in all of
  `/offchain/static`.** No player-faction field exists on `/account` or
  `/user/me` either.
- **`BurnMastery` is a x2 MULTIPLIER, not a flat +3** — measured, see below.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Do not fit a day→faction offset to one observation.** Day 20695 → Foxglove
  (faction 5) while `currentDayOfWeek` is 3, so there is no trivial identity;
  with n=1 every candidate formula fits for exactly one offset.
- **Do not look for the ring debit on the wire.** `start_run` has no
  `gameItemBalanceChanges` field. Read balances before and after.
- **Do not compute the ring cost from `entryData`'s `inputItems` length.**
- **Do not fit an effect to `Vengeance`'s single +5 residue** (QUESTIONS §67).
  Its `amount` has not been shown to be a magnitude at all — for `Weak` and
  `Vulnerable` it is a COUNTDOWN.
- **Do not model `CritHeal` without a user directive** (QUESTIONS §66).
- **Do not "fix" a `scaleRule`/`secondWindRule` exception by widening the
  exclusion.** Both exclusions are asserted to be EXACTLY the
  undefined-measurement set.
- **Do not run the suite sandboxed** — `profile.test.ts` fails falsely.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Metrics
- **Live dungeon: 3 runs, rooms 7 / 6 / 9, 156 actions, 0 first-attempt
  failures.** 9 of 12 run-units (3 → 12, cap FULL), 180 energy, **9 Foxglove
  Silver**. Hard Core **+2976 / +2496 / +8800**, Dendren Root +309 / +216 /
  +546. ⚠ Run 3 is a different arm — do not pool.
- **Live fishing: 20 casts played, 19 charged**, 240 energy, rod durability
  33 → 13. Catch **12/20 = 60.0%, Wilson 95% CI [38.7%, 78.1%]** (session 110:
  63.6% [43.0%, 80.3%] — **overlapping, not distinguishable**). **2 oils, both
  approved-policy**; Hard Core +2480 (~207/catch).
- Suite **2226 → 2262 (+36)**, files 114 → 115.
- Secret scan: **9793 files (tracked), 0 unexplained, 14 allowlisted**; 477
  files (diff scope), 0 unexplained.
- Silver rings 291 → 282. Runway ~56 runs / 14 days (uniform-rotation model).
- Fishing corpus 295 → 315 casts; dungeon offers +19 rows.

## Open questions for Claude
1. **The rotation order needs ONE run after 2026-08-31 18:00 UTC.** That single
   observation turns a 7-way unknown into a solved map. **Highest-value cheap
   measurement available**, and it is free — any authorized run on a new day
   produces it as a side effect.
2. **`CritHeal`: model it latent from n=1, or wait for a second pair?** A user
   directive, QUESTIONS §66. Default today is wait.
3. **Is the Tier-1/Tier-3 arm a baseline for anything downstream?** **NINTH
   session unactioned.** There are now three Tier-2 anchors — but two of them
   are a different arm from the third, which makes this harder, not easier.
4. **Should `chooseNewCard`'s currency flaw be fixed independently of §13?**
   Comparing a one-zone crit against a five-zone hit is wrong regardless of
   deck composition. Carried from session 112, still unactioned.
5. **The oil result is n=2 batches.** 60.0% vs 63.6% cannot separate them. A
   third batch is the first point that could.
6. **`LossEvasionUp` / `LossLuckUp` remain unmodelled** — offered, never
   picked. No action needed; noted so a brief does not read
   `AWAITING_MODEL_DIRECTIVE` (now holding only `CritHeal`) as "all modelled".

## Files changed
```
 CLAUDE.md                                     |  65 +-   (rule 11, THIRD version)
 QUESTIONS.md                                  |  78 +    (§66, §67)
 handoff/DECISIONS.md                          |  21 +
 handoff/scratch-session-113.md                | 340 +
 scripts/checkEntryTiers.ts                    | 255 +-   (rotation runway)
 scripts/liveFishing.ts                        |  96 +-   (override disarmed)
 src/api/client.ts, schemas.ts                 |  46 +    (getGameDay)
 src/orchestrator/config.ts                    |  22 +    (doubleLethalOverride)
 src/sim/boons.ts                              | 122 +    (+19 offers, CritHeal)
 src/sim/enemies.ts                            |  33 +-   (PLAYER +1 ATK)
 src/strategy/fishing/oilPolicy.ts             |  23 +
 tests/  (17 files, 1 new)                     | 1187 +-  (+36 tests)
 fixtures/  3 dungeon runs + 20 fishing casts
 477 files changed, 298492 insertions(+), 307 deletions(-)
```
