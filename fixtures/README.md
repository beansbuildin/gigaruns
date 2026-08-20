# fixtures/ — what is redacted, and what that does and does not achieve

These are real captured API responses from a real Gigaverse account, committed
to a **public** repository (DECISIONS.md, 2026-08-12). This file exists so
nobody has to infer the redaction policy from the redacted values — which is
exactly how the policy went wrong for forty-six sessions.

## Redacted

| What | Becomes | Applied by |
|---|---|---|
| Wallet address (checksummed, lower, upper) | `0xUSER` | each capture script's own `redact()` |
| Any `*username*` key's value | `<USER>` | same, redacted **by key**, not by known value |
| The full JWT | `<JWT>` | `GigaverseClient.redactSecrets` |
| `NOOB_TOKEN_CID` | `"<NOOB_TOKEN>"` | `src/api/redact.ts` |
| Entity docIds shaped `Type#<instanceId>-<noobToken>` | `Type#<NOOB_TOKEN>` | `src/api/redact.ts` |
| The account doc's own `docId` (keyed on `tableName: "GigaNoobNFT"`) | `"<NOOB_TOKEN>"` | `src/api/redact.ts` |
| Per-ROM `lastTx` hashes and any `0x` + 20 hex (probe only) | `0x<REDACTED>` | `scripts/probeRomsPlayer.ts` |

Handoff **prose** (session logs, scratch notes) is a separate pass:
`redactProse()` in `src/api/redact.ts` redacts `noobId <digits>`, a quoted
`username "…"`, and `address 0x…` (full or truncated). Each rule requires the
identifier's own label, which is what keeps commit SHAs and contract addresses
intact. It will NOT find an identifier written without its label — check the
output, not the exit code.

Raw, unredacted bodies stay in `<rundir>/raw/`, covered by the
`fixtures/**/raw/` ignore rule. They are never committed.

## Deliberately NOT redacted

- **Bare numeric `docId`s** (the 12.9M-range game document ids). These are
  corpus content — fish, items, dungeon documents — and a blanket numeric rule
  would flatten thousands of files of real data.
- **Contract addresses.** Game data. A blanket `0x[0-9a-f]{40}` rule would
  destroy them along with the account address, which is why every script
  redacts the account address by value rather than by shape.
- Everything else: stats, moves, loot tables, boon offers, RNG outcomes. That
  is the entire point of the corpus.

## What the redaction does NOT achieve

**Two things, stated plainly, because a redaction that looks stronger than it
is is worse than none at all.**

1. **The git HISTORY still contains the noob token id.** It was committed
   unredacted from session 08 (2026-08-13) until session 54 (2026-08-20). The
   backfill rewrote the working tree, not history. Anyone reading old commits
   can still recover it, and `ownerOf(tokenId)` is a public call on Abstract —
   so the address redaction in historical commits is, for practical purposes,
   undone by the token in the same commit. Only a history rewrite would change
   this, and that was weighed and declined (it force-pushes over a public
   repo's history and invalidates every clone and commit hash).

2. ~~Three tracked handoff documents still name the account in plaintext.~~
   **RESOLVED, session 55, by user decision: the three documents are redacted;
   git history is deliberately left alone.** `handoff/log/session-02.md`,
   `handoff/log/session-07.md` and `handoff/scratch-session-02.md` carried the
   noob id, and session-07 also the username and a truncated address. They were
   never covered by anything in `src/api/redact.ts` — and could not have been,
   because every rule there is keyed on a JSON field shape and these files are
   hand-written English. `redactProse()` was added for exactly this, keyed on
   the identifier's LABEL rather than its shape, so it cannot eat the git SHAs
   quoted in every STATE header. `tests/api/redact.test.ts` asserts the three
   FILES are clean, not merely that the function can clean them.

   **What that does not reach:** limit 1 above still stands unchanged for these
   documents too. The redacted values are in the git history of this repo from
   the sessions that wrote them, and history was NOT rewritten.

### Why history was not rewritten (asked and answered; session 54 weighed it, session 55 confirmed it)

A rewrite force-pushes over a public repository: it invalidates every clone and
every commit SHA cited in past `STATE.md` and session-log headers — which is
the one thing that makes those logs checkable. Against that, it buys little.
Nothing here is a credential (CLAUDE.md §3 covers secrets; no key, signature or
JWT has ever been committed), and the repository owner is already public by
`DECISIONS.md` 2026-08-12. The forward-looking redaction stops adding new
instances; that is the whole of what it claims to do.

**So: treat these fixtures as account-identifying.** They are safe to publish
in the sense that they contain no credentials — CLAUDE.md §3 covers secrets,
and no key, signature or JWT has ever been committed. They are not anonymous.
