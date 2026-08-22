# session 64 — 2026-08-21 — oil-trigger reachability, and the wire that was never connected

Commit at handoff: `b2cd62a`. Three commits: `7414f40`, `2864acf`, `b2cd62a`.
Suite 1180 → **1202**. Ledger day 2026-08-20 throughout (session ran 08:10–08:45
PT, before the 11:00 rollover).

**GATE PASS, both halves.** But the gates are not what mattered this session.

---

## 0. The one-paragraph version

The brief asked for a free corpus analysis to check whether the shipped oil
policy's triggers can fire in live play at all. They can — the Focus trigger is
reachable in ~57% of casts, so the +17.74pp it carries is not a sim artifact.
The brief then authorised a batch to capture a live consume. Six casts produced
none. **The cause was not the trigger model: `main()` never handed the oil
config to `runOneCast`, so every spend was refused with "no `dendren.oils`
block" while that block sat in `config/bot.json` marked approved.** Fixed, and
the very next cast consumed an oil — the first in the project's history, which
settled four mechanics at once and broke three claims that were on the books.

---

## 1. §1 — the reachability analysis

### Definitions, which are the whole question

A **decision point** is a captured board state where the live loop actually got
to choose:

1. the fish was ALIVE (`fishHp > 0`), and
2. a `play_cards` response exists strictly LATER in the same cast.

Clause 2 is "with a turn remaining". Clause 2 is **empirical**, not structural —
it asks whether a later turn was actually captured, not whether the rules would
have allowed one. So a killed process under-reports, and `incomplete` (1 cast)
is reported separately rather than folded into the rates.

Ordering within a cast is by the server's `updatedAt`, with the file path as a
tiebreak. Filesystem order will not do: a killed-and-resumed process writes
later turns of the same `docId` into a different directory.

The analysis calls **`onDemandTriggers`**, the shipped function the live loop
calls — not a paraphrase. Held stock is passed as zero and ignored, because that
function is stock-blind by construction and the question is reachability, not
affordability.

### Results (102 casts, post-batch; 95 at first run)

```
                    at 95 casts        at 102 casts
FOCUS   reachable   56 (58.9%)         58 (56.9%)   187 turns
RELAX   reachable    9 ( 9.5%)         10 ( 9.8%)    10 turns
either              60 (63.2%)         62 (60.8%)
both                 5 ( 5.3%)          6 ( 5.9%)
neither             35 (36.8%)         40 (39.2%)
decision points    413                443
```

**The clause is load-bearing.** Dropping it: Focus 58 → **72**, a 14-cast
inflation, in the flattering direction. The population it wrongly admits is the
ESCAPED cast — a cast ends when the focus budget is spent, so an escape's final
state is `focusMeter: 0` with the fish still alive. 83 of 102 casts escaped, so
this is the common case.

### The finding nobody asked for — §3's confound, measured

```
                caught (15/95)   escaped (80/95)
Focus reachable     33.3%            63.8%
Relax reachable     46.7%             2.5%
```

The two triggers select **opposite** populations. Focus fires in casts going
badly; Relaxing in casts going well. The brief argued this confound from first
principles and forbade an oil-vs-non-oil catch comparison; it is now a
measurement. No such comparison was reported.

### Calibration

The sim implies ~32% of casts consume nothing. The corpus says **36.8%** have
neither trigger reachable (at 95 casts). Closer than session 63's single cast
suggested.

---

## 2. The bug

### What the log said, batch 1 cast 1

```
▸ turn 4: card 48 @ focus [2,3] (P_hit 0.40, ev 1.0)
  · on-demand wanted a focus oil here — NOT spending: no `dendren.oils` block
    in config/bot.json — silence is not authorization (the session-24 lesson…)
▸ turn 5: card 1 @ focus [2,3] (P_hit 0.37, ev -0.1)
  · on-demand wanted a relaxing oil here — NOT spending: no `dendren.oils` block…
  · on-demand wanted a focus oil here — NOT spending: no `dendren.oils` block…
```

Three trigger firings in one cast, all refused. `config/bot.json` has the block,
with `policyApproved: true`, and `src/orchestrator/config.ts` maps it correctly
onto `BotConfig.dendren.oils`.

### The actual defect

`LiveFishingDeps.oilBudget` is **optional**, and `main()`'s `runOneCast({…})`
call literal omitted it. `deps.oilBudget` was therefore `undefined` on every
live cast since the policy shipped in session 62. `grep -n "oilBudget"` over
`scripts/liveFishing.ts` returned exactly two hits: the interface field and the
`mayConsumeOil` call site. Nothing assigned it.

### Why it survived three sessions

1. **The field's own doc comment.** *"Deliberately not a path field… omitting it
   writes nothing anywhere, it only makes the loop more conservative."* True —
   and it makes a permanently-omitted dependency read as a safe default rather
   than a dead feature.
2. **The test chain stopped one link short.** `tests/fishing/oilPolicy.test.ts`
   has, since session 62:
   ```
   it("passes the config block through rather than assuming one", () => {
     expect(call).toMatch(/configured:\s*deps\.oilBudget/);
   });
   ```
   That pins `runOneCast → mayConsumeOil`, which was always correct. Nothing
   pinned `main() → runOneCast`. The untested link was the **optional** one,
   which is exactly where the gap hides: omitting it typechecks.

### The fix, and the test

`oilBudget: config.dendren?.oils` in main()'s literal, plus a source-scan test
on that literal. Source-scan because there is no type error to catch and no
return value to assert — the defect is an **absent property**, and absence has
to be asserted against. Removing the line fails the new test; demonstrated,
restored green.

**Generalised rule, in DECISIONS: an optional dependency needs its POPULATION
tested, not just its use.**

---

## 3. The batches

### Batch 1 — 6 casts, pre-fix, halted `clean_cast_cap`

| cast | turns | outcome | oils | note |
|---|---|---|---|---|
| 1 | 7 | CAUGHT | 0 | 3 trigger firings, all refused by config |
| 2 | 3 | escaped | 0 | |
| 3 | 3 | CAUGHT | 0 | |
| 4 | 1 | CAUGHT | 0 | one-turn catch |
| 5 | 3 | escaped | 0 | |
| 6 | 2 | escaped | 0 | |

Energy 419 → 347, observed delta 12/cast, committed 12/cast, reconciled every
cast. Ledger 6 → 12 of 20 (rule 13, read after).

**§2c's pre-registered interpretation does NOT apply to this batch.** Six clean
casts is ~1-in-900 under the sim's model *if the policy is running*. It was not.
This is evidence of a bug, not of a wrong trigger model. §2c stays
pre-registered for a batch against fixed code.

No cast was flagged OIL-POLICY-DRY, and that is correct: stock was held (Focus
23, Relaxing 1), so this was a config refusal, not the bag running dry. The six
pool into the non-oil arm — nothing was consumed and play was identical to clean
play.

### Batch 2 — 1 cast, post-fix, halted `oil_consumed`

The user was asked before this batch (the brief carries an explicit "do not
extend past six clean casts", written under a premise the bug had invalidated)
and chose "Run a fresh batch now".

```
▸ turn 6: card 38 @ focus [2,3] (P_hit 0.96, ev 4.5)
★ on-demand METER trigger: focus meter at 0/3 (23 Focus Oil held) — using one.
✓ use_fishing_item (942): fish now 4/21, focus 2/3, mana 3 -> 3
▸ turn 7: card 79 @ focus [2,2] (P_hit 0.71, ev 2.4)
…
▸ cast over: escaped after 10 turns
▸ BATCH HALT (oil_consumed) — the intended exit. Stopping for recap.
```

Cast `13019015`. Ledger 12 → 13 of 20. 7 casts remain.

---

## 4. §2e — the consume, in full

### Request / response

```json
POST { "action": "use_fishing_item", "actionToken": "1787326437363",
       "data": { "cards": [], "nodeId": "", "focusPoint": [],
                 "itemId": 942, "slotIndex": 0, "tierId": 0 } }

->   { "success": true, "message": "Item used successfully." }
```

### Board state across it

`fixtures/fishing-casts/live/cast-2026-08-21-15-33-40/`

```
state-007  Cards played successfully.  fishHp 4  focus 0  pos [1,2] prev [1,4]  consUsed 0  slots [F,F,F]
state-008  Item used successfully.     fishHp 4  focus 2  pos [1,2] prev [1,4]  consUsed 1  slots [T,F,F]
state-009  Cards played successfully.  fishHp 8  focus 1  pos [1,4] prev [1,2]  consUsed 1  slots [T,F,F]
```

Events:

```
state-007  ['FISH_MOVED', 'CARD_PLAYED', 'HIT', 'FISH_HP_DIFF']
state-008  ['FOCUS_STAMINA_DIFF', 'use_fishing_item']          <- no FISH_MOVED
state-009  ['FISH_MOVED', 'CARD_PLAYED', 'FISH_HP_DIFF']
```

`lastMovePath` `[3,2]` on both 007 and 008; `nextCardIndex` 9 on both; `hand`
`[76,79]` on both; `discard` identical on both.

### What this settles

- **`slotIndex: 0` CONFIRMED for item 942.** Reflected back as
  `fishingConsumableSlotUsed[0] = true`.
- **+2 exactly.** `focusMeter` 0 → 2 against `focusMeterMax: 3`.
- **No turn cost.** No `FISH_MOVED`, no card leaves the hand, `nextCardIndex`
  unmoved. **This resolves the mechanic `oilTiming.ts` scored BOTH ways** for
  want of a single observation. The free-consume arm is the FAVOURABLE one, so
  no existing policy ranking is invalidated.
- **No mana.** 3 → 3, confirming a claim that was user-stated.
- Balance Focus 23 → 22.

### What it does NOT settle

`slotIndex` for **Mid Relaxing Oil (937)**, and the index for a **SECOND
consume within one cast**. Relaxing stock is 1; the Relaxing trigger is
reachable in ~10% of casts. **The risk surface is not retired.**

---

## 5. Three claims the one cast broke

Each surfaced as a test failure, not by inspection.

### 5a. `castTrace` counted the item response as a TURN

The item response repeats the preceding turn's `previousFishPosition`, so the
continuity check broke, `continuous` went false, `isCleanTrace` returned false,
and **the entire oil cast dropped out of the movement corpus**. That inverts
§4b, which pools movement quantities across the oil arm precisely because an oil
changes what we spend and not what the fish does. **Every future oil cast would
have been dropped, silently.**

Fixed by skipping `"Item used successfully."` (`ITEM_MESSAGE`) — the same
treatment `LOOT_MESSAGE` has had all along for the same reason. clean 100 → 101,
play turns 429 → 439; the only remaining non-clean trace is session 45's
resumed cast `12975152`.

This is session 63's `shield.currentMax` dead end in fishing costume: a response
that re-reports its predecessor's state, read as a fresh event.

Cost of the fix, recorded: the trace no longer contains the snapshot in which
the meter reads its post-restore value. The restoration is still visible in the
next real turn; a reader reconstructing the budget turn-by-turn should consult
the raw fixture.

### 5b. "focusMeter never regenerates within a cast" is FALSE as written

A Focus Oil is a regeneration by design. The audit reported exactly one
violation: `13019015 t7->8: moved 1, meter spent -1`.

Scoped to **CARD PLAY**. `auditFocusMeter` now skips transitions where
`consumablesUsed` increased and reports **`oilSkipped`** — counted, never
silently dropped, because a count that quietly shrinks is how a denominator
stops meaning anything. Detected off the server's own field, not a repo-written
flag, so it cannot be forgotten and applies retroactively.

Post-fix: scored 441, agree 441, regen 0, oilSkipped 1. `auditFishHp` 442/442,
crits 13.

### 5c. My own comment, falsified 90 minutes after I wrote it

In `tests/fishing/oilReachability.test.ts` I wrote *"The Relaxing trigger is
unaffected: a lethal fish is never the last state."* True across 101 casts.
Cast 13019015 **escaped at `fishHp: 1`** — alive, at lethal range, on the
terminal state, with no turn left to spend into. The lax definition calls that
reachable; it was not.

So the clause now demonstrably defends **both** triggers on real data.

---

## 6. §19 crossed

`pi` exceeded `PI_DECISION_THRESHOLD` (0.5) for the **first time ever** — cast
13019015, max **0.727**, visible in the live log as `matcher π=0.727 (n=2)`.

```
verdict          INSUFFICIENT_DATA -> KEEP
activeTurns      7 -> 20     (MIN_INSTRUMENTED_TURNS 32)
turnsRemaining   12
verdictIsPowered false
crossingCastIds  ['13019015']
distribution     n=20, min 0.130, median 0.139, max 0.727,
                 fractionAboveDecisionThreshold 0.05
```

KEEP is an EXISTENCE claim and fires at any n — the minimum gates the DROP arm
only, which the suite already asserted independently. Session 60's own comment
predicted this exactly: *"When the corpus finally crosses N this test starts
asserting DROP-or-KEEP on its own, which is the rule working."*

The test was rewritten to assert the crossed state, pinned on the rule's
conditions and inequalities rather than the literal 20 — same discipline session
60 imposed. **The payoff half is still unpowered and both `verdictIsPowered:
false` and `turnsRemaining > 0` are asserted**, because a KEEP is a comfortable
answer and easy to misread as the question closing. Session 51's DROP stays
preserved verbatim.

---

## 7. §4 — the carried `previousFishPosition` trap

Session 63 left `previousFishPosition: [0, 0]` in three `tests/liveFishing.test.ts`
mocks, fearing a change could shift matcher-derived expectations. **It cannot:**
nothing in the live decision path reads the field. `grep` for `.previousFishPosition`
outside `castTrace.ts`, `movePathAudit.ts` and the schema returns only
`KNOWN_DOC_DATA_KEYS`, an allowlist. Both consumers are offline audits over
fixtures.

**Correction to the brief (rule 9, fourth occurrence).** It said the live wire
reports `[4,4]` there. The corpus says the server sends **all 16 on-grid cells**
across 75 `state-000` captures; `[4,4]` is 3 of them. `[0,0]` is **0 of 75**.

Replaced with `fishPosition` — on-grid **by construction** however the caller
moves the fish, and a state the server really sends: prev == current in **94 of
522** committed states.

---

## 8. Smaller things, recorded

- **The zero-streak tripwire was computed nowhere outside tests.** Exactly the
  "sentence about a safeguard" its own header rails against. Now seeded from the
  corpus via a new `castOutcomesChronological` (ordered by each cast's earliest
  `updatedAt`, dropping incomplete casts per `evaluateZeroStreak`'s own
  contract) and extended per cast. It read **0**, independently matching session
  63's recorded reset — which is what validates the new ordering.
- **`readDayDocs` extracted to `src/api/fishingLedger.ts`.** `liveFishing.ts`
  could not import `checkFishingCaps.ts` for it: that script calls `main()` at
  module scope, so importing it fires a live request as a side effect of a type
  import, and it imports `liveFishing.ts` back — the cycle would close.
  Behaviour byte-for-byte identical, verified by re-running the script.
- **`FishingCorpusResponse` gained `board` + `updatedAt`**, additive; every
  count `summarizeFishingCorpus` produces is untouched by the addition. Missing
  scalars default to **NaN, not 0** — 0 is meaningful for both `fishHp` (dead)
  and `focusMeter` (the trigger's exact condition), so defaulting to it would
  manufacture firings out of parse failures.
- **`loadFishingCorpus` already skips `raw/`.** Investigated because every
  fixture exists twice locally (redacted + untracked `raw/`, differing only in
  `PLAYER_CID`). Not a bug; noted so the next reader does not re-investigate.

## 9. Census, every delta reconciling with this session's 7 live casts

```
fishingCorpus  95 -> 102 casts, 522 -> 562 docs, 414 -> 443 turns,
               15 -> 18 caught, 79 -> 83 escaped, incomplete 1 unchanged
castTrace      95 -> 102 traces, 94 -> 101 clean, 410 -> 439 play turns
stateFields    10 -> 13 crits
oil arm        1 -> 2 oil casts (12975152 inherited, 13019015 ours)
reachability   Focus 56 -> 58, Relaxing 9 -> 10, decision points 413 -> 443
```

`playTurns` (443) counts the `use_fishing_item` response, which is not a turn;
`castTrace`'s 439 excludes it. The two differ by 1 plus the resumed cast, and
that is expected rather than a discrepancy.

## 10. Verification at the final commit

```
npx tsc --noEmit    clean
npx vitest run      67 files, 1202/1202 passed
git diff --check    clean
secret scan         0 matches for 0x[a-fA-F0-9]{4,} | noobId \d | eyJ | PRIVATE
                    across the full session diff (7414f40~1..HEAD)
.gitignore          .env, *.key, data/, logs/ covered.
                    config/discovered.json deliberately NOT ignored (session 60,
                    game-global) — re-verified clean of secrets.
no test writes a real data path
```

Ledger at handoff: **7 fishing casts of 20**, **0 dungeon run-units** (12/12
spent). Zero dungeon runs started this session.
