/**
 * scripts/probe.ts — READ-ONLY Gigaverse discovery.
 *
 * Resolves the real IDs for Forbidden Woods and Dendren, dumps every response
 * to fixtures/probe/, and reports whether move charges are visible.
 *
 * This script NEVER starts a run, spends energy, or sends a transaction.
 *
 *   AUTH_MODE=jwt  npx tsx scripts/probe.ts     # borrow browser session
 *   AUTH_MODE=eoa  npx tsx scripts/probe.ts     # bot-owned wallet
 *
 * Deps: npm i viem tsx
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { privateKeyToAccount } from "viem/accounts";

const BASE = "https://gigaverse.io/api";
const OUT = "fixtures/probe";
const SECRETS = join(homedir(), ".secrets");

/** Names we're hunting for. Case-insensitive substring match. */
const TARGETS = [/forbidden/i, /woods/i, /dendren/i];

// ─── auth ────────────────────────────────────────────────────────────────────

function readSecret(name: string): string | null {
  const p = join(SECRETS, name);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : null;
}

const mask = (t: string) => `${t.slice(0, 8)}…(${t.length} chars)`;

/**
 * Path A: reuse a JWT copied from the browser's Authorization header.
 * Start here — it requires no signing and works with Abstract Global Wallet.
 */
function authFromJwt(): string {
  const jwt = readSecret("gigaverse-jwt.txt");
  if (!jwt) {
    throw new Error(
      "No JWT at ~/.secrets/gigaverse-jwt.txt\n" +
        "Log into gigaverse.io, DevTools > Network, play one action, copy the\n" +
        "Authorization: Bearer <token> value into that file.",
    );
  }
  return jwt;
}

/**
 * Path B: sign in with a bot-owned EOA.
 *
 * WARNING: this authenticates the EOA's OWN account. If the user plays via
 * Abstract Global Wallet, this is a DIFFERENT, EMPTY account — login will
 * succeed and the character will be missing. See SPEC 1a.
 */
async function authFromEoa(): Promise<string> {
  const pk = readSecret("gigaverse-private-key.txt");
  if (!pk) throw new Error("No key at ~/.secrets/gigaverse-private-key.txt");

  const account = privateKeyToAccount(pk as `0x${string}`);
  const timestamp = Date.now();
  const message = `Login to Gigaverse at ${timestamp}`; // exact format, do not alter
  const signature = await account.signMessage({ message });

  const res = await fetch(`${BASE}/user/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signature,
      address: account.address,
      message,
      timestamp, // must match the value inside `message`
      agent_metadata: {
        type: "custom-bot",
        model: process.env.GIGAVERSE_AGENT_MODEL ?? "unknown",
      },
    }),
  });

  if (!res.ok) throw new Error(`auth failed ${res.status}: ${await res.text()}`);

  // Shape is unconfirmed — see the throw below, which reports the real keys.
  const body = (await res.json()) as Record<string, any>;
  const jwt = body.jwt ?? body.token ?? body.authToken ?? body.data?.jwt;
  if (!jwt) {
    // Field name is unconfirmed — show the shape rather than guessing further.
    throw new Error(`No JWT found. Response keys: ${Object.keys(body).join(", ")}`);
  }
  return jwt;
}

// ─── fetching ────────────────────────────────────────────────────────────────

let jwt = "";
let lastCall = 0;

async function get(path: string, label: string): Promise<unknown | null> {
  // Be a polite client even though this is read-only.
  const wait = 1200 + Math.random() * 400 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  const text = await res.text();
  if (!res.ok) {
    console.log(`  ✗ ${label}  ${res.status}  ${text.slice(0, 200)}`);
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.log(`  ✗ ${label}  non-JSON response`);
    return null;
  }

  // Raw and unmodified — this is the ground truth the spec gets corrected against.
  writeFileSync(join(OUT, `${label}.json`), JSON.stringify(json, null, 2));
  console.log(`  ✓ ${label}  (${text.length} bytes)`);
  return json;
}

// ─── searching ───────────────────────────────────────────────────────────────

interface Hit {
  path: string;
  matched: string;
  container: unknown;
}

/**
 * Walk any JSON shape looking for target names. Returns the *containing object*
 * for each hit, not just the string — the sibling fields are what carry the id,
 * energy cost, and room count.
 */
function search(node: unknown, path = "$", out: Hit[] = [], parent?: unknown): Hit[] {
  if (typeof node === "string") {
    for (const re of TARGETS) {
      if (re.test(node)) {
        out.push({ path, matched: node, container: parent ?? node });
        break;
      }
    }
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => search(v, `${path}[${i}]`, out, node));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      search(v, `${path}.${k}`, out, node);
    }
  }
  return out;
}

/** Pull the most likely id field out of a matched container. */
function guessId(container: unknown): unknown {
  if (!container || typeof container !== "object") return null;
  const obj = container as Record<string, unknown>;
  const keys = ["ID_CID", "id", "dungeonId", "DUNGEON_CID", "nodeId", "_id", "docId"];
  for (const k of keys) if (k in obj) return obj[k];
  return null;
}

/** Look for anything that smells like a per-move charge counter. */
function findChargeFields(node: unknown, path = "$", out: string[] = []): string[] {
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (/charge|uses|cooldown|remaining|stamina/i.test(k)) {
        out.push(`${path}.${k} = ${JSON.stringify(v)}`);
      }
      findChargeFields(v, `${path}.${k}`, out);
    }
  }
  return out;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync("config", { recursive: true });

  const mode = process.env.AUTH_MODE ?? "jwt";
  console.log(`\n▸ auth (${mode})`);
  jwt = mode === "eoa" ? await authFromEoa() : authFromJwt();
  console.log(`  jwt ${mask(jwt)}`);

  const me = (await get("/user/me", "user-me")) as Record<string, any> | null;
  if (!me) throw new Error("Session invalid. Refresh the JWT and retry.");

  // Address can sit under several keys depending on account type — probe, don't assume.
  const address =
    me.address ?? me.data?.address ?? me.user?.address ?? me.checksumAddress;
  console.log(`  address: ${address ?? "NOT FOUND — inspect user-me.json"}`);

  console.log("\n▸ endpoints");
  const responses: Record<string, unknown> = {};
  const endpoints: [string, string][] = [
    ["/game/dungeon/today", "dungeon-today"],
    ["/game/dungeon/state", "dungeon-state"],
    ["/items/balances", "items-balances"],
    ["/gigajuice/player/" + address, "juice"],
    ["/offchain/player/energy/" + address, "energy"],
    ["/game/account/" + address, "account"],
  ];

  for (const [path, label] of endpoints) {
    const r = await get(path, label);
    if (r) responses[label] = r;
  }

  // ── target search ────────────────────────────────────────────────────────
  console.log("\n▸ searching for Forbidden Woods / Dendren");
  const discovered: Record<string, unknown> = { probedAt: new Date().toISOString() };
  let found = false;

  for (const [label, body] of Object.entries(responses)) {
    for (const hit of search(body)) {
      found = true;
      const id = guessId(hit.container);
      console.log(`\n  ── "${hit.matched}"  in ${label} at ${hit.path}`);
      console.log(`     id: ${JSON.stringify(id)}`);
      console.log(`     container: ${JSON.stringify(hit.container, null, 2).slice(0, 900)}`);

      const key = /dendren/i.test(hit.matched) ? "dendren" : "forbiddenWoods";
      discovered[key] = { id, source: `${label}${hit.path}`, container: hit.container };
    }
  }

  if (!found) {
    console.log(
      "\n  ✗ No matches.\n" +
        "    Forbidden Woods may be gated behind progression, be seasonal, or\n" +
        "    live on an endpoint not probed here. Read fixtures/probe/*.json by\n" +
        "    hand for a dungeon list, and check whether the in-game name differs\n" +
        "    from the API name. Do NOT guess an id — log this to QUESTIONS.md.",
    );
  }

  // ── the strategy-defining question ───────────────────────────────────────
  console.log("\n▸ move charges (determines strategy design — SPEC §4)");
  const charges = Object.entries(responses).flatMap(([label, body]) =>
    findChargeFields(body, label),
  );
  if (charges.length) {
    console.log("  ✓ charge-like fields present:");
    charges.slice(0, 40).forEach((c) => console.log(`     ${c}`));
    console.log("\n  → Enemy move sets can likely be pruned. Big edge. Build §4a pruning.");
  } else {
    console.log(
      "  ? none found — but dungeon-state is empty outside an active run.\n" +
        "    Re-run this probe DURING a live battle to answer properly.",
    );
  }

  writeFileSync("config/discovered.json", JSON.stringify(discovered, null, 2));
  console.log("\n▸ wrote config/discovered.json + fixtures/probe/*.json\n");
}

main().catch((e) => {
  console.error("\n✗", e.message, "\n");
  process.exit(1);
});
