/**
 * scripts/doctor.ts — run this FIRST. Preflight for a machine that has never
 * run this bot.
 *
 * ── WHY THIS IS NOT SCAFFOLDING ───────────────────────────────────────────
 *
 * Every "can I use your bot?" dies at setup, and it dies silently: a token in
 * the wrong file, an expired token, a missing config, the wrong Node. The
 * person gives up and never says why. This script is the difference between
 * "it didn't work" and "your token expired 3 hours ago, here's how to get a new
 * one" — so every check below prints WHAT TO DO, not just what failed.
 *
 * Read-only and safe: at most ONE authenticated GET (`/user/me`), no POST, no
 * game state touched, nothing spent.
 *
 *   npx tsx scripts/doctor.ts
 *   npx tsx scripts/doctor.ts --profile=alice
 */

import { existsSync, readFileSync } from "node:fs";

import { GigaverseClient } from "../src/api/client.js";
import { mask } from "../src/api/auth.js";
import { loadBotConfig } from "../src/orchestrator/config.js";
import { loadGuardBudget } from "../src/orchestrator/guardPersistence.js";
import { resolveProfile, profileArg, dataPath, configPath } from "../src/profile.js";

const OK = "  ✓";
const BAD = "  ✗";
const WARN = "  ⚠";

let failures = 0;
const fail = (what: string, fix: string) => {
  failures++;
  console.log(`${BAD} ${what}`);
  for (const line of fix.split("\n")) console.log(`      ${line}`);
};
const pass = (what: string) => console.log(`${OK} ${what}`);
const warn = (what: string, note: string) => {
  console.log(`${WARN} ${what}`);
  for (const line of note.split("\n")) console.log(`      ${line}`);
};

/**
 * Decode a JWT's `exp` WITHOUT calling the API.
 *
 * Deliberate: "is my token expired" answered by a network round-trip is a worse
 * answer — it needs the network to be up, it costs a request, and a 401 cannot
 * distinguish "expired" from "malformed" from "revoked". The claim is right
 * there in the token. No signature verification: this is a local sanity check
 * on the user's own token, not an authentication decision.
 */
function jwtExpiry(jwt: string): { exp: number | null; malformed: boolean } {
  const parts = jwt.split(".");
  if (parts.length !== 3) return { exp: null, malformed: true };
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { exp?: number };
    return { exp: typeof payload.exp === "number" ? payload.exp : null, malformed: false };
  } catch {
    return { exp: null, malformed: true };
  }
}

const hours = (seconds: number) => `${(seconds / 3600).toFixed(1)}h`;

/** Hours until the next 11:00 Pacific rollover, which both daily caps use. */
function hoursToRollover(): number {
  const now = new Date();
  const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const next = new Date(pacific);
  next.setHours(11, 0, 0, 0);
  if (pacific >= next) next.setDate(next.getDate() + 1);
  return (next.getTime() - pacific.getTime()) / 3_600_000;
}

async function main() {
  const profile = resolveProfile(profileArg(process.argv));
  console.log(`\n▸ doctor — profile "${profile.name}"\n`);

  // ── 1. Node ──────────────────────────────────────────────────────────────
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) pass(`Node ${process.versions.node}`);
  else fail(`Node ${process.versions.node} is too old`, "This project needs Node 20 or newer. Install it from nodejs.org, then re-run.");

  // ── 2. Working directory ─────────────────────────────────────────────────
  if (existsSync("package.json") && existsSync("src") && existsSync("scripts")) {
    pass("running from the repo root");
  } else {
    fail(
      "not in the repo root",
      "Every path here is relative to the repo root. `cd` into the cloned\n" +
        "directory (the one containing package.json) and re-run.",
    );
  }

  // ── 3. The token ─────────────────────────────────────────────────────────
  let jwt: string | null = null;
  if (!existsSync(profile.jwtPath)) {
    fail(
      `no JWT at ${profile.jwtPath}`,
      "1. Log in at gigaverse.io in your browser.\n" +
        "2. Open DevTools -> Network, then play one action in the game.\n" +
        "3. Click any request to gigaverse.io/api, find the request header\n" +
        "   `Authorization: Bearer <token>`, and copy the <token> part.\n" +
        `4. Save it to ${profile.jwtPath} (the token only, no "Bearer").`,
    );
  } else {
    const raw = readFileSync(profile.jwtPath, "utf8").trim();
    if (!raw) {
      fail(`${profile.jwtPath} is empty`, "Paste the Authorization token into it — see the steps above.");
    } else if (raw.toLowerCase().startsWith("bearer ")) {
      fail(
        `${profile.jwtPath} still has the "Bearer " prefix`,
        'Store the token ONLY — delete the leading "Bearer " and the space.',
      );
    } else {
      const { exp, malformed } = jwtExpiry(raw);
      if (malformed) {
        fail(
          "the token does not parse as a JWT",
          "It should be three dot-separated chunks. You may have copied the\n" +
            "whole header line or a truncated value. Re-copy it.",
        );
      } else if (exp === null) {
        warn("the token has no `exp` claim", "Cannot check expiry locally; carrying on.");
        jwt = raw;
      } else {
        const left = exp - Math.floor(Date.now() / 1000);
        if (left <= 0) {
          fail(
            `the token EXPIRED ${hours(-left)} ago`,
            "This is normal and will keep happening — Gigaverse tokens are\n" +
              "short-lived. Re-copy it from DevTools exactly as you did the\n" +
              "first time, and overwrite the file.",
          );
        } else {
          jwt = raw;
          pass(`token present and valid for another ${hours(left)}  (${mask(raw)})`);
          if (left < 3600) {
            warn("under an hour left on this token", "A long session will outlive it. Consider re-copying now.");
          }
        }
      }
    }
  }

  // ── 4. Config ────────────────────────────────────────────────────────────
  const botJson = configPath(profile, "bot.json");
  // Shared across profiles by design — dungeon IDs and room counts are
  // properties of the game, not of an account. See Profile.discoveredPath.
  const discoveredJson = profile.discoveredPath;
  try {
    const config = loadBotConfig(botJson, discoveredJson);
    pass(
      `config valid — dungeon ${config.dungeonId}, ${config.energyCostPerRun} energy/run, ` +
        `budget ${config.dailyEnergyBudget}/day, ${config.maxRunsPerSession} runs`,
    );
    if (config.dendren) pass(`fishing configured — node ${config.dendren.nodeId}, ${config.dendren.maxCastsPerSession} casts/session`);
    else warn("no dendren block in config", "Fishing is not configured. Dungeon runs still work.");
  } catch (e) {
    fail(
      `config problem: ${(e as Error).message.split("\n")[0]}`,
      (profile.name === "default"
        ? `${botJson} is committed and should exist — check you are in the repo root.\n`
        : `${botJson} is this profile's own budget file and you need to create it.\n` +
          `  Copy the shipped one:  mkdir -p ${profile.configRoot} && cp config/bot.json ${botJson}\n`) +
        `${discoveredJson} is generated. If it is missing, run:\n` +
        "  npx tsx scripts/probe.ts",
    );
  }

  // ── 5. One authenticated GET ─────────────────────────────────────────────
  // Last, because it is the only network call and it is worth nothing if the
  // checks above already failed. Reports the resolved address so the user can
  // confirm it is THEIR account before anything runs.
  if (jwt) {
    try {
      const client = new GigaverseClient({ jwt });
      const me = await client.getMe();
      const account = await client.getAccount(me.address);
      pass(`authenticated as ${account.username ?? "(no username)"} — ${me.address}`);
      console.log(`      ^ confirm this is YOUR account before running anything that plays.`);
      if (!me.canEnterGame) warn("the API says this account cannot enter the game", "Check for an in-browser prompt (a level-up, a claim) blocking play.");
    } catch (e) {
      fail(
        `the authenticated request failed: ${(e as Error).message.split("\n")[0]}`,
        "If this says the token expired, re-copy it from DevTools. Otherwise\n" +
          "check your network and that gigaverse.io is up.",
      );
    }
  }

  // ── 6. Today's caps ──────────────────────────────────────────────────────
  // Local ledgers only — no network. The real server caps are checked by the
  // run scripts themselves at start_run.
  const toRollover = hoursToRollover();
  const dungeon = loadGuardBudget(dataPath(profile, "guard-budget.json"));
  const fishing = loadGuardBudget(dataPath(profile, "guard-budget-fishing.json"));
  console.log(
    `\n  today's local ledgers (roll over at 11:00 Pacific, ${toRollover.toFixed(1)}h from now):\n` +
      `    dungeon: ${dungeon.runsStarted} runs / ${dungeon.energySpent} energy recorded\n` +
      `    fishing: ${fishing.runsStarted} casts / ${fishing.energySpent} energy recorded`,
  );

  // ── verdict ──────────────────────────────────────────────────────────────
  if (failures === 0) {
    console.log(`\n▸ All checks passed. You are ready.\n`);
    console.log(`  A dungeon run (one run, then it stops and waits for you):`);
    console.log(`    npx tsx scripts/liveRun.ts --juiced --juiced-index=1 --runs=1\n`);
    console.log(`  Fishing:`);
    console.log(`    npx tsx scripts/liveFishing.ts --casts=1\n`);
    console.log(`  Neither will sell, burn, transfer, or send an on-chain transaction —`);
    console.log(`  see tests/clientSurface.test.ts, which fails the build if that changes.\n`);
  } else {
    console.log(`\n▸ ${failures} check(s) failed. Fix the items marked ✗ above, then re-run.\n`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
