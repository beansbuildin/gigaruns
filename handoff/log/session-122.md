# session 122 — 2026-09-05 — day-20700 rotation SOLVED — GATE PASS

Full recap. `handoff/STATE.md` carries the same content in shorter form;
everything verbose lives here.

> **[session 123 pointer — the RECORD BELOW IS UNCHANGED, only its section
> number moved.]** The drift-ratio question this session filed as **QUESTIONS
> §67** is now **QUESTIONS §70**. `§67` was already taken by the session-113
> `Vengeance` entry, which is the incumbent and was NOT renumbered. Every
> "QUESTIONS §67" below refers to the drift ratio and should be read as §70;
> the prose is left exactly as written because a log is a record of what was
> believed when. §70 is also now **ANSWERED** — see it for the user's call.

## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data (§13). The
session worked `handoff/next.md`'s session-122 brief, which was CURRENT.

**The gate the brief set: the day-20700 rotation measurement. GATE PASS, and
this one is DECISIVE where day 20699's was not.** The prediction was committed
(`4d68bc84`) BEFORE `start_run`; the server charged **Crusader (135) 39→36**,
sole mover, exactly −3. **THE 7-PERMUTATION IS NOW DETERMINED.**

**Unusually, ALL FIVE of the brief's checkable claims (A–E) came back CORRECT** —
breaking a four-session run in which a stale caption was the defect.

**EVERYTHING SPENDABLE IS SPENT.** Dungeon **12/12** run-units (4 juiced Tier-2
runs). Fishing **20/20 charged, 23 played** — the server refused cast 24 for its
own cap and the guard tripped closed.

Suite **2424 passed / 2424, 116 files, exit 0**. `tsc --noEmit` clean,
`git diff --check` clean, `discoveredShipsClean` 8/8.

⚠ **Re-run the suite UNSANDBOXED** — sandbox breaks `tsx` (EPERM on its IPC
pipe, reproduced again this session on the very first command) and `git`.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        12329
  CONTROL A (read):     11931 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS — no unexplained hits, both controls healthy.
```

⚠ **It caught TWO real leaks introduced THIS session, both mine, both in
`handoff/scratch-session-122.md`:** the bare wallet address (the only
unexplained hit in 12,329 files) and the real username. Both redacted; the
address is disclosed in that file. **Not rotated** — a public on-chain address
is not a credential, and the JWT was never printed. **Fixed forward rather than
by amending `4d68bc84`**, whose entire value is being a tamper-evident timestamp
predating `start_run`. Rewriting history is the user's call.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session:** the **`dayOfWeek` 1-indexing** entry and the **rod
decrement RATE** entry — both are now folded into the rotation entry and a
green test respectively, and self-enforce. Also dropped **`data.nextPosition`**
(quiet for many sessions).

- ⭐ **[NEW] THE ROTATION IS SOLVED — six slots MEASURED, the seventh FORCED.**
  dow1 Crusader(135), dow2 Overseer(136) **forced, NOT measured**, dow3
  Foxglove(139), dow4 Summoner(140), dow5 Chobo(134), dow6 Athena(137), dow7
  Archon(138). DECISIONS 2026-09-05. Re-opens as: *"measure the rotation"* or
  *"the rotation order is unconfirmed"*. **A dow-2 run is still worth doing** —
  see open question 1 — but as CONFIRMATION, not discovery.
- ⭐ **[NEW] The rod decrements per PLAYED cast, not per CHARGED cast.
  MEASURED.** Rod 28→5 over 23 played / 20 charged; per-charged predicts 8.
  Re-opens as: *"does the rod decrement on uncharged casts?"*.
- ⭐ **[NEW] GEAR HAS DURABILITY AND A WORN PIECE CHANGES THE LOADOUT
  MID-SESSION.** Item 640 hit 0 during run 3; run 4 opened hpMax 45, Sword ATK
  26→16, Shield ATK 11→6. Re-opens as: *"gear only changes between sessions"* —
  that premise is FALSIFIED.
- ⭐ **[NEW] [USER] `PLAYER.hpMax` HOLDS AT 50**; the degraded run is excluded by
  name in `tests/enemies.test.ts`. The user repaired the head mid-session
  (slot 11 now 70). Re-opens as: *"re-pin PLAYER to the newest opening (45)"*.
- ⭐ **[NEW] [USER] The `LIVE.drift` re-derive THRESHOLD is RATIFIED and STATE's
  old open question 4 is CLOSED.** Re-derive if `|drift| ≥ 1.0` **OR** five
  consecutive same-direction moves. It FIRED this session (fifth move). Re-opens
  as: *"does the drift walk justify a re-derive?"* or *"still short of −1, so
  pin"* — the latter phrasing is now wrong on its own.
- ⭐ **[NEW] The bare/LIVE drift ratio CROSSED its bar (4.83 < 5) and the bar was
  NOT moved.** Session 102 pre-registered that a further fall means re-examining
  the conclusion. Escalated as QUESTIONS §67. Re-opens as: *"lower the ratio bar
  to 4.5"* — explicitly forbidden.
- **The ARITHMETIC rotation map stays FALSIFIED.** `faction = dayOfWeek + 2`
  died at day 20698. Re-opens as: *"faction = dayOfWeek + 2"*.
- **The charged faction does NOT change mid-day.** Now **sixteen** same-day
  charges across four days. Re-opens as: *"does the faction rotate within a
  day?"*.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.** Re-opens as:
  *"the fishing budget is 300/25"*.
- **[USER] The double-lethal oil override is DISABLED; Focus Oil off the
  allowlist.** Re-opens as: *"turn the double-lethal band back on"*.
- **[USER] The Tier-1/Tier-3 whole-run income baseline is RETIRED BY NAME.**
  Re-opens as: *"one cross-tier run gives the first clean read"*.
- **A new boon type from n=1 needs a USER DIRECTIVE.** Now **six** held:
  `CritHeal`, `Intimidating`, `BurningTenacity`, `RegenMastery`,
  `VulnerableMastery`, NEW `WeakeningBlock`. Re-opens as: *"model the remaining
  latent boons"*.
- **Evade DOMINATES crit; `critProc`'s exclusion list was the defect.** Re-opens
  as: *"critProc's 2×ATK rule has exceptions"*.
- **TASKS §13's SWAP is parked on DATA, not code.** Re-opens as: *"wire in the
  reachability/coverage scoring"*.
- **[USER] Unspent skill XP.** CLOSED, §61.1 forbids re-raising it.
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **Pre-registration as a git commit, twice now, and it is what made this a
  test.** `4d68bc84` predates `start_run`. Repeat this.
- **`scripts/liveRun.ts` end to end, four times.** **0/278 first-attempt action
  failures** across the day (55 + 79 + 87 + 57).
- **`scripts/liveFishing.ts`, 23 casts**, halting cleanly on the server's own
  cap rejection rather than pushing past it.
- **Chasing a census signal instead of re-pinning it** — six new loadout combos
  looked like drift; five were, and the sixth was a real gear-durability
  finding that a re-pin would have buried.
- **`scripts/liveRun.ts` now has a gear-durability preflight** (reports, never
  blocks), exercised on a dry-run.
- **Rule 13 discipline held**: every live command read back off the server
  ledger.

## What's broken
- ⚠ **`PLAYER` was STALE for a whole session and the staleness was MASKED.**
  `rock.def` 9→10 and `paper.def` 16→17 landed between sessions; the assertion
  that pins them sits AFTER an `hpMax` assertion that failed first, so it never
  ran. **An assertion ordered after a failing one is not a passing assertion.**
- ⚠ **The bare/LIVE drift ratio crossed its pre-registered bar: 4.83 < 5.** The
  conclusion it underwrote ("different fisheries") is now in doubt. QUESTIONS §67.
- ⚠ **`LIVE.drift` is on a FIVE-step monotone walk** (−0.6417 → −0.6593 →
  −0.6850 → −0.6882 → **−0.7230**). Re-derived per the ratified threshold.
- ⚠ **Two prose leaks (address, username) reached a commit before the scan caught
  them.** The scan works; my prose discipline did not.
- ⚠ **A `Dungeon#3` DayCount at 9 exists and this bot did not create it.**
  Harmless — the ledger is PER-DUNGEON (measured) — but something else is
  playing dungeon 3 on this account.
- ⚠ **Multi-session HOLDS that ENDED and must not be re-quoted as stable:** b6's
  `rescues − sacrifices` 12→14 (its line literally read "UNMOVED"), b10 31, the
  `all3` numerator 25→29, `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` "2.3"→"2.5".
- ⚠ **The rod did NOT reach 0** (5 left), so the user's fish-to-zero-and-halt
  directive was not exercised. **5 casts will exhaust it next session.**
- ⚠ **`Intimidating` still cannot separate "heals its amount" from "heals a flat
  2"** — all observations remain at amount 2.

## Corrections to SPEC.md
- **`SPEC.md` was not touched and needed no change.** No live response
  contradicted it; gear durability and `dayOfWeek` are not fields SPEC documents.
- ⭐ **The brief was RIGHT on all five checkable claims (A–E)** — day 20700 /
  dow 1, balances at 246, run-units 0/12, fishing 0/20, rod 28. First session in
  five with no wrong printed caption. `scripts/checkEntryTiers.ts`'s caption was
  rewritten anyway, because SOLVING the rotation made its "NEXT TEST" text stale.
- **`tests/enemies.test.ts`'s premise "gear only changes BETWEEN sessions" was
  wrong** and is corrected in place with the measurement beside it.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged.

## Dead ends
- **Do not re-fit an arithmetic rotation rule to the six points.** The
  permutation is measured; `dow1→f1, dow2→f2` LOOKS like an identity map and
  `dow3→f5` breaks it.
- **Do not quote the dow-2 cell as measured.** It is forced under hypothesis (a).
- **Do not lower the bare/LIVE ratio bar.** Session 102 forbade a third move.
- **Do not re-hunt the advance faction-indicator field.** CLAUDE.md rule 11.
- **Do not look for the ring debit on the wire.** Read balances before/after.
- **Do not narrow the gear preflight to a dungeon-slot allowlist** — exactly one
  slot mapping is confirmed (11), and slots 8/14/15 are fishing gear.
- **Do not run the suite sandboxed** — `tsx` and `git` both fail.
- **Do not trust a `tail`-piped or task-notification exit code.** Capture to a
  file and read `$?`.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Dungeon, live: 4 juiced Tier-2 runs, 12/12 run-units, 240 energy.** Deaths
  rooms **9 / 11 / 10 / 7**. Rings: 12 Crusader (39→27, −3/run). **0/278
  first-attempt action failures.** ⚠ Run 4 — the BROKEN-GEAR run — was the
  shallowest at room 7. Suggestive, **n=1, and not attributable**; it is also
  the run that lost 5 max HP and 10 Sword ATK, so do not read it as variance
  either. Runs 1–3 and run 4 are NOT the same arm.
- **Fishing, live: 23 played / 20 charged. CATCH RATE 14/23 = 60.9%**, counted
  off the batch log's `cast_over` events (14 caught, 9 escaped). Rod **28→5,
  exactly 1.00 per PLAYED cast.** 3 Relaxing Oil (937) spends; Focus triggers
  policy-withdrawn.
- Suite **2424 passed / 2424**, files 116 (was 2391/116).
- Corpus: **117 dungeon attempts** (was 113), **433 fishing casts** (was 410).
- Silver rings **234** (was 246). Archon still scarcest at 18; Athena 21.
- **~113 corpus pins re-derived with provenance across 14 test files.** Every set
  change verified purely ADDITIVE by MULTISET diff both ways (33 `OBSERVED_OFFERS`
  rows, **0 removals**).

## Open questions for Claude
1. **A dow-2 day CONFIRMS the forced cell — it does not discover it.** Day 20701
   is dow 2 and was live at recap time. Under the solved map it must charge
   **Overseer (136)**. Worth one pre-registered run, but frame it as
   confirmation; the brief must not present the rotation as unsolved.
2. ⚠ **QUESTIONS §67 needs a USER decision: does "different fisheries" survive at
   4.83x?** The bar was crossed and NOT moved, per session 102's own
   pre-registration. Nothing in flight depends on it (§0a is suspended).
3. **The rod has 5 durability.** Five casts exhaust it, and the user's standing
   directive is to fish to zero, HALT, and wait for a manual repair. Next
   session hits that halt almost immediately — say so in the brief.
4. **The catch-rate question is ANSWERED and resolves BENIGNLY — retire it.**
   **14/23 = 60.9%**, back INSIDE the user's 60–70% framing after two readings
   at or below its floor (65.2% → 55% → 60.9%). Pooled over the last three
   batches: **40/66 = 60.6%**, also inside. The session-121 worry that 55% was
   "the second consecutive reading at the floor" does not survive a third
   sample. **Do not raise this with the user as a concern again** unless a
   batch lands below ~55% with n ≥ 25.

   ⚠ **Caveat on the instrument, so the number is not over-trusted:** this was
   counted from the LOG's `cast_over` events, not from the committed corpus.
   `loadFishingCorpus`'s records carry `caughtFish` as `null` on the states
   inspected, so the obvious corpus-side computation returns 0/433 and is
   WRONG. Anyone recomputing this needs the right field first — that mismatch
   is worth a few minutes and was not chased here.
5. **`WeakeningBlock` joins the latent set, making six.** Default HOLD. Its name
   suggests an on-block effect, so measuring it needs post-pickup exchanges
   where a block lands — not a guess from `selectedVal1: 4`.
6. **Something else is playing dungeon 3 on this account** (`Dungeon#3` DayCount
   at 9, updated mid-session). Worth one question to the user; it is not this
   bot, and the run-unit ledger is per-dungeon so nothing was consumed.
7. **The `web/` front end has still never spawned a real script** — untouched
   since session 120.

## Files changed
```
 scripts/checkEntryTiers.ts     |  rotation caption -> SOLVED, 7-permutation
 scripts/liveRun.ts             |  +49  gear-durability preflight
 scripts/liveFishing.ts         |  in-sample 2.3 -> 2.5
 src/sim/boons.ts               |  +33 OBSERVED_OFFERS rows
 src/sim/enemies.ts             |  PLAYER rock.def 9->10, paper.def 16->17
 src/sim/scenarios.ts           |  mutual-lethal hp 3 -> 2
 tests/ (14 files)              |  ~113 corpus pins + WeakeningBlock + drift
 QUESTIONS.md                   |  +§67 the crossed ratio bar
 handoff/DECISIONS.md           |  entries appended
 handoff/scratch-session-122.md |  new — the pre-registration + result
 handoff/log/session-122.md     |  new
 fixtures/                      |  4 runs + 2 dry-runs, 24 fishing casts
 729 files changed, 483855 insertions(+), 211 deletions(-)
```

---

## Verbose appendix

### A. The pre-registration, and why it counted

Committed as `4d68bc84` at ~16:58Z. First `start_run` POSTed at 17:01Z. The
prediction named a **2-of-7** set — Crusader (135) 39→36 **or** Overseer (136)
51→48 — and explicitly declined to predict which, because either branch forces
the other faction into dow 2 and therefore solves the permutation.

Falsifiers were stated separately for two claims, which matters because they can
die independently (session 118 is the precedent):

1. **ORDER** dies if the mover is any faction already claimed by dow 3–7.
2. **CHARGE SHAPE** (then 17/17) dies if more than one faction moves, or if the
   amount is not exactly 3.

Result: Crusader, sole mover, −3, read twice and stable. Order PASSES, shape
survives and is now **21/21** after the day's four runs.

### B. The four ring reads, in order

```
before  f4 138 Archon 18 | f3 137 Athena 21 | f7 134 Chobo    30
        f1 135 Crusader 39 | f6 140 Summoner 42 | f5 139 Foxglove 45
        f2 136 Overseer 51                                total 246
run 1   Crusader 39 -> 36   (six others byte-identical)
run 2   Crusader 36 -> 33   (six others byte-identical)
run 3   Crusader 33 -> 30   (six others byte-identical)
run 4   Crusader 30 -> 27   (six others byte-identical)   total 234
```

### C. The `Dungeon#3` question, resolved by measurement not assumption

Flagged in the pre-registration commit as UNRESOLVED, with an explicit note not
to assume the convenient reading. `checkDungeonToday.ts` showed dungeon 5 at
`null` but a sibling `DayCount#…#Dungeon#3` at `UINT256_CID: 9`, updated 23
minutes before the session's first read, by something that is not this bot.

Two readings differed by three runs: per-dungeon (4 juiced runs available) or
shared (9 of 12 gone, so 1). After run 1, `Dungeon#5` read **3** while
`Dungeon#3` stayed at **9** — **the counters are independent**. The convenient
reading was right, which is not the same as it having been safe to assume.

### D. The gear-durability finding, in full

Six new `hpMax/armorMax` census combos. Five are ordinary mid-run growth:

```
run 2  state-042  50/27 -> 50/35  AddMaxArmor(+8)
run 2  state-136  50/35 -> 58/35  AddMaxHealth(+8)
run 2  state-140  58/35 -> 58/32  corrode shred
run 2  state-142  58/32 -> 58/29  corrode shred
run 2  state-160  58/29 -> 58/35  room boundary restore
```

The sixth is not growth — it is a NEW OPENING:

```
run 1  50/50 arm 17/17   rock 26/10  paper 11/17  scissor 12/8
run 2  50/50 arm 17/17   rock 26/10  paper 11/17  scissor 12/8
run 3  50/50 arm 17/17   rock 26/10  paper 11/17  scissor 12/8
run 4  45/45 arm 17/17   rock 16/10  paper  6/17  scissor 12/8   <-- broken gear
```

`pickedBoons: []` on all four. `startingATK`/`startingDEF` identical on all four
(rock 16/0, paper 6/12, scissor 12/8) — it is the CURRENT values, which carry
the gear bonus, that collapsed toward the class base.

`GET /gear/instances/{address}` at the time:

```
slot  2  dur 22  item 109      slot  3  dur 44  item 110
slot  6  dur 19  item 204      slot  6  dur 30  item 208
slot  8  dur  0  item 50   <- "Stone Rod", a FISHING item, superseded
slot 11  dur  0  item 640  <- "Golkan Eradicator Head", Epic, Forbidden Woods
slot 12  dur 48  item 641  <- its BODY counterpart, healthy
slot 13  dur  6  item 905      slot 13  dur 14  item 901
slot 14  dur 28  item 812  <- the fishing rod, Claim E confirmed
slot 15  dur  4  item 954      slot 15  dur 10  item 954
```

So the head wore to 0 during run 3 and run 4 opened without **+10 Sword ATK,
+5 Shield ATK and +5 max HP**. The attribution is inferred from the delta and
from 640 being the one equipped dungeon piece at 0 — the static catalog gives
the item's name and rarity but **no stat block**, so it is not directly
confirmed.

**After the user repaired it mid-session, slot 11 read `dur 70`.**

### E. `PLAYER` was stale, and the staleness was MASKED

Separate from the breakage, and older than it:

```
run-2026-08-31-03-26-52  rock 26/9   paper 11/16
run-2026-09-05-17-01-10  rock 26/10  paper 11/17   <-- moved, BETWEEN sessions
```

`tests/enemies.test.ts` pins these against the newest unbooned capture and would
have caught it on the first run of the day. It did not, because the `hpMax`
assertion sits ABOVE the move loop in the same `it` block and failed first on
run 4's 45. The move mismatch only printed once run 4 was excluded for an
unrelated reason.

**This recurred within the same session.** `tests/fishing/damageEconomy.test.ts`
line 440's ratio assertion failed and aborted its block, so the `LIVE.drift` pin
on line 463 never ran and appeared green while being 0.035 wrong.

### F. Knock-on scenario repairs from the `PLAYER` DEF change

Both are the same mechanism session 42 already recorded, one notch further:

- `src/sim/scenarios.ts` `mutual-one-hit-from-death`: `me.hp` 3 → **2**. Sword
  DEF 9→10 means a rock/rock tie regens 10 against the enemy's 12 ATK, so
  overflow is 2 and hp 3 SURVIVED — the scenario had stopped being mutually
  lethal. Cannot go below 1; if Sword DEF ever reaches 12 this construction
  needs a different enemy.
- `tests/strategy.test.ts`: `hp` 5 → **4**. At hp 5 the margin had decayed to
  **0.1** (rock −666.6 vs paper −666.7) — the test was passing on a coin flip.
  hp 4 restores session 42's own stated figures exactly (−722.2 vs −666.7).

### G. `LIVE.drift` — the fifth move and the crossed bar

```
-0.6417 -> -0.6593 -> -0.6850 -> -0.6882 -> -0.7230
```

Five moves, all the same direction. `|drift|` 0.723, so the MAGNITUDE arm did
not fire; the DIRECTION arm did. Re-derived.

Separately, `bare.economy.drift / LIVE.drift` fell **17x -> 9.97x -> 8.48x ->
4.83x**, through its bar of 5. Session 102 pre-registered the response in its
own words: *"if the ratio keeps falling, the answer is to re-examine the
conclusion, NOT to move the bar a third time."* So the bar was **not moved**;
the assertion became a pin at 4.830349605884868 and the conclusion went to
QUESTIONS §67. `bare` has not moved at all — the ratio fell because LIVE's own
drift grew.

### H. The rod discriminator, preserved by accident

The brief pre-registered it and I planned to protect it by waiting for the
18:00Z rollover so all casts fell in one game day. The user redirected to fish
immediately, to use day 20700's otherwise-wasted cap. That looked like it would
cost the measurement — and it did not, because the **server's own 20-cast cap**
stopped charging at 20 while play continued to 23:

```
rod 28 -> 5   over 23 PLAYED / 20 CHARGED
per PLAYED   predicts 28 - 23 = 5   OBSERVED
per CHARGED  predicts 28 - 20 = 8
```

Cast 24 was refused: `HTTP 400 — "Player has reached max runs for fishing"`, and
the guard tripped closed (rule 5).

### I. Corpus re-derivation

~113 pins across 14 test files, all with `[session 122] was X` provenance.

- `OBSERVED_OFFERS` 507 → 540: **ADDED 33, REMOVED 0**, multiset-checked both ways.
- Loadout census +6, docId sets +3 (`13267011/22/32`) and +3 oil casts.
- The `BurnMastery` pair set looked like it SHRANK 4 → 2. It did not: that
  assertion ran on `maxRunDirs: 30`, a SLIDING WINDOW, and today's runs pushed
  the older pairs out. Switched to `exAll` — n 12 → 64, full set
  `{6/3: 18, 4/2: 38, 8/4: 4, 10/5: 4}` unchanged, `mastery.ok` 0 on both. The
  tell was that the doc comment's own counts were full-corpus figures.
- ⚠ **One automated pass introduced a bug and it was caught by re-running**: it
  rewrote a histogram KEY (`[2, 22]` → `[3, 24]`) instead of only the count.
  Corrected to `[[0,149],[1,101],[2,24],[3,3]]`. Bulk pin edits need a verifying
  re-run, not just a green-looking diff.
