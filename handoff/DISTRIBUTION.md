# DISTRIBUTION — what ships, what does not, and the one thing only the user can do

Drafted session 59 against the portability brief §3.

**[session 60] Steps 1 and 2 of the order of operations below are now DONE in
the working tree** — the `config/discovered.json` split and the MIT `LICENSE`,
plus the README's ToS correction. Steps 3–6, which create and push the
distribution repo, remain **the user's**: they involve their GitHub account, and
CLAUDE.md forbids an agent doing them.

---

## The one blocking reason not to just share this repo

**The git HISTORY carries identifiers.** The working tree is clean — session 54
redacted 2,726 fixture files to 0 raw occurrences — but the history still holds
the noob token and three handoff documents' identifiers. That was a deliberate
decision (`fixtures/README.md`) and it stays fine for a repo nobody is invited
to read. **Pointing friends at it is an invitation.**

**Ship from a fresh repo with squashed history.** One commit, no ancestry. This
costs nothing and sidesteps the `git filter-repo` / force-push question
entirely — no rewriting, no stale clones holding the old objects, no chance a
reflog or a fork keeps what was removed.

---

## Ships

| Path | Why |
|---|---|
| `README.md` | the setup guide; written for someone with no context |
| `src/`, `scripts/`, `tests/` | the program and its 1057 tests |
| `fixtures/` | **already redacted** (session 54: 2,726 files, 0 raw occurrences). The sim replays these; a friend starting with an empty corpus gets a bot that cannot simulate anything |
| `config/bot.json` | the budget knobs, with the author's numbers as defaults |
| `config/discovered.json` | **game-global, not per-account** — Forbidden Woods is dungeon 5 and `maxRoom` 16 for everyone (confirmed on four dungeons, session 57). Shipping it saves every friend a `probe.ts` run. **[session 60] Split and un-ignored; ships.** Pinned by `tests/discoveredShipsClean.test.ts` |
| `LICENSE` | **[session 60] added.** MIT. Without it nobody has permission to use the code, collaborator access notwithstanding |
| `SPEC.md`, `SPEC-fishing.md` | what the API actually does, verified against live responses |
| `CLAUDE.md` | explains *why* the odd rules exist; most are scar tissue from a specific incident |
| `PROTOCOL.md` | how the project is worked on |
| `package.json`, `tsconfig.json`, `.gitignore` | build |
| `vitest.config.ts` | **[session 67] ADDED after the step-5 rehearsal found it missing.** Without it vitest falls back to a 5-second `testTimeout` instead of the configured 10 — the config's own comment says why 10 is deliberate — and to its default `include`. Nothing failed on timing in the rehearsal; a friend on a slower machine is one flake from concluding the bot is broken |
| `package-lock.json` | **[session 67] ADDED after the step-5 rehearsal.** `npm install` from a bare `package.json` worked, but it resolves whatever is current, so two friends can land on different vitest majors and get different results from the same commit. With the lockfile, `npm ci` is possible and "it passes for me" means something |

## Does not ship

| Path | Why |
|---|---|
| `data/` | the author's learned state and spend ledgers — opponent model, guard budgets, play counts, mined fishing patterns. Personal, and useless to anyone else. **[session 60] now also holds `data/roms.json`**, the ROM token ids split out of `discovered.json` |
| `logs/` | raw captures, unredacted by design |
| `handoff/` | ~250KB of session notes naming the account, plus this file. Reads as an internal document because it is one |
| `QUESTIONS.md`, `TASKS.md` | the author's working queue, not a user's concern |
| `~/.secrets/` | never in the repo; not even referenced except by path |
| `CODEXAUDIT`, `CODEXIMPROVE`, `CODEXREVIEW`, `config/.gitkeep`, `.claude/` | **[session 67]** review scratch and editor config. They were on neither list, so the rehearsal had to decide; recorded here so the next export does not decide again |

---

## Open items — ALL THREE RESOLVED by the user, 2026-08-20; items 1 and 3 IMPLEMENTED session 60

1. **`config/discovered.json` — SPLIT, do not simply un-ignore it.** The file is
   *mostly* game-global, but its `roms` block is not: `knownRomIds`
   `["7959","2097","5345","689"]` plus the full 37-ROM enumeration are the
   author's own NFT token ids — **the same identifier class session 54 spent
   2,726 files removing.** Shipping the file whole would re-import that class
   into the one file every friend is told to keep.
   - `config/discovered.json` → game-global only (dungeon 5, `maxRoom` 16,
     endpoints, request shapes, `amountFieldBehavior`, cooldown notes). Comes
     off `.gitignore` and ships.
   - The ROM enumeration → a per-profile account file that **stays gitignored**,
     resolved through `src/profile.ts` like every other per-account path.
   - The split is verifiable, so verify it: a test asserting the shipped file
     contains no bare numeric id list and no 20+-char hex. The same grep that
     found this (`0x[0-9a-fA-F]{20,}` and identity-ish keys) returns clean on the
     rest of the file — 0 addresses, 0 long hex, the only identity-ish keys being
     `playerEndpoint`/`playerEndpointConfidence`, which are endpoint paths.
2. **Private repo.** Friends are added as collaborators. Public stays available
   later; the reverse is not.
3. **MIT licence.** Add `LICENSE` at the distribution root. Without it nobody has
   permission to use the code at all, collaborator access notwithstanding.

## And one correction to the portability brief, which invented a risk

The portability brief's §5 told the README to carry a **ToS warning** —
"automating a game account may breach its terms and the downside lands on their
assets." **That is wrong for this game and must not ship.** Per the user:
bots are *explicitly allowed* in Gigaverse, and the team has itself published a
repo of agentic skills for running fully autonomous accounts. There is no ban
risk to warn about.

This was CLAUDE.md rule 1 being violated by the brief's author — a generic
assumption about game bots, applied without checking this game's actual stance.
Replace the paragraph with the accurate version: **automation is sanctioned
here, and the bot only plays** (`tests/clientSurface.test.ts` is the proof of the
second half). That is a better opening line for a friend than a hedge, and it has
the advantage of being true.

---

## Step 5 is now a script — run it before every invite

`npx tsx scripts/preflight.ts` (add `--keep` to inspect the tree afterwards).

It exports the ships list, runs `doctor.ts` under a HOME with no `~/.secrets`,
runs the suite, and secret-scans **the export** rather than the working tree —
the four things session 67 did by hand. `dist-preflight/` is gitignored and the
script deletes it unless `--keep`.

**It never creates a repo, adds a remote, or pushes.** Steps 3, 4 and 6 below
are the user's by standing decision.

*Session 68 result:* PASSED — one `✗` (the JWT), `73 files, 1279 passed | 13
skipped (1292)`, secret scan clean. Session 67's four failures and eleven
never-collected tests are gone; the 13 skips are author-data suites announcing
themselves loudly, which is the designed outcome, not a regression.

Two false alarms in the script's own first run, fixed and worth knowing about
if it ever cries wolf again: counting `✗` anywhere matched doctor's summary
sentence as a second failure, and the secret scanner flagged `src/api/redact.ts`
for containing the field name it exists to redact.

## Order of operations, when the user decides to do it

1. Split `config/discovered.json`; game-global half off `.gitignore`, ROM
   enumeration into a gitignored per-profile file.
2. Add the MIT `LICENSE`.
3. `git checkout-index` (or a plain copy) of the ships-list into a clean directory
   — **not** a clone, so no `.git` comes with it.
4. `git init`, one commit, push to the new repo.
5. Clone it fresh somewhere else and run `npx tsx scripts/doctor.ts` **as a
   friend would** — no `~/.secrets` set up, no `data/`. The failures it prints
   are the actual first-run experience, and that is the only way to find out
   whether the guide is right.
6. `npm install && npx vitest run` in that fresh clone. If `fixtures/` was
   trimmed by accident, the sim tests fail there and pass at home.

Step 5 is the one worth not skipping. Everything else is mechanical.

**[session 67] Steps 5 and 6 have now been REHEARSED LOCALLY**, against a
gitignored `dist-preflight/` copy of this list — no repo, no push. Full report,
including every `doctor.ts` line verbatim and a copy-pasteable checklist for
steps 3–6: `handoff/reports/session-67-distribution-rehearsal.md`.

The short version: **`doctor.ts` and both live entry points are portable** —
one actionable failure, for the missing JWT, and nothing else. **The SUITE is
not.** Four test files assert against `data/`, `logs/` and `handoff/`, all
correctly on the does-not-ship list, so a friend's first `npx vitest run` is
red and eleven tests silently never run at all. `fixtures/` was NOT trimmed,
which is what step 6 was there to catch.

---

## The `romId` references in SPEC.md — DECIDED, they stay
**User decision, 2026-08-20 (session 61 §6). Recorded here with its reasoning
so nobody rediscovers it as a finding in six sessions and "fixes" it.**

Session 60's recap flagged that `SPEC.md` carries ROM token ids on 19 lines and
that `SPEC.md` ships — raised as an incomplete distribution safeguard, since
`config/discovered.json` had just been split precisely to remove those ids.

> The 19 `romId` references in SPEC.md are **ERC-721 token ids on a public
> chain**, already enumerable by anyone holding the contract address, and they
> anchor evidence whose value depends on being checkable (`romId 2097 claimed
> with amount:57 credited ~1.0`). Scrubbing them would cost the spec's
> evidentiary value to remove information that is not actually concealed.
> **Accepted exposure, deliberate, 2026-08-20.**

### What this decision does NOT change

- **No wallet addresses, no JWTs, no private keys in any shipped doc, ever.**
  That line is unmoved and is not what this decision is about.
- **`config/discovered.json`'s split stays exactly as shipped**, and
  `tests/discoveredShipsClean.test.ts` stays as its pin — including its
  SHA-256-hashed id list and its sixth check that no scalar matches
  `/romId\s*\d/i`. This decision is scoped to **`romId` references in SPEC.md
  prose** and nothing else.
- `SPEC-fishing.md` is already clean (its one apparent hit is `689` inside
  `1.689`).

### Why the two are treated differently, since that looks inconsistent

`config/discovered.json` is a **generated config file** — its ids are there to
be read by code, carry no argument, and cost nothing to remove. `SPEC.md`'s are
**citations inside an evidentiary claim**; removing them leaves a sentence that
asserts a measurement nobody can re-check. Same identifiers, different jobs,
different answers.

### Steps 3-6 remain the user's

An agent must not create or push the distribution repo. Steps 1-2 are done in
the tree.
