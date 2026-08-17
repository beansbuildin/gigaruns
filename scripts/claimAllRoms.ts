/**
 * scripts/claimAllRoms.ts — session-22 brief §3. Supersedes the hardcoded
 * 4-id `scripts/claimRoms.ts` for full-account claiming, now that
 * `GET /roms/player?id=<address>` (CONFIRMED session 22, SPEC.md "ROM
 * enumeration") gives the real list of all 37 owned ROMs and their current
 * `factoryStats.energyCollectable`.
 *
 * Sourced live each run (never a hardcoded id list) — the whole point of
 * this successor over `claimRoms.ts` is not needing a hand-maintained id
 * set. Filters to `energyCollectable > 0` (37 ROMs but not all have
 * anything to claim right now) and claims in descending order by claimable
 * amount, so the biggest wins land first if the run is interrupted.
 *
 * No cap-aware batching against the account's 420 energy ceiling — overflow
 * is CONFIRMED non-wasting (user, session 21; SPEC.md "ROM factory-claim"):
 * whatever doesn't fit stays banked in the ROM, not lost. Safe to claim
 * everything in one pass regardless of current account energy.
 *
 * `--limit=N` claims only the top N by energyCollectable — use this to
 * live-verify against a handful of the 33 newly-discovered ROMs before
 * trusting the pattern holds across all of them (session-22 brief §3's
 * explicit instruction). Omit for a full pass once verified.
 *
 * Usage: npx tsx scripts/claimAllRoms.ts [--limit=N]
 */
import { GigaverseClient } from "../src/api/client.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  const client = new GigaverseClient();
  const me = await client.getMe();

  const romsResp = await client.getRomsPlayer(me.address);
  const claimable = romsResp.entities
    .map((e) => ({ docId: e.docId, energyCollectable: e.factoryStats.energyCollectable }))
    .filter((r) => r.energyCollectable > 0)
    .sort((a, b) => b.energyCollectable - a.energyCollectable);

  const toClaim = limit ? claimable.slice(0, limit) : claimable;
  console.log(
    `${romsResp.entities.length} ROMs total, ${claimable.length} with energyCollectable > 0, claiming ${toClaim.length}${limit ? ` (--limit=${limit})` : ""}.`,
  );
  console.log(`Snapshot sum across the ${toClaim.length} being claimed: ${toClaim.reduce((s, r) => s + r.energyCollectable, 0)} energy.`);

  await sleep(1200 + Math.random() * 400);
  const before = await client.getEnergy(me.address);
  const startEnergy = before.entities[0]?.parsedData.energyValue ?? 0;
  console.log(`Starting account energy: ${startEnergy}`);

  let energy = startEnergy;
  const results: { docId: string; snapshot: number; ok: boolean; delta?: number; error?: string }[] = [];

  for (const rom of toClaim) {
    await sleep(1200 + Math.random() * 400);
    try {
      const preClaim = await client.getEnergy(me.address);
      const pre = preClaim.entities[0]?.parsedData.energyValue ?? energy;

      await sleep(1200 + Math.random() * 400);
      const res = await client.claimRomEnergy(rom.docId, 0);
      console.log(`docId ${rom.docId} (snapshot ${rom.energyCollectable}): success=${res.success}`);

      await sleep(1200 + Math.random() * 400);
      const postClaim = await client.getEnergy(me.address);
      const post = postClaim.entities[0]?.parsedData.energyValue ?? pre;
      const delta = post - pre;
      energy = post;
      console.log(`  energy ${pre} -> ${post} (delta ${delta})`);
      results.push({ docId: rom.docId, snapshot: rom.energyCollectable, ok: true, delta });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`docId ${rom.docId} (snapshot ${rom.energyCollectable}): FAILED — ${msg.slice(0, 200)}`);
      results.push({ docId: rom.docId, snapshot: rom.energyCollectable, ok: false, error: msg.slice(0, 200) });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Final energy: ${energy} (started at ${startEnergy}, net +${energy - startEnergy})`);
  console.log("Per-ROM results:");
  for (const r of results) {
    console.log(`  ${r.docId} (snapshot ${r.snapshot}): ${r.ok ? `+${r.delta} energy` : `FAILED (${r.error})`}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
