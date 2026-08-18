/**
 * tests/mineFishPatterns.test.ts — session 29, CODEXREVIEW #5.
 *
 * `data/fish-patterns.jsonl` is gitignored real live-play data, not a
 * fixture, so these tests build records/casts by hand rather than reading
 * it — same discipline as the rest of this project's fixture-free unit
 * tests. The real bug this guards against (cast `12923189`: a resumed
 * process relabeling its true turn-3 move as a second "turn 0") is
 * reproduced faithfully in the last describe block below, using the exact
 * real timestamps/positions found in the real (gitignored) log.
 */

import { describe, expect, it } from "vitest";

import { groupByCast, testPrimitives, type Cast, type TransitionRecord } from "../scripts/mineFishPatterns.js";
import { buildPatternPool } from "../src/sim/fishing/patterns.js";

describe("groupByCast — duplicate/gap detection (CODEXREVIEW #5)", () => {
  it("flags no duplicates and no gaps for a clean, contiguous cast", () => {
    const records: TransitionRecord[] = [
      { ts: "t0", castId: "c1", turn: 0, from: [1, 1], to: [1, 2], gridSize: 4 },
      { ts: "t1", castId: "c1", turn: 1, from: [1, 2], to: [1, 3], gridSize: 4 },
      { ts: "t2", castId: "c1", turn: 2, from: [1, 3], to: [1, 4], gridSize: 4 },
    ];
    const [cast] = groupByCast(records);
    expect(cast!.duplicateTurns).toEqual([]);
    expect(cast!.hasGaps).toBe(false);
    expect(cast!.maxTurn).toBe(2);
  });

  it("flags a duplicate turn only when the two records DISAGREE on the resulting cell", () => {
    const agreeing: TransitionRecord[] = [
      { ts: "t0", castId: "c1", turn: 0, from: [1, 1], to: [1, 2], gridSize: 4 },
      { ts: "t0b", castId: "c1", turn: 0, from: [1, 1], to: [1, 2], gridSize: 4 }, // identical re-log, harmless
    ];
    expect(groupByCast(agreeing)[0]!.duplicateTurns).toEqual([]);

    const conflicting: TransitionRecord[] = [
      { ts: "t0", castId: "c1", turn: 0, from: [1, 1], to: [1, 2], gridSize: 4 },
      { ts: "t0b", castId: "c1", turn: 0, from: [1, 1], to: [2, 2], gridSize: 4 }, // disagrees — the real bug's shape
    ];
    expect(groupByCast(conflicting)[0]!.duplicateTurns).toEqual([0]);
  });

  it("flags a gap when a turn before maxTurn is missing", () => {
    const gapped: TransitionRecord[] = [
      { ts: "t0", castId: "c1", turn: 0, from: [1, 1], to: [1, 2], gridSize: 4 },
      // turn 1 missing
      { ts: "t2", castId: "c1", turn: 2, from: [1, 3], to: [1, 4], gridSize: 4 },
    ];
    const [cast] = groupByCast(gapped);
    expect(cast!.hasGaps).toBe(true);
    expect(cast!.maxTurn).toBe(2);
  });
});

describe("testPrimitives — rejects duplicate/gapped casts rather than silently patching around them", () => {
  const pool = buildPatternPool();
  const real = pool.find((p) => p.name === "bounce(1,0)")!;

  function cleanCastMatching(pattern: typeof real, castId: string): Cast {
    const start = { x: 1, y: 1 };
    const gridSize = 4;
    const maxTurn = 2;
    const trajectory = pattern.path(start, gridSize, maxTurn + 2);
    const byTurn = new Map<number, { x: number; y: number }>();
    for (let t = 0; t <= maxTurn; t++) byTurn.set(t, trajectory[t + 1]!);
    return { castId, gridSize, start, byTurn, maxTurn, duplicateTurns: [], hasGaps: false };
  }

  it("a clean cast can still be matched and counted as support (fix doesn't break normal matching)", () => {
    const casts = [cleanCastMatching(real, "clean1"), cleanCastMatching(real, "clean2"), cleanCastMatching(real, "clean3")];
    const { supports, excluded } = testPrimitives(casts);
    expect(excluded).toEqual([]);
    const match = supports.find((s) => s.pattern.name === real.name);
    expect(match?.matchingCasts.sort()).toEqual(["clean1", "clean2", "clean3"]);
  });

  it("excludes a cast with a conflicting duplicate turn from EVERY primitive's support, even one it would otherwise match", () => {
    const clean = cleanCastMatching(real, "clean1");
    const corrupted: Cast = { ...cleanCastMatching(real, "corrupted"), duplicateTurns: [0] };
    const { supports, excluded } = testPrimitives([clean, corrupted]);
    expect(excluded).toEqual([{ castId: "corrupted", reason: expect.stringContaining("duplicate/conflicting") }]);
    for (const s of supports) {
      expect(s.matchingCasts).not.toContain("corrupted");
    }
  });

  it("excludes a gapped cast rather than counting its non-gap turns as a full match", () => {
    const clean = cleanCastMatching(real, "clean1");
    const gapped: Cast = { ...cleanCastMatching(real, "gapped"), hasGaps: true };
    const { supports, excluded } = testPrimitives([clean, gapped]);
    expect(excluded).toEqual([{ castId: "gapped", reason: expect.stringContaining("gapped trajectory") }]);
    for (const s of supports) {
      expect(s.matchingCasts).not.toContain("gapped");
    }
  });
});

describe("the exact real-world 12923189 scenario (session 29, CODEXREVIEW #5)", () => {
  // Reproduced faithfully from the real (gitignored) data/fish-patterns.jsonl
  // as it looked before this session's fix: three real turns (0/1/2) from
  // one process, then a resumed process's `let turn = 0` bug relabeling the
  // real turn-3 move as a second turn 0 — landing at a DIFFERENT cell than
  // the genuine turn-0 record, since it's really the position 3 turns later.
  const buggyRecords: TransitionRecord[] = [
    { ts: "2026-08-15T20:32:48.588Z", castId: "12923189", turn: 0, from: [2, 4], to: [2, 3], gridSize: 4 },
    { ts: "2026-08-15T20:32:50.120Z", castId: "12923189", turn: 1, from: [2, 3], to: [1, 3], gridSize: 4 },
    { ts: "2026-08-15T20:32:51.528Z", castId: "12923189", turn: 2, from: [1, 3], to: [1, 4], gridSize: 4 },
    { ts: "2026-08-15T20:37:49.364Z", castId: "12923189", turn: 0, from: [1, 4], to: [2, 4], gridSize: 4 },
  ];

  it("groupByCast flags the collision as a conflicting duplicate at turn 0", () => {
    const [cast] = groupByCast(buggyRecords);
    expect(cast!.castId).toBe("12923189");
    expect(cast!.duplicateTurns).toEqual([0]);
  });

  it("testPrimitives excludes 12923189 entirely — it is never counted as support for any primitive", () => {
    const [corrupted] = groupByCast(buggyRecords);
    const { supports, excluded } = testPrimitives([corrupted!]);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]!.castId).toBe("12923189");
    for (const s of supports) {
      expect(s.matchingCasts).not.toContain("12923189");
    }
  });
});
