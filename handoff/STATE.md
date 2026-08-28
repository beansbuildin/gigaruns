# STATE — session 105 — 2026-08-28 — code at commit 885bedf1036fb151de863de806dcf1edcdd6ba49

## Status
Brief had two parts. **Part A (fishing batch) GATE PASS, Part B (two offline
dungeon items) GATE PASS.** Live spend: **21 fishing casts, 252 energy, 15
Relaxing Oils, 0 dungeon runs.** Catch rate **14/21 = 66.7%**.

The batch ran 18 casts to the rod's durability floor and stopped, as briefed.
**The user then repaired the rod mid-session and said 4 casts remained**, so 3
more were played — the number the repo's own 252-energy budget allowed. A 4th
was NOT played: it needs a budget raise, which is ask-first.

Suite **2068 passed / 2068, 111 files** (`vitest run --maxWorkers=4`; the
default over-subscribes this machine and produces FALSE timeouts — session 100,
unchanged). `tsc --noEmit` clean, `git diff --check` clean, secret scan **0 hits
on all four patterns over the diff**, `discoveredShipsClean` 8/8.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten (see `/recap` step 3). Entries marked
**[USER]** are user directives an agent may not re-open at all.

- **Proc effect sizes.** `block` = `floor(ATK/2)`, `evasion` = full negate,
  `lck` = `2 x ATK` — MEASURED, exact, control 0/4111. §58, §62. Re-opens as:
  *"diff the HP deltas on fired vs unfired exchanges."*
- **`tenacity` / `intuition` as damage mitigation.** RULED OUT, both, with no
  positive mechanic. §58, §62. Re-opens as: *"find what tenacity does."* What
  is genuinely open is the heal AMOUNTS — and ONLY that; pick-order closed
  below.
- **Tenacity PICK-ORDER.** RETIRED — redundant given the stat by construction,
  not merely underpowered. §63. Re-opens as: *"test whether tenacity's rate
  depends on where AddTenacity was picked"* or *"session 103 saw pick order
  matter."*
- **The six statuses.** `Burn`/`Weak`/`Vulnerable`/`Regen`/`SecondWind` exact;
  **`lifesteal` DOES NOT EXIST**; `amount: 0` is INERT. §59. Re-opens as:
  *"measure the status effects"* or any task listing lifesteal.
- **`triggeredBoons`.** CLOSED as an evidence channel — 0 non-empty of 10,616.
  DECISIONS 2026-08-26. Re-opens as: *"settle whether triggeredBoons populates."*
  **No runs may be spent on it.**
- **`SecondWind` / `Steadfast`.** Ordinary volume WILL NOT settle these — that
  is a positive finding, not missing data. DECISIONS 2026-08-27. Re-opens as:
  *"grow n on SecondWind/Steadfast through normal play."*
- **Redraw.** CLOSED — `redrawEnabled` stays false, the counterfactual bound is
  retired, and §28's gap 1 is STRUCTURALLY unreachable from a shadow at any
  volume. §49, §51. Re-opens as: *"run more redraw shadow analysis."*
- **JEBAITOR.** CLOSED — a ~9% skill making a cast not count against the daily
  ledger; it explains the `lowered` direction of a repo-vs-game cast
  disagreement and ONLY that. §34. Re-opens as: *"the cast ledgers disagree"*
  or *"the bot played more casts than the game counted."*
- **[USER] Rule 8 — highest non-Perpetual tier, lowest at the final room.**
  Reversed on new evidence 2026-08-20. Re-opens as: *"revert to lowest-tier"*
  or *"fix the falling sim coverage."* The coverage fall is the PRICE of the
  rule, not a regression.
- **[USER] Rule 11 — entry tier is Tier-1 (`--juiced-index=1`), 0 rings.**
  Session 104. `data.index` is the TIER; `entryData` is ordered 2, 1, 3, so
  array position is NOT tier. Re-opens as: *"correct the juiced index"* — a
  positional 'fix' selects Tier 2 and spends silver rings.
- **[USER] Rule 12 — energy is not a constraint** (~1368/day via ROMs; the
  endpoint reports only the regen pool). Re-opens as: *"we are blocked on
  energy."* Exercise `--dry-run` before reporting any blocker.
- **[USER] Auth Path B / EOA / `viem`.** RETIRED, not deferred — the account is
  an AGW with no user-held key. DECISIONS 2026-08-20. Re-opens as: *"finish the
  EOA auth path."* `tests/clientSurface.test.ts` fails if a signer returns.
- **[USER] The rod.** Golkan, REPAIRED not replaced — done again 2026-08-28,
  18 -> 40. `CORPUS_DECK` stays Shroom until the corpus is majority-Golkan.
  §53, §61.3. Re-opens as: *"repoint CORPUS_DECK"* or *"pick a new rod."*
- **[USER] Unspent skill XP.** CLOSED, not deferred. §61.1. Re-opens as:
  *"the account has unallocated skill points worth spending."*
- **Suite invocation.** `vitest run --maxWorkers=4`; the default
  over-subscribes this machine and produces FALSE timeout failures.
  DECISIONS 2026-08-26. Re-opens as: *"the suite is red."*

## What works
- **Part A — 21 casts, 14 caught = 66.7%**, exact binomial 95% CI
  **[43.0%, 85.4%]**. Against the RECENT-ERA baseline (`focusDry`, excluding
  today) of **41/74 = 55.4%**, Fisher **p = 0.455** — high, and NOT separable
  from the era. Do not report it as an improvement. (Compared against the era,
  not the all-time corpus, per DECISIONS 2026-08-26.)
- **The rod ran to EXACTLY 0 over 18 casts** (18 -> 0, paired readings under one
  batchId), re-confirming the 1.00/cast decrement at the one place session 102
  could not reach: the floor itself. The preflight halts AT 0 on the NEXT
  invocation, not mid-batch — so a batch sized to the reading runs clean.
- **The necessity gate withheld a third time and it was free again.** 4
  opportunities (non-null `bestKillProbability`), 1 above 0.85 (p = 0.926),
  oil withheld, **cast CAUGHT**. Live record now 3 withholds, all 3 free.
- **Part B1 — tenacity pick-order ANSWERED and RETIRED**, offline, on the full
  corpus: 26 of 77 runs picked `AddTenacity` at positions 1-9. Raw pick-order
  reproduces session 103's shape at 5x volume, then **dissolves entirely under
  the stat** — 13 of 16 (stat, pick) cells are ONE RUN. Holding the stat fixed:
  3 informative strata, 7 procs in 269 exchanges, Fisher p = 0.488 / 0.196 /
  0.566, pooled 0.677. §63.
- **Part B2 — `handoff/TIER1-MEASUREMENT.md` written**, zero live spend. Its
  finding: **ONE run suffices** if it clears >= 6 rooms. Depth was the stated
  worry; normalising by rooms CLEARED collapses session 103's 1.47x raw spread
  to 10.4% (CV 4.9%), against hypotheses 300% apart. Decision rule and a
  Dendren-Root negative control are fixed in advance.
- `src/sim/combat.ts` untouched. CAPTURE-1's prohibition stands as §58/§59
  left it.

## What's broken
- **Nothing is red.** But four pinned claims MOVED and none was a silent bump:
- ⚠ **`deckShuffle`'s count bound broke a SECOND time (0 -> <=1 -> 2 observed).**
  Re-derived rather than bumped: 253 opening hands, 2 ordered matches, lambda =
  0.2076, so **P(>=2) = 1.9%** (ordered null) or ~32% (set null). Bound now sits
  at **5**, where P is ~1e-5 and a real sequential-draw bug would give 253. A
  bound must sit between what chance can do and what the bug would do; 0 and 1
  both sat below what chance can do.
- ⚠ **`castEra`'s bucket-3 tell is no longer exactly 1** — it moved 1 -> 2 after
  surviving sessions 96/98/99/102. It is an occurrence COUNT, so 2 falsifies
  nothing, and the era separation it guards is if anything better supported
  (2/95 focusDry vs 17/94 preOil). The four-session constancy claim is retired.
- ⚠ **`damageEconomy`'s sim-vs-live ratio fell again: 17x -> 9.97x -> 8.48x.**
  The bar was NOT moved (session 102 pre-registered that a third move is the
  wrong response, and 8.48 clears 5). Recorded so the next fall is the third
  against a written expectation.
- **`redrawCounterfactual`'s "always upward" net STOPPED at 4** across the
  largest growth it has seen. The refusal to call 0->1->3->4 a trend was right.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Corrections to SPEC.md
- **None. `SPEC.md` and `SPEC-fishing.md` were not touched, and neither was
  contradicted.**
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **`data.nextPosition` / `data.nextMovePath` flagged `UNKNOWN FIELD` 9 times
  is EXPECTED, not a new discovery** — known since session 26, fires on ~1-2%
  of responses. Do not brief it as a find.
- **The `nextPosition` OVERRIDE went ACTIVE live for the first time** (22/22
  hits, Wilson lower bound 85.1%, threshold 10). It fired, predicted {4,2},
  actual {4,2}, cast caught. Session 30 wired it as unreachable-in-practice; it
  is reachable now and is steering live play.

## Dead ends
- **Do not re-brief tenacity pick-order.** §63 retires it, and the reason is
  structural, not sample size: `boons` and `stat` are read off the SAME
  preceding state, so the per-exchange `tenacity` already encodes the boon at
  the moment it applied. More runs cannot create a residual.
- **Do not read the 66.7% catch rate as the policy working better.** p = 0.455
  against the era. Session 102's identical-shaped result (14/20) got the same
  treatment.
- **Do not "fix" the 21-vs-19 cast discrepancy.** 21 casts played, 19 charged
  by `dayDocs`; JEBAITOR fired twice and the pairing is exact (both JEBAITOR
  events sit inside the two casts whose reconcile logged `lowered`). §34 is
  CLOSED — do not generalise it to the `raised` direction.
- **Do not read a lethal exchange's clamped HP delta as damage.** The new
  `stateFields` crit anomaly reads Δ-9 clamped (9->0) but the server's
  unclamped `FISH_HP_DIFF` is **11**. At face value it gives ratio 1.29,
  disjoint from every other row, and "one multiplier fits them all" looks
  FALSIFIED by a censoring artefact. It is not: 7 x 1.5 -> 11, interval
  unchanged at [1.5, 1.5833). Same trap as the `Regen` lethal exclusion.
- **Empty `run-` fixture dirs from `--dry-run` are expected, not corpus
  pollution.**

## Metrics
- **Live: 21 fishing casts, 252 energy, 15 Relaxing Oils (937), 0 dungeon
  runs, 0 dungeon energy.** Game ledger **19/20** (JEBAITOR ate 2); repo ledger
  19 casts / 252 energy. Repo energy budget **exactly exhausted at 252/252**.
- **Catch rate 14/21 = 66.7%**, CI [43.0%, 85.4%]. Era `focusDry` now
  **55/95 = 57.9%**; all-time **108/250 = 43.2%**.
- **Rod: 18 -> 0 over 18 casts** (1.00/cast, exact), then repaired to **40**.
- **Oils: 6 double-lethal firings (2 each) + 3 single-lethal (1 each) = 15**;
  27 -> 12 held. 0.71 oils/cast. 9 Focus triggers withdrawn by policy.
- **Necessity gate: 4 opportunities, 1 withheld** at p = 0.926 (cast caught).
  Union across all logs: 12 of 31 would hold at 0.85.
- **Tenacity pick-order: 26 of 77 runs picked `AddTenacity`, positions 1-9;
  3 of 8 stat strata informative, 7 procs in 269 exchanges.**
- Corpus **230 -> 251 fishing casts** (+100 responseDocs, +50 playTurns,
  +14 caught, +7 escaped; `incomplete` UNCHANGED at 1, eleventh batch running).
  Dungeon attempts unchanged at 83.
- Suite **2063 -> 2068** (+5 pick-order tests). 59 corpus-ratchet failures
  across the same ten files as session 102, all re-derived.

## Open questions for Claude
1. **The `nextPosition` override is now LIVE and steering card choice** — it
   crossed its 10-hit threshold and fired this session at 22/22. Nothing was
   briefed about it and no one decided to turn it on; it armed itself by
   accumulating validation data, exactly as session 30 designed. Is that
   wanted? It is a real behaviour change to live play with no user sign-off.
2. **The repo's 252-energy fishing budget is now the binding constraint again,
   and JEBAITOR is why.** 252 was set (session 93) as 21 x 12 against a game cap
   of 20, so it could "never buy a cast the server would not already refuse."
   JEBAITOR breaks that: 21 casts played, only 19 charged, so the game still
   offers a 20th while the repo is out of budget. Raise it, or accept losing
   ~1-2 casts a day to the skill? **Ask-first either way.**
3. **Should the first live Tier-1 run be run?** `handoff/TIER1-MEASUREMENT.md`
   is written and says one run settles it. Still needs a rule-11 go-ahead.
4. Unchanged and still deferred: session 100's open question 2 (should the live
   loop read the dungeon proc booleans in real time).

## Files changed
```
  M  QUESTIONS.md                    +§63 (tenacity pick-order RETIRED)
  A  handoff/TIER1-MEASUREMENT.md    B2 pre-registration, 146 lines
  M  scripts/procEffectSize.ts       +tenacityByPickOrder, +pickOrderPower,
                                       +stratified report section
  M  tests/procEffectSize.test.ts    +5 pick-order tests (25 -> 30)
  M  scripts/liveFishing.ts          REDRAW_SHADOW_IN_SAMPLE_RATE_PCT 3.0 -> 3.1
  M  tests/fishing/castEra.test.ts               corpus ratchet (17) + bucket-3
  M  tests/fishing/redrawCounterfactual.test.ts  corpus ratchet (17) + net held
  M  tests/fishing/oilReachability.test.ts       corpus ratchet (9)
  M  tests/fishing/matcherHeadroom.test.ts       corpus ratchet (5)
  M  tests/fishing/zoneTemplate.test.ts          corpus ratchet (3) + gap 4->5
  M  tests/fishing/redrawShadowAnalysis.test.ts  corpus ratchet (2)
  M  tests/sim/fishingCorpus.test.ts             corpus ratchet + 9 oil casts
  M  tests/fishing/stateFields.test.ts           +1 crit anomaly (unclamped 11)
  M  tests/fishing/damageEconomy.test.ts         drift pin, ratio 9.97 -> 8.48
  M  tests/fishing/deckShuffle.test.ts           bound re-derived from the null
  M  handoff/reports/*.md                        regenerated
  ?? 21 new cast fixtures
```
