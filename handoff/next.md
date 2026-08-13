# BRIEF — session 03

Task 3 was well executed. `dungeonId 5`, `ENERGY_CID 20`, `maxRoom 16`, eight
battle states, and a clean gate. Three responses below, then the task.

---

## 1. I am reopening the charge conclusion

You concluded: charges go negative, therefore §4a becomes down-weight rather
than prune-to-zero. I don't think the evidence supports that yet, and this is
the highest-value mechanic in the game, so it's worth one more look.

The observation was: **enemy `paper` at 1, played it, landed at −1.**

Two hypotheses both fit that:

- **H1 (hard prune).** A move requires ≥1 charge to play. The −1 is the
  *resulting* state — `paper` is now locked until it regenerates. Every
  observation you have is consistent with this.
- **H2 (soft cost).** Moves are playable at any value; charges simply go
  negative. Also consistent.

You reported that **no move was ever seen attempted at ≤0**. That is weak
evidence *for* H1, not against it. Under H2 you'd expect to eventually see a
play from a non-positive charge; you saw none.

There's also an unexplained detail: 1 → −1 is a decrement of **two**. If a play
costs 1, something else moved that counter — a second cost, a regeneration tick
on unused moves, or two turns collapsed between the snapshots you compared.
Until that's explained, neither hypothesis is safe to build on.

**The discriminating observation.** Across every consecutive state pair in the
fixtures, emit one row per player per move:

```
turn | player | move | chargesBefore | movePlayed | chargesAfter | delta
```

Then answer three questions in the recap:

1. Is `delta` ever anything other than −1 for the played move? What happens to
   the two *unplayed* moves — do they regenerate?
2. Did any player ever hold a move at ≤0 and play a different one? **That's H1
   confirmed.**
3. Did any player ever play a move that was already at ≤0? **That's H2
   confirmed.**

If the fixtures can't separate them, say so and leave it UNRESOLVED — do not
pick one. Write §4a to branch on a single flag so the answer can be swapped in
later without touching the EV engine.

This matters because the two models differ enormously in value. H1 turns a
three-way guess into certainty; H2 is a mild prior nudge.

---

## 2. On getting the combat model wrong

> *A 100% fit on a corpus that can't distinguish your hypotheses isn't
> confirmation.*

That's the correct lesson and I want it kept. Recording it as a
do-not-reintroduce block was right.

Generalize it into a habit: **before treating a verification pass as
confirmation, state which branches the corpus never exercised.** A verifier
that can't fail on a wrong model isn't a verifier. Add that line to the §1 note.

That's also the reason I'm pushing back on the charge conclusion above — same
failure shape, one turn of evidence carrying a design decision.

Please restate the **verified** combat model explicitly in your next recap:
exactly when armor is granted, to whom, and in what amount. My brief said
"Shield wins restore armor"; your correction generalized it. I want the final
form written down in one place, since the whole utility function hangs off it.

---

## 3. Security: don't rewrite history

The username in `c916be5` came from my brief — I wrote it in after reading it
off a screenshot. My error, not yours.

**Leave it.** The username is already public in-game and on-chain via the Noob
NFT, so the rewrite buys very little, while a force-push on a public repo risks
desyncing your local clone for no real gain. The thing that actually mattered —
wallet address and JWT — was redacted throughout, including in that same commit.

Your fix of building username redaction into `writeRedactedCorpus` is the right
response: stop the leak going forward rather than relitigate the past. Log in
`DECISIONS.md`: *username tolerated in history; address and JWT never are.*

---

## 4. `maxRoom 16` changes the utility function

Sixteen rooms per run at 20 energy is a much longer run than SPEC §4b assumed.
Dying in room 2 forfeits fourteen rooms of loot.

So **survival dominates far more than the current weights express.** When you
get to Task 5, make the depth bonus steep rather than linear, and raise `w₁`
well above `w₂`. A slow win that reaches room 12 beats a fast one that dies in
room 5, and the current weights don't come close to capturing that gap.

Don't implement this yet — just carry it into Task 4's sim as a scenario worth
scoring: total loot across a 16-room run, not win rate per fight.

---

## Your task

**Step 1 — one watched run, first.** Your recommendation was right and it's
worth the 20 energy. §4c is currently written against zero evidence, which is
the worst state any section can be in. The user will play a run manually,
deliberately conservatively (Shield-heavy) to survive to a loot phase rather
than to win fights fast.

Capture, in redacted fixtures:

- **A full `lootPhase` state** — every option offered, its fields, and the
  action envelope that selects one. This is the priority.
- The heal card's actual shape, if one appears.
- Consecutive states across several turns, for the §1 charge table.
- A room transition, so `Floor`/`Room` progression is on record.

If the run dies before a loot phase again, report that plainly and do **not**
write §4c from inference.

**Step 2 — Task 4, the simulator.** As you proposed. No network, no auth. Build
it on the committed fixtures plus `verifyCombatModel.ts`. Fix the `vitest run`
exit-1 while you're there — real tests, not `--passWithNoTests`.

Do not start Task 2 or write strategy code this session.
