# STATE — session 87 — 2026-08-23/24 (PT) — code at commit a040172b

## Status
**GATE 0 PASS. GATE 1 (fishing) PASS. GATE 2 (dungeon) PASS.**
**⚠ THE TEST SUITE IS RED AND WAS LEFT RED BY USER DIRECTIVE: 70 failed /
1603 passed (1673), 11 failed files of 99.** `tsc --noEmit` clean,
`git diff --check` clean, `discoveredShipsClean` 8/8, secret scan clean.

- **A LIVE session, the first since session 82.** Both ledgers were fresh at
  minute one (fishing 0/20, `dayProgressEntities` null) and both were spent
  deliberately: **20 fishing casts and ONE juiced dungeon run.**
- **§19 IS ANSWERED after five blocked sessions — `KEEP`, and it is ONE TURN
  SHORT of powered** (31 instrumented matcher turns against `MIN_INSTRUMENTED_TURNS`
  = 32). Reported exactly as the code returns it, not renegotiated.
- **§23 IS ANSWERED.** The tight energy probe fired for the first time:
  `tightDelta -60` against committed 60 — **MATCHES**, which is §23's SECOND
  branch. The 3x multiplier is NOT the suspect.
- **The `EV support` line PRINTED for the first time ever** (built s78,
  unreachable s82, fixed s84, silent until now).
- **⚠ THE 20 CASTS FALSIFIED A STRUCTURAL CLAIM IN THE MEMO §28 IS ASKING THE
  USER TO RULE ON.** `neither = 0` is now `neither = 6`. GATE 0 is what makes
  this visible rather than silent.

## What works
- **§1 / GATE 0 — the memo's denominators are FROZEN as `CORPUS-2026-08-23A`**,
  pinned BEFORE the first cast (commit `8f0f55fb`).
  `handoff/reports/session-86-corpus-snapshot.md` carries the predicate, the
  148-docId roster, and every denominator with the filter that produced it.
  One header line added to the memo and one to QUESTIONS §28. **Nothing was
  recomputed and no memo number moved.**
  - Predicate uses what the loader already supports:
    `{ docId : createdAt <= "2026-08-23T00:20:47.236Z" }`, the corpus MAXIMUM
    (cast `13041486`), not a round number. A date-granularity cut would NOT
    have worked — the batch carries the same calendar date.
  - Re-derived and reproducing the memo exactly: 148 traces / 147 clean / 147
    resolved / **612 plays under `playCount`**, era 94+54 casts, 410+202 plays.
  - ⚠ plays is **612 under `playCount`** and **760** under
    `turns.filter(x => x.play !== undefined)`. Both written down.
- **§2 / GATE 1 — 20 casts spent, exit 0, no guard trip.** Both ledgers agree
  at 20/20; corpus **148 → 168 casts, 612 → 699 plays, 147 → 167 resolved**.
- **§19's verdict, as the code returns it** (`--last-casts=20`, 87 rows):
  ```
    library at batch time:  3 patterns, support 23/167 clean casts, pi0 0.142
    instrumented turns:     31 REAL, 0 predating the field (no rule-10 issue)
    pi:  n=31  min 0.141  p25 0.145  median 0.150  p75 0.242  max 0.735
         <=0.15  48.4%    >0.5  19.4%
    base hit rate:          34.5% (87 turns)
    crossings:              2 casts, BOTH beat base (13055877 50.0%, 13055908 60.0%)
    opening focus:          n=20 mean 0.800  95% CI [0.435, 1.165]
    VERDICT: KEEP — verdictIsPowered FALSE (31 of minimum 32)
  ```
  **A whole-file run (95 turns) returns KEEP *powered*,** so both scopes agree
  on direction. This batch's pi ran HIGHER than history (>0.5 on 19.4% of turns
  against 6.3% whole-file).
- **§3 / GATE 2 — run `25035508`, death @ room 8, 7008 Hard Core, juiced, 60
  energy.** Above the modal room 3–5 death. Rule 11 satisfied in every clause:
  `--juiced --juiced-index=3 --runs=1`, 3x itemId 131 loaded from stock 23,
  per-run human go-ahead obtained, stopped and handed back, never chained.
  `--dry-run` first (the path had not executed in five sessions).
  - **§23 probe: `86 -> 26, tightDelta -60` against committed 60 — MATCHES.**
    Run-level accounting still shows the -1 (`86 -> 27`, observed 59), so the
    credit lands DURING the run, not at `start_run`. Regen (18/hr, integer
    pool) is the leading candidate. **NOT asserted, and the drift was NOT
    fixed** — §23 says not to before the probe speaks.
  - **`EV support: 0/49 decisions were fully modelled; 49 (100.0%)
    unsupported.`** 100% is EXPECTED under rule 8, which selects modified
    enemies. Not a fault.
  - **Rule 13 discharged: `dayProgressEntities` 0 → 3**, exactly one juiced
    run. No discrepancy, nothing denied or interrupted.
  - First-attempt failures **0/60** across every action class.
- **A first-ever boon pair arrived free: `WeakeningMastery`** (states 059→060).
  It has a pair and no model. `boonCapture` stayed OFF — this is the thing that
  block exists to buy, and it was not armed to get it.

## What's broken
- **THE SUITE IS RED, 70 assertions across 11 files, LEFT RED DELIBERATELY.**
  The user chose (c) "leave the whole suite red and go straight to recap" when
  offered the alternatives. **Most failures are corpus counts moving and are
  mechanical. THESE ARE NOT, and must not be silently rewritten to match:**
  - **`neither = 0` → `neither = 6`** (`castEra.test.ts:189`). The memo §5
    states this as a STRUCTURAL claim: "in today's era there is not one play
    where both the held hand and the redrawn triple are dead." Twenty casts
    produced six. **It is false now.**
  - **Dead hands today 15 → 32.** The memo's self-declared weakest joint
    (rescue 15/15, 95% CI [79.6%, 100.0%], n=15) has 17 more observations
    against it. Re-reading it is a NEW row beside the frozen one, never over.
  - **`wasted` structurally zero at every threshold → 3.** Downstream of the above.
  - **The "THIRTYFOLD drop" in budget-zero incidence is now ~6.5x.** Today's
    era goes 54 casts / 202 plays / 3 budgetZero → **74 / 289 / 20** (1.5% →
    6.9%). Catch rate today 34/54 → 46/74 (63.0% → 62.2%, essentially flat).
  - **SPEC-fishing §4's "three documented exceptions" to the `fishHp` rule is
    now SIX.** Three new exceptions — a SPEC-relevant finding, NOT a count.
  - **`REAL_DECK` no longer matches the account's rod.** Grant table expected
    `[1..10]`, corpus now yields `[1,2,3,4,5,6,74,75,76,78]` — the batch's
    catches resolved `cardsToAdd` offers and `fullDeck` reached 21.
  - `boons.test.ts` fails on the new `WeakeningMastery` pair having no model.
- **Focus Oil stock is ZERO** (Relaxing 36). Casts repeatedly logged
  `on-demand wanted the Mid Focus Oil — NONE HELD`; cast `13055941` flagged
  OIL-POLICY-DRY with 5 triggers / 0 spent, excluded from both outcome arms.
  **The standing add-2-vs-restore-to-2 capture could not have fired** — there
  was nothing to consume. Not arranged, per the brief.
- **QUESTIONS §28 is still OPEN and still blocks §26.** No shadow
  instrumentation written. `redrawEnabled` false, `REDRAW_THRESHOLD` untouched.
- Carried, untouched: the gate-1 re-audit (every no-aim-arm figure); the two
  unpaid redraw correctness gaps (`liveFishing.ts:2471`, `:1526`); the pacing
  term's cause; H2's proc model; `play_cards`/redraw/`use_fishing_item`
  unrouted; §0a NOT lifted, **+19.40pp MAY NOT BE QUOTED**; three Big Heals do
  not save a run; the crit rule still needs a base-6/8/10 crit (not seen).

## Corrections to SPEC.md
- **None applied to SPEC.md this session** — the `fishHp` exception count moving
  3 → 6 IS a SPEC-fishing §4 correction, but the three new exceptions were not
  characterised before the user called the recap, and writing "six" without
  saying which three would be worse than leaving it. **This is the first item
  for session 88.**
- **Two corrections to the session-87 BRIEF, both rule 9, both pre-batch:**
  - **"§19 is now one command behind the batch" is FALSE.** The turns had
    ALREADY accrued in sessions 60–85's casts: a whole-file run BEFORE the
    first cast returned **KEEP, powered, on 95 instrumented turns.** §19 was
    one command behind *someone running it*, not behind this session's casts.
  - **The brief's library support is stale.** Brief: "11 of 88 clean casts,
    pi_0 ≈ 0.133" (session-55 figures). Measured at batch time: **22/147
    clean casts, pi0 0.154**; after the batch, **23/167, pi0 0.142**.
- Unchanged: resolved IDs forbiddenWoods=5, dendren nodeId="5"/pondId=2. Move
  charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Backgrounding a 20-cast batch as ONE uninterruptible command.** The user
  said "stop at 10 casts" and the instruction could not land — the batch had
  already finished. **Run live batches in chunks a stop can reach.** This is
  the session's most important lesson and it cost 10 casts of user intent.
- **`find fixtures -type d -empty -delete` during the recap.** Intended to
  remove the two dry-run stubs; removed ~60 historical empty `raw/` dirs and
  three `.claude` stubs too. **Harmless — git does not track empty directories,
  no tracked file was removed, `git status` unchanged at 24 entries** — but the
  glob was far wider than the intent. Scope such cleanups to named paths.
- Standing, none re-opened: redraw CLOSED; energy is never a blocker;
  `--dry-run` before claiming a blocker; do not revert rule 8; +19.40pp
  SUSPENDED; `boonCapture` OFF; no H2 proc model; no M4 lines; no 429 backoff
  without an observed 429; do not shuffle the random-sample deck; do not import
  `todaysEraCastIds()` into a committed test; do not read `SIM blind` as a live
  proxy; do not restate session 86's finding without the word **UNIFORM**.

## Metrics
- **Live: 20 fishing casts (240 energy) + 1 juiced dungeon run (60 energy).**
  Fishing ledger 20/20 (BLOCKED until 11:00 PT). `dayProgressEntities` 3 of 12
  — **9 units / 3 juiced runs remain today.**
- Dungeon run `25035508`: death @ room 8, 7008 Hard Core, 0/60 first-attempt
  failures, 7 boon types picked, 4 unmodelled offered, UNMODELLED_TYPES 24.
- Corpus **148 → 168** casts, **612 → 699** plays, **147 → 167** resolved.
  Dungeon attempts **67 → 68**.
- Suite **1666 passed / 0 failed → 1603 passed / 70 failed** (1673 total, 99
  files). `tsc` clean. **The regression is entirely corpus-count pins and the
  claim reversals listed above; no source file was edited this session.**

## Open questions for Claude
1. **How should the contradicted pins be handled?** The user was offered
   (a) mechanical counts only, (b) update everything and record each reversal
   in DECISIONS, (c) leave red and recap — **and chose (c).** So session 88
   inherits a red suite by design. The substantive question is unchanged:
   `neither = 0` was pinned as a STRUCTURAL claim and is now false. Rewriting
   it to match new data is the renegotiation `matcherVerdict.ts` exists to
   prevent, so it belongs to the user, not an agent.
2. **§28 is still the live one and it is the user's** — and it is now being
   asked against a memo whose §5 structural claim the newer corpus contradicts.
   The frozen figures are still the right thing to rule on; whether the
   contradiction changes the ANSWER is exactly the user's call.
3. **§19 needs ONE more instrumented matcher turn** to convert `KEEP
   (unpowered)` into `KEEP (powered)` at the batch scope. Cheapest possible
   follow-up: it will arrive in the first cast or two of the next batch.
4. **§23's remaining half:** the charge is confirmed 60 and the −1 is credited
   back DURING the run. Identifying what credits it is a new, cheap, offline
   question — the run log for `25035508` has every state.
5. **Three unclaimed captures remain:** a base-6/8/10 crit (card 10 is in the
   deck, not seen this run); an oil consumed at a NON-ZERO meter (**impossible
   until Focus Oil stock is non-zero — it is 0**); and now a **model for
   `WeakeningMastery`**, whose first-ever pair is in this session's fixtures.

## Files changed
```
 2 commits (8f0f55fb gate 0, + this recap).

  A  handoff/reports/session-86-corpus-snapshot.md  +238  the frozen snapshot
  M  handoff/reports/session-86-redraw-revisit.md     +8  one header line
  M  QUESTIONS.md                                     +8  §28 header line
  A  handoff/scratch-session-87.md                   +60  surprises as they landed
  A  fixtures/fishing-casts/live/cast-2026-08-24-*    20 new cast dirs
  A  fixtures/dungeon-runs/run-2026-08-24-00-14-01     run 25035508
  M  handoff/reports/dungeon-runs.md, fishing-casts.md      regenerated
```
