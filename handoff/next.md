# BRIEF — session 99 — new-rod deck check, 2 fishing casts, up to 4 dungeon runs (ONE AT A TIME), and the §26 redraw-shadow analysis

**This document replaces the session-98 `next.md`.** Session 98 is executed
and closed — QUESTIONS.md §46, STATE.md session 98. Five follow-up rulings
from that session are recorded as QUESTIONS.md §47–§50; read them before
starting, they carry the reasoning this brief only summarizes.

**Same terms as the last two sessions: every item below is done, or blocked
with a named reason stated up front, before this session ends** (CLAUDE.md
rule 6).

**Read this section before touching anything live — it changes what "one
session" can mean today.** CLAUDE.md rule 11 is absolute: *"One run, then
stop and hand back. Never chain... `--runs=1`, every time"* — because the
user allocates skill points between dungeon runs and must explicitly say
when to resume, and *"a rule requiring per-run human approval cannot be
satisfied by an autonomous loop."* **The user asking for "4 dungeon runs"
today is a budget for the day (it is, not coincidentally, the exact daily
cap — 12 run-units ÷ 3 per juiced run = 4), not an instruction to chain
them.** This session can run the FIRST dungeon run, then must stop and hand
back for skill-point allocation and an explicit go-ahead before touching a
second. If this brief is being executed unattended and the user isn't
available to approve runs 2–4 in the same sitting, **do the first run,
report, and stop — do not simulate approval or assume it.** Do not let "the
brief said 4" become a reason to chain them; that would violate rule 11
regardless of what this document asks for.

---

# §1 — Before anything live: confirm the new rod's deck (QUESTIONS.md §47)

The rod was swapped after session 98. Before the first live cast or dungeon
response of this session:

1. Check `GEAR_CID_array` on the first live response against the OLD rod's
   known ids. Do not assume `REAL_DECK` transferred unchanged.
2. If the deck changed, treat `rodDeck.ts` and any deck-keyed pinned test as
   describing the OLD rod until the new one is captured and baselined —
   expect some pins to need re-blessing, the same shape as the
   Makeshift/Shroom break (session 87–89).
3. State plainly, in the recap, whether the deck actually changed. Don't
   assume it did just because the rod did.

# §2 — Two fishing casts

Standard batch discipline, capped at 2 (`SESSION_98_LIMITS`-style structural
cap, not a soft convention — a mistyped flag should not be able to spend a
third). `--dry-run` first, since §1 may have found a deck change, which is
exactly the kind of change that warrants it per every prior fishing brief's
own rule-4 discipline.

Report at the same depth as sessions 96–98: catch rate (with a binomial CI,
n=2 will be close to uninformative on its own — say so rather than reading
anything into 0/2, 1/2, or 2/2), whether the 0.85 necessity gate got an
opportunity to fire and what it did if so (no shaping toward it per §50 —
just report what happened), and opening-turn focus spend against the 0.83
baseline (n=119). This batch also adds to the redraw-shadow log for free —
report the new cumulative shadow count after these 2 casts, since §3 below
will want the up-to-date number.

# §3 — The §26 redraw shadow analysis (QUESTIONS.md §49)

**User-approved to attempt now.** Not pre-certified as sufficient — that's
what this section computes, honestly, before drawing any conclusion.

1. Pull every shadow record `redrawShadow.ts` has logged since session 90
   (cumulative through session 98: 0/52, 4/24, 0/2, 0/43, 2/40 = 6 fires in
   161 shadow card decisions across 5 batches, plus §2 above's fresh
   records). Write the analysis as a script in the shape of this repo's
   other trigger-calibration tools (`redrawTriggerCalibration.ts` /
   `redrawCounterfactual.ts` are the closest conventions) rather than a
   one-off calculation — it should be re-runnable as more shadow volume
   accumulates.
2. **Compute whether 161(+) observations, 6(+) fires, actually supports an
   out-of-sample verdict on the candidate trigger** — state the achieved
   power/confidence for the effect size the original candidate was fitted
   to detect, not just "here's a percentage." If it's thin, say so
   explicitly and name what volume would close the gap, the same way
   session 97 priced the matcher-library question at 87–122 turns instead
   of leaving it vague. **Do not force a verdict the data doesn't support**
   — §49's approval was to attempt this, not to guarantee a clean answer.
3. Separately, GAP 1 from §28 (the `FISH_MOVED`-unobserved semantics
   ambiguity, two candidate readings named in code since session 78 §6,
   neither measured) — check whether the shadow log's accumulated volume
   can distinguish between them. If not, say so as its own finding, don't
   fold a "can't tell" into the main verdict silently.
4. **`redrawEnabled` and `REDRAW_THRESHOLD` stay untouched no matter what
   this analysis finds.** Report the verdict; enabling redraw live is the
   user's call per §26/§28's standing text, not a conclusion this session
   reaches on its own.
5. Write up as a QUESTIONS.md entry (next unused number — check the file's
   actual last section before numbering) reporting the verdict, the power
   computation, and the GAP 1 finding.

# §4 — Up to four dungeon runs, one at a time, each stopping for the user

Per the framing at the top of this document: **run one juiced Tier-3 entry,
then stop.**

- `--juiced --juiced-index=3`, 3x Big Heal Juice (itemId 131) from
  `config/bot.json`'s `forbiddenWoods.potions` — the standing configuration,
  unchanged.
- `--runs=1`. Every time. Never chain.
- After the run resolves (death, clear, or stop), **hand back to the user**
  for skill-point allocation and the explicit go-ahead to start the next
  one. Do not proceed autonomously.
- Repeat up to 4 times today (the full daily run-unit cap — 12 ÷ 3 = 4), only
  as the user actually approves each one in turn.
- Report each run at the standard depth this repo already uses (death room
  or clear, Hard Core and Dendren Root earned, energy spent) — the existing
  `handoff/reports/dungeon-runs.md` convention.
- **Worth watching for, not a required deliverable:** `TASKS.md`
  CAPTURE-1/CAPTURE-2 are blocked purely on missing live captures for the
  five rolled stats (`evasion`, `block`, `lck`, `tenacity`, `intuition`) and
  several statuses. These runs generate exactly that kind of data as a side
  effect of playing normally — no extra work is needed to capture it, but
  if anything in this batch's responses looks like it bears on CAPTURE-1,
  note it in the recap rather than let it pass unremarked the way session
  94's wide-orb-rule boon pairs almost were.

---

## Recap, for the whole session

Full suite, `tsc --noEmit`, `git diff --check`, secret scan — once, at the
end. State explicitly, at the top of the recap: §1's deck-check result, §2's
batch report, §3's shadow-analysis verdict (including whether it was
actually conclusive or explicitly underpowered), and exactly how many of
the 4 dungeon runs actually happened and why it stopped where it did if
fewer than 4.
