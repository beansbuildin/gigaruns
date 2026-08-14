/**
 * scripts/chargeTable.ts — the discriminating observation for SPEC §4a.
 *
 * Emits one row per player per move for every consecutive state pair in every
 * recorded run:
 *
 *   turn | player | move | chargesBefore | movePlayed | chargesAfter | delta
 *
 * and then answers the three questions that separate the two charge models:
 *
 *   H1 (hard prune) — a move needs >=1 charge to play. Non-positive == locked.
 *   H2 (soft cost)  — any move is playable; charges simply go negative.
 *
 *   Q1. Is delta ever anything but -1 for the played move, and do the two
 *       unplayed moves regenerate?
 *   Q2. Did a player ever hold a move at <=0 and play a different one?  -> H1
 *   Q3. Did a player ever play a move already at <=0?                   -> H2
 *
 * Runs are read per-directory so that the boundary between two unrelated runs
 * is never mistaken for an exchange:
 *   fixtures/dungeon-runs/state-NNN.json          -> the session-02 run
 *   fixtures/dungeon-runs/run-<stamp>/state-*.json -> one run each
 *
 * Read-only. No network.
 *
 *   npx tsx scripts/chargeTable.ts
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "fixtures/dungeon-runs";
const MOVES = ["rock", "paper", "scissor"] as const;
const WEAPON = { rock: "Sword", paper: "Shield", scissor: "Spell" } as const;

type MoveKey = (typeof MOVES)[number];

interface Move {
  currentCharges: number;
  maxCharges: number;
}

interface Side {
  id: string;
  lastMove: string;
  thisPlayerWin: boolean;
  health: { current: number; currentMax: number };
  shield: { current: number; currentMax: number };
  [k: string]: unknown;
}

interface Row {
  run: string;
  turn: number;
  player: string;
  move: string;
  before: number;
  max: number;
  played: boolean;
  after: number;
  delta: number;
  /** Did this side win or tie the exchange? Only then does it regenerate. */
  wonOrTied: boolean;
  /** Armor state before the exchange — regen is only observable below the cap. */
  armorBefore: number;
  armorMax: number;
  moveDEF: number;
}

function statesIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /^state-\d+\.json$/.test(f))
    .sort()
    .map((f) => join(dir, f));
}

/** Every run directory, each one a self-contained sequence of exchanges. */
function runDirs(): { name: string; files: string[] }[] {
  const runs: { name: string; files: string[] }[] = [];
  if (!existsSync(DIR)) return runs;

  const flat = statesIn(DIR);
  if (flat.length) runs.push({ name: "session-02", files: flat });

  for (const e of readdirSync(DIR).sort()) {
    const p = join(DIR, e);
    if (!statSync(p).isDirectory() || e === "raw") continue;
    const files = statesIn(p);
    if (files.length) runs.push({ name: e, files });
  }
  return runs;
}

function sides(file: string): Side[] {
  const j = JSON.parse(readFileSync(file, "utf8")) as {
    data?: { run?: { players?: Side[] } | null } | null;
  };
  return j.data?.run?.players ?? [];
}

const rows: Row[] = [];

for (const { name, files } of runDirs()) {
  for (let i = 1; i < files.length; i++) {
    const before = sides(files[i - 1]!);
    const after = sides(files[i]!);
    if (before.length < 2 || after.length < 2) continue;

    // `lastMove` persists through the reward/enemy path phases that follow a
    // kill, so a naive pair-walk invents turns in which nothing was played.
    // Skip any pair where no HP, armor, or charge actually moved.
    // Both sides must name a move, or it is not an exchange. A room transition
    // swaps in a fresh enemy whose lastMove is "" while ours still reads from
    // the killing blow — counting that invents a play with delta 0.
    if (!after.every((p) => MOVES.includes(p.lastMove as MoveKey))) continue;
    if (before[1]!.id !== after[1]!.id) continue;

    const moved = before.some((p, s) => {
      const n = after[s]!;
      return (
        p.health.current !== n.health.current ||
        p.shield.current !== n.shield.current ||
        MOVES.some((m) => (p[m] as Move).currentCharges !== (n[m] as Move).currentCharges)
      );
    });
    if (!moved) continue;

    for (let s = 0; s < 2; s++) {
      const b = before[s]!;
      const a = after[s]!;
      // lastMove on the *after* state names the move that produced it.
      const playedKey = a.lastMove as MoveKey | "";

      for (const m of MOVES) {
        const bm = b[m] as Move;
        const am = a[m] as Move;
        rows.push({
          run: name,
          turn: i,
          player: s === 0 ? "me" : "foe",
          move: WEAPON[m],
          before: bm.currentCharges,
          max: bm.maxCharges,
          played: playedKey === m,
          after: am.currentCharges,
          delta: am.currentCharges - bm.currentCharges,
          wonOrTied: !(after[1 - s]! as Side).thisPlayerWin,
          armorBefore: b.shield.current,
          armorMax: b.shield.currentMax,
          moveDEF: (bm as unknown as { currentDEF: number }).currentDEF,
        });
      }
    }
  }
}

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const W = Math.max(24, ...rows.map((r) => r.run.length + 2));
console.log(
  `\n${pad("run", W)}${pad("turn", 5)}${pad("player", 7)}${pad("move", 7)}` +
    `${pad("before", 7)}${pad("played", 7)}${pad("after", 6)}delta`,
);
console.log("─".repeat(W + 44));
for (const r of rows) {
  const flag = r.delta !== -1 && r.played ? "  <-- NOT -1" : "";
  console.log(
    `${pad(r.run, W)}${pad(r.turn, 5)}${pad(r.player, 7)}${pad(r.move, 7)}` +
      `${pad(r.before, 7)}${pad(r.played ? "yes" : "", 7)}${pad(r.after, 6)}` +
      `${r.delta >= 0 ? "+" : ""}${r.delta}${flag}`,
  );
}

// ── Q1 ────────────────────────────────────────────────────────────────────
const playedRows = rows.filter((r) => r.played);
const oddPlays = playedRows.filter((r) => r.delta !== -1);
const unplayed = rows.filter((r) => !r.played);
const atMax = unplayed.filter((r) => r.before >= r.max);
const belowMax = unplayed.filter((r) => r.before < r.max);

console.log(`\n${"═".repeat(72)}\nQ1. deltas\n`);
console.log(`  played moves:            ${playedRows.length}`);
console.log(`    delta == -1:           ${playedRows.length - oddPlays.length}`);
console.log(`    delta != -1:           ${oddPlays.length}`);
for (const r of oddPlays) {
  console.log(`      ${r.run} turn ${r.turn} ${r.player} ${r.move}: ${r.before} -> ${r.after} (${r.delta})`);
}
console.log(`  unplayed, already at max: ${atMax.length}` + `  (all delta 0: ${atMax.every((r) => r.delta === 0)})`);
console.log(`  unplayed, below max:      ${belowMax.length}` + `  (all delta +1: ${belowMax.every((r) => r.delta === 1)})`);
const overCap = unplayed.filter((r) => r.after > r.max);
console.log(`  ever regenerated past max: ${overCap.length}`);

// ── Q2 / Q3 ───────────────────────────────────────────────────────────────
// Group by (run, turn, player) so we can ask what a side did while holding a
// non-positive move.
const held = new Map<string, Row[]>();
for (const r of rows) {
  const k = `${r.run}|${r.turn}|${r.player}`;
  (held.get(k) ?? held.set(k, []).get(k)!).push(r);
}

const q2: string[] = [];
const q3: string[] = [];
for (const [k, group] of held) {
  const nonPositive = group.filter((r) => r.before <= 0);
  if (!nonPositive.length) continue;
  const playedRow = group.find((r) => r.played);
  if (!playedRow) continue;
  const names = nonPositive.map((r) => `${r.move}@${r.before}`).join(",");
  if (playedRow.before <= 0) {
    q3.push(`${k} played ${playedRow.move} at ${playedRow.before}`);
  } else {
    // Forced only if every move other than the one played was non-positive.
    const alternatives = group.filter((r) => !r.played);
    const forced = alternatives.every((r) => r.before <= 0);
    q2.push(
      `${k} held ${names}, played ${playedRow.move}@${playedRow.before}` +
        ` (${alternatives.filter((r) => r.before > 0).length} other legal move(s)` +
        `${forced ? " — FORCED" : ""})`,
    );
  }
}

console.log(`\nQ2. held a move at <=0 and played a different one (=> H1 hard prune)`);
console.log(q2.length ? q2.map((s) => `  ${s}`).join("\n") : "  NONE OBSERVED");
console.log(`\nQ3. played a move already at <=0 (=> H2 soft cost)`);
console.log(q3.length ? q3.map((s) => `  ${s}`).join("\n") : "  NONE OBSERVED");

// ── verdict ───────────────────────────────────────────────────────────────
//
// The brief proposed "held a move at <=0 and played a different one => H1".
// That rule does not survive the lesson it was written to enforce. Under H2 a
// side holding a locked move and playing another is completely unremarkable —
// it simply preferred that move. The rule only has force when the alternatives
// were *exhausted*, i.e. the play was forced. So a Q2 hit is scored by how many
// legal alternatives it actually eliminated, not by its mere existence.
console.log(`\n${"═".repeat(72)}\nVERDICT`);
if (q3.length) {
  console.log("  H2 CONFIRMED — a move at <=0 was played. Charges are a soft cost.");
} else if (q2.length) {
  const forced = q2.filter((s) => s.includes("FORCED"));
  console.log(`  WEAK / UNRESOLVED — ${q2.length} turn(s) where a side held a`);
  console.log("  non-positive move and played a different one. Under H2 that is");
  console.log("  exactly what a free choice looks like, so it discriminates only");
  console.log("  when every other move was also locked.");
  console.log(`  turns where the play was FORCED (all alternatives locked): ${forced.length}`);
  if (!forced.length) {
    console.log("  => nothing separates H1 from H2. Do not encode either.");
    console.log("     Branch on a flag (SPEC §4a).");
  }
} else {
  console.log("  UNRESOLVED — no side was ever observed taking a turn while");
  console.log("  holding a non-positive move, so nothing separates H1 from H2.");
  console.log("  Do not encode either. Branch on a flag (SPEC §4a).");
}

// State plainly which branches the corpus does and does not exercise (brief §2).
//
// The branch that separates the confirmed combat model from the rejected one is
// NOT merely "won with Spell". It is: won-or-tied with a DEF-bearing non-Shield
// move *while below the armor cap*. At the cap both models predict the same
// armor, which is exactly how session 02's corpus fit two models at once.
const discriminating = rows.filter(
  (r) =>
    r.played &&
    r.move !== "Shield" &&
    r.moveDEF > 0 &&
    r.wonOrTied &&
    r.armorBefore < r.armorMax,
);
console.log(`\n  discriminating exchanges (won/tied with a DEF-bearing non-Shield`);
console.log(`  move while below the armor cap — the branch that separates the`);
console.log(`  confirmed model from the rejected one): ${discriminating.length}`);
for (const r of discriminating) {
  console.log(
    `    ${r.run} turn ${r.turn} ${r.player} ${r.move}` +
      ` (DEF ${r.moveDEF}, armor ${r.armorBefore}/${r.armorMax})`,
  );
}
if (!discriminating.length) {
  console.log(`    NONE — the corpus cannot tell the two models apart.`);
}
console.log(`\n  branches still NOT exercised:`);
console.log(`    - any move played from 0 or negative charges (H1 vs H2).`);

const lowPlays = playedRows.filter((r) => r.before === 1);
console.log(`\n  plays from exactly 1 charge: ${lowPlays.length}`);
for (const r of lowPlays) {
  console.log(`    ${r.run} turn ${r.turn} ${r.player} ${r.move}: 1 -> ${r.after}`);
}
console.log();
