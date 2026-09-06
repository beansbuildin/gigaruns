# session 123 — 2026-09-05 — day-20701 dow-2 rotation MEASURED — GATE PASS

Full recap. `handoff/STATE.md` carries the same content in shorter form;
everything verbose lives here.

## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data (§13). The
session worked `handoff/next.md`'s session-123 brief, which was CURRENT.

**The gate the brief set: the day-20701 dow-2 CONFIRMATION. GATE PASS, and it
CLOSES the rotation question entirely.** Prediction committed as **`ccb5f123`**
BEFORE `start_run`; the server charged **Overseer (136), sole mover, exactly −3,
on all four runs — 54 → 51 → 48 → 45 → 42.** The dow-2 cell was the one derived
by ELIMINATION and never observed. **All seven cells are now MEASURED.**

**EVERYTHING SPENDABLE IS SPENT.** Dungeon **12/12** run-units (4 juiced Tier-2
runs). Fishing **20/20 charged, 24 played** — the server refused cast 25 for its
own cap and the guard tripped closed.

Suite **2463 passed / 2463, 116 files, exit 0**. `tsc --noEmit` clean,
`git diff --check` clean, `discoveredShipsClean` 8/8.

⚠ **Re-run the suite UNSANDBOXED** — sandbox breaks `tsx` and `git`.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        13036
  CONTROL A (read):     12638 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all rules; allowlisted hits each printed
> PASS — no unexplained hits, both controls healthy.
```

**No leaks this session** — unlike session 122, whose two prose leaks are fixed.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session:** the **`dayOfWeek` 1-indexing** and **rod-decrement
RATE** entries were already dropped in 122. Dropped now: the **`PLAYER.hpMax`
HOLDS AT 50** entry (discharged on its own condition — the head was repaired, so
it is a live pin, not a standing rule) and the **`Dungeon#3`** entry (closed by
[USER] directive; its content is deliberately not restated).

- ⭐ **[NEW] THE ROTATION IS FULLY MEASURED — all SEVEN cells, none forced.**
  dow1 Crusader(135), **dow2 Overseer(136) MEASURED day 20701**, dow3
  Foxglove(139), dow4 Summoner(140), dow5 Chobo(134), dow6 Athena(137), dow7
  Archon(138). DECISIONS 2026-09-05. Re-opens as: *"measure the rotation"*, *"the
  rotation order is unconfirmed"*, or *"the dow-2 cell is forced, not
  measured"* — that last is now wrong on its own. **Charge SHAPE 25/25.**
- ⭐ **[NEW] [USER] OTHER DUNGEONS ON THIS ACCOUNT ARE OUT OF SCOPE AND ARE NOT
  TO BE LOOKED AT.** Do not query, count, read or report another dungeon's
  counter, not even to confirm nothing changed. `checkDungeonToday.ts` now
  FILTERS to the requested dungeonId. **The one technical fact kept: the
  12-run-unit ledger is PER-DUNGEON, measured.** Re-opens as any request to
  re-check that counter.
- ⭐ **[NEW] GEAR WEAR RATE = exactly −3 per dungeon run, on exactly FOUR pieces**
  (slots 11, 12, 13×2); the other six do not move. Measured n=4. Makes a break
  FORECASTABLE. Re-opens as: *"how fast does gear wear?"*.
- ⭐ **[NEW] [USER] THE GEAR HALT: never abort a run in progress; after a
  COMPLETED run, any piece at 0 stops the session for a manual repair.**
  Pieces already at 0 when the session opens are GRANDFATHERED. Re-opens as:
  *"gate the run on a durability threshold"* or *"abort, the gear is about to
  break"*.
- ⭐ **[NEW] THE ROD IS DENDREN (923), and its geometry was NEVER unknown.**
  `/fishing/cards` (committed at `fixtures/fishing-casts/cards.json`) has ids
  91–100. The decks are **POSITIONALLY IDENTICAL** to Golkan — geometry-keyed
  numbers TRANSFER, only damage magnitude does not. `CURRENT_ROD` repointed;
  play half closed. Re-opens as: *"the Dendren geometry is unknown"* or *"a cast
  is needed to recover the hit zones"* — both false.
- ⭐ **[NEW] DENDREN IS BETTER, and the sim settled it without a live cast:**
  +3.23pp catch [2.92, 3.55], 0.6 fewer turns, n=40k/arm, identical seeds.
  **The live 45.8% (11/24) is NOT a regression — p = 0.103 against the 60.6%
  baseline.** Detecting the real 3pp effect live needs ~87 sessions. Re-opens
  as: *"is the new rod worse?"* or *"measure the rod difference live"*.
- ⭐ **[NEW] [USER] Item 50 (slot 8) is the SUPERSEDED Stone Rod — the replaced
  rod, not a repairable piece.** The session-123 fishing hold built on the
  opposite premise was lifted. Re-opens as: *"repair slot 8 before fishing"*.
- **[USER] "Different fisheries" is RETIRED AS PHRASING; the conclusion is
  unchanged** and rests on §0a's two much larger gaps (meter-out 1.0% vs 64.2%,
  catch ~70% vs 27.6%). The 4.83 pin STAYS as a convergence measure. QUESTIONS
  **§70** (renumbered from a §67 collision). Re-opens as: *"restore the `> 5`
  assertion"* or *"different fisheries"*.
- **The ARITHMETIC rotation map stays FALSIFIED.** Re-opens as: *"faction =
  dayOfWeek + 2"*.
- **The charged faction does NOT change mid-day.** Twenty same-day charges
  across five days. Re-opens as: *"does the faction rotate within a day?"*.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.**
- **[USER] The double-lethal oil override is DISABLED; Focus Oil off the
  allowlist.**
- **[USER] The Tier-1/Tier-3 whole-run income baseline is RETIRED BY NAME.**
- **A new boon type from n=1 needs a USER DIRECTIVE.** Six held. Re-opens as:
  *"model the remaining latent boons"*.
- **Evade DOMINATES crit.** Re-opens as: *"critProc's 2×ATK rule has
  exceptions"*.
- **TASKS §13's SWAP is parked on DATA, not code.**
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **Pre-registration as a git commit, three sessions running.** `ccb5f123`
  predates `start_run`. Repeat this.
- **`scripts/liveRun.ts` end to end, four times. 0/284 first-attempt action
  failures** (72 + 78 + 66 + 68).
- **`scripts/liveFishing.ts`, 24 casts** on a brand-new deck, halting cleanly on
  the server's own cap rejection.
- **`scripts/checkGear.ts` (NEW)** — full durability census; bracketing a run
  with it is what measured the wear rate.
- **`scripts/fishBatchReport.ts` (NEW)** — catch rate, species, tier, Hard Core
  from `gameItemBalanceChanges`. **Discharges session 122's instrument caveat**;
  the catch rate is no longer hand-counted.
- **The fishing guard failed closed correctly on a rod swap it had never seen**,
  with an actionable "re-equip or repoint" message and no code change.
- **Rule 13 discipline held**: every live command read back off the server ledger.

## What's broken
- ⚠ **The K=10 redraw margin COLLAPSED to zero** (b10 32, all3 32; margin
  4 → 2 → 0). The assertion session 122 nominated to catch it, caught it.
  Pinned, not relaxed. **QUESTIONS §71.** Confounded by the rod swap.
- ⚠ **The `bare`/LIVE mean-damage gap CROSSED 0.7** (0.7136). Not raised a third
  time, per its own pre-registration. **The rod swap is the answer its note
  demanded** — `bare` is `BASE_DECK` and frozen by construction.
- ⚠ **`dungeonSim`'s non-degeneracy band needed a THIRD widening** (0.95 → 0.96,
  measured 0.9520). Its own re-derive trigger (~0.97) is ~one gear step away.
- ⚠ **A documented trap was walked into**: filling `ROD_CARD_GRANTS` with all
  eight rods broke `rodDeck.test.ts` exactly as that test's comment predicted.
  Reverted; the read is preserved in a comment.
- ⚠ **The live catch rate reads 45.8%**, below the ~55% concern floor — but at
  n=24 with a deck change it is **not** separable from variance (p=0.103).
- ⚠ **`Intimidating` still cannot separate "heals its amount" from "heals a flat
  2"** — all observations remain at amount 2.

## Corrections to SPEC.md
- **`SPEC.md` was not touched and needed no change.** No live response
  contradicted it; gear durability, rod grants and card geometry are not fields
  SPEC documents.
- ⚠ **The brief was WRONG on TWO of six checkable claims.** **B FAIL** — Archon
  18→24 and Overseer 51→54 rose out of band (total **243**, not 234), which moved
  the prediction's arithmetic and makes **Athena (21) the scarcest ring, not
  Archon**. **E FAIL** — the rod was swapped, so "812 at durability 5" described
  a rod no longer equipped. A/C/D/F passed.
- ⚠ **A CORRECTION MADE MID-SESSION, recorded because the pattern is now
  three-for-three:** I claimed the Dendren geometry was unobservable without a
  dealt deck. It was in `fixtures/fishing-casts/cards.json` all along — the same
  "right endpoint is one over" error as sessions 70 and 99. **Before declaring a
  field unobservable, enumerate the endpoints this repo already has fixtures for.**
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged.

## Dead ends
- **Do not add the three legacy rods (49/50/336) to `ROD_CARD_GRANTS`** — the
  account's gear array carries Stone Rod (50) beside the active rod, so a
  complete table makes "exactly one KNOWN rod" ambiguous. Resolve by SLOT first.
- **Do not re-fit an arithmetic rotation rule.** The permutation is measured.
- **Do not lower the bare/LIVE ratio bar.** Still forbidden.
- **Do not re-hunt the advance faction-indicator field.** CLAUDE.md rule 11.
- **Do not look for the ring debit on the wire.** Read balances before/after.
- **Do not narrow the gear preflight to a dungeon-slot allowlist** from n=4.
- **Do not update corpus pins mid-session** — `OBSERVED_OFFERS` moved 560 → 562
  between two test invocations while live runs were still writing fixtures.
- **Do not run the suite sandboxed.** **Do not trust a `tail`-piped exit code.**
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Dungeon, live: 4 juiced Tier-2 runs, 12/12 run-units, 240 energy.** Deaths
  rooms **11 / 11 / 10 / 10**. Overseer 54→42, −3/run. **0/284 first-attempt
  action failures.** Hard Core **20,208**, Dendren Root **3,054**.
- **Fishing, live: 24 played / 20 charged. CATCH RATE 11/24 = 45.8%**, Hard Core
  **2,880**. Species: Infused Sediment ×5 (Epic), Kelpkin ×2 (Uncommon),
  Plankton ×2 (Common), Finley ×1 (Common), Jelloid ×1 (Uncommon).
- **Sim, deck head-to-head, n=40,000/arm, identical seeds:** Golkan 93.05% /
  3.79 turns, **Dendren 96.29% / 3.17 turns**, **+3.23pp [2.92, 3.55]**.
- Suite **2463 passed / 2463**, files 116 (was 2424/116).
- Corpus: **121 dungeon attempts** (was 117), **457 fishing casts** (was 433).
- Silver rings **231**. **Athena scarcest at 21**, then Archon 24.
- **~100 corpus pins re-derived**, applied iteratively because each failing
  assertion masked the next.

## Open questions for Claude
1. ⚠ **QUESTIONS §71 needs a USER decision: does the K=10 separation claim
   survive at a margin of zero?** The cheapest discriminator is one
   **Dendren-only** batch: if the margin stays at zero on post-swap casts alone
   it is the thesis; if it reopens, it was the pooling across a deck change.
   That costs one ordinary fishing day.
2. **QUESTIONS §70 is ANSWERED** — no action needed, listed so it is not
   re-raised.
3. **The rod tripwire, not a study.** After ~3 more fishing days (n ≈ 100
   Dendren casts), a pooled rate **below ~50%** is a real signal; 50–65% is
   noise. **Do not commission a live study of the 3pp effect — it needs ~87
   sessions.**
4. **A Dendren-only recount is owed on several pooled numbers**, not just K=10:
   the `LIVE.damageHist` mode and `LIVE.drift` now pool across two decks. Say so
   in the brief rather than quoting them.
5. **`Intimidating` and five other latent boons still await a user directive.**
6. **The `web/` front end has still never spawned a real script** — untouched
   since session 120.

---

# Verbose appendix

## The four dungeon runs

| run | fixture | deepest | Hard Core | Root | first-attempt failures |
|---|---|---|---|---|---|
| 1 | run-2026-09-05-20-04-13 | 11 | 5,592 | 840 | 0/72 |
| 2 | run-2026-09-05-20-12-04 | 11 | 5,448 | 840 | 0/78 |
| 3 | run-2026-09-05-20-20-10 | 10 | 4,536 | 687 | 0/66 |
| 4 | run-2026-09-05-20-27-10 | 10 | 4,632 | 687 | 0/68 |
| **TOTAL** | | | **20,208** | **3,054** | **0/284** |

Combined 23,262. Runs 1–2 went one room deeper and earned more of both, but
**all four are the SAME ARM** — item 905 broke during run 2 and was repaired
before run 3, so unlike session 122 there is no degraded-loadout confound.

## The gear wear census, bracketed around every run

```
slot item   start  r1   r2   r3   r4   rate
  11  640     70   67   64   61   58   -3/run
  12  641     48   45   42   39   36   -3/run
  13  905      6    3    0*  21   18   -3/run   (* repaired to 24 by the user)
  13  901     14   11    8    5    2   -3/run
   2  109     10   10   10   10   10    0
   3  110     32   32   32   32   32    0
   6  227    2/0  2/0  2/0  2/0  2/0    0       (grandfathered zero)
   8   50      0    0    0    0    0    0       (the superseded Stone Rod)
  14  923     40   40   40   40   40    0       (the rod — dungeon does not wear it)
  15  954   25/25  ...  unmoved              0
```

**Four pieces wear, six do not.** That identifies the dungeon-wearing set BY
BEHAVIOUR rather than by guess, and it is what made item 905's break
predictable: at 3 with a known −3/run, run 2 was named in advance as the run it
would break in. Session 122 found its equivalent hours later in a census diff.

## The Golkan → Dendren card map, read from `fixtures/fishing-casts/cards.json`

```
  zones                    Golkan          Dendren         delta
  [1,2,3]                  80 +6/-3        91 +7/-4        hit +1, miss -1
  [4,5,6]                  81 +6/-3        92 +7/-4        hit +1, miss -1
  [7,8,9]                  84 +6/-3        93 +7/-4        hit +1, miss -1
  [1,4,7]                  85 +6/-3        94 +7/-4        hit +1, miss -1
  [2,5,8]                  86 +6/-3        95 +7/-4        hit +1, miss -1
  [3,6,9]                  87 +6/-3        96 +7/-4        hit +1, miss -1
  [1,3,7,9]                74 +7/-4        97 +9/-4        hit +2
  [2,4,6,8]                88 +8/-4        98 +9/-5        hit +1, miss -1
  ring (8 cells)           89 +4/-4        99 +5/-4        hit +1
  centre crit              90 crit+12/-3  100 crit+14/-4   crit +2, miss -1
```

Identical `hitZones`, `critZones` and `manaCost` on all ten. Zero shared ids.

## The two new crit anomalies, and the censoring trap they nearly triggered

```
13270062 t3: card 91  predicted Δ-7,  actual Δ-11  (24->13/26)  ratio 1.571
13270082 t2: card 98  predicted Δ-9,  actual Δ-13  (13->0/14)   CLAMPED
```

The second is LETHAL, so its state delta of 13 is censored. The server's own
`FISH_HP_DIFF` for that shot is **14** — read off the fixture's `events[]`.
Using 13 would give 1.444 and drag the interval's lower bound down on an
artefact. With 14 the ratios are **1.571 and 1.556, both above 1.5**, and the
standing 1.33–1.67 band survives its first test on a new deck.

⚠ Both rows were briefly read as a flat "+4" (7→11 and 9→13 are each +4). That
was an artefact of the clamped number: the true pair is +4 and **+5**.

## Head-to-head deck simulation

```
n = 40,000 per arm, identical seeds, shipped matcher policy (redraw=3)
  GOLKAN   catch 93.05%   turns/cast 3.79
  DENDREN  catch 96.29%   turns/cast 3.17
  difference +3.23pp, 95% CI [2.92, 3.55]
```

Power to detect a difference live, 80% power, α=0.05, against a known baseline:

| effect | casts | sessions at 24 played/day |
|---|---|---|
| 3pp (what the sim predicts) | 2,080 | ~87 |
| 5pp | 749 | ~31 |
| 10pp | 187 | ~8 |
| 14pp | 96 | ~4 |

`P(X ≤ 11 | n=24, p=0.606) = 0.103` — the observed 45.8% is ordinary variance.

## The pin re-derivation, and why it took eight passes

~100 pins moved. They were applied ITERATIVELY, not in one sweep, because
**each failing assertion masked the next one in its own block** — the
carry-forward lesson firing at scale. Pass counts: 24, 14, 9, 7, 4, 3, 1, 0.
`LossBlockUp`'s third pickup is the clearest case: its count assertion failed
first, so the latent no-op checks below it had NEVER EXECUTED. Bumping the count
and re-running is what actually tested it — and it **holds out of sample at n=3**.
