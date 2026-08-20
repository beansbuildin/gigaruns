/**
 * src/api/redact.ts — the ONE place fixture redaction rules live.
 *
 * [session 54] Why this module exists at all. The redaction logic was six
 * near-identical private `redact()` copies across `liveRun.ts`,
 * `liveFishing.ts`, `watch.ts`, `battleWatch.ts`, `probe.ts` and
 * `parseHar.ts`. That is this repo's single most recurrent defect shape —
 * "a fix applied to one class and the sibling with the identical field never
 * re-scored" (session 51, `serverErrorDetail`, its FOURTH instance) — and a
 * redaction rule is the worst possible thing to have six copies of, because
 * five of them being right is indistinguishable from six until someone reads
 * the fixtures.
 *
 * [session 54, user decision] `NOOB_TOKEN_CID` is redacted as of today.
 *
 * The reason, stated plainly so nobody "simplifies" it back out: the tracked
 * fixtures have redacted `PLAYER_CID` to `0xUSER` since session 08 while
 * keeping `NOOB_TOKEN_CID` at its real value, on a PUBLIC repo. The token id
 * is not a credential and nothing is compromised by it — but it is a stable
 * on-chain identifier for the same account the address redaction is hiding,
 * and `ownerOf(tokenId)` is a public call, so anyone who wants the address
 * can read it off the token. A redaction that does not do the thing it looks
 * like it does is worse than no redaction, because it invites the assumption
 * that the fixtures are anonymous.
 *
 * WHAT THIS DOES NOT DO: the token is in this repo's public git HISTORY back
 * to session 08. Redacting forward stops adding new instances; it does not
 * restore anonymity, and only a history rewrite would. See `fixtures/README.md`.
 */

/** Matches the convention already used for the address (`0xUSER`), username (`<USER>`) and jwt (`<JWT>`). */
export const NOOB_TOKEN_PLACEHOLDER = "<NOOB_TOKEN>";

/**
 * Redact the account's noob token id wherever it appears in a serialized JSON
 * body. Three rules, because the id appears in three shapes — and finding the
 * second and third only AFTER shipping the first is the whole lesson here.
 *
 * The session-54 backfill redacted `NOOB_TOKEN_CID` and then found the same id
 * still fully readable in 2,725 files as the suffix of an `EntityEquipment`
 * docId, and once more as the account doc's own `docId`. That is the exact
 * defect this redaction was fixing, reproduced one level down: a rule that
 * covers the obvious occurrence and leaves the identifier legible elsewhere.
 *
 * All three are keyed by SHAPE, not by known value — the same reasoning
 * `watch.ts` already applies to usernames. A hardcoded value list only redacts
 * what we already knew to look for, and this account is not the only one this
 * bot could ever run against.
 *
 * Nothing in `src/` or `scripts/` reads any of these fields, and `docId` is
 * typed as a plain `z.string()` in `schemas.ts`, so replacing them cannot
 * break a parse — verified session 54 by grep and by the full suite.
 *
 * WHAT IS DELIBERATELY NOT REDACTED: bare numeric `docId`s elsewhere (the
 * 12.9M-range game document ids) are game data, and a blanket rule would
 * flatten real corpus content. So is the long instance id preceding the token
 * in an `EntityEquipment` docId — rule 2 replaces the whole docId rather than
 * just the token suffix precisely because that leading id is also stable and
 * account-scoped, and trimming only the token would repeat the mistake again.
 */
export function redactNoobToken(text: string): string {
  return (
    text
      // 1. The field itself, numeric as sent or already-quoted so a re-run is
      //    a no-op.
      .replace(/("NOOB_TOKEN_CID"\s*:\s*)(?:\d+|"[^"]*")/g, `$1"${NOOB_TOKEN_PLACEHOLDER}"`)
      // 2. Entity docIds of the form `Type#<instanceId>-<noobToken>`. The
      //    whole value goes, not just the suffix — see above.
      .replace(/("docId"\s*:\s*")([A-Za-z]+)#\d+-\d+(")/g, `$1$2#${NOOB_TOKEN_PLACEHOLDER}$3`)
      // 3. The account doc, whose own `docId` IS the token. Keyed on the
      //    sibling `tableName: "GigaNoobNFT"` rather than on a numeric shape,
      //    because bare numeric docIds elsewhere are legitimate game data.
      .replace(
        /("docId"\s*:\s*)(?:\d+|"[^"]*")(\s*,\s*"tableName"\s*:\s*"GigaNoobNFT")/g,
        `$1"${NOOB_TOKEN_PLACEHOLDER}"$2`,
      )
  );
}
