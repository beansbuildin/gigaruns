/**
 * web/server/src/routes/config.ts — read and save a profile's
 * `config/bot.json` (the daily energy budgets, per README's "Set your
 * budgets" section).
 *
 * This route does NOT validate the config's shape — `loadBotConfig` (in
 * `src/orchestrator/config.ts`) already does that, and it pulls in enough
 * of the strategy/sim graph that importing it here would defeat the point
 * of keeping this server thin (see `parentRepo.ts`'s doc comment). A saved
 * config gets validated for real the next time the frontend runs the
 * doctor job — which the UI prompts for right after a save.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { Router } from "express";

import { configPath, resolveProfile } from "../parentRepo.js";
import { REPO_ROOT } from "../repoRoot.js";

const router = Router();

router.get("/:name/config", (req, res) => {
  let profile;
  try {
    profile = resolveProfile(req.params.name);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }

  const path = join(REPO_ROOT, configPath(profile, "bot.json"));
  if (!existsSync(path)) {
    res.json({ exists: false, path });
    return;
  }
  try {
    const config = JSON.parse(readFileSync(path, "utf8")) as unknown;
    res.json({ exists: true, path, config });
  } catch (e) {
    res.status(500).json({ error: `${path} does not parse as JSON: ${(e as Error).message}` });
  }
});

router.put("/:name/config", (req, res) => {
  let profile;
  try {
    profile = resolveProfile(req.params.name);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }

  const body = (req.body as { config?: unknown } | undefined)?.config;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Missing config object in request body." });
    return;
  }

  const path = join(REPO_ROOT, configPath(profile, "bot.json"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n");
  res.json({ ok: true, path });
});

export default router;
