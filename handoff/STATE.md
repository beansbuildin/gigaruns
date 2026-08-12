# STATE — session 00 — project init — commit (none yet)

## Status
Task 0 "handoff setup": **IN PROGRESS**
Next per TASKS.md: Task 1 — Scaffold
Overall: Repo seeded with spec, tasks, rules, and handoff protocol. No code
written yet. Nothing has touched the live API.

## What works
- Nothing verified. This is session zero.

## What's broken
- Nothing yet.

## Corrections to SPEC.md
None this session. **Note for whoever reads this next:** `SPEC.md` was written
from Gigaverse's public docs and their official agent skill. Every item marked
`[VERIFY]` is an educated guess and some of it is probably wrong. Forbidden
Woods and Dendren are not publicly documented at all — their IDs must come out
of `probe.ts`, never out of the spec.

## Dead ends
None yet.

## Metrics
No data.

## Open questions for Claude
1. **Auth path** — does the user play through Abstract Global Wallet? If so, a
   bot-owned EOA authenticates a *different, empty* account (SPEC §1a). Path A
   (browser JWT) is the default until this is confirmed.
2. **Fishing HAR** — Task 7 is blocked until the user captures one Dendren cast
   from the browser. Everything about the fishing API comes from that file.

## Files changed
```
CLAUDE.md              rules of engagement
SPEC.md                architecture, API surface, strategy design
TASKS.md               11 tasks, each with a verification gate
PROTOCOL.md            the Claude ⇄ Claude Code loop
scripts/probe.ts       read-only discovery
.claude/commands/      recap.md, handoff.md
handoff/STATE.md       this file
```
