/**
 * scripts/parseHar.ts — Task 7. Extracts the fishing API surface from a
 * browser HAR capture (`fixtures/**\/*.har`, gitignored — never committed,
 * carries live session context per CLAUDE.md §3).
 *
 * Writes two REDACTED, committed fixtures:
 *   - fixtures/fishing-casts/cast.json           one full Dendren cast,
 *                                                 start_run through terminal
 *   - fixtures/fishing-casts/item-metadata-sample.json
 *                                                 a curated subset of
 *                                                 GET /offchain/static's
 *                                                 `gameItems[]` — the full
 *                                                 endpoint is ~900KB and
 *                                                 mostly irrelevant to this
 *                                                 bot, so only items this
 *                                                 project actually cares
 *                                                 about (potions, Hard Core,
 *                                                 Forbidden Woods entry
 *                                                 items) are kept.
 *
 * Also prints an endpoint summary (method + path + count) to stdout — this
 * is what SPEC-fishing.md's endpoint table was built from.
 *
 * Redaction follows scripts/watch.ts's `redact()` exactly: the player's own
 * wallet address (found in the HAR's own request URLs — this capture has no
 * visible Authorization header, see SPEC-fishing.md §0) and any
 * `*username*` field are replaced. Never assume a HAR is clean without this
 * step — CLAUDE.md §3.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "fixtures/fishing-casts";

interface HarEntry {
  request: { method: string; url: string; postData?: { text?: string } };
  response: { status: number; content: { text?: string } };
}

/** Node 20-compatible recursive .har finder — no fs.globSync (Node 22+ only). */
function findHarFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...findHarFiles(p));
    else if (name.endsWith(".har")) out.push(p);
  }
  return out;
}

function findDefaultHar(): string {
  const candidates = findHarFiles("fixtures");
  if (candidates.length === 0) {
    throw new Error("No .har file found under fixtures/. Pass a path: npx tsx scripts/parseHar.ts <path>");
  }
  if (candidates.length > 1) {
    console.log(`Multiple .har files found, using the first: ${candidates.join(", ")}`);
  }
  return candidates[0]!;
}

function redact(raw: string, address: string): string {
  let s = raw;
  for (const form of [address, address.toLowerCase(), address.toUpperCase()]) {
    if (form) s = s.split(form).join("0xUSER");
  }
  return s.replace(/("(?:[A-Za-z_]*[Uu]ser[Nn]ame[A-Za-z_]*)"\s*:\s*)"[^"]*"/g, '$1"<USER>"');
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function main() {
  const harPath = process.argv[2] ?? findDefaultHar();
  console.log(`Parsing ${harPath}`);
  const har = JSON.parse(readFileSync(harPath, "utf8")) as { log: { entries: HarEntry[] } };
  const entries = har.log.entries;

  // ── endpoint summary ──────────────────────────────────────────────────────
  const counts = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.request.method} ${pathOf(e.request.url)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log(`\n${entries.length} total entries, ${counts.size} distinct endpoints:`);
  for (const [k, v] of [...counts.entries()].sort()) console.log(`  ${v}x  ${k}`);

  // ── find the player address to redact (from any /api/*/​<address> path) ────
  let address = "";
  for (const e of entries) {
    const m = pathOf(e.request.url).match(/0x[0-9a-fA-F]{40}/);
    if (m) {
      address = m[0];
      break;
    }
  }
  if (!address) console.log("\nWARNING: no 0x-address found in any request path — redaction will only cover username fields.");
  else console.log(`\nRedacting address ${address.slice(0, 6)}...`);

  const hasAuthHeader = entries.some((e) => "headers" in e.request && (e.request as unknown as { headers: { name: string }[] }).headers?.some((h) => /authoriz/i.test(h.name)));
  console.log(`Authorization header present anywhere in HAR: ${hasAuthHeader}`);

  mkdirSync(OUT_DIR, { recursive: true });

  // ── one full fishing cast: start_run + every play_cards, in order ─────────
  const fishingCalls = entries.filter((e) => pathOf(e.request.url) === "/api/fishing/action");
  const cast = fishingCalls.map((e) => ({
    request: JSON.parse(redact(e.request.postData?.text ?? "{}", address)),
    response: JSON.parse(redact(e.response.content.text ?? "{}", address)),
  }));
  writeFileSync(join(OUT_DIR, "cast.json"), JSON.stringify(cast, null, 2));
  console.log(`\nWrote ${OUT_DIR}/cast.json — ${cast.length} fishing/action calls (redacted).`);

  // ── fishing/cards and fishing/state, for the deck + pond-tier reference data ──
  const cardsEntry = entries.find((e) => pathOf(e.request.url) === "/api/fishing/cards");
  const stateEntry = entries.find((e) => pathOf(e.request.url).startsWith("/api/fishing/state/"));
  if (cardsEntry) {
    writeFileSync(join(OUT_DIR, "cards.json"), redact(cardsEntry.response.content.text ?? "{}", address));
    console.log(`Wrote ${OUT_DIR}/cards.json`);
  }
  if (stateEntry) {
    writeFileSync(join(OUT_DIR, "state.json"), redact(stateEntry.response.content.text ?? "{}", address));
    console.log(`Wrote ${OUT_DIR}/state.json`);
  }

  // ── item metadata: curated subset of offchain/static's gameItems[] ────────
  const staticEntry = entries.find((e) => pathOf(e.request.url) === "/api/offchain/static");
  const balancesEntry = entries.find((e) => pathOf(e.request.url) === "/api/items/balances");
  if (staticEntry) {
    const body = JSON.parse(staticEntry.response.content.text ?? "{}") as {
      gameItems: Array<{ docId: string; NAME_CID: string; TYPE_CID?: string }>;
    };
    const heldIds = new Set<string>();
    if (balancesEntry) {
      const bal = JSON.parse(balancesEntry.response.content.text ?? "{}") as { entities: Array<{ ID_CID: string }> };
      for (const e of bal.entities) heldIds.add(e.ID_CID);
    }
    // Keep: anything typed Consumable (potions), item 845 (Hard Core, the
    // scored leaderboard currency), and anything currently in the captured
    // player's inventory — a representative, size-bounded sample, not the
    // full ~625-entry catalog.
    const sample = body.gameItems.filter((it) => it.TYPE_CID === "Consumable" || it.docId === "845" || heldIds.has(it.docId));
    writeFileSync(join(OUT_DIR, "item-metadata-sample.json"), JSON.stringify(sample, null, 2));
    console.log(`Wrote ${OUT_DIR}/item-metadata-sample.json — ${sample.length}/${body.gameItems.length} gameItems (Consumables + Hard Core + held items).`);
  } else {
    console.log("No /api/offchain/static entry in this HAR — item-metadata-sample.json not written.");
  }

  console.log("\nDone. Cross-check output against SPEC-fishing.md before trusting any endpoint as CONFIRMED.");
}

main();
