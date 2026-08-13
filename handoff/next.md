# BRIEF — session 02

Good recap. The vitest audit catch and the honest "src/ is entirely empty" note
are exactly right. Answers below, then your task.

---

## Answers to your open questions

**Q3 — reorder Task 3 before Task 2? YES.** Your reasoning is correct and this
is now the plan. `probe.ts` is self-contained, read-only, and doesn't import
`src/api/`, so nothing blocks it. Writing zod schemas against spec guesses and
then rewriting them against reality is wasted work in both directions. Ground
truth first.

Record in `DECISIONS.md`: *Task 3 runs before Task 2; schemas are written from
observed responses, never from SPEC.*

**Q1 — auth path: Path A, confirmed.** The user plays in-browser (character
"<USER>", Lv.0), so assume Abstract Global Wallet and do not build EOA signing
yet. The JWT will be at `~/.secrets/gigaverse-jwt.txt`. Path B stays deferred.

**Q2 — fishing HAR: deferred, not blocking.** Correct call. Don't chase it.

---

## Ground truth from manual play

The user played Forbidden Woods by hand this session. Observations from the live
UI — treat as **strong hypotheses to confirm in probe output**, not as fact,
since these are read off pixels rather than API fields.

**Move charges EXIST and are visible for both sides.** Three pip segments render
under every move card, player and enemy alike. This is the §4 edge and it
appears to be real. Find the API field carrying it — likely near the move stat
block. Getting this field name is the single most valuable output of your probe.

**Full enemy stats are visible pre-decision.** ATK and DEF for all three enemy
moves are shown before you commit. Observed on Miasmablade Toxishroom: Sword
14/7, Shield 10/4, Spell 8/3.

**Armor is a separate pool that sits in front of HP.** Player showed `ARM 0/12`
and `HP 2/30` as independent bars. Enemy armor fell 14 → 8 after losing an
exchange while their HP stayed 35/35 — so **damage depletes armor before HP**.
SPEC §4b treats armor as a minor utility term; it's more central than that.

**Shield wins appear to restore armor.** Player armor went `0/12` → `12/12` on
a won Shield exchange. Player Shield DEF is exactly 12. Working hypothesis:
*winning with Shield grants armor equal to that move's DEF.* If true, Shield is
not a passive stall move — it's a resource-regeneration move, and the utility
function needs to reward it far more than the current `w₃=0.3` does. **Confirm
before building §4b.**

**Other observed shapes:** enemy names are modifier + creature ("Miasmablade
Toxishroom"), suggesting prefix affixes that may alter stats. Floor and Room are
tracked separately (`Floor 1, Room 2`). Per-item drop percentages render in the
UI, so a drop table is probably exposed. Player has max HP 30, max ARM 12 at
Lv.0.

Enemy move log (2 fights, tiny sample, do not model on this yet):
Room 1 turn 1 = Spell. Room 2 turn 1 = Sword.

---

## Your task — Task 3, discovery

Per `TASKS.md` Task 3 and `SPEC.md` §3b.

Prerequisite: `~/.secrets/gigaverse-jwt.txt` must exist. If it doesn't, write
that to `QUESTIONS.md` and stop — do not build workarounds, and do not start
Task 2 as a substitute.

Run `probe.ts`. Then, beyond the existing gate:

1. **Run the probe again during an active battle.** The user will start a
   Forbidden Woods run and pause mid-fight. `/game/dungeon/state` is empty
   outside a run, and every question above lives inside that response. This is
   the whole point of the session — a probe run only outside combat answers
   almost nothing.
2. **Answer each hypothesis above explicitly in the recap**, naming the actual
   API field or stating ABSENT: charges, enemy stat visibility, armor-vs-HP
   ordering, shield-restores-armor, floor/room, drop table.
3. **Commit redacted fixtures.** Full battle-state JSON with addresses as
   `0xUSER` and JWTs as `<JWT>`. Keep every game-mechanical value intact — these
   fixtures become the Task 4 test corpus, so fidelity matters more than tidiness.
4. **Update `SPEC.md` §3 and §4** from what you find, and list every change in
   the recap's Corrections section.

Do not write strategy code this session. Discovery only.

If the probe's name matching fails to find Forbidden Woods, dump the full
dungeon list into the recap rather than guessing an ID — the in-game display
name may differ from the API name.
