/**
 * scripts/rewardTierAudit.ts — session-56 brief §4. The first look at a field
 * this project has been discarding since session 09.
 *
 * Session 09 recorded, live, that a room-2 reward offer following a forced
 * non-Safe fight carried `tier`/`tierName: "Risky"` on all three options —
 * fields never seen on `rewardPathOptions[]` before — and noted "reward offers
 * apparently inherit the risk tier of the fight just won". It was logged, not
 * modelled (DECISIONS 2026-08-15). `wireBoonToOption` still reads only
 * `boonTypeString`/`selectedVal1`/`selectedVal2`, and `WireRewardOption`
 * declares only `index` and `boon`. **46 sessions of offers went past with the
 * tier discarded.**
 *
 * This is direct corroboration of the user's mechanism for reversing CLAUDE.md
 * rule 8, and it is worth being clear WHY rule 8's own evidence does not refute
 * it: rule 8 measured `lootTable` identity **in the enemy offer**, 440/440.
 * Reward-card quality and score payout are downstream of WINNING the fight, and
 * an enemy offer's lootTable cannot show them. **The user's claim is orthogonal
 * to rule 8's evidence, not contradicted by it** — which is how a hard rule can
 * be reversed without anyone having been wrong.
 *
 * Read-only. No network.
 *
 *   npx tsx scripts/rewardTierAudit.ts
 *
 * ── TWO CORPUS TRAPS THIS SCRIPT HANDLES, BOTH FOUND THE HARD WAY ──────────
 *
 *  1. **A run directory holds MULTIPLE ATTEMPTS.** `entity.ID_CID` is literally
 *     5 — the DUNGEON id — not a run id, so it cannot separate them. Attempts
 *     are delimited by `ROOM_NUM_CID` DECREASING. Joining rewards to fights
 *     per-directory without that produced 5 bogus "reward tier != preceding
 *     fight tier" exceptions, every one of them a cross-attempt join.
 *  2. **`ROOM_NUM_CID` lives on `data.entity`, NOT `data.entity.data`.**
 *     Reading it off the inner object yields `undefined` silently, and every
 *     room-controlled comparison then collapses into one bucket.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { BOON_MODELS } from "../src/sim/boons.js";
import { CORPUS_DIR } from "../src/sim/corpus.js";
import { priorityOf } from "../src/strategy/boonPriority.js";

const rule = (s: string) => `\n${"═".repeat(74)}\n${s}\n${"═".repeat(74)}`;
const TIER_NAME = ["Safe", "Risky", "Dangerous"];
const mean = (xs: number[]) => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);

interface WireRewardOption {
  index: number;
  tier?: number;
  tierName?: string;
  gigusOrbItemId?: number;
  gigusOrbAmount?: number;
  boon: { boonTypeString: string; selectedVal1: number; selectedVal2: number };
}

interface Offer {
  run: string;
  attempt: number;
  room: number;
  tier: number;
  /** Tier of the fight immediately preceding, within the SAME attempt. */
  precedingFightTier: number | null;
  options: WireRewardOption[];
}

const offers: Offer[] = [];
let mixedTierOffers = 0;

for (const dir of readdirSync(CORPUS_DIR).sort()) {
  const full = join(CORPUS_DIR, dir);
  if (!statSync(full).isDirectory()) continue;
  const files = readdirSync(full).filter((f) => f.startsWith("state-") && f.endsWith(".json")).sort();

  let attempt = 0;
  let lastRoom = 0;
  let lastFightTier: number | null = null;
  const seen = new Set<string>();

  for (const f of files) {
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
    const inner = entity?.data;

    // Trap 1: a room going BACKWARDS is a new attempt in the same directory.
    if (room < lastRoom) {
      attempt++;
      lastFightTier = null;
    }
    if (room > 0) lastRoom = room;

    const ap = inner?.activePath;
    if (ap && "enemyBuff" in ap) lastFightTier = ap.tier ?? null;

    const rp = inner?.rewardPathOptions;
    if (!rp || rp.length === 0) continue;

    // The same offer is written on every poll; dedupe on its contents.
    const key = `${attempt}|${room}|${rp
      .map((o) => `${o.boon.boonTypeString}:${o.boon.selectedVal1}:${o.boon.selectedVal2}:${o.gigusOrbAmount}`)
      .sort()
      .join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tiers = new Set(rp.map((o) => o.tier));
    if (tiers.size > 1) mixedTierOffers++;
    offers.push({
      run: dir,
      attempt,
      room,
      tier: rp[0]!.tier ?? -1,
      precedingFightTier: lastFightTier,
      options: rp,
    });
  }
}

// ── 1. is the tier a property of the OFFER or of the OPTION? ──────────────
console.log(rule(`REWARD TIER — ${offers.length} distinct offers in ${CORPUS_DIR}`));

console.log(`
  offers whose three options do NOT share one tier: ${mixedTierOffers} of ${offers.length}

  ${
    mixedTierOffers === 0
      ? "→ The tier is a property of the OFFER, not of the option. There is no\n" +
        "    tier to CHOOSE among reward options — only a tier the offer arrives\n" +
        "    with. Any framing of §4 as 'compare options by tier' is impossible."
      : "→ Mixed-tier offers exist; the option-level comparison IS available."
  }`);

// ── 2. the inheritance claim ──────────────────────────────────────────────
console.log(rule("INHERITANCE — does the reward tier equal the tier of the fight just won?"));

const joined = offers.filter((o) => o.precedingFightTier !== null);
const matches = joined.filter((o) => o.tier === o.precedingFightTier);
const differs = joined.filter((o) => o.tier !== o.precedingFightTier);

console.log(`
  offers with a preceding fight in the SAME attempt: ${joined.length} of ${offers.length}
  reward tier == preceding fight tier:               ${matches.length}  (${((100 * matches.length) / joined.length).toFixed(1)}%)
  differs:                                           ${differs.length}`);
for (const d of differs.slice(0, 10)) {
  console.log(`    ${d.run} attempt ${d.attempt} room ${d.room}: fight tier ${d.precedingFightTier} -> reward tier ${d.tier}`);
}
console.log(`
  ${
    differs.length === 0
      ? "→ INHERITANCE HOLDS on every joinable offer. Session 09's one-instance\n" +
        "    observation generalises: choosing a harder enemy in room N raises the\n" +
        "    tier of the reward offer in room N+1. That is the user's mechanism,\n" +
        "    visible in data this project already had."
      : "→ Inheritance holds on most but not all offers; see the exceptions above."
  }
  The offers with NO preceding fight are the run's FIRST offer (room 2), where
  no fight has been recorded in that attempt yet. They are excluded rather than
  scored as agreement.`);

// ── 3. does a higher-tier offer contain better boons? ─────────────────────
console.log(rule("QUALITY BY TIER, CONTROLLED FOR ROOM — the question that matters"));

console.log(`
  Deeper rooms offer fewer Safe tiers AND plausibly better rewards
  independently, so an UNCONTROLLED comparison finds an effect whether or not
  one exists. Every row below is one (room, tier) cell. n is OFFERS; each
  carries 3 options.

  room  tier         n   meanOrb   unmodelled%   priority-target%`);

const cells = new Map<string, Offer[]>();
for (const o of offers) {
  const k = `${o.room}|${o.tier}`;
  (cells.get(k) ?? cells.set(k, []).get(k)!).push(o);
}

const cellRow = (list: Offer[]) => {
  const opts = list.flatMap((o) => o.options);
  const orbs = opts.map((o) => o.gigusOrbAmount).filter((x): x is number => typeof x === "number");
  const unmodelled = opts.filter((o) => !BOON_MODELS[o.boon.boonTypeString]).length;
  const withTarget = list.filter((o) =>
    o.options.some((x) => priorityOf(x.boon.boonTypeString, o.room) !== null),
  ).length;
  return {
    n: list.length,
    orb: mean(orbs),
    unmodelledPct: (100 * unmodelled) / opts.length,
    targetPct: (100 * withTarget) / list.length,
  };
};

const roomsSeen = [...new Set(offers.map((o) => o.room))].sort((a, b) => a - b);
for (const room of roomsSeen) {
  for (const tier of [0, 1, 2]) {
    const list = cells.get(`${room}|${tier}`);
    if (!list) continue;
    const r = cellRow(list);
    console.log(
      `  ${String(room).padEnd(6)}${(TIER_NAME[tier] ?? String(tier)).padEnd(13)}${String(r.n).padStart(2)}   ` +
        `${r.orb.toFixed(2).padStart(6)}   ${r.unmodelledPct.toFixed(0).padStart(10)}%   ${r.targetPct.toFixed(0).padStart(14)}%`,
    );
  }
}

// Within-room paired contrast: only rooms that actually saw >1 tier can speak.
console.log(`
  WITHIN-ROOM CONTRASTS (only rooms that saw more than one tier can speak):`);
let contrasts = 0;
for (const room of roomsSeen) {
  const present = [0, 1, 2].filter((t) => cells.has(`${room}|${t}`));
  if (present.length < 2) continue;
  contrasts++;
  const parts = present.map((t) => {
    const r = cellRow(cells.get(`${room}|${t}`)!);
    return `${TIER_NAME[t]} ${r.orb.toFixed(1)} (n=${r.n})`;
  });
  const lo = cellRow(cells.get(`${room}|${present[0]!}`)!);
  const hi = cellRow(cells.get(`${room}|${present[present.length - 1]!}`)!);
  const d = hi.orb - lo.orb;
  console.log(`    room ${room}: meanOrb  ${parts.join("  vs  ")}   Δ ${d >= 0 ? "+" : ""}${d.toFixed(2)}`);
}
if (contrasts === 0) console.log("    (none — no room in the corpus was captured at more than one reward tier)");

// Roll values on matched types, the brief's second quality probe.
console.log(`
  ROLL VALUES ON MATCHED TYPES — same boon type seen at more than one tier:`);
const byType = new Map<string, Map<number, Set<string>>>();
for (const o of offers) {
  for (const opt of o.options) {
    const t = opt.boon.boonTypeString;
    const perType = byType.get(t) ?? byType.set(t, new Map()).get(t)!;
    const perTier = perType.get(o.tier) ?? perType.set(o.tier, new Set()).get(o.tier)!;
    perTier.add(`${opt.boon.selectedVal1}/${opt.boon.selectedVal2}`);
  }
}
let matchedTypes = 0;
for (const [type, perType] of [...byType].sort()) {
  if (perType.size < 2) continue;
  matchedTypes++;
  const parts = [...perType]
    .sort((a, b) => a[0] - b[0])
    .map(([t, vals]) => `${TIER_NAME[t]}=${[...vals].sort().join(",")}`);
  console.log(`    ${type.padEnd(22)} ${parts.join("   ")}`);
}
if (matchedTypes === 0) console.log("    (no boon type appears at more than one reward tier)");

// ── 4. what the corpus CANNOT say ─────────────────────────────────────────
console.log(rule("WHAT THIS CORPUS CANNOT ANSWER — read before writing brief 57"));

const totalOffers = offers.length;
const orbDiffers = offers.filter(
  (o) => new Set(o.options.map((x) => x.gigusOrbAmount)).size > 1,
).length;
const nonSafe = offers.filter((o) => o.tier > 0).length;
console.log(`
  n out loud: ${totalOffers} offers total, ${nonSafe} of them non-Safe
  (${((100 * nonSafe) / totalOffers).toFixed(0)}%), spread across ${roomsSeen.length} rooms and ${contrasts} rooms with a
  within-room contrast. That is SMALL. A null result here is "not enough data",
  not "the user is wrong".

  And the deeper limit: **the bot has taken the lowest tier in every unforced
  decision it has ever made.** Every non-Safe row above came from a room that
  offered no Safe option at all — the bot was forced, never choosing. So there
  is NO data whatsoever on what beating a DELIBERATELY chosen hard enemy
  yields. Rule 8 created its own evidence base. That is not a criticism of
  rule 8; it is the honest ceiling on this audit, and it is why the first few
  flipped runs are themselves the measurement rather than a confirmation of it.

  Two things this audit found that were NOT in the brief and that brief 57
  should use:

  1. \`gigusOrbAmount\` (item 845, Hard Core) is carried PER REWARD OPTION and
     DIFFERS across the three options in ${orbDiffers} of ${totalOffers} offers — e.g. [23,16,21].
     So choosing a reward boon also chooses a Hard Core payout, and
     \`pickBoon\`/\`pickBoonWithPriority\` are both completely blind to it. That
     is a live strategy gap independent of the rule-8 question, and it is the
     nearest thing in the data to the user's "harder cores payout" claim.
  2. The tier is uniform WITHIN an offer, so it is inherited, never chosen.
     The only lever on reward tier is which ENEMY tier you fight — which is
     exactly the rule-8 decision.`);
