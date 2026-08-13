# STATE — session 01 — 2026-08-12 — commit 23c0a33

## Status
Task 1 "Scaffold": **GATE PASS**
Next per TASKS.md: Task 2 — Auth (Path A) + API client
Overall: Repo is initialised, public at github.com/beansbuildin/gigaruns, and
typechecks clean. No bot logic exists yet and nothing has ever touched the live
Gigaverse API.

## What works
- `npx tsc --noEmit` — exit 0, TypeScript 5 strict + NodeNext ESM.
- `npx vitest run` — vitest 4.1.10 boots, 0 test files (none written yet).
- `npm audit` — 0 vulnerabilities.
- `.gitignore` verified with `git check-ignore` against `.env`,
  `config/discovered.json`, `data/`, `logs/`, `*.key`, `fixtures/**/*.har` —
  all six IGNORED.
- Secret scan over all tracked files — 0 hits for wallet addresses or JWTs.
- Directory tree per SPEC §6 exists, `.gitkeep` in every empty tracked dir.

## What's broken
- Nothing broken. But note the scale of what is *absent*: `src/` is entirely
  empty. Every file under `src/api/`, `src/strategy/`, `src/sim/`, and
  `src/orchestrator/` named in SPEC §6 is still a directory with a `.gitkeep`
  in it. Task 1 was scaffolding only, by instruction.

## Corrections to SPEC.md
None this session — no live response has been observed yet, so there is nothing
to correct the spec against. Everything marked `[VERIFY]` remains unverified.

Two code-level corrections, not spec corrections:
- `scripts/probe.ts:86` did not compile as downloaded. `await res.json()` is
  typed `unknown` by `@types/node`, so `body.jwt` was a TS18046 error. Added
  `as Record<string, any>` at the call. Type-only; behaviour unchanged. The
  script's own "show the real keys" throw on line 89 is intact.
- Resolved IDs: forbiddenWoods=UNKNOWN, dendren=UNKNOWN (probe not yet run).
- Move charges: UNKNOWN — `probe.ts` has not been executed against a session.

## Dead ends
- vitest 2.x: pulled a vulnerable vite/esbuild tree (`npm audit` reported 5
  vulnerabilities, 1 critical). Upgraded to vitest 4.1.10, which reports 0.
  Don't pin back to 2.x without re-auditing.

## Metrics
No data. Nothing has been simulated or played.

## Open questions for Claude
Both carried forward unanswered from session 00 — session 01 was scaffolding
and could not resolve either.

1. **Auth path (blocks Task 2).** Does the user play through Abstract Global
   Wallet? If so, a bot-owned EOA authenticates a *different, empty* account
   (SPEC §1a) — login succeeds, character is missing, and the failure looks
   like a bug rather than a wrong account. Path A (JWT copied from the browser,
   at `~/.secrets/gigaverse-jwt.txt`) is the default until confirmed. Task 2
   cannot be verified without that file existing.
2. **Fishing HAR (blocks Task 7).** Needs one Dendren cast captured from the
   browser at `fixtures/fishing-cast.har`. Everything about the fishing API
   comes out of that file. Nothing in Tasks 2–6 depends on it, so it is not
   urgent yet — but it has a human in the loop, so asking early is cheap.

A third, new, and answerable without the user:
3. **Task 2 vs Task 3 ordering.** Task 3 is marked "the unblocking task" and
   `probe.ts` already exists and compiles. It has its own inline auth and does
   not import `src/api/`. If a valid JWT is available, running the probe first
   would resolve the dungeon ID, the charge question, and real response shapes —
   which would let Task 2's zod schemas be written against ground truth instead
   of against the spec's guesses. Worth reordering?

## Files changed
```
 .gitignore                        |  12 ++
 .claude/commands/handoff.md       |  46 ++    (moved from root)
 .claude/commands/recap.md         | 100 ++    (moved from root)
 handoff/STATE.md                  |  45 ++    (moved from root)
 handoff/DECISIONS.md              |  10 ++    (new, header only)
 handoff/log/.gitkeep              |   0 ++
 scripts/probe.ts                  | 269 ++    (moved from root, 1 type fix)
 package.json                      |  27 ++
 package-lock.json                 |      ++
 tsconfig.json                     |  30 ++
 vitest.config.ts                  |  12 ++
 src/{api,sim,orchestrator}/.gitkeep
 src/strategy/{dungeon,fishing}/.gitkeep
 fixtures/{probe,dungeon-runs,fishing-casts}/.gitkeep
 config/.gitkeep  tests/.gitkeep
 CLAUDE.md SPEC.md TASKS.md PROTOCOL.md — unchanged, stayed in root
```
