# session 100 — 2026-08-26 — §A durability preflight, §B `triggeredBoons` resolved, §C blocked

**Result: GATE PASS.** §A done, §B done, §C blocked on the ledger with the
reason the brief itself anticipated.

Suite 1988/1988 across 109 files. `tsc --noEmit` clean. `git diff --check`
clean. Secret scan 0 hits on all four patterns. `discoveredShipsClean` 8/8.

**Live spend: ZERO.** Three reads total (`/gear/instances` x2, one
`--dry-run`). No casts, no runs, no energy, no oils, no fixtures written.

---

## §C first, because it was settled in the first minute

Per CLAUDE.md rule 12 ("exercise the real gate before reporting a blocker"),
the session opened by running the ledger check rather than reasoning about
elapsed time:

```
$ npx tsx scripts/checkFishingCaps.ts
guard day (11:00 PT rollover): 2026-08-25   [file records: 2026-08-25]
hours until next reset:        3.02
GAME ledger  (dayDocs pond 2):  20 / 20
REPO ledger  (data/guard-budget-fishing.json): 20 casts, 252 energy
ledgers agree at 20 cast(s) spent today.
VERDICT: BLOCKED — cap spent. Next window opens at 11:00 PT (3.02h).
```

Re-checked at 09:12 PT: still 20/20, 1.8h remaining. **§C was not attempted
and not partially attempted.** The 20-cast batch (§55) is still owed and
belongs to the first session that runs after 11:00 PT.

Note for the next session: `tsx` fails under the tool sandbox with
`EPERM ... listen /tmp/claude-501/tsx-501/*.pipe`. Every `npx tsx` invocation
here had to run unsandboxed. That is a harness quirk, not a repo problem.

---

## §A — `DURABILITY_CID` wired into the fishing preflight

### The endpoint, confirmed rather than assumed

CLAUDE.md rule 2 forbids inventing an endpoint. `/gear/instances/{address}`
was confirmed from a recorded browser session, not brute-forced:

```
$ (HAR entries matching /gear/)
GET https://gigaverse.io/api/gear/items            -> 200  223584 bytes
GET https://gigaverse.io/api/gear/instances/<ADDR> -> 200   59973 bytes
```

Response shape, read off that real 200 (148 rows):

```json
{"entities": [{
  "_id": "...", "docId": "GearInstance#109_1752766722",
  "GAME_ITEM_ID_CID": 109, "OWNER_CID": "<ADDR>", "PLAYER_CID": "<ADDR>",
  "RARITY_CID": 1, "DURABILITY_CID": 0,
  "EQUIPPED_TO_SLOT_CID": 2, "EQUIPPED_TO_INDEX_CID": 0,
  "createdAt": "...", "updatedAt": "...", "__v": 0, "REPAIR_COUNT_CID": 0
}]}
```

Only the four fields anything reads are asserted; `.passthrough()` keeps the
rest, per `schemas.ts`'s header rule.

**A related find worth recording:** the same object also rides along on
DUNGEON action responses at `$.data.entity.data.gearInstances[]`. So durability
is reachable from two directions, not one.

**The FISHING state does NOT carry it.** `fishing/state/{address}` has
`GEAR_CID_array` (which ids are equipped) and no durability anywhere, so the
brief's "check before adding a new network call" resolves to: a new call is
genuinely needed for the fishing path.

### The design decision that matters

The rod is found by **matching `GAME_ITEM_ID_CID` against `CURRENT_ROD`**, not
by looking in slot 14. Slot is recorded and never keyed on. This makes the
preflight self-validating rather than merely informative: if the equipped rod
ever stops being the rod `REAL_DECK` describes, that is itself a halt. That is
sessions 89-91's actual failure — simulating a deck the account was not
playing — caught before the batch instead of reconstructed three sessions
later.

Four halt conditions, all fail-closed (CLAUDE.md rule 5):

| condition | why it stops a batch |
|---|---|
| `DURABILITY_CID <= 0` | the Shroom state; server deals `BASE_DECK`, every damage-keyed sim number describes a rod not in play |
| rod not equipped (`EQUIPPED_TO_SLOT_CID === -1`) | a rod in the bag is not a rod in use |
| a *different* rod equipped | the deck-vs-rod mismatch, named |
| zero rows returned | a read that saw nothing is not a healthy rod |

Warn (no stop) at `<= 5`. That number is a display threshold and is documented
as one — it is not derived, because there is nothing to derive it from.

### Deliberately NOT predictive

QUESTIONS.md §52 is explicit that the per-cast decrement rate is unknown, so
nothing computes "N casts remaining". `tests/fishing/rodDurability.test.ts`
pins the *absence* of that claim:

```ts
expect(r.detail).toMatch(/NOT a claim about casts remaining/);
expect(r.detail).not.toMatch(/\d+ casts? (remaining|left)/);
```

### It was run, not just written

```
$ npx tsx scripts/liveFishing.ts --dry-run
▸ liveFishing.ts — dry-run
  · resuming today's fishing budget: 252 energy / 20 casts already spent
  account <USER>
  · nextPosition override: ARMED (no miss on record).
  · rod durability: rod 812 reads DURABILITY_CID 38 (slot 14, GearInstance#812_...).
▸ cast 1/1
✗ Guard tripped: session run cap reached {"attemptedRun":21,"cap":20}
```

The preflight ran, read a real number, and the batch then stopped on the
ledger cap — both gates behaving correctly, zero spend.

### The first bracket

- Golkan at equip, 2026-08-26T02:27:20Z (session 99, hand-read): **40**
- Golkan at this preflight, after session 99's **2 casts**: **38**

**1.0 per cast.** At 1.0/cast a 40-durability rod is a ~40-cast rod, which is
exactly the user's own "~40 casts" estimate.

**This is not promoted to the rate, and the reasons are specific.** It is one
bracket; the "before" half was a hand-read at equip rather than an instrument
reading; and a per-BATCH or per-TURN decrement could coincide with 1.0/cast at
n=2. §52 point 4 keeps "~40 casts" an estimate until it has been cross-checked
against a real observed rod failure. `data/rodDurability.jsonl` now records a
paired before/after reading (with `castsSoFar` and a `dryRun` flag) on every
live batch, so the rate becomes derivable from ordinary play.

---

## §B — `triggeredBoons` resolved, and the real channel found

### 1. The field has never populated

Whole committed corpus, canonical states only:

```
  triggeredBoons occurrences        10616      (= 5308 states x 2 players, exactly)
  triggeredBoons NON-EMPTY              0
```

93 run dirs, both sides, 2026-08-13 through 2026-08-26. Session 99 saw the
same over four runs and correctly could not distinguish "rare" from "never".
Over the full corpus it is **never**.

### 2. It is not a capture-path gap — ruled out separately

The competing explanation had to be eliminated, not assumed away. Five sibling
arrays on the *same* player object populate (counts over all fixture files
including `raw/` mirrors, hence the 21,268 denominator):

```
  activeEffects   10286 / 21268      gearBoons     8346 / 21268
  pickedBoons      9036 / 21268      statusEffects 4900 / 21268
  focusBuffs          54 / 21268  = 0.25%
```

`focusBuffs` settles it: a path that captures a 0.25% sibling is not silently
dropping `triggeredBoons` 21,268 consecutive times.

### 3. The real channel is `data.events[]`

Every dungeon action response carries an event log. Event kinds across the
corpus:

```
  OnUpdateStatus 4196   use_move 3838   OnDamage 3113   OnApplyShield 2078
  OnDeath 341   OnHeal 197   use_item 108   OnDropJuice 70
  dungeon_started 66   intuition_block 6
```

And `use_move` carries per-exchange, per-side proc booleans:

```json
{"type":"use_move","value":"rock","playerId":0,"batch":0,
 "data":{"blockProc0":false,"evadeProc0":false,"critProc0":false,
         "intuitionProc0":false,"tenacityProc0":false}}
```

n = 1919 exchanges per side:

```
  flag              stat        fired /    n      rate    fired when stat==0
  blockProc0        block         90 / 1919     4.69%     0 / 299
  blockProc1        block         22 / 1919     1.15%     0 / 918
  critProc0         lck           24 / 1919     1.25%     0 / 1012
  critProc1         lck           25 / 1919     1.30%     0 / 943
  evadeProc0        evasion        6 / 1919     0.31%     0 / 1691
  evadeProc1        evasion       31 / 1919     1.62%     0 / 928
  intuitionProc0    intuition      6 / 1919     0.31%     0 / 1354
  tenacityProc0     tenacity      17 / 1919     0.89%     0 / 1172
  tenacityProc1     tenacity      19 / 1919     0.99%     0 / 932
```

**The zero-stat column is the whole argument.** No flag has ever fired while
its own stat read zero, across 299-1691 observations each. That is what makes
this a MAPPING rather than a naming coincidence — and it resolves **`lck` as
CRIT CHANCE**, which SPEC §4e listed as unknown semantics.

Proc rate binned by the actor's stat value, for the two best-observed flags:

```
  blockProc0    stat= 0  0/299   0.00%      critProc1   stat=0  0/943  0.00%
                stat= 3  2/96    2.08%                  stat=2 13/437  2.97%
                stat= 5  3/64    4.69%                  stat=3  7/187  3.74%
                stat=10 50/587   8.52%                  stat=4  2/97   2.06%
                stat=17  4/30   13.33%
```

Roughly a percentage point per stat point. **That sentence is an observation,
not a fitted model, and must not be lifted into code.**

Two corroborations, neither engineered:

- `intuitionProc0` fired **6** times; the corpus holds exactly **6**
  `intuition_block` events (`{"blockedMove":"rock"}` etc.), on the same turns.
- There is **no `intuitionProc1` flag at all**, and the enemy's `intuition` is
  0 in all 5308 states. The server does not report a roll the enemy cannot
  make. (Cross-check from the stat sweep: `intuition[1]` non-zero in 0 of 5316.)

### 4. Session 08 predicted this and nobody followed up

`src/api/schemas.ts` has carried `events: z.array(z.unknown())` since
2026-08-14 with this comment:

> *"Untyped for now (`z.unknown()`), but worth watching: a structured event log
> of what an action caused is a much better signal than diffing `run`
> before/after, if later actions populate it for room clears, kills, boon
> picks, etc."*

They populate — from 2026-08-14 onward, including all four of session 99's
runs (`run-2026-08-26-03-*` all carry events). Nothing on the dungeon side ever
read it, while `src/sim/fishing/castTrace.ts` has been reading its own
`data.events[]` the entire time.

**Third instance of the same failure**: session 70 (`/gear/items` vs
`/offchain/static`), session 99 (fishing doc vs `/gear/instances`), and now
(`run.players[]` vs `data.events[]`). A field's absence from the payload a repo
happens to read is not its absence from the API.

### 5. Effect on CAPTURE-1

`TASKS.md` updated. The proc-**rate** half is no longer a capture problem —
CAPTURE-1 asked for "hundreds of observations each" and 1919 exchanges per side
are already committed. What remains:

- **Effect SIZES.** Nothing yet says what `block` DOES when it procs.
- **`Weak`/`Vulnerable`/`Burn`/`Regen`/lifesteal** — untouched; they live in
  `statusEffects`, not the proc booleans. (Observed types: `p1:Burn` 1303,
  `p0:Weak` 296, `p1:Vulnerable` 278, `p0:SecondWind` 223, `p1:Regen` 173,
  `p0:Steadfast` 65, ...)
- The **"do not stub, default, or flag-hide"** prohibition stands unchanged.

---

## Surprises, in the order they arrived

1. **`data.events` was sitting in the schema the whole time**, with a comment
   predicting its exact value. The finding cost one grep of object keys.
2. **`DURABILITY_CID` is on dungeon responses too**, at
   `$.data.entity.data.gearInstances[]` — reachable from two directions.
3. **The HAR is gitignored** (`fixtures/**/*.har`), so the durability test
   transcribes rows inline rather than reading it; a test that read it would
   pass on this machine and fail everywhere else.
4. **`tests/noHardcodedPaths.test.ts` ratchet 25 → 26.** Raised rather than
   converted, following the `rodDeck.ts` precedent: `procEvidence.ts` names
   `fixtures/dungeon-runs`, the COMMITTED CORPUS, which is a fact about what
   was recorded and not something a `--profile` run should redirect.
5. **The default vitest worker count over-subscribes this machine and
   generates false failures.** Load ran 13-31 with **49 stray node processes**
   from unrelated sessions. Every failure was a TIMEOUT in a heavy sim test,
   never an assertion — `deckShuffle` was observed at **16.3s** against the 10s
   `testTimeout`.

   Decisive control that it is not this session's code: the suite **excluding
   both new test files** — session 99's exact 107 files — failed **4 of 1967**
   under load 20, where session 99 recorded 1967/1967.

   **The fix is `--maxWorkers=4`**, found at the end of the session: the suite
   passes **1988/1988 in 13.3s at load average 31.6**, versus ~25s and
   intermittent failure unbounded. Worth considering as a `vitest.config.ts`
   default — a suite whose green depends on what else the machine is doing is
   a suite nobody can trust, and this one has heavy sim tests sitting close
   enough to the timeout that scheduling noise decides the result.
6. **I wrote a wrong causal explanation into a code comment, twice.** Both
   drafts blamed the full-corpus scan for those timeouts. The first rested on
   runs where I had two vitest processes going at once; the second on runs
   taken at load 17+. Both were withdrawn and the corrected note says the
   bounded scan exists to bound what a test pays as an append-only corpus
   grows, and explicitly warns the next reader not to re-derive a performance
   justification from the file's history. This is CLAUDE.md rule 10's shape —
   an effect attributed to the wrong cause because the measurement environment
   changed underneath — and it very nearly shipped as documentation.
7. **A `--dry-run` creates an empty fixture dir** (`cast-2026-08-26-15-55-36/`
   containing only an empty `raw/`). Pre-existing `FixtureWriter` behaviour,
   untracked by git since it is empty. Cosmetic, not touched.
