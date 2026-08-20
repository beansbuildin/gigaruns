/**
 * src/sim/fishing/patterns.ts — a SYNTHETIC stand-in pattern library.
 *
 * [HYPOTHETICAL — not the real Dendren pattern set.] The one real capture
 * (`fixtures/fishing-casts/cast.json`) is a single 5-move cast, nowhere near
 * enough to fit an actual pattern library from — CLAUDE.md §2 forbids
 * inventing endpoints, and by the same logic this file does not claim to
 * invent the real fish-movement rules either. It exists for exactly one
 * purpose: `scripts/fishConvergence.ts`'s structural question of "how many
 * turns does hypothesis elimination need to converge, for a plausible
 * library shape and size" — a question about the ALGORITHM's behaviour, not
 * about Dendren specifically. Never use this library to drive live card
 * choice; the real thing gets built from `data/fish-patterns.jsonl` once
 * Task 9 starts logging real casts (SPEC.md §5).
 *
 * Every pattern here is fully determined by (start cell, grid size) — no
 * hidden state beyond the turn index, matching SPEC.md §5's
 * `(state, turnIndex) -> nextCell` representation. `path(turn)` is
 * precomputed once per (pattern, start) pair since these are exactly the
 * "fixed delta cycles, mirrors, clockwise walks" SPEC.md names.
 */

import type { Cell } from "./geometry.js";
import { allCells, cellsEqual, inGrid } from "./geometry.js";

export interface Pattern {
  name: string;
  /** Precompute the full trajectory from a known start cell. */
  path(start: Cell, gridSize: number, length: number): Cell[];
}

/** Billiard-style reflection off the grid walls, fixed integer velocity. */
function bounceDelta(dx: number, dy: number): Pattern {
  return {
    name: `bounce(${dx},${dy})`,
    path(start, gridSize, length) {
      const out: Cell[] = [start];
      let x = start.x;
      let y = start.y;
      let vx = dx;
      let vy = dy;
      for (let t = 1; t < length; t++) {
        let nx = x + vx;
        let ny = y + vy;
        if (nx < 1 || nx > gridSize) {
          vx = -vx;
          nx = x + vx;
        }
        if (ny < 1 || ny > gridSize) {
          vy = -vy;
          ny = y + vy;
        }
        // Corner clamp — a reflection that still lands out of bounds (both
        // axes pinned at a corner) holds position rather than diverging.
        nx = Math.min(gridSize, Math.max(1, nx));
        ny = Math.min(gridSize, Math.max(1, ny));
        x = nx;
        y = ny;
        out.push({ x, y });
      }
      return out;
    },
  };
}

/** Alternates between the start cell and its point-reflection through the grid centre. */
const mirrorAcrossCentre: Pattern = {
  name: "mirrorAcrossCentre",
  path(start, gridSize, length) {
    const mirrored: Cell = { x: gridSize + 1 - start.x, y: gridSize + 1 - start.y };
    const out: Cell[] = [];
    for (let t = 0; t < length; t++) out.push(t % 2 === 0 ? start : mirrored);
    return out;
  },
};

/** A short repeating cycle: start -> neighbour -> start -> neighbour -> ... */
function twoCellCycle(dx: number, dy: number): Pattern {
  return {
    name: `twoCellCycle(${dx},${dy})`,
    path(start, gridSize, length) {
      const target: Cell = { x: start.x + dx, y: start.y + dy };
      const b = inGrid(target, gridSize) ? target : start;
      const out: Cell[] = [];
      for (let t = 0; t < length; t++) out.push(t % 2 === 0 ? start : b);
      return out;
    },
  };
}

/** Clockwise or counter-clockwise walk around the grid's outer ring. */
function perimeterWalk(clockwise: boolean): Pattern {
  return {
    name: `perimeterWalk(${clockwise ? "cw" : "ccw"})`,
    path(start, gridSize, length) {
      const ring: Cell[] = allCells(gridSize).filter(
        (c) => c.x === 1 || c.x === gridSize || c.y === 1 || c.y === gridSize,
      );
      // Order the ring cells into an actual walk (top row L->R, right col
      // top->bottom, bottom row R->L, left col bottom->top).
      const top = ring.filter((c) => c.y === 1).sort((a, b) => a.x - b.x);
      const right = ring.filter((c) => c.x === gridSize && c.y !== 1 && c.y !== gridSize).sort((a, b) => a.y - b.y);
      const bottom = ring
        .filter((c) => c.y === gridSize)
        .sort((a, b) => b.x - a.x);
      const left = ring
        .filter((c) => c.x === 1 && c.y !== 1 && c.y !== gridSize)
        .sort((a, b) => b.y - a.y);
      const walk = [...top, ...right, ...bottom, ...left];
      const ordered = clockwise ? walk : [...walk].reverse();
      let idx = ordered.findIndex((c) => cellsEqual(c, start));
      // Start cell isn't on the ring (interior start) — anchor to the
      // nearest ring cell instead. A synthetic-library approximation, fine
      // for a structural convergence measurement.
      if (idx === -1) {
        let best = 0;
        let bestDist = Infinity;
        ordered.forEach((c, i) => {
          const d = Math.abs(c.x - start.x) + Math.abs(c.y - start.y);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        idx = best;
      }
      const out: Cell[] = [];
      for (let t = 0; t < length; t++) out.push(ordered[(idx + t) % ordered.length]!);
      return out;
    },
  };
}

/**
 * The full stand-in pool — 8 bounce directions x 2 step sizes, a mirror, a
 * two-cell cycle in each of the 4 orthogonal directions, and a CW/CCW
 * perimeter walk. 23 patterns total, structurally consistent with SPEC.md
 * §5's "fixed delta cycles, mirrors, clockwise walks" but NOT the verified
 * real set — see the module header.
 */
/**
 * The grid sizes this game actually uses. Every one of the 531 `gridSize`
 * values in the corpus is 4; `castSim.ts` defaults to 4 as well. Kept as a
 * LIST rather than a constant so that if a larger pond ever appears, adding it
 * here re-runs the equivalence check at that size instead of silently keeping
 * a dedup decision that was only ever valid on a 4x4 board.
 */
export const GAME_GRID_SIZES: readonly number[] = [4];

/** Long enough to exceed any real cast's turn count, so two patterns that agree here agree in play. */
const EQUIVALENCE_HORIZON = 16;

/**
 * A pattern's complete observable behaviour: its trajectory from EVERY start
 * cell, at every grid size the game uses. Two primitives with the same
 * signature are the same map — not merely unseparated by the current corpus,
 * but incapable of ever being separated by any observation this game can
 * produce.
 */
export function behaviourSignature(pattern: Pattern, gridSizes: readonly number[] = GAME_GRID_SIZES): string {
  const parts: string[] = [];
  for (const g of gridSizes) {
    for (let x = 1; x <= g; x++) {
      for (let y = 1; y <= g; y++) {
        const path = pattern.path({ x, y }, g, EQUIVALENCE_HORIZON);
        parts.push(path.map((c) => `${c.x},${c.y}`).join(">"));
      }
    }
  }
  return parts.join("|");
}

/**
 * [session 53, brief §4] Drops primitives that are provably the SAME MAP as
 * one already in the pool, keeping the first in pool order.
 *
 * Why this is a correctness fix and not a tuning knob. The matcher's prior
 * spreads its initial mass uniformly over the library's candidates. Session 52
 * re-mined the library from 2 patterns to 4 and found that `bounce(2,0)` and
 * `bounce(-2,0)` produce BYTE-IDENTICAL trajectories on all three supporting
 * casts — on a 4-wide grid a +-2 step reflects immediately, so the two are
 * indistinguishable everywhere, not just on the casts observed. The library
 * doubled but added ONE hypothesis, and that hypothesis then held 2/4 of the
 * initial mass instead of 1/3.
 *
 * `matcherPosterior.ts`'s pi is computed from that mass, and QUESTIONS.md §19's
 * decision rule is "does pi climb past 0.5 on any cast". Measuring a posterior
 * against a prior known to be double-counted answers a question nobody asked,
 * which is why this lands BEFORE the §19 batch rather than after.
 *
 * Fixed HERE, in the pool, rather than in `promotePatterns` — aliasing is a
 * property of the primitive SET at a given grid size, not of any one corpus,
 * so a pool that cannot offer duplicates cannot regrow them when the corpus
 * changes. Expect this to be INERT on the replay (session 52 measured the
 * deduped variant at dLogLoss -0.0056 [-0.0312, +0.0121], catches 24 vs 27 vs
 * 26 — all three indistinguishable at n=88); it ships as a correctness fix to
 * the prior, not as a prediction improvement, and should be argued that way.
 */
export function dedupePatterns(patterns: readonly Pattern[], gridSizes: readonly number[] = GAME_GRID_SIZES): Pattern[] {
  const seen = new Map<string, string>();
  const out: Pattern[] = [];
  for (const pattern of patterns) {
    const sig = behaviourSignature(pattern, gridSizes);
    const existing = seen.get(sig);
    if (existing !== undefined) continue; // provably the same map as `existing`
    seen.set(sig, pattern.name);
    out.push(pattern);
  }
  return out;
}

/** Which primitives `dedupePatterns` collapses, and onto what — for reporting and tests. */
export function patternAliases(
  patterns: readonly Pattern[],
  gridSizes: readonly number[] = GAME_GRID_SIZES,
): Array<{ dropped: string; sameAs: string }> {
  const seen = new Map<string, string>();
  const aliases: Array<{ dropped: string; sameAs: string }> = [];
  for (const pattern of patterns) {
    const sig = behaviourSignature(pattern, gridSizes);
    const existing = seen.get(sig);
    if (existing !== undefined) aliases.push({ dropped: pattern.name, sameAs: existing });
    else seen.set(sig, pattern.name);
  }
  return aliases;
}

/** The raw primitive set, BEFORE de-aliasing — exposed so tests can show what was collapsed. */
export function buildRawPatternPool(): Pattern[] {
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const pool: Pattern[] = [];
  for (const [dx, dy] of dirs) pool.push(bounceDelta(dx, dy));
  for (const [dx, dy] of dirs) pool.push(bounceDelta(dx * 2, dy * 2));
  pool.push(mirrorAcrossCentre);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    pool.push(twoCellCycle(dx, dy));
  }
  pool.push(perimeterWalk(true));
  pool.push(perimeterWalk(false));
  return pool;
}

/**
 * The primitive pool every caller should use: `buildRawPatternPool()` with
 * provably-identical primitives collapsed. See `dedupePatterns`.
 */
export function buildPatternPool(): Pattern[] {
  return dedupePatterns(buildRawPatternPool());
}

/**
 * Resolves saved pattern NAMES (from `data/minedFishPatterns.json`, or any
 * older library file) to pool entries, mapping a name that de-aliasing
 * retired onto the survivor it is provably identical to, and dropping the
 * resulting duplicates.
 *
 * [session 53, brief §4] Needed because a library mined BEFORE de-aliasing
 * can name a primitive the deduped pool no longer contains — the live
 * `data/minedFishPatterns.json` holds both `bounce(2,0)` and `bounce(-2,0)`
 * today. Resolving the retired name to its survivor is exactly right (they
 * are the same map), and collapsing the duplicate is the entire point: two
 * entries for one hypothesis is the double-counted prior this change exists
 * to remove. Without this, `liveFishing.ts`'s loader would silently drop the
 * name and `minedLibraryGate.ts` would throw.
 *
 * `unresolved` names are returned rather than ignored — a name that matches
 * nothing at all is a stale or corrupt file, not an alias, and the caller
 * should say so.
 */
export function resolvePatternsByName(names: readonly string[]): { patterns: Pattern[]; unresolved: string[] } {
  const raw = buildRawPatternPool();
  const bySignature = new Map<string, Pattern>();
  for (const p of dedupePatterns(raw)) bySignature.set(behaviourSignature(p), p);

  const rawByName = new Map(raw.map((p) => [p.name, p]));
  const patterns: Pattern[] = [];
  const unresolved: string[] = [];
  const taken = new Set<string>();

  for (const name of names) {
    const rawPattern = rawByName.get(name);
    if (!rawPattern) {
      unresolved.push(name);
      continue;
    }
    const survivor = bySignature.get(behaviourSignature(rawPattern));
    if (!survivor || taken.has(survivor.name)) continue; // duplicate of one already taken
    taken.add(survivor.name);
    patterns.push(survivor);
  }
  return { patterns, unresolved };
}

/** A minimal candidate shape, matching `strategy/fishing/matcher.ts`'s `Candidate`. */
export interface PatternCandidate {
  id: string;
  predict(turn: number): Cell;
}

/** Anchor a `Pattern` at a known start cell, producing a `matcher.ts`-compatible candidate. */
export function toCandidate(
  pattern: Pattern,
  start: Cell,
  gridSize: number,
  maxTurns: number,
): PatternCandidate {
  const trajectory = pattern.path(start, gridSize, maxTurns + 1);
  return {
    id: `${pattern.name}@${start.x},${start.y}`,
    predict: (turn: number) => trajectory[turn] ?? trajectory[trajectory.length - 1]!,
  };
}
