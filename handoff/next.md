# BRIEF — session 15

Isolating the divergence into two causes and quantifying each — `focusMeter` at
~30%, library mismatch as the dominant remainder, blind matcher at 7–10%
consistent with live 0/6 at P≈55–65% — is the best diagnostic work in this
project. The `matcherPool: []` split (what the true pattern is drawn from vs.
what the matcher searches) is the move that made it possible.

And "a brief that asked *does this one mechanic explain the gap* got *partly,
and here's the bigger thing*" is exactly right. Don't let a brief's framing cap
the answer.

---

## 1. My `argmax P_hit` instruction was an overcorrection — fix it

Session 13's brief told you to maximise hit probability with mana as a
feasibility filter. Dropping the `/manaCost` divisor was right. Switching the
objective to `P_hit` was not, and the user's screenshot shows why.

**Cards differ in both damage and miss penalty.** Visible in hand: one card
deals 2 on hit, two deal 5, and one shows a miss penalty of 3. Both numbers are
per-card and printed on the card face.

`argmax P_hit` discards both. It's indifferent between a 2-damage and a 5-damage
card at equal hit chance, and it will take a marginally safer card over one worth
2.5× as much progress.

The correct objective is **expected net progress in `fishHp` units**:

```
EV(card, focus) = P_hit · card.damage − (1 − P_hit) · card.missPenalty
```

That's what SPEC §5 originally said, minus the bad divisor. It naturally
encodes "misses are the budget" — the penalty term is the miss cost, in the same
units as the gain, so no separate weighting is needed.

Keep `isManaConstrained` as the late-cast correction. Re-run the sim after the
change in both library-known and blind configurations; the blind number is the
one that should track live.

## 2. Four mechanics from the user's screenshot

All from a live annotated client view. Treat as strong hypotheses, confirm
against state fields.

**Per-card miss penalty** — as §1. Confirm the field exists in the card schema;
if the API exposes it, `chooseCard` should read it rather than using a constant.

**Spell rewards on catch.** After each successful catch you choose one of three
new spells — structurally identical to dungeon boons. So the deck **grows within
a session**, and card choice compounds. Nothing models this. It's also why the
0-catch streak is worse than it looks: no catches means no deck growth, so the
hand stays at its weakest all session.

**Rod equipment carries its own spell set.** A gear layer for fishing. Worth
flagging because gear has been the single biggest lever found in this project —
Sword ATK +4 beat every strategy intervention combined. Rod choice may dominate
card policy the same way.

**Fishing oils (potions).** A consumable layer, separate from dungeon potions,
visible in the fishing UI. Unmodelled.

Also confirming from the same image: mana ("Stamana") 6/6, cards cost 1 each,
redraw costs 1 per card held (3 for a full hand), fish HP 18 max. The bobber
starts centred and the meter reads 3/3, matching your live finding.

**One concrete consequence of the 3×3-stamp-on-4×4-grid geometry:** a card
centred at a corner has most of its stamp clipped off-grid. There is no true
centre on a 4×4, but the middle 2×2 cells maximise coverage. So focus placement
has a *static* positional value independent of where the fish is — worth encoding
directly, and cheap to verify in the sim.

## 3. Q1: build the miner **and** collect casts — they don't compete

You framed it as build-now-on-25-lines versus spend-budget-growing-the-log. Do
both: the miner is offline work, the casts are live, and they run in parallel.

The order matters though. **Start casts first** — they're the long pole and the
budget resets daily. The user reports **15 casts available today**; raise the
fishing session cap in `config/bot.json` to use them. At ~5 transitions per cast
that's ~75 new transitions against the current 25.

Build `mineFishPatterns.ts` while they run, then mine the grown log at session
end.

**On 25 lines being thin: your instinct is right and this project has a rule for
it.** Enemy-63 and `ROLLED_STATS` were both confident reads off small samples,
and the second was caught only because you applied a 30-observation floor to
yourself. Apply the same discipline here — the miner should report candidate
cycles **with their support counts**, and promote nothing to the pattern library
below a stated threshold. A miner that outputs "no pattern is yet supported" on
100 transitions is a correct miner.

Feed whatever it finds back through `matcherPool` and report the sim rate. If the
mined library moves the blind 7–10% figure upward, that's the first evidence the
matcher can ever help live.

## 4. Q2: potions are scarcer than the plan assumed

The loadout-time consumption finding changes the economics, not just the
mechanics. **A committed potion is spent whether or not it's used** — the probe
burned a Big Heal Juice on a run that never called `use_item`.

The user holds 7 Big and 7 Mid. Committing 3 per run at 12 runs/day exhausts
that in under two days. So before any timing policy is worth building:

- **Are potions purchasable or drop-only, and at what cost?** Check
  `/offchain/static` and the vendor/market endpoints. If a +20 HP heal costs
  more than the marginal loot from the rooms it buys, the policy is *don't
  commit potions*, and that's a legitimate answer.
- **Commit-time consumption means partial loadouts matter.** Committing 1 potion
  costs 1. There's no reason to commit 3 by default.

So Stage B's real first question is economic, not tactical. Answer it before
modelling turn-cost and multi-use. If potions are cheaply farmable, proceed; if
not, the honest recommendation to the user may be to save them.

Don't spend dungeon runs on `use_item` timing this session — fishing has the
larger unexplored surface and the budget is better spent there.

## 5. Q3: yes, build `--status`

Trivial and it pays for itself. Have it print remaining dungeon runs, dungeon
energy, fishing casts, and fishing energy against the date-keyed guards, without
needing a dry run. Call it at the top of every live session.

---

## Your task

1. **`--status` first** (§5), so the session plans against real budget.
2. **Start live fishing casts early** (§3) — raise the cap, use the day's
   allowance, log every transition.
3. **Fix `chooseCard`'s objective** to net `fishHp` EV (§1), re-run the sim in
   both library-known and blind modes, report both.
4. **Build `mineFishPatterns.ts`** (§3) with support counts and a promotion
   threshold. Mine at session end against the grown log.
5. **Potion economics** (§4) — purchasable or not, and at what cost. Read-only.
6. Record §2's four mechanics in `SPEC-fishing.md` as `[VERIFY]` with the
   screenshot as source, and confirm what you can against live state.

If the mined library still can't lift the blind sim rate, say so plainly. That
would mean Dendren's movement isn't drawn from a small deterministic set at all,
and the identification framing — mine, from SPEC §5, since session 01 — is simply
wrong for this fish.

Addendum — potions are CRAFTABLE (revises §4):

USER-CONFIRMED: the user can craft potions. They are not a fixed
stock, so "save them" is no longer the likely answer and the timing
policy is worth building.

But renewable is not free. §4's question changes from "can we get
more" to "what does one cost, in inputs, versus what it buys."

Find, read-only:
  - The crafting recipe for Big/Mid Heal Juice -- exact input items
    and quantities. Try /offchain/static first (it carries gameItems
    with descriptions); the fishing bench in the client is the crafting
    UI, so the HAR at fixtures/fishing-cast.har may contain the
    endpoint if it was open during capture.
  - Where those inputs come from: fishing catches, dungeon loot,
    purchase, or a mix. This matters more than the raw number.
  - Whether crafting itself costs energy or has a daily cap. If it
    draws from the same 240/day pool, potions compete directly with
    the runs they are meant to improve, and that changes everything.

Then compute the trade, both sides in the same units:
  - COST: inputs per potion, expressed in whatever produces them
    (casts, runs, or energy).
  - BENEFIT: run the sim with 1, 2, and 3 potions committed vs zero,
    and report mean rooms cleared for each. This reuses the gear-sweep
    harness -- same shape of question, same method. Note the sim
    cannot yet model use_item timing, so treat these as an upper bound
    (perfectly-timed heals) and say so.

Report the break-even: how much loot must a room yield for a
committed potion to pay for itself. That number, not the heal amount,
decides whether to commit 0, 1, 2, or 3.

IF THE INPUTS COME FROM FISHING: say so prominently. It would mean
the two halves of this project are one economy -- fishing feeds
crafting feeds dungeon depth -- and the orchestrator's loop priority
in SPEC §6 (currently "dungeon first, it caps at 10/day") would need
re-deriving from that, not from run caps.

Still read-only this session. Do not craft anything -- CLAUDE.md's
ask-first list covers spending the user's materials.
