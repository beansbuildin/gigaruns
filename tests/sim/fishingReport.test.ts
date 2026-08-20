/**
 * tests/sim/fishingReport.test.ts — [session 30] run-visibility reporting,
 * fishing half.
 */

import { describe, expect, it } from "vitest";

import type { FishingCast } from "../../src/sim/fishingCorpus.js";
import { buildFishingMarkdown, summarizeFishingCast, summarizeFishingRollup } from "../../src/sim/fishingReport.js";

function cast(
  docId: string,
  opts: { caught: boolean; fishName?: string; rarity?: number; consumablesUsed?: number },
): FishingCast {
  // [session 61 §4b] The oil flag defaults to the non-oil arm here because
  // every cast in the real corpus IS non-oil (`consumablesUsed` 0 on all 94) —
  // an oil-era default would make these fixtures unrepresentative of anything
  // recorded. `consumablesUsed` is settable so a caller can build the oil arm.
  const consumablesUsed = opts.consumablesUsed ?? 0;
  return {
    docId,
    consumablesUsed,
    oilEra: consumablesUsed > 0,
    slotsUsed: [false, false, false],
    responses: [
      { file: "f1", kind: "start_run", completeCid: false, successCid: null, caughtFish: null },
      opts.caught
        ? {
            file: "f2",
            kind: "play_cards",
            completeCid: true,
            successCid: true,
            caughtFish: { gameItemId: 1, name: opts.fishName ?? "Zombo", rarity: opts.rarity ?? 2 },
          }
        : { file: "f2", kind: "play_cards", completeCid: true, successCid: false, caughtFish: null },
    ],
  };
}

describe("summarizeFishingCast", () => {
  it("reports caught with fish name and rarity", () => {
    const record = summarizeFishingCast(cast("1", { caught: true, fishName: "Zombo", rarity: 2 }));
    expect(record).toEqual({ docId: "1", caught: true, fishName: "Zombo", rarity: 2 });
  });

  it("reports escaped with no fish", () => {
    const record = summarizeFishingCast(cast("2", { caught: false }));
    expect(record).toEqual({ docId: "2", caught: false, fishName: null, rarity: null });
  });
});

describe("summarizeFishingRollup — mixed catches and misses", () => {
  it("computes the right catch rate and per-name totals", () => {
    const records = [
      summarizeFishingCast(cast("1", { caught: true, fishName: "Zombo" })),
      summarizeFishingCast(cast("2", { caught: false })),
      summarizeFishingCast(cast("3", { caught: true, fishName: "Zombo" })),
      summarizeFishingCast(cast("4", { caught: true, fishName: "Finley" })),
      summarizeFishingCast(cast("5", { caught: false })),
    ];
    const rollup = summarizeFishingRollup(records);
    expect(rollup.totalCasts).toBe(5);
    expect(rollup.caught).toBe(3);
    expect(rollup.catchRatePct).toBeCloseTo(60, 5);
    expect(rollup.totalByName).toEqual({ Zombo: 2, Finley: 1 });
  });

  it("handles zero casts without dividing by zero", () => {
    expect(summarizeFishingRollup([]).catchRatePct).toBe(0);
  });
});

describe("buildFishingMarkdown", () => {
  it("renders the rollup and per-cast rows", () => {
    const records = [summarizeFishingCast(cast("1", { caught: true, fishName: "Zombo", rarity: 2 })), summarizeFishingCast(cast("2", { caught: false }))];
    const markdown = buildFishingMarkdown(records, { generatedAt: "TEST" });
    expect(markdown).toContain("2 recorded casts — 1 caught (50.0%)");
    expect(markdown).toContain("- Zombo: 1");
    expect(markdown).toContain("| 1 | yes | Zombo (rarity 2) |");
    expect(markdown).toContain("| 2 | no | — |");
  });
});
