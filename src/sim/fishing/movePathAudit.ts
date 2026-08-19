/**
 * src/sim/fishing/movePathAudit.ts — [session 48]
 *
 * FACT 1, as it has been stated since session 45, is: *"every move lands on a
 * fixed Manhattan-`k` ring, and `k` is constant per cast."* It was
 * exceptionless across 279 transitions and it is the hard constraint the ring
 * model is built on — off-ring cells get probability exactly zero.
 *
 * Session 48's first live cast (`12988700`) broke it, and not by a little:
 * its six moves ran `k = 1, 2, 1, 2, 1, 2`, a perfect alternation.
 *
 * `data.lastMovePath` explains what is really going on, and it had been on the
 * wire the whole time. It is the server's own account of the move: 1-based
 * row-major cell indices, **one per unit step**, ending on `fishPosition`.
 * On every k=1 turn it has length 1; on every k=2 turn it has length 2 and
 * the intermediate cell is orthogonally adjacent to both endpoints.
 *
 * So the fish only ever takes UNIT steps. What varies is how many it takes in
 * a turn. The quantity FACT 1 called a "step class" is a **step count**, and
 * the part of FACT 1 that is exceptionless is the unit-step decomposition —
 * not the per-cast constancy of the count, which is merely very common.
 *
 * The three identities below hold **319/319 with zero exceptions** on the
 * committed corpus, which is why they are worth pinning:
 *
 *   1. `lastMovePath.length === manhattan(previousFishPosition, fishPosition)`
 *   2. `lastMovePath[last]` decodes to `fishPosition`
 *   3. every hop along `previousFishPosition -> ...path` is a unit step
 *
 * Identity 2 also re-confirms session 47's row-major reading of `position`
 * (`index === (position[0] - 1) * gridSize + position[1]`) on a second,
 * independent field — `position[0]` is the ROW.
 *
 * Note the shape of the miss, because it is the same one three times now
 * (heuristic (d), the `.message` classifier, the zone table): the evidence
 * that refutes the strong form of FACT 1 was present in every capture from the
 * beginning. Nothing looked at it, because the corpus view used to fit the
 * movement model (`data/fish-patterns.jsonl`) projects each turn down to
 * `from`/`to` and discards the path between them.
 */

import type { CastTrace } from "./castTrace.js";

export interface MovePathRow {
  castId: string;
  turnIndex: number;
  /** Manhattan distance from `previousFishPosition` to `fishPosition`. */
  steps: number;
  path: number[];
  lengthMatches: boolean;
  endpointMatches: boolean;
  allUnitSteps: boolean;
}

export interface MovePathAudit {
  scored: number;
  lengthMatches: number;
  endpointMatches: number;
  allUnitSteps: number;
  /** Every row failing at least one identity — empty on the committed corpus. */
  violations: MovePathRow[];
  /** Histogram of steps-per-turn (`lastMovePath.length`). */
  stepHistogram: Map<number, number>;
}

/** Decodes a 1-based row-major cell index into `[row, col]`, both 1-based. */
export function indexToCell(index: number, gridSize: number): { x: number; y: number } {
  return { x: Math.floor((index - 1) / gridSize) + 1, y: ((index - 1) % gridSize) + 1 };
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Scores every turn that carries a `lastMovePath` against the three
 * identities. Turn 0 has no move and no path, so it contributes nothing.
 */
export function auditMovePaths(traces: readonly CastTrace[]): MovePathAudit {
  let scored = 0;
  let lengthMatches = 0;
  let endpointMatches = 0;
  let allUnitSteps = 0;
  const violations: MovePathRow[] = [];
  const stepHistogram = new Map<number, number>();

  for (const trace of traces) {
    for (const turn of trace.turns) {
      const path = turn.lastMovePath;
      if (!path || path.length === 0) continue;
      scored++;
      stepHistogram.set(path.length, (stepHistogram.get(path.length) ?? 0) + 1);

      const cells = path.map((i) => indexToCell(i, turn.gridSize));
      const lenOk = path.length === manhattan(turn.previousFishPosition, turn.fishPosition);
      const end = cells[cells.length - 1]!;
      const endOk = end.x === turn.fishPosition.x && end.y === turn.fishPosition.y;
      const chain = [turn.previousFishPosition, ...cells];
      let unitOk = true;
      for (let i = 0; i + 1 < chain.length; i++) {
        if (manhattan(chain[i]!, chain[i + 1]!) !== 1) unitOk = false;
      }

      if (lenOk) lengthMatches++;
      if (endOk) endpointMatches++;
      if (unitOk) allUnitSteps++;
      if (!lenOk || !endOk || !unitOk) {
        violations.push({
          castId: trace.docId,
          turnIndex: turn.index,
          steps: path.length,
          path,
          lengthMatches: lenOk,
          endpointMatches: endOk,
          allUnitSteps: unitOk,
        });
      }
    }
  }

  return { scored, lengthMatches, endpointMatches, allUnitSteps, violations, stepHistogram };
}

export interface StepCountCast {
  castId: string;
  /** Steps-per-turn, in turn order. */
  counts: number[];
  constant: boolean;
  /** True when the counts strictly alternate between exactly two values. */
  alternating: boolean;
}

/**
 * Per-cast steps-per-turn sequences — the direct test of FACT 1's *constancy*
 * half, which is the half that is now known to be false.
 */
export function stepCountsPerCast(traces: readonly CastTrace[]): StepCountCast[] {
  const out: StepCountCast[] = [];
  for (const trace of traces) {
    const counts: number[] = [];
    for (const turn of trace.turns) {
      if (turn.lastMovePath && turn.lastMovePath.length > 0) counts.push(turn.lastMovePath.length);
    }
    if (counts.length === 0) continue;
    const constant = counts.every((c) => c === counts[0]);
    const alternating =
      !constant &&
      new Set(counts).size === 2 &&
      counts.every((c, i) => (i < 2 ? true : c === counts[i - 2]));
    out.push({ castId: trace.docId, counts, constant, alternating });
  }
  return out;
}

export interface NextMovePathRow {
  castId: string;
  turnIndex: number;
  nextMovePath: number[];
  /** `nextMovePath` decoded to cells. */
  decoded: { x: number; y: number }[];
  nextPosition: { x: number; y: number };
  /** Does the decoded path end exactly on `nextPosition`? */
  endsOnNextPosition: boolean;
  /** Is the decoded path a chain of unit steps from the fish's current cell? */
  unitStepsFromCurrent: boolean;
  /** The realized `lastMovePath` on the FOLLOWING turn, when there is one. */
  realizedPath: number[] | null;
  /** Did the fish actually go there? `null` when the cast ended first. */
  realized: boolean | null;
}

/**
 * [session 48] Scores `data.nextMovePath` / `data.nextPosition` — the
 * server's PRE-ROLLED next move, QUESTIONS.md §17.
 *
 * §17 asked whether `nextMovePath` is ever a genuine multi-cell path or
 * always a one-cell duplicate of `nextPosition`. It is a genuine path. The
 * one non-null sample §17 had read `nextMovePath [1,2]` and `nextPosition
 * [1,2]` and called them identical — but they are different types.
 * `nextMovePath` is a list of 1-based row-major cell INDICES ([1,2] decodes
 * to [1,1] then [1,2]); `nextPosition` is a coordinate pair. The apparent
 * identity was a coincidence of formatting.
 *
 * It is the same unit-step path structure as `lastMovePath`, one turn early,
 * and its LENGTH is the next move's step count — the quantity FACT 1 got
 * wrong.
 */
export function auditNextMovePaths(traces: readonly CastTrace[]): NextMovePathRow[] {
  const out: NextMovePathRow[] = [];
  for (const trace of traces) {
    trace.turns.forEach((turn, i) => {
      const path = turn.nextMovePath;
      const next = turn.nextPosition;
      if (!path || path.length === 0 || !next) return;
      const decoded = path.map((idx) => indexToCell(idx, turn.gridSize));
      const end = decoded[decoded.length - 1]!;
      const chain = [turn.fishPosition, ...decoded];
      let unit = true;
      for (let j = 0; j + 1 < chain.length; j++) {
        if (manhattan(chain[j]!, chain[j + 1]!) !== 1) unit = false;
      }
      const following = trace.turns[i + 1];
      out.push({
        castId: trace.docId,
        turnIndex: turn.index,
        nextMovePath: path,
        decoded,
        nextPosition: next,
        endsOnNextPosition: end.x === next.x && end.y === next.y,
        unitStepsFromCurrent: unit,
        realizedPath: following?.lastMovePath ?? null,
        realized: following ? following.fishPosition.x === next.x && following.fishPosition.y === next.y : null,
      });
    });
  }
  return out;
}

