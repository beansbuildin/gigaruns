# session 120 — 2026-09-03 — OFFLINE, no live game calls

User asked to pivot this thread toward a public front end so other people
could use the bot, showing an Abstract-wallet-connect login screen from
another autobattler (fireball.gg) as the reference pattern. Full write-up:
`handoff/DECISIONS.md`, 2026-09-03 (session 120). This file is the
index/recap.

## The conflict, found before writing any code

Two places in this repo already make an explicit, considered decision
against exactly the hosted/wallet-custody pattern the reference screenshot
implied:

- `README.md`, "Not planned": *"No web UI, no hosted service, no dashboard,
  no one else holding your token... If it ever grows a server, the safety
  sentence at the top stops being true, and that sentence is the point."*
- `src/api/auth.ts`'s doc comment (2026-08-20): the old bot-owned-EOA login
  path was deleted because *"a bot that reads a private key cannot make the
  one promise this repo can otherwise make: it asks for a session token,
  not custody of a wallet."*

Presented this directly rather than building past it. Asked the user how to
resolve it; the answer was to build the **self-run** front end — honoring
`src/profile.ts`'s already-documented "Model A" (each person runs the bot
themselves, own machine, own JWT, no hosting, no custody) — not the hosted
version.

## Side research (recorded, not acted on)

Gigaverse's own login is SIWE (wallet signs a timestamped message, that
signature is POSTed for a JWT). Its ToS (`gigaverse.io/legal/terms`)
permits "automated gameplay (using approved agents or similar)" and doesn't
ban third-party tools outright, but prohibits account-access sharing/leasing
and caps one identity per user. Neither confirms nor rules out a hosted
product — "approved agents" implies some kind of allowlist, not chased
further since it stopped being relevant once the self-run path was chosen.
Left here in case a future session revisits the hosted question.

## What got built: `web/`

A local-only setup/status/run control panel — Express (TypeScript) backend,
React/Vite frontend, both bound to `127.0.0.1` only. The backend imports
only `src/profile.ts` / `src/api/auth.ts` directly; every actual
game-playing action (doctor check, dungeon run, fishing batch) is spawned
as the exact existing CLI script via an allowlisted endpoint — no game
logic is reimplemented, and a live (non-dry-run) job requires
`confirmed: true` enforced server-side. Output streams to the browser over
SSE. Four tabs: Setup, Status, Budgets, Run. Full detail in `web/README.md`.

## Verification — narrower than usual, and said so

Isolated sandbox, and DELIBERATELY missing `src/sim`/`src/strategy`/
`scripts/` (see `web/README.md`'s explanation for why the backend doesn't
import that graph). Confirmed: both halves type-check clean, the client
builds, the built client is served correctly by the backend from one
origin, JWT/config save-and-read round-trip, and the job-allowlist's three
safety checks (unknown kind, live-without-confirmed, path-traversal
profile name) all reject correctly. A job spawn against a script that
doesn't exist in the sandbox (by design) proved the error path works
cleanly rather than crashing the server. **Never actually run
`doctor.ts`/`liveRun.ts`/`liveFishing.ts` for real** — that needs the real
repo, and is the next thing to check before trusting this past "the
plumbing works."

## Left for the user

`README.md`'s "No web UI" line is now imprecise (a *local-only* one exists)
without breaking the actual promise ("no one else holding your token").
Flagged rather than edited — a specific wording change is proposed
separately, not applied silently to the project's own safety document.

## Renumbering note

`handoff/next.md` had already been written this same day (session 119) as
"BRIEF — session 120." Since this session's own work landed first, that
brief is renumbered to session 121 — content unchanged, only the number.
