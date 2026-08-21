# STATE — session 65 — 2026-08-21 (PT) — code at commit 841cd13

## Status
**BOTH GATE HALVES PASS.** Suite **1223/1223** (1202 → 1223, +21), `tsc
--noEmit` clean, `git diff --check` clean, secret scan clean across the whole
session diff, no test writes a real data path.

- **Gate 1 PASS** — the oil timing sweep is re-scored on the measured
  free-consume arm, the turn cost is pinned by a test, and the corrected
  headline is reported. It **reproduces the published table exactly**.
- **Gate 2 PASS** — partial dry is handled and tested. Both branches
  demonstrated failing individually (2 tests, then 3), restored green. It then
  **executed live the same session**, on casts 2 through 7.

**THE SESSION'S HEADLINE IS THE THING NEITHER GATE ASKED FOR:
`slotIndex` was never a constant, and a hard-coded `0` had been correct since
session 44 only because no cast had ever wanted a SECOND oil.** The first cast
that did got HTTP 400, and the rejection poisoned the action token. See "What's
broken" §1.

**Caps at session end: 0 fishing casts left (20/20 spent — exactly the seven
this brief authorized, 13→20), 0 dungeon run-units (12/12, already spent on
arrival).** The session ran entirely BEFORE the 11:00 PT rollover, so the
ledger day was still 2026-08-20. **Zero dungeon runs were started.**

**Rule 13 exercised after every batch.** Ledger read 13→17→19→20, matching the
casts sent exactly. No denial or interrupt occurred.

## What works
- **§1, THE LOTTERY HIT ON CAST ONE.** The brief priced a seven-cast batch as a
  ~51% shot at the Relaxing trigger firing at all. It fired immediately:
  `use_fishing_item (937)` at `fishHp 1/23` → `0/23` → **CAUGHT**.
  **`slotIndex: 0` CONFIRMED for Mid Relaxing Oil (937)**, mana `6 → 6`.
  The last named mechanical unknown on the oil path is closed.
- **The slot CURSOR, fixed and then confirmed live.** `nextConsumableSlot`
  reads the server's own `fishingConsumableSlotUsed` and fails closed both
  ways (absent field → `null`, full ledger → `null`, never a wrap-around).
  **The same cast that exposed the bug then proved the fix:** 13019682 was
  abandoned mid-play by the desync, persisted server-side, was resumed against
  fixed code, and consumed **three** oils in total walking slots 0, 1, 2 — one
  before the bug bit, two after the fix.
- **Partial dry, live.** The Relaxing Oil was spent on cast 1, putting stock at
  Relaxing 0 / Focus 22 — a state no code path had ever executed. Casts 2–7 ran
  it: OIL-POLICY-DRY recorded for Relaxing, Focus consuming normally in the
  same cast, batch not halting. Tested BEFORE it could happen, not after.
- **§19 is POWERED and CLOSED — KEEP at n=35.**
- **The sweep re-run.** on-demand +19.40pp [+19.39, +19.41], robust at effect
  amounts 1/2/3 (+13.89 / +19.40 / +21.99).

## What's broken
1. **FIXED THIS SESSION, and it is the session's real finding: `slotIndex` was
   hard-coded to `0` at the consume call site since session 44.** Cast
   13019682 spent a Focus Oil at slot 0, hit `focusMeter: 0` again two turns
   later, and sent a second consume at slot 0 against
   `fishingConsumableSlotUsed [T,F,F]` → **HTTP 400**. The constant was never
   wrong before because no cast had ever wanted a second oil. **A value
   "confirmed live" on n=1 of a repeatable action is confirmed for the first
   occurrence only.**
2. **FIXED: a rejected `use_fishing_item` ADVANCES THE SERVER'S ACTION TOKEN.**
   The call site's comment claimed it "fails closed via the catch block, not a
   GuardTrip — an optional rescue, not a required step." Live play falsified
   that: the next `play_cards` died on
   `Invalid action token 1787330936730 != 1787330937735`.
   `postFishingAction` throws before assigning the response token, so the
   client never learns it, and the failure surfaces ONE TURN from its cause.
   **There is no resync — `GET /fishing/state` carries no `actionToken`** — so
   the loop now fails closed at the rejected consume, naming it.
   **Not destructive:** the cast persists server-side and the next invocation
   RESUMES it (no `start_run`, no energy, no ledger entry).
3. **The `nextPosition` override ARMED for the first time and has never seen a
   MISS.** 12 validation entries, 12 hits, across 9 casts; Wilson lower bound
   72.2%. It is now a LIVE input to card choice, not a dormant safeguard.
   **Do not read 72.2% as a measured accuracy** — the bound has only ever been
   observed climbing.
4. Carried: corrode modelled but inert in `dungeonSim` (**now a CLOSED
   decision, not an open question**); a perpetual corrode would be
   under-modelled; 25 analysis scripts hold hardcoded paths; `boonCapture`
   stays OFF; distribution steps 3–6 remain the user's.

## Corrections to SPEC.md
- **`slotIndex` is a CURSOR over the server's three-slot ledger, not a
  constant.** SPEC-fishing's "Still NOT confirmed" paragraph is replaced with
  the three findings that closed it. `fishingConsumableSlotUsed` and
  `consumablesUsed` are promoted out of the schema's `passthrough()`, because
  the loop now READS them rather than merely recording them.
- **`slotIndex: 0` CONFIRMED for Mid Relaxing Oil (937)** by our own consume.
  Mana `6 → 6` — the second independent confirmation that consuming costs no
  mana, after 942's `3 → 3`.
- **A rejected `use_fishing_item` still advances the server's action token**,
  and no endpoint can resync it. Recorded in SPEC-fishing §4a.
- **A correction to the BRIEF, not to SPEC (rule 9, fifth occurrence).** The
  brief said the +19.40pp headline "was computed across both arms." It was
  not — OIL-POLICY.md's table is labelled `costsTurn=false, amount=2, n=8000`
  and `main()` has always judged robustness on those rows alone, printing
  "ARTIFACT BRANCH" over the others. **The recommendation never depended on
  the unresolved mechanic, so measuring it corrects no published number, and
  +19.40pp may be quoted again.**
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Do not read an `UNKNOWN FIELD` banner as a server change.** I nearly
  reported `data.nextPosition` as newly appearing. It has fired on ~1–2% of
  responses since session 30 and has a whole validation/override section built
  on it; the banner fires because the field is off the known-keys list.
  **Rule 10 in miniature — a warning that first APPEARS today is not an effect
  that first HAPPENED today.**
- **Do not assume a mock that omits a field is merely simpler — it is a
  DIFFERENT SERVER.** `fishingConsumableSlotUsed` is on every live state; two
  test mocks omitted it, and once the loop started reading it those mocks
  silently sent no consume at all, turning every "it consumes" assertion
  vacuous. Both now track the slot ledger and reject a repeat slot the way the
  server does.
- **Do not stop a batch on an oil consume when the objective is turns.**
  Session 64's exit is session 65's capture; the shapes are named limit sets
  (`SESSION_64_LIMITS` / `SESSION_65_LIMITS`), not retuned constants.
- Standing: never report an energy number as a blocker (rule 12); exercise the
  real gate (`--dry-run`) before claiming a blocker; do not revert rule 8; do
  not re-run rule 8's closed measurement programme; never pipe a live run to a
  truncating reader; do not clamp a fabricated `[0,0]` onto the grid; do not
  count the `use_fishing_item` response as a turn.
- **The recap checklist's `.gitignore` line is FIXED** — flagged stale for
  seven consecutive sessions, corrected this session rather than noted an
  eighth time. It now names what IS ignored and points at
  `tests/discoveredShipsClean.test.ts` as the real check.

## Metrics
- **Live fishing: 7 ledger casts, 8 cast-plays** (one was a RESUME of the cast
  abandoned by the token desync — 0 energy, no `start_run`, no ledger entry).
  **5 caught / 2 escaped.**
  - **4 oils consumed across 4 casts:** 1× Mid Relaxing (937), 3× Mid Focus
    (942). One cast consumed three.
  - Oils held after: **Relaxing 0, Focus 18.** Relaxing 1→0 (the single 937);
    Focus 22→18 = 4 spent, being 1 on cast 13019677 and 3 on cast 13019682.
  - Energy reconciled every cast at 12/cast; ledger 13→17→19→20 of 20.
- **Reachability, corpus-wide (109 casts, 474 decision points):** Focus 60
  (55.0%, 191 turns), Relaxing 12 (11.0%, 14 turns), either 65, neither 44.
  **The lax-vs-strict Focus gap is STILL exactly 14** across three independent
  batches — structural, not sampling noise. The Relaxing gap moved 1 → 2.
- **Sweep, measured arm, n=8000/arm, amount=2:** on-demand 88.11% vs never
  68.71% = **+19.40pp** [+19.39, +19.41], 5578 oils, 0.278pp/oil.
- **§19: 20 → 35 of 32 instrumented turns — POWERED, verdict KEEP.** Two casts
  have crossed `PI_DECISION_THRESHOLD` and both hit above the 28.5% base rate:
  13019015 (π 0.727, 30.0%) and 13019677 (π 0.502, 75.0%).
- **Live dungeon: 0 runs.** Not authorized, and the ledger was already 12/12.
- Corpus 102 → **109** casts. Suite 1202 → **1223** (+21).

## Open questions for Claude
1. **Is the `nextPosition` override safe to leave armed?** It fires on ~1–2% of
   turns, forces focus onto the predicted cell, and has **never been tested by
   a miss** (12/12). Its Wilson gate was built to be conservative, but a bound
   that has only ever climbed is not a measured accuracy. Worth a deliberate
   decision rather than continued drift.
2. **Should the second-consume path be exercised again deliberately?** It is
   fixed and confirmed once (slots 0→1→2 on one cast). Slot 2 specifically has
   exactly one observation. Cheap to accumulate incidentally now that Focus
   stock is 18 and the Focus trigger fires in 55% of casts — probably needs no
   dedicated budget, but say so explicitly rather than assuming.
3. **Relaxing Oil stock is ZERO.** The lethal trigger is reachable in ~11% of
   casts and will now record OIL-POLICY-DRY every time. Crafting is on the
   ask-first list. Does the user want to craft more, or should the recap stop
   reporting Relaxing dry-trigger counts as if they were actionable?
4. **§19 is CLOSED — stop budgeting casts for it and stop reporting turn
   accrual.** Named here so the next brief does not carry it forward out of
   habit.
5. `boonCapture` stays OFF — still zero ordinary runs since the directive.

## Files changed
```
 4 commits (edd1b4b, 30d1a0c, a1f887c, 841cd13). 44 new redacted cast files.

     tests/fishing/oilPartialDry.test.ts  | 444  (new — gate 2, + the slot cursor)
     scripts/liveFishing.ts               | 134  (nextConsumableSlot, token fail-closed)
     src/strategy/fishing/oilBatch.ts     |  96  (SESSION_65_LIMITS, the inverted exit)
     scripts/oilTimingSweep.ts            |  65  (gate 1 — measured arm only)
     tests/fishing/oilReachability.test.ts|  48  (census 102 -> 109)
     tests/sim/fishingCorpus.test.ts      |  47  (census + the 3-consume cast)
     tests/fishing/matcherVerdict.test.ts |  33  (§19 POWERED KEEP)
     tests/fishing/oilTiming.test.ts      |  31  (gate 1 — the turn cost pinned)
     src/strategy/fishing/oilTiming.ts    |  24  (MEASURED_CONSUME_COSTS_TURN)
     tests/fishing/zoneTemplate.test.ts   |  18  (census)
     tests/fishing/oilStockExhaustion.test|  16  (mock now sends the slot ledger)
     src/api/fishing.ts                   |   9  (slot ledger out of passthrough)
     tests/fishing/stateFields.test.ts    |  10  (oilSkipped 1 -> 5, crits 13 -> 17)
     handoff/DECISIONS.md                 |   7  (7 entries)
     SPEC-fishing.md                      |  (the slot paragraph, rewritten)
     .claude/commands/gigarecap.md        |  (the stale .gitignore line, FIXED)
```

---
---

# Session log — verbose appendix (session 65)

## A. The exact failure that exposed the `slotIndex` bug

Cast **13019682**, batch 1, cast 4 of 7. Fixture dir
`fixtures/fishing-casts/live/cast-2026-08-21-16-48-44/`.

```
  · oils held: Relaxing 0, Focus 21 (on-demand policy)
  ▸ turn 0: card 39 @ focus [4,2] (P_hit 0.76, ev 3.0)
  · on-demand wanted the Mid Relaxing Oil here (turn 1) — NONE HELD, playing on
    without it. This cast is flagged out of both arms.
  ▸ turn 1: card 10 @ focus [3,2] (P_hit 0.39, ev 0.9)
  ★ on-demand METER trigger: focus meter at 0/3 (21 Focus Oil held) — using one.
  ✓ use_fishing_item (942): fish now 7/18, focus 2/3, mana 8 -> 8
  ▸ turn 2: card 76 @ focus [2,1] (P_hit 0.99, ev 2.9)
  ★ on-demand METER trigger: focus meter at 0/3 (20 Focus Oil held) — using one.
  ✗ use_fishing_item rejected (HTTP 400) — continuing cast without it
  ▸ turn 3: card 7 @ focus [2,1] (P_hit 0.71, ev 3.4)

✗ Guard tripped: fishing play_cards rejected
  {"success":false,
   "message":"Error tracking action: Error: Invalid action token
              1787330936730 != 1787330937735",
   "actionToken":"1787330936730"}
```

The slot ledger across that cast's own captured states — this is the whole
proof, and it is on the wire, not inferred:

```
state-000  consumablesUsed 0  slotUsed [F,F,F]  focus 3  token 1787330929489
state-001  consumablesUsed 0  slotUsed [F,F,F]  focus 1  token 1787330931819
state-002  consumablesUsed 0  slotUsed [F,F,F]  focus 0  token 1787330933332
state-003  consumablesUsed 1  slotUsed [T,F,F]  focus 2  token 1787330935550  ← 942 accepted
state-004  consumablesUsed 1  slotUsed [T,F,F]  focus 0  token 1787330936730
           → second use_fishing_item at slotIndex 0 → HTTP 400
           → server token is now 1787330937735; client still holds ...936730
           → next play_cards dies
```

**Two independent bugs in four lines.** The wrong slot is the cause; the token
advance on a rejected request is what turned a skipped rescue into a dead cast.
Fixing only the first would have left the second armed for any other rejection
reason.

## B. Why the hard-coded `0` survived 21 sessions

Every oil cast in the corpus before this one used exactly slot 0:

```
12975152  consumablesUsed 1  slotsUsed [T,F,F]   (inherited, pre-capture)
13019015  consumablesUsed 1  slotsUsed [T,F,F]   (session 64, first ever consume)
13019665  consumablesUsed 1  slotsUsed [T,F,F]   (session 65, the 937)
13019677  consumablesUsed 1  slotsUsed [T,F,F]   (session 65)
13019682  consumablesUsed 3  slotsUsed [T,T,T]   (session 65, THE ONE)
```

Session 64 recorded "`slotIndex` for a SECOND consume within one cast is
UNCONFIRMED" and was exactly right to. The value was confirmed for the first
consume and generalised to all of them by the code, not by the evidence.

The per-cast test assertion changed accordingly. It used to be "one oil, slot
0"; it is now the invariant that actually holds — `consumablesUsed` equals the
number of slots marked used, and the used slots form a PREFIX (the cursor never
skips a free slot or reuses a spent one).

## C. Gate demonstrations, in full

```
DEMO A — partial-dry branch removed (continue -> break in the oilWanted loop)
  × records OIL-POLICY-DRY for relaxing, sends use_fishing_item for focus
  × plays the cast to a normal outcome ... records the third state
  Tests  2 failed | 15 passed (17)

DEMO B — stock_dry's && weakened to ||
  × does not stop when ONE oil is dry but the other is held
  × keeps going under the session-64 shape too
  × six clean casts REPORTS but does not halt
  Tests  3 failed | 18 passed (21)

DEMO C — slotIndex regressed to the hard-coded 0
  × records OIL-POLICY-DRY for relaxing, sends use_fishing_item for focus
  × sends slotIndex 0 then slotIndex 1 when the meter empties twice
  × stops sending consumes once all three slots are spent, and plays on
  Tests  3 failed | 16 passed (19)

DEMO D — MEASURED_CONSUME_COSTS_TURN flipped back to true
  × is FALSE — consuming an oil costs no turn
  and the sweep's banner starts reporting the artifact arm as measured
  Tests  1 failed | 18 passed (19)

ALL RESTORED — 1223 passed (1223), tsc clean.
```

## D. The full sweep output, measured arm, n=8000/arm

```
── costsTurn=false   effect amount=2   n=8000/arm (the payload's own value) ──
  policy                  catch   Δ vs never             95% CI   oils  pp/oil
  never                  68.71%     +0.00pp [+0.00pp, +0.00pp]      0       —
  start                  74.38%     +5.66pp [+5.66pp, +5.67pp]  16000   0.028
  on-demand              88.11%    +19.40pp [+19.39pp,+19.41pp]  5578   0.278
  lethal-relaxing-only   73.19%     +4.47pp [+4.47pp, +4.48pp]   1821   0.197
  focus-when-empty-only  86.45%    +17.74pp [+17.73pp,+17.75pp]  3515   0.404
  heuristic-c            73.22%     +4.51pp [+4.51pp, +4.52pp]   2630   0.137

  amount=1 -> on-demand +13.89pp     amount=3 -> on-demand +21.99pp
  ROBUST AT THE MEASURED TURN COST: on-demand wins at every effect amount.
```

Byte-identical to `handoff/OIL-POLICY.md`'s published table, which is the point:
the headline was always the `costsTurn=false` arm, so measuring the mechanic
confirmed it rather than correcting it.

## E. §19's full verdict output

```
── pi distribution over matcher turns ──
  n=35  min 0.130  p25 0.136  median 0.140  p75 0.247  max 0.727
  at or below 0.15: 60.0%   above 0.5: 5.7%
  REPLAY reference (session 50/51, NOT live): median 0.135, 70.5% <= 0.15

  base hit rate over the batch: 28.5% (207 turns)
  13019015  turns 10  maxPi 0.727  hit 30.0%  ← crossed
  13019677  turns  4  maxPi 0.502  hit 75.0%  ← crossed

── VERDICT: KEEP ──
  pi exceeded 0.5 on 2 cast(s), and 2 of those hit above the batch base rate
  28.5%. KEEP is an EXISTENCE claim, so it fires at any n — but the payoff half
  is a sampled comparison, and at 35 instrumented turn(s) it is powered.
```

Pre-registered in the session-65 brief §2 before the batch ran. The rule was
not touched between the pre-registration and this result; only the corpus
changed. **§19 is closed.**

## F. The batch, cast by cast

| # | docId | outcome | turns | oils | note |
|---|---|---|---|---|---|
| 1 | 13019665 | CAUGHT | 4 | 937 ×1 | the ~51% lottery, hit on cast one |
| 2 | 13019672 | CAUGHT | 6 | — | first PARTIAL DRY: Relaxing trigger, none held |
| 3 | 13019677 | CAUGHT | 4 | 942 ×1 | Focus consumes while Relaxing is dry |
| 4 | 13019682 | (trip) | 3 | 942 ×1 | **the slotIndex bug + token desync** |
| 4' | 13019682 | CAUGHT | 7 | 942 ×2 | RESUMED post-fix; slots 1 and 2 |
| 5 | 13019755 | escaped | 2 | — | |
| 6 | 13019756 | escaped | 2 | — | |
| 7 | 13019822 | CAUGHT | 2 | — | |

7 ledger casts (13→20), 8 cast-plays, 5 caught / 2 escaped, 4 oils consumed.

## G. What I got wrong in-session, recorded rather than quietly fixed

1. **I invented a docId.** I referred to the tripped cast as `13019751`
   throughout my first pass — including in DECISIONS, SPEC-fishing, four test
   comments and a commit message — before checking. The real id is `13019682`,
   and it is the SAME cast that later resumed and walked all three slots, which
   is a materially better story than the two-different-casts version I had
   written. Corrected everywhere. **A docId that is never checked against a
   fixture is a plausible-looking number, and this repo's whole method is that
   claims get checked against the corpus.**
2. **I nearly reported `data.nextPosition` as a new server field.** It has
   fired on ~1–2% of responses since session 30. See STATE's Dead ends.
