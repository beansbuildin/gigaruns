# session 10 — 2026-08-15 — commit b43e241

Full detail behind `handoff/STATE.md`'s summary. Brief: session-10 brief §1-5
("Every run dies... put a name on it, don't tune blind").

## What the brief asked for

1. Death-room histogram from the existing corpus, first — cheap, decides
   where retune effort goes.
2. Retune for attrition: `w1`, depth bonus, §4c loot ranking, validated
   against sim's mean-rooms-cleared. Mark boon-preference conclusions
   provisional (thin corpus).
3. Update `TASKS.md`: Task 5 gate retired to reported-metrics, Task 11 gate
   promoted.
4. Five more live runs with the retuned config, budget 120 energy. Compare
   death-room distribution before/after.
5. The `reward_*`/`path_*` envelope test, opportunistically.
6. `QUESTIONS.md` capture checklist for the fishing HAR.

Items 1, 2, 3, 6 done. Items 4 and 5 blocked — see below.

## 1. Death-room histogram

Built `scripts/deathRooms.ts`. The key design decision: what counts as an
"attempt," and what counts as a "death."

**Attempt boundary.** `src/sim/corpus.ts`'s `loadCorpus()` returns one
`CorpusRun` per capture *directory*, and its own doc comment already notes "a
watcher session can span several dungeon attempts" — split internally by
`DUNGEON_ID_CID`. But the reverse is also true and not handled by
`loadCorpus`: one dungeon attempt can span *several directories*, because
`scripts/liveRun.ts` writes a fresh capture directory per process invocation,
and session 08/09's live play frequently restarted the process mid-run
(resuming an existing run is a normal, tested path — see DECISIONS
2026-08-15's `assertCanStartRun` fix). So `deathRooms.ts` groups by
`DUNGEON_ID_CID` globally, across every directory, not just within one.
Verified by hand first: chronologically walking `logs/*.jsonl`'s
`resuming_existing_run`/`run_ended_or_absent` events for session 08+09 landed
on the identical six death rooms the script independently produced from the
fixture corpus (a different data source — JSONL decision logs vs. raw wire
state captures) — two independent derivations agreeing is why the grouping
logic is trusted rather than merely plausible.

**Death boundary.** Only an attempt whose *last captured state* has the
player at HP 0 counts. Every corpus capture from before session 08 is a
human-supervised research session (combat-model verification, `AddBlock`
pickup pair capture, etc.) that stopped recording without the player dying —
9 of them, all at various rooms, none at HP 0. Counting "the capture ended
here" as "the bot died here" would have manufactured 9 fake data points. One
edge case worth flagging: `run-2026-08-15-01-53-36 cid=24789323` ends with
**both** sides at HP 0 — a mutual-kill tie (both played `rock`, `thisPlayerWin`
false on both sides in the raw JSON). Counted as a player death (the run ends
regardless of the enemy's fate), at room 4.

**Result:**

```
15 distinct dungeon attempts (grouped by DUNGEON_ID_CID across directories)
6 confirmed deaths, 9 non-death captures (excluded)

DEATH-ROOM HISTOGRAM
  room 1: (0)
  room 2: ██ (2)
  room 3: ██ (2)
  room 4: ██ (2)

per-attempt:
  cid=24781644  room=4  (session 08's one run)
  cid=24788679  room=3  (session 09 run 1)
  cid=24789323  room=4  (session 09 run 2, mutual-kill tie)
  cid=24789353  room=2  (session 09 run 3)
  cid=24789397  room=2  (session 09 run 4)
  cid=24789416  room=3  (session 09 run 5)
```

Matches `STATE.md` session 09's "rooms reached 3/4/2/2/3" for its own five
runs, plus session 08's one run at room 4 — six total, 2/2/2 across rooms
2/3/4, zero at room 1.

Per the brief's own diagnostic ("if deaths cluster at 2-3 it's early-room HP
economy, if they spread evenly it's enemy scaling") this reads as **enemy
scaling**. n=6 is thin — six data points is not a distribution, it's an
anecdote with numbers attached — but it's what exists, and it agrees with the
sweep result in §2.

## 2. Retune

**The structural read.** `src/strategy/utility.ts`'s win terminal was:

```ts
if (isDead(foe)) return cfg.winValue;
```

Flat. Among several move choices that all lead to a win within the search
horizon (`cfg.depth` = 2 live sim / 3 live play), the engine was completely
indifferent to *how much* HP/armor survived the win. This is precisely
"optimising each battle as if it were the last one" from brief §1 — a kill
that leaves you at 30 HP and one that leaves you at 2 HP score identically,
even though only one of them sets up room 5.

Changed to:

```ts
if (isDead(foe)) return cfg.winValue + base;
```

where `base` is the same continuous HP/armor term the non-terminal branch
already computes. Verified this doesn't create a discontinuity: at a win,
`foe.hp <= 0` and (per the combat model — armor absorbs before HP, so a dead
foe's armor is already 0) `foe.armor === 0` too, so `base`'s foe-side terms
are always exactly 0 at a win — `base` reduces cleanly to
`w.hp*(me.hp/hpMax) + w.armor*(me.armor/hpMax)`, a pure "how comfortable was
this win" margin.

**Deliberately not applied to death.** `isDead(me)` still returns
`deathPenalty(room, cfg)` with no `base` added. Reasoning: death ends the run
regardless of what the enemy's HP/armor looked like — there's no "how
comfortable was this death" to price, and adding `base` there would have
broken `tests/strategy.test.ts`'s "scores mutual death as death, not as a
win" exact-equality test for no semantic gain (mutual death states in the
test fixtures have nonzero armor on both sides by construction, since `over`
only sets `hp: 0`).

**Test fallout.** One test broke as expected:
`tests/strategy.test.ts`'s "decides that case on expectation" filtered
`cells` by `c.value === cfg().winValue` to identify which of Shield's three
replies were kills — no longer true once wins carry a margin. First fix
attempt (`c.outcome > 0`) was itself wrong: `outcome` is the RPS
move-comparison result, not whether the exchange was lethal, and the test's
own comment says one of the two kills is a **tie** that happens to be lethal
(their Shield ties ours, they still take 6, dead from 4 HP) — `outcome > 0`
only caught the win, not the lethal tie, and the assertion failed with `[]`
partially matching. Fixed properly by resolving the exchange and checking
`isDead(result.foe) && !isDead(result.me)` directly — more robust than either
prior form since it doesn't depend on `utility.ts`'s internal encoding at
all.

**§4c loot fix.** `Heal`'s urgency bonus:

```ts
// before
score = 100 * (usable / hpMax) + (hpFraction < 0.5 && roomsRemaining > 0 ? 60 : 0);
// after
score = 100 * (usable / hpMax) + (roomsRemaining > 0 ? 60 * (1 - hpFraction) : 0);
```

A heal offered at 51% HP used to score identically to one at 100% (both get
+0 urgency bonus); now it scores close to the 49%-HP case (60*0.49 vs
60*0.51) rather than falling off a cliff at one threshold. Motivated by
`Regen`/HP-persistence findings (DECISIONS 2026-08-17): HP does not come back
between rooms or in combat, so what matters is how much is missing, not which
side of 50% that happens to land on.

**The sweep, and the null result.**

```
$ (temporary sweep script, not committed — ad hoc weight/depthBonus multipliers via strategyPolicy({config: {...}}))
baseline (current DEFAULT)   mean rooms 1.946 ± 0.017   room1 win 86.4% ± 0.5   deepest 3   battleCov 41%
hp weight x3                 mean rooms 1.967 ± 0.017   room1 win 86.5% ± 0.5   deepest 3   battleCov 40%
hp weight x10                mean rooms 1.945 ± 0.017   room1 win 86.5% ± 0.5   deepest 3   battleCov 41%
depthBonus x5 (1.75)         mean rooms 1.955 ± 0.017   room1 win 86.4% ± 0.5   deepest 3   battleCov 40%
depthBonus x10 (3.5)         mean rooms 1.956 ± 0.017   room1 win 86.4% ± 0.5   deepest 3   battleCov 40%
hp x3 + depthBonus x5        mean rooms 1.975 ± 0.017   room1 win 86.4% ± 0.5   deepest 3   battleCov 40%
```

N=20000, seed 1. Also ran a straight before/after A/B via `git stash` at the
same N and seed: `meanRoomsCleared` 1.946 both times, room-1 win rate 86.4%
both times, to 3 significant figures, `scored` counts differing by 3 out of
20000 (17280 vs 17283 — noise from boon-offer RNG draws, not decision
differences).

**Why this makes sense, on reflection.** The room-1 EV table
`scripts/sim.ts` already prints (unchanged by this session, still worth
reading) shows the actual numbers: turn 3 of a sample battle has rock's cells
at `u1001.1 u561.0 u1001.3` — i.e. once the engine is one move from a
possible kill, cell VALUES are already deep in "someone's about to die"
territory (±1000-scale), and the ~0-2 point margin this session added is
swamped by which move has higher P(win) under the opponent model in the
first place. The RPS structure (3 discrete moves, large ATK/DEF gaps between
enemies' Rock/Paper/Scissor) doesn't produce many genuine near-ties in EV for
a small continuous margin to break. Amplifying the margin 10x confirms this
isn't a magnitude problem — at 10x the room-1 win rate STILL doesn't move
past 86.4→86.5%, within CI.

**What this does and doesn't mean.** It does NOT mean the utility function
is unfixable or that HP/armor weighting is irrelevant in principle. It means:
at the corpus's currently-observable depth (rooms 1-4), with the current
linear weighted-sum utility form, no magnitude of `hp`/`armor`/`depthBonus`
retuning shows up in `meanRoomsCleared`. Combined with the even death-room
histogram (§1), the more likely explanation is that runs are dying to
specific hard fights (enemy 65's Risky-tier rolled stats at room 3, whatever
room 4 turns out to need) rather than to accumulated attrition that a
smoother HP-preservation term would have prevented. That's a different
problem — better opponent-model reads at depth, or capture past room 4 — not
a weight-tuning problem.

Both code changes are kept. They are correct fixes to real defects (win
terminal was genuinely wrong; the heal step function was genuinely
arbitrary), validated harmless, just not shown to be THE fix for anything
measurable yet.

## 3. TASKS.md

Task 5: added a "GATE RETIRED" block pointing to Task 11, per brief §2 — the
existing gate text and its 2026-08-16 "GATE MET" outcome are left untouched
below it (append, don't rewrite history).

Task 11: added the promoted gate text (mean rooms cleared, 95% CI, ≥1000
runs, reported alongside room-1 win rate / coverage / `deepestScorableRoom` /
death-room distribution) and this session's "GATE NOT MET" outcome with the
sweep table and the histogram cross-reference.

## 4 & 5. Blocked: five-run stage and envelope test

`npm run live -- --dry-run` (a real live call, just read-only) was the first
live action attempted this session, specifically to sanity-check the
strategy-code changes above before spending anything. It halted immediately:

```
▸ liveRun.ts — STAGE 1 dry-run
  · resuming today's budget: 78 energy / 5 runs already spent
  account <USER> noobId <NOOB>
▸ run 1/1
✗ Guard tripped: session run cap reached {"attemptedRun":6,"cap":5}
```

`data/guard-budget.json`: `{"date":"2026-08-15","energySpent":78,"runsStarted":5}`.
Cross-checked against the real system clock (`date -u`) — genuinely today,
not stale state from a different day that should have rolled over. Session
09's five-run stage spent the entire `config/bot.json` budget
(`dailyEnergyBudget: 120`, `maxRunsPerSession: 5`) earlier today, and the
guard did exactly what session 09 built it to do: refuse a 6th run.

The session-10 brief asks for five MORE runs on top of that — which needs
either raising today's budget or waiting for tomorrow's UTC rollover.
Raising `config/bot.json` myself was the live option, and CLAUDE.md's "Ask
first" list names exactly this ("spend energy above the configured daily
budget") as something not to do autonomously. Session 09's own 60/3→120/5
raise is not a precedent for doing this unilaterally again — that raise
matched a figure the session-09 brief had *already stated explicitly*
("120 energy this session... covers five runs"); this one would not.

Logged as `QUESTIONS.md` #8 (the budget decision) and #9 (the envelope test,
which piggybacks on #8 rather than being separately blocked — it needs one
live reward pick to exist at all). Neither the five-run stage nor the
envelope test happened this session. This means **nothing about the retune's
real-world effect was confirmed live** — everything in §1/§2 above is sim and
corpus analysis only.

## Commit

`b43e241` — `git diff 1b0d77f..b43e241 --stat`:

```
QUESTIONS.md            | 70 ++++++++++++++++++++++++++++++++----
SPEC.md                 | 40 ++++++++++++++++++---
TASKS.md                | 92 +++++++++++++++++++++++++++++++++++++++++++++++
handoff/DECISIONS.md    |  5 +++
scripts/deathRooms.ts   | 96 +++++++++++++++++++++++++++++++++++++++++++++++++ (new)
src/strategy/loot.ts    | 10 +++++-
src/strategy/utility.ts | 26 +++++++++++---
tests/strategy.test.ts  | 15 ++++++--
8 files changed, 334 insertions(+), 20 deletions(-)
```

No new fixture directories — no live network traffic occurred this session,
by construction (blocked at the first attempted call).
