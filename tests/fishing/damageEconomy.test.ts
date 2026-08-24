/**
 * tests/fishing/damageEconomy.test.ts — [session 80 §1, GATE 1] **the live
 * fish GAINS HP in expectation and the simulator's LOSES it, and the term that
 * carries the difference is the hit rate.**
 *
 * Session 48 wrote the decision table (`scripts/lossDecomposition.ts`):
 * meter-outs dominating with the focus meter INTACT selects the damage
 * economy. The corpus selects that branch — 80 of 130 casts end with the fish
 * healed to full, 24 of them with focus AND mana still in hand — and for
 * thirty-one sessions nobody measured the branch's own quantity, which is not
 * an outcome rate but a drift:
 *
 *     E[Δ fishHp per play] = P(hit) × (−damage) + P(miss) × (+heal)
 *
 * Four things are pinned below, in the order they matter:
 *
 *   1. **The corpus fact**, re-derived from the fixtures on every run and
 *      never pasted in. The live drift is POSITIVE: every cast is a race
 *      against a rising floor.
 *   2. **The simulator's is NEGATIVE** in the arm `OIL-POLICY.md` §0a
 *      suspends, and by a wide margin.
 *   3. **The hit rate carries it.** The per-card AMOUNTS are read from a real
 *      capture and every arm reproduces live's to within a tenth, so a
 *      decomposition that swaps one term at a time names the hit rate — which
 *      the session-80 brief had eliminated as a cause by comparing live
 *      against a THIRD arm (`matcherPool: []`, the deck sweep's) and carrying
 *      the conclusion across to these two.
 *   4. **The denominator is checked, not assumed.** Dropping zero-delta sim
 *      turns as redraws is only sound while every shot moves HP, and card 78's
 *      `hitEffects` is empty. `assertShotsAccountedFor` is exercised in both
 *      directions.
 *
 * Fixtures and the seeded simulator only — no `data/`, no network, and nothing
 * written anywhere (CLAUDE.md: tests never touch a real data path).
 */

import { describe, expect, it } from "vitest";

import {
  assertShotsAccountedFor,
  corpusEconomy,
  corpusEconomyUnclamped,
  economyOf,
  modeOf,
  simEconomy,
  type Economy,
} from "../../src/sim/fishing/damageEconomy.js";
import { makeMatcherFishPolicy, REDRAW_THRESHOLD, type CastOptions } from "../../src/sim/fishing/castSim.js";
import { isCleanTrace, loadCastTraces } from "../../src/sim/fishing/castTrace.js";
import { REAL_DECK } from "../../src/sim/fishing/rodDeck.js";

const TRACES = loadCastTraces().filter(isCleanTrace);
const LIVE = corpusEconomy(TRACES);

/** The board `scripts/damageEconomy.ts` and `scripts/focusProfileCheck.ts` both fix. */
const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;

/**
 * 400 casts, not the scripts' 4000. The quantities under test are separated by
 * whole HP points — live +0.19 against the bare arm's −3.4 — so n=400 resolves
 * them with room to spare, and a test suite is not the place to spend eight
 * seconds re-deriving a figure the script prints.
 */
const RUNS = 400;

/* ===========================================================================
 * ⚠⚠⚠ [session 90 §3] THREE TESTS IN THIS FILE ARE RED, AND THEY ARE RED
 *     ON PURPOSE. DO NOT REGENERATE THEM.
 * ===========================================================================
 *
 * Session 90's brief authorised regenerating six files of "ordinary corpus-
 * count drift" and required each to be checked first. Five were drift. **This
 * one is not.** `LIVE.drift` — the quantity two tests here call THE FINDING —
 * **changed sign**: it was positive (the band asserts > 0.05, and the docblock
 * above cites +0.19) and is now **-0.0316**. A sign flip on a headline claim
 * is not a number to bump.
 *
 * ## The cause, measured rather than guessed
 *
 * Split the 167 clean traces by the deck they were actually DEALT — the split
 * session 89 §2 discovered and DECISIONS 2026-08-23 says to always state:
 *
 *     dealt deck        casts  plays   hitRate   meanDmg  meanHeal    drift
 *     base [1..10]         22     74    18.9%      4.571     3.000   +1.568
 *     non-base            145    622    39.9%      5.210     3.086   -0.222
 *     POOLED (=LIVE)      167    696    37.6%      5.176     3.074   -0.032
 *
 * **The two arms have OPPOSITE drift signs, and the pooled figure sits near
 * zero because they nearly cancel.** So "the fish gains HP in expectation" was
 * never a fact about the fishery — it is what pooling a low-hit-rate base-deck
 * window into a rod-deck corpus produces. Held to one deck, the live fish
 * LOSES HP, which is the SAME SIGN as the sim's bare arm rather than the
 * opposite of it.
 *
 * By batch, the same thing seen from the other side: the 146 older clean
 * traces drift **+0.079** and the 21 newest drift **-0.787** (hit rate 47.2%
 * against 36.2%). One batch moved the pooled sign.
 *
 * ## Why this is the user's call and not a fix
 *
 * Three of this file's claims rest on the sign, and each fails differently:
 *
 *   1. *"THE FINDING: the fish gains HP in expectation"* — false as stated on
 *      the pooled corpus, and MEANINGLESS on it, since the pooled corpus is
 *      two fisheries.
 *   2. *"the clamp is real but small"* — the unclamped drift is **-0.0014**,
 *      i.e. indistinguishable from zero. The clamp claim survives; the
 *      `> 0` term in it does not.
 *   3. *"THE FINDING: the bare arm's drift is NEGATIVE where live's is
 *      positive"* — the CONTRAST is what breaks. Both are negative now. The
 *      magnitudes still differ by an order of magnitude (-0.222 against
 *      < -2), so "not the same fishery" survives; "opposite signs" does not.
 *
 * **This bears on OIL-POLICY §0a.** The suspension of +19.40pp rests partly on
 * live and sim being different fisheries, and the single cleanest number
 * expressing that was the opposite drift sign. That argument now needs the
 * magnitude, not the sign. §0a is NOT lifted and nothing here argues that it
 * should be — but the reason it stands has changed, and a reason that changed
 * silently is worse than one that failed loudly.
 *
 * The choice is between pinning the deck-conditioned figures (which changes
 * what this file measures) and re-stating the findings around magnitude. Both
 * are real edits to a published claim, so both are the account owner's.
 * `QUESTIONS.md` §31 asks. Until then these three stay red.
 * ========================================================================= */

function armOf(label: string, extra: Omit<CastOptions, "seed" | "policy">) {
  return simEconomy(label, { policy: makeMatcherFishPolicy(REDRAW_THRESHOLD, true), ...REAL_PARAMS, ...extra }, RUNS);
}

/** Swap ONE term of the live economy for the arm's and report the drift that results. */
function driftSwapping(e: Economy, term: "hit" | "damage" | "heal"): number {
  const hitRate = term === "hit" ? e.hitRate : LIVE.hitRate;
  const damage = term === "damage" ? e.meanDamage : LIVE.meanDamage;
  const heal = term === "heal" ? e.meanHeal : LIVE.meanHeal;
  return hitRate * -damage + (1 - hitRate) * heal;
}

describe("the live damage economy, re-derived from the corpus", () => {
  it("has a play on every turn — the live bot cannot redraw, so plays and turns are the same set", () => {
    // `redrawEnabled` ships false in `liveFishing.ts` and no committed cast
    // contains a redraw. This is the assumption the sim half's denominator
    // filter is calibrated against, so it is asserted rather than recalled.
    expect(LIVE.unchanged).toBe(0);
    expect(LIVE.hits + LIVE.misses).toBe(LIVE.plays);
    expect(LIVE.plays).toBeGreaterThan(500);
  });

  it("THE FINDING: the fish gains HP in expectation — the drift is positive", () => {
    expect(LIVE.drift).toBeGreaterThan(0);
    // A band, not a pin. The corpus grows every session it plays; what must not
    // drift is the sign and the order of magnitude, because a positive drift is
    // what makes a cast a race against a rising floor.
    expect(LIVE.drift).toBeGreaterThan(0.05);
    expect(LIVE.drift).toBeLessThan(0.4);
  });

  it("lands roughly a third of its shots, for ~5 damage, against ~3 heal on a miss", () => {
    expect(LIVE.hitRate).toBeGreaterThan(0.3);
    expect(LIVE.hitRate).toBeLessThan(0.4);
    expect(LIVE.meanDamage).toBeGreaterThan(4.5);
    expect(LIVE.meanDamage).toBeLessThan(5.5);
    expect(LIVE.meanHeal).toBeGreaterThan(2.7);
    expect(LIVE.meanHeal).toBeLessThan(3.3);
    // The modal play, which is what the catalog says it should be: a 5-damage
    // hit or a 3-point heal. `fixtures/fishing-casts/cards.json` gives the
    // Shroom deck six cards at exactly 5/−3.
    expect(modeOf(LIVE.damageHist).value).toBe(5);
    expect(modeOf(LIVE.healHist).value).toBe(3);
  });

  it("the clamp is real but small — the unclamped reading agrees in sign and within a tenth", () => {
    // The server clamps `fishHp` at `fishMaxHp`, so a terminal miss shows a
    // smaller state delta than the card's own `FISH_HP_DIFF`. Both readings are
    // reported by the script; this is the check that they do not tell two
    // different stories.
    const unclamped = corpusEconomyUnclamped(TRACES);
    expect(unclamped.plays).toBe(LIVE.plays);
    expect(unclamped.hits).toBe(LIVE.hits);
    expect(unclamped.drift).toBeGreaterThan(0);
    expect(unclamped.meanDamage - LIVE.meanDamage).toBeGreaterThan(0);
    expect(unclamped.meanDamage - LIVE.meanDamage).toBeLessThan(0.5);
  });
});

describe("the simulator's economy, same predicate", () => {
  const bare = armOf("bare", { deckIds: [...REAL_DECK] });
  const blind = armOf("blind", { deckIds: [...REAL_DECK], matcherPool: [] });

  it("accounts for every shot — the zero-delta filter is validated, not trusted", () => {
    // Card 78 deals its damage only on a crit (`hitEffects: []`), so an
    // ordinary hit with it would move `fishHp` by 0 and be dropped by the
    // filter as if it were a redraw. Today that never happens; this is the
    // assertion that says so out loud on every run.
    expect(() => assertShotsAccountedFor(bare)).not.toThrow();
    expect(() => assertShotsAccountedFor(blind)).not.toThrow();
    expect(bare.economy.plays).toBe(bare.shots);
    expect(bare.economy.hits).toBe(bare.hitsReported);
  });

  it("throws when the denominator does not reconcile", () => {
    expect(() => assertShotsAccountedFor({ ...bare, shots: bare.shots + 1 })).toThrow(/shots reported by/);
    expect(() => assertShotsAccountedFor({ ...bare, hitsReported: bare.hitsReported + 1 })).toThrow(/hits reported/);
  });

  it("redraws on a large share of its turns, which the live bot never does", () => {
    // Not a footnote: the sim spends mana and buys observations the shipped
    // policy cannot. Reported by the script, pinned here so it cannot become
    // invisible.
    expect(bare.turns).toBeGreaterThan(bare.shots);
    expect((bare.turns - bare.shots) / bare.turns).toBeGreaterThan(0.1);
    expect(bare.redrawMana).toBeGreaterThan(0);
  });

  it("THE FINDING: the bare arm's drift is NEGATIVE where live's is positive", () => {
    // This is OIL-POLICY §0a's arm — every oil Δ in this repo was computed in
    // it. Live's fish heals faster than it is damaged; this arm's fish is
    // destroyed at over three HP per play. The two are not the same fishery,
    // and the drift says so in one number where catch rate needed a paragraph.
    expect(bare.economy.drift).toBeLessThan(0);
    expect(bare.economy.drift).toBeLessThan(-2);
    expect(LIVE.drift).toBeGreaterThan(0);
  });

  it("reproduces live's per-card AMOUNTS in every arm — they are read from a real capture", () => {
    for (const e of [bare.economy, blind.economy]) {
      expect(Math.abs(e.meanHeal - LIVE.meanHeal)).toBeLessThan(0.5);
    }
    // Damage is within a tenth in the bare arm; the blind arm plays worse cards
    // rather than differently-valued ones, so its mean is lower without any
    // card dealing a different amount.
    expect(Math.abs(bare.economy.meanDamage - LIVE.meanDamage)).toBeLessThan(0.5);
  });

  it("THE CAUSE: the hit rate dominates the decomposition, not the arithmetic", () => {
    // The session-80 brief eliminated hit geometry — "the sim lands shots at
    // the live rate" — on the strength of `deckObjectiveSweep.ts`'s 36.42%
    // baseline, which is the BLIND arm on a different deck. The arms that
    // produce §0a's figures land shots far more often than live does.
    const hit = Math.abs(driftSwapping(bare.economy, "hit") - LIVE.drift);
    const damage = Math.abs(driftSwapping(bare.economy, "damage") - LIVE.drift);
    const heal = Math.abs(driftSwapping(bare.economy, "heal") - LIVE.drift);
    expect(hit).toBeGreaterThan(damage);
    expect(hit).toBeGreaterThan(heal);
    expect(hit / (hit + damage + heal)).toBeGreaterThan(0.8);
    expect(bare.economy.hitRate).toBeGreaterThan(LIVE.hitRate + 0.3);
  });
});

describe("economyOf — the shared scorer", () => {
  it("is an exact identity on hand-built deltas, in both sign conventions", () => {
    // Two hits of 5, two misses of 3: drift = (−5 −5 +3 +3) / 4 = −1.
    const e = economyOf("synthetic", 1, [-5, -5, 3, 3]);
    expect(e.plays).toBe(4);
    expect(e.hits).toBe(2);
    expect(e.misses).toBe(2);
    expect(e.hitRate).toBe(0.5);
    expect(e.meanDamage).toBe(5);
    expect(e.meanHeal).toBe(3);
    expect(e.drift).toBe(-1);
  });

  it("counts a zero delta as unchanged rather than as a hit or a miss", () => {
    const e = economyOf("synthetic", 1, [0, 0, -4]);
    expect(e.unchanged).toBe(2);
    expect(e.hits).toBe(1);
    expect(e.misses).toBe(0);
  });

  it("is empty-safe", () => {
    const e = economyOf("synthetic", 0, []);
    expect(e.plays).toBe(0);
    expect(e.drift).toBe(0);
    expect(e.hitRate).toBe(0);
  });
});
