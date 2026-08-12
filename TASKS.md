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

### 5 — Dungeon strategy

Implement SPEC §4: EV engine, utility function, opponent model with charge
pruning and first-order transition tracking, maximin fallback, loot ranking.
Pure functions only.

**Gate:** In sim, beats a fixed-move baseline (always-Sword) by ≥15% win rate
over 1000 runs. Log the EV table for one full battle and eyeball it — every
chosen move should be justifiable from its numbers. If one isn't, the utility
weights are wrong, not the logs.

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
