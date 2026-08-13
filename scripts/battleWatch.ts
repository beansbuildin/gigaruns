/**
 * scripts/battleWatch.ts — READ-ONLY observation of a live dungeon run.
 *
 * Polls GET /game/dungeon/state while a human plays, and snapshots every state
 * that differs from the last one. Answers the questions a single out-of-combat
 * probe cannot: does damage hit armor before HP, does winning with Shield
 * restore armor, do charges decrement, what does a loot phase look like.
 *
 * This script ONLY issues GETs. It never posts an action, never starts a run,
 * and never spends energy. The human drives; this just watches.
 *
 *   npx tsx scripts/battleWatch.ts [seconds]
 *
 * Snapshots (raw) land in fixtures/dungeon-runs/raw/, redacted copies one level
 * up. Each snapshot is numbered in observation order.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = "https://gigaverse.io/api";
const OUT = "fixtures/dungeon-runs";
const RAW = join(OUT, "raw");

const jwt = (() => {
  const p = join(homedir(), ".secrets", "gigaverse-jwt.txt");
  if (!existsSync(p)) throw new Error(`No JWT at ${p}`);
  return readFileSync(p, "utf8").trim();
})();

const MOVES = ["rock", "paper", "scissor"] as const;
/** API uses RPS names, the game uses weapons. Map at the boundary (SPEC 2). */
const WEAPON = { rock: "Sword", paper: "Shield", scissor: "Spell" } as const;

interface Side {
  id: string;
  health: { current: number; currentMax: number };
  shield: { current: number; currentMax: number };
  lastMove: string;
  thisPlayerWin: boolean;
  otherPlayerWin: boolean;
  [k: string]: unknown;
}

function redact(json: unknown, address: string): string {
  let s = JSON.stringify(json, null, 2);
  for (const f of [address, address.toLowerCase(), address.toUpperCase()]) {
    if (f) s = s.split(f).join("0xUSER");
  }
  return s.split(jwt).join("<JWT>");
}

/** One-line summary of a side: HP, armor, and each move's ATK/DEF/charges. */
function line(p: Side): string {
  const moves = MOVES.map((m) => {
    const mv = p[m] as { currentATK: number; currentDEF: number; currentCharges: number };
    return `${WEAPON[m]} ${mv.currentATK}/${mv.currentDEF} x${mv.currentCharges}`;
  }).join("  ");
  return `HP ${p.health.current}/${p.health.currentMax}  ARM ${p.shield.current}/${p.shield.currentMax}  ${moves}`;
}

async function main() {
  mkdirSync(RAW, { recursive: true });
  const budgetSec = Number(process.argv[2] ?? 900);
  const deadline = Date.now() + budgetSec * 1000;

  console.log(`\n▸ watching for ${budgetSec}s — play normally, this only reads\n`);

  let last = "";
  let n = 0;
  let address = "";

  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/game/dungeon/state`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!res.ok) {
      console.log(`  ✗ ${res.status} — ${(await res.text()).slice(0, 120)}`);
      if (res.status === 401) throw new Error("JWT rejected. Refresh it.");
      await sleep(5000);
      continue;
    }

    const text = await res.text();
    const json = JSON.parse(text) as {
      data?: { run?: { players?: Side[] }; entity?: Record<string, unknown> } | null;
    };
    const run = json.data?.run;
    const entity = json.data?.entity;
    address ||= String(entity?.PLAYER_CID ?? "");

    // Compare on the run body alone — entity timestamps churn every poll.
    const sig = JSON.stringify(run ?? null);
    const [me, foe] = run?.players ?? [];
    if (sig !== last && me && foe) {
      last = sig;
      const tag = String(n).padStart(3, "0");

      writeFileSync(join(RAW, `state-${tag}.json`), JSON.stringify(json, null, 2));
      writeFileSync(join(OUT, `state-${tag}.json`), redact(json, address));

      const room = entity?.ROOM_NUM_CID;
      const phases = ["lootPhase", "pathPhase", "enemyPathPhase", "rewardPathPhase"]
        .filter((k) => (run as Record<string, unknown>)[k])
        .join(",");

      console.log(`── ${tag}  room ${room}  enemy ${entity?.ENEMY_CID}${phases ? `  [${phases}]` : ""}`);
      console.log(`   me   ${line(me)}`);
      console.log(`   foe  ${line(foe)}`);
      if (me.lastMove || foe.lastMove) {
        const w = me.thisPlayerWin ? "me" : foe.thisPlayerWin ? "foe" : "tie";
        console.log(
          `   last: me=${WEAPON[me.lastMove as keyof typeof WEAPON] ?? "-"}` +
            ` foe=${WEAPON[foe.lastMove as keyof typeof WEAPON] ?? "-"}  won: ${w}`,
        );
      }
      const loot = (run as Record<string, unknown>).lootOptions as unknown[] | undefined;
      if (loot?.length) console.log(`   loot: ${JSON.stringify(loot).slice(0, 400)}`);
      n++;
    }

    await sleep(1200 + Math.random() * 400);
  }

  console.log(`\n▸ ${n} distinct states → ${OUT}/\n`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

main().catch((e) => {
  console.error("\n✗", e.message, "\n");
  process.exit(1);
});
