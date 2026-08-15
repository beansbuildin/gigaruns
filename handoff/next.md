# BRIEF — session 14

The mana fix was worth more than either of us expected — 19.0% → 92.4%, and it
only surfaced because you checked whether the second bug was *downstream* of the
first rather than stopping at one. `shouldRedraw` comparing `evPerMana` was
invisible while `chooseCard` shared the same wrong objective. Finding a latent
bug that only becomes reachable after fixing another is the hard kind.

The `use_item` probe landing a clean 400 with `"Item not found in index"` is
exactly the outcome hoped for: action name, envelope, and `itemId` semantics all
confirmed at zero exposure.

Now the thing I want to reframe.

---

## 1. The fishing sim says 92.4%. Live says 0 for 6. That's the alarm.

You filed this as "an optimistic ceiling, not a live prediction." It's much
stronger than that.

Six real casts (1 human + 5 bot), zero catches. If the true catch rate were even
50%, the odds of six straight escapes are about 1.6%. At 92.4% it's roughly one
in five million. **The sim and reality are not describing the same game.**

Session 11 established the sim-vs-live divergence check for exactly this
situation, and it's worth noting the contrast: the dungeon sim predicted 1.946
mean rooms cleared against a live 2.0, which is what licensed trusting its
conclusions. The fishing sim has no such license. **Until it predicts live
outcomes, no number it produces should be used to justify a design decision —
including the 92.4% that gated Task 8 in.**

Treat that as the standing rule the session-11 check implied but didn't spell
out: a sim's authority comes from its agreement with live, and it's held per
domain, not inherited across them.

## 2. `focusMeter` probably explains it — and it guts the strategy I specified

The 3-point non-regenerating budget, with movement costing Manhattan distance,
is a hard constraint on the exact thing my §5 policy depends on.

I wrote: *hedge throughout — wide hitboxes, focus placed over the
highest-probability region.* That assumes focus placement is free. It costs a
scarce, non-refilling resource across a cast that only affords ~5 plays. Under
that constraint, you get roughly **one meaningful repositioning per cast**, not
one per turn. Hedge-throughout as written isn't affordable.

So the policy needs re-deriving under the real budget, and the shape probably
inverts: focus placement becomes a **commitment decision** — where do I spend my
one move, and when — while card choice does the per-turn adapting from a mostly
fixed position. That's a different optimisation from the one in SPEC §5.

**This is the session's work, and it's offline and free.** Model `focusMeter` in
`castSim.ts`, re-run the 500-cast sim, and report the new catch rate. Two
possible outcomes, both informative:

- **Catch rate collapses toward the live 0/6** → the sim is now faithful, the
  divergence is explained, and the strategy gets re-derived under a constraint
  we understand.
- **It stays high** → `focusMeter` isn't the explanation and something else is
  wrong. Next suspects in order: the synthetic pattern library bearing no
  resemblance to real Dendren (the matcher ran on `emptyFallback` for all five
  casts), the deck/card set, and `fishHp` or damage scaling.

Don't spend more casts until this resolves. More live data against an
unfaithful sim buys transitions but not understanding, and the transitions
accumulate cheaply once the sim is worth trusting.

## 3. Q1: the fishing sim is the spine — neither of your options

You framed it as Stage B versus more casts. I'd do neither as the spine, for the
reason in §2: fishing's blocker isn't data volume, it's that the model is wrong.
25 transitions won't mine patterns, and 50 won't either if the simulator around
them is describing a different game.

**Task 12 Stage B rides along cheaply.** The only thing blocking it is the
`consumables` field shape, which is one `start_run` away. Check
`/items/balances` for an actual heal potion first, then send `start_run` with a
single potion in `consumables` and see what the state reports. If the field
takes item IDs it'll work; if it wants slot indices or objects, the error names
it — same logic as the `use_item` probe.

Don't build the timing policy from that. Just establish the field shape and stop,
so Stage B still gets a clean session.

## 4. Q2: resume the stuck run first

Yes — first action, before anything else. At 4/36 against a full-health enemy
it's likely a loss, but closing it out cleanly beats leaving live state dangling
across sessions, and it costs no run slot.

It's also the natural place for §5's focus probe if any fishing budget remains.

## 5. Q3: `focusMeter` regeneration is now critical, and it's nearly free to test

This moved from optional to blocking — §2's re-derivation can't be done without
knowing whether the budget refills per turn, per hand-refill, or never.

Test it deliberately on the next cast: **spend all 3 points early**, then keep
playing and watch whether the meter moves. Normally that would be a wasteful
line, but at 0 catches in 6 there's nothing to protect, and the answer determines
the whole policy shape.

Scope Task 11's fishing-side mining to include `focusMeter` — it's not a side
mechanic, it's the binding constraint.

## 6. For the user: Sword ATK and Sword DEF are now tied

The re-measured sweep puts them at 2.429 ± 0.070 and 2.427 ± 0.073 — overlapping
intervals, so the session-12 ranking that put ATK alone at the top no longer
holds under the hp 34→36 baseline. Either is the right pick; nothing else is
close.

Keep re-measuring the sweep whenever the loadout changes. That's twice now that
a gear shift has reordered results.

---

## Your task

1. **Resume the stuck run**, per §4. First.
2. **Model `focusMeter` in `castSim.ts`**, re-run the 500-cast sim, report the
   new catch rate against the live 0/6. This is the spine.
3. **Re-derive SPEC §5's policy** under the real focus budget, per §2 — only
   after the sim's new number is known.
4. **`focusMeter` regeneration probe**, per §5, if fishing budget allows.
5. **`consumables` field-shape test only**, per §3. Do not build the policy.
6. Record the §1 rule: sim authority is earned per domain against live outcomes,
   never inherited.

If §2's re-run leaves the catch rate high, say so plainly and list what you'd
check next. A sim that survives an attempt to break it is worth more than one
that was never tested — but it has to be a real attempt.
