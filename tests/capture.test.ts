/**
 * tests/capture.test.ts — [session 78, §5 / CODEXAUG22REVIEW L4]
 *
 * `FixtureWriter` and `RunLog` existed twice, independently, with the redaction
 * routine duplicated a third time alongside them. These two classes write the
 * evidence everything else in this repo is built on, and one of the things they
 * do is REDACT — so a fix applied to one copy and not the other is a silent
 * divergence in the two paths that produce the corpus.
 *
 * The tests below do two things: pin the redaction once, and pin that there is
 * still only ONE implementation. The second is the one that matters over time —
 * re-duplicating the class is exactly the move this refactor exists to prevent,
 * and it would otherwise pass every other test in the suite.
 *
 * Every path here is an `mkdtempSync` temp dir. Nothing touches `fixtures/`,
 * `data/` or `logs/` (CLAUDE.md working style).
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CaptureFixtureWriter, CaptureRunLog, redactCapture, stamp } from "../src/orchestrator/capture.js";
import { FixtureWriter as DungeonFixtureWriter, RunLog as DungeonRunLog } from "../scripts/liveRun.js";
import { FixtureWriter as FishingFixtureWriter, RunLog as FishingRunLog } from "../scripts/liveFishing.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "capture-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("redactCapture", () => {
  const noop = (t: string) => t;

  it("replaces the address in all three cases the wire uses", () => {
    const addr = "0xAbCdEf0123456789";
    const raw = JSON.stringify({ a: addr, b: addr.toLowerCase(), c: addr.toUpperCase() });
    const out = redactCapture(raw, addr, noop);
    expect(out).not.toContain("bCdEf");
    expect(out.match(/0xUSER/g)).toHaveLength(3);
  });

  it("routes the JWT through the caller's redactor, never a prefix of it", () => {
    // [session 28, CODEXREVIEW #7] Every prior caller passed the 8-char DISPLAY
    // prefix from `maskedJwt()`, so most of a real credential could have landed
    // in a "redacted" fixture on a public repo. The full-token redactor is the
    // client's own and is the only thing that has ever seen the real value.
    // Deliberately NOT `eyJ...`-shaped. `scripts/preflight.ts` scans the export
    // for anything structurally a JWT and flagged the first draft of this line
    // — correctly. Its narrow allowance exists for "the redaction module has to
    // contain the thing it redacts", and this is not that case: `capture.ts`
    // DELEGATES to the caller's redactor and holds no token literal. What the
    // test needs is a long multi-segment secret, which this is.
    const jwt = "HEADER-part.reallylongsecretpayload.SIGNATURE-part";
    const out = redactCapture(JSON.stringify({ t: jwt }), "0xabc", (t) => t.split(jwt).join("<JWT>"));
    expect(out).toContain("<JWT>");
    expect(out).not.toContain("reallylongsecretpayload");
  });

  it("masks any *username* key regardless of casing", () => {
    const raw = JSON.stringify({ userName: "someone", USERNAME_CID: "x", playerUsername: "y" });
    const out = redactCapture(raw, "0xabc", noop);
    expect(out).not.toContain("someone");
    expect(out).toContain('"<USER>"');
  });

  it("applies the shared noob-token rule", () => {
    // [session 54] The rule that held in five of six writers, which is why it
    // lives in src/api/redact.ts — and why this module exists one level up.
    const out = redactCapture(JSON.stringify({ NOOB_TOKEN_CID: 4242 }), "0xabc", noop);
    expect(out).not.toContain("4242");
  });

  it("leaves an already-clean body untouched", () => {
    const raw = JSON.stringify({ hp: 30, move: "rock" });
    expect(redactCapture(raw, "0xabc", noop)).toBe(raw);
  });
});

describe("CaptureFixtureWriter", () => {
  it("writes the raw body and the redacted body as a pair", () => {
    const w = new CaptureFixtureWriter("0xSECRET", (t) => t, dir, "run");
    const name = w.write({ address: "0xSECRET", hp: 30 });

    // Raw keeps the truth so the redaction can always be re-derived and
    // re-checked; the sibling is what ships.
    expect(readFileSync(join(w.dir, "raw", name), "utf8")).toContain("0xSECRET");
    expect(readFileSync(join(w.dir, name), "utf8")).not.toContain("0xSECRET");
    expect(readFileSync(join(w.dir, name), "utf8")).toContain("0xUSER");
  });

  it("numbers files in write order, zero-padded to three digits", () => {
    const w = new CaptureFixtureWriter("0xabc", (t) => t, dir, "run");
    expect(w.write({ i: 0 })).toBe("state-000.json");
    expect(w.write({ i: 1 })).toBe("state-001.json");
    expect(readdirSync(w.dir).filter((f) => f.endsWith(".json")).sort()).toEqual([
      "state-000.json",
      "state-001.json",
    ]);
  });

  it("returns the file name, which is half of an exchange identity", () => {
    // [session 36, CODEXAUDIT #1] `runName` + this tail is the SAME derivation
    // `opponentModelPersistence.ts`'s corpus bootstrap uses, so the live path
    // and a later restart can never compute a different identity for one
    // exchange. The fishing copy returned void and silently could not do this.
    const w = new CaptureFixtureWriter("0xabc", (t) => t, dir, "cast");
    const name = w.write({});
    expect(name).toBe("state-000.json");
    expect(w.runName.startsWith("cast-")).toBe(true);
  });
});

describe("CaptureRunLog", () => {
  it("appends one JSON object per line, each stamped", () => {
    const log = new CaptureRunLog(dir, "run");
    log.write({ event: "a" });
    log.write({ event: "b" });
    const lines = readFileSync(log.filePath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const parsed = lines.map((l) => JSON.parse(l) as { event: string; ts: string });
    expect(parsed.map((p) => p.event)).toEqual(["a", "b"]);
    for (const p of parsed) expect(Date.parse(p.ts)).not.toBeNaN();
  });

  it("puts `ts` first so a caller's own `ts` cannot be silently shadowed", () => {
    // The spread order is `{ ts, ...entry }` — a caller passing its own `ts`
    // WINS. That is deliberate (a replayed record keeps its original time) and
    // worth pinning, because the opposite order is the more obvious one to write.
    const log = new CaptureRunLog(dir, "run");
    log.write({ ts: "1999-01-01T00:00:00.000Z", event: "replayed" });
    expect(JSON.parse(readFileSync(log.filePath, "utf8").trim()).ts).toBe("1999-01-01T00:00:00.000Z");
  });
});

describe("stamp", () => {
  it("is filesystem-safe — no colons, no 'T'", () => {
    expect(stamp()).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
  });
});

/**
 * The guard that keeps this refactor from being undone by accident. A future
 * reader who reintroduces a local `class FixtureWriter { ... }` in either script
 * breaks these — and nothing else in the suite would notice, because both copies
 * behaved identically right up until the day one of them got a fix.
 */
describe("there is exactly ONE implementation of each", () => {
  it("both FixtureWriters are the shared class", () => {
    const d = new DungeonFixtureWriter("0xabc", (t) => t, dir);
    const f = new FishingFixtureWriter("0xabc", (t) => t, dir);
    expect(d).toBeInstanceOf(CaptureFixtureWriter);
    expect(f).toBeInstanceOf(CaptureFixtureWriter);
  });

  it("both RunLogs are the shared class", () => {
    expect(new DungeonRunLog(dir)).toBeInstanceOf(CaptureRunLog);
    expect(new FishingRunLog(dir)).toBeInstanceOf(CaptureRunLog);
  });

  it("and they still differ only in the prefix, which is the whole point", () => {
    const d = new DungeonFixtureWriter("0xabc", (t) => t, dir);
    const f = new FishingFixtureWriter("0xabc", (t) => t, dir);
    expect(d.runName.startsWith("run-")).toBe(true);
    expect(f.runName.startsWith("cast-")).toBe(true);

    expect(new DungeonRunLog(dir).filePath).toContain("run-");
    expect(new FishingRunLog(dir).filePath).toContain("fishing-");
  });

  it("redaction is identical on both, because it is the same code", () => {
    // Same reason as above — no `eyJ` prefix anywhere in this file, so a future
    // tightening of preflight's JWT pattern cannot turn this into a false hit.
    const jwt = "HEADER.secret.SIG";
    const redactor = (t: string) => t.split(jwt).join("<JWT>");
    const body = { address: "0xSECRET", userName: "someone", NOOB_TOKEN_CID: 99, t: jwt };

    const d = new DungeonFixtureWriter("0xSECRET", redactor, dir);
    const f = new FishingFixtureWriter("0xSECRET", redactor, dir);
    const dOut = readFileSync(join(d.dir, d.write(body)), "utf8");
    const fOut = readFileSync(join(f.dir, f.write(body)), "utf8");
    expect(dOut).toBe(fOut);
    for (const out of [dOut, fOut]) {
      expect(out).not.toContain("0xSECRET");
      expect(out).not.toContain("someone");
      expect(out).not.toContain("99");
      expect(out).toContain("<JWT>");
    }
  });
});
