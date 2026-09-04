# Giga bot — local web UI

A local setup/status/run control panel for the bot in the parent repo. This
exists so someone who isn't comfortable with a terminal can still use the
bot — it does not change what the bot promises.

**It is local-only, on purpose, same as the CLI.** There is no server to
deploy, no account but your own, and nothing anyone else ever holds. See
the root [`README.md`](../README.md)'s safety section — this UI is a
front end on the same trust boundary, not a new one. Concretely:

- The backend binds to `127.0.0.1` only. It is never reachable from your
  network, let alone the internet.
- Your JWT goes straight into the same file the CLI already reads
  (`~/.secrets/gigaverse-jwt.txt`, or the per-profile equivalent). This UI
  never sends it anywhere else.
- Every action that can actually play the game — a dungeon run, a fishing
  batch — is the exact same script the CLI runs (`scripts/liveRun.ts`,
  `scripts/liveFishing.ts`), invoked with the same flags, subject to the
  same guards. This UI adds no new game-playing code path; it's a thinner
  layer that spawns the already-tested one and shows you its output.
- A live (non-dry-run) action requires an explicit confirmation in the UI,
  and the backend independently refuses to run one without that
  confirmation — the safeguard isn't only in the browser.

## Running it

Two processes, both local:

```bash
# Terminal 1 — the backend
cd web/server
npm install
npm run dev          # http://127.0.0.1:4173

# Terminal 2 — the frontend
cd web/client
npm install
npm run dev           # http://127.0.0.1:5173, proxies /api to the backend
```

Open `http://127.0.0.1:5173`. Use the **Setup** tab first — it walks
through the same six steps as the root README's "Get your token" section,
just in a form instead of a terminal.

For a single command that serves everything from one port (no separate
dev server): build the client once, then just run the backend —

```bash
cd web/client && npm install && npm run build
cd ../server && npm install && npm start   # http://127.0.0.1:4173, serves the built UI too
```

## What's here

| Path | What it is |
|---|---|
| `server/` | Express backend (TypeScript). Binds `127.0.0.1` only. Reuses `src/profile.ts` and `src/api/auth.ts` from the parent repo directly for profile/JWT-path conventions; every actual game action is spawned as the existing CLI script, never reimplemented. |
| `client/` | React + Vite frontend. Setup wizard, a status panel (runs `doctor.ts`), a budget editor (`config/bot.json`), and run controls (dry-run always available; live runs need confirmation). |

## Why the backend doesn't import the strategy/sim code directly

`server/src/parentRepo.ts` explains this in its own doc comment, but the
short version: `src/orchestrator/config.ts` and the actual game-decision
code pull in a large dependency graph (hundreds of KB across `src/sim/` and
`src/strategy/`). Importing that into an HTTP server would mean either a
second, undertested copy of game-decision logic reachable only from a
browser, or carrying the whole graph into a process that doesn't need it.
Instead, every action that actually plays the game is a spawned child
process running the exact script the CLI already runs — one code path,
one set of tests, one place a bug could be.

## Status

v1. Built and type-checked in an isolated sandbox (not the real repo — see
the delivery note in `handoff/DECISIONS.md`). Not yet run against the real
repo's own scripts end-to-end (the sandbox doesn't have `scripts/` or the
`src/sim`/`src/strategy` tree, deliberately, per the point above) — that
needs a real run against the actual repo before this is trusted beyond
"the plumbing works."
