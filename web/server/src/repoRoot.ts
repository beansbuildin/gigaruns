/**
 * web/server/src/repoRoot.ts — the one place that computes where the Giga
 * repo root is, relative to this file's own location on disk.
 *
 * `web/server/src/` is three levels below the repo root (src -> server ->
 * web -> root). Every script this server spawns (`scripts/doctor.ts`,
 * `scripts/liveRun.ts`, `scripts/liveFishing.ts`) assumes it is being run
 * FROM the repo root — `doctor.ts` even checks for this itself — so every
 * spawned child process gets `cwd: REPO_ROOT` explicitly rather than
 * inheriting whatever directory `npm run dev` happened to be started from.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(here, "../../../");
