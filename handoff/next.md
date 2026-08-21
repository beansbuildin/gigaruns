# BRIEF — session 69

## The clock and the ledger

Written **2026-08-21, 14:00 PT**. *Source: session 68 live-measured.* Ledger
`dayDocs[pond 2]` at **5 of 20 — 15 casts remain.** Dungeon untouched today.

**`doctor.ts` is the standing first command of every session.** Session 67's
expired JWT cost a stop-work order that turned out to be stale by the time it was
read; session 68's `doctor.ts` answered it in one second.

**This brief authorizes ZERO dungeon runs and a fishing batch gated on §1
passing.** Do not cast until the hoist is proven.

*Environment, sessions 66–68: `npx tsx` and `git` both fail under the command
sandbox on this machine. Run unsandboxed. Not a repo problem.*

---

## 1. Hoist `dist` above the oil block — the batch depends on it

**User decision, 2026-08-21: hoist first, then a batch.**

*Source: session 68.* The shadow produced **13 records and exactly ONE at a
firing moment**, Focus arm, with `bestKillProbability` **null on all 13**. The
cause is structural, not sampling: the shadow evaluates in the card-choice phase,
the Relaxing trigger fires only on a lethal fish, and **a lethal Relaxing consume
ends the cast inside the oil block — before that phase is reached.** The same gap
swallows any turn whose oil block throws, which is exactly the turn a trigger
fired on.

`dist` depends only on `matcher.history`, `pendingPrediction` and the mined
tables — **none of which a consume changes** — so it can be computed earlier.

**Two things must both be true, and the second is the one that gets skipped:**

- Shadow observes a **Relaxing** firing moment, with `bestKillProbability`
  populated rather than null.
- **The live decision is unchanged by the hoist.** Byte-identical play with the
  hoist in and out. A restructure of the live loop that alters play while
  "only moving a computation" is the session-64/65 failure in a new costume.

**Demonstrate the observability test failing with the hoist reverted**, then
restore. Session 68's own leak test is the model: byte-identity is easy to pass
while proving nothing, so it needed three anti-vacuity tests alongside.

---

## 2. The user's cast — what the fixtures actually show, and what still needs checking

The user watched a cast where the bot played cards on turns 0–2 and then spent a
**Relaxing Oil** on turn 3 to finish the fish, and read that as the bot taking
the easy route with resources still in hand.

### 2a. Three corrections to the resource model, verified in the fixtures

*Source: `fixtures/fishing-casts/live/cast-2026-08-21-20-11-01/raw`, read
directly.*

- **There is no mana pool on the board.** The state carries no `mana` field, and
  **every card in the deck has `manaCost: 1`.** The sim's `escaped_mana` is a
  sim-side name; do not reason about a live mana budget that does not exist.
- **The depleting per-cast resources are `playerHp` (max 10) and the draw pile**
  (`cardInDrawPile`, `nextCardIndex`).
- **A miss is not free — it costs BOTH.** In that cast: `fishHp` **9 → 12 → 14**
  (back to full) while `playerHp` went **10 → 9 → 8**. Misses heal the fish
  *and* damage the player. So "it had resources left, it could have kept
  swinging" understates the cost: swinging can move the fish **away** from
  lethal.

**This does not make the user's instinct wrong.** It sharpens it: the question is
not "were resources left" but "was the oil buying anything a card would have
bought anyway."

### 2b. What still needs identifying, because I could not

The directory I read is one of session 68's five but is **not** the cast
described — it shows three misses and no consume. **Identify the actual cast**
(*session 68 live-measured: 2 Relaxing consumes, both lethal, both caught*) and
report, for the turn the oil fired:

- `fishHp`, `playerHp`, cards in hand and their `hitZones`/`hitEffects`,
  remaining draw pile.
- **Was there a card in hand that would have killed the fish with certainty?**
  If yes, this is exactly the case the certainty gate already catches, and the
  answer is "the shipped policy is the wrong one", not "the rule needs to be
  stronger."
- If no, what was `bestKillProbability` — and would the threshold in §3 have
  held the oil?

**Report this to the user directly.** It is the concrete instance behind the
directive and it decides how much of §3 is actually needed.

---

## 3. The probabilistic threshold — derive it from an exchange rate, do not tune it

**User decision, 2026-08-21: add a probabilistic threshold on top of the
certainty gate.**

This sits against standing guidance — *session 67: "do not tune the necessity
thresholds; a tuned pair buys ~0.08pp on a sim whose control arm catches 68.71%
against the real fishery's 25.9%."* **The resolution is that this threshold must
not be fitted.** Do not sweep for the value that maximises catch rate. Derive it
from what the user is trading, pre-register it, and report what it costs as well
as what it saves.

### 3a. The derivation to attempt

A lethal-band oil converts an uncertain catch into a certain one. If
`p = P(catch without the oil)`, spending gains `(1 − p)` fish. So **spend when
`(1 − p)` exceeds the value of an oil measured in fish, and hold otherwise.**

*Source: session 66, corpus-measured —* the Relaxing trigger priced at
**~6 oils per extra fish**, i.e. one oil ≈ **0.167 fish**, 95% interval roughly
1.5–20 oils per fish. That gives a first-cut hold threshold near **p ≥ 0.83**,
with an interval wide enough that the number must be reported with it.

**Two things make this principled rather than arbitrary**, and both belong in the
report:

- The threshold comes from a **measured exchange rate**, not from a sweep.
- **It should differ per oil, because stock differs.** *Live-measured, session
  68: Relaxing 56, Focus 19.* A plentiful oil is worth less, so its hold
  threshold should be higher. Say so explicitly if you implement one number for
  both.

### 3b. Scope check — this band is small

*Source: session 67, corpus-measured.* The gate inputs are bimodal:
`bestKillProbability` **34.3% exactly 0 / 55.8% exactly 1 / 9.9% between**;
`bestConnectProbability` 59.8% / 27.8% / 12.5%.

**So the certainty gate already covers 55.8% of firing moments, and the
probabilistic threshold can only bite on the ~9.9% in between.** Report the
threshold's effect against that denominator, not against all firings — a rule
that changes one decision in ten should not be described as if it changed the
policy.

### 3c. Constraints

- `p` in the derivation is **P(catch eventually without the oil)**, which is not
  the same as `bestKillProbability` (this turn). If you use the per-turn value as
  a proxy, **say so and say which direction it biases.**
- Pin it with a test that fails at **both** degeneracies — always-hold and
  never-hold — the way session 67 pinned the certainty gate.
- **Report escapes, not just oils saved.** A threshold that saves oil by losing
  fish is a worse policy the user did not ask for.

---

## 4. Stock policy — Focus until depleted, Relaxing capped at 2 per cast

**User directive, 2026-08-21:**

> Continue using Focus oil until supply naturally depletes, then only use 2×
> Relaxing oil per fishing run.

*Live-measured, session 68: Relaxing **56**, Focus **19**.* Focus is now the
scarce one.

- **Focus: unconstrained** until stock reaches zero. When it does, stop and tell
  the user rather than silently changing behaviour.
- **Relaxing: hard cap of 2 per cast, effective immediately.** The cap is a
  ceiling, not a quota — it never causes a spend. Applying it now satisfies both
  readings of the directive and is non-binding in the common case; *session 65
  recorded a cast that consumed three oils*, so it is not hypothetical.
- A third Relaxing trigger in one cast records **OIL-POLICY-DRY**, the cast
  continues, the batch does not halt — the partial-dry path from session 65.

---

## 5. The Steady Lure crit — now datable

**User-stated, 2026-08-21: the lure was equipped BEFORE today's casts.**

That unblocks session 68's open question. *Source: session 68 —* do **not**
compute a crit rate over the whole corpus; 1/484 plays spans ~60 sessions and is
rule 10's trap. **Scope the denominator to plays on 2026-08-21 only** and report
the rate against the user-stated **3%**.

The **damage rule stays open at n=1.** *Session 68: card 76, `critZones: []` and
`critEffects: []`, took the fish 5 → 0 where its `hitEffects` amount is 3.*
`hit + 2`, a flat 5, and "lethal, server reports remaining HP" all fit exactly.
**Do not encode one.** If the scoped rate holds up, a handful more casts settles
it.

---

## 6. The batch

After §1 passes: cast under the **unchanged** live policy (`onDemandTriggers`),
with shadow recording both arms.

- **Up to 10 casts**, leaving 5 in reserve on the day.
- Halt on: the count; the ledger short; the 15-cast zero-streak tripwire; or
  **§1's observability failing in practice** — if the hoist ships and shadow
  still records `bestKillProbability: null` at a Relaxing firing, stop and report
  rather than accumulating unobservable casts.
- **Do not stop on an oil consume.** Do not force one.
- Rule 13 after the batch: read the ledger, confirm it moved by exactly the casts
  sent.
- `conserve(r=1,f=1)` stays **unshipped**; `policyApproved` stays false.

---

## 7. Do not

- Do not cast before §1 passes, or run any dungeon run.
- **Do not ship the conserving policy or the new threshold** — shadow and report.
- Do not sweep the threshold for maximum catch rate (§3).
- Do not describe the threshold as changing the policy when it touches ~10% of
  firings (§3b).
- Do not reason about a live mana pool; there is not one (§2a).
- Do not encode a crit damage rule at n=1, or compute a crit rate over the whole
  corpus (§5).
- Do not let the hoist change live play (§1).
- Do not read `ls fixtures/fishing-casts/live | wc -l` as a cast count — dirs are
  per invocation, `--dry-run` makes empty ones, and 7 hold more than one cast.
- Standing: never report energy as a blocker; exercise `--dry-run` before claiming
  a blocker; do not revert rule 8; do not loosen the `fakeDoc` observability
  guard; §19, rule 8 and corrode-in-`dungeonSim` are CLOSED; `boonCapture`
  settled OFF; distribution steps 3/4/6 remain the user's.

---

## 8. Gate

1. **The hoist is proven both ways** — shadow records a Relaxing firing moment
   with `bestKillProbability` populated, **and** live play is byte-identical with
   the hoist in and out. Demonstrate the observability test failing with the
   hoist reverted.
2. **The probabilistic threshold is derived from a stated exchange rate,
   pre-registered before the batch, and pinned by a test that fails at both
   degeneracies.** A report that presents a swept value does not meet this gate.

---

## 9. Corrections to me

- **I wrote that stock was "Relaxing 0, Focus 18". Live it was Relaxing 56,
  Focus 19.** Rule 9, sixth occurrence. I carried session 65's balance read
  forward as if it were current, tagged it *live-measured, session 65*, and the
  tag was accurate while the use of it was not. **A provenance tag records where
  a number came from; it does not certify that the number still holds.** For
  anything the user can change between sessions — stock, equipment, crafting — the
  brief should say "as of session N, verify at start", not state it as fact.
- **Worse, that stale number produced a conclusion that was right for the wrong
  reason.** I wrote that the Relaxing arm could not be exercised live because
  stock was zero. The arm indeed could not be exercised — but because of the
  structural ordering session 68 found, with 56 oils in the bag. **A correct
  conclusion reached from a false premise is more dangerous than a wrong one**,
  because the recap confirms it and nobody looks again. Session 68 looked anyway.
- **I could not identify the cast the user described**, which is why §2b is a
  task rather than an answer. I read one of session 68's directories, found it
  showed three misses and no consume, and stopped rather than guessing at which
  of the five it was.

---

## Your task (session 69)

1. `doctor.ts` first; read both ledgers; report the day.
2. **§1 / gate 1** — hoist `dist` above the oil block, proven both ways.
3. **§2b** — identify the user's cast and answer whether a card could have killed
   that turn. **Report it to the user directly.**
4. **§3 / gate 2** — derive the probabilistic threshold from an exchange rate,
   pre-register it, pin both degeneracies. Do not ship it.
5. **§4** — Focus unconstrained, Relaxing capped at 2 per cast.
6. **§5** — crit rate scoped to 2026-08-21 plays; damage rule stays open.
7. **§6** — up to 10 casts, shadow recording both arms.
8. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** §1 is the whole session's dependency and §2b is the item
the user most wants answered. **The likeliest outcome of §2b is that a card could
NOT have killed that turn** — the certainty gate would have spent the oil too,
and the user's concern lands on the probabilistic band instead, where §3 is aimed
and where only one firing in ten lives. That is a smaller finding than it feels
like, and saying so plainly is more useful than a rule that appears to fix
something it does not touch.
