# STATE — session 54 — 2026-08-19 (PT) — commit fe24aa8

## Status
Session-54 brief: **items §1, §3, §4, §5 delivered. §2 — the §19 fishing batch —
COULD NOT RUN.**

There was no gate this session; §19 was the only measurement and it is blocked.
**Report it as: §19 unmeasured for a fourth session, blocked on the game's own
daily cast cap, not on anything reprioritisable.**

The brief's premise for §2 ("the cap resets 11:00 PT... it is not blocked now")
assumed this session would begin after the reset. It began ~2 hours after
session 53, **inside the same guard-day session 53 exhausted.** Verified live,
not assumed. Everything else in the brief is done.

Next: §19 still needs a batch. It is schedulable only in a session beginning
after 11:00 PT on a day the caps have not already been spent.

## What works
- **§1 the orchestrator's dungeon arm is CLOSED** (`scripts/orchestrator.ts`).
  `nextAction` is called with `DUNGEON_ARM_DISABLED` (null); the `dungeon`
  branch is a loud fail-closed naming rule 11. Deleted rather than left
  unreachable: `resolvePotionLoadout`, the `startConsumables`/`potionPolicy`
  wiring, `dungeonBudgetSnapshot`, the `runOnce` call, the opponent-model
  bootstrap/save. Verified live: `orchestrator.ts --dry-run` returns a
  fishing-only decision.
- **§1 `config/bot.json`'s `forbiddenWoods.potions` is PERMANENT** —
  `{allowedItemId: 131, maxPerRun: 3}`. `_potionsComment` rewritten from ~1,900
  chars of add/remove history to the safety argument plus the reopening
  condition.
- **§1 `tests/orchestrator/dungeonArmClosed.test.ts`** — 9 tests, source-level
  because the invariant is about which code paths EXIST.
- **§4 `overflowReachable`** derived once in `EnsureEnergyResult` on every
  return path, with a **WARN when it flips true**, plus an `overflow_reachable`
  log event that fires independently of whether a claim happened.
- **§3 the §23 tight energy probe is BUILT and ARMED** (`LiveRunDeps.
  energyProbe`) — two GETs bracketing `start_run`, zero energy, on every real
  run. **Not fired: no run happened.**
- **§5 `scripts/boonCoverage.ts` now RANKS** the 36 unmodelled types by offer
  frequency and shallowest room, and reports the rooms 1–3 subset separately.
- **Fixture redaction: `NOOB_TOKEN_CID` and the two docId shapes carrying the
  same id are redacted**, 2,726 tracked files backfilled, 0 raw occurrences
  left outside three pre-existing handoff documents. `fixtures/README.md`
  states what this does and does not achieve.
- **`src/api/redact.ts`** — the redaction logic was SIX near-identical private
  copies; all seven capture scripts now route through one module.
- Suite **886/886** (was 862), `tsc --noEmit` clean, `git diff --check` clean,
  all at the final commit. No test writes to a real data path.

## What's broken
1. **§19 is UNMEASURED for a fourth session.** Dendren's real daily cast cap is
   spent: `GET /fishing/state`'s `dayDocs` reports `UINT256_CID: 20` for pond 2
   against the 20/day cap confirmed in session 21. The bot's own guard agrees
   (20/20 casts, 240/240 energy). Real energy was 100/420 — **energy was never
   the constraint, the cast cap is**, and no config change reaches it.
2. **§23's −1 energy drift is still unexplained**, 3/3 juiced runs. The probe
   that would split it is armed but has not fired.
3. **Three tracked handoff documents still name the account in plaintext** —
   `handoff/log/session-02.md`, `handoff/log/session-07.md` (which also carries
   the username and a partial address), `handoff/scratch-session-02.md`. Never
   passed through any `redact()`; the redaction effort has always been scoped
   to `fixtures/`. **Left for the user**, recorded in `fixtures/README.md`.
4. **The git HISTORY still holds the noob token** from session 08 onward. The
   backfill rewrote the working tree, not history.
5. Carried, unchanged: Enemy Room 71 (room 9) is captured UNCLEAN and cannot be
   modelled; 36 boon types offered with no `BOON_MODELS` entry.

## Corrections to SPEC.md
- **None this session** — no live response contradicted SPEC.md. The two
  corrections below are to the BRIEF, not the spec.
- **The brief's §4 was STALE: the default claim order was ALREADY descending**,
  and has been since session 52 (`opts.order ?? "descending"` in
  `ensureEnergyFor`, `claimOrderRaw ?? "descending"` in `liveRun.ts`). Sessions
  52 and 53 ran ascending by passing `--claim-order=ascending` explicitly, and
  the brief read those runs as the default. No code change was needed; the
  change is to stop passing the flag. The WARN half was real and is built.
- **The brief's §5 rooms-1–3 question expected a small leverage subset. It is
  30 of 36**, led by TieWeak (11 offers of 135, room 1), AddBurnShield (8,
  room 1), AddLifestealShield (5, room 1), Regen (4, room 1), VulnerableBlock
  (4, room 1). That materially weakens "a boon offered once every forty runs
  costs more than it returns" for the top of the list.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture this session.

## Dead ends
- **Do not redact only `NOOB_TOKEN_CID`.** The first backfill did exactly that
  and the same id remained fully readable in the same 2,725 files as the suffix
  of an `EntityEquipment` docId, plus once more as the account doc's own
  `docId`. Three shape-keyed rules are needed, and rule 2 must replace the
  WHOLE docId — the leading instance id is also stable and account-scoped.
- **Do not write real identifiers into a test as literal data.** The first
  draft of `tests/api/redact.test.ts` used the real token and instance id,
  re-committing the exact identifier the module removes. Caught by the recap's
  secret scan, not by review. The rules are shape-keyed, so synthetic ids
  exercise them identically.
- **Do not phrase the potion invariant as "no `potionPolicy` without
  `juicedStartRun`".** That is FALSE of a legitimate path:
  `liveRun.ts --potions=N --resume-existing` deliberately builds one without
  `--juiced`, because those consumables were committed server-side by whoever
  started the run. The real invariant is about AUTO-DERIVING from the config
  allowlist.
- **Do not "fix" `dungeonBudgetSnapshot`'s `costPerAction` to 60 and keep the
  arm.** Rule 11 needs per-run human approval, which an autonomous loop cannot
  give at any cost figure.
- Standing, unchanged: do not re-run the numeric-token experiment (§21); do not
  gate a de-aliasing change without `--before-raw`; `npx tsx -e` cannot resolve
  this project's relative imports; do not rebuild the expected-coverage focus
  objective (50); do not tune focus spend quantity again (48, 49, 50); replay
  for DIFFERENCES never absolutes (48); never pipe a live run to a truncating
  reader (52).

## Metrics
- **Live dungeon: 0 runs.** Rule 11 requires per-run approval and none was
  given; the caps were exhausted anyway (240/240 energy, 12/12 run-units).
- **Live fishing: 0 casts.** Cap 20/20 for the guard-day `2026-08-19`.
- **Live reads only, zero energy spent this session:** `getMe`, `getEnergy`
  (100→105/420 across the session, regen 18/hr), `getDungeonToday`,
  `getFishingState`, and one `orchestrator.ts --dry-run`.
- **Boon coverage: 17 modelled, 135 captured offers (49 in room 1). Modelled
  but never offered in room 1: 0. Offered but unmodelled: 36, of which 30 are
  first offered in rooms 1–3.**
- **Redaction backfill: 3,239 tracked json/har/jsonl files scanned, 2,726
  rewritten.** Raw token occurrences outside handoff prose: 2,730 → **0**.
- Suite 862 → **886**. Corpus unchanged (dungeon 55 attempts, fishing 89
  traces) — nothing was captured this session.

## Open questions for Claude
1. **§19 needs a session that STARTS after 11:00 PT on an unspent day.** This
   is now a scheduling constraint on the brief, not a research question, and it
   has cost §19 four sessions. State it in the brief rather than letting the
   session discover it at minute five.
2. **Do the three handoff documents naming the account get redacted?** The
   username is plausibly a public game handle, so this is the user's call about
   linkability, same as the fixture question they just answered. Not decided
   unilaterally.
3. **The rooms-1–3 unmodelled subset is 30 of 36, not a handful.** Does
   "opportunistic" still stand for the top five (TieWeak 11, AddBurnShield 8,
   AddLifestealShield 5, Regen 4, VulnerableBlock 4 — all room 1)? Modelling
   any needs a pickup PAIR, which is capture, not code.
4. **Room 9 still needs a Safe capture** to become modellable — leave it, per
   the session-54 brief's own reasoning (rule 8 means you cannot choose it).
5. **§23 stays open until the armed probe fires.** Do not fix the drift before
   the probe says whether the tight pair reads −59 or −60.

## Files changed
```
 6 commits.  Code/docs: 19 files, +790 / −169.
 Fixtures:   2,727 files, +5,511 / −5,451 (the redaction backfill).

     scripts/orchestrator.ts                     | 235  (§1 dungeon arm closed)
     tests/orchestrator/dungeonArmClosed.test.ts | 140  (§1, new)
     src/api/redact.ts                           |  78  (new, extracted from 6 copies)
     tests/api/redact.test.ts                    |  76  (new)
     scripts/liveRun.ts                          |  71  (§3 probe, §4 wiring)
     tests/liveRun.test.ts                       |  66  (§3)
     scripts/boonCoverage.ts                     |  54  (§5 ranking)
     QUESTIONS.md                                |  51  (§19 block, §23 armed)
     src/orchestrator/energyPreflight.ts         |  46  (§4 overflowReachable)
     tests/orchestrator/energyPreflight.test.ts  |  46  (§4)
     tests/boons.test.ts                         |  43  (§5)
     TASKS.md                                    |  20  (Task 4.5, the 5→4 note)
     config/bot.json                             |   6  (§1 potions permanent)
     scripts/{battleWatch,liveFishing,parseHar,probe,probeRomsPlayer,watch}.ts
                                                 |  27  (route through redact.ts)
     fixtures/README.md                          |  new
```
