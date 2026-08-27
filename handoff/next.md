# BRIEF — session 102 — the 20-cast live fishing batch (§C, carried from sessions 100-101, QUESTIONS.md §55)

**This document replaces the session-101 `next.md`.** Session 101 is executed
and closed — QUESTIONS.md §58 (§A+§B), §59 (§D), STATE.md session 101. §A
(events-coverage) and §B (proc effect sizes) are DONE, and the user's
mid-session addition, §D (status-effect mechanics), is also DONE. All three
are dungeon-side findings (combat procs and statuses in Forbidden Woods) and
touch nothing about this session's task. §C is the only carried item, and it
is now the whole brief.

**Confirm the reset before doing anything else — do not assume the clock.**
Session 101 read the fishing ledger at 20/20 spent, 09:54 PT, with the
11:00 PT rollover not yet arrived at that point. A full day has since
passed, so this is very likely stale — but CLAUDE.md rule 4 / rule 13
discipline stands regardless of how obvious the answer looks: run
`npx tsx scripts/checkFishingCaps.ts` first and go by what it reports, not
by elapsed wall-clock time. If it still reads 20/20, this session is blocked
again — say so plainly and stop; do not idle-wait for a clock that has
already been wrong once this week.

---

# §C — The 20-cast fishing batch (QUESTIONS.md §55)

**Volume, not targeting — §50's ruling still stands.** §55 set this at 20
casts, the full daily cap, explicitly as a volume decision, not a shaped
attempt to observe the 0.85 necessity gate (open since session 99, still
zero opportunities across four small batches). Report whatever the gate
does or doesn't do as an observation of ordinary play at higher volume, not
as a targeted test.

1. `checkFishingCaps.ts` first (above, non-negotiable). Then `--dry-run` per
   standing rule-4 discipline — the necessity gate, the retired tripwire,
   and the durability preflight (live since session 100) are all real code
   paths worth exercising dry before spending anything.
2. Run the full 20-cast batch. Oils are pre-authorized and autonomous within
   `config/bot.json`'s standing policy — `dendren.oils.policyApproved: true`,
   Relaxing Oil (937) only, capped at 2/cast, `maxPerCast: 3` overall. No new
   approval is needed for this batch; this is the same standing permission
   sessions 97-99 already ran under.
3. Report at standard depth:
   - Catch rate with a binomial CI. The corpus baseline is 210 casts / 80
     caught (38.1%) as of the last report regen — n=20 finally has real
     power against that, compared to the 2-9 cast batches run this quarter.
   - How many opportunities the 0.85 necessity gate got and what it did
     each time.
   - Opening-turn focus spend against the 0.83 baseline.
   - Updated cumulative redraw-shadow count (still tracking toward §51's
     ~350-decision target for 80% power).
4. **The durability bracket.** `data/rodDurability.jsonl` currently holds
   two `before` readings, both dry-run, both 38 — confirming zero casts have
   been spent on Golkan (itemId 812, the standing rod per §53) since session
   99's 40→38 over 2 casts. This is the first batch that can take a real
   `before` AND `after` reading around actual live casts in the same
   session. Take both, and report the resulting decrement rate against that
   existing 40→38/2-casts, n=1 figure — this is what turns it into a bracket
   with an actual sample instead of one data point.
5. **After the batch, or after any live command that reports denied,
   blocked, or interrupted:** re-read the ledger (`checkFishingCaps.ts`)
   before reporting what happened. A tool-level denial racing execution is
   not proof nothing ran (CLAUDE.md rule 13, session 61) — go by the
   server's own count of casts spent, never by what the harness said back,
   and never re-issue a denied command on the strength of the denial alone.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4` — the default over-subscribes this machine and
produces false timeout failures, session 100's finding), `tsc --noEmit`,
`git diff --check`, secret scan. State explicitly, at the top of the recap:
whether the ledger read reset or was still exhausted on arrival, the batch's
catch rate and CI, the necessity-gate and redraw-shadow figures, and the
durability bracket's new decrement rate. If the ledger was still exhausted,
say so plainly and stop there — that is an acceptable, expected outcome, not
a failure to report around.
