# Session 54 — 2026-08-19 (PT) — rule 11 implementation, redaction, and a fishing batch that could not run

## Headline

Four of the brief's five substantive items delivered. **The fifth — §2, the §19
fishing batch, which the brief itself called "the session's real measurement" —
could not run at all.** Not deprioritised, not deferred: blocked on the game's
own daily cast cap, verified live.

No gate was set this session. §19 was the only measurement on offer, and it did
not happen.

---

## §2 — why the fishing batch could not run (the important part)

The brief's premise: "The cap resets 11:00 PT and the library is finally the
right one... It is not blocked now."

Right about the library. Wrong about the timing, and the error is worth naming
precisely because it is a scheduling property of this repo that will recur.

This session began at **~19:57 PT on 2026-08-19**, roughly two hours after
session 53 ended (its log is stamped 18:53 PT). The guard-day rolls at **11:00
PT**, so both sessions sit inside the *same* guard-day — the one session 53
exhausted. The brief was written from session 53's recap, which said "the 11:00
PT cap reset makes this possible", and that was true of the *next* reset, not of
any session starting before it.

**Verified live, not inferred from the local guard file** (the two can drift —
`liveRun.ts` has a whole DRIFT check for exactly that):

| source | reading |
|---|---|
| `GET /fishing/state` → `dayDocs[pondId 2].UINT256_CID` | **20** |
| real cap (user-confirmed, session 21; `discovered.json.maxCastsPerDayJuiced`) | 20/day |
| `data/guard-budget-fishing.json` | `{date: "2026-08-19", energySpent: 240, runsStarted: 20}` |
| `GET /offchain/player/energy` | **100/420**, regen 18/hr |

So the account had ample *energy* — 100 of a needed 12 per cast. What it did not
have was casts. That distinction matters for the next brief: this is **not** a
policy cap in `config/bot.json` that the user could authorise raising. It is a
server-side daily limit, and no config change reaches it.

One thing noticed while reading `dayDocs`: **pond 1's counter is 0** and pond 1
has its own nodes (0/1/2 at 12/16/20 energy, skillLevel 15). Casts there were
technically available. Not taken — pond 1 is out of CLAUDE.md's scope (Forbidden
Woods + *Dendren*), the entire 89-cast corpus and the mined pattern library are
Dendren, and mixing ponds would contaminate exactly the measurement §19 is
waiting for.

**Recorded in QUESTIONS.md §19** with the scheduling constraint stated for the
next brief.

---

## §1 — rule 11, and the ordering that made it safe

The brief was right that the ordering *is* the work. Two traps, one anticipated
and one not.

### The anticipated trap

`resolvePotionLoadout` gated on `config.potions` alone. Its doc comment claimed
to "mirror `liveRun.ts`'s `main()` allowlist gate exactly" — that gate has
**two** conditions (config block present **and** `--juiced`), because "non-juiced
runs must NEVER use potions" (session 24). And `orchestrator.ts` called `runOnce`
with **no** `juicedStartRun`, so every run it started was a plain 20-energy run.

Make the potions block permanent first, and the next orchestrator invocation
loads 3 Big Heal Juices into a plain run. Session 24 verbatim. So: arm closed
first, config second, test third.

### The trap that was NOT in the brief

`scripts/orchestrator.ts` took **three** guard locks and held them for the life
of the process:

```
acquireGuardLock(DEFAULT_GUARD_STATE_PATH)      // data/guard-budget.json
acquireGuardLock(DEFAULT_OPPONENT_MODEL_PATH)
acquireGuardLock(DEFAULT_PLAY_COUNTS_PATH)
```

`acquireGuardLock` is an exclusive-create lockfile held until process exit, and
**`liveRun.ts` needs all three.** So an 8-hour `orchestrator.ts --hours=8`
session would have *refused every rule-11 dungeon run the user approved during
it* — the exact runs rule 11 exists to enable.

That is a bug introduced *by* closing the arm, not one that existed before: it
only becomes obstruction once the orchestrator stops writing those files. With
the arm closed this process never touches any of the three, so the locks are
dropped and only the fishing lock is kept. Same reasoning retired the
opponent-model bootstrap-and-save, which was a write to a real data path by a
process that would never read the model.

### What shipped

- `nextAction(energy, DUNGEON_ARM_DISABLED, ...)` — null, whose semantics the
  scheduler already documents as "permanently unavailable, never sleep and wait
  for it". Exactly right for rule 11: don't start a run, and don't stall waiting
  for energy you'll never spend.
- The `dungeon` branch is now a fail-closed `throw` naming rule 11 and pointing
  at `liveRun.ts --juiced --juiced-index=3 --runs=1`. Unreachable by
  construction, kept deliberately: if someone reintroduces a dungeon budget at
  the call site, this stops the process rather than quietly starting a run.
- Deleted: `resolvePotionLoadout`, `dungeonBudgetSnapshot` (its `costPerAction`
  was 20 — wrong under rule 11, and explicitly *not* to be "fixed" to 60 while
  keeping the arm), the `runOnce` call, the potion wiring.
- `config/bot.json`'s `forbiddenWoods.potions` is permanent; `_potionsComment`
  went from ~1,900 chars of add/remove history to the safety argument, the
  session-24 incident in one sentence, and the reopening condition.

### The invariant test, and why the brief's phrasing of it is false

The brief asked for: "assert that no code path constructs a `LiveRunDeps` with a
`potionPolicy` and no `juicedStartRun`."

**That invariant does not hold, and should not.** `liveRun.ts --potions=N
--resume-existing` deliberately builds a potion policy without `--juiced` —
those consumables were already committed server-side by whoever started the run,
and refusing them would strand a resume. The gate that matters is narrower:
nothing may **auto-derive** a loadout from the config allowlist without
requiring juiced.

`tests/orchestrator/dungeonArmClosed.test.ts` states it that way (9 tests), and
also pins the failure mode the brief correctly flagged as "the obvious way this
change goes wrong": a null dungeon arm must not make `nextAction` return `done`
while fishing still has budget, and must not sleep waiting for dungeon energy.

Verified live: `orchestrator.ts --dry-run` → `{"kind":"done","reason":"both
modes' daily policy budget/cap exhausted..."}`. That `done` is correct here —
fishing genuinely is exhausted — but the wording now misleads, so the loop's
`done` branch prints which arm actually stopped.

---

## §4 — the brief was stale on half of it

**"Switch the default claim order to descending" was already done.**
`ensureEnergyFor` has `opts.order ?? "descending"` and `liveRun.ts` has
`claimOrderRaw ?? "descending"`, both since session 52. Sessions 52 and 53 ran
ascending by passing `--claim-order=ascending` *explicitly*, and the brief read
those runs as the default. No code change; the change is to stop passing the
flag.

The WARN half was real:

- `overflowReachable` moves from a recomputation at the `liveRun.ts` call site
  into `EnsureEnergyResult`, derived once on **every** return path — including
  the two that claim nothing. It is `null`, never `false`, when the bank was not
  read or the cap is unknown: *"we did not claim" must not silently mean "we did
  not check"*.
- WARN when it flips true, on the same reasoning as session 53's first-attempt
  telemetry: the condition that makes a decision safe should announce when it
  stops holding. `maxSnapshot < headroom` (315 < 394 live, both session-53 runs)
  is precisely what makes descending safe.
- `claim_audit` only fires when something was claimed — most runs claim nothing
  — so a separate `overflow_reachable` log event fires independently.

---

## §3 — the §23 probe, built and armed, not fired

`LiveRunDeps.energyProbe` reads the pool immediately before and immediately
after the `start_run` POST with nothing else in flight, logging
`start_run_energy_probe` with `tightDelta`, `estimatedCost`, `matchesCommitted`.
Two GETs, zero energy, armed on every real run, skipped on `--dry-run`.

Rule 11 removed the plain-20-energy comparison arm QUESTIONS.md §23 originally
wanted. The read still discriminates without one:

- tight **−59** → the CHARGE is 59 and the 3× multiplier is the suspect
  (59 = 20×3 − 1).
- tight **−60** → something *inside* the run credits 1 back (loot, boon, a regen
  tick in the window) — a different investigation.

Placement is load-bearing: the before-read sits *after* the guard and
dungeon-cap checks and immediately before the POST. Earlier, and those requests'
latency lands inside the window and the pair stops being tight.

Not fired — no run happened. Costs nothing to carry.

---

## §5 — the redaction question, and two findings inside it

The user chose **"redact both + document"**.

### What was true before

- 2,725 tracked fixtures carried `NOOB_TOKEN_CID` at its real value.
- 3,225 redacted `PLAYER_CID` to `0xUSER`.
- The real address appeared in **zero** tracked files.
- `ownerOf(tokenId)` is a public call on Abstract, so the token resolves to the
  address the redaction was hiding.

### Finding 1 — the first fix reproduced the same defect one level down

Redacting `NOOB_TOKEN_CID` left the identical id **fully readable in the same
2,725 files** as the suffix of an `EntityEquipment` docId
(`EntityEquipment#<instanceId>-<noobToken>`), and once more as the account doc's
own `docId` in `fixtures/probe/account.json`.

Caught by a test that asserts the **corpus** is redacted (`git ls-files` →
`text !== redactNoobToken(text)`), not merely that the function replaces a
number. That is the only version of that test worth writing, and it failed on
first run listing the offenders.

`redactNoobToken` now has three shape-keyed rules, and rule 2 replaces the
**whole** docId rather than the token suffix — the leading instance id is also
stable and account-scoped, so trimming only the token would have been the same
half-measure a third time. Deliberately untouched: bare numeric `docId`s (the
12.9M-range game document ids) and contract addresses, both corpus content.

### Finding 2 — the rule lived in six copies

`redact()` was six near-identical private functions across `liveRun`,
`liveFishing`, `watch`, `battleWatch`, `probe`, `parseHar`, plus
`probeRomsPlayer`'s own. That is this repo's most recurrent defect shape
(session 51's `serverErrorDetail`, its fourth instance), and a redaction rule is
the worst thing to have six copies of, because five being right is
indistinguishable from six until someone reads the fixtures. Extracted to
`src/api/redact.ts`; all seven route through it.

### Finding 3 — caught by the recap's own secret scan

The first draft of `tests/api/redact.test.ts` used the **real** token id and the
**real** equipment instance id as test data — re-committing, into a tracked
file, the exact identifier the module exists to remove. The scan caught it; no
reviewer did. The rules are shape-keyed, so synthetic ids exercise them
identically.

### What the redaction does NOT achieve — stated in `fixtures/README.md`

1. **The git history still holds the token** from session 08. The backfill
   rewrote the working tree, not history, and history rewriting was weighed and
   declined (force-push over a public repo, invalidates every clone).
2. **Three tracked handoff documents still name the account in plaintext** —
   `handoff/log/session-02.md`, `handoff/log/session-07.md` (also the username
   and a partial address), `handoff/scratch-session-02.md`. The redaction effort
   has always been scoped to `fixtures/`; these were hand-written and never
   passed through any `redact()`. **Left for the user**, recorded rather than
   quietly fixed — the username is plausibly a public game handle, which makes
   it the same linkability call they just answered for fixtures.

Backfill: 3,239 tracked json/har/jsonl scanned, **2,726 rewritten**. Raw token
occurrences outside handoff prose: **2,730 → 0**.

---

## §5 — boon coverage

`scripts/boonCoverage.ts` now ranks the 36 offered-but-unmodelled types by offer
frequency and reports each type's shallowest room, plus the rooms-1–3 subset.

**The brief expected a small leverage subset. It is 30 of 36.**

| type | offers (of 135) | shallowest room |
|---|---|---|
| TieWeak | 11 | 1 |
| AddBurnShield | 8 | 1 |
| AddLifestealShield | 5 | 1 |
| Regen | 4 | 1 |
| VulnerableBlock | 4 | 1 |
| TieVulnerable | 4 | 2 |
| AddLifestealSword | 3 | 1 |
| WeakeningBlock | 3 | 1 |
| WeakeningMastery | 3 | 1 |

That materially weakens "a boon offered once every forty runs costs more than it
returns" for the top of the list — TieWeak alone appears in 8% of all captured
offers, at room 1. **Not acted on**: modelling a boon needs a pickup PAIR, which
is capture rather than code, and choosing to model any is a strategy decision
with its own gate.

Counting fix worth naming: offers are counted once per **offer**, not once per
option, so an offer holding a type twice cannot inflate the ranking it feeds.

`TASKS.md` Task 4.5 now records session 53's `deepestScorableRoom` 5 → 4
explicitly (CLAUDE.md §6) — honest capture lowering a coverage metric, at
exactly the value the retired gate sat at, one capture away from looking like a
regression to a future reader. It says do not tune it back, and names the lever
that actually moves it.

---

## Verification at the final commit

```
npx tsc --noEmit                              clean
npx vitest run                                51 files, 886 passed (was 862)
git diff --check                              clean
npx tsx scripts/orchestrator.ts --dry-run     fishing-only decision, correct `done`
npx tsx scripts/boonCoverage.ts               17 modelled / 36 unmodelled / 30 shallow
secret scan (0x[a-fA-F0-9]{4,}, noobId, eyJ, PRIVATE)   no matches
git grep <NOOB> (excluding 3 pre-existing handoff docs)  0
```

No test writes to a real data path. The two new I/O-touching tests
(`dungeonArmClosed`, `redact`) are **read-only** — source text and `git
ls-files` — and the new `liveRun` probe tests use `makeDeps`'s isolated
`guardStatePath`.

## A note on the secret scan

The token id tried to get back into a tracked file **three times** this session:
once in the fixtures (the original problem), once as literal test data in
`tests/api/redact.test.ts`, and once in the verification block of *this log*.
The first was found by a corpus-level test, the second and third by the recap's
own secret scan. None by reading the diff.

That is the argument for the scan being a step rather than a habit, and for
writing `<NOOB>` in prose even when quoting a command that legitimately printed
the real value.

## Energy spent this session: zero

Every live call was a read: `getMe`, `getEnergy`, `getDungeonToday`,
`getFishingState`, one `orchestrator.ts --dry-run`. No dungeon run (rule 11
needs per-run approval; none given, and the caps were exhausted anyway at
240/240 energy and 12/12 run-units). No fishing cast.
