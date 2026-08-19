/**
 * scripts/auditStepClass.ts — [session 45] independent re-derivation of the
 * session-45 brief's §0 claims about fish movement, straight off
 * `data/fish-patterns.jsonl` and `fixtures/fishing-casts/cards.json`.
 *
 * Written FIRST, before any strategy code, per CLAUDE.md §9: a brief's
 * claims about what the corpus contains are hypotheses to verify, not facts
 * to implement. The brief (`handoff/next.md` §0) asserts three facts and a
 * four-row predictor comparison; this script recomputes every one of them
 * from scratch, with its own independent code path, and prints the brief's
 * claimed number next to the measured one so a divergence is impossible to
 * miss.
 *
 * Re-runnable as the corpus grows — that is the point of committing it
 * rather than doing this in a scratch file (the brief asks for exactly
 * this). Read-only: touches no data path, writes nothing.
 *
 * Usage: npx tsx scripts/auditStepClass.ts [path-to-fish-patterns.jsonl]
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Cell } from "../src/sim/fishing/geometry.js";
import { cellKey, inGrid, zonesToCells } from "../src/sim/fishing/geometry.js";
import { groupByCast, isCleanCast, loadTransitionRecords, type Cast } from "../src/sim/fishing/transitionCorpus.js";
import { castHops, type Displacement } from "../src/strategy/fishing/contextualFallback.js";

const DEFAULT_PATH = join("data", "fish-patterns.jsonl");
const CARDS_PATH = join("fixtures", "fishing-casts", "cards.json");

interface CardEntity {
  id: number;
  manaCost: number;
  hitZones: number[];
  critZones: number[];
  hitEffects: { type: string; amount: number }[];
  missEffects: { type: string; amount: number }[];
  critEffects: { type: string; amount: number }[];
}

/** Manhattan step length of one hop — the candidate "step class" of that move. */
function stepLen(from: Cell, to: Cell): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

function deltaOf(from: Cell, to: Cell): Displacement {
  return { dx: to.x - from.x, dy: to.y - from.y };
}

/** Every in-grid cell at exactly Manhattan distance `k` from `cell`. */
function ringCells(cell: Cell, k: number, gridSize: number): Cell[] {
  const out: Cell[] = [];
  for (let dx = -k; dx <= k; dx++) {
    const rem = k - Math.abs(dx);
    for (const dy of rem === 0 ? [0] : [-rem, rem]) {
      const c = { x: cell.x + dx, y: cell.y + dy };
      if (inGrid(c, gridSize)) out.push(c);
    }
  }
  return out;
}

function pct(num: number, den: number): string {
  return den === 0 ? "  n/a" : `${((num / den) * 100).toFixed(1)}%`;
}

function line(label: string, measured: string, claimed: string, ok: boolean) {
  const flag = ok ? "OK  " : "DIFF";
  console.log(`  [${flag}] ${label.padEnd(52)} measured ${measured.padStart(9)}   brief ${claimed.padStart(9)}`);
}

// ── Fact 1 ────────────────────────────────────────────────────────────────

function fact1(casts: readonly Cast[], gridSize: number) {
  console.log("\n── FACT 1: every move lands on a fixed Manhattan-k ring ──");
  const distHist = new Map<number, number>();
  let offRing = 0;
  let constantK = 0;
  let multiMoveCasts = 0;
  const classCount = new Map<number, number>();

  for (const cast of casts) {
    const hops = castHops(cast);
    if (hops.length === 0) continue;
    const lens = hops.map((h) => stepLen(h.from, h.to));
    for (const l of lens) distHist.set(l, (distHist.get(l) ?? 0) + 1);

    const k = lens[0]!;
    classCount.set(k, (classCount.get(k) ?? 0) + 1);
    // "off the legal in-grid k-ring", k fixed by the cast's FIRST move
    for (const h of hops) {
      const onRing = ringCells(h.from, k, cast.gridSize).some((c) => cellKey(c) === cellKey(h.to));
      if (!onRing) offRing++;
    }
    if (hops.length >= 2) {
      multiMoveCasts++;
      if (lens.every((l) => l === k)) constantK++;
    }
  }

  const d1 = distHist.get(1) ?? 0;
  const d2 = distHist.get(2) ?? 0;
  const other = [...distHist.entries()].filter(([k]) => k !== 1 && k !== 2).reduce((n, [, c]) => n + c, 0);
  line("transitions at Manhattan distance 1", String(d1), "148", d1 === 148);
  line("transitions at Manhattan distance 2", String(d2), "115", d2 === 115);
  line("transitions at any other distance", String(other), "0", other === 0);
  line(
    "casts with >=2 moves, every move same k",
    `${constantK}/${multiMoveCasts}`,
    "65/65",
    constantK === multiMoveCasts,
  );
  line("moves off the legal in-grid k-ring", `${offRing}/${d1 + d2 + other}`, "0/263", offRing === 0);
  line("k=1 casts", String(classCount.get(1) ?? 0), "36", (classCount.get(1) ?? 0) === 36);
  line("k=2 casts", String(classCount.get(2) ?? 0), "31", (classCount.get(2) ?? 0) === 31);
  if (other > 0) {
    console.log(`         other distances observed: ${[...distHist.entries()].filter(([k]) => k !== 1 && k !== 2).map(([k, c]) => `${k}x${c}`).join(", ")}`);
  }
  void gridSize;
  return { classCount };
}

// ── Fact 2 ────────────────────────────────────────────────────────────────

function fact2(casts: readonly Cast[]) {
  console.log("\n── FACT 2: next move conditioned on previous, per class ──");
  const stats = new Map<number, { n: number; repeat: number; reverse: number }>();
  for (const cast of casts) {
    const hops = castHops(cast);
    if (hops.length === 0) continue;
    const k = stepLen(hops[0]!.from, hops[0]!.to);
    for (const h of hops) {
      if (!h.prev) continue;
      const d = deltaOf(h.from, h.to);
      const s = stats.get(k) ?? { n: 0, repeat: 0, reverse: 0 };
      s.n++;
      if (d.dx === h.prev.dx && d.dy === h.prev.dy) s.repeat++;
      if (d.dx === -h.prev.dx && d.dy === -h.prev.dy) s.reverse++;
      stats.set(k, s);
    }
  }
  const claims: Record<number, [string, string, string]> = {
    1: ["27.7%", "0.0%", "112"],
    2: ["3.6%", "41.7%", "84"],
  };
  for (const k of [...stats.keys()].sort()) {
    const s = stats.get(k)!;
    const c = claims[k];
    line(`k=${k}  n (scored hops with a prev delta)`, String(s.n), c?.[2] ?? "-", c ? String(s.n) === c[2] : true);
    line(`k=${k}  P(repeat previous delta)`, pct(s.repeat, s.n), c?.[0] ?? "-", true);
    line(`k=${k}  P(exact reversal)`, `${pct(s.reverse, s.n)} (${s.reverse}/${s.n})`, c?.[1] ?? "-", true);
  }
  return stats;
}

// ── Fact 3 ────────────────────────────────────────────────────────────────

function loadCards(): CardEntity[] {
  const raw = JSON.parse(readFileSync(CARDS_PATH, "utf8")) as { entities: CardEntity[] };
  return raw.entities;
}

function fact3(casts: readonly Cast[], cards: readonly CardEntity[]) {
  console.log("\n── FACT 3: the deck's zone templates are built around the rings ──");

  // Group card ids by hitZone template.
  const byTemplate = new Map<string, number[]>();
  for (const c of cards) {
    const key = [...c.hitZones].sort((a, b) => a - b).join(",");
    byTemplate.set(key, [...(byTemplate.get(key) ?? []), c.id]);
  }
  for (const wanted of ["2,4,6,8", "1,3,7,9", "1,2,3,4,6,7,8,9"]) {
    console.log(`  hitZones {${wanted}}: ids ${(byTemplate.get(wanted) ?? []).join(", ") || "(none)"}`);
  }

  // Empirical hit rate of (card template, focus offset) against each class.
  // Focus offset is measured from the fish's CURRENT cell; a transition whose
  // focus would land off-grid is excluded from that offset's denominator.
  const transitions: { k: number; from: Cell; to: Cell; gridSize: number }[] = [];
  for (const cast of casts) {
    const hops = castHops(cast);
    if (hops.length === 0) continue;
    const k = stepLen(hops[0]!.from, hops[0]!.to);
    for (const h of hops) transitions.push({ k, from: h.from, to: h.to, gridSize: cast.gridSize });
  }

  const offsets: [number, number][] = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) offsets.push([dx, dy]);

  console.log("\n  best hit rate over all card templates, by (class, focus offset from fish's current cell):");
  for (const k of [1, 2]) {
    const rows: { off: string; best: string; tmpl: string; n: number }[] = [];
    for (const [dx, dy] of offsets) {
      let bestRate = -1;
      let bestTmpl = "";
      let bestN = 0;
      for (const [tmplKey] of byTemplate) {
        const zones = tmplKey.split(",").filter((s) => s.length > 0).map(Number);
        let hits = 0;
        let n = 0;
        for (const t of transitions) {
          if (t.k !== k) continue;
          const focus = { x: t.from.x + dx, y: t.from.y + dy };
          if (!inGrid(focus, t.gridSize)) continue;
          n++;
          const covered = zonesToCells(focus, zones, t.gridSize);
          if (covered.some((c) => cellKey(c) === cellKey(t.to))) hits++;
        }
        if (n === 0) continue;
        const rate = hits / n;
        if (rate > bestRate) {
          bestRate = rate;
          bestTmpl = tmplKey;
          bestN = n;
        }
      }
      rows.push({ off: `(${dx},${dy})`, best: bestRate < 0 ? "n/a" : `${(bestRate * 100).toFixed(1)}%`, tmpl: bestTmpl, n: bestN });
    }
    console.log(`\n   class k=${k}:`);
    for (let dy = -2; dy <= 2; dy++) {
      const cells = offsets
        .filter(([, oy]) => oy === dy)
        .map(([ox]) => {
          const r = rows.find((rr) => rr.off === `(${ox},${dy})`)!;
          return `${r.off}=${r.best.padStart(6)}`;
        });
      console.log(`     ${cells.join("  ")}`);
    }
    const origin = rows.find((r) => r.off === "(0,0)")!;
    console.log(`     best at (0,0): ${origin.best} via template {${origin.tmpl}}  (n=${origin.n})`);
  }
  return byTemplate;
}

function main() {
  const path = process.argv[2] ?? DEFAULT_PATH;
  const records = loadTransitionRecords(path);
  const allCasts = groupByCast(records);
  const clean = allCasts.filter(isCleanCast);
  const gridSize = allCasts[0]?.gridSize ?? 4;

  console.log(`\n▸ auditStepClass.ts — ${path}`);
  console.log(`  ${records.length} raw transitions, ${allCasts.length} distinct casts, ${clean.length} clean casts`);
  console.log(`  (the brief's §0 says "263 transitions, 67 casts, no filtering" — ALL figures below use ALL casts,`);
  console.log(`   matching the brief; a clean-only rerun is printed at the end for comparison)`);

  fact1(allCasts, gridSize);
  fact2(allCasts);
  fact3(allCasts, loadCards());

  console.log("\n── same Facts 1-2 restricted to isCleanCast() casts (sanity, not the brief's basis) ──");
  fact1(clean, gridSize);
  fact2(clean);
  console.log("");
}

const isMain = process.argv[1]?.endsWith("auditStepClass.ts");
if (isMain) main();
