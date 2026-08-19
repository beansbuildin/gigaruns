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

import { buildPatternPool, type Pattern } from "../src/sim/fishing/patterns.js";
import { simulateCasts, matcherFishPolicy } from "../src/sim/fishing/castSim.js";
import {
  groupByCast,
  type Cast,
  type TransitionRecord,
} from "../src/sim/fishing/transitionCorpus.js";
import {
  PROMOTION_THRESHOLD,
  testPrimitives,
  type ExcludedCast,
  type PrimitiveSupport,
  type PrimitiveTestResult,
} from "../src/sim/fishing/patternMining.js";

export type { Cast, TransitionRecord };
export { groupByCast };
export { PROMOTION_THRESHOLD, testPrimitives };
export type { ExcludedCast, PrimitiveSupport, PrimitiveTestResult };

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
//
// [session 50] `PROMOTION_THRESHOLD`, `testPrimitives` and the promotion rule
// itself moved to `src/sim/fishing/patternMining.ts` so the off-policy
// replay's leave-one-cast-out matcher tier can promote by the identical rule
// instead of a lookalike (brief §1). Behavior is unchanged; they are
// re-exported here so every existing import site — including
// `tests/mineFishPatterns.test.ts` — is untouched.

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

// [session 44] Guarded behind isMain — every other script in this project
// with an exported `loadRecords`/similar (deathRooms.ts, dungeonReport.ts,
// fishingReport.ts, liveRun.ts, liveFishing.ts, orchestrator.ts) already
// does this; this file was the one outlier, unconditionally calling
// `main()` (a real write to `data/minedFishPatterns.json`, plus console
// output) as a side effect of merely IMPORTING its exports. Found the hard
// way: `scripts/auditPruneCounterexample.ts` originally imported
// `loadRecords`/`groupByCast` from here and silently re-ran the whole
// miner as a side effect.
const isMain = process.argv[1] && process.argv[1].endsWith("mineFishPatterns.ts");
if (isMain) main();
