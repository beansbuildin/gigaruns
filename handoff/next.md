# BRIEF — session 108 — dungeon: 4 Tier-1 juiced runs, ONE invocation, chained without stopping

**This document replaces the session-107 `next.md`.** Session 107 is executed
and closed — fishing-only batch GATE PASS on the raised 300/25 budget, 22
casts played / 20 charged, JEBAITOR gap measured at 9.1% (STATE.md session
107). **Before doing anything below, read STATE.md's "Settled — do not
re-open" digest.** Nothing in this brief should duplicate an entry in that
digest — if anything below looks like it might, that's this brief being
wrong, not the digest being stale.

**This session is dungeon only.** No fishing is authorized here.

---

## Read this before running anything: today's authorization is non-standard

**CLAUDE.md rule 11 normally requires `--runs=1` every invocation, with a
full stop and a fresh human go-ahead before the next run** ("approval for one
run is never approval for the next"). **The user has explicitly overridden
that for this session only**, given directly in chat: *"This is time limited
so I am authorizing for this session to play all 4 dungeons without stopping
in between."*

Treat this as a **dated, single-session exception, not a rule change**:

- Run all 4 as **one invocation**, `--runs=4`, rather than four separate
  `--runs=1` calls with a pause between. `liveRun.ts` already supports this
  (`--runs=N`, "stage 4" in its own header) — the standing policy has simply
  always passed 1. Nothing about the underlying mechanics changes; only the
  batching does.
- Record this explicitly in the recap and in `DECISIONS.md` as a **user
  directive scoped to session 108's date, not a standing change to rule 11.**
  The next dungeon brief still defaults to `--runs=1` with a stop between
  runs unless the user says otherwise again — this authorization does not
  carry forward by default.
- Everything else about rule 11 is unchanged and still applies to all 4 runs
  inside the single invocation (see below).

## What doesn't change: the other four rule-11 conditions, on all 4 runs

- **`--juiced-index=1`.** `index` is the TIER value off `entryData[].tier`,
  not an array position — `entryData` is ordered tier 2, 1, 3. Settled;
  exercised live 4/4 already in session 106. Do not re-verify this as if it
  were new.
- **Zero rings.** Confirmed by the *absence* of negative
  `gameItemBalanceChanges` on each `start_run` — session 106 found there is
  no `inputItems` key on the request body itself (that was a correction to
  the old measurement plan; don't ask for a field that doesn't exist).
- **Still 60 energy, juiced**, per run — `--juiced` stays set for the whole
  `--runs=4` invocation. `index` and `isJuiced` are independent axes; Tier-1
  does not mean non-juiced.
- **Still auto-loads 3x Big Heal Juice** (itemId 131,
  `config/bot.json` → `forbiddenWoods.potions`) on every run in the batch —
  that gate reads `--juiced` alone.

## What chaining changes operationally: skill points and loadout

- **Do not allocate skill points at any point in this batch — not between
  runs, not at the end.** That prohibition is unconditional and this
  authorization does not touch it. Since there is no pause between runs this
  session, no allocation opportunity exists anyway; just don't invent one.
- **This means gear stays exactly what it read at the start of run 1 across
  all 4 runs** — a side effect of not stopping, and a good one: it keeps the
  whole batch one single comparable loadout arm (the "stable going forward"
  ruling), same as session 106's batch, with zero risk of drift between runs
  since nothing is happening between them to drift.
- Report the accumulated unspent skill XP at the end so the user can spend it
  in one pass whenever they next choose to — do not treat "4 runs done" as
  itself a natural allocation point unless the user says so.

## Ledger discipline — before the batch and after, not between runs

- `npx tsx scripts/checkDungeonToday.ts` **before** the invocation. Confirm
  what's actually available today — do not assume a fresh 0/12; check
  whatever the real `dayProgressEntities` reading is. **If fewer than 12
  run-units (4 runs x 3) are available, say so up front and run only as many
  full runs as the real ledger supports** — do not attempt a partial 4th run
  or round up.
- `--dry-run` first per standing rule-4 discipline, still worth the twenty
  seconds even under time pressure.
- Run `--runs=4 --juiced --juiced-index=1`.
- `npx tsx scripts/checkDungeonToday.ts` again **after** the whole invocation
  completes (not after each run — there's no natural pause to check at). If
  the batch stops early (server error, three consecutive action failures,
  daily cap reached mid-batch), that's rule 5 doing its job — report how many
  of the 4 runs actually completed and why, same as any fail-closed stop.
- If anything in the run is reported denied, blocked, or interrupted, re-read
  the ledger before reporting it as not having happened — rule 13 stands
  regardless of the batching change.

## What this batch is and is not

**This is not a re-run of the Tier-1 Hard Core measurement.** That's CLOSED
(STATE.md digest: "MEASURED, not derived... It is no longer a derivation").
Do not re-apply `TIER1-MEASUREMENT.md`'s decision rule or re-score H/r as if
testing a hypothesis — the multiplier is settled at an exact 4:1 quantum.
This batch is ordinary Tier-1 juiced play at the confirmed rate: bank the
Hard Core and Dendren Root totals, rooms cleared, and boon picks as corpus,
same as any other dungeon session, but don't frame it as evidence-gathering.

Rule 8 (highest non-Perpetual tier; lowest/no-modifiers at the final room)
still governs every in-room `enemyPathOptions` choice across all 4 runs —
unaffected by the entry-tier setting or by the chaining.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan. State explicitly, at the top of the recap:

- That this session ran under a **one-time, dated exception to rule 11's
  chaining prohibition**, explicitly authorized by the user for time
  pressure — and that the exception does not carry forward.
- How many of the 4 runs actually completed in the single invocation, and
  why if fewer than 4 (ledger shortfall going in, or a mid-batch fail-closed
  stop).
- Per run: rooms cleared, Hard Core and Dendren Root totals, `start_run`
  body confirmation (`index: 1`, `isJuiced: true`).
- Total accumulated unspent skill XP at the end, ready for the user's next
  single allocation pass.
- **Carried forward, unresolved — this brief does not settle any of them:**
  STATE.md's open question 1 (`nextPosition` override live, no sign-off),
  open question 2 (fishing guard counter over-count — out of scope for a
  dungeon session), and open question 3 (whether Tier-1 is now the baseline
  for downstream dungeon reports — fourth session unaddressed; flag it again
  rather than letting it go quiet).
