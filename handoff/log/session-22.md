# session 22 — 2026-08-17

Brief: ROM enumeration (the session's real spine — user supplied
`GET /roms/player?id=<address>` directly), fishing top-off if convenient,
`chooseNewCard` scoping if time remained. No conflict between STATE.md and
next.md at session start.

## 1. ROM enumeration — probe

`scripts/probeRomsPlayer.ts` (new, read-only). Hit `GET /roms/player?id=
<address>` live:

```
address: <ADDR>
GET /roms/player?id=<address> -> HTTP 200, 86189 bytes

Top-level keys: [ 'entities' ]
"entities" is an array of 37 entries.
```

Each entry: `docId`, `factoryStats` (`tier`, `faction`, `energyCollectable`,
`maxEnergy`, plus per-week accrual fields), `offchainRomDoc` (cosmetic —
image/gif/mp4 URLs, serial number).

Cross-checked `docId` against the 4 previously-known `romId`s used by
`factory-claim` — all 4 appear verbatim in the list:

```
known-4 present in docId set: {'7959', '5345', '2097', '689'}
```

Full enumeration, sorted by `energyCollectable` descending:

```
('2696', 540, 'Gold', 'Overseer', 540)
('6096', 540, 'Gold', 'Chobo', 540)
('4586', 315, 'Gold', 'Overseer', 315)
('2768', 315, 'Gold', 'Chobo', 315)
('4543', 315, 'Gold', 'Archon', 315)
('2894', 315, 'Gold', 'Chobo', 315)
('3777', 252, 'Gold', 'Overseer', 252)
('5446', 180, 'Void', 'Archon', 540)
('3754', 168, 'Silver', 'Archon', 168)
('2493', 84, 'Silver', 'Chobo', 84)
('7033', 43, 'Gold', 'Overseer', 540)
('2114', 28, 'Silver', 'Chobo', 126)
('4720', 28, 'Silver', 'Chobo', 126)
('741', 26, 'Silver', 'Overseer', 168)
('7246', 20, 'Gold', 'Archon', 252)
('4950', 13, 'Gold', 'Overseer', 168)
('5996', 13, 'Gold', 'Overseer', 168)
('3196', 13, 'Silver', 'Archon', 168)
('2201', 13, 'Silver', 'Archon', 168)
('2671', 13, 'Silver', 'Chobo', 168)
('6541', 13, 'Silver', 'Gigus', 168)
('8156', 12, 'Silver', 'Overseer', 168)
(15 more at 0, including the previously-known 4: 7210, 2097, 7959, 7701,
 5345, 9850, 689, 4420, 459, 558, 3066, 2892, 5251, 5401, 8972)

sum energyCollectable: 3259
```

Matches session 20's ~3,252 hand-pasted snapshot almost exactly (small
delta = live accrual between snapshots). `config/discovered.json`'s new
`roms.allRoms` holds the full list (gitignored — real docIds).

**Redaction near-miss, caught before commit (see step 5 below for the fix):**
the first redacted fixture write only stripped the exact account address
(`OWNER_CID`), missing per-ROM `lastTx` transaction hashes and a shared
`tableId` field — both are `0x` + long hex strings that aren't the account
address string itself, so the address-only regex didn't touch them. A tx
hash resolves the transacting wallet on any block explorer, so this would
have been a real (if indirect) address leak into a public repo had it been
committed. Fixed by broadening `probeRomsPlayer.ts`'s `redact()` to strip
any `0x[a-fA-F0-9]{20,}` after the address-specific pass, and regenerating
the already-committed-nowhere fixture from the untouched raw dump (no
second live call needed).

## 2. ROM enumeration — claiming

`scripts/claimAllRoms.ts` (new) — sources the full list live every run
(never hardcoded), filters `energyCollectable > 0`, claims descending,
`--limit=N` for a bounded pass.

**Batch 1, `--limit=5`:**

```
37 ROMs total, 22 with energyCollectable > 0, claiming 5 (--limit=5).
Snapshot sum across the 5 being claimed: 2025 energy.
Starting account energy: 88
docId 2696 (snapshot 540): success=true
  energy 88 -> 420 (delta 332)
docId 6096 (snapshot 540): success=true
  energy 420 -> 420 (delta 0)
docId 4586 (snapshot 315): success=true
  energy 420 -> 420 (delta 0)
docId 2768 (snapshot 315): success=true
  energy 420 -> 420 (delta 0)
docId 4543 (snapshot 315): success=true
  energy 420 -> 420 (delta 0)

Final energy: 420 (started at 88, net +332)
```

**The 4 zero-delta results needed independent verification, not
assumption** — re-ran `probeRomsPlayer.ts` immediately after:

```
2696 energyCollectable= 208   (540 - 332 = 208, exactly the untaken remainder)
6096 energyCollectable= 540   (UNCHANGED — the 0-delta claim did not touch it)
4586 energyCollectable= 315   (UNCHANGED)
2768 energyCollectable= 315   (UNCHANGED)
4543 energyCollectable= 315   (UNCHANGED)
```

Confirms: claiming while the account is already at the 420 cap is a
genuine no-op — `success:true` in the response, zero effect on either the
account or the ROM. Nothing lost, but also nothing gained; the productive
move is to claim after spending some energy down, not to force a full pass
while capped.

**Batch 2, after fishing spent 60 energy down (see §3): `--limit=1`:**

```
37 ROMs total, 22 with energyCollectable > 0, claiming 1 (--limit=1).
Starting account energy: 360
docId 6096 (snapshot 540): success=true
  energy 360 -> 420 (delta 60)

Final energy: 420 (started at 360, net +60)
```

Exactly filled the 60-energy headroom fishing had opened, confirming the
pattern a second time: credited amount = min(ROM's `energyCollectable`,
headroom to cap).

**Net this session: +392 energy from ROM claims** (332 + 60), the largest
single-session ROM yield so far.

## 3. Fishing — remaining budget

`npx tsx scripts/liveFishing.ts --casts=5`, full output:

```
▸ liveFishing.ts — 5 cast(s)
  · resuming today's fishing budget: 180 energy / 15 casts already spent
  account <USER>

▸ cast 1/5
  ▸ turn 0: card 21 @ focus [1,3] (P_hit 1.00, ev 8.0)
  ▸ turn 1: card 35 @ focus [2,3] (P_hit 0.14, ev -1.9)
  ▸ cast over: escaped after 2 turns
  ▸ energy: 420 -> 408  (spent 12)

▸ cast 2/5
  ▸ turn 0: card 6 @ focus [3,1] (P_hit 1.00, ev 5.0)
  ▸ turn 1: card 1 @ focus [3,2] (P_hit 0.40, ev 0.2)
  ▸ turn 2: card 5 @ focus [3,2] (P_hit 0.14, ev -1.9)
  ▸ cast over: escaped after 3 turns
  ▸ energy: 408 -> 396  (spent 12)

▸ cast 3/5
  ▸ turn 0: card 10 @ focus [3,4] (P_hit 1.00, ev 10.0)
  ▸ cast over: escaped after 1 turns
  ▸ energy: 396 -> 384  (spent 12)

▸ cast 4/5
  ▸ turn 0: card 21 @ focus [4,3] (P_hit 1.00, ev 8.0)
  ▸ turn 1: card 3 @ focus [4,3] (P_hit 0.50, ev 1.0)
  ▸ turn 2: card 10 @ focus [4,3] (P_hit 0.43, ev 1.4)
  ▸ turn 3: card 5 @ focus [4,3] (P_hit 0.40, ev 0.2)
  ▸ turn 4: card 7 @ focus [4,3] (P_hit 0.20, ev -1.2)
  ▸ cast over: escaped after 5 turns
  ▸ energy: 384 -> 372  (spent 12)

▸ cast 5/5
  ▸ turn 0: card 21 @ focus [2,2] (P_hit 1.00, ev 10.0)
  ▸ cast over: caught after 1 turns — CAUGHT!
  ★ caught! resolving cardsToAdd offer (16, 34, 33) -> chose id 34
  ✓ loot sent — fullDeck now 15 card(s), cardChosenId 34
  ▸ energy: 372 -> 360  (spent 12)

▸ done. energy spent (guard-tracked) 240, casts 20
```

Today's fishing budget now fully spent (240/240, 20/20). This is the one
live card choice referenced in Task 13's scoping (§5 below).

`mineFishPatterns.ts` re-run against the grown log:

```
102 transitions across 30 casts

First-move classification:
  step1  18
  diag1  5
  line2  6
  jump2  0
  other  1

Primitive exact-match test:
  perimeterWalk(cw)        support=4  casts=[12923267,12925773,12942030,12945319]
  bounce(0,-1)             support=2  casts=[12923267,12945319]
  bounce(1,0)              support=1  casts=[12945306]
  bounce(2,0)              support=1  casts=[12944936]
  bounce(-2,0)             support=1  casts=[12944936]
  bounce(0,2)              support=1  casts=[12945313]
  bounce(0,-2)             support=1  casts=[12945313]
  twoCellCycle(0,-1)       support=1  casts=[12945319]
  perimeterWalk(ccw)       support=1  casts=[12945306]

  1 primitive(s) promoted: perimeterWalk(cw)

Sim catch rate (500 synthetic casts, focusMeter modelled):
  matcher BLIND (matcherPool: []):        33/500 = 6.6%
  matcher with MINED library (1 pattern): 81/500 = 16.2%
```

`perimeterWalk(cw)` support climbed 3→4 (no new promotion — still just the
one). `bounce(0,-1)` is new-ish: it was a single-match near-miss before
this batch, now at support=2, one more independent match from promotion.

## 4. Secret-scan finding, full detail (summarized in STATE.md)

Covered in §1 above. The fix is in `scripts/probeRomsPlayer.ts`'s
`redact()` function (two-pass: exact address, then any long hex string)
and the regenerated `fixtures/probe/roms/player-response-redacted.json`.
Verified post-fix: `grep -nE '0x[a-fA-F0-9]{4,}' fixtures/probe/roms/
player-response-redacted.json` only matches `NNNNxNNNN` image-dimension
substrings in `imgUrl`/`gifUrl`/`mp4Url` values (e.g. `1280x1280` contains
the literal substring `0x1280`) — an expected false positive of the
widened scan pattern, not a real hit.

Also checked: `fixtures/fishing-casts/live/cast-2026-08-17-05-57-33/raw/`
is correctly covered by the existing `fixtures/**/raw/` gitignore rule
(`liveFishing.ts`'s own established redaction path, unchanged this
session) — `git add -n` on the cast directory picks up only the 18
already-redacted `state-NNN.json` files, none of which matched the secret
scan.

## 5. `chooseNewCard` scoping (Task 13)

See TASKS.md Task 13 for the full writeup. Summary: current heuristic is
argmax hit-power/mana over the 3 offers, blind to the existing deck.
`castSim.ts`'s `simulateCast` builds a fresh RANDOM deck sample from the
full catalog every cast — it has no concept of a real, specific held deck
at all, so any deck-composition comparison needs that fixed first (cheap,
no new capture needed). The harder blocker is validation: only 1 live
card choice exists to check any heuristic against (this session's own
catch, `{16, 34, 33}` → chose `34`), and the sim's own fish-pattern model
underneath any deck-composition comparison is itself only weakly checked
against reality (16.2% sim vs. an unknown real rate estimated at ~3.3%
from 1-in-30 real casts). Scoped and written down; no code written this
session, per the brief's own explicit permission to stop there.

## Verification

```
$ npx tsc --noEmit
(clean)

$ npx vitest run
 Test Files  23 passed (23)
      Tests  356 passed (356)
```
