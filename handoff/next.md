# BRIEF — session 06

Four questions, four answers, then the task. Short version: gate retired (my
error, not yours), capture approved, Task 5 rescoped to room 1.

---

## 1. Yes — retire the Task 4.5 gate. The gate was badly set.

I wrote `deepestScorableRoom ≥ 4` because the corpus reached room 4. That was
the wrong basis. Corpus *depth* and corpus *scorability* are different things,
and enemies 65 and 66 being innately unscorable caps the metric at 2 no matter
how good the boon model is. You couldn't have met it by working harder.

Building the work, recording FAIL, diagnosing why the gate was unreachable, and
moving the blocker to capture is exactly the right handling. Don't carry it
forward as ≥2 either — a gate that's one counterfactual substitution away from
passing measures nothing useful.

**The generalisable rule, for `CLAUDE.md`:** a gate must be set on something the
agent controls. If a gate depends on data that doesn't exist yet, it's a capture
request wearing a gate's clothes. When you receive a gate you believe is
unreachable *before* starting, say so at the top of the session rather than
after — that's a cheaper failure than this one was.

## 2. Your ROLLED_STATS restraint was the best call in the session

You had a path to unlocking your own gate — narrow `ROLLED_STATS` on
`evasion 1` at 8/9 — and you didn't take it, because n=9 with one miss is the
shape a ~10% proc produces, and it would have been the enemy-63 error in a new
costume.

That's the third time this repo has been bitten by a confident read off a thin
sample, and the first time it was caught *before* it cost anything. Applying the
30-observation floor to yourself, against your own incentive, is the behaviour
that makes the rest of this project's numbers trustworthy.

Same for rescoping the reason-code test when it failed on `Heal` — "the test was
asserting my expectation, not the model" — and for labelling the room-2
substitution as a counterfactual. Keep all of it.

## 3. Capture: approved, and it's the session's first action

One supervised run, before Task 5. It unblocks two walls at once and costs 20
energy, which is cheap against the alternative of tuning strategy blind.

Note that this **does not** require Task 2 — `watch.ts` polls read-only with its
own inline auth, exactly as in session 03. Task 2 gates the *bot playing*, not
us capturing.

Capture priorities, in order:

1. **`ROLLED_STATS` on enemy 65** — Sword wins **at full enemy armor**, several
   of them, since "damage at full armor is halved given block > 0" is the one
   surviving hypothesis and it has a single positive sample. This is the
   highest-value target.
2. **Take `AddEvasion` or `AddLuck` early**, then play a long run so the rolled
   stat has many damage-taking opportunities. You need ~30 to clear the floor;
   get as close as one run allows.
3. **Room-1 boon options** — record every offer triple seen, even ones not
   taken. Four offer triples is too thin for an offer distribution.
4. **Opportunistic: the die-on-a-tie confound.** If the user can finish an enemy
   on a mirrored move, take it — but don't engineer the run around it, since
   ties can't be forced reliably. See §4.

Write the capture instructions into `QUESTIONS.md` as a short, plain checklist
the user can follow while playing, not as prose. They're clicking, not reading.

## 4. The die-on-a-tie confound — take the free version

You're right that it may cost nothing: if *a side that dies on an exchange deals
no damage* is the real rule, it's an addition to the existing model with no new
mechanic, and it turns the player-side evasion evidence into 9/9.

**Prefer that hypothesis on parsimony** — it explains the miss without inventing
a dodge proc — but don't promote it to CONFIRMED on one sample. Add it as a
flag defaulting OFF, same treatment as Burn, and note in SPEC that it and
`evasion 1` are **mutually confounded until a second death-on-tie is observed**.
Opportunistic capture only.

## 5. Task 5 scope — room-1 battle rate is the gate, rooms-cleared is reported

You're right that mean-rooms-cleared over mostly-unscorable runs is measuring
room-1 win rate with extra steps. `always-Sword 1.018 ± 0.058` is barely a
different number from its 67.9% battle rate.

So, replacing my session-05 gate:

> **Task 5 gate:** On the scored subset, the strategy engine beats the
> always-Sword baseline on **room-1 battle win rate**, with non-overlapping 95%
> confidence intervals over ≥1000 runs. Report alongside: mean rooms cleared
> ± CI, coverage %, and `deepestScorableRoom` — reported, not gated.

Gate on what's measurable now; report what isn't, so the blind spot stays
visible. The rooms-cleared gate moves to Task 11, where it belongs once
coverage has climbed.

Two constraints on how you build it:

- **Room-agnostic.** Nothing may hardcode room 1. The engine takes a state and
  returns a decision; when coverage climbs it should work deeper with no
  rewrite. §4c loot ranking gets *written* against the spec but explicitly
  marked unvalidated, since it can't be tested at depth 1.
- **always-Sword at 67.9% is a real baseline, not a strawman.** Beating it
  needs the charge pruning (`chargesAreHardLimit` now defaults true) and the
  tie-value asymmetry from session 05 — a Sword tie does real damage, a Shield
  tie against DEF 6–8 does none. Tuned weights alone won't get there.

---

## Your task

1. **Write the capture checklist into `QUESTIONS.md`**, then stand up `watch.ts`
   and tell the user to play. Capture first — it's the only step that needs a
   human awake.
2. **Task 5**, per §5. Room-agnostic, gated on room-1 battle rate.
3. Fold whatever the capture yields into the corpus and re-report coverage. If
   `ROLLED_STATS` clears the 30-observation floor, narrow it and say what
   `deepestScorableRoom` becomes.
4. Retire the Task 4.5 gate in `TASKS.md` in-commit, with the §1 note on why.
5. Add the §1 gate-setting rule to `CLAUDE.md`.

If the capture run dies early and yields little, **still do Task 5** — it's not
blocked, only its validation depth is.

## Looking ahead, so you can shape Task 5 accordingly

Task 2 then Task 6 comes next, and that changes the capture economics
completely: once the bot can play supervised runs, corpus grows at machine
speed and the coverage walls dissolve without anyone clicking. Design Task 5's
logging so those runs are directly ingestible as fixtures — that's the step
where this project stops being bottlenecked on human play.
