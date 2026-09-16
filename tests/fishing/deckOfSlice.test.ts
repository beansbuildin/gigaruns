import { describe, expect, it } from "vitest";
import { deckOf } from "../../scripts/redrawDeckSlice.js";
import type { CastTrace } from "../../src/sim/fishing/castTrace.js";
import { ROD_CARD_GRANTS, SHROOM_ROD, GOLKAN_ROD } from "../../src/sim/fishing/rodDeck.js";

const traceOf = (ids: readonly number[]) =>
  ({ cards: new Map(ids.map((id) => [id, {}])) }) as unknown as CastTrace;

// [session 133] Session 132 found the "golkan" slice pooled Shroom (811) casts
// with Golkan (812), because card 74 is in BOTH grants. These pin the split.
describe("deckOf — Shroom is not Golkan", () => {
  it("card 74 is shared by the two grants (the cause)", () => {
    expect(ROD_CARD_GRANTS[SHROOM_ROD]).toContain(74);
    expect(ROD_CARD_GRANTS[GOLKAN_ROD]).toContain(74);
  });

  it("a full Shroom grant is shroom, not golkan", () => {
    expect(deckOf(traceOf(ROD_CARD_GRANTS[SHROOM_ROD]!))).toBe("shroom");
  });

  it("a full Golkan grant is golkan", () => {
    expect(deckOf(traceOf(ROD_CARD_GRANTS[GOLKAN_ROD]!))).toBe("golkan");
  });

  it("card 74 alone does not make a deck golkan", () => {
    expect(deckOf(traceOf([74]))).toBe("shroom");
  });

  it("a low-id deck with no Shroom-only card stays unknown", () => {
    expect(deckOf(traceOf([1, 2, 3, 76]))).toBe("unknown");
  });
});
