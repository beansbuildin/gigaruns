# DISTRIBUTION — what ships, what does not, and the one thing only the user can do

Drafted session 59 against the portability brief §3. **Nothing here has been
executed.** Creating or pushing the distribution repo is the user's call and
involves their GitHub account, so this is a checklist, not a script.

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
| `config/discovered.json` | **game-global, not per-account** — Forbidden Woods is dungeon 5 and `maxRoom` 16 for everyone (confirmed on four dungeons, session 57). Shipping it saves every friend a `probe.ts` run. **Currently gitignored** — see the open item below |
| `SPEC.md`, `SPEC-fishing.md` | what the API actually does, verified against live responses |
| `CLAUDE.md` | explains *why* the odd rules exist; most are scar tissue from a specific incident |
| `PROTOCOL.md` | how the project is worked on |
| `package.json`, `tsconfig.json`, `.gitignore` | build |

## Does not ship

| Path | Why |
|---|---|
| `data/` | the author's learned state and spend ledgers — opponent model, guard budgets, play counts, mined fishing patterns. Personal, and useless to anyone else |
| `logs/` | raw captures, unredacted by design |
| `handoff/` | ~250KB of session notes naming the account, plus this file. Reads as an internal document because it is one |
| `QUESTIONS.md`, `TASKS.md` | the author's working queue, not a user's concern |
| `~/.secrets/` | never in the repo; not even referenced except by path |

---

## Open items — decisions only the user can make

1. **`config/discovered.json` is in `.gitignore`** (CLAUDE.md rule 3, from day
   one when nobody knew whether it held anything sensitive). It does not: it
   holds dungeon IDs, energy costs and room counts, all game-global. To ship it,
   it must come off the ignore list — **a deliberate change to a rule-3 line**,
   which is why it is listed here rather than done. The alternative is telling
   each friend to run `npx tsx scripts/probe.ts` first, which works and costs
   them one command.
2. **Where the distribution repo lives**, and whether it is public. The working
   repo is public today (DECISIONS 2026-08-12).
3. **A licence.** There is none. Absent one, nobody has permission to use it.

---

## Order of operations, when the user decides to do it

1. Take `config/discovered.json` off `.gitignore`, or decide friends run `probe.ts`.
2. Add a licence.
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
