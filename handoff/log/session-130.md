# Session 130 — 2026-09-13 — back to Tier 3 (gold), a full live day, Vengeance modelled

## STATE at close (copied)


## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data. The
session worked `handoff/next.md`'s session-130 brief, which was CURRENT.

**⭐ GATE PASS. The full live day was spent at the NEW tier, AND the suite was
left GREEN** — **2718 passed / 2718, exit 0** (117 files, unsandboxed,
`--maxWorkers=4`), `tsc --noEmit` exit 0, `git diff --cached --check` exit 0,
`discoveredShipsClean` 8/8.

**Dungeon: PASS — 12/12 run-units, 4 juiced TIER-3 runs, 297 actions, 0/297 =
0.00% first-attempt failures.** Pre-registered in `c347f046` before the first
`start_run`; four of five hypotheses PASS and **H2 FAILED on purpose-built
data: the gold faction does NOT follow the silver dow map.**
**Fishing: PASS — 10 played / 9 charged,** clean `cast_cap` exit at the gear
halt it was sized to (pre-registered in `d3a1f451`).

**JWT: refreshed by the user before the session.** `doctor.ts` at 16:58Z read
**167.6h** left → expires ≈ **2026-09-20T16:35Z**. It did not bind; the day did
(rollover 18:00Z). All live work finished by 17:34:41Z, 25 minutes inside it.

**ONE authorization covered the session, given in chat** at ~17:01Z (*"Yes: 4 T3
+ 10 casts"*), which also CONFIRMED the brief's quoted Tier-3 directive. Not
claimed from the brief.

**Secret scan, quoting the instrument** (`npx tsx scripts/secretScan.ts`, run
after staging):

```
> PASS — no unexplained hits, both controls healthy.
```
Addition, not substitute: `--scope=diff --ref=02a5e944` → **725 files, PASS**.
The recap's own diff grep: `eyJ` 0, `noobId\s*\d+` 0, `PRIVATE` 0,
`0x[a-fA-F0-9]{4,}` 0. No `raw/` or `.har` path staged.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **[USER]** =
a user directive an agent may not re-open at all.

**Dropped this session — THREE:** the **`Vengeance` AMPLIFIES** entry (now a
model with 29/29 + 164/164 pins that fail if reverted — superseded by the new
[USER] entry below); the **TieDamageReduction held at n=1** entry (folded into
`tests/boons.test.ts`'s `AWAITING_MODEL_DIRECTIVE`, which fails anyone who
models it); the **`VulnerableMastery` needs collection** entry (quiet for three
sessions; its reasoning lives in QUESTIONS).

- ⭐ **[USER] [NEW] ENTRY TIER IS 3 — GOLD RINGS.** 2026-09-13, standing.
  `--juiced-index=3`; CLAUDE.md rule 11 amended with the Tier-2 clause struck
  and kept; `dungeonArmClosed.test.ts` retires `{2, 1}`. DECISIONS 2026-09-13.
  Re-opens as: *"switch to Tier 2 to save gold"*, *"Tier 2 is the standing
  entry tier"*, *"run --juiced-index=2"*.
- ⭐ **[NEW] THE GOLD CHARGE IS ONE FACTION × 3 — BUT NOT THE SILVER ROTATION.**
  Day 20708 (dow 2) charged **Foxglove Gold 248**, silver map says Overseer.
  Tier-3 shape count **4/4**; Tier-2's **49/49 is CLOSED**. ONE gold day
  observed. Re-opens as: *"predict today's gold faction from the dow map"*,
  *"the rotation is fully measured, so gold is known"* — the rotation is
  measured for SILVER only.
- ⭐ **[NEW] DENDREN ROOT (846) IS A FUNCTION OF THE DEATH ROOM, NOT THE TIER.**
  Room 9 → 546 and room 10 → 687 at both tiers; full table in SPEC §3c.
  Re-opens as: *"compare Dendren Root totals across tiers"*, *"846 should be
  unchanged at ≈2,700–2,900"* — a total is depth-confounded; compare per room.
- ⭐ **[USER] [NEW] `Vengeance` IS MODELLED** ("Model it", 2026-09-13). Arms on
  a LOSS, holds on a loss, consumed on the holder's next damaging exchange,
  which deals `floor(x*1.25)` (crit before; Weak/Vulnerable/block after).
  `src/sim/vengeance.ts`, QUESTIONS §67 ANSWERED. ⛔ Only amount 25 has armed;
  15 is refused. Re-opens as: *"ask the user about Vengeance"*, *"Vengeance is
  n=2"*, *"model Vengeance 15 as +15%"*.
- ⭐ **`blockedMove`'s SCOPE IS MEASURED AND THE PROPOSED WIRING IS FALSIFIED.**
  Now **23 procs**: current **6/23** vs 7.67 (p ≈ 0.31, chance), next **2/23**
  vs 7.67 (p ≈ 0.0067). Soft prior, not an exclusion (2 counterexamples stand).
  Consumed nowhere. Re-opens as: *"wire blockedMove in — remove it from the
  enemy's distribution"*, *"commission runs for blockedMove"*.
- ⚠ **`hpMax` 51 → 50 AND Sword ATK 27 → 26 coincide with the rod swap 923 →
  924.** Unchanged: all four session-130 start states read **50/17** on rod 924.
  COINCIDENT, NOT PROVEN; falsifiable only by a swap back. Re-opens as: *"the −1
  is broken gear"*, *"swap back to 923 to test it"* (not for this alone).
- ⚠ **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT — SIXTH session.** 901 and a
  slot-15 954 were repaired out of band again. ✅ Keep the inversion: read
  `checkGear.ts` first. Re-opens as: *"raise these repairs up front"*.
- ⭐ **[USER] APPROVAL IS PER SESSION, NOT PER RUN** — 2026-09-11. Used exactly
  that way again. ⛔ A brief may never manufacture it; rule 5, rule 13 and the
  per-arm gear halt untouched. Re-opens as: *"ask before each run"*, *"the user
  has authorized N runs"* (in a brief).
- ⭐ **[USER] RING BALANCES ARE NOT A CONSTRAINT** — 2026-09-11. ✅ KEEP reading
  ALL FOURTEEN (both metals) before and after every run — the debit is not on
  the wire. Re-opens as: *"the gold runway is a concern"*, *"consider Tier 2 to
  save gold"*.
- ⭐ **THE ORCHESTRATOR'S DUNGEON ARM STAYS CLOSED** — no dungeon run without a
  human in the loop. Re-opens as: *"rule 11 softened, so the arm can reopen"*.
- **[USER] THE GEAR HALT: never abort a run in progress; after a COMPLETED run,
  any piece at 0 stops that ARM; pieces at 0 at session open are GRANDFATHERED;
  PER-ARM.** Fired exactly as pre-registered on both arms this session. Item 50
  (slot 8) is grandfathered. Re-opens as: *"item 50 halts the arm"*.
- **[USER] OTHER DUNGEONS ON THIS ACCOUNT ARE OUT OF SCOPE.** The 12-run-unit
  ledger is per-dungeon.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.** Binding cap
  = smallest of rod / ledger / gear — **gear at 10** this session.
- **[USER] The Tier-1/Tier-3 whole-run income baseline is RETIRED BY NAME.**
  Switching tiers does not un-retire it; per-room recording is not that
  experiment. Re-opens as: *"design a cross-tier income experiment"*.
- ⚠ **PIN IN-SESSION; THE BACKLOG IS THE COST.** 175 sites this session, green
  same-session. Re-opens as: *"defer the pin pass"*.

## What works
- **`scripts/liveRun.ts --juiced --juiced-index=3` four times in ~21 min** —
  297 actions, **0/297** first-attempt failures; dry-run printed `index 3`.
  `liveRun.ts` sends `index` straight to the server; no positional `entryData`
  read exists in it (checked).
- **Every gear forecast landed EXACTLY** at all four dungeon readings
  (45/21/21/9 → … → 36/12/12/0) and on the fishing close (slot-15 10→0, 20→10;
  rod 27→17).
- **`scripts/liveFishing.ts --oil-batch` at `SESSION_130_LIMITS.castCap 10`**,
  clean `cast_cap` exit.
- **Payout summing off `gameItemBalanceChanges`** in `logs/run-*.jsonl` —
  validated by reproducing session 125's 19,608 / 2,874 exactly before use.
- **Pre-registration as a commit, TENTH session running**, split per arm.
- **`vengeanceRules`** in `npx tsx scripts/statusEffects.ts`: 29/29, 164/164, 8/8.

## What's broken
- ⚠ **BOTH ARMS ARE HALTED on gear.** Dungeon: **905 (slot 13) at 0**. Fishing:
  **slot-15 954 (…83b834fd) at 0**, its pair at 10. Close: 640 36, 641 12, 901
  12, rod 924 17. **Both need a manual repair before the next live day.**
- ⚠ **`data.nextPosition` / `data.nextMovePath` still logged as UNKNOWN FIELDS**
  every fishing turn (dumps again today) while the override uses it (67/67).
  Registry gap, not a rule-5 condition. **Not closed this session.**
- ⚠ **`fixtures/fishing-casts/cards.json` holds 8 of Golkan's 10 cards** (82,
  83 absent). Unchanged.
- ⚠ **`checkEntryTiers.ts` still prints a ring "RUNWAY" line under both tiers**,
  a concept the user retired 2026-09-11. Its Tier-3 block no longer prints the
  silver rotation table (fixed this session); the runway line was left.
- ⚠ **THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE** —
  `Bash(npx tsx scripts/liveRun.ts *)`, `Bash(npx tsx scripts/liveFishing.ts
  *)`, `Bash(npx tsx scripts/orchestrator.ts *)`. The user's edit to make.
  Did not block anything this session.
- ⚠ **`$TMPDIR` DIFFERS by sandbox mode** — avoided this session by using the
  scratchpad path throughout. **The `web/` front end** is untouched since
  session 120.

## Corrections to SPEC.md
- **SPEC §3c said Tier 3 "requires one Golden Ring per faction"**; live: ONE
  gold faction, −3 per juiced run, six untouched, silver untouched, and the
  faction (Foxglove 248 on dow 2) is NOT the silver map's. **Fixed in SPEC.md**,
  with the 846-by-room table added beside it.
- **CLAUDE.md rule 11**: `--juiced-index=3` [USER], dated, Tier-2 clause struck.
- **The brief's "Vengeance n=2"** was wrong by the corpus: 29 damage exchanges.
- **The brief's Dendren-Root "tight test" framing** (totals ≈2,700–2,900) is
  depth-confounded; the per-room identity is the real test and it PASSES.
- **The brief's gear table was stale in 2 of 7 rows** (901 0→24, slot-15 0→20).
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: **ABSENT** for rings on the wire — unchanged since session 112.

## Dead ends
- **Do not print ring balances with positional `awk` columns** — the faction
  names shift the fields and the between-run print came out empty; run 2's
  gold reading was lost. Use `sed` on the `balance N` token, or read the JSON.
- **Do not let a pin patcher write files before it has parsed every failure** —
  the first run crashed on an argument on the next line after writing three
  files. Snapshot `tests/` first and diff against it.
- **Do not strip outer brackets when re-formatting an array received value** —
  `[[1,99],…]` became `[1,104], …`, a syntax error. Caught before a suite read it.
- **Do not compare Dendren Root totals across days** — compare per death room.
- Carried: never read consecutive captures as consecutive EXCHANGES;
  `loadCorpus()` drops `data.events`; anchor pins on the matcher call; ratio
  pins need BOTH halves; never nest a `/* was */`. §0a NOT lifted — **+19.40pp
  and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Dungeon, live: 4 juiced Tier-3 runs, 12/12 run-units, 240 energy,** day
  **20708 (dow 2)**, 17:04:17Z → ~17:25Z. Actions **75 / 62 / 57 / 103 = 297**,
  0 first-attempt failures. Death rooms **9 / 9 / 10 / 14**.
- **Hard Core 8,736 / 9,264 / 9,696 / 14,208 = 41,904**, 998/room = **×2.04**
  Tier 2's 490/room (band [1.6, 2.4] PASS). Room-matched: room 9 ×2.13, room 10
  ×1.93.
- **Dendren Root 546 / 546 / 687 / 1,362 = 3,141** (×1.09 of 2,874, PASS);
  per room identical to Tier 2.
- **Gold, open → close: Foxglove 31 → 19 (−12)**; Overseer 25, Crusader 25,
  Athena 35, Archon 40, Chobo 44, Summoner 48 unchanged. **Silver 159
  unchanged** (Athena 9, Archon 12, Crusader 15, Chobo 18, Summoner 30, Foxglove
  33, Overseer 42). Readings: 28 after run 1, 22 during run 3, 19 during run 4,
  19 at close — runs 2+3 are one combined −6.
- **Fishing, live: 10 PLAYED / 9 CHARGED**, 120 energy, 1 Relaxing oil (20 →
  19). **Puppeteer 4/10 = 40.0% today; 11/27 = 40.7% cumulative** — its own
  slice, not pooled. Other slices unchanged: Dendren 54/104 = 51.9%, Golkan
  183/307 = 59.6%. 2,400 Hard Core.
- **Vengeance:** 29/29 damage, 164/164 transitions, 8/8 victim-inert; 43
  `Vengeance` status sightings, all amount 25, all side 0.
- **Fish-HP multiplier interval [1.500, 1.583) → [1.500, 1.5625)** on
  Puppeteer card 101 (base 8, actual 12).
- Suite **2718/2718** (was 2674). Corpus **149 dungeon attempts** (was 145),
  **564 fishing casts** (was 554). `OBSERVED_OFFERS` **780 → 818**.
  Loadout census +2 mid-run combos (50/21, 58/14); start loadout 50/17 ×4.

## Open questions for Claude
1. ⭐ **BOTH ARMS NEED REPAIRS before any live work** — 905 (slot 13) and the
   slot-15 954 at 0. Read `checkGear.ts` first; repairs keep landing out of band.
2. ⭐ **What is the GOLD faction rotation?** One point: dow 2 → Foxglove (248).
   Silver's dow 3 cell is also Foxglove, so "gold = silver shifted by one day"
   is one candidate among many — **n=1 separates nothing**. The next Tier-3 day
   is the second point; pre-register a SET, not a single faction.
3. ⚠ **Is the rod carrying a dungeon stat line?** Still 50/17 on rod 924. Only a
   swap back to 923 tests it; not worth a swap by itself.
4. ⚠ **`nextPosition` registry gap** — cheap, still open, noise on every turn.
5. ⚠ **`checkEntryTiers.ts`'s ring-runway line** outlived the [USER] retirement
   of the runway question. Delete it, or does the user still want it printed?

## Files changed
Work commit `9015e650` plus pre-registration commits `c347f046`, `d3a1f451`,
and this recap; fixtures collapsed:

```
 fixtures/dungeon-runs/**            622 files — 4 run captures (+1 dry-run)
 fixtures/fishing-casts/live/**       68 files — 10 cast captures
 src/sim/vengeance.ts                NEW — the Vengeance combat model
 scripts/statusEffects.ts            +vengeanceRules, inertAtZero note superseded
 src/sim/boons.ts                    OBSERVED_OFFERS 780 -> 818; Vengeance note
 src/strategy/fishing/oilBatch.ts    +SESSION_130_LIMITS (castCap 10)
 scripts/liveFishing.ts              -> SESSION_130_LIMITS; in-sample 2.3 -> 2.2
 scripts/checkEntryTiers.ts          Tier-3 block no longer prints silver rotation
 scripts/{doctor,liveRun,orchestrator,checkGear}.ts   --juiced-index=3 hints
 tests/**                            20 files — pin pass (175 sites) + Vengeance
 CLAUDE.md, SPEC.md, QUESTIONS.md    rule 11 [USER]; §3c corrected; §67 answered
 handoff/{STATE,DECISIONS,scratch-session-130,log/session-130}.md
```

---

## Scratch file (pre-registrations and results, as committed)

# scratch — session 130 — 2026-09-13

## Session open (read live, 16:58Z)
- doctor: token valid another **167.6h** — does NOT bind; the day does (rollover 18:00Z, ~1.0h).
- Game day **20708, dow 2**. Run-units **0/12** (`dayProgressEntities` null). Fishing **0/20**.
- **Tier 3 OFFERED**, `dropMultiplier 4`, `inputsBasedOnFactionDay: true` (printed off tier 3's own entry).
  Gold ids (entryData order, amounts all 1): 245 Overseer 25, 244 Crusader 25, 248 Foxglove 31,
  246 Athena 35, 247 Archon 40, 243 Chobo 44, 249 Summoner 48 — **gold total 248**.
- Silver (instrument only): Athena 9, Archon 12, Crusader 15, Chobo 18, Summoner 30, Foxglove 33,
  Overseer 42 — **total 159**, matches STATE 129 exactly.
- Gear LIVE (brief's table stale again, 2 of 7 rows): 640 48, 641 24, **901 24** (was 0 — repaired),
  905 12, rod 924 27, slot-15 954 **10 / 20** (was 10 / 0 — repaired). Item 50 slot 8 at 0, grandfathered.
- `liveRun.ts` sends `index` straight to the server (no positional `entryData` lookup anywhere in it);
  dry-run printed **"isJuiced:true, index 3"**. Trap checked, not present.
- **[USER] authorization, in chat, 2026-09-13 ~17:01Z: "Yes: 4 T3 + 10 casts"** — confirms the Tier-3
  directive the brief quoted AND authorizes the session. **[USER] Vengeance: "Model it".**

## PRE-REGISTRATION — dungeon arm (committed before the first start_run)

1. **GOLD charge shape — a Tier-2 claim tested at Tier 3 for the FIRST time. New counter 0/0;
   Tier-2's 49/49 is CLOSED as a Tier-2 figure.**
   - H1: exactly ONE gold id moves per run, by exactly −3, six untouched.
   - H2 (weaker, stated separately): the gold faction follows the SILVER dow map, so dow 2 → f2 →
     **245 Overseer Gold 25 → 22 → 19 → 16 → 13**.
   - Falsifiers: >1 gold id moves; an amount other than 3; (H2 only) a different faction moves.
2. **SILVER untouched: all seven identical before and after every run (159).** Any silver move is a finding.
3. **Dendren Root (846) — TIGHT test.** Answers to `isJuiced` alone. Tier-2 reference session 125:
   2,874 over 4 runs (~718/run). Prediction: 4-run total within **±25% of 2,874 (2,155–3,590)**.
   **Falsified if the ratio to Tier 2 is ≥ 1.5** (i.e. it moved with the tier).
4. **Hard Core (845) — LOOSE test, pre-registered as a RATIO.** Tier-2 reference session 125:
   19,608 over 40 death-rooms (9/11/7/13) = **490 HC/room**. Prediction: Tier-3 HC-per-room ÷ 490
   ∈ **[1.6, 2.4]**, centre 2.0. Room depths reported beside it. Totals are depth-dominated and not
   predicted.
5. **Gear path at −3/run on slots 11/12/13×2:**
   | after run | 640 | 641 | 901 | 905 |
   |---|---|---|---|---|
   | 1 | 45 | 21 | 21 | 9 |
   | 2 | 42 | 18 | 18 | 6 |
   | 3 | 39 | 15 | 15 | 3 |
   | 4 | 36 | 12 | 12 | **0 ← break** |
   905 breaks at the END of run 4, the last authorized run; the dungeon arm halts after it, which costs nothing.
6. Run-units 0 → 3 → 6 → 9 → 12.

## DUNGEON ARM — RESULTS (4/4 runs, 17:04:17Z → ~17:25Z, day 20708 dow 2)

| run | log | actions | 1st-attempt fails | death room | 845 | 846 |
|---|---|---|---|---|---|---|
| 1 | 17-04-18 | 75 | 0 | 9 | 8,736 | 546 |
| 2 | 17-10-46 | 62 | 0 | 9 | 9,264 | 546 |
| 3 | 17-14-59 | 57 | 0 | 10 | 9,696 | 687 |
| 4 | 17-19-06 | 103 | 0 | 14 | 14,208 | 1,362 |
| **Σ** | | **297** | **0/297** | 42 | **41,904** | **3,141** |

Payout summed from `gameItemBalanceChanges` in the run logs; method VALIDATED first against session
125's recorded day (19,608 / 2,874 reproduced exactly).

1. **GOLD charge, Tier-3 count: 4/4 one faction at −3 (readings: 31 → 28 after run 1; 22 read DURING
   run 3; 19 read DURING run 4; 19 at close).** ⚠ Runs 2 and 3 are one combined reading (−6 over two
   entries) — the between-run print in my loop used the wrong awk columns and lost run 2's number.
   H1 PASS. **H2 FALSIFIED: the charged gold faction on dow 2 is FOXGLOVE (248), not Overseer (245).**
   The silver dow map does not govern gold.
2. **Silver untouched on all readings — 159.** PASS.
3. **Dendren Root 3,141 vs 2,874 = ×1.09** — inside ±25%, below 1.5. PASS. ⭐ And sharper than
   registered (found AFTER registration, so labelled as such): **846 is a deterministic function of the
   death room, identical across tiers** — room 9 → 546, room 10 → 687 on both Tier 2 (sessions
   125/129/09-09..09-11) and Tier 3 today. Room 14 → 1,362 is new and continues the increment series.
4. **Hard Core 41,904 / 42 rooms = 997.7/room ÷ 490 = ×2.04** — inside [1.6, 2.4]. PASS. Room-matched
   (post-registration): room 9 T3 mean 9,000 vs T2 mean 4,219 (n=5) = ×2.13; room 10 T3 9,696 vs T2
   mean 5,016 (n=4) = ×1.93.
5. **Gear EXACT at every reading:** 45/21/21/9 → 42/18/18/6 → 39/15/15/3 → **36/12/12/0**. 905 broke at
   the end of run 4 as predicted → dungeon arm HALTED (costs nothing; all authorized runs done).
6. Run-units 3 → 6 → 9 → 12. PASS.

## PRE-REGISTRATION — fishing arm (committed before the first cast)
- Scope: user authorized 20; **binding cap is GEAR at 10** (slot-15 pair 10 / 20, −1.00/PLAYED cast).
  Rod 924 at 27 (slack), ledger 0/20 CHARGED (slack). `SESSION_130_LIMITS.castCap = 10`.
- Predicted close: slot-15 **10 → 0 and 20 → 10**, rod **27 → 17**, exit `cast_cap` at played 10, and
  the fishing arm HALTED on gear after it. Charged ≤ 10 (free casts make charged < played).
- Oils Relaxing-only; Focus triggers log policy-withdrawn.
- Catch rate: NO prediction. Reported as a Puppeteer-only slice, never pooled into Dendren.

## FISHING ARM — RESULTS (17:31:25Z → 17:34:41Z, day 20708)
- **10 PLAYED / 9 CHARGED**, clean `cast_cap` exit, 120 energy. Game ledger 9/20.
- **Gear EXACT:** slot-15 **10 → 0** and **20 → 10**, rod **27 → 17** (−1.00/played cast). Fishing arm HALTED on gear.
- **Puppeteer slice: 4/10 = 40.0% today; 11/27 = 40.7% cumulative.** Not pooled. 2,400 Hard Core.
- 1 Relaxing oil consumed (20 → 19); Focus triggers logged policy-withdrawn.
- `nextPosition` override 67/67 hits; still logged as an UNKNOWN FIELD every turn (carry-forward 3, not closed).

## Vengeance ([USER] "Model it")
29/29 damage, 164/164 trigger, 8/8 victim-inert — see DECISIONS 2026-09-13.

## Surprises log
- My between-run balance print used wrong awk columns and lost run 2's gold reading. Recovered with reads taken DURING runs 3 and 4 (after their entry charge).
- The session-129 "Vengeance n=2" was an artefact of `inertAtZero`'s filter: the corpus held 29 damage exchanges.
- A first pin-patcher run crashed MID-TREE (arg on the next line) after writing three files; caught by the literal-mismatch guard on the rerun, verified by diff against a pre-pin copy.
- A patcher bug stripped the outer brackets of a nested array literal (`[[1,99],...]` → `[1,104], ...`); fixed by hand before any suite run read it.
- `checkEntryTiers.ts`'s Tier-3 cost block is TEMPLATED off the Tier-2 finding ("3x ONE of the seven,
  Measured live, session 112", silver rotation text) — it asserts the Tier-2 charge shape for gold
  without any Tier-3 measurement. The instrument prints a hypothesis as fact.
- `doctor.ts` still suggests `--juiced-index=2` in its "ready" banner.

---

## Verbose: Vengeance model search

Candidate compositions scored over the 29 armed damage exchanges (victim not evading):

```
29/29  V first (x1.25 floor), then Weak, then Vuln, then block
29/29  flat +floor(x/4)          (identical to the above for integers)
27/29  single floor over the combined product
26/29  Weak first, then V
 0/29  no Vengeance effect
```

Trigger census over every exchange whose player had picked Vengeance
(before-status, after-status, outcome from the holder's side, took HP, dealt):

```
 51 before=- after=- outcome=0  took=Y dealt=Y
 33 before=- after=- outcome=1  took=N dealt=Y
  3 before=- after=- outcome=0  took=N dealt=Y
 32 before=- after=25 outcome=-1 took=Y dealt=N
  2 before=- after=25 outcome=-1 took=N dealt=N   <- armed without HP damage: trigger is the LOSS
 14 before=25 after=25 outcome=-1 took=Y dealt=N  <- holds, no stacking
 16 before=25 after=- outcome=1  took=N dealt=Y   <- consumed
 13 before=25 after=- outcome=0  took=Y dealt=Y   <- consumed on a tie too
```

The one val1-15 pickup (run-2026-08-20-22-46-26, state-088) was followed by
outcomes 0, 1, 0, 0 and the run ended — it never lost, so it never armed.

## Verbose: pin pass
Rounds: an initial JSON-reporter pass (71 failures after the retired-tier test
fix), four automatic patch rounds anchored on the matcher column, and hand edits
for: OBSERVED_OFFERS (+38, generated from boonPickups, multiset-diffed), the
loadout census (+50/21, +58/14), KNOWN_CRIT_ANOMALIES (+1, base 8), the Wall-1
clean room-1 options (+Heal, +UpgradePaper, +UpgradeScissor), Heal rooms (+6, 8,
9, 1, 10), three toMatchObject sites, four ratio pins (both halves), the oil-cast
docId list (+13403226), two next-line toBeCloseTo arguments, and the redraw
shadow in-sample constant ("2.3" -> "2.2"). Sweep: 175 lines carry a
`[session 130, day 20708]` annotation; 0 of them are byte-identical to a
removed line once the annotation is stripped.

Two failures were NOT pinned, because the population was wrong rather than the
number: procEffectSize's tenacity test (evadeProc0 co-fire) and the fish-HP
interval upper edge (a genuine tightening, 19/12 -> 25/16).

## Carry-forward, by name
1. blockedMove answered, wiring falsified — now 23 procs, next-exchange p ≈ 0.0067; collection only.
2. Rod dungeon stat line — still 50/17 on 924, untested.
3. nextPosition registry gap — still open.
4. cards.json Golkan 8/10 — still open.
5. A brief's prediction about its own tests can be backwards — no instance this session.
6. Pin in-session — done, 175 sites, green.
7. Patcher traps — respected; two NEW patcher traps recorded in Dead ends.
8. Consecutive captures are not consecutive exchanges — respected (Exchange loader used throughout).
9. $TMPDIR differs by sandbox mode — avoided via the scratchpad path.
10. settings.local.json ask block — still present, listed in STATE.
11. Other dungeons out of scope; rotation measured for SILVER only; web/ untouched; §0a not lifted.
