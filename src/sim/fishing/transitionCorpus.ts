/**
 * src/sim/fishing/transitionCorpus.ts — [session 33] the shared cast-grouping
 * logic for `data/fish-patterns.jsonl`, extracted out of
 * `scripts/mineFishPatterns.ts` (where it originated, session 15/29) so a
 * second module needing the same "records -> per-cast trajectory" shape
 * (CODEXIMPROVE #3's contextual fallback) doesn't re-derive it — per
 * CODEXIMPROVE #3's own instruction to "reuse mineFishPatterns.ts's existing
 * groupByCast-style logic rather than re-deriving it." Behavior is
 * byte-for-byte unchanged from the version this replaces; only the location
 * moved. `scripts/mineFishPatterns.ts` now imports from here instead of
 * defining its own copy.
 *
 * Not to be confused with `src/sim/fishingCorpus.ts` (CODEXREVIEW #1/#5),
 * which groups committed FIXTURE response files by `docId` — a different
 * corpus (raw per-turn API responses) from this one (the flat
 * `data/fish-patterns.jsonl` transition log, keyed by `castId` from turn
 * one). See that file's header for why the two were never conflated.
 */

import { existsSync, readFileSync } from "node:fs";

import type { Cell } from "./geometry.js";
import { cellsEqual } from "./geometry.js";

export interface TransitionRecord {
  ts: string;
  castId: string;
  turn: number;
  from: [number, number];
  to: [number, number];
  gridSize: number;
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

/** A cast usable for exact-trajectory or contextual-transition analysis — excludes the CODEXREVIEW #5 resumed-numbering/gap failure modes. */
export function isCleanCast(cast: Cast): boolean {
  return cast.duplicateTurns.length === 0 && !cast.hasGaps && cast.maxTurn >= 0;
}

/**
 * [session 33] Reads `data/fish-patterns.jsonl`-shaped records off disk —
 * same read/parse behavior as `scripts/mineFishPatterns.ts`'s original
 * `loadRecords` (one bad line skipped, never fatal), factored out so
 * `scripts/liveFishing.ts`'s new contextual-fallback wiring (CODEXIMPROVE
 * #3) doesn't need a third copy of this file-reading loop alongside
 * `mineFishPatterns.ts`'s and `scripts/liveFishing.ts`'s own pre-existing
 * `loadTransitionLog` (which returns a different, already-cell-keyed shape
 * for `emptyFallback` and is untouched by this addition).
 */
export function loadTransitionRecords(path: string): TransitionRecord[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim().length > 0);
  const out: TransitionRecord[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as TransitionRecord);
    } catch {
      // one bad line shouldn't lose the whole log
    }
  }
  return out;
}
