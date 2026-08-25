/**
 * scripts/claimRoms.ts — session-21 brief §2. Claims energy from the known
 * ROM ids via `GigaverseClient.claimRomEnergy` (promoted this session from
 * `scripts/probeRomsFactoryClaim.ts`'s one-shot raw-fetch probe now that the
 * endpoint is CONFIRMED — SPEC.md "ROM factory-claim").
 *
 * Only 4 of the account's 37 ROMs are known (STATE.md session 20:
 * 7959, 2097, 5345, 689) — full enumeration needs the ROMULATOR panel's
 * request URL, still unconfirmed (QUESTIONS.md). Claim what's known now
 * rather than block on the rest, per the session-21 brief.
 *
 * Overflow past the account's 420 energy cap is CONFIRMED non-wasting
 * (user, session 21) — whatever doesn't fit stays banked in the ROM. So
 * there's no batching/ordering logic needed against the cap; this claims
 * every known ROM in one pass, in descending order of the last-known
 * `energyCollectable` snapshot (5345/689 ~12 each, 2097 last seen ~1,
 * 7959 never once succeeded) purely for a sensible log order, not because
 * order matters for correctness.
 *
 * ## [session 95 §E] This script used to accept any flag and ignore it
 *
 * Session 94 ran `npx tsx scripts/claimRoms.ts --dry-run` expecting a preview.
 * There was no argument parsing in this file at all, so the flag did nothing
 * and the REAL claim went through — 4 ROMs, energy 156 -> 315. No harm came of
 * it (a claim is an energy GAIN, and `liveRun.ts`'s preflight performs one
 * autonomously under rule 12), but a script that accepts a flag it does not
 * implement will eventually be trusted to have honoured it. That is CLAUDE.md
 * rule 5 — an unexpected state is a stop, not a guess — and it is the exact
 * defect `scripts/lib/cliArgs.ts` was written for in session 80.
 *
 * `--dry-run` is now real: it does the read half (getMe, getEnergy) and prints
 * the claim it WOULD send for each ROM, without ever calling
 * `client.claimRomEnergy`. Anything unrecognised is refused before the first
 * network call.
 *
 * Usage: npx tsx scripts/claimRoms.ts [--dry-run]
 */
import { GigaverseClient } from "../src/api/client.js";
import { rejectUnknownArgs } from "./lib/cliArgs.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Descending by last-known energyCollectable snapshot (STATE.md session 20 / SPEC.md).
const ROM_IDS = ["5345", "689", "2097", "7959"];

const KNOWN_ARGS = ["--dry-run"] as const;

const USAGE = `Usage: npx tsx scripts/claimRoms.ts [--dry-run]

  Claims banked energy from the four known ROM ids (${ROM_IDS.join(", ")}).

  --dry-run   read the account and print the claims that WOULD be sent;
              calls no claim endpoint and changes nothing

  An unrecognised flag is refused rather than ignored, because the default is
  to CLAIM FOR REAL — CLAUDE.md rule 5.`;

async function main() {
  rejectUnknownArgs(process.argv.slice(2), KNOWN_ARGS, USAGE);
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");

  const client = new GigaverseClient();
  const me = await client.getMe();

  const before = await client.getEnergy(me.address);
  const startEnergy = before.entities[0]?.parsedData.energyValue ?? 0;
  console.log(`Starting energy: ${startEnergy}`);
  if (dryRun) console.log("DRY RUN — no claim will be sent.\n");

  let energy = startEnergy;
  const results: { romId: string; ok: boolean; delta?: number; error?: string }[] = [];

  for (const romId of ROM_IDS) {
    await sleep(1200 + Math.random() * 400);
    try {
      const preClaim = await client.getEnergy(me.address);
      const pre = preClaim.entities[0]?.parsedData.energyValue ?? energy;

      if (dryRun) {
        // The read half only. Deliberately NOT a simulated delta: this script
        // cannot know what a ROM holds without claiming it, and printing a
        // guessed number would be the same class of mistake as the flag that
        // did nothing.
        console.log(`romId ${romId}: WOULD claim (index 0) — energy currently ${pre}`);
        results.push({ romId, ok: true });
        continue;
      }

      await sleep(1200 + Math.random() * 400);
      const res = await client.claimRomEnergy(romId, 0);
      console.log(`romId ${romId}: success=${res.success}`);

      await sleep(1200 + Math.random() * 400);
      const postClaim = await client.getEnergy(me.address);
      const post = postClaim.entities[0]?.parsedData.energyValue ?? pre;
      const delta = post - pre;
      energy = post;
      console.log(`  energy ${pre} -> ${post} (delta ${delta})`);
      results.push({ romId, ok: true, delta });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`romId ${romId}: FAILED — ${msg.slice(0, 200)}`);
      results.push({ romId, ok: false, error: msg.slice(0, 200) });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  if (dryRun) {
    console.log(`DRY RUN — nothing claimed. Energy unchanged at ${startEnergy}.`);
    console.log(`Would have attempted ${ROM_IDS.length} ROM(s): ${ROM_IDS.join(", ")}`);
    return;
  }
  console.log(`Final energy: ${energy} (started at ${startEnergy}, net +${energy - startEnergy})`);
  console.log("Per-ROM results:");
  for (const r of results) {
    console.log(`  ${r.romId}: ${r.ok ? `+${r.delta} energy` : `FAILED (${r.error})`}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
