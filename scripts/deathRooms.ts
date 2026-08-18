/**
 * scripts/deathRooms.ts — death-room histogram, session-10 brief §1.
 *
 * "If deaths cluster at rooms 2-3, the bot is entering room 2 already damaged
 * and the problem is early-room HP economy. If they spread evenly, it's enemy
 * scaling." This is the diagnostic that decides which one it is.
 *
 * Goes through `src/sim/corpus.ts` for the wire shape (DECISIONS 2026-08-15:
 * "corpus.ts is the only module permitted to know the wire shape") rather than
 * re-deriving pair-walking rules here.
 *
 * A dungeon ATTEMPT is `DUNGEON_ID_CID`, grouped ACROSS capture directories —
 * one bot-driven run frequently spans several directories because each
 * `npm run live` invocation writes its own directory (session 08/09). Splitting
 * only within a directory (as `loadCorpus`'s per-dir grouping does) would count
 * one real run as several.
 *
 * Only attempts that end with the PLAYER at 0 HP count as a death. Every
 * pre-session-08 capture in the corpus is a human-supervised research session
 * that stopped without the player dying (captured for combat-model
 * verification, not played to a game over) — including those would silently
 * mix "the researcher stopped recording" into "the bot died", which is not the
 * same event. Report them separately, not folded into the histogram.
 *
 *   npx tsx scripts/deathRooms.ts
 */

import { loadCorpus, type CorpusState, type WireSide } from "../src/sim/corpus.js";
import { ROOM_ENEMIES } from "../src/sim/enemies.js";

export const roomOfEnemy = new Map(ROOM_ENEMIES.map((p) => [p.enemy.id, p.room]));

export interface Attempt {
  cid: number;
  dirs: string[];
  states: CorpusState[];
  room: number | null;
  playerDied: boolean;
}

/**
 * Groups the corpus into distinct dungeon ATTEMPTS by `DUNGEON_ID_CID`,
 * across capture directories (one bot-driven run frequently spans several —
 * each `npm run live` invocation writes its own directory). Exported
 * [session 30] so `scripts/dungeonReport.ts` reuses the exact same grouping
 * and death/room derivation rather than re-deriving it — see this file's
 * header comment for why the grouping has to cross directories.
 */
export function computeAttempts(root?: string): Attempt[] {
  const runs = loadCorpus(root);

  const byCid = new Map<number, { dirs: Set<string>; states: CorpusState[] }>();
  for (const { name, states } of runs) {
    for (const s of states) {
      const cid = s.run.DUNGEON_ID_CID;
      const entry = byCid.get(cid) ?? { dirs: new Set<string>(), states: [] };
      entry.dirs.add(name);
      entry.states.push(s);
      byCid.set(cid, entry);
    }
  }

  const attempts: Attempt[] = [];
  for (const [cid, { dirs, states }] of byCid) {
    const last = states[states.length - 1]!;
    const [me, foe] = last.run.players as [WireSide, WireSide];
    attempts.push({
      cid,
      dirs: [...dirs],
      states,
      room: roomOfEnemy.get(foe.id) ?? null,
      playerDied: me.health.current <= 0,
    });
  }
  attempts.sort((a, b) => a.cid - b.cid);
  return attempts;
}

// [session 30] Guarded behind isMain so `computeAttempts`/`roomOfEnemy` can
// be imported (by `scripts/dungeonReport.ts` and its tests) without also
// re-running this CLI's printing as an import side effect.
const isMain = process.argv[1] && process.argv[1].endsWith("deathRooms.ts");

function printHistogram(): void {
  const attempts = computeAttempts();

  const deaths = attempts.filter((a) => a.playerDied);
  const notDeaths = attempts.filter((a) => !a.playerDied);

  console.log(`${attempts.length} distinct dungeon attempts in the corpus (grouped by DUNGEON_ID_CID across directories).`);
  console.log(`${deaths.length} confirmed deaths (player HP reached 0 in the last captured state).`);
  console.log(`${notDeaths.length} captures that stopped without a death — pre-session-08 human research sessions, excluded from the histogram below.\n`);

  const histogram = new Map<number, number>();
  for (const d of deaths) {
    if (d.room === null) continue;
    histogram.set(d.room, (histogram.get(d.room) ?? 0) + 1);
  }

  console.log("DEATH-ROOM HISTOGRAM (confirmed deaths only)");
  const maxRoom = Math.max(0, ...histogram.keys());
  for (let room = 1; room <= maxRoom; room++) {
    const n = histogram.get(room) ?? 0;
    console.log(`  room ${room}: ${"█".repeat(n)} ${n}`);
  }

  console.log("\nper-attempt detail:");
  for (const d of deaths) {
    console.log(`  cid=${d.cid}  room=${d.room}  dirs=${d.dirs.join(",")}`);
  }

  if (notDeaths.length) {
    console.log("\nnon-death captures (last known room, for completeness — not a death, not in the histogram):");
    for (const a of notDeaths) {
      console.log(`  cid=${a.cid}  lastRoom=${a.room}  dirs=${a.dirs.join(",")}`);
    }
  }
}

if (isMain) printHistogram();
