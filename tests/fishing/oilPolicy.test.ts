/**
 * tests/fishing/oilPolicy.test.ts — session 43 heuristic (c). Synthetic
 * throughout: no live oil-use outcome exists yet to check against (see
 * oilPolicy.ts's own header on `LOW_FISH_HP_FRACTION`'s "a handful, not
 * derived" status).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  aboveReserveFloor,
  LOW_FISH_HP_FRACTION,
  MAX_CONSUMABLE_SLOTS,
  mayConsumeOil,
  MID_FOCUS_OIL_ITEM_ID,
  MID_RELAXING_OIL_ITEM_ID,
  OIL_RESERVE_FLOOR,
  shouldConsiderRelaxingOil,
  type OilBudgetConfig,
  type OilSpendContext,
} from "../../src/strategy/fishing/oilPolicy.js";
import { evaluateZeroStreak, ZERO_STREAK_LIMIT } from "../../src/strategy/fishing/zeroStreak.js";
import { loadFishingCorpus } from "../../src/sim/fishingCorpus.js";

describe("item ids — resolved against fixtures/fishing-casts/item-metadata-sample.json, SPEC-fishing.md §4a", () => {
  it("are the real docIds, not placeholders", () => {
    expect(MID_FOCUS_OIL_ITEM_ID).toBe(942);
    expect(MID_RELAXING_OIL_ITEM_ID).toBe(937);
  });
});

describe("config constants", () => {
  it("LOW_FISH_HP_FRACTION is the user's stated ballpark (2/20 = 10%, the brief's own example), not tuned to a knife's edge", () => {
    expect(LOW_FISH_HP_FRACTION).toBe(0.15);
  });
});

describe("shouldConsiderRelaxingOil", () => {
  it("recommends spending at low fish HP fraction, with one held", () => {
    expect(shouldConsiderRelaxingOil(2, 20, 1)).toBe(true); // 10% <= 15%
  });

  it("does not recommend spending when fish HP fraction is comfortably above the threshold", () => {
    expect(shouldConsiderRelaxingOil(10, 20, 1)).toBe(false); // 50%
  });

  it("is exactly true at the threshold boundary — inclusive", () => {
    expect(shouldConsiderRelaxingOil(3, 20, 1)).toBe(true); // exactly 15%
  });

  it("is false just above the threshold boundary", () => {
    expect(shouldConsiderRelaxingOil(3.01, 20, 1)).toBe(false); // 15.05%
  });

  it("never recommends spending when none is held, however low the fish HP", () => {
    expect(shouldConsiderRelaxingOil(0, 20, 0)).toBe(false);
  });

  it("refuses on a degenerate zero fishMaxHp rather than dividing by zero", () => {
    expect(shouldConsiderRelaxingOil(0, 0, 1)).toBe(false);
  });
});

describe("aboveReserveFloor", () => {
  it("is false at exactly the reserve floor", () => {
    expect(aboveReserveFloor(OIL_RESERVE_FLOOR)).toBe(false);
  });

  it("is true one above the reserve floor", () => {
    expect(aboveReserveFloor(OIL_RESERVE_FLOOR + 1)).toBe(true);
  });

  it("is false at zero", () => {
    expect(aboveReserveFloor(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// [session 61 §4c] mayConsumeOil — the authorization gate.
//
// The brief's instruction was "do not copy `resolvePotionLoadout`'s bug": a
// resolver gating on `config.potions` alone while its caller gated on two
// conditions, with a comment claiming they matched. A comment cannot enforce
// that, so the correspondence is pinned here two ways — every condition is
// asserted to block independently, and the LIVE CALL SITE is read to check it
// passes each one rather than re-deriving any of them.
// ---------------------------------------------------------------------------

const APPROVED: OilBudgetConfig = { allowedItemIds: [MID_RELAXING_OIL_ITEM_ID, 942], maxPerCast: 3, policyApproved: true };

/** A context that is allowed, so each test can break exactly one thing. */
const ok = (over: Partial<OilSpendContext> = {}): OilSpendContext => ({
  configured: APPROVED,
  itemId: MID_RELAXING_OIL_ITEM_ID,
  heldBalance: 2,
  usedThisCast: 0,
  usedThisCastOfItem: 0,
  dryRun: false,
  spendFailedThisCast: false,
  ...over,
});

describe("mayConsumeOil — every condition blocks on its own", () => {
  it("allows the baseline case, so the negative tests below mean something", () => {
    const d = mayConsumeOil(ok());
    expect(d.allowed).toBe(true);
    expect(d.reason).toMatch(/within budget/);
  });

  it("REFUSES with no config block — silence is not authorization (the session-24 lesson)", () => {
    const d = mayConsumeOil(ok({ configured: undefined }));
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/silence is not authorization/);
  });

  it("REFUSES while policyApproved is false, which is the state shipped in config/bot.json", () => {
    const d = mayConsumeOil(ok({ configured: { ...APPROVED, policyApproved: false } }));
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/policyApproved/);
    // The reason a budget alone is not enough, stated in the message itself.
    expect(d.reason).toMatch(/budget is not authorising the timing/i);
  });

  it("REFUSES an item outside allowedItemIds however large the balance", () => {
    expect(mayConsumeOil(ok({ itemId: 821, heldBalance: 99 })).allowed).toBe(false);
  });

  it("REFUSES a zero balance — never invents a positive one", () => {
    expect(mayConsumeOil(ok({ heldBalance: 0 })).allowed).toBe(false);
  });

  it("REFUSES on a dry run: the decision stands, nothing is spent", () => {
    const d = mayConsumeOil(ok({ dryRun: true }));
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/dry run/);
  });

  it("REFUSES after a failed spend this cast rather than retrying an unconfirmed slotIndex", () => {
    expect(mayConsumeOil(ok({ spendFailedThisCast: true })).allowed).toBe(false);
  });

  it("stops AT the per-cast budget, and the 3-slot hard ceiling wins over a larger config", () => {
    expect(mayConsumeOil(ok({ configured: { ...APPROVED, maxPerCast: 2 }, usedThisCast: 1 })).allowed).toBe(true);
    expect(mayConsumeOil(ok({ configured: { ...APPROVED, maxPerCast: 2 }, usedThisCast: 2 })).allowed).toBe(false);
    // The board state exposes exactly 3 consumable slots (SPEC-fishing §4a), so
    // a config asking for more is clamped rather than honoured. Zod caps this
    // at 3 too; the clamp is the second line of defence, not the only one.
    expect(
      mayConsumeOil(ok({ configured: { ...APPROVED, maxPerCast: 99 }, usedThisCast: MAX_CONSUMABLE_SLOTS })).allowed,
    ).toBe(false);
  });

  it("names the REAL blocker when several conditions fail at once", () => {
    // No config AND no balance AND a dry run. The message must lead with the
    // config, because that is the one a reader can act on.
    const d = mayConsumeOil(ok({ configured: undefined, heldBalance: 0, dryRun: true }));
    expect(d.reason).toMatch(/dendren\.oils/);
  });
});

describe("the live call site passes every condition the gate checks", () => {
  // Pinned by READING the call site, not by re-deriving it. If someone adds a
  // condition to `mayConsumeOil` and forgets to pass it from `liveFishing.ts`,
  // TypeScript catches it (every field is required). This catches the reverse:
  // the call site quietly hard-coding a value instead of passing the real one,
  // which typechecks fine and is exactly how the potions resolver drifted.
  const src = readFileSync(join(process.cwd(), "scripts", "liveFishing.ts"), "utf8");
  const call = src.slice(src.indexOf("mayConsumeOil({"), src.indexOf("mayConsumeOil({") + 400);

  it("passes the config block through rather than assuming one", () => {
    expect(call).toMatch(/configured:\s*deps\.oilBudget/);
  });

  /**
   * ── [session 64] THE OUTER HOP, which nothing checked ────────────────────
   *
   * The assertion above passed for three sessions while no oil could be spent
   * at all. It pins `runOneCast` -> `mayConsumeOil`, and that hop was always
   * correct. The broken one was `main()` -> `runOneCast`: `oilBudget` is
   * OPTIONAL on `LiveFishingDeps`, `main()` never set it, and so the gate saw
   * `configured: undefined` on every live cast and refused with "no
   * `dendren.oils` block in config/bot.json" — while the block sat in
   * `config/bot.json` with `policyApproved: true`.
   *
   * A chain tested link-by-link is not tested unless every link is covered,
   * and an OPTIONAL dependency is exactly where the gap hides: omitting it
   * typechecks, and the field's doc comment describes omission as the
   * conservative choice, so the dead state reads as the safe one.
   *
   * This is why the test is on the source text. There is no type error to
   * catch and no return value to assert — the defect is an absent property in
   * an object literal, and absence is what has to be asserted against.
   */
  it("main() actually POPULATES deps.oilBudget from the loaded config", () => {
    const mainCall = src.slice(src.lastIndexOf("await runOneCast({"), src.length);
    const literal = mainCall.slice(0, mainCall.indexOf("});") + 3);
    expect(literal).toMatch(/oilBudget:\s*config\.dendren\?\.oils/);
    // and not neutralised back to nothing by a later edit
    expect(literal).not.toMatch(/oilBudget:\s*undefined/);
  });

  it("passes the REAL live balance, not a constant", () => {
    // [session 62 §1] `relaxingOilHeld` became `oilHeld[kind]` when `on-demand`
    // replaced heuristic (c): the loop now spends BOTH oils, so the balance is
    // per-kind. The point of the assertion is unchanged — it must be a live
    // reading, not a literal.
    expect(call).toMatch(/heldBalance:\s*held\b/);
    expect(call).not.toMatch(/heldBalance:\s*\d/);
  });

  it("passes the running per-cast count, so the budget can actually bind", () => {
    expect(call).toMatch(/usedThisCast:\s*oilsUsedThisCast/);
  });

  it("passes the loop's own dryRun and failure flags rather than literals", () => {
    expect(call).toMatch(/dryRun,/);
    expect(call).toMatch(/spendFailedThisCast:\s*oilUseFailedThisCast\[kind\]/);
    expect(call).not.toMatch(/dryRun:\s*false/);
    expect(call).not.toMatch(/policyApproved/); // the call site must not re-decide approval
  });

  it("the shipped config has policyApproved TRUE — the user approved the on-demand policy (session 62 §1)", () => {
    // **This assertion was INVERTED on 2026-08-20, and deliberately.** It read
    // `toBe(false)` from session 61, where the flag was the thing standing
    // between a derived recommendation and a live spend (CLAUDE.md rule 4).
    // The user has now seen `handoff/OIL-POLICY.md` and approved it, so FALSE
    // would no longer be the safe state — it would be a stale one that
    // silently disables a policy the account owner asked for.
    //
    // What the test still guards is the part that is NOT the user's to flip by
    // accident: that the gate is genuinely load-bearing, i.e. flipping the flag
    // back to false really does refuse every spend.
    const bot = JSON.parse(readFileSync(join(process.cwd(), "config", "bot.json"), "utf8")) as {
      dendren: { oils: OilBudgetConfig };
    };
    expect(bot.dendren.oils.policyApproved).toBe(true);
    // ---- [session 93 §1] RELAXING-ONLY, by user directive 2026-08-24 -------
    // This read `toContain(MID_FOCUS_OIL_ITEM_ID)` until this session. `942`
    // is now WITHDRAWN — not out of stock, withdrawn — so the assertion is
    // inverted for the same reason `policyApproved` was inverted above: the
    // old value is not the safe one, it is the stale one. See
    // `handoff/OIL-POLICY.md` §4 and `tests/fishing/oilFocusWithdrawn.test.ts`.
    expect(bot.dendren.oils.allowedItemIds).not.toContain(MID_FOCUS_OIL_ITEM_ID);
    expect(bot.dendren.oils.allowedItemIds).toContain(MID_RELAXING_OIL_ITEM_ID);
    // Approved and funded -> a RELAXING spend is allowed...
    expect(mayConsumeOil(ok({ configured: bot.dendren.oils })).allowed).toBe(true);
    // ...a FOCUS spend is refused on identity, whatever the balance says...
    const focus = mayConsumeOil(ok({ configured: bot.dendren.oils, itemId: MID_FOCUS_OIL_ITEM_ID, heldBalance: 99 }));
    expect(focus.allowed).toBe(false);
    expect(focus.reason).toMatch(/not in dendren\.oils\.allowedItemIds/);
    // ...and the approval flag is still the thing doing the work.
    expect(mayConsumeOil(ok({ configured: { ...bot.dendren.oils, policyApproved: false } })).allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// [session 61 §4e] The zero-streak tripwire, which SURVIVES the 60% drop and
// is now computed rather than remembered.
// ---------------------------------------------------------------------------

describe("the zero-catch tripwire — armed through the oil transition", () => {
  it("keeps the user's standing limit of 15 across the 60% target's removal", () => {
    expect(ZERO_STREAK_LIMIT).toBe(15);
  });

  it("counts backwards from the most recent cast and resets on a catch", () => {
    expect(evaluateZeroStreak([false, false, true, false, false]).streak).toBe(2);
    expect(evaluateZeroStreak([true]).streak).toBe(0);
    expect(evaluateZeroStreak([]).streak).toBe(0);
  });

  it("trips AT the limit, not one past it", () => {
    const at = evaluateZeroStreak(Array(ZERO_STREAK_LIMIT).fill(false));
    expect(at.tripped).toBe(true);
    expect(at.castsRemaining).toBe(0);
    const below = evaluateZeroStreak(Array(ZERO_STREAK_LIMIT - 1).fill(false));
    expect(below.tripped).toBe(false);
    expect(below.castsRemaining).toBe(1);
  });

  it("does NOT reset because the spending policy changed — the point of spanning the oil boundary", () => {
    // Eight pre-oil misses then seven oil-era misses is a streak of fifteen.
    // A per-arm streak would read 7 and stay silent through exactly the
    // transition the tripwire exists to cover.
    expect(evaluateZeroStreak(Array(15).fill(false)).tripped).toBe(true);
  });

  it("the REAL corpus is well below the limit, and the streak is computed rather than quoted", () => {
    // Terminal outcomes only: an incomplete cast is a process that died, not
    // evidence about the fishery, and counting it as a miss would inflate the
    // streak toward a false trip.
    const outcomes = loadFishingCorpus()
      .map((c) => c.responses.find((r) => r.completeCid))
      .filter((t): t is NonNullable<typeof t> => t !== undefined)
      .map((t) => t.successCid === true);
    const v = evaluateZeroStreak(outcomes);
    expect(v.tripped).toBe(false);
    expect(v.streak).toBeLessThan(ZERO_STREAK_LIMIT);
    // Pinned as an inequality, not a literal: the streak moves on every cast,
    // and a literal here teaches the next reader to edit the number.
    expect(v.castsRemaining).toBeGreaterThan(0);
  });
});
