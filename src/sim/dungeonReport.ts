/**
 * src/sim/dungeonReport.ts — [session 30] run-visibility reporting, dungeon
 * half. Pure functions only (no filesystem) — `scripts/dungeonReport.ts`
 * does the reading/writing, same split as `src/strategy/` vs. `src/api/`.
 *
 * Reward fields verified against real captures before writing any of this
 * (per the session-30 brief's explicit instruction — don't guess field
 * names): `gameItemBalanceChanges` is a top-level array on dungeon POST
 * responses (sibling to `data`, not inside it).
 *
 *  - item 845, `NAME_CID: "Hard Core"` — credited on `message: "Reward
 *    chosen"` (a boon pick). Confirms the session-08 `gigusOrbItemId`/
 *    `gigusOrbAmount` hypothesis (handoff/DECISIONS.md 2026-08-14) directly.
 *  - item 846, `NAME_CID: "Dendren Remnant"` — credited on a `"Move Used"`
 *    response that lands a kill. **The user calls this "Dendren Root" in
 *    conversation; the wire NAME_CID is "Dendren Remnant."** Per CLAUDE.md
 *    §1 ("if a field you expected is missing, the live response is right"),
 *    this report uses the wire name as the source of truth and reports the
 *    user's term alongside it rather than silently substituting one for the
 *    other.
 *
 * Full captures: `fixtures/dungeon-runs/run-2026-08-15-15-38-09/
 * state-{054,079,110}.json`.
 *
 * "CLEARED" (floor 4 / room 16) has never happened live — `ROOM_NUM_CID >=
 * MAX_ROOM && COMPLETE_CID === true` is the principled definition given the
 * confirmed field semantics, not a verified observation of the shape itself.
 */

import type { CorpusState } from "./corpus.js";
import { MAX_ROOM } from "./enemies.js";

/** Wire item id, `NAME_CID: "Hard Core"` — the leaderboard-scored currency. */
export const ITEM_HARD_CORE = 845;
/** Wire item id, `NAME_CID: "Dendren Remnant"` — the user's "Dendren Root." */
export const ITEM_DENDREN_REMNANT = 846;

export type DungeonOutcome =
  | { kind: "death"; room: number | null }
  | { kind: "cleared" }
  | { kind: "incomplete"; lastRoom: number | null };

export interface DungeonRunRecord {
  cid: number;
  dirs: string[];
  outcome: DungeonOutcome;
  juiced: boolean;
  hardCoreEarned: number;
  dendrenRemnantEarned: number;
  energySpent: number;
}

/** Structural input, deliberately decoupled from `scripts/deathRooms.ts`'s `Attempt` type — src/ does not import from scripts/. */
export interface DungeonAttemptInput {
  cid: number;
  dirs: string[];
  states: CorpusState[];
  /** 1-based room the death-room histogram already derives (enemy present in the last captured state). `null` if that enemy isn't in `ROOM_ENEMIES`. */
  room: number | null;
  playerDied: boolean;
}

/**
 * Summarizes one dungeon attempt into a report record. `energyCostPerRun` is
 * passed in (from `config/discovered.json` via the caller) rather than
 * imported here, keeping this module pure and testable without touching
 * config — juiced mode is a confirmed 3x multiplier (DECISIONS 2026-08-17).
 */
export function summarizeDungeonAttempt(attempt: DungeonAttemptInput, energyCostPerRun: number): DungeonRunRecord {
  // NOT `IS_JUICED_CID` — that's the always-on account-level purchased buff,
  // not the per-run mode selection. See `WireEntity`'s doc comment
  // (`src/sim/corpus.ts`) for the full correction.
  const juiced = attempt.states.some((s) => s.entity?.WANTS_JUICED_MODE_CID === true);

  let hardCoreEarned = 0;
  let dendrenRemnantEarned = 0;
  for (const s of attempt.states) {
    for (const change of s.gameItemBalanceChanges) {
      if (change.id === ITEM_HARD_CORE) hardCoreEarned += change.amount;
      else if (change.id === ITEM_DENDREN_REMNANT) dendrenRemnantEarned += change.amount;
    }
  }

  const last = attempt.states[attempt.states.length - 1] ?? null;
  const lastEntity = last?.entity ?? null;

  let outcome: DungeonOutcome;
  if (attempt.playerDied) {
    outcome = { kind: "death", room: attempt.room };
  } else if (
    typeof lastEntity?.ROOM_NUM_CID === "number" &&
    lastEntity.ROOM_NUM_CID >= MAX_ROOM &&
    lastEntity.COMPLETE_CID === true
  ) {
    outcome = { kind: "cleared" };
  } else {
    outcome = { kind: "incomplete", lastRoom: attempt.room };
  }

  return {
    cid: attempt.cid,
    dirs: attempt.dirs,
    outcome,
    juiced,
    hardCoreEarned,
    dendrenRemnantEarned,
    energySpent: energyCostPerRun * (juiced ? 3 : 1),
  };
}

function formatOutcome(outcome: DungeonOutcome): string {
  switch (outcome.kind) {
    case "death":
      return `death @ room ${outcome.room ?? "unknown"}`;
    case "cleared":
      return "CLEARED";
    case "incomplete":
      return `incomplete (last room ${outcome.lastRoom ?? "unknown"})`;
  }
}

export interface DungeonMarkdownOptions {
  generatedAt?: string;
}

/** Renders the committed `handoff/reports/dungeon-runs.md` from a set of records. Deterministic given the same input (no `Date.now()` unless `generatedAt` is omitted). */
export function buildDungeonMarkdown(records: DungeonRunRecord[], opts: DungeonMarkdownOptions = {}): string {
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const lines: string[] = [];

  lines.push("# Dungeon runs");
  lines.push("");
  lines.push(
    `Regenerated from \`data/run-reports/dungeon.jsonl\` by \`scripts/dungeonReport.ts\` — do not hand-edit. Last generated ${generatedAt}.`,
  );
  lines.push("");
  lines.push(
    `**"Dendren Root"** (the user's term) is wire item 846, \`NAME_CID: "Dendren Remnant"\` — see this file's ` +
      `header comment in \`src/sim/dungeonReport.ts\` for the capture that confirmed it.`,
  );
  lines.push("");

  const deaths = records.filter((r) => r.outcome.kind === "death");
  const cleared = records.filter((r) => r.outcome.kind === "cleared");
  const incomplete = records.filter((r) => r.outcome.kind === "incomplete");
  const totalHardCore = records.reduce((s, r) => s + r.hardCoreEarned, 0);
  const totalDendrenRoot = records.reduce((s, r) => s + r.dendrenRemnantEarned, 0);
  const totalEnergy = records.reduce((s, r) => s + r.energySpent, 0);
  const juicedCount = records.filter((r) => r.juiced).length;

  lines.push(
    `${records.length} recorded attempts — ${deaths.length} deaths, ${cleared.length} cleared, ${incomplete.length} incomplete/stopped. ` +
      `${juicedCount} juiced.`,
  );
  lines.push(`Total Hard Core earned: ${totalHardCore}. Total Dendren Root earned: ${totalDendrenRoot}. Total energy spent: ${totalEnergy}.`);
  lines.push("");

  if (deaths.length > 0) {
    lines.push("## Death-room histogram");
    lines.push("");
    const histogram = new Map<number, number>();
    for (const d of deaths) {
      if (d.outcome.kind === "death" && d.outcome.room != null) {
        histogram.set(d.outcome.room, (histogram.get(d.outcome.room) ?? 0) + 1);
      }
    }
    const maxRoom = Math.max(0, ...histogram.keys());
    for (let room = 1; room <= maxRoom; room++) {
      const n = histogram.get(room) ?? 0;
      lines.push(`- room ${room}: ${"█".repeat(n)} ${n}`);
    }
    lines.push("");
  }

  lines.push("## Per-run detail");
  lines.push("");
  lines.push("| cid | outcome | juiced | Hard Core | Dendren Root | energy | dirs |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of records) {
    lines.push(
      `| ${r.cid} | ${formatOutcome(r.outcome)} | ${r.juiced ? "yes" : "no"} | ${r.hardCoreEarned} | ${r.dendrenRemnantEarned} | ${r.energySpent} | ${r.dirs.join(", ")} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}
