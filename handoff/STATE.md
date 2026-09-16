# STATE — session 133 — 2026-09-16 — commit 7761feb4

## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data. Worked
`handoff/next.md`'s session-133 brief, which was CURRENT (written 09-16T00:29Z).

**⭐ GATE PASS — all three parts.**
1. **Session 132 RECOVERED.** Its captures and code were committed (`e2500a76`),
   `log/session-132.md` was written, and all nine scratch-only findings were
   promoted into DECISIONS and SPEC.
2. **Live day 20711 spent in full.** Four juiced Tier-3 runs (12/12 run-units,
   0/259 first-attempt failures) and 20 casts on Golkan (812). **Fourth gold
   point measured.**
3. **Suite: red → GREEN.** 79 failed / 2826 at the first run, then **2826/2826**
   on the final tree (see log). It took about 9 full-suite passes plus per-file
   loops. `tsc --noEmit` exit 0.

**⚠ Order deviated from the brief, deliberately.** The brief said to do the
offline recovery before any live arm. At 16:41Z only 78 minutes of the day were
left. So: session 132's captures were committed first, the user authorized the
day, the day ran, and the pin pass came after the last cast (the session-131
lesson). No finding was at risk; the scratch file was committed at 16:43Z.

**ONE authorization covered the session, given in chat at 16:43Z:** *"4 T3 runs
+ 20 casts"* (an AskUserQuestion option the user selected).

**JWT:** exp 2026-09-20T16:32:40Z, 95.8h left at 16:42Z. `doctor.ts` now prints
the absolute exp (session 132's fix, committed this session).

**⚠ DUNGEON ARM HALTED FOR REPAIR:** 640 and 901 both reached **0** after run 4,
the day's last run. The next dungeon day needs both repaired first.

## Settled — do not re-open
Pointers only. `DECISIONS.md` and `QUESTIONS.md` own the evidence. **[USER]** = a
user directive an agent may not re-open at all.

**Dropped this session — TWO**, each now enforced elsewhere:
- **"cards.json holds 8 of Golkan's 10"** — retired in DECISIONS, and no brief
  has re-raised it.
- **"Deck arithmetic has not predicted catch rate"** — folded into the
  Golkan-slice entry below and its DECISIONS line.

- ⭐ **[USER] THE ROD IS GOLKAN (812).** 2026-09-14, standing. Re-opens as:
  *"re-derive a drift table to argue for Puppeteer"*, *"swap back to 924/923"*,
  *"the sim says Dendren beats Golkan"*.
- ⭐ **[NEW] THE GOLKAN SLICE IS 812-ONLY: 173/287 = 60.3%.** 192/327 was an
  811+812 pool (card 74 is shared) and is RETIRED. `deckOf` is fixed and pinned
  (DECISIONS 2026-09-16). Re-opens as: *"Golkan cumulative 58.7%"*, *"add 74 back
  to GOLKAN_IDS"*.
- ⭐ **[USER] FISHING STOPS ONLY ON A BROKEN ROD.** Cap = min(rod, ledger,
  authorized). CLAUDE.md rule 11. Re-opens as: *"size castCap to the slot-15
  gear"*.
- ⭐ **[UPDATED] GOLD ROTATION: FOUR POINTS, FOUR DISTINCT FACTIONS.**
  - The points: dow 2 → 248 Foxglove, 3 → 247 Archon, 4 → 249 Summoner,
    5 → 245 Overseer.
  - Charge shape **16/16**.
  - An unmeasured dow (6, 7, 1) must charge one of {243 Chobo, 244 Crusader,
    246 Athena}; a measured dow should repeat its faction.
  - Re-opens as: *"predict the next gold faction by a step rule"*, *"gold =
    silver shifted"*.
- ⭐ **[NEW] `--resume-existing` COSTS NO RUN-UNIT; gear debits at `start_run`.**
  DECISIONS 2026-09-15. Re-opens as: *"an interrupted run burned 3 units"*.
- ⭐ **[NEW] SLOT-6 204 IS NOT A WEAR PIECE.** The wear set is 640/641/901/905.
  Re-opens as: *"204 at 4 is a halt risk"*.
- ⭐ **[NEW] "Intuition quarters damage" and the Weak "exceptions" are
  Weak/Vengeance.**
  - All 89 quartered exchanges have the attacker under Weak.
  - Both Vengeance-armed Weak misses reproduce under `vengeanceDamage`.
  - DECISIONS 2026-09-16. Re-opens as: *"intuition has a mitigation arm"*,
    *"the Weak rule has unexplained misses"*.
- ⭐ **THE FISHING ROD CARRIES NO DUNGEON STAT LINE.** Re-opens as: *"swap to
  923 to test the rod stat line"*.
- ⭐ **DENDREN ROOT (846) IS A FUNCTION OF THE DEATH ROOM** — now 15/15 at Tier 3,
  plus room 5 → 141 (SPEC §3c). Re-opens as: *"compare 846 totals across
  days/tiers"*.
- ⭐ **`blockedMove`'s WIRING IS FALSIFIED.**
  - 39 procs: current 12/39 (P≈0.44), next 4/39 (P≈0.0009).
  - 4 counterexamples to a hard exclusion.
  - Re-opens as: *"wire blockedMove in"*.
- ⚠ **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT — NINTH session.** The rod was
  feared near 0 and read 44; 905 was 2 and read 24. Read `checkGear.ts` live.
  Re-opens as: *"the rod is probably broken"*.
- ⭐ **[USER] RING BALANCES ARE NOT A CONSTRAINT.** Still read all fourteen
  before and after every run. Re-opens as: *"the gold runway is a concern"*.
- **[USER] THE DUNGEON GEAR HALT** — never abort a run; after a completed run,
  any piece at 0 stops that arm; item 50 (slot 8) is grandfathered.
- **[USER] OTHER DUNGEONS OUT OF SCOPE.** **[USER] fishing budget 360 energy / 30
  casts.** **[USER] Tier-1/Tier-3 income baseline RETIRED BY NAME.**
- ⚠ **PIN AFTER THE DAY'S LAST CAST.** This session did, and it took a single
  pass (no redo). Re-opens as: *"pin before the second batch"*.

## What works
- **`liveRun.ts --juiced --juiced-index=3` ×4 in ~32 min.**
  - Actions 53/71/62/73, 0 first-attempt failures.
  - The dry-run printed `index 3`; energy was covered without a ROM claim.
- **Gear landed exactly on the pre-registered −3/run path at every read:**
  640 9/6/3/0, 641 45/42/39/36, 905 21/18/15/12, 901 9/6/3/0.
- **`liveFishing.ts --oil-batch`** (`SESSION_132_LIMITS`, castCap 12), then
  `--casts=8`.
  - Both batches exited rc 0.
  - The rod lost exactly 1 per played cast.
- **Payout summing off `post_response` `gameItemBalanceChanges`.** Re-validated
  by reproducing all five of session 132's per-log figures before use.
- **The pin patcher family (scratchpad, not committed):**
  - **Parsing:** each pass parses every failure before writing, handling
    `toBe`, `toBeCloseTo` (precision-aware), `toHaveLength`, numeric-array
    `toEqual` and `toMatchObject` diffs.
  - **Refusals:** it refuses to write when an anchor isn't unique.
  - **Safety:** `tests/` was snapshotted first.
- **`checkEntryTiers.ts`** prints all four gold points and the remaining set.
  **`redrawDeckSlice.ts`** prints a separate Shroom row.

## What's broken
- ⛔ **Dungeon gear 640 and 901 are at 0.** The dungeon arm is halted until both
  are repaired (user action).
- ⚠ **Rod 812 is at 24.** Fishing is not halted; the next cap is min(24, 20,
  authorized) = 20.
- ⚠ **`checkGear.ts`'s DUNGEON HALT banner still fires permanently on item 50**
  (slot 8, grandfathered).
- ⚠ **`factionDayRunway` + `tests/entryTierRunway.test.ts` KEPT, not deleted.**
  CLAUDE.md rule 11 names that test as the guard against the retired "30 runs /
  7.5 days" figure coming back. Deleting it is a CLAUDE.md edit and belongs to
  the user or a brief.
- ⚠ **The inserter wrote into two single-line arrays and broke syntax** (boons
  heal rooms; oilReachability ×2). This was caught by the parse error and fixed
  by hand, and the suite is green. The tool bug is not fixed.
- ⚠ **THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE.** It is
  the user's edit; mentioned once.
- **`web/`** is untouched since session 120.

## Corrections to SPEC.md
- **§3c, 846 table:** added **5 → 141** (session 132), and per-room identity is
  15/15.
- **§3c, gold rotation:** "One gold day is observed; the rotation is unknown" is
  stale. It now records four days and the silver+109 id mapping. Fixed in
  SPEC.md.
- **The brief** said `doctor.ts` doesn't print JWT expiry. Session 132 had
  already fixed that, uncommitted. The brief's claim "all seven gold ids are now
  known" was true but not new: `checkEntryTiers.ts` `FACTIONS` already encoded
  +109.
- **The brief** feared rod 812 was "at or near 0". It read 24 → 2 across session
  132, then 44 at this open (repaired out of band).
- **Resolved IDs:** forbiddenWoods=5, dendren nodeId="5"/pondId=2 (unchanged).
- **Move charges:** ABSENT for rings on the wire (unchanged since session 112).

## Dead ends
- **Don't let the list inserter touch a single-line array.** Its end-of-array
  detection mis-fires and it inserts after `]);`. Inline those by hand.
- **Diff parsing must skip the `+ Received` header line**, or it becomes a
  context-less hunk.
- **A `startswith` anchor is not unique in `redrawCounterfactual.test.ts`.** The
  same `all3.rescues - all3.sacrifices` pin sits in three tests; all three move
  together.
- **`$TMPDIR` differs between sandboxed and unsandboxed commands.** Write
  cross-mode scratch output to the scratchpad path.
- **Carried from earlier sessions:**
  - Never end a background loop with `[ $rc -ne 0 ] && break`.
  - Never let a patcher write full precision into `toBeCloseTo(x, 1)`.
  - Never read consecutive captures as consecutive exchanges.
  - `loadCorpus()` drops `data.events`.
  - Ratio pins need both halves moved.
  - §0a NOT lifted: **+19.40pp and +17.74pp MAY NOT BE QUOTED.**
  - Don't reproduce −0.389.

## Metrics
- **Dungeon, live:** day **20711 (dow 5)**, 4 juiced Tier-3 runs, 12/12 units,
  16:55Z → 17:27Z. Death rooms **8 / 11 / 9 / 8**.
- **Hard Core:** 7,776 / 11,232 / 8,784 / 7,584 = **35,376** → 982.7/room =
  **×2.01** Tier 2's 490 (band PASS). Pooled Tier-3 over four days: 145,968 / 151
  rooms = 966.7/room, ×1.97.
- **Dendren Root:** 420 / 840 / 546 / 420, per-room identity 4/4.
- **Gold:** Overseer 25 → 22 → … → 13. The other six (Foxglove 19, Crusader 25,
  Archon 28, Athena 35, Summoner 36, Chobo 44) were unchanged, and silver held
  at **159** at every read.
- **Fishing, live day 20711:**
  - **20 played / 17 charged**; 12/20 = **60.0%** caught (7/12, then 5/8).
  - 3 oils; rod 44 → 32 → 24.
- **Fishing, session 132 (scored this session):** 22 played / 20 charged,
  14/22 = 63.6%; rod 24 → 2.
- **Rod slices:** **812 173/287 = 60.3%**; 811 45/82 = 54.9%; 923 54/104 =
  51.9%; 924 11/27 = 40.7%; 922 21/82 = 25.6%.
- **§71 margins (reported only, [USER] HOLD), 626 traces:** pooled −9, Shroom
  +12, 812 −22, Dendren −3.
- **Suite:** **2826/2826** (was 2752). Corpus: **161 dungeon attempts, 626
  fishing casts**.
- **Other counts:**
  - `OBSERVED_OFFERS` 850 → 919.
  - `KNOWN_CRIT_ANOMALIES` 21 → 26, fish-HP interval unchanged at
    [1.500, 1.5625).
  - Loadout census +6 (50/37, 58/19, 58/21, 64/11, 64/14, 78/27) — not chased.

## Open questions for Claude
1. ⭐ **Fifth gold point.** Tomorrow is dow 6. Under the permutation it must be
   one of {Chobo, Crusader, Athena} — pre-register the SET. A repeat of any of
   the four measured factions kills the permutation. **640 and 901 must be
   repaired first.**
2. ⭐ **WeakeningEvade is held at n=1** (latent at pickup, fixed val1 4). Model
   it as latent by directive (the LossBlockUp precedent), or keep holding?
3. **Loadout census +6 combos** this session. Worth one chase, as session 131
   did for 74/24?
4. **Delete `factionDayRunway` and its test?** That needs a CLAUDE.md rule 11
   edit, because the test is named there as a guard.

## Files changed
Work spans commits `e2500a76` (session 132 captures + code), `ccb2c206`
(pre-registration), `c627bc06` (day captures + `deckOf`) and the closeout commit.

```
 fixtures/dungeon-runs/**              9 run captures (2 dry-runs) — sessions 132+133
 fixtures/fishing-casts/**             42 cast captures — sessions 132+133
 scripts/redrawDeckSlice.ts            deckOf: 812-exclusive ids, Shroom slice
 scripts/checkEntryTiers.ts            four gold points printed
 scripts/doctor.ts                     absolute JWT exp (session 132)
 scripts/liveFishing.ts                SESSION_132_LIMITS; in-sample 2.1 -> 2.2
 src/strategy/fishing/oilBatch.ts      +SESSION_132_LIMITS
 src/sim/boons.ts                      OBSERVED_OFFERS 850 -> 919
 tests/**                              ~20 files — pin pass; +deckOfSlice.test.ts;
                                       procEffectSize/statusEffects explanations pinned
 SPEC.md                               §3c 846 room 5, gold rotation four days
 handoff/{STATE,DECISIONS,scratch-session-133,log/session-132,log/session-133}.md
```
