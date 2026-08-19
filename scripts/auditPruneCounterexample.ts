/**
 * scripts/auditPruneCounterexample.ts — [session 44, brief §3.4]
 *
 * Session-43 heuristic (d) (`pruneReturnToPrevious`, `src/strategy/fishing/
 * heuristics.ts`) claims: "a fish that just made a 1-cell move never
 * returns to the cell it just came from." SPEC-fishing.md §8 flagged this
 * as the one heuristic with a real chance of being wrong outright, and its
 * own instruction is explicit: "a future audit that finds a counterexample
 * should remove the call, not explain it away."
 *
 * This walks every real logged cast in `data/fish-patterns.jsonl` for a
 * literal instance: turn t-1 is a 1-cell move (from A to B), and turn t
 * moves the fish from B back to exactly A. Report the count plainly either
 * way — zero counterexamples is evidence the heuristic hasn't been WRONG
 * yet, not proof it's right (SPEC-fishing.md §8 already says none of these
 * four heuristics are corpus-validated).
 *
 * [session 44] Motivated by a real sim-domain finding worth stating here
 * too: `scripts/fishingHeuristicAblation.ts` found heuristic (d) causes a
 * reproducible ~2pp catch-rate REGRESSION in the sim (N=20000, two
 * independent seeds), entirely traceable to `patterns.ts`'s `bounceDelta`
 * — a billiard-style wall reflection whose own mechanic is EXACTLY "step
 * to the wall cell, then step back to the predecessor cell" on the turn it
 * bounces. That is a SIM-domain artifact (a specific synthetic primitive
 * doing something the heuristic's real-world reasoning didn't anticipate),
 * not live evidence either way — per the standing "sim authority is earned
 * per domain" rule (DECISIONS.md 2026-08-15, session 14), it does not
 * override what this script finds in the real corpus.
 *
 * Usage: npx tsx scripts/auditPruneCounterexample.ts [path-to-fish-patterns.jsonl]
 */

import { join } from "node:path";
import { groupByCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { cellsEqual } from "../src/sim/fishing/geometry.js";

const path = process.argv[2] ?? join("data", "fish-patterns.jsonl");
const records = loadTransitionRecords(path);
const casts = groupByCast(records);

const counterexamples: { castId: string; turn: number; from: [number, number]; to: [number, number]; back: [number, number] }[] = [];

// byTurn maps turn -> cell AFTER that turn's move; turn -1 is implicitly `cast.start`.
for (const cast of casts) {
  if (cast.duplicateTurns.length > 0 || cast.hasGaps) continue;
  const cellAt = (t: number) => (t < 0 ? cast.start : cast.byTurn.get(t)!);
  for (let t = 1; t <= cast.maxTurn; t++) {
    const a = cellAt(t - 2); // position before the 1-cell move
    const b = cellAt(t - 1); // position after the 1-cell move (turn t-1)
    const c = cellAt(t); // position after turn t's move
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) continue; // turn t-1 wasn't a 1-cell move
    if (cellsEqual(c, a)) {
      counterexamples.push({ castId: cast.castId, turn: t, from: [a.x, a.y], to: [b.x, b.y], back: [c.x, c.y] });
    }
  }
}

console.log(`\n▸ auditPruneCounterexample.ts — ${path}`);
console.log(`  ${casts.length} casts checked (excluding gapped/duplicate-turn casts, same discipline as mineFishPatterns.ts)`);
console.log(`  ${counterexamples.length} counterexample(s) found: a 1-cell move immediately followed by an exact return to the predecessor cell\n`);
for (const c of counterexamples) {
  console.log(`  cast ${c.castId}, turn ${c.turn}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)} -> ${JSON.stringify(c.back)} (back to start)`);
}
if (counterexamples.length === 0) {
  console.log(`  Heuristic (d) has not been caught wrong yet against the real corpus — not proof it's right, per SPEC-fishing.md §8.`);
} else {
  console.log(`  ★★★ SPEC-fishing.md §8's own instruction: remove/gate the pruneReturnToPrevious call, don't explain this away.`);
}
console.log();
