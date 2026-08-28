# BRIEF — session 105 — an 18-cast fishing batch (rod durability limit — pause for repair before any further casts), plus two offline dungeon items left from session 104

**This document replaces the session-104 `next.md`.** Session 104 is executed
and closed — both its parts GATE PASS, STATE.md session 104. **Before doing
anything below, read STATE.md's "Settled — do not re-open" digest and
`DECISIONS.md`'s 2026-08-26 block.** Session 104's own brief re-asked
something §58 had already resolved in session 101, and STATE.md now says
plainly: *"a future brief must not repeat it."* Nothing in this brief should
duplicate an entry in that digest — if anything below looks like it might,
that's this brief being wrong, not the digest being stale.

---

# Part A — the fishing batch, capped at 18 casts, then STOP for a rod repair

**The user's own instruction: this session pauses at 18 casts so the rod can
be repaired before any more are spent.** This is not the daily cap (20) —
it's the rod. Golkan read 18 durability as of session 102, decrementing
exactly 1.00/cast (n=20, session 102), and is being repaired, not replaced
(digest: "Golkan, being REPAIRED not replaced"). Do not request 20 casts and
let the preflight fail closed partway through — request 18 explicitly,
because that number is already known, and stop there even if the real
durability reading comes back higher than expected.

1. **Confirm before assuming, on both axes:**
   - `npx tsx scripts/checkFishingCaps.ts` first — go by what `dayDocs[pondId
     2]` actually reads, not by how much wall-clock time has passed since
     session 102's 20/20.
   - Read the current rod durability (whatever live path the session-100
     preflight uses) before running anything. **18 is the expected reading,
     not an assumption to skip verifying.** If it reads anything other than
     18, use the real number to decide the batch size — the rule is "stop
     before the rod hits 0," not "always run exactly 18."
2. `--dry-run` per standing rule-4 discipline before spending anything live.
3. Run up to 18 casts (or fewer, per step 1's real reading), under the
   already-shipped, already-autonomous policy — no new approval needed for
   any of these, per standing directive:
   - On-demand Relaxing-Oil-only necessity gate, composed with the
     double-lethal band (shipped, session ~97-98 per the digest's redraw/oil
     entries — do not re-derive it).
   - Redraw stays disabled (`redrawEnabled: false`) — the digest says this is
     CLOSED; log the shadow trigger as usual but it changes nothing live.
4. **Stop at 18 (or the real durability ceiling), full stop — do not attempt
   any cast beyond it even though 2 more would fit inside today's 20-cast
   daily cap.** This is an intentional, expected mid-batch halt, not a
   failure to report around. Say plainly that the remaining 2 casts of
   today's daily allowance are being left unspent on purpose, pending the
   repair.
5. **Take a durability reading immediately after the final cast**, the same
   paired-reading discipline session 102 used, specifically to see how the
   preflight behaves right at the boundary (durability reaching 0, or
   whatever floor is actually reported) rather than assuming it degrades the
   same way it did over casts 1-18 of the original bracket. This is new
   information session 102 couldn't get, since that batch never ran the rod
   all the way down.
6. Report at standard depth: catch rate with a binomial CI against the
   corpus baseline, opening-turn focus spend, oil spend under the shipped
   policy, and the necessity-gate opportunity count — same shape as session
   102's report, not a new format.
7. **After the batch, re-read `checkFishingCaps.ts` before reporting
   anything** if any cast comes back denied, blocked, or interrupted —
   CLAUDE.md rule 13 stands regardless of which resource (casts, durability)
   is at issue.

---

# Part B — two offline dungeon items left from session 104, zero live spend

Both are things STATE.md session 104 named as genuinely still open — neither
is in the "Settled" digest, and neither should be confused with the proc
effect-size work that digest says is done.

## B1 — tenacity pick-order, across the FULL dungeon corpus, not just session 103's 4 runs

Session 103 saw tenacity's fire rate move with where `AddTenacity` sat in the
pick order (pick 5 of 8 → 6/54; pick 6 of 7 → 0/38) at n=4 runs — too thin to
be a rule. Session 104's presence/absence split (5.26% vs 0.73%, p =
2.23e-05, direction only per the digest's own caveat about clustered
exchanges) answered *whether the boon is picked*, not *where in the run it
was picked*. That's still open.

- Pull pick-order data from the **full 83-attempt dungeon corpus**, not just
  the 4 most recent runs — every prior run that picked `AddTenacity` at some
  point has a recorded position, and this doesn't need new live data to
  start looking at.
- State plainly whether the corpus has enough `AddTenacity` picks at varied
  positions to say anything, or whether — like `SecondWind`/`Steadfast` —
  this is real but not reachable by mining ordinary play. Session 104's open
  question 3 asked this explicitly; answer it rather than leaving it posed
  again.
- If a pattern holds, state it as a measured fired/unfired effect the same
  way §62 did, not as a correlation. If it doesn't, say so and recommend
  retiring the question, the same way SecondWind/Steadfast were retired in
  the digest, rather than leaving it to be re-asked a third time.

## B2 — pre-register what would count as a valid Tier-1 Hard Core measurement

The ~quarter-of-Tier-3 figure for Tier-1's Hard Core payout is a
**derivation** (`dropMultiplier` 4→1, projected off session 103's 30,960),
not an observation — every juiced `start_run` this bot has ever sent used
`index: 3`, 34 of 34. Session 104's open question 2 asked whether the first
live Tier-1 run should be shaped to measure this, and flagged the real
problem: loadout and room depth vary run-to-run, so one run may not separate
the tier effect from ordinary variance.

- **Zero live spend for this item — it's a planning document, not a run.**
  Write down, before any Tier-1 run happens, what would actually count as
  evidence: how many runs, held against what (the same loadout across them,
  per the user's "stable going forward" ruling), and whether comparing
  against session 103's Tier-3 runs at the same rooms-reached is a fair
  baseline or too confounded by the loadout changes already known to have
  happened in that corpus.
- This does not authorize or schedule a live Tier-1 run. That's still a
  separate go-ahead under rule 11, whenever the user next wants one — this
  just means the session that runs it isn't figuring out its own measurement
  plan in real time while a run-unit ticks down.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan. State explicitly, at the top of the recap: how many casts the fishing
batch actually ran (18, or the real durability-limited number) and the
post-batch durability reading; and, for the dungeon side, whether the
pick-order question resolved, stayed open for lack of corpus support, or is
recommended for retirement — plus the Tier-1 measurement pre-registration in
full, ready for whoever runs that first live run.
