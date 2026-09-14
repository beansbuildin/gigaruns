# STATE — session 131 — 2026-09-14 — commit 675b13df (work commit b4bff5ad)

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
