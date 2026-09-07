# STATE — session 124 — 2026-09-06 — commit c8e11c26

## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data (§13). The
session worked `handoff/next.md`'s session-124 brief, which was CURRENT.

**The gate the brief set: the §71 K=10 discriminator. GATE PASS — and it cost
ZERO CASTS.** The answer was sitting in committed fixtures. **§71's dichotomy is
FALSE:** both its branches presuppose a positive pre-swap margin, and the
pre-swap GOLKAN slice (307 traces, the largest single-deck cell) is **already at
−5**. There was never a positive margin for the rod swap to destroy. **[USER]
ruled HOLD** — §71 stays OPEN and UNCHANGED.

**ELEVEN pre-registered forecasts, ELEVEN held EXACTLY**, across four dungeon
runs, the rod, and the charge shape. Pre-registration commits `e8769d3b`,
`624f0575`, `5b9eb364`, each confirmed to predate its spend.

**EVERYTHING SPENDABLE IS SPENT.** Dungeon **12/12** run-units (4 juiced Tier-2
runs). Fishing **20/20 charged, 26 played** — the server refused cast **27**.

Suite **2498 passed / 2498, 116 files, exit 0**. `tsc --noEmit` exit 0,
`git diff --check` clean.

⚠ **Re-run the suite UNSANDBOXED** — sandbox breaks `tsx` and `git`.
⚠ **`$TMPDIR` DIFFERS between sandboxed and unsandboxed runs.** A file written
in one mode is not there in the other; this cost a debugging cycle.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        14452
  CONTROL A (read):     14052 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all rules; allowlisted hits each printed
> PASS — no unexplained hits, both controls healthy.
```

**No leaks this session.**

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session:** the **rotation** entry (fully measured in 123, no work
left, and the last instrument still claiming otherwise was fixed) and the
**"Dendren geometry / rod is 923"** entry (discharged — the geometry is in
`fixtures/fishing-casts/cards.json` and `CURRENT_ROD` is repointed).

- ⭐ **[NEW] THE TWO WEAR SETS ARE DISJOINT AND EVERY BREAK IS FORECASTABLE.**
  **Dungeon: slots 11, 12, 13×2 at −3 per RUN. Fishing: slots 14, 15×2 at −1.00
  per PLAYED cast.** Neither moves under the other activity — tested four times
  this session. `floor(durability / rate)` names the BREAK RUN correctly.
  ⚠ Durability **CLAMPS at 0**, so that formula gives the right break EVENT and
  the wrong final READING. **A rod-only repair does NOT reopen a full fishing
  day.** DECISIONS 2026-09-06. Re-opens as: *"how fast does gear wear?"* or
  *"which pieces wear?"*.
- ⭐ **[NEW] A REPAIR MINTS A NEW `docId`.** Item 901 went `…_cffcabf3` →
  `…_373feb7b` across the user's repair. **Anything keyed on docId across a
  repair mis-tracks the piece as new.** Re-opens as: *"track gear by docId"*.
- ⭐ **[NEW] §71's DICHOTOMY IS FALSE, and the K=10 margin is now NEGATIVE**
  (b10 33, all3 34, margin −1; history 4 → 2 → 0 → −1). At constant policy era
  EVERY deck is ≤ 0 (legacy −1, golkan −16, dendren −2); the positive margin
  lives in the two OLDER ERAS (+6 / +13 / −19). **The separation tracks the
  ERA, not the rod.** A mechanism was hypothesised, MEASURED and REJECTED
  (budget-zero 41.2% / 0.7% / 30.2% against those margins — non-monotone).
  ⚠ **[USER] §71 is OPEN: HOLD, pending more Dendren data.** An agent may not
  retire it. Re-opens as: *"recompute the margin on Dendren-only casts"* — done,
  answered — or *"retire the K=10 claim"* — needs a user directive.
- ⭐ **[NEW] THE CORPUS STRADDLES AT LEAST TWO DECK CHANGES, not one**, and
  "low card ids" is TWO populations: 44 DRY-ROD `BASE_DECK` casts (use
  `splitByDealtDeck`) and 82 rod-dealt casts on an earlier, unidentified rod.
  Conflating them is the natural error and this session made it first.
  Re-opens as: *"the corpus straddles a deck change"* (singular).
- ⭐ **[NEW] THE FISH-TO-ZERO HALT WORKS — first firing in the project's
  history**, and its safety **DEPENDS ON `castCap: 2`**. Rod durability is
  checked at PREFLIGHT and after the batch, **never between casts**, so a long
  `--casts=N` batch without `--oil-batch` would play past zero onto a dry rod
  and inject `BASE_DECK` into the corpus mid-batch. **Run fishing as repeated
  small `--oil-batch` invocations.** Re-opens as: *"run the whole fishing day in
  one batch"*.
- ⭐ **[NEW] `--casts=N` is SILENTLY OVERRIDDEN by `--oil-batch`** —
  `authorizedCasts = batchLimits.castCap ?? args.casts`, `castCap` 2 — while
  the banner still prints `args.casts`. **The banner and the real cap
  disagree.** Re-opens as: *"why did --casts=15 only play 2?"*.
- **[USER] OTHER DUNGEONS ON THIS ACCOUNT ARE OUT OF SCOPE.** Not queried, not
  counted, not reported. The 12-run-unit ledger is PER-DUNGEON, measured.
- **[USER] THE GEAR HALT: never abort a run in progress; after a COMPLETED run,
  any piece at 0 stops the session for a manual repair.** Pieces already at 0
  when the session opens are GRANDFATHERED. ⚠ **Clarified live this session and
  confirmed by the user's own actions: the halt is per-ARM.** Broken slot-15
  (fishing) pieces did not block dungeon runs, and a broken slot-13 (dungeon)
  piece did not block fishing.
- **DENDREN IS BETTER** (+3.23pp [2.92, 3.55], n=40k/arm). The live rate is NOT
  a regression. Re-opens as: *"is the new rod worse?"*.
- **[USER] Item 50 (slot 8) is the SUPERSEDED Stone Rod**, not a repairable
  piece. Re-opens as: *"repair slot 8 before fishing"*.
- **[USER] "Different fisheries" is RETIRED AS PHRASING; the conclusion stands.**
  QUESTIONS **§70**. Re-opens as: *"restore the `> 5` assertion"*.
- **The ARITHMETIC rotation map stays FALSIFIED.** The permutation is measured,
  all seven cells. Re-opens as: *"faction = dayOfWeek + 2"* or *"measure the
  rotation"*.
- **The charged faction does NOT change mid-day.** Now **29/29** on the shape.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.**
- **[USER] The double-lethal oil override is DISABLED; Focus Oil off the
  allowlist.**
- **[USER] The Tier-1/Tier-3 whole-run income baseline is RETIRED BY NAME.**
- **A new boon type from n=1 needs a USER DIRECTIVE.** **SEVEN** held now —
  `Thorns` joined this session. Re-opens as: *"model the remaining latent boons"*.
- **Evade DOMINATES crit**, and **evade zeroes damage 15/15** — measured this
  session. Re-opens as: *"critProc's 2×ATK rule has exceptions"*.
- **TASKS §13's SWAP is parked on DATA, not code.**
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **Pre-registration as a git commit, FOUR sessions running.** Every forecast
  this session was committed before its spend. **11/11 held.** Repeat this.
- **`scripts/liveRun.ts` end to end, four times. 0/288 first-attempt action
  failures** (108 + 57 + 58 + 65).
- **Run 1 reached ROOM 14 — the deepest in the corpus's history.**
- **Rule 8 exercised hard, including the PERPETUAL FILTER firing live** at room
  14 (`offered=[0,2,1] taken=1 perpetualFilteredTop=true`).
- **`scripts/redrawDeckSlice.ts` (NEW)** — slices the corpus by the deck the
  server dealt, after splitting on `splitByDealtDeck`. It is what answered §71.
- **`scripts/checkGear.ts` bracketed around every run and every batch** — this
  is what made all eleven forecasts checkable.
- **The fishing guard failed closed on the server's own cap rejection** at cast
  27 and did not retry.
- **Rule 13 discipline held**: every live command read back off the server
  ledger.

## What's broken
- ⚠ **The K=10 margin went NEGATIVE (−1).** Re-pinned to the measured state,
  NOT relaxed. **QUESTIONS §71, [USER] HOLD.**
- ⚠ **TWO NEW CRIT ANOMALIES.** Card **18** is the FIRST on a low-id
  base/legacy card; card **96** is DENDREN and repeats session 123's card-91
  ratio exactly. Neither is a new base, so neither tightens the bound.
- ⚠ **`Thorns` is a NEW PICKED boon** — verified latent no-op at pickup
  (hp/hpMax/armor/armorMax and all ROLLED byte-identical; `selectedVal1` 5,
  Rare, TokenId 123). It had been OFFERED since 2026-08-27 and never picked.
  **HELD pending a user directive**, as the precedent requires.
- ⚠ **`procEffectSize`'s "intuition never mitigates on its own" needed its
  FILTER completed, not its claim relaxed.** The first-ever evade+intuition
  co-fire (1 of 638) read as a counterexample until `evadeProc0` was excluded
  alongside `blockProc0`. Evade zeroes damage **15/15**. The claim still has no
  counterexample.
- ⚠ **The live catch rate is 50.0% this session** (13/26); pooled Dendren-only
  **24/50 = 48.0%**. **NOT a concern** — the tripwire arms at n≈100, and this
  is not a regression.

## Corrections to SPEC.md
- **`SPEC.md` was not touched and needed no change.** No live response
  contradicted it.
- ⚠ **The brief's six checkable claims ALL PASSED** — the first clean sweep in
  three sessions. Claim B was flagged as likely to fail again (balances rose
  last session); it held at 231 this time.
- ⚠ **A CLAIM I MADE TOO EARLY, corrected in place rather than deleted.** After
  the rod halt I wrote that the session would get *"no third data point on
  where the server refusal lands"*. The user repaired the rod and authorised the
  rest of the day, and the refusal landed at **cast 27** (after 24 and 25).
  **Do not fold a "therefore we cannot learn X" onto a correct prediction** — a
  halt is a hand-back, not the end of the day.
- ⚠ **A LIVE INSTRUMENT CONTRADICTED THE SETTLED RECORD FOR A FULL SESSION.**
  `checkEntryTiers.ts` still printed *"dow2 … FORCED BY ELIMINATION, NOT
  MEASURED"* after session 123 measured it. Fixed. **When a measurement lands,
  grep the SCRIPTS that print claims about it, not just the markdown.** Applied
  immediately to this session's own new tool.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.

## Dead ends
- **Do not re-run §71's nominated Dendren-only discriminator as if it were
  open.** It is answered, and its framing was wrong.
- **Do not "fix" the source labels in `OBSERVED_OFFERS` by using the AFTER
  state.** Rows are keyed to the **BEFORE** label; using `after` turned all 35
  new rows into `sourceMisses` (17 → 52).
- **Do not add the three legacy rods (49/50/336) to `ROD_CARD_GRANTS`.**
- **Do not re-fit an arithmetic rotation rule.**
- **Do not re-hunt the advance faction-indicator field.**
- **Do not look for the ring debit on the wire.**
- **Do not update corpus pins mid-session** — this session pinned only after
  12/12 run-units and 20/20 casts were spent, for exactly session 123's reason.
- **Do not run the suite sandboxed.** **Do not trust a `tail`-piped or
  task-notification exit code** — capture to a file and read `$?`.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Dungeon, live: 4 juiced Tier-2 runs, 12/12 run-units, 240 energy.** Deaths
  rooms **14 / 8 / 7 / 10**. Foxglove 45→42→39→36→33, −3/run, sole mover every
  time. **0/288 first-attempt action failures.** Hard Core **19,056**, Dendren
  Root **2,778**.
- **Fishing, live: 26 played / 20 charged**, server refused cast **27**. Catch
  rate **13/26 = 50.0%**, Hard Core **4,880**. Pooled Dendren-only **24/50 =
  48.0%**.
- **Rod 923: 16 → 0 over 16 casts, repaired to 40, → 30.** Slot-15 pair
  20/25 → **0/0**.
- **§71 slice, final (483 traces):** baseDeck +1 (44), legacyRod +6 (82),
  **GOLKAN −5 (307)**, **DENDREN −4 → −3 (50)**, pooled −1.
- **Economy, pooled vs Dendren-only** — quote BOTH, never the pooled alone:
  `LIVE.drift` **−0.7010 pooled / −0.5765 Dendren**; `damageHist` mode
  **5 pooled / 7 Dendren**.
- Suite **2498 passed / 2498**, files 116 (was 2463/116).
- Corpus: **125 dungeon attempts** (was 121), **483 fishing casts** (was 457).
- Silver rings **213**. **Athena still scarcest at 21**, then Archon 24.
- **~100 corpus pins re-derived**, converged over ~15 iterative passes.

## Open questions for Claude
1. ⚠ **QUESTIONS §71 is on [USER] HOLD** — more Dendren data before any
   decision. **Do not re-commission the discriminator; it is answered.** The
   open part is only whether the claim is retired or rescoped to the older eras.
2. ⚠ **`Thorns` needs a USER DIRECTIVE** — SEVENTH held boon. Latent no-op at
   pickup; the name suggests retaliation and the name is not evidence.
3. **The rod tripwire, not a study.** Dendren corpus is at **50**; the tripwire
   arms at ~100. A pooled rate below ~50% is a real signal then; 48.0% now is
   NOT one. **Do not commission a live study — it needs ~87 sessions.**
4. **Gear forecast for the next session, free and pre-computable:** at −3/run,
   **905 is at 6 and breaks on run 2**; 901 at 17 (5 runs), 641 at 24 (8), 640
   at 46 (15). **The slot-15 fishing pair is at 0 and must be repaired before
   fishing**, or the rod-only repair leaves them broken.
5. **Five other latent boons still await a user directive** (`CritHeal`,
   `Intimidating`, `BurningTenacity`, `RegenMastery`, `VulnerableMastery`,
   `WeakeningBlock`). `Intimidating` still cannot separate "heals its amount"
   from "heals a flat 2".
6. **The `web/` front end has still never spawned a real script** — untouched
   since session 120.
