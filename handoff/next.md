# BRIEF — session 34

Session 33 landed clean: 510/510 tests (+10), `tsc` clean, GATE PASS. It
shipped CODEXIMPROVE #3 (hierarchical contextual fishing fallback) exactly
as scoped: offline leave-one-cast-out CV on the real corpus reproduced
Codex's core finding first (cell-only 16.4% top-1 — exact match; cell +
previous direction 37.1% vs. Codex's 33.9%, same ~2.3x conclusion), THEN a
simulator ablation confirmed the algorithm exploits real structure
(33.8% → 72.5% on synthetic casts), and only then did it get wired live
(`scripts/liveFishing.ts` now calls the new `contextualFallback()` instead
of `emptyFallback()` directly). `minIndependentCasts=3` was chosen by
sweeping {2,3,4} against log loss/Brier, not guessed. Real corpus already
has 10 context keys clearing the live threshold today.

---

## Before anything else: real fishing casts are currently blocked, not by this session's code

Session 33's one real `--casts=1` live attempt got `start_run` rejected
HTTP 400, and read-only follow-up (`scripts/checkFishingStuck.ts`) found
the account carrying a completed-but-unresolved doc (`docId 12957129`,
`COMPLETE_CID: true`, `SUCCESS_CID: false` — an ESCAPE, not a catch) with
no `cardsToAdd` and `cardChosenId: -1`. Every previously-documented stuck
case (DECISIONS session 15, QUESTIONS §10) was catch-specific; this is a
new, unconfirmed shape. Full writeup: **QUESTIONS.md §15**.

This is logged and stopped, correctly — CLAUDE.md's stuck protocol is log
and stop, not guess at an unconfirmed `loot`-shaped resolution for an
escape. It does not block `--dry-run` (never reaches `start_run`), it does
not block any dungeon work, and it does not block the offline CV/ablation
scripts session 33 built. **Do not attempt a real `--casts=N` fishing
invocation this session** unless `scripts/checkFishingStuck.ts` shows the
account is clear again (worth a quick read-only check at the start of the
session, cheap and non-committing) — if it's still stuck, that's still the
same open QUESTIONS.md §15 item, not a new bug to chase.

**Needs a human, not Claude:** a DevTools capture of what the real client
sends after an escape, same as how `path_two`/`loot` were each originally
confirmed. Nothing for this session to do about that directly beyond not
making it worse.

---

## 1. Give carried dungeon charges continuation value (CODEXIMPROVE #4)

Relevant code, re-checked against the current tree (these files are
untouched since the original Codex review commit — session 33 only
touched fishing files — so the doc's line numbers below are confirmed
still accurate):

- `src/strategy/utility.ts:55-72` — `utility()`. Confirmed live: the
  terminal/leaf scoring function only ever reads `hp`/`armor` on both
  sides (`w.hp`, `w.armor`, `w.foeHp`, `w.foeArmor`). No move-charge term
  exists anywhere in this function today.
- `src/strategy/decide.ts:78-120` (the recursive `value()` search) and
  `:130-180` (`decide()`, the top-level table build + argmax). Confirmed
  live: `value()` bottoms out at `utility(state, cfg)` on `depth <= 0` or
  a terminal state — charge state is part of `BattleState` throughout the
  search but never scored at the leaf, only implicitly shaping which
  moves are legal along the way (via `legalMoves(..., cfg.chargesAreHardLimit)`).
- `src/sim/combat.ts:39-77, 157-164` — charge accounting on resolve
  (verify current line numbers on open; this file's mtime also predates
  session 33, so likely unchanged, but wasn't re-read line-by-line this
  time).
- `SPEC.md:829` — names the charges-persist-across-rooms behavior this
  item is about.

The problem, same as the original review: HP and armor are priced as
resources carried into future rooms; move charges are not, despite also
persisting across room transitions and controlling move legality under
the enabled hard-limit model. Depth-three search accounts for charge
changes only inside its own horizon — at a win or a depth leaf, two
otherwise-equal states score identically even when one carries a depleted
high-value move into the next room. That's misaligned with the actual
target metric (mean rooms cleared).

**Implementation requirements, per CODEXIMPROVE's spec — staged, smallest
first:**

1. **Tie-break only, first.** Add a tie-break between otherwise-equal
   decision scores (`decide()`'s `table.reduce` argmax at
   `decide.ts:178`, currently "ties broken by the order in MOVES") that
   prefers the better expected post-exchange charge reserve. This should
   be provably non-regressive the same way session 31's fishing tie-break
   was (CODEXIMPROVE #2) — it only resolves cases that were already tied
   on the primary score, never overrides a strict comparison. Add a test
   proving exactly that: two moves with equal `score` but different
   resulting charge reserves, tie-break picks the higher-reserve one;
   two moves with UNEQUAL `score`, tie-break never fires regardless of
   charge reserve.
2. **Weight reserve by move usefulness, not a blind sum.** Don't just sum
   all remaining charges — a depleted high-ATK move matters more than a
   depleted low-value one. ATK/DEF or observed play share (this project
   already tracks move-pick frequency in a few places — check
   `opponentModel.ts` and the boon/loot code for an existing move-value
   or play-share signal before inventing a new one) are the doc's own
   suggested starting weights. Document whatever you land on with the
   same "why this number" discipline as
   `NEXT_POSITION_OVERRIDE_THRESHOLD`/`minIndependentCasts=3`.
3. **Then, separately, ablate a continuation term.** Only after the
   tie-break lands and is tested: try a small normalized charge-reserve
   utility term, or a one-room continuation rollout, added to `utility()`
   itself (not just the tie-break). Ship a non-zero weight ONLY if mean
   rooms cleared improves by more than the 95% CI on the existing dungeon
   sim's batch runs (`tests/dungeonSim.test.ts` already has the harness
   this needs — reuse it, same as the HP/armor weight sweep that already
   produced a documented null result). Keep zero as the explicit control;
   report the comparison honestly if it doesn't clear the bar, same as
   CLAUDE.md §9 has applied to every other unproven claim this project
   has checked.
4. Add regression tests for both stages independently — the tie-break's
   non-regression proof (step 1) should pass and be committed even if
   step 3's continuation term ultimately doesn't ship.

This is explicitly a MORE credible new dungeon axis than another HP/armor
weight sweep (which already produced a reliable null result per the
"Areas not worth retuning yet" section of the original CODEXIMPROVE doc)
— it's untried, not re-tried.

---

## Your task

1. §1 (CODEXIMPROVE #4, charge-reserve continuation value) is the whole
   scope this session, staged as written above: tie-break + its
   regression test first, continuation-term ablation second, ship the
   ablation only if it clears the bar.
2. Do the cheap read-only `scripts/checkFishingStuck.ts` check before
   deciding whether any live fishing smoke test is safe — don't attempt a
   real fishing cast if it's still stuck, and don't guess at resolving it
   either way. This session's actual work is dungeon-side and unaffected
   regardless of the fishing account's state.
3. Don't start CODEXIMPROVE #5 (boon valuation) this session — still
   queued, not now, same discipline every prior session in this run has
   used.
4. Recap normally, full suite + `tsc` against the final commit as usual.

---

## Queued, not this session

- **CODEXIMPROVE #5** (boon valuation using real confirmed deltas +
  persisted per-run `playCounts`) — relevant code per the original doc:
  `src/strategy/loot.ts:92-174`, `src/sim/boons.ts:296-333`,
  `scripts/liveRun.ts:586-588, 853-869` (verify current line numbers on
  open — `liveRun.ts` has been touched by several sessions since the
  review commit, more likely to have drifted than the charge-reserve
  files above). Well-scoped, not urgent; do after #4.
- **QUESTIONS.md §15** (stuck-account-after-escape) — needs a human
  DevTools capture, not code. Not this session's job beyond the
  non-committing read-only check above.
- Task 14 (bot-initiated juiced `start_run`) still BLOCKED on a live
  DevTools capture — still needs a manual juiced run captured whenever
  convenient, not code work.
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends
  the whole session (unchanged since session 25, not re-queued as an
  action item, just still true).
