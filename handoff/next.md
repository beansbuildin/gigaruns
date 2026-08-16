# BRIEF — session 17

The stale-brief guard worked exactly as designed — you detected `next.md` was
session 15's already-executed brief, didn't re-run it, didn't guess at what a
session-16 brief would have said, and worked the next unblocked task with the
reasoning stated. That's the protocol functioning. And Stage B was a better
choice than the brief you didn't receive would have made.

Three findings from it deserve calling out, then two corrections and the task.

---

## 1. Three results that change the picture

**`use_item` costs no combat turn.** This resolves the question I flagged in
session 11 as deciding the entire policy shape. It isn't a tempo trade — it's
pure scarcity allocation. The only cost of healing early is overheal waste.

**The old `potionSweep.ts` modelled a heal as `hpMax += 20`** — a permanent stat
boost, not a heal. That's the sweep whose `+1.26 rooms` figure I quoted back to
the user in session 16 as the largest effect the project had measured. The
conclusion survived (corrected: `+1.347`), but the number I cited came from a
broken model, and you found it while building the replacement rather than
inheriting it. Keep the old script marked as buggy so nobody re-quotes it.

**`data.index` is a consumption counter, not an item ID.** `[131, 131]` needs
`index: 0` then `index: 1`. Worth flagging in SPEC prominently — it's the kind
of field that looks like an ID and silently isn't.

## 2. Your threshold sweep stopped at its own optimum — extend it

You swept `{0.2, 0.34, 0.5}` and 0.5 won at every loadout size. **0.5 is the
highest value you tested**, so the sweep's best row sits on the boundary of the
search space, and the true optimum may be outside it.

Your own explanation predicts this. If waiting risks a lethal exchange crossing
the check point before the heal fires, *and* healing costs no turn, then the
only argument against healing earlier is overheal waste. Against a 20 HP heal on
a 36 HP pool, overheal only starts binding above roughly `1 − 20/36 ≈ 0.44`
— which 0.5 already exceeds without losing.

Re-run at `{0.5, 0.6, 0.7, 0.8, 0.9}` × loadout `{1, 2, 3}`. Report the full
curve, not just the winner, so the shape is visible. If the maximum lands on an
interior point, that's the real optimum; if it lands at 0.9, extend again and
say so.

This is a free correction — pure sim, no energy, no materials.

## 3. Q1 and Q3 are one question, and here's the break-even

Q3 (default potions on?) reduces entirely to Q1 (does crafting draw from the
240/day pool?), because stock is nearly gone — 3 Big Heal Juice against ~2
consumed per run.

The math, so the craft probe returns a decision rather than a datum. Daily
budget 240 energy ≈ 12 runs at 20 each, so both caps bind together and any
energy spent crafting directly costs runs.

- **No potions:** `12 × 2.130 = 25.6` rooms/day.
- **3 potions/run**, crafting costing `X` energy per attempt at 70% success:
  expected `X/0.7` per potion, so `20 + 4.29X` per run, and
  `3.477 × 240/(20 + 4.29X)` rooms/day.

Setting them equal gives **`X ≈ 2.9`**. So:

- **Crafting costs no energy** → `12 × 3.477 = 41.7` rooms/day, a 63% gain.
  Default potions on at 3 per run, immediately.
- **Crafting costs under ~3 energy per attempt** → still net positive, scale
  the loadout to the margin.
- **Crafting costs more than ~3** → potions lose to simply running more.
  Recommend spending the remaining free stock and then stopping.

**Authorized: one craft attempt** with `GET /offchain/player/energy` immediately
before and after. Materials are abundant (700–900 of each input) and a failed
attempt answers the energy question just as well as a success. One attempt, then
stop — don't build stock before the number is known.

Re-derive the break-even with the §2 sweep's corrected optimum before
recommending, since a better threshold shifts the benefit side.

## 4. Fishing — the user has to act, and I've asked again

Nothing here is an agent task. Two reasoned guesses were spent, both cleanly
rejected, and the state is confirmed persistent rather than transient. Correct
call not to guess a third time.

The user has been asked twice. Framing it for them as two tiers this time:

- **Minimum:** open Dendren in the browser and pick a card. That alone unblocks
  the account, even with nothing captured.
- **Better:** do it with DevTools → Network open and paste back the request
  payload and URL.

If only the minimum happens, the account unblocks and the action name gets
captured on the *next* catch instead — so build the live fishing loop to dump
the full raw response on any terminal event it doesn't recognise. That turns the
next catch into an automatic capture and removes the user from the loop
permanently.

Do that regardless of whether they act this session.

---

## Your task

1. **Extended threshold sweep**, per §2. First — it's free and it feeds §3.
2. **One craft attempt with before/after energy**, per §3. Authorized.
3. **Break-even recommendation**: default potions on or off, at what loadout,
   with the numbers.
4. **Unknown-terminal-event raw dump** in the fishing loop, per §4.
5. If the user unblocks fishing: spend the day's casts. `perimeterWalk(cw)` is
   still one confirming cast from promotion, and it remains the only evidence
   the matcher can ever help.

Note the death histogram is now 15 deaths at `0/4/5/6` — still no room-1 death,
still even. Task 11 stays parked; its revival condition was the histogram
changing shape, and it hasn't.

Addendum — fishing account UNBLOCKED by the user:

The user opened the client and found a "COLLECT" screen for the most
recent catch, clicked collect, then selected a spell card. The account
is no longer stuck. Verify with scripts/checkFishingStuck.ts at session
start -- expect a clean state and fullDeck length 11 (was 10, +1 for
the card selected).

Note the sequence: COLLECT is a SEPARATE step before card selection.
The stuck state was between those two, which is why select_card and
claim were both rejected -- the collect step hadn't happened yet.
Record in SPEC-fishing.md as the catch resolution flow.

No request was captured, so the action names are still unknown. The
§4 unknown-terminal-event raw dump is now MORE important, not less --
it is the only remaining path to capturing them, and it fires on the
next catch. Build it before spending casts.

Fishing casts are now unblocked. §5 applies: perimeterWalk(cw) is one
confirming cast from promotion.
