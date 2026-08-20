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

2. **Three tracked handoff documents still name the account in plaintext** —
   `handoff/log/session-02.md`, `handoff/log/session-07.md`, and
   `handoff/scratch-session-02.md` carry the noob id, and session-07 also
   carries the username and a partial address. The redaction effort has always
   been scoped to `fixtures/`; the session logs were written by hand and never
   passed through any `redact()`. They are not covered by anything in
   `src/api/redact.ts`. Left as-is pending a decision, and recorded here rather
   than quietly fixed, since the username is plausibly a public game handle and
   that is the account holder's call, not the bot's.

**So: treat these fixtures as account-identifying.** They are safe to publish
in the sense that they contain no credentials — CLAUDE.md §3 covers secrets,
and no key, signature or JWT has ever been committed. They are not anonymous.
