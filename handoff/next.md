# BRIEF — session 94 — four juiced dungeon runs, in two pairs, hard stop after the first two for a fresh go-ahead

**This is a dungeon session, not a fishing one — the first dungeon-focused
brief since before session 89's log.** The 10-cast fishing batch is still
owed per session 93's open questions, but nothing here touches fishing;
that's a separate future brief.

**Where this came from.** The user asked for a session scoping four juiced
dungeon runs, structured as two pairs with a hard pause after the first two,
waiting on their explicit go-ahead before the second pair. **This brief is
scoping and preparation only — it is not itself an approval for any run.**
CLAUDE.md rule 11 and the "Ask first" list both say, in as many words:
*"Approval for one run is never approval for the next."* Nothing about a
user asking for four runs in one sitting changes that — each of the four
still needs its own separate, explicit go-ahead, obtained at the time. The
"pause after two" the user asked for is a **stricter, session-level
checkpoint layered on top of** that standing per-run gate, not a substitute
for it. Read this whole section before running anything.

---

## 0. What every run requires, individually, regardless of this brief

From CLAUDE.md rule 11 (2026-08-20, standing until the user says otherwise)
and the "Ask first — never do these autonomously" list:

- **60-energy juiced Tier-3 entry**: `--juiced` (`JUICED_COST_MULTIPLIER` 3
  against the 20-energy base) and `--juiced-index=3` (the entry-tier choice,
  distinct from the in-room `enemyPathOptions` tier that rule 8 governs).
  Both conditions, every run — there is no such thing as a plain run anymore.
- **3x Big Heal Juice** (itemId 131), auto-loaded from `config/bot.json`'s
  `forbiddenWoods.potions` block. Verify stock covers the runs you're about
  to attempt (§1c) — this block is safe to leave in config permanently, but
  it doesn't guarantee the item is in inventory.
- **`--runs=1`, every time. One run, then stop and hand back.** Never chain
  automatically — `scripts/orchestrator.ts`'s dungeon arm is disabled
  specifically because a rule requiring per-run human approval cannot be
  satisfied by an autonomous loop. This brief scoping four runs across two
  pairs does not create an exception to that; it just organizes when the
  (still-individual) approvals happen.
- **Skill points are allocated by the user between runs, never by the
  agent.** After each run's result, stop. Don't suggest an allocation unless
  asked, and don't proceed to the next run's plan until the user has had the
  chance to allocate.

**What this brief adds on top of the above:** after run 2's result and skill
points are handled, the session stops **harder** than the per-run gate
requires — it doesn't even present run 3's plan or ask for its go-ahead in
that same pass. That's the pause the user asked for. Runs 1 and 2 still each
need their own separate go-ahead exactly as rule 11 always requires; the
pause is additional, not instead of.

---

## 1. Before starting

- **Rule 13, applied to the dungeon ledger.** Run
  `npx tsx scripts/checkDungeonToday.ts` and read `dayProgressEntities`
  against `maxRunsPerDay` (12 run-units, resetting 11:00 Pacific — juiced
  runs cost 3 units each, so **4 juiced runs is the entire daily
  allowance**, not a subset of it). Session 93's STATE.md read
  `dayProgressEntities` null for 2026-08-24 with zero dungeon runs that day;
  don't carry that number forward — check today's fresh.
- **Energy.** `dendren.dailyEnergyBudget` is `252` (raised in session 93).
  Four juiced runs cost `240` energy on their own, before any fishing spend
  today — check the day's actual energy ledger, not just the dungeon
  run-unit count, before promising the user all four fit today.
- **Potions.** Confirm Big Heal Juice (131) stock covers at least the runs
  you're about to attempt (3 per run). If stock can't cover all 4, say so
  up front — that caps how far this session can get regardless of the
  approval structure below, and it's better surfaced at the top than
  discovered mid-pair.
- **`--dry-run` first** if anything about room logic, enemy tiers, or loot
  handling has changed since the last dungeon session — standing habit, not
  new to this brief.

---

## 2. The structure — two pairs of one, not a batch of four

### 2a. Run 1

1. Present the plan (juiced, Tier-3, 3x Big Heal Juice, `--runs=1`) and get
   the user's **explicit go-ahead for this run specifically**.
2. `npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1`
3. Report the full result — outcome (cleared/death/incomplete), room reached,
   Hard Core and Dendren Root earned, energy spent, any guard trips, retries,
   or spec surprises — the same depth `handoff/reports/dungeon-runs.md`'s
   per-run table already tracks.
4. Stop. The user allocates skill points from this run's outcome. Don't do
   it for them, don't suggest a specific allocation unless asked.

### 2b. Run 2

Repeat 2a exactly — **a fresh, separate go-ahead**, not carried over from
run 1's. Report and stop for skill points the same way.

### 2c. The pause

Once run 2 is reported and skill points are settled, **end this pass here.**
Do not present run 3's plan, do not ask for its go-ahead, and do not treat
anything said so far — including the user's original request for four runs —
as authorization to continue. Recap plainly: what runs 1 and 2 did, resources
earned, the run-unit/energy/potion ledger remaining, and that the session is
holding for the user's separate go-ahead to continue to runs 3 and 4.

### 2d. Runs 3 and 4 — only once the user actually says to continue

When that go-ahead comes (a new explicit message, not implied by time having
passed), repeat 2a and 2b once each for runs 3 and 4 — same five steps, same
individual approvals, same skill-point stop after each. Nothing about having
already done two runs today changes rule 11 for the third or fourth.

---

## 3. After the session (whether it's 2 runs, 4, or fewer on a shortfall)

- Confirm `handoff/reports/dungeon-runs.md` regenerated and picked up every
  completed run (`scripts/dungeonReport.ts` reads `data/run-reports/dungeon.jsonl`).
- Full suite + `tsc --noEmit` + `git diff --check`, secret scan, same as any
  other session's recap.
- **Stopping at 2 (the planned pause), or earlier on a ledger/energy/potion
  shortfall, is a complete and expected result** — not something to explain
  away or push past.

---

## 4. Do not

- **Do not treat this brief, or the user's request for "four runs," as
  approval for any individual run.** Each of the four needs its own
  explicit go-ahead, obtained at the time, per rule 11 and the Ask-first
  list — full stop, no matter how this brief scopes the session.
- **Do not allocate skill points, ever.** The user's call, every time,
  between every run.
- **Do not run 3 or 4 without a fresh go-ahead obtained after the pause** —
  not one carried over from anything said around runs 1–2.
- **Do not exceed 4 runs** even if the ledger shows headroom — the user set
  the number.
- **Do not vary the four conditions per run** (juiced, `--juiced-index=3`,
  3x Big Heal Juice, `--runs=1`) to "save resources" on any individual run —
  rule 11's four conditions are load-bearing together.
- **Do not let the orchestrator's dungeon arm run any of this.** It's
  disabled by design; use `liveRun.ts` directly, one run at a time, as
  above.

---

## Your task (session 94)

1. Check the dungeon ledger, energy budget, and potion stock (§1) before
   promising four runs fit today.
2. Run 1: plan → separate go-ahead → execute → report → user allocates
   skill points.
3. Run 2: same, with its own separate go-ahead.
4. **Stop.** Recap runs 1–2 and hold for the user's explicit go-ahead to
   continue — do not present run 3's plan in this pass.
5. On a later, explicit go-ahead: run 3, then run 4, each following the same
   plan → go-ahead → execute → report → skill-points cycle, each approved
   separately.
6. Recap normally once the session actually ends (at the pause or after all
   four): regenerated dungeon report, full suite, `tsc --noEmit`,
   `git diff --check`, secret scan.

**The one thing this brief cannot do for you:** grant approval. Its whole job
is to make sure the session is structured the way the user asked — two runs,
a real stop, then two more only on request — while every individual run
still gets exactly the explicit, separate go-ahead rule 11 has required since
2026-08-20 and has never once stopped requiring for any run since.
