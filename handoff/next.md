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

## 4. Your Q4 and Task 7 are the same capture

Item metadata has no confirmed endpoint, and `/items/balances` returns bare
numeric IDs. But **the game client displays item names**, so it fetches them from
somewhere. Don't guess the URL — the user's browser knows, and a HAR capture is
already the blocker on Task 7 (fishing). One capture, not two.

The user has been given this checklist; the file lands at
`fixtures/fishing-cast.har` (gitignored, stays local):

1. DevTools → Network → Fetch/XHR, recording before playing.
2. Open the inventory, let item names render.
3. Play one complete Dendren cast, start to finish.
4. Save all as HAR with content.

If it's present, parse it: extract the item-metadata endpoint **and** the fishing
API surface, and generate `SPEC-fishing.md` per TASKS.md Task 7. If it's absent,
don't block — note it and continue.

## 5. Your Q2 and Q3

The no-Safe-tier rate (33%) — agreed, `pickLowestTier()` handles it, just track
it. Note that generalising from "always Safe" to "lowest offered" preserved the
original zero-tradeoff reasoning rather than abandoning it; that was the right
shape of fix.

---

## 6. Run economics — user-confirmed, treat as authoritative

The user has a **240 energy/day** dungeon budget: 12 runs at 20 energy, or 4
"juiced" runs at 60 energy (`isJuiced: true` in `start_run`). 5/12 used at the
time of writing.

Three facts, confirmed directly by the user — these close open questions, don't
re-verify them:

1. **Potions: hard cap of 3 per dungeon**, regardless of run type, consumed on
   use. This is a per-**dungeon** allowance, not a per-run cost.
2. **Juiced runs are mechanically identical** — 3× energy, 3× rewards, same
   dungeon. The corpus, combat model, boon models, and all tuning transfer.
3. **The 3× multiplier is real and explicitly disclosed by the game.**

### Production target: juiced only

Once the bot produces consistent results, production switches to juiced runs
permanently. The economics are now unambiguous: three potions cover 3× the
rewards, with no proportional consumption to erode the saving. Fewer runs, less
wall-clock time, same consumable cost.

Record in `DECISIONS.md` as the production target. Still worth one diff check on
the first juiced run as cheap insurance — but don't gate the switch on it.

### Testing stays on 20-energy runs

**For this session: 20-energy runs only, batches of 3.** Not juiced.

Juiced gives 4 samples/day instead of 12, at 3× cost per sample. The death-room
histogram needs *count*, not value — sample size is the measurement. The sim
carries the statistics; live batches are drift checks against it.

Budget: 3 runs (60 energy) for the retuned config, plus up to 2 runs (40 energy)
if the §3 envelope test needs its own attempts. **Cap at 100 energy.**

**Do not change run type mid-batch.** It would confound the before/after
death-room comparison, which is this session's actual result.

## 7. Potion timing — new task, not this session

Three uses across up to 16 rooms is an **optimal stopping problem**, not a
threshold rule. Spend at room 2 and you may lack it at room 6; hold all three and
you die at room 3 holding them. Given every run so far dies at rooms 2–4,
mistimed potions are plausibly a larger loss than anything remaining in the
combat model.

Prerequisites, in order — the policy is undefinable without them:

- **Item metadata** (§4 HAR): what each potion actually does. Flat heal,
  percentage, cure, buff.
- **`use_item` confirmed.** Still `[VERIFY]`, from the same source that got
  `loot_one` and `enemy_two` wrong. Never send speculatively mid-run.
- **`start_run`'s `consumables: []`** — are potions declared at entry or used
  mid-run? This changes the policy shape entirely: pre-committed loadout versus
  in-run decision.

Then model as expected rooms-cleared over remaining potions and remaining rooms,
tuned in the sim against the death-room histogram.

Add to `TASKS.md` as its own task with its own gate. **Do not bolt it onto this
session's retune** — the death-room comparison needs a single variable changed.

---

## Your task

1. **Death-room histogram** from the existing 5 runs plus all prior captures.
   Cheap, and it decides where §1's effort goes. Do this first.
2. **Retune for attrition**, per §1 — `w₁`, depth bonus, and §4c loot ranking,
   validated against the sim's mean-rooms-cleared. Mark boon-preference
   conclusions provisional per §2.
3. Update `TASKS.md`: Task 5 gate retired to reported-metrics, Task 11 gate
   promoted per §2, potion-timing task added per §7.
4. **Three live runs** with the retuned config, 20-energy, per §6. Compare
   death-room distribution before and after — that's the real result, not the
   win rate.
5. The §3 envelope test, opportunistically.
6. Parse the HAR if present, per §4. Don't block if it isn't.
7. `DECISIONS.md`: juiced production target, potion cap, confirmed mechanics.

If the retune doesn't move mean rooms cleared, say so plainly. A negative result
here is genuinely informative: it would mean attrition isn't the binding
constraint and something else is — most likely enemy scaling past room 3, which
the corpus can barely see.

Addendum — potions confirmed pre-committed; HAR captured:

USER-CONFIRMED: potions are chosen as a PRE-COMMITTED LOADOUT before
entering, not used mid-run. This supersedes the optimal-stopping
framing in SPEC and session 10 §7.

Consequences:
  - It is a static 3-item selection maximizing expected rooms
    cleared, not a sequential decision. Fully solvable in sim.
  - `use_item` likely never needs sending. The loadout goes in
    start_run's `consumables: []` (currently always sent empty).
    Keep use_item [VERIFY] but drop it off the critical path.
  - Downgrade from a standalone task to an extension of loot
    ranking. Update TASKS.md accordingly.

STILL OPEN — how do committed potions take effect? Auto-trigger on a
condition (HP threshold), or passive run-long buffs? This determines
whether the sim models them as conditional heals or as flat stat
deltas. Answer from item descriptions or a captured start_run; ask
the user if neither resolves it.

HAR: user reports it placed in the project. VERIFY IT IS AT
fixtures/fishing-cast.har and gitignored before any commit — a HAR
carries a live Authorization header and this repo is public. If it
is anywhere else, move it and confirm `git status` is clean.

Parse it for BOTH:
  1. The item-metadata endpoint (names/descriptions for the numeric
     IDs in /items/balances) -- unblocks the loadout policy.
  2. The fishing API surface -> SPEC-fishing.md, per TASKS.md Task 7.

Commit only redacted extractions, never the HAR.
