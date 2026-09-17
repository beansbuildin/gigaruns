/**
 * [session 134] Corpus-pin patcher — the committed replacement for the
 * scratchpad patcher family sessions 128–133 rebuilt by hand every session.
 *
 * When the fixture corpus grows, many tests pin corpus-derived numbers and go
 * red together. This tool moves those pins to the new values, and ONLY those
 * pins, and refuses everything it cannot move safely.
 *
 * What it fixes, by construction rather than by care:
 *  - **The list-inserter bug** (session 133: wrote after `]);` into single-line
 *    arrays and broke syntax). Arrays are located as TypeScript AST nodes and
 *    replaced by their exact span, keeping single- vs multi-line layout. There
 *    is no end-of-array scan to mis-fire.
 *  - **The `+ Received` header defect.** There is no diff text to parse: the
 *    reporter (`scripts/pinReporter.ts`) captures structured actual/expected.
 *  - **Non-unique anchors** (`all3.rescues - all3.sacrifices` in three tests of
 *    `redrawCounterfactual.test.ts`). The anchor is the matcher call's own
 *    file:line:column from the stack, which is unique per call site.
 *
 * What it keeps from the old family: every failure is planned before anything
 * is written; `--write` requires `--snapshot` and copies each file first; an
 * edited file that no longer parses is not written. Carried rules enforced in
 * code: `toBeCloseTo(x, p)` is written at p+1 decimals, never full precision;
 * a ratio expression (`912 / 1248`) is REFUSED — both halves move by hand.
 * Bounds (`toBeGreaterThan` …), `.not`, and non-literal arguments are refused:
 * those are judgements, not pins.
 *
 * Usage:
 *   npx tsx scripts/pinPatch.ts --run [test files…]      # plan only
 *   npx tsx scripts/pinPatch.ts --run --write --snapshot=<dir> [--annotate=134]
 *   npx tsx scripts/pinPatch.ts --dump=<file> …           # reuse a dump
 */
import ts from "typescript";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import type { PinFailure } from "./pinReporter.js";

export interface Edit {
  start: number;
  end: number;
  text: string;
}

export interface Plan {
  failure: PinFailure;
  matcher: string;
  edits: Edit[];
  /** Human-readable before -> after, for the printout. */
  summary: string;
}

export interface Refusal {
  failure: PinFailure;
  reason: string;
}

const SCALAR = new Set(["toBe", "toHaveLength", "toBeCloseTo"]);
const DEEP = new Set(["toEqual", "toStrictEqual", "toMatchObject"]);

class Refuse extends Error {}

/**
 * Parse a value as the reporter captured it. vitest hands scalars as numbers or
 * as pretty-format strings (`'7'`, `'[\n  1,\n]'`, `'{\n  "a": 1,\n}'`), which
 * are JSON once trailing commas go. Anything else (`Any<Number>`, class
 * prefixes, NaN) fails to parse and the failure is refused.
 */
export function parseReported(v: unknown): unknown {
  if (typeof v === "number") return v;
  if (typeof v !== "string") throw new Refuse(`unparseable reported value ${JSON.stringify(v)}`);
  try {
    return JSON.parse(v.replace(/,(\s*[\]}])/g, "$1"));
  } catch {
    throw new Refuse(`reported value is not plain data: ${v.slice(0, 60)}`);
  }
}

function numericValue(node: ts.Node): number | null {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  return null;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) throw new Refuse(`non-finite actual ${n}`);
  return Object.is(n, -0) ? "0" : String(n);
}

function propName(p: ts.ObjectLiteralElementLike): string | null {
  if (!ts.isPropertyAssignment(p)) return null;
  const n = p.name;
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  return null;
}

function findMatcherCall(sf: ts.SourceFile, offset: number): ts.CallExpression | null {
  let hit: ts.CallExpression | null = null;
  const visit = (n: ts.Node): void => {
    if (hit) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.getStart(sf) === offset
    ) {
      hit = n;
      return;
    }
    if (n.pos <= offset && offset < n.end) ts.forEachChild(n, visit);
  };
  visit(sf);
  return hit;
}

function hasNot(call: ts.CallExpression): boolean {
  let e: ts.Expression = call.expression;
  while (ts.isPropertyAccessExpression(e) || ts.isCallExpression(e)) {
    if (ts.isPropertyAccessExpression(e)) {
      if (e.name.text === "not") return true;
      e = e.expression;
    } else {
      e = e.expression;
    }
  }
  return false;
}

/** Replace a whole numeric array node, keeping its layout. */
export function formatArray(sf: ts.SourceFile, node: ts.ArrayLiteralExpression, values: number[]): string {
  const text = node.getText(sf);
  const items = values.map(fmt);
  if (!text.includes("\n")) return `[${items.join(", ")}]`;
  const lineOf = (pos: number): number => sf.getLineAndCharacterOfPosition(pos).line;
  const indentOf = (pos: number): string => {
    const ls = sf.getPositionOfLineAndCharacter(lineOf(pos), 0);
    return /^[ \t]*/.exec(sf.text.slice(ls))![0];
  };
  const els = node.elements;
  const closeIndent = indentOf(node.getEnd() - 1);
  if (els.length === 0) {
    return `[\n${closeIndent}  ${items.join(", ")}${items.length ? "," : ""}\n${closeIndent}]`;
  }
  const first = els[0]!.getStart(sf);
  const elemIndent = indentOf(first);
  const perLine = Math.max(1, els.filter((e) => lineOf(e.getStart(sf)) === lineOf(first)).length);
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += perLine) lines.push(elemIndent + items.slice(i, i + perLine).join(", "));
  const trailing = els.hasTrailingComma || lineOf(els[els.length - 1]!.getEnd()) !== lineOf(node.getEnd() - 1);
  // A multi-line array whose first element sits on the `[` line keeps that shape.
  const openInline = lineOf(first) === lineOf(node.getStart(sf));
  const body = lines.join(",\n") + (trailing ? "," : "");
  if (openInline) return `[${body.trimStart()}\n${closeIndent}]`;
  return `[\n${body}\n${closeIndent}]`;
}

function deepEdits(
  sf: ts.SourceFile,
  actual: unknown,
  expected: unknown,
  node: ts.Node,
  path: string,
  subset: boolean,
  out: Edit[],
): void {
  if (typeof expected === "number") {
    if (Object.is(actual, expected)) return;
    if (typeof actual !== "number") throw new Refuse(`${path}: actual is not a number`);
    const src = numericValue(node);
    if (src === null) throw new Refuse(`${path}: source is not a numeric literal (${node.getText(sf).slice(0, 40)})`);
    if (!Object.is(src, expected)) throw new Refuse(`${path}: source ${src} != reported expected ${expected}`);
    out.push({ start: node.getStart(sf), end: node.getEnd(), text: fmt(actual) });
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) throw new Refuse(`${path}: actual is not an array`);
    if (!ts.isArrayLiteralExpression(node)) throw new Refuse(`${path}: source is not an array literal`);
    if (node.elements.some((e) => ts.isSpreadElement(e) || ts.isOmittedExpression(e))) {
      throw new Refuse(`${path}: array has spread/holes`);
    }
    if (node.elements.length !== expected.length) throw new Refuse(`${path}: source length != reported expected length`);
    if (actual.length === expected.length) {
      actual.forEach((a, i) => deepEdits(sf, a, expected[i], node.elements[i]!, `${path}[${i}]`, subset, out));
      return;
    }
    // Length changed: whole-node replacement, numeric arrays only.
    const nums = actual.every((a) => typeof a === "number") && node.elements.every((e) => numericValue(e) !== null);
    if (!nums) throw new Refuse(`${path}: length ${expected.length} -> ${actual.length} on a non-numeric array`);
    if (/\/\/|\/\*/.test(node.getText(sf))) throw new Refuse(`${path}: length changed on an array holding comments`);
    node.elements.forEach((e, i) => {
      if (!Object.is(numericValue(e), expected[i])) throw new Refuse(`${path}[${i}]: source != reported expected`);
    });
    out.push({ start: node.getStart(sf), end: node.getEnd(), text: formatArray(sf, node, actual as number[]) });
    return;
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object" || Array.isArray(actual)) {
      throw new Refuse(`${path}: actual is not an object`);
    }
    if (!ts.isObjectLiteralExpression(node)) throw new Refuse(`${path}: source is not an object literal`);
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    const keys = new Set([...Object.keys(e), ...(subset ? [] : Object.keys(a))]);
    for (const k of keys) {
      if (!(k in a) || !(k in e)) throw new Refuse(`${path}.${k}: key added or removed`);
      if (JSON.stringify(a[k]) === JSON.stringify(e[k])) continue;
      const props = node.properties.filter((p) => propName(p) === k);
      if (props.length !== 1) throw new Refuse(`${path}.${k}: not a single plain property in source`);
      deepEdits(sf, a[k], e[k], (props[0] as ts.PropertyAssignment).initializer, `${path}.${k}`, subset, out);
    }
    return;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Refuse(`${path}: non-numeric leaf changed (${JSON.stringify(expected)} -> ${JSON.stringify(actual)})`);
  }
}

/** Plan the edits for one failure against the file's current source. */
export function planFailure(sf: ts.SourceFile, f: PinFailure): Plan {
  let offset: number;
  try {
    offset = sf.getPositionOfLineAndCharacter(f.line - 1, f.column - 1);
  } catch {
    throw new Refuse(`location ${f.line}:${f.column} is outside the file`);
  }
  const call = findMatcherCall(sf, offset);
  if (!call) throw new Refuse(`no matcher call at ${f.line}:${f.column} (failure raised inside a helper?)`);
  const matcher = (call.expression as ts.PropertyAccessExpression).name.text;
  if (hasNot(call)) throw new Refuse(`.not.${matcher} is not a pin`);
  if (!SCALAR.has(matcher) && !DEEP.has(matcher)) throw new Refuse(`${matcher} is not a pin matcher`);
  const arg = call.arguments[0];
  if (!arg) throw new Refuse(`${matcher}() has no argument`);
  const actual = parseReported(f.actual);
  const expected = parseReported(f.expected);
  const was = arg.getText(sf);
  const edits: Edit[] = [];

  if (matcher === "toBeCloseTo") {
    if (typeof actual !== "number") throw new Refuse("toBeCloseTo actual is not a number");
    const src = numericValue(arg);
    if (src === null) {
      throw new Refuse(`toBeCloseTo(${was.slice(0, 40)}) is an expression — a ratio pin moves BOTH halves by hand`);
    }
    if (typeof expected === "number" && Math.abs(src - expected) > 1e-12) {
      throw new Refuse(`source ${src} != reported expected ${expected}`);
    }
    const p = call.arguments[1];
    const precision = p === undefined ? 2 : numericValue(p);
    if (precision === null || !Number.isInteger(precision) || precision < 0) {
      throw new Refuse("toBeCloseTo precision is not an integer literal");
    }
    edits.push({ start: arg.getStart(sf), end: arg.getEnd(), text: fmt(Number(actual.toFixed(precision + 1))) });
  } else if (matcher === "toBe" || matcher === "toHaveLength") {
    if (typeof expected !== "number") throw new Refuse(`${matcher} expected is not a number`);
    deepEdits(sf, actual, expected, arg, "$", false, edits);
  } else {
    deepEdits(sf, actual, expected, arg, "$", matcher === "toMatchObject", edits);
  }
  if (edits.length === 0) throw new Refuse("actual equals expected — nothing to move");
  const after = applyEdits(sf.text.slice(arg.getStart(sf), arg.getEnd()), edits.map((e) => ({
    ...e,
    start: e.start - arg.getStart(sf),
    end: e.end - arg.getStart(sf),
  })));
  return { failure: f, matcher, edits, summary: `${matcher}(${oneLine(was)}) -> ${oneLine(after)}` };
}

function oneLine(s: string): string {
  const t = s.replace(/\s+/g, " ");
  return t.length > 70 ? `${t.slice(0, 67)}...` : t;
}

/** Apply non-overlapping edits. Throws on overlap. */
export function applyEdits(text: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.end > sorted[i - 1]!.start) throw new Refuse("overlapping edits");
  }
  let out = text;
  for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/**
 * The `// [session N] was X` annotation, as an insertion at the end of the
 * matcher's statement. Only for scalar pins, only when the statement ends its
 * line — so it can never land on a neighbouring line (session 129's trap).
 */
export function annotationEdit(sf: ts.SourceFile, plan: Plan, session: string): Edit | null {
  if (!SCALAR.has(plan.matcher)) return null;
  const offset = sf.getPositionOfLineAndCharacter(plan.failure.line - 1, plan.failure.column - 1);
  const call = findMatcherCall(sf, offset)!;
  let stmt: ts.Node = call;
  while (stmt.parent && !ts.isExpressionStatement(stmt)) stmt = stmt.parent;
  if (!ts.isExpressionStatement(stmt)) return null;
  const end = stmt.getEnd();
  const lineEnd = sf.text.indexOf("\n", end) === -1 ? sf.text.length : sf.text.indexOf("\n", end);
  const rest = sf.text.slice(end, lineEnd);
  const startLine = sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line;
  if (sf.getLineAndCharacterOfPosition(end).line !== startLine) return null;
  const was = oneLine(call.arguments[0]!.getText(sf));
  const note = `[session ${session}] was ${was}`;
  if (/^\s*$/.test(rest)) return { start: end, end, text: ` // ${note}` };
  const m = /^(\s*\/\/ ?)/.exec(rest);
  if (m) return { start: end + m[1]!.length, end: end + m[1]!.length, text: `${note}; ` };
  return null;
}

function parseErrors(sf: ts.SourceFile): number {
  return ((sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics ?? []).length;
}

export interface FileResult {
  file: string;
  plans: Plan[];
  refusals: Refusal[];
  newText: string | null;
}

/**
 * Plan every failure in one file and produce its patched text. Two failures
 * that want the same span with different text (an `it.each` over one pin) are
 * both refused; identical duplicates collapse. The patched text must parse with
 * no more errors than the original, or the whole file is refused.
 */
export function patchSource(file: string, text: string, failures: PinFailure[], annotate?: string): FileResult {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const plans: Plan[] = [];
  const refusals: Refusal[] = [];
  for (const f of failures) {
    try {
      plans.push(planFailure(sf, f));
    } catch (e) {
      if (!(e instanceof Refuse)) throw e;
      refusals.push({ failure: f, reason: e.message });
    }
  }
  // Same call site reported twice: keep one if identical, refuse both if not.
  const bySite = new Map<string, Plan[]>();
  for (const p of plans) {
    const k = `${p.failure.line}:${p.failure.column}`;
    bySite.set(k, [...(bySite.get(k) ?? []), p]);
  }
  const kept: Plan[] = [];
  for (const group of bySite.values()) {
    const sig = (p: Plan): string => JSON.stringify(p.edits);
    if (group.every((p) => sig(p) === sig(group[0]!))) kept.push(group[0]!);
    else for (const p of group) refusals.push({ failure: p.failure, reason: "one call site, conflicting actuals (it.each?)" });
  }
  const edits: Edit[] = kept.flatMap((p) => p.edits);
  if (annotate) {
    for (const p of kept) {
      const a = annotationEdit(sf, p, annotate);
      if (a) edits.push(a);
    }
  }
  if (edits.length === 0) return { file, plans: [], refusals, newText: null };
  let newText: string;
  try {
    newText = applyEdits(text, edits);
  } catch (e) {
    if (!(e instanceof Refuse)) throw e;
    return { file, plans: [], refusals: [...refusals, ...kept.map((p) => ({ failure: p.failure, reason: e.message }))], newText: null };
  }
  const after = ts.createSourceFile(file, newText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (parseErrors(after) > parseErrors(sf)) {
    return {
      file,
      plans: [],
      refusals: [...refusals, ...kept.map((p) => ({ failure: p.failure, reason: "patched file no longer parses — file left untouched" }))],
      newText: null,
    };
  }
  return { file, plans: kept, refusals, newText };
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "";
}

function main(): void {
  const root = process.cwd();
  let dump = arg("dump");
  const write = arg("write") !== undefined;
  const snapshot = arg("snapshot");
  const annotate = arg("annotate") || undefined;
  if (write && !snapshot) {
    console.error("--write requires --snapshot=<dir> (originals are copied there first)");
    process.exit(1);
  }
  if (arg("run") !== undefined) {
    dump = join(mkdtempSync(join(tmpdir(), "pinpatch-")), "dump.json");
    const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
    const r = spawnSync(
      "npx",
      ["vitest", "run", "--maxWorkers=4", "--reporter=dot", "--reporter=./scripts/pinReporter.ts", ...files],
      { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, PIN_DUMP: dump } },
    );
    console.log(`vitest rc=${r.status}  dump=${dump}`);
  }
  if (!dump) {
    console.error("pass --run or --dump=<file>");
    process.exit(1);
  }
  const failures = JSON.parse(readFileSync(dump, "utf8")) as PinFailure[];
  const byFile = new Map<string, PinFailure[]>();
  const refusals: Refusal[] = [];
  for (const f of failures) {
    const rel = relative(root, f.file);
    if (rel.startsWith("..") || !rel.endsWith(".test.ts")) {
      refusals.push({ failure: f, reason: "not a test file inside the repo — pins only" });
      continue;
    }
    byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  }
  let moved = 0;
  for (const [file, fs] of byFile) {
    const r = patchSource(file, readFileSync(file, "utf8"), fs, annotate);
    refusals.push(...r.refusals);
    for (const p of r.plans) console.log(`  PIN  ${relative(root, file)}:${p.failure.line}  ${p.summary}`);
    moved += r.plans.length;
    if (write && r.newText !== null) {
      const snap = resolve(snapshot!, relative(root, file));
      mkdirSync(dirname(snap), { recursive: true });
      copyFileSync(file, snap);
      writeFileSync(file, r.newText);
    }
  }
  for (const r of refusals) {
    console.log(`  SKIP ${relative(root, r.failure.file)}:${r.failure.line}  ${r.reason}  [${r.failure.test}]`);
  }
  console.log(
    `\n${failures.length} failure(s): ${moved} pin(s) ${write ? "WRITTEN" : "planned (dry run)"}, ${refusals.length} refused.` +
      (write ? `  snapshot: ${snapshot}` : ""),
  );
  process.exit(refusals.length ? 2 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
