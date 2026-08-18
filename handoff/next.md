# BRIEF — session 29

Session 28 landed all five Tier 1 safety fixes clean (428/428 tests,
including flipping the two tests that used to enshrine unsafe behavior).
Both Codex documents (`CODEXREVIEW`, `CODEXIMPROVE`) are now committed at
the repo root for direct reference — don't re-derive their findings from
scratch, cite them.

This session: two Tier 2 items, promoted ahead of the rest of the queue for
concrete reasons below. Not a full sweep of everything left — same
discipline as session 28, small and verified beats comprehensive and rushed.

---

## 1. Fix resumed-cast transition-numbering corruption (CODEXREVIEW #5)

**Promoted out of the general queue** because it isn't just a data-quality
issue — it's actively steering current live play. `scripts/liveFishing.ts`
always initializes local `turn` to zero on resume, regardless of what's
already logged for that `castId`; `scripts/mineFishPatterns.ts` stores one
observation per turn number and silently overwrites duplicates. Concrete
proof already in the log: cast `12923189` has two distinct turn-0
transitions ~5 minutes apart — the second (from a resumed process) overwrote
the first. `perimeterWalk(cw)` and `perimeterWalk(ccw)` are both currently
promoted (support 4 and 3) and both feed the live matcher's seed pool.

**Fix:**

1. Derive the next turn/sequence number from existing records for the same
   `castId` on resume, not always zero.
2. Validate that the last logged `to` position matches the resumed cast's
   actual current position before appending anything.
3. In the miner: reject or explicitly segment gapped/duplicate trajectories
   rather than silently overwriting; never count a partial/gapped cast as
   an exact full-trajectory match.
4. **Re-run `mineFishPatterns.ts` against the corrected log and report
   honestly whether both promotions still hold.** If either was inflated
   by the duplicate, un-promote it — don't leave a bug-influenced pattern
   quietly seeding live play just because walking it back is inconvenient.
5. Add a regression test reproducing the exact `12923189` scenario (two
   resumed-process turn-0 writes) and confirming the miner no longer
   double-counts it.

## 2. Reconcile server-side daily caps as real scheduling state (CODEXREVIEW #6)

**QUESTIONS.md §13 is now answered — user-confirmed: both fishing and
dungeon reset at 11am Pacific (PDT currently), not UTC midnight.** This
replaces the "fishing has no known boundary, fall back to fail-closed only"
framing from the original brief — fold the real boundary in for both modes.

**Dungeon:** before scheduling a new run, check the authoritative
`GET /game/dungeon/today` count and treat it as ground truth over the local
guard file — block scheduling if the server count is already exhausted,
rather than attempting and eating a rejection.

**Fishing:** no authoritative "today" read endpoint is confirmed, so it
still can't cross-check live state the way dungeon can — but
`guardPersistence.ts`'s date-keying can now use the REAL boundary instead
of UTC midnight for both modes. Change the guard-budget date key from
"current UTC calendar date" to "most recent 11am Pacific rollover." Use a
proper timezone-aware calculation (`America/Los_Angeles`, which handles the
PDT/PST daylight-saving transition automatically) rather than hardcoding a
UTC offset — a hardcoded offset would silently drift wrong twice a year.
This directly addresses the root cause behind session 24's local/real
guard mismatch and session 27's wasted `start_run` attempt, on both modes,
without needing a fishing-side authoritative endpoint at all.

A confirmed server-cap rejection should still mark that mode exhausted for
the rest of the local day after verification, not retried or treated as an
unrelated anomaly each time — this is now a backstop for whatever the
corrected date-key logic might still miss, not the only defense.

Add regression tests: a guard-budget check made at, say, 10:59am Pacific
should read yesterday's key; one at 11:01am should read today's — across a
DST transition boundary if easy to simulate, since that's exactly the case
a hardcoded offset would get wrong.

---

## Your task

1. Fix the resume-transition-numbering bug (§1), re-run the miner, and
   report honestly on whether the 2 current promotions survive.
2. Add dungeon-side cap reconciliation against `GET /game/dungeon/today`
   (§2); leave fishing's fail-closed behavior as the permanent fallback
   unless the user has separately answered the reset-boundary question.
3. Don't start CODEXIMPROVE items or CODEXREVIEW #8 this session — queued
   next, not now.
4. Recap normally, full suite + tsc against the final commit as usual.

---

## Queued for session 30 — decided, not yet scoped in detail

Three items, user-confirmed this session, to write up properly once
session 29 lands:

1. **Run-visibility reporting.** Per-run/per-cast JSONL log plus an
   auto-generated human-readable markdown summary, committed to the repo
   (`handoff/reports/dungeon-runs.md`, `handoff/reports/fishing-casts.md`
   or similar). Dungeon: death room, or CLEARED for the (never-yet-seen)
   case of reaching room 16/floor 4 room 4, plus Dendren Root and Hard
   Cores rewards per run — verify both are actually extractable from
   dungeon fixture data before assuming the field shape, same discipline
   as everything else in this project. Fishing: catch rate %, fish names +
   quantities. Build on `deathRooms.ts` and `loadFishingCorpus()` rather
   than duplicating them. Regenerate after each session's live play.
2. **Act on `nextPosition` when it fires, not just log it.** User directive:
   when present, reposition the focus point to secure the guaranteed hit
   on the predicted cell — this is no longer a "wait and see" question,
   it's authorized live behavior once implemented. Still worth a brief
   validation-only pass first (log predicted vs. actual next position
   before trusting it to override the matcher) given the small sample
   size so far, but the target behavior is now settled.
3. **Dual Yield — no backfill needed, add forward detection instead.** The
   user added this skill after today's testing session, so there's no
   existing catch data to audit (nothing to find). Add a lightweight
   detector so the next actual double-catch is recognized and logged
   correctly (does it need two `loot` calls, one call with a different
   `cardsToAdd` shape, etc.) rather than silently mishandled the first
   time it fires — same pattern as the existing unknown-field detectors
   used elsewhere in this project.

Also naturally-resolved this session, no code follow-up needed: no
dedicated fishing-volume session — casts continue to accrue from ordinary
play toward Task 13's data floor.
