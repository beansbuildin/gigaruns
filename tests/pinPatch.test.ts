/**
 * [session 134] scripts/pinPatch.ts — the committed pin patcher. Pure: every
 * test drives `patchSource` on an in-memory string; nothing touches `tests/`.
 * Each of session 133's three named defects has a test of its own.
 */
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { parseReported, patchSource } from "../scripts/pinPatch.js";
import type { PinFailure } from "../scripts/pinReporter.js";

/** Location of the `nth` occurrence of `.matcher(` in `text`, as the stack reports it. */
function at(text: string, matcher: string, nth = 0): { line: number; column: number } {
  let idx = -1;
  for (let i = 0; i <= nth; i++) {
    idx = text.indexOf(`.${matcher}(`, idx + 1);
    if (idx < 0) throw new Error(`no ${matcher} #${nth}`);
  }
  const before = text.slice(0, idx + 1);
  const line = before.split("\n").length;
  const column = idx + 1 - before.lastIndexOf("\n");
  return { line, column };
}

function fail(text: string, matcher: string, actual: unknown, expected: unknown, nth = 0): PinFailure {
  return { test: "t", file: "/x/a.test.ts", message: "", actual, expected, ...at(text, matcher, nth) };
}

function parses(text: string): boolean {
  const sf = ts.createSourceFile("a.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return ((sf as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics ?? []).length === 0;
}

describe("pinPatch — scalar pins", () => {
  it("moves a toBe literal and nothing else", () => {
    const src = `it("a", () => {\n  expect(x).toBe(8);\n  expect(y).toBe(8);\n});\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toBe", "7", "8", 1)]);
    expect(r.newText).toBe(`it("a", () => {\n  expect(x).toBe(8);\n  expect(y).toBe(7);\n});\n`);
    expect(r.refusals).toEqual([]);
  });

  it("DEFECT 3: identical anchor text in three tests — only the reported call site moves", () => {
    const pin = "expect(all3.rescues - all3.sacrifices).toBe(5);";
    const src = [1, 2, 3].map((i) => `it("t${i}", () => {\n  ${pin}\n});`).join("\n") + "\n";
    const r = patchSource("a.test.ts", src, [fail(src, "toBe", "6", "5", 1)]);
    const lines = r.newText!.split("\n").filter((l) => l.includes("all3"));
    expect(lines.map((l) => l.trim())).toEqual([
      pin,
      "expect(all3.rescues - all3.sacrifices).toBe(6);",
      pin,
    ]);
  });

  it("toHaveLength and negative literals", () => {
    const src = `expect(a).toHaveLength(2);\nexpect(b).toBe(-3);\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toHaveLength", "3", "2"), fail(src, "toBe", "-4", "-3")]);
    expect(r.newText).toBe(`expect(a).toHaveLength(3);\nexpect(b).toBe(-4);\n`);
  });

  it("toBeCloseTo is written at precision+1, never full precision", () => {
    const src = `expect(r).toBeCloseTo(0.58, 1);\nexpect(s).toBeCloseTo(0.6031);\n`;
    const r = patchSource("a.test.ts", src, [
      fail(src, "toBeCloseTo", 0.6123456, 0.58, 0),
      fail(src, "toBeCloseTo", 0.6129876, 0.6031, 1),
    ]);
    expect(r.newText).toBe(`expect(r).toBeCloseTo(0.61, 1);\nexpect(s).toBeCloseTo(0.613);\n`);
  });

  it("refuses a ratio toBeCloseTo — both halves move by hand", () => {
    const src = `expect(r).toBeCloseTo(912 / 1248, 3);\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toBeCloseTo", 0.7291, 912 / 1248)]);
    expect(r.newText).toBeNull();
    expect(r.refusals[0]!.reason).toMatch(/BOTH halves/);
  });

  it("refuses bounds, .not, and non-literal arguments", () => {
    const src = `expect(a).toBeGreaterThan(3);\nexpect(b).not.toBe(4);\nexpect(c).toBe(N);\n`;
    const r = patchSource("a.test.ts", src, [
      fail(src, "toBeGreaterThan", "2", "3"),
      fail(src, "toBe", "4", "4"),
      fail(src, "toBe", "5", "6", 1),
    ]);
    expect(r.newText).toBeNull();
    expect(r.refusals.map((x) => x.reason)).toEqual([
      expect.stringMatching(/not a pin matcher/),
      expect.stringMatching(/\.not/),
      expect.stringMatching(/not a numeric literal/),
    ]);
  });

  it("refuses when the source literal disagrees with the reported expected (wrong location)", () => {
    const src = `expect(a).toBe(9);\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toBe", "7", "8")]);
    expect(r.refusals[0]!.reason).toMatch(/source 9 != reported expected 8/);
  });
});

describe("pinPatch — arrays (DEFECT 1: the list-inserter)", () => {
  it("single-line array that GROWS stays one valid line and `]);` survives", () => {
    const src = `it("heal", () => {\n  expect(rooms).toEqual([1, 2, 3]);\n});\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toEqual", "[\n  1,\n  2,\n  3,\n  4,\n]", "[\n  1,\n  2,\n  3,\n]")]);
    expect(r.newText).toBe(`it("heal", () => {\n  expect(rooms).toEqual([1, 2, 3, 4]);\n});\n`);
    expect(parses(r.newText!)).toBe(true);
  });

  it("single-line array inside a nested call (`]));`) is replaced by span", () => {
    const src = `expect(f(x)).toEqual([7, 8]); expect(g()).toEqual(h([1]));\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toEqual", "[\n  7,\n  8,\n  9,\n]", "[\n  7,\n  8,\n]")]);
    expect(r.newText).toBe(`expect(f(x)).toEqual([7, 8, 9]); expect(g()).toEqual(h([1]));\n`);
  });

  it("multi-line, one-per-line array keeps its layout", () => {
    const src = `    expect(v).toEqual([\n      10,\n      20,\n    ]);\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toEqual", "[\n  10,\n  20,\n  30,\n]", "[\n  10,\n  20,\n]")]);
    expect(r.newText).toBe(`    expect(v).toEqual([\n      10,\n      20,\n      30,\n    ]);\n`);
  });

  it("multi-line packed array keeps its per-line count", () => {
    const src = `expect(v).toEqual([\n  1, 2, 3,\n  4, 5,\n]);\n`;
    const r = patchSource("a.test.ts", src, [
      fail(src, "toEqual", JSON.stringify([1, 2, 3, 4, 5, 6, 7]), JSON.stringify([1, 2, 3, 4, 5])),
    ]);
    expect(r.newText).toBe(`expect(v).toEqual([\n  1, 2, 3,\n  4, 5, 6,\n  7,\n]);\n`);
  });

  it("same-length array moves only the changed elements, comments intact", () => {
    const src = `expect(h).toEqual([\n  3, // bucket a\n  3, // bucket b\n]);\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toEqual", "[\n  3,\n  4,\n]", "[\n  3,\n  3,\n]")]);
    expect(r.newText).toBe(`expect(h).toEqual([\n  3, // bucket a\n  4, // bucket b\n]);\n`);
  });

  it("refuses a length change on an array holding comments", () => {
    const src = `expect(h).toEqual([\n  3, // a\n]);\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toEqual", "[\n  3,\n  4,\n]", "[\n  3,\n]")]);
    expect(r.newText).toBeNull();
    expect(r.refusals[0]!.reason).toMatch(/comments/);
  });
});

describe("pinPatch — objects", () => {
  it("toMatchObject moves nested numeric leaves and ignores extra actual keys", () => {
    const src = `expect(o).toMatchObject({ a: 1, b: { "c": 4 } });\n`;
    const r = patchSource("a.test.ts", src, [
      fail(src, "toMatchObject", '{\n  "a": 1,\n  "b": {\n    "c": 5,\n  },\n  "z": 9,\n}', '{\n  "a": 1,\n  "b": {\n    "c": 4,\n  },\n}'),
    ]);
    expect(r.newText).toBe(`expect(o).toMatchObject({ a: 1, b: { "c": 5 } });\n`);
  });

  it("toEqual refuses an added key and a changed string leaf", () => {
    const src = `expect(o).toEqual({ a: 1 });\nexpect(p).toEqual({ s: "x" });\n`;
    const r = patchSource("a.test.ts", src, [
      fail(src, "toEqual", '{"a": 1, "b": 2}', '{"a": 1}', 0),
      fail(src, "toEqual", '{"s": "y"}', '{"s": "x"}', 1),
    ]);
    expect(r.newText).toBeNull();
    expect(r.refusals).toHaveLength(2);
  });
});

describe("pinPatch — safety", () => {
  it("one call site with conflicting actuals (it.each) is refused, not guessed", () => {
    const src = `it.each([1, 2])("%s", (n) => { expect(n).toBe(3); });\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toBe", "1", "3"), fail(src, "toBe", "2", "3")]);
    expect(r.newText).toBeNull();
    expect(r.refusals).toHaveLength(2);
  });

  it("identical duplicate reports collapse to one edit", () => {
    const src = `expect(n).toBe(3);\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toBe", "4", "3"), fail(src, "toBe", "4", "3")]);
    expect(r.newText).toBe(`expect(n).toBe(4);\n`);
    expect(r.plans).toHaveLength(1);
  });

  it("DEFECT 2: reported values are structured — no diff header to mis-parse", () => {
    expect(parseReported('[\n  1,\n  2,\n]')).toEqual([1, 2]);
    expect(parseReported('{\n  "a": {\n    "b": 1,\n  },\n}')).toEqual({ a: { b: 1 } });
    expect(parseReported(0.25)).toBe(0.25);
    expect(() => parseReported("Any<Number>")).toThrow(/not plain data/);
    expect(() => parseReported("- Expected\n+ Received\n\n- 1\n+ 2")).toThrow(/not plain data/);
  });

  it("annotation lands on the matcher's own line, merging into an existing comment", () => {
    const src = `expect(a).toBe(2);\nexpect(b).toBe(1); // [session 128] was 0\nexpect(c).toEqual([1]);\n`;
    const r = patchSource(
      "a.test.ts",
      src,
      [fail(src, "toBe", "3", "2", 0), fail(src, "toBe", "2", "1", 1), fail(src, "toEqual", "[1, 2]", "[1]")],
      "134",
    );
    expect(r.newText).toBe(
      `expect(a).toBe(3); // [session 134] was 2\n` +
        `expect(b).toBe(2); // [session 134] was 1; [session 128] was 0\n` +
        `expect(c).toEqual([1, 2]);\n`,
    );
  });

  it("no annotation when the statement spans lines", () => {
    const src = `expect(\n  a,\n).toBe(2);\n`;
    const r = patchSource("a.test.ts", src, [fail(src, "toBe", "3", "2")], "134");
    expect(r.newText).toBe(`expect(\n  a,\n).toBe(3);\n`);
  });
});
