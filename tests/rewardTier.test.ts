/**
 * tests/rewardTier.test.ts — pins the two structural claims `scripts/
 * rewardTierAudit.ts` makes about the corpus, so a future capture that breaks
 * either one fails loudly instead of quietly changing a report nobody reruns.
 *
 * These are the claims brief 57's rule-8 decision rests on. The QUALITY
 * findings are deliberately NOT pinned — n is small (24 non-Safe offers) and
 * they are expected to move as the corpus grows. Structure is not.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { priorityOf } from "../src/strategy/boonPriority.js";
import { CORPUS_DIR } from "../src/sim/corpus.js";

interface WireRewardOption {
  tier?: number;
  gigusOrbItemId?: number;
  gigusOrbAmount?: number;
  boon: { boonTypeString: string };
}

interface Offer {
  room: number;
  tier: number;
  precedingFightTier: number | null;
  /** True when this offer is the very first state captured in its directory. */
  firstCapturedState: boolean;
  options: WireRewardOption[];
}

function loadOffers(): Offer[] {
  const out: Offer[] = [];
  for (const dir of readdirSync(CORPUS_DIR).sort()) {
    const full = join(CORPUS_DIR, dir);
    if (!statSync(full).isDirectory()) continue;
    const files = readdirSync(full).filter((f) => f.startsWith("state-") && f.endsWith(".json")).sort();
    let lastRoom = 0;
    let lastFightTier: number | null = null;
    let attempt = 0;
    const seen = new Set<string>();
    for (const f of files) {
      const isFirst = f === files[0];
      const doc = JSON.parse(readFileSync(join(full, f), "utf8")) as {
        data?: {
          entity?: {
            ROOM_NUM_CID?: number;
            data?: { activePath?: { tier?: number; enemyBuff?: unknown }; rewardPathOptions?: WireRewardOption[] };
          };
        };
      };
      const entity = doc.data?.entity;
      const room = entity?.ROOM_NUM_CID ?? 0;
      // A room going backwards is a NEW ATTEMPT in the same directory —
      // `entity.ID_CID` is the dungeon id (5) and cannot separate them.
      if (room < lastRoom) {
        attempt++;
        lastFightTier = null;
      }
      if (room > 0) lastRoom = room;
      const ap = entity?.data?.activePath;
      if (ap && "enemyBuff" in ap) lastFightTier = ap.tier ?? null;
      const rp = entity?.data?.rewardPathOptions;
      if (!rp || rp.length === 0) continue;
      const key = `${attempt}|${room}|${rp.map((o) => `${o.boon.boonTypeString}:${o.gigusOrbAmount}`).sort().join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        room,
        tier: rp[0]!.tier ?? -1,
        precedingFightTier: lastFightTier,
        firstCapturedState: isFirst,
        options: rp,
      });
    }
  }
  return out;
}

const offers = loadOffers();

describe("rewardPathOptions carries a tier, and it was discarded for 46 sessions", () => {
  it("the corpus actually has offers to reason about", () => {
    expect(offers.length).toBeGreaterThanOrEqual(138);
  });

  it("every option carries tier and a gigusOrb payout", () => {
    for (const o of offers) {
      for (const opt of o.options) {
        expect(typeof opt.tier, JSON.stringify(opt)).toBe("number");
        expect(opt.gigusOrbItemId).toBe(845); // Hard Core
        expect(typeof opt.gigusOrbAmount).toBe("number");
      }
    }
  });

  it("the tier is uniform WITHIN an offer — it is inherited, never chosen", () => {
    const mixed = offers.filter((o) => new Set(o.options.map((x) => x.tier)).size > 1);
    expect(mixed).toEqual([]);
  });

  it("the orb payout is NOT uniform within an offer — picking a boon picks a payout", () => {
    // [session 57] No longer only a gap: `pickBoonWithPriority` now reads this
    // as a within-rank tie-break. If it ever becomes uniform the tie-break
    // becomes inert on its own, which is the correct failure.
    const differs = offers.filter((o) => new Set(o.options.map((x) => x.gigusOrbAmount)).size > 1);
    expect(differs.length).toBeGreaterThan(offers.length * 0.9);
  });
});

describe("the orb tie-break's SURFACE — how rarely a priority rank actually ties", () => {
  /**
   * [session 57] The number that decides whether §2 was worth the session, and
   * it is small: the shipped rule reaches only decisions where two options
   * share the WINNING priority rank. Pinned here so a future session reading
   * "orbs are wired in" does not assume the bot is chasing orbs — it mostly
   * is not. `scripts/orbTieBreakReport.ts` prints the full three-policy
   * comparison, including the wider reading that was NOT shipped (+1.81
   * orbs/decision against the shipped +0.029, 62x, changing 35.5% of picks
   * instead of 0.7%). Widening needs a user directive, not a code change.
   */
  const HP_FRACTIONS = [1, 0.75, 0.5, 0.25];

  it("two options share the winning priority rank on well under a tenth of decisions", () => {
    let decisions = 0;
    let tied = 0;
    for (const offer of offers) {
      const ranks = offer.options.map((o) => priorityOf(o.boon.boonTypeString, offer.room));
      const matched = ranks.filter((r): r is NonNullable<typeof r> => r !== null);
      for (const _hp of HP_FRACTIONS) {
        decisions++;
        if (matched.length === 0) continue;
        const best = Math.min(...matched);
        if (ranks.filter((r) => r === best).length > 1) tied++;
      }
    }
    expect(decisions).toBeGreaterThanOrEqual(552);
    // Measured 16 of 552 (2.9%). The bound is loose on purpose — the corpus
    // grows — but it must stay an order of magnitude below "usually".
    expect(tied / decisions).toBeLessThan(0.1);
    expect(tied).toBeGreaterThan(0); // if this hits zero the tie-break is fully dead
  });
});

describe("the inheritance claim — the mechanism behind the rule-8 reversal", () => {
  it("reward tier equals the tier of the fight just won, on every joinable offer", () => {
    const joined = offers.filter((o) => o.precedingFightTier !== null);
    expect(joined.length).toBeGreaterThanOrEqual(87);
    const differs = joined.filter((o) => o.tier !== o.precedingFightTier);
    expect(differs).toEqual([]);
  });

  it("every unjoinable offer has a REASON, so the 100% above is not hiding a broken join", () => {
    // Two legitimate reasons for no preceding fight, and only two:
    //   - the offer is the attempt's first (room 2, nothing fought yet), or
    //   - the capture itself began mid-run, so the fight was never recorded.
    // The second is real: `run-2026-08-14-22-02-31/state-000.json` opens at
    // room 4. Anything else means the attempt-boundary logic has broken and
    // the inheritance rate is measuring the wrong pairs.
    const unjoined = offers.filter((o) => o.precedingFightTier === null);
    const unexplained = unjoined.filter((o) => o.room > 2 && !o.firstCapturedState);
    expect(unexplained).toEqual([]);
    // ...and the mid-run-capture escape hatch must stay rare, or it is not an
    // escape hatch, it is the join failing.
    expect(unjoined.filter((o) => o.firstCapturedState && o.room > 2).length).toBeLessThanOrEqual(3);
  });
});
