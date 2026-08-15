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

---

### 8 — Fishing strategy

Implement SPEC §5: hypothesis-elimination pattern matcher, transition logging
from turn one, EV-per-mana card choice, redraw threshold, lethal check,
Fintuition reveal handling.

**Gate:** Given the recorded cast fixture, the matcher narrows the candidate set
monotonically and predicts correctly once `|H| == 1`. Sim over 500 synthetic
casts beats random card choice on catch rate. Empty-hypothesis-set fallback is
tested.

---

### 9 — Live fishing, supervised

One Dendren cast dry-run, then one real cast, then five.

**Gate:** Five casts, no guard trips, fish logged with rarity, transitions
appended to `data/fish-patterns.jsonl`.

---

### 10 — Orchestrator

Budget-aware loop per SPEC §6, energy-regen sleeps, daily caps, guards
centralised in `guards.ts`, graceful SIGINT (finish the current action, never
abandon a run mid-turn).

**Gate:** Eight-hour unattended session. Zero unhandled exceptions. Daily rollup
generated. Energy spend within budget.

---

### 11 — Tuning

`scripts/mineFishPatterns.ts` promotes recurring cycles from the transition log
into named patterns. Sweep dungeon utility weights (`w₁, w₂, w₃`) in sim against
the accumulated real opponent model.

**Gate:** Report of items-per-energy before vs. after tuning, for both loops.

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

---

## Later, if the user wants it

- Path B — bot-owned EOA with full sign-in, so the JWT self-renews.
- Multi-account orchestration (permitted by Fair Play Rules; needs per-account
  token isolation — do not share one action-token mutex across accounts).
- Auto-leveling (blocked in `CLAUDE.md`; needs an explicit stat-priority config
  from the user before it can be unblocked).
