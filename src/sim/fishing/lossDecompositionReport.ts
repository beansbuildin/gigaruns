/**
 * src/sim/fishing/lossDecompositionReport.ts — [session 117, OFFLINE]
 *
 * Pure functions only (no filesystem) — `scripts/lossDecompositionReport.ts`
 * does the reading/writing, same split as `src/sim/fishingReport.ts` /
 * `scripts/fishingReport.ts`.
 *
 * `terminalReason` (and the 4-way `Reason` type) moved here from
 * `scripts/lossDecomposition.ts` (session 48), which now imports it back
 * rather than keeping a second copy — see that file's doc comment. The
 * classification itself is UNCHANGED: check `fishHp >= fishMaxHp` before
 * `mana <= 0`, exactly as session 48 shipped it, so a cast that hits both at
 * once (mana exhausted on the same turn the fish's HP happens to have
 * climbed back to max) is scored "escaped (fish at full HP)", not
 * "mana out" — the meter-refill is the more informative fact about what
 * actually happened on that turn.
 *
 * Session 117's offline analysis (`handoff/DECISIONS.md`, 2026-09-02) is
 * what surfaced that this breakdown existed only as a manual,
 * un-persisted diagnostic — this file is what lets `regenerateReports.ts`
 * commit it like the other two run-visibility reports, off the FULL fixture
 * corpus every run, not just one session's slice of it.
 */

import type { CastTrace } from "./castTrace.js";

export type TerminalReason = "caught" | "escaped (fish at full HP)" | "mana out" | "truncated / unresolved";

/** The four terminal reasons, in the fixed display order every table below uses. */
export const TERMINAL_REASONS: readonly TerminalReason[] = ["caught", "escaped (fish at full HP)", "mana out", "truncated / unresolved"];

/**
 * Classifies one cast's terminal reason off its LAST recorded turn.
 * `fishHp >= fishMaxHp` is checked before `mana <= 0` — see this file's doc
 * comment for why the two are not mutually exclusive in the corpus.
 */
export function terminalReason(t: CastTrace): TerminalReason {
  const last = t.turns[t.turns.length - 1]!;
  if (t.caught) return "caught";
  if (last.fishHp >= last.fishMaxHp) return "escaped (fish at full HP)";
  if (last.mana <= 0) return "mana out";
  return "truncated / unresolved";
}

export interface LossDecompositionRecord {
  docId: string;
  reason: TerminalReason;
  /** Turns played, excluding the `start_run` state (turn 0) — `t.turns.length - 1`. */
  turns: number;
  finalMana: number;
  finalFocus: number;
  /** True if any recorded turn of this cast had `focusMeter === 0`. */
  everFocusZero: boolean;
}

export function summarizeCastTrace(t: CastTrace): LossDecompositionRecord {
  const last = t.turns[t.turns.length - 1]!;
  return {
    docId: t.docId,
    reason: terminalReason(t),
    turns: t.turns.length - 1,
    finalMana: last.mana,
    finalFocus: last.focusMeter,
    everFocusZero: t.turns.some((turn) => turn.focusMeter === 0),
  };
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export interface LossDecompositionReasonRollup {
  count: number;
  pct: number;
  meanFinalFocus: number;
  meanFinalMana: number;
  meanTurns: number;
}

export interface LossDecompositionRollup {
  total: number;
  byReason: Record<TerminalReason, LossDecompositionReasonRollup>;
  /** Casts that ever reached `focusMeter === 0`, out of `total`. */
  everFocusZero: number;
}

export function summarizeLossDecompositionRollup(records: LossDecompositionRecord[]): LossDecompositionRollup {
  const byReason = {} as Record<TerminalReason, LossDecompositionReasonRollup>;
  for (const reason of TERMINAL_REASONS) {
    const rs = records.filter((r) => r.reason === reason);
    byReason[reason] = {
      count: rs.length,
      pct: records.length > 0 ? (rs.length / records.length) * 100 : 0,
      meanFinalFocus: mean(rs.map((r) => r.finalFocus)),
      meanFinalMana: mean(rs.map((r) => r.finalMana)),
      meanTurns: mean(rs.map((r) => r.turns)),
    };
  }
  return {
    total: records.length,
    byReason,
    everFocusZero: records.filter((r) => r.everFocusZero).length,
  };
}

export interface LossDecompositionMarkdownOptions {
  generatedAt?: string;
}

/** Renders the committed `handoff/reports/fishing-loss-decomposition.md` from a set of records. Deterministic given the same input. */
export function buildLossDecompositionMarkdown(records: LossDecompositionRecord[], opts: LossDecompositionMarkdownOptions = {}): string {
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const rollup = summarizeLossDecompositionRollup(records);
  const lines: string[] = [];

  lines.push("# Fishing loss decomposition");
  lines.push("");
  lines.push(
    `Regenerated from \`data/run-reports/fishing-loss-decomposition.jsonl\` by \`scripts/lossDecompositionReport.ts\` — do not hand-edit. Last generated ${generatedAt}.`,
  );
  lines.push("");
  lines.push(
    `${rollup.total} clean cast${rollup.total === 1 ? "" : "s"} (\`loadCastTraces()\` + \`isCleanTrace\`) over the full fixture corpus. Terminal reason, in order:`,
  );
  lines.push("");
  lines.push("| terminal reason | n | % | mean final focus | mean final mana | mean turns |");
  lines.push("|---|---|---|---|---|---|");
  for (const reason of TERMINAL_REASONS) {
    const r = rollup.byReason[reason];
    if (r.count === 0) continue;
    lines.push(
      `| ${reason} | ${r.count}/${rollup.total} | ${r.pct.toFixed(1)}% | ${r.meanFinalFocus.toFixed(2)} | ${r.meanFinalMana.toFixed(2)} | ${r.meanTurns.toFixed(1)} |`,
    );
  }
  lines.push("");
  lines.push(
    `Casts that ever reached \`focusMeter 0\`: ${rollup.everFocusZero}/${rollup.total}` +
      (rollup.total > 0 ? ` (${((rollup.everFocusZero / rollup.total) * 100).toFixed(1)}%)` : "") +
      ".",
  );
  lines.push("");
  lines.push(
    "See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, " +
      "and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.",
  );
  lines.push("");

  return lines.join("\n");
}
