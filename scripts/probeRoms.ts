/**
 * scripts/probeRoms.ts — READ-ONLY. Session-19 brief: the user captured two
 * real `POST /api/roms/factory-claim` request bodies in-browser
 * ({romId:"7959",claimId:"energy",amount:7} and
 * {romId:"2097",claimId:"energy",amount:57}) and confirmed the endpoint
 * directly, so it's written into SPEC.md/config/discovered.json as
 * CONFIRMED without a probe (CLAUDE.md §2). What's still open is (1) a
 * ROM-enumeration read endpoint — how many ROMs this wallet holds beyond
 * the two known IDs — and (2) whether `amount` is a request field or purely
 * server-determined. Per CLAUDE.md §2 ("dump the full response of a related
 * endpoint and look for it"), this dumps `GET /user/me`, `GET /game/account/
 * {address}`, and `GET /offchain/static` and searches every payload for any
 * field mentioning "rom" (case-insensitive, word-ish) or "factory".
 *
 * Usage: npx tsx scripts/probeRoms.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { GigaverseClient } from "../src/api/client.js";
import { loadJwt } from "../src/api/auth.js";

const BASE = "https://gigaverse.io/api";
const OUT_DIR = "fixtures/probe";

function findRomFields(node: unknown, path: string, hits: string[], seen: Set<unknown>) {
  if (node === null || typeof node !== "object" || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    node.slice(0, 50).forEach((v, i) => findRomFields(v, `${path}[${i}]`, hits, seen));
    return;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const keyHit = /rom|factory/i.test(k);
    const valHit = typeof v === "string" && /rom|factory/i.test(v);
    if (keyHit || valHit) {
      const shown = typeof v === "object" ? "(object, see below)" : JSON.stringify(v);
      hits.push(`${path}.${k} = ${shown}`);
    }
    findRomFields(v, `${path}.${k}`, hits, seen);
  }
}

async function dumpRaw(path: string, jwt: string, filename: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${jwt}` } });
  const text = await res.text();
  console.log(`GET ${path} -> HTTP ${res.status}, ${text.length} bytes`);
  if (res.status < 200 || res.status >= 300) {
    console.log(text.slice(0, 500));
    return null;
  }
  const json = JSON.parse(text);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${filename}`, JSON.stringify(json, null, 2));
  return json;
}

async function main() {
  const jwt = loadJwt();
  const client = new GigaverseClient({ jwt });
  const me = await client.getMe();
  console.log(`address: ${me.address}\n`);

  const targets: Array<[string, string]> = [
    ["/user/me", "roms-user-me-raw.json"],
    [`/game/account/${me.address}`, "roms-account-raw.json"],
    ["/offchain/static", "roms-offchain-static-raw.json"],
  ];

  const seen = new Set<unknown>();
  const allHits: string[] = [];
  for (const [path, filename] of targets) {
    const json = await dumpRaw(path, jwt, filename);
    if (json === null) continue;
    const before = allHits.length;
    findRomFields(json, `$[${path}]`, allHits, seen);
    console.log(`  ${allHits.length - before} rom/factory-related field(s) found.`);
  }

  console.log(`\n${allHits.length} total field(s) mentioning "rom" or "factory" across all dumps:`);
  for (const h of allHits.slice(0, 100)) console.log(`  ${h}`);
  if (allHits.length > 100) console.log(`  ...and ${allHits.length - 100} more`);
  console.log(`\nFull raw dumps written to ${OUT_DIR}/ (gitignored).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
