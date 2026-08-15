# SESSION LOG — session 11 — 2026-08-15

Same content as `handoff/STATE.md` at commit time, plus the verbose detail
that doesn't belong in a ~150-line state file: full endpoint dumps, the raw
boon-pickup derivations, and the live-run log excerpts the summary numbers
above are drawn from.

---

## STATE.md (verbatim at commit time)

(See `handoff/STATE.md` in this commit — not duplicated here to avoid drift
between the two copies. Read that file for Status/What works/What's
broken/Corrections/Dead ends/Metrics/Open questions.)

---

## What actually happened, in order

1. **Read the brief.** `handoff/next.md` still carries the "BRIEF — session
   10" header — the last commit before this session ("brief: session 11")
   only APPENDED to that file (§6 run economics, §7 potion timing, and an
   addendum about potions/HAR), it never renamed the header. `STATE.md`
   (session 10) already covered everything in the ORIGINAL part of that
   brief. The delta this session actually needed to act on was: the HAR
   parse (§4/addendum), the DECISIONS.md economics entries (§6/§7), the
   TASKS.md potion downgrade (addendum), and the still-blocked 3-run live
   stage (QUESTIONS.md §8).

2. **Asked the user directly about the budget** rather than writing to
   QUESTIONS.md and waiting — this is an interactive session, not the
   autonomous bot loop, so there was no reason to defer a decision the user
   could answer immediately. User picked "raise today's budget."
   `config/bot.json` → 240/12 (matching the user's own stated real economics
   from brief §6, not an arbitrary number).

3. **Launched the 3-run live batch in the background** (`npm run live --
   --runs=3`, logged to `logs/session11-liverun.log`) and worked the fishing
   HAR in parallel while it ran.

4. **Found the HAR** at `fixtures/fishing-casts/fishing-cast.har` (not the
   exact path the brief specified, `fixtures/fishing-cast.har`, but correctly
   gitignored either way). Also found a dense community research note at
   `~/Downloads/FISHING-NOTES-SHAREABLE.md` (not part of the repo) claiming
   a much broader API surface — treated as hypotheses per CLAUDE.md §9, not
   transcribed. Every claim from it that mattered got independently
   corroborated or corrected against the actual HAR (see the corroboration
   list below).

5. **Built `scripts/parseHar.ts`**, ran it, and it immediately surfaced a
   real schema gap (see Corrections in STATE.md — `isDayCard` nulls).

6. **Live batch finished clean** (0 HTTP 500s, 3/3 runs, 0 combat-model
   failures) while the HAR work was in progress.

7. **Ran the full test suite** and got 6 corpus-total-assertion failures —
   NOT bugs, the established pattern (DECISIONS 2026-08-16: "expected to
   fail after every capture… the mechanism that forces new data to be
   looked at"). Investigated each one individually rather than just bumping
   numbers — this is where `AddMaxArmor`/`CorrosiveShield` modeling and the
   gear-change PLAYER update came from; both were real findings the test
   failures pointed at, not incidental drift.

8. **Wrote `SPEC-fishing.md`**, updated `config/discovered.json`,
   `DECISIONS.md`, `TASKS.md`, `QUESTIONS.md`.

---

## Fishing HAR — full endpoint list captured

80 total HAR entries, 48 distinct endpoints. Relevant subset (full list in
`scripts/parseHar.ts`'s own stdout, reproducible by re-running it):

```
GET  /api/fishing/cards
GET  /api/fishing/state/{address}
GET  /api/offchain/static
GET  /api/indexer/gameitems
GET  /api/indexer/player/gameitems/{address}
GET  /api/items/balances
POST /api/fishing/action     (6 calls: 1 start_run, 5 play_cards)
```

No `Authorization` header anywhere in the 80-entry HAR (checked
programmatically) — likely Chrome's "omit sensitive data" HAR export option,
not confirmed. `gameItemBalanceChanges` was `[]` on every `play_cards`
response, `undefined` (absent) on `start_run`.

## The one full cast, condensed

```
start_run  nodeId="5" tierId=1        → playerHp 10/10, fishHp 13/20, gridSize 4
play 1 (idx1, miss)                    → playerHp 9,  fishHp 16
play 2 (idx1, miss)                    → playerHp 8,  fishHp 19
play 3 (idx0, HIT 5)                    → playerHp 7,  fishHp 14, NEW_HAND
play 4 (idx1, miss)                    → playerHp 6,  fishHp 17
play 5 (idx0, miss)                    → playerHp 5,  fishHp 20 (max)  → FISH_ESCAPED
COMPLETE_CID true, SUCCESS_CID false
```

`focusPoint` moved `[2,2]` → `[3,3]` after play 1 and stayed there — the
bobber move and the card play are the same action on this grid.

## Item metadata — the three heal potions, verbatim `itemEffect`

```
docId 151 "Lil Heal Juice"  RARITY Common    itemEffect: OnUseBattle → Heal amount 4
docId 155 "Mid Heal Juice"  RARITY Uncommon  itemEffect: OnUseBattle → Heal amount 8
docId 131 "Big Heal Juice"  RARITY Rare      itemEffect: OnUseBattle → Heal amount 20
```

All three: `durabilityChange: -1`, `playerType: "ThisPlayer"`,
`statusType: "None"`. Item 845 = `"Hard Core"` (the leaderboard-scored item),
confirmed via both `/indexer/gameitems` and `/offchain/static`.

## Community note corroboration (FISHING-NOTES-SHAREABLE.md, not repo content)

Claims that matched this capture: `playerHp` = mana (exact), `cards` = hand
index not card id (exact, confirmed by discard-diffing), energy costs
12/16/20 and daily caps 10/20 (matched `node0/1/2Energy` and
`maxPerDay(Juiced)` almost exactly), item 845 = Hard Core (exact), dungeon
id 5 = Forbidden Woods (matches `config/discovered.json`, already known).

Claims NOT corroborated (this capture can't test them): the 4-pattern fish
movement taxonomy (only 5 moves observed, one pattern's worth of signal at
most), a second/third pond's existence, redraw's wire shape, a catch's wire
shape.

Claims this capture's OWN data superseded rather than just confirmed: the
note listed "cast-start POST" as an uncaptured gap — it's not a separate
action, it's `action: "start_run"`, the same name the dungeon side uses.

## Boon pickups — full dump, this session's 6 new ones

```
run-2026-08-15-15-38-09 state-009→010  room 1
  offered: AddIntuition(1,0) | UpgradePaper(4,0) | UpgradePaper(0,4)
  picked:  AddIntuition — rolled intuition 0→1

run-2026-08-15-15-38-09 state-029→030  room 2
  offered: CorrosiveShield(2,0) | Regen(1,0) | VulnerableEvade(4,0)
  picked:  CorrosiveShield — hp 22→22, armor 10→10, armorMax 16→16 (NO CHANGE — latent)

run-2026-08-15-15-38-09 state-053→054  room 3
  offered: AddLuck(1,0) | AddIntuition(1,0) | AddIntuition(2,0)
  picked:  AddLuck — rolled lck 0→1

run-2026-08-15-15-38-09 state-078→079  room 1
  offered: AddEvasion(1,0) | AddBlock(5,0) | AddWeakSword(2,0)
  picked:  AddEvasion — rolled evasion 0→1

run-2026-08-15-15-38-09 state-090→091  room 2
  offered: Regen(2,0) | AddMaxArmor(4,0) | AddBlock(7,0)
  picked:  AddMaxArmor — armor 14→14 (unchanged), armorMax 16→20

run-2026-08-15-15-38-09 state-111→112  room 1
  offered: AddLifestealShield(3,0) | BurnMastery(1,0) | AddTenacity(3,0)
  picked:  AddTenacity — rolled tenacity 0→3
```

New unmodelled types sighted (offered, not picked): `VulnerableEvade`,
`AddWeakSword`, `AddLifestealShield`, `BurnMastery`.

## Gear change, exact before/after (newest unbooned opening state)

```
hpMax     32 → 34
armorMax  16 → 16 (unchanged)
rock (Sword)    ATK 16→20  DEF 0→4
paper (Shield)  ATK 6→6    DEF 12→12 (unchanged)
scissor (Spell) ATK 16→12  DEF 12→8  (REVERTED — session 09 had pushed this UP to 16/12)
```

Non-monotonic: don't assume gear only ever improves when reading a future
recap that only skims the delta.

## Room 4 — first non-Safe-tier capture ever, full buff payload

```json
{
  "id": "withering",
  "name": "Withering",
  "description": "Applies 1 Weak on Magic wins",
  "minTier": 1,
  "effects": [{"kind":"onEnemyWinExchange_applyStatus","statusType":"Weak","amount":1,"moveType":"scissor"}]
}
```

Confirmed via `cid=24804259` (`run-2026-08-15-15-38-09`) — the ONLY room-4
capture with a non-null `activeEnemyBuff` out of 4 total (the other 3, all
Safe-tier, stayed null throughout). Logged in `tests/enemies.test.ts`, not
added to `ROOM_ENEMIES` — one instance, not a stable profile yet.

## Live-run log — full room/reward/tier trail, all 3 runs

```
run 1/3: room1(AddIntuition, tier1 NOT safe) → room2(CorrosiveShield, tier1 NOT safe)
         → room3(AddLuck, tier1 NOT safe) → room4, died HP 3/34
run 2/3: room1(AddEvasion, tier2 NOT safe) → room2(AddMaxArmor, tier1 NOT safe)
         → room3, died HP 14/34
run 3/3: room1(AddTenacity, tier2 NOT safe) → room2, died HP 4/34
```

Every room-1→2 (and deeper) transition this session had NO Safe tier
offered — matches session 09's finding that Safe isn't guaranteed
(`pickLowestTier()` handled all of them without incident, as designed).

energy: 137 total today (guard-tracked), 8 runs. 0 guard trips.

## Test suite — the 6 corpus-total failures, one at a time, what each meant

1. `boons.test.ts` "contains before/after pairs" (17→23): expected, 6 new
   pickups.
2/3. `boons.test.ts` "CorrosiveShield/AddMaxArmor has a pair but no model":
   real finding, not drift — modeled both (see above).
4. `boons.test.ts` "covers every boon type the corpus has a pair for":
   downstream of #2/#3, resolved by modeling.
5. `boons.test.ts` "OBSERVED_OFFERS is exactly what the corpus recorded":
   expected, 6 new offers added to the table.
6. `replay.test.ts` "loads the recorded captures" (214→264 exchanges) and
   "reports the headline numbers" (428→528 side-updates, 0 clean failures
   throughout — the number that actually matters): expected, new corpus.

Two SECOND-ORDER failures the first pass didn't anticipate, both because
`AddMaxArmor` going clean retroactively affected an EXISTING session-06
room-1 offer that had never been picked:
- `enemies.test.ts` PLAYER loadout tests (32/34 hpMax, distinct-loadout set)
  — real gear change, not caused by the boon work, just surfaced by the same
  new corpus data.
- `enemies.test.ts` room-4 `activeEnemyBuff` test — real new capture
  (Withering), not caused by the boon work either.
- `dungeonSim.test.ts` × 3 (`CLEAN_BOON_TYPES` needed `AddMaxArmor` added;
  `battleCoverage.scored` 1108→1120; `scoredWinRate` 0.0032→0 at this exact
  seed) — all downstream of the SAME `AddMaxArmor` model change.
- `combat.test.ts` × 1 — scissor DEF literal (12→8) needed updating for the
  gear reversion.

All 249 tests pass after updates. `npx tsc --noEmit` clean throughout.
