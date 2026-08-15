# BRIEF — session 13

Task 8 passed, and replaying the real cast against SPEC before writing strategy
code caught two contradictions that would otherwise have been baked into the
matcher. That ordering — validate the spec against the corpus, *then* build — is
now the third time it's paid off.

---

## 1. My §5 was backwards on every count, and one consequence isn't propagated yet

I wrote the catch meter as rising on a hit and falling on a miss. Reality is the
inverse: a hit drives `fishHp` toward 0 (the catch), a miss drives it toward
`fishMaxHp` (the escape). Every sentence I wrote about it was wrong.

But the detail that matters most is the one you found incidentally: **the real
cast escaped at `fishHp == fishMaxHp` with mana still at 5/10.**

That refutes a load-bearing assumption in my §5 design. I wrote:

> pick `argmax EV(card) / card.manaCost` — mana is the real budget

**Mana is not the budget. Misses are.** The cast ended with half the mana
unspent, because the miss counter hit the ceiling first. Dividing EV by mana
cost optimises against a constraint that isn't binding, and it will systematically
prefer cheap low-probability cards over expensive reliable ones — exactly
backwards when every miss is a step toward losing the cast.

Check whether `cardChoice.ts` still carries that divisor. If it does:

- **Maximise hit probability per turn.** Mana becomes a feasibility filter
  (can I afford this card?), not a denominator.
- Keep a mana-aware term only for the endgame — if remaining mana can't cover
  enough turns to finish the fish, efficiency starts mattering again. That's a
  late-cast correction, not the primary objective.
- Re-run the 500-cast sim after the change. If catch rate moves from 19.0%,
  the divisor was costing real performance.

This also composes with your convergence finding. Hedge-throughout plus
maximise-hit-probability is one coherent policy: **wide hitboxes, focus placed
over the highest-probability region, damage and mana both sacrificed for the
chance to connect.** Identification is a bonus when it happens, never the plan.

## 2. Q1: Task 9 is the spine — and Task 12's blocker is free, not a session

You framed these as competing for one supervised session. I don't think Task 12
needs one.

**`consumables: []` is currently always empty.** So sending `use_item` right now
risks nothing — there is no item in the loadout to consume. The response
resolves the question by itself:

- `404`/`405` → the action name is wrong, same as `loot_one` and `enemy_two`.
- `400` with a meaningful error (no such item / invalid index) → **the action
  exists**, and the error text usually names the argument it wanted.
- `200` → unexpected with an empty loadout. Dump it and stop.

Either way `use_item` gets confirmed with zero exposure. Do it late in a run
that's already going badly, so a burned action token costs the least, and let
`postWithVerifiedRetry` re-sync afterwards.

That's a probe, not a stage. **Task 12 doesn't need doomed-state detection at
all** — that requirement came from my session-11 addendum, which assumed the
loadout would be populated. It isn't yet, and that makes the probe safe.

So: **Task 9 (live fishing) is the session's spine.** The matcher and EV engine
are built and idle, and every cast produces real transition data that feeds §3.

Note Task 9 doesn't need the user to play — same staging as Task 6 (dry run →
one cast → five), run by you. Add a fishing energy budget line to
`config/bot.json` before the first cast: casts are 12/16/20 energy against the
same pool the dungeon draws from, capped at 10/day.

## 3. Q2: park Task 11

Three independent confirmations of the flat histogram (n=6, n=9, n=11) and a
null result at 10× weight amplification. The evidence is settled and the lever
is exhausted.

The opponent-model read at rooms 2–4 stays parked too — it improves passively as
production runs accumulate, and it's a slope, not a step. Potion timing is the
identified lever; once §2's probe lands, Task 12 becomes the dungeon's next real
work.

Take Task 11 off the active list in `TASKS.md` and say what would revive it: a
materially different utility *form* (not magnitude), or the histogram shifting
shape as the corpus grows.

## 4. Q3: agreed, and it happens automatically

Re-running convergence against `data/fish-patterns.jsonl` once Task 9 produces
real transitions is right, and the honest framing of the current numbers as a
stand-in library is right too.

One thing to watch when the real data lands: if real Dendren convergence is
*better* than the synthetic pool suggests, the hedge-throughout default may be
over-conservative. Don't let the synthetic conclusion calcify into an assumption
— it was a decision made under a documented placeholder, and it should be
re-opened, not defended.

## 5. Give the user the full gear ranking

Sword ATK +4 at +0.305 rooms is roughly ten times anything strategy tuning has
produced, and it's a decision the user makes with their own resources.

Put the **complete ranked table** — all 8 upgrades with means and CIs — in the
recap, not just the winner. Flag which gaps are inside each other's confidence
intervals, so the user can tell a real ordering from noise. This is the most
directly actionable output the sim has produced.

---

## Your task

1. **§1 mana-divisor check** in `cardChoice.ts`. Fix if present, re-run the
   500-cast sim, report whether 19.0% moved.
2. **§2 `use_item` probe** — late in a poor run, empty loadout. Report the exact
   status and body.
3. **Task 9 — live fishing**, staged: dry run → one cast → five. Log every fish
   transition to `data/fish-patterns.jsonl` from the first cast.
4. Fishing energy budget in `config/bot.json`, per §2.
5. Park Task 11 per §3, with revival conditions stated.
6. Full gear ranking in the recap, per §5.

If the `use_item` probe confirms the action, **do not** build the potion policy
this session — record it and let Task 12 have a clean session. One variable at a
time, same as always.
