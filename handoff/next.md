# BRIEF — session 27

Session 26's `nextPosition`/`nextMovePath` investigation found the field in
8/225 turns (3.56%) and concluded it was too rare to be a standing
mechanic. **New information changes that conclusion.** The user has fishing
skills the codebase didn't know about — most importantly **Fintuition**
(currently level 2: 3% per-turn chance to reveal the fish's next move).
3.56% observed against a 3% expected rate, over n=225, is a match, not
noise session 26 had no way to explain. This is not a dead end — it's a
confirmed mechanic. Re-open it.

Also new: **Dual Yield** (level 2: 4% chance to catch 2 fish at once,
possibly changing the catch-resolution UI/response shape), and a direct
report from the user that catch rate "feels very low" — which needs a more
foundational check than either skill before anything else.

Today's real daily caps were exhausted by session 25 and untouched by
session 26 (zero live calls). Assume they may still be tight — everything
below is scoped to work from existing code and fixture data first; check
real state before assuming new live casts are needed or available.

---

## 1. Top priority: is the bobble/focus-point actually being moved in live play?

The user's low-catch-rate concern deserves a direct, checked answer before
chasing either skill. Read `scripts/liveFishing.ts` and
`src/strategy/fishing/*.ts` end to end and answer plainly: does the live
loop ever send an action that repositions the focus point (`focusMeter`
per SPEC.md — the mechanic modelled in `castSim.ts`), or does it default to
center/static every cast? If it's a no-op or effectively always-centered,
that's a bigger and more foundational problem than either skill below —
say so directly if that's what's found, don't soften it.

## 2. Re-examine `nextPosition`/`nextMovePath` as a Fintuition proc, not noise

Re-check the 8 turns from session 26's audit (QUESTIONS.md §12) against
this new context. If confirmed as Fintuition:

- Document the mechanic properly (SPEC-fishing.md, not just
  QUESTIONS.md/DECISIONS.md — this graduated from "hypothesis" to
  "explained finding").
- Scope (don't necessarily build yet) how the live loop should react when
  `nextPosition` is present: reposition the focus point to guarantee the
  hit on the predicted cell, rather than the current matcher-based
  inference. This is a genuine, if infrequent (~3%), guaranteed-value
  opportunity the loop currently does nothing special for.
- Note Fintuition is presumably upgradeable — worth asking the user
  whether they plan to level it further, since the proc rate (and thus
  this mechanic's value) scales with upgrades.

## 3. Fold the user's real heuristic into Task 13's scoring design

The user's own manual play heuristic for `chooseNewCard`: pick the card
with the most hit/catch spots (grid coverage), not raw hit-power/mana. This
is a concrete, sourced alternative to sim against the current
argmax-hit-power/mana placeholder — use it as Task 13's first real
candidate to test with the deck-aware `simulateCast` infrastructure session
26 already built, rather than inventing hypothetical alternatives. Task
13's own data-floor gate (needs more than 1 live card choice on record)
is unchanged — this doesn't unblock live validation, but it gives the sim
comparison a real, motivated alternative to test instead of a strawman.

## 4. Check whether Dual Yield has ever fired, silently mishandled or not

Search existing fishing-cast fixtures for any catch response shaped
differently than the standard single-fish resolution (extra entries in
`caughtFish`, an unexpected `cardsToAdd` count, two `gameItemBalanceChanges`
fish entries in one response, etc.). At 4% over the existing cast corpus,
it may simply never have triggered — check before assuming either way. If
it has fired and the current `loot` handling assumes exactly one fish,
that's a real gap worth fixing before it fires live again.

---

## Your task

1. Direct, honest answer on whether the focus-point repositioning mechanic
   is actually exercised in live play. This is the priority — answer it
   before the other three.
2. Re-derive the Fintuition/`nextPosition` connection from existing data;
   document properly if confirmed; scope (don't build) the guaranteed-hit
   reaction.
3. Document the user's grid-coverage heuristic as Task 13's first real
   candidate, ready to sim-test once there's session time for it.
4. Audit existing fixtures for any Dual Yield firing; report either way.
5. Check real daily cap state before assuming any new live casts are
   available or needed — everything above should be answerable without
   them.
