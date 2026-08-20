/**
 * src/sim/orbOffers.ts — attach the per-option Hard Core payout to the sim's
 * boon offers, so a sim arm can exercise the live orb rule.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────
 *
 * `OBSERVED_OFFERS` (src/sim/boons.ts) is hand-transcribed and carries exactly
 * what `applyBoon` needs: `type`, `val1`, `val2`. `gigusOrbAmount` is a
 * PAYOUT, not an effect, so it was never in that table — which meant the
 * simulator could not tell policy B (orbs break ties within a priority rank,
 * shipped session 57) from policy A (no orb reading at all). Both arms picked
 * identically, because in the sim every option's payout was `undefined`.
 *
 * That is a measurement gap, not a hypothetical: the offers here are THE SAME
 * OFFERS the sim already draws, with one extra field joined on. This is
 * deliberately NOT the counterfactual that `SimOptions.offers` was originally
 * built for — nothing is invented, no offer is added, removed, or reweighted.
 * `assertDistributionPreserved()` below is what holds that claim to account,
 * and `scripts/orbDepthExperiment.ts` calls it before it reports a number.
 *
 * ── THE JOIN IS BY CONTENT, NOT BY `source`, AND THE ROOM IS OFF BY ONE ────
 *
 * Two things were measured before this join was written, both 135/135 with no
 * exceptions (`scripts/orbDepthExperiment.ts` re-asserts them on every run):
 *
 * 1. **`OBSERVED_OFFERS[].room` is `ROOM_NUM_CID - 1`.** The reward phase is
 *    reached with the room counter ALREADY ADVANCED past the room whose clear
 *    produced the offer, so the wire says 2 while the table — correctly, and
 *    consistently for all 50+ sessions it has existed — says 1. Any sweep that
 *    labels a corpus offer with raw `ROOM_NUM_CID` is therefore one room deep
 *    of every other room number in this project. That matters: `room` feeds
 *    `boonPriority.priorityOf`'s rooms-1..8 lifesteal window and `rankBoons`'
 *    depth weighting.
 *
 * 2. **17 of the 135 `source` values name a file two states LATER than the one
 *    holding the offer** (a uniform -2, in five runs). So a join keyed on
 *    `source` silently drops those 17 — including every offer deeper than room
 *    5, i.e. exactly the rows a depth experiment most wants.
 *
 * The join is therefore: match on `room + 1 == ROOM_NUM_CID` AND an exact
 * `type:val1:val2` triple-match across all options, within the run directory
 * the `source` names. That resolves all 135 with zero ambiguity — no two
 * candidate states for one row ever disagreed about the payouts. `source` is
 * still used, but only to pick the directory.
 *
 * Read-only, no network. Reads `fixtures/`, so it is corpus-bound like
 * `corpus.ts` and unlike the rest of `src/sim/`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { OBSERVED_OFFERS, type BoonOffer } from "./boons.js";
import { CORPUS_DIR, type WireEntity, type WireRewardOption } from "./corpus.js";

/** The identity of an offer's option list: every type and both values. */
const contentKey = (opts: readonly { type: string; val1: number; val2: number }[]): string =>
  opts.map((o) => `${o.type}:${o.val1}:${o.val2}`).join("|");

interface CorpusOffer {
  /** `run-<ts>/state-NNN`, without the `.json`. */
  label: string;
  /** Raw `ROOM_NUM_CID` — one MORE than `OBSERVED_OFFERS`' room. See header. */
  wireRoom: number;
  key: string;
  orbs: (number | undefined)[];
}

/**
 * Every recorded reward offer, grouped by run directory.
 *
 * No attempt-walking and no dedup: the key is the state file, so repeats are
 * distinct rows by construction. `ROOM_NUM_CID` is read from `data.entity`,
 * NOT `data.entity.data` (session 56's trap), and is stored raw — the -1 is
 * applied at the join so the offset stays visible in one place.
 */
export function corpusOffersByRun(root: string = CORPUS_DIR): Map<string, CorpusOffer[]> {
  const out = new Map<string, CorpusOffer[]>();
  for (const dir of readdirSync(root).sort()) {
    const full = join(root, dir);
    if (!statSync(full).isDirectory()) continue;
    const list: CorpusOffer[] = [];
    for (const file of readdirSync(full).sort()) {
      if (!file.startsWith("state-") || !file.endsWith(".json")) continue;
      const doc = JSON.parse(readFileSync(join(full, file), "utf8")) as {
        data?: { entity?: WireEntity & { data?: { rewardPathOptions?: WireRewardOption[] } } };
      };
      const entity = doc.data?.entity;
      const rp = entity?.data?.rewardPathOptions;
      if (!rp || rp.length === 0) continue;
      list.push({
        label: `${dir}/${file.replace(/\.json$/, "")}`,
        wireRoom: entity?.ROOM_NUM_CID ?? 0,
        key: contentKey(rp.map((o) => ({ type: o.boon.boonTypeString, val1: o.boon.selectedVal1, val2: o.boon.selectedVal2 }))),
        orbs: rp.map((o) => o.gigusOrbAmount),
      });
    }
    out.set(dir, list);
  }
  return out;
}

export interface OrbJoin {
  /** `OBSERVED_OFFERS` with `orbs` attached wherever the corpus supplied one. */
  offers: BoonOffer[];
  /** Rows resolved to exactly one agreed payout vector. */
  joined: number;
  /** Rows left exactly as they were — no candidate, or candidates disagreed. */
  unjoined: string[];
  /** Joined rows where every option carried a numeric payout. */
  complete: number;
  /** Rows whose `source` file is NOT where the offer actually lives. */
  sourceMisses: string[];
}

/**
 * `OBSERVED_OFFERS` with payouts joined on, by the content+room rule in the
 * header.
 *
 * Rows that do not resolve are passed through UNCHANGED rather than dropped —
 * the offer distribution the sim draws from must not depend on how much payout
 * data the corpus happens to hold. An unjoined row leaves every `orbs`
 * undefined, which every orb rule already treats as "not captured".
 *
 * Candidates whose payout vectors DISAGREE are rejected rather than
 * arbitrated. Two states matching one row on room and full content but paying
 * differently would mean the join key is not an identity, and picking one
 * would attach a payout on no evidence — the same silent-wrong-answer shape
 * `boonPriority.ts`'s partial-capture guard refuses.
 */
export function offersWithOrbs(root: string = CORPUS_DIR): OrbJoin {
  const byRun = corpusOffersByRun(root);
  const unjoined: string[] = [];
  const sourceMisses: string[] = [];
  let joined = 0;
  let complete = 0;

  const offers = OBSERVED_OFFERS.map((offer) => {
    const dir = offer.source.split("/")[0]!;
    const key = contentKey(offer.options);
    const candidates = (byRun.get(dir) ?? []).filter((c) => c.key === key && c.wireRoom - 1 === offer.room);
    const agreed = new Set(candidates.map((c) => JSON.stringify(c.orbs)));

    if (candidates.length === 0 || agreed.size !== 1) {
      unjoined.push(offer.source);
      return { ...offer, options: offer.options.map((o) => ({ ...o })) };
    }
    if (!candidates.some((c) => c.label === offer.source)) sourceMisses.push(offer.source);

    const orbs = candidates[0]!.orbs;
    joined++;
    if (orbs.every((x) => typeof x === "number")) complete++;
    return { ...offer, options: offer.options.map((o, i) => ({ ...o, orbs: orbs[i] })) };
  });

  return { offers, joined, unjoined, complete, sourceMisses };
}

/**
 * Throws unless the enriched table is the SAME OFFERS as `OBSERVED_OFFERS` —
 * same length, same order, same room, same source, same `type`/`val1`/`val2`
 * on every option. The only permitted difference is an added `orbs`.
 *
 * This is what makes it honest to feed these through `SimOptions.offers`,
 * whose doc comment otherwise reserves that hook for labelled counterfactuals.
 * If this ever throws, the result is a hypothetical and must be reported as
 * one — do not relax the check to make a run go through.
 */
export function assertDistributionPreserved(enriched: readonly BoonOffer[]): void {
  if (enriched.length !== OBSERVED_OFFERS.length) {
    throw new Error(`orbOffers: ${enriched.length} offers vs OBSERVED_OFFERS' ${OBSERVED_OFFERS.length}`);
  }
  for (let i = 0; i < enriched.length; i++) {
    const a = OBSERVED_OFFERS[i]!;
    const b = enriched[i]!;
    if (a.room !== b.room || a.source !== b.source || a.options.length !== b.options.length) {
      throw new Error(`orbOffers: offer ${i} (${a.source}) does not match OBSERVED_OFFERS`);
    }
    for (let j = 0; j < a.options.length; j++) {
      const x = a.options[j]!;
      const y = b.options[j]!;
      if (x.type !== y.type || x.val1 !== y.val1 || x.val2 !== y.val2) {
        throw new Error(`orbOffers: offer ${i} (${a.source}) option ${j} differs: ${x.type} vs ${y.type}`);
      }
    }
  }
}

/** A drop-in for `offersForRoom` that carries payouts. */
export function orbOffersForRoom(enriched: readonly BoonOffer[]): (room: number) => BoonOffer[] {
  return (room: number) => enriched.filter((o) => o.room === room);
}
