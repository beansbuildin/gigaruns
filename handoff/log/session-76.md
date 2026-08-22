# SESSION 76 — 2026-08-22 — the repo, as a stranger runs it

**GATE 1 PASS. GATE 2 PASS. GATE 3 PASS.** Suite 1433 → **1442/1442**,
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean, tree clean.
Four commits: `8008140`, `f575dcd`, `9fc7a66`, `8bb7988`.

**0 live actions.** Opened 07:22 PT against ledgers session 75 exhausted;
rollover 11:00 PT. Ship-nothing posture HOLDS (user, this session).

---

## 0. The ledgers, read before anything else

```
▸ doctor — profile "default"
  ✓ token present and valid for another 147.6h  (<JWT>...(1728 chars))
  ✓ authenticated as <USER> — <ADDR>
  today's local ledgers (roll over at 11:00 Pacific, 3.6h from now):
    dungeon: 12 runs / 240 energy recorded
    fishing: 20 casts / 228 energy recorded
▸ All checks passed. You are ready.
```

`checkFishingCaps.ts`: `GAME ledger (dayDocs pond 2): 20 / 20`, `REPO ledger:
20 casts`, *"ledgers agree"*, `VERDICT: BLOCKED — cap spent.`
`checkDungeonToday.ts`: `DayCount#…#Dungeon#5` → `UINT256_CID: 12`.

Server and repo agree on both. The brief's derived claim was right; it was still
worth reading, and cost twenty seconds.

---

## 1. §1 / GATE 1 — the assertion git could never satisfy

### The measurement

```
$ ls -d fixtures/fishing-casts/live/cast-* | wc -l        133
   with a state-* file                                    109
   raw-only (empty once fixtures/**/raw/ is ignored)        24

$ git ls-files fixtures/fishing-casts/live | awk -F/ '{print $4}' | sort -u | wc -l   109
$ ... | awk -F/ '$5 ~ /^state-/ {print $4}' | sort -u | wc -l                          109
```

Author: `133 > 109` ✓. Clone: `109 > 109` ✗. **Structurally unsatisfiable** —
git tracks files, not directories, so a directory whose only content is ignored
cannot exist in any clone of any commit.

### Baseline, reproduced with the repo's own instrument

```
$ npx tsx scripts/preflight.ts
  ✓ exported 271 tracked file(s) to dist-preflight/
▸ doctor.ts with an empty HOME — 1 ✗   (the JWT)   ✓ expected state
  Test Files  1 failed | 85 passed (86)
  Tests  1 failed | 1419 passed | 13 skipped (1433)
  ★★★ RED in a stranger's tree.
▸ PREFLIGHT FAILED
```

### After

```
  Test Files  86 passed (86)
  Tests  1419 passed | 15 skipped (1434)
  ✓ green in a stranger's tree.
▸ PREFLIGHT PASSED — the export behaves for a stranger.
```

Run twice, byte-identical. At the final commit (with `requireInputs.test.ts`):
`87 passed (87)`, `1427 passed | 15 skipped (1442)`, PASSED.

### Why the guard "missed" a fifth file — it did not

```
$ git log --oneline -S 'expect(dirs.length).toBeGreaterThan(withStates.length)' \
      -- tests/sim/fishingCorpus.test.ts
f93d9a6 session 68 §4: scripts/preflight.ts, and the "110th cast" was never missing

$ git show --stat f93d9a6
 handoff/DISTRIBUTION.md         |  22 +++
 scripts/preflight.ts            | 211 +++++++++++++++++++++
 tests/sim/fishingCorpus.test.ts |  45 ++++-
```

**The assertion and the instrument built to catch it shipped in the same
commit**, after `632d9c5` (§3) had swept the four known files. And the
session-68 log's final preflight reads `1279 passed | 13 skipped (1292)` while
that session's working tree ended at **1293** — exactly one test short, because
`preflight.ts` exports the git **INDEX** and the test was written after the last
run.

**A one-shot sweep does not stay swept.** That is the durable sentence, and it
is why open question 2 (preflight in CI) now has a sharper form: CI *on a push*
closes this gap; a pre-commit hook would not, because the index is the thing
that lags.

### The sixth file, found by asking the question rather than by a failure

`tests/discoveredShipsClean.test.ts`, from session 60 (`743389b`):

```ts
it("and if it exists locally, it is the file that holds them", () => {
  // Skipped in a fresh clone, which is correct — there is nothing to check.
  if (!existsSync("data/roms.json")) return;
```

It was **not** skipped. It PASSED, having asserted nothing —
`tests/helpers/authorData.ts`'s own docstring calls this *"the same failure mode
as a vacuous assertion: green, and testing nothing."* Converted to
`probeAuthorData` + `describe.skipIf`, which is why the export's skip count
moved 13 → 15 while the local count stayed 8/8.

**Nothing detects this shape.** Both instances were found by reading. A vacuous
pass is invisible to the suite AND to `preflight.ts` — both count it as a pass.

---

## 2. §2 / GATE 2 — fail closed, and the two opposite ways not to

### Negative test, in a clone-shaped tree (no `data/`, no `logs/`)

```
$ npx tsx scripts/redrawBlastRadius.ts --runs=50

✗ redrawBlastRadius.ts cannot run — 2 required input(s) unusable:

    data/fish-patterns.jsonl  (absent)
        needed for: the empirical fish-step table and both blind-fallback maps (§3, §4)
    data/minedFishPatterns.json  (absent)
        needed for: `matcherPool` — the matcher the live config plays with (§3, §4)

  These are the AUTHOR'S accumulated captures. `data/` and `logs/` are
  gitignored and do not ship, so this is the expected state in any clone —
  it is not a bug in the code you received.
  …CLAUDE.md rule 5.
EXIT=2
```

`liveGateFiringRates.ts` likewise, naming all three (`data/ringPrediction.jsonl`,
`data/minedFishPatterns.json`, `logs`), `EXIT=2`, no report.

**Before:** the first ran to completion printing `catch 0.0%` on both arms with
§4's mechanism prose unchanged beneath it; the second crashed at §3 with a raw
`ENOENT: scandir 'logs'` **after** publishing a §2 computed on 420 turns instead
of 440 and 0 era casts instead of 134.

### Positive controls — both instruments intact

```
▸ liveGateFiringRates.ts — SESSION 75 GATE 1
  Replay: 39 era casts / 134 turns, and 127 clean casts / 440 turns.

  whole clean corpus — 440 turns
    RELAXING gate   evaluated   20   held (fired)    0   0.0%
    FOCUS    gate   evaluated   80   held (fired)    0   0.0%
    SHADOW   >=1 certain-kill       0      >=1 certain-connect    0
    bestKillProbability    0.009 .. 0.991   exactly 1: 0
    bestConnectProbability 0.000 .. 0.967   exactly 1: 0
```

```
── §3  DOES IT ACTUALLY EXECUTE? — THE DEFAULT POLICY, MEASURED ──
  matcherFishPolicy            casts with >=1 redraw  3515 / 4000   87.9%

  arm            casts w/ redraw   shots   hit rate per shot   catch    turns/cast
  NEVER (0)                  0   24790               35.6%    24.9%         6.20
  derived (.339)          3453   18188               45.4%    32.5%         6.07
```

Every session-75 headline figure reproduces to the digit. **This is a control,
not a measurement** — nothing was re-derived and no number moved.

### What the guard is

`scripts/lib/requireInputs.ts`. `missingInputs()` is pure and returns
`absent` / `empty file` / `no matching entries`; `requireInputs()` prints and
exits **2** (distinct from 1, so "I have no data" is separable from "the
analysis went wrong"). The third reason matters on its own: a `logs/` full of
dungeon files and no `fishing-*.jsonl` scores zero live firings and reads as a
finding. Callers pass profile-resolved paths, so the module holds no path
literal — `noHardcodedPaths` ratchet unmoved at 25.

---

## 3. §3 / GATE 3 — the claim that outlived its evidence, twice

`src/sim/fishing/castSim.ts` carried, INSIDE the branch session 75 fixed:

> "a free step made the redraw strictly CHEAPER in sim than in play, so session
> 72's 263 mana per extra fish and its `escaped_mana` 18.8% -> 39.8% were both
> UNDERSTATEMENTS. Correcting it therefore STRENGTHENS the CLOSED verdict."

Measured: **263.0 → 43.9**. Down by a factor of six. `SPEC-fishing.md` §7a
carries the retraction and the table — verified present and correct — but the
comment is what a reader opens to understand the fix. Replaced with the measured
direction, the mechanism (*a `continue` skips everything below it, not the one
thing you were thinking about*; the branch was **information**-free, and that is
the larger term), and the verdict as it stands: **CLOSED ON PRICE, NOT ON
EFFECT**. The stale `escaped_mana` pair re-reads **18.5% → 39.4%** (session 75
§3's own table, lines 246–247 of its log).

`tests/fishing/pConnectConsumers.test.ts` carried "(session 72: 263 mana per
extra fish)" — and STATE.md tells the next reader to cite that file with the
`pConnect` verdict, so it *will* be opened. Corrected.

Same class as §1 and §2: a conclusion nobody re-read where it was written down.
Session 75 caught this exact defect in a format string one file over and did not
look at the comment.

---

## 4. §4 — DISTRIBUTION.md vs what shipped

Verified here, not transcribed:

```
$ git remote -v          origin  https://github.com/beansbuildin/gigaruns.git
$ git rev-list --count HEAD                    370
$ git ls-files handoff | wc -l                 102
$ git ls-files .claude                         …/settings.local.json.bak  (tracked)
```

Scans, working tree and **all 370 commits** (`git grep … $(git rev-list --all)`):

| pattern | tree | history |
|---|---|---|
| `0x[a-fA-F0-9]{40}` | 0 | **0** |
| `eyJ[A-Za-z0-9_-]{30,}` | 0 | **0** |
| `\b0x[0-9a-fA-F]{64}\b` | 0 | **0** |
| `PRIVATE KEY` | 2 — both grep-pattern strings (`.claude/….bak`, `handoff/next.md`) | — |
| `/Users/<USER>` | **5 files** — `handoff/log/session-{01,15,35,37}.md`, `.claude/…bak` | — |

Smaller than the document feared. DISTRIBUTION.md now opens with a box saying so
and labels its does-not-ship table as the **export's** list. `.claude/*.bak`
added to `.gitignore`. **No history rewritten, no remote touched, nothing
deleted** — steps 3–6 remain the user's.

## 5. §5 — rule 3's last two contradictions

- `CLAUDE.md` "Working style": *"`viem` for signing"* → *"Nothing here signs"*,
  with the reason. `viem` gone since session 59, pinned absent by
  `tests/clientSurface.test.ts:129–132`.
- `TASKS.md` "Later, if the user wants it": the Path B line deleted, which is
  literally what rule 3 instructs.

Both are one-liners that keep *"the bot asks for a session token, not custody of
a wallet"* true — the sentence in front of anyone deciding to run this.

---

## 6. Surprises, in the order they happened

1. **The brief was accurate in every particular I checked**, including line
   numbers, counts and the mechanism. Rule 9 expects a third miss; this was not
   it.
2. **The fix surfaced a sixth file, as the brief predicted** — and the honest
   finding is the class, exactly as it said. The sixth is *worse* than the
   fifth: green and silent rather than red and loud.
3. **The scratch-tree method has an artefact.** `git checkout-index` into a
   non-repo directory fails `tests/profile.test.ts`, which shells out to
   `git check-ignore`. Not a code defect. `preflight.ts` (export inside the
   working tree) is the right instrument for the SUITE; the scratch tree is
   right for running a SCRIPT with no `data/`.
4. **A `**/` inside a TypeScript block comment terminates the comment.**
   Writing `fixtures/**/raw/` in the new docstring produced 16 parse errors.
   Trivial, cost five minutes, and will cost the next person five minutes too.
5. **The shell's cwd persists between tool calls**, so a `cd` into `fixtures/`
   made a later `git ls-files fixtures/…` return nothing and briefly looked like
   a finding about tracked files. It was not.
