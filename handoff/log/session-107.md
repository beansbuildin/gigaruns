# Session 107 — 2026-08-29 — fishing on the raised 300/25 budget — GATE PASS

Brief: `handoff/next.md` (session-107), fishing only. **No dungeon work was
authorized and none was done.**

---

## 0. The session opened blocked — expired JWT

First command of the session, `scripts/checkFishingCaps.ts`:

```
TokenExpiredError: Auth rejected (HTTP 401). The JWT is expired or invalid — refresh it.
    at GigaverseClient.get (src/api/client.ts:329:49)
  status: 401, body: '{"error":"Unauthorized"}'
```

Decoded the token's `exp` locally without printing it:

| | |
|---|---|
| `exp` | 2026-08-28T17:56:01Z |
| session start | 2026-08-29T14:18:51Z |
| stale by | ~20.4 h |

It lapsed **~33 minutes after session 106's fourth dungeon run finished**
(last run 17:23Z). `liveFishing.ts --dry-run` failed identically — the auth
preflight runs before the rod and cap preflights, so a stale token blocks
everything, not just writes.

Reported as a block per CLAUDE.md ("Blocking is only acceptable for: a missing
private key/JWT..."), and non-network work (tsc, suite, config verification)
continued meanwhile. The user refreshed the token mid-turn.

**Worth noting for the next brief:** there is no in-repo renewal path. A session
that opens with an expired JWT loses however long it takes the user to notice.

---

## 1. Pre-flight — every axis confirmed live, none carried forward

Per the brief's "confirm before assuming, on every axis".

**Budget, through the repo's own loader** (`loadBotConfig()`), not by reading
the JSON:

```
dendren_dailyEnergyBudget: 300
dendren_maxCastsPerSession: 25
```

**Ledgers** — and the guard day matters here:

```
guard day (11:00 PT rollover): 2026-08-28   [file records: 2026-08-27]
hours until next reset:        3.62
GAME ledger  (dayDocs pond 2):  0 / 20
REPO ledger:                    0 casts, 0 energy
VERDICT: 20 cast(s) available this guard-day.
```

The game day was **fresh**. Note the subtlety: `todayKey()` is 11:00-Pacific
aware (`Intl`, `America/Los_Angeles`, DST-safe), so at 07:23 PT the guard day
was still `2026-08-28`. Session 106's dungeon runs (16:24-17:23 **UTC** =
09:24-10:23 PT on Aug 28) fell in guard-day `2026-08-27`, which is why the
fishing ledger's stale 252/19 record belonged to a day that had already rolled.

**A false alarm I checked and discarded:** `guardPersistence.ts`'s header
comment says the budget is "Keyed by date (UTC calendar day)". That comment is
stale from session 09 — the actual `todayKey()` implementation is Pacific
11:00-aware. Had I trusted the comment I would have reported a bogus 18-hour
day-boundary mismatch as a latent bug. **The code was right and its own header
was wrong.**

**Rod, live:** `rod 812 reads DURABILITY_CID 37 (slot 14,
GearInstance#812_1787690500_766077e9)`.

**Durability history**, which set the expectation for the batch:

| batch | casts | durability | rate |
|---|---|---|---|
| 2026-08-27T04:13 | 20 | 38 -> 18 | 1.00 |
| 2026-08-28T15:11 | 16 | 18 -> 0 **halt** | ~1.1 |
| (repaired to 40) | | | |
| 2026-08-28T15:20 | ~3 | 40 -> 37 | ~1.0 |

At ~1/cast, 37 covered a 20-cast day with margin. No halt risk — correct, as it
turned out.

**Dry-run** flagged a pre-existing completed-but-unresolved terminal doc with
unknown fields `data.nextPosition`, `data.nextMovePath` (dumped to
`logs/fishing-unknown-terminal-2026-08-29-14-25-19.json`). It did not predict a
`start_run` rejection and did not cause one.

---

## 2. The batch — `--casts=25`, stopped by the server at 23

Sized at 25 deliberately: the brief wanted the JEBAITOR gap measured cleanly,
and that requires letting the GAME's own ceiling be the thing that binds rather
than the repo's. It was.

```
▸ cast 23/25
  ▸ energy: 98 -> 98  (observed delta 0; committed 0)

✗ Guard tripped: session run cap reached
  {"source":"server start_run rejection",
   "message":"Unexpected response from /fishing/action: HTTP 400 —
     {\"success\":false,\"message\":\"Player has reached max runs for fishing\",
      \"error\":\"Player has reached max runs for fishing\",
      \"actionToken\":1788013970775}"}
```

**22 played, 0 energy spent on the refused 23rd.** Fail-closed worked: the
rejection was surfaced as a guard trip with the server's own body, not absorbed.

### The JEBAITOR gap

`fishing_ledger_reconciled` fires once per cast. The full sequence, 23 events:

```
idx  gameCasts  repoBefore  adjusted  direction
  0-5    0..5       0..5      False    agreed
  6      5          6         True     LOWERED   <-- JEBAITOR
  7-13   6..12      6..12     False    agreed
 14     12         13         True     LOWERED   <-- JEBAITOR
 15-22  13..20     13..20     False    agreed
```

**Two procs in 22 casts = 9.1%** (95% Wilson [2.5%, 27.8%]), landing on §34's
~9% figure. Final: game 20 / repo 20, agreed.

**22 played is confirmed four independent ways**, which is why I trust it over
the guard counter:

| source | value |
|---|---|
| `cast_over` events | 22 |
| corpus growth | 251 -> 273 (+22) |
| energy committed | 264 = 22 x 12 |
| rod durability | 37 -> 15 (-22) |

### The budget behaved as headroom

**264 / 300 energy used, 36 spare. It refused nothing.** This is precisely what
the brief predicted and what the raise was for: the repo stopped being the
binding constraint, and the game's 20-charge cap took over.

---

## 3. Results

**Catch rate 12 caught / 22 = 54.5%**, 95% Wilson **[34.7%, 73.1%]**.

| population | caught/n | rate | 95% Wilson |
|---|---|---|---|
| this batch | 12/22 | 54.5% | [34.7%, 73.1%] |
| prior corpus (all rods) | 108/251 | 43.0% | [37.1%, 49.2%] |
| prior 100 (recent era) | 59/100 | 59.0% | [49.2%, 68.1%] |
| full corpus incl. batch | 120/273 | 44.0% | [38.2%, 49.9%] |

Two-proportion test, batch vs prior corpus: **z = 1.04, two-sided p = 0.297.**
Indistinguishable — as expected at n=22, and not evidence of anything moving.

Fish caught: Barnaboo x3, Plankton x3, Jelloid x3, Ollie, Kelpkin, Finley.

**Oils.** 8 Mid Relaxing Oil (937) across **4 double-lethal firings, two each**;
stock 32 -> 24. Example (`oil_double_lethal_fired`, turn 1):

```
{"wanted":["relaxing","relaxing"],"fishHp":3,"fishMaxHp":15,
 "relaxingHeld":32,"source":"double-lethal"}
```

The per-cast Relaxing cap of 2 was **REACHED and did not BIND** — the policy
wanted exactly two, never three, on all four firings. Consistent with every
prior session's note.

**Necessity gate: 15 Focus triggers withdrawn by policy.** Logged as
`oil_trigger_policy_withdrawn` (942 absent from `allowedItemIds`), NOT
`oil_trigger_no_stock`. This is session 93's fix still working, and it is
load-bearing: the wrong branch would flag each cast OIL-POLICY-DRY and exclude
it from BOTH outcome arms permanently. The oil shadow saw `["focus"]` on 15
turns and `["relaxing"]` on 1.

**Opening turn (n=22):** aim cells (2,2) x11, (3,3) x4, (3,2) x3, (2,3) x3,
(1,3) x1. Mean pHit 0.482, median 0.492, mean ev 1.20. All 69 decisions: mean
pHit 0.426. Turns per cast: median 3, max 10.

**Redraw:** 69 shadows, 18 suppressed, 4 no-decision. `redrawEnabled` false, so
zero live effect. The in-sample rate recomputed to **3.0%** (was 3.1%).

**`nextPosition` override:** ARMED, 2 validations this batch, **both hits**
(`acted_hit`, predicted [3,3] / [3,4], actual identical). Still no user sign-off.

---

## 4. Rod durability — a new finding

**37 -> 15 = exactly 22 = casts PLAYED, not the 20 CHARGED.**

So **JEBAITOR buys a free ledger slot but NOT free rod wear.** The two paired
readings now on record agree exactly:

| session | casts played | durability | per cast |
|---|---|---|---|
| 105 | 20 | 38 -> 18 | 1.00 |
| 107 | 22 | 37 -> 15 | 1.00 |

**The post-batch reading had to be taken manually.** The batch exited via the
guard trip, which skips the `phase: "after"` write in `liveFishing.ts` (~line
3881) — so `rodDurability.jsonl` has a `before` for this batch and no `after`. I
took it with a follow-up `--dry-run`. **A batch that ends on the server cap —
i.e. the normal, intended ending for a full day — never records its own after
reading.** That is a small instrumentation gap worth closing.

**Actionable:** 15 durability will not cover a 20-cast day. It will halt around
cast 15, exactly as session 105's 18 -> 0 halt did at cast 16. Repair before the
next batch.

---

## 5. The suite — 57 failures, re-derived not bumped

The 22 new casts shifted every corpus-derived constant across 9 files. Growth
was uniform: **+22 casts, +69 plays**.

**Before touching a number I checked the structural claims, because those
breaking would be a finding rather than maintenance.** All held:

| invariant | at n=273 |
|---|---|
| `zoneTemplate` exceptionless resolver | **1058 / 1058** |
| focus-meter reconstruction (`spent + remaining`) | **1034 / 1034** |
| `assertOpeningFocusPinned` | still passes |
| era split `[preOil, oilSupplied, focusDry]` | `[94, 62, 117]` — first two FROZEN |
| mana-slack histogram shape | 8 still the mode; every bucket rose or held |

The era split is the sharpest evidence: the two closed eras did not move by a
single cast, and the open one grew by **exactly 22**. The test files' own
comment trails document this exact situation — *"Only the census moved; the
property this test exists for (`mismatches` empty, `correct === scored`) is
asserted below and did not."*

Method: iterate `vitest --reporter=json`, read `expected`/`received` per
assertion, patch the literal, append `/* [session 107] was X */` per the repo's
existing convention. Vitest reports only the first failure per test, so this
took ~10 rounds to reach a fixpoint. Non-scalar cases (arrays, object
`toMatchObject`, fraction literals like `445 / 605`, and two long `docId` lists)
were handled individually.

### Two mistakes made and corrected in-session

1. **I guessed a constant instead of measuring it.** For
   `[s.all.casts, s.all.plays, s.all.budgetZero]` I wrote 288 for budgetZero by
   inference. **The real value was 284.** Caught by re-running rather than
   trusting the edit; every subsequent value was read from an actual.
2. **I destroyed ~180 lines of comment history.** My first pass rewrote the long
   `docId` array literals in `tests/sim/fishingCorpus.test.ts` (-179) and
   `tests/fishing/oilReachability.test.ts`, collapsing them and deleting the
   interleaved per-session notes. Restored both blocks verbatim from HEAD via
   `git show HEAD:<path>` and **appended** the new ids instead. Verified with
   `git diff | grep -E "^-\s*//"` -> **zero comment-only deletions**. Diffstat
   went from 202+/350- to 194+/163-.

The new ids sort to the end (`13148595` > `13131311`), so appending preserves
the sorted order the assertion requires.

### One source constant moved

`scripts/liveFishing.ts:214` — `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` `"3.1"` ->
`"3.0"`. The live loop PRINTS this figure, and
`redrawShadowAnalysis.test.ts`'s "⚠ the live loop's PRINTED in-sample rate is
this number, not a stale one" exists exactly to force this update.

---

## 6. Verification against the final commit

```
vitest run --maxWorkers=4   ->  111 files, 2092 passed / 2092
tsc --noEmit                ->  clean
git diff --check            ->  clean
discoveredShipsClean        ->  8 / 8
```

Secret scan, all four `/recap` patterns, over the tracked diff AND all
untracked files:

```
TRACKED    0x[a-fA-F0-9]{4,} -> 0   noobId\s*\d -> 0   eyJ -> 0   PRIVATE -> 0
UNTRACKED  0x[a-fA-F0-9]{4,} -> 0   noobId\s*\d -> 0   eyJ -> 0   PRIVATE -> 0
```

Fixture redaction confirmed positively: **111 `0xUSER` markers** across the new
cast dirs, zero real addresses. `.gitignore` still covers `.env`, `*.key`,
`data/`, `logs/`, `profiles/`, `fixtures/**/raw/`, `fixtures/**/*.har`;
`config/discovered.json` remains deliberately NOT ignored.

**3 empty `cast-` dirs** were created today (two `--dry-run`s and the
server-rejected cast 23). Git does not track empty directories, so nothing to
clean — the documented "expected, not pollution" case.

---

## 7. Surprises, for the next brief

1. **The guard counter over-counts.** `guard-budget-fishing.json` ended at
   `runsStarted: 25` against 22 played / 20 charged, so `--status` printed
   "25/25 used -> 0 remaining" and `checkFishingCaps` printed "repo over-counted
   by 5". The reconciler's own trace ends *agreed at 20*. Benign direction (it
   can only under-grant) and it coincided with the server cap here, but the
   number `--status` reports is not the casts played. **Untouched.**
2. **A batch ending on the server cap never records its `after` durability.**
   See §4.
3. **`guardPersistence.ts`'s header comment contradicts its own code** (says UTC
   calendar day; `todayKey()` is 11:00-Pacific). Untouched, but it nearly
   produced a phantom bug report.
4. **Unknown response fields** `data.nextPosition` / `data.nextMovePath` on
   `play_cards`, 6 midcast + 4 terminal dumps. Harmless this session. Given the
   `nextPosition` override is live and unsigned-off, a field by that name
   appearing in responses is worth a look.
