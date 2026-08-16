/**
 * scripts/probeCraftAction.ts — READ-ONLY. Session-17 brief authorized one
 * live craft attempt to settle whether crafting energy shares the 240/day
 * pool, but no crafting POST endpoint has ever been confirmed anywhere in
 * this repo — only the read-only `GET /offchain/static` recipes data
 * (DECISIONS.md 2026-08-16, session 15). CLAUDE.md §2: never invent an
 * endpoint; dump a related endpoint and look for it instead.
 *
 * This dumps a fresh `GET /offchain/static` response to
 * fixtures/probe/offchain-static-raw.json (gitignored raw; this script does
 * not commit it) and searches the recipe entries and the whole payload for
 * any field that looks like an action name or a craft-specific endpoint
 * hint, so the actual craft attempt (if one is possible) uses a confirmed
 * name rather than a guess.
 *
 * Usage: npx tsx scripts/probeCraftAction.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { loadJwt, mask } from "../src/api/auth.js";

const BASE = "https://gigaverse.io/api";
const OUT_DIR = "fixtures/probe";

async function main() {
  const jwt = loadJwt();
  console.log(`Using JWT ${mask(jwt)}`);

  const res = await fetch(`${BASE}/offchain/static`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const text = await res.text();
  console.log(`GET /offchain/static -> HTTP ${res.status}, ${text.length} bytes`);

  if (res.status < 200 || res.status >= 300) {
    console.log(text.slice(0, 2000));
    process.exit(1);
  }

  const json = JSON.parse(text);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/offchain-static-raw.json`, JSON.stringify(json, null, 2));
  console.log(`Full raw response written to ${OUT_DIR}/offchain-static-raw.json (gitignored)`);

  const topKeys = Array.isArray(json) ? [] : Object.keys(json);
  console.log(`Top-level keys: ${topKeys.join(", ")}`);

  const data = json.data ?? json;
  const recipes = data.recipes ?? data.craftingRecipes ?? null;
  if (Array.isArray(recipes)) {
    console.log(`\n${recipes.length} recipe entries. First entry's keys:`);
    console.log(Object.keys(recipes[0] ?? {}).join(", "));
    const bigHeal = recipes.find((r: any) =>
      JSON.stringify(r).includes("131") || JSON.stringify(r).toLowerCase().includes("heal"),
    );
    if (bigHeal) {
      console.log(`\nA heal-juice-looking recipe entry, full object:`);
      console.log(JSON.stringify(bigHeal, null, 2));
    }
  } else {
    console.log("No `recipes`/`craftingRecipes` array found at data top level.");
  }

  // Search the whole payload for any string field that looks like an action
  // name (snake_case, contains "craft") — this is the thing we're hunting for.
  const hits: string[] = [];
  const seen = new Set<unknown>();
  function walk(node: unknown, path: string) {
    if (node === null || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.slice(0, 50).forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === "string" && /craft/i.test(v)) {
        hits.push(`${path}.${k} = ${JSON.stringify(v)}`);
      }
      if (/craft/i.test(k) && typeof v !== "object") {
        hits.push(`${path}.${k} = ${JSON.stringify(v)}`);
      }
      walk(v, `${path}.${k}`);
    }
  }
  walk(json, "$");

  console.log(`\n${hits.length} field(s) mentioning "craft" anywhere in the payload:`);
  for (const h of hits.slice(0, 60)) console.log(`  ${h}`);
  if (hits.length > 60) console.log(`  ...and ${hits.length - 60} more`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
