/**
 * [session 134] Vitest reporter for `scripts/pinPatch.ts`.
 *
 * Dumps every failed assertion's STRUCTURED `actual` / `expected` and the
 * exact file:line:column of the matcher call to the JSON file named by
 * `$PIN_DUMP`. This replaces the old scratchpad patchers' habit of parsing
 * the printed diff text, which (a) truncates long arrays, (b) carried a
 * `+ Received` header line that broke hunk parsing, and (c) could only be
 * anchored by a text prefix that was not unique (session 133).
 *
 *   PIN_DUMP=/path/dump.json npx vitest run --reporter=default \
 *     --reporter=./scripts/pinReporter.ts
 *
 * Read-only with respect to the repo: it writes exactly one file, at the path
 * the caller names, and refuses to run without one.
 */
import { writeFileSync } from "node:fs";

export interface PinFailure {
  test: string;
  file: string;
  line: number;
  column: number;
  actual: unknown;
  expected: unknown;
  message: string;
}

interface ErrorLike {
  message?: string;
  actual?: unknown;
  expected?: unknown;
  stacks?: { file: string; line: number; column: number }[];
}

interface TestCaseLike {
  name: string;
  module: { moduleId: string };
  result(): { state: string; errors?: readonly ErrorLike[] };
}

export default class PinReporter {
  private readonly out: PinFailure[] = [];
  private readonly path: string;

  constructor() {
    const p = process.env.PIN_DUMP;
    if (!p) throw new Error("pinReporter: set PIN_DUMP to the dump file path");
    this.path = p;
  }

  onTestCaseResult(tc: TestCaseLike): void {
    const r = tc.result();
    if (r.state !== "failed") return;
    for (const e of r.errors ?? []) {
      // The first stack frame in the test module is the matcher call site. A
      // frame in a helper file is kept as-is; pinPatch refuses it if the node
      // there is not a literal.
      const frames = e.stacks ?? [];
      const top = frames.find((f) => f.file === tc.module.moduleId) ?? frames[0];
      if (!top) continue;
      this.out.push({
        test: tc.name,
        file: top.file,
        line: top.line,
        column: top.column,
        actual: e.actual,
        expected: e.expected,
        message: (e.message ?? "").split("\n")[0] ?? "",
      });
    }
  }

  onTestRunEnd(): void {
    writeFileSync(this.path, JSON.stringify(this.out, null, 1));
  }
}
