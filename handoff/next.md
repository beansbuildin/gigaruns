# BRIEF — session 20

**Opening move, before anything else below:** the user resumed session 19's
smoke-test dungeon run (left active at room 2, browser prompted
abandon/resume when they next logged in). Finish it via the normal live
path — it's already resumed, so this just needs `scripts/liveRun.ts` (or
the orchestrator) to play it out to completion, win or death, same as any
other live run. No new run slot or energy cost for the resume itself
(confirmed session 17). Once it's done and the account shows a clean
non-active state, tell the user directly so they can go capture the ROM
panel — they're deliberately holding off on that capture until this run is
out of the way.

Session 19 delivered both threads from its brief, honestly reported as
partial where they're partial. Housekeeping (recap-against-final-commit)
landed. Take the two threads below in order of what actually needs deciding
first, after the resumed run is handled.

---

## 1. ROM claims: the number came back small — decide whether to keep going

The live claim worked (romId 2097, HTTP 200, before/after energy read
confirms it lands in the real spendable pool) — but credited **~1.0 energy**,
not the 7 or 57 in the captured request bodies. Confirmed: `amount` in the
request does NOT control the credited amount (sent 57, got ~1). Also
confirmed the request needs `amount` present at all (omit it → HTTP 500), so
it's a required-but-inert field, an odd but now-documented shape.

**Worth doing the arithmetic before spending more session time on this.** The
account's own passive regen is 18/hr against a 420 cap — that's up to 432/day,
already above the bot's own 240/day configured budget. So the recurring
"real energy at 10/420" wall isn't really a *daily total* shortage; it's
sessions landing before regen catches back up. A ~1-energy trickle per ROM,
gated by an unknown cooldown, only matters if there are enough ROMs and a
short enough cooldown to add up to something comparable to that regen rate —
and right now only 2 ROMs are known, one of which (7959) has never once
succeeded a claim.

I asked the user directly for two things this brief needs before Task 10's
energy model can use ROM claims at all:

1. How many ROMs the wallet actually holds, and what UI panel lists them
   (only 7959/2097 are known from two captured requests).
2. Whether the claim cooldown is known/documented anywhere client-side
   (session 19 only lower-bounded it at >34 seconds via one failed
   re-claim).

**If the user's answer suggests real volume** (e.g., dozens of ROMs, or a
short cooldown), size it properly: total claimable/day, and only then decide
whether it's worth wiring into the orchestrator. **If not** — small ROM
count, long cooldown, or the user doesn't know — deprioritize this. Don't
spend a session empirically timing out a cooldown; that's exactly the kind
of "wait and see" CLAUDE.md's fail-closed spirit argues against spending
agent time on. Ask again rather than guess.

Regardless of the answer, `POST /roms/factory-claim`'s odd `amount`-required-
but-inert shape is already documented (SPEC.md) — that part doesn't need
redoing.

## 2. Task 10: real gate needs someone to press go outside a chat session

Everything code-side is done and verified: scheduler dry-run reads real
account state correctly, SIGINT is live-verified to finish the current
action and stop cleanly at the next turn boundary (not mid-turn), guard-trip
classification is unit-tested against every real reason string. This is not
"needs more building" — it's "needs an unattended clock."

`npx tsx scripts/orchestrator.ts --hours=8` has to run outside an interactive
session for the actual gate (eight hours, zero unhandled exceptions, daily
rollup, energy within budget) to be checkable at all. That's not something
this brief can hand to a Claude Code session the way the rest of the work
gets handed off — an interactive session doesn't stay open eight hours. This
needs the user to kick it off directly (background process, screen/tmux, or
similar) and let a session review the resulting log/rollup afterward.

**One decision before that run starts, not after:** the orchestrator's
dungeon runs are currently potion-free (stated simplification in the
script's own header). Task 12 already has a working, tested potion policy
(`shouldUsePotion`, threshold 0.5) sitting unused in `liveRun.ts`. Wire it
into the orchestrator's dungeon path before the real 8h run — running the
long unattended gate on a known-weaker config just to re-run it later with
potions wired in wastes the one long clock-block this needs. This is a small
integration, not new design; the policy and its threshold are already
settled.

## 3. Recurring bookkeeping tax — worth fixing once instead of absorbing again

Session 18 found 4 stale hardcoded corpus-count literals after an out-of-band
commit. Session 19's own notes say the same failure mode "fired again this
session, as expected." Twice now, in a row, with "expected" attached the
second time — that's not a one-off, that's a structural gap: `tests/boons.test.ts`, `tests/dungeonSim.test.ts`, and `tests/replay.test.ts` assert
against hand-maintained literal counts (exchange counts, pickup counts, room-1
option counts) that drift every time new fixture data lands, live or
otherwise.

Worth a small refactor: derive those expected counts from the fixture corpus
itself at test-run time (count what's actually in `fixtures/`) rather than
hardcoding the numbers a human has to update by hand after every capture. The
tests that check *model correctness* (exchange replay, delta re-derivation)
stay exactly as strict as they are now — only the tests asserting "how big is
the corpus right now" change shape, from a literal to a computed value. Small,
one-session job, and it removes a recurring source of false "something broke"
signals right when a session has just landed real new data — which is exactly
the moment false alarms are most expensive to sort out.

---

## Your task

1. Report back on the two ROM questions above (ask the user directly if not
   already answered) and decide, with the arithmetic in §1, whether ROM
   claiming is worth further investment. Don't automate it regardless of the
   answer without a separate explicit go-ahead — this is a sizing decision,
   not a build one, this session.
2. Wire the existing potion policy into `scripts/orchestrator.ts`'s dungeon
   path.
3. Refactor the three corpus-count tests to compute expected counts from
   fixtures rather than hardcoding them.
4. Tell the user plainly, in the recap: the 8-hour orchestrator run is ready
   to start and needs to be kicked off outside an interactive session. This
   is the last thing standing between the project and its stated overall
   goal (a fully functional autoplay bot) — flag it as such.
