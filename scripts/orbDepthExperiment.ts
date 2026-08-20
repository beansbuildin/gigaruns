/**
 * scripts/orbDepthExperiment.ts — session-58 brief §1.
 *
 * **Does the wide orb rule (policy C, QUESTIONS §24) cost depth?**
 *
 * The decision rule was fixed BEFORE any number existed, per the brief:
 *
 *   break-even ratio  A/C = 18.580 / 20.391 = 0.911
 *   at the sim's mean 3.286 rooms  ->  break-even DROP = 0.292 rooms
 *   SHIP C          if C's depth loss <  0.15 rooms
 *   UNRESOLVED      if the loss is 0.15 .. 0.292
 *   DO NOT SHIP     if the loss is >  0.292   (C is net-negative; §24 closes no)
 *
 * ── STAGE 0 EXISTS BECAUSE PRECISION IS NOT THE ONLY WAY A NULL CAN LIE ────
 *
 * The brief's argument for running this at all is sound and worth keeping: a
 * test whose PRECISION exceeds the DECISION THRESHOLD is informative even when
 * it returns null, which is a different thing from an underpowered
 * failure-to-reject. But that argument assumes the instrument can respond at
 * all, and here it might not:
 *
 *   `applyBoon` changes the player's state for exactly SIX boon types —
 *   Heal, UpgradeRock, UpgradePaper, UpgradeScissor, AddMaxArmor, AddMaxHealth.
 *   The 5 `rolled` types move a stat `combat.ts` never reads; the 6 `latent`
 *   types hit `case "latent": break;`; the 36 unmodelled types return the
 *   player unchanged. So a decision between two inert options is BIT-IDENTICAL
 *   in this simulator no matter which arm makes it.
 *
 * And policy C fires only where NO priority family matches — which excludes
 * AddMaxArmor, AddMaxHealth and UpgradeRock BY CONSTRUCTION, since all three
 * are priority families. C's entire depth channel is therefore Heal,
 * UpgradePaper and UpgradeScissor.
 *
 * Stage 0 measures how often that channel is actually open. If C and B differ
 * only on inert options, a null result is not "the harm is below threshold" —
 * it is "the experiment could not have shown harm", and the honest report is
 * that the sim cannot answer §24 rather than that it answered no.
 *
 * ── WHAT IS AND IS NOT LICENSED ───────────────────────────────────────────
 *
 * `dungeonSim` fights SAFE tier and live play now fights the hardest offered
 * (rule 8). Boon quality plausibly matters MORE when fights are harder, so a
 * null measured here may understate C's real cost. That is why the ship
 * threshold is half the break-even rather than the break-even itself.
 *
 * Read-only. No network. Spends nothing.
 *
 *   npx tsx scripts/orbDepthExperiment.ts [--runs=8000]
 */

import { offersWithOrbs, assertDistributionPreserved, orbOffersForRoom } from "../src/sim/orbOffers.js";
import { BOON_MODELS, type BoonOffer, type BoonOption } from "../src/sim/boons.js";
import { randomPolicy, simulateRun, type SimOptions } from "../src/sim/dungeonSim.js";
import { strategyPolicy } from "../src/strategy/policy.js";
import { pickBoonWithPriority, DEFAULT_BOON_PRIORITY, type OrbRule } from "../src/strategy/boonPriority.js";
import type { Combatant } from "../src/sim/types.js";

const rule = (s: string) => `\n${"=".repeat(76)}\n${s}\n${"=".repeat(76)}`;
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);

const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 8000);

/** The brief's thresholds, fixed before any number existed. See the header. */
const SHIP = 0.15;
const BREAK_EVEN = 0.292;

/**
 * The only boon effects that move a number `combat.ts` reads. Derived from
 * `BOON_MODELS` rather than hand-listed, so a newly modelled boon joins it
 * automatically and this script's central caveat cannot silently go stale.
 */
const EFFECTIVE_KINDS = new Set(["heal", "moveDelta", "maxArmor", "maxHealth"]);
const isEffective = (type: string): boolean => {
  const m = BOON_MODELS[type];
  return m ? EFFECTIVE_KINDS.has(m.effect.kind) : false;
};

// ── the enriched offer table ──────────────────────────────────────────────
const joinResult = offersWithOrbs();
assertDistributionPreserved(joinResult.offers);
const enriched = joinResult.offers;

console.log(rule("ORB DEPTH EXPERIMENT — policy C (wide) vs policy B (shipped tie-break)"));
console.log(`
  offer table:      ${enriched.length} offers, distribution asserted identical to OBSERVED_OFFERS
  payouts joined:   ${joinResult.joined}  (complete on every option: ${joinResult.complete})
  unjoined:         ${joinResult.unjoined.length}
  source misses:    ${joinResult.sourceMisses.length} rows whose \`source\` names a file 2 states past the offer
  sim runs per arm: ${RUNS}`);

// ── STAGE 0 — can this instrument respond at all? ─────────────────────────
console.log(rule("STAGE 0 — CONSTRUCT VALIDITY: is the depth channel even open?"));

const HP_FRACTIONS = [1, 0.75, 0.5, 0.25] as const;
const player = (fraction: number): Combatant =>
  ({ hp: Math.max(1, Math.round(40 * fraction)), hpMax: 40, armor: 8, armorMax: 20, moves: {} }) as unknown as Combatant;

const pickUnder = (rule_: OrbRule, offer: BoonOffer, hp: number): BoonOption =>
  pickBoonWithPriority(
    player(hp),
    offer.options,
    offer.room,
    { ...DEFAULT_BOON_PRIORITY, orbRule: rule_ },
    {},
    offer.options.map((o) => o.orbs),
  );

let decisions = 0;
let differ = 0;
let differEffective = 0;
let bothInert = 0;
let orbsB = 0;
let orbsC = 0;
const swaps = new Map<string, number>();

for (const offer of enriched) {
  for (const hp of HP_FRACTIONS) {
    decisions++;
    const b = pickUnder("tie-break", offer, hp);
    const c = pickUnder("wide", offer, hp);
    orbsB += b.orbs ?? 0;
    orbsC += c.orbs ?? 0;
    if (b === c) continue;
    differ++;
    if (isEffective(b.type) || isEffective(c.type)) {
      differEffective++;
      const k = `${b.type} -> ${c.type}`;
      swaps.set(k, (swaps.get(k) ?? 0) + 1);
    } else {
      bothInert++;
    }
  }
}

console.log(`
  decisions:                                    ${decisions}
  C picks a DIFFERENT option than B:            ${differ}  (${pct(differ, decisions)})
    ...where BOTH options are inert in the sim: ${bothInert}  (${pct(bothInert, differ)} of the differences)
    ...where at least one MOVES player state:   ${differEffective}  (${pct(differEffective, differ)} of the differences)

  orbs/decision  B ${(orbsB / decisions).toFixed(3)}   C ${(orbsC / decisions).toFixed(3)}   delta ${((orbsC - orbsB) / decisions).toFixed(3)}`);

if (differEffective > 0) {
  console.log(`\n  the swaps that can actually move a run (B -> C):`);
  for (const [k, n] of [...swaps].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`);
}

const channelOpen = differEffective > 0;
if (!channelOpen) {
  console.log(`
  *** THE DEPTH CHANNEL IS CLOSED. ***
  Every decision where C differs from B is a choice between options that leave
  the player's state untouched, so both arms are bit-identical run for run and
  a depth comparison is guaranteed to return exactly 0.00 rooms. That is NOT
  evidence that C is harmless — it is evidence that this simulator cannot see
  the question. Reported as UNRESOLVED regardless of what stage 1 prints.`);
}

// ── STAGE 1 — the depth comparison ────────────────────────────────────────
console.log(rule(`STAGE 1 — MEAN ROOMS CLEARED, n=${RUNS} per arm, identical seeds`));

const armOptions = (orbRule: OrbRule): Omit<SimOptions, "seed"> => ({
  policy: strategyPolicy({ name: `ev+orb-${orbRule}`, boonPriority: { ...DEFAULT_BOON_PRIORITY, orbRule } }),
  opponent: randomPolicy,
  chargesAreHardLimit: true,
  offers: orbOffersForRoom(enriched),
});

interface Arm { label: string; mean: number; half: number; orbsPerRun: number; rooms: number[] }

function runArm(label: string, orbRule: OrbRule): Arm {
  const opts = armOptions(orbRule);
  const rooms: number[] = [];
  let orbSum = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = simulateRun({ ...opts, seed: 1 + i });
    rooms.push(r.roomsCleared);
    for (const b of r.boons) orbSum += b.orbs ?? 0;
  }
  const mean = rooms.reduce((a, b) => a + b, 0) / RUNS;
  const variance = Math.max(0, rooms.reduce((a, b) => a + (b - mean) * (b - mean), 0) / RUNS);
  return { label, mean, half: 1.96 * Math.sqrt(variance / RUNS), orbsPerRun: orbSum / RUNS, rooms };
}

const armB = runArm("B  shipped (tie-break)", "tie-break");
const armC = runArm("C  wide", "wide");

const loss = armB.mean - armC.mean;
const orbGain = armC.orbsPerRun - armB.orbsPerRun;

// The arms share seeds run for run, so the difference is PAIRED and its
// standard error must be computed on the per-seed differences — not from the
// two arms' independent variances, which ignores the (large) shared variance
// and overstates the uncertainty on exactly the quantity the decision rule
// keys on. Most seeds produce an identical run in both arms, and a paired
// interval is what lets those count as evidence of no difference.
const diffs = armB.rooms.map((b, i) => b - armC.rooms[i]!);
const identical = diffs.filter((d) => d === 0).length;
const dMean = diffs.reduce((a, b) => a + b, 0) / RUNS;
const dVar = Math.max(0, diffs.reduce((a, b) => a + (b - dMean) * (b - dMean), 0) / RUNS);
const dHalf = 1.96 * Math.sqrt(dVar / RUNS);

console.log(`
  ${armB.label.padEnd(24)} mean rooms ${armB.mean.toFixed(4)} +/- ${armB.half.toFixed(4)}   orbs/run ${armB.orbsPerRun.toFixed(3)}
  ${armC.label.padEnd(24)} mean rooms ${armC.mean.toFixed(4)} +/- ${armC.half.toFixed(4)}   orbs/run ${armC.orbsPerRun.toFixed(3)}

  C's depth loss:  ${loss.toFixed(4)} rooms   (positive = C is shallower)
  C's orb gain:    ${orbGain.toFixed(3)} orbs per RUN  (${pct(orbGain, armB.orbsPerRun)} of B's)

  PAIRED difference (the statistic the decision rule keys on):
    seeds where the two arms produced an IDENTICAL run: ${identical} of ${RUNS}  (${pct(identical, RUNS)})
    mean B - C: ${dMean.toFixed(4)} rooms,  95% CI [${(dMean - dHalf).toFixed(4)}, ${(dMean + dHalf).toFixed(4)}]
    half-width ${dHalf.toFixed(4)} rooms vs the ${SHIP} ship bar and the ${BREAK_EVEN} break-even`);

// ── the pre-registered decision ───────────────────────────────────────────
console.log(rule("DECISION — against the rule fixed before the numbers existed"));

let verdict: string;
if (!channelOpen) {
  verdict = `UNRESOLVED — the depth channel is closed (stage 0). The 0.00 loss is a
  property of the instrument, not of policy C. §24 stays open and stays a
  user judgement call.`;
} else if (dMean + dHalf < SHIP) {
  verdict = `SHIP C — depth loss ${loss.toFixed(4)} rooms, and the whole 95% interval
  sits below the ${SHIP} ship bar (upper bound ${(dMean + dHalf).toFixed(4)}). The orb gain is
  ${orbGain.toFixed(2)} per run, ${pct(orbGain, armB.orbsPerRun)} of B's, bought for no measurable depth.`;
} else if (dMean + dHalf <= BREAK_EVEN) {
  verdict = `UNRESOLVED — depth loss ${loss.toFixed(4)} is in the ${SHIP}..${BREAK_EVEN} band where the
  Safe-tier caveat could plausibly flip the sign. Do not ship.`;
} else {
  verdict = `DO NOT SHIP — depth loss ${loss.toFixed(4)} > ${BREAK_EVEN} rooms. C is net-negative;
  §24 closes as answered-no.`;
}
console.log(`\n  ${verdict}\n`);
