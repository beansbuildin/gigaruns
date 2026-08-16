import { describe, expect, it } from "vitest";

import { shouldUsePotion } from "../src/strategy/potions.js";

describe("shouldUsePotion", () => {
  it("fires at or below the threshold", () => {
    expect(shouldUsePotion(16, 32, 1, 0.5)).toBe(true); // exactly 0.5
    expect(shouldUsePotion(15, 32, 1, 0.5)).toBe(true); // below
  });

  it("does not fire above the threshold", () => {
    expect(shouldUsePotion(17, 32, 1, 0.5)).toBe(false);
  });

  it("never fires with no potions remaining, regardless of HP", () => {
    expect(shouldUsePotion(1, 32, 0, 0.5)).toBe(false);
  });
});
