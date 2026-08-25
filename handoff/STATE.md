# STATE — session 96 — 2026-08-25 (PT) — code at commit 9c06e3d3

## Status
All four brief items: **GATE PASS.** Suite **1769 passed / 1769, 104 files**.
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean on all four
patterns, `discoveredShipsClean` 8/8, no `raw/` committed.

**The 10-cast live batch RAN** — 10 casts played, 9 charged, clean exit on
`cast_cap`. This was the owed batch, three sessions overdue.

## What works
- **§1 — the 11-pattern library is SHIPPED and RECORDED** (QUESTIONS.md §36).
  The due-diligence cross-check the brief asked for **ran**: session 95's
  scratchpad backup of the 3-pattern file survived, so
  `scripts/minedLibraryGate.ts` was run old-vs-new for the first time on this
  library. **Paired ΔlogLoss 0.0106, 95% CI [-0.0096, 0.0274] — CI includes
  zero.** A NO-HARM result, not a benefit. Matcher-active turns 292 → 398
  (+36%) at a higher median weight. **This instrument is replay, not `castSim`,
  so §0a does not reach it and the verdict is quotable** — §0a's own text draws
  that line.
- **§2 — `boonCapture` is DELETED**, fully unwired (QUESTIONS.md §37).
  Repo-wide grep over `src/ scripts/ tests/ config/` returns nothing.
- **§3 — the gate-1 re-audit is DEFINED and CLOSED** (QUESTIONS.md §38). No new
  measurement; all four named figures verified against the logs myself.
- **§4 — the batch.** 3 caught / 7 escaped, 43 shots, 15 hits (34.9%), 120
  energy against the 252 budget. All 10 rod-dealt, no `BASE_DECK` window.
- **Corpus re-pinned honestly.** 53 assertions across 7 files went red on the
  new casts; each claim was checked rather than blanket-updated.

## What's broken
- ⚠ **`matcherHeadroom`'s miss-spike drift bound was STALE and I corrected it.**
  The comment claimed the distance-1 share "has not shifted more than 1.4
  points". Across five widenings the real spread is **48.0% → 49.9% = 1.9
  points**, and it is **monotone upward**. Still the finding (half of all misses
  land one cell away); no longer fairly describable as flat.
- ⚠ **`redrawCounterfactual`'s K≤3 break-even ratio moved AWAY from its 5%
  bound — 4.76% → 4.41% — for a misleading reason.** `rescues` (11) and
  `sacrifices` (8) are both **frozen for a third consecutive batch** while
  `fires` grows, so the ratio falls mechanically. **Do not read it as the claim
  strengthening.** The file's own instruction ("when it breaks, do NOT widen the
  bound") still stands.
- ⚠ **§2c clean-cast tripwire REACHED: 9 clean casts of 10 against a
  pre-registered threshold of 6.** Under the sim's ~0.70 oils/cast that is a
  ~1-in-900 event. Per the tripwire's own instruction this is **evidence the
  trigger model does not describe live play**. Batch was neither extended nor
  cut short.
- ⚠ **The brief's §2 wiring list UNDERSHOT by four call sites** (rule 9). It
  named `liveRun.ts` / config / module / test. Also present: `src/orchestrator/
  config.ts` (zod schema, `BotConfig` field, `resolve()` line — real code),
  `scripts/boonPriorityReport.ts` (a whole §2d OVERLAP section built on
  `chooseCaptureBoon`), `tests/boonPriority.test.ts` (the 0-of-5 overlap test),
  plus comment references in two `src/` modules.
- Carried, untouched: H2's proc model still blocked on capture (`TASKS.md`
  CAPTURE-1); §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED**;
  §26's shadow evaluation still unstarted; §27 (ΔEV-per-step) has its own brief
  at `handoff/next-ev-per-step.md`, deliberately not done here.
- **"The gate-1 re-audit" is GONE from this list on purpose.** It closed in §38.

## Corrections to SPEC.md
- **None this session.** Ten live casts were played and **nothing in any
  response contradicted the spec**. `SPEC.md` and `SPEC-fishing.md` untouched.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Correction to a repo doc, not the spec:** the brief said to leave
  `liveRun.ts`'s `boonPriority` doc comment alone, but its entire content was a
  contrast with the module being deleted. **Reworded, not deleted** — the
  asymmetry it explains (why the user's play directive correctly ships ungated)
  is real and load-bearing. Same for `config/bot.json`'s
  `_boonPriorityComment`, which opened "NOT A GATE, unlike `_boonCaptureComment`
  next door."

## Dead ends
- **Do not re-open §36, §37 or §38.** All three are user directives executed,
  not proposals. The batch result does not reopen them.
- **Do not "fix" the falling matcher metrics.** `actual` did not move (0.375 →
  0.373) for a second batch; that is ten casts pooled into 199 and resolves
  nothing about the library either way.
- **The 1-of-5 overlap measurement was deliberately KEPT** in
  `boonPriority.ts`'s header when the module around it was deleted. It is why
  the priority list was never widened. **Do not add the old capture targets to
  the priority list** — it is the user's play directive, not a coverage
  instrument.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED; `dendren.dailyEnergyBudget`
  252 STANDING; `castSim` suspended for this fishery.

## Metrics
- **Live: 10 fishing casts, 0 dungeon runs.** 120 energy. 2 Relaxing Oils.
  ⚠ **10 casts PLAYED, 9 CHARGED** — `dayDocs[2]` = 9/20, repo ledger agrees at
  9. §34's JEBAITOR skill, now seen a **second** time (session 92 saw the same
  10-POST/9-charged shape). A gain, not a defect; still not plannable.
- Suite **1792/1792 → 1769/1769.** −23 tests, all `boonCapture`'s.
- Corpus: **189 → 199 casts, 778 → 821 play turns, 1091 → 1149 response docs,
  188 → 198 clean traces.** Transitions 778 → 821.
- **Matcher (the §36 observation):** active on **20 of 43 turns (46.5%)**,
  median weight **0.190**, 12 posterior updates. On those 20 turns the matcher
  predicted the actual cell **2** times against the baseline's **5**. n=20 —
  not evidence of a regression.
- **Redraw: 0 live redraws sent**, confirmed from the log, not assumed.
  `redrawEnabled` false. Shadow 0 of 43 decisions (in-sample 2.7%), 11
  `redraw_suppressed`. The K=6-with-budget row the shadow is fitted on is
  **UNCHANGED in every term for a second consecutive batch**.
- **Oil:** 1 double-lethal firing (fish 4/16, turn 1, caught). Per-cast Relaxing
  cap of 2 REACHED, again did **not** BIND — third batch running. The other 9
  casts logged `oil_trigger_policy_withdrawn`, **not** OIL-POLICY-DRY: §35's
  distinction working across a full batch for the first time.
- **Claims that HELD across the widening:** `incomplete` still exactly 1;
  `ZONE_OFFSET` still exceptionless over 43 further plays (sixth clean
  widening); relaxing lethal numerator still 13 casts / 15 points (ninth
  denominator-only batch); focusDry bucket-3 tell still exactly 1.
- ✅ **ERA RULING CONFIRMED OUT OF SAMPLE A THIRD TIME.** `preOil`
  [94, 410, 184] and `oilSupplied` [62, 235, 4] byte-identical; **all ten new
  casts classified `focusDry`** (33 → 43).
- **Rod:** ~31 of the user's ~40-cast repair horizon spent. **User report, not a
  repo measurement** — nothing here can see durability (§29).

## Open questions for Claude
1. **The rod is the nearest hard stop: ~9 casts of headroom left on the user's
   own ~40 estimate.** A next 10-cast batch would very likely cross it
   mid-batch, and the repo cannot predict the window — only detect it after the
   fact by the dealt deck. Worth asking the user for a fresh durability read
   before the next fishing brief, rather than discovering it live.
2. **The §2c tripwire has now fired.** 9 clean casts of 10 against a threshold
   of 6 is the pre-registered signal that the oil trigger model is wrong about
   live play. It needs a ruling: re-derive the trigger model, or retire the
   tripwire as a broken instrument, or accept the divergence and say so.
3. **The matcher-seed question §36 could not answer offline is still open after
   one batch.** 20 matcher-active turns is far too thin. If the answer matters,
   it needs a pre-registered comparison over several batches, not another
   incidental observation folded into a fishing report.
4. **§27 (ΔEV-per-step) is still unstarted** and has a ready brief at
   `handoff/next-ev-per-step.md`. It needs no live data.
5. **Two long-running claims are drifting monotonically** (the miss-spike
   1.9-point upward drift; the frozen rescues/sacrifices numerators). Both are
   corrected in place this session, neither is broken yet, and both will need a
   decision within a batch or two rather than another re-pin.

## Files changed
```
 3 commits (2 code + this recap). 10 new cast fixtures (43 states).

  A  QUESTIONS.md §36/§37/§38        ship library / delete boonCapture / close gate-1
  D  src/strategy/boonCapture.ts     -246
  D  tests/boonCapture.test.ts       -228
  M  scripts/liveRun.ts              -190  all wiring, flag, gate, summary
  M  tests/liveRun.test.ts           -190  two describe blocks
  M  scripts/boonPriorityReport.ts   -63   the §2d OVERLAP section
  M  src/orchestrator/config.ts      -33   zod schema + field + resolve
  M  src/strategy/boonPriority.ts          overlap measurement KEPT, reworded
  M  tests/boonPriority.test.ts      -28   the 0-of-5 overlap test
  M  src/sim/boonRunCoverage.ts            comment reference
  M  config/bot.json                 -16   boonCapture block + comment
  M  tests/fishing/{castEra,matcherHeadroom,oilReachability,
       redrawCounterfactual,stateFields,zoneTemplate}.test.ts   53 re-pins
  M  tests/sim/fishingCorpus.test.ts       corpus counts + new oil cast
  A  fixtures/fishing-casts/live/cast-2026-08-25-18-5*  10 casts
  M  handoff/reports/{fishing-casts,dungeon-runs}.md    regenerated
```
