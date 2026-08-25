# BRIEF — session 95 — offline backlog sweep: zero live spend, no fishing casts, no dungeon runs

**Every item below is chosen specifically because it needs no new live data.**
Read-only GETs against already-captured logs/fixtures/corpus are fine and are
exactly what several of these need (the energy probe from session 94's four
runs, the boon pairs from session 94's run 4, the existing fishing corpus for
the matcher questions). Nothing here should ever reach `start_run`,
`use_fishing_item`, a cast POST, or any other action that spends a resource.

**Where this came from.** Session 94's STATE.md was walked through in chat,
which surfaced its own six open items. Cross-referencing those against
`QUESTIONS.md` turned up more: several sections still headed **"OPEN"**
(§19, §23) are actually **closed** in `handoff/DECISIONS.md` (sessions 65 and
87) — the headers were never updated. Two more genuinely open sections (§20,
§27) turned out to be offline-doable and are folded in. One item (the boon
pairs) needed a ruling from the user on modelling policy, obtained in chat —
recorded as §A below.

---

## 0. Ground rule for this whole session

**No live spend of any kind.** If working any item below turns out to
actually require a new cast or dungeon run rather than reading what's already
on disk, stop and say so rather than running it — that would defeat the
reason this session exists. `--dry-run` reads and report scripts are fine;
anything that would POST an action that spends a resource is not.

---

## A. Model the three first-ever boon pairs from session 94's run 4 — user directive: model now, don't wait

**The choice made, in chat:** model `AddWeakMagic`, `VulnerableCrit`, and
`Regen` now from their single observed pair each, rather than waiting for a
second pickup to confirm. The user chose this over the more cautious default
(leave them red until a second observation) — record it that way in
`DECISIONS.md`: a deliberate choice against the safer option, not an
oversight.

### A0. Verified this pass — corrects the STATE.md framing, doesn't change the directive

Session 94's STATE.md describes this as "deriving each effect from its
before/after pair." **Checked directly against the fixtures this pass:** all
three pairs show **zero change to any `players[0]` field** —

```
  AddWeakMagic   run-2026-08-25-03-30-48  state-009 → state-010   selectedVal1=2
  VulnerableCrit run-2026-08-25-03-30-48  state-055 → state-056   selectedVal1=1
  Regen          run-2026-08-25-03-30-48  state-105 → state-106   selectedVal1=1
```

only `pickedBoons` grows by one entry each time; `hp`, `armor`, `hpMax`,
`armorMax`, and every `rolled` stat are byte-identical before and after in
all three pairs. **This is not a gap in what to derive — it's the answer.**

`src/sim/boons.ts` already has a well-precedented category for exactly this
shape: **`{ kind: "latent" }`**, currently used by 24 entries including
`AddBurnSword`, `CorrosiveShield`, and `CorrosiveMagic` — each documented as
"a zero delta is a RESULT here, not a gap: the pair proves the pickup changes
no stat," with the actual mechanism (almost always a status effect armed for
later combat) left **unconfirmed and never inferred from the name** (an
explicit rule since `UpgradePaper` guessed wrong in session 43, and DECISIONS
2026-08-15 made it standing). `AddBurnSword`'s own entry is the template:

```ts
AddBurnSword: {
  effect: { kind: "latent" },
  contaminates: ["STATUS_EFFECT"],
  evidence: "run-2026-08-14-01-00-08 state-038→state-039",
  observed: "selectedVal1 3 → no change to any player field",
},
```

### A1. What to actually do

1. Add three `BOON_MODELS` entries in `src/sim/boons.ts`, each
   `effect: { kind: "latent" }`, following the `AddBurnSword`/`CorrosiveShield`/
   `CorrosiveMagic` shape exactly: `evidence` citing the exact run/state pair
   above, `observed` stating the selectedVal1 and "no change to any player
   field" (verify this claim yourself against the fixture rather than trust
   this brief's transcription — rule 9).
2. **`contaminates`**: the three existing `latent` boons that arm a status
   effect all use `["STATUS_EFFECT"]`. Check `Reason` (`src/sim/coverage.ts`)
   for whether that's still the right category for these three specifically,
   or whether one of them fits a different existing `Reason` better — don't
   default to `STATUS_EFFECT` by pattern-matching alone.
3. **Do not guess the mechanism from the name for any of the three, including
   `Regen`.** "Regen" strongly suggests a per-turn heal-over-time effect, but
   Task 4.5's rule ("a boon is modelled ONLY if the corpus contains a state
   pair bracketing its pickup — nothing inferred from the option text")
   applies exactly here: this repo's boon model only covers the pickup
   instant, and a per-turn tick — if `Regen` even has one — would need its
   own multi-turn observation and possibly a new `BoonEffect` kind this repo
   doesn't have yet. That's out of scope for this brief. Model `Regen` as
   `latent` like the other two, and note in its entry's comment (matching
   `CorrosiveShield`'s own phrasing) that a per-turn effect, if real, is
   unconfirmed and would need separate future capture — don't silently close
   that question by shipping a confident-looking model.
4. Update `tests/boons.test.ts` — the three `"has a pair but no model"`
   failures and the aggregate `"covers every boon type the corpus has a pair
   for"` failure should go green from this alone; confirm they do rather than
   assume it.
5. Record in `DECISIONS.md`: the user's choice to model from n=1 against the
   more cautious default, and that all three landed as `latent` because the
   evidence — not a judgment call — put them there.

---

## B. `OBSERVED_OFFERS` — verify additivity, then regenerate

**+22 offers this session** (227 in the table, 249 in the corpus). Session
93's precedent is the check to re-run **before** touching the table: confirm
every row in the corpus not in the table (should be the full +22, and only
in that direction) and **zero** rows in the table absent from the corpus. If
that holds, regenerate `OBSERVED_OFFERS` from the current corpus and confirm
`Math.max(...OBSERVED_OFFERS.map(o => o.room))`'s pin is still accurate.
**Do not skip the additivity check to save time** — session 93 established
why it matters and it's cheap.

Note: three of the six suite failures need §A regardless, so this table's
regeneration was correctly deferred until now — don't regenerate it before
§A lands, since a boon-modelling change could plausibly touch adjacent
fixtures the table reads.

---

## C. Two cheap instrument fixes — wrong text and counts on correct enforcement

### C1. `boonRunCoverage.ts`'s `firstEverCandidates` undercounts by one

Run 4's stdout reported **2** unmodelled first-ever candidates;
`tests/boons.test.ts` found **3**. `src/sim/boonRunCoverage.ts`'s
`summarizeBoonRunCoverage()` (line ~63) is pure — it only sees the `picked`
array it's handed. **The bug is very likely in whatever builds that array at
the call site in `liveRun.ts`**, not in this pure function itself — find where
`summarizeBoonRunCoverage` is actually called for a live run and check
whether it's missing one of the three picks (`AddWeakMagic`, `VulnerableCrit`,
or `Regen`). Session 94's own STATE.md flags this as "exactly session 93's
open-question-3 class" — an end-of-run reader unchecked against a shape the
current policy produces — so the missing pick is a good candidate for
happening at the run's LAST room specifically (the same closing-turn/closing-
room blind spot pattern that hit `oilsConsumed` in §33). Verify which of the
three is missing and why before fixing, then add a regression test so a
future run can't silently drop one again.

### C2. The energy-drift warning names the wrong cause

`src/orchestrator/energyAccounting.ts`'s `describeEnergyAccounting()` prints
something to the effect of *"possible external balance change (e.g. a ROM
claim) landed mid-run"* whenever `observedDelta` differs from
`committedDelta`. It fired on all four of session 94's runs (observed 59 vs
committed 60, every time) and **no ROM claim happened during any of them** —
between-run readings show energy rising unaided between runs (passive regen,
~18/hr ≈ 0.3/min over a ~6-minute run), which is consistent with the drift
without needing an external event. **§23 already resolved a closely related
case** (`DECISIONS.md`, 2026-08-23, session 87 §3): a `tightDelta -60` probe
on run `25035508` found the charge is exactly 60 and "the standing −1 is
credited back DURING the run… regen at 18/hr against an integer pool is the
LEADING CANDIDATE, NOT asserted." **Match that hedge exactly** — rewrite the
warning to name in-run passive regen as the leading candidate for the
observed-vs-committed gap, not a certainty, and drop the "external balance
change / ROM claim" framing, which session 94 confirmed didn't happen. Don't
fix the underlying drift (§23 already said not to — the guard enforces off
committed spend, so it's conservative and safe); only the diagnostic text is
wrong.

---

## D. `config/bot.json`'s `_boonCaptureComment` is a stale forecast

It prices `boonCapture` at "~27 runs to model all five" targets, from session
55's measurement that `pickBoon` top-ranks an unmodelled type 0 of 540 times.
That measurement predates the **wide orb rule** (session 58+), which
session 94 itself demonstrated picks unmodelled types for free — a THIRD
occurrence today (`Regen`, room 7, taken over ranked `AddBlock` purely
because of its orb payout). Update the comment to note the wide-orb-rule
finding and that the "~27 runs" forecast is stale as a current estimate,
without erasing what session 55 actually measured (it's still correct about
session 55; it's wrong as a forecast today). This is a comment-only change —
`boonCapture.enabled` stays `false`.

---

## E. `scripts/claimRoms.ts` — add real flag handling, fail closed on unknown flags

**Read the file — it currently has *no* CLI argument parsing of any kind.**
`main()` runs the same unconditional claim sequence every time; passing
`--dry-run` (as session 94 did, expecting a preview) does nothing to prevent
it — the four ROM claims and the +159 energy still happened for real. This
is a fail-closed violation (CLAUDE.md rule 5): an unrecognized flag should
error, not be silently ignored.

1. Add argument parsing (`process.argv`) with an actual `--dry-run` mode that
   logs the planned claims and the `getEnergy` before-read, without calling
   `client.claimRomEnergy`.
2. Reject any other unrecognized flag with a non-zero exit and a clear error
   naming the bad flag — don't just ignore it.
3. Add a regression test (mirroring how `tests/cliArgs.test.ts` or
   `scripts/claimAllRoms.ts`'s own arg handling, if it has any, is tested)
   so a future unknown flag fails loudly rather than being silently accepted
   again.

---

## F. Two unpaid redraw correctness gaps — offline hardening of code that never fires live

**`QUESTIONS.md` §28 ANSWERED names both explicitly as "both fixable
offline, neither fixed."** Redraw stays `redrawEnabled: false` regardless —
**do not touch that flag or `REDRAW_THRESHOLD`.** This is about the
correctness of code that would matter if redraw is ever turned on, not about
turning it on.

1. **`liveFishing.ts:2471`** — a redraw firing `FISH_MOVED` isn't observed by
   the branch that should see it, leaving a hole in the matcher's history.
   `QUESTIONS.md` describes this as "a choice between two unmeasured
   semantics, not a repair" — read the surrounding code, articulate the two
   candidate semantics concretely (this brief cannot, without having read the
   full function), and if neither is obviously correct, write a new
   `QUESTIONS.md` entry naming both rather than picking one by feel.
2. **`liveFishing.ts:1526`** — `MAX_REDRAWS_PER_CAST = 5` currently aborts
   the cast via a fail-closed `GuardTrip` rather than falling through to an
   ordinary play. Design a real per-cast redraw budget with a fall-through,
   consistent with how other per-cast caps in this repo behave (e.g. the
   Relaxing Oil per-cast cap, which stops trying rather than aborting the
   whole cast) — but confirm that comparison actually holds before leaning on
   it, don't assume.
3. Add regression tests for both. Since redraw never fires live, these tests
   necessarily exercise the code path directly rather than through a real
   cast — say so in the test's docblock so a future reader doesn't mistake
   unit coverage for live validation.

---

## G. §27 / "the pacing term's cause" — the narrower sim-vs-live question, offline

These are the same open thread under two names. Session 84 decomposed the
44.9%→1.5% focus-budget collapse into three terms and could not name the
cause of the **focus-pacing term** (−18.2pp) — `DECISIONS.md`, 2026-08-23,
explicitly: "the CAUSE is not [identified], and rule 6 says say so." Session
85 found the direct hypothesis (replaying sessions 61/62's commits) doesn't
work — the corpus can't date the change precisely enough, and the one
focus-related constant in the live path didn't move in that window — but
also found gate 2's simulator at the shipped weight (`w=3`) lands **0.004
outside** today's era's opening-spend interval, against **0.207 outside** at
`w=0`. §27's recommendation, never acted on: ask **"what makes live's
EFFECTIVE focus-reserve behaviour differ from the sim's at the same nominal
weight"** instead of replaying whole policies — a much smaller search.

This is pure sim/corpus analysis — no live data needed beyond what's already
captured. Worth a bounded time-box rather than an open-ended search; if
nothing surfaces, say so plainly and leave §27 as a still-open recommendation
rather than forcing a conclusion.

---

## H. §20 — re-mine `data/mined-patterns.json` (optional, lower priority)

**No longer gates anything** — §19 closed as a POWERED KEEP at session 65
and was reaffirmed at session 87, independent of this. Still a real, cheap,
long-deferred item: re-mining at the current (189-cast, up from 88) corpus
promotes `bounce(2,0)`/`bounce(-2,0)` alongside the two `perimeterWalk`
patterns already live, raising support from 11/88 to more (recompute against
the current corpus size, don't reuse the old fraction). `scripts/mineFishPatterns.ts`
owns this decision per its own docblock. If time allows after A–G, run it;
if not, it's fine to leave for a future brief — say so rather than rushing it.

---

## I. Documentation hygiene: two stale "OPEN" headers in `QUESTIONS.md`

Found while compiling this brief, worth a few minutes: **§19** and **§23**
are both closed (§19: `DECISIONS.md` 2026-08-23 session 87 §2, "KEEP, one
turn short of powered," confirming session 65's original close; §23:
`DECISIONS.md` 2026-08-23 session 87 §3, "the 3x multiplier is EXONERATED"),
but their `QUESTIONS.md` section headers still read `[... OPEN ...]`. Add a
brief closing pointer to each (in the same append-only style as other
`ANSWERED` headings — don't rewrite the original text) so a future backlog
sweep doesn't have to re-derive their status from `DECISIONS.md` the way this
one did.

---

## What's explicitly excluded from this brief, and why

- **The 10-cast fishing batch** (owed since session 92) — needs live casts.
  Separate future brief.
- **H2's proc-branch model** — blocked on capture (`TASKS.md` CAPTURE-1): the
  proc rates for evasion/block/lck/tenacity/intuition don't exist in any
  captured data yet, and inventing them was explicitly refused in session 78
  ("converts an honest 'unscorable' into a confident wrong number"). Not
  offline-doable until new live dungeon data captures those procs.
- **"The gate-1 re-audit"** — carried across several STATE.md's as a phrase
  with no definition this pass could locate in `QUESTIONS.md`, `DECISIONS.md`,
  or `TASKS.md`. Before deciding whether it's offline-doable, the next
  session should locate what it actually refers to (likely an older session
  log or a git-history search this pass didn't do) rather than either
  guessing at it or continuing to carry it forward undefined.

---

## Gate

1. §A: three new `BOON_MODELS` entries, evidence-cited and verified against
   the actual fixtures (not copied from this brief); `boons.test.ts`'s four
   related failures go green; the n=1 modelling choice is recorded in
   `DECISIONS.md` as the user's directive.
2. §B: additivity verified before regeneration; `OBSERVED_OFFERS` regenerated
   and its room-max pin confirmed accurate.
3. §C: both instrument fixes land with corrected text/logic and a regression
   test each; neither touches the underlying enforcement it was diagnosing.
4. §D: `_boonCaptureComment` updated, `boonCapture.enabled` untouched.
5. §E: `claimRoms.ts` has real flag parsing, a working `--dry-run`, and
   rejects unknown flags; a regression test pins it.
6. §F: both redraw correctness gaps addressed or explicitly deferred to a new
   `QUESTIONS.md` entry with concrete named options; `redrawEnabled`/
   `REDRAW_THRESHOLD` untouched either way.
7. §G: a time-boxed attempt at the narrower focus-reserve question, reported
   honestly whether or not it lands on an answer.
8. §I: both stale headers get a closing pointer.
9. Suite, `tsc --noEmit`, `git diff --check`, secret scan all run clean at
   the end — this session has no reason to leave anything red that §A–§E
   can close.

**What does NOT meet the gate:** guessing at `Regen`'s or any other latent
boon's mechanism from its name; skipping the `OBSERVED_OFFERS` additivity
check; fixing the energy-drift warning's text by asserting regen as certain
rather than a leading candidate; touching `redrawEnabled`/`REDRAW_THRESHOLD`
under any framing; spending any live resource for any reason, including "just
to verify."

## Do not

- **Do not run any live cast or dungeon run.** This is the one hard rule for
  the whole session.
- **Do not touch `redrawEnabled` or `REDRAW_THRESHOLD`.**
- **Do not infer a boon's effect from its name.** Established since
  `UpgradePaper` guessed wrong in session 43; DECISIONS 2026-08-15 made it
  standing.
- **Do not re-open `QUESTIONS.md` §19, §23, §26, §28, §29, §30, §31, §32, or
  §33.** All closed; §I only adds a pointer, not a reopening.
- **Do not regenerate `OBSERVED_OFFERS` before §A lands** or before
  additivity is verified.

## Your task (session 95)

1. §A: model the three boon pairs as `latent`, verified against fixtures.
2. §B: verify `OBSERVED_OFFERS` additivity, then regenerate.
3. §C: fix `boonRunCoverage`'s undercount and the energy-drift warning's
   wrong cause, each with a regression test.
4. §D: update `_boonCaptureComment`.
5. §E: add real flag handling to `claimRoms.ts`.
6. §F: address or formally defer the two redraw correctness gaps.
7. §G: time-boxed attempt at the focus-reserve question; report honestly.
8. §H: re-mine `mined-patterns.json` if time remains.
9. §I: close the two stale headers.
10. Recap normally: full suite, `tsc --noEmit`, `git diff --check`,
    `assertionCoverage`, `preflight.ts`, secret scan. Report the actual final
    count — this session has no live-spend excuse for leaving anything red.
