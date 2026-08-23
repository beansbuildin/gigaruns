# STATE — session 81 — 2026-08-22 (PT 2026-08-22) — code at commit 2981e4ea

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1573/1573** (was 1561), 95 files,
`tsc --noEmit` clean, `git diff --check` clean, `assertionCoverage` **0
vacuous**, `discoveredShipsClean` passes.

- **The crit rule family is down from three members to TWO.** The third crit
  anomaly landed on this session's live batch and **falsifies
  `floor(hit × 5/3)`**. `hit × 1.5` round-half-up and `hit × 1.6` rounded both
  survive. Card 10 crits for 10 and is in the deck — the last two are
  separable by ordinary casting.
- **Both gates were pinned BEFORE the live batch and both HELD on the 22 new
  plays they had never seen.** The resolver went 590/590 → **612/612**
  exceptionless; the headroom instrument moved by ≤1pp on every row.
- **Live: 8 casts played, all 8 authorised** (the full remaining allowance,
  two batches of 4 with a ledger check between). Ledgers agree at **20/20**.
  6 catches, 4 casts consumed oil. **0 dungeon runs, 12 run-units unspent.**
- **Ship-nothing posture HOLDS.** No strategy changed. Every new module is a
  measurement instrument; nothing it reports is wired to a decision.

## What works
- **§1 GATE 1 — the resolver pinned at 612/612 WITH its predicate, and the
  wire semantics it depends on** (`zoneAudit.ts` `RESOLUTION_READINGS`,
  `zoneTemplate.test.ts`). The brief asked for a new test; that test has
  existed since session 47 and already scored exceptionless, so what was
  actually missing was the OTHER axis — which two states a shot resolves
  between. Both states carry a `focusPoint` and a `fishPosition`:

  ```
    b.focusPoint + b.fishPosition           612/612  100.0%   <- the server's
    a.focusPoint + b.fishPosition           480/612   78.4%
    a.focusPoint + a.fishPosition           385/612   62.9%
    b.focusPoint + b.previousFishPosition   380/612   62.1%
  ```

  The pin **fails under the `previousFishPosition` reading** and asserts all
  four exact scores — a pin that does not fail the wrong reading has not
  tested anything. `scored` was `>= 282` for thirty-four sessions, which could
  not distinguish "the corpus grew" from "the predicate silently narrowed".

- **§1b GATE 2 — the matcher costed against a fixed ceiling**
  (`src/sim/fishing/matcherHeadroom.ts`, `scripts/matcherHeadroom.ts`, 9
  tests). Four policies, same 612 plays, same cards, same budget:

  ```
    RANDOM    uniform over reachable focus    20.3%   floor
    STAY-PUT  never move the focus            24.2%
    ACTUAL    the shipped bot                 36.3%
    ORACLE    same card, best focus           66.3%   ceiling
    ORACLE    best card in hand + best focus  71.1%
  ```

  Captures **34.6%** of available prediction headroom; **30.1pp** remain with
  today's cards and budget; card selection is worth **4.7pp** on top; focus
  MOVEMENT is worth **12.1pp** over never moving, so prediction is
  load-bearing. **ACTUAL is the only row a code change can move** — that is
  what makes it a scoreboard rather than a snapshot.

- **§5 answered: the miss is STRUCTURED, not diffuse.** 176 of 367 misses
  (**48.0%**) land ONE cell from the shot's footprint, 86% within two. The
  fraction was 48.0% before the batch and 48.0% after.

- **§2 the margin column** (`scripts/damageEconomy.ts`): `h* = heal/(damage+heal)`,
  margin = hit% − h*. LIVE −1.8pp, bare **+41.9pp**, blind −4.6pp, live-config
  +3.8pp. The bare arm is marked with its margin in the output so +19.40pp is
  not re-quoted by accident.

## What's broken
- **A ceiling that sat below its own floor, found by an assertion I wrote.**
  `prev.focusMeter` is the WRONG focus budget: 12 of 612 plays move the focus
  further than it allows, and the oracle called **6 server-scored HITS
  unhittable**. Cause: `castTrace.ts` skips `use_fishing_item` responses, so an
  oil restores the meter between two recorded turns. Fixed by reconstructing
  the budget as `spent + remaining`; both invariants now THROW.
- **23 of 612 plays (3.8%) fired a card with NO on-grid footprint** — every
  zone off-board, so the shot could not hit whatever the fish did. All misses;
  **6 avoidable** with the same card from a different reachable focus. A wasted
  play is invisible in the hit rate: it looks exactly like a bad prediction.
  **REPORTED, NOT FIXED** — live-policy change, rule 4.
- **The brief's 581 does not reproduce.** True count 590 (pre-batch), now 612.
  Neighbours it is not: 587/609 (clean traces), 583 (the brief's own stated
  discard predicate). Hunt time-boxed and abandoned.
- **§0a is NOT lifted. +19.40pp still MAY NOT BE QUOTED.**
- **`play_cards`, redraw and `use_fishing_item` remain unrouted**, unchanged
  and for the unchanged reason (session 65). Blocked on a capture.
- Carried, untouched: H2's proc model (CAPTURE-1); shrinkage re-fit unstable;
  per-cast vs per-draw shuffle undistinguished; reshuffle-at-wrap unobserved.

## Corrections to SPEC.md
- **`floor(hit × 5/3)` is FALSIFIED — two crit rules survive, not three.**
  Cast `13041474` t2: card 38 landed in its own translated `critZones`, so the
  card's crit fired for base **9**, and the server reported `FISH_HP_DIFF`
  **14**. `×1.5`→14 ✓, `×1.6`→14 ✓, `floor(9×5/3)`→15 ✗. Two details make it
  usable: **it is LETHAL** (12→0), so the clamped delta says only "≥12" and
  only the uncensored field separates; and **the base is the card's CRIT
  amount, not its hit amount**. Session 80 searched `hitEffects` for a 9, found
  none, and DECISIONS recorded that casting could not settle this — but the
  lure scales whatever the shot's damage would have been, and base-9 crits are
  common (cards 38, 39, 40). **The two crit sources COMPOSE.** SPEC-fishing
  §CRIT_HIT rewritten. Next separator: base 6, 8 or 10; **card 10 crits for 10
  and is in the deck**.
- **SPEC-fishing §4d written — shot resolution ordering.** A card resolves
  against the focus point AFTER the move and the fish's cell in the RESULTING
  state, never `previousFishPosition`. 612/612. The wrong readings are
  dangerous for WHERE THEY LAND (62–79%), not for failing.
- **SPEC-fishing §4e written — the focus budget.** `spent + remaining` recovers
  the pre-play meter on 591/591 non-oil plays; all 21 failures are oil
  consumes, **zero residue**. **Restore-to-2 vs add-2 is NOT settled by the
  corpus** — all 21 fired at meter 0, where they are the same event. §4a's
  static table points at add-2 (`FishingRestoreFocus` is an amount per tier,
  Lil 1 / Mid 2 / Big 3; the bot spends the MID oil). Neither is encoded.
- **Session 80's "only the denominator grows" retirement is itself softened.**
  It was retired on one observation; this batch moved the relaxing numerator
  by ZERO across 8 casts. Two batches say the numerator moves *rarely* —
  weaker and better supported than either previous version.
- Unchanged: `mana -= card.manaCost` still unconfirmed (no 0- or 2-cost card
  has ever been played). Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/
  pondId=2. Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Recovering the brief's 581.** Tried clean-traces-only (587), the brief's
  own discard predicate (583), `lastMovePath` present (590), non-terminal
  (461). None is 581. Abandoned per session 80's lesson; every count now ships
  with the filter that produced it.
- **Reading the hit-9 separator as unreachable.** Session 80 searched
  `hitEffects` and concluded casting could not settle the crit rule. Wrong
  field — `critEffects` carries 9s, and one landed within eight casts.
- **`prev.focusMeter` as the focus budget.** Kept as the scored counter-model
  in the test, because a pin that does not fail the wrong model tests nothing.
- Standing, none re-opened: energy is never a blocker; `--dry-run` before
  claiming one; do not revert rule 8; redraw CLOSED on price; +19.40pp
  SUSPENDED; `boonCapture` OFF; do not build H2's proc model; do not write
  M4's lines; `DEFAULT_POTION_THRESHOLD` untouched; `chooseNewCard` UNTOUCHED;
  no 429 backoff without an observed 429; do not shuffle the random-sample deck.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.
- **`preflight.ts` (~90s) runs BEFORE the push**, not via CI after it.

## Metrics
- **Live: 8 fishing casts, all authorised, 6 catches (75%), 96 energy, 0
  dungeon runs.** Ledgers agree at 20/20; 12/12 run-units unspent. 4 casts
  consumed oil. 75% on n=8 is the highest batch on record and is **not**
  evidence of a change.
- Suite **1561 → 1573** (+12), 94 → 95 files. `assertionCoverage` 0 vacuous.
- Corpus: 140 → **148 casts**, 799 → **839 response docs**, 591 → **613 play
  turns**, 42 → **48 catches**. Oil-era casts 19 → 23.
- Headroom across the batch: random 20.4→20.3, stay-put 23.7→24.2, actual
  35.4→36.3, oracle 65.6→66.3, best-card 70.5→71.1. Aim-error spike at
  distance 1: 48.0% → 48.0%.
- Oil reachability: relaxing numerator **unmoved** at 13 casts / 15 points;
  rate 9.286% → 8.784%. Lax-vs-strict gap 16 → 17 (`13041476`).

## Open questions for Claude
1. **One crit on a base-6, base-8 or base-10 shot finishes the crit rule.**
   Card 10 (crit 10) is in the deck: `×1.5`→15 vs `×1.6`→16. This is now a
   cheap, well-defined target — it needs casts, not thought.
2. **30.1pp of hit rate is on the table and nobody has proposed a mechanism.**
   The miss is structured (48% at distance 1), which points at a better
   tie-break rather than a new model. What is the smallest change worth
   simulating, and what gate would it have to clear?
3. **The 23 no-footprint plays (3.8%, 6 avoidable) are a live-policy bug.**
   Fixing them is worth up to ~1pp of hit rate for no prediction improvement
   at all. Rule 4 says it needs a gate — what should that gate be?
4. **An oil consumed at a NON-ZERO focus meter settles add-2 vs restore-to-2.**
   All 21 on record fired at 0. Nothing needs it today; it is one cast away.
5. **12 run-units are unspent and one juiced dungeon run still seeds session
   78's `evSupported` telemetry.** Needs a per-run go-ahead (rule 11). The
   dungeon path has not executed since session 75.

## Files changed
```
 3 commits (aa912662, e7dd1f97, 2981e4ea, + this recap).

  NEW  src/sim/fishing/matcherHeadroom.ts      330  GATE 2, the scoreboard
  NEW  scripts/matcherHeadroom.ts              105  GATE 2, the report
  NEW  tests/fishing/matcherHeadroom.test.ts   190  GATE 2 + the budget model
       src/sim/fishing/zoneAudit.ts            +60  RESOLUTION_READINGS
       tests/fishing/zoneTemplate.test.ts      +45  GATE 1, all four readings
       tests/fishing/stateFields.test.ts      +115  the third crit, falsified
       scripts/damageEconomy.ts                +45  §2 margin column
       scripts/auditZoneTemplate.ts            +18  the four readings
       SPEC-fishing.md                        +115  §4d, §4e, CRIT_HIT
       tests/fishing/oilReachability.test.ts   ~20  corpus pins moved
       tests/sim/fishingCorpus.test.ts         ~15  corpus pins moved
       fixtures/fishing-casts/live/            +8 casts (~40 docs)
```
