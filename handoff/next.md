# BRIEF — session 04

Calling Task 4 a FAIL at the top of `STATE.md` was right. 8 states → 72 across 5
attempts, `lootPhase` captured, §4c rewritten against real fields — that's a
good session that didn't reach its gate, and those are different things.

Two of my errors below, one reinterpretation, one scope call, then the task.

---

## 1. My Shield-heavy advice was wrong, and it generalizes

I told the user to play Shield-heavy to survive to a loot phase. You found the
flaw: **Shield's ATK 6 cannot out-damage armor that fully restores.** That
wasn't a suboptimal line, it was an unwinnable one, and it cost a run.

The general principle, which needs to go into SPEC §4 as a first-class mechanic:

> When armor fully restores on a qualifying win, damage below the restore rate
> deals **zero net progress**. Effective damage is not `ATK`, it's
> `max(0, ATK − armorRestoredPerWin)`.

This is a **threshold, not a gradient**, and it breaks the smooth utility
function in §4b. A move whose ATK sits under an opponent's restore rate has no
offensive value at all — it can only stall. Two consequences:

- The §4b weights can't express this. `w₂·(enemyHP/enemyMaxHP)` treats 6 damage
  as 75% of 8 damage; in reality one may be worth nothing and the other
  everything. Task 5 needs an explicit net-damage term computed against the
  opponent's observed restore behaviour.
- **It partly retracts my session-03 point about survival dominance.** Survival
  still matters across 16 rooms, but a line that cannot break armor isn't
  survival — it's a slower loss. The correct frame is: *maximise net damage
  subject to not dying*, not *minimise risk*.

Add this to SPEC §4 as a named mechanic with the session-03 run as evidence.

## 2. My charge discriminator — I think you're reading it as a null result

You recorded "23 firings, 0 forced" as a dead end because no player was ever
*forced* into a single legal move. But the interesting number isn't the forced
count. It's the zero.

23 opportunities where a move sat at ≤0, and it was chosen **zero times**. If
moves at ≤0 were freely playable and selection were anywhere near uniform, you'd
expect roughly 7–8 such plays. Getting 0 is around `(2/3)^23 ≈ 1e-4`.

That's strong evidence for **H1 (hard prune)** — not a null result. My question 2
was badly worded ("hold a ≤0 move and play a different one"), which is what made
this look like non-evidence. The absence *is* the signal.

Before we act on it, one confound has to be cleared: an agent could avoid
low-charge moves *by policy* rather than *by rule*. So:

- **Split the 23 by actor.** Player rows are contaminated — the user was
  following my guide. Only **enemy** rows are clean evidence. Report the enemy-
  only count and run the binomial against a uniform null.
- **Report the delta distribution** for played moves. The unexplained 1 → −1
  (decrement of 2) is still open. Is −1 the mode? Are there other values? What
  happens to *unplayed* moves between consecutive states?

If enemy-only rows are ≥10 with 0 plays from ≤0, treat H1 as confirmed and write
§4a as a hard prune with the flag defaulting to prune. If fewer, keep the flag
and default to prune anyway, noting the sample size — the asymmetry favours it,
since wrongly pruning costs one option while wrongly permitting costs a
guaranteed-loss move.

## 3. On enemy 63

Calling it Shield-biased off 14 exchanges and having it wash out to uniform over
39 is the same failure as my Shield advice and my discriminator wording: a
confident read off a sample too small to carry it.

You logged it. Good. Make it structural rather than remembered — **§4a's model
must not emit a read below a minimum sample threshold.** SPEC §4a already says
mix 50/50 with uniform below ~20 observations; raise that to a hard floor: below
30 exchanges for a given key, return uniform and expose a `confidence: low` flag
so downstream code can't quietly treat a thin read as a strong one.

---

## 4. Scope call, as you asked

You were right to escalate this rather than discover it mid-task. My call:

**Build the simulator on the clean exchange model, with unmodelled mechanics as
explicit fail-closed inputs — your recommendation. Not hardcoded zeros.**

Plus one addition: **the sim must report coverage as a headline metric.**

```
scored 340 / 1000 runs — 660 unscorable
  412 boons present
  198 status effects (Burn)
   50 rolled enemy stats outside observed range
```

Hardcoded zeros produce a number that looks authoritative and is silently biased
toward room 1. Fail-closed without a coverage metric produces a sim that quietly
scores almost nothing. Coverage makes the blind spot a visible, trackable
quantity — and it turns "how much does the sim actually cover?" into a number
that should climb every session.

Concretely: any run touching an unmodelled mechanic is marked `UNSCORABLE` with
a reason code, never scored as if the mechanic were absent. Task 5 strategy work
is validated only on the scored subset, and any claim about win rate must state
the coverage alongside it.

**Leave the enemy-65 half-damage case and Burn's tick rate unmodelled.** One
sample each is not a mechanic, it's an anecdote. They become reason codes, not
guesses.

---

## Your task — Task 4, and only Task 4

No live runs. **Do not spend energy this session.** The 72-state corpus is
enough, and another watched run would trade a session for evidence you already
have.

1. Simulator per SPEC §6, built on the verified exchange model.
2. Unmodelled mechanics as fail-closed inputs with reason codes; coverage
   reported on every sim result.
3. Real tests — fix the `vitest run` exit 1 with actual test files, not
   `--passWithNoTests`. Hand-build the scenario set from TASKS.md Task 4,
   drawing from the 72 real states rather than inventing shapes.
4. Include a scenario for the §1 threshold case: a low-ATK move against
   restoring armor. The sim should show zero net progress. If it doesn't, the
   armor model is wrong and that's a more important finding than the gate.
5. Run the charge recount in §2 and report it.

Gate: `vitest run` green, 1000 synthetic runs scored against a random-move
opponent, coverage reported. State plainly which branches the corpus still
cannot exercise — per your own rule from session 03.
