/**
 * src/api/fishingLedger.ts — [session 64] the GAME's own daily cast ledger,
 * read in the one place that is allowed to know its shape.
 *
 * Extracted verbatim from `scripts/checkFishingCaps.ts`, which owned it since
 * session 23 and still prints the operator-facing report. The move is not
 * tidying: `scripts/liveFishing.ts` now consults the ledger between casts
 * (§2b's third stop condition), and it cannot import `checkFishingCaps.ts` to
 * get it — that script calls `main()` unconditionally at module scope, so
 * importing it would fire a live request as a side effect of a type import,
 * and it imports `liveFishing.ts` back for `FISHING_GUARD_STATE_PATH`, so the
 * cycle would close. A shared module breaks both problems at once.
 *
 * Behaviour is byte-for-byte what `checkFishingCaps.ts` did. Only the location
 * moved; that script now imports from here.
 */

/** Dendren. CLAUDE.md scopes this bot to one pond; the whole corpus is pond 2. */
export const DENDREN_POND_ID = 2;

export interface DayDoc {
  pondId: number;
  casts: number;
}

/**
 * `FishingStateSchema` is `.passthrough()`, so `dayDocs` arrives untyped — it
 * has never been part of the declared shape. Read it defensively rather than
 * widening the schema off one observation (CLAUDE.md §1).
 *
 * SHAPE, captured live 2026-08-19 (session 62): `dayDocs` is
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
export function readDayDocs(state: unknown): DayDoc[] {
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

/**
 * Casts left on the GAME's ledger for Dendren, or `null` when the ledger
 * cannot be read — which is NOT zero. A caller deciding whether to keep
 * casting must distinguish "the server says none left" from "we failed to
 * find out", because only the first is a reason to stop and the second is a
 * reason to fail closed.
 */
export function dendrenCastsRemaining(state: { maxPerDayJuiced?: number } & Record<string, unknown>): number | null {
  const mine = readDayDocs(state).filter((d) => d.pondId === DENDREN_POND_ID);
  if (mine.length !== 1) return null;
  const cap = state.maxPerDayJuiced;
  if (typeof cap !== "number") return null;
  return cap - (mine[0] as DayDoc).casts;
}
