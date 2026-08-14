/**
 * scripts/watch.ts — READ-ONLY observation of a live dungeon run.
 *
 * Polls GET /game/dungeon/state on a fixed 2.5s cadence, hashes each response,
 * and writes a fixture only when the state actually changes. The human plays;
 * this only ever reads. There is no POST in this file and there must never be
 * one — starting a run or sending a move costs energy (CLAUDE.md §4).
 *
 *   npx tsx scripts/watch.ts [seconds]        # default 1800
 *
 * Two deliberate choices, both learned the hard way:
 *
 * 1. The hash covers `data.run` only, not the whole body. `entity` carries
 *    `updatedAt` stamps on every gear instance that churn between polls, so
 *    hashing the full response would "change" every 2.5s and write hundreds of
 *    identical game states. The full response is still what gets *written* —
 *    only the change *detection* is narrowed.
 *
 * 2. Captures land in a fresh per-run directory, not the flat corpus.
 *    scripts/verifyCombatModel.ts globs `state-NNN.json` out of
 *    fixtures/dungeon-runs/ and diffs consecutive pairs; dropping a second
 *    run's states into that flat list would make it read the boundary between
 *    two unrelated runs as a real exchange.
 *
 * Raw bodies (real wallet address) stay in <rundir>/raw/, covered by the
 * `fixtures/ ** /raw/` ignore rule. The committed copies one level up carry
 * 0xUSER / <USER> / <JWT>.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = "https://gigaverse.io/api";
const POLL_MS = 2500;

const jwt = (() => {
  const p = join(homedir(), ".secrets", "gigaverse-jwt.txt");
  if (!existsSync(p)) throw new Error(`No JWT at ${p}`);
  return readFileSync(p, "utf8").trim();
})();

const MOVES = ["rock", "paper", "scissor"] as const;
/** API uses RPS names, the game uses weapons. Map at the boundary (SPEC §2). */
const WEAPON = { rock: "Sword", paper: "Shield", scissor: "Spell" } as const;

interface Move {
  currentATK: number;
  currentDEF: number;
  currentCharges: number;
  maxCharges: number;
}

interface Side {
  id: string;
  health: { current: number; currentMax: number };
  shield: { current: number; currentMax: number };
  lastMove: string;
  thisPlayerWin: boolean;
  otherPlayerWin: boolean;
  [k: string]: unknown;
}

interface StateResponse {
  data?: {
    run?: { players?: Side[]; [k: string]: unknown } | null;
    entity?: Record<string, unknown> | null;
  } | null;
}

/**
 * Address and JWT are non-negotiable redactions. Username is redacted by *key*
 * rather than by known value — this endpoint has never carried one, but a
 * hardcoded list only redacts what we already knew to look for.
 */
function redact(raw: string, address: string): string {
  let s = raw;
  for (const form of [address, address.toLowerCase(), address.toUpperCase()]) {
    if (form) s = s.split(form).join("0xUSER");
  }
  s = s.split(jwt).join("<JWT>");
  return s.replace(/("(?:[A-Za-z_]*[Uu]ser[Nn]ame[A-Za-z_]*)"\s*:\s*)"[^"]*"/g, '$1"<USER>"');
}

/** One line per side: HP, armor, and every move's ATK/DEF and charges. */
function line(p: Side): string {
  const moves = MOVES.map((m) => {
    const mv = p[m] as Move;
    return `${WEAPON[m]} ${mv.currentATK}/${mv.currentDEF} x${mv.currentCharges}`;
  }).join("  ");
  return `HP ${p.health.current}/${p.health.currentMax}  ARM ${p.shield.current}/${p.shield.currentMax}  ${moves}`;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

async function main() {
  const budgetSec = Number(process.argv[2] ?? 1800);
  const OUT = join("fixtures", "dungeon-runs", `run-${stamp()}`);
  const RAW = join(OUT, "raw");
  mkdirSync(RAW, { recursive: true });

  const deadline = Date.now() + budgetSec * 1000;

  console.log(`\n▸ watch.ts — GET only, ${POLL_MS}ms cadence, ${budgetSec}s budget`);
  console.log(`▸ captures → ${OUT}/  (raw in ${RAW}/, gitignored)`);
  console.log(`▸ jwt ${jwt.slice(0, 8)}…  ctrl-c to stop\n`);

  let lastHash = "";
  let n = 0;
  let polls = 0;
  let address = "";
  let sawLoot = false;
  let idle = true; // no run seen yet — keeps the "go play" hint to one line

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });

  while (Date.now() < deadline && !stopping) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/game/dungeon/state`, {
        method: "GET",
        headers: { Authorization: `Bearer ${jwt}` },
      });
    } catch (e) {
      console.log(`  ✗ network — ${(e as Error).message}`);
      await sleep(5000);
      continue;
    }
    polls++;

    if (!res.ok) {
      console.log(`  ✗ ${res.status} — ${(await res.text()).slice(0, 120)}`);
      if (res.status === 401) throw new Error("JWT rejected. Refresh it.");
      await sleep(5000);
      continue;
    }

    const text = await res.text();
    const json = JSON.parse(text) as StateResponse;
    const run = json.data?.run;
    const entity = json.data?.entity;
    address ||= String(entity?.PLAYER_CID ?? "");

    const [me, foe] = run?.players ?? [];
    if (!run || !me || !foe) {
      if (idle) {
        console.log(`  · polling — no active run yet, start one when ready`);
        idle = false;
      }
      await sleep(POLL_MS);
      continue;
    }
    idle = false;

    const hash = createHash("sha256").update(JSON.stringify(run)).digest("hex");
    if (hash === lastHash) {
      await sleep(POLL_MS);
      continue;
    }
    lastHash = hash;

    const tag = String(n).padStart(3, "0");
    writeFileSync(join(RAW, `state-${tag}.json`), JSON.stringify(json, null, 2));
    writeFileSync(join(OUT, `state-${tag}.json`), redact(JSON.stringify(json, null, 2), address));

    const phases = ["lootPhase", "pathPhase", "enemyPathPhase", "rewardPathPhase"]
      .filter((k) => (run as Record<string, unknown>)[k])
      .join(",");

    console.log(
      `── ${tag}  ${hash.slice(0, 8)}  room ${entity?.ROOM_NUM_CID}  enemy ${entity?.ENEMY_CID}` +
        `${phases ? `  [${phases}]` : ""}`,
    );
    console.log(`   me   ${line(me)}`);
    console.log(`   foe  ${line(foe)}`);
    if (me.lastMove || foe.lastMove) {
      const w = me.thisPlayerWin ? "me" : foe.thisPlayerWin ? "foe" : "tie";
      console.log(
        `   last: me=${WEAPON[me.lastMove as keyof typeof WEAPON] ?? "-"}` +
          ` foe=${WEAPON[foe.lastMove as keyof typeof WEAPON] ?? "-"}  won: ${w}`,
      );
    }

    // The whole point of this capture. Print it in full, never truncated.
    const loot = (run as Record<string, unknown>).lootOptions as unknown[] | undefined;
    if (loot?.length) {
      sawLoot = true;
      console.log(`   ★ LOOT ${loot.length} option(s):`);
      console.log(
        redact(JSON.stringify(loot, null, 2), address)
          .split("\n")
          .map((l) => `     ${l}`)
          .join("\n"),
      );
    }

    n++;
    await sleep(POLL_MS);
  }

  console.log(`\n▸ ${n} distinct states from ${polls} polls → ${OUT}/`);
  console.log(`▸ loot phase captured: ${sawLoot ? "YES" : "no"}\n`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

main().catch((e) => {
  console.error("\n✗", e.message, "\n");
  process.exit(1);
});
