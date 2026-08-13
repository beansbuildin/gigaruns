# STATE — session 02 — 2026-08-13 — commit a830f31

## Status
Task 3 "Probe & discovery": **GATE PASS**
Next per TASKS.md: Task 4 — Simulator + fixtures. (Task 2, Auth + API client,
was deliberately deferred behind Task 3 — see DECISIONS 2026-08-13. It is still
unbuilt and is the other unblocked task.)
Overall: Forbidden Woods is `dungeonId 5`, 20 energy, 16 rooms; the full combat
model is confirmed and machine-checked against 8 recorded live battle states;
`src/` is still entirely empty.

## What works
- `scripts/probe.ts` — ran live against the API. Resolved Forbidden Woods from
  `GET /game/dungeon/today`, dumped 7 endpoints, wrote `config/discovered.json`.
- `scripts/battleWatch.ts` (new) — GET-only poller. Captured 8 distinct battle
  states across 7 exchanges of a human-played run, snapshotting on change.
- `scripts/verifyCombatModel.ts` (new) — replays every recorded exchange and
  diffs predicted HP/armor against the server's actual values.
  **Verified: 14/14 side-updates matched, exit 0.**
- `npx tsc --noEmit` — clean, exit 0.
- Redaction: raw dumps (address, username) stay in gitignored `**/raw/`;
  committed copies carry `0xUSER` / `<USER>` / `<JWT>` with every
  game-mechanical value intact.
- Secret scan over the whole session diff — 0 hits for address, JWT, username.

## What's broken
- `npx vitest run` — **exit 1, "No test files found."** Zero tests exist. This
  is Task 4's job, but it means nothing in this repo is regression-protected.
- `src/` is still empty. No API client, no strategy, no orchestrator. Nothing
  has ever POSTed to the API; the human played every observed move.
- Loot table completely unobserved. `lootOptions` was `[]` for the whole run and
  `lootPhase` never flipped — the run ended in a death. §4c loot ranking is
  built on zero evidence.
- Charge semantics incomplete — see Corrections. Pruning cannot be built safely.
- `handoff/next.md` carried the raw username. Redacted to `<USER>` in the
  working tree, but it is still present in git history at commit c916be5
  (user-authored, before this session). Removing it there needs a history
  rewrite and force-push — NOT done, ask first.

## Corrections to SPEC.md
All fixed in SPEC.md this session (§3 table, new §3c/§3d, §4, §4a, §4b, §4c).

- **Combat resolution — SPEC had no model at all; now CONFIRMED.** A side that
  **wins or ties** regenerates armor = **its own move's `currentDEF`**, capped
  at `currentMax` (excess wasted), then deals its **full `currentATK`**. A loser
  gains and deals nothing. Regen resolves **before** damage. Damage depletes
  armor first, overflow carries to HP the same exchange. A tie = both sides
  winning. **Every move regenerates, not just Shield.**
- **I first derived a WRONG model that also scored 14/14.** It had only Shield
  granting armor, ties dealing `ATK − opponent DEF`, and a special case for
  Shield ties. The two are algebraically identical while armor is 0 and the cap
  is slack, and every observed win was Sword (DEF 0) or the enemy's Shield — so
  no win with a DEF-bearing non-Shield move ever exercised the deciding branch.
  It is wrong the moment you win with Spell: 0 armor granted instead of 8. The
  correct model came from the user, not from the data. Recorded in SPEC §4 as a
  "do not reintroduce" block.
- **There is no in-combat healing.** HP is restored only by a card offered after
  a won fight. Armor is renewable, HP is not. SPEC §4b previously implied they
  were interchangeable; `w₃=0.3` raised to ~0.8 and effective-HP demoted to a
  baseline to beat rather than the default.
- SPEC §2 `dungeonId` — never seen in any response, but it is a **request**
  field, so GETs can neither confirm nor refute it. Left unverified, not
  "corrected". Settles at Task 6.
- `entity.ID_CID` is the dungeon type and is a **string** `"5"`;
  `dungeonDataEntities[].ID_CID` is the **number** `5`. Coerce at the boundary.
- `DUNGEON_ID_CID` (`24754733`, on both `run` and `entity`) is the **run
  instance id**, not the dungeon id.
- `players[1].id` = `"Enemy Room 63"` embeds `ENEMY_CID` 63, **not** the room.
  Room is `entity.ROOM_NUM_CID`.
- **No floor field exists** anywhere. Only `ROOM_NUM_CID`.
- `entryData` is ordered tier 2, 1, 3 — **array index is not tier**.
- Tier 1 is free (`inputItems: []`); tiers 2/3 consume 7 items each and carry
  `inputsBasedOnFactionDay: true`, so the required list is **not static**.
- Energy is stored scaled (`ENERGY_CID: 332247916021`). Read
  `parsedData.energyValue`. Never the raw CID.
- Armor is the `shield` field, a full pool parallel to `health`, not a minor term.
- Resolved IDs: **forbiddenWoods=5** (energy 20, maxRoom 16, basicBoonMultiplier
  2), **dendren=NOT FOUND** — zero hits for `/dendren|fish|cast|bait|node/i`
  across all 7 endpoints. Fishing is on a genuinely undiscovered surface.
- Move charges: **PRESENT, and the enemy's are fully visible** —
  `currentCharges`/`maxCharges` per move on both `players[]` entries, alongside
  `currentATK`/`currentDEF`. No hidden information in the move layer.
  **But see the caveat under Open questions — charges can go negative.**

## Dead ends
- Deriving combat rules from fixtures alone. The corpus fit two different models
  perfectly and could not separate them. Don't trust a 100% fit until you have
  checked the data actually exercises the branch that distinguishes candidates.
- Searching the 7 confirmed endpoints for fishing. Zero hits. Do not re-probe
  for Dendren without the HAR; the surface is not reachable from these paths.
- First `.gitignore` rule was `fixtures/probe/raw/`, which missed
  `fixtures/dungeon-runs/raw/` and staged 104 address-bearing lines. Caught
  pre-commit. Rule is now `fixtures/**/raw/`. Any new capture script writing to
  a fresh directory needs re-checking.

## Metrics
- Live: 0 runs played by the bot. 0 energy spent. 0 actions POSTed. All
  observation GET-only; a human played the run.
- Observed: 1 human run, 7 exchanges, 8 states, room 1, enemy 63, tier 1,
  ended in death.
- Combat model: 14/14 side-updates predicted exactly.
- Damage taken across the run: 51, of which armor absorbed 27.
- Account: noobId 72946, energy 332/420, regen 18/hr, juiced.

## Open questions for Claude
1. **Can a move at ≤ 0 charges be played?** Blocks SPEC §4a pruning, which is
   the single biggest claimed edge. 13 of 14 charge transitions moved by exactly
   ±1 (−1 on use, +1/turn regen, capped). The exception: the enemy played
   `paper` at `currentCharges: 1` and it landed at **−1**, then regenerated to 0.
   So charges go negative and we never saw a move attempted at ≤ 0. Either
   negative is a lockout (pruning valid) or an accounting artifact (pruning
   unsafe). SPEC now says down-weight, don't zero. Resolves with more observed
   runs — `battleWatch.ts` already logs every transition, no new tooling needed.
2. **Loot table shape — blocks §4c entirely.** Never reached a loot phase.
   `dropItemIds`/`dropRateMultipliers` are `[]` on all three `entryData` tiers,
   so the table is *not* in `/game/dungeon/today`; it must come from
   `lootOptions` during `lootPhase`. Needs one room won with `battleWatch.ts`
   running — a fresh run, 20 energy. Same run also answers Q1 and shows the heal
   card. Should the next session ask the user for this before Task 4, given §4c
   is currently specified against no evidence at all?
3. **Task 4 or Task 2 next?** Both unblocked. Task 4 (sim) can be built purely
   from the 8 committed fixtures plus the verified combat model, with no network
   and no auth. Task 2 (auth + client) is a prerequisite for Task 6 but nothing
   sooner. Recommend Task 4 — the model is fresh and machine-checkable now — but
   the brief should say which.
4. Unmodelled battle fields, all zero/empty in the one observed run:
   `tenacity`, `evasion`, `lck`, `intuition`, `block`, `battleArmorReduction`,
   `activeEffects`, `statusEffects`, `pickedBoons`, `triggeredBoons`,
   `gearBoons`, `focusBuffs`. Worth asking the user what any of these do before
   the sim hardcodes them to zero?

## Files changed
```
 .gitignore                           |    7 +
 QUESTIONS.md                         |   77 ++   (new)
 SPEC.md                              |  189 +++-
 fixtures/dungeon-runs/state-00{0..7}.json | 2357 ++  (new, redacted)
 fixtures/probe/*.json (7 files)      | 2757 ++   (new, redacted)
 handoff/DECISIONS.md                 |    2 +
 handoff/scratch-session-02.md        |  149 ++   (new)
 scripts/battleWatch.ts               |  135 ++   (new)
 scripts/probe.ts                     |  119 ++-
 scripts/verifyCombatModel.ts         |  129 ++   (new)
 23 files changed, 5902 insertions(+), 19 deletions(-)
```
