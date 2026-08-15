/**
 * tests/api/fishing.test.ts — Task 7 gate: the schemas in src/api/fishing.ts
 * must parse the redacted fixtures produced by scripts/parseHar.ts from the
 * one real Dendren cast this project has ever captured.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  FishingActionResponseSchema,
  FishingCardsSchema,
  FishingStateSchema,
  GameItemsSampleSchema,
} from "../../src/api/fishing.js";

const FIXTURES = "fixtures/fishing-casts";

describe("fishing schemas against the captured cast", () => {
  it("parses every fishing/action response in the cast", () => {
    const cast = JSON.parse(readFileSync(`${FIXTURES}/cast.json`, "utf8")) as Array<{ response: unknown }>;
    expect(cast.length).toBeGreaterThan(0);
    for (const call of cast) {
      const parsed = FishingActionResponseSchema.safeParse(call.response);
      expect(parsed.success, parsed.success ? "" : JSON.stringify((parsed as { error?: unknown }).error)).toBe(true);
    }
  });

  it("the cast ends COMPLETE_CID true, SUCCESS_CID false (an escape, not a catch)", () => {
    const cast = JSON.parse(readFileSync(`${FIXTURES}/cast.json`, "utf8")) as Array<{
      response: { data: { doc: { COMPLETE_CID: boolean; SUCCESS_CID: boolean } } };
    }>;
    const last = cast[cast.length - 1]!.response.data.doc;
    expect(last.COMPLETE_CID).toBe(true);
    expect(last.SUCCESS_CID).toBe(false);
  });

  it("parses fishing/cards", () => {
    const cards = JSON.parse(readFileSync(`${FIXTURES}/cards.json`, "utf8"));
    const parsed = FishingCardsSchema.safeParse(cards);
    expect(parsed.success, parsed.success ? "" : JSON.stringify((parsed as { error?: unknown }).error)).toBe(true);
  });

  it("parses fishing/state", () => {
    const state = JSON.parse(readFileSync(`${FIXTURES}/state.json`, "utf8"));
    const parsed = FishingStateSchema.safeParse(state);
    expect(parsed.success, parsed.success ? "" : JSON.stringify((parsed as { error?: unknown }).error)).toBe(true);
  });

  it("pondEntryTiers names pondId 2 as Dendren", () => {
    const state = JSON.parse(readFileSync(`${FIXTURES}/state.json`, "utf8")) as {
      pondEntryTiers: Array<{ name: string; pondId: number }>;
    };
    const dendren = state.pondEntryTiers.filter((t) => t.name.startsWith("dendrenpond"));
    expect(dendren.length).toBeGreaterThan(0);
    expect(dendren.every((t) => t.pondId === 2)).toBe(true);
  });

  it("parses the item-metadata sample and resolves the three heal potions", () => {
    const items = JSON.parse(readFileSync(`${FIXTURES}/item-metadata-sample.json`, "utf8"));
    const parsed = GameItemsSampleSchema.safeParse(items);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const byName = new Map(parsed.data.map((i) => [i.NAME_CID, i]));
    expect(byName.get("Lil Heal Juice")?.itemEffect?.effects[0]?.effects[0]?.amount).toBe(4);
    expect(byName.get("Mid Heal Juice")?.itemEffect?.effects[0]?.effects[0]?.amount).toBe(8);
    expect(byName.get("Big Heal Juice")?.itemEffect?.effects[0]?.effects[0]?.amount).toBe(20);
    expect(byName.get("Hard Core")).toBeDefined();
  });
});
