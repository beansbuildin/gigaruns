# STATE — session 64 — 2026-08-21 (PT) — code at commit 0437f61

## Status
**BOTH GATE HALVES PASS.** Suite **1202/1202** (1180 → 1202, +22), `tsc
--noEmit` clean, `git diff --check` clean, secret scan clean across the whole
session diff, no test writes a real data path.

- **Gate 1 PASS** — the trigger-reachability analysis exists, reports both
  triggers as counts and percentages over the corpus, and its definitions are
  pinned. Removing the "with a turn remaining" clause fails **4 tests**
  (demonstrated, restored green).
- **Gate 2 PASS** — the batch stop logic halts on all five conditions.
  **Each halt demonstrated failing individually** when removed (2/1/2/1/1
  tests), restored green. Precedence is tested too.

**THE SESSION'S HEADLINE IS NOT EITHER GATE.** It is that
**`on-demand` could never have consumed an oil, in any session, because the
config was never handed to the loop** — and that once fixed, the very first
cast consumed one. See "What's broken" §1 and "What works" §2.

**Caps at session end: 7 fishing casts left (13/20 spent), 0 dungeon
run-units.** The session ran entirely BEFORE the 11:00 PT rollover, so the
ledger day was still 2026-08-20. **Zero dungeon runs were started.**

**Rule 13 exercised twice**, after each batch. Ledger read 6→12 then 12→13,
matching the casts sent exactly. No denial or interrupt occurred.

## What works
- **§1, THE FREE TEST, and it retires the brief's worry.** Over the corpus,
  using the SHIPPED `onDemandTriggers` rather than a paraphrase:
  **Focus reachable 58/102 (56.9%), Relaxing 10/102 (9.8%)**, either 60.8%.
  The +17.74pp Focus benefit is **NOT a sim artifact** — the meter reaches
  zero with turns still to play in most casts.
- **The first live oil consume in the project's history**, and every mechanic
  it could settle is settled — see Corrections. `slotIndex: 0` confirmed for
  942, +2 exact, **no turn cost**, no mana.
- **The batch machinery.** `oilBatch.ts` is pure and returns a REASON, not a
  boolean; `--oil-batch` wires it between casts, reading the ledger and the
  balances LIVE rather than inferring them, and failing closed if either read
  fails.
- **The zero-streak tripwire is finally computed.** It was called from tests
  and nowhere else — the exact "sentence about a safeguard" its own header
  warns of. Now seeded from the corpus (`castOutcomesChronological`) and
  extended per cast. It read 0, independently matching session 63's recorded
  reset, which is what validates the new chronological ordering.

## What's broken
1. **FIXED THIS SESSION, and it is the reason for three sessions of "bad
   luck": `main()` never populated `LiveFishingDeps.oilBudget`.** So
   `mayConsumeOil` saw `configured: undefined` on every live cast and refused
   with *"no `dendren.oils` block in config/bot.json"* — while that block sat
   in `config/bot.json` with `policyApproved: true`. Two things hid it: the
   field's own doc comment ("omitting it… only makes the loop more
   conservative") makes a permanently-omitted dependency read as a safe
   default, and `tests/fishing/oilPolicy.test.ts` pinned the INNER hop
   (`runOneCast` → `mayConsumeOil`) and passed throughout. **The chain was
   tested one link short, and the untested link was the optional one.**
2. **`slotIndex` for Mid Relaxing Oil (937) is STILL UNCONFIRMED**, as is the
   index for a SECOND consume within one cast. Stock is Relaxing 1 / Focus 23
   and the Relaxing trigger is reachable in ~10% of casts. **Do not report the
   risk surface as retired.**
3. **§19 is KEEP but NOT settled.** 20 of 32 instrumented turns,
   `verdictIsPowered` false, `turnsRemaining` 12. A KEEP is a comfortable
   answer and easy to misread as the question closing.
4. Carried: corrode is modelled but inert in `dungeonSim`; a perpetual corrode
   would be under-modelled; 25 analysis scripts hold hardcoded paths;
   `boonCapture` stays OFF; distribution steps 3–6 remain the user's.

## Corrections to SPEC.md
- **`use_fishing_item` costs NO turn** — the payload never said, so
  `oilTiming.ts` scored every policy BOTH ways. Measured: the response carries
  `FOCUS_STAMINA_DIFF` and **no `FISH_MOVED`**, and `fishPosition`,
  `previousFishPosition`, `lastMovePath`, `hand`, `discard`, `nextCardIndex`
  are identical across it. No mana either (3→3), confirming a user-stated
  claim. The free-consume arm is the FAVOURABLE one, so **no existing policy
  ranking is invalidated.** SPEC-fishing §4a carries the full envelope.
- **`slotIndex: 0` CONFIRMED for Mid Focus Oil (942)** by our own consume, not
  a DevTools capture. `focusMeter` 0→2 exactly; `consumablesUsed` 0→1;
  `fishingConsumableSlotUsed` `[F,F,F]`→`[T,F,F]`.
- **SPEC's "focusMeter never regenerates within a cast" is FALSE as written.**
  A Focus Oil is a regeneration by design. Scoped to **CARD PLAY**;
  `auditFocusMeter` skips consumable transitions and reports `oilSkipped`
  (counted, never silently dropped). 441/441 agree, regen 0, oilSkipped 1.
- **The brief said the live wire reports `previousFishPosition: [4,4]`.** The
  corpus says the server sends **all 16 on-grid cells** across 75 start_run
  states and `[4,4]` is 3 of them. `[0,0]` is **0 of 75**. Rule 9, fourth
  occurrence — a single observation generalised.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Do not count the `use_fishing_item` response as a TURN.** It repeats the
  preceding turn's move fields, so continuity breaks, `isCleanTrace` goes
  false, and the WHOLE oil cast drops out of the movement corpus — inverting
  §4b, which pools movement across the oil arm precisely because an oil
  changes what we spend and not what the fish does. **Every future oil cast
  would have been dropped.** Skipped now via `ITEM_MESSAGE`, the same
  treatment `LOOT_MESSAGE` already had. Session 63's `shield.currentMax` dead
  end in fishing costume: a response re-reporting its predecessor's state,
  read as a fresh event.
- **Do not drop "with a turn remaining" from a reachability definition.** It
  inflates Focus reachability by 14 casts, in the flattering direction.
- **"A lethal fish is never the last state" is FALSE** — I wrote it this
  session and live play falsified it 90 minutes later. Cast 13019015 escaped
  at `fishHp: 1`, alive and lethal on the terminal state with no turn left.
- **Do not test only the USE of an optional dependency.** Test that something
  POPULATES it. This is the whole of "What's broken" §1.
- **Do not read §2c's six-clean-casts interpretation onto batch 1.** It halted
  at the cap, but the triggers had fired and been refused by the unwired dep.
  Six clean casts was evidence of a bug, not of a wrong trigger model. §2c
  stays pre-registered for a batch against fixed code.
- Standing: never report an energy number as a blocker (rule 12); exercise the
  real gate (`--dry-run`) before claiming a blocker; do not revert rule 8; do
  not re-run rule 8's closed measurement programme; never pipe a live run to a
  truncating reader; do not clamp a fabricated `[0,0]` onto the grid.
- **The recap checklist's `.gitignore` line is stale — SIXTH session.** It says
  to confirm `config/discovered.json` is ignored. It deliberately is NOT
  (session 60, game-global). Re-verified clean of secrets. Everything else on
  that list holds and was re-run.

## Metrics
- **Live fishing: 7 casts across two batches.** 3 caught / 4 escaped.
  - **Batch 1 (6 casts, pre-fix)** — halted `clean_cast_cap`. 3 caught
    (7, 3, 1 turns), 3 escaped. **0 oils consumed, and none could be.**
    Triggers fired 3× in cast 1 alone and were refused by config.
  - **Batch 2 (1 cast, post-fix)** — halted `oil_consumed`, the intended exit.
    Escaped after 10 turns. **One Mid Focus Oil consumed at turn 7.**
  - Oils held after: **Relaxing 1, Focus 22** (Focus 23→22, the one spend).
  - Energy 419→347 then 349→337; observed delta 12/cast, committed 12/cast,
    reconciled every cast.
  - Ledger 6→12→13 of 20, read from `dayDocs` after each batch.
- **Reachability, corpus-wide (102 casts, 443 decision points):** Focus 58
  (56.9%, 187 turns), Relaxing 10 (9.8%, 10 turns), either 62, neither 40.
  **Lax definition: Focus 72 — a 14-cast inflation.**
- **The §3 confound, MEASURED rather than argued:** Focus is reachable in
  **63.8% of escaped** casts vs 33.3% of caught; Relaxing in **46.7% of
  caught** vs 2.5% of escaped. The triggers select opposite populations, so an
  oil-vs-non-oil catch comparison is near-pure selection. Not reported.
- **Sim-vs-live consumption:** the sim implies ~32% of casts consume nothing;
  the corpus says **39.2% have neither trigger reachable**. Closer calibration
  than one cast suggested. A live rate is still n=1 and not reportable.
- **§19: 7 → 20 of 32 instrumented turns, and it CROSSED.** π exceeded 0.5 for
  the first time ever (cast 13019015, max 0.727) → verdict
  INSUFFICIENT_DATA → **KEEP** on the existence arm.
- **Live dungeon: 0 runs.** Not authorized.
- Suite 1180 → **1202** (+22).

## Open questions for Claude
1. **Should the next session spend casts to clear `slotIndex` for 937?** It is
   the last mechanical unknown, and it will not clear incidentally: the
   Relaxing trigger is reachable in ~10% of casts, so an unbudgeted batch has
   roughly a 1-in-10 chance per cast. A deliberate ~7-cast batch would clear it
   with ~52%; there is no cheap route. Worth putting to the user as a cost,
   not smuggling in as a side effect.
2. **`oilTimingSweep.ts` should be re-run now that the turn cost is known.**
   Every policy was scored under BOTH assumptions; one arm is now known to be
   the real one. The +19.40pp headline was computed across both. This is
   cheap, offline, and nobody has done it.
3. **Should corrode be wired into `dungeonSim`?** Unchanged from session 63 —
   modelled and live-wired but inert in sim, because sim enemy profiles carry
   no buff id. Needs a decision on which buff a simulated room's enemy carries.
   A scenario question; still not decided in-session.
4. **§19 needs 12 more instrumented turns to power the DROP arm.** That is
   roughly 4–5 casts. Worth naming as a budget item rather than hoping it
   accrues.
5. **The brief's tables keep carrying unverified claims** (rule 9, fourth
   occurrence this session — `previousFishPosition: [4,4]`). The session-64
   brief's own §7 diagnosed this and asked for provenance in captions; the very
   next table still lacked it. Worth treating as a format rule, not a reminder.
6. `boonCapture` stays OFF — still zero ordinary runs since the directive.

## Files changed
```
 3 commits (ca8db49, 1d435f2, 0437f61). 7 new redacted cast fixtures.

     src/sim/fishing/oilReachability.ts   | 175  (new — gate half 1)
     tests/fishing/oilReachability.test.ts| 190  (new — definitions pinned)
     src/strategy/fishing/oilBatch.ts     | 125  (new — gate half 2)
     tests/fishing/oilBatch.test.ts       | 105  (new — each halt in isolation)
     src/api/fishingLedger.ts             |  70  (new — extracted readDayDocs)
     scripts/oilReachability.ts           |  45  (new — the report)
     scripts/liveFishing.ts               | 120  (--oil-batch, THE oilBudget fix)
     SPEC-fishing.md                      |  38  (§4a the full envelope)
     src/strategy/fishing/oilTiming.ts    |  45  (turn cost RESOLVED)
     src/sim/fishingCorpus.ts             |  75  (board scalars + chronological)
     src/sim/fishing/castTrace.ts         |  40  (ITEM_MESSAGE + consumablesUsed)
     src/sim/fishing/stateFieldAudit.ts   |  30  (oilSkipped)
     tests/fishing/matcherVerdict.test.ts |  55  (§19 KEEP, rewritten)
     tests/sim/fishingCorpus.test.ts      |  44  (census + 2 oil casts)
     tests/fishing/zoneTemplate.test.ts   |  41  (census + oil-cast cleanliness)
     tests/liveFishing.test.ts            |  45  (3 mocks off [0,0])
     handoff/DECISIONS.md                 |   6  (6 entries)
     tests/fishing/oilPolicy.test.ts      |  28  (the OUTER hop pinned)
     tests/fishing/stateFields.test.ts    |  20  (crits 13, oilSkipped)
```
