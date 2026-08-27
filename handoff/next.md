# BRIEF — session 104 — dungeon: measure what the procs actually do to damage, then switch the standing entry tier to Tier-1 (0 rings)

**This document replaces the session-103 `next.md`.** Session 103 is executed
and closed — the 4-run juiced batch, STATE.md session 103. **This session is
dungeon-side only, both parts offline/near-zero live spend — fishing is out
of scope**, whatever the fishing ledger reads. The rod stays capped at 18
casts/batch until it's repaired; the user is handling the repair directly,
outside this loop, so there is nothing to check or report on the fishing side
this session.

**Three of session 103's open questions are closed by the user, in
conversation, outside a numbered session — record all three as ANSWERED
QUESTIONS.md entries before or alongside the work below, the same convention
§52–§56 already use:**

1. **Open question 3 (11,111 unspent skill XP) — IGNORE IT.** Not a task, not
   a recommendation to revisit. The "never allocate them yourself" rule is
   unaffected either way; this closes the question rather than deferring it.
2. **Open question 1 (gear/loadout stability) — RESOLVED: stable going
   forward.** The user expects the loadout to hold steady from here, unlike
   the two mid-batch re-specs session 103 caught. This does not retroactively
   fix the session 103 corpus (rooms 1-3 vs room 4 still are not one arm —
   that caveat stands on the historical data), but future batches can be read
   as one loadout unless a new re-spec is flagged, and the loadout-census
   framing in `tests/enemies.test.ts`'s doc comments should stop hedging
   toward "drift is expected."
3. **Session 102's open question 1 (the fishing rod) — informational, no
   action.** The user is repairing Golkan directly rather than replacing it,
   specifically so the deck stays the same one for future sessions
   (`CORPUS_DECK` stays pointed at the same rod's data once it's repointed —
   no change needed from this brief, just recorded so a future reader
   doesn't re-ask).

---

# Part A — measure the proc booleans against real damage, using the existing corpus (zero live spend)

**This is the direct continuation of §58's own unresolved half.** §58
measured proc RATES for `blockProc`/`evadeProc`/`critProc`/`tenacityProc` (and
settled `intuitionProc` completely, via `intuition_block` events) but said
plainly: *"Rates are not mechanics. Knowing `blockProc0` fires 4.69% of the
time does not say what `block` DOES when it fires (a full negate? a
reduction? by how much?). That is a second measurement — diff the HP/shield
deltas on fired vs unfired exchanges — and it has not been done."* The user's
instruction this session is to do that second measurement now. The corpus
already has what it needs: **1,919 exchanges per side**, captured and
committed, no new run required.

1. **For each of block, crit, evade, tenacity**: partition exchanges into
   fired vs unfired for that flag, holding the attacker/defender ATK-DEF
   inputs as comparable as the corpus allows (the same discipline §59 used
   for `Weak`/`Vulnerable` — measure the residual against what the plain
   stat model predicts, not a raw average). Report the effect size in the
   same exact-fraction style §57/§58/§59 already use (`fired/n`, not a
   rounded percentage) — a full negate, a fixed reduction, a multiplier, or
   "no measurable effect" are all valid findings; state whichever one the
   data actually shows.
2. **`tenacity` needs an extra control, not just the fired/unfired diff.**
   This session's own dead-end note found tenacity's proc RATE moves with
   whether `AddTenacity` was picked and with pick order (run 2: 6/54 with
   `AddTenacity` at pick 5 of 8; run 3: 0/38 with it at pick 6 of 7; runs 1
   and 4, no `AddTenacity` pick, 0/48 and 1/44) — n=4 runs, not a rule, but
   real enough that pooling all tenacity-fired exchanges without noting
   `AddTenacity` presence could mix two different populations. Report the
   damage-effect measurement broken out by that split if the corpus supports
   it; say plainly if n is too thin to split.
3. **`tenacity` and `intuition` were already ruled out as damage mitigation**
   in §58 — this measurement may confirm that (no damage-side effect) rather
   than find one. If so, that is the finding: say what tenacity firing DOES
   change, if anything measurable at all (turn order, an energy/mana field,
   nothing detectable in this corpus) rather than leaving it as a second
   "ruled out, no positive mechanic" entry with nothing new added.
4. **Cross-check against `intuition`'s already-solved mechanic as a sanity
   control on the method itself** — §57 showed `intuitionProc0` fires
   exactly match the corpus's `intuition_block` events, 6/6. If this
   session's fired/unfired diff approach doesn't reproduce that known result
   cleanly on `intuition`, the method has a problem worth finding before
   trusting it on the three still-open flags.
5. Reuse the existing convention — a new script alongside
   `scripts/procEvidence.ts`/`scripts/statusEffects.ts` (or extend one of
   them), pinned with a test the same way `tests/procEvidence.test.ts` and
   `tests/statusEffects.test.ts` pin theirs. `npx tsx <script>` should be
   re-runnable as volume accumulates, per the standing pattern.
6. **This does not authorize touching `src/sim/combat.ts`.** CAPTURE-1's
   prohibition on stubbing, defaulting, or flag-hiding the combat model
   stands exactly as §58/§59 left it. This measurement is what CAPTURE-1
   has been waiting on, not a green light to build the model in the same
   session that finally measures it — write up what's now known and let a
   future brief decide whether it's enough to build on.
7. Add the QUESTIONS.md entry (next unused number) with the verdict per
   proc, named plainly — "block does X, measured N/N" or "no measurable
   damage effect, measured N/N" — not hedged.

---

# Part B — switch the standing dungeon entry tier from Tier-3 to Tier-1 (0 rings)

**User directive, this session: gold ring stock covers roughly 16 more days
at the current Tier-3 run rate, and the Hard Cores event runs for 42 more
days.** Continuing to spend Golden Rings (items 243–249, one per faction,
per SPEC.md §3c) on every juiced entry would exhaust them with roughly 26
days of the event still open. **All dungeon runs switch to Tier-1 (0 rings,
`inputItems: []`) going forward, standing until the user says otherwise** —
the same weight as rule 11's original Tier-3 choice, and it supersedes that
one specific number in it.

**What this changes, and what it does not — confirm both against the code
before writing anything, not from this brief's description of them:**

- `index` (`entryData`'s tier — 1/2/3) and `isJuiced` (the 60-energy, 3x
  reward run mode) are confirmed-independent axes (SPEC.md §3c/§3f, session
  42). Switching `index` from 3 to 1 does **not** touch `isJuiced` — the run
  is still a 60-energy juiced entry, still consumes 3 of the 12 daily
  run-units, still auto-loads potions (potion loading is gated on `--juiced`
  alone, not on `index` — TASKS.md Task 14's outcome). None of rule 11's
  other three conditions change.
- **What does change: Hard Core income per run drops, roughly to a
  quarter.** `dropMultiplier` is 4 at Tier 3 and 1 at Tier 1, and it governs
  Hard Core (item 845) only — Dendren Root (item 846) responds to `isJuiced`
  alone and is unaffected by tier (SPEC.md, session 42, confirmed on a real
  Tier-2-vs-Tier-3 comparison). **State this plainly in the recap as the
  cost of the switch, not as a footnote** — the account's stated reason for
  running dungeons at all right now is the Hard Cores event, and this trades
  ring conservation for a real cut to that same currency's earn rate.
  Dendren Root income is unaffected.
- **The mechanism is already live code, not new work.**
  `buildJuicedStartRunEnvelope(dungeonId, index, consumables)` takes `index`
  as a parameter; the `--juiced-index=N` CLI flag is fail-closed and generic
  (TASKS.md Task 14, gate met session 43 — two bot-initiated juiced Tier-3
  starts, and separately a Tier-2 index was captured the same session). No
  evidence anything hardcodes `3`, but confirm this directly rather than
  assuming rule 9 applies to this brief's own claim: grep for `juiced-index`,
  `index: 3`, and `dropMultiplier` across `scripts/`, `src/`, and
  `handoff/reports/dungeonReport.ts`'s generation code before shipping, in
  case any report or reward-expectation logic silently assumes Tier-3's `4`.
- Update `CLAUDE.md` rule 11 itself — it currently names `--juiced-index=3`
  as the standing choice and needs to say `--juiced-index=1` instead, with
  this session's date and the ring-scarcity reason, the same way rule 8
  documents why "highest tier" replaced "lowest tier." Don't just change the
  number silently; a future reader needs to know why Tier-1 is standing now
  when every session log up to 103 ran Tier-3.
- **`--dry-run` the new flag combination (`--juiced --juiced-index=1`)
  before ending the session**, per rule 4 discipline — this exercises the
  envelope-building and potion-loading paths at the new index without
  spending anything. **Do not run a live Tier-1 dungeon run as part of this
  brief.** The first live run at the new tier is a future session's job,
  under the same per-run go-ahead rule 11 already requires — this brief
  ships the switch and verifies it dry, nothing more.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan. State explicitly, at the top of the recap: the proc-damage verdict for
each of block/crit/evade/tenacity (with intuition's known result as the
method's sanity check), and confirm the Tier-1 switch is wired and dry-run
clean with the Hard Core cost stated in plain numbers, not just "reduced."
