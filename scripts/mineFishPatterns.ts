/**
 * scripts/mineFishPatterns.ts — Task 11's fishing half. Promotes recurring
 * cycles from `data/fish-patterns.jsonl` (real live transitions, logged from
 * turn one since Task 9) into named patterns the matcher can search —
 * SPEC.md §5's "mine recurring cycles offline and promote them to named
 * patterns," previously unbuilt and reclassified session 14 from "nice to
 * have" to the actual blocker on fishing ever beating random.
 *
 * **Promotion discipline (session-15 brief §3, echoing DECISIONS.md
 * 2026-08-15/16's repeated ~30-observation floor for reading a RATE off a
 * sample — enemy-63 and ROLLED_STATS were both burned by skipping this):**
 * a candidate is reported with its support count regardless, and nothing is
 * promoted to the searchable library below a stated threshold. This miner
 * tests a different statistical shape than a rate, though, and says so
 * explicitly rather than silently reusing the same number — see
 * `PROMOTION_THRESHOLD`'s own comment.
 *
 * Two things get mined, independently:
 *
 *  1. First-move classification (community note's step1/diag1/line2/jump2
 *     taxonomy, SPEC-fishing.md — a descriptive tally, not a predictive
 *     pattern, reported for its own sake).
 *  2. Exact-match testing of every observed cast's full turn-by-turn
 *     trajectory against the existing synthetic primitive pool
 *     (`src/sim/fishing/patterns.ts` — "fixed delta cycles, mirrors,
 *     clockwise walks," already SPEC.md §5's own stated shape) anchored at
 *     that cast's own start cell. A primitive that fits ≥
 *     `PROMOTION_THRESHOLD` independent real casts EXACTLY is promoted into
 *     the mined library; nothing else is. This is the part that can actually
 *     move `matcherPool` off empty.
 *
 * Usage: npx tsx scripts/mineFishPatterns.ts [path-to-fish-patterns.jsonl]
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Cell } from "../src/sim/fishing/geometry.js";
import { cellsEqual } from "../src/sim/fishing/geometry.js";
import { buildPatternPool, type Pattern } from "../src/sim/fishing/patterns.js";
import { simulateCasts, matcherFishPolicy } from "../src/sim/fishing/castSim.js";

export interface TransitionRecord {
  ts: string;
  castId: string;
  turn: number;
  from: [number, number];
  to: [number, number];
  gridSize: number;
}

const DEFAULT_PATH = join("data", "fish-patterns.jsonl");

export function loadRecords(path: string): TransitionRecord[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim().length > 0);
  const out: TransitionRecord[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as TransitionRecord);
    } catch {
      // one bad line shouldn't lose the whole log — same convention as loadTransitionLog
    }
  }
  return out;
}

export interface Cast {
  castId: string;
  gridSize: number;
  start: Cell;
  /** turn -> observed cell AFTER that turn's move, i.e. `to`. */
  byTurn: Map<number, Cell>;
  maxTurn: number;
  /**
   * [session 29, CODEXREVIEW #5] Turns with two or more logged records that
   * DISAGREE on the resulting cell — the resumed-cast numbering bug's
   * fingerprint (a resumed process relabeling its true next turn as the
   * cast's turn 0 again). Two records at the same turn that happen to agree
   * are harmless and not counted here.
   */
  duplicateTurns: number[];
  /** True if any turn in `0..maxTurn` has no record at all — a cast like this can never be an exact FULL-trajectory match, only a coincidental partial one. */
  hasGaps: boolean;
}

export function groupByCast(records: TransitionRecord[]): Cast[] {
  const byId = new Map<string, TransitionRecord[]>();
  for (const r of records) {
    const arr = byId.get(r.castId) ?? [];
    arr.push(r);
    byId.set(r.castId, arr);
  }
  const casts: Cast[] = [];
  for (const [castId, recs] of byId) {
    recs.sort((a, b) => a.turn - b.turn);
    const first = recs[0]!;
    const start: Cell = { x: first.from[0], y: first.from[1] };
    const byTurn = new Map<number, Cell>();
    const seenAtTurn = new Map<number, Cell[]>();
    let maxTurn = -1;
    for (const r of recs) {
      const to: Cell = { x: r.to[0], y: r.to[1] };
      const seen = seenAtTurn.get(r.turn) ?? [];
      seen.push(to);
      seenAtTurn.set(r.turn, seen);
      byTurn.set(r.turn, to); // last write wins for byTurn itself; duplicateTurns below is what actually gates eligibility
      if (r.turn > maxTurn) maxTurn = r.turn;
    }
    const duplicateTurns = [...seenAtTurn.entries()]
      .filter(([, cells]) => cells.length > 1 && !cells.every((c) => cellsEqual(c, cells[0]!)))
      .map(([t]) => t)
      .sort((a, b) => a - b);
    let hasGaps = false;
    for (let t = 0; t <= maxTurn; t++) {
      if (!byTurn.has(t)) {
        hasGaps = true;
        break;
      }
    }
    casts.push({ castId, gridSize: first.gridSize, start, byTurn, maxTurn, duplicateTurns, hasGaps });
  }
  return casts;
}

// ── 1. First-move classification — descriptive only, community note's
//    step1/diag1/line2/jump2 taxonomy (SPEC-fishing.md §0). ─────────────────

type MoveClass = "step1" | "diag1" | "line2" | "jump2" | "other";

function classifyFirstMove(dx: number, dy: number): MoveClass {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if ((adx === 1 && ady === 0) || (adx === 0 && ady === 1)) return "step1";
  if (adx === 1 && ady === 1) return "diag1";
  if ((adx === 2 && ady === 0) || (adx === 0 && ady === 2)) return "line2";
  if (adx === 2 && ady === 2) return "jump2";
  return "other";
}

function tallyFirstMoves(casts: Cast[]): Map<MoveClass, number> {
  const tally = new Map<MoveClass, number>([
    ["step1", 0],
    ["diag1", 0],
    ["line2", 0],
    ["jump2", 0],
    ["other", 0],
  ]);
  for (const c of casts) {
    const first = c.byTurn.get(0);
    if (!first) continue;
    const cls = classifyFirstMove(first.x - c.start.x, first.y - c.start.y);
    tally.set(cls, (tally.get(cls) ?? 0) + 1);
  }
  return tally;
}

// ── 2. Exact-match testing against the existing synthetic primitive pool. ──

/**
 * **Not the same statistical regime as the project's ~30-observation rate
 * floor (DECISIONS.md 2026-08-15/16), and this constant is deliberately
 * smaller — say so explicitly rather than silently reusing "30" out of
 * habit.** That floor bounds how many samples it takes to read a NOISY RATE
 * (a proc chance, an opponent's move mix) without overfitting a small
 * sample — the enemy-63 mistake, made twice. An exact multi-turn trajectory
 * match against one of ~23 candidate primitives is a different kind of
 * evidence: if a fish's movement were NOT drawn from this primitive set at
 * all, the chance of even ONE real cast exactly matching a primitive across
 * every one of its turns by coincidence is already small, and two
 * independent real casts matching the SAME primitive from different start
 * cells by pure coincidence is smaller still (roughly 1-in-23 squared if
 * primitives were hit uniformly at random, ignoring that a short cast has
 * few turns to be wrong about). Three independent matches is used here as a
 * conservative promotion bar for THIS kind of evidence — not a claim that it
 * is equally strong evidence as 30 rate observations, just that requiring 30
 * EXACT independent trajectory matches before ever promoting anything would
 * make this miner permanently inert at any live-play volume this project
 * could plausibly reach in one project's lifetime.
 */
const PROMOTION_THRESHOLD = 3;

export interface PrimitiveSupport {
  pattern: Pattern;
  matchingCasts: string[];
}

export interface ExcludedCast {
  castId: string;
  reason: string;
}

export interface PrimitiveTestResult {
  supports: PrimitiveSupport[];
  excluded: ExcludedCast[];
}

/**
 * [session 29, CODEXREVIEW #5] A cast with duplicate/conflicting turn
 * numbers or a gap before its own last turn is excluded from exact-match
 * testing entirely — it is REJECTED, not silently patched around. The old
 * behavior skipped gaps mid-loop and still called the remaining turns an
 * "exact full-trajectory match," which is exactly the shape of false
 * confidence CODEXREVIEW #5 flagged (and duplicate/conflicting turns are the
 * resumed-cast numbering bug's direct fingerprint — see
 * `scripts/liveFishing.ts`'s `lastRecordForCast` doc comment).
 */
export function testPrimitives(casts: Cast[]): PrimitiveTestResult {
  const pool = buildPatternPool();
  const results: PrimitiveSupport[] = pool.map((pattern) => ({ pattern, matchingCasts: [] }));
  const excluded: ExcludedCast[] = [];

  for (const cast of casts) {
    if (cast.maxTurn < 0) continue;
    if (cast.duplicateTurns.length > 0) {
      excluded.push({
        castId: cast.castId,
        reason: `duplicate/conflicting record(s) at turn(s) ${cast.duplicateTurns.join(",")} — likely a resumed-process numbering collision (CODEXREVIEW #5)`,
      });
      continue;
    }
    if (cast.hasGaps) {
      excluded.push({
        castId: cast.castId,
        reason: `gapped trajectory (a turn before maxTurn ${cast.maxTurn} is missing) — cannot be an exact FULL-trajectory match`,
      });
      continue;
    }
    for (const support of results) {
      const trajectory = support.pattern.path(cast.start, cast.gridSize, cast.maxTurn + 2);
      let matches = true;
      for (let t = 0; t <= cast.maxTurn; t++) {
        const observed = cast.byTurn.get(t)!; // no gaps at this point — guaranteed present
        const predicted = trajectory[t + 1];
        if (!predicted || !cellsEqual(predicted, observed)) {
          matches = false;
          break;
        }
      }
      if (matches) support.matchingCasts.push(cast.castId);
    }
  }
  return { supports: results.filter((s) => s.matchingCasts.length > 0), excluded };
}

// ── main ─────────────────────────────────────────────────────────────────

function main() {
  const path = process.argv[2] ?? DEFAULT_PATH;
  const records = loadRecords(path);
  const casts = groupByCast(records);

  console.log(`\n▸ mineFishPatterns.ts — ${path}`);
  console.log(`  ${records.length} transitions across ${casts.length} casts\n`);

  if (records.length === 0) {
    console.log("  no transitions logged yet — nothing to mine.\n");
    return;
  }

  console.log("First-move classification (descriptive, community note's taxonomy):");
  const tally = tallyFirstMoves(casts);
  for (const [cls, n] of tally) {
    console.log(`  ${cls.padEnd(6)} ${n}`);
  }

  console.log(`\nPrimitive exact-match test (${buildPatternPool().length} candidates from src/sim/fishing/patterns.ts):`);
  const { supports, excluded } = testPrimitives(casts);
  if (excluded.length > 0) {
    console.log(`  ${excluded.length} cast(s) excluded from exact-match testing entirely (CODEXREVIEW #5 — never count a partial/gapped/duplicated cast as an exact match):`);
    for (const e of excluded) {
      console.log(`    cast ${e.castId}: ${e.reason}`);
    }
  }
  if (supports.length === 0) {
    console.log(`  0 primitives matched any real cast exactly.`);
  } else {
    supports.sort((a, b) => b.matchingCasts.length - a.matchingCasts.length);
    for (const s of supports) {
      console.log(`  ${s.pattern.name.padEnd(24)} support=${s.matchingCasts.length}  casts=[${s.matchingCasts.join(",")}]`);
    }
  }

  const promoted = supports.filter((s) => s.matchingCasts.length >= PROMOTION_THRESHOLD);
  console.log(`\nPromotion threshold: ${PROMOTION_THRESHOLD} independent exact-matching casts (see PROMOTION_THRESHOLD's own comment for why this isn't the usual 30-observation floor).`);
  if (promoted.length === 0) {
    console.log(`  0 primitives promoted. This is the CORRECT, honest outcome at ${casts.length} real casts —`);
    console.log(`  not a bug in the miner. matcherPool stays effectively empty; report below is unchanged from blind.`);
  } else {
    console.log(`  ${promoted.length} primitive(s) promoted: ${promoted.map((p) => p.pattern.name).join(", ")}`);
  }

  // Persist whatever was promoted so scripts/liveFishing.ts can seed the
  // matcher's candidate pool without re-running the miner mid-cast. Always
  // overwritten (even to an empty list) so a pattern that regresses below
  // threshold as more casts land doesn't linger stale in live play.
  const mineOutPath = join("data", "minedFishPatterns.json");
  writeFileSync(
    mineOutPath,
    JSON.stringify(
      { patterns: promoted.map((p) => p.pattern.name), minedAt: new Date().toISOString(), castCount: casts.length },
      null,
      2,
    ),
  );
  console.log(`\n  written to ${mineOutPath} — scripts/liveFishing.ts reads this to seed the matcher.`);

  // Feed whatever was promoted back through matcherPool and report the sim
  // rate — session-15 brief §3's explicit ask, whichever way it comes out.
  const minedPool: Pattern[] = promoted.map((p) => p.pattern);
  const N = 500;
  const blind = simulateCasts(N, { policy: matcherFishPolicy, matcherPool: [] });
  const mined = simulateCasts(N, { policy: matcherFishPolicy, matcherPool: minedPool });
  console.log(`\nSim catch rate (${N} synthetic casts, focusMeter modelled):`);
  console.log(`  matcher BLIND (matcherPool: []):        ${blind.caught}/${N} = ${(blind.catchRate * 100).toFixed(1)}%`);
  console.log(`  matcher with MINED library (${minedPool.length} pattern${minedPool.length === 1 ? "" : "s"}): ${mined.caught}/${N} = ${(mined.catchRate * 100).toFixed(1)}%`);
  if (minedPool.length === 0) {
    console.log(`  (identical to blind, as expected — nothing was promoted to search against.)`);
  }
  console.log();
}

main();
