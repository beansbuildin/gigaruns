/**
 * scripts/oilTimingSweep.ts — [session 61 §4d] derive the oil consumption
 * TIMING policy in simulation, in BOTH turn-cost branches, with a sensitivity
 * check on the effect amounts.
 *
 * ## Read this before reading a number
 *
 * **The corpus contains no usable oil data.** 93 of 94 casts spent no
 * consumable; the 94th (12975152) spent one before capture began with the item
 * unidentifiable. So this sweep scores a MODEL of the oils built from their
 * item payloads (`FishingRestoreFocus` +2, `FishingDamageFish` +2), not
 * observed behaviour. Nothing here is a measurement of the oils.
 *
 * **No oil is consumed live on the strength of this.** CLAUDE.md rule 4 and
 * `config/bot.json`'s `dendren.oils.policyApproved`, which ships false: the
 * user approves a policy before anything is spent.
 *
 * ## What is swept
 *
 *   - 6 timing policies (src/strategy/fishing/oilTiming.ts), including the
 *     never-oil control and the un-overfittable "consume both at start".
 *   - BOTH branches of the unresolved mechanic: `costsTurn` false and true.
 *   - Effect amounts 1 / 2 / 3 — the sensitivity check. The payload says 2;
 *     if the winner flips at 1 or 3 the recommendation is not robust and
 *     saying so is the useful result.
 *
 * Paired on seed across arms, so a difference is a paired statistic rather
 * than two independent noisy rates.
 *
 * ## THE HEADLINE FINDING IS ABOUT THE SWEEP ITSELF — read before the tables
 *
 * **This sim structurally cannot represent a turn cost, so the `costsTurn=true`
 * branch is NOT a model of one.** Diagnosed rather than assumed, from the
 * sweep's own numbers:
 *
 *   - Turns are not scarce. `maxTurns` is 40 and mean turns per cast is ~2.95;
 *     `stalled` (the only outcome `maxTurns` can cause) is 0 or 1 in 4000.
 *   - What IS scarce is MANA (10 to start, every card costs some;
 *     `escaped_mana` is the dominant loss at 1007/4000) and MISSES (a miss
 *     pushes `fishHp` back toward `fishMaxHp`; `escaped_meter` 259/4000).
 *   - A consume turn as implemented plays no card, so it spends no mana, takes
 *     no miss, and hands the matcher a free observation of the fish's move.
 *
 * So burning a turn on an oil is not a cost in this model — it is a free
 * scouting action, and the numbers show exactly that: `start` at `costsTurn=
 * true` cuts `escaped_mana` 868 -> 270 and `escaped_meter` 165 -> 10, and its
 * catch rate RISES from 74% to 93%. An added cost that improves the outcome is
 * an artifact, not a finding, and the `costsTurn=true` rows are reported with
 * that label attached rather than deleted.
 *
 * This is the brief's own blessed answer — "the sim cannot separate these" is
 * a valid result and has precedent (two boon policies at n=2000). It also
 * inverts the brief's framing of the mechanic: the brief reasoned that a
 * turn-costing +2 is a net loss whenever an ordinary attack deals more than 2,
 * which assumes the forgone turn was a free guaranteed attack. In this fishery
 * a turn is not free — it costs mana and risks a miss that undoes damage —
 * so the arithmetic is not "2 versus the card's damage" even in principle.
 */

import {
  simulateCast,
  matcherFishPolicy,
  type CastOptions,
} from "../src/sim/fishing/castSim.js";
import { OIL_TIMING_POLICIES, PAYLOAD_OIL_EFFECTS, type OilTimingPolicy } from "../src/strategy/fishing/oilTiming.js";

export interface ArmResult {
  policy: string;
  runs: number;
  caught: number;
  catchRate: number;
  meanTurns: number;
  escapedMeter: number;
  escapedMana: number;
  oilsSpent: number;
  /** Casts where at least one oil was spent — a policy that never triggers is inert, not good. */
  castsUsingOil: number;
  /** `maxTurns` exhausted. Near zero throughout, which is what proves turns are not scarce here. */
  stalled: number;
}

export interface PairedDelta {
  policy: string;
  /** catchRate(arm) - catchRate(control), on the SAME seeds. */
  deltaCatchRate: number;
  lo: number;
  hi: number;
  /** Casts where the two arms disagreed on the outcome — the paired sample size that matters. */
  discordant: number;
}

function baseOpts(): Omit<CastOptions, "seed" | "oils"> {
  // Deliberately the plainest configuration the sim offers: synthetic pool,
  // matcher policy, defaults everywhere. A richer arm would make the oil
  // effect harder to read, not easier, and this sweep is about the oils.
  return { policy: matcherFishPolicy };
}

export function runArm(
  runs: number,
  policy: OilTimingPolicy,
  costsTurn: boolean,
  amount: number,
  seed = 1,
  held = 1,
): { summary: ArmResult; caughtBySeed: boolean[] } {
  let caught = 0;
  let turns = 0;
  let escapedMeter = 0;
  let escapedMana = 0;
  let oilsSpent = 0;
  let castsUsingOil = 0;
  let stalled = 0;
  const caughtBySeed: boolean[] = [];
  for (let i = 0; i < runs; i++) {
    const r = simulateCast({
      ...baseOpts(),
      seed: seed + i,
      oils: {
        policy,
        costsTurn,
        effects: { focusRestore: amount, fishDamage: amount },
        focusOilHeld: held,
        relaxingOilHeld: held,
      },
    });
    const isCaught = r.outcome === "caught";
    caughtBySeed.push(isCaught);
    if (isCaught) caught++;
    if (r.outcome === "escaped_meter") escapedMeter++;
    if (r.outcome === "escaped_mana") escapedMana++;
    if (r.outcome === "stalled") stalled++;
    turns += r.turns;
    oilsSpent += r.oilsUsed.length;
    if (r.oilsUsed.length > 0) castsUsingOil++;
  }
  return {
    summary: {
      policy: policy.name,
      runs,
      caught,
      catchRate: caught / runs,
      meanTurns: turns / runs,
      escapedMeter,
      escapedMana,
      oilsSpent,
      castsUsingOil,
      stalled,
    },
    caughtBySeed,
  };
}

/**
 * Paired difference in catch rate with a normal-approximation CI on the
 * DISCORDANT pairs only (McNemar's shape): pairs where both arms agree carry
 * no information about the difference, and pooling them shrinks the interval
 * for no reason.
 */
export function pairedDelta(policy: string, arm: boolean[], control: boolean[]): PairedDelta {
  const n = Math.min(arm.length, control.length);
  let armOnly = 0;
  let controlOnly = 0;
  for (let i = 0; i < n; i++) {
    if (arm[i] && !control[i]) armOnly++;
    else if (!arm[i] && control[i]) controlOnly++;
  }
  const discordant = armOnly + controlOnly;
  const delta = (armOnly - controlOnly) / n;
  if (discordant === 0) return { policy, deltaCatchRate: 0, lo: 0, hi: 0, discordant: 0 };
  // Variance of the paired difference of proportions, discordant-only form.
  const se = Math.sqrt((armOnly + controlOnly - (armOnly - controlOnly) ** 2 / n) / n) / n;
  return { policy, deltaCatchRate: delta, lo: delta - 1.96 * se, hi: delta + 1.96 * se, discordant };
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const pp = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}pp`;

function reportBranch(runs: number, costsTurn: boolean, amount: number): PairedDelta[] {
  const control = runArm(runs, OIL_TIMING_POLICIES[0]!, costsTurn, amount);
  console.log(
    `\n── costsTurn=${costsTurn}   effect amount=${amount}   n=${runs}/arm ` +
      `${amount === PAYLOAD_OIL_EFFECTS.fishDamage ? "(the payload's own value)" : "(sensitivity)"} ──`,
  );
  if (costsTurn) {
    console.log(
      "  ⚠ ARTIFACT BRANCH — a consume turn here spends no mana, takes no miss and gives the matcher a free\n" +
        "    observation, so it is a BENEFIT, not a cost (see this file's header). Do not read these rows as a\n" +
        "    turn-cost model; read them as evidence that this sim cannot represent one.",
    );
  }
  console.log(
    `  ${"policy".padEnd(22)} ${"catch".padStart(8)} ${"Δ vs never".padStart(11)} ${"95% CI".padStart(18)} ` +
      `${"oils".padStart(6)} ${"pp/oil".padStart(7)} ${"escMana".padStart(8)} ${"escMeter".padStart(9)} ${"stall".padStart(6)}`,
  );
  const deltas: PairedDelta[] = [];
  for (const p of OIL_TIMING_POLICIES) {
    const arm = p.name === "never" ? control : runArm(runs, p, costsTurn, amount);
    const d = pairedDelta(p.name, arm.caughtBySeed, control.caughtBySeed);
    deltas.push(d);
    const s = arm.summary;
    // pp per oil spent: a policy that buys the same lift with a third of the
    // stock is the better policy, and the raw delta hides that entirely.
    const perOil = s.oilsSpent > 0 ? ((d.deltaCatchRate * 100) / s.oilsSpent) * runs / 100 : 0;
    console.log(
      `  ${p.name.padEnd(22)} ${pct(s.catchRate).padStart(8)} ${pp(d.deltaCatchRate).padStart(11)} ` +
        `${`[${pp(d.lo)}, ${pp(d.hi)}]`.padStart(18)} ` +
        `${String(s.oilsSpent).padStart(6)} ${(s.oilsSpent > 0 ? perOil.toFixed(3) : "—").padStart(7)} ` +
        `${String(s.escapedMana).padStart(8)} ${String(s.escapedMeter).padStart(9)} ${String(s.stalled).padStart(6)}`,
    );
  }
  return deltas;
}

function main(): void {
  const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 20000);
  console.log("▸ oilTimingSweep — session 61 §4d");
  console.log("  MODELLED, NOT OBSERVED: the corpus has no usable oil cast. See this file's header.");
  console.log("  No oil is consumed live on the strength of this (rule 4; dendren.oils.policyApproved ships false).");

  const winners: Record<string, string> = {};
  for (const costsTurn of [false, true]) {
    for (const amount of [PAYLOAD_OIL_EFFECTS.fishDamage, 1, 3]) {
      const deltas = reportBranch(runs, costsTurn, amount);
      const best = deltas.filter((d) => d.policy !== "never").reduce((a, b) => (b.deltaCatchRate > a.deltaCatchRate ? b : a));
      winners[`costsTurn=${costsTurn} amount=${amount}`] =
        `${best.policy} (${pp(best.deltaCatchRate)}, CI [${pp(best.lo)}, ${pp(best.hi)}]${best.lo > 0 ? "" : " — CI INCLUDES ZERO"})`;
    }
  }

  console.log("\n── the sensitivity check, which is the point of running six branches ──");
  for (const [k, v] of Object.entries(winners)) console.log(`  ${k.padEnd(28)} -> ${v}`);
  // Robustness is judged WITHIN the branch the sim can actually model. Mixing
  // in the artifact branch would report "not robust" for a reason that has
  // nothing to do with the policies.
  const modelled = Object.entries(winners).filter(([k]) => k.startsWith("costsTurn=false"));
  const names = new Set(modelled.map(([, v]) => v.split(" ")[0]));
  console.log(
    names.size === 1
      ? `\n  ROBUST WITHIN THE MODELLED BRANCH: ${[...names][0]} wins at every effect amount (1, 2, 3) at costsTurn=false.`
      : `\n  NOT ROBUST even at costsTurn=false: the winner changes with the effect amount (${[...names].join(", ")}).`,
  );
  console.log(
    "  The costsTurn=true rows are NOT a second opinion on the same question — see the header. The honest\n" +
      "  statement of the turn-cost branch is that this sim cannot score it, and the first live oil cast must.",
  );

  console.log("\n── the theses, so a winner has to have a reason ──");
  for (const p of OIL_TIMING_POLICIES) console.log(`  ${p.name.padEnd(22)} ${p.thesis}`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) main();
