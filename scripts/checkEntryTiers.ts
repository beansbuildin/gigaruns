/**
 * scripts/checkEntryTiers.ts — session 111, read-only preflight for CLAUDE.md
 * rule 11's ENTRY TIER. No POST, no game state mutation.
 *
 * ## [session 113] THE COST MODEL, THIRD AND CURRENT VERSION
 *
 * **Each game day, exactly ONE faction is charged, 3 rings per juiced run.
 * The charged faction rotates daily.** User-supplied, 2026-08-30, resolving
 * what session 112's single measurement could not.
 *
 * This file has now held three different cost models and it is worth naming
 * all three, because two of them printed confident numbers that were wrong:
 *
 *  1. **"one of EACH of the seven, per run"** (sessions 111-112). Read
 *     literally off `entryData.inputItems` + `inputAmounts: [1,...]`. Printed
 *     a runway of 30 runs / 7.5 days. **Wrong by construction** — it billed
 *     seven factions for a purchase that touches one.
 *  2. **"3 of ONE faction, rotation unknown"** (session 112, measured). Right
 *     about the debit, silent about tomorrow, so it could only say the runway
 *     was a lower bound of unknown slack.
 *  3. **This one.** The rotation is real and daily, so the runway is not
 *     `min(balance)/3` at all — it is set by how often the rotation lands on
 *     the scarcest faction, which is a WEEKLY question, not a per-run one.
 *
 * ## What is still not known, and is therefore not printed as a number
 *
 * **Which faction is active on which day.** One observation exists — game day
 * 20695 charged Foxglove (139) — and a single point fits every candidate
 * formula for exactly one choice of offset, so it establishes nothing. The
 * mapping is knowable the moment a run lands on a SECOND day; until then this
 * script prints the rotation-dependent figures as a RANGE and says which end
 * is which. See `handoff/DECISIONS.md`, 2026-08-30 (session 113).
 *
 * ## The `3` no longer needs separating for THIS purpose
 *
 * Session 112 left "3 = the juiced multiplier" and "3 = a flat per-entry
 * amount" unseparated. That ambiguity is real and still open, but it **does
 * not affect any number below**, because CLAUDE.md rule 11 mandates that every
 * run be juiced. Both readings charge 3 on every run this bot is permitted to
 * make. It would only matter to an unjuiced entry, which rule 11 forbids.
 *
 * ## The other half: `inputsBasedOnFactionDay: true` must never be cached
 *
 * Both gated tiers carry it. The list is a per-day thing; this script reads it
 * live every time and so must anything else.
 */
import { GigaverseClient } from "../src/api/client.js";

/**
 * Faction ring ids, and the faction INDEX each belongs to.
 *
 * The index is not invented and not read off the id order. It comes from
 * `GET /offchain/static`'s `recipes[]`, where seven "Hatchard Kit" recipes
 * share id `500006` and differ only in `FACTION_CID_array` and their input
 * ring — an identity mapping the server publishes itself:
 *
 *   1 Crusader 135 · 2 Overseer 136 · 3 Athena 137 · 4 Archon 138
 *   5 Foxglove 139 · 6 Summoner 140 · 7 Chobo 134
 *
 * Two sibling families (`500007`, `500008`) carry the same seven factions
 * against rings shifted by +2 and +4, which is how the identity family is
 * identifiable as the identity rather than one rotation among three.
 *
 * Silver and gold are the same seven factions offset by 109 (134 -> 243),
 * verified against every id below.
 */
const FACTIONS: readonly { faction: number; name: string; silver: number; gold: number }[] = [
  { faction: 1, name: "Crusader", silver: 135, gold: 244 },
  { faction: 2, name: "Overseer", silver: 136, gold: 245 },
  { faction: 3, name: "Athena", silver: 137, gold: 246 },
  { faction: 4, name: "Archon", silver: 138, gold: 247 },
  { faction: 5, name: "Foxglove", silver: 139, gold: 248 },
  { faction: 6, name: "Summoner", silver: 140, gold: 249 },
  { faction: 7, name: "Chobo", silver: 134, gold: 243 },
];

const RING_NAMES: Record<number, string> = Object.fromEntries(
  FACTIONS.flatMap((f) => [
    [f.silver, `${f.name} Silver`],
    [f.gold, `${f.name} Gold`],
  ]),
);

/** Faction index for a ring id, or `undefined` for a non-ring item. */
export function factionOf(itemId: number): number | undefined {
  return FACTIONS.find((f) => f.silver === itemId || f.gold === itemId)?.faction;
}

/** Runs per day at rule 11's ceiling — 12 run-units / 3 per juiced run. */
export const RUNS_PER_DAY = 4;

/**
 * Rings charged per JUICED run, measured live on run 25215982 (Foxglove
 * 57 -> 54, session 112). Not derived from `inputAmounts`, which says 1 —
 * see the header on why the discrepancy does not need resolving here.
 */
export const RINGS_PER_JUICED_RUN = 3;

/** Days in the rotation. Seven factions, one per day — the assumption is named at every print site. */
export const ROTATION_PERIOD_DAYS = FACTIONS.length;

export type TierCost = { id: number; amount: number };

export interface FactionDayRunway {
  /**
   * Per faction: how many runs its own stock affords **on the days it is
   * active**. This is NOT a runway on its own — a faction with 30 rings
   * affords 10 runs, but only ever spends them one active day in
   * `ROTATION_PERIOD_DAYS`.
   */
  perFaction: { id: number; faction: number | undefined; balance: number; activeDayRuns: number }[];
  /** The scarcest faction's row — the one that dries first and so bounds everything. */
  scarcest: { id: number; balance: number; activeDayRuns: number };
  /** The most-stocked faction's row, printed so the SPREAD is visible rather than just the floor. */
  richest: { id: number; balance: number; activeDayRuns: number };
  /**
   * Full rotation cycles completable before the scarcest faction cannot fund a
   * full active day at `runsPerDay`. Assumes a uniform cycle hitting each
   * faction once — **the assumption the data does not yet support**.
   */
  cyclesUntilScarcestDries: number;
  /** `cyclesUntilScarcestDries` expressed in runs and in calendar days at `runsPerDay`. */
  runsUntilScarcestDries: number;
  daysUntilScarcestDries: number;
}

/**
 * The rotation-aware runway. Pure and exported so the arithmetic anyone is
 * likely to get wrong is pinned by a test rather than only ever exercised
 * against the live endpoint — the same reason its predecessor `runwayRuns`
 * was exported, and that one shipped a 9.5x error for two sessions anyway,
 * because the bug was in the MODEL and not in the arithmetic. Read the header
 * before trusting any number out of here.
 *
 * Returns `null` for a free tier (`inputItems: []`), which has no runway
 * rather than an infinite one.
 */
export function factionDayRunway(
  cost: TierCost[],
  balances: Map<number, number>,
  runsPerDay: number = RUNS_PER_DAY,
  perRun: number = RINGS_PER_JUICED_RUN,
): FactionDayRunway | null {
  if (cost.length === 0) return null;
  // Clamped so a malformed 0 cannot divide into an infinite runway — the one
  // defensive clamp carried over from `runwayRuns`, which needed it too.
  const spend = Math.max(1, perRun);
  const perDay = Math.max(1, runsPerDay) * spend;
  const perFaction = cost.map(({ id }) => {
    const balance = balances.get(id) ?? 0;
    return { id, faction: factionOf(id), balance, activeDayRuns: Math.floor(balance / spend) };
  });
  let scarcest = perFaction[0]!;
  let richest = perFaction[0]!;
  for (const row of perFaction) {
    if (row.balance < scarcest.balance) scarcest = row;
    if (row.balance > richest.balance) richest = row;
  }
  const cyclesUntilScarcestDries = Math.floor(scarcest.balance / perDay);
  return {
    perFaction,
    scarcest,
    richest,
    cyclesUntilScarcestDries,
    // One cycle is `ROTATION_PERIOD_DAYS` calendar days, each affording
    // `runsPerDay` runs — regardless of WHICH faction pays on which of them.
    runsUntilScarcestDries: cyclesUntilScarcestDries * ROTATION_PERIOD_DAYS * Math.max(1, runsPerDay),
    daysUntilScarcestDries: cyclesUntilScarcestDries * ROTATION_PERIOD_DAYS,
  };
}

async function main() {
  const dungeonId = Number(process.argv[2] ?? 5);
  const client = new GigaverseClient();
  const today = await client.getDungeonToday();
  const dungeon = today.dungeonDataEntities.find((d) => d.ID_CID === dungeonId);
  if (!dungeon) throw new Error(`dungeonId ${dungeonId} not present in dungeonDataEntities`);

  const balancesRes = await client.getItemsBalances();
  const balances = new Map<number, number>();
  // `ID_CID` is a STRING on this endpoint (`"134"`), unlike the numeric `ID_CID`
  // on `dungeonDataEntities` — keying the map on it raw silently yields 0 for
  // every ring, which reads as "out of rings" rather than as a bug.
  for (const row of balancesRes.entities) balances.set(Number(row.ID_CID), row.BALANCE_CID);

  // [session 113] The faction day, read WITHOUT spending a run. This is the
  // only advance signal the search of §1.3 actually found; see the block that
  // prints it for what it does and does not tell you.
  const day = await client.getGameDay();

  console.log(`\n▸ ${dungeon.NAME_CID} (dungeonId ${dungeonId}) — entry tiers, live\n`);
  console.log(
    `  game day ${day.currentDay}  (week ${day.currentWeek}, dayOfWeek ${day.currentDayOfWeek}) — ` +
      `next day in ${day.readableTimeTillNextDay}`,
  );
  console.log(
    `  ⚠ NO field on any endpoint names TODAY'S CHARGED FACTION in advance. Checked: every key of\n` +
      `    /game/dungeon/today (incl. dungeon ${dungeonId} and entryData), /account, /user/me, and\n` +
      `    /offchain/static. The day counter above is what IS knowable ahead of a run — it tells you\n` +
      `    WHEN the faction changes, never WHICH. Learn the which from a balance diff, then map it.`,
  );

  // Array order is tier 2, 1, 3. Sort for READING only; every lookup below is
  // by `.tier`, never by position — `entryData[0]` is Tier 2 and
  // `entryData[1]` is Tier 1, two coincidences that make a positional read
  // look correct right up until it spends seven silver rings by mistake.
  for (const entry of [...dungeon.entryData].sort((a, b) => a.tier - b.tier)) {
    const cost = entry.inputItems.map((id, i) => ({ id, amount: entry.inputAmounts[i] ?? 1 }));
    console.log(`\n  tier ${entry.tier}  dropMultiplier ${entry.dropMultiplier}  ${JSON.stringify(entry.name)}`);
    if (cost.length === 0) {
      console.log(`    cost: none (inputItems: []) — no rings spent`);
      continue;
    }
    const r = factionDayRunway(cost, balances)!;
    console.log(
      `    cost: ${RINGS_PER_JUICED_RUN}x ONE of the seven below, per juiced run — which one rotates DAILY.`,
    );
    console.log(
      `          (entryData says inputAmounts ${JSON.stringify(entry.inputAmounts)} across all seven ids;` +
        ` that is the\n           SUPERSET over faction-days, NOT one run's bill. Measured live, session 112.)`,
    );
    for (const row of [...r.perFaction].sort((a, b) => a.balance - b.balance)) {
      console.log(
        `      faction ${row.faction ?? "?"}  ${String(row.id).padEnd(4)}${(RING_NAMES[row.id] ?? "(unknown item)").padEnd(18)}` +
          ` balance ${String(row.balance).padStart(3)}  = ${String(row.activeDayRuns).padStart(3)} runs on its own active days`,
      );
    }
    console.log(
      `    ▸ RUNWAY, under a UNIFORM ${ROTATION_PERIOD_DAYS}-day rotation at ${RUNS_PER_DAY} runs/day:\n` +
        `      ${r.cyclesUntilScarcestDries} full cycle(s) = ${r.daysUntilScarcestDries} days = ` +
        `~${r.runsUntilScarcestDries} runs, bound by ${r.scarcest.id} ${RING_NAMES[r.scarcest.id] ?? ""} (${r.scarcest.balance} held).`,
    );
    console.log(
      `      Spread across factions is ${r.scarcest.balance}-${r.richest.balance}, so the TRUE runway lands\n` +
        `      inside that band depending on the rotation ORDER — which is UNCONFIRMED.\n` +
        `      [session 121] FIVE days are on record. The ARITHMETIC map stays FALSIFIED;\n` +
        `      the PERMUTATION hypothesis (a) was tested on a pre-registered prediction and SURVIVED:\n` +
        `        day 20695 dow3 -> f5 Foxglove | 20696 dow4 -> f6 Summoner\n` +
        `        day 20697 dow5 -> f7 Chobo    | 20698 dow6 -> f3 ATHENA  <- predicted f1, got f3\n` +
        `        day 20699 dow7 -> f4 ARCHON   <- pre-registered {f1,f2,f4}; got f4. (a) HOLDS.\n` +
        `      Three consecutive days advanced +1, so session 116 fitted "faction = dayOfWeek + 2".\n` +
        `      Day 20698 was that fit\u2019s own nominated wrap test and it FAILED: 7 is followed by 3,\n` +
        `      not by 1. Crusader (135) never moved. What SURVIVED and is now 17/17 is the charge\n` +
        `      SHAPE — exactly ONE faction, exactly ${RINGS_PER_JUICED_RUN}. What died is the ORDER.\n` +
        `      ⚠ THE PASS IS WEAK EVIDENCE AND WAS SAID TO BE, IN ADVANCE. Under (b) a random draw\n` +
        `        lands in the predicted 3-of-7 set 43% of the time, so day 20699 is a Bayes factor of\n` +
        `        only ~2.3 for (a) over (b). A FAIL would have been decisive; a pass is not a solve.\n` +
        `      Still fitting: (a) a fixed 7-permutation, now with fragment 5->6->7->3->4 and only\n` +
        `      {1,2} left, for dow 1 and dow 2, in one of just 2 orders (was 6); (b) per-day\n` +
        `      pseudo-random; (c) a period that is not 7. The runway figure above assumes (a).\n` +
        `      ⚠ dayOfWeek is 1-INDEXED — MEASURED, not assumed. Sessions 117/118 printed the\n` +
        `        remaining slots as "dow 0/1/2" on the assumption that dow 6 is followed by dow 0.\n` +
        `        The server returned dow 7 for day 20699. dow = day mod 7 with 0 mapped to 7, so the\n` +
        `        two OPEN days are dow 1 (day 20700) and dow 2 (day 20701), never a dow 0.\n` +
        `      ▸ NEXT TEST, and under (a) it is the LAST one needed: day 20700 (dow 1) must charge\n` +
        `        Crusader (135) or Overseer (136). Either answer SOLVES the order under (a), because\n` +
        `        dow 2 then takes whichever is left. Anything else kills (a) outright.\n` +
        `      Do NOT re-fit an arithmetic rule to the five points.`,
    );
    console.log(
      `      ⚠ Do NOT quote the ${r.runsUntilScarcestDries} as exact. It assumes each faction is charged\n` +
        `        exactly once per ${ROTATION_PERIOD_DAYS} days. That is the user's stated model, not a measurement.\n` +
        `        The old "min(balance)/${RINGS_PER_JUICED_RUN}" figure was a DIFFERENT model and is retired — see this file's header.`,
    );
    if (entry.inputsBasedOnFactionDay) {
      console.log(`    ⚠ inputsBasedOnFactionDay: true — this list is per-day. Re-read it; never cache it.`);
    }
  }
  console.log("");
}

const isMain = process.argv[1] && process.argv[1].endsWith("checkEntryTiers.ts");
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
