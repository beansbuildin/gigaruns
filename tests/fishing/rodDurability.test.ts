/**
 * [session 100 §A, QUESTIONS.md §52] The rod-durability preflight.
 *
 * The gate this pins is the FAIL-CLOSED one and only that one: a rod reading
 * `DURABILITY_CID: 0` must stop a batch before it spends a cast. There is
 * deliberately no test of a "casts remaining" prediction, because there is
 * deliberately no prediction — §52 forbids assuming a decrement rate, and the
 * repo holds one unpaired data point.
 *
 * **The rows below are transcribed from a real response**, the captured 200 on
 * `GET /api/gear/instances/{address}` in `fixtures/fishing-casts/fishing-cast.har`
 * (148 rows), plus the 2026-08-26 Shroom/Golkan reading recorded in
 * `src/sim/fishing/rodDeck.ts`. They are inline rather than read from the HAR
 * because `.gitignore` excludes `fixtures/**\/*.har` — the capture is
 * machine-local, so a test that read it would pass here and fail everywhere
 * else.
 */

import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readRodDurability,
  ROD_DURABILITY_WARN_AT,
  NOT_EQUIPPED_SLOT,
  type GearInstanceLike,
} from "../../src/strategy/fishing/rodDurability.js";
import { CURRENT_ROD, GOLKAN_ROD, SHROOM_ROD, MAKESHIFT_ROD } from "../../src/sim/fishing/rodDeck.js";
import {
  appendRodDurability,
  loadRodDurability,
  DEFAULT_ROD_DURABILITY_LOG_PATH,
  type RodDurabilityRecord,
} from "../../scripts/liveFishing.js";

/** Non-rod rows, verbatim shapes from the HAR. Present so the filter has something to reject. */
const BAG: GearInstanceLike[] = [
  { docId: "GearInstance#109_1752766722", GAME_ITEM_ID_CID: 109, DURABILITY_CID: 0, EQUIPPED_TO_SLOT_CID: 2 },
  { docId: "GearInstance#227_1786556848_d232b394", GAME_ITEM_ID_CID: 227, DURABILITY_CID: 0, EQUIPPED_TO_SLOT_CID: 6 },
  { docId: "GearInstance#633_1786755878_9b3403c7", GAME_ITEM_ID_CID: 633, DURABILITY_CID: 35, EQUIPPED_TO_SLOT_CID: 12 },
  { docId: "GearInstance#228_1771046815_a73cb236", GAME_ITEM_ID_CID: 228, DURABILITY_CID: 0, EQUIPPED_TO_SLOT_CID: NOT_EQUIPPED_SLOT },
];

const rod = (id: number, durability: number, slot = 14): GearInstanceLike => ({
  docId: `GearInstance#${id}_1786726698_3b8fde91`,
  GAME_ITEM_ID_CID: id,
  DURABILITY_CID: durability,
  EQUIPPED_TO_SLOT_CID: slot,
});

describe("rod durability preflight — the fail-closed gate", () => {
  it("passes the healthy Golkan reading recorded on 2026-08-26 (40, slot 14)", () => {
    const r = readRodDurability([...BAG, rod(GOLKAN_ROD, 40)]);
    expect(r.status).toBe("ok");
    expect(r.stop).toBe(false);
    expect(r.durability).toBe(40);
    expect(r.rodItemId).toBe(GOLKAN_ROD);
    expect(r.slot).toBe(14);
  });

  it("HALTS on a rod that has run dry — the Shroom (811) reading, DURABILITY_CID 0", () => {
    // The exact state QUESTIONS.md §29 took three sessions to diagnose backwards.
    const r = readRodDurability([...BAG, rod(CURRENT_ROD, 0)]);
    expect(r.stop).toBe(true);
    expect(r.status).toBe("halt");
    expect(r.durability).toBe(0);
    expect(r.detail).toMatch(/RUN DRY/);
    // The halt must say WHY it matters, not just that it fired: a dry rod means
    // the server deals BASE_DECK and the simulator is describing a different rod.
    expect(r.detail).toMatch(/BASE_DECK/);
  });

  it("HALTS on negative durability too — the floor is `<= 0`, not `=== 0`", () => {
    expect(readRodDurability([...BAG, rod(CURRENT_ROD, -1)]).stop).toBe(true);
  });

  it("HALTS when the rod `REAL_DECK` describes is not equipped at all", () => {
    // Shroom sat at slot -1 after the swap. A rod in the bag is not a rod in use.
    const r = readRodDurability([...BAG, rod(CURRENT_ROD, 40, NOT_EQUIPPED_SLOT)]);
    expect(r.stop).toBe(true);
    expect(r.durability).toBeNull();
    expect(r.detail).toMatch(/NOT equipped/);
  });

  it("HALTS when a DIFFERENT rod is equipped — the deck-vs-rod mismatch, named", () => {
    // This is sessions 89-91's actual failure mode caught forward: the rod in
    // play stops being the rod the simulator models. `CURRENT_ROD` is Golkan,
    // so an equipped Makeshift/Shroom must stop the batch.
    for (const other of [MAKESHIFT_ROD, SHROOM_ROD]) {
      if (other === CURRENT_ROD) continue;
      const r = readRodDurability([...BAG, rod(other, 44)]);
      expect(r.stop).toBe(true);
      expect(r.detail).toContain(String(other));
    }
  });

  it("HALTS on an empty response — a read that saw nothing is not a healthy rod", () => {
    const r = readRodDurability([]);
    expect(r.stop).toBe(true);
    expect(r.durability).toBeNull();
  });

  it("HALTS on an ambiguous read — two equipped instances of the same rod", () => {
    const dup = { ...rod(CURRENT_ROD, 12), docId: "GearInstance#812_other_5ce16e63" };
    const r = readRodDurability([...BAG, rod(CURRENT_ROD, 40), dup]);
    expect(r.stop).toBe(true);
    expect(r.detail).toMatch(/ambiguous/i);
  });

  it("WARNS but does not stop at or below the warn line, and claims nothing about casts remaining", () => {
    const r = readRodDurability([...BAG, rod(CURRENT_ROD, ROD_DURABILITY_WARN_AT)]);
    expect(r.status).toBe("low");
    expect(r.stop).toBe(false);
    expect(r.durability).toBe(ROD_DURABILITY_WARN_AT);
    // §52: no rate exists, so no headroom claim may be made. Pin the absence.
    expect(r.detail).toMatch(/NOT a claim about casts remaining/);
    expect(r.detail).not.toMatch(/\d+ casts? (remaining|left)/);
    // one above the line is plain ok
    expect(readRodDurability([...BAG, rod(CURRENT_ROD, ROD_DURABILITY_WARN_AT + 1)]).status).toBe("ok");
  });

  it("checks the rod by ITEM ID, not by slot number — slot is recorded, never keyed on", () => {
    // Same rod, unexpected slot: still found, still read. If this ever starts
    // failing because slot 14 got hardcoded somewhere, that is the regression.
    const r = readRodDurability([...BAG, rod(CURRENT_ROD, 40, 9)]);
    expect(r.status).toBe("ok");
    expect(r.slot).toBe(9);
  });
});

describe("the paired durability ledger", () => {
  it("round-trips a before/after pair, from which a decrement rate becomes derivable", () => {
    // CLAUDE.md working style: an isolated temp path, never the real data path.
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-roddur-"));
    const path = join(dir, "rodDurability.jsonl");
    try {
      const base: Omit<RodDurabilityRecord, "phase" | "castsSoFar" | "durability"> = {
        at: "2026-08-26T18:00:00.000Z",
        batchId: "2026-08-26T18:00:00.000Z",
        dryRun: false,
        rodItemId: GOLKAN_ROD,
        docId: "GearInstance#812_1786726698_3b8fde91",
        status: "ok",
      };
      appendRodDurability({ ...base, phase: "before", castsSoFar: 0, durability: 40 }, path);
      appendRodDurability({ ...base, phase: "after", castsSoFar: 20, durability: 20 }, path);

      const rows = loadRodDurability(path);
      expect(rows).toHaveLength(2);
      const before = rows.find((r) => r.phase === "before")!;
      const after = rows.find((r) => r.phase === "after")!;
      expect(before.batchId).toBe(after.batchId);
      // The measurement the pair exists for. NOT asserted as a real rate —
      // these are invented numbers proving the ARITHMETIC is reachable from a
      // pair, which is the whole point of recording `castsSoFar`.
      const casts = after.castsSoFar - before.castsSoFar;
      expect((before.durability! - after.durability!) / casts).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // ── [session 121] THE DENOMINATOR BUG, pinned against the REAL corpus ─────
  //
  // The pair above proves the arithmetic is *reachable*. It does not prove the
  // arithmetic is *right*, and for three sessions it was not: `before` rows are
  // written with a hard-coded `castsSoFar: 0` while `after` rows carry
  // `guards.runCount`, the guard's DAY-CUMULATIVE CHARGED total loaded from the
  // persisted budget file. The difference is therefore the DAY's charged count,
  // not the batch's play, and the two coincide only on a day's FIRST batch.
  //
  // This is CLAUDE.md rule 11's own lesson landing on a different field: the
  // round-trip test above passed the entire time, on invented numbers chosen so
  // that 20 casts and a 20-point drop gave a tidy 1. A green test proves the code
  // computes what the test says, never that the test says the right thing.
  describe("the denominator — why a fit must use `batchCastsPlayed`", () => {
    it("reproduces the real 2026-09-03 pair whose implied rate is 10x too low", () => {
      const dir = mkdtempSync(join(tmpdir(), "gigaruns-roddur-"));
      const path = join(dir, "rodDurability.jsonl");
      try {
        // Verbatim shape of `data/rodDurability.jsonl`'s last real pair, session
        // 118's closing 2-cast batch. Durability 50 -> 48 over TWO casts played,
        // while `castsSoFar` went 0 -> 20 because 20 was the day's charged total.
        const base = {
          at: "2026-09-03T02:12:55.000Z",
          batchId: "2026-09-03T02:12:55.000Z",
          dryRun: false,
          rodItemId: GOLKAN_ROD,
          docId: "GearInstance#812_1787690500_766077e9",
          status: "ok",
        };
        appendRodDurability({ ...base, phase: "before", castsSoFar: 0, batchCastsPlayed: 0, durability: 50 }, path);
        appendRodDurability({ ...base, phase: "after", castsSoFar: 20, batchCastsPlayed: 2, durability: 48 }, path);

        const rows = loadRodDurability(path);
        const before = rows.find((r) => r.phase === "before")!;
        const after = rows.find((r) => r.phase === "after")!;
        const drop = before.durability! - after.durability!;

        // The OLD denominator. Pinned as WRONG on purpose — if someone
        // "simplifies" the fit back onto `castsSoFar`, this is the number they
        // would silently start reporting.
        expect(drop / (after.castsSoFar - before.castsSoFar)).toBeCloseTo(0.1, 6);
        // The right one, off the same rows.
        expect(drop / after.batchCastsPlayed!).toBe(1);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("`before` rows carry a zero `batchCastsPlayed` — nothing was played yet", () => {
      const dir = mkdtempSync(join(tmpdir(), "gigaruns-roddur-"));
      const path = join(dir, "rodDurability.jsonl");
      try {
        appendRodDurability(
          { at: "x", phase: "before", batchId: "b", castsSoFar: 0, batchCastsPlayed: 0, dryRun: false, rodItemId: GOLKAN_ROD, docId: "d", durability: 40, status: "ok" },
          path,
        );
        expect(loadRodDurability(path)[0]!.batchCastsPlayed).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("stays optional, so the 47 rows written before session 121 still load", () => {
      const dir = mkdtempSync(join(tmpdir(), "gigaruns-roddur-"));
      const path = join(dir, "rodDurability.jsonl");
      try {
        // A pre-session-121 row, verbatim: no `batchCastsPlayed` key at all.
        appendFileSync(
          path,
          `${JSON.stringify({ at: "2026-08-26T18:00:00.000Z", phase: "after", batchId: "b", castsSoFar: 20, dryRun: false, rodItemId: GOLKAN_ROD, docId: "d", durability: 20, status: "ok" })}\n`,
          "utf8",
        );
        const rows = loadRodDurability(path);
        expect(rows).toHaveLength(1);
        // `undefined`, not 0 — an absent measurement must not read as "played
        // nothing", which would make an old row look like a division by zero
        // rather than like a row that cannot be fitted.
        expect(rows[0]!.batchCastsPlayed).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  it("survives a corrupt line rather than losing the log", () => {
    const dir = mkdtempSync(join(tmpdir(), "gigaruns-roddur-"));
    const path = join(dir, "rodDurability.jsonl");
    try {
      appendRodDurability(
        { at: "x", phase: "before", batchId: "b", castsSoFar: 0, dryRun: false, rodItemId: GOLKAN_ROD, docId: "d", durability: 40, status: "ok" },
        path,
      );
      appendFileSync(path, "{not json\n", "utf8");
      expect(loadRodDurability(path)).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("defaults to a real data path that no test may write to", () => {
    expect(DEFAULT_ROD_DURABILITY_LOG_PATH).toBe(join("data", "rodDurability.jsonl"));
  });

  it("reads an absent log as empty, not as a throw", () => {
    expect(loadRodDurability(join(tmpdir(), "gigaruns-nonexistent-roddur.jsonl"))).toEqual([]);
  });
});
