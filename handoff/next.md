# BRIEF — session 100 — wire the durability preflight, resolve `triggeredBoons`, and run the 20-cast batch once the ledger resets

**This document replaces the session-99 `next.md`.** Session 99 is executed
and closed — QUESTIONS.md §51, STATE.md session 99. Five follow-up rulings
are recorded as QUESTIONS.md §52–§56; read them before starting.

**Same terms as the last three sessions: every item below is done, or
blocked with a named reason stated up front, before this session ends**
(CLAUDE.md rule 6).

**Both daily ledgers were EXHAUSTED as of session 99** (fishing 20/20,
dungeon 12/12), resetting 11:00 Pacific. **§A and §B below are offline and
can run right now, regardless of ledger state. §C is live and can only run
after the reset** — if this session executes before 11:00 Pacific, do §A
and §B, report the ledger is still exhausted, and leave §C for whichever
session runs next after the reset. Do not wait on §C to do §A/§B.

---

# §A — Wire `DURABILITY_CID` into the fishing preflight (QUESTIONS.md §52)

**Fail-closed first, predictive later — do not build the predictive version
without the data it needs.**

1. Call `/gear/instances/{address}` (or reuse it if a live fishing response
   already bundles the same gear-instance data — check before adding a new
   network call) at the start of a live batch and log the reading.
2. Build the preflight to halt or warn when durability reads at or near 0 —
   we know 0 means "ran dry" (Shroom's reading). This is buildable now, on
   data already in hand.
3. **Do not build a "N casts remaining" prediction yet.** The decrement rate
   is unknown — session 99 recorded Golkan at 40 at equip and two casts
   played since, with no post-batch reading. Add logging that records the
   durability reading before AND after every live batch from here forward,
   so the rate becomes derivable from ordinary play. A future session
   upgrades the preflight to predictive once a few paired readings exist.
4. Pin the fail-closed behavior with a test (a durability-0 fixture that
   the preflight refuses to proceed past, mirroring how the oil-stock and
   rod-durability-estimate checks already gate a batch start).
5. Cross-reference against the user's own "~40-cast estimate" once real
   readings exist — don't replace it as the authority until it's been
   checked against at least one real rod failure (rule 9).

# §B — Resolve `triggeredBoons` (QUESTIONS.md §54, §51's blocking item on CAPTURE-1)

**This is a required item, not optional.** The field that would evidence a
boon proc was empty on all 214 POSTs of session 99's full 4-run day, and it
gates `TASKS.md` CAPTURE-1 — a silent, never-firing evidence channel would
make the five-rolled-stats model unreachable by ordinary play, however many
runs get spent chasing it.

1. **Check the full corpus, not just session 99.** All 79 recorded dungeon
   attempts — has `triggeredBoons` EVER been non-empty on any captured
   state, at any point in this repo's history? This is the load-bearing
   question and it's answerable offline from fixtures already on disk.
2. If it has populated before: find the earliest/any instance, characterize
   what was different about that state (a specific boon type? a specific
   capture path?), and narrow the question from "does it ever populate" to
   "why didn't it this time."
3. If it has never populated, across the entire corpus: that's strong
   evidence the field doesn't populate on this capture path at all (a
   client-side/logging gap) rather than evidence no boon has ever procced
   in 79 runs. Check whether any OTHER field or response artifact carries
   proc evidence indirectly (a damage delta, a status-effect timestamp,
   anything `combat.ts` or the capture pipeline already reads) before
   concluding the game simply never triggered a boon.
4. **State a clear verdict**, not a shrug: "the field is real but rare,"
   "the field doesn't populate on this capture path, use X instead," or "we
   cannot tell yet and here's what evidence would settle it." Whichever it
   is, record it as a QUESTIONS.md entry (next unused number) and update
   `TASKS.md`'s CAPTURE-1 entry to reflect whether this gates it or clears
   it.

# §C — The 20-cast fishing batch, once the ledger has reset (QUESTIONS.md §55)

**Volume, not targeting — §50's "don't shape a batch toward the 0.85 gate"
ruling stands.** This is the user's own instruction for tomorrow's
allocation, not a workaround of that ruling.

1. Confirm the ledger has actually reset before starting (`npx tsx
   scripts/checkFishingCaps.ts` or equivalent) rather than assuming 24
   hours have passed.
2. `--dry-run` first per standing rule-4 discipline — the necessity gate,
   the retired tripwire, and (if §A landed first) the new durability
   preflight are all changes since the last full-size batch.
3. Run the full 20-cast batch. Report at standard depth: catch rate with a
   binomial CI (n=20 finally has real power compared to the recent 2-9 cast
   batches — say so), how many opportunities the 0.85 necessity gate got
   and what it did each time, opening-turn focus spend against the 0.83
   baseline, and the updated cumulative redraw-shadow count (still tracking
   toward §51's ~350-decision target for 80% power).
4. If §A's durability preflight is live by the time this runs, report its
   first real reading before and after the batch — this is the first
   opportunity to start deriving the decrement rate §A's task 3 needs.

---

## Recap, for the whole session

Full suite, `tsc --noEmit`, `git diff --check`, secret scan — once, at the
end. State explicitly, at the top of the recap, the status of §A, §B, and
§C: done, done-with-a-named-caveat, or blocked-with-a-stated-reason (§C
being blocked on "ledger not yet reset" is an acceptable, expected reason —
say so plainly rather than leaving it ambiguous whether it was attempted).
