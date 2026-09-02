/**
 * tests/sim/lossDecompositionReport.test.ts — [session 117, OFFLINE]
 *
 * `terminalReason`'s classification itself is not new — it is
 * `scripts/lossDecomposition.ts` (session 48) unchanged, moved here so the
 * persisted report (`scripts/lossDecompositionReport.ts`) can share it. This
 * file pins that classification (all four terminal reasons, including the
 * fish-full-before-mana-out check order) plus the new
 * `summarizeCastTrace`/markdown layer session 117 added around it.
 */

import { describe, expect, it } from "vitest";

import type { CastTrace, CastTurn } from "../../src/sim/fishing/castTrace.js";
import {
  buildLossDecompositionMarkdown,
  summarizeCastTrace,
  summarizeLossDecompositionRollup,
  terminalReason,
  type LossDecompositionRecord,
} from "../../src/sim/fishing/lossDecompositionReport.js";

/** Minimal valid `CastTurn` — every field a real turn carries, only the ones a test names are varied. */
function turn(index: number, opts: Partial<CastTurn> = {}): CastTurn {
  return {
    file: `state-${String(index).padStart(3, "0")}.json`,
    index,
    fishPosition: { x: 0, y: 0 },
    previousFishPosition: { x: 0, y: 0 },
    lastMovePath: null,
    nextMovePath: null,
    nextPosition: null,
    fishHp: 5,
    fishMaxHp: 10,
    mana: 5,
    manaMax: 10,
    focusPoint: { x: 0, y: 0 },
    focusMeter: 1,
    focusMeterMax: 3,
    consumablesUsed: 0,
    gridSize: 4,
    hand: [],
    fullDeck: [],
    nextCardIndex: 0,
    discard: [],
    play: index === 0 ? null : { handIndex: 0, hit: true, fishHpDiff: -1 },
    newHand: null,
    fishDied: false,
    fishEscaped: false,
    ...opts,
  };
}

/** Minimal valid `CastTrace` — a real cast's `caught`/`escaped` flags, backed by whatever `turns` a test builds. */
function trace(docId: string, turns: CastTurn[], opts: Partial<CastTrace> = {}): CastTrace {
  return {
    docId,
    cards: new Map(),
    turns,
    caught: false,
    escaped: false,
    hasStart: true,
    continuous: true,
    consumablesUsedMax: 0,
    ...opts,
  };
}

describe("terminalReason", () => {
  it("is caught when the trace's own `caught` flag is set, regardless of the final turn's numbers", () => {
    const t = trace("1", [turn(0), turn(1, { fishHp: 9, fishMaxHp: 10, mana: 3 })], { caught: true });
    expect(terminalReason(t)).toBe("caught");
  });

  it("is 'escaped (fish at full HP)' when the final turn's fishHp reaches fishMaxHp", () => {
    const t = trace("2", [turn(0), turn(1, { fishHp: 12, fishMaxHp: 12, mana: 4 })]);
    expect(terminalReason(t)).toBe("escaped (fish at full HP)");
  });

  it("is 'mana out' when mana hits 0 and the fish is NOT at full HP", () => {
    const t = trace("3", [turn(0), turn(1, { fishHp: 6, fishMaxHp: 10, mana: 0 })]);
    expect(terminalReason(t)).toBe("mana out");
  });

  it("checks fish-full BEFORE mana-out — a cast that hits both at once is 'escaped (fish at full HP)', not 'mana out'", () => {
    const t = trace("4", [turn(0), turn(1, { fishHp: 10, fishMaxHp: 10, mana: 0 })]);
    expect(terminalReason(t)).toBe("escaped (fish at full HP)");
  });

  it("is 'truncated / unresolved' when neither condition holds — fixture capture stopped mid-cast", () => {
    const t = trace("5", [turn(0), turn(1, { fishHp: 6, fishMaxHp: 10, mana: 4 })]);
    expect(terminalReason(t)).toBe("truncated / unresolved");
  });
});

describe("summarizeCastTrace", () => {
  it("reports turns as turns.length - 1 (excludes the start_run state)", () => {
    const t = trace("6", [turn(0), turn(1), turn(2, { fishHp: 10, fishMaxHp: 10, mana: 8, focusMeter: 2 })]);
    const r = summarizeCastTrace(t);
    expect(r).toEqual<LossDecompositionRecord>({
      docId: "6",
      reason: "escaped (fish at full HP)",
      turns: 2,
      finalMana: 8,
      finalFocus: 2,
      everFocusZero: false,
    });
  });

  it("sets everFocusZero true when ANY recorded turn hit focusMeter 0, not just the final one", () => {
    const t = trace("7", [turn(0, { focusMeter: 0 }), turn(1, { focusMeter: 2, fishHp: 8, fishMaxHp: 10, mana: 6 })]);
    expect(summarizeCastTrace(t).everFocusZero).toBe(true);
  });
});

describe("summarizeLossDecompositionRollup", () => {
  it("counts, percentages and per-reason means match a hand-checked mixed set", () => {
    const records: LossDecompositionRecord[] = [
      { docId: "a", reason: "caught", turns: 2, finalMana: 8, finalFocus: 1, everFocusZero: false },
      { docId: "b", reason: "caught", turns: 4, finalMana: 6, finalFocus: 0, everFocusZero: true },
      { docId: "c", reason: "escaped (fish at full HP)", turns: 5, finalMana: 5, finalFocus: 0, everFocusZero: false },
      { docId: "d", reason: "mana out", turns: 10, finalMana: 0, finalFocus: 0, everFocusZero: true },
    ];
    const rollup = summarizeLossDecompositionRollup(records);
    expect(rollup.total).toBe(4);
    expect(rollup.byReason.caught).toEqual({ count: 2, pct: 50, meanFinalFocus: 0.5, meanFinalMana: 7, meanTurns: 3 });
    expect(rollup.byReason["escaped (fish at full HP)"]).toEqual({ count: 1, pct: 25, meanFinalFocus: 0, meanFinalMana: 5, meanTurns: 5 });
    expect(rollup.byReason["mana out"]).toEqual({ count: 1, pct: 25, meanFinalFocus: 0, meanFinalMana: 0, meanTurns: 10 });
    expect(rollup.byReason["truncated / unresolved"]).toEqual({ count: 0, pct: 0, meanFinalFocus: 0, meanFinalMana: 0, meanTurns: 0 });
    expect(rollup.everFocusZero).toBe(2);
  });

  it("returns all-zero rollups without dividing by zero on an empty set", () => {
    const rollup = summarizeLossDecompositionRollup([]);
    expect(rollup.total).toBe(0);
    expect(rollup.everFocusZero).toBe(0);
    for (const reason of Object.keys(rollup.byReason) as (keyof typeof rollup.byReason)[]) {
      expect(rollup.byReason[reason]).toEqual({ count: 0, pct: 0, meanFinalFocus: 0, meanFinalMana: 0, meanTurns: 0 });
    }
  });
});

describe("buildLossDecompositionMarkdown", () => {
  it("renders a deterministic markdown table given a fixed generatedAt", () => {
    const records: LossDecompositionRecord[] = [
      { docId: "a", reason: "caught", turns: 2, finalMana: 8, finalFocus: 1, everFocusZero: false },
      { docId: "b", reason: "escaped (fish at full HP)", turns: 5, finalMana: 5, finalFocus: 0, everFocusZero: false },
    ];
    const md = buildLossDecompositionMarkdown(records, { generatedAt: "2026-09-02T00:00:00.000Z" });
    expect(md).toContain("# Fishing loss decomposition");
    expect(md).toContain("Last generated 2026-09-02T00:00:00.000Z");
    expect(md).toContain("2 clean casts");
    expect(md).toContain("| caught | 1/2 | 50.0% | 1.00 | 8.00 | 2.0 |");
    expect(md).toContain("| escaped (fish at full HP) | 1/2 | 50.0% | 0.00 | 5.00 | 5.0 |");
    expect(md).not.toContain("| mana out |");
    expect(md).not.toContain("| truncated / unresolved |");
    expect(md).toContain("Casts that ever reached `focusMeter 0`: 0/2 (0.0%).");
  });

  it("handles zero records without a NaN percentage", () => {
    const md = buildLossDecompositionMarkdown([], { generatedAt: "2026-09-02T00:00:00.000Z" });
    expect(md).toContain("0 clean casts");
    expect(md).toContain("Casts that ever reached `focusMeter 0`: 0/0.");
    expect(md).not.toContain("NaN");
  });
});
