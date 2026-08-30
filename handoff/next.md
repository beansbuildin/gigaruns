# BRIEF — session 110 — fishing report fix (Hard Core was never captured), then the fishing batch

**This document replaces the session-109 `next.md`.** Session 109 is executed
and closed — the 2 remaining Tier-1 dungeon runs, standard rule 11, GATE
PASS. Today's dungeon ledger is exhausted (12/12). **Before doing anything
below, read STATE.md's "Settled — do not re-open" digest.** Nothing in this
brief should duplicate an entry in that digest — if anything below looks
like it might, that's this brief being wrong, not the digest being stale.

**This session is fishing only.** No dungeon work is authorized here.

---

## Step 0 — fix a real gap: fishing's Hard Core income has never been tracked

**Fishing grants Hard Core (item 845) on every catch, credited synchronously
in the same response that resolves the catch.** `SPEC-fishing.md` §4 has
this live-verified since session 15/16 (cast 12925773, fish Zombo,
`gameItemBalanceChanges: [{id:521, amount:1}, {id:845 ("Hard Core"),
amount:320}]`) — settled, do not re-derive that it happens.

**What's actually missing: `src/sim/fishingCorpus.ts` and
`src/sim/fishingReport.ts` never parse `gameItemBalanceChanges` at all.**
Confirmed by reading both files directly — zero references to item 845 or
Hard Core in either. That's why `handoff/reports/fishing-casts.md` has no
Hard Core column and why no session recap has ever quoted a fishing Hard
Core total: nothing in this repo has ever aggregated it, even though the
dungeon side (`dungeonReport.ts`) has done the equivalent for the dungeon
corpus since early on. This was flagged to the user this session as a real
instrumentation gap, not a game-mechanic question — do this before running
any new casts, per the user's own request:

1. Extend `FishingCast`/`loadFishingCorpus()` (`src/sim/fishingCorpus.ts`) to
   read `gameItemBalanceChanges` off the terminal (or catch-resolving)
   response of each cast and extract the item-845 amount, mirroring however
   `dungeonReport.ts` does it on the dungeon side — reuse that pattern rather
   than inventing a new one.
2. Extend `FishingCastRecord`/`summarizeFishingCast()`
   (`src/sim/fishingReport.ts`) to carry a `hardCore: number` field (0 for an
   uncaught cast), and add a Hard Core column to `buildFishingMarkdown()`'s
   per-cast table and a running total to its summary line, same shape as
   `dungeon-runs.md`'s header total.
3. **Regenerate the report against the full existing corpus** (273 casts) —
   this backfills every past session's Hard Core income from data that
   already exists in the fixtures, no new spend required.
4. Add regression tests the way `tests/potions.test.ts` did for the
   potion-policy fix — at minimum: a cast fixture with a known catch and
   known `gameItemBalanceChanges` amount produces the expected `hardCore`
   value; an escaped/uncaught cast produces 0; the report's running total
   matches the sum of its own per-cast column.
5. **Report explicitly in the recap, before anything else fishing-related:**
   - Whether the amount is a fixed constant (320, matching the one
     session-15/16 data point) or varies — check across the full backfilled
     corpus rather than assuming either.
   - Total Hard Core and average per catch, for **session 102** (14 caught,
     2026-08-25) and **session 105** (14 caught, 2026-08-28) specifically —
     the user asked for these two by name.
   - The same total/average across the full 273-cast corpus, for context.
6. **This is corrective instrumentation, not a strategy change.** It does
   not alter what the bot plays, what it consumes, or any budget. Nothing
   about it needs a rule-11-style go-ahead — it's the fishing-side
   equivalent of a report script that already exists for dungeons.

## Step 1 — the fishing batch, after Step 0 is done and reported

1. **Confirm before assuming, on every axis.**
   - `npx tsx scripts/checkFishingCaps.ts` first — read `dayDocs[pondId 2]`
     for today's actual remaining casts.
   - Confirm the repo reads the 300-energy / 25-cast budget (raised
     2026-08-29, settled — do not re-raise or revert without a new user
     directive).
   - Read current rod durability live. Last read **15** (post-session-107
     batch, 37 → 15 over 22 casts played). No fishing has run since —
     confirm live, and if it's low enough that the batch would hit 0
     partway through, size the batch to stop before the floor, same
     discipline as session 105.
2. `--dry-run` first, per standing rule-4 discipline.
3. Run the batch under the already-shipped, already-autonomous policy — no
   new approval needed:
   - On-demand Relaxing-Oil-only necessity gate + double-lethal band
     (shipped) — do not re-derive it. Oil stock last read 24 (post-session
     107); confirm live.
   - Redraw stays disabled (`redrawEnabled: false`) — CLOSED; log the
     shadow trigger as usual, it changes nothing live.
   - Size the batch to whatever the live caps and durability reading
     actually allow, up to the 25-cast / 300-energy ceiling — headroom, not
     a target (settled, session 107).
4. Take a durability reading immediately after the batch.
5. Report at standard depth, now WITH Hard Core included since Step 0
   landed it: catch rate with binomial CI against the era baseline, oil
   spend under the shipped policy, necessity-gate opportunity count, casts
   played vs. charged (JEBAITOR gap), post-batch rod durability, **and this
   batch's own Hard Core total/average, using the new report column.**
6. If any cast comes back denied, blocked, or interrupted, re-read
   `checkFishingCaps.ts` before reporting anything — rule 13 stands.

## Two carried issues that touch fishing specifically — read before running

1. **The guard-budget day-key rollover bug is NOT fixed in code, and it
   reaches fishing.** `liveFishing.ts:1799` uses the identical pattern that
   bit the dungeon side in session 109 (QUESTIONS §65). Failure direction is
   safe (over-counts → blocks casts, never over-spends). If `--status` and
   `checkFishingCaps.ts` disagree, trust the live ledger.
2. **The fishing guard counter over-counts, separately.** Session 107 saw
   `runsStarted` read 25 against 22 played / 20 charged. Same rule: the live
   ledger and the reconciler's in-batch trace are the authority, not
   `--status`'s number.

Neither blocks the batch — both are about which number to trust if two
disagree.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan (prove the file count it covered — session 109 found a scan that
silently read zero files and still reported "0 hits"). State explicitly, at
the top of the recap:

- Step 0's result: whether Hard Core is a fixed or variable amount per
  catch, the session-102 and session-105 totals/averages by name, and the
  full-corpus total.
- Step 1's batch: casts played vs. charged, catch rate with CI, oil spend,
  post-batch rod durability, this batch's Hard Core total.
- **Carried forward, unresolved:** the `nextPosition` override (live,
  steering fishing card choice, still no user sign-off — sixth session
  carried) and whether the Tier-1 dungeon arm is now the baseline for
  downstream reports (out of scope here, but don't let it go unmentioned
  again).
