/**
 * scripts/orbTieBreakReport.ts — session-57 brief §2.
 *
 * **What is `gigusOrbAmount` as a within-priority-rank tie-break actually
 * worth?** The brief asked for this number before anyone calls the change a
 * win, and asked for it to be reported plainly if it is ~0.
 *
 * `rewardPathOptions[].gigusOrbAmount` is the per-option Hard Core (itemId
 * 845) payout. It differs across the three options in 136 of 138 recorded
 * offers (session 56 §4), and both `pickBoon` and `pickBoonWithPriority` were
 * blind to it for 56 sessions.
 *
 * The user's directive is narrow: **priority rank decides first; orbs break
 * ties WITHIN one rank; orbs never override a higher-priority boon.** So this
 * script reports three policies over the same decisions:
 *
 *   A  BASELINE   — priority rank, then `rankBoons`. What shipped in session 56.
 *   B  SHIPPED    — priority rank, then ORBS, then `rankBoons`. The directive.
 *   C  WIDE       — orbs decide among ALL options whenever no priority family
 *                   matches. **NOT SHIPPED**, reported only so the user can see
 *                   what loosening the rule would be worth before choosing to.
 *
 * Read-only. No network. Reads the corpus directly rather than
 * `OBSERVED_OFFERS`, because that hand-maintained table carries no payouts.
 *
 *   npx tsx scripts/orbTieBreakReport.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { CORPUS_DIR } from "../src/sim/corpus.js";
import { choosePriorityBoon, DEFAULT_BOON_PRIORITY, priorityOf } from "../src/strategy/boonPriority.js";
import { rankBoons } from "../src/strategy/loot.js";
import type { BoonOption } from "../src/sim/boons.js";
import type { Combatant } from "../src/sim/types.js";

const rule = (s: string) => `\n${"═".repeat(74)}\n${s}\n${"═".repeat(74)}`;
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
const mean = (xs: number[]) => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);

/**
 * Same four HP fractions sessions 55 and 56 used. HP is swept rather than
 * fixed because `rankBoons`' heal gate and pool weighting both move with it,
 * so one HP value can hide a disagreement that exists at every other.
 */
const HP_FRACTIONS = [1, 0.75, 0.5, 0.25] as const;
const player = (fraction: number): Combatant =>
  ({ hp: Math.max(1, Math.round(40 * fraction)), hpMax: 40, armor: 8, armorMax: 20, moves: {} }) as unknown as Combatant;

// ── corpus sweep ───────────────────────────────────────────────────────────
// The two traps session 56 documented apply here too: a run DIRECTORY holds
// multiple attempts (delimited by ROOM_NUM_CID DECREASING), and ROOM_NUM_CID
// lives on `data.entity`, NOT `data.entity.data`.
interface WireRewardOption {
  index: number;
  gigusOrbAmount?: number;
  boon: { boonTypeString: string; selectedVal1: number; selectedVal2: number };
}
interface Offer {
  room: number;
  source: string;
  options: BoonOption[];
  orbs: (number | undefined)[];
}

const offers: Offer[] = [];
for (const dir of readdirSync(CORPUS_DIR).sort()) {
  const full = join(CORPUS_DIR, dir);
  if (!statSync(full).isDirectory()) continue;
  const files = readdirSync(full).filter((f) => f.startsWith("state-") && f.endsWith(".json")).sort();
  let attempt = 0;
  let lastRoom = 0;
  const seen = new Set<string>();

  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(full, f), "utf8")) as {
      data?: { entity?: { ROOM_NUM_CID?: number; data?: { rewardPathOptions?: WireRewardOption[] } } };
    };
    const entity = doc.data?.entity;
    const room = entity?.ROOM_NUM_CID ?? 0;
    if (room < lastRoom) attempt++;
    if (room > 0) lastRoom = room;

    const rp = entity?.data?.rewardPathOptions;
    if (!rp || rp.length === 0) continue;
    const key = `${attempt}|${room}|${rp
      .map((o) => `${o.boon.boonTypeString}:${o.boon.selectedVal1}:${o.boon.selectedVal2}:${o.gigusOrbAmount}`)
      .sort()
      .join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    offers.push({
      room,
      source: `${dir}/${f}`,
      options: rp.map((o) => ({
        type: o.boon.boonTypeString,
        val1: o.boon.selectedVal1,
        val2: o.boon.selectedVal2,
      })),
      orbs: rp.map((o) => o.gigusOrbAmount),
    });
  }
}

console.log(rule(`ORB TIE-BREAK — ${offers.length} distinct offers, ${offers.length * HP_FRACTIONS.length} decisions`));

const withOrbs = offers.filter((o) => o.orbs.every((x) => typeof x === "number"));
const orbSpread = withOrbs.filter((o) => new Set(o.orbs).size > 1);
console.log(`
  offers with a payout on EVERY option:  ${withOrbs.length} of ${offers.length}  (${pct(withOrbs.length, offers.length)})
  of those, payouts DIFFER across options: ${orbSpread.length}  (${pct(orbSpread.length, withOrbs.length)})
  mean spread (max - min) where they differ: ${mean(orbSpread.map((o) => Math.max(...(o.orbs as number[])) - Math.min(...(o.orbs as number[])))).toFixed(2)} orbs`);

// ── the tie rate: how often does the shipped rule even get a chance? ───────
console.log(rule("1. THE TIE RATE — how often two options share the winning priority rank"));

let decisions = 0;
let noPriorityMatch = 0;
let rankTied = 0;
let orbCouldDecide = 0; // tied AND the tied options pay differently

for (const offer of offers) {
  for (const hp of HP_FRACTIONS) {
    decisions++;
    const ranks = offer.options.map((o) => priorityOf(o.type, offer.room));
    const matched = ranks.filter((r): r is NonNullable<typeof r> => r !== null);
    if (matched.length === 0) {
      noPriorityMatch++;
      continue;
    }
    const best = Math.min(...matched);
    const tiedIdx = ranks.map((r, i) => (r === best ? i : -1)).filter((i) => i >= 0);
    if (tiedIdx.length < 2) continue;
    rankTied++;
    const tiedOrbs = tiedIdx.map((i) => offer.orbs[i]);
    if (tiedOrbs.every((x) => typeof x === "number") && new Set(tiedOrbs).size > 1) orbCouldDecide++;
    void hp;
  }
}

console.log(`
  decisions swept:                                  ${decisions}
  no option matches any priority family:            ${noPriorityMatch}  (${pct(noPriorityMatch, decisions)})
  a priority matched, but only ONE option:          ${decisions - noPriorityMatch - rankTied}  (${pct(decisions - noPriorityMatch - rankTied, decisions)})
  TWO OR MORE tied at the winning rank:             ${rankTied}  (${pct(rankTied, decisions)})
    ...and those tied options pay DIFFERENT orbs:   ${orbCouldDecide}  (${pct(orbCouldDecide, decisions)})  <- the shipped rule's whole surface`);

// ── the three policies, over the same decisions ───────────────────────────
console.log(rule("2. WHAT IT IS WORTH — total Hard Core orbs taken, three policies"));

let totalA = 0;
let totalB = 0;
let totalC = 0;
let changedB = 0;
let changedC = 0;
let scored = 0;

for (const offer of offers) {
  for (const frac of HP_FRACTIONS) {
    const p = player(frac);
    const rankOptions = {};

    const decide = (orbs?: (number | undefined)[]): number => {
      const d = choosePriorityBoon({
        player: p,
        offered: offer.options,
        room: offer.room,
        config: DEFAULT_BOON_PRIORITY,
        rankOptions,
        orbs,
      });
      if (d) return d.index;
      const ranked = rankBoons(p, offer.options, offer.room, rankOptions);
      return offer.options.indexOf(ranked[0]!.option);
    };

    const a = decide(undefined);
    const b = decide(offer.orbs);

    // Policy C: the WIDE reading. Identical to B except that when NO priority
    // family matches, the richest option wins outright (rankBoons only breaks
    // a payout tie). NOT SHIPPED — reported so the user can price loosening.
    let c = b;
    const ranks = offer.options.map((o) => priorityOf(o.type, offer.room));
    if (ranks.every((r) => r === null) && offer.orbs.every((x) => typeof x === "number")) {
      const bestOrbs = Math.max(...(offer.orbs as number[]));
      const richest = offer.options.map((_, i) => i).filter((i) => offer.orbs[i] === bestOrbs);
      if (richest.length === 1) c = richest[0]!;
      else {
        const ranked = rankBoons(p, richest.map((i) => offer.options[i]!), offer.room, rankOptions);
        c = offer.options.indexOf(ranked[0]!.option);
      }
    }

    const orbAt = (i: number) => offer.orbs[i];
    if (typeof orbAt(a) === "number" && typeof orbAt(b) === "number" && typeof orbAt(c) === "number") {
      totalA += orbAt(a)!;
      totalB += orbAt(b)!;
      totalC += orbAt(c)!;
      scored++;
    }
    if (a !== b) changedB++;
    if (a !== c) changedC++;
  }
}

const perDecision = (t: number) => (scored === 0 ? NaN : t / scored);
console.log(`
  decisions with a payout on every option (scored): ${scored} of ${decisions}

  A  BASELINE (priority -> rankBoons)          total ${totalA} orbs   mean ${perDecision(totalA).toFixed(3)}/decision
  B  SHIPPED  (priority -> ORBS -> rankBoons)  total ${totalB} orbs   mean ${perDecision(totalB).toFixed(3)}/decision
  C  WIDE     (NOT SHIPPED)                    total ${totalC} orbs   mean ${perDecision(totalC).toFixed(3)}/decision

  B vs A:  ${totalB - totalA >= 0 ? "+" : ""}${totalB - totalA} orbs over ${scored} decisions  (${(perDecision(totalB) - perDecision(totalA)).toFixed(3)}/decision), pick CHANGED on ${changedB} (${pct(changedB, decisions)})
  C vs A:  ${totalC - totalA >= 0 ? "+" : ""}${totalC - totalA} orbs over ${scored} decisions  (${(perDecision(totalC) - perDecision(totalA)).toFixed(3)}/decision), pick CHANGED on ${changedC} (${pct(changedC, decisions)})`);

console.log(rule("3. HOW TO READ THIS"));
console.log(`
  For scale: session 56 §4 measured the whole ENEMY-TIER effect on mean orbs
  at room 3 as +4.21 (Safe 17.3, n=25, vs Dangerous 21.5, n=2) — suggestive,
  not established. A per-decision delta here is directly comparable to that.

  The narrow rule is the USER'S DIRECTIVE and ships regardless of this number.
  If B - A is ~0 it is because priority rank rarely ties, NOT because the field
  is worthless — C is the same field read more widely. Neither number is a
  reason to widen the rule without a new directive (session-57 brief §2).

  A decision is only "scored" when every option in the offer carries a payout,
  because the tie-break refuses to fire on a partial capture rather than read
  an absent field as zero.`);
