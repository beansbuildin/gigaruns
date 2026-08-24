# BRIEF — session 92 — land the §32 ruling (re-specify the era predicate), then run the second live fishing batch (10 casts, this time with `--oil-batch`)

**One era-model correction, then one live batch.** Read §1 fully before
touching anything live — the boundary you land there is what the next 10
traces get classified under the moment anything calls `eraOf()`/`splitByEra()`
on them, and running the batch first would let 10 new casts blend into a
corpus whose era split this brief already knows is wrong.

**Where this came from.** Session 91's STATE.md was walked through with the
user in chat. `QUESTIONS.md` §32 offered three options for the `castEra.test.ts`
degradation; the user was shown all three (plus "leave it open, it isn't
gating anything") and chose **option (b): re-specify the era predicate** —
record that as a choice made among options offered, not spontaneous user
language, the same convention §31 used.

---

## 0. Verification and rule 9

```
npx tsc --noEmit
npx vitest run
```

**Establish the actual current baseline yourself.** Session 91's own STATE.md
(not a paraphrase — its own final recap) reads 2 failed / 1744 passed (1746
total) at commit `b5d59393`. Cite that as the last *known* reading, not this
session's baseline — rule 9 applies to numbers carried forward one session as
much as ten.

**Files actually read this pass, precisely** (so the next reader knows what's
verified versus carried forward): `handoff/STATE.md` (session 91, in full);
`handoff/next.md` (session 91's brief, in full); `QUESTIONS.md` §32 (in full);
`CLAUDE.md` rules 9 and 13 (grepped and read in place); `src/sim/fishing/castEra.ts`'s
docblock and `POLICY_ERA_BOUNDARY`/`eraOf`/`splitByEra` (lines ~1-145); `tests/fishing/castEra.test.ts`
(grepped for every call site of `splitByEra`/`eraOf`/`todaysEraCastIds`, not
read start to finish); `handoff/reports/fishing-casts.md` (in full, 178-cast
report); `data/fishing-oil-cast-states.jsonl` (in full); `config/bot.json`
(grepped: `dendren.oils` = `{allowedItemIds:[942,937], maxPerCast:3,
perItemMaxPerCast:{"937":2}}`); `handoff/log/session-90.md` and `session-91.md`
headers (dates only); `handoff/OIL-POLICY.md` §0a (grepped: +19.40pp still
SUSPENDED, rests on meter-out/catch, not drift); `tests/fishing/redrawShadow.test.ts`
and `src/strategy/fishing/redrawShadow.ts` (grepped, not read in full); the six
raw `logs/fishing-unknown-midcast-2026-08-24-19-1*.json` capture files from
session 91's batch (grepped for any `redraw*` field — **none exist in the raw
HTTP capture**; the redraw-shadow's decision fields — `coverageBelowK`,
`conditionMet`, `budget`, `liveRedrawEnabled` — are computed and accumulated
client-side inside `liveFishing.ts` and never appear in the server payload, so
their absence from the raw logs is not itself informative about whether the
shadow ran).

**Not opened this pass — verify before relying on them:** the full body of
`scripts/liveFishing.ts` (183KB — session 91 grepped `doubleLethalTriggers`,
`redrawShadow`, `COMPLETE_CID`, `--casts=` to specific line numbers; those
citations are repeated below on session 91's authority, not re-verified this
pass; `--oil-batch`'s exact flag name and plumbing were **not** grepped by
session 91 or this brief — confirm before relying on the exact spelling in
§2b); `tests/fishing/redrawCounterfactual.test.ts` and every other test file
besides `castEra.test.ts` that calls `splitByEra`/`eraOf` (this brief found
call sites in `castEra.test.ts` only by grepping that one file — a full-repo
grep for `splitByEra(`, `eraOf(`, and `todaysEraCastIds(` is part of §1's
work, not already done here).

---

## 1. §32 — the ruling, and why it's a bigger edit than a bound bump

**The choice made:** re-specify the `"today"` era predicate at a real policy
boundary, rather than (a) re-pinning the four degrading claims as converging
small-sample estimates, or (c) something else including a standing tracked
series. The user's reasoning, per the options as framed: (a) would require
someone to say out loud that session 89's "single most important thing that
did NOT move" bound was descriptive rather than load-bearing, which
contradicts how session 89 described it; (b) is the honest one, at the cost of
re-baselining every era-conditioned number in the file.

### 1a. What's being reversed

Three straight batches, one direction, four claims, all in `castEra.test.ts`
(table from `QUESTIONS.md` §32, reproduce and recompute, don't hand-copy):

```
  claim                                 s84/86      s89        s91
  budget-zero ratio before/today        ~30x        6.48x      3.92x
  redraw rescue rate, today's era       15/15 100%  26/32 81%  30/42 71%
  wasted values across the sweep        {0}         {0,3,4,5,6} {0,3,6,7,9,10,11,12}
  meanOptimal gap between eras          —           0.0062     0.0250  ⚠ BOUND 0.01
```

The mechanism `QUESTIONS.md` §32 hypothesizes (not yet implemented, and not
yet confirmed): `POLICY_ERA_BOUNDARY` is `"2026-08-21"` (`src/sim/fishing/castEra.ts`
line 71, day precision), drawn to separate a matcher-weighting regime change.
`"today"` has since silently kept absorbing every policy change after that
date rather than closing at the next one — it held 54 casts when these claims
were first pinned and holds 84 now, spanning (per session 91's STATE.md) the
autonomous-oil-spend policy, the double-lethal oil trigger's wiring and first
live firing, and the rod-durability window and repair. **This is the same
pooling problem §31 just ruled on for `damageEconomy.test.ts`, one file over**
— a population being treated as one thing when it's several.

### 1b. The boundary — verify before picking one; there is a real wrinkle here

Two candidate cuts exist in the repo's own history, and neither is a clean
drop-in:

- **The autonomous-oil-spend decision** (session 61, user decision
  2026-08-20). This **predates** the current 2026-08-21 boundary, so it can't
  be the new cut — it's already inside `"before"`.
- **The double-lethal oil trigger.** Wired as code in session 90
  (2026-08-24, zero live spend that session — confirmed by session 90's own
  header). **First exercised live** in session 91's batch, same calendar day,
  casts `13068171` and `13068190`. This is a genuine policy change (a new
  autonomous live action the bot can take), which makes it the more honest
  candidate of the two — but it landed on the **same calendar day** as the
  casts that first exercise it, and `eraOf()` currently truncates to
  **date-only** precision (`at.slice(0, 10) < POLICY_ERA_BOUNDARY`, line 136).
  A day-precision predicate cannot separate "2026-08-24, pre-double-lethal"
  from "2026-08-24, post-double-lethal" — both truncate to the same string.

**This brief does not pick between the resolutions below — that's session
92's judgment call, made with full code context and against actual
`doc.createdAt` values, not the calendar-day summary here:**

1. Move `eraOf` to timestamp (not date) precision for this one boundary, with
   a specific, measured instant — candidate anchors are session 90's landing
   commit and session 91's first double-lethal firing; verify which reading
   the corpus actually needs (i.e., which one correctly separates the
   pre/post populations for the claims in §1a) before picking either.
2. Accept that day precision genuinely can't cut inside a single calendar day,
   and instead treat the double-lethal wiring as the start of a third era
   beginning the next calendar day — which would currently still classify all
   ten of session 91's casts as pre-double-lethal despite two of them
   exercising it live. If you take this path, **say so explicitly** in the
   docblock rather than let that inconsistency sit unremarked; it's exactly
   the kind of thing this whole exercise exists to surface, not bury.

If neither resolves cleanly against the corpus, **option (c) from `QUESTIONS.md`
§32 — splitting the control out as a standing tracked series instead of a
gating bound — is still on the table.** A ruling for (b) is not licence to
force a boundary that doesn't hold up; if it doesn't, open a fresh
`QUESTIONS.md` entry describing the new wrinkle rather than picking one of the
two resolutions above by feel.

### 1c. What to actually change

1. In `src/sim/fishing/castEra.ts`: implement the boundary decided in §1b —
   this may mean updating `POLICY_ERA_BOUNDARY`/`eraOf`/`splitByEra` in place,
   or replacing the binary `Era` type with a small named set of boundaries if
   two eras can no longer honestly describe the corpus. Update the module's
   docblock (currently lines ~1-59) with the same evidentiary rigor it already
   models for the existing boundary — it cites an exact five-cast discrepancy
   for the 2026-08-21 cut; the new boundary needs a citation of the same kind,
   not a paragraph of reasoning alone.
2. Grep the **whole repo** (not just `castEra.test.ts`) for every call site of
   `eraOf(`, `splitByEra(`, and `todaysEraCastIds(`, and recompute — don't
   hand-edit — every era-conditioned number `QUESTIONS.md` §32's table names,
   plus anything else those call sites feed.
3. Rewrite the red `meanOptimal` assertion (and any sibling claim in
   `castEra.test.ts` whose title no longer matches the corrected split) under
   a corrected title and claim — the same discipline session 91 applied to
   `damageEconomy.test.ts`'s three red tests. Don't just adjust the comparator
   or widen the 0.01 bound; widening it is the exact move session 89 and
   session 91 both refused elsewhere, and it's what this brief exists to
   avoid repeating here.
4. Record the ruling: a new dated **"§32 ANSWERED"** heading in `QUESTIONS.md`
   (a new heading below the existing text, not an edit to it — the §29/§30/§31
   convention) stating the user chose option (b) among the three offered, plus
   exactly which boundary was implemented and why. Add the matching entry to
   `handoff/DECISIONS.md`.

---

## 2. The live batch — 10 more casts, with the summary session 91 missed

### 2a. Before starting

- Baseline the suite yourself (§0).
- **Land §1 first.** The batch adds up to 10 new traces the next time anything
  calls `loadCastTraces()`/`eraOf()`. Landing the era fix against the current
  178-trace corpus first means it doesn't depend on data that doesn't exist
  yet, and the batch becomes a clean out-of-sample check — the same reasoning
  session 91 gave for landing its §2 before its own batch.
- **Rule 13.** Read the server's own ledger before assuming budget:
  `dayDocs[pondId 2]` casts remaining, `oilHeld.relaxing`/`oilHeld.focus`
  stock. Session 91 left these at `10/20` for the day and `53` Relaxing / `0`
  Focus — treat as the last known reading, not the current one; re-check.
- **Rod durability.** The user's own report (§29, session 91) put ~40 casts of
  headroom from 2026-08-24, of which session 91's batch already spent 10.
  Nothing in this repo can see durability directly — the account owner is the
  only sensor that exists — so this brief cannot promise the next 10 will be
  real-deck casts. Check afterward (§2c-3); if a `BASE_DECK` cast turns up,
  that's the user's call to interpret, not something to guess at.

### 2b. Run it

```
npx tsx scripts/liveFishing.ts --casts=10 --oil-batch
```

**`--oil-batch` is new versus session 91's command.** Session 91's own
STATE.md found, after the fact, that all four `batchRedrawShadow*`
accumulators and the `redraw_shadow_batch` event live entirely inside
`if (args.oilBatch)`, which `--casts=10` alone never set — so the summary
session 91's brief asked for never actually ran (per-turn records are
unconditional, so nothing was lost, but the batch-level rollup never printed).
**Confirm the flag's exact name and wiring in `liveFishing.ts` before running**
— neither session 91 nor this brief has grepped `--oil-batch` specifically,
only `--casts=`.

`npx tsx` and `git` fail under the command sandbox — run unsandboxed, as every
prior session has noted.

### 2c. After it finishes — three separate reports, not one recap paragraph

1. **The double-lethal trigger, if the band arose again.** Same depth session
   91 gave it: both `use_fishing_item` POSTs, both slots, the `fishHp`
   trajectory, and whether the per-cast Relaxing cap (2, from `config/bot.json`)
   is reached and whether it actually binds this time (session 91: reached
   once, never bound — the policy wanted exactly two, never three). If the
   band never arose, say that plainly; it's a real outcome.
2. **The redraw shadow, now with the batch summary.** Report the raw
   `batchRedrawShadowDecisions`/`Fires`/`Sanity`/`Blind` counts and the
   resulting live fire rate against the in-sample K=6 rate. More importantly,
   check whether session 91's per-turn finding **persists at roughly double
   the sample**: across session 91's 52 decisions, `coverageBelowK` and
   `conditionMet` were never true on the same turn — every low-coverage turn
   had `budget: 0`, and `conditionMet` requires `budget > 0`. That
   anti-correlation, not the 0/52 fire count, is the thing worth re-measuring;
   `redrawShadow.ts`'s own docblock is explicit that a live rate can show
   whether the candidate fires at a similar rate out of sample, not whether it
   would have helped — report at that level of honesty, no more.
3. **Whether any of the 10 new casts were dealt `BASE_DECK`,** using the
   `dealtDeck`/`traceDealtDeck` classification session 91 already built and
   shared on `rodDeck.ts` — no new logic needed. Zero of session 91's 10 were;
   if any of these are, surface it immediately rather than letting it quietly
   join the corpus, since it would mean either the repair didn't fully take or
   the ~40-cast estimate is wrong.

---

## 3. Gate

1. §1: `QUESTIONS.md` carries a new dated §32 ANSWERED entry recording the
   user's choice of option (b) and precisely which boundary was implemented,
   with measured evidence for it in `castEra.ts`'s docblock, in the same style
   as the existing 2026-08-21 boundary's justification. Every era-conditioned
   number named in §1a's table is recomputed on the corrected split, not
   hand-edited. The previously-red `meanOptimal` assertion (and any sibling
   whose claim no longer holds) is rewritten under a corrected title and
   claim. `DECISIONS.md` carries the matching entry.
2. §2: the batch ran to completion with `--oil-batch`, or the recap says
   exactly why it stopped early, verified against the ledger (rule 13). All
   three of §2c's reports are present even when the honest answer is "no, it
   didn't happen this batch" — a null result reported is a met gate; one left
   unmentioned is not.

**What does NOT meet the gate:** widening the 0.01 bound, or hand-picking a
boundary date, without measured evidence of the kind `castEra.ts`'s existing
docblock already models; a boundary fix applied to `castEra.test.ts` alone
while other `splitByEra`/`eraOf` call sites go unchecked; a live batch run
without a ledger check first; a double-lethal or redraw-shadow live result
that happens and goes unreported because the recap only says "batch
completed."

---

## 4. Do not

- **Do not re-open `QUESTIONS.md` §26, §28, §29, §30, or §31.** All are
  closed; nothing here bears on them.
- **Do not touch `redrawEnabled` or `REDRAW_THRESHOLD`.** The shadow stays a
  shadow regardless of anything this batch's summary shows.
- **Do not touch `handoff/reports/session-86-redraw-revisit.md` or
  `session-86-corpus-snapshot.md`.** Still frozen at `CORPUS-2026-08-23A`.
- **Do not extend the batch past 10 casts** to chase a double-lethal or
  redraw-shadow firing. The user set the number; a null result from exactly
  10 casts is the honest result.
- **Do not force a §1b boundary that doesn't hold up against the corpus.** If
  neither resolution in §1b lands cleanly, write a fresh `QUESTIONS.md` entry
  describing the new wrinkle instead of picking one by feel — a ruling for
  option (b) in the abstract is not licence to paper over a concrete
  granularity problem the ruling didn't anticipate.
- **`npx tsx` and `git` fail under the command sandbox. Run unsandboxed.**

---

## Your task (session 92)

1. Determine and document the corrected era boundary (§1b), with measured
   evidence, resolving the same-day granularity wrinkle explicitly rather than
   glossing over it.
2. Update `castEra.ts` (`POLICY_ERA_BOUNDARY`/`eraOf`/`splitByEra`, or an
   expanded era model) and its docblock accordingly.
3. Grep the whole repo for every consumer of the era split; recompute every
   era-conditioned number the corrected boundary affects.
4. Rewrite `castEra.test.ts`'s red assertion(s) under corrected titles and
   claims.
5. Record the §32 ruling in `QUESTIONS.md` (new dated heading) and
   `DECISIONS.md`.
6. Check the server ledger and oil stock, then run
   `npx tsx scripts/liveFishing.ts --casts=10 --oil-batch`.
7. Report: the double-lethal trigger's firing (or its absence) and whether its
   cap bound; the redraw shadow's batch-summary fire rate against the
   in-sample K=6 rate, and whether session 91's coverage/budget
   anti-correlation persists; whether any of the 10 new casts were dealt
   `BASE_DECK`.
8. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit, `assertionCoverage`, `preflight.ts`, secret scan. Report the
   actual final failure count.

**Honest expectation and sequencing.** §1 is the real work this session — the
same weight session 91 gave its `damageEconomy.test.ts` reversal — because a
boundary picked without the same rigor the existing one has would just move
the pooling problem rather than close it. Do it first and get it right. §2's
live batch is mechanical by comparison: nothing new is being built there, only
run and reported on honestly, including the summary session 91's command
accidentally skipped. **If the double-lethal band or a redraw-shadow fire
simply don't arise in these 10 casts, that's a complete and acceptable
result.**
