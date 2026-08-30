# session 111 — 2026-08-30 — Tier-2 entry tier; secret-scan instrument; QUESTIONS §65

Session opened 08:50 PDT, closed 10:16 PDT. **Zero live spend: 0 dungeon runs,
0 rings, 0 energy, 0 fishing casts.**

---

## 0. The brief, and the half of it that could not run

The brief was dungeon-only: move the standing entry tier Tier-1 → Tier-2 by
user directive, document it, then run up to 4 juiced runs one at a time.

It explicitly said *"confirm live, don't assume it's still exhausted"* about the
dungeon ledger. That instruction paid off, in the direction the brief did not
expect:

```
$ npx tsx scripts/checkDungeonToday.ts
dungeonId 5 dayProgressEntities (real runs today): 12
  ...  "ID_CID": "Dungeon#5",  "UINT256_CID": 12,  "TIMESTAMP_CID": 20694
```

The 11:00 Pacific reset had not yet arrived — the session ran 08:50–10:16 PDT,
entirely inside the 2026-08-29 guard day, whose 12 run-units session 109 had
already spent. Exercised the real gate rather than reasoning from the reading
(CLAUDE.md rule 12's lesson):

```
$ npx tsx scripts/liveRun.ts --dry-run --juiced --juiced-index=2 --runs=1
  · real server runs today: 12/12  (matches bot-tracked count)
  · real server cap already reached today — any start_run will be rejected server-side.
  · --juiced: next genuinely new start_run will send isJuiced:true, index 2.
  · potions: config authorizes up to 3x itemId 131 (hard cap 3); 13 in stock -> loading 3.
  ▸ ROM bank: 37 ROMs, 24 with energyCollectable > 0, 3538 energy claimable
✗ Guard tripped: session run cap reached {"attemptedRun":15,"cap":12}
```

Note `index 2` was accepted and echoed by the loop — the flag plumbing is
exercised even though the run was refused.

**The consequence for the gate, stated plainly.** The brief's gate was *"the
real `entryData`/`inputItems` cost for Tier-2, confirmed against the actual
negative `gameItemBalanceChanges` on `start_run`"*. The first half is done; the
second half **requires a run and is UNMET**. It is not a soft pass and the
first live Tier-2 run still owes it.

---

## 1. Tier-2: the cost, measured live before any spend

Read straight off `GET /game/dungeon/today` → `dungeonDataEntities[ID_CID 5]
.entryData`, ordered as returned:

```
[pos 0] tier=2  dropMultiplier=2  "Forbidden Woods Tier 2"  inputsBasedOnFactionDay=true
        inputItems=[134,137,138,135,136,139,140]  inputAmounts=[1,1,1,1,1,1,1]
        startDay=20675  endDay=20731
[pos 1] tier=1  dropMultiplier=1  "Forbidden Woods Tier 1"
        inputItems=[]  inputAmounts=[]
        startDay=20675  endDay=20731
[pos 2] tier=3  dropMultiplier=4  "Forbidden Woods Tier 3"  inputsBasedOnFactionDay=true
        inputItems=[245,244,243,246,248,247,249]  inputAmounts=[1,1,1,1,1,1,1]
        startDay=20675  endDay=20735
```

**The shape, not just the count, is the finding.** Session 106 recorded "seven
ids each" for tiers 2 and 3, having only ever read Tier 3's entry. The count is
right, but `inputAmounts` all-1 across seven DIFFERENT faction ids means a run
costs **one of each of the seven silver rings simultaneously** — so the runway
is the scarcest faction, not the total.

Balances the same minute, via `GET /offchain/player/items/balances`:

| faction | silver id | balance | gold id | balance |
|---|---|---|---|---|
| Chobo | 134 | 33 | 243 | 37 |
| Crusader | 135 | 39 | 244 | 20 |
| Overseer | 136 | 42 | 245 | **19** |
| Athena | 137 | **30** | 246 | 27 |
| Archon | 138 | **30** | 247 | 28 |
| Foxglove | 139 | 57 | 248 | 26 |
| Summoner | 140 | 54 | 249 | 43 |
| **total** | | **285** | | **200** |
| **RUNWAY** | | **30 runs = 7.5 days** | | **19 runs = 4.8 days** |

**285 vs 30 is a 9.5x error** for anyone who sums. Against a Tier-2 offering
window ending day 20731 — today is 20694, so ~37 days — the stock covers about
a fifth of it. That is the same arithmetic that drove the Tier-3 → Tier-1
switch on 2026-08-27, and it is now written into CLAUDE.md rule 11 so nobody
rediscovers it as a surprise blocker.

Also worth noting: `ID_CID` on the balances endpoint is a **string** (`"134"`),
unlike the numeric `ID_CID` on `dungeonDataEntities`. Keying a map on it raw
yields 0 for every ring, which reads as "out of rings" rather than as a bug —
that happened once while writing `checkEntryTiers.ts` and is commented there.

### `entryData[0]` is Tier 2 — the coincidence is now a trap

The array is ordered tier **2, 1, 3**. Under the old directive `entryData[1]`
was Tier 1 *by luck*; under the new one `entryData[0]` is Tier 2 *by a
different coincidence*. Two tiers in a row where a positional read happens to
work is exactly how someone concludes position tracks tier — and then gets
Tier 2 when they wanted Tier 1, silently spending seven silver rings, or vice
versa. Restated in rule 11, DECISIONS, and the pinning test.

### Three stale operator-facing command lines, found on the way

Nothing in code defaults the index (`--juiced-index` is required and never
guessed), so the policy is something an operator reads off a printed line — a
stale hint IS the bug:

| file | said | now |
|---|---|---|
| `scripts/liveRun.ts` USAGE | "Tier-3 entry", `--juiced-index=1` | Tier-2, `=2` |
| `scripts/doctor.ts` ready message | `--juiced-index=1` | `=2` |
| `scripts/orchestrator.ts` header + `RULE_11_POINTER` | "Tier-3 entry", `=1` | Tier-2, `=2` |

Two of them had said "Tier-3" since the 2026-08-27 amendment — stale for four
sessions. `tests/orchestrator/dungeonArmClosed.test.ts` now forbids **both**
retired indices (3 and 1) and reads comment-stripped source, so `src/sim/
boons.ts` may keep its correct historical note that session 106's 24 offers came
from a `--juiced-index=1` entry. A historical note naming a retired tier is
fine; an instruction naming one is not.

---

## 2. The secret-scan flag — the defect was implicit SCOPE

Raised against session 110's recap line and worked at the user's direction once
the dungeon arm was blocked.

| session | actually covered | recap said |
|---|---|---|
| 108 | unreconstructable | "0 hits including the WIDENED 0x pattern" |
| 109 | read **zero bytes** | 0/4 → produced the "prove the file count" rule |
| 110 | one session's diff, **117 files** | `files in session diff: 117` |
| 111 (this) | 9,118 tracked files | scope printed beside the count |

**Session 110's scan was not broken.** It measured what it said it measured.
But "117 files" reads as repository coverage and is **1.3%** of the tree, and a
diff-scoped scan structurally cannot see a secret that landed in an earlier
session — which is how session 108's unreconstructable method went unchecked
for two sessions. Three sessions, three incomparable numbers, no way to tell
which was a full sweep.

### Two controls, because there are two ways to measure nothing

Session 109's rule catches "the reader read no bytes". A **regex that stopped
matching** produces the identical comforting zero and no session had ever
checked for it.

- **Control A** — `docId` must appear in >0 files. (109's.)
- **Control B** — every rule must hit its own synthetic positive sample and
  miss `redact.ts`'s placeholder. (New.)

Either failing fails the whole scan, as does a zero-file sweep.

**Control B found a live crash the moment it was written.** `verifyMatchers`
recorded a non-global pattern as a failure and then handed it to `matchAll`,
which throws — so a reportable failure would have taken the scan down instead
of being reported. Fixed to `continue`.

### The rules are the inverse of `src/api/redact.ts`

`redact.ts` is prevention; this is verification. Each of the 8 rules is the
un-redacted form of one of its placeholders, and they are described in those
terms so the pair cannot drift the way six copies of `redact()` did before
session 54 consolidated them.

Rules grounded against the real tree before being written, not guessed:
`jwt`, `addressBare` (40-hex, 0 hits tree-wide), `addressLabelled`,
`noobTokenJson`, `noobIdProse`, `usernameQuoted`, `privateKeyPem` (0),
`privateKeyHex` (0).

### `usernameQuoted` had a real bug, not just noise

The first draft produced 6 unexplained hits. Two were a genuine regex defect:
in JSON the field is `"username": "<USER>"`, and without consuming the key's own
**closing** quote the rule read that as the value's **opening** quote, matched
the nonsense string `username": "`, and therefore never tested the real value
against the placeholder lookahead — **a correctly-redacted fixture flagged.**

Three tightenings, each from an actual tracked-tree false positive:

1. `username"?` — consume the JSON key's closing quote.
2. Value must start alphanumeric — drops documentation ellipses
   (`username "..."` in `handoff/DECISIONS.md:352`, ASCII dots, verified by
   hexdump rather than assumed).
3. Value must be ≥2 chars — drops one-letter stand-ins in `redact.ts`'s own
   doc comment. **Accepted cost: a genuine one-character username would not be
   caught.**

The remainder are 5 files of synthetic redaction vectors, allowlisted with
reasons and **printed in the report** so an exemption cannot quietly widen.

### Samples are built at runtime, never written as literals

A scanner holding literal example secrets flags itself, and the obvious remedy —
allowlist the scanner — creates the one file where a real secret could hide
behind a legitimate exemption. Every sample is concatenated at call time
(`j("ey", "JhbGci...", ...)`), and both new files are asserted clean under their
own rules.

**That assertion caught the test file twice.** Splitting the VALUE is not
enough when a rule is keyed on a LABEL: `j("username ", ...)` leaves
`username ", "` in the source, which is itself a match. Then the *comment
explaining the fix* contained the same literal and matched again. Both now split
the label too.

**And the first draft contained a literal NUL byte**, from splitting `-z` output
on a raw NUL instead of `"\x00"`. `git`/`grep` treat such a file as binary, so
the scanner would have skipped its own source. Pinned by an explicit test.

### Allowlist staleness is exhaustive-scope only

On `--scope=diff` an exemption's file is usually just absent from the diff, and
the naive check flagged all six as stale and printed *"delete them"* — advice
that would have deleted live exemptions. Out-of-scope and stale are
indistinguishable from a narrow sweep, so the report now says it did not check.

### Final output

```
> secret scan — scope: tracked
  files scanned:        9118
  CONTROL A (read):     8758 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples

      jwt                 0 unexplained   (1 allowlisted)
      addressBare         0 unexplained
      addressLabelled     0 unexplained   (2 allowlisted)
      noobTokenJson       0 unexplained   (1 allowlisted)
      noobIdProse         0 unexplained   (4 allowlisted)
      usernameQuoted      0 unexplained   (6 allowlisted)
      privateKeyPem       0 unexplained
      privateKeyHex       0 unexplained
> PASS
```

`--scope=diff --ref=389ed4d4~2`: 14 files, 0 unexplained. The recap's own four
literal patterns over added lines: `0x…{4,}` 0, `noobId\s*\d+` 0, `eyJ` 0,
`PRIVATE` 4 — all four the scanner's own rule text and test sample.

---

## 3. QUESTIONS §65 — the guard-budget day-key straddle, FIXED

The repo's one concrete carried task, open since session 109.

`saveGuardBudget` evaluated `todayKey()` at **write** time and wrote the
process's **cumulative** counters under it. Those counters are seeded at
**process start**, so a process crossing 11:00 Pacific stamped the whole
invocation's totals — including everything spent before the rollover — onto the
new day.

`DAY_MEMO` (keyed by guard-state path, since one process legitimately accounts
for two arms that roll over independently of each other's *write* timing)
rebases at the boundary. `loadGuardBudget` and `saveGuardBudget` both gained an
optional `now: Date`, matching `todayKey`'s existing shape — which is what makes
the boundary testable without waiting for 11:00.

### Session 108 replayed, exactly

Per session 109's log the `--runs=4` invocation started 2026-08-29T17:53Z and
crossed 18:00Z between runs 2 and 3. **PDT is UTC-7, so 17:53Z is 10:53 PT —
BEFORE the rollover, which puts it in guard day 2026-08-28, one calendar day
behind the UTC date.** I got that off-by-one wrong on the first attempt (used
UTC 08-28) and eight cases failed loudly; the anchor assertion now pins both
keys before anything else runs.

| save | cumulative | guard day | file written |
|---|---|---|---|
| run 1, 17:56Z | 60 / 3 | 2026-08-28 | `{2026-08-28, 60, 3}` |
| run 2, 17:59Z | 120 / 6 | 2026-08-28 | `{2026-08-28, 120, 6}` |
| run 3, 18:03Z | 180 / 9 | **2026-08-29** | `{2026-08-29, 60, 3}` |
| run 4, 18:07Z | 240 / 12 | 2026-08-29 | `{2026-08-29, 120, 6}` |

`{date: "2026-08-29", energySpent: 120, runsStarted: 6}` is **exactly** what
session 109 had to write by hand to unblock the day. Before the fix the file
read 240/12 and the next dry run fail-closed with
`{"attemptedRun":15,"cap":12}` against a server reading 6.

### Three corrections to §65's own fix sketch

1. **Seed the memo at LOAD, not lazily at first save.** §65 says this and it is
   load-bearing: a process that loads a non-zero seed before 11:00 and does not
   write again until after has no pre-rollover save to learn the boundary from,
   so a save-time memo reproduces the original bug intact.
2. **FIRST LOAD WINS.** `liveRun.ts` and `liveFishing.ts` each call
   `loadGuardBudget` twice, and `doctor.ts`/`checkFishingCaps.ts` load the same
   paths read-only. A second load re-seeding the memo after a rollover zeroes
   the baseline and restores the bug in full.
3. **A backwards move must NOT throw, and my first draft did.**
   `guards.adoptServerRunCount()` (`guards.ts:136`) is
   `this.runsStarted = serverRunCount` — **absolute, and it can lower the
   counter** — and `liveFishing.ts:1804` calls it after
   `reconcileFishingLedger` on the AUTONOMOUS path. Post-rollover that can put
   the cumulative below the baseline, so throwing would have crashed a
   straddling fishing batch at the exact moment it was healing itself.

   This falsifies the assumption the whole design rests on: "the counters are
   monotonic within a process" is **false** on the one arm that runs unattended.
   The baseline is what stops applying once the counters are re-seeded, so it is
   dropped and the raw cumulative written — always ≥ the rebased value, keeping
   the error direction at over-count → block → never over-spend, and in the
   adopt case exactly the game's own number, because the reconciler guarantees
   `seed.runsStarted === gameCasts`.

### What this does NOT fix

Only the **persisted** ledger is rebased. `GuardState`'s in-memory counters stay
cumulative across the boundary, so the straddling process itself still counts
the old day's spend against the new day's cap and stops early. Fail-safe, and
the next process reads a correct ledger. Re-seeding a live `GuardState`
mid-batch is a larger change than §65 asked for.

### A mis-citation in §65 itself

§65 said `scripts/liveFishing.ts:1799` "uses the identical `saveGuardBudget(...)`
pattern". Line 1799 builds the `PersistedGuardBudget`-shaped **input** to
`reconcileFishingLedger`; the writes are at 1804, 1903 and 1969. The conclusion
was right — the autonomous arm reaches the bug and was the argument for fixing
it — and all three writes go through the fix. Recorded rather than silently
corrected, per CLAUDE.md rule 9.

### Post-change smoke, on real files, read-only

```
$ npx tsx scripts/liveRun.ts --status
▸ liveRun.ts --status (2026-08-29)
  dungeon runs:    12/12 used  ->  0 remaining
  dungeon energy:  240/240 used  ->  0 remaining
  fishing casts:   20/25 used  ->  5 remaining
  fishing energy:  264/300 used  ->  36 remaining

$ npx tsx scripts/doctor.ts
  ✓ token present and valid for another 121.6h
  today's local ledgers (roll over at 11:00 Pacific, 0.8h from now):
    dungeon: 12 runs / 240 energy recorded
    fishing: 20 casts / 264 energy recorded
▸ All checks passed.
    npx tsx scripts/liveRun.ts --juiced --juiced-index=2 --runs=1
```

`data/guard-budget.json` and `data/guard-budget-fishing.json` were read, not
written.

---

## 4. Surprises, collected as they happened

1. **The brief's "confirm, don't assume" instruction fired in the unexpected
   direction** — it was written expecting a possible reset, and the reset had
   not happened.
2. **`inputAmounts` all-1 across seven DIFFERENT ids** is a materially different
   cost model from "seven ids", and only the live read distinguishes them.
3. **`entryData[0]` is Tier 2** — a positional read now "works" for a second
   tier in a row, which makes it look *more* correct than it is.
4. **`ID_CID` is a string on the balances endpoint** and a number on
   `dungeonDataEntities`. Silent zeros, not an error.
5. **Writing control B immediately found a crash in control B's own helper.**
6. **The scanner's self-check caught its own test file twice** — a rule keyed
   on a LABEL is matched by the code that builds the label, comments included.
7. **My first draft of the §65 fix would have crashed autonomous fishing**, via
   an `adoptServerRunCount` path that makes the monotonicity assumption false.
8. **A sandboxed vitest run showed a false red** in `tests/profile.test.ts`
   (`fatal: unable to access '/Users/cameron/.gitconfig'`); unsandboxed it is
   clean. Known environment behaviour, not a code failure.

---

## 5. Verification, against the final pre-recap commit

- `npx vitest run --maxWorkers=4` — **2195 passed / 2195, 113 files**
  (2147 → 2195, +48: +6 entry-tier runway, +32 secret scan, +10 guard straddle)
- `npx tsc --noEmit` — clean, exit 0
- `git diff --check` — clean
- `npx tsx scripts/secretScan.ts` — PASS (output quoted in §2)
- `tests/discoveredShipsClean.test.ts` — 8/8
- `.gitignore` — all seven required paths present

## 6. Commits

```
6da45f2f  session 111: Tier-2 becomes the standing dungeon entry tier (user directive)
389ed4d4  session 111: one secret-scan instrument, with a control for each way to measure nothing
3057aa95  session 111: fix the guard-budget day-key straddle in code (QUESTIONS §65)
```
