# TASKS

Work in order. Each task has a **Gate** — a concrete, checkable result. Do not
start the next task until the gate passes. Commit at each gate with the
verification output in the message.

If a task is blocked, write the blocker to `QUESTIONS.md` and skip to the next
unblocked task. Do not idle.

---

### 1 — Scaffold

Node 20+, TypeScript strict, `viem`, `zod`, `vitest`. Directory layout per
SPEC §6. `.gitignore` covering `.env`, `*.key`, `config/discovered.json`,
`data/`, `logs/`, `fixtures/**/*.har` **before any auth code exists**.

**Gate:** `npx tsc --noEmit` clean. `git status` shows no secret-bearing path.

---

### 2 — Auth (Path A) + API client

Load JWT from `~/.secrets/gigaverse-jwt.txt`. Client with: rate limiter
(1200ms + 0–400ms jitter), 429 backoff from 5s, single-flight action-token mutex,
zod-validated responses, truncated-JWT logging only.

**Gate:** `GET /user/me` returns the user's real account. Print username and
noob ID. Deliberately corrupt the JWT and confirm a clean "token expired" halt
rather than a crash loop.

---

### 3 — Probe & discovery ← **the unblocking task**

Build `scripts/probe.ts` per SPEC §3b. Read-only; must not start a run.

**Gate:** `config/discovered.json` contains a real numeric `dungeonId` for
Forbidden Woods with its energy cost and room count, sourced from a live
response — not from this spec. `fixtures/probe/*.json` populated. Print the
answer to: **do moves have charges, and are the enemy's visible?** That answer
determines how §4 gets built, so state it explicitly in the commit message.

---

### 4 — Simulator + fixtures

Replay harness that feeds recorded states to strategy functions and reports
outcomes. Hand-build 20 dungeon states covering: full HP opening, low HP, enemy
one hit from death, self one hit from death, and (if charges exist) a
zero-charge enemy.

**Gate:** `vitest run` green. Sim plays 1000 synthetic runs against a
random-move opponent and reports win rate. Nothing touches the network.

---

### 4.5 — Boon model ← inserted 2026-08-15, **GATE RETIRED 2026-08-16**

Model boons as state deltas applied at pickup, derived from before/after pairs
in the corpus. Nothing inferred from option text. Types without a pair stay
unmodelled and fail closed with a reason code.

**Gate as written:** `deepestScorableRoom` ≥ 4, matching corpus depth, with
coverage reported.

**Outcome: the model is built and correct; the gate is NOT met, and it was never
reachable.** `deepestScorableRoom` is still **1**. `src/sim/boons.ts` models all
four boon types that have a pickup pair, `tests/boons.test.ts` re-derives every
delta from the fixtures, and the blanket `BOON_TAKEN` reason is replaced by
precise ones. But three walls hold the number down, and the second is fatal to
the gate itself (SPEC §4d):

1. 6 of 6 recorded room-1 boon options are unmodelled or grant a rolled stat.
2. Enemies 65 and 66 are unscorable *innately* — so a perfect boon model caps
   `deepestScorableRoom` at **2**, not 4. The gate asked for a number the corpus
   cannot produce regardless of how good the boon model is.
3. Only four offer triples exist; synthesising more is forbidden.

`npm run sim` prints a labelled counterfactual proving the machinery works: sub
`Heal` into room 1 and the number rises to 2, then stops at wall 2.

**Not carried forward as a blocker.** The remaining work is capture, not code —
see `QUESTIONS.md` §5a–§5d for the specific captures that would move it, all of
which fit inside a single watched run.

**GATE RETIRED [2026-08-16, session-06 brief §1].** Not carried forward as `>= 2`
either: a gate one counterfactual substitution away from passing measures
nothing. The gate was badly set, and the generalisable rule is now `CLAUDE.md`
§6 — *a gate must be set on something the agent controls*. `deepestScorableRoom
>= 4` was chosen because the corpus **reached** room 4, which confused corpus
depth with corpus scorability.

**And one of the reasons recorded for retiring it was itself wrong.** Reason 2
above — enemies 65 and 66 are unscorable *innately* — was falsified by session
06's capture: `enemyPathOptions[]` carries `rolledEnemyStats` and `enemyBuff`
**per tier**, tier 0 ("Safe") is all zeros with a null buff, and the recorded
profiles are Dangerous-tier instances the user chose. The retirement stands on
reasons 1 and 3, which hold. Reason 2 is retracted; see `src/sim/enemies.ts` and
DECISIONS 2026-08-16.

**`deepestScorableRoom` went 5 → 4 in session 53, and that is NOT a regression
— it is the retired gate's exact value moving under it.** [2026-08-20, session
53; recorded here session 54 per CLAUDE.md §6.] The 12 boon offers captured
that session introduced three new UNMODELLED types (AddWeakShield,
RegenMastery, Vengeance) at rooms 3/4, so more simulated runs go unscorable
earlier. Verified by stashing, deterministic across three runs. More real
offers lowering a coverage metric is the metric working correctly; nothing in
the code got worse.

Recorded because the retired gate above sat at exactly 4, so this number is
one honest capture away from looking like a failure to a future reader who
finds it at 3 and does not know why. **Do not tune anything to get it back to
5.** The lever that actually moves it is modelling the unmodelled types, and
`scripts/boonCoverage.ts` now ranks them by offer frequency and shallowest
room: session 54 measured **30 of 36 unmodelled types first offered in rooms
1–3**, led by TieWeak (11 offers, room 1), AddBurnShield (8, room 1) and
AddLifestealShield (5, room 1). Modelling any of those needs a pickup PAIR,
which is capture, not code — the same conclusion this task reached in 2026-08-15
and the reason it is retired rather than open.

**[2026-08-20, session 57] The gate is now retired TWICE OVER, and the second
reason is permanent: CLAUDE.md rule 8 flipped to the HIGHEST enemy tier, so
`deepestScorableRoom` and battle coverage will FALL and STAY FALLEN.** Of the
622 non-Safe paths ever offered, 617 (99.2%) carry `rolledEnemyStats`, and
SPEC §4e establishes those are 1–5% proc chances needing hundreds of
observations the corpus does not have. The simulator therefore scores almost
nothing about the policy the bot now plays — this is the accepted cost recorded
in rule 8 itself, not a regression and not a capture gap another session
closes. Session 56 measured the ceiling directly: modelling every one of the 46
enemy buffs freed **zero** exchanges, because `ROLLED_STATS` co-occurs on every
one it cleared.

Two consequences a future reader needs, stated here rather than re-derived:

  1. **`src/sim/dungeonSim.ts` still fights SAFE tier by default and that is
     deliberate.** Raising it would not close the gap — it would only make the
     sim refuse to score. Every number the simulator now prints describes
     Safe-tier play, which is a lower bound on difficulty and no longer the
     policy. The default's doc comment says so.
  2. **Offline gating of DUNGEON strategy is largely over** (session-57 brief
     §4). The sim was already scoring 64/1107 exchanges (5.8%) and could not
     separate two boon policies at n=2000. From here a dungeon strategy change
     is justified by being a user directive or by being mechanically obviously
     correct — reading a field the bot ignored, fixing a double-count — and
     validated by live outcome over many runs, which at rule 11's four juiced
     runs/day is weeks. **Anything claiming an offline gate must name the arm
     that separated and at what n, or admit it did not.** Fishing is now the
     only place in this project where an offline gate still means something:
     88 clean traces, paired and bootstrapped, and it still separates arms.

---

### 5 — Dungeon strategy

**GATE RETIRED [2026-08-16, session-10 brief §2].** `deepestScorableRoom`
climbing 1 → 4 (Task 6, session 09) made the room-1-only framing this gate was
built around stale: combat is solved (0 model failures across 214 exchanges,
room-1 battle win rate 81.8% vs a 67.9% baseline, both non-overlapping), but
every one of the bot's own five live runs died before room 5, and dying with
low HP after a "won" room-1 battle is not the same thing as winning the run.
Room-1 battle win rate now goes in the **reported-metrics block permanently**
— it is not re-run and not tuned against — and Task 11's mean-rooms-cleared
gate is **promoted to the live objective**. See Task 11 for the current gate
and this session's outcome against it.

Implement SPEC §4: EV engine, utility function, opponent model with charge
pruning and first-order transition tracking, maximin fallback, loot ranking.
Pure functions only. Must use `netDamageOnTie` rather than raw ATK — see the
tie-value asymmetry in SPEC §4b.

**Gate [RESTATED AGAIN 2026-08-16, session-06 brief §5].** The 2026-08-15 form
gated on *mean rooms cleared*, which with `deepestScorableRoom` pinned at 1 is
the room-1 win rate with extra steps — `always-Sword 1.018` is barely a different
number from its 67.9% battle rate. The rooms-cleared gate moves to Task 11, where
it belongs once coverage has climbed. Replacing it:

> On the scored subset, the strategy engine beats the always-Sword baseline on
> **room-1 battle win rate**, with **non-overlapping 95% confidence intervals**
> over ≥1000 runs. Report alongside: mean rooms cleared ± CI, coverage %, and
> `deepestScorableRoom` — **reported, not gated**. **Any win-rate claim stated
> without its coverage is not a result.**

Gate on what is measurable now; report what isn't, so the blind spot stays
visible. Two constraints on the build: the engine must be **room-agnostic**
(nothing hardcodes room 1, so it works deeper with no rewrite when coverage
climbs), and §4c loot ranking gets written but explicitly marked **unvalidated**,
since it cannot be tested at depth 1.

**Outcome: GATE MET [2026-08-16].** `npm run sim`, 1000 runs each vs random,
room-1 battle win rate on the scored subset:

```
always-Sword   67.9% ± 2.9  [65.0, 70.8]  (679/1000 scored)
ev-engine      81.8% ± 2.4  [79.4, 84.2]  (818/1000 scored)
```

Intervals do not overlap. Reported, not gated: mean rooms cleared always-Sword
1.038 ± 0.059 vs ev-engine 1.616 ± 0.072; battle coverage 49% vs 39%;
`deepestScorableRoom` 1 for both. **Coverage falls as the engine improves** and
that is not a regression — a policy that survives room 1 more often takes more
boons, and every recorded room-1 boon is unscorable. Only capture moves
`deepestScorableRoom`.

Baselines re-measured at the session-06 loadout (`armorMax` 15 → 16, the user
changed gear): always-Sword 67.9%, random 60.6%, always-Shield 55.1%. Always-Sword
is a genuinely strong baseline, not a strawman.

Where the edge comes from, measured rather than asserted: depth-2 expectimax is
worth ~4 points over depth-1 (82.0% vs 78.3%), and depth 3 a further ~2 that is
**inside the confidence interval** and costs 7× the time, so the default stays
at 2. Online learning against this opponent is worth ~1 point, correctly — the
sim's opponent is uniformly random, so there is nothing to learn, and the model
reports exactly that (`determinism()` finds nothing over 5447 observations).

**[UPDATED session 07]** Re-run at N=20000 (`scripts/depthAblation.ts`, session-06
brief §8): depth 1/2/3 SEPARATE cleanly (77.14% / 79.96% / 81.64%, non-overlapping
95% CIs) — the depth-2→3 gap above was real, just under-sampled at N=1000. Depth 4
(82.62%) does not separate from depth 3. Adopted for live play as `LIVE_CONFIG`
(`src/strategy/config.ts`); `DEFAULT_CONFIG` stays at depth 2 for sim throughput.
See DECISIONS 2026-08-17.

Log the EV table for one full battle and eyeball it — every chosen move should
be justifiable from its numbers. If one isn't, the utility weights are wrong,
not the logs. `npm run sim` prints one, from a warmed model at a fixed seed.

**Extension [2026-08-15, session 11] — RETRACTED [2026-08-15, session 12].**
Session 11 downgraded potion timing to a static pre-run loadout choice,
folded into §4c loot ranking with no standalone task or gate, on the
reasoning that potions are selected before `start_run` and not used
mid-run. **This was wrong — the session-12 brief's addendum carries a direct
user confirmation that reverses it: potions are CLICKED to use during a
run.** They do not auto-proc, and they are not fire-and-forget at
`start_run` either. The auto-proc branch this extension used to describe is
deleted; see Task 12 below, which restores potion timing as its own task
with its own gate.

---

### 6 — Live dungeon, supervised

Run **exactly one** Forbidden Woods run end to end. `--dry-run` prints decisions
without sending. Then one real run.

**Gate:** One completed run, full JSONL log, run summary printed, energy
accounting matches expectation. Then five consecutive runs with no guard trips.

**Outcome [session 08]: first half MET, second half NOT ATTEMPTED.**
`scripts/liveRun.ts` built with 4 CLI stages (`--dry-run`/`--stage2`/
`--runs=N`) per the session-08 brief's staged plan. Blocked at the top of the
session on a rejected JWT (QUESTIONS.md §7); once refreshed, ran all the way
through: stage 1 (dry-run) found and fixed a real spec-drift bug on the
first-ever live call (`/game/dungeon/state`'s idle shape); stage 2 sent the
project's first-ever POST (`start_run`) and halted as designed; stage 3 ran
one full room 1→4 live run, ending in a death at room 4 that matched the
clean combat model to the last hit. Along the way: `GET /game/dungeon/state`
turned out not to carry a fresh `actionToken` (client was clobbering its own
tracked token — fixed); the reward-pick action is `reward_one`, not
`loot_one`; the enemy-tier pick is `path_two`, not `enemy_two`; an HTTP 500
does NOT reliably mean an action didn't apply (confirmed both ways on the
same run) — `postWithVerifiedRetry()` re-checks live state before ever
retrying. Room 3's Safe-tier capture gap (open since session 06/07) is
closed; `MAX_SAFE_ROOM` is 4, not 2. Full detail in DECISIONS.md and
handoff/log/session-08.md.

**Five consecutive runs NOT attempted** — this run took five rounds of
live-discovered bugs and several human-assisted unblocks to get through, not
a clean pass to build five more on. Next session's first move.

**Outcome [session 09]: GATE MET on its numeric terms — five completed runs,
zero clean-model failures — but "no guard trips" did NOT hold, and the trips
were real findings, not noise.** Two genuine live surprises before the first
run even finished: `enemyPathOptions[]` is not guaranteed to include a Safe
(tier 0) option (user-confirmed expected behavior — `pickLowestTier()`
replaced the old strict Safe-only rule, see DECISIONS 2026-08-15 and CLAUDE.md
§8; **`pickLowestTier` no longer exists — rule 8 flipped on 2026-08-20 and the
live selector is now `pickHighestTier`**, session 57), and a stranded run at room 2 (HP 2/32) exposed a real ordering bug —
`assertCanStartRun` ran unconditionally before checking whether a run already
existed, so resuming a run could be blocked by the session cap meant only for
NEW starts. Both fixed with regression tests, not worked around live.

Five runs completed: rooms reached 3, 4, 2, 2, 3 (all deaths, no full clear).
78 energy spent (`config/bot.json` raised 60/3 → 120/5 to match the session-09
brief's stated budget, which the config file had never been updated to
reflect). The `reward_*`/`path_*` HTTP-500 pattern from session 08 recurred
substantially — 17 occurrences across the 5 runs (9 reward, 8 path), all
cleanly retried via `postWithVerifiedRetry`, 0 landing as the split-brain
"applied despite the error" case, 0 needing the reward-by-identity fix to
actually redirect (the offer never changed under a retry this session, but
the safety net is now in place for when it does).

**The biggest finding: Wall 1 (`deepestScorableRoom` stuck at 1 since Task
4.5) is broken.** Live play captured pickup pairs for two more clean boon
types (`UpgradeRock`, `UpgradeScissor` — a new `moveDelta` effect kind,
`contaminates: []`, same footing as `Heal`) plus a second clean room-1 Heal
pickup, giving THREE independent clean+modelled room-1 options where session
08 had zero. `deepestScorableRoom` moved 1 → **4**, `MAX_OBSERVED_ROOM` — the
corpus's entire known depth, in one session. The "run win rate is exactly 0
BY CONSTRUCTION" invariant (DECISIONS 2026-08-15) is also gone: a scored run
can now, rarely (~0.3%), actually win. See DECISIONS 2026-08-15 (session 09)
for the full derivation and `tests/boons.test.ts`/`tests/dungeonSim.test.ts`
for the restated (not just re-numbered) invariants.

Not carried forward as a re-opened gate — this is a capture-driven change to
what the corpus supports, the kind of thing Task 4.5's retirement already
anticipated ("remaining work is capture, not code"). Worth Claude(chat)
weighing whether Task 5's strategy gate or Task 11's rooms-cleared gate should
move given the new depth. Full detail in DECISIONS.md and
handoff/log/session-09.md.

---

### 7 — Fishing API discovery

Requires the user's HAR capture (SPEC §3a) at `fixtures/fishing-cast.har`. Build
`scripts/parseHar.ts` to extract endpoints, bodies, and response shapes; generate
`src/api/fishing.ts` and a fixture of one full cast.

**Gate:** Documented fishing endpoint list with request/response schemas,
committed as `SPEC-fishing.md`. Dendren's node ID resolved into
`config/discovered.json`. If fishing is websocket-based, stop and write to
`QUESTIONS.md` instead.

**Outcome [2026-08-15, session 11]: GATE MET.** The user's HAR landed at
`fixtures/fishing-casts/fishing-cast.har` (not the exact path named above,
but correctly gitignored — `scripts/parseHar.ts` searches `fixtures/**/*.har`
rather than a hardcoded name). It is REST, one write endpoint (`POST
/api/fishing/action`), same action-token discipline as the dungeon side, so
no `QUESTIONS.md` block was needed. `SPEC-fishing.md` documents the full
endpoint map and every schema, `src/api/fishing.ts` implements them (zod,
`.passthrough()`, same convention as `src/api/schemas.ts`), and
`tests/api/fishing.test.ts` re-derives every schema against the redacted
fixtures.

Dendren resolved into `config/discovered.json`'s new `dendren` block, with a
stated caveat: `nodeId: "5"` (the value that worked, sent on the request) and
`pondId: 2` (independently named `"dendrenpond-tier1/2/3"` in a response) are
recorded SEPARATELY rather than assumed to be the same field under two
names — see `SPEC-fishing.md §3`.

One live finding along the way (CLAUDE.md §1): `deckCardData`'s
`startingAmount`/`unlockLevel` are `null` on `isDayCard` entries and entirely
ABSENT on some catalog entries — two different wire shapes for "no fixed
value", not one. `FishingCardSchema` types both fields
`.nullable().optional()`.

Also resolved, opportunistically, per session-11 brief §4: the item-metadata
endpoint from `QUESTIONS.md §3`'s other half. `GET /offchain/static`'s
`gameItems[]` carries names, descriptions AND a structured `itemEffect` —
confirms the three heal potions are flat heals (+4/+8/+20 HP), not
percentage, settling that branch of the potion-loadout question. See
`SPEC-fishing.md §5`.

Not attempted (genuinely uncaptured in this one cast, not overlooked): a
catch, a redraw, a second pond, or fish movement pattern identification
(Task 8's job, needs more than 5 moves of signal). See `SPEC-fishing.md §7`.

---

### 8 — Fishing strategy

Implement SPEC §5: hypothesis-elimination pattern matcher, transition logging
from turn one, EV-per-mana card choice, redraw threshold, lethal check,
Fintuition reveal handling.

**Gate:** Given the recorded cast fixture, the matcher narrows the candidate set
monotonically and predicts correctly once `|H| == 1`. Sim over 500 synthetic
casts beats random card choice on catch rate. Empty-hypothesis-set fallback is
tested.

**Outcome [2026-08-15, session 12]: GATE MET, and the gate was runnable as
written despite the 4×4/focus correction (session 11) — checked this at the
start of the session per CLAUDE.md §6 rather than discovering it at the
end.** The 3×3-vs-4×4 change affects the EV formula's derivation (now a
`(card, focus)` pair, `SPEC.md §5`), not the gate's own success criteria,
which never named a grid shape. `src/strategy/fishing/matcher.ts`,
`src/strategy/fishing/cardChoice.ts`, `src/sim/fishing/castSim.ts`; tests in
`tests/fishing/`. Matcher narrows monotonically and predicts the real cast's
actual next cell correctly once `|H| == 1` (`tests/fishing/matcher.test.ts`,
built from the real cast's decoded position sequence). 500-synthetic-cast
sim: matcher-EV policy 19.0% catch rate vs random 7.8% (`tests/fishing/
castSim.test.ts`). Empty-`|H|` fallback tested directly and confirmed to
trigger on the real cast replayed against the synthetic pool
(`scripts/fishConvergence.ts`'s own output). Verified by:
`npx vitest run tests/fishing` (18/18 pass), `npx tsc --noEmit` clean.

**[2026-08-18, session 43] Six new user-sourced strategy heuristics added,
per session-43 brief §3 — see SPEC-fishing.md §8 for the full writeup.**
Four implemented as tested pure functions (`src/strategy/fishing/
heuristics.ts`: center-bias tie-break, prune-return-to-previous-cell,
edge-predictability geometric helper, coverage-maximizing tie-break —
wired into `cardChoice.ts`'s `bestFocusForCard`/`chooseCard` and
`scripts/liveFishing.ts`'s distribution pipeline). Two are judgment calls
documented as decision points rather than functions, per the brief's own
framing (deliberate non-scoring play/redraw to let the fish drift closer;
oil-reserve floor, `src/strategy/fishing/oilPolicy.ts`).

**Capture gap, flagged rather than guessed past (CLAUDE.md §2)**: the
oil-reserve heuristic's recommendation function (`shouldConsiderRelaxingOil`)
has no live call site and cannot get one yet — no request shape for
actually consuming a fishing oil mid-cast has ever been captured. SPEC-
fishing.md §4a already named this same gap for the general oil-use
mechanism (`itemId`/`slotIndex` on the existing envelope are "very likely"
it, not confirmed). A DevTools capture of the real client using ANY
fishing oil (Mid Focus, Mid Relaxing, or otherwise) — same method as
`reward_one`/`path_two`/`loot` were each originally confirmed — would
unblock wiring the recommendation into a real action. See QUESTIONS.md.

Also unvalidated against live/corpus data, stated plainly per SPEC-
fishing.md §8's own honesty discipline: heuristic (d)'s prune has never
been audited against `data/fish-patterns.jsonl` for a real 1-cell-move-
then-reversal counterexample; heuristic (e) is only implemented in its
narrow geometric form (fewer candidate cells from an edge), not the
fuller probabilistic claim (which specific cell the fish favors from
there); heuristic (a)'s centering bias has not been checked against catch
rate. None of these are gated — they are cheap, defensible defaults
implemented because the brief asked for them, not because they have been
proven to help yet.

---

### 9 — Live fishing, supervised

One Dendren cast dry-run, then one real cast, then five.

**Gate:** Five casts, no guard trips, fish logged with rarity, transitions
appended to `data/fish-patterns.jsonl`.

**Outcome: GATE MET across two sessions, with an honest addendum.** Session
13 delivered "five casts, no guard trips, transitions appended" (25
transitions, 5/5 casts, 0 catches — every cast escaped, so "fish logged with
rarity" was literally not yet possible). **Session 15 delivered the missing
piece**: this project's first-ever live catch (cast `12925773`, "Zombo,"
`rarity: 2`, item 521) — see SPEC-fishing.md §4 for the full terminal-shape
capture. `data/fish-patterns.jsonl` grew to 39 transitions across 9 casts.

**But session 15's own run DID trip a guard**, immediately after the catch —
the account got stuck ("Player is already in a game," QUESTIONS.md §10),
and `scripts/liveFishing.ts`'s cast 5/15 threw `GuardTrip` cleanly (CLAUDE.md
§5's fail-closed behavior working as designed, not a bug). Not retried in a
loop — blocked further live fishing for the rest of the session. Reading the
gate literally across both sessions: MET. Reading it strictly within one
session: session 13 alone met the numeric/no-trip parts without a catch;
session 15 alone got a catch but also a trip. The honest summary is that the
gate's four conditions were never all simultaneously true within one
session, but every condition has now been demonstrated at least once.

**[2026-08-16, session 17] The guard-trip's root cause is now CLOSED.**
QUESTIONS.md §10's catch-resolution action is confirmed: `loot`, user-
captured via DevTools, `data.cards: [<real card id from cardsToAdd>]`.
`scripts/liveFishing.ts`'s `runOneCast` now sends it automatically the
moment a catch needs resolving, so the bot's own future catches should no
longer strand the account — untested end-to-end by the bot itself yet
(account energy was too low, 2/420, to run a live cast this session after
the fix landed). See SPEC-fishing.md's request-envelope section and
DECISIONS.md 2026-08-16 (session 17).

---

### 10 — Orchestrator

Budget-aware loop per SPEC §6, energy-regen sleeps, daily caps, guards
centralised in `guards.ts`, graceful SIGINT (finish the current action, never
abandon a run mid-turn).

**Gate [REVISED 2026-08-17, session 24]:** ~~Eight-hour unattended session~~ —
retired. The eight-hour figure predates both the ROM energy discovery and the
confirmed real per-day counts (12 dungeon runs, 20 fishing casts). It reads as
though energy-regen was assumed to be the slow, scarce resource requiring
hours to exhaust and recover; it is not the binding constraint. The real limit
is the game's own per-day counts: at this project's pacing (1200ms + jitter,
a handful of actions per run/cast), spending the full day's allowance is
plausibly well under an hour. Once those caps are hit, the only remaining
thing to verify is that the orchestrator recognizes it and idles cleanly
rather than erroring or busy-retrying — the next real milestone after that
(surviving to tomorrow's reset and resuming) is roughly 24 hours out, which
even the original 8-hour figure was never going to reach.

**New gate: a 2-hour unattended ceiling** (not a target to fill — if the real
caps are exhausted sooner, clean idle + early exit is a PASS, not a
shortfall). Zero unhandled exceptions. Correct recognition of hitting the
daily dungeon (12) and fishing (20) caps, with clean idle after. Daily rollup
generated. Energy spend within budget. Report the actual wall-clock time to
exhaust both caps — this project has been guessing at that number for four
sessions and should have a real one now.

**Outcome [2026-08-17, session 19]: PARTIALLY MET — built, unit-tested, and
live-smoke-tested; the eight-hour unattended half is NOT attempted, stated
explicitly per CLAUDE.md §6 rather than left ambiguous.**

Built this session: `src/orchestrator/scheduler.ts` (pure `nextAction()` —
decides dungeon vs. fishing vs. energy-regen sleep vs. "done for today" from
real energy + each mode's own daily budget, balancing the two loops by
relative headroom rather than always favoring one), `src/orchestrator/
shutdown.ts` (graceful SIGINT — a shared `ShutdownSignal` flag checked once
per turn inside `runOnce`/`runOneCast`, right after confirming the run/cast
isn't already over and BEFORE the next action is sent, so an in-flight
action always finishes and only the *next* one is skipped; a second SIGINT
force-exits), `guards.ts`'s new `isBudgetGuardTrip()` (a narrow allowlist so
one mode hitting its daily cap doesn't take the other mode's loop down with
it — CLAUDE.md §5's "unexpected state" fail-closed is preserved for genuine
anomalies; a designed, expected budget stop is not one), and
`scripts/orchestrator.ts` (the entrypoint composing all of the above around
the SAME `runOnce`/`runOneCast` Task 6/9 already gated live — no game logic
duplicated).

**Live-verified, not just unit-tested:** `--dry-run` against the real
account correctly read live energy/guard state and picked the right next
action. A real bounded run (`--hours=0.05`) started one genuine dungeon run,
won the room-1 battle, picked a reward, and was SIGINT'd mid-run — it
finished the in-flight reward pick, then stopped cleanly at the room-2 turn
boundary ("run left active at room 2"), recorded the correct real energy
delta (95→75, 20 spent), persisted `data/guard-budget.json` correctly, and
printed a rollup (both modes' budgets + a live final energy read) before
exiting 0 with no unhandled exception. This is the two genuinely new,
risk-bearing mechanisms (scheduler choice + graceful SIGINT) verified live,
not just against fixtures.

**Known simplification, stated in the script's own header:** potion loading
is not wired into the orchestrator yet — dungeon runs through it go
potion-free regardless of `config/bot.json`'s `forbiddenWoods.potions`,
matching the safe "unconfigured" default rather than silently changing
behavior for a user who HAS configured potions. Small, separate follow-up.

**What was NOT attempted, and why:** the gate's actual eight-hour unattended
window. Nothing in an interactive coding session can run unattended for
eight real hours while also being verified within that same session — the
two are mutually exclusive. Per CLAUDE.md §6 (state what a gate needs before
calling it met or silently reinterpreting it): what this needs is exactly
what it says — someone starts `npx tsx scripts/orchestrator.ts --hours=8`
and leaves it running, unattended, separately from any chat session, then
the resulting log/rollup is checked afterward. The live smoke test above is
the strongest evidence available *this session* that the mechanism works;
it is not a substitute for the real duration the gate asks for.

The one real live dungeon run this smoke test produced (fixture corpus +2
new distinct player loadout `38/16`, +1 room-1 boon offer) tripped the exact
class of stale hardcoded corpus-count assertions CLAUDE.md's own new
recap-against-final-commit line (this session's housekeeping item, see
DECISIONS.md) was written to catch — caught and fixed within this same
session rather than left for the next one to discover.

**Outcome [2026-08-17, session 25]: GATE MET.** Retried after session 24's
potions leak was closed (see STATE.md/DECISIONS.md) — the user ran
`caffeinate -i npx tsx scripts/orchestrator.ts --hours=2` unattended, in
their own terminal, and it ran to completion on its own.

- **Zero unhandled exceptions.** Clean exit, full rollup printed, no stack
  trace, no crash.
- **Zero potions used**, confirmed by the run's own output (no potion log
  line ever appears — `config/bot.json` still has no `forbiddenWoods.potions`
  block, and both `orchestrator.ts`'s `resolvePotionLoadout()` and
  `liveRun.ts`'s loadout path fail safe to 0 potions when it's absent).
- **Both real daily caps hit and recognized cleanly**: dungeon 12/12 runs
  (216/240 energy), fishing 20/20 casts (239/240 energy) — `"done for today:
  both modes' daily policy budget/cap exhausted"`, then idle, no busy-retry.
- **Energy spend within budget** on both modes (24 and 1 energy of headroom
  left respectively). Real account energy 139/420 at exit, regen 18/hr.
- **Daily rollup generated** (`liveRun.ts --status` block: per-mode
  runs/casts used and remaining, energy used and remaining, real account
  energy).
- **Real wall-clock time to exhaust both caps: ~45 minutes** (2,723,437ms
  between the first and last `start_run`/cast token) — this project has been
  guessing at this number for four sessions (originally 8h) and now has a
  real one. Of that ~45 minutes, **~27 minutes (1600s) was a single
  energy-regen sleep** (real account energy hit 4/420 partway through, below
  the 12-energy floor needed for even the cheapest fishing cast) — active
  play across all 32 actions took roughly **18 minutes**. The scheduler
  interleaved dungeon and fishing throughout by relative daily-budget
  headroom (`src/orchestrator/scheduler.ts`, session 19), not by draining
  one mode before touching the other — confirmed live, not just unit-tested.
- **Known gap, not a failure**: the scheduler has no way to learn about
  energy gained outside its own tracking (e.g. a manual ROM claim mid-run) —
  it only re-polls real energy when a sleep completes or the process
  restarts, and a single SIGINT during a sleep ends the whole session rather
  than just skipping the wait (`shutdown.ts` sets `requested` on the first
  press, which the outer loop also checks). ROM auto-claiming itself remains
  intentionally unbuilt per the standing instruction in `QUESTIONS.md`
  (session 20) — not a gap introduced this session.
- **Fresh corpus data**: 12 real dungeon runs, 20 real fishing casts,
  including two boons' first-ever pickup pairs (`VulnerableEvade`,
  `AddLifestealMagic` — both modelled `{kind:"latent"}`, zero delta at
  pickup, same shape as `AddBurnSword`; see `src/sim/boons.ts` and
  DECISIONS.md) and six brand-new unmodelled boon type sightings
  (`BurningEvade`, `AddVulnerableSword`, `ArmorDepletedVulnerable`,
  `AddWeakMagic`, `WeakeningCrit`, `AddVulnerableMagic` — offered, not
  picked, left unmodelled per the standing name-inference rule). Two new
  distinct player loadouts (`42/18`, `42/26`, both mid-run `AddMaxArmor`
  pickups from the existing `42/16` starting loadout, not new gear). Full
  `tests/boons.test.ts`/`tests/enemies.test.ts` corpus-total assertions
  updated to match, 404/404 passing, `tsc --noEmit` clean.
- **New open item, logged not fixed**: three fishing casts this session
  returned `data.nextPosition`/`data.nextMovePath` as unknown terminal
  fields — `scripts/liveFishing.ts`'s existing (pre-session) detector caught
  and dumped all three non-fatally to `logs/fishing-unknown-terminal-*.json`,
  tied to `QUESTIONS.md §10`'s open "account-stuck" mechanic. Worth a look
  with these three fresh real dumps, not investigated this session — the
  cast itself resolved normally (`"escaped after N turns"`) each time, so
  this did not block or corrupt anything live.

The eight-hour figure this gate originally asked for is retired per its own
2026-08-17 revision (above) — the real per-day caps bind in under an hour at
this project's pacing, so an eight-hour unattended window was never the
right thing to gate on. Nothing further is owed to Task 10 unless a future
session wants to re-verify after a mechanism change.

**[2026-08-18, session 44] New open item, found not fixed**: this task's
graceful-SIGINT contract (`ShutdownSignal`, `installProcessSigintHandler`)
is wired into `scripts/orchestrator.ts`'s `main()` but NOT into either
direct-CLI entry point's own `main()` (`scripts/liveRun.ts`,
`scripts/liveFishing.ts` — grepped both, confirmed absent from each). Found
live: stopping this session's `npx tsx scripts/liveFishing.ts --casts=20`
invocation via `kill -INT` on the real PID fell through to Node's default
SIGINT behavior (immediate termination) instead of the documented "stop
before the next card, cast left in progress" path, because `deps.
shutdownSignal` was simply `undefined` for that entry point. Turned out
harmless THIS time (the in-flight cast's next action hadn't been sent yet
— confirmed via a follow-up `--dry-run` read showing the account still at
the exact pre-kill turn, no orphaned or double-counted state), but that
was circumstance, not a guarantee the mechanism provides for a direct-CLI
invocation. Both `runOnce()`/`runOneCast()` already accept the same
`shutdownSignal` param either way (only the orchestrator's own `main()`
constructs and installs one) — wiring it into `liveRun.ts`'s and
`liveFishing.ts`'s own `main()` functions the same way is a small, low-risk
fix using an already-proven pattern, not attempted this session (found
while diagnosing something else, and out of this session's actual scope).

---

### 11 — Tuning ← DUNGEON HALF PARKED 2026-08-15, session 13 (see below)

`scripts/mineFishPatterns.ts` promotes recurring cycles from the transition log
into named patterns. Sweep dungeon utility weights (`w₁, w₂, w₃`) in sim against
the accumulated real opponent model.

**Gate:** Report of items-per-energy before vs. after tuning, for both loops.

**Fishing half is UNPARKED and active** — Task 9 (live fishing) now has a real
transition log (`data/fish-patterns.jsonl`, 25 lines from 5 live casts, session
13) to mine once there's enough volume. Not attempted yet; needs more live
casts than one session produced.

**[session 14] `mineFishPatterns.ts` is now the BLOCKER, not a volume
question.** The session-14 brief asked whether `focusMeter` (confirmed live
session 13, 3-point non-regenerating focus-move budget) explains the sim's
92.4%-vs-live-0/6 divergence. Modelling it in `castSim.ts` (new
`FOCUS_METER_MAX`/`defaultStartFocus`) drops the 500-cast catch rate to
69.9–71.6% — real, but still statistically incompatible with 0/6
(P≈0.05%). The dominant cause is separate: the sim's true fish pattern is
always drawn from the same synthetic pool the matcher searches, so it can
always identify it in principle — none of this project's six real casts
(1 human + 5 bot) ever have, because the real pattern isn't in that
library. Forcing the matcher blind (`castSim.ts`'s new `matcherPool: []`
option) drops the rate to ~7–10%, indistinguishable from random and
consistent with live 0/6 (P≈55–65%) — see `scripts/fishFocusMeter.ts` and
SPEC.md §5. Consequence: 25 transitions was never "not quite enough yet,"
it's that NO volume of transitions helps until `mineFishPatterns.ts`
exists to turn them into a real library the matcher can search. This is
now the single most consequential piece of unbuilt fishing code in the
project.

**[2026-08-16, session 15] `mineFishPatterns.ts` is now BUILT** (`scripts/
mineFishPatterns.ts`). Run against the grown log (39 transitions, 9 casts —
25/5 from session 13 plus 14/4 from this session's live casts before the
account got stuck, TASKS.md Task 9): tests every real cast's full
turn-by-turn trajectory against the existing synthetic primitive pool
(`src/sim/fishing/patterns.ts`), promotes only on ≥3 independent exact
matches (a deliberately smaller bar than the project's usual 30-observation
rate floor — see the script's own comment for why exact trajectory matches
are a different kind of evidence). **Result: 0 primitives promoted — the
honest, correct outcome at 9 casts, not a miner bug** — but one real
near-miss: `perimeterWalk(cw)` matches 2 of 9 casts exactly, including the
5-turn cast that produced this session's first-ever catch (edge-following,
turning corners exactly where the ring turns — not a coincidental short
match). One more confirming cast clears the bar. With nothing promoted, the
sim catch rate through `matcherPool` is unchanged from blind (6.6%, N=500) —
reported honestly, per the brief's own anticipation of this possible
outcome. `data/fish-patterns.jsonl` growth is now the clear next lever:
mine again once more casts land.

**[session 18] `perimeterWalk(cw)` promoted** — its 3rd independent
confirming cast landed, clearing the ≥3-match bar. (Not previously rolled up
into this section — see `handoff/log/session-18.md` for the original entry.)

**[2026-08-17, session 21] Sim-only redraw threshold sweep — built and run
for the first time as a dedicated script (`scripts/redrawThresholdSweep.ts`),
per SPEC.md §5's long-standing "tune in the sim, not live" instruction.**
Swept `{-1e6 (never redraw), -5, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5, 8, 12, 20}`
against `castSim.ts` (N=2000, matcher-ev policy, full synthetic pool — same
setup the informal session-13 sweep used). **Result: 0 is confirmed as the
true optimum** — 70.7% ± 2.0%, an interior point of the tested range (curve
rises from 67.6% at "never redraw" to 70.7% at 0, then falls sharply past 1,
down to 0.4% by threshold 8). No config change: `REDRAW_THRESHOLD` was
already 0. This also re-surfaces that the sim's baseline catch rate is
~70% now (not the older 92.4%/19.0% figures cited elsewhere in this file),
consistent with session 14's `focusMeter` modelling correction — those older
numbers predate that fix and should not be read as still current.

Also this session: 6 more real casts spent (raised budget, `config/bot.json`
dendren 200/15 → 240/20, sourced from both `config/discovered.json`'s
probe-era `maxCastsPerDayJuiced: 20` and a fresh user confirmation), 1 new
catch. `mineFishPatterns.ts` re-run against the grown log (90 transitions,
25 casts): still 1 primitive promoted (`perimeterWalk(cw)`, support
unchanged at 3 — no new independent match this batch), plus two new
support-1 near-misses (`bounce(2,0)`, `bounce(-2,0)`) from a single cast,
not yet promotable. Honest null result on new promotions, not a miner bug.

**[2026-08-18, session 44] Ground truth re-established before spending anything
this session (brief §0) — this "still 1 primitive promoted" line above is
now STALE, corrected here rather than silently.** Fresh `mineFishPatterns.ts`
run against the full current corpus (169 transitions, 50 casts — matching
QUESTIONS.md §14's resolved count) confirms **2 primitives promoted**:
`perimeterWalk(cw)` (support=4) and `perimeterWalk(ccw)` (support=3, its 3rd
confirming cast landed sometime around session 28 per DECISIONS.md
2026-08-18 session 29's reference — never rolled up into this file's own
narrative the way `perimeterWalk(cw)`'s session-18 promotion was at line
609 above). `data/minedFishPatterns.json` on disk matched this exactly
(`castCount: 50`), so it was current, not stale/local-only. Confirmed live
that `scripts/liveFishing.ts`'s `runOneCast` actually reads this file
(`loadMinedPatterns()`, default path) to seed the matcher — not a
theoretical wiring. Fresh sim comparison at the SAME N the miner's own
built-in report always uses (500): matcher BLIND 7.0% (35/500) vs. matcher
WITH the current 2-pattern library 22.4% (112/500) — see SPEC.md §5 for
the full writeup and `handoff/STATE.md` (session 44) for this session's
live batch measured against this baseline.

**[2026-08-18, session 44] Live batch: 16 completed casts, 0 caught
(0.0%) — a real, dominant cause found, not noise.** Spent today's fishing
budget (192/240 energy, 16 new `start_run`s + 1 resumed pre-existing cast)
under the freshly-reconfirmed 2-pattern mined library and the full
session-43 heuristic pipeline. All 16 completed casts escaped. All-time
figure moved 14.0%(7/50) → 10.4%(7/67) — down, not up, since today added
16 zero-catch casts to the denominator with no new catches. **This was
NOT bad luck at the sim's own predicted rate** (0/16 has under a 2% chance
if the true rate were 22-24%, the sim's own prediction from earlier this
session) — a real cause was found and confirmed in BOTH live and sim
domains: SPEC-fishing.md §4c (new), `chooseCard`/`bestFocusForCard`
chronically burn the entire 3-point focus budget within the first 2-4
turns of every cast (confirmed at 16/16 live, and 43% of N=300 simulated
casts by a median of turn 2), then play the rest of a cast blind from a
frozen focus point. Diagnosed live by the USER directly, off their own
reading of the account's real mid-cast state (`7/10 mana, 0/3 focus`), not
found by this session's own analysis first — the analysis that followed
(live log turn-by-turn, then a sim instrumentation of the same decision
code) confirmed it in full. Session stopped by explicit user instruction
after the first observed failed catch this batch (cast 16, loop-numbered)
— a genuinely stuck-mid-cast case at turn 3 (docId `12975755`) is left
resumable, not force-completed. See SPEC-fishing.md §4c for the full
root-cause writeup and the proposed fix shape (a focus-reserve
continuation term, same pattern as the dungeon side's `chargeReserveWeight`,
DECISIONS.md 2026-08-18 session 34) — **explicitly scoped as next
session's top priority, not attempted this session** (user chose
document-only over design-and-validate-now when asked directly). This is
the Task 11 revival condition CLAUDE.md §6 requires stated up front: "a
materially different utility form" is now a concrete, evidenced candidate
(pricing focus-budget reserve), not a repeat of the dungeon side's already-
exhausted magnitude sweep.

**[2026-08-18, session 45] The dominant fishing defect was NOT the focus
budget — it was the movement model, and that is now built.** Session 44
scoped a focus-reserve term as this session's top priority. The session-45
brief re-derived the corpus first and found a larger defect above it; this
session verified that finding independently before implementing anything
(`scripts/auditStepClass.ts`, new and re-runnable) and it holds:

- **FACT 1**: the fish walks a Manhattan-`k` ring, `k ∈ {1,2}` fixed per
  cast — **0 counterexamples in 279 clean transitions / 68 casts**, including
  the 20 transitions this session's own live batch added out-of-sample.
- **FACT 2**: within a class the next move is conditioned on the previous one
  in OPPOSITE directions — `k=1` never reverses (0/109), `k=2` reverses 39.2%
  (40/102).
- **FACT 3**: the deck's zone templates are exactly the two rings; focus
  co-located on the fish is 100.0% vs `k=1` and 71.3% vs `k=2`.

Every predictor this project shipped before now was class-blind, so it
assigned probability mass to cells the fish provably could not reach, and
`chooseCard` consumes the whole distribution — the mass distorted both the
card pick and the focus placement. Full writeup: **SPEC-fishing.md §9**.

**§1 GATE MET** (`scripts/fishingRingCV.ts`, leave-one-cast-out, 68 clean
casts / 211 scored transitions, same conventions as `fishingContextualCV.ts`):

```
cell-only (old tier 2)                  top1 19.4%  logLoss 3.912  zeroP 23
cell + prev-displacement (shipped)      top1 42.7%  logLoss 3.536  zeroP 23
ring, class-aware (FACT 1 only)         top1 26.1%  logLoss 1.287  zeroP  0
ring + prev-delta conditional (1+2)     top1 46.4%  logLoss 1.118  zeroP  0
  ...k=1 casts only                     top1 54.1%  logLoss 0.803
  ...k=2 casts only                     top1 38.2%  logLoss 1.455
```

Gate was "beat the cell+prev baseline on BOTH log loss and top-1" — met on
both, by wide margins. NOTE the brief's own claimed baseline (logLoss 2.070)
did not reproduce: measured it is 3.536, because 23 of the held-out cells get
exactly zero probability under that predictor and take this project's standing
`-log(1e-9)` floor. The ring model's own numbers came in slightly BETTER than
the brief projected. Both divergences favour the ring model, so the gate's
direction was never in doubt, but the brief's baseline figure is wrong and
should not be carried forward.

**Also this session, in priority order as delivered:**

- §2: `src/sim/fishing/empiricalFish.ts` replaces the sim's synthetic
  ground-truth fish with a sampler over the real corpus's own statistics.
  Session 44's heuristic-(d) regression verdict is **corrected to NEUTRAL**
  (SPEC-fishing.md §8) — the ~2pp regression was an artifact of
  `patterns.ts`'s `bounceDelta`, which models a fish this game does not have.
- §3: the focus-reserve term IS built and swept (`focusReserveAblation.ts`),
  `DEFAULT_FOCUS_RESERVE_WEIGHT = 3` from a two-seed plateau. **Lift +1.6pp,
  not the ~+5pp projected.** Focus exhaustion 79.5% → 69.5% of casts.
  SPEC-fishing.md §4c.
- §4 (deck composition): **the brief's claim does not reproduce and is NOT a
  live lever as described.** Projected shape-matched decks at 55.5%/79.0% vs
  the real deck's 32.2%; measured, the real deck WINS (33.2% vs 15.2% mid /
  22.0% high). Premise was wrong: cards 7, 79 and 76 — one of each key
  template — are ALREADY in the real deck. Left as a NON-task; anyone reviving
  it needs a new premise, not a rerun.
- §5: 2 live casts (the day's remaining budget), both escaped. New per-turn
  predicted-vs-actual log `data/ringPrediction.jsonl` +
  `scripts/ringPredictionReport.ts`. Live ring-tier top-1 27.8% (5/18, both
  casts `k=2`) against the class-matched offline 38.2% — inside the CI,
  settles nothing at this n, and says so.

**Still open on the fishing side, in the order a next session should take
them:**

1. **A real live batch under the ring model.** This session could only afford
   2 casts. 20-30 casts under `ringModelEnabled: true` would give the per-turn
   accuracy figure enough n to actually confirm or refute transfer, per class.
   That is the only remaining question the corpus cannot answer.
2. **Retire heuristic (d).** It is now a proven no-op for `k=2` (guard tests
   displacement length, not class) and redundant for `k=1` once §9's
   conditional table ships. Removing it is a deliberate change, not a
   side effect — hence not done here.
3. **Graceful SIGINT in `liveRun.ts`/`liveFishing.ts` `main()`** (Task 10) —
   still not wired, still small, still using an already-proven pattern.
4. `data.nextMovePath` — new unknown wire field, QUESTIONS.md §17.

**Dungeon half PROMOTED to the live objective [2026-08-16, session-10 brief §2],
superseding the item-per-energy form above for the dungeon side** — Task 5's
gate served its purpose and is retired to reported-metrics (see Task 5). The
death-room histogram is the diagnostic that decides where retuning effort
should go, and it is now cheap to compute (`scripts/deathRooms.ts`), so it is
part of the gate's own reporting, not a separate task:

> Mean rooms cleared per run, on the scored subset, beating the current
> configuration by a margin exceeding the 95% CI over ≥1000 runs. Report
> alongside: room-1 battle win rate, coverage %, `deepestScorableRoom`, and the
> distribution of death rooms.

**Outcome [2026-08-16, session 10]: GATE NOT MET — retune attempted, sim
validation found no measurable lever, and that null result is itself the
finding.**

`scripts/deathRooms.ts` (new) groups the corpus by `DUNGEON_ID_CID` **across**
capture directories (one bot-driven run often spans several — each `npm run
live` invocation writes its own directory) and counts only attempts that
actually end at player HP 0, excluding pre-session-08 human research captures
that were never played to a death. Of the corpus's 15 distinct dungeon
attempts, **6 are confirmed deaths**: room 2 ×2, room 3 ×2, room 4 ×2, room 1
×0. Deaths are **spread evenly across rooms 2–4**, not clustered at 2–3 — per
the brief's own diagnostic, that reads as **enemy scaling**, not early-room HP
mismanagement, though n=6 is thin.

Retuned `src/strategy/utility.ts`: a win used to score a flat `cfg.winValue`
regardless of remaining HP/armor, so among winning lines the engine was
indifferent between finishing a kill at full HP and finishing it one hit from
death — exactly "optimising each battle as if it were the last one" (brief
§1). Fixed by adding the same continuous HP/armor margin the non-terminal case
already uses on top of `winValue` (death is left flat — a death forfeits
everything, so there is no margin to reward there, unlike a win, which
continues the run). All 236 tests pass; one test rewritten to check the
outcome directly (`isDead(...)`) rather than an exact `.value === winValue`
equality the change necessarily breaks. Also loosened §4c's `Heal` urgency
bonus from a step function (`+60` below 50% HP, `+0` at or above) to continuous
in `(1 - hpFraction)`, since HP does not regenerate between rooms and a heal
at 51% HP scoring identically to one at 100% undervalues it.

**Both changes are correct in isolation and validated harmless (tests green,
`npm run sim`'s own Task 5 report unaffected) — but a weight sweep found
neither has ANY measurable effect on `meanRoomsCleared` or room-1 win rate,
even amplified 10×:**

```
baseline (current DEFAULT)   mean rooms 1.946 ± 0.017   room1 win 86.4% ± 0.5   deepest 3
hp weight x3                 mean rooms 1.967 ± 0.017   room1 win 86.5% ± 0.5   deepest 3
hp weight x10                mean rooms 1.945 ± 0.017   room1 win 86.5% ± 0.5   deepest 3
depthBonus x5 (1.75)         mean rooms 1.955 ± 0.017   room1 win 86.4% ± 0.5   deepest 3
depthBonus x10 (3.5)         mean rooms 1.956 ± 0.017   room1 win 86.4% ± 0.5   deepest 3
hp x3 + depthBonus x5        mean rooms 1.975 ± 0.017   room1 win 86.4% ± 0.5   deepest 3
```
(N=20000 each, seed 1.) Every number sits inside the others' CIs. This is not
"we haven't found the right weights yet" — 10× is not a subtle nudge, and
nothing moved. The room-1 battle win rate (86.4%) is unchanged to one decimal
across every row, meaning the argmax move barely ever flips: this game's 9-cell
RPS payoff structure has large enough ATK/DEF asymmetries that one move
usually dominates in expectation regardless of the HP/armor margin, so there is
little near-tie EV gap left for a margin term to break.

**Reads the same direction as the death-room histogram**: if the binding
constraint were cross-room HP mismanagement, amplifying the weight that prices
HP preservation should have shown *something*. It didn't, and deaths are not
clustered in the early rooms a mispriced HP term would predict. Both point at
single-battle lethality escalating with room depth (enemy 65's Risky-tier
stats at room 3, the observed room-4 mutual-kill tie) as the dominant risk —
which weight-tuning the current utility form cannot address, because it prices
resource preservation, not survival of a specific hard fight. Confirming this
needs either a real opponent-model read at rooms 2–4 (thin today — the 30/1%
observation floors in DECISIONS 2026-08-15/16 apply) or capture past room 4,
neither of which is a tuning task.

Both code changes are kept — they are correct fixes to a real bug and a real
inconsistency, not reverted for producing a null result — but neither is
reported as *the* fix for attrition, because the evidence says attrition
(as a cross-room HP-management problem) is not what's binding. Five more live
runs (Task 6 follow-up) will add real death-room data under the retuned
config; if the live distribution also stays even across rooms 2–4 rather than
shifting later, that is independent confirmation.

**PARKED [2026-08-15, session 13 brief §3].** Three independent live
confirmations now (n=6 → n=9 → n=11 confirmed deaths, sessions 10/11/12),
plus the 10× weight-amplification null result above: the death-room
histogram stays flat at room 1 ×0 / 2 ×3 / 3 ×4 / 4 ×4 every time, and
nothing in the current utility *form* moves it. The evidence is settled and
this lever is exhausted — re-running the same sweep a fourth time would not
be a hard task, it would be a pointless one (CLAUDE.md §6).

**What would revive it** (per CLAUDE.md §6 — a parked task states its own
revival condition, not just its parking reason):

1. **A materially different utility *form*, not magnitude.** The sweep
   tested ×3/×5/×10 amplifications of the SAME terms (`weights.hp`,
   `depthBonus`) and found no daylight — that rules out mistuned magnitude,
   not a wrong shape. A genuinely different term (e.g. one that prices a
   specific opponent's rolled stats, or a lookahead past the current-room
   horizon) is untested and could move the number where amplitude couldn't.
2. **The histogram itself shifting shape** as the corpus grows past n=11 —
   a skew toward early rooms appearing where three independent measurements
   found none would be new evidence, not a repeat of old evidence.
3. **Task 12 Stage B landing** (potion timing — see below): it is now the
   identified lever for attrition instead, per the session-11/12 sizing
   (+4/+8/+20 flat heals against a ~32-36 HP pool). If Stage B's own gate
   moves mean-rooms-cleared, Task 11 stays parked on the strength of that
   result; if Stage B ALSO finds nothing, that would be worth revisiting
   Task 11's parking reasoning specifically, since two independent levers
   both moving nothing would be a stronger claim than either alone.

The room 2-4 opponent-model read (thin at n<30/1%, DECISIONS 2026-08-15/16)
stays parked for the same reason it was before — it improves passively as
production runs accumulate and isn't itself a dedicated task.

---

**[2026-08-19, session 46] The live batch could NOT be run — the gate was
unreachable before the session began, and the reason was misdiagnosed twice.**
The session-46 brief made a 20-30 cast live batch the session's whole point,
naming the completed-but-unresolved doc state (QUESTIONS.md §10) as the one
blocker to clear first. Both halves of that turned out wrong, in a way worth
recording because the wrong diagnosis had already propagated through two
recaps and a brief.

Two hard limits, neither of them the doc state:

1. **The server-side daily cap was already reached.** `start_run` rejected
   HTTP 400 with `"Player has reached max runs for fishing"` — captured
   verbatim only after fixing the bug described below.
2. ~~**Energy.**~~ **CORRECTED — this was not a real limit, and reporting it as
   one was this session's own error.** The account held 15-16 of 420 with an
   18/hour regen, from which I computed "12.5 hours" and declared the gate
   unreachable. But the account's 37 ROMs held **2,603 claimable energy** at
   that moment (read live: 27 ROMs with `energyCollectable > 0`), obtainable in
   one pass via `scripts/claimAllRoms.ts`, with overflow past the 420 cap
   CONFIRMED non-wasting since session 21/22. That is ~10x what the batch
   needed. **After the 11:00 Pacific cap reset, a full 20-cast batch was
   affordable.** It was not run because of this incorrect analysis, not because
   it was impossible. Caught by the user, who had already stated the >1,300
   energy/day ROM figure explicitly before the session began.

**Why it was invisible: a dead guard, found live.** `client.ts` throws
`UnexpectedResponseError` for every non-2xx, and that error's `.message` is
only ever `"Unexpected response from <path>: HTTP <status>"` — the server's
own text lives ONLY in `.body`, which `liveFishing.ts` discarded at all three
fishing action call sites (contrary to CLAUDE.md §5). Consequently
`runOneCast`'s server-cap classifier, which tested `/reached max runs/i`
against `.message`, **had been dead since session 29 wrote it**. Fixed
(`serverErrorDetail()`); it fired correctly for the first time on this
session's capture. Strong inference, flagged as inference: session 45's cast-3
rejection was most likely this same server cap (its batch stood at cast 18-19
of the day, right at the 20-cast juiced cap), recorded instead as the stuck
doc and propagated from there into STATE.md and the brief.

Note the shape: **this is the same defect class as heuristic (d)**, retired
earlier the same session — a guard whose condition names a real fact while
reading a field that fact never appears in. Two instances in one session, one
in strategy code and one in production error handling, neither found by a
reviewer applying a rule. See SPEC-fishing.md §8's closing paragraph.

**Delivered instead, all offline, all committed:**

- **§1b/§1d instrumentation, landed BEFORE any cast** (the brief's explicit
  sequencing, and the one part of §1 that was fully achievable). Every
  `ringPrediction` row now carries the shipped `contextualFallback`
  baseline's numbers scored on the SAME turn against the SAME fish, plus the
  played shot's own predicted hit probability and whether it landed.
  `ringPredictionReport.ts` prints the paired mean ΔLL with a 95% CI,
  per-class top-1 for both predictors, and a Wilson-interval calibration
  curve. **The next session can run the batch and get the full §1 readout
  with no further building** — this is the session's main hand-off.
- **§2 heuristic (d) retired** in full, with its arc preserved in
  SPEC-fishing.md §8.
- **§3 deck thread CLOSED with a reason, not just a verdict.** Per-turn hit
  rate added to the sim; the shape-matched MID deck's hit rate is genuinely
  *lower* than the real deck's (42.2% vs 48.8%, both seeds), which is the
  brief's "geometry claim is wrong" branch. Session 45's refutation stands
  unqualified.
- **§4 SPEC hygiene**: the log-loss smoothing convention (reconciling
  2.070-vs-3.536 exactly) and the in-sample calibration discount, both written
  in as standing rules.
- **FACT 1 re-verified** on the unchanged corpus: 0/279 off-ring, 66/66 casts
  class-consistent.

**What the next session needs**, stated so the gate is meetable rather than
merely restated: **the 11:00 Pacific cap reset passed, and a ROM claim.** That
is the whole list. Energy is not a constraint on this project — claim first
(`npx tsx scripts/claimAllRoms.ts`), then run 20 casts. Read
`GET /offchain/player/energy` AND `GET /roms/player?id=<address>` when planning;
do not infer the budget from `data/guard-budget-fishing.json`, which is this
bot's own policy ledger and knows nothing about the real pool, the ROM bank, or
the server's own counter.

**And the gap that caused this**: nothing in the live-play path knows ROMs
exist. `liveFishing.ts`, `liveRun.ts` and `orchestrator.ts` never read
`GET /roms/player` and never prompt to claim when the pool is below a planned
batch's cost. Folding an energy-floor check plus a ROM-claim prompt into the
live loops is now the highest-value unbuilt item in the project — it is worth
more than further model work, because this constraint has blocked or truncated
live batches in **three consecutive sessions** (44, 45, 46).

**No dungeon work for a fourth consecutive session** — a deliberate
consequence of the fishing model being where the open questions are, not an
oversight. The scheduler energy-tracking gap and the charge-reserve plateau
(sessions 40-42) remain untouched and unblocked.

**[session 47, brief §1f] Both carried items are now RESOLVED — one closed,
one formally parked.** CLAUDE.md §6's discipline applied to the backlog: an
item that has drifted five sessions is either work or it is parked with a
stated unpark condition, and "carried forward" is neither.

**CLOSED — the scheduler energy-tracking gap.** Every `sleep` the scheduler
returns is an energy shortfall, and since session 22 an energy shortfall has
been a *claim*, not a wait — the ROM bank routinely holds thousands (2,603
measured in session 46). Session 25 hit the old behaviour live: the loop
computed a ~1600s sleep at 4/420 energy, the user topped up from ROMs
out-of-band, and the sleeping process had no way to notice. `nextAction` now
reports `targetEnergy` on its sleep decision (staying pure — it reports the
number, it claims nothing), and `scripts/orchestrator.ts` runs
`ensureEnergyFor` against that target before honouring the sleep, re-deciding
if the bank covers it. Fail-SOFT, unlike the pre-batch preflight: if the bank
cannot cover the shortfall then sleeping really is the right action, so the
error is reported and the original sleep is honoured. `--no-rom-claim` opts
out, same flag as the two live scripts.

The other half of session 25's finding — that a *sleeping* process still
cannot be told about an out-of-band top-up — is untouched and now much less
likely to matter, since the loop no longer starts a long sleep it could have
claimed its way out of. Not worth a live channel for that residue.

**PARKED — the charge-reserve plateau.** `chargeReserveWeight` ships at 0.4.
Session 34 established the shape thoroughly: an inverted-U with 0.4/0.5/0.6 a
statistically indistinguishable plateau, each separated above 0.2, 0.3 and
0.8, at N=60000/weight over two seeds. 0.4 is the plateau's low-risk edge.

*What would unpark it, stated so the next reader can tell a hard task from a
finished one:* nothing about the plateau itself — re-sweeping it at higher N
buys a tighter interval around a difference already measured as absent, which
is the definition of work that cannot pay. It unparks only if the utility
function it sits inside CHANGES (a new term added beside it, or the HP/armor
weights re-tuned), because the plateau is a property of the whole utility, not
of this weight alone. Absent that, 0.4 stands and no further sweep is owed.

This differs from the fishing-side focus-reserve sweep re-run this same
session, which was *not* a re-sweep for its own sake: the sim underneath it
had genuinely moved twice (heuristic (d) retired, the zone template
corrected), which is exactly the "utility changed" condition above.

### 12 — Potion timing ← restored 2026-08-15, session 12 (see Task 5's retracted extension)

**Restores the standalone task session 10 §7 originally asked for, superseding
session 11's downgrade to a static pre-run loadout choice.** The session-12
brief carries a direct user confirmation: **potions are CLICKED to use
during a run — they do not auto-proc, and they are not chosen once at
`start_run` and left alone.** The shape is two decisions, not one:

1. **Loadout** — select 3 potions before `start_run` (pre-committed,
   user-confirmed session 11; goes in `consumables: []`, currently always
   sent empty).
2. **Timing** — use them manually mid-run, one click each, almost certainly
   the `use_item` action. This is the optimal-stopping problem session 11
   downgraded away: spend a heal now, or hold it for a worse spot later.
   +4/+8/+20 flat heals against a ~32 HP pool, in runs currently dying at
   rooms 2–4 (Task 11's death-room histogram) — the largest single lever
   identified against attrition, bigger in principle than anything the
   Task 11 weight sweep found.

**Blocker — `use_item` action name: CONFIRMED [2026-08-15, session 13,
live].** Session-13 brief §2's key insight: `consumables` is currently
ALWAYS sent empty, so there is no item in the loadout to consume — sending
`use_item` risked nothing regardless of run state, and the doomed-state
detection this blocker originally asked for was never actually needed.
Probed once, opportunistically, at room 3 with own HP critically low (4/36,
not a literal certain-death state but "already going badly" per the brief's
relaxed criterion — `scripts/liveRun.ts --probe-use-item` fires at ≤34% own
HP): `POST /game/dungeon/action` with `{action: "use_item", dungeonId: 5,
actionToken: <real numeric>, data: {consumables: [], isJuiced: false,
index: 0, itemId: 0}}` (the COMBAT-style envelope, not the reward/path-style
one) returned **HTTP 400, `{"success":false,"message":"Item not found in
index"}`** — a clean, meaningful rejection naming the actual problem (no
item at itemId 0), not a 404/405 wrong-endpoint rejection or a crash. This
confirms: the action name is real, the combat-style envelope is accepted at
the routing/validation level, and `itemId` is (at least part of) how the
target item is specified. Full request/response in
`fixtures/dungeon-runs/run-2026-08-15-20-44-28/state-039.json`.

**Still open — an empty-loadout probe cannot answer these; need Stage B's
first REAL potion:**

- Does using a potion consume the turn, or is it free? This is the entire
  cost side of the decision — a turn cost makes it a tempo-vs-survival
  trade; free makes it pure scarcity allocation.
- Can two potions be used in the same battle?
- ~~Does `consumables: []` take item IDs, slot indices, or objects?~~
  **ANSWERED [2026-08-15, session 14, live]** — raw item IDs, confirmed
  below.
- ~~Are potions consumed on use even if the run then fails?~~ **ANSWERED,
  and more specific than the question anticipated** — see below.

**[2026-08-15, session 14, live] `consumables` field shape: CONFIRMED, plus
a bigger surprise.** `scripts/checkPotions.ts` (new, read-only) found real
inventory: Big Heal Juice (itemId 131) balance 8, Mid Heal Juice (155)
balance 7, Lil Heal Juice (151) balance 0. `scripts/liveRun.ts` gained
`--probe-consumables=<itemId>` (mirrors the existing `--probe-use-item`
pattern; only overrides the ONE `start_run` POST, everything else stays
`consumables: []`) and sent `start_run` with `consumables: [131]` — the
run started normally (`"Dungeon run started"`), and **the raw item ID is
what the field takes**, settling that question. The surprise: **the Big
Heal Juice balance dropped from 8 to 7 immediately, at `start_run` time —
before any combat, and the run never called `use_item` even once** (it
played out normally via the existing combat loop and died at room 2 with
zero heals fired, zero HP anomalies in the log). This means the potion is
consumed at **loadout commitment**, not at point-of-use — the two-decision
model (TASKS.md's own framing above: "Loadout" then separately "Timing")
is confirmed structurally, but "are potions consumed on use even if the
run fails" undersells it: this potion was consumed despite never being
used at all. Full request/response in
`fixtures/dungeon-runs/run-2026-08-15-23-02-36/state-000.json`; the item
balance re-check is `scripts/checkPotions.ts`'s own output, not a fixture.
Per the session-14 brief's explicit instruction, no timing policy or
`use_item`-triggering attempt was made this session — Stage B's
turn-cost/multi-use questions above are still open and need a run that
actually calls `use_item` on a loaded potion.

**[2026-08-16, session 15] Potion economics — read-only, resolves most of
Task 12's "is Stage B even worth building" prerequisite.**

**Crafting recipe, `GET /offchain/static`'s `recipes[]` (CONFIRMED):**
faction-gated, 7 variants per potion (one per faction, using that faction's
own Dust/Shard material) — the account is `FACTION_CID: 4`, self-consistently
confirmed by inventory (below) to be **Archon**:

| potion | inputs | energy | success rate |
|---|---|---|---|
| Mid Heal Juice (155) | 2× Archon Dust (76) + 3× Bolt (4) | 6 | **70%** |
| Big Heal Juice (131) | 1× Archon Shard (83) + 2× Steel Pipe (5) + 2× Bolt (4) | 8 | **70%** |

Crafting is **not guaranteed** — 70% success per attempt, so expected energy
per successful potion is `cost / 0.7` (Mid ≈ 8.6, Big ≈ 11.4), not the
listed cost. `MAX_COMPLETIONS_CID: 0`/`COOLDOWN_CID: 0`/`IS_DAILY_CID: false`
— no per-day crafting cap found on the recipe itself.

**Material availability, `GET /items/balances` (CONFIRMED, this account):**
Bolt 765, Archon Shard 194, Archon Dust 942, Steel Pipe 913. **Materials are
NOT the binding constraint** — at these balances the account could attempt
Big Heal Juice ~194 times (Shard-limited) before running out of inputs, far
beyond any plausible daily craft volume. This settles the "renewable but not
free" framing from the session-15 brief addendum: renewable, and the
"not free" part is energy and the 30% failure chance, not materials.

**Still genuinely open — could not be settled read-only**: whether crafting
energy (`ENERGY_CID` on the recipe) draws from the SAME 240/day pool as
dungeon runs and fishing casts, or a separate pool. No recipe field states
this, and confirming it needs an actual craft attempt with a before/after
energy read — which this session did not do (read-only per the brief). This
is the single number that decides everything below.

**Benefit side, `scripts/potionSweep.ts` (new, reuses `gearSweep.ts`'s
shape)**: models N committed Big Heal Juice as `+20×N` starting HP — an
explicit **upper bound** (perfectly-timed heals, since the sim has no
`use_item` timing model yet), not a live prediction:

```
potions   mean rooms cleared        delta vs 0-potion baseline
0         2.130 ± 0.051             +0.000
1         2.664 ± 0.047             +0.534
2         3.086 ± 0.042             +0.956
3         3.389 ± 0.038             +1.260
```
(N=2000, ev-engine policy, real `PLAYER` baseline.) Diminishing returns per
potion (+0.534, then +0.422, then +0.304 marginal) — expected, since HP
headroom matters less once death risk per battle is already well-covered.

**The break-even, both scenarios, since the energy-pool question is
unresolved:**

- **IF crafting shares the 240/day pool**: one committed potion costs ≈11.4
  energy (expected, Big Heal Juice). That same 11.4 energy spent on MORE
  RUNS instead (11.4/20 ≈ 0.57 of a run) buys ≈0.57 × 2.130 ≈ **1.21 rooms**
  at the 0-potion baseline rate — MORE than the 0.534 rooms one committed
  potion adds, even before accounting for the 30% craft-failure tax already
  folded into the 11.4 figure. **Under this scenario, spending energy on
  more runs beats spending it on potions**, at every N tested (1/2/3) — the
  sim's own diminishing returns make this worse, not better, for higher N.
  This is the upper-bound sim, so a real (imperfectly-timed) potion would be
  worth even less; the conclusion only strengthens under a more honest model.
- **IF crafting draws from a separate pool**: potions are close to free
  (materials abundant, no opportunity cost against runs) and committing all
  3 per run (+1.260 rooms, upper bound) is straightforwardly worth it.

**The recommendation to the user is entirely conditional on this one open
question** — confirm the energy-pool sharing before building Stage B's
timing policy, not after. A single live craft attempt with a before/after
`GET /offchain/player/energy` read would settle it in one action.

**Gate**, two stages — the second is not meetable until the first lands, per
CLAUDE.md §6 (state what has to be captured, don't let the gate outrun it):

- **Stage A (capture): MET [2026-08-15, session 13].** `use_item` sent
  once, response logged cleanly (400, not a crash) — see above. The
  turn-cost/multi-use/consumed-on-loss questions are NOT answered by this
  (an empty loadout has nothing to observe those mechanics with) and stay
  open for Stage B's first real-item attempt or a direct user answer in
  `QUESTIONS.md`.
- **Stage B: MET [2026-08-16, session 16].** Field-shape sub-step was MET
  session 14 (raw item ID, consumed at `start_run`). This session built the
  rest: **sim timing** — `dungeonSim.ts`'s `SimOptions.potions` (threshold-
  triggered heal, superseding the old all-committed-at-room-1 upper bound;
  DECISIONS 2026-08-16) and `scripts/potionTimingSweep.ts` (sweeps
  threshold × loadout size, N=2000; best row 0.5 threshold / 3 potions:
  3.477 ± 0.034 mean rooms cleared vs. 2.130 ± 0.051 baseline, **+1.347**).
  **Live policy** — `src/strategy/potions.ts`'s `shouldUsePotion` (pure,
  the sim's best threshold) wired into `scripts/liveRun.ts` via
  `--potions=N --potion-threshold=X`, sending real Big Heal Juice in
  `consumables` and firing `use_item` mid-combat. **Two live runs**
  answered the remaining open mechanics (turn-cost: NO; multi-use: YES, but
  `index` addresses loadout POSITION not itemId — a real bug the first run
  found and the second run confirmed fixed end-to-end) — see DECISIONS
  2026-08-16 and SPEC.md's `use_item` section for the full capture.
  **Items-per-energy**: both runs spent 20 energy (1 run) and 2 potions
  each; run 1 reached room 4 (vs. the even 0/4/4/6-ish baseline spread),
  run 2 reached room 3 — two data points, not enough to move the death-room
  histogram's shape on their own (now 0/4/5/6 across 15 confirmed deaths,
  TASKS.md Task 11), but real potions firing at the right moments in both.
  **Multi-use question ALSO settles the loadout-of-3 case is now safe to
  ship**: a 3-potion loadout just needs indices 0, 1, 2 in order, which the
  fixed code already does generically (`potionPolicy.used` tracks the next
  index).

Sequencing: neither Stage A (session 13) nor Stage B's field-shape check
(session 14) has displaced Task 9/11 (fishing) as the session's actual
spine — both were low-cost, brief-directed probes riding along on live
dungeon runs already happening for other reasons. Session 16 made potion
timing itself the spine, since the fishing account was stuck all session
(QUESTIONS.md §10, unresolved — needs the user's own DevTools capture).

**Stage C: DONE [2026-08-16, session 17] — Task 12 is CLOSED, no further stages.**
Two findings, one user decision, settling the task:

1. Extended `potionTimingSweep.ts` to {0.5..0.9} × {1,2,3}: 0.5 is a genuine
   interior optimum (curve rises to it, then falls away past it), not a
   boundary artifact of the original {0.2, 0.34, 0.5} search. No config
   change needed — `DEFAULT_POTION_THRESHOLD` was already 0.5.
2. **User directive, mid-session: crafting is permanently manual, only
   in-dungeon use is automated.** This retires the crafting-energy-pool
   question outright (see DECISIONS.md) rather than answering it — before
   the message landed, a fresh `GET /offchain/static` dump had already
   found no craft POST endpoint anywhere in the payload, so the authorized
   craft attempt was blocked on CLAUDE.md §2 regardless.
3. Consequence: potions default ON in `scripts/liveRun.ts` — but gated
   behind an explicit user-set allowlist (`config/bot.json`'s
   `forbiddenWoods.potions`), not free inventory auto-detection, per a
   direct user correction mid-session ("verify... which potions you are
   allowed to take... otherwise you might burn through my supply... without
   my intent"). No `--potions=N` flag needed for normal play; absent that
   config block the loop uses 0 potions, full stop. Current config: itemId
   131 (Big Heal Juice), 2 per run (user's own choice, not the sim's
   theoretical best of 3) — threshold 0.5. See DECISIONS.md 2026-08-16
   (session 17) for the live-verified detail and the superseded first cut.

---

### 13 — `chooseNewCard` deck-composition scoring ← scoped 2026-08-17, session 22; NOT STARTED

**Scoped, not implemented, per the session-22 brief's own instruction ("only
write code after scoping is written down... if scoping reveals this needs
more real catches before a sim comparison would mean anything, say so
plainly and stop there — that's a legitimate outcome").** This is that
outcome: scoping surfaced a real prerequisite gap and a thin validation
floor, in that order, so no code lands this session.

**What `chooseNewCard` optimizes for today, confirmed by reading
`src/strategy/fishing/cardChoice.ts`:** argmax `max(hitEffect, critEffect)
/ manaCost` over the 3 offered cards, in total isolation from the deck
already held. No model of grid coverage, redundancy with cards already in
`fullDeck`, or mana curve — exactly the gap the brief named.

**The prerequisite gap, found by reading `src/sim/fishing/castSim.ts`
before writing anything new:** `simulateCast` does not model "the deck a
real account actually holds" at all. `deck.push(rng.pick(catalog))`
(`castSim.ts` line ~186) builds a fresh RANDOM sample, sized to the full
catalog, on every single simulated cast — it has no concept of a specific
held card list, let alone one that grows over time as `chooseNewCard`
picks. **Any deck-composition comparison needs this fixed first**: `
simulateCast` (or a new sibling function) has to draw hands from an
explicit, passed-in deck (a list of real card ids resolved against the
catalog for their mechanical stats) instead of a fresh random draw each
cast. This is well-scoped, needs no new live capture (the catalog already
exists, `fullDeck` is already a live-readable list of ids), and is the
one piece of this task that COULD be built today without more captures —
but it is infrastructure, not the scoring logic itself, and was not built
this session per the "scope first" instruction taking priority.

**The validation floor, the harder problem:** even with deck-aware
`simulateCast` in hand, any comparison it produces would rest on two
un-stacked layers of unvalidated model:

1. `castSim`'s own fish-pattern model is itself only weakly checked
   against reality — matcher-blind sim catch rate 6.6% vs. matcher+mined
   16.2% (this session's `mineFishPatterns.ts` run, 102 transitions/30
   casts), with the REAL rate still unknown to any useful precision (1
   catch in 30 real casts total across every session to date is 3.3%, a
   single-digit-count estimate with no stated CI). A deck-composition
   heuristic tuned against this sim inherits all of that uncertainty.
2. `chooseNewCard` itself has essentially no live outcome data to check
   against — this session's fishing batch (Task 4) produced exactly one
   live card choice under the CURRENT heuristic (catch on cast `12945...`,
   offers `{16, 34, 33}`, chose `34`; `fullDeck` grew to 15). One data
   point cannot distinguish "the current heuristic chose well" from "it
   chose adequately and got lucky" from "a better heuristic would have
   done the same thing anyway" — the same "30-observation floor" reasoning
   DECISIONS.md already applies everywhere else in this project applies
   here with even less data than usual.

**Consequence — this is genuinely Task 11's dungeon-tuning null result
shape, recognized in advance rather than discovered after building
something:** Task 11's parked dungeon half spent real session time
sweeping utility weights ×3/×5/×10 in a sim before finding no measurable
live-relevant signal. Building a full deck-composition scorer now, against
a fish-pattern model with a ~30-cast real floor and a 1-choice real
validation set for the very heuristic being replaced, risks the identical
outcome: a sim number that moves, with no way to know if it means anything
live. Scoping this BEFORE code, as the brief asked, catches that risk at
its cheapest point.

**Gate, once this is unparked (states what has to be captured, per
CLAUDE.md §6):**

> On real deck data (not a synthetic random sample), a candidate
> `chooseNewCard` replacement beats the current argmax-hit-power/mana
> heuristic on sim catch rate or mean turns-to-catch, non-overlapping 95%
> CI, using the SAME fish-pattern model already in use elsewhere in this
> project (not a bespoke one built to make this task easier to pass).
> Reported alongside, not gated: how many real card choices exist to check
> the sim's ranking against, and whether the sim and live agree on the
> handful that do.

**What would unpark it — corrected 2026-08-18, session 41: condition (1) is
DONE, not pending.** This paragraph originally listed the deck-aware
`simulateCast` prerequisite as still needing to be built; it already was,
session 26 — `src/sim/fishing/castSim.ts`'s `CastOptions.deckIds` (line
~183, header comment `[ADDED session 26, Task 13 infrastructure]`) draws
hands from an explicit passed-in deck when supplied, exactly the
capability this paragraph asked for. The session-27 addendum below already
treated this as existing infrastructure; this paragraph had not been
updated to match and the two contradicted each other. The only remaining
condition is (2): enough real catches that the "1 live choice" validation
floor becomes double digits, so a sim-vs-live comparison has more than one
point to check. Infrastructure without validation data would still just
produce a confident-looking number with the same unearned confidence Task
11 already found and rejected once — this task stays parked on data, not
code.

**First real candidate, sourced not invented — added 2026-08-17, session
27.** The session-27 brief reports the user's own manual-play heuristic for
this exact decision: pick the offered card with the most hit/catch spots
(grid coverage), not raw hit-power/mana. This is a concrete, user-sourced
alternative to `chooseNewCard`'s current argmax-hit-power/mana placeholder
— when this task unparks, it should be the FIRST thing tested against the
deck-aware `simulateCast` infrastructure (session 26), rather than an
invented hypothetical. Scoped only, not built: a grid-coverage scorer would
need `zonesToCells(focus, card.hitZones ∪ card.critZones, gridSize)` sized
against the grid (already available via `geometry.ts`), likely compared per-
mana the same way the current heuristic is, but this is a sketch, not a
spec — write the real version against actual deck data once the task
unparks, not now. Does not change the gate above or either unparking
condition — the data floor is the same regardless of which candidate scores
against it.

---

### 14 — Bot-initiated juiced `start_run`, with per-mode potion equip ← scoped 2026-08-17, session 23; UNBLOCKED 2026-08-18 (out-of-band capture), not yet implemented

**Blocker resolved — captured request shape, see DECISIONS.md 2026-08-18
(out-of-band, user DevTools capture) for the full entry:**
`POST /api/game/dungeon/action`, `{"action":"start_run","actionToken":"",
"dungeonId":5,"data":{"consumables":[131,131,131],"itemId":0,
"expectedAmount":0,"index":3,"isJuiced":true,"gearInstanceIds":[],
"devBoons":[]}}`. `isJuiced: true` is the confirmed juiced flag; there is
still no `tier` field — `index: 3` is the strongest live candidate for how
Tier-3 selection is actually encoded, NOT yet independently confirmed
(response body wasn't captured). **The run this request started is still
live as of this capture** (room 1, full HP/armor) — resuming and
completing it is the gate's own live-verification data (3x reward at first
pick, `dayProgressEntities` moving by exactly 3) and must happen before
"once unblocked" work below is treated as gated-and-closed. See
`handoff/next.md` for the resume-first instruction.

**Why this exists.** Session 23's incident (DECISIONS.md 2026-08-17): `liveRun.ts`
silently resumed a run it hadn't started, and separately the local guard-tracked
run count drifted from the real server count because manually-started runs are
invisible to it. Both are now fixed (`ResumeConfirmationRequired` gate,
`findRealRunsToday()`) — but the underlying reason the user has to start juiced
runs manually at all is still true: **the bot cannot construct a juiced
`start_run` request itself.** This task is that gap, made explicit rather than
worked around again.

**What's confirmed, user-stated [2026-08-17]** (see SPEC.md's Forbidden Woods
section and DECISIONS.md for the full derivation — not repeated here):
a Juiced run costs 60 energy, consumes 3 of the 12 daily run-count units,
requires clearing only 1 room's worth of fights, and pays 3x every room's
reward. The user has also committed to leaving the "dungeon sack" empty going
forward, so potion loading is entirely the bot's responsibility via
`consumables` on `start_run` — already working for ordinary runs.

**What's missing, checked directly per CLAUDE.md §2:** `start_run`'s captured
envelope has never once carried a `tier` field or sent `isJuiced: true`, in
any capture across 23 sessions. There is no confirmed request shape for
"start a Tier-3, juiced Forbidden Woods run." Guessing at this field is
exactly the class of mistake that caused session 23's incident (a different
guess, same failure mode: acting on an assumed request/response shape instead
of a captured one) — this task must not repeat it.

**Blocker:** a live DevTools capture (same method as `reward_one`/`path_two`
in session 08) of the real request body the browser sends when the user
manually starts a juiced Tier-3 run — Network tab, the `POST
/game/dungeon/action` (or possibly a distinct endpoint) with `action:
"start_run"`, captured at the moment the user clicks start with the juiced
toggle and Tier 3 both selected. Paste the full request body (redact the JWT)
into `QUESTIONS.md` or hand it directly to a session.

**Once unblocked, two pieces, in order:**

1. `scripts/liveRun.ts`'s current `buildEnvelope()` (line ~244) is confirmed,
   by direct read against this capture, to be the WRONG shape for a juiced
   `start_run`: it hardcodes `isJuiced: false`, sends only 3 `data` fields
   (`consumables`/`isJuiced`/`index`), and passes `client.getActionToken()` —
   a real number — as `actionToken`. The captured juiced request sends
   `actionToken: ""` (empty string) and the full 7-field `data` shape
   (`consumables`/`isJuiced`/`index`/`itemId`/`expectedAmount`/
   `gearInstanceIds`/`devBoons`) — the same 7 fields `buildPathSelectionEnvelope`
   (line ~271) already sends for reward/path picks — but with the run's REAL
   `dungeonId` (5), not `buildPathSelectionEnvelope`'s hardcoded `0`. That's a
   third, hybrid shape matching neither existing builder exactly. Add a new
   `buildJuicedStartRunEnvelope(dungeonId, index, consumables)` (doc-commented
   with this capture as its evidence, same convention as
   `buildPathSelectionEnvelope`'s comment) and branch the `start_run` call site
   (line 718) to use it only when the caller asked for a juiced start; leave
   the existing `buildEnvelope` call untouched for ordinary (non-juiced) starts
   — that shape has produced working runs across 23 sessions and is not the
   thing to touch. Add a dedicated test pinning the new builder's output
   against this capture's exact JSON, same convention as `reward_one`/
   `path_two`'s tests. Open question this task should resolve, not assume:
   whether the empty-string-actionToken/7-field shape is required specifically
   *because* the run is juiced, or would also be required for an ordinary
   start_run (untestable from this capture alone — there is no juiced/non-juiced
   pair to diff). Treat the captured shape as ground truth for juiced starts
   only until a reason to believe otherwise turns up.
2. A `--juiced` (or similar) CLI flag on `liveRun.ts` that, ONLY when starting
   a genuinely new juiced run, loads potions from `config/bot.json`'s
   allowlist into `consumables` — mirroring the existing `--potions=N`
   mechanism but scoped to juiced starts only, per the user's stated
   rationale (3 potions across 1 juiced run instead of 9 across 3 plain runs).
   Plain (non-juiced) runs keep defaulting to an empty sack per the user's
   own directive — this flag must never load potions into a plain run. Needs
   its own tier/`index` selector too (fail-closed like `--potions=N` — refuse
   rather than default-guess which tier); `index: 3` is this capture's value
   for the tier-3 offering actually chosen, not yet confirmed as "index ==
   tier" in general (see above).

**Gate:** one bot-initiated juiced Tier-3 `start_run`, live-verified — the
response (or a follow-up state read) confirms the run is actually juiced
(3x reward observed at the first reward pick, matching the user's stated
5→15 Dendren Root example or equivalent), and the account's real
`dayProgressEntities` counter for Dungeon#5 moves by exactly 3, not 1.

**Outcome [2026-08-18, session 42]: CODE DONE, GATE NOT MET — the resumed run
(§0) was user-initiated, not bot-initiated; the gate specifically asks for a
bot-initiated juiced `start_run`, which was not attempted this session
(today's real dungeon budget/run-slots were already committed to the resumed
run; a fresh juiced start would spend another 60 energy / 3 run-units the
brief did not authorize).**

Both pieces landed:

1. `buildJuicedStartRunEnvelope(dungeonId, index, consumables)`
   (`scripts/liveRun.ts`) — pinned against the exact captured JSON in a
   dedicated test. Wired into the `start_run` call site via a new
   `deps.juicedStartRun` (only set when the CLI's `--juiced` flag is passed);
   the ordinary `buildEnvelope` path is untouched byte-for-byte for every
   plain start.
2. `--juiced` + `--juiced-index=N` CLI flags, fail-closed exactly like
   `--potions=N` (`--juiced` alone throws rather than defaulting `index` to
   3). Potion auto-loading is now ALSO gated behind `--juiced` — both the
   config-auto-detect branch and the `startConsumables` sent on a genuinely
   new `start_run` — closing the exact gap session 24's incident named
   ("apply ONLY to genuinely-new juiced start_run calls, never plain ones").
   An explicit `--potions=N` still works without `--juiced` (needed for
   `--resume-existing`, exactly what §0 used this session), but no longer
   auto-loads into a plain NEW start.

A real correctness gap was found and fixed while wiring this in, not asked
for by the brief but necessary for the gate to mean anything once attempted:
`GuardState.assertCanStartRun`/`recordRunStarted` hardcoded 1 run-unit per
start — a juiced start_run consumes 3 (SPEC.md's Juiced run-mode section).
Both now take an optional `runUnits` param (default 1, every existing
call site unaffected); `liveRun.ts`'s new-start branch passes 3× energy and
3 run-units when `deps.juicedStartRun` is set. Without this fix, a future
bot-initiated juiced start would have silently under-counted both the daily
energy budget and the session run cap.

**§0's resume DID produce real evidence for this gate's two conditions, even
though it wasn't a bot-initiated start** — see STATE.md for the numbers
(3x reward confirmed via triplicated `gameItemBalanceChanges` entries;
`dayProgressEntities` unchanged during this session, consistent with — not
new proof of — the already-established "+3 at start" finding). The gate
itself still requires the bot to send the juiced `start_run` POST itself;
that has not happened yet.

12/12 new tests pass (3 `guards.test.ts`, 4 `parseArgs` tests, 3 `runOnce`
integration tests, 2 `buildJuicedStartRunEnvelope` unit tests) — see
DECISIONS.md and handoff/log/session-42.md for the full verification.

**Follow-up, same session — `index == tier` is now CONFIRMED, and it's a
different mechanic than assumed.** The user manually started a SECOND juiced
run, this one Tier-2 (silver rings), and captured its real `start_run`
request: `index: 2`. Combined with this session's own `index: 3` (gold
rings, Tier-3) and the pre-existing `config/discovered.json` `entryData`
table (three item-gated entry tiers — 1 free, 2 costs one Silver Ring per
faction, 3 costs one Golden Ring per faction — `dropMultiplier` 1/2/4,
already documented in SPEC.md §3c since session 03 but never connected to
`start_run`'s `index` field before now), the mapping is settled: **`index`
IS `entryData`'s `tier` field**, an axis entirely independent of `isJuiced`.
This user-provided run was also resumed and played live (§0-style) —
died room 6, own HP 0/38. Confirmed a THIRD time: `dayProgressEntities`
moved exactly 3→6 at this second juiced `start_run` (read before and after,
matching session 23's original finding and this session's own first
resume). The item-crediting 3x-duplicate pattern (SPEC.md §3f) held
identically regardless of entry tier (2 vs 3) — base per-room amounts were
byte-for-byte the same progression (5,9,14,19,25) in both runs. **RESOLVED,
user-stated**: `dropMultiplier` and the juiced 3x govern separate reward
channels entirely — `dropMultiplier` affects Hard Core (item 845) only,
the juiced 3x affects Dendren Root (item 846) only, so they were never
going to stack visibly on this channel. See SPEC.md §3c/§3f.

**RESOLVED, user-stated**: this second run's own opening state (zero
picked boons) showed PLAYER's rock (Sword) move substantially stronger
than the first run's capture 90 minutes earlier (ATK 16→26, DEF 0→9) while
scissor's own gear boost from the first capture was gone (back to base
12/8) — confirmed an ordinary armor re-spec between the two manual starts,
not anything tier-linked. See `src/sim/enemies.ts`'s `PLAYER` doc comment.

**Outcome [2026-08-18, session 43]: GATE MET.** The user gave standing
authorization (session-43 brief §0) for a bot-initiated juiced Tier-3
`start_run` matching the exact captured shape (`isJuiced:true, index:3,
consumables:[131,131,131]`), amending CLAUDE.md's "Ask first" list for
exactly that shape. Two such runs were sent, this project's own process
constructing and POSTing `start_run` itself for the first time (not a
resume of a manually-started run):

- **Run 1**: `dayProgressEntities` for Dungeon#5 moved 6→9 (exactly +3).
  First kill's `gameItemBalanceChanges` carried three duplicate `{id:846
  (Dendren Root), amount:5}` entries = 15 total, matching the user's own
  5→15 reference point. Died room 6, HP 0/40.
- **Run 2** (after the user's manual level-up, per brief §1):
  `dayProgressEntities` moved 9→12 (exactly +3, exhausting the daily juiced
  cap). Same 3x-duplicate pattern (5,9,14,19,25 progression, byte-for-byte
  identical to run 1 and to session 42's two resumed runs). Died room 5, HP
  0/40.

Both numbers matched the gate's terms exactly on both runs — no rounding
up needed either time. `dayProgressEntities` for Dungeon#5 is now 12/12 for
today; no further juiced starts are possible until the daily reset.

Opportunistic capture from run 2: `UpgradePaper`'s first-ever pickup pair
(room 4, `moveDelta`, ATK-variant roll — see `src/sim/boons.ts` and
DECISIONS.md), and a real PLAYER stat update (hpMax 38→40, the user's own
level-up, though it turns out to have landed before run 1 rather than
between the two runs as planned — see `src/sim/enemies.ts`'s PLAYER doc).

---

## Blocked on captures that do not exist yet

[session 78 / CODEXAUG22REVIEW] Recorded here rather than left as review prose,
because CLAUDE.md rule 6 draws exactly this line: **a gate that depends on data
that does not exist is "a capture request wearing a gate's clothes"**, and no
amount of working harder can meet it. Both items below are capture requests.
Neither is a modelling task today, and neither should be attempted as one.

### CAPTURE-1 — mechanics for the five rolled stats (H2's blocked half)

**What is missing:** authoritative semantics or exchange-level captures for
`evasion`, `block`, `lck`, `tenacity`, `intuition` — and separately for the
statuses `Weak`, `Vulnerable`, `Burn`, `Regen` and lifesteal.

**Why nothing can be built without them.** `src/sim/combat.ts` reads corrode
and no other mechanic, deliberately: `src/sim/types.ts:31-36` says a non-zero
value in these fields makes the unit *unscorable rather than being quietly
approximated*. The review's proposed fix is probability-weighted proc branches,
which need proc RATES — 1-5% events wanting hundreds of observations each
(SPEC §4e). Building the branch structure and filling it with defaults converts
an honest "unscorable" into a confident wrong number, which is the failure this
repo exists to avoid. **Do not stub it, default it, or hide it behind a flag.**

**What session 78 built instead, and why it matters here:** every live decision
now logs `evSupported` / `unmodelled` / `unmodelledBySide` beside its EV
(§3). So the ordering of this capture list stops being guessed — *which*
mechanics co-occur in the fights the bot actually loses becomes readable
straight out of `logs/`. **Read that before choosing what to capture.**

**[session 100 §B, QUESTIONS.md §57] THE PROC-RATE HALF IS NO LONGER A
CAPTURE PROBLEM. The data is already committed and nobody had read it.**

`data.events[]` on every dungeon action response carries a per-exchange,
per-side boolean for all five rolled stats (`blockProc0`, `evadeProc0`,
`critProc0`, `intuitionProc0`, `tenacityProc0`, and the `*1` enemy variants).
It has populated since 2026-08-14. The corpus holds **1919 exchanges per side**
— against the "hundreds of observations each" this entry said were needed —
with rates of 0.31% to 4.69%, exactly the 1-5% band SPEC §4e predicted.
`scripts/procEvidence.ts` measures it; `tests/procEvidence.test.ts` pins it.

The mapping is verified, not assumed: **no flag has ever fired while its own
stat read zero** (299-1691 zero-stat observations per flag). That also resolves
`lck` as CRIT CHANCE.

`triggeredBoons` — the field session 99 flagged as never firing — is NOT this
channel and never was. It has never been non-empty in 10,616 occurrences. It
gates nothing. Do not spend runs chasing it.

**[session 101 §A] THE CAPTURE PATH IS COMPLETE — the `n` above is not an
undercount.** Session 100 flagged that `data.events` was on only 2093 of 5308
states and could not tell "expected" from "evidence being dropped". The 5308
partition exactly: 2687 `GET` reads (`actionToken == 0`, 0 carry events, no
exceptions), 265 enemyPath offers, 263 path-SELECTION responses reporting a
fresh un-acted enemy, 66 `dungeon_started`, 108 potion `use_item`, and 1919
exchanges. **Every response in which an exchange resolved carries its events —
1919 of 1919.** QUESTIONS.md §58 §1.

**[session 101 §B] EFFECT SIZES: THREE OF THE FIVE ARE NOW EXACT.** Measured
off `OnDamage` rows in the same `data.events[]` — `playerId` names the VICTIM,
`data.source` separates combat from burn — against a null of "damage taken ==
attacker `currentATK`" that is exact on 2211/2285 no-proc exchanges.

```
  block      floor(ATK/2)   partial reduction, never a negate (0 of 76 took 0)
  evasion    0              FULL negate, 26 of 26
  lck        2 x ATK        crit multiplier; session 100 gave the rate
  tenacity   —              NOT damage. Associated with OnHeal, n=6, UNBOUNDED
  intuition  —              NOT damage. Denies a MOVE (`blockedMove`), n=6
```

**The control is what makes these mechanics rather than correlations:** across
3577 matched exchanges holding the same stat non-zero with the flag unfired,
the rule matched **zero** times. Confidence intervals are wide at these
volumes and QUESTIONS.md §58 reports them wide; the separation is the claim.

**What is still missing:**

- **`tenacity` and `intuition` mechanics.** Both are ruled OUT as damage
  mitigation, which is progress, but neither has a positive verdict. Both fire
  ~6-19 times in the whole corpus, so both need volume, not cleverness.
- **`SecondWind`'s TRIGGER condition** — magnitude exact, trigger unknown. Not
  lethality and not a fixed HP threshold (fired at 40/40 vs 10 incoming, held
  at 40/40 vs 14). n=10.
- **`Steadfast`'s mechanic** — no damage effect. Debuff immunity is consistent
  (0 of 11 gained a Weak/Vulnerable while active) but underpowered at n=11;
  the expected count under NO effect is ~0.3.
- **The flat run-scoped heal** — 22 heals no status or proc explains, always 2
  or 4, constant within a run. A boon or enemy trait, not lifesteal.
- **[session 101 §D — DONE, and they were never uncaptured] The statuses.**
  They are on every player object in the corpus, exactly as `data.events[]`
  was. Six exist, not the four listed here: `Burn` 1388, `Weak` 477,
  `Vulnerable` 427, **`SecondWind` 223**, `Regen` 176, **`Steadfast` 65**.
  **`lifesteal` does not exist** — no such status, and no proportional heal
  anywhere in the corpus. It comes OFF this list rather than staying on it.

```
  Burn        tick == AFTER-state amount (apply, then tick)   522/522
  Weak        damage dealt == floor(ATK * 0.75)                 33/33
  Vulnerable  damage taken == floor(ATK * 1.25)                 34/34
  Regen       heals its amount unless the unit died             53/53
              then decays by 1, same exchange                   60/60
  SecondWind  one-shot stored heal of exactly `amount`          10/10
  Steadfast   no damage effect; mechanic UNDETERMINED (n=23)
```

  **`amount` means three different things** — magnitude for `Burn`/`Regen`/
  `SecondWind`, a countdown for `Weak`/`Vulnerable` whose multiplier is fixed —
  and **`amount: 0` is INERT**, verified 59/59, 37/37, 25/25. Zero is the most
  common value on four of the six types, so a PRESENCE check is wrong on the
  majority of occurrences. QUESTIONS.md §59.
- **`crit x block` composes multiplicatively** (2 x 0.5 = 1.0) on the single
  exchange where both fired. Mechanism, one observation — not a measured rule.

**The prohibition above is UNCHANGED. Do not stub, default, or flag-hide these
branches.** Sessions 100 and 101 obtained two inputs — rates, then effect sizes
for three of the five — and obtaining inputs is not authorisation to build. A
branch structure is still an honest "unscorable" converted into a confident
wrong number while `tenacity` and `intuition` have no mechanic at all and the
statuses that account for the ENTIRE residual are unmeasured.

**The specific trap now that three rules are exact and cheap to code:**
`block`, `evasion` and `lck` are the easy three, and wiring only those would
produce a simulator that models the mitigation it happens to know and silently
ignores `tenacity`, `intuition`, `Weak`, `Vulnerable`, `Burn`, `Regen` and
lifesteal — biased, not merely incomplete, because every mechanic left out is
one that moves damage. `src/sim/types.ts:31-36`'s "unscorable rather than
quietly approximated" contract is what forbids that, and it forbids it more
now than it did before these numbers existed.

**Blocks:** any Rule 8 policy claim derived from the simulator; CAPTURE-2.

### CAPTURE-2 — potion timing on a model that covers Rule 8 fights (M2)

**Blocked on CAPTURE-1, and it is the user's call regardless.**

`src/strategy/potions.ts` ships a flat `DEFAULT_POTION_THRESHOLD = 0.5`, swept
correctly — but against the CLEAN simulator, which does not represent the
statuses and proc damage a Rule 8 fight carries. Recent live runs crossed from
above the threshold to as low as 3/40 HP before the next potion check.

The review's fix is `hp <= credibleNextExchangeHpDamage`, which needs exactly
the model CAPTURE-1 is blocked on — so the review's own implementation order
sequences a blocked item behind a blocked item. It is also a **live policy
change to consumable use**, which is CLAUDE.md rule 4 and the user's decision
even once the model exists.

**Do not touch `0.5`.** The review says this too: it "should not be solved by
changing `0.5` blindly." Raising it without a better model wastes a limited
consumable; leaving it spends the potion after the dangerous hit instead of
before it. Neither is fixable by picking a different number.

### CAPTURE-3 — CLOSED 2026-08-22 (session 79). The corpus already held the answer

**Asked:** does the server shuffle, and where does a looted card land in
`fullDeck`? Session 78 raised it after `scripts/deckObjectiveSweep.ts` returned
a null — all 80 appended candidates byte-identical to baseline, the same cards
prepended moving hit rate up to +19.91pp — and diagnosed it as `castSim`'s
`drawHand` walking the roster from index 0.

**Answered, from committed fixtures, with no live play.** Every live fishing
state carries `fullDeck`, `hand`, `nextCardIndex`, `cardInDrawPile` and
`discard`. Taking every state where `nextCardIndex === hand.length` — the
opening hand of a cast:

```
  opening hands examined                        129
  hand === fullDeck[0..2]                         0    ← sequential draw predicts 129
  distinct fullDeck orderings                    38
  states carrying a draw pile                   721
  states with nextCardIndex > fullDeck.length     0    ← the pile never exhausts
```

On the most-played deck `[1,2,3,4,5,6,7,76,77,79]`, 31 opening hands by roster
position:

```
  pos          0    1    2    3    4    5    6    7    8    9
  in opening  13    8    5   16    6   10    7   13    7    6      / 31
  uniform shuffle predicts 9.3 each  →  chi-square 13.47, 9 df, NOT rejected (crit 16.92)
  sequential-from-0 predicts         →  31, 31, 31, 0, 0, 0, 0, 0, 0, 0
```

**The server shuffles.** `fullDeck` is a roster; `nextCardIndex` indexes a
hidden shuffled pile that is never on the wire (`deckCardData` is the card
metadata list and is likewise canonical). Roster tail positions 7/8/9 turn up
13, 7 and 6 times in opening hands — there is no positional decay of any kind.

**What that does to the blocker:** it dissolves it. Where a looted card lands in
the roster cannot matter to which cards are drawn, because the pile is
re-ordered every cast. `castSim` shuffles now (session 79 §1), the sweep re-runs
meaningfully, and `tests/fishing/deckShuffle.test.ts` fails the old model on
this same data.

**Session 78's instruction here — "Do NOT unblock this by adding a shuffle to
`castSim`" — was the right instinct on a wrong premise.** Sequential draw was
not the conservative default; it was an unexamined assumption that the corpus
falsifies at 129/129. The shuffle is the measurement, not the invention.

**CONFIRMED LIVE the same session, on three ordinary casts (2 catches):**

- **A looted card is APPENDED to the roster.** `[74,75,76,78,1,2,3,4,5,6]` ->
  `[74,75,76,78,1,2,3,4,5,6,38]`. This was CAPTURE-3's literal question.
- **And it makes no difference, which is the point.** Card 38 — last position
  in the roster, the position session 78 called unreachable — was drawn on
  turn 6 of the very next cast and was in the OPENING HAND of the one after.
- **The pile EXHAUSTS and the cursor WRAPS**, and the corpus always said so:
  `nextCardIndex` 9 -> 2 on a 10-card deck and 9 -> 1 on an 11-card one, in 7
  of 131 casts. That is exactly `(idx + handSize) % deck.length` — `drawHand`'s
  own arithmetic — so the wraparound is validated in FORM and does fire on real
  decks.

**That last bullet corrects this section's own first draft, written hours
earlier, and the error is CLAUDE.md rule 10 in miniature.** It claimed "the
pile never exhausts" from `nextCardIndex > fullDeck.length` being zero in 721
states. That predicate cannot see the event: the server wraps the cursor rather
than overflowing it, so exhaustion shows up as the cursor going DOWN. Check
what a field can express before believing what it reports.

**What is still NOT measured:**

- **Per-cast vs per-draw shuffle.** Both reproduce the opening-hand statistics
  above. Per-cast is implemented as the simpler hypothesis matching
  `nextCardIndex`'s advance — chosen, not measured, and said so in code.
- **Whether the pile is RE-SHUFFLED at the wrap**, or continues in the order it
  was dealt. Narrower than the old bullet it replaces, and not modelled either
  way.

**The sweep re-run, 2026-08-22, 4000 paired casts per arm, and it is SUSPENDED**
(`OIL-POLICY.md` §0a — this simulator does not reproduce the fishery: sim catch
~70% against a real 27.6%, meter-out 1.0% against 64.2%; on the real 23-card
deck the sim's own baseline catch rate is 0.0%):

```
  baseline (23-card held deck)      catch 0.0%   hit 36.42%   meanTurns 4.39
  best appended arm      card 25    hit 45.82%   (+9.40pp)
  control: mean |append − prepend|  1.93pp       ← the harness's own noise floor
  spread across the 80 arms         9.09pp
  chooseNewCard's pick   card 110   ranks 62/80, 8.80pp behind the argmax (4.6x the floor)
```

**`chooseNewCard` is UNTOUCHED and stays untouched.** Session 78's version of
that last line was doubly suspended — a `castSim` result measured in the
PREPENDED arm, which is not what a loot pick does. One of those two suspensions
is now lifted: the number above is measured in the appended arm, the one a loot
pick produces. The other stands, and it is the one that matters: changing live
card selection on a sim result is CLAUDE.md rule 4. The next thing that could
move this is the §0a profile check, not more simulation.

**Read the control gap before reading the ranking.** Two arms that are the same
deck differ by 1.93pp at 4000 casts, so only 10 of 80 arms clear their own
noise, and rank order below those is meaningless.

---

## Later, if the user wants it

- Multi-account orchestration (permitted by Fair Play Rules; needs per-account
  token isolation — do not share one action-token mutex across accounts).
- Auto-leveling (blocked in `CLAUDE.md`; needs an explicit stat-priority config
  from the user before it can be unblocked).
