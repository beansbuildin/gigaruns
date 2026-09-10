# STATE — session 126 — 2026-09-09 — commit <SHA>

## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data. The
session worked `handoff/next.md`'s session-126 brief, which was CURRENT.

**The gate the brief set: arm the Dendren catch-rate tripwire at n ≈ 100.
GATE FAIL — it did not arm. The Dendren corpus reached n = 76, not ~100**,
because the user closed the session after **2 fishing casts** of the 30-cast
scope. The reading at that n is **38/76 = 50.0%**; it is reported, not acted on.

**The dungeon arm is a full PASS: 12/12 run-units, 4 juiced Tier-2 runs,
0/280 first-attempt action failures**, every run separately authorised.

**⭐ THE BRIEF'S HEADLINE WAS WRONG AND THE CLOCK IS WHY. It was a CHOBO day,
not an Athena day** — day 20704 (dow 5) had 44 minutes left at session open.
All four runs were spent **before** the 18:00Z rollover, so they charged
**Chobo 30 → 18** and left **Athena untouched at 21**, the scarcest ring. The
brief's own runway warning was answered by reading the rollover clock, not by
skipping runs.

**⚠ TWO of the brief's six claims FAILED, both out-of-band user repairs —
the SECOND consecutive session with that exact failure mode.** 901 read **26**,
not 5; the slot-15 pair read **20 / 20**, not 1 / 6. Claims A–D passed exactly
(rings total 207, both ledgers fresh at 0).

Suite **2571 passed / 2571, 116 files, exit 0**. `tsc --noEmit` exit 0,
`git diff --check` exit 0.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`),
run AFTER staging:

```
> secret scan — scope: tracked
  files scanned:        15847
  CONTROL A (read):     15447 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
> PASS — no unexplained hits, both controls healthy.
```

Diff-scoped scan as an ADDITION, not a substitute: `--scope=diff --ref=6e3fa22e`,
PASS. **No leaks this session.**

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session — THREE, to hold the ~15 cap:** the **secret-scan
staging** entry (now enforced by the recap checklist and done correctly twice);
the **25% mitigator** entry (unchanged, still open, but it lives in open
question 2 and was eating a digest slot); **`castCap: 2` / fish-to-zero**
(folded into the rod entry below).

- ⭐ **[NEW] A REPAIR DOES NOT ALWAYS MINT A NEW `docId`. The settled claim has
  a clean in-session COUNTEREXAMPLE.** Rod 923 read durability **6** at
  17:14:57Z and **40** at 17:33:22Z under the **byte-identical** docId
  `GearInstance#923_…_44691fd0`. Keying on SLOT is still correct and still the
  advice; what is falsified is the MECHANISM claim that a repair always mints.
  ⚠ Only the rod is clean — 901 and the slot-15 pair were repaired before the
  first read, so their docIds cannot be compared. Re-opens as: *"a repair mints
  a new docId, so key on slot"* — the conclusion holds, the reason does not.
- ⭐ **[NEW] THE FACTION IS A FUNCTION OF THE ROLLOVER CLOCK, AND A BRIEF
  WRITTEN HOURS EARLIER WILL NAME THE WRONG ONE.** `checkEntryTiers.ts` prints
  `next day in HH:MM:SS`; reading it before the first run turned a forecast
  "Athena day" into an actual Chobo day and saved 12 Athena. **Read the clock
  before accepting any faction framing.** Re-opens as: *"this is an <X> day"*
  — verify it live first.
- ⭐ **[NEW] THE FIRST-EVER `Vulnerable` FLOOR-MULTIPLIER EXCEPTION, and it is
  a BOON.** `run-2026-09-09-17-28-53/state-120`: atk 39, Vulnerable 1, no proc
  flags, expected `floor(39×1.25)` = 48, server dealt **52**. Splitting on
  whether `VulnerableMastery` was active separates it perfectly — **ABSENT
  84/84 obey, ACTIVE 0/1**. ⛔ **NOT modelled** (n=1 needs a [USER] directive)
  and **not nameable**: 4/3, 1.35 and "+4" all reproduce 52 at atk 39.
  Enforced by `tests/statusEffects.test.ts`. Re-opens as: *"Vulnerable is
  exceptionless"* — no longer true — or *"model VulnerableMastery"* — needs a
  directive.
- ⚠ **[NEW] THE `deckShuffle` SEQUENTIAL BOUND WAS CROSSED — 6 of 515 — AND
  THE TWO NULLS NOW DISAGREE.** Under the ordered-uniform null P(≥6) ≈ 5.2e-6;
  under the SET null ≈ 3.5%. Pinned, not widened. The session-79 falsification
  is UNTOUCHED (6/515 = 1.17% against a 2% bar). Re-opens as: *"raise the
  bound to 7"* — no — or *"the loader is serving the pile sequentially"* — that
  would show 515, not 6.
- **[USER] EVERY DUNGEON RUN NEEDS ITS OWN GO-AHEAD.** A brief asserting "the
  user has authorized 4 runs" is the BRIEF's claim, not the user's. Ask. Held
  four times this session.
- **THE TWO WEAR SETS ARE DISJOINT AND EVERY BREAK IS FORECASTABLE.**
  **Dungeon: slots 11, 12, 13×2 at −3 per RUN. Fishing: slots 14, 15×2 at −1.00
  per PLAYED cast.** Confirmed again on all four runs and both casts — the rod
  read 40 after every dungeon run. ⚠ Durability **CLAMPS at 0**.
- **[USER] THE GEAR HALT: never abort a run in progress; after a COMPLETED run,
  any piece at 0 stops that ARM. Pieces already at 0 at session open are
  GRANDFATHERED. The halt is PER-ARM.** Fired on the dungeon arm after run 4,
  exactly as pre-registered, at no cost.
- **[USER] OTHER DUNGEONS ON THIS ACCOUNT ARE OUT OF SCOPE.** The 12-run-unit
  ledger is PER-DUNGEON, measured.
- **THE ROD IS READ AT PREFLIGHT AND AFTER THE BATCH, NEVER BETWEEN CASTS**, and
  **`--casts=N` is SILENTLY OVERRIDDEN by `--oil-batch`**. **Run fishing as
  repeated small `--oil-batch` invocations at `castCap: 2`.** Re-opens as:
  *"run the whole fishing day in one batch"*.
- **[USER] "Different fisheries" is RETIRED AS PHRASING; the conclusion stands.**
  QUESTIONS **§70**. Re-opens as: *"restore the `> 5` assertion"*.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.**
- **[USER] The double-lethal oil override is DISABLED; Focus Oil off the
  allowlist.**
- **[USER] The Tier-1/Tier-3 whole-run income baseline is RETIRED BY NAME.**
- **A new boon type from n=1 needs a USER DIRECTIVE. NOW TEN, not seven** —
  `LossLuckUp`, `IntuitionArmor` and `AddWeakShield` were added this session.
  Re-opens as: *"model the remaining latent boons"*.
- **Evade DOMINATES crit**, and **evade zeroes damage 15/15**.

## What works
- **Pre-registration as a git commit, SIX sessions running.** `6e3fa22e`,
  committed before any spend with both ledgers verified at 0.
- **`scripts/liveRun.ts` end to end, four times. 0/280 first-attempt failures**
  (62 + 63 + 58 + 97).
- **Rule 8's Perpetual filter fired live 7 times** (runs 2–4).
- **Every dungeon forecast landed EXACTLY** — rings −3/run sole mover on all
  four, and all four wearing pieces on their predicted values every time.
- **`scripts/checkGear.ts` bracketed around every run and the batch.**
- **The `--oil-batch` shape**: one invocation, `castCap: 2`, exited on the
  intended `cast_cap` reason, rod delta exactly −1.00/cast.

## What's broken
- ⚠ **THE GATE DID NOT ARM.** 2 casts of a 30-cast scope. Not a defect — the
  user closed the session — but the gate is unmet and stays open.
- ⚠ **`deckShuffle`'s derived bound was CROSSED (6 of 515)** — pinned, see the
  digest. The two nulls disagree about whether it is an anomaly.
- ⚠ **TWO MORE DRIFTING BOUNDS RE-PINNED, both continuing last session's
  direction.** `|BASE_ARM.meanDamage − LIVE.meanDamage|` 0.5497 → **0.5566**
  (benign: `BASE_ARM` is closed, so the whole move is LIVE rising — the test's
  own claim getting stronger). movePath step-count constancy 0.8972 →
  **0.8957**, a second consecutive fall toward the ring model's blind spot.
  **Do not fit a cause.**
- ⚠ **THREE new latent boon types in ONE session** — the largest single-session
  addition. All three verified latent no-ops at pickup; `IntuitionArmor` ROLLS
  (`val1Min` 7, `val1Max` 10, drew 7), so a single pickup cannot pin even its
  magnitude.
- ⚠ **Dendren catches WORSE than Golkan in live play — 50.0% (n=76) against
  59.6% (n=307).** Recorded as an observation, NOT a re-opening of the settled
  sim result. It is confounded by era and by the small n.
- ⚠ **`$TMPDIR` differs between sandbox modes and cost a cycle for the THIRD
  consecutive session.** Sandboxed `tsx` also fails outright (EPERM on its IPC
  socket).

## Corrections to SPEC.md
- **`SPEC.md` was not touched and needed no change.** No live response
  contradicted it.
- ⚠ **The brief's six checkable claims: FOUR PASSED, TWO FAILED (E and F).**
  Both failures are out-of-band user repairs, not spec errors.
- ⚠ **The brief's Dendren baseline (37/74 = 50.0%) VERIFIED** — live 38/76 after
  this session's cast. Rule 9 pass.
- ⚠ **`checkFishingCaps.ts` prints `REPO ledger: 2 casts, 24 energy`, and
  24/12 = 2.** Cast counter tracks CHARGED, energy counter tracks PLAYED. Both
  correct; reads as broken if skimmed. Noted, not changed.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.

## Dead ends
- **Do not read `fishBatchReport.ts` for a corpus-wide Dendren rate** — it is
  SESSION-scoped and printed `catch rate 0.0%` before any cast. The Dendren
  slice comes from `scripts/redrawDeckSlice.ts` / `splitByDealtDeck`.
- **Do not widen a crossed bound.** Three were crossed; all three became pins.
- **Do not name the 25% mitigator, or `VulnerableMastery`, without measuring.**
- **Do not "fix" `OBSERVED_OFFERS` source labels using the AFTER state.** The 35
  rows added this session use the BEFORE label.
- **Do not update corpus pins mid-session** — pinned only after the run-units
  were spent and the session closed.
- **Do not run the suite sandboxed** (`tsx` and `git` both fail), **do not trust
  a `tail`-piped exit code**, and **`$TMPDIR` DIFFERS between sandbox modes**.
- **Do not re-fit an arithmetic rotation rule** or re-hunt the advance
  faction-indicator field or the ring debit on the wire.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Dungeon, live: 4 juiced Tier-2 runs, 12/12 run-units, 240 energy**, all on
  game day **20704 (dow 5, Chobo)**. Deaths rooms **10 / 10 / 7 / 12**.
  Chobo 30→27→24→21→**18**, −3/run, sole mover every time. Charge shape
  33/33 → **37/37**. **0/280 first-attempt failures.** Hard Core **18,816**,
  Dendren Root **2,688**.
- **Fishing, live: 2 played / 2 charged** of a 30-cast scope, 24 energy.
  Catch **1/2**. One Relaxing oil consumed (28 → 27), Focus 0.
- **Gear: 640 34→22, 641 12→0, 901 26→14, 905 12→0** (dungeon);
  **rod 923 6→(repaired 40)→38, slot-15 pair 20→18 / 20→18** (fishing).
- **Rings, close: Chobo 18, Athena 21, Archon 24, Crusader 27, Summoner 30,
  Foxglove 33, Overseer 42 — total 195.**
- **§71 K=10 — QUOTE BOTH: POOLED margin −1, HELD for a third session**, and
  byte-identical components (b10 124 fires/43/8 = 35; all3 160/51/15 = 36).
  **DENDREN-ONLY margin −3** at n=76 (b10 net 4, all3 net 7).
- **Catch rate, POOLED AND DENDREN-ONLY** (carry-forward item 5, unanswered for
  two sessions): pooled **255/509 = 50.1%**, Dendren-only **38/76 = 50.0%**,
  Golkan **183/307 = 59.6%**.
- **`LIVE.drift` −0.7199 pooled** (was −0.7235) — **REVERSED AGAIN**, so the
  streak resets to **one**. Under the [USER] rule (`|drift| ≥ 1.0` OR five
  consecutive same-direction moves) **neither arm is close.** `damageHist` mode
  **5** pooled.
- **JWT valid another 71.4h**, expiry ≈ **2026-09-12T16:40Z**.
- Suite **2571 passed / 2571**, files 116 (was 2534/116).
- Corpus: **133 dungeon attempts** (was 129), **509 fishing casts** (was 507).
- Pins re-derived: ~85, over 12 automated passes plus ~20 hand edits.

## Open questions for Claude
1. ⭐ **Wire `blockedMove` into the opponent model.** UNTOUCHED this session —
   the offline work never started, because the dungeon arm ran to 12/12 and the
   session closed. Still free EV, still pure-strategy, still **zero live
   spend**. ⚠ Scope it: CURRENT vs NEXT exchange is not settled by the fixtures.
2. ⚠ **What is the 25% mitigator?** 73 exchanges take `floor(atk × 0.75)` with
   no proc flag. Untouched this session. Answerable offline.
3. ⭐ **What is `VulnerableMastery`?** New this session and the sharpest lead in
   the combat corpus: it separates the ONLY Vulnerable exception perfectly at
   n=1. **Needs exchanges at DIFFERENT `atk` values** — its `val1` never rolls,
   so more pickups will not separate 4/3 from 1.35 from "+4". Free to collect
   on any run where it is offered.
4. ⚠ **QUESTIONS §71 is on [USER] HOLD.** Pooled margin HELD at −1 a third
   time; Dendren-only reads −3 at n=76. Report the slice; do not decide.
5. **Gear forecast for the next session, free and pre-computable.** Dungeon:
   **641 and 905 are at 0 — the dungeon arm is HALTED and needs a repair before
   run 1**; 640 at 22 (7 runs), 901 at 14 (4). Fishing at −1.00/played cast:
   rod 923 at 38, slot-15 pair at **18 each — the pair binds first, at 18
   played casts**. **Raise the dungeon repair up front.**
6. **`Thorns` and NINE other latent boons await a user directive** — was seven;
   `LossLuckUp`, `IntuitionArmor`, `AddWeakShield` joined. `UNMODELLED_TYPES`
   unchanged at 13.
7. **The `web/` front end has still never spawned a real script** — untouched
   since session 120.

## Files changed
`git diff --stat 6e3fa22e..HEAD`, fixtures collapsed:

```
 fixtures/**                                  ~595 files (4 run captures + 2 cast captures)
 src/sim/boons.ts                              185 +   OBSERVED_OFFERS +35 rows
 tests/boons.test.ts                            50 +-  3 latent boons held; censuses +12/+2/+1
 tests/statusEffects.test.ts                    ~90 +- FIRST Vulnerable exception, enforced
 tests/fishing/deckShuffle.test.ts              ~30 +- crossed bound -> pin, both nulls re-derived
 tests/fishing/{castEra,oilReachability,matcherHeadroom,zoneTemplate,
                redrawCounterfactual,redrawShadowAnalysis,damageEconomy,
                movePath}.test.ts                     corpus pins, ~85 values
 tests/{enemies}.test.ts                         1 +   loadout census +1 ("59/21")
 tests/sim/fishingCorpus.test.ts                 1 +   +1 oil-cast docId
 handoff/{STATE,DECISIONS,log/session-126,scratch-session-126}.md
 handoff/reports/*.md                                  regenerated by the live scripts
```
