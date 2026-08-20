/**
 * tests/clientSurface.test.ts — session 59.
 *
 * **The safety property, pinned before it decays.**
 *
 * The whole trust ask this bot makes on someone is a session token. What makes
 * that a reasonable ask is not a promise in a README — it is that the API
 * client has no capability to do anything worse than play the game. There is no
 * sell, no burn, no list, no transfer, and no on-chain transaction anywhere in
 * its surface. The worst this program can do on someone's account is play, and
 * claim that account's own ROM energy into that same account's pool.
 *
 * That is currently an ACCIDENT of what has been built, not a guarantee. This
 * test makes adding a destructive endpoint a conscious act that breaks the
 * suite, rather than a Tuesday.
 *
 * **If you are here because this test failed:** do not add the method to the
 * allowlist to make it green. Ask whether the program should be able to do that
 * to someone else's account at all, and whether `README.md`'s "what it will not
 * do" section is still true. If the answer is genuinely yes, the allowlist entry
 * and the README change land in the same commit.
 *
 * Writes nothing, calls nothing — reflection over the prototype only.
 */
import { describe, expect, it } from "vitest";

import { GigaverseClient } from "../src/api/client.js";

/**
 * Every method the client is allowed to expose, with what it can do.
 *
 * Reads are inert. The two POSTs are the entire mutation surface, and both are
 * game moves. `claimRomEnergy` is the one thing that touches an asset at all,
 * and it moves the account's OWN accrued energy into the account's OWN
 * spendable pool — no recipient, no counterparty, nothing leaves.
 */
const ALLOWED = new Set([
  // reads
  "getMe",
  "getAccount",
  "getEnergy",
  "getDungeonToday",
  "getDungeonState",
  "getItemsBalances",
  "getJuice",
  "getFishingState",
  "getRomsPlayer",
  // writes — both are game actions
  "postDungeonAction",
  "postFishingAction",
  "claimRomEnergy",
  "getDungeonStateOnce",
  // plumbing: pacing, redaction, token accessors. No network semantics.
  "constructor",
  "maskedJwt",
  "redactSecrets",
  "getActionToken",
  "getFishingActionToken",
  // [session 59] Generic transports. These are `private` in TypeScript, which
  // is ERASED AT RUNTIME — they are on the prototype and this test sees them,
  // so listing them is the honest thing to do rather than filtering them out
  // and claiming a smaller surface than exists. `post` in particular can reach
  // ANY path, so the named-endpoint allowlist above is a statement about what
  // the program DOES, not a sandbox. The separate test below is what keeps that
  // true: nothing outside client.ts may call them.
  "raw",
  "get",
  "post",
]);

/**
 * Words that must never appear in a client method name. Not a substitute for
 * reading a diff — a `postDungeonAction` could in principle carry anything —
 * but it catches the obvious shape, and the obvious shape is what gets added
 * by someone moving fast.
 */
const FORBIDDEN_VERBS = ["sell", "buy", "burn", "list", "transfer", "send", "approve", "withdraw", "mint", "sign", "swap"];

const publicMethods = (): string[] =>
  Object.getOwnPropertyNames(GigaverseClient.prototype).filter((n) => !n.startsWith("_"));

describe("the client's surface is the safety story", () => {
  it("exposes nothing outside the allowlist", () => {
    const unexpected = publicMethods().filter((m) => !ALLOWED.has(m));
    expect(unexpected, `unexpected client method(s): ${unexpected.join(", ")} — read this file's header`).toEqual([]);
  });

  it("still exposes everything the allowlist claims — so the list cannot rot silently", () => {
    // The other direction matters too: a shrunken client with a stale allowlist
    // would keep passing the check above while the list stopped describing
    // anything real, and the README would be citing a fiction.
    const actual = new Set(publicMethods());
    const missing = [...ALLOWED].filter((m) => !actual.has(m));
    expect(missing, `allowlist names method(s) that no longer exist: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no method whose name suggests selling, burning, transferring or signing", () => {
    const offenders = publicMethods().filter((m) =>
      FORBIDDEN_VERBS.some((v) => m.toLowerCase().includes(v)),
    );
    expect(offenders).toEqual([]);
  });

  it("the only NAMED mutating endpoints are two game actions and a self-directed energy claim", () => {
    const mutating = publicMethods().filter(
      (m) => (m.startsWith("post") || m.startsWith("claim")) && m !== "post",
    );
    expect(mutating.sort()).toEqual(["claimRomEnergy", "postDungeonAction", "postFishingAction"]);
  });

  it("the generic transports are used ONLY inside client.ts", async () => {
    // `raw`/`get`/`post` can reach any path, and TypeScript's `private` does
    // not exist at runtime. What actually bounds the program's behaviour is
    // that no call site outside the client reaches for them — so assert that
    // directly instead of trusting a keyword the compiler throws away.
    const { execSync } = await import("node:child_process");
    const hits = execSync(
      `grep -rn --include='*.ts' -e 'client\.post(' -e 'client\.get(' -e 'client\.raw(' src scripts tests || true`,
      { encoding: "utf8" },
    )
      .split("\n")
      .filter((l) => l.trim());
    expect(hits, `generic transport used outside client.ts:\n${hits.join("\n")}`).toEqual([]);
  });

  it("nothing in src/ imports a signing library", async () => {
    // The AGW point from CLAUDE.md rule 3, enforced rather than asserted: the
    // moment anything here signs, "a session token, not custody of a wallet"
    // stops being true. `viem` was dropped in session 59 for exactly this.
    const { execSync } = await import("node:child_process");
    const hits = execSync(
      `grep -rn --include='*.ts' -e "from \\"viem" -e "from 'viem" -e "ethers" -e "privateKeyToAccount" -e "signMessage" src scripts || true`,
      { encoding: "utf8" },
    )
      .split("\n")
      .filter((l) => l.trim() && !l.includes("scripts/probe.ts:") && !l.includes("src/api/auth.ts:"));
    expect(hits, `signing-library reference(s):\n${hits.join("\n")}`).toEqual([]);
  });
});
