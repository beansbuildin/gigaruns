# STATE — session 107 — 2026-08-29 — code at commit 0eeae11e

## Status
Brief was **fishing only, on the raised 300-energy / 25-cast budget. GATE PASS.**
Live spend: **22 fishing casts PLAYED, 20 CHARGED, 264 energy, 8 Mid Relaxing
Oils (937), 0 dungeon runs, 0 rings, 0 Focus Oil.**

**The batch was stopped by the GAME, not by the repo** — a server `HTTP 400
"Player has reached max runs for fishing"` on cast 23. The raised budget behaved
as headroom exactly as intended: **264/300 energy used, 36 spare, and it refused
nothing.** The JEBAITOR gap the raise exists to capture came out clean at
**2 of 22 = 9.1%**.

**The session opened BLOCKED: the JWT had expired** (`exp` 2026-08-28T17:56Z,
~20h stale, lapsed ~30 min after session 106's last dungeon run). The user
refreshed it mid-session and everything below ran after that.

Suite **2092 passed / 2092, 111 files** (`vitest run --maxWorkers=4`; the default
over-subscribes this machine and produces FALSE timeouts — session 100,
unchanged). `tsc --noEmit` clean, `git diff --check` clean, secret scan **0 hits
on all four patterns** over the tracked diff AND the 222 new fixture files,
`discoveredShipsClean` 8/8.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten (see `/recap` step 3). Entries marked
**[USER]** are user directives an agent may not re-open at all.

**Dropped this session** (folded into tests that would fail, per `/recap` step 3):
**Proc effect sizes** (`tests/procEffectSize.test.ts` asserts them exactly, and
its null arm is now the exceptionless `cleanMisses === []`) and **the six
statuses** (asserted exactly in the status tests; `lifesteal` cannot be
reintroduced without a red suite).

- **[USER] The fishing budget is 300 energy / 25 casts.** Raised from 252/20 by
  direct user directive 2026-08-29, resolving sessions 105/106 open question 2.
  It is HEADROOM, not a new cap — the game's 20 CHARGED casts/day still binds
  and did, this session. Re-opens as: *"raise the fishing budget"*, *"the repo
  ceiling cost a cast"*, or *"revert 300/25 to 252/20"*.
- **JEBAITOR, and its gap, MEASURED.** A ~9% chance a cast does not count
  against `dayDocs`. This session: **22 played, 20 charged, 2 lowered
  reconciliations — 9.1%**, landing on §34's figure. Re-opens as: *"the cast
  ledgers disagree"* or *"measure played vs charged casts"*. **A sub-25-cast
  batch is NOT evidence the budget is too low.**
- **Rod durability is charged per cast PLAYED, not per cast CHARGED.** 37 -> 15
  over 22 played = exactly 1.00/cast; JEBAITOR buys a free ledger slot and NOT
  free rod wear. DECISIONS 2026-08-29. Re-opens as: *"does JEBAITOR save
  durability"* or *"derive the durability rate"*.
- **Tier-1 Hard Core payout.** MEASURED, not derived: `dropMultiplier` governs
  item 845 ONLY, at an **exact 4:1 quantum**. Dendren Root (846) unmoved.
  DECISIONS 2026-08-28. Re-opens as: *"measure the first live Tier-1 run"* or
  *"the ~quarter figure is still a derivation."* It is no longer a derivation.
- **The no-proc null.** Damage = attacker's `currentATK` on **1645/1645
  status-clean exchanges, full corpus, zero misses ever.** DECISIONS
  2026-08-28. Re-opens as: *"the null rate is falling"* — a MIXED-population
  rate is composition-bound and falling is expected; the clean one is exact.
- **`tenacity` / `intuition` as damage mitigation.** RULED OUT, both, with no
  positive mechanic. §58, §62. Re-opens as: *"find what tenacity does."* What
  is genuinely open is the heal AMOUNTS — and ONLY that; pick-order closed
  below.
- **Tenacity PICK-ORDER.** RETIRED — redundant given the stat by construction,
  not merely underpowered. §63. Re-opens as: *"test whether tenacity's rate
  depends on where AddTenacity was picked"* or *"session 103 saw pick order
  matter."*
- **`triggeredBoons`.** CLOSED as an evidence channel — 0 non-empty of 10,616.
  DECISIONS 2026-08-26. Re-opens as: *"settle whether triggeredBoons populates."*
  **No runs may be spent on it.**
- **`SecondWind` / `Steadfast`.** Ordinary volume WILL NOT settle these — that
  is a positive finding, not missing data. DECISIONS 2026-08-27. Re-opens as:
  *"grow n on SecondWind/Steadfast through normal play."*
- **Redraw.** CLOSED — `redrawEnabled` stays false, the counterfactual bound is
  retired, and §28's gap 1 is STRUCTURALLY unreachable from a shadow at any
  volume. §49, §51. Re-opens as: *"run more redraw shadow analysis."*
- **[USER] Rule 11 — entry tier is Tier-1 (`--juiced-index=1`), 0 rings.**
  Session 104, EXERCISED LIVE 4/4 in session 106. `data.index` is the TIER;
  `entryData` is ordered 2, 1, 3, so array position is NOT tier. Re-opens as:
  *"correct the juiced index"* — a positional 'fix' selects Tier 2 and spends
  silver rings.
- **[USER] The rod.** Golkan, REPAIRED not replaced. Read 37 pre-batch and
  **15 post-batch** this session. `CORPUS_DECK` stays Shroom until the corpus is
  majority-Golkan. §53, §61.3. Re-opens as: *"repoint CORPUS_DECK"* or *"pick a
  new rod."*
- **[USER] Unspent skill XP.** CLOSED, not deferred. §61.1. Re-opens as:
  *"the account has unallocated skill points worth spending."*
- **Suite invocation.** `vitest run --maxWorkers=4`; the default
  over-subscribes this machine and produces FALSE timeout failures.
  DECISIONS 2026-08-26. Re-opens as: *"the suite is red."*

## What works
- **The batch, and the ceiling that stopped it.** 22 casts played across
  14:28-14:32Z, ending on a server 400 `"Player has reached max runs for
  fishing"` at cast 23. `checkFishingCaps.ts` read **0/20 before and 20/20
  after**. The repo budget never bound (264/300).
- **The JEBAITOR gap, measured four ways that agree.** `fishing_ledger_reconciled`
  fired per cast and logged exactly **two `lowered` adjustments** (at repo-counts
  6 and 13). 22 played is confirmed independently by: 22 `cast_over` events,
  corpus 251 -> 273, energy 264 = 22 x 12, and rod wear 37 -> 15 = 22.
- **Catch rate 12/22 = 54.5%**, 95% Wilson **[34.7%, 73.1%]**. Prior corpus
  108/251 = 43.0%; the recent-100 window 59.0%. Two-proportion vs prior corpus
  **z = 1.04, p = 0.30** — indistinguishable, as expected at n=22.
- **Oil policy behaved exactly as shipped.** 8 Relaxing (937) over **4
  double-lethal firings, 2 each**; stock 32 -> 24. The per-cast cap of 2 was
  REACHED and did not BIND. **15 Focus triggers were withdrawn by policy**
  (`oil_trigger_policy_withdrawn`, 942 absent from `allowedItemIds`) — session
  93's fix still holding, so those casts stay in BOTH outcome arms rather than
  being flagged OIL-POLICY-DRY.
- **Redraw stayed disabled**: 69 shadows logged, 18 suppressed, 0 live effect.

## What's broken
- ⚠ **`guard-budget-fishing.json` recorded `runsStarted: 25` against 22 played /
  20 charged.** So `--status` reported "25/25 used -> 0 remaining" and the
  post-batch `checkFishingCaps` printed "repo over-counted by 5". The
  reconciler's own in-batch trace ends **agreed at 20**, so this is the GUARD
  counter drifting, not the reconciler. Direction is benign (it under-grants,
  never over-grants) and it coincided with the server cap this time. **Not
  touched** — see open question 2.
- ⚠ **Unknown fields on `play_cards` responses: `data.nextPosition` and
  `data.nextMovePath`**, 6 midcast + 4 terminal dumps in `logs/`. Present on the
  pre-batch dry-run's stale terminal doc too. Did not affect play.
- ⚠ **57 suite assertions went red on the new corpus and were RE-DERIVED, not
  bumped.** All 9 files were pure census growth (+22 casts / +69 plays,
  uniformly). **Every structural invariant held at the larger n** —
  `zoneTemplate`'s exceptionless resolver 1058/1058, the focus-meter
  reconstruction 1034/1034, `assertOpeningFocusPinned` still passing, and the
  era split still `[94, 62, 117]` with preOil and oilSupplied FROZEN and only
  the current era growing by exactly 22.
- **The JWT expires and blocks the whole session.** No renewal path in-repo;
  it is a manual copy from the user's browser.

## Corrections to SPEC.md
- **None. `SPEC.md` and `SPEC-fishing.md` were not touched** — nothing in the
  live responses contradicted them this session.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **One source constant moved:** `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` "3.1" ->
  "3.0" in `scripts/liveFishing.ts`. The live loop PRINTS this, and
  `redrawShadowAnalysis.test.ts` exists to stop it going stale.

## Dead ends
- **Do not read a sub-25-cast batch as the budget being too low.** 300/25 is
  headroom over the game's 20 CHARGED casts; 22 played is the expected shape.
- **Do not rewrite the long `docId` array literals in
  `tests/sim/fishingCorpus.test.ts` or `tests/fishing/oilReachability.test.ts`.**
  Tried it here and it destroyed ~180 lines of per-session comment history;
  restored from HEAD and APPENDED instead. The new ids sort to the end, so
  appending preserves order.
- **Do not guess a corpus constant and let the suite confirm it.** Tried it once
  (`budgetZero` guessed 288, real value 284). Re-run and read the actual.
- **Empty `cast-` fixture dirs are expected, not pollution** — 3 today: two
  `--dry-run`s and the server-rejected cast 23. Git does not track empty dirs.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Metrics
- **Live: 22 fishing casts PLAYED, 20 CHARGED to `dayDocs[pond 2]`, 264/300
  energy, 8 Relaxing Oils, 0 dungeon runs, 0 rings.**
- **JEBAITOR gap 2/22 = 9.1%** (95% Wilson [2.5%, 27.8%]).
- **Catch rate 12/22 = 54.5%** [34.7%, 73.1%]; prior corpus 43.0%; p = 0.30.
- **Rod durability 37 -> 15 = exactly 1.00 per cast PLAYED** (22), not per cast
  charged (20). Session 105's rate was 38 -> 18 over 20 = 1.00. Two paired
  readings now agree exactly.
- Opening turn (n=22): aim (2,2) x11, (3,3) x4, (3,2) x3, (2,3) x3, (1,3) x1;
  mean pHit 0.482. All turns (n=69): mean pHit 0.426. Turns/cast median 3.
- Corpus **251 -> 273 casts; 989 -> 1058 plays.** Dungeon unchanged at 87.
- Suite **2092 -> 2092** (unchanged count; 57 constants re-derived across 9
  files, no test added or removed).

## Open questions for Claude
1. **The `nextPosition` override is LIVE and steering fishing card choice** with
   still no user sign-off — it armed itself by accumulating validation data.
   **2 more validations today, both hits.** Carried UNCHANGED from sessions
   105/106. Is it wanted?
2. **NEW: the fishing guard counter over-counts.** `runsStarted` reached 25 on a
   22-played / 20-charged batch. Benign direction, but the repo's own session cap
   and the played count disagree, and `--status` reports a number that is not the
   casts played. Fix the counter, or is the reconciler's figure the only one that
   should be trusted?
3. **Is the Tier-1 arm now the baseline for everything downstream?** Session
   103's Tier-3 numbers are no longer comparable on any payout statistic and
   several reports still quote them. **Third session unmentioned-and-unactioned**
   — out of scope for a fishing session, but it is not going away.
4. Unchanged and still deferred: session 100's open question 2 (should the live
   loop read the dungeon proc booleans in real time).
