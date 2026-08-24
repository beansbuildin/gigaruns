# BRIEF — session 90 — wire double-lethal oil live (user override), finish the pin sweep, build §26's redraw shadow eval

**One live-path change this session, three documentation/test-hygiene passes.**
Read §1 fully before touching any code — it's the one item that spends real
oil stock the moment it's live, and it's going live specifically because the
user overrode the sim's own recommendation, which has to be recorded plainly
rather than smoothed over.

**Where everything below came from.** Session 89's STATE.md was walked
through with the user item by item. Four rulings came back, all in this
brief. A research pass (this session, offline) then re-verified every code
claim in this brief directly against the current files rather than trusting
STATE.md's one-line summaries — three of STATE.md's characterizations turned
out to be imprecise in ways that change what to actually do; each is called
out where it matters.

---

## 0. Verification and rule 9

```
npx tsc --noEmit                     expect clean
npx vitest run                       baseline 8 failed files / 42 failed / 1673 passed / 1 skipped (1716)
```

**Rule 9 applies to this whole brief, and it mattered this time.** Before
writing this, a read-only pass confirmed against the actual current code
(not against STATE.md's summary) `handoff/OIL-DOUBLE-LETHAL.md` in full,
`src/strategy/fishing/oilTiming.ts`'s double-lethal additions
(`doubleLethalTriggers`, `doubleLethal`, ~lines 630-757),
`scripts/liveFishing.ts`'s oil consume loop (~lines 2177-2308) and its
surrounding "THREE gates" comment (~lines 1944-1975), `tests/fishing/oilDoubleLethal.test.ts`
in full, `src/strategy/fishing/oilShadow.ts` (the shadow-evaluation
precedent), current `QUESTIONS.md` §26 and §28, `src/sim/fishing/redrawCounterfactual.ts`,
`tests/fishing/redrawCounterfactual.test.ts`, and `src/sim/fishing/castTrace.ts`'s
`loadCastTraces`. **Not opened**: `tests/fishing/oilShadowInert.test.ts`,
`tests/fishing/oilStockExhaustion.test.ts` (referenced as a pattern to
follow, not read directly), or the six other files behind §3's remaining 24
failures (`oilReachability`, `matcherHeadroom`, `damageEconomy`,
`zoneTemplate`, `fishingCorpus`, `enemies` test files) — open each before
touching it.

**Three corrections to how STATE.md described things, found by this pass:**

1. **`OIL-DOUBLE-LETHAL.md` has no "what approving this would mean" section**
   the way `OIL-POLICY.md` §3 does. §1 below writes the wiring steps from
   scratch — there's no precedent text to lift.
2. **Nothing tests the live executor's double-consume behavior end to end.**
   All 19 assertions in `oilDoubleLethal.test.ts` are against the pure
   decision function; none exercise `liveFishing.ts`'s actual consume loop
   with a live-shaped mocked request/response sequence. §1 adds this before
   the switch flips.
3. **`redrawCounterfactual.test.ts` is NOT pinned to the frozen `CORPUS-2026-08-23A`
   snapshot in code** — `loadCastTraces()` has no date or doc-id filter and
   reads whatever's currently in `fixtures/fishing-casts/`. So there was never
   an architectural "frozen vs. live" conflict to resolve — the test was
   always live-computed, exactly like `castEra.test.ts`, and simply went
   stale the same way when the corpus grew. §2 below is a straightforward
   regeneration, not a design decision. (The **memo**,
   `session-86-redraw-revisit.md`, stays frozen regardless — it's a static
   document, not code, and nothing here touches it.)

---

## 1. Wire the double-lethal oil trigger live — the user's explicit override

**Record this precisely, because it's not the sim's recommendation.**
`OIL-DOUBLE-LETHAL.md` recommends AGAINST shipping this: **140.9 marginal
oils per extra fish against a bar of roughly 12** — more than 11x over. The
user reviewed that finding and chose to authorize it anyway. Quote them
exactly, in both `QUESTIONS.md` and `DECISIONS.md`: *"I want to authorize
the bot to use 2x relaxing oil if it will be lethal and it is not confident
in catching with mana."* State the sim result in the same entry, beside the
override, so nobody reading it later mistakes this for the sim's
endorsement — it is the user's conscious choice to value a guaranteed catch
in the 3-4 `fishHp` band over the oils-per-fish ratio the sim priced it on.

### 1a. Add the missing coverage before flipping anything

Nothing currently proves the live loop actually issues two separate
`use_fishing_item` POSTs for a repeated `"relaxing"` entry — the claim in
`OIL-DOUBLE-LETHAL.md` §3 that it does is a code-reading claim, not a test.
Before wiring, write an integration-style test against `liveFishing.ts`'s
consume loop (mocked fetch, following the pattern
`tests/fishing/oilStockExhaustion.test.ts` already establishes for
stock-related loop behavior — read that file first) that puts a cast in the
double-lethal band and asserts: two `use_fishing_item` POSTs are sent, into
two different slots; `oilHeld.relaxing` decrements by 2; `oilsUsedThisCastOf.relaxing`
reaches 2; and — the case worth being paranoid about — if the SECOND
relaxing consume ends the cast (it will: first oil takes `fishHp` 3or4 → 1or2,
survives; second takes it to ≤0, and the cast completes), confirm the loop's
existing `doc.COMPLETE_CID` break (line ~2209) correctly stops before
attempting any further consume in the same decision array (e.g. a trailing
`"focus"` entry from `doubleLethalTriggers`'s `[...base]` spread) rather than
sending a third POST against an already-finished cast. That exact failure
mode cost a real live cast once before (the comment at `liveFishing.ts`
~1969-1975 documents it) — the reasoning that double-lethal is safe from it
is sound, but it has never been exercised, live-shaped or otherwise.

### 1b. Retire the not-wired guard, don't just break it

`oilDoubleLethal.test.ts` lines ~161-168 currently assert
`liveFishing.ts` calls `onDemandTriggers` and does **not** contain
`doubleLethalTriggers(` — a text-grep guard that exists specifically to keep
this feature from shipping by accident. The moment §1c wires it, this test
fails **by design**, not as a regression. Replace it with the opposite
assertion (the live path DOES call `doubleLethalTriggers`) rather than just
deleting it — the guard's job (catch a future silent revert or a future
silent re-addition of a different unshipped trigger) is worth keeping in the
positive direction.

### 1c. The wiring itself

At `scripts/liveFishing.ts` line ~2177, replace:

```ts
const oilWanted = onDemandTriggers({ ... }, PAYLOAD_OIL_EFFECTS);
```

with

```ts
const oilWanted = doubleLethalTriggers({ ... }, PAYLOAD_OIL_EFFECTS);
```

— same context object, same call shape; `doubleLethalTriggers` already calls
`onDemandTriggers` internally as its base case, so every existing single-oil
behavior is preserved unchanged and the double case only fires in the 3-4
band under the existing derived threshold
(`RECOMMENDED_NECESSITY_THRESHOLDS.relaxing = 1`, the same zero-tuned-constant
the necessity gate already uses — nothing to invent here). Update the import
at line ~153 accordingly, and update the "THREE gates" comment block at
~1944-1975 — it currently names `onDemandTriggers` as gate 1; say what
actually gates the spend now.

**Do not** route this through `doubleLethal(...).decide(...)` (the
`OilTimingPolicy` wrapper) instead of the raw trigger function — the wrapper
adds a positional stock filter that's redundant with what the loop already
does per-iteration via live `mayConsumeOil` checks, and `doubleLethalTriggers`
itself already guards on `relaxingOilHeld >= 2` before firing the double
case. Using the raw function keeps parity with how `onDemandTriggers` is
called today.

### 1d. After wiring

- `dendren.oils.policyApproved` is already `true` (session 62) — no config
  change needed; this is a trigger-selection change, not a budget-approval
  one.
- Append a short "WIRED LIVE" section to `OIL-DOUBLE-LETHAL.md`: the date,
  the user's override quote, and what to watch for on the first live firing
  (both POSTs land, `EV`/held counts move as expected, no `COMPLETE_CID`
  double-send).
- **The first live double-fire hasn't happened yet and won't necessarily
  happen this session** — nothing here forces a fishing batch. Whenever
  fishing next runs autonomously and the band condition arises (sim
  estimate: the band arises on 8.27% of decisions, the trigger itself fires
  on 3.48%), that recap should report the full response pair in detail, not
  just a line item — this is the first time real oil stock moves through a
  path nothing has exercised live before.

---

## 2. `redrawCounterfactual.test.ts` — regenerate, cross-reference the frozen memo

Simpler than STATE.md's summary made it sound (see §0's correction #3): this
test was never snapshot-pinned in code, so there's no architectural choice to
make. Regenerate its ~17 assertions from the real functions
(`redrawCounterfactual`, `separability`, `manaSlack`, etc. — all imported at
its top from `src/sim/fishing/redrawCounterfactual.ts`) against the current
corpus, the same discipline session 89 already applied to `castEra.test.ts`:
don't hand-type numbers, keep the old values noted (comment or the
`DECISIONS.md` entry below), don't touch anything in
`handoff/reports/session-86-redraw-revisit.md` or
`session-86-corpus-snapshot.md` — those two files are static prose and stay
frozen at `CORPUS-2026-08-23A` regardless of what this test now reads.

Add **one** comment near the top of the test file, once, explaining this
plainly for the next reader: these pins track the live corpus and will keep
moving; the `CORPUS-2026-08-23A` figures in the session-86 memo are a
permanently frozen historical snapshot computed once and never recomputed
(per `QUESTIONS.md` §28); the two will diverge over time on purpose, and
that's not a bug in either one.

---

## 3. The other 24 mechanical pins

`oilReachability` (8), `matcherHeadroom` (7), `damageEconomy` (3),
`zoneTemplate` (3), `fishingCorpus` (2), `enemies` (1). STATE.md
characterized all 24 as ordinary corpus-count drift, and the user authorized
regenerating them on that basis — **but verify each file before regenerating
it**, the same way this session's research pass found `redrawCounterfactual.test.ts`'s
situation was subtly different from its one-line description. Read the
actual failing assertions in each of the six files; if all six really are
mechanical corpus counts (a number that moved because the corpus grew, not a
claim that reversed), regenerate them from their real instrument functions
and note old values, same as §2. **If any one of them turns out to be a
structural claim — a "there is exactly one X" or "never observed Y" kind of
assertion, the way `neither = 0` was — stop on that one specifically and
report it rather than folding it into the mechanical batch.** That's the
standing rule this whole project has followed since session 87; this session
doesn't get to skip it just because the user pre-authorized the bucket.

---

## 4. §26 — build the redraw shadow evaluation

**Authorized, and now the natural next step**: §28's restated reason for
keeping redraw closed names "no validated trigger" as (half of) the blocker,
and this is the instrument that produces out-of-sample evidence for one.
**`redrawEnabled` stays `false` and `REDRAW_THRESHOLD` stays untouched
throughout** — this is a logging-only addition, never an actual redraw
action. That constraint is unconditional and doesn't get relaxed by anything
in this brief.

### The precedent to follow, and the mistake it already made once

`src/strategy/fishing/oilShadow.ts` is the shape to copy, not reinvent. Three
structural properties, all required:

1. **Deep-copy isolation** — `snapshotOilDecision` rebuilds every input into
   fresh frozen objects before the shadow touches it, so the shadow never
   holds a reference the live path reads again. The redraw-shadow equivalent
   needs the same: whatever state it evaluates against must be a snapshot,
   not a shared reference.
2. **Cannot throw** — the entire evaluation body sits inside one
   `try { ... } catch (e) { return { ...base, error: e.message, sanity: [...] } }`.
   A shadow failure degrades to a logged record with an `error` field; it
   never propagates and never touches the live decision.
3. **Inert by type** — the record type it returns has no field the live loop
   reads back. It gets pushed to an array and logged, nothing more.

**The mistake to not repeat**: session 68 placed the oil shadow's evaluation
in the wrong phase of the turn (after the consume block), so it was blind to
exactly the turns a lethal consume ended — the decisions that mattered most.
Session 69 fixed it by hoisting the evaluation earlier. `oilShadow.ts`'s own
header states the lesson: *"a shadow evaluated in the wrong phase of a turn
is blind to exactly the decisions that end the turn, and it reports that
blindness as an ordinary run of quiet records."* For redraw specifically:
evaluate whether a redraw would have been indicated **before** the turn's
card gets played — evaluating after would make the question moot for
exactly the turns worth logging.

### What to shadow

Don't derive a new trigger candidate — reuse the one this project already
has. Session 83's `heldCoverage`-conditioned-on-focus-budget candidate is the
existing, pre-registered shape (separates dead hands at AUC 0.922; clean
when conditioned on `budget >= 1`: K=6 fires 6 times with 6 rescues and 0
sacrifices, K=10 fires 44 times with 18 rescues and 3 sacrifices, in the
sample it was fitted on). **Verify its exact current definition in code
before using it** — it was described in `DECISIONS.md`'s 2026-08-23 (session
83, §3) entry as "fitted to this corpus with oracle labels and no held-out
set, n=27 in the conditioned arm — a shape, not a tuning," so find wherever
it actually lives in `src/` now (search for `heldCoverage`) rather than
re-deriving it from the DECISIONS.md prose.

### What "one extra field per logged decision" means

§26's original ask (session 84 §4) was specific: log what the trigger would
have fired on, live, and send nothing. Follow that shape — the shadow record
rides beside the existing per-turn log entry, not a separate stream, the
same way the oil shadow's record does.

---

## 5. Gate

1. §1: the override is recorded verbatim in `QUESTIONS.md` and
   `DECISIONS.md`, beside the sim's own negative number. The missing
   integration test exists and passes. The not-wired guard is replaced with
   its positive equivalent. `liveFishing.ts` calls `doubleLethalTriggers`.
   Nothing forces a live fishing batch this session.
2. §2: `redrawCounterfactual.test.ts`'s pins regenerated from the real
   functions, old values noted, the frozen-memo cross-reference comment
   added. The two frozen session-86 report files untouched.
3. §3: each of the six files checked individually before regenerating; any
   structural (not mechanical) finding reported separately rather than
   folded in.
4. §4: the shadow evaluator exists, follows all three of `oilShadow.ts`'s
   structural properties, evaluates at the correct turn phase, and shadows
   the existing `heldCoverage`-conditioned candidate. `redrawEnabled` false,
   `REDRAW_THRESHOLD` untouched, verified in the diff, not just asserted.

**What does NOT meet the gate:** any live redraw action, however gated; a
double-lethal wiring with no integration test for the two-consume path; a
"mechanical" pin fix that was actually a structural reversal, folded in
without being flagged; a shadow evaluator that can throw, that holds a live
reference, or that's wired to influence the actual card played.

---

## 6. Do not

- **Do not touch `redrawEnabled` or `REDRAW_THRESHOLD`.** The shadow eval is
  additive logging only.
- **Do not touch `session-86-redraw-revisit.md` or `session-86-corpus-snapshot.md`.**
  Frozen permanently.
- **Do not force a live fishing batch** to test the double-lethal wiring.
  Let it fire naturally; report carefully whenever it does.
- **Do not present the double-lethal wiring as sim-recommended.** It isn't —
  say so every time it's mentioned, the way this brief does.
- **Do not fold a structural finding into the "24 mechanical pins" bucket**
  without flagging it separately.
- **`npx tsx` and `git` fail under the command sandbox. Run unsandboxed.**

---

## Your task (session 90)

1. Record the double-lethal override in `QUESTIONS.md`/`DECISIONS.md`.
2. Write the missing live-loop integration test for the double-consume path,
   including the `COMPLETE_CID` mid-sequence case.
3. Replace `oilDoubleLethal.test.ts`'s not-wired guard with its positive
   equivalent.
4. Wire `liveFishing.ts` to `doubleLethalTriggers`; update the surrounding
   gate comment.
5. Regenerate `redrawCounterfactual.test.ts`'s pins; add the frozen-memo
   cross-reference comment.
6. Check and regenerate the other 24 mechanical pins, file by file.
7. Build the §26 redraw shadow evaluator on the `oilShadow.ts` pattern,
   shadowing the existing `heldCoverage`-conditioned candidate, correct turn
   phase, `redrawEnabled`/`REDRAW_THRESHOLD` untouched.
8. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit, `assertionCoverage`, `preflight.ts`, secret scan. Report the
   real final failure count — this session should get the suite very close
   to green, but say the actual number, not the arithmetic guess.

**Honest expectation and sequencing.** Items 1-3 are close to mechanical —
verified, low-risk, precedent-following. Item 4 (the shadow eval) is
genuinely new build work and the one most likely to reveal something this
brief didn't anticipate, the way the "not actually frozen" finding did for
item 2. **If the session runs out of room, item 4 is what carries to session
91** — unlike the other three, nothing else in this brief depends on it
landing today, and it's explicitly logging-only, so a half-finished attempt
left unwired is safe to leave for next time. Item 1, by contrast, should not
be left half-done: either the wiring lands with its test coverage complete,
or it doesn't land at all this session — a double-lethal trigger wired
without the integration test, or with the guard test just deleted rather
than replaced, is worse than not wiring it yet.
