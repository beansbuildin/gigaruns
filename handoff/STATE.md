# STATE — session 93 — 2026-08-24 (PT) — code at commit 84f4d796 (recap c31531bc)

## Status
**GATE PASS — all four items delivered, one with a scope the ledger forced.**
§1 (relaxing-oil-only, config AND code), §2 (§33 answered, option b), §3
(`OBSERVED_OFFERS` regenerated) all landed. §4 ran **1 cast, not 10** — see
below; the reason is a real ceiling, exercised not assumed, and the user
approved the one-cast spend.

**Suite went 1 failed → 0 failed** (1749 → **1757 passed, 1757 total**).
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean,
`discoveredShipsClean` 8/8, no `raw/` committed.

**`assertionCoverage` and `preflight` BOTH RUN CLEAN for the first time in five
sessions** — 1757 tests counted with zero vacuous, and PREFLIGHT PASSED.

## What works
- **§1 — RELAXING-OIL-ONLY IS LIVE.** `dendren.oils.allowedItemIds` is `[937]`.
  A **withdrawal, not a stock artifact**: the bot declines Focus Oil even if
  stock returns. ⚠ **The brief's §4c-1 expectation was wrong and was checked,
  not implemented** — a config-only change does NOT stop 942 being evaluated.
  `onDemandTriggers` fires on `focusRemaining <= 0` regardless of stock (its own
  docblock says so), and `allowedItemIds` is checked inside `mayConsumeOil`
  *after* the trigger decides. The refusal then fell through liveFishing's
  `held <= 0` branch — **keyed on the BALANCE, not the reason** — logging
  `oil_trigger_no_stock`, writing a `dryTriggers` row and flagging the cast
  OIL-POLICY-DRY, out of **both** arms. Under a withdrawal that is permanent:
  every future cast whose meter hit zero would have left the corpus forever.
  So the withdrawn kind is now dropped from `oilWanted` **before** the spend
  loop under `oil_trigger_policy_withdrawn`. **A trigger the policy has
  withdrawn is not a dry bag.** Pinned WITH FIVE FOCUS OILS IN STOCK, plus a
  contrast case showing the session-92 budget still flagging the same cast dry.
- **§1 CONFIRMED ON ITS FIRST LIVE TURN.** The one cast fired the focus trigger
  at turn 2 (meter 0) and it was dropped by the new filter. **Zero log lines
  mention 942.** Under yesterday's code that turn flags the cast out of both
  arms.
- **§2 — §33 ANSWERED (option b).** `castTrace` carries `consumablesUsedMax`
  (MAX over every captured state — `fishingCorpus.ts`'s own rule);
  `oilsConsumed` returns it; `tests/sim/oilCensusAgreement.test.ts` ties the two
  readers together permanently. Turn semantics untouched (that was option a).
- ⚠ **THE UNDERCOUNT WAS 27 CASTS, NOT 6, AND DATES FROM SESSION 62.** Census
  15/24 → **39/56**, against §33's estimate of 21/35. §33 reasoned from the
  double-lethal, but **the on-demand LETHAL trigger fires when the oil finishes
  the fish — so a *successful* lethal firing has always landed on the closing
  turn.** 26 of 27 blind casts are `caught` with final `fishHp` ≤ payload damage
  (single lethal) or exactly 4 (double). This was never a new policy breaking an
  instrument; it was **an instrument blind to the shipped policy's own successes
  for thirty sessions.** Under-counted 27×, over-counted 0× — nothing published
  was inflated.
- **§3 — `OBSERVED_OFFERS` regenerated after three declines.** Re-verified
  first, per the gate: **25 rows in the corpus and absent from the table, ZERO
  the other way** — incomplete, never wrong. All 25 from four juiced runs on
  2026-08-24. Deepest new row is room 8, so the room-9 pin and "offers stop one
  room short of the deepest death" both hold untouched.
- **§34 ANSWERED — `JEBAITOR`.** §34 asked for the `start_run` body on
  recurrence; it recurred, the body was captured, and it carries
  `{"type":"JEBAITOR","value":6.75}` — a skill giving ~6.75% chance a cast does
  not count against the daily ledger (user-stated). **166 casts with a captured
  `start_run`, JEBAITOR on exactly 3, and two of the three are the ONLY two
  casts ever observed uncharged** (`13071800` = session 92's §34 cast, and
  `13073296`). The third predates the instrument (rule 10 — the event is
  datable only because it sits on the SERVER's response). **This direction is a
  GAIN, not a defect.**

## What's broken
- **Nothing is red.** Suite 1757/1757, `assertionCoverage` clean, PREFLIGHT
  PASSED. First fully-green handoff in five sessions.
- ⚠ **`firedOil` CHANGED MEANING and one published claim diluted.** All twelve
  casts §2 added to `oilSupplied`'s oil arm are **Relaxing** firings, which do
  not restore the meter — so the restore-stripping counterfactual fell
  **48.5% → 37.5%** purely by dilution. `firedOil` only ever approximated
  "restored the meter" *because the reader was blind to exactly the oils that
  don't restore*. The claim is now asserted on the restore predicate directly:
  13 casts, **51.7%** stripped vs a standardised preOil **57.2%** — within
  5.5pp, **tighter** than the 6.8pp the blind reader gave. The claim survived;
  do not quote the 48.5% figure again.
- ⚠ The "meter-vs-`consumablesUsed` gap is exactly 2" reading is **retired** —
  that constant was an artifact of both readers being broken in the same place.
  It is **13 against 39** now.
- ⚠ **`12975152` is exempted from the preOil restore-free control**
  (`PRE_OIL_CONSUMABLE_EXEMPT`). It reads `consumablesUsed: 1` on all four
  captured states, every one a `play_cards`: capture began mid-cast, the spend
  predates the window and the policy. Exempted on a claim, not by loosening the
  check. **A second id arriving there is a different fact — investigate, don't
  append.**
- Carried, untouched: the gate-1 re-audit; the two unpaid redraw correctness
  gaps (`liveFishing.ts:2471`, `:1526`); the pacing term's cause; H2's proc
  model; §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED**.

## Corrections to SPEC.md
- **None this session.** No live response contradicted the spec; `SPEC.md` and
  `SPEC-fishing.md` are untouched.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Rule 9 — the brief was wrong twice and both were checked, not implemented.**
  (a) §4c-1's "no 942 trigger evaluation at all" — false, see §1 above; the
  correction *is* the code half of §1. (b) §0's claim that `oilPolicy.test.ts`
  does not read `config/bot.json` — **it does**, at line ~236, and that
  assertion had to be inverted to pin the withdrawal.

## Dead ends
- **Hand-editing any moved pin — REFUSED.** All 59 recomputed from measured
  values, each carrying a `[session 93] was X` attribution.
- **Regenerating `OBSERVED_OFFERS` wholesale — REFUSED.** The table carries
  per-entry historical annotations going back to session 03; the 25 missing rows
  were generated from the corpus and appended instead.
- **Reverting `boons.test.ts`'s Wall-1 clean list — not needed.** +1
  `UpgradeRock` is an already-clean type recurring, **not** a seventh hole (the
  session-60/61/75 distinction). Sixth consecutive session of that pattern.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED; `boonCapture` OFF.

## Metrics
- **Live: 1 fishing cast, 1 caught (100%), 1 Relaxing Oil, 12 energy. ZERO
  dungeon runs** (`dayProgressEntities` null). Relaxing 46 → 45; Focus stock
  irrelevant now.
- ⚠ **THE BATCH WAS 1 CAST BECAUSE BOTH CEILINGS WERE REAL, AND BOTH WERE
  EXERCISED BEFORE BEING REPORTED** (rules 12 and 13). `checkFishingCaps.ts`
  read `dayDocs[pond 2]` at **19/20** — the daily counter had NOT reset, 16.4h
  to 11:00 PT. `liveFishing.ts --dry-run` tripped the repo's own budget at
  **240/240**. The user then approved raising `dendren.dailyEnergyBudget`
  **240 → 252** to spend the day's last cast, which expires unused at rollover.
  **That bump is safe to leave: 252/12 = 21 casts and the GAME caps the day at
  20**, so it can never buy a cast the server would not already refuse.
- **§4c-2 — the double-lethal did NOT fire.** One ordinary on-demand lethal:
  fish 1/19 → one Relaxing → 0/19, CAUGHT. Per-cast Relaxing cap of 2 **not
  reached** (1 of 2), so the reached-not-bound streak neither extends nor breaks.
- **§4c-3 — redraw shadow: 2 decisions, 0 fires, 1 blind, 0 sanity/error**,
  `liveRedrawEnabled` false on both rows. Both had `conditionMet` true and
  `coverageBelowK` FALSE (heldCoverage 16 and 13 against a threshold of 6).
  A 2-decision cast — a SHORT one, where session 92 saw fires concentrate — and
  it produced none. **n=2 settles nothing.** Running tally: 0/52, 4/24, 0/2.
- **§4c-4 — ROD-DEALT, not `BASE_DECK`.** focusDry base count still 12 of 33.
- ⚠ **The new cast is itself a live instance of the §33 defect fixed hours
  earlier** — `consumablesUsed` reads 0,0,0 across its turns and 1 on the item
  response. Counted correctly now; invisible under yesterday's reader.
- Suite **1 failed / 1749 passed → 0 failed / 1757 passed (1757)**.
- Corpus: **188 → 189 casts**. `preOil` 94 and `oilSupplied` 62 both still
  FROZEN (now asserted directly, not implied by a sum); all growth in
  `focusDry` 32 → 33 — **fourth consecutive batch**.

## Open questions for Claude
1. **The 10-cast batch is still owed and is the obvious next ask.** The ledger
   resets 11:00 PT; nothing about it is blocked any more. The redraw-shadow
   puzzle (0/52 vs 4/24, Fisher p = 0.008) has 2 more observations and still
   needs volume, not a redesign.
2. **Should `dendren.dailyEnergyBudget` stay at 252?** It is safe (the game caps
   at 20 casts) but it is no longer the binding ceiling, which is a change in
   what that number means. A one-line ruling either way.
3. **§2 found that a shipped policy's own successes were invisible to the census
   for thirty sessions. That is worth one deliberate audit, not a fix.** The
   pattern is "an instrument that walks the END of a cast, unchecked against the
   shape the current policy produces". Two instruments broke on it in sessions
   92-93. A brief that names the remaining end-of-cast readers and asks for them
   to be checked once would close the class.
4. **`firedOil` now means "spent any consumable".** Anything that wants "restored
   the meter" must use the restore predicate. Worth stating in the next brief so
   it is not re-conflated — it was conflated for thirty sessions by accident.
5. **The rod: ~21 of the user's ~40-cast horizon is now spent.** `rodDeck.test.ts`
   goes red when it runs dry; that is designed.
6. **§34 is CLOSED and should not be reopened.** The `raised` direction of a
   ledger disagreement still has no explanation — do not generalise JEBAITOR to
   it.

## Files changed
```
 2 commits, 24 files (+1006 / -136), 1 new cast fixture (5 states).

  M  config/bot.json                        §1 allowedItemIds [937]; §4 budget 240 -> 252
  M  scripts/liveFishing.ts                 §1 oil_trigger_policy_withdrawn filter
  M  src/sim/fishing/castTrace.ts           §2 consumablesUsedMax
  M  src/sim/fishing/castEra.ts             §2 oilsConsumed repointed; PRE_OIL_CONSUMABLE_EXEMPT
  M  src/orchestrator/fishingLedgerReconcile.ts  §34 names the JEBAITOR cause
  M  src/sim/boons.ts                       §3 +25 regenerated offers
  A  tests/fishing/oilFocusWithdrawn.test.ts     §1, 3 cases
  A  tests/sim/oilCensusAgreement.test.ts        §2, ties the two readers
  M  tests/boons.test.ts                    §3 Wall 1 183 -> 195, clean +1
  M  tests/fishing/{castEra,matcherHeadroom,oilReachability}.test.ts
  M  tests/fishing/{redrawCounterfactual,stateFields,zoneTemplate,oilPolicy}.test.ts
  M  tests/fishing/offPolicyReplay.test.ts  §2 synthetic traces
  M  tests/sim/fishingCorpus.test.ts
  M  QUESTIONS.md                           §33 ANSWERED; §34 ANSWERED; §35 OPENED+LANDED
  M  handoff/DECISIONS.md                   7 entries
  M  handoff/OIL-POLICY.md                  §4, the withdrawal
  A  fixtures/fishing-casts/live/cast-2026-08-25-02-20-19  (5 states)
  M  handoff/reports/{fishing-casts,dungeon-runs}.md
  M  handoff/STATE.md, handoff/log/session-93.md
```
