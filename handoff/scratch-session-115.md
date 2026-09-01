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
