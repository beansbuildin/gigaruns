/**
 * scripts/checkFishingCaps.ts — read-only precondition check for a fishing
 * batch. Zero energy, zero POSTs, one GET.
 *
 * WHY THIS EXISTS. QUESTIONS.md §19 has been displaced four sessions running
 * (51, 52, 53, 54), and in session 54 the reason was purely a scheduling fact
 * nobody could see without a live read: the session began ~2 hours after the
 * previous one, inside the SAME guard-day that session had already exhausted.
 * The brief had asserted "it is not blocked now". It was.
 *
 * Two independent ledgers have to agree before a batch is worth planning, and
 * they CAN drift (session 23 saw the dungeon pair read 8/12 local vs 11/12
 * server, because a browser-started run is invisible to local tracking):
 *
 *   1. The GAME's own counter — `GET /fishing/state` -> `dayDocs`, keyed
 *      `DayCount#<address>#Fishing#<pondId>` (same shape as the dungeon side's
 *      `dayProgressEntities`, see schemas.ts's `DayProgressEntitySchema`).
 *      This is authoritative: it counts every cast regardless of who sent it.
 *   2. THIS REPO's guard — `data/guard-budget-fishing.json`, date-keyed on
 *      `todayKey()` (11:00 Pacific rollover, not UTC midnight).
 *
 * Printing both and the hours-until-reset makes "can this session run a batch"
 * a one-command question instead of a mid-session discovery.
 *
 * Usage: npx tsx scripts/checkFishingCaps.ts
 */
import { readFileSync } from "node:fs";

import { GigaverseClient } from "../src/api/client.js";
import { loadGuardBudget, todayKey } from "../src/orchestrator/guardPersistence.js";
import { FISHING_GUARD_STATE_PATH } from "./liveFishing.js";

/** Dendren. CLAUDE.md scopes this bot to one pond; the whole corpus is pond 2. */
const DENDREN_POND_ID = 2;

interface DayDoc {
  pondId: number;
  casts: number;
}

/**
 * `FishingStateSchema` is `.passthrough()`, so `dayDocs` arrives untyped — it
 * has never been part of the declared shape. Read it defensively rather than
 * widening the schema off one observation (CLAUDE.md §1).
 *
 * SHAPE, captured live 2026-08-19 (this session): `dayDocs` is
 * `[{pondId: number, doc: {UINT256_CID: number, docId: string, ...}}]` — the
 * pond is an EXPLICIT sibling field, not a suffix to be parsed off `docId`.
 * (`docId` reads `DayCount#<address>#player-day-data-pond-2`, so the dungeon
 * side's `DayCount#...#Dungeon#<id>` convention does NOT carry over.)
 *
 * TRAP, same capture: the response ALSO carries a SINGULAR `dayDoc`, and it is
 * pond 1's — it read `UINT256_CID: 0` while pond 2 sat at its 20/20 cap. Any
 * reader that reaches for `state.dayDoc` gets a confident wrong answer about
 * Dendren. Always go through `dayDocs` and match on `pondId`.
 */
function readDayDocs(state: unknown): DayDoc[] {
  const docs = (state as { dayDocs?: unknown }).dayDocs;
  if (!Array.isArray(docs)) return [];
  return docs.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { pondId, doc } = entry as Record<string, unknown>;
    if (typeof pondId !== "number" || typeof doc !== "object" || doc === null) return [];
    const casts = (doc as Record<string, unknown>).UINT256_CID;
    if (typeof casts !== "number") return [];
    return [{ pondId, casts }];
  });
}

/** Hours until the next 11:00 Pacific rollover, the boundary `todayKey()` uses. */
function hoursUntilReset(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const minutesNow = hour * 60 + get("minute");
  const minutesToReset = (11 * 60 - minutesNow + 24 * 60) % (24 * 60);
  return Math.round((minutesToReset / 60) * 100) / 100;
}

async function main() {
  const client = new GigaverseClient();
  const me = await client.getMe();
  const state = await client.getFishingState(me.address);

  const dayDocs = readDayDocs(state);
  const mine = dayDocs.filter((d) => d.pondId === DENDREN_POND_ID);
  const serverCasts = mine.length === 1 ? (mine[0] as DayDoc).casts : null;
  const serverCap = state.maxPerDayJuiced;

  const guard = loadGuardBudget(FISHING_GUARD_STATE_PATH);
  let persistedDate = "(no file)";
  try {
    persistedDate = JSON.parse(readFileSync(FISHING_GUARD_STATE_PATH, "utf8")).date ?? "(no date)";
  } catch {
    /* absent file is a legitimate zero seed — loadGuardBudget already said so */
  }

  console.log(`guard day (11:00 PT rollover): ${todayKey()}   [file records: ${persistedDate}]`);
  console.log(`hours until next reset:        ${hoursUntilReset()}`);
  console.log("");
  console.log(`GAME ledger  (dayDocs pond ${DENDREN_POND_ID}):  ${serverCasts ?? "NOT FOUND"} / ${serverCap}`);
  console.log(`REPO ledger  (${FISHING_GUARD_STATE_PATH}): ${guard.runsStarted} casts, ${guard.energySpent} energy`);
  console.log("");
  for (const d of dayDocs) console.log(`  dayDocs[pondId ${d.pondId}] = ${d.casts}`);
  console.log("");

  if (serverCasts === null) {
    console.log("VERDICT: cannot tell — no dayDoc for this pond. Do NOT plan a batch off the repo ledger alone.");
    return;
  }
  if (serverCasts !== guard.runsStarted) {
    console.log(
      `LEDGERS DISAGREE: game ${serverCasts} vs repo ${guard.runsStarted}. ` +
        `The GAME is authoritative (session 23). A gap means casts this process did not send.`,
    );
  } else {
    console.log("Ledgers agree.");
  }
  const remaining = serverCap - serverCasts;
  console.log(
    remaining > 0
      ? `VERDICT: ${remaining} cast(s) available this guard-day.`
      : `VERDICT: BLOCKED — cap spent. Next window opens at 11:00 PT (${hoursUntilReset()}h).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
