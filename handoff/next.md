# BRIEF — session 26

**Task 10 is DONE.** Session 25's 2-hour orchestrator retry passed clean:
zero exceptions, zero potion leaks, both real daily caps hit and recognized,
full rollup, exit 0. Real number for "how long to exhaust a day's budget":
~45 minutes. This closes the project's last standing infrastructure gate —
both loops now genuinely run unattended.

Priority for this session is a real fishing-mechanics lead that surfaced as
a byproduct, ahead of Task 13.

---

## 1. Investigate `nextPosition`/`nextMovePath` before anything else

Three casts last session hit `liveFishing.ts`'s unknown-terminal-field
detector on `data.nextPosition`/`data.nextMovePath`, sitting in `doc.data`
alongside `fishPosition`/`previousFishPosition` — NOT near
`cardChosenId`/`caughtFish` (the actual catch-resolution fields, session
17). The existing inline code comment guesses this is catch-resolution
related; that guess doesn't hold up against where these fields actually
sit. One real dump: `fishPosition: [2,3]`, `nextPosition: [1,3]`,
`nextMovePath: [3]` — reads as a genuine look-ahead of the fish's next
move, not anything catch-related. Full dumps in `QUESTIONS.md §12`.

**What to check, cheaply, before doing anything else:**

1. Does this field appear on EVERY turn's response, or only the terminal
   doc? The detector that caught it only fires on terminal docs — it's
   unknown whether this has been present all along and just never
   surfaced, or is genuinely new/conditional.
2. If it's per-turn: does `nextPosition` reliably predict the fish's actual
   position on the following turn, across several real casts? This is
   checkable against existing fixture data before spending any new casts.
3. If confirmed as a real look-ahead: this would let the live loop react to
   ground truth instead of `mineFishPatterns.ts`'s statistical inference
   (matcher-blind 6.6% vs. matcher+mined 16.2% sim, but real catch rate is
   only ~3.3% off a thin sample — the inference approach's ceiling looks
   low). Don't build anything yet — confirm it holds across multiple real
   casts first, per CLAUDE.md §9 (a promising field name is a hypothesis,
   not a fact, until checked against the corpus).

**If it checks out**, this becomes the actual next fishing task — bigger
than Task 13, and probably worth a new TASKS.md entry of its own rather
than folding into Task 8's already-met gate (same convention as every prior
task addition in this project).

## 2. Task 13 — infrastructure piece only, in parallel

The deck-representation infrastructure Task 13 scoped (session 22) doesn't
need new live capture and can proceed regardless of what §1 finds. The
actual scoring/comparison logic should wait — if §1 confirms a real
look-ahead signal, "what should `chooseNewCard` optimize for" may look
different than the argmax-hit-power/mana placeholder it's replacing.

## 3. Low-priority notes, don't chase this session

- `shutdown.ts`: a single SIGINT during an energy-regen sleep ends the
  whole session, not just that wait — surfaced when the user manually
  topped up energy mid-sleep with no way to signal the running process. A
  full restart is already documented as safe (guard state persists across
  invocations) and is an acceptable answer for now. Not worth building a
  separate skip-signal mechanism unless this becomes a recurring
  annoyance in practice.
- 11 vs. 12 run-dir count mismatch from session 25 — unexplained, doesn't
  affect the gate, not investigated. Leave it; revisit only if it recurs
  or something else depends on the exact count.

---

## Your task

1. Check whether `nextPosition`/`nextMovePath` appears on every fishing
   turn or only terminal docs, using existing fixture data first.
2. If per-turn: validate it against real fish positions across available
   casts before proposing any code changes.
3. Report findings plainly, including if it doesn't hold up — that's a
   legitimate, useful outcome, not a failure to find something.
4. Task 13's deck-representation infrastructure (not the scoring logic) can
   proceed in parallel regardless of §1's outcome.
5. Leave §3's items alone this session.
