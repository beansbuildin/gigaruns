# BRIEF — session 23 (corrected mid-session)

**Read this instead of the original session-23 plan below the line.** The
original plan (9 non-juiced runs first, then 3 juiced runs) collided with
reality: the user had already manually started a juiced Tier-3 run (3x Big
Heal Juice committed) at room 1 before this session's batch began. Since
only one dungeon run can be active at a time, the batch's first "non-juiced"
run almost certainly resumed and played THAT run instead — under the
potions-off policy meant for the batch, not the potions-on policy meant for
the juiced run. A later run in the same batch (6th) also got stranded
mid-combat by a network failure. Nothing has been lost that can't be
accounted for — potions are consumed at `start_run` commitment, not at use
(session 14), so the 3 Big Heal Juice are gone from inventory regardless of
what's discovered below; the open question is only whether they delivered
any healing benefit or were wasted.

**Do these in order. Don't skip the diagnostic — the juiced-run plan
shouldn't restart until the state is actually understood, not assumed.**

## 1. Resolve the stranded live run

Currently active: room 2, HP 22/42, non-juiced enemy, stranded by a network
fetch failure mid-combat. Resume and complete it via the normal live path,
potions off (matches this run's own original policy — no reason to change
it now). Costs no new run slot; it's already counted in today's used total.

## 2. Read-only diagnostic on "run 1" of the batch — before anything else moves

Check the logged fixture/state for whatever got recorded as the first run of
this session's batch:

- Does its `start_run`/state data show `isJuiced: true` and
  `consumables: [131, 131, 131]` (or similar)? This confirms whether it was
  actually the user's pre-existing juiced run.
- Did any `use_item` calls fire during it, or none at all?
- What room did it reach, and how did it end (win/death)?
- Cross-check current Big Heal Juice (itemId 131) balance against session
  22's ending balance — a drop of exactly 3 at that run's start would
  independently confirm the timing.

Report findings plainly before proceeding to step 3. If the potions were
committed but never used, say so directly — that's a real finding, not
something to soften.

## 3. Report clean current state

After steps 1-2: real dungeon runs remaining today, real energy remaining,
current Big Heal Juice balance. Don't reuse any numbers from earlier in this
session — get them fresh.

## 4. Confirm potion config is actually at maxPerRun=3

The original brief asked for `config/bot.json`'s
`forbiddenWoods.potions.maxPerRun` to be raised 2→3 for the juiced batch.
Verify this actually landed before the next juiced run — don't assume it
did because it was asked for.

## 5. Juiced Tier-3 runs — one at a time, strict sequencing

For each of the remaining planned juiced runs:

1. **User** starts it manually in the browser (juiced toggle, Tier 3,
   whatever selection surfaces the "3 gold rings" offering) and confirms
   it's showing active.
2. **User** tells CC to proceed.
3. **CC** resumes and completes ONLY that currently-active run — potions
   on, `maxPerRun=3`. No reward-pick logic changes needed ("Gold Ring" only
   affects Hard Cores payout on the same boon offers, not which offers
   appear).
4. **CC stops.** Does not loop, does not auto-start another run. Reports
   the outcome (room reached, potions fired, real energy/reward numbers
   observed) and waits for the user to start the next one.

Repeat for however many juiced runs remain given real runs-left after
steps 1-3.

## 6. Still true from the original brief

- Correct SPEC.md/`config/discovered.json`'s juiced-multiplier note — user
  confirmed live, 3x reward multiplier is real, `juicedMultiplier: 1` was
  wrong or measuring something else.
- Do not attempt Task 10's 8-hour orchestrator run this session.

---

*Original pre-correction brief below, kept for reference only — superseded
by the numbered list above.*

Session 22 was the biggest single-session ROM result so far: all 37 ROMs
enumerated, +392 energy claimed, account hit the real 420 cap twice.
Fishing's daily budget is fully spent (240/240); dungeon sits at 3/12 runs
used. Two time-sensitive, user-directed items for this session, in order.

1. Spend the 9 remaining non-juiced runs (potions off).
2. Then 3 juiced Tier-3 runs, user-started, bot-finished, potions on,
   maxPerRun=3, one at a time, no auto-loop.
3. Defer Task 10's 8-hour run until after today's reset.
