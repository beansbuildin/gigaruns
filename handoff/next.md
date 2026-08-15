# BRIEF — session 10

Five runs, `deepestScorableRoom` 1 → 4, two new boons modelled from the bot's
own play, and two real bugs caught by guard persistence the moment it started
working. The identity-retry fix was never exercised (0 of 17 offers moved) —
worth saying plainly rather than claiming vindication, though at 17 500s the
exposure was much higher than session 08's two suggested.

Now the thing I think the recap under-framed.

---

## 1. Every run dies. That's the project's actual problem now.

Rooms reached: **3, 4, 2, 2, 3** out of 16. All deaths. `scoredWinRate` 0.32%.
Nothing has ever reached room 5, across the bot's runs and the user's.

Put the two numbers next to each other. Room-1 battle win rate is **81.8%**. If
battles were independent, sixteen of them would clear at `0.818^16 ≈ 4%`.
Observed is **0.32%** — an order of magnitude worse.

That gap is the finding. Battles are *not* independent, because HP persists
across rooms (confirmed, 7 boundaries) and armor doesn't reset. **The run is a
war of attrition, and the bot is optimising each battle as if it were the last
one.** Winning a room at 81.8% while arriving at room 5 with 4 HP is not
winning.

So the objective was wrong, and it was wrong because I set it. Task 5's gate —
room-1 battle win rate — was the right *measurable* thing when
`deepestScorableRoom` was 1. It is no longer the right *target*. Combat is
solved: 0 model failures across 214 exchanges, 81.8% against a 67.9% baseline.
**Attrition management is untouched.**

Concretely, three things follow:

- **`w₁` (survival) is far too low.** HP is a cross-room resource being spent
  like a per-battle one. Early-room HP has option value for late rooms that the
  current utility function doesn't price.
- **Loot ranking is the main lever, and it's barely grounded** — three clean
  room-1 offers sampled. SPEC §4c ranks Heal first only below 50% HP; given
  attrition, healing and armor boons are probably underweighted throughout.
- **The right metric is mean rooms cleared**, which is finally measurable now
  that scorable depth (4) covers every run that has ever happened.

## 2. Answering your Q1: revisit Task 11's gate, retire Task 5's

Task 5's gate has served its purpose — don't re-run it, don't tune against it.
Room-1 battle win rate now goes in the reported-metrics block permanently.

**Promote Task 11's rooms-cleared gate to the live objective:**

> Mean rooms cleared per run, on the scored subset, beating the current
> configuration by a margin exceeding the 95% CI over ≥1000 runs. Report
> alongside: room-1 battle win rate, coverage %, `deepestScorableRoom`, and the
> distribution of death rooms.

That last one — **the death-room histogram** — is the diagnostic that matters. If
deaths cluster at rooms 2–3, the bot is entering room 2 already damaged and the
problem is early-room HP economy. If they spread evenly, it's enemy scaling.
Those need different fixes, and right now we can't tell which it is.

Your caution about the corpus being thin is right and it bounds what to do: tune
the **weights** against the sim, but treat any conclusion about *which boon to
prefer* as provisional until more offers are sampled. Say which is which in the
recap.

## 3. The 500s — one cheap test before accepting them

17 across 5 runs isn't flakiness-shaped, and there's a pattern already visible
in what you reported: **all 17 are in the `reward_*`/`path_*` family. Zero are in
the combat family.**

That's also the family with the anomalous envelope — `dungeonId: 0` and
`actionToken: ""`. Combat actions send a real dungeon ID and a real token and
never 500.

So before treating this as server-side noise, test whether the envelope is
subtly wrong: on the next reward pick, send the **tracked `actionToken`** from
the previous POST response instead of `""`, and the real `dungeonId` instead of
`0`. One variation at a time, on a live pick, with the current handling as
fallback.

It might be nothing — the empty token was inferred from a working request. But a
100% correlation between an odd envelope and a 17-occurrence error rate is worth
one cheap test before writing it off as someone else's problem. If both
variations 500 too, accept it as server flakiness, record it, and stop looking.

Not a session's work. One test, opportunistically, during whatever else runs.

## 4. Your Q4 and Task 7 are the same capture — ask once

Item metadata has no confirmed endpoint, and `/items/balances` returns bare
numeric IDs. But **the game client displays item names**, so it fetches them from
somewhere. Don't guess the URL.

The user's browser knows. And a HAR capture is already the blocker on Task 7
(fishing). So it's one request, not two:

> Open gigaverse.io, DevTools → Network → Fetch/XHR, then:
> 1. Open the inventory and let item names render.
> 2. Play one complete Dendren fishing cast, start to finish.
> 3. Save as HAR → `fixtures/fishing-cast.har`.

Write that into `QUESTIONS.md` as a numbered checklist. One ten-minute capture
unblocks the item-metadata endpoint *and* the entire fishing half of the project,
which has been blocked since session 01.

Consumables may well be the biggest available lever on deaths — but that's a
hypothesis, and it stays one until we can read what's in the inventory.

## 5. Your Q2 and Q3

The no-Safe-tier rate (33%) — agreed, `pickLowestTier()` handles it, just track
it. Note that generalising from "always Safe" to "lowest offered" preserved the
original zero-tradeoff reasoning rather than abandoning it; that was the right
shape of fix.

---

## Your task

1. **Death-room histogram** from the existing 5 runs plus all prior captures.
   Cheap, and it decides where §1's effort goes. Do this first.
2. **Retune for attrition**, per §1 — `w₁`, depth bonus, and §4c loot ranking,
   validated against the sim's mean-rooms-cleared. Mark boon-preference
   conclusions provisional per §2.
3. Update `TASKS.md`: Task 5 gate retired to reported-metrics, Task 11 gate
   promoted per §2.
4. **Five more live runs** with the retuned config. Budget **120 energy**.
   Compare death-room distribution before and after — that's the real result,
   not the win rate.
5. The §3 envelope test, opportunistically.
6. `QUESTIONS.md` capture checklist, per §4.

If the retune doesn't move mean rooms cleared, say so plainly. A negative result
here is genuinely informative: it would mean attrition isn't the binding
constraint and something else is — most likely enemy scaling past room 3, which
the corpus can barely see.
