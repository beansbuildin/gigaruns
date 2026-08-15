# BRIEF — session 12

Task 7 passed and the fishing half is open after eleven sessions blocked. Item
metadata fell out of the same capture. And the death histogram held its shape at
n=9 — exactly even across rooms 2/3/4, replicating n=6 independently.

Flagging the gear-change discipline first: re-measuring the gate against the new
loadout and explicitly marking session 10's numbers non-comparable is the right
handling. 92.9% vs 86.4% would have looked like a huge model win. It's Sword ATK
16→20.

---

## 1. Answering Q1: fishing. And your dungeon framing left out the real lever.

You framed the dungeon's remaining options as opponent-model depth or capture
past room 4. Both are thin-data problems that **fill themselves** as production
runs accumulate — slopes, not steps, and neither needs a session dedicated to it.

The lever you listed separately under Q3 is the big one: **potions are +4/+8/+20
flat against a ~32 HP pool.** Three of them is potentially 60 HP — roughly two
full health bars — in runs that currently die at room 2, 3, or 4. Nothing in the
utility function is that size. Weight tuning moved 0.03 rooms.

But it's blocked on one user answer (§3), so it can't be the session's spine.

**So: Task 8, fishing strategy.** Reasons, in order:

- It's the only fully unblocked direction, and it's half the original project.
- The dungeon bot already works and produces value. Running it in production
  *while* fishing gets built accumulates exactly the rooms 2–4 opponent data the
  dungeon diagnostic needs. The blocked path unblocks itself in the background.
- Splitting effort across both is the thing worth avoiding, and you were right
  to ask rather than guess.

If the user answers §3 mid-session, fold the potion work in — it's small once
the trigger mechanism is known.

## 2. SPEC §5 was wrong, and it breaks more of the fishing design than it looks

I wrote "3×3 grid" from the public docs. Live capture: **4×4 with the
bobber/focus mechanic enabled**, hitboxes relative to a movable `focusPoint`,
not absolute cells. Good catch, and correcting SPEC with the capture cited
rather than patching around it was right.

Two consequences the correction doesn't yet carry, both of which change §5's
strategy design:

**The hypothesis-elimination core survives; the card-choice math doesn't.**
Pattern identification still works — fish movement is still drawn from a finite
pattern library, and each observed transition still prunes candidates. But EV
per card was written for fixed hitboxes over absolute cells. With a movable
focus, the action is a **(card, focus placement) pair**, and EV integrates over
where you put the focus. Re-derive that section; don't adapt it.

**Convergence may be too slow to matter, and that's the strategic finding.**
16 cells instead of 9, and the captured cast ended after ~5 card plays. If the
pattern library is large, `|H|` may never reach 1 before the fish escapes — in
which case the "identify then exploit" framing is wrong for Dendren and the
right policy is **hedging throughout**: wide hitboxes, focus placed to cover the
highest-probability region, damage sacrificed for hit probability.

Don't assume either way. Measure it: from the captured cast plus whatever the
sim can generate, report **how many observations `|H|` needs to converge versus
how many plays a cast actually affords.** That ratio decides the entire policy
shape, and it's answerable before writing the card chooser.

## 3. Q3: yes, ask — and I've asked the user directly

`OnUseBattle` reading as a manual action **contradicts** the pre-committed
loadout I recorded in session 11, and I may have downgraded the task too early on
that basis. The branches differ substantially:

- **Auto-proc on a threshold** → loadout selection only. Which three potions,
  static, solvable in sim. Small.
- **Manual mid-battle** → the optimal-stopping problem is back. Loadout
  selection *and* timing, and `use_item` needs confirming before any live use.

Put both branches in `TASKS.md` so whichever answer arrives is ready to build.
Do not model either speculatively.

Either way, `use_item` stays `[VERIFY]`. If it turns out to be needed, confirm
it on a run already lost — never speculatively mid-run.

## 4. Q2: keep the test queued, but run the free analysis first

0/3 after 17/5 is a real change and 3 runs is too thin to write it off. Before
spending a live attempt, there's a free check: **were session 09's 17 failures
clustered in time, or spread across the batch?** Clustered means a server-side
window and closes the question at zero cost. Spread means it's request-shaped
and the envelope test is worth keeping.

That's a log query, not a run. Do it, then decide.

## 5. Gear is a bigger lever than anything in the model — tell the user

Sword ATK 16→20 moved mean rooms cleared from 1.632 to 2.103 on the always-Sword
baseline. That single gear change beat every strategy intervention attempted
across sessions 10 and 11 combined.

The sim can now answer *which upgrade is worth most* — cheaply, offline, with no
energy. Run a sweep over plausible single-stat upgrades (each move's ATK and DEF,
max HP, max armor) at the current loadout and report the ranking by mean rooms
cleared.

That's a concrete, actionable output for the user's own progression decisions,
and it costs one sim batch.

---

## Your task

1. **Task 8 — fishing strategy.** Hypothesis-elimination matcher, transition
   logging from the first cast, and the `(card, focus)` EV re-derivation per §2.
2. **§2's convergence measurement first** — it decides whether the policy is
   identify-then-exploit or hedge-throughout. Report the ratio explicitly.
3. **§5 gear sweep.** One sim batch, ranked output.
4. **§4 clustering analysis** on session 09's logs.
5. Both potion branches into `TASKS.md` per §3, unbuilt.
6. Production dungeon runs if budget allows, to accumulate rooms 2–4 opponent
   data in the background. Not the session's focus — just don't leave the budget
   idle.

Task 8's gate is unchanged in `TASKS.md`, but note it was written against the
3×3 assumption. If the 4×4 reality makes it unrunnable as written, say so at the
**start** of the session rather than at the end — per the session-06 rule about
gates you believe are unreachable.

Addendum — potion trigger CONFIRMED MANUAL (resolves §3, Q3):

USER-CONFIRMED: potions are CLICKED to use during a run. They do not
auto-proc. Combined with the pre-committed loadout, the full shape is:

  1. SELECT 3 potions before start_run (pre-committed, user-confirmed
     session 11) -- goes in `consumables: []`, currently always empty.
  2. USE them manually mid-run, one click each -- almost certainly the
     `use_item` action.

This REVERSES the session-11 addendum's downgrade. The optimal-stopping
problem is back, and it is now the largest identified dungeon lever:
+4/+8/+20 flat heals against a ~32 HP pool, in runs dying at rooms 2-4.
Restore it in TASKS.md as its own task with its own gate; delete the
auto-proc branch from §3.

BLOCKER: `use_item` is still [VERIFY], from the source that got
loot_one (409) and enemy_two (400) wrong. Confirm it before any
policy work depends on it. Confirm ONLY on a run already lost -- get
to a state where death is certain, then send `use_item`. A 400 costs
nothing there and a 200 confirms the action name, the envelope, and
the data shape in one attempt. Never speculatively mid-viable-run.

Also unknown, and needed before the policy is buildable:
  - Does using a potion consume the turn, or is it free? This is the
    whole cost side of the decision. If it costs a turn, using one is
    a tempo trade; if free, the only cost is scarcity.
  - Can two be used in the same battle?
  - Does `consumables: []` take item IDs, slot indices, or objects?
    The three heal potion IDs are known from /offchain/static.
  - Are potions consumed on use even if the run then fails?

The turn-cost question determines whether this is simple scarcity
allocation or a genuine tempo-vs-survival tradeoff. Establish it from
the lost-run confirmation attempt if possible.

SEQUENCING: this does NOT displace Task 8 (fishing) as this session's
spine -- fishing is fully unblocked, potions need the use_item
confirmation first. Do the confirmation opportunistically on the next
run that is clearly lost, then build the policy next session.