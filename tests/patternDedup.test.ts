/**
 * [session 53, brief §4] De-aliasing the primitive pool.
 *
 * The defect: `bounce(2,0)` and `bounce(-2,0)` are the SAME MAP on a 4-wide
 * grid (a ±2 step reflects immediately), so a library holding both gave one
 * hypothesis 2/4 of the matcher's initial prior mass instead of 1/3.
 * `matcherPosterior.ts`'s π is computed from that mass and QUESTIONS.md §19's
 * decision rule reads π, so this had to be fixed before §19 could be judged.
 */
import { describe, it, expect } from "vitest";
import {
  buildPatternPool,
  buildRawPatternPool,
  dedupePatterns,
  patternAliases,
  behaviourSignature,
  resolvePatternsByName,
  GAME_GRID_SIZES,
} from "../src/sim/fishing/patterns.js";

describe("pattern de-aliasing", () => {
  it("collapses bounce(-2,0) onto bounce(2,0) — the pair session 52 found", () => {
    const aliases = patternAliases(buildRawPatternPool());
    expect(aliases).toContainEqual({ dropped: "bounce(-2,0)", sameAs: "bounce(2,0)" });
  });

  it("finds FOUR more aliases than the one pair that happened to get promoted", () => {
    // Session 52 saw only the pair that reached the promotion threshold. The
    // aliasing actually affects 5 of the 23 primitives: every ±2 diagonal is
    // the same map, and so is each ±2 axis pair.
    const aliases = patternAliases(buildRawPatternPool());
    expect(aliases.map((a) => a.dropped).sort()).toEqual(
      ["bounce(-2,-2)", "bounce(-2,0)", "bounce(-2,2)", "bounce(0,-2)", "bounce(2,-2)"].sort(),
    );
    expect(buildRawPatternPool()).toHaveLength(23);
    expect(buildPatternPool()).toHaveLength(18);
  });

  it("keeps the FIRST of each equivalence class, so surviving names stay stable", () => {
    const names = buildPatternPool().map((p) => p.name);
    expect(names).toContain("bounce(2,0)");
    expect(names).not.toContain("bounce(-2,0)");
    expect(names).toContain("perimeterWalk(cw)");
    expect(names).toContain("perimeterWalk(ccw)");
  });

  it("leaves genuinely distinct primitives alone — ±1 bounces are NOT aliases", () => {
    const names = buildPatternPool().map((p) => p.name);
    for (const n of ["bounce(1,0)", "bounce(-1,0)", "bounce(0,1)", "bounce(0,-1)"]) {
      expect(names).toContain(n);
    }
  });

  it("produces a pool with no two identical behaviour signatures", () => {
    const sigs = buildPatternPool().map((p) => behaviourSignature(p));
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it("is idempotent — deduping an already-deduped pool changes nothing", () => {
    const once = buildPatternPool();
    expect(dedupePatterns(once).map((p) => p.name)).toEqual(once.map((p) => p.name));
  });

  it("would NOT collapse these primitives on a larger grid — the dedup is grid-size-specific", () => {
    // The ±2 aliasing is a consequence of a 4-wide board. Stating it as a test
    // so that adding a bigger pond to GAME_GRID_SIZES visibly changes the pool
    // rather than silently keeping a decision that no longer holds.
    expect(GAME_GRID_SIZES).toEqual([4]);
    const onBigGrid = patternAliases(buildRawPatternPool(), [8]);
    expect(onBigGrid.map((a) => a.dropped)).not.toContain("bounce(-2,0)");
  });
});

describe("resolvePatternsByName", () => {
  it("maps a retired alias name onto its surviving twin", () => {
    const { patterns, unresolved } = resolvePatternsByName(["bounce(-2,0)"]);
    expect(unresolved).toEqual([]);
    expect(patterns.map((p) => p.name)).toEqual(["bounce(2,0)"]);
  });

  it("collapses a pre-dedup library from 4 names to 3 patterns — the live file's exact case", () => {
    const { patterns, unresolved } = resolvePatternsByName([
      "perimeterWalk(cw)",
      "perimeterWalk(ccw)",
      "bounce(2,0)",
      "bounce(-2,0)",
    ]);
    expect(unresolved).toEqual([]);
    expect(patterns.map((p) => p.name)).toEqual(["perimeterWalk(cw)", "perimeterWalk(ccw)", "bounce(2,0)"]);
  });

  it("reports a name matching nothing rather than silently dropping it", () => {
    const { patterns, unresolved } = resolvePatternsByName(["bounce(2,0)", "notAPattern"]);
    expect(patterns.map((p) => p.name)).toEqual(["bounce(2,0)"]);
    expect(unresolved).toEqual(["notAPattern"]);
  });
});
