# BRIEF — session 58 (settle the orb rule with a number, then the flip's first live run)

## PRECONDITION — §19, and the clock

At the time of writing it is **23:48 PT on 2026-08-19**; the caps reset at
**11:00 PT on 2026-08-20, 11.2 hours out**. A session beginning before then is
blocked for an **eighth** time.

`npx tsx scripts/checkFishingCaps.ts` first, free, one GET. Unspent → 20 casts,
then `npx tsx scripts/matcherWeightReport.ts --last-casts=20`, and §19 is done.
Spent → skip fishing entirely; everything below stands on its own.

**The dungeon caps are on the same 11:00 PT boundary.** §2's run needs 60 energy
and 3 of 12 run-units, so check `checkDungeonToday` too before planning it.

---

## 0. §24 can be settled offline, and the reason the recap thought otherwise is worth keeping

Session 57 wrote that "no offline experiment can settle it — the sim cannot
separate two boon policies at n=2000," citing §2e's null. **That inference does
not hold, and the distinction generalises past this question.**

§2e failed to *detect a difference*. §24 does not need one detected — it needs
one **bounded against a threshold**, and the threshold is computable from
numbers already in the recap:

```
A (baseline)      18.580 orbs/decision
C (wide, unshipped) 20.391 orbs/decision
break-even ratio  A/C = 0.911  →  C wins unless it costs >8.9% of depth
at the sim's mean 3.286 rooms  →  break-even DROP = 0.292 rooms
sim 95% half-width at n=2000   =  0.115 rooms
                                  0.292 / 0.115 = 2.5x the noise floor
```

**A test whose precision exceeds the decision threshold is informative even when
it comes back null.** An underpowered failure-to-reject tells you nothing; a
null at ±0.115 against a 0.292 threshold tells you the harm is smaller than the
gain. Those are different results and §2e's null was being read as the first
when it is available as the second. Worth a line in the recap, because this
project has several "cannot be measured" conclusions and at least one of them
was really "was not measured against the right threshold."

---

## 1. The orb depth experiment — do this before the run

User decision: settle §24 with the experiment, then ship whichever wins.

**Set the decision rule now, before any numbers exist** — same discipline as
§19's, and for the same reason:

- Run C vs B (shipped) through `dungeonSim`, **mean rooms cleared, n = 8000 per
  arm** (half-width ~0.058, giving 5x margin on the 0.292 threshold rather than
  2.5x). Same seed policy for both arms; the only difference is the boon rule.
- **Ship C if C's depth loss is < 0.15 rooms** — half the break-even, deliberately
  conservative for the reason in the next paragraph.
- **Do not ship, and report as unresolved, if the loss is between 0.15 and
  0.292.** That is the band where the sim's caveat could plausibly flip the sign.
- **Do not ship if the loss exceeds 0.292.** C is net-negative and §24 closes as
  answered-no.

**Why the margin, stated honestly:** `dungeonSim` still fights Safe tier by
default (session 57 documented this deliberately — raising it would only make
the sim refuse to score). The bot now fights the hardest tier. Boon quality
plausibly matters *more* when fights are harder, so a null measured under Safe
conditions may understate C's real cost. The margin is the price of that
caveat. Say in the recap that the experiment was run under Safe-tier conditions
and what that does and does not license.

Also report **orbs per run**, not only per decision. The 552-decision report
holds the run fixed and therefore cannot see the thing the whole question turns
on: orbs compound with depth, so a policy that gains 1.81 per decision and
costs a room can still lose. `orbs_per_run = mean_rooms × orbs_per_decision` is
the quantity being maximised and it should appear in the output.

---

## 2. The first live run under the flip — AUTHORISED

User go-ahead given for **one** run, rule 11 terms: 60-energy juiced,
`--juiced-index=3`, 3x Big Heal Juice, `--runs=1`, stop and hand back. Run it
**after** §1 resolves, so it exercises the final boon policy rather than an
interim one.

```
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1 > logs/run-58-1.log 2>&1
```

Redirect and `tail`; never pipe a live run to a truncating reader (session 52).

### 2a. The silent failure to watch for, in room 1

`final-room-unreadable` falls back to conservative no-modifiers. If
`ROOM_NUM_CID` reads wrong live, **every room takes the lowest tier and the run
looks completely normal** — the flip silently does not happen and 60 energy buys
a lowest-tier run indistinguishable from the last fifty. Session 57 found this
exact shape in the old tests: they served state with no `data.entity`, `roomNum`
came back 0, and post-flip that is the unreadable branch, so they would have
passed while the loop took the lowest tier.

**Room 16 is unreachable — the deepest run ever is room 10 — so any
`final-room-unreadable` on this run is a bug, not a legitimate branch.** Check
the first `tier_choice` log line as soon as it appears: tier taken should be the
**highest** offered (minus any Perpetual filter). If it is the lowest, or if the
`⚠ final-room-unreadable` label appears at all, **stop the run and investigate
before spending the rest of the entry.**

### 2b. Recovery paths, so nothing gets improvised at 60 energy committed

- **`PerpetualOnlyOfferError` halts mid-run.** 0 of 134 corpus offers are
  entirely Perpetual so it should never fire, but an unfired branch that halts
  is exactly the kind that surprises. If it does: the run is **not lost** —
  resume with `--resume-existing --potions=3 --potions-used=<n>`, and capture the
  full offer first, because it would be the corpus's first all-Perpetual sighting
  and worth more than the run.
- **Expect to die shallower than room 10.** Every fight is now the hardest
  offered. A shorter run is the *cost side of the flip*, not a regression, and
  n=1 says almost nothing either way. Do not read a room-4 death as evidence
  against rule 8, and do not read a room-10 run as evidence for it.

### 2c. What to report

- Tier **offered vs taken** in every room, with the full offered tier set.
- How often **Perpetual filtered** the top choice — expected ~35% of offers.
- Whether `final-room` or `final-room-unreadable` appeared at all.
- **Orb totals**: `orbsOffered` vs `orbsTaken` per decision, and the run sum.
  This is the first live orb data the project will have.
- **§23's tight energy probe finally fires** — it has been armed and unfired
  since session 54. Report whether the pair around `start_run` reads −59 or −60.
  That single number splits "the 3x multiplier miscounts" from "something inside
  the run credits 1 back", and it has been open for four sessions purely for
  want of a run.
- Loot, score, rooms, juice consumption and when.

**This is the only data that will ever exist on what a chosen hard win pays.**
The bot took the lowest tier on every unforced decision it ever made, so there
is no historical comparison and there never will be. Capture it carefully.

---

## 3. Standing items, unchanged

- **`boonCapture` stays OFF.** Let the directive's free by-product coverage
  accumulate from ordinary play; re-ask after a few runs.
- **Do not gate a dungeon strategy change offline** (session 57 §4) — with the
  one exception §1 establishes: a *depth* comparison against a computed
  threshold is still valid, because depth is the one thing the sim measures with
  usable precision. Scored-exchange coverage is gone; mean rooms cleared is not.
  Do not let §1 be read as a general reopening.
- **Do not widen a rule to make it fire.** If §1 says don't ship C, §24 closes.

---

## Your task (session 58)

1. **Precondition** — `checkFishingCaps.ts` and `checkDungeonToday`. §19 if
   unspent; it is minutes and it has waited seven sessions.
2. **§1** — the C-vs-B depth experiment at n=8000, decision rule applied as
   written above, orbs-per-run reported alongside orbs-per-decision.
3. **§2** — one juiced run under the final policy, with the room-1 flip check
   before it is allowed to continue, and the full report including §23's probe.
4. **§0** — the threshold-vs-detection note in the recap.
5. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit; no test writes a real data path; secret scan before handoff.

**Honest expectation.** §1 is an hour of compute and it either ships a 9.7%
orb gain or closes a question — both are good outcomes and neither needs a
judgement call once the rule above is fixed in advance. §2 is the session's real
event: a code path with 1014 passing tests and zero live exercise, driving the
first fight this bot has ever deliberately chosen to make harder. The most
likely failure is not a crash — it is `final-room-unreadable` firing silently
and the run coming back looking exactly like every previous one. §2a is there so
that gets caught in room 1 rather than in the recap.
