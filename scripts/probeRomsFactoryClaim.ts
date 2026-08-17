/**
 * scripts/probeRomsFactoryClaim.ts — session-19 brief. `POST /api/roms/
 * factory-claim` is CONFIRMED by the user's own DevTools capture (two real
 * request bodies: {romId:"7959",claimId:"energy",amount:7} and
 * {romId:"2097",claimId:"energy",amount:57}), so this is not inventing an
 * endpoint (CLAUDE.md §2) — it's the first live call against a
 * user-confirmed one, same footing as the dungeon/fishing endpoints when
 * they were first exercised. No wallet signature or gas prompt (user-
 * confirmed), so this is a routine authenticated write, not an on-chain
 * spend under CLAUDE.md's ask-first list.
 *
 * Per DECISIONS 2026-08-13 ("schemas are written from observed responses,
 * never from SPEC"), this uses a raw fetch (not a typed client method —
 * none exists yet) so the FIRST real response can be captured before any
 * schema is written, mirroring how `reward_one`/`path_two`/`loot` were each
 * first confirmed via a raw/DevTools capture before being wired in.
 *
 * ONE romId per invocation, ONE attempt, deliberately — this mutates real
 * account state (claims real energy), so each call is inspected before the
 * next one is decided on, rather than looping unattended. CLAUDE.md §7's
 * 1200ms+jitter floor applies even off the dungeon/fishing action-token
 * chains, since this raw fetch bypasses the client's built-in limiter.
 *
 * Usage: npx tsx scripts/probeRomsFactoryClaim.ts <romId> [--with-amount=N]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { GigaverseClient } from "../src/api/client.js";
import { loadJwt } from "../src/api/auth.js";

const BASE = "https://gigaverse.io/api";
const OUT_DIR = "fixtures/probe/roms";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rawPost(jwt: string, body: unknown): Promise<{ status: number; json: unknown; text: string }> {
  const res = await fetch(`${BASE}/roms/factory-claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // leave json null, text still printed
  }
  return { status: res.status, json, text };
}

async function main() {
  const romId = process.argv[2];
  const withAmountArg = process.argv.find((a) => a.startsWith("--with-amount="));
  const withAmount = withAmountArg ? Number(withAmountArg.split("=")[1]) : undefined;
  if (!romId) {
    console.error("Usage: npx tsx scripts/probeRomsFactoryClaim.ts <romId> [--with-amount=N]");
    process.exit(1);
  }

  const jwt = loadJwt();
  const client = new GigaverseClient({ jwt });
  const me = await client.getMe();
  mkdirSync(OUT_DIR, { recursive: true });

  const before = await client.getEnergy(me.address);
  const beforeVal = before.entities[0]?.parsedData.energyValue;
  console.log(`BEFORE: energyValue=${beforeVal} (raw: ${JSON.stringify(before.entities[0]?.parsedData)})\n`);

  await sleep(1200 + Math.random() * 400);
  const body: Record<string, unknown> = { romId, claimId: "energy" };
  if (withAmount !== undefined) body.amount = withAmount;
  console.log(`POST /roms/factory-claim body=${JSON.stringify(body)}`);
  const result = await rawPost(jwt, body);
  console.log(`-> HTTP ${result.status}: ${result.text.slice(0, 1000)}`);
  const suffix = withAmount !== undefined ? "withAmount" : "noAmount";
  writeFileSync(`${OUT_DIR}/claim-${romId}-${suffix}.json`, JSON.stringify(result.json ?? result.text, null, 2));

  await sleep(1200 + Math.random() * 400);
  const after = await client.getEnergy(me.address);
  const afterVal = after.entities[0]?.parsedData.energyValue;
  console.log(`\nAFTER: energyValue=${afterVal} (raw: ${JSON.stringify(after.entities[0]?.parsedData)})`);
  console.log(`DELTA: ${afterVal! - beforeVal!}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
