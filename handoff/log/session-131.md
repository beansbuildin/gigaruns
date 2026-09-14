# session 131 — 2026-09-14 — Golkan revert, second gold point, 20 Golkan casts — GATE PASS

## Recap (mirrors handoff/STATE.md at this commit)
## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data. The
session worked `handoff/next.md`'s session-131 brief, which was CURRENT.

**⭐ GATE PASS. The full live day was spent, the brief's work list was done, and
the suite was left GREEN** — **2752 passed / 2752, exit 0** (117 files,
unsandboxed, `--maxWorkers=4`), `tsc --noEmit` exit 0. (Final-tree re-run and
the closeout checks are quoted in the session log.)

**Dungeon: PASS — 12/12 run-units, 4 juiced TIER-3 runs, 265 actions, 0/265
first-attempt failures.** Pre-registered in `8a273d55` before the first
`start_run`. **Second gold point: day 20709 (dow 3) → 247 ARCHON Gold.** Not
Foxglove (permutation survives); the shifted-silver candidate (Summoner) FAILED.
**Fishing: PASS — 20 played / 17 charged on GOLKAN (812), two batches of 10**,
each pre-registered, each a clean `cast_cap` exit.

**JWT:** exp **2026-09-20T16:32:40Z**, **144.6h** left at 15:57Z. Did not bind;
the day did (rollover 18:00Z; last cast 17:56Z).

**ONE authorization covered the session, given in chat** (~16:05Z, *"Golkan yes:
4 T3 + 20 Casts"*), which also CONFIRMED the brief's quoted Golkan directive.
Batch 2 ran on *"resume fishing"* after an out-of-band repair. A mid-batch
*"run up to 15 casts"* arrived after batch 2 had started at 10 and was not
actionable (gear halt as it then stood, 3 casts left, 4 min to rollover).

**⭐ NEW [USER] RULE at session end:** *"pass a new rule for fishing that it
should only stop if the Rod is broken, the two lure slots are not a major
impact."* Recorded in CLAUDE.md rule 11, DECISIONS, and `checkGear.ts`.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **[USER]** =
a user directive an agent may not re-open at all.

**Dropped this session — FIVE**, each now enforced elsewhere: **ENTRY TIER IS 3**
(CLAUDE.md rule 11 + `dungeonArmClosed.test.ts`); **Vengeance IS MODELLED**
(29/29 + 164/164 pins fail if reverted); **APPROVAL IS PER SESSION** and **THE
ORCHESTRATOR'S DUNGEON ARM STAYS CLOSED** (both CLAUDE.md rule 11); the **`hpMax`
51→50 coincides with the rod swap** entry (ANSWERED — merged into the rod entry).

- ⭐ **[USER] [NEW] THE ROD IS GOLKAN (812).** 2026-09-14, standing.
  `CURRENT_ROD = GOLKAN_ROD`. DECISIONS 2026-09-14. Re-opens as: *"re-derive a
  drift table to argue for Puppeteer"*, *"swap back to 924/923"*.
- ⭐ **[USER] [NEW] FISHING STOPS ONLY ON A BROKEN ROD.** Slot-15 lures at 0 do
  NOT halt fishing or size the batch; cap = min(rod, ledger, authorized). Dungeon
  arm's any-piece halt unchanged. CLAUDE.md rule 11. Re-opens as: *"size castCap
  to the slot-15 gear"*, *"the lure at 0 halts fishing"*.
- ⭐ **[NEW] GOLD ROTATION: TWO POINTS, NOT THE SILVER MAP, NOT SILVER-SHIFTED.**
  dow 2 → Foxglove 248; dow 3 → Archon 247. Shape (one faction × 3) **8/8**.
  Re-opens as: *"gold = silver shifted by one day"*, *"predict today's gold
  faction"* — pre-register a SET that excludes both measured factions.
- ⭐ **[NEW] THE FISHING ROD CARRIES NO DUNGEON STAT LINE.** Golkan openings
  50/17, rock 26 ×4 — same as on 924. Cause of the 51→50 drop unknown.
  Re-opens as: *"swap to 923 to test the rod stat line"*.
- ⭐ **[NEW] DECK ARITHMETIC HAS NOT PREDICTED LIVE CATCH RATE — TWICE.** No
  mechanism fitted. Re-opens as: *"Puppeteer dominates at every aim level"*,
  *"the sim says Dendren beats Golkan"*.
- ⭐ **[NEW] "cards.json holds 8 of Golkan's 10 cards" was FALSE.** 10/10 present,
  0.400 exactly; −0.389 retired, source unknown. Re-opens as: *"add cards 82/83
  to the fixture"*, *"Golkan's drift is −0.389"*.
- ⭐ **DENDREN ROOT (846) IS A FUNCTION OF THE DEATH ROOM.** Now 8/8 per-room
  matches across two Tier-3 days (SPEC §3c table). Re-opens as: *"compare 846
  totals across days/tiers"*.
- ⭐ **`blockedMove`'s WIRING IS FALSIFIED.** Now **27 procs**: current **8/27**
  vs 9.01 (P≈0.43), next **2/27** vs 9.01 (P≈0.0018). Soft prior, 2
  counterexamples. Consumed nowhere. Re-opens as: *"wire blockedMove in"*,
  *"commission runs for blockedMove"*.
- ⚠ **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT — SEVENTH session, and repairs
  now land MID-SESSION too.** Read `checkGear.ts` at open AND before each batch.
  Re-opens as: *"raise these repairs up front"*.
- ⭐ **[USER] RING BALANCES ARE NOT A CONSTRAINT** — 2026-09-11. The runway line
  is now DELETED from `checkEntryTiers.ts`. ✅ Still read ALL FOURTEEN before and
  after every run. Re-opens as: *"the gold runway is a concern"*.
- **[USER] THE DUNGEON GEAR HALT: never abort a run; after a COMPLETED run any
  dungeon piece at 0 stops that arm; pieces at 0 at session open are
  GRANDFATHERED (item 50, slot 8).** Re-opens as: *"item 50 halts the arm"*.
- **[USER] OTHER DUNGEONS ON THIS ACCOUNT ARE OUT OF SCOPE.** Ledger per-dungeon.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.**
- **[USER] The Tier-1/Tier-3 whole-run income baseline is RETIRED BY NAME.**
  Re-opens as: *"design a cross-tier income experiment"*.
- ⚠ **PIN IN-SESSION.** 190 annotated sites this session, green same-session.
  Re-opens as: *"defer the pin pass"*.

## What works
- **`liveRun.ts --juiced --juiced-index=3` ×4 in ~21 min** — 73/46/74/72 actions,
  0 first-attempt failures; dry-run printed `index 3`.
- **Every dungeon gear reading landed EXACTLY on the pre-registered −3/run path**
  (640 33/30/27/24, 641 9/6/3/0, 901 9/6/3/0, 905 23/20/17/14).
- **`liveFishing.ts --oil-batch` at `SESSION_131_LIMITS.castCap 10`**, twice,
  clean `cast_cap` exits; rod −1.00/played cast both batches (44→34→24).
- **Payout summing off `gameItemBalanceChanges`** — re-validated against session
  130's 41,904 before use.
- **Pin patcher that parses every failure and refuses to write on one
  unanchored literal** — 8 rounds, 0 bad writes; `tests/` snapshotted first.
- **`checkEntryTiers.ts`** prints both gold points and no runway; **`checkGear.ts`**
  prints a per-arm verdict (fishing off slot 14 only).

## What's broken
- ⚠ **Rod 812 is at 24.** Under the new rule it is the only fishing gate; the
  next batch caps at min(24, ledger 20, authorized). Slot-15 954 …83b834fd at 0,
  …ac25b641 at 10 — no longer halting.
- ⚠ **`checkGear.ts`'s DUNGEON HALT banner still fires permanently on
  grandfathered item 50** (slot 8). Read which slot; it is not an arm halt.
- ⚠ **`factionDayRunway` is exported and tested but printed by nothing** since
  the runway line was deleted. Dead code kept to avoid churning its test.
- ⚠ **`doctor.ts` does not print JWT expiry** (the brief said to verify it
  there); decoded `exp` from the token file instead.
- ⚠ **The game fishing ledger lagged the repo ledger by one mid-session** (8 vs 9
  after batch 1); converged at 17/17 after batch 2. Not a rule-13 event.
- ⚠ **THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE.** Did not
  block anything. The user's edit.
- **The `web/` front end** is untouched since session 120.

## Corrections to SPEC.md
- None to SPEC.md this session: the §3c 846-by-room table held 4/4 and the gold
  charge shape held. The gold faction list is in DECISIONS, not SPEC (a rotation
  is not yet a spec claim at n=2).
- **The brief** said `doctor.ts` reports JWT expiry — it does not.
- **STATE 129/130** said cards.json holds 8 of Golkan's 10 cards — false; retired.
- **The brief's gear table** was stale in 2 of 7 rows at open (905 0→26, slot-15
  0→20), and 641/901/slot-15 changed again mid-session (641 0→60, a new 901
  instance …37fba31e at 24, slot-15 …ac25b641 0→20).
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: **ABSENT** for rings on the wire — unchanged since session 112.

## Dead ends
- **Do not end a background loop with `[ $rc -ne 0 ] && break`** — the task
  reports exit 1 on a clean run. Read each run's own exit line.
- **Do not let a blanket patcher write `toBeCloseTo(x, 1)` sites** — it writes
  full precision into a 1-digit pin; round those by hand.
- **The vitest JSON reporter carries no diff** for arrays/objects — use the
  default reporter to read received values.
- **A re-pin pass started before the day's LAST batch will have to be redone** —
  batch 2 landed mid-pass and moved 62 pins again. Pin after all casts.
- **Do not reproduce −0.389 again** — grant list, 80–89 and 74+80–88 all miss.
- Carried: never positional `awk` on ring balances; never read consecutive
  captures as consecutive EXCHANGES; `loadCorpus()` drops `data.events`; ratio
  pins need BOTH halves; §0a NOT lifted — **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Metrics
- **Dungeon, live:** day **20709 (dow 3)**, 4 juiced Tier-3 runs, 12/12 run-units,
  240 energy, 16:54Z → ~17:21Z. Death rooms **9 / 6 / 10 / 11**.
- **Hard Core 8,448 / 5,424 / 8,976 / 10,848 = 33,696** → 936/room = **×1.91**
  Tier 2's 490 (band [1.6, 2.4] PASS). Pooled Tier-3, two days: 75,600 / 78
  rooms = 969/room, ×1.98.
- **Dendren Root 546 / 216 / 687 / 840 = 2,289**, per-room identity 4/4.
- **Gold: Archon 40 → 37 → 34 → 31 → 28**; Foxglove 19, Overseer 25, Crusader 25,
  Athena 35, Chobo 44, Summoner 48 unchanged. **Silver 159 unchanged** at every
  read.
- **Opening loadout on Golkan: hpMax 50, armor 17, rock ATK 26 — ×4.**
- **Fishing, live: 20 PLAYED / 17 CHARGED**, 240 energy, 2 Relaxing (19 → 17).
  Batch 1 **5/10**, batch 2 **4/10** = **9/20 = 45.0%**. **Golkan cumulative
  192/327 = 58.7%** — arithmetic on the carried 183/307 + 9/20, NOT recomputed
  from the corpus this session; post-Puppeteer era. Other slices
  unchanged: Puppeteer 11/27 = 40.7%, Dendren 54/104 = 51.9%.
- **Fish-HP interval unchanged [1.500, 1.5625)**; `KNOWN_CRIT_ANOMALIES` 20 → 21
  (Golkan card 86, 6 → 9).
- Suite **2752/2752** (was 2718). Corpus **153 dungeon attempts** (was 149),
  **584 fishing casts** (was 564). `OBSERVED_OFFERS` **818 → 850**. Loadout
  census +3 (74/21, 74/24, 74/27 — AddMaxHealth(24), a new size).

## Open questions for Claude
1. ⭐ **Third gold point.** Measured: dow 2 → Foxglove, dow 3 → Archon. Under a
   7-permutation, the next Tier-3 day must charge NEITHER. Pre-register the
   five-faction SET; n=2 still separates nothing about order.
2. ⭐ **Fishing batch size under the new rule.** Rod 812 at 24 is now the only
   gear term. With a fresh 20-cast ledger the cap is 20 unless the user
   authorizes fewer; a batch must never exceed rod durability (the dry-rod
   BASE_DECK hazard). Does the user want the rod repaired before the next day?
3. ⚠ **What dropped hpMax 51→50 / rock ATK 27→26 on 2026-09-12?** Not the rod.
   Low priority; nothing currently tests it.
4. ⚠ **Delete `factionDayRunway` and `tests/entryTierRunway.test.ts`?** Nothing
   prints it any more. Cleanup, not a decision the user needs to make.

## Files changed
Work commit `b4bff5ad` plus pre-registration commits `8a273d55`, `c3a29c3b`,
`b36f1eaf`, and this recap (CLAUDE.md rule 11, `checkGear.ts` per-arm verdict,
DECISIONS):

```
 fixtures/dungeon-runs/**                558 files — 4 run captures (+1 dry-run)
 fixtures/fishing-casts/**               122 files — 20 cast captures
 src/sim/fishing/rodDeck.ts              CURRENT_ROD 924 -> 812
 src/strategy/fishing/oilBatch.ts        +SESSION_131_LIMITS (castCap 10)
 scripts/liveFishing.ts                  -> SESSION_131_LIMITS; +nextPosition/nextMovePath known; in-sample 2.2 -> 2.1
 scripts/checkEntryTiers.ts              runway line deleted; two gold points printed
 scripts/checkGear.ts                    per-arm verdict; fishing reads the rod only [USER]
 src/sim/boons.ts                        OBSERVED_OFFERS 818 -> 850
 tests/**                                24 files — pin pass (190 sites) + slice-aware / deck-explicit fixes
 CLAUDE.md                               rule 11: fishing stops only on a broken rod [USER]
 handoff/{STATE,DECISIONS,scratch-session-131,log/session-131}.md, handoff/reports/*
```

## Verbose: scratch file, verbatim

# scratch — session 131 — 2026-09-14

## Session open (read live, 15:57Z)
- JWT exp **2026-09-20T16:32:40Z**, **144.6h** left — does NOT bind; the day does (rollover 18:00Z, ~2.0h).
- Game day **20709, dow 3**. Run-units **0/12** (`dayProgressEntities` null). Fishing **0/20** (both ledgers agree).
- Tier 3 offered, `dropMultiplier 4`. **Gold 236**: Foxglove 248 **19**, Overseer 245 25, Crusader 244 25,
  Athena 246 35, Archon 247 40, Chobo 243 44, Summoner 249 48 — matches brief claim B exactly.
- **Silver 159**: Athena 9, Archon 12, Crusader 15, Chobo 18, Summoner 30, Foxglove 33, Overseer 42 — matches C.
- Gear LIVE (brief's table stale again — SEVENTH session): 640 36, 641 12, 901 12, **905 26** (was 0 — repaired),
  **rod slot 14 = 812 Golkan at 44** (already equipped by the user before the session),
  slot-15 954 …83b834fd **20** (was 0 — repaired), 954 …ac25b641 **10**. Item 50 slot 8 at 0, grandfathered.
- **[USER] in chat, 2026-09-14 ~16:05Z: "Golkan yes: 4 T3 + 20 Casts"** — confirms the Golkan (812) rod
  directive the brief quoted AND authorizes this session: 4 juiced Tier-3 runs + 20 casts.
  **20 casts is NOT reachable on current gear** — the 954 at 10 wears −1/played cast and halts the arm at 10.
  Said so to the user at the top: batch 1 = 10, then halt → hand back for repair → resume on a fresh read.

## PRE-REGISTRATION — dungeon arm (committed before the first start_run)

1. **GOLD — the SECOND gold-rotation point. Day 20709, dow 3.**
   - H1 (shape): exactly ONE gold id moves per run, by exactly −3; six gold untouched. Tier-3 shape count 4/4 → 8/8.
   - **H2 (permutation falsifier, the sharp test): the charged faction is NOT Foxglove 248.** A second Foxglove
     charge (19 → 16 → 13 → 10 → 7) kills "gold is a 7-permutation of dow" outright.
   - Predicted SET under H2: {243 Chobo, 244 Crusader, 245 Overseer, 246 Athena, 247 Archon, 249 Summoner}.
   - **Named candidate H3 (one of many, not a favourite): "gold = silver shifted by one day" → dow 3 = silver dow 4
     = Summoner Gold 249: 48 → 45 → 42 → 39 → 36.** Expected because it is the only named map that fits the one
     observed point; its prior is barely above 1/6 — a miss is not surprising, a hit is not a solve (n=2).
   - If the day rolls to 20710 before a run starts (it should not — ~2h slack), falsifier stays "not Foxglove"
     and H3 becomes Chobo 243.
2. **SILVER untouched: all seven identical before and after every run (159).** Any silver move is a finding.
3. **Hard Core (845) — RATIO, not total.** Tier-2 reference 490 HC/room. Prediction: Tier-3 HC-per-room ÷ 490
   ∈ **[1.6, 2.4]**, centre **2.04** (session 130's measurement). Also: every per-run 845 amount divides by 48.
4. **Dendren Root (846) — per DEATH ROOM, never totals.** Each run's 846 equals the SPEC §3c table for its
   death room: 6→216, 7→309, 8→420, 9→546, 10→687, 11→840, 12→1005, 13→1179, 14→1362. Falsified by any
   mismatch at a tabled room. Rooms outside 6–14 are new table entries, not tests.
5. **The rod stat line — opening loadout on Golkan.** Session 129/130 openings on rod 924: hpMax **50**,
   Sword (rock) ATK **26**, armorMax 17. Pre-2026-09-12 on rod 923: **51/27**.
   - H-rod: the unbooned `state-000` of run 1 reads **hpMax 51, rock ATK 27** (armor 17) → the fishing rod
     carries a DUNGEON stat line (924 subtracts 1/1 relative to 812/923).
   - Null: reads **50/26** → the 51→50 coincidence was not the rod.
   - Anything else (e.g. a third reading) → record, assert no cause.
6. **Gear path at −3/run on 640/641/901/905:**
   | after run | 640 | 641 | 901 | 905 |
   |---|---|---|---|---|
   | 1 | 33 | 9 | 9 | 23 |
   | 2 | 30 | 6 | 6 | 20 |
   | 3 | 27 | 3 | 3 | 17 |
   | 4 | 24 | **0 ← break** | **0 ← break** | 14 |
   641 and 901 break at the END of run 4, the last authorized run; the dungeon arm halts after it, costs nothing.
7. Run-units 0 → 3 → 6 → 9 → 12.

## Dungeon arm — raw result (read live after each run; scored at recap)
- Runs exit 0 ×4, actions 73/46/74/72 = **265, 0/265 first-attempt failures**; run-units 12/12.
- **Gold: Archon 247 40 → 37 → 34 → 31 → 28** (−3 ×4). Six gold untouched. **All seven silver untouched (159).**
  H1 PASS (shape 8/8). **H2 PASS — not Foxglove; the permutation survives.** **H3 (Summoner) FAILED.**
- Gear exact on every reading: 640 33/30/27/24, 641 9/6/3/**0**, 901 9/6/3/**0**, 905 23/20/17/14. Dungeon arm HALTED
  (641 + 901 at 0 after the last authorized run — cost nothing).
- The batch loop's own exit 1 was the trailing `[ $rc -ne 0 ] && break` test, not a run failure.

### Dungeon arm — SCORED
| run | dungeon run id | death room | 845 | 845/48 | 846 | SPEC §3c 846 for room |
|---|---|---|---|---|---|---|
| 1 | 25578265 | 9 | 8,448 | 176 | 546 | 546 ✅ |
| 2 | (17-04-24 log) | 6 | 5,424 | 113 | 216 | 216 ✅ |
| 3 | (17-07-44 log) | 10 | 8,976 | 187 | 687 | 687 ✅ |
| 4 | (17-12-40 log) | 11 | 10,848 | 226 | 840 | 840 ✅ |
- Method validated first: the same `gameItemBalanceChanges` summer reproduces session 130's **41,904** exactly.
- **845: 33,696 over 36 rooms = 936/room → ÷490 = ×1.91. PASS** ([1.6, 2.4], centre 2.04). Every amount ÷48 exact — PASS.
- **846: 4/4 per-room identity PASS** (rooms 6/9/10/11 all tabled). Total 2,289 — NOT compared (depth-confounded).
- **Rod stat line: NULL.** Every opening on Golkan 812 reads **hpMax 50, armor 17, rock ATK 26** (×4) — the same as on
  924. The rod does NOT carry a dungeon stat line; the 51→50 / 27→26 coincidence with the 923→924 swap was NOT the rod.
  (Cause of the −1/−1 still unknown; 923 itself untested, but 812 ≠ 924 is now shown irrelevant.)

## PRE-REGISTRATION — fishing arm (committed before the first cast)
1. `CURRENT_ROD` repointed 924 → **812** BEFORE the first cast (preflight needs it). `rodDeck.test.ts`
   "CURRENT_ROD is that rod" expected **RED now, GREEN after the first recorded Golkan cast.**
2. The first cast is dealt Golkan's grant `[74,80,81,84,85,86,87,88,89,90]` (not BASE_DECK, not Puppeteer's).
3. Batch `SESSION_131_LIMITS.castCap 10` — bound by GEAR (slot-15 …ac25b641 at 10). **Played 10.** Charged ≤ 10,
   reported separately.
4. Gear path: slot-15 …83b834fd 20 → **10**, …ac25b641 10 → **0 ← fishing arm halts**; rod 812 44 → **34**.
5. Catch rate — CONTINUATION of Golkan 183/307 = 59.6%. Expected ~6/10; 90% binomial band **3–9**.
   **≤ 2 caught is a flag** (P ≈ 1.2% at 59.6%) that the post-era Golkan arm diverges. n=10 settles nothing else.
6. Oils Relaxing-only (19 held); Focus triggers log policy-withdrawn.
7. After the halt: stop, hand back for the slot-15 repair; casts 11–20 only on a fresh gear read.

## Fishing batch 1 — raw result
- 10 PLAYED; GAME ledger **8/20** vs repo guard **9** charged — disagree by one, both recorded. Caught **5/10**
  (casts 1,2,3,5,10). Golkan continuation **188/317 = 59.3%**. In band (3–9) PASS; no divergence flag.
- Gear exact: slot-15 …83b834fd 20→10, …ac25b641 10→**0** (arm halted), rod 44→34 (−1.00/played cast). 1 Relaxing (19→18).
- The UNKNOWN FIELD lines in this batch came from the process that loaded liveFishing.ts before the registry edit.

## PRE-REGISTRATION — fishing batch 2 (committed before its first cast)
- **[USER] "resume fishing"** in chat ~17:36Z, after an out-of-band repair; covered by the session's 20-cast scope.
- Fresh read 17:36:55Z: slot-15 …83b834fd **10**, …ac25b641 **20** (repaired 0→20); rod 812 **34**; ledger 8/20
  (12 left). ALSO repaired/changed out of band: **641 0→60**, and slot 13's 901 is a NEW INSTANCE (…37fba31e) at 24.
- Binding cap = min(gear 10, authorization remainder 10, ledger 12, rod 34) = **10** — `SESSION_131_LIMITS` unchanged.
- Gear path: …83b834fd 10→**0 (halt)**, …ac25b641 20→10, rod 34→24.
- Catch: same band 3–9 of 10; ≤2 flags. Rollover 18:00Z is ~23 min out; a batch took ~3.5 min.

## Fishing batch 2 — raw result
- 10 PLAYED, **4 caught** (casts 1,2,4,6). Golkan continuation **192/327 = 58.7%**. In band PASS.
- Ledgers now AGREE at **17/20** (game 8→17, repo 9→17): the batch-1 8-vs-9 gap closed — the game ledger lagged one
  cast. Session total: **20 played / 17 charged**.
- Gear exact: …83b834fd 10→**0 (halt)**, …ac25b641 20→10, rod 34→24.
- **[USER] mid-batch "run up to 15 casts, ledger shows 12/20 left"** arrived AFTER batch 2 had started at castCap 10.
  Not actionable: gear halt (…83b834fd at 0), 3 left on the ledger, rollover 18:00Z at 17:56Z. Handed back.

## Offline findings so far
- **Golkan card coverage: the "8 of 10 (82, 83 absent)" claim is FALSE.** All ten of `ROD_CARD_GRANTS[812]` are in
  `cards.json`; E[fish-HP delta per play] at random aim computes **0.400 exactly** = the session-129 brief's figure.
  82/83 are not Golkan cards. −0.389 is not reproduced by the grant list, by 80–89, or by 74+80–88 — its source is
  unknown and it is RETIRED. The two numbers were never a deck-coverage discrepancy.

## Pin pass
- Suite after the live work: 72 failed (batch 1), then 62 after batch 2 landed mid-pass. Snapshot of `tests/` taken
  first (scratchpad). Patcher parses EVERY failure and refuses to write if any literal is unanchored; a second-round
  hit on a pin already carrying a session-131 annotation replaces the value and keeps the original "was".
- Hand edits: OBSERVED_OFFERS +32 (generated, multiset 32/0), loadout census +3 (chased), KNOWN_CRIT_ANOMALIES +1,
  Wall-1 clean +Heal +UpgradeRock, Heal rooms +1,+4, oil docIds +13419650 +13419927, gap set +13419933, four ratio
  pins with BOTH halves, redraw in-sample "2.2" → "2.1", toMatchObject ×7, arrays ×8, procEffectSize slice-aware,
  redrawTrigger deck-explicit, rodDurability Golkan default case. 190 `[session 131, day 20709]` annotations.
- **GREEN: 2752/2752, 117 files.**

## Surprises log
- `doctor.ts` does not print JWT expiry any more (brief says "verify with doctor.ts"); decoded `exp` directly.
- 812 was already equipped at session open — the brief's step 1 ("the user equips 812") landed out of band.
- Gear repaired/changed out of band MID-SESSION, between the batches: 641 0→60, a NEW 901 instance (…37fba31e) at 24,
  slot-15 …ac25b641 0→20. The dungeon arm is therefore NOT halted at close on 641; the old 901 (…492d8277) left slot 13.
- The batch loop's trailing `[ $rc -ne 0 ] && break` makes the background task report exit 1 on success.
- A blanket patcher writes full precision into `toBeCloseTo(x, 1)` sites — rounded back by hand (blockedMove pct).
- The JSON reporter carries no diff for arrays/objects; the default reporter does.

## Verbose: brief recap-lead items, in the brief's order
- **Rod revert:** 812 already equipped at slot 14 at open (checkGear 15:57:26Z, durability 44). `CURRENT_ROD`
  repointed 924 → 812 in `c3a29c3b` before the first cast. `rodDeck.test.ts` was GREEN at the first suite run
  (after batch 1); the red window between repoint and first cast was not observed because no suite ran in it.
- **Opening loadout on Golkan:** 50/17, rock ATK 26 ×4 → NOT 51/27 → the rod carries no dungeon stat line.
- **Second gold point:** Archon 247, −3 ×4. Not Foxglove (H2 PASS). Shifted-map Summoner (H3 FAIL). Pre-registered set
  of six non-Foxglove factions: HIT.
- **Silver:** untouched at all five reads (open + after each run), 159. Tier-3 shape 8/8.
- **Golkan card coverage:** resolved false; STATE 129/130's entry does not appear in the new STATE; DECISIONS
  2026-09-14 retires it. (STATE 129/130 are superseded files, not edited in place.)
- **Live gear:** see scratch; fishing batch cap bound by slot-15 gear at 10 both times (under the rule as it then
  stood). At close: 640 24, 641 60, 905 14, 901 (…37fba31e) 24, rod 812 24, 954 …83b834fd 0, …ac25b641 10.
- **Authorization:** one, in chat, "Golkan yes: 4 T3 + 20 Casts"; plus "resume fishing" (batch 2) and a mid-batch
  "run up to 15 casts" not acted on.
- **Fishing:** 20 played / 17 charged; 9/20 caught; Golkan continuation 192/327 (arithmetic).
- **Small jobs:** runway line deleted; nextPosition/nextMovePath registered + test.

## Carry-forward, by name (the brief's ten)
1. Vengeance MODELLED [USER] — untouched; entry dropped from the digest (tests enforce it).
2. blockedMove wiring FALSIFIED — now 27 procs, next-exchange P≈0.0018; not commissioned, accrued for free.
3. Rod dungeon stat line — TESTED this session: NULL.
4. TieDamageReduction HELD at n=1 — no second pickup; not re-asked. `procEffectSize` clean-miss list made slice-aware
   because its run left the 20-run window.
5. Pin in-session — done, 190 annotated sites, 2752/2752.
6. Patcher traps — respected (parse-all-then-write, tests/ snapshot, both halves on 6 ratio pins, no nested was).
   Two new traps recorded in Dead ends.
7. Consecutive captures ≠ consecutive exchanges — not exercised this session.
8. $TMPDIR — avoided; scratchpad path throughout; suite and git unsandboxed.
9. settings.local.json ask block — still present; did not block.
10. Orchestrator dungeon arm CLOSED; other dungeons out of scope; income baseline retired; web/ untouched; §0a not
    lifted.

## Closeout checks, final tree (run after staging, before the recap commit)
- `npx tsx scripts/secretScan.ts` → `> secret scan — scope: tracked` · `files scanned: 19149` ·
  `> PASS — no unexplained hits, both controls healthy.`
- Addition: `--scope=diff --ref=7d962efa` → 714 files, `> PASS — no unexplained hits, both controls healthy.`
- Recap diff grep (non-fixture): `eyJ` 0, `noobId\s*\d+` 0, `PRIVATE` 0, `0x[a-fA-F0-9]{4,}` 0. No `raw/` or `.har` staged.
  `.gitignore` covers .env, *.key, data/, logs/, profiles/, fixtures/**/raw/, fixtures/**/*.har.
- `vitest run --maxWorkers=4` unsandboxed → **117 files, 2752/2752, exit 0** (read from a captured file).
- `tsc --noEmit` exit 0 · `git diff --cached --check` exit 0 · `discoveredShipsClean` 8/8.
