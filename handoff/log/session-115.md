# SESSION 115 — 2026-09-01 — verify the offline chooseNewCard fix; day had not rolled

Duplicate of STATE.md at handoff time, plus the verbose material below it.

# STATE — session 115 — 2026-09-01 — commit <SHA>

## Status
Brief was: **Step 0**, verify the OFFLINE `chooseNewCard` currency fix against
the real repo (it had only ever run in an isolated sandbox); **Step 1**, read
the live day and stop if it had not rolled.

- **Step 0: GATE PASS.** The real suite agrees with the offline sandbox in
  every respect. No discrepancy. Suite **2297 → 2298** (the offline commit
  added exactly one test), the two affected files **45/45** — the exact count
  the sandbox claimed. Independently re-derived the substantive claim against
  the real 80-card catalog rather than trusting the test the same offline
  session wrote.
- **Step 1: the day had NOT rolled. Stop-condition fired as written.**
  `currentDay` **20696**, `dayOfWeek` 4 — unchanged from session 114's close.
  Next day was 01:19:25 out at read time. Dungeon 5 at **12/12** run-units.
- **Steps 2-4 NOT ENTERED. LIVE SPEND THIS SESSION: ZERO.** No runs, no casts,
  no rings, no energy. The user chose to close rather than hold ~75 minutes for
  the reset, so day 20697's third rotation point passes to the next session
  with a full 12/12 cap.

Suite **2298 passed / 2298, 115 files**. `tsc --noEmit` clean, `git diff
--check` clean, `.gitignore` verified on all seven required paths,
`tests/discoveredShipsClean.test.ts` 8/8.

⚠ **Re-run the suite UNSANDBOXED** — sandbox breaks `tsx` (EPERM on its IPC
socket) and `git` (`.gitconfig`). Use `--maxWorkers=4`.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        10524
  CONTROL A (read):     10161 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS — no unexplained hits, both controls healthy.
```

At `--scope=diff --ref=5d526ef7`: **6 files, 0 unexplained**, control A 2.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session:** "TODAY'S FACTION IS NOT KNOWABLE IN ADVANCE" — it is
written verbatim into **CLAUDE.md rule 11** ("Do not re-hunt for this field"),
which is the stated drop criterion. ⚠ **Session 114 announced this same drop and
then did not execute it** — the entry stayed in its digest. Executed now.

- ✅ **[NEW] `chooseNewCard`'s currency flaw is FIXED and VERIFIED on the real
  suite.** Commit `c3cc71aa` (offline) + this session's verification.
  DECISIONS 2026-09-01. Re-opens as: *"fix `chooseNewCard`'s currency flaw"* or
  *"the offline `chooseNewCard` fix still needs real-suite verification"* —
  both are done. **The §13 SWAP is a different thing and IS still parked.**
- **[USER] Tier 2 costs 3 rings of ONE faction per juiced run, rotating daily.**
  8 for 8 across two faction days. DECISIONS 2026-08-30/31. Re-opens as:
  *"Tier 2 costs one of each of the seven silver rings"* or *"the charged
  faction is fixed"*.
- ⚠ **The rotation ORDER is n=2 and NOT solved.** 20695→Foxglove(139),
  20696→Summoner(140) — **ADJACENT days**, so many orders still fit. Re-opens
  as: *"the day→faction map is solved"*. **Day 20697 predicts Chobo (134); a
  NON-adjacent point is worth more than another adjacent one.**
- **[USER] The double-lethal oil override is DISABLED; Focus Oil off the
  allowlist.** Re-opens as: *"turn the double-lethal band back on"*.
- **[USER] Oil target framing: 60-70% catch rate, oils not wasted.** ⚠ Re-opens
  as: *"the disable cost us catch rate"* — **63.6 / 60.0 / 58.3% across three
  batches are NOT distinguishable**.
- **A new boon type from n=1 needs a USER DIRECTIVE.** Precedent used four
  times. `CritHeal` (§66), `Intimidating` (§68), `BurningTenacity` (§69) are all
  held. Re-opens as: *"model the remaining latent boons"*.
- **TASKS §13's SWAP is parked on DATA, not code.** `positionalReachability` /
  `meanZoneCoverage` built, NOT wired; a test fails if anyone wires them.
  Re-opens as: *"wire in the reachability/coverage scoring"*.
- **[USER] Chaining is a ONE-TIME, DATED exception.** Rule 11 pins `--runs=1`.
- **`triggeredBoons`.** CLOSED — 0 non-empty of 10,616. No runs may be spent.
- **`tenacity` / `intuition` as damage mitigation RULED OUT.** §58, §62, §63.
- **[USER] Unspent skill XP.** CLOSED, §61.1 forbids re-raising it.
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **The offline `chooseNewCard` fix, verified for real.** Suite 2298/2298 (115
  files) against 114's 2297/115 — one test added, nothing broken. The two
  affected files 45/45, matching the sandbox's claim exactly. `tsc` clean,
  `git diff --check` clean on both the working tree and the commit.
- **Independent re-derivation of the fix's headline claim**, not trusting the
  same session's own test. Loaded `fixtures/fishing-casts/cards.json` (80
  cards) and called `chooseNewCard` on the recorded session-92 offer:
  `35 → 5×3=15`, `30 → 6×5=30`, `31 → 6×5=30`, **picks 30**. Matches
  DECISIONS 2026-09-01. The session-92 bad choice is corrected.
- ⭐ **The fix also flips card 35 against ITSELF** — weighted, its own hit (15)
  beats its own crit (8), which the raw formula had backwards. Not previously
  recorded anywhere; the flaw was one notch wider than the write-up said.
- **Ring balances show NO out-of-band drift since 114 closed.** Live: Archon 30,
  Athena 33, Chobo 39, Crusader 39, Summoner 42, Foxglove 45, Overseer 48 —
  **total 276**, matching 114's closing 288→276 faction-for-faction. (114 itself
  saw +6 of drift over its gap; this gap saw none. Drift is real but not
  constant — keep reading, don't start assuming either way.)
- **The day reading, corroborated from a SECOND document.** `checkEntryTiers`
  said day 20696; `dayProgressEntities` independently carried a Dungeon#3 row
  stamped `TIMESTAMP_CID: 20696`, written well after 114 closed.

## What's broken
- ⚠ **The rotation ORDER is a 2-point fit on ADJACENT days.** Not a map.
- ⚠ **`Intimidating` cannot separate "heals its amount" from "heals a flat 2"**
  — all 12 observations are at amount 2. Its TRIGGER is also unseparated.
- ⚠ **`BurnMastery` floor-vs-round** still needs an ODD plain amount. No runs
  were spent this session, so no new pairs — named for the third session.
- ⚠ **`LIVE.drift` has moved monotonically more negative across seven pins.**
  Band widened to the order of magnitude. **If the sign flips or it reaches -1,
  re-derive — do not widen again.**
- ⚠ **`redrawCounterfactual`'s K=6 arm is no longer frozen**; only
  `sacrifices: 0` is durable. K=10 still carries the thesis.
- ⚠ **A cosmetic label nit in `liveFishing.ts`**, deliberately NOT fixed: the
  rod-durability line pairs a play-driven delta with a charge-driven count.
- **The JWT expires and blocks the whole session.** Valid to 2026-09-04T18:48Z
  — **three days out. The next session is likely the last one before it dies.**

## Corrections to SPEC.md
- **`SPEC.md` was not touched, and neither was CLAUDE.md.** No live captures
  were made, so nothing could contradict the spec. Second session running that
  rule 11 needed no revision.
- **A stale evidence count in the instrument itself, FIXED.**
  `scripts/checkEntryTiers.ts:235` printed *"the rotation ORDER — which is
  UNCONFIRMED (one day observed)"*. True when written; false the moment session
  114 measured day 20696. The measurement landed, the printed warning didn't —
  so the script was **understating its own evidence to the next session that
  reads it**. Replaced with the real state: two days on record, adjacent, a
  non-adjacent third point worth more than another consecutive one. No test
  pinned the string; `tests/entryTierRunway.test.ts` 13/13 still green.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured (no live runs).

## Dead ends
- **Do not treat the day→faction formula as solved.** Two adjacent points.
- **Do not re-hunt the advance faction-indicator field.** Search complete,
  CLAUDE.md rule 11.
- **Do not look for the ring debit on the wire.** Read balances before/after.
- **Do not trust a "dropped this session" note without checking the digest
  below it.** Session 114's did not match its own list.
- **Do not run the suite sandboxed** — `tsx` and `git` both fail under it.
  `$TMPDIR` also differs by sandbox mode, so a scratch script written to
  `$TMPDIR` cannot resolve repo-relative imports; write it inside the repo.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Live: ZERO.** No dungeon runs, no fishing casts, no rings, no energy spent.
  Day 20696, 12/12 run-units already gone from session 114.
- Suite **2297 → 2298 (+1, from the offline commit)**, files 115. Affected
  files 45/45. `entryTierRunway` 13/13, `discoveredShipsClean` 8/8.
- Secret scan: **10,524 files (tracked), 0 unexplained, 14 allowlisted**;
  6 files (diff scope vs `5d526ef7`), 0 unexplained.
- Silver rings 276, unchanged. Corpus unchanged: 101 dungeon attempts, 339
  fishing casts.

## Open questions for Claude
1. **The rotation map needs a THIRD point, ideally NON-adjacent.** Day 20697
   predicts **Chobo (134)** — free on any authorized run. Because this session
   spent nothing, the next session starts with a **full 12/12 cap**, so it can
   take the third point AND have three runs left over.
2. ⚠ **The JWT expires 2026-09-04T18:48Z.** Three days. A brief that assumes
   live access beyond that will fail at the first call; consider making "refresh
   the JWT" the explicit first step of the next brief.
3. **`Intimidating` (§68): model it as a per-exchange heal, or hold?** Evidence
   12/12, but a single observation at a different amount separates the two
   readings. Default: hold. Unchanged — no new data.
4. **`BurningTenacity` (§69) and `CritHeal` (§66) both await directives.**
5. **Is the Tier-1/Tier-3 arm a baseline for anything downstream?** ELEVENTH
   session. Still cheap and well-defined: a five-run same-arm Tier-2 anchor
   exists, so one Tier-1 or Tier-3 run on THIS loadout gives the first clean
   cross-tier read.
6. **`BurnMastery` floor-vs-round** still needs an ODD plain amount.
7. **Was `chooseNewCard` worth fixing blind?** It is fixed and verified, but the
   validation floor is still **2 live card choices project-wide**. The fix is
   defensible on argument, not on data — the same footing §13's swap is parked
   for. Worth deciding whether that asymmetry is intended.

## Files changed
```
 handoff/STATE.md                | rewritten
 handoff/DECISIONS.md            |   2 +
 handoff/scratch-session-115.md  | 100 +   (new)
 handoff/log/session-115.md      | new
 scripts/checkEntryTiers.ts      |   6 +-  (stale n=1 warning -> n=2, adjacent)
```
(Plus the pre-existing offline commit `c3cc71aa`, verified but not re-touched:
`src/strategy/fishing/cardChoice.ts`, its 2 test files, TASKS.md, DECISIONS.md.)

---

## Verbose appendix

# scratch — session 115 — 2026-09-01

## Step 0 — verify the offline `chooseNewCard` fix against the REAL repo: PASS

Commit under test: `c3cc71aa` ("session 115 (offline) — chooseNewCard currency
fix"). Working tree was CLEAN at session start — the offline commit was already
in `main`, nothing uncommitted.

- Full suite, UNSANDBOXED, `--maxWorkers=4`: **2298 passed / 2298, 115 files.**
  Session 114 closed at 2297/115, so the offline commit added exactly one test
  and broke nothing. No dependency the isolated sandbox couldn't see turned up.
- The two affected files alone: **45 / 45** — EXACTLY the count the offline
  sandbox claimed. The sandbox check was accurate, not lucky.
- `tsc --noEmit`: clean. `git diff --check`: clean (working tree AND the
  session commit).
- Secret scan `--scope=tracked`: 10,524 files, 0 unexplained, 14 allowlisted.
  `--scope=diff --ref=5d526ef7`: 6 files, 0 unexplained.

**Independent re-derivation, NOT trusting the test the same offline session
wrote.** Loaded the real 80-card catalog (`fixtures/fishing-casts/cards.json`)
and called `chooseNewCard` directly on the session-92 offer:

```
card 35: hitAmt=5 x 3 zones = 15 | critAmt=8 x 1 =  8 | mana=1 -> 15
card 30: hitAmt=6 x 5 zones = 30 | critAmt=0 x 0 =  0 | mana=1 -> 30
card 31: hitAmt=6 x 5 zones = 30 | critAmt=0 x 0 =  0 | mana=1 -> 30
PICKED: 30
```

Matches DECISIONS.md 2026-09-01 exactly. The recorded session-92 bad choice is
corrected: 35's 8-damage one-zone crit no longer outranks a 6 across five zones.
Note the fix ALSO flips card 35 against ITSELF — weighted, its own hit (15)
beats its own crit (8), which the raw formula had backwards.

**Verdict: the real suite agrees with the offline sandbox in every respect.**
No discrepancy to report. Step 0's stop-condition did not fire.

## Step 1 — the day has NOT rolled. Nothing live to spend.

`scripts/checkEntryTiers.ts` / `checkDungeonToday.ts`, read ~09:39 Pacific:

- **`currentDay` 20696, `dayOfWeek` 4 — UNCHANGED from session 114's close.**
- **next day in 01:19:25** (reset ~10:59 Pacific).
- Dungeon 5 `dayProgressEntities`: **12 of 12 spent.** Cap has not reset.

Per the brief's own Step 1 stop-condition, the session ends here for live work.
**Live spend this session: ZERO.** Steps 2-4 not entered.

Day 20697 still predicts **Chobo (134)** under the two-point candidate. It is
still available, to the next session, on the far side of the reset.

## Independent corroboration of the day reading (unplanned)

`dayProgressEntities` returned a Dungeon#**3** row — not Forbidden Woods —
with `UINT256_CID: 9` and `updatedAt: 2026-09-01T16:32:55Z`, roughly SEVEN
MINUTES before my read, stamped `TIMESTAMP_CID: 20696`.

Two things follow. First, it independently corroborates that the day is still
20696 from a *different* document than the one I read it from. Second, **the
account was being played by a human, on another dungeon, concurrently with this
session.** That is not the bot (this session sent no game writes). Worth
knowing because it means ring/gold balances can move out of band mid-session —
which is exactly the trap session 114 hit from the other direction.

## Ring balances — NO out-of-band movement since session 114 closed

Read live: Archon 30, Athena 33, Chobo 39, Crusader 39, Summoner 42,
Foxglove 45, Overseer 48. **Total 276**, matching STATE.md's session-114
closing total (288 → 276) exactly, faction by faction. Session 114 saw +6 of
out-of-band movement between sessions; this gap saw none.

## Fixed: a stale evidence count in the instrument itself

`scripts/checkEntryTiers.ts:235` printed *"the rotation ORDER — which is
UNCONFIRMED (one day observed)"*. That was true when written and became false
when session 114 measured day 20696; the measurement landed, the printed
warning didn't. Left alone, the next session reads its own instrument and is
told the rotation is n=1 when it is n=2 — the script UNDERSTATES its own
evidence.

Replaced with the actual state: two days on record, ADJACENT (20695→Foxglove
139, 20696→Summoner 140), adjacency constrains little, a NON-adjacent third
point is worth more than another consecutive one. No test pinned the old
string; `tests/entryTierRunway.test.ts` 13/13 still green, `tsc` clean.

This is the only code change this session made beyond verifying the offline one.

## Carry-forward items, addressed by name (brief's own list)

- **`BurnMastery` floor-vs-round** — still needs an ODD plain (non-crit,
  non-multiplied) amount. No runs were spent this session, so no new pairs;
  unchanged, still open, named for the third session running.
- **`Intimidating` (§68), `BurningTenacity` (§69), `CritHeal` (§66)** — all
  three remain at their DEFAULT (hold / latent). No directive was given this
  session and none was inferred. Explicitly NOT modelled.
- **`chooseNewCard`'s currency flaw** — off the carry-forward list, correctly.
  Step 0's real-suite verification found no problem the offline sandbox missed.

### Full command output

```
$ npx vitest run --maxWorkers=4          # UNSANDBOXED
 Test Files  115 passed (115)
      Tests  2298 passed (2298)
   Duration  13.11s

$ npx vitest run tests/fishing/cardChoice.test.ts tests/fishing/cardReachability.test.ts --maxWorkers=4
 Test Files  2 passed (2)
      Tests  45 passed (45)

$ npx tsc --noEmit
TSC CLEAN

$ git diff --check          # working tree AND HEAD~1..HEAD
CLEAN / CLEAN

$ npx tsx scripts/secretScan.ts
> secret scan — scope: tracked
  files scanned:        10524
  CONTROL A (read):     10161 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
      jwt                 0 unexplained   (1 allowlisted)
      addressBare         0 unexplained
      addressLabelled     0 unexplained   (2 allowlisted)
      noobTokenJson       0 unexplained   (1 allowlisted)
      noobIdProse         0 unexplained   (4 allowlisted)
      usernameQuoted      0 unexplained   (6 allowlisted)
      privateKeyPem       0 unexplained
      privateKeyHex       0 unexplained
> PASS — no unexplained hits, both controls healthy.

$ npx tsx scripts/secretScan.ts --scope=diff --ref=5d526ef7
> secret scan — scope: diff vs 5d526ef7
  files scanned:        6
  CONTROL A (read):     2 file(s) contain "docId"
> PASS — no unexplained hits, both controls healthy.

$ npx tsx scripts/checkEntryTiers.ts     # excerpt
  game day 20696  (week 86, dayOfWeek 4) — next day in 01:19:25
  tier 2  dropMultiplier 2  "Forbidden Woods Tier 2"
      faction 4  138 Archon Silver      balance  30
      faction 3  137 Athena Silver      balance  33
      faction 7  134 Chobo Silver       balance  39
      faction 1  135 Crusader Silver    balance  39
      faction 6  140 Summoner Silver    balance  42
      faction 5  139 Foxglove Silver    balance  45
      faction 2  136 Overseer Silver    balance  48
                                    total  276   (= session 114's close, no drift)

$ npx tsx scripts/checkDungeonToday.ts   # excerpt, address redacted
dungeonId 5 dayProgressEntities (real runs today): 12
  ID_CID "Dungeon#5"  UINT256_CID 12  TIMESTAMP_CID 20696  updatedAt 2026-08-31T19:12:34Z
  ID_CID "Dungeon#3"  UINT256_CID  9  TIMESTAMP_CID 20696  updatedAt 2026-09-01T16:32:55Z
     ^ NOT this bot. A human played Dungeon#3 ~7 min before this read. Corroborates day 20696.

$ npx tsx <independent card-choice re-derivation, against fixtures/fishing-casts/cards.json>
catalog size: 80
card 35: hitAmt=5 x 3 zones = 15 | critAmt=8 x 1 =  8 | mana=1 -> score 15
card 30: hitAmt=6 x 5 zones = 30 | critAmt=0 x 0 =  0 | mana=1 -> score 30
card 31: hitAmt=6 x 5 zones = 30 | critAmt=0 x 0 =  0 | mana=1 -> score 30
PICKED: 30
```
