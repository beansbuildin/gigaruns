# DISTRIBUTION REHEARSAL — steps 5 and 6, run locally

Session 67, 2026-08-21. Brief §3. **No repo was created and nothing was
pushed.** The export is a gitignored copy inside the project
(`dist-preflight/`), built with `git checkout-index` and pruned to
`DISTRIBUTION.md`'s ships list — no `.git` came with it. Steps 3–6 remain the
user's; this rehearses the two of them that need no GitHub.

Regenerate it with the commands in §5 below.

---

## The headline

**The bot itself is portable. Its test suite is not.**

Every entry point a new user is told to run degrades correctly in an
environment with no `~/.secrets` and no `data/` — `doctor.ts` prints one
actionable failure and nothing else, and `liveRun.ts`/`liveFishing.ts` refuse
with the same message rather than a stack trace. That is the part that
mattered most and it passed.

What does not survive the trip is the suite: **four test files fail and eleven
tests silently never run**, all because tests reach into directories the ships
list deliberately excludes. A friend's first `npx vitest run` is red, and the
failures look like the bot is broken when it is not.

---

## 1. `doctor.ts` as a friend sees it — VERBATIM

Run as `HOME=/nonexistent-friend-home npx tsx scripts/doctor.ts` from the clean
export, which is how the friend's missing `~/.secrets` was simulated (through
the profile/env indirection; nothing under the real `~/.secrets` was touched,
moved or renamed).

```
▸ doctor — profile "default"

  ✓ Node 24.13.1
  ✓ running from the repo root
  ✗ no JWT at /nonexistent-friend-home/.secrets/gigaverse-jwt.txt
      1. Log in at gigaverse.io in your browser.
      2. Open DevTools -> Network, then play one action in the game.
      3. Click any request to gigaverse.io/api, find the request header
         `Authorization: Bearer <token>`, and copy the <token> part.
      4. Save it to /nonexistent-friend-home/.secrets/gigaverse-jwt.txt (the token only, no "Bearer").
  ✓ config valid — dungeon 5, 20 energy/run, budget 240/day, 12 runs
  ✓ fishing configured — node 5, 20 casts/session

  today's local ledgers (roll over at 11:00 Pacific, 23.1h from now):
    dungeon: 0 runs / 0 energy recorded
    fishing: 0 casts / 0 energy recorded

▸ 1 check(s) failed. Fix the items marked ✗ above, then re-run.
```

**That is the whole list, and the one failure is the correct one.** It names
the exact file, gives four numbered steps, and does not confuse "you have not
set up a token yet" with "something is wrong". `config/discovered.json` and
`config/bot.json` both loaded from the shipped copies — the session-60 split
works as designed for a stranger. Missing `data/` did not fail anything; it
reported zero ledgers, which is right for day one.

`npm install` also succeeded from a bare `package.json` with no lockfile: 0
vulnerabilities, no build step, no native modules.

The three commands the README tells a new user to try next were also run in the
clean export and all three behave:

- `liveRun.ts --status` printed the full ledger table without needing a token.
- `liveRun.ts --dry-run --juiced --juiced-index=3 --runs=1` and
  `liveFishing.ts --casts=1 --dry-run` both stopped at
  `✗ No JWT at …/.secrets/gigaverse-jwt.txt` with the same instructions.

---

## 2. The suite in the clean tree — FOUR FILES FAIL

```
 FAIL  tests/rejectionAudit.test.ts [ tests/rejectionAudit.test.ts ]
Error: ENOENT: no such file or directory, open 'logs/run-2026-08-18-19-50-13.jsonl'

 FAIL  tests/api/redact.test.ts > redactProse — [session 55] handoff documents, not JSON >
       the three tracked handoff documents are redacted — the corpus-level assertion, not just the function's
Error: ENOENT: no such file or directory, open 'handoff/log/session-02.md'

 FAIL  tests/fishing/matcherVerdict.test.ts > against the real corpus — end to end, so the only
       untested thing on the day is the data > §19 has CROSSED: the matcher exceeded the decision
       threshold, so the verdict is KEEP while the payoff half stays unpowered
AssertionError: expected 0 to be greater than 0

 FAIL  tests/fishing/reversalDispersion.test.ts > reversalDispersion on the committed corpus >
       is internally consistent
AssertionError: expected 0 to be greater than 0

 FAIL  tests/fishing/reversalDispersion.test.ts > reversalDispersion on the committed corpus >
       REFUTES the session-51 brief's under-dispersion claim — the number is above 1, not 0.80
AssertionError: expected 0 to be greater than 1

 Test Files  4 failed | 67 passed (71)
      Tests  4 failed | 1264 passed (1268)
```

At home the same commit is **71 files, 1279 passed**.

**`fixtures/` is NOT the problem.** DISTRIBUTION.md step 6 exists to catch a
trimmed fixture corpus, and it was not trimmed — 3,935 files exported and every
fixture-driven test passes. The failures are a different class entirely.

### Each failure, and which list it belongs to

| test | reads | that path is on the |
|---|---|---|
| `tests/rejectionAudit.test.ts` | `logs/run-*.jsonl` (via `PRE_SESSION_53_LOGS`) | **does-not-ship** list |
| `tests/api/redact.test.ts` | `handoff/log/session-02.md`, `handoff/log/session-07.md`, `handoff/scratch-session-02.md` | **does-not-ship** list |
| `tests/fishing/matcherVerdict.test.ts` | `data/ringPrediction.jsonl` | **does-not-ship** list |
| `tests/fishing/reversalDispersion.test.ts` | `data/fish-patterns.jsonl` | **does-not-ship** list |

**None of these is a bug in the ships list.** Every path involved is correctly
excluded — they are the author's logs, session notes and learned state, and
they should not be shipped. The bug is that four *shipped* tests assert against
*unshipped* data, which is only invisible at home because the data is always
there.

### And the one that is worse than a failure

`tests/rejectionAudit.test.ts` throws during collection, so it contributes
**0 tests instead of 11**. Diffing the JSON reporters home-vs-export, those
eleven are the entire difference between 1279 and 1268:

```
rejectionAudit — the pre-session-53 regime  … classifies start_run separately …
                                            … pins the 66 / 66 / 224 split
                                            … NEVER rejected a numeric-token POST …
                                            … zero overlap between rejected and accepted gap bands
                                            … counts a retry as part of its decision
rejectionAudit — after the session-53 pacing fix  … has post-fix logs to read at all
                                                  … rejects ZERO empty-token first attempts
                                                  … actually paces the empty-token POSTs
rejectionAudit — parsing  … does not advance the response clock across a rejected attempt
                          … survives a truncated final line
                          … reads the legacy stringified body shape
```

A count that silently drops by 11 is exactly the failure mode CLAUDE.md keeps
legislating against, and it is only visible by diffing reporter output.

### The fix, when someone takes it on

The pattern already exists in this repo: `loadRingPredictions` returns `[]` for
a missing file and `reversalDispersion`'s loader could do the same. The tests
then need to **skip explicitly** when the corpus is absent rather than assert
`> 0` — `describe.skipIf(!existsSync(...))` with a message saying the data is
the author's — so a friend's run is green and honest rather than red and
confusing. `redact.test.ts`'s handoff assertion belongs to the author's own
pre-commit discipline, not to a shipped suite, and is the clearest candidate
for a skip guard. **Not fixed this session** — it is four files of judgement
calls about what a stranger's suite should assert, and the brief scoped this to
finding them.

---

## 3. The ships list — two omissions, both real

**`vitest.config.ts` is not on the ships list and the suite needs it.** Without
it vitest falls back to its default `include` and, more importantly, to a
**5-second** `testTimeout` instead of the configured 10. The config's own
comment explains why 10 is deliberate ("if a test hangs, it is reaching for the
network and that is a bug"). Nothing failed on timing in this rehearsal, but a
friend on a slower machine is one flake away from concluding the bot is broken.

**`package-lock.json` is not on the ships list.** `npm install` from a bare
`package.json` worked and resolved cleanly today, but it resolves *whatever is
current*, so two friends can end up on different vitest majors and get
different results from the same commit. Shipping the lockfile makes
`npm ci` possible and makes "it passes for me" mean something.

Neither is in the does-not-ship list either — they were simply never
considered. **Add both to the ships table.**

Also unlisted in either direction, and correctly excluded here: `CODEXAUDIT`,
`CODEXIMPROVE`, `CODEXREVIEW`, `config/.gitkeep`, `.claude/`. Worth adding to
the does-not-ship list so the next person exporting does not have to decide
again.

Nothing on the ships list turned out to be unnecessary.

---

## 4. Secret scan — THE EXPORT, not the working tree

Run against `dist-preflight/` with `node_modules` excluded. These are different
artifacts and the scan is reported separately on purpose.

| pattern | files | verdict |
|---|---|---|
| `0x[a-fA-F0-9]{4,}` | 4 | all false positives — see below |
| noob-id pattern | 1 | false positive |
| JWT prefix | 1 | false positive |
| `PRIVATE` | 0 | clean |
| `*.har`, `*.harx`, `**/raw/**` | 0 | clean |

- `tests/api/redact.test.ts` — the redactor's own synthetic vectors: a
  repeated-digit noob id, a truncated 4-hex-digit address, and a `deadbeef`-style
  placeholder. Fake by construction; this is the test that *removes*
  identifiers. **Deliberately not quoted here**, so a future scan of `handoff/`
  does not have to re-adjudicate them.
- `src/sim/rng.ts`, `scripts/auditMovementIndependence.ts` — `0x6d2b79f5`, the
  mulberry32 constant.
- `fixtures/probe/roms/player-response-redacted.json` — `0x1280`, from the
  substring `1280x1280 PNG` inside an IPFS image URL.
- `tests/api/client.test.ts` — a base64url `{"alg":"HS256"}` header followed by
  300 `x`s. A synthetic token, and the `eyJ` prefix is what makes any JWT match
  that pattern.

**The export is clean.** This says nothing about the git history, which is the
reason the whole squashed-history plan exists — see §5.

---

## 5. YOUR CHECKLIST — DISTRIBUTION.md steps 3 to 6

Decisions already made and stated inline: **private repo**, friends added as
collaborators; **squashed single-commit history**, because the current history
still carries the noob token and three handoff documents' identifiers even
though the working tree does not. One commit, no ancestry, no `filter-repo`, no
stale clones holding the old objects.

Do §3's two ships-list additions first, or accept that friends will not have a
lockfile or the vitest config.

**Step 3 — export the ships list** (from the project root; this is exactly what
the rehearsal ran):

```bash
rm -rf ../gigaverse-dist && mkdir -p ../gigaverse-dist && git checkout-index -a --prefix=../gigaverse-dist/ && cd ../gigaverse-dist && rm -rf handoff .claude && rm -f TASKS.md QUESTIONS.md CODEXAUDIT CODEXIMPROVE CODEXREVIEW config/.gitkeep
```

**Step 4 — one commit, then push to a NEW PRIVATE repo.** Create the empty
private repo on GitHub first, then:

```bash
git init -b main && git add -A && git commit -m "Gigaverse autoplay bot" && git remote add origin git@github.com:<you>/<repo>.git && git push -u origin main
```

**Step 5 — clone it fresh and run doctor as a friend would.** The point is a
directory that has never had your `~/.secrets` or `data/`:

```bash
cd /tmp && rm -rf giga-friend && git clone git@github.com:<you>/<repo>.git giga-friend && cd giga-friend && npm install && HOME=/nonexistent npx tsx scripts/doctor.ts
```

Expect exactly one `✗`, for the JWT. Anything else is new since this rehearsal.

**Step 6 — run the suite in that fresh clone:**

```bash
npx vitest run
```

Expect the four failures in §2 until they are fixed. **Tell friends about them
before they run it**, or fix them first — a red suite on first contact is the
single most likely reason someone quietly gives up.

**One thing to check that this rehearsal could not:** `git log --oneline | wc -l`
in the fresh clone must print **1**. If it prints more, the squash did not
happen and the identifiers in the history came with it.
