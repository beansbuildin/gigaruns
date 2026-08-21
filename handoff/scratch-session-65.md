# scratch — session 65 (surprises as they land)

## 1. Item 937 fired on CAST 1 of 7 — the ~51% lottery hit immediately
`★ on-demand LETHAL trigger: fish at 1/23 HP (1 Relaxing Oil held) — using one.`
`✓ use_fishing_item (937): fish now 0/23, focus 1/3, mana 6 -> 6` → CAUGHT after 4 turns.

- **`slotIndex: 0` CONFIRMED for Mid Relaxing Oil (937)** — by our own consume.
- The lethal trigger did exactly what its thesis says: converted a live fish at
  1 HP into a certain catch on the same turn.
- Mana 6→6 — no mana cost, second independent confirmation (942 gave 3→3).
- fishHp 1 ≤ fishDamage 2, so the trigger fired at 1 rather than exactly 2.

**Consequence: stock is now Relaxing 0 / Focus 22 — PARTIAL DRY is live from
cast 2 onward**, the state implemented and tested earlier this session (§1c).
This batch is its first real execution.

## 2. `data.nextPosition` — I WAS WRONG, it is not new. CHECKED, corrected.
My first read was "the server has started sending the fish's next position."
It has not. `nextPosition`/`nextMovePath` have fired on ~1-2% of responses
since session 30 (QUESTIONS.md §12), and `liveFishing.ts` has a whole
validation-and-override section built on them. The `UNKNOWN FIELD` banner
fires only because the field is not on the known-keys list, not because it is
new. **Rule 10's trap in miniature, and I nearly walked into it: a warning
that first APPEARS in today's logs is not an effect that first HAPPENED
today.** Verified: 2 casts of this batch carry it, and in both the server's
`nextPosition` matched the NEXT state's `fishPosition` exactly (2/2).

## 3. The `nextPosition` override ARMED for the first time — this part IS new
`· nextPosition override ACTIVE (10/10 hits, Wilson lower bound 72.2%)`
The code comment asserting it "has never armed live yet" was true when written
and is now false; fixed in place. The validation log is 12 entries / 12 hits
across 9 casts, so **the gate has never been tested by a MISS** — 72.2% is a
lower bound that has only ever been observed climbing, not a measured accuracy.
It is now a LIVE input to card choice rather than a dormant safeguard.

## 4. The sweep's arms were NOT what the brief said — see §3 of the recap
`oilTimingSweep.ts`'s header already states `costsTurn=true` is an ARTIFACT
branch and robustness is judged WITHIN `costsTurn=false`. So the "+19.40pp
computed across both arms" framing needs checking, not assuming.
