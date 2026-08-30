# BRIEF — session 110 — fishing only

**This document replaces the session-109 `next.md`.** Session 109 is executed
and closed — the 2 remaining Tier-1 dungeon runs, standard rule 11, GATE
PASS. Today's dungeon ledger is exhausted (12/12). **Before doing anything
below, read STATE.md's "Settled — do not re-open" digest.** Nothing in this
brief should duplicate an entry in that digest — if anything below looks
like it might, that's this brief being wrong, not the digest being stale.

**This session is fishing only.** No dungeon work is authorized here — rule
11 needs its own go-ahead regardless, and the dungeon ledger is spent for
today anyway.

---

## Two carried issues that touch fishing specifically — read before running

1. **The guard-budget day-key rollover bug is NOT fixed in code, and it
   reaches fishing.** Session 109 found `saveGuardBudget` stamps the write
   time's day key onto counters seeded at process start, so a run that
   straddles the 11:00 Pacific reset misattributes its pre-reset spend to
   the new day. It was corrected in *data* for the dungeon ledger only
   (server-authoritative, user-approved) — **the code path itself is
   unchanged**, and `liveFishing.ts:1799` uses the identical pattern
   (QUESTIONS §65, STATE.md session 109 open question 1). A fishing batch
   that happens to straddle the reset could see the same local/server
   disagreement. The failure direction is safe (over-counts → blocks
   casts, never over-spends), so this is not a reason to stop, but if
   `--status` or a fail-closed stop disagrees with
   `npx tsx scripts/checkFishingCaps.ts`, **trust the live ledger
   (`dayDocs[pondId 2]`) over the local guard file**, and say so in the
   recap rather than treating it as a new mystery.
2. **The fishing guard counter over-counts, separately.** Session 107 saw
   `runsStarted` read 25 against 22 played / 20 charged. Carried unresolved
   across sessions 107-109. Same rule applies: `checkFishingCaps.ts`'s live
   read and the reconciler's in-batch trace are the authority, not
   `--status`'s number.

Neither of these blocks the batch — they're both about which number to
trust when two disagree, not about whether to run.

## The fishing batch

1. **Confirm before assuming, on every axis.**
   - `npx tsx scripts/checkFishingCaps.ts` first — read `dayDocs[pondId 2]`
     for today's actual remaining casts.
   - Confirm the repo reads the 300-energy / 25-cast budget (raised
     2026-08-29, settled — do not re-raise or revert without a new user
     directive).
   - Read current rod durability live. Last read **15** (post-session-107
     batch, 37 → 15 over 22 casts played). No fishing has run since —
     confirm the live number rather than assuming it's still 15, and if
     it's low enough that the batch would hit 0 partway through, size the
     batch to stop at the floor the same way session 105 did (stop before
     0, don't guess past it).
2. `--dry-run` first, per standing rule-4 discipline.
3. Run the batch under the already-shipped, already-autonomous policy — no
   new approval needed:
   - On-demand Relaxing-Oil-only necessity gate + double-lethal band
     (shipped) — do not re-derive it. Oil stock last read 24 (post-session
     107); confirm live.
   - Redraw stays disabled (`redrawEnabled: false`) — CLOSED; log the
     shadow trigger as usual, it changes nothing live.
   - Size the batch to whatever the live caps and durability reading
     actually allow, up to the 25-cast / 300-energy ceiling. Not a request
     for exactly 25 — that number is headroom, not a target (settled,
     session 107).
4. Take a durability reading immediately after the batch.
5. Report at standard depth: catch rate with binomial CI against the era
   baseline, oil spend under the shipped policy, necessity-gate opportunity
   count, casts played vs. casts charged (the JEBAITOR gap — report it even
   if zero), post-batch rod durability.
6. If any cast comes back denied, blocked, or interrupted, re-read
   `checkFishingCaps.ts` before reporting anything — rule 13 stands.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan (prove the file count it covered — session 109 found a scan that
silently read zero files and still reported "0 hits"). State explicitly, at
the top of the recap:

- Casts played vs. charged, catch rate with CI, oil spend, post-batch rod
  durability.
- Whether the day-key rollover pattern or the guard-counter over-count
  actually surfaced this session (most likely not, but say so either way
  rather than leaving it silently unmentioned).
- **Carried forward, unresolved:** STATE.md's open question on the
  `nextPosition` override (live, steering fishing card choice, still no
  user sign-off — sixth session carried) and whether the Tier-1 dungeon arm
  is now the baseline for downstream reports (out of scope for a fishing
  session, but don't let it go unmentioned again).
