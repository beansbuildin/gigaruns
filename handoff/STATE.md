# STATE — session 70 — 2026-08-21 (PT) — code at commit 1300722

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
  logs `ledgerRemaining` after every cast. Session 69's ten read
  `14 14 13 12 11 10 9 8 7 6`, so `dayDocs` went 5 → 6 → **6** → 7 → … → 14 and
  exactly ONE cast failed to tick it: **cast 2, docId 13024510**. Ordinary in
  every client-visible respect, and **the server DID charge its energy**
  (408→396, `drifted:false`). Ruled out from the same logs: double-counted doc
  (15 starts → 15 distinct docIds), resume, miscounted rejection, read lag,
  another pond, and oil-ending (casts 5/6/8/10 also ended on an oil and all
  ticked). **The missing increment is server-side with no client-visible
  cause.** Full census in `handoff/log/session-70.md` §A.
- **§4 the repo now DEFERS.** `reconcileFishingLedger` + `adoptServerRunCount`
  (deliberately NOT monotonic), wired inside `runOneCast` at the
  `getFishingState` every cast already makes — not in `main()`, per session
  64's dead-outer-wire lesson. Costs no extra request, runs before
  `assertCanStartRun`, persists the corrected count.
- **§1 redraw is CONFIRMED and the intent guard is live.**
  `buildFishingEnvelope` now **throws** on a `play_cards` with absent/empty
  `cards`; `buildRedrawEnvelope` is the only producer of `cards: []`. The send
  path is exercised only by tests forcing `redrawEnabled` true.
- **§5a `scripts/critByGear.ts`** — the crit rate rescoped to gear read off each
  cast's own document, with a real no-lure control.
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
  `schedule(8)` −19 p=0.001). **An inert arm here means NOT EXERCISED.** Full
  table in the log §C; the whole argument in
  `handoff/reports/session-70-focus-profile.md`.
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
  **811 Shroom Rod `[1,2,3,4,5,6,74,75,76,78]`**. Confirmed against play, not
  just the payload: every cast's `fullDeck` matched Makeshift until
  **2026-08-21T19:58:29Z** and is Shroom from that cast on, with
  `GEAR_CID_array` swapping the rod at the same cast. Session 15's "rod
  `itemEffects` are empty" stands — `/gear/items` was the wrong place to look,
  not the wrong question. **⚠ `REAL_DECK` in `fishingEmpiricalAblation.ts` /
  `focusReserveAblation.ts` / `focusProfileCheck.ts` is the MAKESHIFT deck and
  is now stale.** Deliberately not repointed: 110 of 123 clean traces were
  played on it, so changing it makes old and new numbers incomparable without
  making either right. See open question 2.
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
  `/offchain/static` does NOT carry the 3% — `gameItems` 951 and 952 have no
  effect field at all, so it stays user-stated and API-unverifiable.
- **Session 49's `focusBudget.ts` header numbers are all stale** at 123 traces:
  meter-out 80.8%→**64.2%**, turns at focus 0 50.4%→**43.9%**, opening spend
  1.62→**1.40**. The meter-out premise survives; the numbers behind it moved.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **An `observeTurn` recording once per LOOP ITERATION is wrong.** A redraw or
  turn-free oil consume re-enters without advancing `turn`, so it emits
  `0 1 2 2 2 3` and shifts every profile after the first repeat. That version
  read 0.53; corrected reads 0.77. FAIL either way, but a recap would have
  quoted a number wrong by 45%. Caught by its own test, not by reading.
- **A merely WEAK card does not trigger `shouldRedraw` in the live loop** — the
  real distribution concentrates on the fish, so a 9-of-16-cell card returns
  `pHit 1.0` and positive EV. Use `hitZones: []`.
- **A one-way `Math.max` clamp is the plausible wrong ledger fix** — passes
  "refuses a cast the game says is spent", fails "allows one it says remains".
  Both directions pinned and demonstrated.
- `checkFishingCaps.ts`'s disagree line described only one direction; fixed by
  sharing the reconciler.
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; do not loosen the `fakeDoc` observability
  guard; §19, rule 8 and corrode-in-`dungeonSim` are CLOSED; `boonCapture`
  settled OFF; do not fold stock into the oil threshold.
- **`npx tsx` and `git` both fail under the command sandbox** on this machine.
  Run unsandboxed. Not a repo problem.

## Metrics
- **Live: 0 casts, 0 dungeon runs.** Ledgers at session start: game **16/20**,
  repo **15** — gap flipped direction from session 69 (game 14 / repo 15)
  because the user played two casts by hand.
- **Corpus unchanged: 124 casts / 123 clean traces / 521 playTurns.** Meter-out
  64.2%, mana-out 7.3%, caught 27.6%.
- Sim (live config, n=4000): opening spend 0.77, meter-out 32.5%, catch 20.7%.
- Sim (bare default, synthetic fish — **the arm the oil sweeps ran**): opening
  spend 0.64, meter-out **1.0%**, catch **70.8%**. That is not this fishery.
- **Suite 1328 → 1360.** New: `fishingLedgerReconcile` 9, `redraw` 11,
  `oilShadowExchangeArm` 6, `focusProfile` 6.
- Certainty gate, now pinned as literals: held **0 of 9** Relaxing firings; the
  exchange threshold would have held **2** (0.964, 0.975).

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
   action is confirmed and guarded; the two blockers are named in SPEC §7a (the
   matcher observation on `FISH_MOVED`, and a real per-cast redraw budget).
5. Still open from session 68: **should `preflight.ts` run in CI?**

## Files changed
```
 5 commits (c69e4bb, 9a4f737, eeaf260, 29cb031, 1300722). 17 files, +2200 -20.

  NEW  scripts/focusProfileCheck.ts                 270  GATE 1
  NEW  tests/fishing/fishingLedgerReconcile.test.ts 263  GATE 2
  NEW  tests/fishing/redraw.test.ts                 250  §1
  NEW  scripts/critByGear.ts                        212  §5a
  NEW  tests/fishing/oilShadowExchangeArm.test.ts   207  §3
  NEW  handoff/reports/session-70-focus-profile.md  199  the gate-1 argument
  NEW  src/orchestrator/fishingLedgerReconcile.ts   144  GATE 2
  NEW  tests/fishing/focusProfile.test.ts            98  observeTurn inert
       scripts/liveFishing.ts                       238  reconcile + redraw + intent guard
       SPEC-fishing.md                              173  §7a, the rod, the crit rescope
       src/sim/fishing/castSim.ts                    49  observeTurn
       src/strategy/fishing/oilShadow.ts             42  SHADOWED_OIL_POLICY
       src/orchestrator/guards.ts                    20  adoptServerRunCount
       scripts/checkFishingCaps.ts                   18  shares the reconciler
       scripts/oilMomentAudit.ts                     11  prints both gates
       scripts/{fishingEmpiricalAblation,focusReserveAblation}.ts  26  REAL_DECK annotated
```
