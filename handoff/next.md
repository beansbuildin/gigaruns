# BRIEF — session 96 — ship the 11-pattern library, retire `boonCapture`, close the gate-1 re-audit, then the owed 10-cast fishing batch

**Where this came from.** After reviewing session 95's offline results (nine
gate items, suite 1792/1792), the user issued five rulings in one message:
ship the 11-pattern matcher library, retire and delete `boonCapture`, make the
10-cast fishing batch the next live brief, define-and-close "the gate-1
re-audit," and split off a separate offline brief for the ΔEV-per-step
distribution work. The first four are this document, in the order that makes
the live batch a clean out-of-sample check on the biggest thing changing
underneath it — the matcher seed. **The ΔEV-per-step brief is deliberately
NOT in this file** — it's `handoff/next-ev-per-step.md`, delivered alongside
this one, so it doesn't compete for this slot with the batch the user asked to
run next.

None of the five rulings are open questions anymore. Don't re-litigate any of
them — the sections below are about executing each correctly, not about
whether to.

---

## 1. Ship the 11-pattern matcher library

**What "ship" means here: nothing to build, a decision to record.**
`data/minedFishPatterns.json` already holds the 11-pattern library —
`scripts/mineFishPatterns.ts` wrote it during session 95's offline re-run and
`scripts/liveFishing.ts` already reads that file to seed the matcher. There is
no separate "activate" step. Shipping is: (a) don't revert it, (b) write the
decision down somewhere other than a STATE.md open question, because that's
what left it undecided across sessions 95→96 in the first place.

- Add **QUESTIONS.md §36** (next unused number — §35 is RELAXING-OIL-ONLY,
  session 93): `## §36 ANSWERED [session 96, user directive 2026-08-25] — SHIP
  THE 11-PATTERN LIBRARY`. Record: the miner re-run went 3→11 patterns
  (`castCount` 89→189), `PROMOTION_THRESHOLD` unchanged at 3, `bounce(2,0)`
  was already promoted before this re-run, `bounce(-2,0)` does not clear the
  threshold at all, eleven primitives do. Quote the user's directive verbatim
  ("Ship the 11-pattern library; it has now passed offline evaluation").
- **Say plainly what evaluation this is and isn't.** The only offline
  comparison that has actually run against this specific change (3-pattern
  library vs. this 11-pattern one) is `mineFishPatterns.ts`'s own
  end-of-run print — blind vs. mined `castSim` catch rate. That number is
  `castSim`-derived and OIL-POLICY.md §0a suspends `castSim` for this fishery
  outright (sim catch ~70–80% against a real ~27.6%), so it may not be quoted
  as evidence the change helps. **`scripts/minedLibraryGate.ts` — the
  purpose-built paired-replay gate for exactly this kind of library change —
  has NOT been run old-vs-new for this library.** Check first whether
  session 95's scratchpad backup of the pre-re-mine 3-pattern
  `minedFishPatterns.json` survived (STATE.md: "A backup of the old file is
  in this session's scratchpad only"). If it did, run
  `npx tsx scripts/minedLibraryGate.ts <backup>.json data/minedFishPatterns.json`
  and record the paired ΔlogLoss verdict in the §36 entry — this is due
  diligence on a shipped decision, not a re-opening of it. If the backup is
  gone, say so in §36 and ship anyway: the user's directive is the decision
  either way, and a missing before-artifact just means that particular
  cross-check isn't available after the fact.
- Note in the same entry that this changed the live matcher seed by more than
  session 95's brief predicted, and that the next live cast (§4 below) is the
  first one to run against it — which is exactly why the batch doubles as an
  observation of it.

## 2. Retire and delete `boonCapture`

**Full wiring, from source to config to tests — leave nothing dangling.**
`tests/boonCapture.test.ts`'s own header says "if it ever stops holding the
module should be deleted rather than left running," and it has stopped
holding: all six of `DEFAULT_CAPTURE_TARGETS`' predecessors have now been
modelled by the ordinary shipped rules (the wide-orb rule, mostly) without the
override ever firing once. The remaining "0-of-540 → 4-of-996" wrinkle from
session 95 is a tie-break artifact (`categorise` scores LATENT boons at the
same floor as truly unmodelled ones), not a live preference — it doesn't
resurrect the premise.

Delete, in this order so nothing is left importing a deleted file mid-step:

1. **`tests/boonCapture.test.ts`** — delete the whole file.
2. **`src/strategy/boonCapture.ts`** — delete the whole file.
3. **`scripts/liveRun.ts`** — remove every piece of the wiring, currently at
   (line numbers as of commit `deb120df`, verify against current HEAD):
   - The `BoonCaptureConfig` import (~line 98).
   - `LiveRunDeps.boonCapture?: { config, captures }` field and its doc
     comment (~613–622) — leave the doc comment on `boonPriority` next to it
     alone, that's a different, unrelated mechanism (it's ON by default and
     isn't gated).
   - `boonCapturedThisRun` state (~941) and its "one target per run" comment.
   - The capture-decision call inside the boon-pick branch (~1666–1683,
     `deps.boonCapture ? chooseCaptureBoon(...) : null` and the precedence
     comment above it).
   - The `boon_capture_pair` fixture-logging block (~1821–1838).
   - `boonCaptureFlag` CLI parsing (~1914) and the `"--boon-capture"` entry in
     the argv allowlist plus its help-text line (~2058, ~2080).
   - The two-condition gate/arming block that builds `captureCfg`/`boonCapture`
     from `config.boonCapture` + the flag, including both error/warning paths
     for a flag-without-config or config-without-flag (~2259–2314).
   - Passing `boonCapture` into `deps` (~2481).
   - The end-of-run summary line reporting capture pairs (~2525–2533).
4. **`config/bot.json`** — remove `forbiddenWoods.boonCapture` (the whole
   block: `enabled`, `_targetsComment`, `targets`, `rooms`) and
   `forbiddenWoods._boonCaptureComment`. Leave `_boonPriorityComment` and
   everything else in `forbiddenWoods` untouched — that's the separate,
   always-on mechanism the deleted comment already took care to distinguish
   itself from.
5. **Verify nothing's left**: `grep -rn "boonCapture\|boon-capture\|BoonCapture" src/ scripts/ tests/ config/` should return nothing. (It will still appear in `handoff/log/session-*.md` and `handoff/DECISIONS.md` — those are historical and append-only; leave them exactly as written.)
6. Run the full suite after deletion, not just a targeted test file —
   `liveRun.ts`'s own test file may reference the removed
   `LiveRunDeps.boonCapture` field in a fixture object even where it doesn't
   test the feature directly.
7. Add **QUESTIONS.md §37**: `## §37 ANSWERED [session 96, user directive
   2026-08-25] — RETIRE AND DELETE boonCapture`. State the reason (six-for-six
   modelled by ordinary play, the module's own test said to delete it once
   that happened) and point to this deletion rather than re-deriving the
   history — `src/strategy/boonCapture.ts`'s own header and
   `config/bot.json`'s `_boonCaptureComment` already carry the full "why," and
   both are gone after step 4, so quote the load-bearing parts into the
   QUESTIONS.md entry rather than leaving the reasoning only in a deleted
   file's git history.

## 3. Define and close "the gate-1 re-audit"

**It already has an answer. Nobody wrote it down as one.** Session 86 §1
diagnosed this fully; every STATE.md since has carried "the gate-1 re-audit"
forward as an undefined phrase instead of pointing at that diagnosis. This
section is bookkeeping, not new investigation — there is no live spend and no
new measurement required.

**The definition**, from `handoff/log/session-86.md` line 97 (the phrase's
origin) and DECISIONS.md's session-86 §1/GATE-1 entry: session 86 found that
`damageEconomy.ts`'s `SIM blind` arm and `deckObjectiveSweep.ts`'s baseline
arm (`matcherPool: []`) **structurally never aim** — 0 focus moves in 1963
turns, 0 cells used beyond the start cell — because they carry no
fish-distribution model at all, so every candidate cell scores identically
and there is nothing for `bestFocusForCard` to prefer. This is **not a bug**
and it is **not "blind" in the sense of "handicapped"** — the arm's EV surface
is uniform, not degraded. Session 86 §1 was explicit that this opens "a
re-audit nobody has done": every figure either of those two arms has ever
produced describes an arm that cannot aim by construction, not a fishery
anyone plays, and needed to be checked rather than assumed retracted.

**The four named figures, traced to source, and why each is already
superseded or suspended — none of this needs re-measuring:**

1. **The deck sweep's 36.42%** — `deckObjectiveSweep.ts`'s baseline
   (`matcherPool: []`), re-run in session 79 §1e on the shuffled draw pile:
   4000 paired casts, baseline hit 36.42% (catch 0.0% on the real 23-card
   deck). This is the no-aim arm by construction (§4b's table: BLIND
   `matcherPool: []` moves 0 of 1963 turns at both `w=0` and `w=3`). **Already
   SUSPENDED**: session 79 §1e's own text marks it suspended under
   OIL-POLICY.md §0a.
2. **Session 78's 41.06%** — the pre-shuffle-fix baseline from the same
   lineage (session 78 §4, "All 80 appended candidates measured
   byte-identical to the baseline (hit 41.06%)"), measured before the server's
   real shuffle behavior was discovered. **Already RETRACTED**: session 79 §1
   retracted session 78's "deck ORDER is load-bearing" finding outright once
   the shuffle was confirmed, and the same baseline arm was re-measured as
   item 1 above. 41.06% is superseded by its own re-run, which is itself the
   no-aim arm.
3. **The noise floor** — session 79 §1e, same re-run: "two arms that are the
   SAME deck differ by 1.93pp at 4000 casts, so only 10 of 80 arms clear their
   own noise." Measured on `deckObjectiveSweep.ts`'s no-aim arm, same as items
   1–2. Not wrong as a noise-floor measurement of that harness — wrong to cite
   as a noise floor for anything a real fishery does, since the arm producing
   it never aims.
4. **The −4.6pp drift margin** — `damageEconomy.ts`'s comparison table
   (session 80 §1, re-run and re-printed session 86 §4): the "SIM blind
   (no-aim)" row, margin −4.6pp against LIVE's −0.7pp, drift +0.317. Named as
   "no-aim" in the table's own row label by the time session 86 re-ran it —
   the table itself already carries the caveat this closure is formalizing.

**Why all four survive as "not wrong, not applicable" rather than "wrong":**
none of them misdescribes the harness they were measured on. `SIM blind` and
`deckObjectiveSweep.ts`'s baseline are legitimate for what session 86 §4b
calls the one thing they're good for — a deck-composition comparison, where
uniform-EV aiming is a fair way to isolate the deck variable. They are not,
and were never validly cited as, a description of catch rate, hit rate, or
margin for a fishery a real (aiming) policy plays. That distinction is the
entire finding; this closure doesn't change any of the four numbers, it
retires their use as evidence about live play.

**Close it:**

- Add **QUESTIONS.md §38**: `## §38 ANSWERED [session 96, user directive
  2026-08-25] — THE GATE-1 RE-AUDIT IS DEFINED, ITS FOUR NAMED FIGURES ARE
  ALREADY SUPERSEDED OR SUSPENDED, AND IT IS CLOSED`. Use the definition and
  the four-figure breakdown above (cite session 86 §1/§4b, session 78 §4,
  session 79 §1/§1e, session 80 §1 by name and section, the way OIL-POLICY.md
  §0a cites its own sources). State explicitly: **no new measurement was
  taken to close this** — session 86 already did the work, this entry is the
  first time it was written where a future STATE.md can find it instead of
  re-carrying the phrase.
- **Stop carrying "the gate-1 re-audit" as an open item in STATE.md.** This
  session's own STATE.md should not list it under "What's broken" or "Open
  questions" — it closes with this brief, full stop, the same way §19 and §23
  got closing pointers in session 95 rather than staying open by inertia.

---

## 4. The 10-cast live fishing batch — now three sessions overdue

Standard cadence, same shape as sessions 92/93's fishing briefs — with one
addition: **this is the first live batch to run against the 11-pattern
library**, which §1 above just shipped, so this batch is simultaneously the
owed volume and the first out-of-sample read on the new matcher seed.

### 4a. Before starting

- **Rule 13.** Check today's fishing ledger fresh — cast count against the
  daily cap, `dendren.dailyEnergyBudget` (252) against today's actual spend.
  Don't carry forward any number from a prior STATE.md; today's cap window
  and any spend from §1–§3's work (there should be none — everything above is
  offline) reset independently.
- **Oil.** `dendren.oils.allowedItemIds` is `[937]` (relaxing only, session
  93 landing) — confirm stock covers at least 10 casts' worth of triggers
  before starting, and confirm nothing in §1's changes touched oil policy
  (it shouldn't have; the matcher and the oil policy are unrelated systems,
  but rule 9 says verify, don't assume).
- **Rod.** Shroom Rod durability — check the current count against the
  ~40-cast repair cycle. If it's due to run out mid-batch, say so up front
  rather than discovering it mid-cast.
- **`--dry-run` first** if anything about the matcher, oil trigger, or redraw
  logic has changed since the last live cast — and §1 just changed the
  matcher's candidate pool, which is exactly the kind of change this habit
  exists for.

### 4b. Run it

`npx tsx scripts/liveFishing.ts --casts=10 --oil-batch`

### 4c. Report, with the new-matcher observation folded in specifically

Alongside the standard per-batch report (catches, hit rate, oil triggers,
double-lethal firings, rod durability spent):

- **Redraw-shadow tally.** `redrawEnabled` stays `false` — this doesn't
  change that — but keep logging what the shadow candidate would have done,
  same as every batch since it was added. State explicitly whether this
  batch used a redraw in the actual live path (it shouldn't have; confirm
  rather than assume, the way session 92's brief asked).
- **Matcher-seed observation.** Report how often the 11-pattern library's
  candidates were actually matched against during this batch (vs. the
  3-pattern library's prior behavior) — `liveFishing.ts` should already be
  logging matcher weight/activity per turn; surface it in the report rather
  than only in raw logs, since this is the "somebody needs to look at this"
  item STATE.md flagged. This is an observation, not a gate — nothing here
  blocks the batch from running or completing.
- **Double-lethal and oil-trigger behavior**, same depth as sessions 92/93.

### 4d. After

- Full suite, `tsc --noEmit`, `git diff --check`, secret scan — same as any
  other session's recap.
- Update the fishing corpus counts (casts, transitions) in STATE.md's Metrics
  section, same convention as every prior fishing session.
- **Do not use this batch to re-litigate §36–§38 above** — they're closed by
  the time this section runs, and a batch result (good or bad) doesn't reopen
  a shipping/deletion/closure decision that already has a directive behind
  it. If the batch surfaces something genuinely new about the matcher
  (regression, a candidate misfiring), that's a fresh open question for
  QUESTIONS.md, not grounds to revert §36.

---

## Do not

- **Do not re-ask whether to ship the 11-pattern library, delete
  `boonCapture`, or close the gate-1 re-audit.** All three are directives, not
  open questions — this brief is about executing them correctly, including
  the due-diligence step in §1 (running `minedLibraryGate.ts` if the backup
  survives) and the deletion completeness check in §2, neither of which is a
  reason to pause and ask again.
- **Do not touch `castSim`-suspended figures as evidence for anything.**
  OIL-POLICY.md §0a stays in force; the gate-1 closure in §3 explains why four
  more figures join the "measured, not quotable as live evidence" pile — it
  doesn't lift §0a or create a new quotable number.
- **Do not fold the ΔEV-per-step work into this session.** It's
  `handoff/next-ev-per-step.md`, a separate document for a separate future
  session — this batch and the housekeeping above are already a full session.
- **Do not let §1's due-diligence check on `minedLibraryGate.ts` block the
  fishing batch.** If the old-library backup is gone, note it and move on;
  the shipping decision doesn't wait on a cross-check that may not be
  recoverable.
- **Do not carry any of §1–§3 forward into another STATE.md as open.** That's
  the exact failure mode §3 just closed out for the gate-1 phrase — writing
  a decision down once, completely, is what stops it from becoming a
  standing undefined obligation.

---

## Your task (session 96)

1. Record and due-diligence-check the 11-pattern library shipping decision
   (§1) — QUESTIONS.md §36, `minedLibraryGate.ts` if the backup survives.
2. Delete `boonCapture` completely — file, test, config block, all of
   `liveRun.ts`'s wiring (§2) — verify with a repo-wide grep, then run the
   full suite. QUESTIONS.md §37.
3. Define and close the gate-1 re-audit (§3) — QUESTIONS.md §38, no new
   measurement, and stop carrying the phrase in STATE.md.
4. Run the owed 10-cast live fishing batch (§4) — first live read on the
   11-pattern library, standard rule-13/oil/rod checks before, redraw-shadow
   and matcher-activity reporting after.
5. Normal recap: suite, `tsc --noEmit`, `git diff --check`, secret scan,
   updated fishing corpus counts.
