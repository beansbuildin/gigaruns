/**
 * scripts/fishBatchReport.ts — read-only per-batch fishing report: casts vs
 * catches, catch rate, the species/tier breakdown of what was caught, and the
 * Hard Core total. Zero energy, one GET (the item catalog, for names/tiers).
 *
 * WHY THIS EXISTS. The catch rate has been recounted by hand from the batch
 * log's `cast_over` events three sessions running, and session 122 recorded
 * the trap: `loadFishingCorpus`'s records carry `caughtFish` as `null` on the
 * states inspected, so the obvious corpus-side computation returns 0/433 and
 * is WRONG. This reads the one field that is actually populated —
 * `gameItemBalanceChanges` on the terminal doc of a caught cast — which is
 * also where the fish species id and the Hard Core payout live.
 *
 * A cast that caught something records `[{id: <fish>, amount: 1}, {id: 845,
 * amount: <hard cores>}]`; an escaped cast records nothing. `rarity` in that
 * change row is **-1 and is not the tier** — the tier comes from the item
 * catalog's `RARITY_NAME`, which is why this makes one network read.
 *
 * Usage: npx tsx scripts/fishBatchReport.ts [--since=YYYY-MM-DDTHH:MM]
 *        (default: casts from the last 6 hours)
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { GigaverseClient } from "../src/api/client.js";

const HARD_CORE = 845;
const DENDREN_ROOT = 846;
/**
 * Default location of the live cast captures. **A DEFAULT, not a hard-coded
 * destination** — `--dir=<path>` overrides it, so a caller pointing at another
 * tree (a test, or a second profile) passes one rather than editing this file.
 * Same shape as `scripts/fishingReport.ts`'s report-path constants, which
 * `tests/noHardcodedPaths.test.ts` already inventories on those terms.
 */
const DEFAULT_LIVE_DIR = join("fixtures", "fishing-casts", "live");

interface Caught {
  itemId: number;
  hardCore: number;
  root: number;
}

/**
 * A cast dir with a single state is NOT a played cast — it is a `--dry-run`
 * capture (start_run was never POSTed) or a cast the server refused. Counting
 * those inflates the denominator and understates the catch rate, which is
 * exactly the kind of quiet denominator error session 121 had to buy a
 * measurement to fix. `played` is therefore gated on more than one state.
 */
export function scanCast(dir: string): { caught: Caught | null; played: boolean } {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  let itemId = 0;
  let hardCore = 0;
  let root = 0;
  for (const f of files) {
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    const data = (o.data ?? {}) as Record<string, unknown>;
    const changes = ((o.gameItemBalanceChanges ?? data.gameItemBalanceChanges ?? []) as {
      id?: number;
      amount?: number;
    }[]);
    for (const c of changes) {
      const id = Number(c.id ?? -1);
      const amt = Number(c.amount ?? 0);
      if (id === HARD_CORE) hardCore += amt;
      else if (id === DENDREN_ROOT) root += amt;
      else if (id > 0 && amt > 0) itemId = id;
    }
  }
  return { caught: itemId > 0 ? { itemId, hardCore, root } : null, played: files.length > 1 };
}

async function main() {
  const LIVE_DIR = process.argv.find((a) => a.startsWith("--dir="))?.split("=")[1] ?? DEFAULT_LIVE_DIR;
  const sinceArg = process.argv.find((a) => a.startsWith("--since="))?.split("=")[1];
  const since = sinceArg ? new Date(sinceArg) : new Date(Date.now() - 6 * 3600 * 1000);

  if (!existsSync(LIVE_DIR)) {
    console.log("no live fishing fixtures on disk");
    return;
  }
  const dirs = readdirSync(LIVE_DIR)
    .filter((d) => d.startsWith("cast-"))
    .filter((d) => {
      // cast-YYYY-MM-DD-HH-MM-SS
      const m = /^cast-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/.exec(d);
      if (!m) return false;
      const t = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
      return t >= since;
    })
    .sort();

  let catches = 0;
  let hardCore = 0;
  let root = 0;
  const species = new Map<number, number>();
  let played = 0;
  for (const d of dirs) {
    const { caught, played: wasPlayed } = scanCast(join(LIVE_DIR, d));
    if (wasPlayed) played++;
    if (!caught) continue;
    catches++;
    hardCore += caught.hardCore;
    root += caught.root;
    species.set(caught.itemId, (species.get(caught.itemId) ?? 0) + 1);
  }

  // Names and tiers come from the catalog; the change row's own `rarity` is -1.
  const names = new Map<number, { name: string; tier: string }>();
  if (species.size > 0) {
    const c = new GigaverseClient() as unknown as {
      raw: (p: string, o: object) => Promise<{ text: string }>;
    };
    const { text } = await c.raw("/offchain/static", { method: "GET" });
    const items = (JSON.parse(text) as { gameItems?: Record<string, unknown>[] }).gameItems ?? [];
    for (const id of species.keys()) {
      const it = items.find((g) => Number(g.ID_CID) === id);
      names.set(id, {
        name: String(it?.NAME_CID ?? `item ${id}`),
        tier: String(it?.RARITY_NAME ?? "?"),
      });
    }
  }

  const rate = played > 0 ? (100 * catches) / played : 0;
  console.log(`▸ fishing batch — casts since ${since.toISOString()}\n`);
  console.log(`  cast dirs seen: ${dirs.length}  (dry-run / server-refused dirs excluded below)`);
  console.log(`  casts PLAYED:   ${played}`);
  console.log(`  catches:        ${catches}`);
  console.log(`  escaped:        ${played - catches}`);
  console.log(`  catch rate:     ${rate.toFixed(1)}%`);
  console.log(`  Hard Core:      ${hardCore}`);
  console.log(`  Dendren Root:   ${root}\n`);
  if (species.size === 0) {
    console.log("  no catches recorded");
    return;
  }
  console.log(`  ${"fish".padEnd(28)} ${"tier".padEnd(12)} count`);
  const rows = [...species.entries()].sort((a, b) => b[1] - a[1]);
  for (const [id, n] of rows) {
    const meta = names.get(id)!;
    console.log(`  ${meta.name.padEnd(28)} ${meta.tier.padEnd(12)} ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
