/**
 * src/strategy/fishing/oilCastState.ts — [session 62 §1b] the THIRD cast state.
 *
 * ## The problem this exists to solve
 *
 * §4b's pre-registration (session 61 brief) splits casts into an OIL arm and a
 * NON-OIL arm for outcome metrics, and derives the split from the server's own
 * `consumablesUsed` (`src/sim/fishingCorpus.ts`'s `oilEra`) — deliberately, so
 * it cannot be forgotten by a loop that fails to write a flag.
 *
 * Partial stock creates a case that derivation cannot see. The user has a few
 * oils, fewer than a batch needs, and `on-demand` spends ~0.70 per cast, so
 * **stock runs out mid-batch.** A cast in which the policy WANTED an oil and
 * none was available is:
 *
 *   - not an oil cast — nothing was consumed, so `consumablesUsed` is 0 and the
 *     server-derived flag correctly says "no oil"; and
 *   - not a clean non-oil cast either — the policy that played it was the oil
 *     policy running dry, which is a different policy from the one the non-oil
 *     arm is meant to measure.
 *
 * Pooling it into either arm is exactly what the DEAD ERA did: a policy change
 * went unflagged, got averaged into a rate, and it took 40 casts to notice the
 * rate meant nothing. So it is flagged as its own state and kept out of both
 * arms until there is a reason to fold it into one.
 *
 * ## Why a sidecar rather than a derived flag
 *
 * Because the server cannot know it. `consumablesUsed` counts what WAS spent;
 * nothing on the board state records what the policy wanted and could not have.
 * Only the spend site knows, so only the spend site can record it — the same
 * reasoning that puts item IDENTITY on the per-turn record rather than deriving
 * it (`liveFishing.ts`'s `oilItemIdsUsed`).
 *
 * The cost of a written flag is the one session 61 named: it starts at zero and
 * cannot see backwards. That is fine here and NOT fine for `oilEra`, because
 * this flag is about a policy that did not exist before this session, so there
 * is no history for it to miss. `oilEra` is about a mechanic that predates the
 * bot, which is why that one is derived and this one is written.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Real data path. Tests MUST override it — CLAUDE.md working-style, "tests must never write to a real data path". */
export const DEFAULT_OIL_CAST_STATE_PATH = join("data", "fishing-oil-cast-states.jsonl");

export interface OilCastStateRecord {
  /** `doc.docId` — the same cast boundary `fishingCorpus.ts` groups on, so the two join without a mapping table. */
  castId: string;
  /** ISO timestamp of the cast that recorded it. */
  at: string;
  /** How many turns fired a trigger against zero stock. */
  dryTriggers: number;
  /** Distinct reasons seen — `"empty"` (balance read, holds none) vs `"balance_unknown"` (read failed). Not the same fact. */
  reasons: string[];
  /** Oils actually consumed on this cast. Non-zero with `dryTriggers > 0` means the bag ran dry PART-way through. */
  oilsConsumed: number;
}

/** Appends one record. Creates the parent directory if absent, same as every other persistence module here. */
export function appendOilCastState(rec: OilCastStateRecord, path: string = DEFAULT_OIL_CAST_STATE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(rec) + "\n");
}

/**
 * Every `castId` on record as having run the oil policy dry. Missing file = an
 * empty set, not an error: no cast has run dry yet is the normal state.
 */
export function loadDryCastIds(path: string = DEFAULT_OIL_CAST_STATE_PATH): Set<string> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return new Set();
  }
  const out = new Set<string>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as Partial<OilCastStateRecord>;
      if (typeof rec.castId === "string" && (rec.dryTriggers ?? 0) > 0) out.add(rec.castId);
    } catch {
      continue; // one bad line does not invalidate the ledger
    }
  }
  return out;
}
