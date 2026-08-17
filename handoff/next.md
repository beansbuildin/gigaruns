# BRIEF — session 23

Session 22 was the biggest single-session ROM result so far: all 37 ROMs
enumerated, +392 energy claimed, account hit the real 420 cap twice.
Fishing's daily budget is fully spent (240/240); dungeon sits at 3/12 runs
used. Two time-sensitive, user-directed items for this session, in order.

---

## 1. Opening move: spend the 9 remaining non-juiced runs, no potions

The user has 9 of today's 12 dungeon runs left before the real per-day
run-count resets (~2h window at time of writing, 11am PST). Spend them now
via `scripts/liveRun.ts` (a bounded batch, not the orchestrator), with
potions OFF (`--potions=0` or temporarily remove the
`forbiddenWoods.potions` config block) — the user's explicit call: Big Heal
Juice is not a good economic trade against a 20-energy run.

Expect real variance across the 9 runs. The death-room histogram has
consistently shown outcomes spread across rooms 2-4 (session 20 added the
corpus's first room-5 death) — run `scripts/deathRooms.ts` fresh rather than
citing a stale number, but a wide spread this batch is the expected shape,
not a signal something's wrong. Feed results into the corpus as usual; no
strategy changes expected from this batch alone.

## 2. Then: 3 juiced Tier-3 runs, user-started, bot-finished

**Correction to carry forward:** the user confirmed directly, live-tested —
juiced Forbidden Woods runs give a real 3x reward multiplier (room 1's
normal 5 Dendren Root drops 15 juiced). `config/discovered.json`'s
`juicedMultiplier: 1` is CONTRADICTED by this and should not be trusted;
note the correction in SPEC.md rather than reading that field at face value
going forward.

**Real gap, checked directly, not assumed:** `start_run`'s actual envelope
(SPEC.md's confirmed dungeon action section) has never carried a `tier`
field — every capture only shows `consumables`/`isJuiced`/`index`, and
`isJuiced` has never once been sent as `true`. The bot has no confirmed way
to construct a juiced-Tier-3 `start_run` request; this is genuinely unbuilt,
not just untested. Given real entry-fee materials (Tier 3 requires 7
distinct crafting items per `config/discovered.json`'s `entryData`) and 3
real Big Heal Juice per run are at stake, don't have the bot guess at this
request shape.

**Use the already-proven pattern instead:** the user starts each of the 3
juiced Tier-3 runs manually in the browser (juiced toggle, Tier 3, whatever
selection surfaces the "3 gold rings" offering), then the bot takes over via
the standard resume path — zero extra energy/run-slot cost for the resume
itself (confirmed sessions 17/19), and the combat/potion loop doesn't care
how a run was started. This sidesteps the unbuilt request shape entirely
while still getting full bot-driven play for the actual combat.

**Sequencing safety guardrail — this is a manual back-and-forth, not a
batch.** There is no watcher polling the browser for a newly-started run;
each of the 3 is a discrete round: user starts it and confirms it's active
→ tells CC to resume and complete THAT ONE run → CC finishes it → user
starts the next. **Do not let CC auto-start a new run after finishing one**
(e.g. via `--runs=N` with N>1, or any loop) — if invoked while no run is
active, the bot's default behavior is to start one itself, and it cannot
construct a juiced-Tier-3 request. An auto-started run would silently be a
plain free-tier run, burning one of the 3 juiced-eligible slots on the
wrong thing. Scope every invocation this batch to "resume and complete the
currently active run, then stop."

**Before handoff, one thing to check** (down from two — see correction
below):

1. Raise `config/bot.json`'s `forbiddenWoods.potions.maxPerRun` from 2 to 3
   for this batch, with a sourced comment (user's explicit call — tier-3/
   juiced stakes justify 3 where the 20-energy case didn't). Ask the user
   whether to revert after this batch or leave it at 3.

**Correction from the user on "Gold Ring": no reward-pick logic changes
needed.** It's not a distinct reward type the bot has to recognize — it's a
modifier on the SAME character-upgrade boon offers (+2 burn, +4 sword DMG,
etc.) that increases the Hard Cores bundled with whichever offer gets
picked. The boon offers themselves are unchanged. So the existing reward-pick
logic doesn't need to distinguish anything special here — whatever boon it
would normally pick, it picks the same way, and the larger Hard Cores payout
happens server-side regardless of which offer is chosen. Drop this as a
pre-flight check entirely.

Once these 3 runs complete, document what was actually observed (real
energy cost, real reward multiplier, whatever `isJuiced`/tier looks like
from the state reads even though the bot didn't construct the request) —
this is real capture, satisfies CLAUDE.md's discovery discipline even
though the bot didn't initiate the run itself.

## 3. Task 10's 8-hour gate — delayed by the user's own choice, until after reset

User confirmed: hold off until after today's reset. Worth noting why that's
the right call independent of timing preference: fishing's guard budget is
already maxed for today, and dungeon's will be near its own cap after item
1 above — so an attempt today would just hit the orchestrator's own
configured daily caps and idle, not exercise the real energy-regen
sleep-and-resume behavior the gate is meant to prove. Wait for a day with
real headroom on both budgets at the start.

---

## Your task

1. Spend the 9 remaining non-juiced dungeon runs now, potions off. Run
   `deathRooms.ts` after and report the fresh histogram.
2. Correct SPEC.md/`config/discovered.json`'s juiced-multiplier note per §2.
3. Raise potion `maxPerRun` to 3 (sourced comment); confirm with the user
   whether to revert after.
4. When the user hands off each juiced Tier-3 run (started manually), resume
   and play it out via the normal live path. Document real observed
   energy/reward numbers afterward. No reward-pick logic changes needed
   (see correction above — "Gold Ring" only affects Hard Cores payout, not
   which boon offers appear).
5. Do not attempt Task 10's 8-hour run this session — explicitly deferred.
