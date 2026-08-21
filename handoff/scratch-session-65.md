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

## 2. NEW UNKNOWN FIELDS on the wire: `data.nextPosition`, `data.nextMovePath`
Fired on turns 1,2,3 of cast 1 and on the `use_fishing_item` doc. Dumped to
`logs/fishing-unknown-midcast-*.json`. NOT mentioned in session 64's recap.
**The server appears to be sending the fish's next position outright** — which
is the exact quantity this repo spends `matcher.ts` / ring predictors / the
`nextPositionOverride` Wilson gate on predicting. Needs checking: is this new,
and does it make the prediction stack redundant? Do NOT act on it in-session.

## 3. `nextPosition` override is ARMED for the first time
`· nextPosition override ACTIVE (10/10 hits, Wilson lower bound 72.2%)`
Session 30/39's gate has never armed live before ("this override has never
armed live yet regardless of how many casts run this session" — its own
comment). It has now. Related to §2 above, probably causally.

## 4. The sweep's arms were NOT what the brief said — see §3 of the recap
`oilTimingSweep.ts`'s header already states `costsTurn=true` is an ARTIFACT
branch and robustness is judged WITHIN `costsTurn=false`. So the "+19.40pp
computed across both arms" framing needs checking, not assuming.
