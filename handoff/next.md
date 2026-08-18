# BRIEF — session 44

Session 43 landed Task 14 (bot-initiated juiced `start_run`, gate MET on
both runs), the Sword-pin/Heal-overflow loot rule, and six user-sourced
fishing heuristics (four implemented, two documented as judgment calls).
629/629 tests, `tsc` clean, at commit `38fd190`.

**The user's directive for this session, verbatim in spirit: fishing's
14.0% live catch rate (7/50, `handoff/reports/fishing-casts.md`) is not
acceptable — hammer out fishing refinements. This session is entirely about
moving that number, not about new dungeon work.**

Read this whole brief before spending anything — the plan below is built
directly on SPEC.md §5's own root-cause finding, not a fresh guess.

---

## Why 14% happened — the diagnosis already exists, don't re-derive it

SPEC.md §5 already did this analysis in depth (sessions 13-15) and it holds:
`focusMeter` accounts for a real but modest chunk of the sim-vs-live gap
(~21pp), but the **dominant** cause is that the hypothesis-elimination
matcher has nothing to identify against — with the real Dendren pattern
library still mostly unmined, the matcher runs effectively **blind**
(sim: ~7–10% catch rate, statistically consistent with a blind-run live
result). A **fully known** pattern library gets the sim to ~70%. The 50-cast
corpus behind today's 14.0% number was played across many sessions where
the matcher was blind for most of it and only gained its first promoted
pattern (`perimeterWalk(cw)`) partway through (session 18). **14% sitting
just above the ~7-10% blind baseline is the expected, unsurprising result of
where the pattern library actually stood — this is not a hidden bug to find,
it's a maturity problem to attack directly**, per Task 11's own standing
note: "no volume of transitions helps until `mineFishPatterns.ts` exists to
turn them into a real library the matcher can search" — it exists now
(session 15/18), so volume is finally the live lever again.

**A local snapshot worth confirming, not assuming:** `data/minedFishPatterns.json`
on disk right now shows `patterns: ["perimeterWalk(cw)", "perimeterWalk(ccw)"]`,
`castCount: 50` — a **second** pattern beyond the one SPEC.md's prose still
describes as the only promotion. This may already reflect the full 50-cast
corpus and just not be written up yet, or it may be stale/local-only. §0
below is to nail this down for real before anything else, not to trust the
file at face value.

---

## 0. Re-establish ground truth on the pattern library — five minutes, do this first

1. Re-run `scripts/mineFishPatterns.ts` fresh against the current
   `data/fish-patterns.jsonl` (should be 169 real transitions / 50 real
   casts per QUESTIONS.md §14's resolution — confirm this count while
   you're in there). Report exactly what promotes, at what support, and
   confirm/refute the `perimeterWalk(ccw)` second promotion.
2. Confirm `scripts/liveFishing.ts` is actually reading
   `data/minedFishPatterns.json` to seed the matcher's candidate pool
   live (DECISIONS 2026-08-17, session 18) — i.e. that today's live casts
   in §2 below will actually use whatever promoted set §0.1 finds, not a
   stale in-memory default.
3. State plainly in STATE.md what the real current promoted-pattern count
   is and how it compares to SPEC.md's own prose (which still says "1
   primitive promoted" as of session 21) — update SPEC.md §5 / TASKS.md
   Task 11 if the second promotion is confirmed real.

## 1. Get an honest sim baseline for TODAY's real matcher state, before spending energy

The 6.6%→16.2% (blind vs. one pattern) sim comparison in DECISIONS
2026-08-17 (session 18) is now stale if §0 found a second promoted pattern.
Before playing live:

1. Re-run the sim comparison (`scripts/fishFocusMeter.ts` or equivalent)
   with `matcherPool` seeded from §0's real current `data/minedFishPatterns.json`
   contents, at the same N the prior comparisons used (500, ideally also
   3000 for a second seed per the project's own convention). This sets an
   honest expectation for what today's live batch *should* achieve, so §2's
   real result can be judged against a real number, not a stale one.
2. While you're in the sim harness: run a quick ablation of the four
   implemented session-43 heuristics (center-bias, prune-return-to-previous,
   edge-predictability, coverage-max) — all-on vs. all-off — against the
   SAME matcherPool from step 1, N≥2000. This is cheap and fast in sim,
   where live validation will stay statistically noisy for a long time at
   the cast volumes this project can afford per day. Report the delta
   plainly, including if it's a null result — per SPEC-fishing.md §8, none
   of these four have been corpus-validated yet, and this is the first
   chance to get ANY signal, even a synthetic one.
3. State both results in STATE.md before moving to §2, so the live batch's
   outcome can be compared against a number that was committed to in
   advance, not adjusted after seeing the result.

## 2. Spend today's fishing budget on a real batch — this is the actual ask

`data/guard-budget-fishing.json` shows 0 energy spent today as of this
brief being written (`config/bot.json`'s dendren budget is 240 energy / 20
casts/day, tier-1 12-energy casts) — re-check it's still untouched before
starting, in case the user played manually since. Playing fishing casts
within the configured daily budget is already blanket-authorized (CLAUDE.md:
"Playing fishing casts... fine to do autonomously within the configured
budget") — no special sign-off needed here, unlike the dungeon juiced-start
case.

1. Run the live fishing loop for a full batch — up to the day's real
   budget/cap, whichever binds first — with the current matcher
   (§0's real promoted set) and all four session-43 heuristics active (the
   current default wiring).
2. Do not stop early because a few casts in a row miss — at ~14-20%
   baseline expectations, a cold streak of 5-8 misses is ordinary variance,
   not a signal something's broken. Only stop early on an actual guard trip
   or unexpected state, per CLAUDE.md §5.
3. If a catch happens, confirm `loot` resolution still fires cleanly
   end-to-end (Task 9's session-17 fix) and the account doesn't get stuck —
   this project's had two different stuck-doc shapes before (QUESTIONS.md
   §10, §15).

## 3. Measure honestly, separately from the all-time number

The all-time 14.0%/50-cast figure blends many sessions of a mostly-blind
matcher and will keep changing slowly even after today's improvements, since
it's cumulative. Report **today's own batch** as its own number too:

1. Regenerate `handoff/reports/fishing-casts.md` (`scripts/fishingReport.ts`)
   — this updates the all-time cumulative figure.
2. Separately, compute and state today's batch's own catch rate in
   isolation (caught / cast, today's casts only) — this is the real signal
   for whether §0-§2's changes did anything, since the all-time number will
   barely move at n≈20 added to n=50 existing.
3. Re-run `mineFishPatterns.ts` again on the grown transition log — did
   today's batch produce a third promotable pattern, or move any existing
   near-miss (`bounce(2,0)`, `bounce(-2,0)`, `twoCellCycle(0,-1)`) closer to
   its ≥3-match bar? Report the current near-miss table plainly either way.
4. Specifically audit today's new transitions for a real 1-cell-move-then-
   reversal case that would counterexample heuristic (d)
   (`pruneReturnToPrevious`) — STATE.md session 43's own open question #3
   flagged this as the one heuristic with a real chance of being wrong
   outright. If you find a counterexample, say so and remove/gate the call
   rather than explain it away (SPEC-fishing.md §8's own instruction).
5. State plainly whether today's batch's catch rate landed near §1's sim
   prediction, above it, or (most likely, at these sample sizes) too noisy
   to tell — do not claim a definitive win or loss off ~20 casts if the
   honest read is "consistent with a wide range of true rates." Say what
   the confidence interval actually allows.

## 4. Ask for one live capture — unblocks a real, currently-unused catch lever

`oilPolicy.ts`'s `shouldConsiderRelaxingOil` (session 43) is a fully-written
recommendation function with no live call site, because no oil-use request
shape has ever been captured (QUESTIONS.md §16). Mid Relaxing Oil is a
**direct fish-damage** consumable (`FishingDamageFish` +2) — exactly the
kind of lever that could rescue a close cast (fish at low HP, no sure kill
in hand) independent of pattern-identification progress. This can't be
guessed past per CLAUDE.md §2.

Ask the user directly, at the top of your session output, to grab one
DevTools capture of using ANY fishing oil mid-cast during today's live play
(same method as `reward_one`/`path_two`/`loot` were each originally
confirmed — Network tab, the real `POST /api/fishing/action` request body,
redact JWT/wallet before it goes anywhere). If they can do this during
§2's batch, wire `oilPolicy.ts` into a real call site in
`scripts/liveFishing.ts` before this session's recap; if not, leave it
queued in QUESTIONS.md §16 exactly as-is — don't invent the shape.

---

## Setting honest expectations — state this plainly in STATE.md, don't round up

Even a **fully mined** pattern library only gets the sim to ~70% (not
100%) — that is the real ceiling this project has ever demonstrated, and
it assumes perfect identification, which 2 (or however many §0 confirms)
promoted patterns out of an unknown-size real library does not yet provide.
The realistic goal for THIS session is "measurably better than blind
(~7-10%) and better than the stale 14% all-time figure," not "at parity
with the sim ceiling." If today's batch lands at, say, 20-25%, that is
real progress worth reporting as such — don't inflate it into "solved," and
don't discount it as noise if §1's sim ablation predicted a similar-sized
lift. If it doesn't move at all, say that plainly too and point at whatever
§0/§3 found as the reason (e.g., today's casts' true patterns simply
weren't in the promoted set) rather than a vague "more data needed."

## Your task

1. §0 — confirm the real current promoted-pattern state and that it's
   actually wired into live play. Five minutes, do it first.
2. §1 — fresh sim baseline + heuristic ablation for TODAY's real matcher
   state, committed to in STATE.md before playing live.
3. §2 — spend today's fishing budget on a real live batch, current best
   pipeline, don't stop early on ordinary variance.
4. §3 — measure today's batch's own catch rate separately from the
   all-time cumulative number, re-mine for new promotions, audit heuristic
   (d) for a counterexample.
5. §4 — ask the user for one oil-use DevTools capture during play; wire
   `oilPolicy.ts` if it lands in time.
6. Recap normally: full suite + `tsc` + `git diff --check` against the
   final commit. State every number from §0-§3 plainly, including null or
   disappointing ones — this session's whole point is an honest read on
   whether the pattern-mining lever actually moves live catch rate, and
   that's valuable to know either way.
