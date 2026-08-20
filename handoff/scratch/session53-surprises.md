# session 53 — surprises

## S1. Brief §0a VERIFIED — session 52's "server changed" is refuted
`post_attempt_failed` counts with `reason: "reward selection rejected"`:
08-18: 12+10+10+8 = 40 (of 40 decisions). 08-20: 14+2+10 = 26 (of 26).
100% on both sides. `reason` predates the `serverErrorDetail` fix; only
`body`/`message` are new. Session 52 grepped for "Invalid action token"
— a string that could not exist before 08-19 — and read newly-visible as new.

## S2. The brief's 3600ms is on the WRONG CLOCK and would likely have FAILED the gate
The brief measured the split as "gap to the preceding response":
  rejected 0.90–1.54s (n=66) / accepted 3.40–4.92s (n=66) — reproduced EXACTLY.
But `RateLimiter.wait()` stamps `lastCallAt` BEFORE dispatch, so `minGapMs`
is a REQUEST-to-REQUEST gap. The two differ by one response latency:
  since_last_response = requestGap - latency,  latency 0.72–1.78s (med 1.45, n=296).
So minGapMs=3600 yields since_last_response ≈ 1.82s worst case / 2.15s typical
— inside the UNMEASURED zone (1.54, 3.40), only 280ms above the highest
observed REJECTION. Not a safe setting.
FIX: put the override on the clock the measurement lives on —
`minGapSinceResponseMs`, set to 4000ms, squarely inside the proven-success
band [3.40, 4.92] (median 4.07) and immune to latency variation.
This is a unit correction found BEFORE the run, not "raising the number
until it passes" (which the brief rightly forbids).

## S3. The action-token epoch cannot be used as an absolute clock — local clock skew
`token_epoch - dispatch_ts` = 0.70–2.68s (median 1.93s), LARGER than the full
POST→response round trip (median 1.45s). The server clock is ahead of this
machine by roughly 1.5–2s. Relative comparisons within a session are fine;
absolute "elapsed since token issued" is not. All timing conclusions here are
therefore anchored on LOCAL response timestamps only.

## S4. Brief §6's list is EMPTY — the gap runs the other way
"Enumerate which `BOON_MODELS` entries have still never appeared in a room-1
offer." Answer: **none. 0 of 17.** Session 52's own `AddMaxHealth` capture
closed the last one. The retroactive-wall-1-hole mechanism (session 11
AddMaxArmor, 43 UpgradePaper, 52 AddMaxHealth) cannot recur in that direction
until something new is ADDED to `BOON_MODELS`.
The real untested surface is the OPPOSITE gap, and it is large: **33 boon
types have been OFFERED in captured runs and have no `BOON_MODELS` entry**
(AddBurnMagic, Thorns, Regen, SecondWind, the whole Weakening*/Burning*/
Vulnerable* families, ...). 47 room-1 offers of 123 total.
`scripts/boonCoverage.ts` reports both directions so the next session reads a
list instead of rediscovering one.

## S5. The audit's gap is measured at LOG-WRITE time, not dispatch time
`log.write({event:"post"})` fires BEFORE `postDungeonAction`, and the rate
limiter sleeps INSIDE it. So `rejectionAudit.ts`'s "gap since response" is the
gap to the DECISION, not to the packet. For first attempts the sleep was
~0-0.2s historically, so the historical bands are ~right at dispatch too and
the conclusion holds — but the number is not what it looks like.
Direct proof the fix lands, measured post-log -> outcome (sleep + latency):
  BEFORE (52 run 1): empty 0.72-1.78s (med 1.42) | numeric 1.16-1.78 (med 1.45)
  AFTER  (53 run 1): empty 4.24-4.55s (med 4.27) | numeric 1.03-1.71 (med 1.42)
Empty-token only, numeric untouched. 6/6 rejections -> 0/6.

## S6. Energy accounting drifted -1 AGAIN, same direction (run 1)
observed 59 vs committed 60, `drifted: true` — identical to session 52 run 1.
Brief §6 said: if it drifts the same direction on both runs this session it is
systematic. Watch run 2.

## S7. Both runs drifted energy -1, same direction — now systematic
Run 1: 80 -> 21, observed 59, committed 60.  Run 2: 79 -> 20, observed 59,
committed 60. Both `drifted: true`. Session 52's run 1 did the same. That is
now 3 of the last 3 juiced runs drifting -1 in the SAME direction, which the
session-53 brief §6 pre-committed to calling systematic. Not regen (regen adds,
this subtracts). QUESTIONS.md §23.

## S8. This session's corpus growth LOWERED deepestScorableRoom, 5 -> 4
Verified by stashing: before session 53's changes all three sim arms report 5;
after, arm 1 reports 4 and the other two still 5. Deterministic across three
runs, so not noise in the sim itself — but it IS noise in the underlying
sample: arm 1's room 5 was 1/2 scorable before and is 0/0 now.
Mechanism: the 12 new offers introduced three new UNMODELLED boon types
(AddWeakShield, RegenMastery, Vengeance) at rooms 3/4, so more simulated runs
go unscorable earlier. This is the sim's own "coverage FALLS as the engine
improves" effect running in the corpus direction. Honest capture lowering a
coverage metric is not a regression, but TASKS.md Task 4.5's old gate was
`deepestScorableRoom >= 4` — worth knowing it is now sitting exactly on it.

## S9. Run 2's death room is reported as `null`
`data/run-reports/dungeon.jsonl` records run 2 as `{"kind":"death","room":null}`
with 8112 score / 687 loot. `dungeonReport.ts` derives the room from the last
captured enemy's presence in `ROOM_ENEMIES`, and Enemy Room 72 was not in it at
report time. Fixed by this session's `ROOM_ENEMIES` additions — but the report
was regenerated BEFORE them, so the committed line is stale. Re-running
`regenerateReports` fixes it. The general shape: a first-ever depth always
reports `room: null` until its enemy is pinned, so the deepest run in the
corpus is always the one the report cannot name.
