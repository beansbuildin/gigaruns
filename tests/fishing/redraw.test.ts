/**
 * tests/fishing/redraw.test.ts — [session 70 §1]
 *
 * **The redraw action is CONFIRMED and it is DELIBERATELY OFF.** Both halves
 * need pinning, and they fail in opposite directions.
 *
 * ## The action
 *
 * User-captured 2026-08-21 from a manual browser cast: redraw is `play_cards`
 * with `cards: []`, the same six-field envelope, `focusPoint` still supplied.
 * No fifth action and no new endpoint — which is why SPEC-fishing §7 called it
 * "genuinely uncaptured" for so long, since the distinguishing signal was never
 * in the `action` string.
 *
 * ## The danger, which is why the intent guard is the deliverable
 *
 * **A redraw is indistinguishable on the wire from a play that failed to choose
 * a card**, and it spends 1 mana per card held. `buildFishingEnvelope` used to
 * default `cards` to `[]`, so any bug or fallback reaching it with no card
 * would have sent a redraw that looked like an ordinary turn in the log.
 * Session 65's precedent says that is not survivable: a rejected
 * `use_fishing_item` advanced the server's action token with no resync
 * available and surfaced a full turn after its cause.
 *
 * So intent is carried by WHICH BUILDER IS CALLED, and the tests below assert
 * on the refusal rather than on a comment promising one.
 *
 * ## Off, and pinned off
 *
 * `cardChoice.ts` §5 records the only calibration `REDRAW_THRESHOLD` has ever
 * had: repeated redraws burning mana before a card was played, the loss mix
 * flipping from 89% `escaped_fish_full` to 78% `escaped_mana`, at a mean of **1.29
 * turns per cast** — and that threshold is still the shipped constant. So the
 * send path is exercised HERE, with the dep forced true, and nowhere else.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildFishingEnvelope,
  buildRedrawEnvelope,
  runOneCast,
  type LiveFishingDeps,
} from "../../scripts/liveFishing.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { fakeCard, fakeDoc } from "../helpers/fishingDoc.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";

const TEST_CONFIG: BotConfig = {
  dungeonId: 5,
  energyCostPerRun: 20,
  maxRoom: 16,
  maxRunsPerDayGame: 12,
  dailyEnergyBudget: 240,
  maxRunsPerSession: 12,
  maxConsecutiveActionFailures: 3,
  dendren: { nodeId: "5", tierId: 1, energyCostPerCast: 12, maxCastsPerDayGame: 20, dailyEnergyBudget: 240, maxCastsPerSession: 20 },
};

describe("the intent guard — a card-less play_cards never reaches the wire", () => {
  it("REFUSES to serialise play_cards with an empty cards array", () => {
    expect(() => buildFishingEnvelope("play_cards", "tok", { cards: [], focusPoint: [2, 3] })).toThrow(/redraw/i);
  });

  it("REFUSES to serialise play_cards with cards omitted entirely — the old silent default", () => {
    // This is the exact shape the pre-session-70 builder turned into `cards: []`
    // and POSTed. It is the failure mode the guard exists for.
    expect(() => buildFishingEnvelope("play_cards", "tok", { focusPoint: [2, 3] })).toThrow(/redraw/i);
  });

  it("says WHY, and names the builder to use instead — an error nobody can act on is a crash", () => {
    let message = "";
    try {
      buildFishingEnvelope("play_cards", "tok", {});
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("buildRedrawEnvelope");
    expect(message).toContain("mana");
  });

  it("leaves the other three actions alone — an empty `cards` is their ordinary shape", () => {
    expect(() => buildFishingEnvelope("start_run", "tok", { nodeId: "5", tierId: 1 })).not.toThrow();
    expect(() => buildFishingEnvelope("use_fishing_item", "tok", { itemId: 942, slotIndex: 0 })).not.toThrow();
    // `loot` DOES carry a card, and must keep working.
    expect(buildFishingEnvelope("loot", "tok", { cards: [34] }).data.cards).toEqual([34]);
  });

  it("still builds an ordinary play unchanged", () => {
    const body = buildFishingEnvelope("play_cards", "tok", { cards: [1], focusPoint: [3, 2] });
    expect(body).toEqual({
      action: "play_cards",
      actionToken: "tok",
      data: { cards: [1], nodeId: "", focusPoint: [3, 2], itemId: 0, slotIndex: 0, tierId: 0 },
    });
  });
});

describe("buildRedrawEnvelope — pinned to the capture", () => {
  it("reproduces the user-captured payload byte for byte", () => {
    // Captured 2026-08-21 from a manual cast, doc 13025041. The actionToken is
    // the capture's own; nothing else in the body varies.
    expect(buildRedrawEnvelope("1787351554996", [2, 3])).toEqual({
      action: "play_cards",
      actionToken: "1787351554996",
      data: { cards: [], nodeId: "", focusPoint: [2, 3], itemId: 0, slotIndex: 0, tierId: 0 },
    });
  });

  it("SENDS focusPoint rather than omitting it — the marker is supplied", () => {
    // A redraw that dropped `focusPoint` would be a different request than the
    // one that was captured, and nothing has ever tested that shape.
    expect(buildRedrawEnvelope("tok", [1, 4]).data.focusPoint).toEqual([1, 4]);
  });
});

/**
 * A cast in which every card has negative EV, so `shouldRedraw` fires
 * (`bestEv < REDRAW_THRESHOLD` at threshold 0, and mana 10 > hand size).
 * The cast completes after a couple of actions so the test terminates.
 */
function redrawWorthyCast(opts: { redrawEnabled?: boolean; alwaysRedrawWorthy?: boolean }) {
  const dir = mkdtempSync(join(tmpdir(), "gigaruns-redraw-"));
  const posts: { action: string; cards: number[]; focusPoint: number[] }[] = [];
  const logLines: Record<string, unknown>[] = [];
  let actions = 0;

  // A card that can NEVER connect — no hit zones at all — so every placement
  // scores `-missAmount` and `shouldRedraw` fires regardless of what the
  // distribution believes. A merely WEAK card is not enough: the live loop
  // feeds `chooseCard` a real distribution concentrated on the fish, so a card
  // covering nine of sixteen cells comes back with pHit 1.0 and a positive EV.
  // The first draft of this helper used a tiny-hit/huge-miss card and measured
  // nothing, because the fish was standing inside its zone.
  const awful = { ...fakeCard({ id: 1, hitAmount: 0, missAmount: 20 }), hitZones: [] as number[] };
  // Worth playing. SAME card id, because `hand` holds ids and the doc's hand is
  // `[1]` — a different id would leave the hand empty rather than improved, and
  // the cast would halt on "no affordable card" instead of playing.
  const good = fakeCard({ id: 1, hitAmount: 9, missAmount: 0 });

  const client = {
    getFishingState: async () => ({ gameState: null }),
    getFishingActionToken: () => "tok",
    getItemsBalances: async () => ({ entities: [] }),
    postFishingAction: async (body: { action: string; data: { cards: number[]; focusPoint: number[] } }) => {
      posts.push({ action: body.action, cards: body.data.cards, focusPoint: body.data.focusPoint });
      actions++;
      const stillAwful = opts.alwaysRedrawWorthy || actions <= 1;
      return {
        success: true,
        message: "ok",
        data: {
          doc: fakeDoc({
            docId: "13025041",
            cards: stillAwful ? [awful] : [good],
            // Well clear of both ends: a fish at max HP escapes before any
            // decision is taken, which is how the first draft of this helper
            // measured nothing at all.
            fishHp: 12,
            fishMaxHp: 30,
            // Terminal once a real card has been played, so the cast ends.
            complete: body.action === "play_cards" && body.data.cards.length > 0,
          }),
          events: [],
        },
        actionToken: 1,
      };
    },
  } as unknown as GigaverseClient;

  const deps: LiveFishingDeps = makeLiveFishingDeps({
    client,
    config: TEST_CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    ...(opts.redrawEnabled === undefined ? {} : { redrawEnabled: opts.redrawEnabled }),
    log: { write: (o: Record<string, unknown>) => logLines.push(o), filePath: "test.jsonl" } as unknown as LiveFishingDeps["log"],
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath: join(dir, "guard-budget.json"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
    logsDir: join(dir, "logs"),
  });

  return { deps, posts, logLines, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("the wire — redraw is off by default and works when forced on", () => {
  it("DEFAULTS OFF: the policy wants a redraw, none is sent, and no empty `cards` reaches the wire", async () => {
    const { deps, posts, logLines, cleanup } = redrawWorthyCast({});
    await runOneCast(deps);
    cleanup();
    const suppressed = logLines.filter((l) => l.event === "redraw_suppressed");
    expect(suppressed.length).toBeGreaterThan(0);
    expect(logLines.some((l) => l.event === "redraw_sent")).toBe(false);
    // The assertion that actually matters: nothing on the wire was a redraw.
    expect(posts.filter((p) => p.action === "play_cards" && p.cards.length === 0)).toHaveLength(0);
    // And the old ambiguous event name is gone for good.
    expect(logLines.some((l) => l.event === "redraw_indicated_not_sent")).toBe(false);
  });

  it("FORCED ON: sends the captured payload, logs `redraw_sent`, and records the mana it cost", async () => {
    const { deps, posts, logLines, cleanup } = redrawWorthyCast({ redrawEnabled: true });
    await runOneCast(deps);
    cleanup();
    const redraws = posts.filter((p) => p.action === "play_cards" && p.cards.length === 0);
    expect(redraws.length).toBeGreaterThan(0);
    // `focusPoint` is supplied on the redraw, per the capture.
    expect(redraws[0]?.focusPoint).toHaveLength(2);
    const sent = logLines.filter((l) => l.event === "redraw_sent");
    expect(sent.length).toBe(redraws.length);
    // The cost is 1 mana per card HELD, and it is not recoverable from the log
    // later — so the hand size at the moment of the redraw is recorded with it.
    expect(typeof sent[0]?.handSize).toBe("number");
    expect(typeof sent[0]?.manaBefore).toBe("number");
    // A real card was still played afterwards: the redraw did not replace the turn.
    expect(posts.some((p) => p.action === "play_cards" && p.cards.length > 0)).toBe(true);
  });

  it("FAILS CLOSED on a runaway rather than spinning — a redraw does not advance `turn`", async () => {
    // MAX_TURNS cannot bound the redraw branch, because `turn++` only happens
    // after a card is played. Without the cap this cast redraws forever and
    // burns mana, which is exactly cardChoice.ts §5's 1.29-turn failure.
    const { deps, posts, cleanup } = redrawWorthyCast({ redrawEnabled: true, alwaysRedrawWorthy: true });
    await expect(runOneCast(deps)).rejects.toThrow(/redraw cap/i);
    cleanup();
    expect(posts.filter((p) => p.cards.length === 0).length).toBeLessThanOrEqual(6);
  });
});

describe("main() does not turn redraw on", () => {
  it("never assigns redrawEnabled true anywhere in the live script", () => {
    // A source assertion, deliberately. The dep default is pinned above by
    // behaviour; what THIS guards is the other half of session 64's lesson —
    // a flag whose default is safe but whose caller quietly sets it. Enabling
    // redraw must be a commit that edits this line and fails this test.
    const src = readFileSync(join("scripts", "liveFishing.ts"), "utf8");
    expect(/redrawEnabled\s*:\s*true/.test(src)).toBe(false);
    // And the CLI has no flag for it either.
    expect(src.includes("--redraw")).toBe(false);
  });
});
