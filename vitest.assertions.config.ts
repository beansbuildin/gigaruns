/**
 * vitest.assertions.config.ts — [session 77 §1] the shipped config plus the
 * assertion counter. Run it through `npx tsx scripts/assertionCoverage.ts`,
 * which owns the temp output path and the verdict; running vitest against this
 * config directly just produces an ordinary suite run with an extra hook.
 *
 * `fileParallelism: false` because every worker appends to one file.
 */
import { defineConfig, mergeConfig } from "vitest/config";

import base from "./vitest.config.js";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      setupFiles: ["./tests/helpers/assertionCount.ts"],
      fileParallelism: false,
    },
  }),
);
