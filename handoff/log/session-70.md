# SESSION LOG — session 70 — 2026-08-21 (PT) — code at commit 1300722

## Status
**GATE 1 FAIL (the finding). GATE 2 PASS.** Suite **1360/1360** (1328 → 1360,
+32), `tsc --noEmit` clean, `git diff --check` clean, secret scan clean across
the whole session diff, `discoveredShipsClean` 8/8. **Zero casts, zero dungeon
runs** — the brief authorized none and none were spent.

- **Gate 1 FAIL, and the failure IS the deliverable.** The sim's per-turn
  focus-spend profile was computed against the corpus's and they do not agree.
  The focus sweep's ranking must not be quoted. Details in §What's broken.
- **Gate 2 PASS.** The missing cast is identified (docId **13024510**) and the
  repo ledger now defers to the game's in BOTH directions, with an exhaustive
  test that the repo counter can never exceed the game's.

**NOTHING NEW IS SHIPPED.** `liveFishing.ts` still plays `onDemandTriggers`;
`focusBudget.ts` is still `{kind:"none"}`; redraw is wired and OFF. The one
behaviour change is the ledger reconciliation, which only ever copies the
server's own count.

## What works
- **§4 THE LEDGER OFF-BY-ONE IS SOLVED, not just reconciled.** `liveFishing.ts`
  logs `ledgerRemaining` — a live read of the game's ledger — after every cast.
  Session 69's ten casts read `14 14 13 12 11 10 9 8 7 6`, so `dayDocs` went
  5 → 6 → **6** → 7 → … → 14 and exactly ONE cast failed to tick it: **cast 2,
  docId 13024510**. It is ordinary in every client-visible respect and **the
  server DID charge its energy** (408→396, `drifted:false`). Ruled out from the
  same logs: not a double-counted doc (15 successful `start_run`s → 15 distinct
  docIds), not a resume, not a rejected start miscounted (the one rejection,
  "Player is already in a game", correctly recorded nothing), not read lag
  (settled at 14 across two later reads), not another pond
  (`dayDocs[pondId 1]`=0). Oil-ending is not it either — casts 5, 6, 8, 10 also
  ended on `use_fishing_item` and all four ticked. **The missing increment is
  server-side with no client-visible cause.**
- **§4 the repo now DEFERS.** `reconcileFishingLedger` + `adoptServerRunCount`
  (deliberately NOT monotonic), wired inside `runOneCast` at the
  `getFishingState` every cast already makes — not in `main()`, per session
  64's dead-outer-wire lesson. Costs no extra request, runs before
  `assertCanStartRun`, persists the corrected count.
- **§1 redraw is CONFIRMED and the intent guard is live.**
  `buildFishingEnvelope` now **throws** on a `play_cards` with absent/empty
  `cards`; `buildRedrawEnvelope` is the only producer of `cards: []`.
- **§5a the crit rate is rescoped to gear read off each cast's own document**,
  with a real control. `scripts/critByGear.ts`.
- **§3 the shadow moved onto the exchange threshold.** `SHADOWED_OIL_POLICY`.
- **§2 `scripts/focusProfileCheck.ts`** — the gate, with a COMPUTED verdict.
  `castSim` gained an `observeTurn` hook, pinned inert (byte-identical over 60
  seeds + 3 anti-vacuity companions).

## What's broken
- **GATE 1: THE SIM DOES NOT REPRODUCE THE FOCUS-SPEND PROFILE.**
  ```
  turn            0    1    2    3    4    5    6    7    8    9   10
  corpus       3.00 1.60 0.92 0.51 0.29 0.09 0.10 0.09 0.12 0.08 0.00
  sim (live)   3.00 2.23 1.31 0.56 0.26 0.12 0.07 0.02 0.01 0.05 0.00
  ```
  Opening spend **0.77** [0.75, 0.79] vs corpus **1.40** [1.23, 1.56]. Meter-out
  **32.5%** vs **64.2%**. Turns 3+ agree within 0.11 — **the entire divergence is
  the opening move**, which is exactly what every candidate policy constrains.
- **THE SWEEP FAILS ITS OWN PRECONDITION TOO, and prints so unprompted.** It
  does not use `castSim` — it replays real trajectories — and under
  `--matcher=loo` (session 50's fix) it spends **0.73** against live's **1.08**
  [0.82, 1.34]. Result: `costCap(2)` and `threshold(0.1…1)` are **+0/−0**, and
  every arm that moves anything moves it DOWN (`costCap(0)` −31 p=0.000;
  `schedule(8)` −19 p=0.001). **An inert arm here means NOT EXERCISED.**
- **LOCALIZED: it is the POLICY model, not the fish model.** The replay's fish
  is the real recorded trajectory. On the same 123 traces the RECORDED policy
  spent **1.40** and today's replayed policy spends **0.73**. `castSim`
  independently lands at **0.77**. Two instruments sharing no fish model agree
  with each other and disagree with live.
- **`REAL_DECK` IS STALE IN THREE SCRIPTS** — see Corrections. Annotated, not
  changed.
- Carried: the `nextPosition` tripwire has still never met a real miss;
  distribution steps 3/4/6 remain the user's; 25 analysis scripts hold
  hardcoded paths (ratchet held at 25 — both new scripts are profile-resolved).

## Corrections to SPEC.md
- **§7 "redraw genuinely uncaptured" is REPLACED by a new §7a.** Redraw is
  `play_cards` with `cards: []`, `focusPoint` still sent — no fifth action, no
  new endpoint. **The distinguishing signal was never in the `action` string**,
  so looking for a fifth action was never going to find it. Response reads
  `"Cards played successfully."` with `FISH_MOVED → CARD_PLAYED → FISH_HP_DIFF →
  NEW_HAND` carrying **three** cards; `FISH_MOVED` means the server charges it
  as a turn.
- **A ROD GRANTS THE STARTING DECK — CONFIRMED, and this account's rod changed
  mid-corpus.** `/offchain/static`'s `gameItems` carries `CARD_CID_array`, which
  `/gear/items` does not: **922 Makeshift Rod `[1,2,3,4,5,6,7,76,77,79]`**,
  **811 Shroom Rod `[1,2,3,4,5,6,74,75,76,78]`**. Confirmed against play: every
  cast's `fullDeck` matched Makeshift until **2026-08-21T19:58:29Z** and is
  Shroom from that cast on, with `GEAR_CID_array` swapping the rod at the same
  cast. Session 15's "rod `itemEffects` are empty" stands — `/gear/items` was
  the wrong place to look, not the wrong question. **⚠ `REAL_DECK` in
  `fishingEmpiricalAblation.ts` / `focusReserveAblation.ts` /
  `focusProfileCheck.ts` is the MAKESHIFT deck and is now stale.** Deliberately
  not repointed: 110 of 123 clean traces were played on it, so changing it makes
  old and new numbers incomparable without making either right.
- **THE `GearInstance` SUFFIX IS A MINT STAMP, NOT AN EQUIP STAMP.** The brief
  read it as equip time. `#951_1787254688` decodes to 2026-08-20 12:38 PT but
  first appears on a cast **21 hours later**; `#811_1787332895` /
  `#952_1787332903` decode to 2026-08-21 10:21 PT and first appear **2h37m
  later**. First appearance in a cast's own array is the observable.
- **Session 69's crit denominator (1/73, 1/39) is SUPERSEDED.** The Steady Lure
  first appears at **2026-08-21T16:47:53Z (09:47 PT)**, not "before that day's
  casts" — the eight earlier casts that day carried no lure. Rescoped (totals
  reconcile: 443+78 = 521 `playTurns`):

  | scope | casts | crits/plays | rate | 95% Wilson |
  |---|---|---|---|---|
  | **no lure — CONTROL** | 102 | **0/443** | 0.00% | [0.00%, 0.86%] |
  | Steady Lure | 22 | 1/78 | 1.28% | [0.23%, 6.91%] |
  | …Steady only | 7 | 0/27 | 0.00% | [0.00%, 12.46%] |
  | …Steady + Sticky | 15 | 1/51 | 1.96% | [0.35%, 10.30%] |

  **The control is the addition that matters**: 443 lure-free plays, zero crits,
  upper bound 0.86% — below the stated 3%. First positive evidence the crit
  source is the GEAR. **But attribution is now AMBIGUOUS**: a Sticky Lure (952)
  joined at 19:58:29Z and the one crit falls inside that window; the 27
  Steady-only plays hold none. **Do not restate the Steady Lure as the source.**
- **`/offchain/static` does NOT carry the 3%.** `gameItems` 951 and 952 have
  `NAME_CID`, `RARITY_CID` 1, `TYPE_CID: "Gear"`, image URLs — and no effect
  field at all. The 3% stays user-stated and API-unverifiable.
- **Session 49's `focusBudget.ts` header numbers are all stale** at 123 traces:
  meter-out 80.8%→**64.2%**, turns at focus 0 50.4%→**43.9%**, opening spend
  1.62→**1.40**. The meter-out premise survives; the numbers behind it moved.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **An `observeTurn` that records once per LOOP ITERATION is wrong.** A redraw
  or turn-free oil consume re-enters without advancing `turn`, so it emits
  `0 1 2 2 2 3` and shifts every profile after the first repeat. That version
  read opening spend **0.53**; corrected reads **0.77**. Verdict was FAIL both
  ways, but a recap would have quoted a number wrong by 45%. Caught by its own
  test, not by reading.
- **A merely WEAK card does not trigger `shouldRedraw` in the live loop.** The
  loop feeds `chooseCard` a real distribution concentrated on the fish, so a
  card covering 9 of 16 cells comes back `pHit 1.0` with positive EV. Use
  `hitZones: []`.
- **`checkFishingCaps.ts` printed "A gap means casts this process did not send"
  on ANY disagreement** — a sentence describing only one direction, and the repo
  has now drifted the other way. Fixed by sharing the reconciler.
- **A one-way `Math.max` clamp is the plausible wrong ledger fix** — it passes
  "refuses a cast the game says is spent" and fails "allows a cast the game says
  remains". Both directions are pinned; demonstrated.
- Standing: never report energy as a blocker; exercise `--dry-run` before
  claiming a blocker; do not revert rule 8; do not loosen the `fakeDoc`
  observability guard; §19, rule 8 and corrode-in-`dungeonSim` are CLOSED;
  `boonCapture` settled OFF; do not fold stock into the oil threshold.
- **`npx tsx` and `git` both fail under the command sandbox** on this machine.
  Run unsandboxed. Not a repo problem.

## Metrics
- **Live: 0 casts, 0 dungeon runs.** Ledgers at session start: game **16/20**,
  repo **15**. Gap flipped direction from session 69 (game 14 / repo 15) because
  the user played two casts by hand.
- **Corpus unchanged at 124 casts / 123 clean traces / 521 playTurns.**
- Corpus focus profile `3.00 1.60 0.92 0.51 0.29 0.09 0.10 0.09 0.12 0.08 0.00`,
  meter-out 64.2%, mana-out 7.3%, caught 27.6%.
- Sim (live config, n=4000): opening spend 0.77, meter-out 32.5%, catch 20.7%.
- Sim (bare default, synthetic fish — **the arm the oil sweeps ran**): opening
  spend 0.64, meter-out **1.0%**, catch **70.8%**.
- **Suite 1328 → 1360.** New: `fishingLedgerReconcile` 9, `redraw` 11,
  `oilShadowExchangeArm` 6, `focusProfile` 6.
- The certainty gate's live record is unchanged and now pinned as literals:
  held **0 of 9** Relaxing firings; the exchange threshold would have held **2**
  (0.964, 0.975).

## Open questions for Claude
1. **Why does the same `chooseCard` spend 1.08 live and 0.73 in replay?** This
   is now the blocking question for any focus-policy decision, it is offline,
   and it costs no casts. Candidates are `offPolicyReplay.ts`'s own stated
   conservatisms (leave-one-out weakening the models the policy consults;
   truncation at the recorded length) — but which, and how much, is unmeasured.
   Note the corrected-map era (1.07) and live (1.08) agree to 0.01, so the data
   has the phenomenon both models lose.
2. **Should the Shroom Rod deck become the sim's `REAL_DECK`?** It is the deck
   the account now plays. Repointing it makes every historical number
   incomparable; not repointing it makes every future comparison wrong. This is
   a judgement call about which the user should make, not the agent.
3. **The crit source is one of TWO lures and cannot be separated at n=1.** A
   handful of casts with only ONE lure equipped would settle it. Worth casts?
4. **Redraw: is `REDRAW_THRESHOLD` recalibration the next session's work?** The
   action is confirmed and guarded; the blockers are named in SPEC §7a (the
   matcher observation on `FISH_MOVED`, and a real per-cast redraw budget).
5. **The ledger's missing cast (13024510) has no client-visible cause.** Worth
   reporting to the game, or just absorbed now the repo defers?
6. Still open from session 68: **should `preflight.ts` run in CI?**

## Files changed
```
 5 commits (c69e4bb, 9a4f737, eeaf260, 29cb031, 1300722). 17 files, +2200 −20.

     scripts/focusProfileCheck.ts                 | 270  (new — GATE 1)
     tests/fishing/fishingLedgerReconcile.test.ts | 263  (new — GATE 2)
     tests/fishing/redraw.test.ts                 | 250  (new — §1)
     scripts/liveFishing.ts                       | 238  (reconcile + redraw + guard)
     scripts/critByGear.ts                        | 212  (new — §5a)
     tests/fishing/oilShadowExchangeArm.test.ts   | 207  (new — §3)
     handoff/reports/session-70-focus-profile.md  | 199  (new)
     SPEC-fishing.md                              | 173  (§7a, the rod, the crit rescope)
     src/orchestrator/fishingLedgerReconcile.ts   | 144  (new — GATE 2)
     tests/fishing/focusProfile.test.ts           |  98  (new — observeTurn inert)
     src/sim/fishing/castSim.ts                   |  49  (observeTurn)
     src/strategy/fishing/oilShadow.ts            |  42  (SHADOWED_OIL_POLICY)
     src/orchestrator/guards.ts                   |  20  (adoptServerRunCount)
     scripts/checkFishingCaps.ts                  |  18  (shares the reconciler)
     scripts/focusReserveAblation.ts              |  13  (REAL_DECK annotated)
     scripts/fishingEmpiricalAblation.ts          |  13  (REAL_DECK annotated)
     scripts/oilMomentAudit.ts                    |  11  (prints both gates)
```


---

# Verbose appendix (log only)

## A. The ledger census, in full

Guard-day 2026-08-21 (starts 18:00 UTC). Seven `liveFishing.ts` invocations,
16 `start_run` POSTs, one rejected → **15 successes, 15 distinct docIds**,
matching the repo counter of 15 exactly.

```
 1  2026-08-21T19:58:29Z  doc=13022748
 2  2026-08-21T20:01:17Z  REJECTED — "Player is already in a game"  (correctly recorded nothing)
 3  2026-08-21T20:11:06Z  doc=13022872
 4  2026-08-21T20:11:19Z  doc=13022874     <- the CRIT cast
 5  2026-08-21T20:11:38Z  doc=13022875
 6  2026-08-21T20:11:52Z  doc=13022876
 7  2026-08-21T21:59:22Z  doc=13024476     batch cast 1
 8  2026-08-21T21:59:50Z  doc=13024510     batch cast 2  <<< NO LEDGER TICK
 9  2026-08-21T22:00:07Z  doc=13024527
10  2026-08-21T22:00:23Z  doc=13024544
11  2026-08-21T22:00:36Z  doc=13024550
12  2026-08-21T22:00:55Z  doc=13024562
13  2026-08-21T22:01:12Z  doc=13024567
14  2026-08-21T22:01:26Z  doc=13024574
15  2026-08-21T22:01:40Z  doc=13024579
16  2026-08-21T22:01:54Z  doc=13024581
```

Per-cast `ledgerRemaining` across the batch (a live read of the game's ledger
after every cast) — this is what localizes the miss:

```
after cast  1  2  3  4  5  6  7  8  9 10
remaining  14 14 13 12 11 10  9  8  7  6
dayDocs     6  6  7  8  9 10 11 12 13 14
              ^ no tick
```

Cast 2 in full — ordinary in every respect, and energy WAS charged:

```
POST  start_run    -> doc=13024510  "Game started successfully."
POST  play_cards   cards[1] focus[3,2]
POST  play_cards   cards[0] focus[3,2]
POST  play_cards   cards[0] focus[3,2]
POST  use_fishing_item itemId 937 (Relaxing) -> complete=true  "Item used successfully."
cast_over  outcome=caught turns=3
POST  loot cards[10]
energy_accounting  before 408 after 396 observedDelta 12 committedDelta 12 drifted=false
```

Terminal action per cast — oil-ending is NOT the discriminator:

```
cast  1 doc=13024476 plays=10 endedBy=play_cards       escaped  tick
cast  2 doc=13024510 plays=3  endedBy=use_fishing_item caught   NO TICK
cast  3 doc=13024527 plays=4  endedBy=play_cards       caught   tick
cast  4 doc=13024544 plays=2  endedBy=play_cards       escaped  tick
cast  5 doc=13024550 plays=4  endedBy=use_fishing_item caught   tick
cast  6 doc=13024562 plays=3  endedBy=use_fishing_item caught   tick
cast  7 doc=13024567 plays=2  endedBy=play_cards       caught   tick
cast  8 doc=13024574 plays=1  endedBy=use_fishing_item caught   tick
cast  9 doc=13024579 plays=2  endedBy=play_cards       caught   tick
cast 10 doc=13024581 plays=6  endedBy=use_fishing_item caught   tick
```

## B. Gate 1 — full `focusProfileCheck.ts` output

```
▸ focusProfileCheck.ts — GATE 1 for the session-70 focus sweep
  n=4000 per sim arm, seed base 1. Corpus is every clean trace on disk.
  profile default, transitions data/fish-patterns.jsonl

── §1  THE CORPUS, RECOMPUTED ──
  CORPUS (live)
    focus:  3.00 1.60 0.92 0.51 0.29 0.09 0.10 0.09 0.12 0.08 0.00
    n    :   123  123  119   80   58   44   29   23   17   13   11
    meter-out 64.2%   catch 27.6%   opening spend 1.40   turns at focus 0 43.9%   casts 123

── §2  THE SIMULATOR ──
  SIM — live config (mined + contextual fallback, empirical fish)
    focus:  3.00 2.23 1.31 0.56 0.26 0.12 0.07 0.02 0.01 0.05 0.00
    meter-out 32.5%   catch 20.7%   opening spend 0.77   turns at focus 0 36.2%

  SIM — bare default (synthetic fish, no fallback) — the oil sweeps' arm
    focus:  3.00 2.36 1.48 0.71 0.40 0.35 0.15 0.00 0.00 0.00 0.00
    meter-out 1.0%   catch 70.8%   opening spend 0.64   turns at focus 0 27.2%

── §4  VERDICT ──
  corpus opening spend  1.40  95% CI [1.23, 1.56]  n=123
  sim    opening spend  0.77  95% CI [0.75, 0.79]  n=4000

  *** FAIL *** — the sim's 0.77 is OUTSIDE the corpus's interval.
```

Note the bare-default arm: **meter-out 1.0%, catch 70.8%.** That is the arm
`oilConserveSweep.ts` actually ran. A fishery where 1 cast in 100 meters out is
not the one the server runs (64.2%).

## C. `focusBudgetSweep.ts --matcher=loo` — full table

```
  shipped: caught 40/123 = 32.5%   per-turn hit 198/400 = 49.5%

  ── PRECONDITION ──
    the RECORDED policy, off the same traces:
      casts that ever hit focus 0: 86/123 = 69.9%   turns at focus 0: 281/517 = 54.4%
      mean spend on the FIRST move: 1.40 of 3
    ...split by ZONE-MAP ERA:
      transposed map, 68 casts: first move 1.66
      CORRECTED map,  55 casts: first move 1.07
    TODAY's policy in the replay (corrected map, matcher LOO):
      casts that ever hit focus 0: 45/123 = 36.6%   turns at focus 0: 101/400 = 25.3%
      mean spend on the FIRST move: 0.73 of 3
    LIVE opening spend (ringPrediction.jsonl, n=50): 1.08 of 3, 95% CI [0.82, 1.34]
    => PRECONDITION FAILED

  policy                       caught          Δcaught (casts)   McNemar p
  costCap(0)                   12/123 =  9.8%   +3 / -31            0.000
  costCap(1)                   39/123 = 31.7%   +5 / -6             1.000
  costCap(2)                   40/123 = 32.5%   +0 / -0             1.000
  threshold(0.1)               40/123 = 32.5%   +0 / -0             1.000
  threshold(0.25)              40/123 = 32.5%   +0 / -0             1.000
  threshold(0.5)               40/123 = 32.5%   +0 / -0             1.000
  threshold(1)                 40/123 = 32.5%   +0 / -0             1.000
  threshold(2)                 34/123 = 27.6%   +3 / -9             0.146
  schedule(ceil(fishHp/bestHit)) 39/123 = 31.7%  +0 / -1            1.000
  schedule(3)                  37/123 = 30.1%   +0 / -3             0.250
  schedule(4)                  37/123 = 30.1%   +0 / -3             0.250
  schedule(6)                  26/123 = 21.1%   +4 / -18            0.004
  schedule(8)                  24/123 = 19.5%   +3 / -19            0.001
```

## D. The gear timeline, off the fixtures

Every fishing document carries `GEAR_CID_array`, so gear is recorded per cast.
Changes observed on 2026-08-21 (times UTC):

```
14:46:17  rod 922 (Makeshift), no lure          <- 8 casts here had NO lure
16:47:53  + 951 (Steady Lure)
19:58:29  - 922, + 811 (Shroom Rod), + 952 (Sticky Lure)
```

Resolved live against `/offchain/static` `gameItems`:

```
 811  Shroom Rod       Gear   CARD_CID_array [74,75,76,78,1,2,3,4,5,6]
 922  Makeshift Rod    Gear   CARD_CID_array [1,2,3,4,5,6,7,76,77,79]
  50  Stone Rod        Gear   CARD_CID_array [5,7,8,9,10,32,35,2,34,37]
 951  Steady Lure      Gear   (no CARD_CID_array, NO effect field of any kind)
 952  Sticky Lure      Gear   (no CARD_CID_array, NO effect field of any kind)
```

`fullDeck` base-ten across casts, confirming the rod really drives the deck:

```
...2026-08-21T17:00:23Z  1,2,3,4,5,6,7,...,76,77,79   (Makeshift)
   2026-08-21T19:58:29Z  1,2,3,4,5,6,74,75,76,78      (Shroom)  <- cast 13022748
   2026-08-21T20:11:19Z  1,2,3,4,5,6,34,74,75,76,78   (Shroom + a looted day-card)
```

Session 69's audited cast 13022748 held card **75**, which exists only in the
Shroom set — independent confirmation.

`GearInstance` suffixes decoded (all are MINT stamps, not equip stamps):

```
1787332895 -> 2026-08-21 10:21:35 PT   (#811)  first seen on a cast 12:58 PT  (+2h37m)
1787332903 -> 2026-08-21 10:21:43 PT   (#952)  first seen on a cast 12:58 PT  (+2h37m)
1787254688 -> 2026-08-20 12:38:08 PT   (#951)  first seen on a cast Aug-21 09:47 PT (+21h)
1786899920 -> 2026-08-16 10:05:20 PT   (#922)
```

## E. Anti-vacuity demonstrations, all four

Each was demonstrated failing, then restored; the suite is green at the final
commit.

```
GATE 2  wiring disabled          -> 3 wiring tests red, 6 rule tests green
GATE 2  Math.max clamp           -> 2 red (passes "refuses", fails "allows")
§1      redraw default -> true   -> "DEFAULTS OFF" red, alone
§1      intent guard disabled    -> the 3 refusal tests red
§3      SHADOWED_OIL_POLICY reverted to {1,1} -> identity + live-record tests red
```

## F. What was NOT done, and why

- **No focus policy recommended.** Gate 1 failed; a ranking from an unexercised
  harness is not a recommendation. `focusBudget.ts` untouched.
- **`REAL_DECK` not repointed to the Shroom deck.** Annotated in all three
  scripts instead — see open question 2. This is a call for the user.
- **Redraw not enabled**, and two blockers recorded in SPEC §7a rather than
  worked around: the matcher observation on `FISH_MOVED`, and a real per-cast
  redraw budget (`MAX_REDRAWS_PER_CAST` is a fail-closed safety cap, not a
  policy).
- **`focusBudget.ts`'s stale header numbers left in place.** Nothing about the
  module's code changed and the numbers will move again; the current ones are in
  `handoff/reports/session-70-focus-profile.md` §1.
