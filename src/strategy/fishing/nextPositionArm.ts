/**
 * src/strategy/fishing/nextPositionArm.ts — [session 66 §1] the FIRST-MISS
 * tripwire on the `nextPosition` override.
 *
 * ## Why the existing gate cannot protect anything
 *
 * The override arms behind a Wilson-score lower bound on hits/attempts
 * (`nextPositionOverrideStats`, `scripts/liveFishing.ts`). That gate was built
 * for a real bug — session 39's raw hit COUNT ignored the denominator — and it
 * fixed it. What it cannot do is FIRE.
 *
 * A Wilson lower bound computed from an unbroken streak only ever CLIMBS:
 * 12/12 ≈ 0.76, 20/20 ≈ 0.84, 50/50 ≈ 0.93. There is no value the streak can
 * reach that lowers it. So while the override behaves, the gate is monotone in
 * the wrong direction, and the moment it stops behaving is the moment nobody is
 * watching a number that has spent every observation going up.
 *
 * That is the whole problem, and it is not a threshold problem. The fix is an
 * EVENT THAT CAN ACTUALLY OCCUR: the first validated miss.
 *
 * The override armed live for the first time in session 65 — 12 validation
 * entries, 12 hits, across 9 casts, firing on ~1-2% of turns — so this stopped
 * being a dormant safeguard and became a live input to card choice without a
 * decision being taken. User decision, 2026-08-21: keep it armed, and add a
 * tripwire that can fire.
 *
 * ## The three prediction cases, which must never be conflated
 *
 * `classifyPredictionOutcome` exists because "no prediction" and "prediction
 * correct" are the same shape at the call site (nothing to complain about) and
 * conflating them is exactly how 12/12 becomes 12/12 forever:
 *
 *   - **absent** — the server volunteered no `nextPosition`, so there is
 *     nothing to validate and nothing to trip. ~98-99% of turns.
 *   - **not_acted** — a prediction was present but the override did NOT steer
 *     the card choice (the gate was unmet, or it is already disarmed). Still
 *     recorded in the validation ledger; NEVER trips the wire. Tripping on a
 *     prediction the bot did not act on would disarm a safeguard over a
 *     counterfactual.
 *   - **acted_hit / acted_miss** — present AND acted on. `acted_miss` is the
 *     only case that disarms, and it is the case the Wilson bound has never
 *     seen.
 *
 * ## Why the disarm is a FILE and why nothing here re-arms
 *
 * A safeguard that resets itself is a log line, not a guard. If the override
 * re-armed next session, the tripwire would record a blip and change nothing —
 * the streak would resume climbing from a ledger that now contains the miss
 * plus every hit after it, and the Wilson bound would clear 0.5 again within a
 * handful of turns. So the disarm outlives the process, and this module
 * deliberately exports NO re-arm function: re-arming is a human deleting
 * `data/nextPositionOverrideDisarm.json` after looking at what it says.
 * `tests/fishing/nextPositionTripwire.test.ts` pins that absence.
 *
 * Failure direction: anything other than a cleanly-absent file counts as
 * DISARMED. A missing file is the normal armed state; an unreadable or
 * malformed one means a disarm may have been recorded and cannot be read, and
 * the override is an optimisation worth a fraction of a percent of turns, so
 * refusing to use it costs approximately nothing. Same fail-closed instinct as
 * `nextConsumableSlot` returning `null` rather than guessing a slot.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { cellsEqual, type Cell } from "../../sim/fishing/geometry.js";

/** Real data path. Tests MUST override it — CLAUDE.md working-style, "tests must never write to a real data path". */
export const DEFAULT_NEXT_POSITION_ARM_STATE_PATH = join("data", "nextPositionOverrideDisarm.json");

/**
 * What the loop did with the server's prediction on one turn. See this
 * module's header: the point of the type is that `absent` and `acted_hit` are
 * different facts, and that `not_acted` is a third thing again.
 */
export type PredictionOutcome =
  | { kind: "absent" }
  | { kind: "not_acted"; hit: boolean }
  | { kind: "acted_hit" }
  | { kind: "acted_miss" };

export interface PredictionOutcomeInput {
  /** The server's pre-rolled cell for THIS turn, or `null` if it volunteered none. */
  predicted: Cell | null;
  /** Where the fish actually went, read off the response's own doc. */
  actual: Cell;
  /**
   * Whether the override actually steered card choice on this turn — i.e.
   * `nextPositionOverrideActive` was true when `chooseCard`'s distribution was
   * built. NOT "the gate would clear now": the gate is re-read every turn, so
   * asking it again after the fact can answer about a different ledger than
   * the one the decision was made against.
   */
  actedOn: boolean;
}

/** Pure classifier — no I/O, so the three-case distinction is testable on its own. */
export function classifyPredictionOutcome(input: PredictionOutcomeInput): PredictionOutcome {
  const { predicted, actual, actedOn } = input;
  if (!predicted) return { kind: "absent" };
  const hit = cellsEqual(predicted, actual);
  if (!actedOn) return { kind: "not_acted", hit };
  return hit ? { kind: "acted_hit" } : { kind: "acted_miss" };
}

/** True only for the one case that disarms the override. Kept as a named predicate so the call site reads as the rule rather than as a string comparison. */
export function tripsWire(outcome: PredictionOutcome): boolean {
  return outcome.kind === "acted_miss";
}

/** The record written when the wire fires. Everything the recap needs to report the miss without going back to the logs. */
export interface OverrideDisarmRecord {
  /** ISO timestamp of the miss. */
  at: string;
  /** `doc.docId` — the same cast boundary `fishingCorpus.ts` groups on. */
  castId: string;
  /** The turn the override fired on and was wrong. */
  turn: number;
  /** The cell the server pre-rolled and the override forced focus toward. */
  predicted: [number, number];
  /** Where the fish actually went. */
  actual: [number, number];
  gridSize: number;
  /** Hits/attempts in the validation ledger at the moment of the miss — the streak this ended. */
  streakHits: number;
  streakAttempts: number;
  /** Wilson lower bound the gate was clearing when it fired. Recorded because the number that authorised the override is part of the evidence about it. */
  lowerBound: number;
}

export interface ArmState {
  /** False only when the file is cleanly absent. See the header for why every other case reads as disarmed. */
  disarmed: boolean;
  /** The recorded miss, when there is a readable one. */
  record: OverrideDisarmRecord | null;
  /** Why this state was reached — distinguishes "never tripped" from "tripped" from "cannot tell", which are three different things to a reader of a recap. */
  reason: "armed_no_file" | "disarmed_by_miss" | "disarmed_unreadable";
}

function isRecord(v: unknown): v is OverrideDisarmRecord {
  const r = v as Partial<OverrideDisarmRecord> | null;
  return (
    !!r &&
    typeof r === "object" &&
    typeof r.at === "string" &&
    typeof r.castId === "string" &&
    typeof r.turn === "number" &&
    Array.isArray(r.predicted) &&
    r.predicted.length === 2 &&
    Array.isArray(r.actual) &&
    r.actual.length === 2 &&
    typeof r.gridSize === "number"
  );
}

/**
 * Reads the persisted arm state. A missing file is the ARMED state and is not
 * an error — no miss has ever been recorded is the normal condition, and has
 * been for the whole project's history.
 */
export function readArmState(path: string = DEFAULT_NEXT_POSITION_ARM_STATE_PATH): ArmState {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { disarmed: false, record: null, reason: "armed_no_file" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A file exists and cannot be read. Something wrote SOMETHING here; the
    // safe reading is that it was a disarm.
    return { disarmed: true, record: null, reason: "disarmed_unreadable" };
  }
  if (!isRecord(parsed)) return { disarmed: true, record: null, reason: "disarmed_unreadable" };
  return { disarmed: true, record: parsed, reason: "disarmed_by_miss" };
}

/**
 * Writes the disarm. **Write-once by design**: if a disarm is already on disk
 * it is left exactly as it was and `false` is returned. The FIRST miss is the
 * evidence worth keeping, and a later write could only ever come from a path
 * that should not have been able to fire (the override is off once this file
 * exists), so overwriting would destroy the record of the event that mattered.
 */
export function disarmOverride(rec: OverrideDisarmRecord, path: string = DEFAULT_NEXT_POSITION_ARM_STATE_PATH): boolean {
  if (readArmState(path).disarmed) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rec, null, 2) + "\n");
  return true;
}

/**
 * The human-facing instruction, kept next to the state it describes so the
 * console line and the recap say the same thing. There is deliberately no code
 * path that performs this.
 */
export function describeArmState(state: ArmState, path: string = DEFAULT_NEXT_POSITION_ARM_STATE_PATH): string {
  if (!state.disarmed) return "nextPosition override: ARMED (no miss on record).";
  if (!state.record) {
    return (
      `nextPosition override: DISARMED — the state file at ${path} could not be read, ` +
      `so a recorded miss cannot be ruled out. Fail-closed. Inspect it, then delete it to re-arm.`
    );
  }
  const r = state.record;
  return (
    `nextPosition override: DISARMED by a validated miss — cast ${r.castId}, turn ${r.turn}, ` +
    `predicted [${r.predicted.join(",")}], actual [${r.actual.join(",")}] ` +
    `(the streak it ended: ${r.streakHits}/${r.streakAttempts}, Wilson lower bound ${(r.lowerBound * 100).toFixed(1)}%). ` +
    `Nothing re-arms this automatically — a human deletes ${path} after deciding the field is still worth trusting.`
  );
}
