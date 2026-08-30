# session 110 — 2026-08-29/30 — fishing Hard Core instrumentation + a 22-cast day — GATE PASS (both parts)

Brief: `handoff/next.md` (session-110), fishing only. **No dungeon work was
authorized and none was done** — the dungeon ledger was already 12/12 from
session 109.

Everything in `handoff/STATE.md` for session 110, plus the verbose material.

---

## 0. The brief's hypothesis was wrong, and the corpus won

The brief's Step 0 said fishing's Hard Core credit was a fixed **320**, from
the single session-15/16 data point (cast 12925773, fish Zombo, `{id:845,
amount:320}`). It asked me to "check across the full backfilled corpus rather
than assuming either", which is the right instruction and is what caught it.

**Measured over all 120 caught casts in the pre-batch corpus, the amount tracks
FISH RARITY:**

```
  rarity 0 -> 80     Barnaboo, Finley, Plankton
  rarity 1 -> 160    Kelpkin, Jelloid, Ollie
  rarity 2 -> 320    Skinzy, Zombo, Deadfin
  rarity 3 -> 400    Podge, Globbo, Gulp, Glimmer
  rarity 4 -> 480    Chompus, Slo_mo
```

The session-15/16 data point is a rarity-2 fish at exactly its base. It was
never evidence of a constant; it was one rung of a ladder.

**On top of the ladder, 12 of those 120 paid an exact 2x or 4x multiple** with
nothing on the response distinguishing them:

```
  date        fish       rarity  paid   xbase  consumablesUsed
  2026-08-21  Barnaboo   0        160    2x    1
  2026-08-22  Finley     0        160    2x    0
  2026-08-24  Finley     0        320    4x    2
  2026-08-24  Ollie      1        320    2x    3
  2026-08-24  Barnaboo   0        320    4x    1
  2026-08-24  Plankton   0        160    2x    0
  2026-08-25  Barnaboo   0        160    2x    0
  2026-08-27  Kelpkin    1        320    2x    0
  2026-08-27  Ollie      1        320    2x    2
  2026-08-27  Finley     0        320    4x    0
  2026-08-27  Barnaboo   0        160    2x    2
  2026-08-28  Zombo      2       1280    4x    0
```

**Ruled out as the driver: oils.** `consumablesUsed` takes 0, 1, 2 and 3 across
the twelve, and 0 on five of them. **Ruled out as an era change:** the non-1x
cases are absent before 2026-08-21 (0 of 14 catches) and 12 of 106 after, which
is not separable from a flat ~10% rate at that n. `IS_JUICED_CID` is `true` on
all 273 casts, so it cannot be that either. No field on the doc named anything
like a multiplier.

### 0a. Two wire shapes a naive implementation gets wrong

**The credit does not land on the response the grouping logic calls terminal.**
Across the corpus it arrives on:

```
  "Cards played successfully."   68
  "Item used successfully."      52
```

The second is a turn that spent an oil and landed the kill in the same action.
A lookup keyed on `completeCid`, or on one `message` string, silently drops one
of these two populations. `summarizeFishingCast` therefore SUMS over the cast's
responses — and `tests/sim/fishingReport.test.ts` has a `splitCredit` fixture
that fails a lookup-shaped implementation.

Note also that `"Item used successfully."` is not in `classifyMessage`'s three
known strings, so those responses classify as `kind: "unknown"`. That is
pre-existing and correct per CLAUDE.md §2 (don't invent meaning for an
unconfirmed shape) — it is recorded here because it is surprising, not because
it is broken.

**The zero for an escaped cast is measured, not a convention.** 152 escaped and
1 incomplete cast credit nothing; all 120 caught casts credit exactly one 845
entry each. `n845 per cast` is `{0: 153, 1: 120}` — never 2.

### 0b. What was actually built

Mirroring the dungeon side rather than inventing a second pattern:

- `src/sim/fishingCorpus.ts` carries the wire's top-level
  `gameItemBalanceChanges` verbatim on each response — same field, same
  placement, same `WireItemBalanceChange` type as `CorpusState` on the dungeon
  side. **No item id is interpreted in the loader.**
- `src/sim/fishingReport.ts` is the layer that knows 845 means Hard Core, and
  it **imports `ITEM_HARD_CORE` from `dungeonReport.ts`** rather than
  re-declaring the constant, so the two halves of the report cannot drift.
- `FishingRollup` gained `totalHardCore` and `hardCorePerCatch`. The markdown
  prints **both** the per-catch and the per-cast mean, because they differ
  whenever anything escaped and either could otherwise be quoted as the other.

Backfill needed **no new spend** — the data was already in committed fixtures.
Cross-checked against an independent Python aggregation over the same tree;
both give **19,520 / 120 catches / 162.7 per catch / 71.5 per cast**.

### 0c. The numbers the user asked for by name

| population | casts | caught | Hard Core | per catch | per cast |
|---|---|---|---|---|---|
| **session 102** (2026-08-26 PT) | 20 | 14 | **2,560** | 182.9 | 128.0 |
| **session 105** (2026-08-28 PT) | 21 | 14 | **3,360** | 240.0 | 160.0 |
| full corpus, pre-batch | 273 | 120 | 19,520 | 162.7 | 71.5 |
| full corpus, post-batch | 288 | 129 | **22,160** | 171.8 | 76.9 |

**The brief dated session 102 to 2026-08-25. It is 2026-08-26 PT** — the log
header and the fixtures agree. The "14 caught" identifier the brief gave is
what disambiguated it. Sessions were mapped to casts by converting each cast's
earliest server-stamped `updatedAt` to PT; the resulting per-day cast and catch
counts reproduce every session log's own figures exactly, which is what
validates the mapping.

### 0d. The prose had to be derived, not written

Step 0 first shipped the ladder as a hardcoded sentence in
`buildFishingMarkdown` — "measured across all 120 caught casts ... 12 of those
120". **The batch made it stale within the same session.** It is computed from
the records now: the base for a rarity is the minimum amount observed at that
rarity, and anything above its base counts as a multiple. Two tests pin the
derivation, including one that checks the base does not move when a rarity-0
cast pays 320.

---

## 1. The batch — `--casts=15`, rod-bound

### 1a. Every axis confirmed live before sizing anything

```
GAME ledger  (dayDocs pond 2):  0 / 20        VERDICT: 20 cast(s) available
config dendren:                 300 energy / 25 casts   (raised session 107)
oils:                           allowedItemIds [937], perItemMaxPerCast {937: 2},
                                policyApproved true
rod durability (live, dry-run): rod 812 reads DURABILITY_CID 15
nextPosition override:          ARMED (no miss on record)
```

**The rod was the binding constraint, and it binds harder than it looks.** The
durability preflight runs **once, before the batch** — it is not re-checked per
cast:

```
scripts/liveFishing.ts:3568   if (rodReading.stop) throw new GuardTrip(...)
```

So a 20-cast batch on a 15-durability rod does **not** halt at cast 15. It
plays all 20 and drives the rod past 0. Sizing to the rod is the whole
safeguard, exactly as session 105 did at 18. This is now a digest entry.

### 1b. The run

```
▸ done. energy spent (guard-tracked) 180, casts 13
▸ rod durability after: 0 (before: 15, casts this batch: 13)
```

15 fixture cast directories, 15 `cast_over` events, 101 POSTs, exit 0, **0
first-attempt failures, 0 sanity rows**, no fail-closed stop.

Note the two different 13s and the one 15: the guard counter and the game
ledger both say **13 charged**, while **15 were played** and **15 durability**
was consumed. Durability tracks casts PLAYED, not charged — the same finding
session 107 made (37 → 15 over 22 played against 20 charged).

### 1c. Outcomes

| # | outcome | turns | | # | outcome | turns |
|---|---|---|---|---|---|---|
| 1 | escaped | 10 | | 9 | escaped | 4 |
| 2 | escaped | 2 | | 10 | caught | 4 |
| 3 | caught | 3 | | 11 | escaped | 10 |
| 4 | caught | 1 | | 12 | caught | 4 |
| 5 | caught | 3 | | 13 | caught | 5 |
| 6 | caught | 2 | | 14 | escaped | 5 |
| 7 | caught | 2 | | 15 | caught | 2 |
| 8 | escaped | 10 | | | | |

**9 caught / 15 = 60.0%**, 95% Wilson **[35.7%, 80.2%]**.

| population | caught/n | rate | 95% Wilson |
|---|---|---|---|
| this batch | 9/15 | 60.0% | [35.7%, 80.2%] |
| session 107 | 12/22 | 54.5% | [34.7%, 73.1%] |
| session 105 | 14/21 | 66.7% | [45.4%, 82.8%] |
| session 102 | 14/20 | 70.0% | [48.1%, 85.5%] |
| full corpus | 129/288 | 44.8% | [39.2%, 50.6%] |

The batch interval overlaps all three recent batches at every point. The
all-time corpus rate is not the right comparator (it pools the dead pre-oil
era) and is shown only for context.

### 1d. Hard Core, this batch — with the new column

**2,640 total, 293.3 per catch, 176.0 per cast.**

```
  13156406  Kelpkin    r1     640   x4
  13156408  Finley     r0      80   x1
  13156411  Barnaboo   r0      80   x1
  13156412  Deadfin    r2     320   x1
  13156415  Plankton   r0      80   x1
  13156421  Jelloid    r1     640   x4
  13156427  Plankton   r0      80   x1
  13156428  Jelloid    r1     640   x4
  13156433  Barnaboo   r0      80   x1
```

**Three of nine catches paid 4x.** Against the corpus prior of 12/120 = 10%,
P(X ≥ 3 | n=9, p=0.10) = **0.053**. Suggestive, not a finding, and notable that
all three were 4x with no 2x — the prior corpus ran 8 twos to 4 fours. Worth
watching across the next batch; not worth acting on.

### 1e. Oils — the double-lethal band did all the work

**10 Relaxing Oils (937), stock 24 → 14, 0.67/cast.** All ten went in **five
double-lethal firings** of 2 each:

```
  turn 1   fish  3/14   relaxingHeld 24   wanted [relaxing, relaxing]
  turn 4   fish  4/29   relaxingHeld 22   wanted [relaxing, relaxing]
  turn 4   fish  4/20   relaxingHeld 20   wanted [relaxing, relaxing, focus]
  turn 5   fish  3/30   relaxingHeld 18   wanted [relaxing, relaxing, focus]
  turn 2   fish  4/20   relaxingHeld 16   wanted [relaxing, relaxing]
```

- **The on-demand single-lethal trigger (fishHp ≤ 2) did not fire once.** Every
  oil this batch came from the double-lethal band, which is the user-override
  path the sim does not recommend (QUESTIONS §30).
- **The necessity gate had zero single-lethal opportunities**, so it neither
  withheld nor permitted. The live record stands at three withholds ever
  (2 in session 102, 1 in session 105), unchanged.
- **The per-cast Relaxing cap of 2 was REACHED and did not BIND**, again —
  `doubleLethalTriggers` wanted exactly two, never three.
- **23 Focus triggers were dropped as WITHDRAWN-BY-POLICY**, correctly logged
  as *"NOT a dry bag and does NOT flag the cast out of the outcome arms"*.
  **Zero `oil_trigger_no_stock`** — no cast left the outcome arms.
- The `conserve(r=0.833,f=1)` shadow arm was exercisable on 23 of 72 decision
  points and **diverged on none** (`wouldSkip: []` on all 72).

### 1f. JEBAITOR — 2 of 15 = 13.3%

`fishing_ledger_reconciled` fired 15 times; two lowered:

```
  idx  gameCasts  repoBefore  adjusted  direction
   5      3           4         yes      lowered
  13     10          11         yes      lowered
```

Against §34's ~9% and session 107's 2/22 = 9.1%. 13.3% on n=15 is entirely
consistent with both. Post-batch ledgers **agree at 13/20**.

### 1g. Post-batch rod reading

**15 → 0 over 15 casts played = exactly 1.00/cast, n=15.** Fourth confirming
batch:

| session | casts played | durability | per cast |
|---|---|---|---|
| 102 | 20 | 38 → 18 | 1.00 |
| 105 | 18 | 18 → 0 | 1.00 |
| 107 | 22 | 37 → 15 | 1.00 |
| **110** | **15** | **15 → 0** | **1.00** |

**The rod is at 0 and fishing cannot run again until the user repairs it.**
7 daily casts expire unspent at 11:00 PT.

---

## 2. The suite ratchet — 58 failures, and two of them were not pins

`+15 casts` turned the suite red exactly as session 102's `+20` did, in the
same nine files:

```
  tests/fishing/castEra.test.ts               17
  tests/fishing/redrawCounterfactual.test.ts  17
  tests/fishing/oilReachability.test.ts        9
  tests/fishing/matcherHeadroom.test.ts        5
  tests/fishing/zoneTemplate.test.ts           3
  tests/fishing/redrawShadowAnalysis.test.ts   2
  tests/sim/fishingCorpus.test.ts              2
  tests/fishing/damageEconomy.test.ts          2
  tests/fishing/stateFields.test.ts            1
```

All re-derived and green, each carrying `/* [session 110] was X */` in the
established convention. Session 102's warning that not every failure is a pin
held again — **two were not**, and both are recorded rather than absorbed:

### 2a. `damageEconomy` meanDamage crossed its bound — WIDENED, not ratcheted

`expect(LIVE.meanDamage).toBeLessThan(5.5)` measured **5.5012406947890815** —
over by 0.02%. Widened to **6.0** because the bound was crossed by a mechanism
that will keep pushing:

> The base Shroom deck is six cards at exactly 5 damage. Every card the bot
> LOOTS is drawn from a catalog whose hit amounts run 5–11
> (`fixtures/fishing-casts/cards.json`: 21 cards at 5, 15 at 6, 10 at 8, 9 at
> 7, 4 at 9, 2 at 10, 2 at 11), and the deck has grown **10 → 18 cards** over
> the corpus. Mean damage per hit therefore rises monotonically with looting,
> by construction.

This is a **magnitude band** ("~5 damage"), not a measurement. Re-deriving it
each batch would turn it into a pin that can never fail, which is the opposite
of what it is for. The right response is a bound the mechanism will not walk
through next session, plus a comment saying to check deck size before assuming
a bug. Both landed.

### 2b. `matcherHeadroom` — card 84 joined the guaranteed-miss set

The set of cards with **no on-grid footprint** went `[1, 3, 4, 6, 35]` →
`[1, 3, 4, 6, 35, 84]`. A card that cannot hit from some position is a
guaranteed miss, and `chooseNewCard` has no deck-composition term
(**TASKS.md §13, still NOT STARTED**). The test's own comment already records
session 91's instance of the bot looting a second copy of card 35 for this
reason; **this is the second observed instance of that shape.** Do not read it
as a quantified cost — read it as §13 accruing evidence.

### 2c. Other movements worth naming

- `castEra` `optimalHistogram` for `focusDry` grew a **fourth bucket, `[3, 1]`**
  — the first focusDry cast whose optimal opening spend is 3.
- `oilReachability`'s 16-cast gap gained **two** members, `13156427` and
  `13156430`, both caught oil-ended casts — the route session 107 first
  recorded, now routine rather than novel.
- `redrawCounterfactual`'s `b10.rescues - b10.sacrifices` moved 21 → 22 after
  holding across two batches; `rescues` itself moved 27 → 29 after holding
  across 43 casts.
- `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` recomputed `"3.0"` → `"2.9"` on the
  288-cast corpus.

---

## 3. Verification

```
npx tsc --noEmit                  clean
npx vitest run --maxWorkers=4     111 files, 2147 passed / 2147
git diff --check                  clean
npx tsx scripts/fishingReport.ts  288 casts
discoveredShipsClean              8/8
.gitignore                        7/7 required paths present
```

**Secret scan, with its file count proven** (session 109 found a scan that
silently read zero files and still reported "0 hits"):

```
files in session diff:            117
  [0x[a-fA-F0-9]{4,}]:              0
  [noobId\s*[0-9]]:                 0
  [eyJ]:                            0
  [PRIVATE]:                        0
POSITIVE CONTROL [docId]:         127   <- proves the scan read content
```

The positive control is the part session 109's failure argues for: a scan that
reports 0 hits and cannot demonstrate it read anything has reported nothing.

---

## 4. Surprises, collected as they happened

1. **The brief's "fixed 320" was one rung of a rarity ladder.** Third time a
   brief's factual claim has failed against the corpus (CLAUDE.md §9 predicted
   the third as expected, not exceptional).
2. **The Hard Core credit lands on `"Item used successfully."` 43% of the
   time** — a message `classifyMessage` does not know.
3. **Hardcoded report prose went stale inside one session.** The strongest
   argument for deriving it that I could have been given.
4. **The durability preflight is once-per-batch, not once-per-cast.** The
   fail-closed guard does not protect a batch that is too long for the rod;
   only sizing does.
5. **Every oil this batch came from the double-lethal override, none from the
   approved on-demand trigger.** The single-lethal condition simply never
   arose across 67 decision points.
6. **Three of nine catches paid 4x**, against a 10% base rate.

---

## 5. [session 110b] The day's closing 7 casts — rod repaired, cap reached

The user repaired the rod between the two halves and authorized the remaining
7 casts. Everything re-confirmed live before spending, per rule 12:

```
local now: 2026-08-30 08:03 PDT
guard day (11:00 PT rollover): 2026-08-29   hours until next reset: 2.95
GAME ledger  (dayDocs pond 2):  13 / 20     REPO ledger: 13 casts, 180 energy
ledgers agree.  VERDICT: 7 cast(s) available this guard-day.
rod durability: rod 812 reads DURABILITY_CID 40   <- repaired, was 0
· resuming today's fishing budget: 180 energy / 13 casts already spent
```

**With a 40-durability rod the binding constraint reverted to the cast cap.**
That is the same reasoning as the first half run backwards, and it is why the
batch was 7 and not more: the rod could have covered 40.

### 5a. The run

```
▸ rod durability after: 33 (before: 40, casts this batch: 20)
▸ done. energy spent (guard-tracked) 264, casts 20
```

(The `casts this batch: 20` is the guard's cumulative guard-day counter, which
correctly resumed at 13 — it is not this invocation's count. The durability
delta, 40 - 33 = 7, is.)

7 fixture directories, 7 `cast_over` events, 38 POSTs, exit 0, **0
first-attempt failures, 0 sanity rows.**

| # | outcome | turns | fish | Hard Core |
|---|---|---|---|---|
| 1 | caught | 1 | Finley (r0) | 80 |
| 2 | caught | 2 | Plankton (r0) | 80 |
| 3 | caught | 1 | Ollie (r1) | 160 |
| 4 | escaped | 4 | — | 0 |
| 5 | escaped | 9 | — | 0 |
| 6 | caught | 2 | Plankton (r0) | **160 (x2)** |
| 7 | caught | 3 | Ollie (r1) | 160 |

**5/7 = 71.4%**, 95% Wilson [35.9%, 91.8%]. **640 Hard Core**, 128.0 per catch.
One 2x multiple (a rarity-0 Plankton at 160).

### 5b. No JEBAITOR this half — and that resolves the first half's rate

All seven `fishing_ledger_reconciled` events read `agreed`; `gameCasts` walked
13 → 19 in lockstep with `repoCastsBefore`. **7 played, 7 charged.**

So the day is **2 procs in 22 casts = 9.1%**, against the first half's
apparent 13.3% on n=15. That lands exactly on §34's ~9% and on session 107's
own 2/22. **The first half's 13.3% was small-n noise, not a rising rate** —
worth recording because a reader seeing only the first batch would have had a
mildly alarming number.

### 5c. Oils — the override did all the work again, and that is now a finding

Two double-lethal firings, 2 oils each, **4 Relaxing**, stock **23 → 19**:

```
  fish 4/16, relaxingHeld 23   -> fish 2/16 -> fish 0/16   CAUGHT
  fish 3/15, relaxingHeld 21   -> fish 1/15 -> fish 0/15   CAUGHT
```

**Stock read 23 at the start of this half against 14 at the end of the last
one.** The user crafted 9 more between the two. Recorded because the number
moved without the bot moving it.

**Across the whole day — 22 casts, 7 firings, 14 oils — the approved on-demand
single-lethal trigger (`fishHp <= 2`) fired ZERO times.** Every oil came from
the double-lethal band, which is the user override of QUESTIONS §30 that the
sim does not recommend. The approved policy is not broken; its condition simply
never arose, because the double-lethal band at `fishHp <= 4` intercepts the
board first and kills the fish before it can reach 2. That is a structural
relationship, not a coincidence, and it means **the oil arm's outcome data is
measuring the override rather than the policy the user approved under rule 4.**
Raised as open question 1.

### 5d. Guard-day totals, both halves

| | played | charged | caught | rate | Hard Core | oils | energy |
|---|---|---|---|---|---|---|---|
| batch 1 | 15 | 13 | 9 | 60.0% | 2,640 | 10 | 180 |
| batch 2 | 7 | 7 | 5 | 71.4% | 640 | 4 | 84 |
| **day** | **22** | **20** | **14** | **63.6%** | **3,280** | **14** | **264** |

Day catch rate 95% Wilson **[43.0%, 80.3%]**. Energy 264 of the 300 budget.
**Ledgers agree at 20/20 — the day is fully spent.**

### 5e. The second ratchet — 56 more assertions

Same nine files, same convention (`/* [session 110b] was X */`). Two movements
worth naming beyond the counts:

- **`castEra`'s focusDry "whole meter on move one" tell moved 2 → 3.** It had
  held at 2 since session 92, when its single reappearance was called an
  isolated cast. It is now three. Still small, but it is no longer a lone
  event and the next batch should be watched.
- **`redrawCounterfactual`'s threshold-6 band recorded a RESCUE**, not another
  wasted firing — `rescues` 10 → 11 against `wasted` unchanged at 6. The
  previous three batches had moved only `fires` and `wasted`.

### 5f. Verification, re-run against the final commit

```
npx tsc --noEmit                  clean
npx vitest run --maxWorkers=4     111 files, 2147 passed / 2147
git diff --check                  clean
secret scan (50 staged files)     0/4, positive control 104 'docId' hits
```
