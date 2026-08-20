/**
 * scripts/minedLibraryGate.ts — [session 52 §4]
 *
 * Gates a change to `data/minedFishPatterns.json` — the library
 * `scripts/liveFishing.ts` seeds its matcher from — on the replay corpus,
 * paired per turn, with a cluster bootstrap over CASTS (turns within a cast
 * are not independent; casts are the resampling unit).
 *
 * **Why this script had to exist.** The session-52 brief asked for the
 * re-mined library to be "gated on the replay, paired against the current
 * 2-pattern library on the same traces". There was no such arm.
 * `matcherTier: "loo"` re-mines the library from the other casts on every
 * fold and never reads the file at all, so every session-50/51 replay figure
 * describes LOO-mined patterns, not the ones live loads. The gate as written
 * was unmeetable with the machinery that existed — CLAUDE.md §6, in the
 * "gate set on something that does not exist yet" shape. `ReplayOptions
 * .matcherLibrary` (added this session) is the missing arm; this script is
 * the gate.
 *
 * Usage: npx tsx scripts/minedLibraryGate.ts <before.json> <after.json>
 */
import { readFileSync } from "node:fs";

import { loadCastTraces, isCleanTrace } from "../src/sim/fishing/castTrace.js";
import { replayCorpus } from "../src/sim/fishing/offPolicyReplay.js";
import { buildRawPatternPool, resolvePatternsByName, type Pattern } from "../src/sim/fishing/patterns.js";

/**
 * [session 53 §4] Resolves names against the RAW, pre-de-aliasing pool,
 * duplicates and all.
 *
 * This exists for exactly one measurement: gating the de-aliasing change
 * itself. The BEFORE arm has to be the library that was actually live —
 * `bounce(2,0)` AND `bounce(-2,0)`, one hypothesis holding two shares of the
 * matcher's prior mass. Loading it through `resolvePatternsByName` collapses
 * the duplicate and silently turns the comparison into 3-vs-3, which scores a
 * ΔlogLoss of exactly 0.0000 and looks like a clean "no change" result while
 * having measured nothing at all. Do not use this for anything else: outside
 * this one A/B, a duplicate candidate is the bug, not the baseline.
 */
function loadLibraryRaw(path: string): Pattern[] {
  const names = (JSON.parse(readFileSync(path, "utf8")) as { patterns?: string[] }).patterns ?? [];
  const byName = new Map(buildRawPatternPool().map((p) => [p.name, p]));
  const out = names.map((n) => byName.get(n)).filter((p): p is Pattern => p !== undefined);
  if (out.length !== names.length) throw new Error(`${path}: ${names.length - out.length} pattern name(s) did not resolve against the raw pool`);
  return out;
}

function loadLibrary(path: string): Pattern[] {
  const names = (JSON.parse(readFileSync(path, "utf8")) as { patterns?: string[] }).patterns ?? [];
  // [session 53 §4] Resolves through de-aliasing (see `resolvePatternsByName`)
  // so a pre-dedup library file still loads. Only a name matching NOTHING is
  // an error; a name that collapses onto its alias is the expected case and is
  // exactly what this change is for.
  const { patterns, unresolved } = resolvePatternsByName(names);
  if (unresolved.length > 0) throw new Error(`${path}: pattern name(s) did not resolve against the pool: ${unresolved.join(", ")}`);
  return patterns;
}

/** Cluster bootstrap over casts: resample casts with replacement, pool their turns. */
function clusterBootstrap(perCast: number[][], iters = 5000): { mean: number; lo: number; hi: number } {
  const flat = perCast.flat();
  const mean = flat.reduce((s, d) => s + d, 0) / flat.length;
  const means: number[] = [];
  for (let b = 0; b < iters; b++) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < perCast.length; i++) {
      const c = perCast[(Math.random() * perCast.length) | 0]!;
      for (const d of c) {
        sum += d;
        n++;
      }
    }
    if (n > 0) means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  return { mean, lo: means[Math.floor(0.025 * means.length)]!, hi: means[Math.floor(0.975 * means.length)]! };
}

function main() {
  const args = process.argv.slice(2);
  const beforeRaw = args.includes("--before-raw");
  const [beforePath, afterPath] = args.filter((a) => !a.startsWith("--"));
  if (!beforePath || !afterPath) throw new Error("usage: minedLibraryGate.ts [--before-raw] <before.json> <after.json>");

  const before = beforeRaw ? loadLibraryRaw(beforePath) : loadLibrary(beforePath);
  const after = loadLibrary(afterPath);
  const traces = loadCastTraces().filter(isCleanTrace);
  console.log(`▸ minedLibraryGate — ${traces.length} clean traces`);
  console.log(`  BEFORE (${beforePath}): ${before.length} pattern(s) — ${before.map((p) => p.name).join(", ")}`);
  console.log(`  AFTER  (${afterPath}): ${after.length} pattern(s) — ${after.map((p) => p.name).join(", ")}\n`);

  const runArm = (lib: Pattern[]) => replayCorpus(traces, { matcherTier: "loo", matcherLibrary: lib });
  const a = runArm(before);
  const b = runArm(after);

  // Pair per (cast, turn). Both arms replay the same traces from the same
  // starts, so turn i of cast d is the same decision point in both.
  const byDoc = new Map(a.results.map((r) => [r.docId, r]));
  const perCastDiff: number[][] = [];
  for (const rb of b.results) {
    const ra = byDoc.get(rb.docId);
    if (!ra) continue;
    const n = Math.min(ra.turns.length, rb.turns.length);
    const diffs: number[] = [];
    for (let i = 0; i < n; i++) diffs.push(rb.turns[i]!.logLoss - ra.turns[i]!.logLoss);
    if (diffs.length > 0) perCastDiff.push(diffs);
  }
  const { mean, lo, hi } = clusterBootstrap(perCastDiff);

  const w = (r: typeof a) => r.results.flatMap((c) => c.turns.map((t) => t.matcherWeight)).filter((x) => x > 0);
  const summary = (r: typeof a, label: string) => {
    const ws = w(r);
    const med = ws.length ? [...ws].sort((x, y) => x - y)[ws.length >> 1]! : 0;
    console.log(
      `  ${label.padEnd(7)} caught ${r.caught}/${r.casts}   hits ${r.hits}/${r.shots}   ` +
        `matcher-active turns ${ws.length} (median weight ${med.toFixed(3)})`,
    );
  };
  summary(a, "BEFORE");
  summary(b, "AFTER");

  const turns = perCastDiff.reduce((s, c) => s + c.length, 0);
  console.log(`\n  paired ΔlogLoss (AFTER − BEFORE, negative favours AFTER), ${turns} turns in ${perCastDiff.length} casts:`);
  console.log(`    ${mean.toFixed(4)}  95% cluster-bootstrap CI [${lo.toFixed(4)}, ${hi.toFixed(4)}]`);

  const excludesZero = lo > 0 || hi < 0;
  if (!excludesZero) console.log(`\n  VERDICT: CI includes zero — the change is not measurably better OR worse on log loss.`);
  else if (mean < 0) console.log(`\n  VERDICT: AFTER is measurably BETTER (CI excludes zero).`);
  else console.log(`\n  VERDICT: AFTER is measurably WORSE (CI excludes zero) — do NOT ship it.`);
  console.log(`  caught: ${a.caught} -> ${b.caught}`);
}

main();
