/**
 * tests/sim/fishingReport.test.ts — [session 30] run-visibility reporting,
 * fishing half.
 */

import { describe, expect, it } from "vitest";

import type { FishingCast } from "../../src/sim/fishingCorpus.js";
import { buildFishingMarkdown, summarizeFishingCast, summarizeFishingRollup } from "../../src/sim/fishingReport.js";

/**
 * [session 64] The board scalars `FishingCorpusResponse` now carries. This
 * file's subject is REPORTING, not triggers, so the values are deliberately
 * inert — a mid-cast board that fires neither oil trigger. Anything
 * board-sensitive belongs in `tests/fishing/oilReachability.test.ts`.
 */
function board(updatedAt: string) {
  // [session 79] `deck: null` — this file tests the fishing REPORT's counts,
  // which read no draw-pile state.
  // [session 110] `gameItemBalanceChanges: []` is the default; a cast that
  // credits Hard Core overrides it on the specific response that credited.
  return {
    board: { fishHp: 8, fishMaxHp: 15, focusMeter: 2, focusMeterMax: 3 },
    deck: null,
    gameItemBalanceChanges: [],
    updatedAt,
  };
}

function cast(
  docId: string,
  opts: {
    caught: boolean;
    fishName?: string;
    rarity?: number;
    consumablesUsed?: number;
    /**
     * [session 110] Item-845 amount credited on the catch-resolving response.
     * Defaults to the rarity-2 base (320) measured live in session 15/16, so
     * every pre-existing case in this file keeps a realistic amount rather
     * than a made-up one.
     */
    hardCore?: number;
    /**
     * [session 110] Splits the credit across two responses. The corpus does
     * not do this — every caught cast credits 845 exactly once, 120/120 — but
     * `summarizeFishingCast` SUMS rather than reading one response, and a test
     * that only ever sees one entry cannot tell a sum from a lookup.
     */
    splitCredit?: boolean;
  },
): FishingCast {
  // [session 61 §4b] The oil flag defaults to the non-oil arm here because
  // every cast in the real corpus IS non-oil (`consumablesUsed` 0 on all 94) —
  // an oil-era default would make these fixtures unrepresentative of anything
  // recorded. `consumablesUsed` is settable so a caller can build the oil arm.
  const consumablesUsed = opts.consumablesUsed ?? 0;
  const total = opts.hardCore ?? 320;
  const half = Math.floor(total / 2);
  return {
    docId,
    consumablesUsed,
    oilEra: consumablesUsed > 0,
    slotsUsed: [false, false, false],
    responses: [
      {
        file: "f1",
        kind: "start_run",
        completeCid: false,
        successCid: null,
        caughtFish: null,
        ...board("2026-08-15T20:00:00.000Z"),
        ...(opts.caught && opts.splitCredit ? { gameItemBalanceChanges: credit(half) } : {}),
      },
      opts.caught
        ? {
            file: "f2",
            kind: "play_cards",
            completeCid: true,
            successCid: true,
            caughtFish: { gameItemId: 1, name: opts.fishName ?? "Zombo", rarity: opts.rarity ?? 2 },
            ...board("2026-08-15T20:00:01.000Z"),
            gameItemBalanceChanges: credit(opts.splitCredit ? total - half : total),
          }
        : {
            file: "f2",
            kind: "play_cards",
            completeCid: true,
            successCid: false,
            caughtFish: null,
            ...board("2026-08-15T20:00:01.000Z"),
          },
    ],
  };
}

/**
 * [session 110] The wire shape: a catch credits the FISH item and item 845 in
 * the same `gameItemBalanceChanges` array (e.g. `[{id:514,amount:1},
 * {id:845,amount:80}]`, `fixtures/fishing-casts/live/cast-2026-08-24-00-04-34/
 * state-004.json`). The non-845 entry is included so these fixtures exercise
 * the id FILTER, not just the sum — a `summarizeFishingCast` that added every
 * amount it saw would pass a 845-only fixture and fail this one.
 */
function credit(hardCore: number) {
  return [
    { id: 514, amount: 1, gearInstanceId: "", rarity: -1 },
    { id: 845, amount: hardCore, gearInstanceId: "", rarity: -1 },
  ];
}

describe("summarizeFishingCast", () => {
  it("reports caught with fish name and rarity", () => {
    const record = summarizeFishingCast(cast("1", { caught: true, fishName: "Zombo", rarity: 2 }));
    expect(record).toEqual({ docId: "1", caught: true, fishName: "Zombo", rarity: 2, hardCore: 320 });
  });

  it("reports escaped with no fish", () => {
    const record = summarizeFishingCast(cast("2", { caught: false }));
    expect(record).toEqual({ docId: "2", caught: false, fishName: null, rarity: null, hardCore: 0 });
  });
});

/**
 * ── [session 110] THE HARD CORE COLUMN ──────────────────────────────────────
 *
 * Fishing credits Hard Core (item 845) on every catch and has since the first
 * cast ever captured, but nothing in this repo read it until now — so the
 * whole point of these cases is that the number comes from data that already
 * existed. They pin the four things a re-implementation could get wrong: the
 * item filter, the zero for an uncaught cast, the SUM across responses, and
 * the report total agreeing with its own per-cast column.
 */
describe("summarizeFishingCast — Hard Core", () => {
  it("extracts the item-845 amount and ignores the fish item alongside it", () => {
    expect(summarizeFishingCast(cast("1", { caught: true, hardCore: 80 })).hardCore).toBe(80);
  });

  it("reports 0 for an escaped cast", () => {
    expect(summarizeFishingCast(cast("2", { caught: false })).hardCore).toBe(0);
  });

  it("sums across responses rather than reading the terminal one", () => {
    // 320 split 160/160 across the start_run and the catch response. A lookup
    // keyed on `completeCid` would report 160.
    expect(summarizeFishingCast(cast("3", { caught: true, hardCore: 320, splitCredit: true })).hardCore).toBe(320);
  });

  it("carries the measured rarity ladder through unchanged", () => {
    // The five base amounts, one per rarity, as measured over all 120 caught
    // casts in the corpus. Nothing in the code knows this ladder — the test
    // asserts the loader is a faithful passthrough of whatever the wire said.
    const ladder: [number, number][] = [
      [0, 80],
      [1, 160],
      [2, 320],
      [3, 400],
      [4, 480],
    ];
    for (const [rarity, amount] of ladder) {
      expect(summarizeFishingCast(cast(`r${rarity}`, { caught: true, rarity, hardCore: amount })).hardCore).toBe(amount);
    }
  });

  it("passes through a 2x/4x multiple without normalising it away", () => {
    // 12 of 120 caught casts paid an exact multiple of the rarity base with no
    // distinguishing field on the response — the largest being Zombo (rarity
    // 2, base 320) at 1280. Nothing may "correct" that back to the base.
    expect(summarizeFishingCast(cast("z", { caught: true, rarity: 2, hardCore: 1280 })).hardCore).toBe(1280);
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
    expect(summarizeFishingRollup([]).hardCorePerCatch).toBe(0);
  });

  it("totals Hard Core and averages it per CATCH, not per cast", () => {
    const records = [
      summarizeFishingCast(cast("1", { caught: true, hardCore: 80 })),
      summarizeFishingCast(cast("2", { caught: false })),
      summarizeFishingCast(cast("3", { caught: true, hardCore: 320 })),
      summarizeFishingCast(cast("4", { caught: false })),
    ];
    const rollup = summarizeFishingRollup(records);
    expect(rollup.totalHardCore).toBe(400);
    // 400/2 caught, NOT 400/4 casts — the two differ whenever anything escaped,
    // and the report prints both so neither can be quoted as the other.
    expect(rollup.hardCorePerCatch).toBe(200);
  });
});

describe("buildFishingMarkdown", () => {
  it("renders the rollup and per-cast rows", () => {
    const records = [summarizeFishingCast(cast("1", { caught: true, fishName: "Zombo", rarity: 2 })), summarizeFishingCast(cast("2", { caught: false }))];
    const markdown = buildFishingMarkdown(records, { generatedAt: "TEST" });
    expect(markdown).toContain("2 recorded casts — 1 caught (50.0%)");
    expect(markdown).toContain("- Zombo: 1");
    expect(markdown).toContain("| 1 | yes | Zombo (rarity 2) | 320 |");
    expect(markdown).toContain("| 2 | no | — | 0 |");
  });

  it("prints a Hard Core total that equals the sum of its own per-cast column", () => {
    const records = [
      summarizeFishingCast(cast("1", { caught: true, fishName: "Barnaboo", rarity: 0, hardCore: 80 })),
      summarizeFishingCast(cast("2", { caught: false })),
      summarizeFishingCast(cast("3", { caught: true, fishName: "Zombo", rarity: 2, hardCore: 1280 })),
    ];
    const markdown = buildFishingMarkdown(records, { generatedAt: "TEST" });

    // Re-read the rendered table rather than trusting the rollup twice: the
    // total and the column are produced by different code paths, and the
    // failure this guards against is exactly them disagreeing.
    const rows = markdown
      .split("\n")
      .filter((l) => /^\| \d+ \|/.test(l))
      .map((l) => Number(l.split("|").at(-2)!.trim()));
    expect(rows).toEqual([80, 0, 1280]);
    expect(markdown).toContain(`Total Hard Core earned: ${rows.reduce((a, b) => a + b, 0)} `);
    expect(markdown).toContain("Total Hard Core earned: 1360 (680.0 per catch, 453.3 per cast).");
  });
});
