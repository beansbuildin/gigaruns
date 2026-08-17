/**
 * scripts/probeRomsPlayer.ts — session-22 brief §3. `GET /api/roms/player?
 * id=<wallet address>` is CONFIRMED — the user captured this directly from
 * the ROMULATOR panel's own request URL (session-22 brief), the same footing
 * as every other endpoint in this project that started from a user/DevTools
 * capture rather than a guess (CLAUDE.md §2).
 *
 * READ-ONLY. Dumps the raw response (real wallet address in the `id` query
 * param and possibly in the body) to `fixtures/probe/raw/` — gitignored, per
 * the existing `fixtures/**\/raw/` convention (scripts/probeRoms.ts). A
 * redacted copy (wallet address replaced with the project's `0xUSER`
 * placeholder — DECISIONS 2026-08-13) is written to `fixtures/probe/roms/`,
 * which IS committed.
 *
 * Usage: npx tsx scripts/probeRomsPlayer.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { GigaverseClient } from "../src/api/client.js";
import { loadJwt } from "../src/api/auth.js";

const BASE = "https://gigaverse.io/api";
const RAW_DIR = "fixtures/probe/raw";
const REDACTED_DIR = "fixtures/probe/roms";

function redact(text: string, address: string): string {
  // First pass: the exact account address (case-insensitive — may appear
  // checksummed or lowercased), tagged distinctly since it's the specific
  // field (OWNER_CID) the rest of this project's fixtures already redact to.
  const addrRe = new RegExp(address, "gi");
  const withAddr = text.replace(addrRe, "0xUSER");
  // Second pass: this endpoint also carries per-ROM `lastTx` transaction
  // hashes and a shared `tableId` — any 0x + 20+ hex chars, not just the
  // account address. A tx hash resolves the transacting wallet on any block
  // explorer, so it gets the same treatment as the address itself (session
  // 22: found unredacted by the first pass alone before this was added).
  return withAddr.replace(/0x[a-fA-F0-9]{20,}/g, "0x<REDACTED>");
}

async function main() {
  const jwt = loadJwt();
  const client = new GigaverseClient({ jwt });
  const me = await client.getMe();
  console.log(`address: ${me.address.slice(0, 6)}...`);

  const url = `${BASE}/roms/player?id=${me.address}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  const text = await res.text();
  console.log(`GET /roms/player?id=<address> -> HTTP ${res.status}, ${text.length} bytes`);

  if (res.status < 200 || res.status >= 300) {
    console.log(text.slice(0, 1000));
    process.exit(1);
  }

  const json = JSON.parse(text);

  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(`${RAW_DIR}/roms-player-raw.json`, JSON.stringify(json, null, 2));

  mkdirSync(REDACTED_DIR, { recursive: true });
  const redactedText = redact(JSON.stringify(json, null, 2), me.address);
  writeFileSync(`${REDACTED_DIR}/player-response-redacted.json`, redactedText);

  // Print a shape summary: top-level keys, and if an array of ROM-like
  // entries is present, the keys of its first element.
  console.log("\nTop-level keys:", Object.keys(json));
  const arrayField = Object.entries(json as Record<string, unknown>).find(([, v]) => Array.isArray(v));
  if (arrayField) {
    const [key, arr] = arrayField as [string, unknown[]];
    console.log(`\n"${key}" is an array of ${arr.length} entries.`);
    if (arr.length > 0) {
      console.log("First entry keys:", Object.keys(arr[0] as object));
      console.log("First entry:", JSON.stringify(arr[0], null, 2));
    }
  }

  console.log(`\nRaw dump: ${RAW_DIR}/roms-player-raw.json (gitignored)`);
  console.log(`Redacted copy: ${REDACTED_DIR}/player-response-redacted.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
