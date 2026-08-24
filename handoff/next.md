# BRIEF — session 89 — the user's rulings on the red suite, 3 boon-pair captures, and a new (unshipped) oil trigger

**No live spend this session, by design.** Everything below is code, tests,
and documentation — record the user's rulings, close what can legitimately be
closed, and derive-but-don't-ship the new oil trigger, per rule 4.

**Where the rulings below came from.** The user was walked through session
88's STATE.md "What's broken" section and asked, item by item, what should
happen to it. Four answers came back and are recorded verbatim in each
section below. Two things did **not** come up and are **not** in scope: §26's
shadow evaluation (now unblocked by §28's answer, but a big enough piece of
work that it belongs in its own brief rather than bolted onto this one — see
§7's honest expectation), and anything about `policyApproved` or a live oil
call site.

---

## 0. Verification and rule 9

```
npx tsc --noEmit                     expect clean
npx vitest run                       baseline 99 files / 72 failed / 1618 passed / 1 skipped (1691)
```

Expect the failure count to drop across this session as §§1-5 land — **verify
the real number after each piece, don't assume an arithmetic total.**

**Rule 9 applies to this whole brief.** I have read `handoff/STATE.md`
(session 88), `QUESTIONS.md` §26 and §28 in full, the DECISIONS.md entries
covering the boon-pair captures (sessions 82, 87, 88), `src/sim/boons.ts` in
full, `src/strategy/fishing/oilTiming.ts` and `oilPolicy.ts` in full,
`handoff/OIL-POLICY.md`, `handoff/OIL-CONSERVE.md`, `config/bot.json`'s
`dendren.oils` block, `handoff/reports/session-86-redraw-revisit.md`,
`tests/fishing/castEra.test.ts`, `tests/fishing/rodDeck.test.ts`, and
`SPEC-fishing.md`'s `FISH_HP_DIFF` row and its surrounding section. **I have
NOT opened** `tests/boons.test.ts`, `tests/fishing/stateFields.test.ts` (only
referenced by what `SPEC-fishing.md` says about it), `scripts/oilConserveSweep.ts`,
`scripts/oilTimingSweep.ts`, `scripts/liveFishing.ts`'s oil call site, or
`src/sim/fishing/castEra.ts` (the module `castEra.test.ts` actually tests).
Every claim below about what any of these do or contain is inferred from
what surrounds them, not read directly — open them before acting on a claim
that turns out to matter.

---

## 1. §28 — record the user's ruling

**The user's answer: accept the re-pricing.** Quoted in full: *"Accept the
re-pricing — keep redraw closed, but retire '43.9 mana per extra fish' as the
stated reason and restate it as 'no validated trigger + two unpaid
correctness gaps.'"*

This is a documentation task, not a code task — nothing about `redrawEnabled`
or `REDRAW_THRESHOLD` changes (both stay as they are: false / untouched).

1. In `QUESTIONS.md`, close out §28: mark it ANSWERED, quote the user's
   ruling verbatim (the way §26's answer was recorded above it), and note
   that §26's shadow evaluation is now unblocked as a consequence — but see
   this brief's own §7 on why it isn't being started here.
2. Add one dated `DECISIONS.md` entry recording the answer, in the file's own
   style (see the 2026-08-23 session-87/88 entries for the shape): what was
   asked, what was answered, and what it changes (the STATED REASON for
   keeping redraw closed) versus what it does not (the verdict itself, which
   was never in question).
3. **Retire "43.9 mana per extra fish against a cast holding 10" everywhere
   it is cited as the live reason redraw is closed**, replacing it with "no
   validated trigger + two unpaid correctness gaps (both fixable offline,
   neither fixed)." Search beyond `QUESTIONS.md` — check `SPEC-fishing.md`,
   `CLAUDE.md`, and any handoff report that states the closure reason rather
   than merely reporting the 43.9 figure as a historical measurement. A
   number that is being reported as *"this is what session 75 measured"*
   stays; a sentence that is doing the job of *justifying why redraw is
   closed today* gets replaced.

**Do not** write any shadow instrumentation, and do not touch
`redrawEnabled` or `REDRAW_THRESHOLD`. The user answered "yes, re-price it" —
they did not answer "yes, ship the shadow eval this session."

---

## 2. REAL_DECK — verify the actual failure before touching anything

**The user's answer: yes, update it** — but read this section before doing
so, because what STATE.md describes and what `tests/fishing/rodDeck.test.ts`
already contains don't obviously line up, and rule 9 says check before
fixing.

`rodDeck.test.ts` (session 71) already carries `ROD_CARD_GRANTS[SHROOM_ROD] =
[1, 2, 3, 4, 5, 6, 74, 75, 76, 78]` — the exact array STATE.md's session-87
recap says the corpus now yields. That test reads the *latest* cast's rod
live (`latestRodObservation()`) and fails loudly, by design, if `CURRENT_ROD`
or `REAL_DECK` drifts from what the account actually holds. So it is not
obvious that *this* file is where the described mismatch lives — STATE.md's
"grant table expected `[1..10]`" doesn't match either rod's grant array in
this table, which suggests the stale assumption may be in a **different,
older** test or script that predates the SHROOM_ROD repoint and still assumes
something closer to a plain sequential deck.

**Before changing anything:** run the suite, find the actual failing
assertion(s) that correspond to STATE.md's "REAL_DECK no longer matches the
account's rod," and confirm which file it's really in. If it turns out to be
`rodDeck.test.ts` itself failing (e.g. on the "grant table agrees with PLAY"
check), fix it there. If it's a different, older hardcoded assumption
elsewhere, fix that one and say so — don't assume STATE.md's one-line summary
named the right file.

---

## 3. SPEC-fishing §4 — characterize before updating

**The user's answer:** *"review the three exceptions then update the spec if
the live data really establishes a new rule."* Not a blanket yes — read this
as two steps, and only do the second if the first earns it.

The `FISH_HP_DIFF` rule (`SPEC-fishing.md`, the Events table around line 168:
`fishHp -= value`, positive on a hit, negative on a miss) has its exceptions
pinned as an exact list in `tests/fishing/stateFields.test.ts` — that file's
own docblock is what SPEC-fishing.md cites for "a third, novel exception
fails loudly rather than being absorbed into a tolerance." Session 87's
20-cast batch apparently produced three more (the count going 3 → 6 per
`scratch-session-87.md`), uncharacterized.

1. Open `stateFields.test.ts`, find the newly-failing exception entries, and
   read each one — what state, what field, what value, what a naive
   application of the `fishHp -= value` rule would have predicted instead.
2. **Only update `SPEC-fishing.md`'s rule text if the three new exceptions
   share a common, nameable cause** — the way the original three did (a
   lethal-blow clamping issue, a crit-vs-hit base amount, etc.). If they're
   three unrelated one-offs, or if the corpus doesn't clearly support a new
   general statement, say so and leave the rule's prose as it is — updating
   the *exception list* pin (a mechanical count) is not the same act as
   updating the *rule* (a claim about mechanics), and the user asked for the
   second only if warranted.
3. Either way, the test pin itself (the exact list, now six rather than
   three) should end up matching the current corpus — that part is
   mechanical regardless of what the prose ends up saying.

---

## 4. The three boon-pair models — offline, no live spend

All three source states are already on disk. No new capture needed.

| type | run | states (approx.) | first sighted | picked |
|---|---|---|---|---|
| `WeakeningMastery` | `25035508` | 059→060 | session 12 (room 1, offered not picked) | session 87 |
| `AddVulnerableSword` | `25036263` | ~105→106 | session 25 (room 1, offered not picked) | session 88 |
| `AddBurnShield` | `25036263` | ~123→124 | session 19 (room 1, offered not picked) | session 88 |

*(State numbers for the two session-88 pairs are read off `STATE.md`'s
summary, not independently re-verified — confirm against
`fixtures/dungeon-runs/run-2026-08-24-01-04-21` before using them.)*

Follow the pattern every existing `BOON_MODELS` entry and its adjoining
comment already establishes (`WeakeningTenacity`/`BurningBlock` session 60,
`TieWeak`/`VulnerableBlock` session 82, `AddMaxHealth` session 17, etc.): read
the before-state and after-state pair, diff the player's stat block against
the boon option's `selectedVal1`/`selectedVal2`, and classify:

- A flat stat change → `{kind: "rolled", stat: ...}` — but **let the diff
  decide which stat and whether it's flat**, not the boon's name.
  `VulnerableBlock`'s session-82 pair is the standing warning here: its
  `selectedVal1` of 4 was **not** a flat add to the rolled `block` stat (10→10
  across the pair) — the model that would have matched the name was wrong,
  and only reading the actual pair caught it.
- A zero-delta pickup with an effect that fires later (a combat trigger, not
  a stat change at pickup) → `{kind: "latent"}`, same shape as the six latent
  types already modelled.
- If a pair doesn't cleanly fit either shape, **say so and leave it
  unmodelled** rather than forcing a guess. SPEC §4d's standing rule — do not
  infer an effect from what a boon's name suggests — governs this exactly as
  it has for every prior capture.

Do this three times, one diff per type, each written as its own change. After
all three: run the suite and report the real before/after failure count.

---

## 5. The four corpus pins in `tests/fishing/castEra.test.ts` — the biggest single item

**The user's answer: yes, update all four now.** Read this section fully
before starting — it's larger than "change four numbers."

**These are NOT the frozen §28 memo figures.** `handoff/reports/session-86-redraw-revisit.md`
and `session-86-corpus-snapshot.md` are pinned to `CORPUS-2026-08-23A` on
purpose, and §28's own text says plainly: *"the corpus has grown since; these
figures have not been recomputed and must not be."* **Do not touch either of
those two files.** What's being updated here is a *different* thing:
`castEra.test.ts` recomputes its assertions against whatever fixtures are
actually on disk each time the suite runs (`redrawCounterfactual(split.today)`,
`focusEraSplit(traces, created)`, `budgetZeroDecomposition(...)`), so its pins
went stale the moment session 87's 20 casts landed — not because a memo was
recomputed, but because the corpus underneath a live-computed test grew.

What's actually pinned in this one file, found by direct read:

- **GATE 1a** (~line 140-150): `focusEraSplit` — today's `[casts, plays,
  budgetZero]` triple (was `[54, 202, 3]`), the "thirtyfold drop" framing, and
  the rate assertions (`toBeCloseTo(0.0149, 3)` etc.).
- **GATE 2** (~line 222-276): `budgetZeroDecomposition` — the three-term
  decomposition (`beforeRate`, `standardisedRate`, `noRestoreRate`,
  `todayRate`), the no-oil/oiled cast-count splits (41/13), and every rate
  derived from them. **If today's era's cast count changed, these
  sub-splits may have changed too** — a bigger today-era doesn't just move
  `todayRate`, it can move how many casts land in the no-oil vs. oiled
  buckets, which moves several downstream numbers together.
- **The redraw-counterfactual pins** (~lines 188-338): `neither = 0` → 6,
  dead-hands count 15 → (STATE.md says 32; verify), the Wilson CI bounds on
  the rescue rate, and `wasted` structurally zero at every threshold (now
  non-zero — STATE.md says 3).

**How to do this safely:** regenerate every number from the actual instrument
functions (`focusEraSplit`, `budgetZeroDecomposition`, `redrawCounterfactual`,
`separability`, all imported at the top of `castEra.test.ts` from
`src/sim/fishing/castEra.ts`) run against the current corpus — do not
hand-type new numbers based on STATE.md's summary figures. STATE.md's numbers
are a recap, not a source; the source is the code that produces them.

**Record the old values, don't erase them.** Either in a comment beside each
updated assertion or in the `DECISIONS.md` entry from §1 above (a second
entry, or a shared one — your call), note what each pin moved from and to,
the way `scratch-session-87.md` §6 already did once. A future reader should
be able to see this drift happened without archaeology.

**If this turns out to be substantially bigger than the rest of the
session** (e.g. the today-era cast-count change cascades into re-deriving
numbers this file doesn't currently print), **say so and stop rather than
rushing it** — see §7's honest expectation on why that's a legitimate
outcome here.

---

## 6. Design (not ship) a double-Relaxing-Oil trigger for the 3–4 `fishHp` band

*(Unchanged from the original request — this is net-new work, not red-suite
cleanup, and it's still the least certain piece of this brief.)*

### The gap, precisely

`onDemandTriggers` (`src/strategy/fishing/oilTiming.ts:180`) fires the
Relaxing Oil exactly once, exactly when `fishHp <= fishDamage` (2 at the
current payload) — i.e. only when a single oil is already lethal. At `fishHp`
3 or 4 it fires **zero**: one oil (−2) would leave the fish alive, and
nothing in the current trigger ever considers spending a second to finish
it. `config/bot.json`'s `dendren.oils.perItemMaxPerCast["937"]: 2` already
permits up to two Relaxing-Oil spends in one cast — set in **session 69**
per the user's own directive ("then only use 2x Relaxing oil per fishing
run") — but no trigger has ever asked for the second one. The budget
plumbing was built five sessions before a trigger that would use it.

### What's wanted, restated as a rule

Not a default, not "always spend two at 3-4 HP" — a **conditional**: at
`fishHp` 3 or 4, if the bot is **not confident** of landing the fish with the
mana and cards it has, fire both Relaxing Oils in the same turn to guarantee
the kill.

### The confidence signal already exists — reuse it, don't reinvent it

`bestKillProbability` (`oilTiming.ts:370`) is already exactly "the best
chance the bot has of finishing the fish THIS TURN with a card it can
actually afford" — built session 67 for the (derived-but-unshipped) necessity
gate. It is the natural "confidence of catching" read for this new trigger
too, and reusing it is the same discipline `onDemand` and `conservingOil`
already follow by sharing `onDemandTriggers` instead of each restating the
lethal condition.

### The shape to build

A new trigger function — e.g. `doubleLethalTriggers`, or a variant of
`onDemandTriggers` — with today's single-lethal case **unchanged** and one
new case added:

- `fishHp <= fishDamage` (today's case): fire one relaxing, exactly as now.
- `fishDamage < fishHp <= 2 * fishDamage` (the 3–4 band at the current +2
  payload) **and** `relaxingOilHeld >= 2` **and** `bestKillProbability(...)`
  is below the confidence cutoff: fire relaxing **twice** —
  `OilTimingDecision` returns `["relaxing", "relaxing"]`.

Two things to verify before this is scorable as a real policy, not assumed:

1. **Whether the live executor can actually consume the same oil kind twice
   inside one turn's decision.** `mayConsumeOil` (`oilPolicy.ts`) is called
   per-consume and already supports two 937s in one CAST via
   `perItemMaxPerCast`, but nothing in this repo has ever asked for two in
   one TURN specifically. Open `scripts/liveFishing.ts`'s oil-consumption
   call site and confirm the loop that walks an `OilTimingDecision` array
   issues one `use_fishing_item` per entry, in order, each re-checked by
   `mayConsumeOil`, rather than deduping or short-circuiting on a repeated
   kind. **If it dedupes, that is a second, separate piece of work — say so,
   don't work around it quietly.**
2. **Whether `1` is the right confidence cutoff, or whether the 3-4 band
   needs its own derivation.** The existing necessity gate's
   `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing = 1` (fire unless the bot's own
   best card already guarantees the kill — no free parameter) is the
   principled, zero-tuned-constant starting point, matching this file's
   standing "do not tune the necessity thresholds" rule
   (`oilTiming.ts:427-450`). **Do not invent a new fitted number for "not
   confident."** If `1` produces a degenerate result in the 3-4 band (always
   fires, or never does), report that plainly rather than tuning around it.

### Score it in sim before writing anything else down

Add the new trigger to a comparison alongside the existing roster (extend
`OIL_TIMING_POLICIES` or follow `oilConserveSweep.ts`'s shape in a dedicated
script) and run the same `n=8000` paired-seed sweep `OIL-POLICY.md` and
`OIL-CONSERVE.md` both use. Report, in the same units those two documents
use: catch %, Δ **vs `on-demand`** (the currently-shipped live policy), oils
spent, oils per extra fish; the **§0a suspension caveat**, verbatim, if
scored on `castSim`'s bare default arm; how often the band actually arises
(`fishHp` 3-4, `relaxingOilHeld >= 2`, low confidence, all three at once);
and oils-per-extra-fish against `MEASURED_RELAXING_OILS_PER_EXTRA_FISH`
(~6 oils per extra fish, [1.5, 20]) — a double-spend needs to clear roughly
**twice** that bar per fish saved, and the write-up should say so explicitly.

### Write it up, do not wire it live

A new `handoff/OIL-DOUBLE-LETHAL.md` (or a new section in `OIL-POLICY.md`),
following `OIL-CONSERVE.md`'s shape. **Nothing here gets a live call site
this session.** `dendren.oils.policyApproved` stays as it is,
`liveFishing.ts`'s existing trigger call is untouched, and the new function
stays reachable-but-uncalled, exactly as `conservingOil` has been since
session 67 — rule 4 requires the user to see the derived policy before its
timing goes live.

---

## 7. Gate

1. §28 recorded in `QUESTIONS.md` and `DECISIONS.md`, and "43.9 mana per
   extra fish" retired everywhere it was doing the job of a live reason.
2. `REAL_DECK` — the real failing assertion identified and fixed, not
   guessed at from STATE.md's summary.
3. SPEC-fishing §4's three new exceptions characterized; the spec's rule
   text updated only if they share a nameable cause, with the reasoning
   stated either way.
4. All three boon pairs modelled (or explicitly left unmodelled with a
   stated reason).
5. `castEra.test.ts`'s four flagged pins regenerated from the real instrument
   functions against the current corpus, with old values recorded, not
   erased.
6. The double-lethal oil trigger exists as a pure function, scored in sim,
   written up for approval — with **no live call site**.

**What does NOT meet the gate:** any change to `policyApproved`,
`liveFishing.ts`'s oil call site, `redrawEnabled`, or `REDRAW_THRESHOLD`; a
boon pair modelled by guessing from its name; a corpus pin hand-typed rather
than regenerated from its instrument; a SPEC-fishing rule change built on
three exceptions that don't actually share a cause; any shadow
instrumentation for §26.

---

## 8. Do not

- **Do not touch `dendren.oils.policyApproved`, `liveFishing.ts`'s oil call
  site, `redrawEnabled`, or `REDRAW_THRESHOLD`.** Derive-and-present only.
- **Do not start §26's shadow evaluation.** It's unblocked by §28's answer,
  but it's a big enough piece of work to deserve its own brief — flag it as
  ready, don't build it here.
- **Do not run any live fishing casts or dungeon runs this session.**
- **Do not touch `session-86-redraw-revisit.md` or `session-86-corpus-snapshot.md`.**
  Those stay frozen at `CORPUS-2026-08-23A` permanently.
- **Do not invent a fitted confidence threshold** for the new oil trigger.
  Start from the existing necessity-gate constant; report a plateau if
  that's what's there.
- **Do not hand-type any of `castEra.test.ts`'s new pinned numbers.**
  Regenerate them from the instrument functions.
- **`npx tsx` and `git` fail under the command sandbox. Run unsandboxed.**

---

## Your task (session 89)

1. §28: record the ruling in `QUESTIONS.md` and `DECISIONS.md`; retire the
   43.9-mana reason wherever it's cited as a live justification.
2. `REAL_DECK`: find the real failing assertion, fix it there, say where it
   actually was.
3. SPEC-fishing §4: characterize the three new exceptions; update the rule
   prose only if warranted; update the test's exception list either way.
4. Model the three boon pairs in `BOON_MODELS`.
5. Regenerate `castEra.test.ts`'s four flagged pins from the real instrument
   functions against the current corpus; record old values.
6. Build the double-lethal oil trigger, verify the live-executor question,
   score it in sim, write it up. No live call site.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit, `assertionCoverage` (check whether it's unblocked — it
   fails closed on any red suite), `preflight.ts`, secret scan.

**Honest expectation and sequencing.** Items 1-4 are close to mechanical —
record a decision, verify one assertion, characterize a short exception
list, follow five sessions of precedent for a boon diff. Item 5 is the
biggest known quantity in the session: it may be four number changes or it
may cascade into re-deriving sub-splits this file doesn't currently print —
if it does, that's a legitimate place to stop and report rather than a
reason to rush. Item 6 is the biggest unknown quantity: the confidence
threshold may degenerate the way earlier necessity thresholds did, or the
live executor may not support two same-kind consumes in one turn. **If the
session runs out of room, item 6 is the one to defer** — it's net-new work,
not red-suite debt, and nothing else in this brief depends on it landing
today.
