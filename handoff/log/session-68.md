# SESSION 68 — 2026-08-21 (PT) — commit 23f182f

## Status
**BOTH GATES PASS.** Suite **1293/1293** (1279 → 1293, +14), `tsc --noEmit`
clean, `git diff --check` clean, secret scan clean across the whole session
diff, no test writes a real data path (checked by mtime, not asserted).

- **Gate 1 PASS** — the oil shadow is provably inert: the live decision is
  byte-identical with shadow on and off, **demonstrated failing** when the
  shadow is allowed to influence it, then restored.
- **Gate 2 PASS** — `rejectionAudit.test.ts` can no longer contribute zero
  tests silently, **demonstrated** with the data source absent.

**THE JWT WAS NOT EXPIRED.** The brief opened with a stop-work order based on
session 67's decode; `doctor.ts` said **valid for another 166.3h**. The user had
refreshed it. The live half of the session went ahead.

**FIVE LIVE CASTS RUN, exactly as authorized.** Ledger `dayDocs[pond 2]` 0 → 5,
repo ledger agrees, 15 casts left. 3 caught / 2 escaped, 3 oils consumed.

**`conserve(r=1,f=1)` is NOT shipped.** `policyApproved` still false,
`liveFishing.ts` still plays `onDemandTriggers`.

## What works
- **§1 THE SHADOW, and it is inert by construction rather than by assertion.**
  `snapshotOilDecision` hands the gate a frozen DEEP COPY (freezing the live
  `deckCardData` in place would itself be a side effect — the copy is what gets
  frozen); `evaluateOilShadow` cannot throw; the record is inert by type.
  Three anti-vacuity tests, because byte-identity is easy to pass while proving
  nothing: the shadow really ran, it really DISAGREES with the live policy on
  the test cast, and the comparator really can fail.
- **The leak demonstration.** Leak = reuse the previous turn's shadow verdict.
  Exactly one test went red, the right one: the shadow-on arm dropped the
  second `use_fishing_item` (937, slot 1) and `oilsConsumed` went 2 → 1.
- **§2 FIVE CASTS + two live-found defects fixed** (see below).
- **§3 THE SUITE IS PORTABLE.** `tests/helpers/authorData.ts` is the one way to
  declare an author-data test; skips are loud (stderr banner + `skipIf`).
- **§4 `scripts/preflight.ts` — and it PASSES.** 243 files exported, doctor
  under an empty HOME prints **1 ✗** (the JWT), suite **1279 passed | 13
  skipped (1292)**, secret scan clean. It never creates a repo or pushes.
- **§4b THE 110TH CAST DOES NOT EXIST** — see Dead ends.

## What's broken
- **THE RELAXING ARM OF THE GATE CANNOT BE OBSERVED IN SHADOW AT ALL**, and
  not for the brief's reason. The brief said stock was zero; live stock was
  **Relaxing 56, Focus 19**. The real cause is ORDERING and it is structural:
  the shadow evaluates in the card-choice phase, the Relaxing trigger fires
  only on a lethal fish, and a lethal Relaxing Oil ends the cast inside the oil
  block — before that phase is reached. **13 shadow records, exactly ONE at a
  firing moment** (Focus arm, `bestConnect` 0.074, gate agreed with the live
  spend); `bestKillProbability` was `null` on all 13. Fixable by hoisting the
  `dist` pipeline above the oil block — `dist` depends only on
  `matcher.history`, `pendingPrediction` and the mined tables, none of which a
  consume changes. Recorded in `oilShadow.ts`'s header. **Do not report the
  gate as validated live.**
- **The same gap swallows any turn whose oil block throws** — which is exactly
  the turn a trigger fired on.
- **The crit DAMAGE rule is unknown at n=1** (see Corrections).
- Carried: corrode modelled but inert in `dungeonSim` (**CLOSED**); 25 analysis
  scripts hold hardcoded paths; the nextPosition tripwire has still never met a
  real server; distribution steps 3/4/6 remain the user's.

## Corrections to SPEC.md
- **NEW MECHANIC: `CRIT_HIT` from a LURE, not the card.** SPEC-fishing modelled
  crits as `critZones`/`critEffects` geometry only. Live, cast `13022874`
  turn 4: `CRIT_HIT` on card 76, which has `critZones: []` AND
  `critEffects: []`, taking the fish 5 → 0 where its `hitEffects` amount is 3.
  *User-stated:* a **"Steady Lure" is equipped, 3% crit chance.** Added to
  SPEC-fishing. **The damage RULE stays open at n=1** — `hit + 2`, a flat 5, or
  "lethal, and the server reports remaining HP" (also exactly 5) all fit. Do
  not encode one. And **do not compute a crit rate over the whole corpus**:
  1/484 plays spans ~60 sessions and the lure's equip date is unknown — rule
  10's trap in another costume.
- **`fishHp` moves by exactly the card's FISH_HP effect: NO LONGER
  EXCEPTIONLESS.** One named, exact-matched exception, so a *second* one fails
  loudly instead of being absorbed by a tolerance.
- **"A caught cast can never be in the gap": FALSIFIED** by `13022748`. Sound
  derivation, dated premise — it assumed the only state the lax reading adds is
  the terminal one, true only when a cast ends on a CARD. A lethal oil ends it
  without one.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **The first leak I wrote was inert BY ACCIDENT and the gate test stayed
  green.** Chasing that found a real defect: `bestKillProbability` returned
  `0.9999999999999999` on one turn and exactly `1` on the next, so at a
  threshold of `1` a bare `>=` made the gate's behaviour on a certain kill a
  matter of float summation order. `NECESSITY_EPSILON` (1e-9) fixes it.
  **NOT a threshold tune** — thresholds are still `{1,1}`, the degenerate
  endpoints still degenerate, and session 67's sweep reproduces
  **byte-for-byte** at n=8000 (88.38% / 3809 oils / 2.42). The sim's
  distributions sum exactly; the defect is **live-only**, which is what shadow
  mode is for.
- **My own first assertion re-imported that bug** by comparing the raw float
  (`toBe(1)`). Assert through `meetsThreshold`.
- **`ls fixtures/fishing-casts/live | wc -l` IS NOT THE CAST COUNT.** The brief
  asked which of "110 dirs vs 109 casts" fails to load. **None does.** 118
  dirs, 95 with state files, 23 empty; **114 distinct docIds**, exactly what
  loads. A dir is per INVOCATION, not per cast — 7 hold more than one, one
  holds six — and every `--dry-run` makes an empty one. The near-equality was a
  coincidence. Pinned as RELATIONS in `fishingCorpus.test.ts`.
- **Two false alarms in `preflight.ts`'s own first run**, both fixed: counting
  `✗` anywhere matched doctor's summary sentence ("Fix the items marked ✗"),
  and the secret scanner flagged `src/api/redact.ts` for containing the field
  it exists to strip. A preflight that cries wolf is worse than none.
- Standing: never report energy as a blocker (rule 12); exercise the real gate
  (`--dry-run`) before claiming a blocker; do not revert rule 8; do not tune the
  necessity thresholds; do not quote the sim's ±0.01pp CIs as decision
  intervals; do not loosen the `fakeDoc` observability guard; §19, rule 8 and
  corrode-in-`dungeonSim` are CLOSED; `boonCapture` settled OFF.
- **`npx tsx` and `git` both fail under the command sandbox** on this machine.
  Run unsandboxed. Not a repo problem.

## Metrics
- **Live: 5 casts** (ledger 0 → 5, ledgers agree, 15 left). 3 caught / 2
  escaped. **3 oils consumed**: 2 Relaxing (both lethal, both caught) + 1 Focus
  (meter trigger). A 4th — a **Focus** oil (942) — was REJECTED by the server;
  the corpus records `consumablesUsed: 1` for that cast, confirming the reject
  was total rather than half-applied. Stock Relaxing 56 → 54, Focus 19 → 18,
  which is the arithmetic checking out.
- **Corpus 109 → 114 casts.** caught 23 → 26, escaped 85 → 87, playTurns
  470 → 484, responseDocs 606 → 631, focus-gap 14 → 15 (session 66 predicted
  the gap grows; it does).
- **Shadow: 13 records, 1 at a firing moment, 0 sanity violations, 0 throws.**
- **Suite 1279 → 1293.** New: `oilShadowInert` 6, `oilLethalCompletes` 2,
  `oilNecessity` +3, `matcherVerdict` +2, corpus reconciliation +1.
- **Clean-export suite: 1279 passed | 13 skipped, 0 failed, all 1292
  collected** — was `4 failed | 1264 passed | 11 never ran`.
- Sim unchanged after the epsilon fix: conserve(r=1,f=1) 88.38% / +19.66pp /
  3809 oils / 2.42 per extra fish, n=8000.

## Open questions for Claude
1. **Should the `dist` pipeline be hoisted above the oil block** so shadow can
   see the Relaxing arm? It is the difference between a half-observable gate
   and a whole one, and it is the only thing standing between here and an
   honest ship/no-ship decision. It is a live-loop restructure and belongs in a
   brief, not a late-session edit.
2. **What is the crit damage rule, and when was the Steady Lure equipped?** The
   second question gates the first: without an equip date no crit rate can be
   computed, and at 3% a handful of casts would settle the damage rule.
   `cardChoice.ts` currently models only the card's crit source.
3. **Does the user still want `conserve(r=1,f=1)` held?** It is now shadowed,
   inert, and float-correct — but validated on ONE live firing, Focus arm only.
4. **Should `preflight.ts` run in CI**, or stay a before-every-invite manual?

## Files changed
```
 5 commits (b9830c4, 7a11383, 72921b8, 02e7907, 23f182f). 25 new fixture files.

     src/strategy/fishing/oilShadow.ts        | 306  (new — the shadow)
     scripts/liveFishing.ts                   | 257  (shadow wiring + 2 fixes)
     tests/fishing/oilShadowInert.test.ts     | 228  (new — GATE 1)
     scripts/preflight.ts                     | 211  (new — §4a)
     tests/fishing/oilLethalCompletes.test.ts | 153  (new — §2 regression)
     tests/fishing/oilReachability.test.ts    | 135  (census + falsified claim)
     tests/helpers/authorData.ts              |  74  (new — §3)
     tests/rejectionAudit.test.ts             |  75  (GATE 2)
     tests/fishing/matcherVerdict.test.ts     |  71  (synthetic §19 pin)
     tests/fishing/oilNecessity.test.ts       |  71  (float-defect pins)
     tests/sim/fishingCorpus.test.ts          |  63  (census + reconciliation)
     src/sim/fishing/castTrace.ts             |  56  (CRIT_HIT + item terminals)
     tests/api/redact.test.ts                 |  51  (split logic vs sweeps)
     tests/fishing/stateFields.test.ts        |  48  (the named exception)
     SPEC-fishing.md                          |  46  (the lure crit)
     src/strategy/fishing/oilTiming.ts        |  42  (NECESSITY_EPSILON)
     tests/fishing/reversalDispersion.test.ts |  28
     tests/fishing/zoneTemplate.test.ts       |  24
     handoff/DISTRIBUTION.md                  |  22
```

---

# Verbose appendix

## A. GATE 1 — the leak demonstration, verbatim

Leak applied to `scripts/liveFishing.ts` (reuse the previous turn's shadow
verdict to suppress this turn's spend):

```
const LEAKED_SKIP = oilShadowRecords[oilShadowRecords.length - 1]?.wouldSkip ?? [];
const oilWanted = LEAKED_SKIP.length > 0 ? [] : onDemandTriggers(...)
```

```
 × the live decision is BYTE-IDENTICAL with shadow on and shadow off

Expected: ...{"action":"use_fishing_item",...,"itemId":937,"slotIndex":0}...
          ...{"action":"play_cards",...}...
          ...{"action":"use_fishing_item",...,"itemId":937,"slotIndex":1}...
          ...{"action":"play_cards",...}...
          "result":{"outcome":"escaped","turns":2,...,"oilsConsumed":2}

Received: ...{"action":"use_fishing_item",...,"itemId":937,"slotIndex":0}...
          ...{"action":"play_cards",...}...
          ...{"action":"play_cards",...}...
          "result":{"outcome":"escaped","turns":2,...,"oilsConsumed":1}

 Tests  1 failed | 5 passed (6)
```

Restored: `grep -c LEAKED_SKIP scripts/liveFishing.ts` → `0`, six green.

**The first leak I wrote did NOT fail the test**, and that was the session's
most useful accident — see appendix C.

## B. GATE 2 — the collection-time throw, both shapes

Same absent data, ONLY the load location differing:

```
old shape (load in describe body):   Test Files  1 failed (1)
                                     Tests  no tests

new shape (load in beforeAll):       Tests  3 passed | 8 skipped (11)
  ⚠ SKIPPED (author data absent) — tests/rejectionAudit.test.ts
    run logs under <tmp>/: 10 of 10 pre-session-53 run logs absent
    These assertions describe the author's own captures, not this code's behaviour.
    They are skipped, NOT passed. See tests/helpers/authorData.ts.
```

The three that still pass are the pure-parsing tests — program logic, correctly
always-running.

## C. The float defect, and how it was found

The leak in appendix A was inert by accident: at turn 0 the gate had FIRED
rather than skipped, so there was no skip verdict to leak. Probing why:

```
turn 0: liveWanted [relaxing], shadowWanted [relaxing], skip [], bk 0.9999999999999999
turn 1: liveWanted [relaxing], shadowWanted [],         skip [relaxing], bk 1
```

Same card, same board, certain kill by construction — different summation order
over the distribution. Under `>= 1` the gate's behaviour on a certain kill was
a coin flip nobody chose.

`NECESSITY_EPSILON = 1e-9` + `meetsThreshold(p, t) => p >= t - EPSILON`.

Re-ran session 67's sweep at n=8000 to check nothing moved:

```
conserve(r=2,f=2)      88.11%  +19.40pp  5578   3.59
conserve(r=1,f=1)      88.38%  +19.66pp  3809   2.42     <- byte-identical to s67
conserve(r=0.5,f=0.5)  88.42%  +19.71pp  3548   2.25
bestKillProbability at the lethal trigger:
  exactly 0   719  34.3%     exactly 1  1171  55.8%     [0.75,1)  13  0.6%
```

Unchanged. **The sim never hits this; the defect is live-only.**

## D. §2 — the five casts, turn by turn

```
cast A 13022748  CAUGHT  Relaxing 937 lethal (fish 2/18 -> 0) -> GuardTrip
                         second consume 942 slot 1 -> HTTP 400, token desynced
                         and the catch was left UNRESOLVED -> account stuck
cast B 13022872  escaped 2 turns, 0 oils
cast C 13022874  CAUGHT  4 turns, Focus 942 at meter 0/3 -> 2/3
                         final play: CRIT_HIT, fish 5 -> 0   [the lure]
cast D 13022875  escaped 3 turns, 0 oils
cast E 13022876  CAUGHT  2 turns, Relaxing 937 lethal (fish 1/16 -> 0)
```

Ledger after: `dayDocs[pond 2] = 5`, repo ledger 5 casts / 60 energy, agree.

### The two defects, and they chain

1. `oilWanted` is computed ONCE per turn and the loop over it never re-checked
   completion. A lethal Relaxing Oil ENDS the cast, so the Focus consume that
   triggered on the same turn was sent against a finished cast. The
   `if (doc.COMPLETE_CID) continue;` that existed sat AFTER the loop; the damage
   is done by the loop's second iteration.

2. The GuardTrip unwound `runOneCast` before its `loot` block, so the catch's
   `cardsToAdd` was never resolved — and the account then rejected the next
   `start_run` with *"Player is already in a game"*. The loot block's own
   comment claimed "the bot's OWN catches never leave the account stuck"; that
   was only ever true of casts that reach the end.

Fix 2 is structural: `resolvePendingCardOffer` is now shared and called BEFORE
`start_run` as well, so recovery is automatic after ANY abort path. Verified
live:

```
★ caught! resolving cardsToAdd offer (34, 7, 9) -> chose id 34 [pre-start recovery]
✓ loot sent — fullDeck now 10 card(s), cardChosenId 34
· account was left stuck by an earlier cast's catch — offer resolved, starting normally.
```

(Card 34 looked like the wrong pick — offer 7 has more damage and more zones —
until `critEffects: 8` on `critZones: [6]` showed up. `max(hit,crit)/mana` = 8
beats 6. The shipped policy was right.)

## E. The CRIT_HIT envelope

```json
{"type":"CARD_PLAYED","playerId":0,"batch":1,"value":0,"data":{"result":1}}
{"type":"CRIT_HIT",   "playerId":0,"batch":1,"value":5,"data":{"result":5}}
{"type":"FISH_HP_DIFF","playerId":0,"batch":1,"value":5,"data":{"result":0}}
{"type":"FISH_DIED",  "playerId":0,"batch":2,"value":516,
  "data":{"fish":{"gameItemId":516,"name":"Finley","moveDistances":[1],
                  "rarity":0,"size":"SM","pondId":2,"quality":1,...}}}
```

Card 76: `hitZones [1,2,3,4,6,7,8,9]`, `critZones []`, `critEffects []`,
`hitEffects [{FISH_HP, 3}]`. Focus `(3,4)`, fish `(2,4)`. Fish 5 → 0.

Event census over the whole corpus (484 card plays, 114 casts):

```
FISH_MOVED 484  CARD_PLAYED 484  HIT 152  FISH_HP_DIFF 487  NEW_HAND 114
FISH_ESCAPED 87  FISH_DIED 26  PLAYER_0_MANA 8  PREDICT_NEXT_MOVE 16
FOCUS_STAMINA_DIFF 6  use_fishing_item 9  DOUBLE_FISH 2  CRIT_HIT 1
```

**CRIT_HIT: 1.** It had never happened before, which is why two audit bugs
survived this long.

## F. The two castTrace bugs

```
castTrace.ts:283   hit: events.some((e) => e.type === "HIT")
                   -> a CRIT_HIT scored as a MISS in every offline audit
castTrace.ts:244   if (body.message === ITEM_MESSAGE) continue;
                   -> dropped the response BEFORE reading its events, so
                      FISH_DIED on a lethal-oil kill was never seen
```

The second showed as `loadCastTraces()` reporting **23** catches against the
corpus's **26**. It read 22 vs 23 before this batch and the one-cast gap was
attributed to the known incomplete cast — a coincidence that hid it. Both views
now say 26.

**The live path was never affected**: `liveFishing.ts:2221` derives
`realizedHit` from `newDoc.data.fishHp < fishHp`. `data/ringPrediction.jsonl`
and §19's verdict are clean.

## G. §4 — preflight, final run

```
✓ exported 243 tracked file(s) to dist-preflight/
  pruned: handoff, .claude, TASKS.md, QUESTIONS.md, CODEXAUDIT, CODEXIMPROVE,
          CODEXREVIEW, config/.gitkeep
▸ doctor.ts with an empty HOME — 1 ✗
    ✗ no JWT at /nonexistent-friend-home/.secrets/gigaverse-jwt.txt
  ✓ exactly one ✗, which should be the JWT.
  Test Files  73 passed (73)
  Tests  1279 passed | 13 skipped (1292)
  author-data tests skipped: 13
▸ secret scan of the exported tree — ✓ clean.
▸ PREFLIGHT PASSED — the export behaves for a stranger.
```

Against session 67: `4 failed | 1264 passed`, 11 never collected.

## H. §4b — the fixture-tree reconciliation

```
dirs=118  with-states=95  empty=23
distinct docIds: 114
dirs holding >1 docId: 7
  cast-2026-08-17-05-34-25 -> 12944907 12944911 12944916 12944922 12944926 12944936
  cast-2026-08-21-20-11-01 -> 13022748 13022872
```
