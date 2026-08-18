# BRIEF — session 43

Session 42 landed cleanly: Task 14's code (`buildJuicedStartRunEnvelope`,
`--juiced` CLI flag) shipped and both live juiced runs that session were
completed — but both were **resumes** of runs the user started manually, so
Task 14's actual gate (a *bot-initiated* juiced `start_run`) was still open.
586/586 tests, `tsc` clean, at the final commit.

**Since that commit, the user gave direct instructions that settle several
open items at once — read this whole section before touching code.**

---

## 0. FIRST ACTION — bot-initiated juiced Tier-3 `start_run`, now explicitly authorized

The user has explicitly authorized the bot to send a fresh `start_run` itself,
standing, for exactly this shape: **juiced, 60 energy, 3× Big Heal Juice
(itemId 131), Tier-3 offering (gold rings, `index: 3`)**. This is new — until
now every juiced run in the corpus was started manually by the user and
merely resumed by the bot (STATE.md session 42, open question 1). This
authorization amends CLAUDE.md's "Ask first" list (which otherwise requires
explicit sign-off before a juiced/energy-committing start): a bot-initiated
`start_run` matching this exact shape (juiced=true, index=3, consumables =
`[131,131,131]`, cost 60 energy / 3 run-units) does **not** need to be asked
for again — do it directly. Any *different* shape (a different tier, a
different potion loadout, non-juiced-vs-juiced mismatch) still needs fresh
authorization; don't generalize this beyond exactly what was authorized.

Before spending anything:

1. `GET /game/dungeon/today` fresh — confirm the account's real daily run
   count and energy budget both leave room for this run (STATE.md session 42
   left the count at "at least 6/12"; a juiced run costs 3 run-units per the
   session-42 `GuardState` fix, so confirm at least 3 remain). Also check
   `config/bot.json`'s configured daily budget hasn't already been exhausted
   — don't just trust the API cap, respect the local config too.
2. Confirm wallet balance actually holds ≥3 Big Heal Juice (itemId 131) and
   ≥60 energy before sending anything.
3. Verify the exact CLI invocation against `scripts/liveRun.ts`'s real
   `parseArgs` (session 42's flags — `--juiced` plus an index/tier selector)
   rather than assuming a flag name from this brief; confirm it produces the
   same envelope shape as session 42's pinned capture: `dungeonId: 5`,
   `actionToken: ""`, `data.index: 3`, `data.isJuiced: true`,
   `data.consumables: [131,131,131]`.
4. Run it live, to completion, applying the reward-pick priorities in §2
   below throughout.
5. Capture Task 14's actual gate evidence — this is the whole point of doing
   a *bot-initiated* run instead of another resume:
   - Reward shown at the first reward pick — is it ~3x a plain Tier-3 pick
     (user's own reference point: a 5→15 Dendren Root-equivalent multiplier)?
   - `GET /game/dungeon/today` read before and after — did `dayProgressEntities`
     for Dungeon#5 move by exactly 3, not 1?
   State both numbers plainly in STATE.md and say honestly whether Task 14's
   gate is actually met now that it's bot-initiated for real — don't round up
   if either number doesn't match.

## 1. STOP after run 1 — do not auto-start run 2

The user wants to manually level up the character using the Dendren Root
earned from run 1 between the two runs. Leveling up is itself an existing
"Ask first" item in CLAUDE.md (irreversible without Hourglasses) — the bot
must not do it, and must not treat "go do the next run" as implied.

- Once run 1 ends (win, loss, or death), **stop. Do not send a second
  `start_run`.**
- Tell the user plainly, at the end of your output: run 1 is complete, here's
  what happened (reward multiplier, room reached, HP/armor at end, the two
  gate numbers from §0.5), please level up now using this run's Dendren Root,
  and give the go-ahead when ready for run 2.
- If the session can stay open waiting on the user's reply, wait for it
  in-session rather than ending — this is a real pause point, not a stopping
  point for `/recap`.
- If the session must end before the go-ahead arrives (context limits, etc.),
  recap normally and leave run 2 clearly queued as this session's first
  action in the next handoff, so it survives a session boundary — the
  standing authorization from §0 already covers it; the next session does not
  need to re-ask, only to confirm the user's go-ahead was actually given.
- When the go-ahead comes, repeat §0 exactly once more (same shape: juiced,
  60 energy, 3× Big Heal Juice, Tier-3/`index:3`), played to completion the
  same way.

## 2. Dungeon reward-pick priority — user directive, update SPEC.md §4c / `src/strategy/loot.ts`

The user's build is Sword-focused and gave two explicit standing preferences
for the reward-pick (loot/boon) ranking currently documented in SPEC.md §4c:

- **Prioritize `UpgradeRock` (the Sword upgrade boon, session-09 corpus) when
  it's offered.** §4c's current rule #2 ("upgrade the move you actually play
  most, read off logged distribution") already tends to point at Sword per
  TASKS.md's `always-Sword` baseline data — but the user is now stating Sword
  priority directly as a hard preference, not an inference. Pin it: Sword
  upgrade wins whenever offered, ahead of the data-driven "most-played move"
  inference (which becomes the fallback for non-Sword situations, e.g. if a
  future build changes).
- **Take the Heal card only when it's not mostly wasted.** Replace the pure
  continuous-urgency scoring (§4c rule #1, scales by `(1 - hpFraction)`) with
  an explicit gate layered on top of it: take Heal only if `hpCurrent <
  hpMax` **and** the wasted overflow is ≤15% of the heal's value. Concretely,
  with `deficit = hpMax - hpCurrent` and `healAmount` = the offered card's
  value (16 in the one clean corpus sample, 8→16, hpMax 32 — cap still
  unverified per §4d's open note):
  ```
  wasted = max(0, healAmount - deficit)
  takeHeal = (hpCurrent < hpMax) && (wasted <= 0.15 * healAmount)
  ```
  If Heal fails this gate, fall through to the next-ranked boon (Sword
  upgrade per above, then max HP/armor, then rarely-played-move ATK, per
  §4c's existing rules 2-4).

Do this work as real implementation, not just a note:

1. Update `src/strategy/loot.ts` with both rules.
2. Update SPEC.md §4c's ranked list text to match, dated.
3. Add a dated entry to DECISIONS.md (2026-08-18, user-stated): Sword-upgrade
   priority + 15%-overflow Heal-take rule, superseding the old pure
   continuous-urgency Heal scoring as a standalone rule (it's now a
   necessary-but-not-sufficient condition, gated by the overflow check).
4. Add tests pinning the overflow-threshold boundary (exactly 15% wasted,
   just under, just over) — use the real 8→16/hpMax-32 sample where it fits,
   synthetic values where a boundary case isn't in the corpus, and say which
   is which.

## 3. Fishing strategy — user directive, `src/strategy/fishing/` + SPEC-fishing.md

**Terminology note, no code change needed:** what the user has been calling
the "bobber"/"bobble"/"center point" is the `focusPoint` field (SPEC-fishing.md
§3/§4) — moving it spends from the 3-charge `focusMeter` budget. The internal
name is already correct; just write "FocusPoint" consistently (not "bobber")
in any new docs/comments this session touches, so informal terms don't creep
back in.

**New strategy heuristics from the user — none of this is captured or
implemented yet, so this is real design + implementation work, not a doc-only
change:**

a. Bias toward keeping FocusPoint in the central 2×2 square of the grid;
   avoid sitting on the field's edges without urgent need — from an edge
   position, the 3-charge Focus budget may not be enough to reach the fish if
   she jumps to the opposite side of the grid.
b. It can be correct to deliberately play a losing/non-scoring card, or to
   redraw the hand, purely to let the fish drift closer to the FocusPoint
   first — not always taking the best-looking immediate card.
c. Always hold at least one Mid Focus Oil and one Mid Relaxing Oil in
   reserve. Oils don't need to be spent every cast, but they're for the close
   calls — e.g. fish at 2 HP with no sure kill in the next few cards is a
   legitimate case to spend Mid Relaxing Oil.
d. A fish that just made a 1-cell move never returns to the cell it just came
   from on its next move — usable to prune the predicted next-move set.
e. A fish that just made a 2-cell move is easier to predict when she's on the
   edge of the field and the player is centered in the middle 2×2.
f. When choosing the next card, prefer whichever covers the maximum number of
   cells the fish could plausibly move to next (a coverage-maximizing
   heuristic over the predicted move set), over just the highest single-cell
   expected value.

Implementation:

1. Write these up as a new "Strategy heuristics" subsection of
   SPEC-fishing.md (they aren't documented anywhere yet), dated 2026-08-18,
   user-stated.
2. Encode (a), (d), (e), (f) into `src/strategy/fishing/cardChoice.ts` (or a
   sibling module if that gets unwieldy) as explicit, testable functions —
   these are concrete enough to implement directly: a centering bias term,
   a "can't return to previous cell" prune on the predicted move set, and a
   coverage-maximizing card-selection tiebreak.
3. (b) and (c) are judgment calls, not pure functions — encode them as
   documented decision points / config thresholds (e.g. an oil-reserve floor
   the strategy won't spend below except at a specified low-fish-HP
   threshold) rather than forcing them into a single scoring formula.
4. Add tests against synthetic board states for (d)/(e)/(f) since live
   fixtures may not cover every case yet — say plainly which cases are
   corpus-backed and which are synthetic, same discipline as §2.
5. If any of this can't be implemented cleanly without more capture (e.g. the
   fish's actual move-selection distribution isn't fully characterized), say
   so and record the gap in TASKS.md/QUESTIONS.md rather than guessing past
   what's known — same standard as everything else in this repo.

---

## Your task

1. §0 first — bot-initiated juiced Tier-3 `start_run` (run 1 of 2), played to
   completion, Task 14 gate evidence captured and stated honestly.
2. §1 — stop after run 1, hand back to the user for manual level-up, wait for
   the go-ahead, then repeat §0 exactly once more (run 2 of 2) — same
   standing authorization, no re-ask needed.
3. §2 — dungeon loot-pick priority update (Sword-first, 15%-overflow Heal
   gate): code + SPEC.md + DECISIONS.md + tests.
4. §3 — fishing strategy heuristics: SPEC-fishing.md write-up, code where the
   heuristic is concrete enough, tests, and honest gap-flagging where it
   isn't yet.
5. Recap normally: full suite + `tsc` + `git diff --check` against the final
   commit, plus the standing "no real data/log path touched by new tests"
   discipline. State both runs' outcomes and Task 14's gate numbers plainly.
