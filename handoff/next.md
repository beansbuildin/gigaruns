# BRIEF — session 19

Session 18 closed the fishing-side loose end for real this time — 9 bot-driven
casts, 4 catches, `loot` fired cleanly every time, zero stranding. That's
QUESTIONS.md §10 done on every axis it's ever been checked against. It also
caught and fixed a real process gap (stale test-suite count from an
out-of-band commit) rather than inheriting it silently. Endorsing the fix
session 18 itself proposed in its open questions: add a line to CLAUDE.md's
working-style section (or wherever the recap step lives) that the full suite
gets re-run against the FINAL commit at recap time, not against whatever was
last checked mid-session. Do that as a small housekeeping edit before the
main task, not as its own session.

One new thing changes this session's shape entirely.

---

## 1. The user found a lever that may remove the real bottleneck

Both dungeon and fishing hit the same wall at session 18's end: real account
energy at 10/420, confirmed shared pool, nothing left to do but wait on
18/hr regen. That's not a guard/config problem — every session since 17 has
been throttled by it.

The user reports ROMs (NFT assets tied to the wallet) can be claimed for
energy via a UI button outside dungeon/fishing screens, and captured two real
requests logged under `factory-claim`:

```json
{"romId":"7959","claimId":"energy","amount":7}
{"romId":"2097","claimId":"energy","amount":57}
```

Confirmed directly with the user: **no wallet signature or gas prompt** when
claiming. That puts this in the same bucket as the existing dungeon/fishing
actions — an authenticated REST call, not an on-chain spend — so it does not
fall under CLAUDE.md's ask-first list as written. Treat it as routine once
verified live, same tier as `loot` or `use_item`.

**Endpoint CONFIRMED by the user:** `POST https://gigaverse.io/api/roms/factory-claim`.
No need to probe for it — write it straight into `SPEC.md`/`config/discovered.json`
as CONFIRMED (method + path from the user's own capture, per CLAUDE.md §2)
and start from there. HTTP method assumed POST given the body carries
`romId`/`claimId` (a write, not a query) — confirm this is actually correct
against the captured request, not just assumed from the body shape.

**Open questions once the endpoint is confirmed, in priority order:**

1. Is `amount` a request parameter or a response value? Reads much more like
   a response (the two ROMs returned different amounts for the same
   `claimId`) — if so, the request likely only needs `romId`/`claimId`, and
   `amount` is server-determined per ROM. Don't assume either way; check the
   full captured response, not just the body fragment above.
2. How many ROMs does this wallet hold, and how are they enumerated? Two
   IDs are known (7959, 2097) — there may be more. Look for a balances-style
   read endpoint before assuming these are the only two.
3. Is there a per-ROM cooldown (daily? one-time?)? This decides whether ROM
   claiming is a one-time energy top-up or a recurring daily income source —
   materially different for Task 10's budget model.
4. Total claimable energy per day across all owned ROMs, once 2–3 are
   answered — this is the number that actually matters for whether the real
   10/420-style floor stops binding.

**Gate, capture-first per CLAUDE.md §6:** document the confirmed endpoint,
request/response schema, and cooldown behavior in `SPEC.md` (new section) and
`config/discovered.json`. One live claim against a real ROM, before/after
`GET /offchain/player/energy` read, confirms the amount actually lands in the
spendable pool (not a separate currency). Don't build automation around this
until that live confirmation exists — same discipline as the potion-timing
task's Stage A/B split.

## 2. Task 10 (Orchestrator) — still the next unstarted task, now worth more

Unchanged from last brief: `guards.ts` has no energy-regen sleep loop,
`liveRun.ts` has no `SIGINT` handling. Still the real next task. But it's
worth sequencing AFTER the ROM discovery above, not before — the orchestrator's
energy-budget model is a different design if ROM claims can top up the pool
mid-session versus if the only lever is waiting on 18/hr regen. Don't build
the sleep-loop's energy math twice.

## 3. Carried forward, unchanged

- `mineFishPatterns.ts`: 1 of ~23 candidates promoted (`perimeterWalk(cw)`,
  now live-wired). More casts compound this automatically — spend fishing
  budget as energy allows (doubly true now if ROM claims add headroom).
- `chooseNewCard` heuristic: still an explicit placeholder, still not urgent.
- Death-room histogram: unchanged at 0/4/5/7 (no dungeon runs completed
  session 18). Task 11 stays parked.

---

## Your task

1. Housekeeping: add the recap-against-final-commit line per session 18's
   own suggestion.
2. Write `POST /api/roms/factory-claim` into SPEC.md/`config/discovered.json`
   as CONFIRMED (endpoint from the user's capture) with the two known
   request bodies as fixture data. Confirm HTTP method against the actual
   capture rather than assuming from body shape alone.
3. Answer the four ROM questions above from the confirmed schema — most need
   the FULL response body (not just the fragment already in hand) and a
   ROM-enumeration read endpoint, both still to find.
4. One live claim with before/after energy read. Document the result. Do not
   automate yet.
5. If time remains: start Task 10, informed by whatever the ROM energy model
   turned out to be.
