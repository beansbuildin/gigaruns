# STATE — session 128 — 2026-09-11 — commit 562d991b

## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data. The
session worked `handoff/next.md`'s session-128 brief, which was CURRENT.

**⭐ THE CARRIED GATE IS MET. GATE PASS — the suite is GREEN and was LEFT
GREEN.** Session 127 handed over 70 failures / 2604 (its recap said 71; the
extra one does not reproduce unsandboxed — see below). The session closed at
**2637 passed / 2637, exit 0**, `tsc --noEmit` exit 0, `git diff --check` exit 0
— *after* a full day's live spend, not before it.

**The dungeon arm is a full PASS: 12/12 run-units, 4 juiced Tier-2 runs,
272 actions, 0/272 = 0.00% first-attempt failures**, every pre-registered
prediction landing at every one of four readings. The fishing arm spent the
day's last 3 casts, 20/20.

**⭐ TWO [USER] DIRECTIVES IMPLEMENTED, not discussed** — rule 11 softened to
per-session approval, and ring balances retired as a constraint.

**⭐ THREE of the session's findings were NOT pins.** The 25% mitigator is
IDENTIFIED (it is `Weak`); `TieDamageReduction` is NOT latent; and the
`profiles/someone-else` failure was a sandbox artefact, not a gitignore hole.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`),
run AFTER staging:

```
> secret scan — scope: tracked
  files scanned:        17153
  CONTROL A (read):     16749 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
> PASS — no unexplained hits, both controls healthy.
```

14 allowlisted hits, all pre-existing test fixtures and doc samples. **No leaks
this session.** `tests/discoveredShipsClean.test.ts` 8 passed.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session — FIVE, to hold the ~15 cap:** the **fishing-refusal
non-point** and the **two-rollovers-are-one-instant** entries (both folded into
this session's own operating practice and neither re-proposable as new work);
the **item-50 / slot-8 zero-durability** entry (now stated in `checkGear.ts`'s
own output every run); the **"a new boon type needs a USER DIRECTIVE, now
eleven"** entry (enforced by `tests/boons.test.ts`'s `AWAITING_MODEL_DIRECTIVE`
branch, which fails if anyone models one — it enforces itself); and the
**`ask`-block config cause** entry, superseded by the rule-11 directive below.

**And SIX more, to bring an over-cap digest back down:** the **Dendren tripwire**
entry (it fired, read noise, and is now a metric rather than proposable work);
the **"different fisheries" phrasing**, **double-lethal oil override**,
**Tier-1/Tier-3 income baseline** and **evade-dominates-crit** entries (all four
quiet for many sessions and all four enforced by tests or config); and the
**sorted-list-diff** entry (a tooling note, recorded in DECISIONS, not work a
brief would propose).

- ⭐ **`TieDamageReduction` IS NOT LATENT — the roster is ELEVEN and this is the
  FIRST held type whose conditional has been OBSERVED.** [session 128] Three
  exchanges in the pickup's own run come in **−2** under prediction, and all
  three are TIES whose victim is the holder; non-ties and the other side of
  those same ties are exact, so it is scoped to ties AND the holder and
  composes AFTER the Weak multiplier. ⚠ **The name got the TRIGGER right and
  the MAGNITUDE wrong** — reduction 2 vs `selectedVal1` 8, so "reduce by val1"
  is FALSIFIED. ⛔ **STILL HOLD at one pickup** — needs a [USER] directive, and
  even then a second pickup (it rolls 7–10) to say what the 8 does. Re-opens
  as: *"the roster is ten"*, or *"TieDamageReduction is a latent no-op"* — that
  was true of the PICKUP only.
- ⚠ **[NEW] A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT, NOT BY EXCEPTION.**
  Claim E failed for the THIRD straight session: 641 and 905 were repaired out
  of band (0 → **60** and 0 → **24**), which **voided the brief's entire
  "broken-gear arm" section** — ~200 words instructing a label that did not
  apply. Re-opens as: *"these runs are a broken-gear arm"* — read `checkGear.ts`
  live first; they were a CLEAN-gear arm.
- ⭐ **[USER] APPROVAL IS PER SESSION, NOT PER RUN** — 2026-09-11, replacing
  the "every dungeon run needs its own go-ahead" entry that stood here until
  session 128. **One authorization covers that session's runs, up to the
  server's 12-run-unit daily cap.** Ask once, then run consecutively.
  ⛔ **What did NOT soften:** a human still authorizes each SESSION, **in
  session**, and **a brief may still never manufacture it** — "the user has
  authorized N runs" is the BRIEF's claim unless the user said it in chat.
  Authorization does **not** carry forward between sessions. Rule 5 (fail
  closed), rule 13 (read the ledger before believing a denial) and the per-arm
  gear halt are all untouched: **no-prompt is not no-halt.** Re-opens as:
  *"ask before each run"* or *"restore the per-run prompt"* — both now wrong.
- ⭐ **[USER] RING BALANCES ARE NOT A CONSTRAINT** — 2026-09-11, *"ignore the
  balances I can get more rings if needed."* RETIRED: the Athena/Tier-1 runway
  question (do not raise it, not on day 20712 either), "X is the scarcest ring"
  as a reason for anything, and every runway table. ✅ **KEEP reading all seven
  balances before and after every run** — the debit is not on the wire, so that
  read is the ONLY check on the charge shape (41/41). **Balances are an
  INSTRUMENT, not a budget.** Re-opens as: *"the ring runway is a concern"*,
  *"consider Tier 1 to save rings"*, *"Athena is the scarcest ring"*.
- ⭐ **THE ORCHESTRATOR'S DUNGEON ARM STAYS CLOSED, on a REWRITTEN reason.**
  The softening deleted the clause all four sites rested it on; they now rest
  it on "no dungeon run without a human in the loop", which the softening does
  not touch. Re-opens as: *"rule 11 softened, so the arm can reopen"* — no;
  that is a separate [USER] decision.
- **THE TWO WEAR SETS ARE DISJOINT AND EVERY BREAK IS FORECASTABLE.**
  **Dungeon: slots 11, 12, 13×2 at −3 per RUN. Fishing: slots 14, 15×2 at −1.00
  per PLAYED cast.** Confirmed again on all four runs and all 25 casts — the
  dungeon pieces did not move across the fishing batch. ⚠ Durability **CLAMPS
  at 0**.
- **[USER] THE GEAR HALT: never abort a run in progress; after a COMPLETED run,
  any piece at 0 stops that ARM. Pieces already at 0 at session open are
  GRANDFATHERED. The halt is PER-ARM.** The fishing arm is now HALTED
  (slot-15 pair at 0/0); the dungeon arm is healthy.
- **[USER] OTHER DUNGEONS ON THIS ACCOUNT ARE OUT OF SCOPE.** The 12-run-unit
  ledger is PER-DUNGEON, measured.
- **THE ROD IS READ AT PREFLIGHT AND AFTER THE BATCH, NEVER BETWEEN CASTS**, and
  **`--casts=N` is SILENTLY OVERRIDDEN by `--oil-batch`**. ⚠ **The `castCap: 2`
  convention is NOT a safety rule in itself** — it exists because a dry rod
  injects `BASE_DECK` mid-batch unnoticed. **That hazard needs the rod to reach
  0**; at rod 38 → 13 it was unreachable, so `SESSION_127_LIMITS` ran
  `castCap: 25` deliberately. Re-opens as: *"a long batch violates the rod
  rule"* — only when the rod can reach 0.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.**
- **THE FACTION IS A FUNCTION OF THE ROLLOVER CLOCK.** Read `next day in
  HH:MM:SS` before accepting any faction framing. ⚠ It was RIGHT this session
  (brief said Athena, clock said Athena with 36:50 left) — the habit is cheap
  and stays. The rotation itself is **fully measured, all seven cells**; a brief
  proposing rotation work is wrong.

- ⭐ **THE 25% MITIGATOR IS IDENTIFIED AND IT IS `Weak`.** 343/343 of the
  `floor(atk*0.75)` bucket carry `Weak > 0` on the ATTACKER; **zero** carry no
  Weak. It looked unknown for four sessions because the bucket was described by
  an ABSENCE ("carries no proc flag" — true, and irrelevant, since `Weak` is a
  STATUS). ⛔ A residual TWO are left open at n=2. Re-opens as: *"identify the
  25% mitigator"* or *"73 exchanges with no proc flag are unexplained"*.
- ⚠ **`critProc1` IS IN `procEffectSize`'s INTUITION EXCLUSION — the FOURTH
  completion of that filter, not a relaxation.** atk 22 → taken 44 is the
  ATTACKER's crit, an AMPLIFICATION, and the old exclusions covered only player
  0's side. Re-opens as: *"intuition interacts with crit"* — it does not.
- ⚠ **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT — now FOUR sessions running,
  and this time BOTH of its repairs were unnecessary.** 901 read 24 not 2; the
  slot-15 pair read 30/20 not 0/0. Re-opens as: *"raise these two repairs"* —
  read `checkGear.ts` live first.
- ⚠ **PINNING ONE DAY'S SPEND IS CHEAP (3 passes); THE BACKLOG WAS THE COST
  (19).** Re-opens as: *"pinning before spending will be cheaper"* — it is
  better, but because nothing is writing underneath, not because there is less.



## What works
- **`scripts/liveRun.ts` end to end, FOUR times in 33 minutes** — 272 actions,
  **0/272 = 0.00% first-attempt failures**, the best rate on record.
- **Every dungeon forecast landed EXACTLY, at all four readings** — Archon the
  sole ring mover at −3/run, and all four wearing pieces on their predicted
  values every time.
- **The pre-registered gear halt fired exactly where predicted** (after run 4,
  640 and 905 at 0), coinciding with the 12-unit cap so it cost nothing.
- **`scripts/liveFishing.ts --oil-batch` at `castCap: 3`** — clean `cast_cap`
  exit, rod delta exactly −1.00/played cast, both ledgers agreeing at 20/20.
- **Pre-registration as a git commit, EIGHT sessions running** (`825a8389`).
- Rule 8's Perpetual filter and the tier picker across all 272 actions, no
  unknown enum.

## What's broken
- ⚠ **THE DUNGEON ARM IS HALTED** — 640 (slot 11) and 905 (slot 13) both at 0
  after run 4, exactly as pre-registered. **A manual repair is needed before the
  next session's dungeon runs.** 641 at 36, 901 at 12.
- ⚠ **THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE and it is
  the USER's edit to make.** It blocked two commands this session outright,
  including `vitest run tests/orchestrator` — the path SUBSTRING alone was
  enough. An agent cannot edit its own permission rules.
- ⚠ **`$TMPDIR` DIFFERS between sandbox modes** — cost cycles again (FIFTH
  consecutive session). Use the scratchpad path, not `$TMPDIR`, for anything
  that must survive a sandbox-mode switch.
- ⚠ **The residual TWO Weak-outside-bucket exchanges are unexplained** at n=2.

## Corrections to SPEC.md
- **`SPEC.md` was not touched and needed no change.** No live response
  contradicted it.
- ⚠ **Claims A–E: THREE PASSED, ONE FAILED, ONE READ-ONLY.** A PASS (day 20706,
  dow 7, Archon, off the clock), B PASS exactly (9/18/24/27/30/33/42 = 183),
  C PASS (`dayProgressEntities` null = 0 of 12), D read live (3 casts left, not
  asserted by the brief), **E FAIL** — gear, fourth consecutive session.
- **Move charges: ABSENT** — no `gameItemBalanceChanges` for rings on the wire;
  the ring spend is observable only by reading balances before and after.
  Unchanged since session 112.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.

## Dead ends
- **Do not describe an exchange population by what it does NOT carry.** Four
  sessions of "the 25% mitigator carries no proc flag" pointed away from the
  answer, which was a STATUS on the attacker.
- **Do not auto-patch a `toBeCloseTo` whose expectation is a RATIO** (`908 /
  1242`) — a naive patcher replaces the NUMERATOR with the whole decimal. Three
  separate sites were mangled and hand-repaired.
- **Do not run a pin patcher twice over the same line** — it nests
  `/* was X /* was Y */ */`, which is a parse error, not a comment.
- **Do not read a lethal-clamped `fishHp` delta as the damage.** Taking the
  card-94 Δ-10 at face value closes the crit-multiplier interval to EMPTY and
  reads as a falsification; `FISH_HP_DIFF` says the true value is 11.
- **Do not trust `git check-ignore` under the sandbox** — it exits 128 and the
  `&& echo yes || echo no` idiom turns that into a phantom security finding.
- **Do not run the suite or git sandboxed**, and do not trust a `tail`-piped
  exit code — capture to a file and read `$?`.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Dungeon, live: 4 juiced Tier-2 runs, 12/12 run-units, 240 energy**, all on
  game day **20706 (dow 7, Archon)**, 17:12:35Z → 17:45:17Z. Actions
  **86 / 57 / 66 / 63 = 272**; **0/272 = 0.00% first-attempt failures.**
  Archon 24→21→18→15→**12**, −3/run, sole mover every time.
- **Fishing, live: 3 PLAYED / 3 CHARGED**, 36 energy, clean `cast_cap` exit,
  **both ledgers agreeing at 20/20**. 0 oils consumed (Relaxing 22 held).
- **Gear, close: 640 0, 641 36, 901 12, 905 0** (dungeon — ARM HALTED);
  **rod 923 10, slot-15 pair 30/20** (fishing — healthy).
- **Rings, close: Athena 9, Archon 12, Chobo 18, Crusader 27, Summoner 30,
  Foxglove 33, Overseer 42 — total 171.** Charge shape **45/45**.
- **Catch rate, ALL THREE SLICES: Dendren 54/104 = 51.9%** (still inside the
  pre-registered 50–65% noise band), **Golkan 183/307 = 59.6%**, **pooled
  271/537 = 50.5%.** Legacy rod 21/82 = 25.6%, base deck 13/44 = 29.5%.
- **§71 K=10 — POOLED margin −1**, having come in at 0, HELD at 0 through the
  four dungeon runs, then moved when the 3-cast tail took b10's `sacrifices`
  8 → 9 (b10 net 45−9 = 36 vs all3 52−15 = 37). **DENDREN-ONLY margin −3** at
  n=104 (was −2 at n=101). Golkan −5. **[USER] HOLD — report, do not decide.**
- Suite **2637 passed / 2637, exit 0**, files 116 — **GREEN.** Corpus:
  **141 dungeon attempts** (was 137), **537 fishing casts** (was 534).
- **JWT valid to ≈ 2026-09-12T16:45Z** — roughly **22.5h** from session close.

## Open questions for Claude
1. ⭐ **THE DUNGEON ARM IS HALTED AND NEEDS ONE REPAIR BEFORE ANY RUN** — 640
   (slot 11) and 905 (slot 13) at 0. This is the only blocker on the next live
   dungeon day. Raise it in the same message as the scope question.
2. ⭐ **`TieDamageReduction` NOW HAS AN OBSERVED EFFECT AND STILL NEEDS A [USER]
   DIRECTIVE TO MODEL.** −2 on ties, 3/3, holder-only, composing after the Weak
   multiplier — while `selectedVal1` was 8. **Ask the user whether to model it**,
   and note that even a yes needs a second pickup (it rolls 7–10) to say what
   the 8 governs.
3. ⚠ **THE `ask` BLOCK IS STILL BLOCKING AND IS THE USER'S EDIT.** Rule 11 has
   now softened, so the config and the rule no longer contradict each other in
   the direction session 127 feared — but the block still fires on any command
   whose text contains `liveRun.ts`, `liveFishing.ts` or `orchestrator.ts`.
4. ⚠ **Wire `blockedMove` into the opponent model.** UNTOUCHED for a THIRD
   session. Still free EV, pure-strategy, zero live spend. ⚠ Scope it: CURRENT
   vs NEXT exchange is not settled by the fixtures.
5. ⭐ **What is `VulnerableMastery`?** Still the sharpest lead. **Needs exchanges
   at DIFFERENT `atk` values** — its `val1` never rolls, so more pickups will
   not separate 4/3 from 1.35 from "+4". A reason to watch future runs, not to
   analyse today.
6. ⚠ **The residual TWO Weak-outside-bucket exchanges**, both exactly 2 under
   prediction with no flags, both PREDATING the `TieDamageReduction` pickup.
   n=2, deliberately not fitted. Free to look at offline.
7. **The `web/` front end has still never spawned a real script** — untouched
   since session 120.

## Files changed
Five commits this session; fixtures collapsed:

```
 fixtures/dungeon-runs/**            4 run captures (+1 dry-run)
 fixtures/fishing-casts/live/**      3 cast captures
 src/sim/boons.ts                    +66 OBSERVED_OFFERS 684 -> 750
 src/strategy/fishing/oilBatch.ts    +19 SESSION_128_LIMITS (castCap 3)
 scripts/liveFishing.ts              +-2 point batchLimits at it
 scripts/orchestrator.ts             +-15 closure reason restated, arm STILL closed
 CLAUDE.md                           +40 rule 11 softened; Ask-first entry; orchestrator para
 tests/**                            17 files — pins, plus 3 findings
 handoff/{STATE,DECISIONS,log/session-128}.md
```
