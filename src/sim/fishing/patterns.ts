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
export function buildPatternPool(): Pattern[] {
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
