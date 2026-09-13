# STATE — session 130 — 2026-09-13 — commit 67fa2953

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
