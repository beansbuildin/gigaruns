# BRIEF — session 07

Task 5 passed against a strong baseline, and the tier discovery is the most
valuable finding in six sessions. Two retractions of mine first, then answers.

---

## 1. My die-on-a-tie request was bad reasoning

I asked you to build it behind a flag "on parsimony grounds." You tested it
instead and found it refuted — the enemy died on a tie and dealt its full 16.

Parsimony is a tiebreaker between hypotheses that *already fit the data
equally*. It is not evidence, and it is not a reason to build. I inverted that,
and testing before building was the correct response to a brief that asked for
the opposite. **Do that again whenever a brief asks you to implement something
the corpus can adjudicate — adjudicate it first.**

## 2. Leave 037→038 unexplained

Both candidates are dead and you flagged that it's now explained by nothing.
That's the right place to leave it. It is one exchange out of 184 with a clean
model everywhere else.

Do **not** propose a third mechanism to close the gap. An unexplained anomaly
sitting in SPEC is honest; a hypothesis invented to fill it is the exact failure
this repo has caught four times. Log it as a known-open anomaly and move on.

Same applies to your note about evasion being "the last hypothesis standing only
because no third has been proposed" — that framing is right, keep it.

## 3. Safe tier is free EV — make it a hard rule

Identical `lootTable` across all three tiers, in both samples, while tiers 1–2
are the sole source of the mechanics that make a battle unscorable. So higher
tiers are strictly dominated: same reward, added risk, plus they poison the
corpus.

Encode as a **hard rule, not a weighted preference**: the bot always picks the
lowest tier offered. Put it in `CLAUDE.md` alongside the other non-negotiables,
and add a guard that halts if a non-lowest tier is ever selected. This is the
kind of rule that gets quietly "optimised" away later by someone reasoning about
risk-reward in the abstract.

Expect coverage to climb on its own once this holds — Safe-tier enemies come in
with zero rolls and null buffs, which removes the enemy-side unscorability
entirely. Room-1 boons remain a separate wall.

---

## 4. Regen — check the corpus, don't spend a run

Your instinct that it changes the *shape* rather than the weights is half right,
and which half depends on a question the existing corpus can answer.

"Start each battle with 2 regen, decreasing by 1 per turn" totals ~3 HP per
battle. Within a battle that's a minor tempo effect against 8–16 damage swings —
not a structural change to §4b.

Across a run it depends entirely on: **does HP persist between rooms, or reset?**
You reached room 2 three times, so the room transitions in the corpus should
show this directly.

- If HP **persists** (as armor does), Regen is ~3 HP × 16 rooms ≈ 48 HP of
  cumulative refund against a 30 HP pool. That's large, and it belongs high in
  §4c loot ranking.
- If HP **resets** each room, it's a small tempo boon and ranks accordingly.

Answer that from the corpus. Model Regen from the option text as a hypothesis
defaulting **OFF**, and validate it from the first machine-speed runs. Don't
re-derive §4b until it's confirmed and its cross-room value is known.

## 5. `intuition` — I've asked the user directly

If it reveals the enemy's next move, you're right that it dwarfs a dodge proc:
§4a's whole edge is predicting that move, and a certain read collapses the
decision. The answer will come from the user, not from capture. Treat as
**pending** — don't model it either way this session.

## 6. Task 2 next — your read is right

Three human runs produced two rooms of depth. That's the argument, and it's
decisive. Task 2 is the step that makes captures free, and every session spent
on human clicks is one not spent building the thing that removes the need for
them.

`AddMaxArmor` stays uncaptured. That's acceptable — it'll land in the first
supervised live runs alongside everything else.

**Stop spending human clicks on coverage.** If a future brief of mine asks for a
capture that Task 6 would produce for free, push back.

## 7. `enemies.ts` — yes, make it tier-aware now

Not for tidiness. The current state is **actively wrong**: room-3 and room-4
profiles are Dangerous-tier instances stored as if they were the enemies
themselves, which means the sim may be reasoning from inflated stats without
saying so. A comment isn't enough.

Restructure the key to `(room, tier) → enemy`, label existing rows as **tier 2**,
and leave tier-0 rows **absent** so lookups fail closed with a reason code
rather than silently falling back. Invent nothing. Empty is correct; wrong is
not.

## 8. Re-test depth-3 — live compute is free

You rejected depth-3 because the CIs overlap, which was right on the evidence.
But the reason you gave — 7× the time — doesn't apply where it matters. The
live bot has a **1200ms floor between actions**. Seven times a few milliseconds
is still free.

So the only question is whether the 84.2% vs 82.0% gap is real. Re-run the
ablation with enough runs to separate the CIs, or establish that it can't be
separated. If depth-3 wins, adopt it for live play and keep depth-2 for sim
throughput. A 2pp edge that costs nothing in production is worth the compute to
confirm.

---

## Your task

1. **Task 2 — auth + API client.** The main work. Path A (browser JWT), rate
   limiter, single-flight action-token mutex, zod schemas written against the
   committed fixtures, clean expired-token halt. Nothing POSTs this session —
   Task 2's gate is read-only verification.
2. `enemies.ts` tier-aware, per §7.
3. Safe-tier hard rule in `CLAUDE.md` + guard, per §3.
4. Corpus check on HP persistence across rooms, per §4.
5. Depth-3 ablation re-run, per §8.

Log the §2 anomaly as known-open in SPEC. Do not model Regen or intuition.

Design the client so supervised runs from Task 6 write fixtures in the same
shape `watch.ts` produces — that's what makes machine-speed capture actually
compound.
