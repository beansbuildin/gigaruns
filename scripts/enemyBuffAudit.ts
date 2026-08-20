/**
 * scripts/enemyBuffAudit.ts — session-56 brief §3.
 *
 * Enumerates every `enemyBuff` id in the corpus with its effect, frequency and
 * minTier, then runs the natural experiment that decides whether a buffed
 * battle can be scored at all:
 *
 *   For every enemy captured BOTH clean (`enemyBuff: null`) and buffed, predict
 *   the buffed stat block from the clean baseline plus the buff's own declared
 *   `effects[]`, and compare against what the wire actually reported.
 *
 * If those agree, a stat-only buff is already inside the numbers the combat
 * model reads and marking the battle unscorable for it is refusing to score a
 * state we fully understand. If they disagree, `src/sim/enemyBuffs.ts` is wrong
 * and `coverage.ts` must go back to failing closed on every buff.
 *
 * Also reports the number that decides how much the CLAUDE.md rule-8 flip costs
 * the simulator: what fraction of non-Safe paths would STILL be unscorable on
 * `rolledEnemyStats` after every buff is modelled.
 *
 * Read-only. No network.
 *
 *   npx tsx scripts/enemyBuffAudit.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { CORPUS_DIR } from "../src/sim/corpus.js";
import {
  applyStatBuff,
  classifyBuff,
  ENEMY_BUFFS,
  type BuffableStats,
  type BuffEffect,
} from "../src/sim/enemyBuffs.js";

const rule = (s: string) => `\n${"═".repeat(74)}\n${s}\n${"═".repeat(74)}`;
const MOVES = ["rock", "paper", "scissor"] as const;

interface WireBuff {
  id?: string;
  name?: string;
  description?: string;
  minTier?: number;
  effects?: BuffEffect[];
}

const stateFiles: string[] = [];
for (const dir of readdirSync(CORPUS_DIR)) {
  const full = join(CORPUS_DIR, dir);
  if (!statSync(full).isDirectory()) continue;
  for (const f of readdirSync(full)) {
    if (f.startsWith("state-") && f.endsWith(".json")) stateFiles.push(join(full, f));
  }
}
stateFiles.sort();

const seen = new Map<string, { buff: WireBuff; count: number }>();
const record = (b: unknown) => {
  if (!b || typeof b !== "object") return;
  const buff = b as WireBuff;
  if (typeof buff.id !== "string") return;
  const e = seen.get(buff.id);
  if (e) e.count++;
  else seen.set(buff.id, { buff, count: 1 });
};

/** Clean baselines, and every buffed sighting, keyed by enemy id. */
const baseline = new Map<string, BuffableStats>();
const buffedSightings: Array<{ enemy: string; buffId: string; observed: BuffableStats }> = [];
/** rolled-stat / buff presence per OFFERED path, by tier — the rule-8 number. */
const byTier = new Map<number, { paths: number; buffed: number; rolled: number }>();

interface WireMoveStats {
  startingATK: number;
  startingDEF: number;
}
interface WireFoe {
  id: string;
  rock: WireMoveStats;
  paper: WireMoveStats;
  scissor: WireMoveStats;
  health: { starting: number };
  shield: { starting: number };
}

const statsOf = (side: WireFoe): BuffableStats => ({
  atk: { rock: side.rock.startingATK, paper: side.paper.startingATK, scissor: side.scissor.startingATK },
  def: { rock: side.rock.startingDEF, paper: side.paper.startingDEF, scissor: side.scissor.startingDEF },
  hp: side.health.starting,
  shield: side.shield.starting,
});

for (const file of stateFiles) {
  const doc = JSON.parse(readFileSync(file, "utf8")) as {
    data?: {
      run?: { players?: WireFoe[]; activeEnemyBuff?: unknown; enemyStartingBuff?: unknown; perpetualBuffs?: unknown[] };
      entity?: { data?: { activePath?: { enemyBuff?: unknown; rolledEnemyStats?: Record<string, number> }; enemyPathOptions?: Array<{ tier?: number; enemyBuff?: unknown; rolledEnemyStats?: Record<string, number> }> } };
    };
  };
  const run = doc.data?.run;
  const entityData = doc.data?.entity?.data;
  const activePath = entityData?.activePath;

  record(activePath?.enemyBuff);
  record(run?.activeEnemyBuff);
  record(run?.enemyStartingBuff);
  for (const b of run?.perpetualBuffs ?? []) record(b);
  for (const o of entityData?.enemyPathOptions ?? []) {
    record(o.enemyBuff);
    const tier = o.tier ?? -1;
    const t = byTier.get(tier) ?? { paths: 0, buffed: 0, rolled: 0 };
    t.paths++;
    if ((o.enemyBuff ?? null) !== null) t.buffed++;
    if (Object.values(o.rolledEnemyStats ?? {}).some((v) => v !== 0)) t.rolled++;
    byTier.set(tier, t);
  }

  // The natural experiment needs the enemy's OPENING stats alongside the buff
  // that was in force. `activePath` carries the buff; players[1] is the foe.
  if (!activePath || !("enemyBuff" in activePath)) continue;
  const players = run?.players ?? [];
  if (players.length < 2) continue;
  const foe = players[1]!;
  const foeId = foe.id;
  const buff = activePath.enemyBuff as WireBuff | null;
  const stats = statsOf(foe);
  if (buff === null || buff === undefined) baseline.set(foeId, stats);
  else if (typeof buff.id === "string") buffedSightings.push({ enemy: foeId, buffId: buff.id, observed: stats });
}

// ── 1. enumeration ────────────────────────────────────────────────────────
console.log(rule(`ENEMY BUFFS — ${seen.size} distinct ids across ${stateFiles.length} recorded states`));

const rows = [...seen.entries()].sort((a, b) => b[1].count - a[1].count);
const classCounts = new Map<string, number>();
console.log(`
  ${"id".padEnd(28)}${"class".padEnd(11)}${"minTier".padEnd(9)}${"sightings".padEnd(11)}effect`);
for (const [id, { buff, count }] of rows) {
  const cls = classifyBuff(buff);
  classCounts.set(cls, (classCounts.get(cls) ?? 0) + 1);
  const eff = (buff.effects ?? []).map((e) => e.kind).join(", ");
  console.log(
    `  ${id.padEnd(28)}${cls.padEnd(11)}${String(buff.minTier ?? "?").padEnd(9)}${String(count).padEnd(11)}${eff}`,
  );
}
console.log(`
  by class: ${[...classCounts].map(([k, v]) => `${k} ${v}`).join(", ")}`);

const missing = rows.filter(([id]) => !ENEMY_BUFFS[id]).map(([id]) => id);
console.log(
  missing.length === 0
    ? "  every corpus buff id is in src/sim/enemyBuffs.ts."
    : `  ✗ NOT IN THE TABLE (these fail closed, correctly, but should be added): ${missing.join(", ")}`,
);

// ── 2. the natural experiment ─────────────────────────────────────────────
console.log(rule("NATURAL EXPERIMENT — do the declared effects predict the buffed stats?"));

let matched = 0;
const mismatches: string[] = [];
let noBaseline = 0;
const tested = new Set<string>();

for (const { enemy, buffId, observed } of buffedSightings) {
  const base = baseline.get(enemy);
  if (!base) {
    noBaseline++;
    continue;
  }
  const buff = seen.get(buffId)?.buff;
  const predicted = applyStatBuff(base, buff);
  if (!predicted) continue;
  const key = `${enemy}|${buffId}|${JSON.stringify(observed)}`;
  if (tested.has(key)) continue;
  tested.add(key);
  const same =
    MOVES.every((m) => predicted.atk[m] === observed.atk[m] && predicted.def[m] === observed.def[m]) &&
    predicted.hp === observed.hp &&
    predicted.shield === observed.shield;
  if (same) matched++;
  else {
    mismatches.push(
      `${enemy} + ${buffId}\n      base ${JSON.stringify(base)}\n      pred ${JSON.stringify(predicted)}\n      obs  ${JSON.stringify(observed)}`,
    );
  }
}

console.log(`
  distinct (enemy, buff, stats) triples with a clean baseline: ${matched + mismatches.length}
  predicted == observed: ${matched}
  mismatches:            ${mismatches.length}
  buffed sightings with no clean baseline for that enemy: ${noBaseline}`);
for (const m of mismatches) console.log(`    ✗ ${m}`);
console.log(
  mismatches.length === 0
    ? `
  ✓ A stat-only buff is fully accounted for by the numbers already on the wire.
    coverage.ts is right not to raise ENEMY_BUFF for one.`
    : `
  ✗ enemyBuffs.ts is WRONG. Revert coverage.ts's probeRun to failing closed on
    every buff until this is explained.`,
);

// ── 3. what the rule-8 flip actually costs ────────────────────────────────
console.log(rule("IF CLAUDE.md RULE 8 FLIPS — what is still unscorable afterwards"));

console.log(`
  ${"tier".padEnd(8)}${"paths".padEnd(9)}${"with buff".padEnd(12)}${"rolled != 0".padEnd(13)}`);
for (const tier of [...byTier.keys()].sort()) {
  const t = byTier.get(tier)!;
  console.log(
    `  ${String(tier).padEnd(8)}${String(t.paths).padEnd(9)}${String(t.buffed).padEnd(12)}${String(t.rolled).padEnd(13)}`,
  );
}
const nonSafe = [...byTier.entries()].filter(([tier]) => tier > 0);
const nsPaths = nonSafe.reduce((a, [, t]) => a + t.paths, 0);
const nsRolled = nonSafe.reduce((a, [, t]) => a + t.rolled, 0);
console.log(`
  non-Safe paths offered: ${nsPaths}
  ...still blocked by ROLLED_STATS after every buff is modelled: ${nsRolled}  (${((100 * nsRolled) / nsPaths).toFixed(1)}%)
  ...freed by this change alone:                                 ${nsPaths - nsRolled}  (${((100 * (nsPaths - nsRolled)) / nsPaths).toFixed(1)}%)

  Modelling the buffs is NECESSARY and nowhere near SUFFICIENT. SPEC §4e says
  the rolled stats are 1-5% proc chances needing hundreds of observations, so
  this is not a gap that another session of capture closes. Brief 57 should
  plan on the simulator scoring almost no post-flip fight, and should say so
  rather than discovering it later as a mystery coverage collapse.`);
