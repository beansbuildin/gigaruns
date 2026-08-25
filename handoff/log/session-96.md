# SESSION 96 — 2026-08-25 — ship the library, delete boonCapture, close gate-1, run the owed batch

Brief: `handoff/next.md`, four items. All four **GATE PASS**.
Commits: `3d32c7b4` (§1–§3, offline), `9c06e3d3` (§4, live batch + re-pins).
Suite **1769 passed / 1769**, 104 files. `tsc --noEmit` clean.

---

## §1 — SHIP THE 11-PATTERN LIBRARY (QUESTIONS.md §36)

The brief asked for a decision to be *recorded*, plus a due-diligence check
**if** session 95's scratchpad backup of the pre-re-mine 3-pattern file
survived. **It survived.** Contents:

```json
{ "patterns": ["perimeterWalk(cw)", "perimeterWalk(ccw)", "bounce(2,0)"],
  "minedAt": "2026-08-20T01:40:10.445Z", "castCount": 89 }
```

That independently confirms session 95's finding that **`bounce(2,0)` was
already promoted** before the re-mine — the session-95 brief had predicted it
as one of the new arrivals.

`scripts/minedLibraryGate.ts` had **never been run old-vs-new for this
library**. Full output:

```
▸ minedLibraryGate — 188 clean traces
  BEFORE (<scratchpad>/minedFishPatterns.3pattern.json): 3 pattern(s) —
    perimeterWalk(cw), perimeterWalk(ccw), bounce(2,0)
  AFTER  (data/minedFishPatterns.json): 11 pattern(s) —
    perimeterWalk(cw), perimeterWalk(ccw), bounce(1,0), bounce(0,1),
    bounce(0,-1), bounce(1,1), bounce(2,0), bounce(-1,0), bounce(-1,1),
    bounce(-1,-1), twoCellCycle(0,-1)

  BEFORE  caught 48/188   hits 302/671   matcher-active turns 292 (median weight 0.164)
  AFTER   caught 51/188   hits 294/632   matcher-active turns 398 (median weight 0.196)

  paired ΔlogLoss (AFTER − BEFORE, negative favours AFTER), 618 turns in 188 casts:
    0.0106  95% cluster-bootstrap CI [-0.0096, 0.0274]

  VERDICT: CI includes zero — the change is not measurably better OR worse on log loss.
  caught: 48 -> 51
```

**How to read it, precisely.** A NO-HARM result. The 4x larger candidate pool
neither sharpens nor degrades the matcher's predictions measurably on 188 clean
traces. `caught 48 → 51` is **3 casts in 188** and is nowhere near the gate's
own noise bar — it may **not** be quoted as an improvement. What the gate *does*
newly show is engagement: active turns **292 → 398 (+36%)** at median weight
**0.164 → 0.196**. More engagement at no log-loss cost is the case for shipping;
it is not proof of gain.

**§0a does not reach this instrument, and that is not a loophole.** §0a suspends
`castSim` by name for this fishery. `minedLibraryGate.ts` runs `replayCorpus`
over real cast traces, and §0a's own text says: *"Session 71 restored the
replay's precondition, not this sim arm. They are different instruments."*
The ΔlogLoss verdict is therefore quotable and the suspension is untouched.
⚠ What remains unquotable: `mineFishPatterns.ts`'s own end-of-run print
(blind 9.2% → mined 59.4%, N=500) — `castSim`-derived, and the only
"evaluation" that had run on this change before today.

---

## §2 — DELETE `boonCapture` (QUESTIONS.md §37)

Six of six capture targets had been modelled by the ordinary shipped rules
(mostly session 58's wide orb rule) without the override firing once, and
`tests/boonCapture.test.ts`'s header said to delete the module once that held.

### ⚠ The brief's wiring list undershot by four call sites

The brief named `liveRun.ts`, `config/bot.json`, the module and its test, with
line numbers "as of `deb120df`, verify against current HEAD". Verifying found
four more, and **two of them are real code, not comments**:

| site | what | brief listed it? |
|---|---|---|
| `src/orchestrator/config.ts` | zod schema entry, `BotConfig.boonCapture` field, `resolve()` passthrough | **no** |
| `scripts/boonPriorityReport.ts` | imports `chooseCaptureBoon` + both defaults; an entire **§2d OVERLAP section** | **no** |
| `tests/boonPriority.test.ts` | imports `DEFAULT_CAPTURE_TARGETS` for the "0 of 5 overlap" corpus test | **no** |
| `src/strategy/boonPriority.ts`, `src/sim/boonRunCoverage.ts` | comment references | **no** |

Recording this as CLAUDE.md rule 9 in its ordinary form: a brief's claim about
what the repo contains is a hypothesis. A `grep` before starting would have
caught it; the brief's own step 5 (grep to verify) is what did.

### The one place I departed from the brief's instruction

The brief said to leave `liveRun.ts`'s `boonPriority` doc comment alone. That
comment's entire content was the contrast — *"**Unlike `boonCapture`, this is
ON by default in live play and needs no gate.** The two are not comparable…"* —
so obeying literally would have left it naming a deleted module, and the brief
also required a clean repo-wide grep. The two instructions conflict.

**Resolved by rewording, not deleting.** The asymmetry it explains is real and
load-bearing: it is *why* the user's boon-selection directive correctly ships
ungated while a quality-costing measurement needed two conditions. Same
treatment for `config/bot.json`'s `_boonPriorityComment`, which opened "NOT A
GATE, unlike `_boonCaptureComment` next door."

**The 1-of-5 overlap MEASUREMENT was deliberately preserved** in
`boonPriority.ts`'s header, with an explicit note not to widen the priority list
to cover the retired targets — that list is the user's play directive, not a
coverage instrument.

### Verification

```
grep -rn "boonCapture\|boon-capture\|BoonCapture" src/ scripts/ tests/ config/
  -> (nothing)
npx tsc --noEmit                            -> clean (one unused BOON_MODELS import removed)
npx vitest run                              -> 1769 passed / 1769, 104 files
npx tsx scripts/boonPriorityReport.ts 200   -> runs; §2d firing-rate arm intact
```

`handoff/log/` and `handoff/DECISIONS.md` still mention the module and were
left exactly as written — historical and append-only.

---

## §3 — THE GATE-1 RE-AUDIT, DEFINED AND CLOSED (QUESTIONS.md §38)

Carried as a bare undefined phrase in five consecutive STATE.md files (87, 91,
92, 93, 95). It already had an answer in session 86 §1; nobody wrote it down as
one. **No new measurement taken.**

Origin, `handoff/log/session-86.md` line 97, verified verbatim:

> **Gate 1 opens a re-audit nobody has done.** Every figure the no-aim arm has
> produced — the deck sweep, the noise floor, its −4.6pp drift margin — was
> measured on a bot that never aims.

The mechanism: `damageEconomy.ts`'s `SIM blind` arm and
`deckObjectiveSweep.ts`'s baseline (`matcherPool: []`) carry no
fish-distribution model, so every candidate cell scores identically —
**0 focus moves in 1963 turns, 0 cells used beyond (2,2)**, at both `w=0` and
`w=3`. ⚠ The condition is **UNIFORM, not blind**: `matcherPool: [] + ringModel`
moves 824 of 2492 turns, so it is the absence of *any* fish model that produces
0/1963, not handicapping.

**All four named figures traced to source and verified against the logs
myself** (rule 9 — I did not take the brief's word):

1. **36.42%** — session 79 §1e, deck sweep baseline, 4000 paired casts, catch
   0.0% on the real 23-card deck. Already SUSPENDED under §0a in session 79's
   own text (confirmed at `session-79.md:45`, `:285`).
2. **1.93pp noise floor** — session 79 §1e, same re-run; only 10 of 80 arms
   clear it (`session-79.md:48`, `:280`).
3. **−4.6pp drift margin** — session 80 §1, re-run session 86 §4. By session 86
   the row label already read `SIM blind (no-aim)` (`session-86.md:219`).
4. **41.06%** — session 78 §4, pre-shuffle baseline. Already RETRACTED by
   session 79 §1 once the per-cast shuffle was confirmed (129 opening hands,
   zero equal to the sequential prediction).

⚠ **One correction to the brief.** It presents four figures as session 86's
list. **Session 86 named three** (deck sweep, noise floor, −4.6pp margin). The
fourth — 41.06% — is same-lineage and worth including, but it was retracted
independently rather than by session 86. §38 says so explicitly.

**Verdict: "not wrong, not applicable."** None misdescribes the harness it was
measured on; all remain legitimate for the deck-composition comparison session
86 §4b says they are good for. What is retired is their use as evidence about
live play. §0a is not lifted and no new quotable number is created.

---

## §4 — THE 10-CAST LIVE BATCH

### Pre-flight (all before spending anything)

- **Rule 13, fresh read:** `checkFishingCaps.ts` → GAME `dayDocs[2]` 0/20, repo
  ledger 0 casts / 0 energy, ledgers agree, 20 available. Nothing carried
  forward from a prior STATE.md.
- **Oil:** `allowedItemIds [937]`, `policyApproved true`, `maxPerCast 3`,
  `perItemMaxPerCast {937: 2}`. Confirmed §1's changes touched nothing here —
  the `config/bot.json` diff was the `boonCapture` removal only.
- **Rod:** ~21 of the user's ~40-cast horizon spent (session 93 §5), ~19 left;
  a 10-cast batch fits with margin. Flagged up front per the brief.
- **`--dry-run` first** (the brief required it, since §1 changed the candidate
  pool): passed every guard, spent nothing.

### Result

10 casts, clean exit on `cast_cap`. **3 caught / 7 escaped.** 43 shots,
**15 hits (34.9%)**. 120 energy against the 252 budget.

| cast | outcome | turns |
|---|---|---|
| 1 | escaped | 2 |
| 2 | escaped | 2 |
| 3 | escaped | 10 |
| 4 | escaped | 8 |
| 5 | **caught** | 5 |
| 6 | escaped | 4 |
| 7 | **caught** | 4 |
| 8 | escaped | 2 |
| 9 | escaped | 5 |
| 10 | **caught** | 1 |

### ⚠ 10 PLAYED, 9 CHARGED — §34's JEBAITOR, second observation

Post-batch `checkFishingCaps.ts`: GAME `dayDocs[2]` = **9**/20, repo ledger
**9** casts / 120 energy, *ledgers agree at 9*. Ten `start_run` POSTs, ten
`cast_over` events, nine charged. This is the **identical shape session 92
recorded** under §34 (`JEBAITOR`, ~6.75% per cast, on the server's own
`start_run` response). Expected, a **gain** not a defect, and per §34 still not
something to plan around — the ledger stays the only authority.

### Matcher-seed observation (what §36 asked this batch to produce)

All ten casts seeded from the 11-pattern library; the seed line printed it in
full every cast. Log event tallies from `logs/fishing-2026-08-25-18-53-45.jsonl`:

```
turns with matcherWeight recorded: 20 of 43   (tier: ring 22, matcher 10, matcher_ring 10, override 1)
  matcher-ACTIVE (weight > 0): 20   median 0.190   min 0.130   max 0.397
  posterior updates: 12 total  ({0: 10, 1: 8, 2: 2})
  on those 20 turns — matcher predicted the actual cell:  2
                      baseline predicted the actual cell: 5
```

**Read this as thin, not as a regression.** n=20 matcher-active turns, pooled
into a 199-cast corpus. The matcher-headroom `actual` rate did not move
(0.375 → 0.373), a second flat batch. Nothing misfired, nothing failed closed.
§36 stands as shipped; this is an observation, not a gate. **If the
matcher-seed question actually matters it needs a pre-registered comparison
over several batches**, not another incidental read folded into a batch report.

### Redraw

`redrawEnabled` **false** throughout. **0 `redraw_sent` events — confirmed
against the log, not assumed**, as the brief asked. Shadow: **0 of 43** card
decisions would have redrawn (in-sample 2.7%), 11 `redraw_suppressed`,
1 `redraw_shadow_no_decision`. The K=6-with-budget row the shadow is fitted on
(`fires 15, rescues 9, sacrifices 0, wasted 4, manaSpent 21`) is **UNCHANGED in
every term for a second consecutive ten-cast batch** — the most stable row in
`redrawCounterfactual.test.ts`.

### Oil

One `oil_double_lethal_fired`: `{turn: 1, wanted: ["relaxing","relaxing"],
fishHp: 4, fishMaxHp: 16, relaxingHeld: 45}` → 2× `use_fishing_item(937)`,
fish 4→2→0, **caught on that turn**. New corpus oil cast `13083731`,
`consumablesUsed 2`, slots `[true, true, false]`.

- **Per-cast Relaxing cap of 2 REACHED and again did NOT BIND** — the policy
  wanted exactly two, never three. Third batch running (91, 92, 96).
- **The other 9 casts spent nothing**, and all nine Focus triggers logged
  `oil_trigger_policy_withdrawn` — **not** `oil_trigger_no_stock`. That is
  session 93's §35 distinction working across a full batch for the first time,
  and it is why those nine casts stayed in the outcome arms instead of being
  flagged OIL-POLICY-DRY and lost.

### ⚠ §2c CLEAN-CAST TRIPWIRE REACHED

```
▸ §2c clean-cast tripwire: 9 clean cast(s) of 10, 2 oil(s) consumed.
  Pre-registered threshold 6 — REACHED. Under the sim's ~0.70 oils/cast this is
  a ~1-in-900 event: report it as evidence the trigger model does not describe
  live play. The batch was NOT extended and NOT cut short.
```

Reported here exactly as the tripwire instructs. This needs a ruling — it is a
pre-registered signal that has now fired.

### Rod

**All 10 casts rod-dealt, no `BASE_DECK` window** (checked via
`traceDealtDeck` over the last ten traces: `{rod: 10}`). The repair holds.
~31 of the ~40-cast horizon now spent. ⚠ That figure is the **user's report
about their own equipment**, not a repo measurement — nothing here can see
durability (§29).

---

## The corpus re-pin — 53 assertions, 7 files

The new casts turned 53 corpus-pinned assertions red. This is the routine
post-batch re-pin, done with the repo's existing provenance convention
(`// [session 96] was N`). **Claims were checked, not blanket-updated.**

Corpus deltas: **189 → 199 casts**, **778 → 821 play turns**, **1091 → 1149
response docs**, **188 → 198 clean traces**, +3 caught / +7 escaped.

### Load-bearing claims that HELD

- `summary.incomplete` still **exactly 1** — the same long-standing truncated
  cast, asserted separately from the counts for exactly this reason.
- `ZONE_OFFSET` still **exceptionless** over 43 further plays it has never seen
  (`mismatches: []`, `correct === scored`) — sixth consecutive clean widening.
- Relaxing lethal numerator still **13 casts over 15 decision points** — the
  **ninth** consecutive batch of denominator-only growth.
- `focusDry` bucket-3 tell (whole meter spent on move one) still **exactly 1** —
  session 92 flagged the first later-era instance as a reappearance; three
  batches on it has not repeated.
- The `previousFishPosition` wrong reading still lands in the misleading band:
  508/820 = **62.0%**, against 61.8% / 62.4% / 62.1% over four widenings.

### ✅ ERA RULING CONFIRMED OUT OF SAMPLE, THIRD TIME

`preOil` `[94, 410, 184]` and `oilSupplied` `[62, 235, 4]` came back
**byte-identical**; **all ten new casts classified `focusDry`** (33 → 43 casts,
132 → 175 plays, 37 → 46 budget-zero). `oilSupplied` has not moved since the
ruling and structurally cannot — it is bounded on both sides by fixed
timestamps. This is §32's consumable-supply boundary holding for a fifth
consecutive batch.

### ⚠ Two claims that MOVED — corrected in place, not restated

**1. `matcherHeadroom`'s miss-spike drift bound was stale.** The comment claimed
the distance-1 share "has not shifted more than 1.4 points". Readings across
five widenings: 48.0 → 48.0 → 48.3 → 49.4 → 49.2 → **49.9%** (243/487). Real
spread **1.9 points, and monotone upward**. The spike is still the finding —
half of all misses land one cell away, across a corpus that has nearly doubled
— but "flat" is no longer an honest description. Corrected in the test's own
comment.

**2. `redrawCounterfactual`'s K≤3 break-even ratio moved AWAY from its bound
for a misleading reason.** 3/63 = 4.76% → 3/68 = **4.41%** against a 5% bound.
But `rescues` (11) and `sacrifices` (8) are **both frozen for a third
consecutive batch** while `fires` grows, so the ratio falls **mechanically**.
Annotated so a future reader does not mistake it for the claim strengthening.
The file's standing instruction — *"When it does [break], do NOT widen the
bound: the honest reading is that near-break-even has stopped being true"* — is
untouched.

### Other notable movements

- Inversion (`coverage <= 3` vs `>= 4` rescue rate) **widened** to its largest
  gap yet: 11/58 = 19.0% against 53/79 = 67.1%. `rescued` held at 11 while dead
  plays grew.
- `focus budget >= 1` rescue rate: 89.5% → 85.4% → **85.7%**. The four-batch
  slide **flattened**; that is one observation, not a floor. The standing "do
  not quote this rate" instruction is unchanged.
- `stateBefore` vs `previousFishPosition` gap narrowed again, 4 plays → 2,
  continuing session 91's trend. Still noise between two wrong readings;
  nothing downstream ranks them.

---

## Dead ends / things deliberately NOT done

- **§27 (ΔEV-per-step) not touched** — it has its own brief at
  `handoff/next-ev-per-step.md` and the session-96 brief explicitly excluded it.
- **No dungeon run** — rule 11 requires a per-run human go-ahead and none was
  given. `orchestrator.ts`'s dungeon arm remains closed.
- **Did not revert the 11-pattern library**, did not re-open §36–§38, did not
  lift §0a, did not touch `PROMOTION_THRESHOLD`.
- **Did not "fix" the flat `actual` rate** or any other falling matcher metric.

---

## Verification

```
npx tsc --noEmit                       -> clean
npx vitest run                         -> 1769 passed / 1769, 104 files
git diff --check                       -> clean
secret scan (0x[a-fA-F0-9]{4,}, noobId, eyJ, PRIVATE) over 3c889754..HEAD -> no hits
committed fixtures hex scan            -> clean (raw/ correctly not committed)
tests/discoveredShipsClean.test.ts     -> 8 passed
npx tsx scripts/checkFishingCaps.ts    -> ledgers agree at 9; 11 casts left this guard-day
```
