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

---

## Later, if the user wants it

- Path B — bot-owned EOA with full sign-in, so the JWT self-renews.
- Multi-account orchestration (permitted by Fair Play Rules; needs per-account
  token isolation — do not share one action-token mutex across accounts).
- Auto-leveling (blocked in `CLAUDE.md`; needs an explicit stat-priority config
  from the user before it can be unblocked).
