/**
 * tests/api/redact.test.ts — [session 54] the fixture redaction rules.
 *
 * These exist because the redaction they replace was WRONG in a specific,
 * instructive way for 46 sessions: it redacted `PLAYER_CID` to `0xUSER` while
 * leaving `NOOB_TOKEN_CID` at its real value on a public repo, so the
 * fixtures looked anonymous while staying trivially linkable via a public
 * `ownerOf()` call. Then the first fix repeated the mistake one level down,
 * leaving the same id readable as a docId suffix in 2,725 files.
 *
 * So the thing worth testing is not "does it replace a number" — it is that
 * every SHAPE the id appears in is covered, and that the shapes deliberately
 * left alone stay alone.
 */

import { describe, expect, it } from "vitest";

import { redactNoobToken, NOOB_TOKEN_PLACEHOLDER } from "../../src/api/redact.js";

describe("redactNoobToken", () => {
  it("redacts the NOOB_TOKEN_CID field, numeric as the API sends it", () => {
    expect(redactNoobToken('{"NOOB_TOKEN_CID": 72946}')).toBe(`{"NOOB_TOKEN_CID": "${NOOB_TOKEN_PLACEHOLDER}"}`);
  });

  it("is idempotent — re-redacting an already-redacted fixture is a no-op", () => {
    const once = redactNoobToken('{"NOOB_TOKEN_CID": 72946}');
    expect(redactNoobToken(once)).toBe(once);
  });

  it("redacts the WHOLE entity docId, not just the token suffix", () => {
    // Trimming only the trailing token would leave the leading instance id,
    // which is also stable and account-scoped — the same half-measure this
    // module exists to stop.
    const raw = '{"docId": "EntityEquipment#79966817350501100526447415351088260038671993089879876864314793285447998749147-72946"}';
    const out = redactNoobToken(raw);
    expect(out).toBe(`{"docId": "EntityEquipment#${NOOB_TOKEN_PLACEHOLDER}"}`);
    expect(out).not.toContain("72946");
    expect(out).not.toContain("799668173505011");
  });

  it("redacts the account doc's own docId, keyed on tableName not on a value", () => {
    const raw = '{"docId": "72946", "tableName": "GigaNoobNFT"}';
    expect(redactNoobToken(raw)).toBe(`{"docId": "${NOOB_TOKEN_PLACEHOLDER}", "tableName": "GigaNoobNFT"}`);
  });

  it("leaves bare numeric game docIds alone — they are corpus content, not identity", () => {
    // The 12.9M-range fishing/dungeon document ids. A blanket numeric-docId
    // rule would flatten real data across thousands of fixtures.
    const raw = '{"docId": "12992261", "tableName": "SomethingElse"}';
    expect(redactNoobToken(raw)).toBe(raw);
  });

  it("leaves contract-style and unrelated fields alone", () => {
    const raw = '{"lastNoobId": 82348, "maxNoobId": 10000, "LEVEL_CID": 1}';
    expect(redactNoobToken(raw)).toBe(raw);
  });
});

describe("the tracked corpus is actually redacted", () => {
  it("no tracked file carries a raw NOOB_TOKEN_CID or an unredacted entity docId", async () => {
    // The rule is only worth anything if it has been APPLIED. This asserts the
    // backfill, not just the function.
    const { execSync } = await import("node:child_process");
    const { readFileSync } = await import("node:fs");
    const files = execSync("git ls-files -z", { maxBuffer: 1 << 28 })
      .toString("utf8")
      .split("\0")
      .filter((f) => f.endsWith(".json") || f.endsWith(".jsonl"));
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      if (text !== redactNoobToken(text)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
