/**
 * web/server/src/routes/profiles.ts — list the profiles that exist, and
 * accept a new profile name.
 *
 * Creating a profile here does not create any files — `resolveProfile()`'s
 * paths are created lazily by the same write paths the CLI already uses
 * (saving a JWT, saving a config). This route only validates the name and
 * lets the frontend move on to the setup wizard for it.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { Router } from "express";

import { DEFAULT_PROFILE_NAME, PROFILES_ROOT, assertValidProfileName } from "../parentRepo.js";
import { REPO_ROOT } from "../repoRoot.js";

const router = Router();

router.get("/", (_req, res) => {
  const root = join(REPO_ROOT, PROFILES_ROOT);
  const names = [DEFAULT_PROFILE_NAME];
  if (existsSync(root)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory()) names.push(entry.name);
    }
  }
  res.json({ profiles: names });
});

router.post("/", (req, res) => {
  const name = String((req.body as { name?: unknown } | undefined)?.name ?? "").trim();
  try {
    assertValidProfileName(name);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }
  if (name === DEFAULT_PROFILE_NAME) {
    res.status(400).json({ error: `"${DEFAULT_PROFILE_NAME}" always exists — nothing to create.` });
    return;
  }
  res.json({ name });
});

export default router;
