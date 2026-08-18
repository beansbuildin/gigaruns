# Session 43 — 2026-08-18 — commit 38fd190

Same content as `handoff/STATE.md` at this session's end, plus verbose
detail that didn't fit there.

## §0/§1 — Task 14's gate, live-verified

Pre-flight checks before spending anything (both runs):

- `npx tsx scripts/liveRun.ts --status`: local guard reset to 0/12 for
  2026-08-18 (date-keyed, prior day's spend doesn't carry over).
- `npx tsx scripts/checkDungeonToday.ts`: real server run count for
  Dungeon#5 — 6/12 before run 1, 9/12 before run 2 (both leaving room for
  exactly one more juiced start under the 12-run daily cap, matching the
  brief's own math: session 42's two prior juiced starts already spent 6,
  this session's two spend the remaining 6).
- Energy: 414/420 before run 1, 357/420 before run 2 — well above the
  60-energy cost either time.
- Wallet: 58x Big Heal Juice (itemId 131) before run 1 — well above the
  3 needed.
- Dry-run (`--juiced --juiced-index=3 --potions=3`) confirmed the intended
  envelope before sending anything real; cross-checked directly against
  `tests/liveRun.test.ts`'s pinned `buildJuicedStartRunEnvelope` test
  (dungeonId 5, actionToken "", consumables [131,131,131], isJuiced true,
  index 3) — exact match.

`config/bot.json`'s `forbiddenWoods.potions` block was temporarily
re-added (allowedItemId 131, maxPerRun 3) for both runs, then removed again
once both were complete, per the established session 24/42 convention
(documented in the block's own `_potionsComment`).

**Run 1** (`fixtures/dungeon-runs/run-2026-08-18-22-00-28/`, 85 states,
`logs/run-2026-08-18-22-00-26.jsonl`): started cleanly (`✓ start_run sent`),
played rooms 1-6, used 2 of 3 potions mid-combat (`use_item` HTTP 200 both
times), died room 6 at HP 0/40. Reward picks: AddTenacity, AddIntuition,
AddBlock, AddTenacity, AddIntuition (rooms 1-5). Enemy-path tier: Safe for
rooms 2-4, non-Safe (tier 1, "none was offered") for rooms 5 and 6 both.

Gate evidence: `gameItemBalanceChanges` at first kill —
`[{id:846,amount:5,rarity:-1},{id:846,amount:5,...},{id:846,amount:5,...}]`
×3 = 15 total, matching 5→15. Progression across all 5 kills: 5, 9, 14, 19,
25 (identical shape to every prior juiced run this corpus has). Item 845
(Hard Core) credits were single entries (672, 768, 864, 960) — not
tripled, consistent with session 42's "dropMultiplier and the juiced 3x
are separate channels" finding.

`GET /game/dungeon/today` before: 6. After: 9. Exactly +3.

**Handback to user** (brief §1): reported run 1's outcome and both gate
numbers, told the user to level up manually and give the go-ahead for run
2. The user replied "go ahead with run 2" mid-turn (surfaced as a
system-reminder mid-tool-call, not a separate conversational turn) — no
separate confirmation needed per the brief's own standing authorization.

**Run 2** (`fixtures/dungeon-runs/run-2026-08-18-22-07-14/`, 79 states,
`logs/run-2026-08-18-22-07-12.jsonl`): same pre-flight pattern (9/12 real
runs, 357/420 energy), same CLI invocation. Started cleanly, played rooms
1-5, used all 3 potions mid-combat, died room 5 at HP 0/40. Reward picks:
AddMaxArmor, AddLuck, AddBlock, UpgradePaper (rooms 1-4) — the UpgradePaper
pick at room 4 is this session's real capture finding (see below).
Enemy-path tier: Safe for rooms 2-3, non-Safe for rooms 4-5.

Gate evidence: same 3x-duplicate pattern, progression 5, 9, 14, 19, 25 —
byte-for-byte identical to run 1's, confirming (again) that `dropMultiplier`
doesn't visibly affect this reward channel regardless of entry tier. Item
845 credits: 672, 864, 1056 (again single entries).

`GET /game/dungeon/today` before: 9. After: 12. Exactly +3 — exhausts
today's real 12-run juiced cap for Dungeon#5.

Both runs' final HP confirmed via direct fixture inspection (not just log
console text): `data.run.players[0].health` = `{current:0, currentMax:40}`
on the last `post_response` carrying a `run` object in each log.

## Capture finding: `UpgradePaper`'s first pickup pair

Run 2's room-4 reward pick (`state-061.json` → `state-062.json`):
`selectedVal1: 8, selectedVal2: 0` → `paper.currentATK` 6 → 14,
`currentDEF` unchanged (12). This is the ATK-variant roll of the generic
`atk += val1; def += val2` reading `UpgradeRock`/`UpgradeScissor` already
established — both of THOSE happened to draw the DEF-variant roll first
(session 09), so this is the first live confirmation the ATK-variant
actually behaves the same way, not just a name-based assumption.

`boons.ts`'s own header comment used `UpgradePaper` as the canonical
illustration of "near-certain from the name, withheld anyway because
nobody picked it" — that illustration is now stale (the type has a real
pair), and the comment was updated to say so rather than left describing a
state that no longer exists.

Modelling this retroactively cleans 8 already-recorded room-1
`UpgradePaper` offers (documented across sessions 12/20/23 as "stays
unmodelled") — same mechanic session 11 established for `AddMaxArmor`.
Updating `tests/boons.test.ts`'s corpus-total assertions to match took
several rounds (the room-1 clean-type count, the "only clean boons" list,
the `healRooms` array's insertion-order-not-sorted quirk) — each read one
at a time off the actual failure diff, per DECISIONS 2026-08-15's standing
instruction, not guessed at in bulk.

## `OBSERVED_OFFERS` reconstruction

Neither run's reward offers were in `src/sim/boons.ts`'s `OBSERVED_OFFERS`
table yet (it's hand-maintained, not generated). Wrote a small scratch
script (`extractOffers.ts`, not committed) reading `loadCorpus()` directly
for the two new run directories, filtering to `rewardPathPhase === true`
states with `rewardPathOptions` present, to get the exact 9 new offers
(5 from run 1, 4 from run 2) with their real `source` filenames — cross-
checked every one against the live console log's own "reward: picking X
(index N)" lines before adding them, confirming the offered triple at each
index matched what was actually picked. All 9 checked out cleanly.

## PLAYER stat update — a real discrepancy from the brief's own plan

`tests/enemies.test.ts`'s "uses the live values" test failed after adding
the new fixtures: `PLAYER.hpMax` (38, from session 42) didn't match the
newest unbooned capture's wire value (40). Investigated directly rather
than just bumping the number: BOTH runs' own `state-000` already read
hpMax 40 — including run 1's, sent BEFORE any level-up was supposed to
happen (the brief's plan was level-up strictly between run 1 and run 2,
using run 1's own Dendren Root). This means the level-up had already
landed before this session's run 1 even started — most plausibly using
Dendren Root left over from session 42's two runs — not between this
session's two runs as planned. Recorded as observed fact in
`src/sim/enemies.ts`'s PLAYER doc rather than silently treating the brief's
assumed narrative as what happened. armorMax and every move's ATK/DEF are
unchanged from session 42's second update (26/9 rock, 6/12 paper, 12/8
scissor) — only hpMax moved.

One test needed a follow-up fix from this: `tests/strategy.test.ts`'s
"scores AddMaxHealth differently than AddMaxArmor" test used val1=8 at
hp=20, and at the NEW hpMax=40 this happened to be an exact numeric
coincidence where the two genuinely different scoring formulas (armor's
`25*(val1/4)*roomsFactor` vs. health's `100*(val1/hpMax)+60*(1-hpFraction)`)
both land on 50. Not a bug — verified both formulas are still computing
different things — just a coincidence at that specific input. Changed
val1 to 6, which doesn't tie, and left a comment explaining why the change
was needed rather than silently swapping the number.

## §2 — Loot-pick priority (Sword pin + Heal gate)

Implementation detail beyond what's in STATE.md: both directives are
implemented as large flat tier-separation bonuses added to the existing
score (`HEAL_TAKEN_BONUS = 1_000_000`, `SWORD_PIN_BONUS = 100_000`), not as
bigger multipliers on the existing formulas. This was a deliberate choice,
not the first thing tried — a magnitude-only fix (e.g. multiplying
`UpgradeRock`'s score by a large factor) could still theoretically be
outscored by an unusually large `pool` offer (e.g. a hypothetical
`AddMaxArmor` val1 of 40+), which would silently violate "wins whenever
offered." The tier-separation approach makes that structurally impossible
regardless of how large any other category's real offer magnitude gets —
same "hard rule, not a scored preference" shape CLAUDE.md §8 already
establishes for enemy-tier selection.

9 new tests: 3 for the Sword pin (beats play-share, beats a large-magnitude
pool offer, doesn't affect non-Sword upgrades), 6 for the Heal gate
(real corpus sample well within the gate; exactly-at/just-under/just-over
the 15% boundary, all synthetic since no corpus sample lands on the exact
boundary; falls through to the next boon on failure; a near-total-deficit
sanity check in the other direction).

## §3 — Fishing strategy heuristics

Read SPEC-fishing.md §3/§4 (board state, `focusPoint`, `gridSize` 4 for
Dendren) and the existing `src/strategy/fishing/` module structure
(`cardChoice.ts`'s EV formula and CODEXIMPROVE #2's existing tie-break
chain, `matcher.ts`/`contextualFallback.ts`'s distribution-building
pipeline) before writing anything, per the brief's own instruction to check
what's real before layering on top.

**Design decision, not asked for explicitly but load-bearing**: all four
implemented heuristics (a/d/e/f) are TIE-BREAKS or distribution-pruning
steps, never a change to the primary EV objective. This was a deliberate
reading of the brief's own language ("bias toward," "avoid... without
urgent need," "prefer whichever covers the maximum," "usable to prune") —
none of these claim to beat real EV, and `cardChoice.ts`'s existing
CODEXIMPROVE #2 tie-break chain was already built exactly for this kind of
addition (resource-conserving preferences among EV-tied options). Extended
that same chain rather than inventing a second mechanism.

**Item-name capture finding, opportunistic**: resolving which real item
"Mid Relaxing Oil" is (needed to write the oil-reserve config with real
item ids, not placeholders) required reading
`fixtures/fishing-casts/item-metadata-sample.json`'s `gameItems[]`
directly — SPEC-fishing.md §4a only had effect TYPES documented (e.g.
`FishingDamageFish`), not the item-name-to-type mapping. Found: Mid
Relaxing Oil (937) is `FishingDamageFish`, not a mana/calm effect; the
actual mana-restore item is separately named "Mid Mana Oil" (939). This
matches the brief's own stated use case for Relaxing Oil (finishing a
low-HP fish) exactly, even though the display name is misleading — a case
where checking the name against the real catalog (DECISIONS 2026-08-15's
discipline) both caught a wrong assumption AND confirmed the user's own
functional intuition was right regardless.

**What was deliberately NOT built**: an actual oil-use action send.
CLAUDE.md §2 forbids inventing an endpoint, and no oil-use request has ever
been captured (SPEC-fishing.md §4a already flagged this as an open gap
before this session). `oilPolicy.ts`'s `shouldConsiderRelaxingOil` is a
pure recommendation function with zero live call sites — flagged in
QUESTIONS.md §16 and TASKS.md Task 8, not silently left unfinished.

25 new tests across `tests/fishing/heuristics.test.ts` (12),
`tests/fishing/oilPolicy.test.ts` (10), and 3 new tests in
`tests/fishing/cardChoice.test.ts` proving the coverage/centering
tie-breaks actually fire (with the EV tie proven via direct
`evaluateCardAtFocus` calls, not just asserted). One test bug caught and
fixed during writing: the first `coverageCount` test's `wideCard` fixture
accidentally included the center zone (5) in `critZones`, defeating the
test's own intended distinction between a "wide but misses center" card
and a "narrow, center-only" card — caught by the test actually failing
(coverage 3, not the expected 2), not by inspection.

## Verification

`npx vitest run`: 629/629 passing, at the final commit (38fd190).
`npx tsc --noEmit`: clean. `git diff --check`: clean. Secret scan (widened
`0x[a-fA-F0-9]{4,}` pattern, `noobId`, `eyJ`, `PRIVATE`) across all three
commits: clean. `.gitignore` still covers `.env`, `*.key`,
`config/discovered.json`, `data/`, `logs/`.

## Commits this session

- `553596d` — Task 14 gate MET (§0/§1)
- `aea24c8` — Sword-upgrade priority + 15%-overflow Heal gate (§2)
- `38fd190` — six fishing strategy heuristics (§3)
