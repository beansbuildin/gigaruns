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
replaces the old strict Safe-only rule, see DECISIONS 2026-08-15 and CLAUDE.md
§8), and a stranded run at room 2 (HP 2/32) exposed a real ordering bug —
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

**Gate:** Eight-hour unattended session. Zero unhandled exceptions. Daily rollup
generated. Energy spend within budget.

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

## Later, if the user wants it

- Path B — bot-owned EOA with full sign-in, so the JWT self-renews.
- Multi-account orchestration (permitted by Fair Play Rules; needs per-account
  token isolation — do not share one action-token mutex across accounts).
- Auto-leveling (blocked in `CLAUDE.md`; needs an explicit stat-priority config
  from the user before it can be unblocked).
