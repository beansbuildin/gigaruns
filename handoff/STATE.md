# STATE — session 89 — 2026-08-23 (PT) — code at commit 9dbb5919 (recap commit)

## Status
**GATE PASS — all six brief items delivered. No live spend, by design.** No
dungeon run, no fishing cast, no on-chain anything. `tsc --noEmit` clean,
`git diff --check` clean, `discoveredShipsClean` 8/8, secret scan clean.

**The suite went 72 failed → 42 failed** (1618 → 1673 passed, 1691 → 1716
tests). Every one of the 30 fixed was authorised by this brief's item-by-item
user rulings; **no failure was fixed by loosening an assertion**, and the four
structural claims that changed are named below rather than absorbed.

## What works
- **§1 / §28 ANSWERED — the redraw verdict is re-priced, not reversed.** User
  ruling recorded verbatim in `QUESTIONS.md` and `DECISIONS.md`. "43.9 mana per
  extra fish" retired at **7 sites where it was justifying the closure**;
  **kept verbatim** everywhere it reports what session 75 measured.
  `redrawEnabled` false and `REDRAW_THRESHOLD` 0, untouched. **§26's shadow
  evaluation is now UNBLOCKED and was deliberately NOT started.**
- **§2 / REAL_DECK — STATE.md named the wrong thing, and the real finding is
  bigger.** `REAL_DECK` matches the rod fine; the INDEPENDENT play-side
  assertion failed, and the claim it encoded is FALSE. See Corrections.
- **§3 / SPEC-fishing §4 — the three new `fishHp` exceptions share ONE cause and
  the long-awaited base-6 separator arrived.** `×1.6` is FALSIFIED. Prose
  updated because the data earned it, not just the pin.
- **§4 — three boon pairs modelled OFFLINE at zero run-unit cost**, all
  `latent`, all verified by a whole-object diff. `UNMODELLED_TYPES` 24 → 21.
- **§5 — `castEra.test.ts` regenerated from the instruments** against 168 casts,
  old values kept beside every pin.
- **§6 — the double-lethal oil trigger is built, verified, scored, and
  RECOMMENDED AGAINST.** Not wired. `handoff/OIL-DOUBLE-LETHAL.md`.

## What's broken
- **42 failures remain, all OUTSIDE the brief's five authorised items** and all
  corpus-count pins in files the brief did not name:
  `redrawCounterfactual.test.ts` 17, `oilReachability` 8, `matcherHeadroom` 7,
  `damageEconomy` 3, `zoneTemplate` 3, `fishingCorpus` 2, `enemies` 1,
  `boons` 1. **They are the user's to rule on, exactly as session 87 left them.**
  - ⚠ **`redrawCounterfactual.test.ts` is the one to think about before
    ruling.** Several of its pins (the mana slack 89.8%/5.85, the four-cell
    table) are the SAME figures frozen in `session-86-redraw-revisit.md` at
    `CORPUS-2026-08-23A`. Updating the live-computed test would make it
    visibly disagree with a memo §28 forbids recomputing. That is a real
    tension and it needs a decision, not a fix.
  - **`boons.test.ts`'s single failure is `OBSERVED_OFFERS`, 25 offers stale
    (202 vs 227) — and it is INERT, verified.** The offered-type SET is
    identical both ways (55), so `UNMODELLED_TYPES` is unaffected. Regenerating
    it is ~1100 lines of hand-transcribed table for zero downstream change.
- **`scripts/assertionCoverage.ts` STILL CANNOT RUN** — fails closed on a red
  suite. The "zero vacuous" check is **BLOCKED, not passed**, for as long as
  the suite is red.
- **`scripts/preflight.ts` STILL FAILS and the repo is STILL NOT SHAREABLE** —
  same cause, smaller number: **42 failed / 1659 passed / 15 skipped (1716)** in
  the exported tree. Everything else is GREEN: 306 files exported, exactly one
  `✗` in the empty-HOME `doctor.ts` run and it is the expected missing JWT, and
  the exported tree's **secret scan is clean**.
- Carried, untouched: the gate-1 re-audit; the two unpaid redraw correctness
  gaps (`liveFishing.ts:2471`, `:1526`) — now the NAMED reason redraw is closed;
  the pacing term's cause; H2's proc model; `play_cards`/redraw/`use_fishing_item`
  unrouted; §0a NOT lifted, **+19.40pp MAY NOT BE QUOTED**; Focus Oil stock 0.

## Corrections to SPEC.md
- **SPEC-fishing §4b said "every cast's `fullDeck` matched the rod's list".
  FALSIFIED, and fixed in SPEC-fishing.md.** Two consecutive casts **15 seconds
  apart** with a **byte-identical `GEAR_CID_array`** were dealt different decks:
  `[74,75,76,78,1,2,3,4,5,6,29]` then `[1,2,3,4,5,6,7,8,9,10,29]`. Same node,
  level, `day`, juice, looted tail.
  - **`[1..10]` is the UN-BONUSED deck, not a ninth rod** — all eight rods in
    `/offchain/static` checked (49, 50, 336, 811, 812, 922, 923, 924), none
    grants it. 7/8/9/10 cover exactly the hit zones 74/75/76/78 do, worse.
  - **Intermittent, not a rod change** — 2026-08-17 (21 casts, ended),
    2026-08-24 (17 casts, current). So `REAL_DECK` was **deliberately NOT
    repointed**; doing so would silently re-baseline every pinned sim number.
  - **`GEAR_CID_array` never identified the ACTIVE rod** — it carries Stone Rod
    (50) beside Shroom (811) on every recent cast.
  - **38 of 149 casts were dealt `BASE_DECK`** and no figure here has ever said
    so. Makeshift/Shroom a second time: **say which deck a comparison used.**
  - **Cause UNKNOWN, deliberately not guessed. `QUESTIONS.md` §29** asks for the
    one cheap live read that would settle it.
- **SPEC-fishing §4's `fishHp` rule: the exceptions are SIX, and they are ONE
  RULE.** Fixed in SPEC-fishing.md. `13055892 t1`, card 7, base **6**,
  non-lethal, `FISH_HP_DIFF` **9**: `×1.5` round-half-up → 9 ✓, `×1.6` rounded
  → 10 ✗ **FALSIFIED**. All six fit one rule, hit- and crit-based, lethal and
  not. ⚠ **A NARROWED FAMILY, NOT A CONSTANT: m ∈ [1.5, 1.5833)** — 1.5 sits on
  the lower endpoint, and **1.55 survives**. Next separator is a base of 12+,
  which no known deck has. **Multiplier still NOT encoded in `cardChoice.ts`.**
  - **Card 7 exists only in `BASE_DECK`** — the anomaly that broke
    `rodDeck.test.ts` is the same anomaly that paid for this result.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Rule 9, one correction to the session-89 brief:** it expected the REAL_DECK
  failure might be in an older file. It is in `rodDeck.test.ts` itself, on the
  "grant table agrees with PLAY" check — the case the brief explicitly
  anticipated. But its framing ("REAL_DECK is stale") was wrong in both
  readings: the constant is fine, the CLAIM is false.

## Dead ends
- **Regenerating `OBSERVED_OFFERS` — considered and declined.** ~1100 lines of
  hand-transcribed table; verified first that it changes nothing downstream.
- **Repointing `REAL_DECK` to `BASE_DECK` — considered and declined.** The
  2026-08-17 base window ENDED, so the base deck is a transient state, and
  repointing would re-baseline ~6 test files of pinned sim numbers.
- **`--held=1` for the double-lethal sweep — not viable.** The trigger is
  identically inert at one oil, so the published `held=1` numbers cannot be the
  comparison. Both arms re-run at `held=2`.
- Standing, none re-opened: redraw CLOSED (now on a different stated reason);
  energy is never a blocker; `--dry-run` before claiming a blocker; do not
  revert rule 8; +19.40pp SUSPENDED; `boonCapture` OFF; no H2 proc model; do not
  read `SIM blind` as a live proxy; do not restate session 86's finding without
  the word **UNIFORM**.

## Metrics
- **Live: ZERO. No dungeon run, no fishing cast.** `dayProgressEntities` and
  `dayDocs` untouched and unread — nothing was spent, so rule 13 has nothing to
  reconcile.
- Suite **72 failed / 1618 passed / 1 skipped (1691) → 42 failed / 1673 passed /
  1 skipped (1716)**. Files 11 failed of 99 → 8 of 100 (`oilDoubleLethal` is new).
- Sim: **n=8000/arm paired seeds**, double-lethal band. Band arises **8.27%** of
  decisions; trigger fires **3.48%**; cutoff withholds on **58%** of band turns
  (1084 of 2580 — **not degenerate**). `double-lethal(r=1)` **95.03%** catch vs
  `on-demand` **94.90%**: **+0.13pp for 1409 extra oils = 140.9 marginal oils
  per extra fish, against a bar of ~12.** `double-lethal(r=0)` reproduces
  `on-demand` byte for byte (arm self-validation).
- Corpus: unchanged — 168 fishing casts, 71 dungeon attempts. **No fixture was
  added this session.**

## Open questions for Claude
1. **§29 is the cheapest high-value question on the board and it needs the
   USER, not an agent.** Next time they are in the game: **is the Shroom Rod
   still equipped, and does it show durability, charges, or a per-day limit?**
   One look separates every hypothesis. Until then, any sim figure quoted
   against recent live play is quoted against the wrong deck.
2. **The 42 remaining failures need a ruling, and `redrawCounterfactual.test.ts`
   (17 of them) needs it MOST** — see the tension with the frozen §28 memo
   above. This is a decision about which of two artefacts is allowed to be
   right, not a cleanup.
3. **§26's shadow evaluation is UNBLOCKED and wants its own brief.** §28's
   restated reason names "no validated trigger" as a blocker, and the shadow
   eval is the instrument that would produce that evidence. ⚠ It should know
   that the rescue evidence MOVED this session: **15/15 → 26/32, CI
   [64.7%, 91.1%]**, and `neither = 0` is retracted.
4. **The double-lethal trigger is declined on price — does the user want it
   deleted or left reachable-but-uncalled?** It is left uncalled (the
   `conservingOil` precedent) and still in `OIL_TIMING_POLICIES` so it keeps
   being scored.
5. **Standing captures, both still unmet:** a base-6/8/10 dungeon crit
   (`critEffects` still never observed); an oil consumed at a NON-ZERO meter
   (impossible while Focus Oil stock is 0).

## Files changed
```
 4 commits, 21 files, +1571 / -150.

  A  handoff/OIL-DOUBLE-LETHAL.md            the §6 write-up (recommends AGAINST)
  A  scripts/oilDoubleLethalSweep.ts         the n=8000 paired sweep
  A  tests/fishing/oilDoubleLethal.test.ts   19 assertions + a not-wired guard
  M  QUESTIONS.md                            §28 ANSWERED, §29 opened
  M  SPEC-fishing.md                         rod->deck falsified; fishHp rule updated
  M  src/sim/fishing/rodDeck.ts              BASE_DECK, KNOWN_DEALT_DECKS
  M  src/sim/boons.ts                        3 latent models
  M  src/strategy/boonCapture.ts             2 targets retired, 2 added
  M  src/strategy/fishing/oilTiming.ts       doubleLethalTriggers/doubleLethal
  M  tests/fishing/castEra.test.ts           every pin regenerated (+320/-…)
  M  tests/fishing/stateFields.test.ts       6-entry list + the interval proof
  M  tests/fishing/rodDeck.test.ts           ratchet rebuilt on PLAY
  M  scripts/{damageEconomy,liveFishing,redrawCounterfactual}.ts   43.9 retired
  M  src/sim/fishing/{castSim,redrawCounterfactual}.ts             43.9 retired
  M  tests/{boons,boonCapture,liveRun,fishing/pConnectConsumers}.test.ts
  M  handoff/STATE.md, handoff/DECISIONS.md, handoff/log/session-89.md
```
