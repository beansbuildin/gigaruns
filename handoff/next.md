# BRIEF — session 111 — dungeon: switch to Tier-2 (silver rings), standing change, up to 4 runs one at a time

**This document replaces the session-110 `next.md`.** Session 110 is executed
and closed — fishing-only, GATE PASS on both halves (Hard Core tracking
built and backfilled, then 22 casts played / 20 charged). Today's dungeon
ledger was untouched this whole time (last known 12/12, spent in session
109 — **confirm live, don't assume it's still exhausted**, since the 11:00
Pacific reset may have passed). **Before doing anything below, read
STATE.md's "Settled — do not re-open" digest.** Nothing in this brief
should duplicate an entry in that digest — if anything below looks like it
might, that's this brief being wrong, not the digest being stale.

**This session is dungeon only.** No fishing is authorized here.

---

## The directive: Tier-2 is now the standing entry tier, replacing Tier-1

**User directive, given directly in chat, confirmed as a STANDING change
(not scoped to one batch):** dungeon entry tier moves from Tier-1
(`--juiced-index=1`, 0 rings) to **Tier-2 (`--juiced-index=2`, silver
rings)**, effective this session, until the user says otherwise again.

This supersedes the settled **[USER] Rule 11 entry-tier** entry (currently:
*"entry tier is Tier-1, 0 rings... Exercised live 10/10"*). Update it in
place, the same way the 2026-08-27 Tier-3→Tier-1 change amended CLAUDE.md
rule 11 rather than leaving two directives to disagree:

- **Edit CLAUDE.md rule 11 directly**, adding a dated `[2026-08-30]` (or
  whatever today's date reads) note the same shape as the existing
  `[2026-08-27]` one: what changed, why (the user's own stated reason, plus
  whatever ring-runway math this session produces — see below), and that it
  is a user directive, not an optimisation.
- **Update the STATE.md settled digest entry** to read Tier-2, and update
  its "exercised live N/N" counter starting from this session's real count
  rather than carrying forward the Tier-1 figure.
- **Add a `DECISIONS.md` entry**, dated, same as every other rule-11 amendment
  in this repo's history.
- Do **not** touch `TIER1-MEASUREMENT.md` or `TIER1-RESULT.md` — those are
  pre-registrations/results for the Tier-1 work already done and closed;
  they're historical record, not something this change edits.

## What "Tier-2 offering" means — verify before spending, do not assume by analogy

The Tier-1 work established a pattern worth repeating exactly, not
reinventing:

- **`--juiced-index=2`.** `index` is the TIER value read off
  `entryData[].tier`, **never an array position**. `entryData` is ordered
  tier **2, 1, 3**, so Tier-2 happens to sit at array position 0 this
  time — the opposite coincidence from Tier-1's position 1. Match on
  `entryData[].tier === 2`; do not index positionally, and do not assume
  "position 0" generalizes from this one observation either.
- **This spends real silver rings, and the exact cost is not yet confirmed
  live.** Session 106 found `entryData[].inputItems` holds **seven ids**
  for both Tier 2 and Tier 3 (vs. Tier-1's empty array) — but that count was
  read off Tier-3's entry, not Tier-2's, and has never been checked for
  Tier-2 specifically. **Log the actual `entryData` for the Tier-2 entry
  before the first run** — the real `inputItems` array, not an assumed
  count — and confirm the resulting negative `gameItemBalanceChanges` on
  `start_run` matches it exactly (the same discipline that confirmed zero
  rings for Tier-1, now run in the direction that expects a real debit).
- **Check the current silver ring balance before running anything, and
  compute the runway.** This repo switched Tier-3→Tier-1 in the first place
  specifically to stop draining a limited ring stock (gold rings then had
  ~16 days of runway against ~42 days of event time left). The same
  arithmetic applies in reverse now: read the live silver ring balance,
  divide by whatever `inputItems` actually costs per run, and state days-of-
  runway explicitly in the recap — at up to 4 runs/day if the user keeps
  running at the daily max. This is not a gate (the user has already
  directed the change), but it must be **visible**, the same way the
  original gold-ring runway was, so nobody rediscovers a shortage as a
  surprise blocker later.
- If the live silver ring balance is insufficient for even one Tier-2 entry,
  **fail closed and report it** — do not fall back to Tier-1 or any other
  tier without asking; that's a real blocker, not a judgment call.

## What doesn't change: the other three rule-11 conditions

- **Still 60 energy, juiced**, per run — `index` and `isJuiced` are
  independent axes (SPEC §3c/§3f), unaffected by which tier is chosen.
- **Still auto-loads 3x Big Heal Juice** (itemId 131,
  `config/bot.json` → `forbiddenWoods.potions`) — that gate reads `--juiced`
  alone.
- **One run, then stop and hand back — standard rule 11, no chaining this
  time.** `--runs=1`, every invocation. Stop after each run, report it, and
  wait for a fresh explicit go-ahead before the next. The user's own choice
  this session was the standard one-at-a-time pattern, not a repeat of
  session 108's chained exception — do not chain.
- Rule 8 (highest non-Perpetual tier; lowest/no-modifiers at the final
  room) still governs every in-room `enemyPathOptions` pick — unaffected by
  the entry-tier setting.
- Skill points: never allocate them yourself. The pause between runs is the
  user's normal opportunity to do so if they choose.

## Sizing: up to 4 runs today, one at a time

- `npx tsx scripts/checkDungeonToday.ts` first — confirm the real
  `dayProgressEntities` reading rather than assuming either "still 12/12
  exhausted" or "freshly reset." Size to whatever run-units are actually
  available, up to 4 runs (12 run-units / 3 per juiced run).
- `--dry-run` first per standing rule-4 discipline — and this time, dry-run
  is also how the Tier-2 `entryData`/ring-cost check above should be done
  before any live spend.
- After each run, re-check the ledger (rule 13) before reporting, and stop
  for a fresh go-ahead before the next.

## A natural measurement opportunity — not a gate, don't force it

This will be the account's **first-ever live Tier-2 entry** (every prior
juiced run has used index 1 or 3; 34/34 historical + 10/10 recent). The
Tier-1 result (`handoff/TIER1-RESULT.md`) found Hard Core payout follows
`base x 12 x dropMultiplier` with an exact quantum per tier (12 at Tier-1,
48 at Tier-3) and predicted, but never tested, **a quantum of 24 at Tier-2**
(`dropMultiplier` 2) — roughly **534 Hard Core/room** at the corpus's ~22.3
mean base. If Tier-2 runs happen to reach `r >= 6` rooms, dividing Hard Core
by rooms cleared and checking it against ~534/room (and Dendren Root
staying on its usual depth-indexed sequence, unaffected by tier) is worth
noting in the recap. **This is opportunistic, not a pre-registered study
like Tier-1 got** — the user didn't ask for one, don't build the
`TIER1-MEASUREMENT.md`-style apparatus for it unless asked. Just don't
throw the numbers away.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan (prove the file count it covered). State explicitly, at the top of the
recap:

- That Tier-2 is now the standing entry tier, and confirmation that
  CLAUDE.md rule 11, the STATE.md settled digest, and DECISIONS.md were all
  updated to say so.
- The real `entryData`/`inputItems` cost for Tier-2, confirmed against the
  actual negative `gameItemBalanceChanges` on `start_run` — not assumed
  from Tier-3's count.
- Silver ring balance before and after, and the runway calculation (days at
  the current rate, up to 4 runs/day).
- How many of the (up to) 4 runs actually happened, and why if fewer.
- Per run: rooms cleared, Hard Core and Dendren Root totals, and the rough
  quantum check against the ~534/room Tier-2 prediction if any run reached
  r >= 6.
- **Carried forward, unresolved:** whether the Tier-1 arm (now itself about
  to be superseded by Tier-2 as the live baseline) is comparable to
  anything downstream — this makes it more urgent, not less, so raise it
  plainly rather than letting a seventh session pass silently. Also the
  `nextPosition` override (fishing-side, out of scope for a dungeon
  session, but don't let a seventh session of silence happen there either).
