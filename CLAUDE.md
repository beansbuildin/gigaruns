# CLAUDE.md — Gigaverse Autoplay Bot

You are building an autonomous bot that plays **Forbidden Woods** (dungeon) and
**Dendren fishing** in Gigaverse on Abstract chain.

Read `SPEC.md` for architecture and strategy design. Work through `TASKS.md` in
order. Do not skip the verification gate at the end of each task.

---

## Non-negotiables

**1. Discover, don't assume.**
Every ID, field name, and enum in `SPEC.md` marked `[VERIFY]` is a guess. The
dungeon ID for Forbidden Woods and the fishing-node ID for Dendren are **not
publicly documented** — you must find them at runtime via `scripts/probe.ts` and
write the real values into `config/discovered.json`. If a field you expected is
missing from a live response, the spec is wrong and the live response is right.
Update the spec and say so in your commit message.

**2. Never invent an endpoint.**
Only call paths confirmed by `probe.ts` output or listed as CONFIRMED in
`SPEC.md`. If you need an endpoint that doesn't exist yet, dump the full response
of a related endpoint and look for it. Do not brute-force URLs.

**3. Secrets never enter the repo.**
Private key and JWT live in `~/.secrets/`, loaded via env. Add `.env`,
`*.key`, `config/discovered.json` to `.gitignore` before writing any auth code.
Never log a key, a signature, or a full JWT — log `jwt[0..8] + "..."` at most.
If you ever print one by accident, stop and tell the user to rotate.

**4. Energy is real money. Simulate first.**
No strategy code gets tested against the live API until it passes against
recorded fixtures in `fixtures/`. The sim harness is Task 4 and it is not
optional. A bad move loop can burn a full day's energy in under a minute.

**5. Fail closed.**
On any unexpected state — unknown enum, HTTP 5xx, three consecutive action
failures, energy below threshold, daily cap hit — stop the loop, log the full
response body to `logs/`, exit non-zero. Never guess an action to "keep going."
A stopped bot costs nothing. A confused bot costs energy and items.

**6. Rate limits.**
Minimum 1200ms between actions, plus 0–400ms jitter. Exponential backoff on 429
starting at 5s. The action-token window is ~5s — if you go too fast the server
rejects the token, and if you go too slow it goes stale. Handle both.

---

## Working style

- **TypeScript, Node 20+, `viem` for signing.** Abstract tooling is TS-first.
- Run `npx tsc --noEmit` and the test suite before declaring a task done.
- Commit after each task with the verification output pasted in the message.
- Keep the API client (`src/api/`) free of game logic, and the strategy modules
  (`src/strategy/`) free of network calls. Strategy takes a state object and
  returns a decision — pure functions, trivially testable. This separation is
  what makes the sim harness possible, so don't collapse it for convenience.

## When you get stuck

Write your question and the relevant response dump into `QUESTIONS.md` at the
repo root, then **continue with the next unblocked task**. Do not idle waiting
for a human. The user will paste `QUESTIONS.md` into a chat with Claude and
bring back answers.

Blocking is only acceptable for: a missing private key/JWT, an on-chain
transaction that would spend ETH, or anything in the "Ask first" list below.

## Ask first — never do these autonomously

- Send any on-chain transaction that spends ETH (minting, buying GigaJuice,
  marketplace purchases). The bot plays; it does not spend.
- Sell, burn, or list any item. Fish and loot accumulate; the user decides.
- Spend energy above the configured daily budget in `config/bot.json`.
- Level up / allocate skill points (this is irreversible without Hourglasses).

Reading, playing dungeon runs, playing fishing casts, and looting are all fine
to do autonomously within the configured budget.
