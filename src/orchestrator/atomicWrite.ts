/**
 * src/orchestrator/atomicWrite.ts — CODEXAUDIT #5 (session 37), finishes
 * CODEXREVIEW #2 (session 28: "write sibling temporary file, flush it, then
 * atomically rename it" — the temp-file+rename half shipped, the flush half
 * never did, across any of the three persistence modules that copied the
 * pattern since). Centralizes that identical write block —
 * `guardPersistence.ts`, `opponentModelPersistence.ts` and
 * `playCountsPersistence.ts` had each copied it separately, byte-for-byte
 * the same shape.
 *
 * `writeFileSync` never hands back a file descriptor, so none of the three
 * could ever fsync what they'd written — a crash between the write
 * completing at the OS buffer-cache level and the data actually reaching
 * disk could still lose it, even though the rename itself was already
 * atomic. This does NOT guarantee durability across a real power loss
 * end-to-end — that remains a filesystem/OS-level property this project is
 * trusting, not one a unit test can independently prove — it closes the
 * specific, concrete gap CODEXREVIEW #2 named: the code now actually asks
 * the OS to flush before considering the write done, rather than never
 * asking at all.
 */

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Writes `body` as JSON to `path`, atomically:
 *  1. Build a sibling temp file, `${path}.tmp-${pid}-${Date.now()}-${rand}` —
 *     the same naming scheme every call site already used before this
 *     refactor, kept identical rather than reinvented.
 *  2. Write the JSON into it and `fsyncSync` the file descriptor — the
 *     actual fix; `writeFileSync` never exposed an fd to fsync.
 *  3. `renameSync` it into place (atomic on the same filesystem).
 *  4. Best-effort `fsyncSync` the parent directory too, so the rename entry
 *     itself is flushed, not just the file's bytes — wrapped in its own
 *     try/catch, since directory-fsync isn't supported on every
 *     platform/filesystem and a platform that can't do it should not make
 *     the whole write throw.
 *
 * On any failure before the rename completes, the temp file is cleaned up
 * before rethrowing, so a failed write doesn't leave an orphaned `.tmp-*`
 * file behind the way a crash already wouldn't have.
 */
export function atomicWriteJson(path: string, body: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const json = JSON.stringify(body, null, 2);

  let fd: number | undefined;
  try {
    fd = openSync(tmp, "w");
    writeSync(fd, json);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, path);
  } catch (e) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // already closed or never fully opened — nothing to clean up
      }
    }
    if (existsSync(tmp)) {
      rmSync(tmp, { force: true });
    }
    throw e;
  }

  try {
    const dirFd = openSync(dirname(path), "r");
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
    }
  } catch {
    // directory fsync isn't supported on every platform/filesystem — the
    // file's own contents are already fsynced above, so this is best-effort.
  }
}
