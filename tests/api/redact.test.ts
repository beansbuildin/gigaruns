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

import { existsSync, readFileSync } from "node:fs";
import { announceMissingAuthorData, probeAuthorData } from "../helpers/authorData.js";

import {
  ADDRESS_PLACEHOLDER,
  NOOB_TOKEN_PLACEHOLDER,
  USERNAME_PLACEHOLDER,
  redactNoobToken,
  redactProse,
} from "../../src/api/redact.js";

/**
 * SYNTHETIC ids, deliberately. The first draft of this file used the real
 * token id and the real equipment instance id as test data — which would have
 * re-committed, into a tracked file, the exact identifier the module under
 * test exists to remove. Caught by the recap's secret scan, not by review.
 * The rules are keyed by SHAPE, so a fake id exercises them identically.
 */
const FAKE_NOOB = "11111";
const FAKE_INSTANCE = "22222222222222222222222222222222222222222222";

describe("redactNoobToken", () => {
  it("redacts the NOOB_TOKEN_CID field, numeric as the API sends it", () => {
    expect(redactNoobToken(`{"NOOB_TOKEN_CID": ${FAKE_NOOB}}`)).toBe(`{"NOOB_TOKEN_CID": "${NOOB_TOKEN_PLACEHOLDER}"}`);
  });

  it("is idempotent — re-redacting an already-redacted fixture is a no-op", () => {
    const once = redactNoobToken(`{"NOOB_TOKEN_CID": ${FAKE_NOOB}}`);
    expect(redactNoobToken(once)).toBe(once);
  });

  it("redacts the WHOLE entity docId, not just the token suffix", () => {
    // Trimming only the trailing token would leave the leading instance id,
    // which is also stable and account-scoped — the same half-measure this
    // module exists to stop.
    const raw = `{"docId": "EntityEquipment#${FAKE_INSTANCE}-${FAKE_NOOB}"}`;
    const out = redactNoobToken(raw);
    expect(out).toBe(`{"docId": "EntityEquipment#${NOOB_TOKEN_PLACEHOLDER}"}`);
    expect(out).not.toContain(FAKE_NOOB);
    expect(out).not.toContain(FAKE_INSTANCE);
  });

  it("redacts the account doc's own docId, keyed on tableName not on a value", () => {
    const raw = `{"docId": "${FAKE_NOOB}", "tableName": "GigaNoobNFT"}`;
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

/**
 * **[session 68 §3] The split this file needed.**
 *
 * The brief's reading was right: this was two kinds of test wearing one hat.
 * `redactNoobToken` and `redactProse` are PROGRAM LOGIC, they run on synthetic
 * input, and they always run — a stranger's clone must keep guarding the
 * redaction rules, because those rules are the code they were given.
 *
 * The two CORPUS SWEEPS below are different: they assert that the author's own
 * tracked files have actually had the rule applied. That is a fact about this
 * repository's contents, it cannot be reconstructed from a clean export, and
 * it gets a loud skip rather than a loosened assertion.
 *
 * Two separate probes on purpose — they can fail independently, and folding
 * them into one would skip a check that was perfectly runnable.
 */
const trackedJsonProbe = probeAuthorData("git-tracked JSON corpus", () => {
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  const out = execSync("git ls-files -z", { maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] })
    .toString("utf8")
    .split("\0")
    .filter((f) => f.endsWith(".json") || f.endsWith(".jsonl"));
  if (out.length === 0) throw new Error("no tracked .json/.jsonl files (not a git checkout of this repo?)");
});
announceMissingAuthorData("tests/api/redact.test.ts (tracked JSON sweep)", trackedJsonProbe);

/** The three handoff documents session 55 backfilled. `handoff/` does not ship. */
const HANDOFF_DOCS = [
  "handoff/log/session-02.md",
  "handoff/log/session-07.md",
  "handoff/scratch-session-02.md",
];
const handoffProbe = probeAuthorData("handoff/ prose documents", () => {
  const missing = HANDOFF_DOCS.filter((f) => !existsSync(f));
  if (missing.length > 0) throw new Error(`${missing.length} of ${HANDOFF_DOCS.length} absent (first: ${missing[0]})`);
});
announceMissingAuthorData("tests/api/redact.test.ts (handoff prose sweep)", handoffProbe);

describe("the tracked corpus is actually redacted", () => {
  it.skipIf(!trackedJsonProbe.ok)("no tracked file carries a raw NOOB_TOKEN_CID or an unredacted entity docId", async () => {
    // The rule is only worth anything if it has been APPLIED. This asserts the
    // backfill, not just the function.
    const { execSync } = await import("node:child_process");
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

describe("redactProse — [session 55] handoff documents, not JSON", () => {
  // Synthetic ids throughout. The rules are keyed on the LABEL next to the
  // value, never on the value itself, so a made-up id exercises them exactly
  // as the real one would — and session 54's dead end is that writing the real
  // identifier into a test re-commits the very thing the module removes.
  it("redacts a noobId written in prose, with or without a colon", () => {
    expect(redactProse("- Account: noobId 11111, energy 332/420")).toBe(
      `- Account: noobId ${NOOB_TOKEN_PLACEHOLDER}, energy 332/420`,
    );
    expect(redactProse("noobId: 11111")).toBe(`noobId: ${NOOB_TOKEN_PLACEHOLDER}`);
    expect(redactProse("noob id 11111")).toBe(`noob id ${NOOB_TOKEN_PLACEHOLDER}`);
  });

  it("redacts a quoted username in any of the three quote styles", () => {
    expect(redactProse('username "someone"')).toBe(`username "${USERNAME_PLACEHOLDER}"`);
    expect(redactProse("username `someone`")).toBe(`username \`${USERNAME_PLACEHOLDER}\``);
    expect(redactProse("username: 'someone'")).toBe(`username: '${USERNAME_PLACEHOLDER}'`);
  });

  it("redacts a TRUNCATED address, which is the shape a session log actually carries", () => {
    expect(redactProse("prints `address 0xAB12...`")).toBe(`prints \`address ${ADDRESS_PLACEHOLDER}...\``);
  });

  it("leaves git SHAs alone — the rule that would have eaten them is why every rule needs a label", () => {
    // These are quoted in every STATE header; losing them destroys the one
    // thing that makes a session log checkable.
    const line = "# STATE — session 07 — commit ff36aa1 — `git diff 2f78c74..ff36aa1 --stat`";
    expect(redactProse(line)).toBe(line);
  });

  it("leaves an unlabelled hex string and a bare number alone — a stated limit, not an oversight", () => {
    expect(redactProse("the contract at 0xdeadbeefcafe holds 11111 items")).toBe(
      "the contract at 0xdeadbeefcafe holds 11111 items",
    );
  });

  it("leaves the word 'username' alone when no quoted value follows it", () => {
    const line = "the username field is redacted by key, not by value";
    expect(redactProse(line)).toBe(line);
  });

  it("is idempotent — re-running over an already-redacted document changes nothing", () => {
    const once = redactProse('address 0xAB12... username "someone" noobId 11111');
    expect(redactProse(once)).toBe(once);
  });

  it.skipIf(!handoffProbe.ok)("the three tracked handoff documents are redacted — the corpus-level assertion, not just the function's", () => {
    // Same shape as the fixture-corpus test above: asserting the FILES are
    // clean, not merely that the function can clean them. A future edit that
    // re-introduces an identifier fails here.
    for (const file of HANDOFF_DOCS) {
      const text = readFileSync(file, "utf8");
      expect(redactProse(text), `${file} is not prose-redacted`).toBe(text);
    }
  });
});
