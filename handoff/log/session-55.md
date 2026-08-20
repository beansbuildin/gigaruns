# SESSION 55 — 2026-08-19 (PT) — commit 39b8ef7

Offline by construction. Four brief items, all delivered. No gate was set.

---

## §1 — the precondition, checked first and verified live

**Result: both ledgers agree; the session is offline.** Run at ~20:55 PT:

```
guard day (11:00 PT rollover): 2026-08-19   [file records: 2026-08-19]
hours until next reset:        14.1

GAME ledger  (dayDocs pond 2):  20 / 20
REPO ledger  (data/guard-budget-fishing.json): 20 casts, 240 energy

  dayDocs[pondId 1] = 0
  dayDocs[pondId 2] = 20

Ledgers agree.
VERDICT: BLOCKED — cap spent. Next window opens at 11:00 PT (14.1h).
```

Dungeon side, from `scripts/checkDungeonToday.ts`: server `Dungeon#5`
`UINT256_CID: 12` against the repo guard's 12 runs / 240 energy. Also agreeing,
also exhausted. Rule 11 forbids a run regardless.

The brief's bounded exception (start the §19 batch if the session is still
running after 11:00 PT on 2026-08-20, and every item is complete) **did not
trigger.** The session ran 20:52–21:15 PT, ~14 hours short.

### Two live shape surprises, both traps

The check was written as a committed script rather than an ad-hoc read
specifically because §19 has lost four sessions to this question. Building it
surfaced two things a reasonable person would have got wrong:

1. **`dayDocs` is NOT keyed the way the dungeon side is.** The dungeon uses
   `DayCount#<addr>#Dungeon#<id>` and the natural move is to parse the suffix.
   Fishing does not: the shape is
   `[{pondId: number, doc: {UINT256_CID, docId, …}}]`, with `pondId` as an
   EXPLICIT sibling field, and `docId` reads
   `DayCount#<addr>#player-day-data-pond-2`. The first draft parsed the suffix
   and printed `NOT FOUND` — a false "cannot tell", which at least fails safe.
2. **The response ALSO carries a SINGULAR `dayDoc`, and it is POND 1's.** It
   read `UINT256_CID: 0` at the exact moment pond 2 sat at its 20/20 cap. A
   reader that reaches for `state.dayDoc` — the obvious name — gets a
   confident WRONG answer about Dendren, in the direction that says "go ahead
   and cast". Both facts are written into the script's doc comment.

Minor, noted and not fixed (out of scope): `scripts/checkDungeonToday.ts`
prints `PLAYER_CID`/`docId` raw to stdout. Console, not a tracked file, so not
a repo leak — but it is the same identifier §4 redacted out of prose.

---

## §2 — §19 reduced to one command, and a near-miss that mattered more

### The brief's premise was half wrong, and the wrong half was the dangerous one

The brief: "Read `matcherWeight` off `ringPrediction.jsonl` rows for a given
batch." Checked against the corpus first, per CLAUDE.md rule 9:

- The field is REAL. `scripts/liveFishing.ts` has written it since session 51
  (`matcherWeight: matcherOnRing ? matcherMixWeight : undefined`), and
  `matcherWeightOf()` exists as a back-compatible reader.
- **But 0 of the 129 rows on disk carry it.** Key census over the whole file:
  `matcherWeight` appears 0 times. Every row predates the instrumentation.
  `tier` distribution: `ring` 100, `matcher` 22, `matcher_ring` 7; 22 casts.

Absence alone would only mean "no data". The hazard is what the existing reader
does with it: `matcherWeightOf()` back-fills an absent field with
`1 - DEFAULT_RING_MODEL_OPTIONS.ringFloor` = **0.9**, the fixed weight that
genuinely WAS in force before session 51. That is the correct default for
reading history. For §19 it is catastrophic, because 0.9 on every turn reads as
**"π is high on every turn" — which is precisely the conclusion §19 exists to
test.** A report that pooled those rows would have returned **KEEP,
confidently, off a constant.**

This is CLAUDE.md rule 10 in its purest form: a field that FIRST APPEARS at
date D, counted as though it described the period before D. Rule 10 was written
in session 53 about `serverErrorDetail`; this is its second instance, found by
applying the rule deliberately rather than by getting burned again.

### What was built

`src/strategy/fishing/matcherVerdict.ts` — pure, rows in, verdict out. It reads
`rec.matcherWeight` DIRECTLY and treats absence as NOT MEASURED, never as 0.9.

Session 51's rule, as CODE and not a comment — the point being that the honest
answer may be "drop the thing two sessions built", and a prose rule can be
renegotiated once the numbers are visible:

| verdict | condition |
|---|---|
| `DROP` | π never exceeds 0.5 on any cast |
| `KEEP` | π exceeds 0.5 on ≥1 cast AND that cast's turns hit above the batch's own base rate |
| `EARNED_BUT_UNPAID` | π exceeds 0.5 but NO crossing cast beats the base rate |
| `INSUFFICIENT_DATA` | no row carries a real π |

Session 51 named only the first two. The third is reachable and is reported
under its own name rather than folded silently into `DROP` — it points the same
direction on different evidence, and a future session may want to tell them
apart.

`scripts/matcherWeightReport.ts` — the driver. Prints provenance BEFORE any
statistic, the loaded library's support recomputed at run time, the full π
distribution (quartiles plus both reference fractions, not just the crossing),
opening focus spend with its n and CI, and the verdict.

### Run end to end on the real corpus

```
▸ matcher weight report — QUESTIONS.md §19
  log:   data/ringPrediction.jsonl (129 rows on disk, 129 in batch)

── loaded library (what the verdict is pinned to) ──
  patterns:  3 — perimeterWalk(cw), perimeterWalk(ccw), bounce(2,0)
  support:   11/88 clean casts explained exactly
  prior pi0: 0.133 (Laplace +1/+2)

── provenance (read this before the numbers) ──
  matcher turns with a REAL matcherWeight: 0
  matcher turns predating the field:       29
  ! those 29 are NOT counted. matcherWeightOf() would fill them with the fixed 0.9
    in force before session 51 — a constant, not a measurement (CLAUDE.md rule 10).

── pi distribution over matcher turns ──
  (nothing measured)

── per cast (ranked by max pi) ──
  base hit rate over the batch: 23.3% (129 turns)
  [22 casts listed, maxPi n/a on every one]

── opening focus spend (turn 0) ──
  n=15  mean 1.667  95% CI [1.137, 2.196]
  reference (session 50): 0.71 replayed vs 1.8 live with the matcher OFF

── VERDICT: INSUFFICIENT_DATA ──
```

Correction to the brief's numbers: support is **11 of 88 CLEAN casts**, not
"11 of 89". 89 is the trace count; `supportingCastCount`'s denominator is clean
casts and it skips casts with duplicate turns or gaps. π₀ = 0.133 as the brief
said.

Opening focus spend brackets session 50's **1.80 live** figure and sits far
above its **0.71 replayed** one, at n=15. That is the half the replay cannot
see, and it is already measurable today.

### On the day

```
npx tsx scripts/checkFishingCaps.ts        # precondition, one GET, zero energy
# ... 20 casts under 5-cast checkpoint discipline ...
npx tsx scripts/matcherWeightReport.ts --last-casts=20
```

Tests: 15, covering all four verdict branches, the rule-10 refusal, the
distinction between "the tier never fired" and "it fired unmeasured", batch
selection (`--since`, `--last-casts`, malformed-argument rejection), and an
end-to-end assertion against the real log. The π branches are exercised
synthetically because the live corpus cannot exercise them at all today — the
rule is a function of the rows and nothing else, so that is sufficient.

---

## §3 — the blind-spot check, then the override

### Right conclusion, wrong mechanism — and the difference is load-bearing

The brief's hypothesis: `chooseBoon` cannot pick an unmodelled boon because an
unmodelled type has no `BOON_MODELS` entry to score. Two corrections:

- **There is no `chooseBoon`.** It is `pickBoon` / `rankBoons` in
  `src/strategy/loot.ts`.
- **The MECHANISM is REFUTED.** `pickBoon` never reads `BOON_MODELS` at all.
  `categorise()` is purely NAME-based: `Heal`; the `AddMax*` prefix; the
  `Upgrade*` suffix; a five-name `ROLLED_TYPES` set; else `unknown`. And
  `loot.ts`'s own header already says this is deliberate — *"what is
  deliberately NOT in the ranking: whether a boon is modelled"*, because
  preferring modelled boons would tune the coverage metric instead of the game.

**The CONCLUSION is confirmed anyway, by measurement:**

| measurement | result |
|---|---|
| unmodelled types categorising as `unknown` | **36 of 36** |
| `unknown`'s score | **10** — lowest of five (heal ~1e6, sword upgrade 1e5, pool ~25·scale, rolled 15) |
| decisions swept (135 offers × 4 HP fractions) | **540** |
| times `pickBoon` top-ranked an unmodelled type | **0** |
| offers where EVERY option is unmodelled | **0 of 135** |

So an unmodelled boon is never picked because it scores lowest, and it scores
lowest because it is unmodelled. Nothing about playing more runs breaks that
loop. But it is a **score FLOOR, not an exclusion** — which is why the fix is a
small override rather than surgery on the ranker. The ranker is not wrong; it
is uninformed, and it stays uninformed until a pair exists.

### The module

`src/strategy/boonCapture.ts`, pure. Three limits:

1. **Room 1 only** — a bad room-1 boon costs the least, and all five targets
   are first offered there.
2. **One target per run** — two picks compound the quality cost and buy no
   extra information about either boon. Enforced by a `runOnce`-LOCAL flag, not
   by the shared captures array, so a `--runs=2` invocation can legitimately
   capture twice, once per run.
3. **A target retires itself once modelled** — `isModelled` is injected;
   `liveRun.ts` passes the real `BOON_MODELS`. **Not in the brief.** Without
   it a stale config keeps paying run quality forever for a pair that already
   exists.

CLAUDE.md rule 8 is NOT in play, and the module says so in prose so a future
reader does not "fix" a deliberate suboptimal pick as a rule-8 violation: rule 8
governs `enemyPathOptions` tier choice on an identical-`lootTable` argument; a
boon pick touches no loot table and is not routed through `pickLowestTier()`.

### The gate — two conditions, deliberately

`config/bot.json`'s `forbiddenWoods.boonCapture.enabled` **AND**
`--boon-capture`. Passing the flag without the config is a hard error; enabling
the config without the flag prints "OFF. This is the safe default, not a bug."
Shipped OFF. This mirrors the potion gate next door, and the reason is that
block's own history: session 24's ONE-condition gate auto-derived a loadout
from a config block alone and consumed the user's limited item on a run they
had not authorized.

### The pair, which is the whole justification

`liveRun.ts` logs `boon_capture_pair` with `beforeTag`, `afterTag`, the run
name, the type and the selected `val1`/`val2` — one line, so the pair is read
off a single log entry rather than reconstructed by hunting adjacent fixture
numbers. It fires **only when both fixture halves exist**, so a failed write
can never be reported as a capture. The run summary reports captures including
the zero case, since "armed and never fired" is the common outcome and must not
read as "was never on".

### Cost, measured — the brief was optimistic by ~5x

| scope | offers holding a target |
|---|---|
| room 1 | **9 of 49 (18.4%)** |
| rooms 1–2 | 18 of 85 (21.2%) |
| rooms 1–3 | 26 of 110 (23.6%) |

Runs in corpus: 43. Runs with a room-1 top-five offer: **8**. At one target per
run that is **~27 runs to model five boons** — about seven days at rule 11's
four juiced runs per day. The brief said "five boons is five runs". Widening to
rooms 1–3 barely moves the rate while tripling the offers the override could
damage, which is why it stays at room 1.

Per-target counts (total offers / room-1 offers), all categorising `unknown`:
TieWeak 11/2, AddBurnShield 8/1, AddLifestealShield 5/3, Regen 4/1,
VulnerableBlock 4/2.

### Tests — 19 new

16 in `tests/boonCapture.test.ts`: the gate, the three limits, selection order
and object identity, plus **corpus-level assertions that the blind spot is
real** (every unmodelled type is `unknown`; 0 top-ranked across the sweep; no
all-unmodelled offer; every default target is a real corpus type, still
unmodelled, and reachable in a permitted room). If a target ever gets modelled
that last test FAILS — which is success, and the test says so.

3 in `tests/liveRun.test.ts` exercising a real `runOnce` with a real
`FixtureWriter` on a temp root: the override takes TieWeak over the Heal the
ranker wants and both fixture halves land on disk; the SAME fixture without the
override goes to the Heal (proving the contrast is the override, not the
scenario); and a second targeted offer in the same run is NOT taken.

**Dead end worth recording:** the first draft of the once-per-run test fed the
identical reward state twice. The stall guard (`checkStateProgress`) ended the
run before the second decision was ever reached, so the test passed for the
wrong reason and leaked an unhandled rejection into the suite. Two DISTINCT
offers are required.

---

## §4 — the three handoff documents

User decision: redact the three files, leave the git history alone.

**"Route them through `src/api/redact.ts`" could not have worked as written**,
and the brief anticipated why. Every rule in `redactNoobToken` is keyed on a
JSON field shape (`"NOOB_TOKEN_CID": …`, `"docId": "Type#1-2"`). The three
documents are hand-written English. Not one rule matches. The failure mode is
that JSON rules silently matching nothing **looks exactly like success** —
which is how the redaction effort stayed scoped to `fixtures/` for fifty-odd
sessions in the first place.

So the module grew `redactProse()`. Three rules, each requiring the
identifier's own **LABEL** next to it rather than matching by shape alone:

- `noobId <digits>` / `noobId: <digits>` / `noob id <digits>`
- `username "…"` / `` username `…` `` / `username: '…'`
- `address 0x…`, full or truncated

Shape alone would be reckless here in a way it is not in JSON: a bare `0x` +
hex rule eats contract addresses and, **in these very files**, the git SHAs
quoted in every STATE header (`commit ff36aa1`, `git diff 2f78c74..ff36aa1`).
Losing a commit SHA out of a session log destroys the one thing that makes the
log checkable. A test asserts SHAs survive.

Applied, and the output checked rather than the exit code. Four lines across
three files, nothing else moved:

```
 handoff/log/session-02.md     | 2 +-
 handoff/log/session-07.md     | 4 ++--
 handoff/scratch-session-02.md | 2 +-
```

Whole-tree residual scan (`git ls-files | xargs grep`) for all three
identifiers: **zero hits.**

Session 54's dead end observed throughout: no real identifier appears in the
new code, its doc comments, or the tests. The rules are label-keyed, so
synthetic ids exercise them identically. (The first draft of the doc comment
DID quote the real values as examples; caught and scrubbed before commit.)

`redactProse` is idempotent by construction — `\d+` does not match
`<NOOB_TOKEN>`, and `0xUSER` has no two hex characters after `0x`. Tested.

`fixtures/README.md` records the decision, the prose pass, its stated limit
(it will not find an identifier written without its label), and now answers the
history question in a section of its own so the next reader does not re-ask it
in three sessions.

---

## §5 — §23, nothing to do

Confirmed: the tight energy probe is armed on `LiveRunDeps.energyProbe` and
fires on the next real run, which was not this session. The −1 drift is
untouched.

---

## Verification at the final commit (39b8ef7)

```
npx tsc --noEmit   -> clean
npx vitest run     -> Test Files 53 passed (53)   Tests 931 passed (931)
git diff --check   -> clean
```

886 → 931 (+45: 16 boonCapture, 3 liveRun parseArgs, 3 liveRun runOnce,
15 matcherVerdict, 8 redactProse). No test writes a real data path — the two
new I/O-touching test constructions both take `mkdtempSync` roots.

Corpus unchanged: dungeon 55 attempts, fishing 89 traces. Nothing was captured
this session, because nothing was played.
