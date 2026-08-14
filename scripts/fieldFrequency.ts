/**
 * scripts/fieldFrequency.ts — session-08 brief addendum §7, check 1.
 *
 * `intuition` is a 5% dungeon proc the user has never seen fire; waiting for
 * them to notice it by eye is waiting on a coin nobody's had ~20 flips of.
 * Cheaper: if intuition reveals something (the enemy's next move, say), it
 * likely shows up as an occasional EXTRA field on a side rather than a
 * permanent one. Walk every captured player/enemy side in the corpus and
 * report any key path present in under ~15% of them — candidates worth a
 * second look, not proof any one of them is intuition.
 *
 * Read-only, no network — goes through src/sim/corpus.ts's loadCorpus() per
 * DECISIONS 2026-08-15 (corpus.ts is the only module that knows the wire
 * shape) rather than re-walking fixture files by hand.
 */

import { loadCorpus } from "../src/sim/corpus.js";

function keyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [];
  if (Array.isArray(obj)) return prefix ? [prefix] : [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(path);
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(...keyPaths(v, path));
    }
  }
  return out;
}

function main() {
  const runs = loadCorpus();
  const sides: Record<string, unknown>[] = [];
  for (const run of runs) {
    for (const state of run.states) {
      for (const side of state.run.players) {
        sides.push(side as unknown as Record<string, unknown>);
      }
    }
  }

  const total = sides.length;
  console.log(`\n▸ ${total} player-side observations across ${runs.length} capture directories\n`);

  const counts = new Map<string, number>();
  for (const side of sides) {
    for (const path of new Set(keyPaths(side))) {
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }

  const THRESHOLD_PCT = 15;
  const rare = [...counts.entries()]
    .map(([path, n]) => ({ path, n, pct: (100 * n) / total }))
    .filter((r) => r.pct < THRESHOLD_PCT)
    .sort((a, b) => a.pct - b.pct);

  if (rare.length === 0) {
    console.log(`  no key path appears in under ${THRESHOLD_PCT}% of observations.`);
  } else {
    console.log(`  key paths present in under ${THRESHOLD_PCT}% of ${total} observations:\n`);
    for (const r of rare) {
      console.log(`  ${r.pct.toFixed(1).padStart(5)}%  (${String(r.n).padStart(3)}/${total})  ${r.path}`);
    }
  }

  // Every side carries the same top-level keys 100% of the time (rolled
  // stats included) — a proc can't show up as a key appearing/disappearing.
  // If it shows up at all in this corpus, it's more likely as CONTENT inside
  // an array field that's usually empty. Arrays are opaque to keyPaths()
  // above (walking into "which index" isn't meaningful), so check separately.
  const ARRAY_FIELDS = ["statusEffects", "activeEffects", "gearBoons", "triggeredBoons"];
  console.log(`\n  non-empty rate of array-typed fields (content, not key presence):\n`);
  for (const key of ARRAY_FIELDS) {
    const nonEmpty = sides.filter((s) => Array.isArray(s[key]) && (s[key] as unknown[]).length > 0);
    console.log(`  ${((100 * nonEmpty.length) / total).toFixed(1).padStart(5)}%  (${String(nonEmpty.length).padStart(3)}/${total})  ${key}`);
  }
  console.log();
}

main();
