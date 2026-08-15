/**
 * tests/liveFishing.test.ts — pure helpers from scripts/liveFishing.ts,
 * against the real captured cast (fixtures/fishing-casts/cast.json) rather
 * than hand-built fixtures, same discipline as tests/fishing/matcher.test.ts.
 */

import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  appendTransition,
  buildFishingEnvelope,
  buildHand,
  cardsById,
  fishCell,
  loadTransitionLog,
  type TransitionRecord,
} from "../scripts/liveFishing.js";
import type { FishingGameDoc } from "../src/api/fishing.js";

const cast = JSON.parse(readFileSync("fixtures/fishing-casts/cast.json", "utf8")) as Array<{
  request: unknown;
  response: { data: { doc: FishingGameDoc } };
}>;

describe("cardsById / buildHand", () => {
  it("maps deckCardData by real card id, and resolves hand ids off it", () => {
    const doc0 = cast[0]!.response.data.doc;
    const byId = cardsById(doc0.data.deckCardData);
    expect(byId.get(79)).toMatchObject({ id: 79, manaCost: 1, hitZones: [2, 4, 6, 8] });

    const hand = buildHand(doc0);
    expect(hand.map((c) => c.id)).toEqual(doc0.data.hand); // [79, 7, 2] on the real capture
  });

  it("throws rather than silently dropping a hand card missing from deckCardData", () => {
    const doc0 = cast[0]!.response.data.doc;
    const broken: FishingGameDoc = { ...doc0, data: { ...doc0.data, hand: [999999] } };
    expect(() => buildHand(broken)).toThrow(/999999/);
  });
});

describe("fishCell", () => {
  it("reads the real cast's fishPosition sequence exactly", () => {
    const cells = cast.map((e) => fishCell(e.response.data.doc));
    // fixtures/fishing-casts/cast.json: [4,2] -> [4,3] -> [4,4] -> [3,4] -> [3,3] -> [4,3]
    expect(cells).toEqual([
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]);
  });
});

describe("buildFishingEnvelope", () => {
  it("reproduces the real cast's start_run request shape", () => {
    const body = buildFishingEnvelope("start_run", "", { nodeId: "5", tierId: 1 });
    expect(body).toEqual({
      action: "start_run",
      actionToken: "",
      data: { cards: [], nodeId: "5", focusPoint: [], itemId: 0, slotIndex: 0, tierId: 1 },
    });
  });

  it("reproduces the real cast's play_cards request shape", () => {
    const body = buildFishingEnvelope("play_cards", "1786764497517", { cards: [1], focusPoint: [2, 2] });
    expect(body).toEqual({
      action: "play_cards",
      actionToken: "1786764497517",
      data: { cards: [1], nodeId: "", focusPoint: [2, 2], itemId: 0, slotIndex: 0, tierId: 0 },
    });
  });
});

describe("data/fish-patterns.jsonl round-trip", () => {
  let dir: string;
  let path: string;

  it("appends and reloads transitions into emptyFallback's empirical map shape", () => {
    dir = mkdtempSync(join(tmpdir(), "gigaruns-fishpatterns-test-"));
    path = join(dir, "fish-patterns.jsonl");
    expect(existsSync(path)).toBe(false);

    expect(loadTransitionLog(path).size).toBe(0); // missing file -> empty map, not a throw

    const rec1: TransitionRecord = { ts: "t1", castId: "c1", turn: 0, from: [4, 2], to: [4, 3], gridSize: 4 };
    const rec2: TransitionRecord = { ts: "t2", castId: "c1", turn: 1, from: [4, 2], to: [4, 1], gridSize: 4 };
    appendTransition(rec1, path);
    appendTransition(rec2, path);

    const log = loadTransitionLog(path);
    expect(log.get("4,2")).toEqual([
      { x: 4, y: 3 },
      { x: 4, y: 1 },
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("skips malformed lines instead of throwing", () => {
    dir = mkdtempSync(join(tmpdir(), "gigaruns-fishpatterns-test-"));
    path = join(dir, "fish-patterns.jsonl");
    appendTransition({ ts: "t1", castId: "c1", turn: 0, from: [1, 1], to: [1, 2], gridSize: 4 }, path);
    appendFileSync(path, "not json\n"); // one broken line shouldn't lose the rest
    appendTransition({ ts: "t2", castId: "c1", turn: 1, from: [1, 1], to: [1, 3], gridSize: 4 }, path);

    const log = loadTransitionLog(path);
    expect(log.get("1,1")).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ]);
    rmSync(dir, { recursive: true, force: true });
  });
});
