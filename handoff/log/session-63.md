# STATE — session 63 — 2026-08-21 (PT) — code at commit 5646e91

## Status
**BOTH GATE HALVES PASS.** Suite **1180/1180** (1157 → 1180, +23), `tsc
--noEmit` clean, `git diff --check` clean, secret scan clean across the whole
session diff, no test writes a real data path.

- **Gate 1 PASS** — a corrode test fails when the `moveType` gate is removed
  (**2 tests**, demonstrated failing), and a second fails when `amount` is
  hard-coded to 3 rather than read from the buff (**3 tests**, demonstrated
  failing). Both restored, green.
- **Gate 2 PASS** — a meter-zero fishing test passes on an on-grid focus point
  (from every corner and the centre at zero budget) and **demonstrably throws**
  on `[0,0]`. Both directions asserted in `tests/fishing/meterZero.test.ts`.

Brief items delivered: §1, §2, §3, §4, §5, §6. Nothing deferred.

**Caps at session end: 0 dungeon run-units (12/12 spent), 14 fishing casts
left.** The session ran entirely BEFORE the 11:00 PT rollover, so the ledger
day was still 2026-08-20. **Zero dungeon runs were started** — the brief
carried no rule-11 go-ahead and a full ledger would not have been one either.

**Rule 13 exercised as routine.** Ledger read after the cast: `dayDocs[pond 2]`
5 → 6, +1 exactly. No denial or interrupt occurred.

## What works
- **`onEnemyWinExchange_corrode` is modelled in the combat core**, and it was
  CONFIRMED against the corpus BEFORE being implemented, not after.
  `corrodeOnEnemyWin` reads `amount` and `moveType` off the buff's own live
  `effects[]`; `resolveExchange` applies it to the player's `armorMax` and
  reports `ExchangeResult.corroded`.
- **The live lookahead is corrode-aware.** `buildBattleState` now attaches
  `run.activeEnemyBuff`, and `BattleState.foeBuff` flows into `decide.ts`'s
  lookahead through `resolveExchange`'s default. Every non-corrode buff returns
  0, so nothing else changed behaviour.
- **The `[0,0]` trap is guarded, not merely tidied.** Three
  `tests/liveFishing.test.ts` mocks moved to the live `[2,2]`; the new file
  asserts the throw as well as the fix.
- Live: **1 fishing cast, clean non-oil, caught in 3 turns**, 0 guard trips.

## What's broken
1. **Nothing from this session is known-broken.**
2. **`on-demand` has STILL never consumed an oil live.** One more cast has been
   spent without touching the risk surface. `slotIndex` for items 937 and 942
   remains confirmed only for item 821; `slotIndex` for a SECOND consume in one
   cast remains unexercised anywhere.
3. **Corrode is modelled but has never fired in a SIM RUN.** `dungeonSim.ts`
   builds foes from `src/sim/enemies.ts` profiles, which carry no buff id, so
   nothing sets `foeBuff` there. It fires in the live lookahead and in tests.
   Wiring it into `dungeonSim` needs a decision about which buff a simulated
   room's enemy carries — that is a scenario question, not a modelling one.
4. **A perpetual corrode would be UNDER-modelled.** `buildBattleState` attaches
   `activeEnemyBuff` only. Corpus-justified (0 states carry a corrode as a
   perpetual), and the failure direction is safe, but it is a real gap.
5. Carried: 25 analysis scripts hold hardcoded paths (ratcheted). `boonCapture`
   stays OFF. Distribution steps 3–6 remain the user's.

## Corrections to SPEC.md
- **No live response contradicted SPEC this session.** The corrections are to
  SPEC's own arithmetic and to the brief.
- **SPEC §3h said "23 base plus 23 `perpetual_` twins". It is 24 and 22.**
  Fixed in SPEC.md, and the identical claim fixed in `src/sim/enemyBuffs.ts`'s
  header. The two missing twins are `perpetual_corrosiveShield` and
  `perpetual_corrosiveMagic` — ZERO appearances across `fixtures/`, against 24
  for `perpetual_corrosiveSword`. Absent because unobserved; **do not complete
  the table to a neat 3×2 without a capture.**
- **SPEC §3h now documents `onEnemyWinExchange_corrode` as CONFIRMED**, with
  the 2×2 contingency table, the three ids, and the two things it does NOT
  establish (the clamp, and `amount` — every live firing is 3).
- **The brief said the user holds one Mid Focus Oil and one Mid Relaxing Oil.**
  The live read is **Relaxing 1, Focus 23.** Rule 9, third occurrence. Focus
  stock is not scarce; Relaxing is.
- **The brief's §2 table listed two corrode variants.** There are **three** —
  it omitted `corrosiveMagic` (scissor), which fired in the corpus.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Do not read a `shield.currentMax` delta across a STATE boundary.** A state
  repeating its predecessor's `(myLastMove, foeLastMove)` pair is the same
  exchange re-reported. Counting those put five spurious zero-deltas in the
  firing cell and made a 4-of-4 model look like 4-of-9. Dedupe on the move pair.
  Session 56's cross-attempt trap in a different costume.
- **Do not clamp current armor to the corroded max.** Unobserved — no corpus
  exchange leaves current above the new max. `applyOutcome`'s existing
  `Math.min` converges an over-max pool down at the next regen anyway.
- **Do not "fix" the `[0,0]` throw by clamping onto the grid.** The board never
  sends `[0,0]`, so a state carrying it is FABRICATED, and repairing fabricated
  input is how a suite stops testing the server.
- **Do not make corrode SCORABLE.** It stays a `mechanic` kind raising
  `ENEMY_BUFF`. Reclassifying would move historical coverage metrics for
  ~nothing: 617 of 622 non-Safe paths also carry `rolledEnemyStats`, and
  session 56 measured exactly zero freed exchanges from modelling buffs.
- **Rule 8's measurement programme is CLOSED (DECISIONS 2026-08-21).** Do not
  re-run the comparison or propose a new one.
- Standing: never report an energy number as a blocker (rule 12); exercise the
  real gate (`--dry-run`) before claiming a blocker; do not revert rule 8 or the
  wide orb rule without a user directive; never pipe a live run to a truncating
  reader.
- **The recap checklist's `.gitignore` line is still stale — FIFTH session.**
  It says to confirm `config/discovered.json` is ignored. It deliberately is
  NOT. Everything else on that list holds and was re-run this session.

## Metrics
- **Corrode, measured against `fixtures/dungeon-runs/` (3066 states):**
  - foe won × move matches: **4 exchanges, all −3**
  - foe won × no match: 19, all 0 · foe lost × match: 8, all 0 · neither: 25, all 0
  - 76 states carry a corrosive buff; **0 carry two**; corrode is the SOLE
    `activeEnemyBuff` on every one. `perpetual_corrosiveSword` appears 24 times
    but only in `enemyPathOptions` OFFERS — never in force (rule 8's Perpetual
    filter).
  - Firings: `corrosiveSword` room 3 of run-2026-08-20-20-04-37 (17→14→11),
    `corrosiveMagic` room 5 same run, `corrosiveShield` room 5 of
    run-2026-08-20-22-46-26.
- **Live fishing: 1 cast, CLEAN NON-OIL, caught in 3 turns.**
  - `fishHp` 12→9→4→0 (never ≤2 while alive); `focusMeter` 3→1→1→0 (zero only
    on the terminal state, fish already dead). **Neither trigger was reachable**
    — this is verified from the board states, not inferred from the absence of
    a log line.
  - Oils held after: **Relaxing 1, Focus 23** — unchanged, nothing consumed.
  - Corpus 94 → **95 casts**; caught 14 → 15; escaped unchanged at 79. Every
    census delta reconciles with exactly this one cast (+5 responseDocs,
    +3 playTurns). Zero-streak **reset to 0** by the catch (was 4 of 15).
- **Live dungeon: 0 runs.** Not authorized.
- **§19: 7 of 32 instrumented turns. UNCHANGED** — no oil cast occurred.
- Suite 1157 → **1180** (+23).

## Open questions for Claude
1. **The oil policy has now gone two sessions without consuming an oil live.**
   The `slotIndex` risk surface for 937/942 is untouched. At ~0.70 oils/cast the
   one-cast-at-a-time approach has roughly a coin-flip miss rate each time; a
   **3-cast batch** would clear it with ~97% probability at a cost of 3 of 20
   casts. Worth asking the user whether to budget that, rather than spending
   single casts that may keep landing clean.
2. **Should corrode be wired into `dungeonSim`?** It is modelled and live-wired
   but inert in sim runs, because sim enemy profiles carry no buff id. This
   needs a decision on which buff a simulated room's enemy carries — a scenario
   question. Given rule 8 makes tier 2 universal and corrode is `minTier: 2`,
   the honest default would be to sample it from corpus offer frequency.
3. **Boon coverage instrumentation reported no new pairs** — zero dungeon runs.
   The orb-6/priority-2 count is unchanged from session 62 and should not be
   re-reported as if it moved.
4. **`tests/liveFishing.test.ts`'s `previousFishPosition: [0, 0]` is the same
   trap class, untouched.** The live wire reports `[4,4]` there. It was left
   alone because changing it could shift matcher-derived expectations and the
   brief named only `focusPoint`. Worth a deliberate look, not a silent fix.
5. `boonCapture` stays OFF — still zero ordinary runs since the directive.

## Files changed
```
 2 commits (5646e91, plus this recap). 5 new redacted fixtures.

     tests/corrode.test.ts            | 205  (new — gate half 1)
     src/sim/enemyBuffs.ts            | 115  (corrodeOnEnemyWin + header fix)
     tests/fishing/meterZero.test.ts  | 110  (new — gate half 2)
     SPEC.md                          |  55  (§3h corrode + twin count)
     handoff/DECISIONS.md             |   7  (6 entries incl. rule-8 closure)
     src/sim/combat.ts                |  35  (corrode in resolveExchange)
     tests/liveFishing.test.ts        |  21  (3 mocks -> on-grid [2,2])
     scripts/liveRun.ts               |  18  (buildBattleState carries the buff)
     src/sim/types.ts                 |  12  (BattleState.foeBuff)
     tests/sim/fishingCorpus.test.ts  |  14  (census 94 -> 95)
     tests/fishing/zoneTemplate.test.ts |  9  (census 94 -> 95)
```

---

# Verbose appendix — session 63

## A. The live cast, in full

```
▸ liveFishing.ts — 1 cast(s)
  · resuming today's fishing budget: 60 energy / 5 casts already spent
  account <USER>
  ▸ energy preflight: pool 420 covers the planned 12 — no ROM claim needed.

▸ cast 1/1
  ✓ start_run sent — fishing actionToken now <TOKEN>
  · matcher seeded with 3 mined pattern(s): perimeterWalk(cw), perimeterWalk(ccw), bounce(2,0)
  · matcher posterior: prior 13.7% (12/93 clean casts explained exactly by the loaded library, Laplace +1/+2)
  · ring model ON: class prior k=1 47 / k=2 46 cast(s), 17 (class, prev-delta) key(s); focusReserveWeight 3
  · sticky switch probability s = 4.46% (estimated: 14/314 consecutive hop pairs)
  · contextual fallback: 102 (cell, previous-direction) key(s) from 93 clean logged cast(s)
  · oils held: Relaxing 1, Focus 23 (on-demand policy)
  ▸ turn 0: card 76 @ focus [3,3] (P_hit 0.79, ev 1.8)
  · predictors: ring p(actual)=0.273 TOP1 | baseline p(actual)=0.222 | shot P_hit 0.79 → HIT | matcher π=0.137 (n=0)
  ▸ turn 1: card 2 @ focus [3,3] (P_hit 0.47, ev 0.8)
  · predictors: ring p(actual)=0.446 | baseline p(actual)=0.283 | shot P_hit 0.47 → HIT | matcher π=0.167 (n=1)
  ▸ turn 2: card 1 @ focus [4,3] (P_hit 0.64, ev 2.2)
  · predictors: ring p(actual)=0.358 TOP1 | baseline p(actual)=0.529 TOP1 | shot P_hit 0.64 → HIT
  ▸ cast over: caught after 3 turns — CAUGHT!
  ★ caught! resolving cardsToAdd offer (41, 38, 32) -> chose id 38
  ✓ loot sent — fullDeck now 11 card(s), cardChosenId 38
  ▸ energy: 420 -> 408  (observed delta 12; committed 12)
```

Three shots, three hits. Not a measurement of anything — n=1, and the brief
said so.

## B. Why the cast is provably clean non-oil, not merely unlogged

Board states from `fixtures/fishing-casts/live/cast-2026-08-21-14-46-13/`:

```
state-000  fishHp 12/19  focusMeter 3/3  playerHp 10  consumablesUsed 0
state-001  fishHp  9/19  focusMeter 1/3  playerHp  9  consumablesUsed 0
state-002  fishHp  4/19  focusMeter 1/3  playerHp  8  consumablesUsed 0
state-003  fishHp  0/19  focusMeter 0/3  playerHp  7  consumablesUsed 0
state-004  fishHp  0/19  focusMeter 0/3  playerHp  7  consumablesUsed 0
```

`on-demand` fires Relaxing at `fishHp <= 2` and Focus at `focusMeter === 0`.
The fish went 4 → 0 without ever sitting at ≤2 alive, and the meter reached 0
only on the terminal state, after the catch. **Neither trigger had a moment.**
`oilCastState` correctly wrote nothing — it records DRY casts only, and this was
not one.

`fishingConsumableSlotUsed` stayed `[false, false, false]` throughout.

Mana (`playerHp`) fell 10 → 9 → 8 → 7, one per card played — consistent with
the user-stated rule that only playing cards spends mana.

**Instrumentation gap noticed, not fixed:** the console prints `oils held:
Relaxing 1, Focus 23`, but `grep -c oil <log>` is **0**. A clean non-oil cast
leaves no machine-readable record of the stock held at cast time. Small, and
worth closing before a batch, because the DRY-vs-clean distinction is derived
from stock.

## C. Corrode — the scan that confirmed it

The full 2×2, over 3066 states in `fixtures/dungeon-runs/`, pairing consecutive
same-room states:

```
foeWon  moveMatches  n    deltas
True    True         9    [-3, 0]     <-- see below
True    False        19   [0]
False   True         8    [0]
False   False        25   [0]
```

The firing cell looked like 4-of-9 until the duplicate states were removed:

```
20-04-37/state-032  room3  corrosiveSword   foe rock    me scissor  cm 17->14  dupLastMove=False
20-04-37/state-033  room3  corrosiveSword   foe rock    me scissor  cm 14->14  dupLastMove=True
20-04-37/state-036  room3  corrosiveSword   foe rock    me scissor  cm 14->11  dupLastMove=False
20-04-37/state-037  room3  corrosiveSword   foe rock    me scissor  cm 11->11  dupLastMove=True
20-04-37/state-038  room3  corrosiveSword   foe rock    me scissor  cm 11->11  dupLastMove=True
20-04-37/state-039  room3  corrosiveSword   foe rock    me scissor  cm 11->11  dupLastMove=True
20-04-37/state-082  room5  corrosiveMagic   foe scissor me paper    cm 17->14  dupLastMove=False
22-46-26/state-056  room5  corrosiveShield  foe paper   me rock     cm 17->14  dupLastMove=False
22-46-26/state-057  room5  corrosiveShield  foe paper   me rock     cm 14->14  dupLastMove=True
```

**Every zero in the firing cell is `dupLastMove=True`.** Deduped: 4 exchanges,
4 firings, exact. This is the single most important line in the section — the
model looked wrong for as long as it took to notice that a state boundary is
not an exchange boundary.

One further decrease was found and correctly excluded:
`run-2026-08-15-15-38-09/state-100`, room 3 → **1** with `cur 0 -> 16`. Room
number DECREASING is session 56's cross-attempt delimiter — a different attempt,
not a corrode.

The live buff envelope, confirming `effects[]` is inlined on the wire
(`run-2026-08-20-20-04-37/state-030`):

```json
{"id": "corrosiveSword", "name": "Miasmablade",
 "description": "Reduces 3 max <color=#7DD3FC>armor</color> on Sword wins",
 "minTier": 2,
 "effects": [{"kind": "onEnemyWinExchange_corrode", "amount": 3, "moveType": "rock"}]}
```

This is why the table's completeness does not gate correctness: an unseen id
arrives carrying its own effects and is handled on sight.

## D. Gate demonstrations, verbatim

**Gate 1a — `moveType` gate removed** (`if (e.moveType !== foeMove) continue;` deleted):

```
× fires on the enemy's MATCHING move only
× leaves armorMax alone when the enemy wins on a NON-matching move
Tests  2 failed | 37 passed (39)
```

**Gate 1b — `amount` hard-coded** (`total += e.amount ?? 0` → `total += 3`):

```
× reads `amount` off the buff rather than assuming the corpus's 3
× sums multiple corrode effects on one buff
× reads the amount from the buff in the combat core too
Tests  3 failed | 36 passed (39)
```

Both restored; `tests/corrode.test.ts` + `tests/enemies.test.ts` = 39/39.

**Gate 2** — `tests/fishing/meterZero.test.ts` asserts on-grid works at zero
budget from all four corners and the centre, AND that `[0,0]` throws
`"gridSize must be >= 1"`, AND that `[0,0]` does NOT throw at a full meter —
which is the reason the bug survived since session 45.

## E. Two failing census tests, and why they were updated rather than pinned

The full suite went red after the cast on `tests/sim/fishingCorpus.test.ts` and
`tests/fishing/zoneTemplate.test.ts`. Both are corpus censuses, and the first
carries its own instruction for exactly this case: *"If this fails after a
future live session added real casts, update the expected numbers — don't
revert the loader."*

Every delta reconciles with the one cast, which is the check that made updating
them safe rather than lazy:

```
casts         94 -> 95   (+1, the cast)
responseDocs 517 -> 522  (+5, its 5 state files)
playTurns    411 -> 414  (+3, a 3-turn catch)
caught        14 -> 15   (+1)
escaped       79 -> 79   (UNCHANGED — the discriminating one)
incomplete     1 ->  1   (still session 44's docId 12975755)

traces        94 -> 95   clean 93 -> 94   trace playTurns 407 -> 410
```

Had `escaped` moved, or `playTurns` moved by anything other than 3, the numbers
would have been hiding a second change.

## F. Scope calls made deliberately

- **`dungeonSim` was NOT wired.** Sim enemy profiles carry no buff id, so
  choosing one would be inventing a scenario. Open question 2.
- **Corrode was NOT made scorable.** It would move historical coverage metrics
  for ~zero freed exchanges (session 56).
- **`replay.ts` was NOT touched.** It re-reads the true `shield.currentMax` from
  the wire on every exchange via `toCombatant`, so it was already correct
  without modelling corrode, and passing the buff would change no result. Worth
  stating explicitly: corrode only matters where state is carried FORWARD
  (`dungeonSim`, `decide.ts`'s lookahead), never in single-exchange replay.
- **`previousFishPosition: [0, 0]` was NOT changed.** Same trap class, but it
  feeds matcher-derived expectations and the brief named only `focusPoint`.
  Open question 4.
