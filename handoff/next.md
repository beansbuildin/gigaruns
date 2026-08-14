# BRIEF — session 05

Gate pass with three corrections that each refute a prior CONFIRMED line, and an
honest headline that `deepestScorableRoom` is 1. That last number is the most
useful thing in the recap, and it reshapes the plan below.

---

## 1. All three corrections accepted

**Armor doesn't refill at room transitions.** Accepted, and note how narrowly
this was caught: four boundaries, three uninformative because the player sat at
cap. One informative sample. That's a good catch and a thin thread — flag in
SPEC that it rests on a single observation and should be re-checked whenever the
corpus grows.

Downstream consequence to record: **armor is a depleting resource across all 16
rooms, not a per-room reset.** That raises the value of armor and heal boons
considerably, and it makes late rooms structurally harder than early ones in a
way §4b never modelled.

**My §1 net-damage rule was wrong.** Accepted. The corrected form, for the
record:

- **Win:** full ATK to the loser. No offset. The loser regenerates nothing.
- **Tie:** `max(0, myATK − theirDEF)`, both directions.
- The threshold I described exists — I attributed it to the wrong branch.

I'd rather have been wrong this way than have the check quietly tuned to pass,
and the reason it was caught is that the brief said a failing threshold check
outranks the gate. **Keep that standing instruction.** When a verification fails,
the default assumption is that the model is wrong, not the check.

One strategic implication worth carrying into Task 5: **ties are not neutral,
and their value depends entirely on which move ties.** A Sword tie at 16 ATK
against DEF 6–7 does real damage; a Shield tie at 6 ATK against DEF 6–8 does
literally nothing. So under genuine uncertainty, tying with a high-ATK move
strictly dominates tying with a low-ATK one — a consideration the current EV
engine has no term for.

**Phantom exchange in the charge count.** Accepted. The boon pickup being
admitted as combat is exactly the kind of error that makes a clean-looking
dataset lie, and finding it invalidated a claim in your own favour.

## 2. Charge recount — your math is better than mine

`p ≈ 0.012` on 11 clean enemy rows, not my `1e-4`. My estimate assumed every
opportunity offered all three moves, which inflated it by roughly an order of
magnitude. Your correction stands.

Defaulting `chargesAreHardLimit` to `true` on 0.012 plus the cost asymmetry is
the right call, and logging it as an explicit reversal rather than a silent flip
is what makes it auditable later. Leave the flag in place — if the corpus grows
and enemy rows reach ~30 with the pattern holding, tighten it then.

---

## 3. `deepestScorableRoom = 1` is now the bottleneck — new task before Task 5

This is the important finding. A scored run is by construction a room-1 death,
so run win rate is structurally 0 and carries no signal. But the problem isn't
the metric — it's that **boons are unmodelled, and clearing a room requires
taking one.**

Everything downstream is unvalidatable until that changes: the §4b weights, the
depth bonus, and all of §4c loot ranking are strategy for rooms the sim cannot
reach. Tuning strategy against room 1 while the real run is 16 rooms deep would
be optimising the only part of the game we can see.

**So: insert Task 4.5 — model boons — before Task 5.**

Session 03 captured verbatim boon shapes and reached room 4 across five
attempts, so there should be several state pairs bracketing a boon pickup.
That's enough to verify a delta model for the boon types actually observed.

- Model boons as state deltas applied at pickup, derived from before/after pairs
  in the corpus. Nothing inferred from the option text alone.
- Boon types **not** observed with a before/after pair stay unmodelled and
  fail closed with a reason code, exactly as now. Don't guess from names.
- Gate: **`deepestScorableRoom` ≥ 4**, matching corpus depth, with coverage
  reported. If the corpus can only support room 2, that's the honest answer —
  report it and say what capture would extend it.

If it turns out the corpus lacks clean before/after boon pairs, say so and stop.
That's a capture request for a watched run, not something to infer around.

## 4. Task 5's gate, restated

You're right that it's unrunnable. Replacing it:

> **Gate:** On the scored subset, the strategy engine beats the always-Sword
> baseline on **mean rooms cleared per run**, by a margin exceeding the 95%
> confidence interval over ≥1000 runs. Report alongside it: room-1 battle win
> rate, coverage percentage, and `deepestScorableRoom`. Any win-rate claim
> stated without its coverage is not a result.

Three reasons for this shape. Rooms cleared is the honest proxy for items per
energy, which is what the bot exists to maximise. A confidence interval beats
the arbitrary 15% I originally wrote — the threshold should come from the data's
own variance, not from a number I picked. And requiring coverage next to every
claim keeps the room-1 blind spot visible instead of buried.

Note the baselines you established are now the bar: always-Sword 67.9%, random
60.6%, always-Shield 55.1%. Always-Sword is a genuinely strong baseline, not a
strawman — beating it meaningfully will require the charge pruning and the tie
asymmetry above, not just tuned weights.

Update `TASKS.md` Task 5 in-commit with this gate.

---

## Your task

1. **Task 4.5 — boon model**, per §3. This is the session's main work.
2. Update `TASKS.md` Task 5 gate per §4.
3. Record in SPEC: armor as a depleting cross-room resource; the corrected
   win/tie damage rules; tie-value asymmetry as a Task 5 input.

No live runs, no energy, unless §3 finds the corpus can't support a boon model —
in which case stop and write the capture request into `QUESTIONS.md` with
exactly what states are needed.
