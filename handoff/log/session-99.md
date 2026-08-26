# STATE — session 99 — 2026-08-26 (PT) — code at commit 7d1bbdcf

## Status
Brief items **§1, §2, §3, §4: ALL DONE. GATE PASS.** All four dungeon runs the
brief budgeted were run, each on its own explicit user go-ahead.

Suite **1967 passed / 1967, 107 files**. `tsc --noEmit` clean,
`git diff --check` clean, secret scan **0 hits on all four patterns**,
`discoveredShipsClean` 8/8.

**Live spend: 2 fishing casts, 4 juiced dungeon runs, 360 energy, 0 oils.**
Both daily ledgers are now EXHAUSTED — fishing 20/20, dungeon 12/12.

Per item: §1 done (**the deck changed, and a standing doc claim was false**);
§2 done (**1 of 2, uninformative and said so**); §3 done (**verdict:
CONSISTENT but UNDERPOWERED**); §4 done (**4 of 4 runs, 4 deaths**).

## What works
- **§1 — the rod is GOLKAN (812)**, swapped 2026-08-26T02:27:20Z. Confirmed on
  BOTH halves rule 9 demands: `/offchain/static` grants
  `[74,80,81,84,85,86,87,88,89,90]`, and both live casts opened on exactly that
  prefix with 812 in `GEAR_CID_array` and 811 gone. `rodDeck.ts` repointed.
- **§2 — 2 casts, 1 caught**, halted on `cast_cap`, the intended exit.
  `SESSION_99_LIMITS` (castCap 2) is the one batch shape in `oilBatch.ts` whose
  number is set BY the ledger rather than in spite of it.
- **§3 — `scripts/redrawShadowAnalysis.ts` is new**, with
  `tests/fishing/redrawShadowAnalysis.test.ts` pinning its exact statistics.
  Re-runnable as volume accumulates, per the brief.
- **§4 — 4 juiced Tier-3 runs**, 214 POSTs, **0 first-attempt failures across
  every action class in all four runs**. Rule 8 held (`TIER-CHECK ... OK`).
- **`LossIntuitionUp` is now MODELLED** (latent), first-ever pickup.
  `UNMODELLED_TYPES` 19 → 18.

## What's broken
- ⚠ **`rodDeck.ts`'s "nothing here can SEE durability" was FALSE, and was false
  when written.** `GET /gear/instances/{address}` carries **`DURABILITY_CID`**
  on every row — Shroom (811) reads 0 (it ran dry), Golkan (812) reads 40.
  Three sessions reconstructed durability from dealt decks while the server
  published it directly. This is the session-70 mistake one endpoint over
  (`/gear/items` vs `/offchain/static`). **Corrected in the file. Nothing
  CONSUMES it yet — that is a wiring job and is unclaimed.**
- ⚠ **The 0.85 necessity gate STILL has never been observed live.** 0 oils
  consumed across the batch, so it got **zero opportunities** — not "held
  nothing". Third consecutive batch without a single-lethal turn.
- ⚠ **`tests/rejectionAudit.test.ts`'s numeric-arm assertion was CHANGED**, and
  a reader should know it was a re-expression, not a relaxation. It read
  `Math.max(numeric) < 2500` and went red on ONE `scissor` POST at 3810ms
  (1 of 1308; next slowest 2259ms; first attempt, and it SUCCEEDED). A max over
  an ever-growing machine-local log corpus fails eventually for reasons
  unrelated to what it checks. It now asserts the median `< 2500` and the share
  at/above the 3600ms pacing floor `< 1%` — **strictly more sensitive** to the
  actual failure mode, since a leak is a floor affecting ~all POSTs, which a
  max could pass.
- **Session 98's STATE.md mislabelled an n.** Its opening-focus-spend figure
  "0.83 [0.69, 0.97] at n=119" is n=**114**; 119 belonged to the 0.82 line.
  Both are +2 now (116 / 121). Values unmoved.
- Carried, untouched: H2's proc model still blocked (`TASKS.md` CAPTURE-1);
  §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED**.

## Corrections to SPEC.md
- **None this session.** `SPEC.md` and `SPEC-fishing.md` untouched — nothing in
  any live response contradicted either.
- The corrections that DID happen are to REPO DOCS, and the durability one is
  significant: `src/sim/fishing/rodDeck.ts` now records that `DURABILITY_CID`
  exists on `/gear/instances/{address}`, and carries a new SHROOM/GOLKAN BREAK
  section.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Do not read the Shroom→Golkan swap as a big break. It is a TIER change, not
  a geometry change.** The decks are positionally IDENTICAL — same ten hit-zone
  sets, same mana cost on all ten, card 74 literally shared. Golkan is Shroom
  one tier better (+1 hit on the six row/column cards, +2 on the diamond, +1
  crit on the centre). Card 89 is the ONLY regression: miss −4 vs 76's −3.
  **Geometry-keyed numbers transfer; damage-keyed ones do not.**
- **Do NOT re-bless a pin that moved because `REAL_DECK` repointed.** Six
  assertions did, and they are tests comparing a SIM arm against a
  CORPUS-derived quantity — correct only while the two decks coincided. New
  **`CORPUS_DECK`** names the deck the corpus was actually played on; all six
  pins stayed byte-identical. Widening those tolerances, or re-blessing them to
  Golkan values, would both have destroyed a working cross-check.
- **Do not ask the redraw shadow to close §28's GAP 1 — at ANY volume.** The
  two `FISH_MOVED` readings differ only on a turn a redraw actually happened,
  and a shadow never redraws. `redraw_sent` rows on this machine: 0.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED; `castSim` suspended for
  this fishery; §48 closed `DEFAULT_FOCUS_RESERVE_WEIGHT`.

## Metrics
- **Fishing: 2 casts, 1 caught = 50.0%, exact 95% CI [1.3%, 98.7%]** — spans
  essentially the whole interval; Fisher vs session 98's 6/9 gives **p = 1.0**.
  0 oils consumed. Corpus 208 → **210** casts.
- **Opening focus spend: 0.83 [0.69, 0.97] at n=116** (and 0.82 at n=121 on the
  other boundary) — **unmoved**.
- **§3 shadow: out-of-sample 6 fires / 170 decisions = 3.53% [1.31%, 7.52%]**
  against an in-sample **3.07%**. Exact binomial **p = 0.6545, NOT REJECTED**.
  **MDE at 80% power = 2.38x**; ~**350** decisions (~7 more batches) needed for
  80% power at a 2x departure. 12 turns reached no card decision. 0 sanity rows.
- **Dungeon: 4 runs, 4 deaths, 0 clears** — rooms 5, 5, 10, 7.
  **Hard Core 24384, Dendren Root 1278, 240 energy, 214 POSTs, 0 first-attempt
  failures.** Room 10 **ties** the deepest death on record (it stood at 1).
- Corpus now 79 dungeon attempts / 210 fishing casts. 23 new boon offers.
- **Oils held: 35 Relaxing (937), 0 Focus (942)** — unchanged, none spent.

## Open questions for Claude
1. **`DURABILITY_CID` is readable and nothing reads it.** The rod's remaining
   durability is now a forward-looking number (Golkan: 40 at equip, and 2 casts
   have been played on it). Wiring it into `liveFishing.ts`'s preflight would
   make the base-deck window PREDICTABLE instead of detectable-after-the-fact,
   which is what sessions 89–91 spent three sessions reconstructing. Worth a
   small task? It is unclaimed and nobody has scoped it.
2. **Should `CORPUS_DECK` be repointed, and when?** It is Shroom and the corpus
   is 210 casts of which **2** are Golkan. The stated rule is to repoint when
   the ratio inverts and re-bless the affected pins in one deliberate pass. That
   is a long way off at 2 casts per batch — but every damage-keyed sim number is
   describing the OLD rod until it happens. Is there a threshold you want?
3. **`triggeredBoons` was EMPTY on every recorded state of a full 4-run day.**
   It is the field that would evidence a boon proc, and it never populated once
   across 214 POSTs. Either it does not populate on this capture path, or no
   boon triggered at all. **Settling which is far cheaper than CAPTURE-1's
   five-stat model, and it gates it** — a proc-evidence channel that silently
   never fires would make CAPTURE-1 unreachable by ordinary play, however many
   runs are spent.
4. **The 0.85 gate has now gone three batches with zero opportunities.** §50
   ruled against shaping a batch toward `fishHp <= 2` to observe it. That ruling
   stands and is not being reopened — but at 2 casts/day the natural arrival
   rate is very low, and it is worth knowing whether you want it left
   indefinitely unobserved.
5. **Dungeon depth is where the opponent model is weakest.** At room 10 it
   reported `uniform-below-floor n=5 confidence=low` — the deepest,
   highest-stakes decisions run on the thinnest data, and that compounds
   because a death there forfeits the most accumulated Hard Core.

## Files changed
```
 6 commits (this recap makes 7). 4 dungeon-run + 2 fishing-cast fixture dirs.

  A  scripts/redrawShadowAnalysis.ts        +250  §3's instrument
  A  tests/fishing/redrawShadowAnalysis.test.ts +120  its exact statistics
  M  src/sim/fishing/rodDeck.ts             +150  Golkan, CORPUS_DECK, DURABILITY_CID
  M  src/sim/boons.ts                       +60   LossIntuitionUp + 23 offers
  M  src/strategy/fishing/oilBatch.ts       +37   SESSION_99_LIMITS
  M  scripts/liveFishing.ts                 +20   cap + in-sample constant
  M  QUESTIONS.md                           +110  §51
  M  tests/rejectionAudit.test.ts           +30   numeric arm re-expressed
  M  tests/boons.test.ts, tests/enemies.test.ts   dungeon pins
  M  tests/fishing/{castEra,matcherHeadroom,oilReachability,redrawCounterfactual,
       zoneTemplate,damageEconomy,fishMaxHp,focusMovement}.test.ts,
     tests/sim/fishingCorpus.test.ts        corpus pins re-blessed, 208 -> 210
```

---

# VERBOSE APPENDIX — session 99

## §1 — the deck check, in full

### What was read, and in what order

The brief said to check `GEAR_CID_array` "on the first live response". The
fishing STATE doc turned out to be the WRONG instrument for this, and the
reason is worth recording: `GET /fishing/state/{address}` returns the last
cast's doc, which at session start was **session 98's final cast**
(`createdAt 2026-08-26T01:51:27Z`) — i.e. a PRE-SWAP snapshot listing 811 and
no 812. Reading it as current would have concluded the rod had NOT changed.

The equipment endpoint is the one that answers this:

```
GET /gear/instances/{address}     161 rows
  GearInstance#811_1787332895_d777fbaa  GAME_ITEM_ID_CID 811
      DURABILITY_CID 0    EQUIPPED_TO_SLOT_CID -1   updatedAt 2026-08-26T02:27:20.834Z
  GearInstance#812_1787690500_766077e9  GAME_ITEM_ID_CID 812
      DURABILITY_CID 40   EQUIPPED_TO_SLOT_CID 14   updatedAt 2026-08-26T02:27:20.836Z
```

Both `updatedAt` stamps are the same 2026-08-26T02:27:20Z — that is the swap,
2ms apart, and it is **after** session 98's last cast at 01:51Z, exactly as
QUESTIONS.md §47 said.

### `/offchain/static` — all eight rods re-read, not just the new one

```
  49  Wood Rod          [2,4,5,6,7,8,9,10,32,34]
  50  Stone Rod         [2,5,7,8,9,10,32,34,35,37]
 336  Phin's Rod        [2,5,7,8,9,10,28,31,38,52]
 811  Shroom Rod        [1,2,3,4,5,6,74,75,76,78]      SAME as recorded
 812  Golkan Rod        [74,80,81,84,85,86,87,88,89,90]  <- THE NEW ONE
 922  Makeshift Rod     [1,2,3,4,5,6,7,76,77,79]       SAME as recorded
 923  Dendren Rod       [91,92,93,94,95,96,97,98,99,100]
 924  Puppeteer's Rod   [101,...,110]
```

Neither previously-recorded grant had drifted.

### PLAY confirmed it — both casts

```
cast-2026-08-26-02-49-20  prefix10 [74,80,81,84,85,86,87,88,89,90]  rods [50, 812]
cast-2026-08-26-02-49-35  prefix10 [74,80,81,84,85,86,87,88,89,90]  rods [50, 812]
```

Session 89's falsification (a rod being equipped ≠ its grant being dealt) is
why this second half was required rather than inferred.

### The deck comparison — the finding that makes this a SOFT break

```
  zones            Shroom            Golkan          delta
  [1,2,3]          1  (+5/-3)        80 (+6/-3)      hit +1
  [4,5,6]          2  (+5/-3)        81 (+6/-3)      hit +1
  [7,8,9]          3  (+5/-3)        84 (+6/-3)      hit +1
  [1,4,7]          4  (+5/-3)        85 (+6/-3)      hit +1
  [2,5,8]          5  (+5/-3)        86 (+6/-3)      hit +1
  [3,6,9]          6  (+5/-3)        87 (+6/-3)      hit +1
  [1,3,7,9]        74 (+7/-4)        74 (+7/-4)      SAME CARD
  [2,4,6,8]        75 (+6/-4)        88 (+8/-4)      hit +2
  ring (8 cells)   76 (+3/-3)        89 (+4/-4)      hit +1, MISS -1
  centre crit      78 (crit+11/-3)   90 (crit+12/-3) crit +1
```

All ten Golkan cards were already in `fixtures/fishing-casts/cards.json`
(captured 2026-08-15), so no card metadata capture was needed.

### The durability correction

`rodDeck.ts` had asserted: *"No durability, charge, or uses-remaining field
exists in the fixtures or the live doc shape... The account owner is the only
durability sensor that exists."* `DURABILITY_CID` is right there on
`/gear/instances/{address}`. The file's own §"Why a CONSTANT and not a per-cast
read" warns that a constant can go stale silently; this is the same failure
applied to a FIELD rather than a value — a field absent from the payloads the
repo happens to record was treated as nonexistent.

## §2 — the batch

```
cast 1: turns 0-3, cards 37/41/40/74, escaped after 4 turns
cast 2: turns 0-4, cards 87/80/86/85/88, CAUGHT after 5 turns
        loot offer (12,15,8) -> chose 8
BATCH HALT (cast_cap) — 2 of 2 completed. 0 oils consumed.
energy 232 -> 208. ledger 20/20.
```

Note cast 1 played 37/41/40 — LOOT cards, not grant cards. The grant is only
visible in `fullDeck`'s prefix, which is why the deck check reads the prefix
rather than the cards played.

Statistics, computed exactly (Clopper-Pearson, Fisher):
```
session 99  1/2  = 50.0%  exact 95% CI [ 1.3%, 98.7%]
session 98  6/9  = 66.7%  exact 95% CI [29.9%, 92.5%]
session 96  3/10 = 30.0%  exact 95% CI [ 6.7%, 65.2%]
Fisher exact, 99 vs 98:  p = 1.0
```

## §3 — the shadow analysis, full output

```
OUT-OF-SAMPLE (logs/)    6 fires / 170 card decisions = 3.53%
IN-SAMPLE (fixtures/)   17 fires / 553 plays          = 3.07%
turns reaching NO card decision: 12
redraw_sent rows: 0        sanity/error rows: 0

per batch:
  fishing-2026-08-24-19-16-38.jsonl   0/ 52   0.00%
  fishing-2026-08-24-22-33-43.jsonl   4/ 24  16.67%
  fishing-2026-08-25-02-20-17.jsonl   0/  2   0.00%
  fishing-2026-08-25-18-53-45.jsonl   0/ 43   0.00%
  fishing-2026-08-26-01-49-02.jsonl   2/ 40   5.00%
  fishing-2026-08-26-02-49-17.jsonl   0/  9   0.00%   <- this session

exact 95% CI [1.31%, 7.52%]
power at n=170 vs p0=3.07%:
  1.5x (4.61%)  26.06%
    2x (6.15%)  60.27%
    3x (9.22%)  95.69%
    5x (15.4%) 100.00%
MDE at 80% power: 2.38x
n for 80% power at 2x: ~350  (~7 more batches)
two-sided exact binomial: p = 0.6545  NOT REJECTED
```

⚠ **Denominator trap.** `grep -c redraw_shadow logs/*.jsonl` gives **214**, not
170, because `redraw_shadow_no_decision` shares the prefix. A turn with no card
decision has no redraw decision to shadow.

## §4 — the four runs

```
run 25096969  death @ room  5  HC 4800  Root 141  60e  46 POSTs  41 decisions
run 25097040  death @ room  5  HC 3696  Root 141  60e  42 POSTs  37 decisions
run 25097325  death @ room 10  HC 9792  Root 687  60e  78 POSTs  63 decisions
run 25097664  death @ room  7  HC 6096  Root 309  60e  47 POSTs  38 decisions
────────────────────────────────────────────────────────────────────────────
              4 deaths, 0 clears  HC 24384  Root 1278  240e  214 POSTs
              0 first-attempt failures in ANY action class, all four runs
              179 of 179 decisions EV-unsupported (expected under rule 8)
```

`dayProgressEntities` after each: 3, 6, 9, 12 — verified on the server after
every run, per CLAUDE.md rule 13. The day is exhausted.

Energy: the pool read 40 before run 4 against a 60-energy cost, and the ROM
preflight claimed it up to 287 without intervention (rule 12's point exactly).

### The `LossIntuitionUp` capture

Whole-object recursive diff, `state-023.json` → `state-024.json` of
`run-2026-08-26-03-12-54`, on BOTH players:

```
player[0]: ONLY `pickedBoons` differs (this boon's own append).
           health, shield, rock/paper/scissor, evasion, block, lck, tenacity,
           intuition, statusEffects, activeEffects, triggeredBoons, gearBoons,
           focusBuffs — all byte-identical.
player[1]: NO field differs at all.
```

Followed for the rest of the run:
```
31 combat rounds after the pickup
intuition stayed {current: 0, starting: 0} on EVERY recorded state
triggeredBoons EMPTY on every recorded state of the whole run
```

Modelled `latent` from n=1 **by explicit user directive in-session**, the same
call made in session 95 for three types. `UNMODELLED_TYPES` 19 → 18; no type
moved in.

## The re-blessing, attributed

45 assertions moved on the fishing side. The two causes were separated by
re-running the suite with `CURRENT_ROD` temporarily held at Shroom:

```
  with CURRENT_ROD = SHROOM (corpus growth only):  41 failures
  with CURRENT_ROD = GOLKAN (both causes):         45 failures
  difference:                                       6 = the repoint
  (and the repoint FIXES 2 rodDeck ratchet failures, hence 39 net corpus pins)
```

The 6 repoint failures were in `damageEconomy` (1), `fishMaxHp` (2),
`focusMovement` (3) — all three build a SIM arm from `[...REAL_DECK]` and
compare it against a corpus-derived quantity. `damageEconomy`'s `meanHeal` gap
hit **0.765** against a 0.5 tolerance, which is almost exactly the +1 hit every
Golkan row/column card carries. The tests were correctly detecting a comparison
that had become invalid. `CORPUS_DECK` fixed all six with **zero pin changes**.

A further 5 failures appeared on the DUNGEON side only after the four runs —
caught because the final suite run was made against the final commit rather
than trusting the mid-session green (CLAUDE.md working style). They were:
`boons.test.ts` ×4 (OBSERVED_OFFERS +23, roomOne 207→219, clean set +3 counts,
healRooms +2, plus the LossIntuitionUp model) and `enemies.test.ts` ×1 (new
loadout combo `54/40`, mid-run in the room-10 run, NOT a new starting loadout —
the start is still 40/22).

`OBSERVED_OFFERS` was appended by **multiset difference** against the corpus
rather than by hand: 23 new, **0 stale**, so nothing already in the table was
invalidated.
