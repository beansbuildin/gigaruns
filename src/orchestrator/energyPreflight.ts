/**
 * src/orchestrator/energyPreflight.ts — [session 47, brief §1a]
 *
 * Session 46 reported a fishing batch blocked on a "12.5-hour regen wait"
 * while **2,603 energy sat claimable across 27 of the account's 37 ROMs**.
 * Nothing in the live-play path knew ROMs existed: `scripts/claimAllRoms.ts`
 * has been a manual standalone script since session 22, and
 * `scripts/liveFishing.ts` / `scripts/liveRun.ts` read only
 * `GET /offchain/player/energy`. Session 46's own recap named folding this in
 * as "the single highest-value unbuilt thing" — it removes the constraint
 * that blocked or truncated live batches in sessions 44, 45 and 46.
 *
 * The user lifted the session-19/20 "ask before automating ROM claiming"
 * instruction in the session-47 brief §0a. That instruction predated
 * `GET /roms/player?id=<address>` being CONFIRMED (session 22) and overflow
 * past the 420 cap being proven non-wasting (sessions 21/22), so claiming is
 * now an ordinary preflight step rather than an ask-first action.
 *
 * **What this does NOT do.** It does not raise any ceiling. `config/bot.json`'s
 * daily budgets and the `GuardState` caps are untouched and still enforced by
 * their existing call sites — spending above the configured daily budget stays
 * on CLAUDE.md's ask-first list. This only ensures the *account pool* can fund
 * a batch the guards have already authorized.
 *
 * **Caveat carried from the brief:** if a claim ever turns out to require an
 * on-chain transaction that spends ETH, stop and ask. The user authorized the
 * claim, not an ETH spend. `POST /roms/factory/claim` has been an offchain
 * call in every capture to date (session 22), which is why this is safe to
 * automate; a future change to that shape invalidates the authorization.
 *
 * Network-free by construction: every call goes through `EnergyPreflightDeps`,
 * so the whole thing is testable offline against mocks (CLAUDE.md's
 * api/strategy separation, applied to the orchestrator layer).
 */

/** One ROM's claimable balance, projected out of `GET /roms/player`'s `entities[].factoryStats`. */
export interface RomBankEntry {
  docId: string;
  energyCollectable: number;
}

export interface EnergyPreflightDeps {
  /** `GET /offchain/player/energy` -> `entities[0].parsedData.energyValue`. */
  getEnergy: () => Promise<number>;
  /** `GET /roms/player?id=<address>` -> `entities[].{docId, factoryStats.energyCollectable}`. */
  getRomBank: () => Promise<RomBankEntry[]>;
  /** `POST /roms/factory/claim`. Rejects on failure — this module fails closed on that. */
  claimRom: (docId: string) => Promise<void>;
  /**
   * [session 53, brief §3] The account's energy CAP, for the `headroom`
   * figure below. Optional: omit it and `headroom`/`maxSnapshot` are reported
   * as null rather than guessed. `clientEnergyPreflightDeps` serves it from
   * the `getEnergy` response it already makes, so this costs no extra request.
   */
  getMaxEnergy?: () => number | null;
  /** CLAUDE.md §7 rate limiting. Injected so tests don't wait 1.2s per claim. */
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}

export interface EnergyPreflightResult {
  /** What the caller said the planned batch needs. */
  requiredEnergy: number;
  /** Account pool before any claim. */
  poolBefore: number;
  /** Account pool after claiming (equals `poolBefore` when no claim was needed). */
  poolAfter: number;
  /** True when `poolBefore` already covered `requiredEnergy` — no ROM read, no claim. */
  alreadySufficient: boolean;
  /** Total `energyCollectable` across the whole bank at read time. Null when the bank was never read. */
  bankTotal: number | null;
  /** ROMs actually claimed, in the order they were claimed (by snapshot, per `claimOrder`). */
  claimedDocIds: string[];
  /** Sum of the *snapshot* `energyCollectable` of the claimed ROMs — an estimate; `poolAfter - poolBefore` is the measured truth. */
  claimedSnapshotTotal: number;
  /** [session 52 §1a] Which order the bank was walked in. `"descending"` unless the caller asked otherwise. */
  claimOrder: ClaimOrder;
  /**
   * [session 52 §1a] Set when the `maxClaims` bound was reached still short of
   * the deficit and the largest remaining ROM was claimed to close it in one
   * step. Null on every unbounded pass — which is every pass that omits
   * `maxClaims`.
   */
  fallbackClaimDocId: string | null;
  /** Per-claim snapshots, in claim order — §1c wants the running total attributable per ROM, not just the sum. */
  claims: { docId: string; snapshot: number; fallback: boolean }[];
  /**
   * [session 53, brief §3] Largest single `energyCollectable` in the bank at
   * read time. Null when the bank was never read.
   *
   * Together with `headroom` this closes the standing "overflow past the 420
   * cap is non-wasting" question BY CONSTRUCTION for this code path instead
   * of by experiment: if `maxSnapshot < headroom`, no single claim this
   * function can make is capable of reaching the cap, so the untested comment
   * is unreachable from here and cannot be tripped by accident. If it is
   * larger, the overflow case IS reachable and can be run deliberately, once,
   * with the numbers recorded — and that still needs asking first.
   */
  maxSnapshot: number | null;
  /** [session 53, brief §3] `maxEnergy - poolBefore` — how much the pool can absorb before capping. Null when the cap is unknown. */
  headroom: number | null;
  /**
   * [session 54, brief §4] `maxSnapshot >= headroom` — is the untested
   * "overflow past the cap is non-wasting" path reachable at all right now?
   * Null when either input is unknown (the bank was never read, or the cap is
   * not reported).
   *
   * This is the condition that makes DESCENDING safe as the default claim
   * order: descending claims the largest ROM first, so if the largest ROM
   * cannot reach the cap, nothing this function does can. Measured false on
   * both session-53 live runs (315 < 394).
   *
   * Derived rather than left to each call site to recompute — session 51's
   * `serverErrorDetail` lesson is that a rule applied in one place and not
   * its sibling is this repo's most recurrent defect shape. It is computed
   * on EVERY return path, including the two that claim nothing, so "we did
   * not claim" never silently means "we did not check".
   */
  overflowReachable: boolean | null;
}

/** [session 52 §1a] Which end of the bank `ensureEnergyFor` claims from. */
export type ClaimOrder = "ascending" | "descending";

/**
 * Fail-closed stop. Thrown when the pool cannot fund the planned batch even
 * after claiming, or when a claim itself failed. Never swallowed here — a
 * stopped bot costs nothing (CLAUDE.md §5).
 */
export class EnergyPreflightError extends Error {
  constructor(
    message: string,
    readonly detail: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EnergyPreflightError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** CLAUDE.md §7: minimum 1200ms between actions, plus 0-400ms jitter. */
const paceMs = () => 1200 + Math.random() * 400;

/**
 * Ensures the account's energy pool can fund `requiredEnergy`, claiming ROM
 * energy if it can't.
 *
 * Order of operations, and why:
 *  1. Read the pool. If it already covers the batch, **return without reading
 *     the ROM bank at all** — the common case costs exactly one GET.
 *  2. Read the bank. If pool + bank still can't cover the batch, throw before
 *     claiming anything: claiming into a short pool just spends requests to
 *     arrive at the same stop.
 *  3. Claim in `opts.order` by `energyCollectable` — **descending by default**,
 *     stopping as soon as the claimed snapshots cover the deficit. The biggest
 *     wins land first, so an interrupted pass still made the most progress it
 *     could (same rationale as `scripts/claimAllRoms.ts`, which this
 *     deliberately does not replace: that script is still the right tool for
 *     draining the whole bank).
 *
 *     [session 52 §1a] `order: "ascending"` inverts that, and `maxClaims`
 *     bounds the loop. Ascending is NOT a better default — it is the right
 *     posture for a *first live exercise* of an unproven path, and for nothing
 *     else. Session 52's live claim had a 53-energy deficit against a
 *     2496-energy bank: descending would have claimed exactly one ROM (docId
 *     4543, snapshot 315, the largest single accrual on the account), pointing
 *     a never-executed code path at the most valuable asset in the bank and
 *     leaving the claim *loop* — pacing, running total, break condition, the
 *     `success: false` check — untested while reporting "claim path verified".
 *     Ascending claimed 13 + 26 + 30 instead. Once the path is proven, the
 *     descending rationale is the better one again, which is why omitting
 *     `order` and `maxClaims` is byte-for-byte the session-47 behaviour.
 *  4. Re-read the pool and verify against the real number, not the snapshots.
 *     A snapshot is a read-time estimate; the 420 cap and in-flight regen both
 *     make the measured delta the only figure worth gating on.
 *
 * Overflow past the 420 cap is CONFIRMED non-wasting (DECISIONS 2026-08-17,
 * sessions 21/22) — whatever doesn't fit stays banked in the ROM — so there is
 * no cap-aware batching to do and no reason to under-claim.
 */
export async function ensureEnergyFor(
  requiredEnergy: number,
  deps: EnergyPreflightDeps,
  opts: { readOnly?: boolean; order?: ClaimOrder; maxClaims?: number } = {},
): Promise<EnergyPreflightResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const log = deps.log ?? (() => {});
  const order: ClaimOrder = opts.order ?? "descending";
  // Unbounded by default. `claimedDocIds.length >= Infinity` is never true and
  // the fallback below is reachable only through that same condition, so an
  // omitted `maxClaims` cannot change a single request the session-47 code
  // would have made.
  const maxClaims = opts.maxClaims ?? Number.POSITIVE_INFINITY;
  // [session 51 §5] `readOnly` runs every READ and every verdict — pool, ROM
  // bank, the sufficiency arithmetic, the "cannot fund" halt — and claims
  // NOTHING. It exists so `scripts/liveRun.ts --dry-run` can exercise this
  // path, which it previously skipped outright: the dry run's whole purpose is
  // to find a dead classifier before a real entry pays for it, and a step the
  // dry run steps over is a step the dry run cannot vouch for.
  const readOnly = opts.readOnly ?? false;

  const poolBefore = await deps.getEnergy();
  // [session 53, brief §3] `getMaxEnergy` reads a value the `getEnergy` call
  // above already fetched — no extra request, and null when unavailable
  // rather than a guessed 420.
  const maxEnergy = deps.getMaxEnergy?.() ?? null;
  const headroom = maxEnergy === null ? null : maxEnergy - poolBefore;
  /** Null until the bank is read — with no bank there is no largest ROM to compare. */
  const overflowReachableFor = (max: number | null): boolean | null => (max === null || headroom === null ? null : max >= headroom);
  if (poolBefore >= requiredEnergy) {
    log(`  ▸ energy preflight: pool ${poolBefore} covers the planned ${requiredEnergy} — no ROM claim needed.`);
    return {
      requiredEnergy,
      poolBefore,
      poolAfter: poolBefore,
      alreadySufficient: true,
      bankTotal: null,
      claimedDocIds: [],
      claimedSnapshotTotal: 0,
      claimOrder: order,
      fallbackClaimDocId: null,
      claims: [],
      maxSnapshot: null,
      headroom,
      overflowReachable: overflowReachableFor(null),
    };
  }

  const deficit = requiredEnergy - poolBefore;
  log(`  ▸ energy preflight: pool ${poolBefore} short of the planned ${requiredEnergy} (deficit ${deficit}) — reading the ROM bank.`);

  await sleep(paceMs());
  const bank = await deps.getRomBank();
  const claimable = bank
    .filter((r) => r.energyCollectable > 0)
    .sort((a, b) => (order === "ascending" ? a.energyCollectable - b.energyCollectable : b.energyCollectable - a.energyCollectable));
  const bankTotal = claimable.reduce((s, r) => s + r.energyCollectable, 0);
  const maxSnapshot = claimable.reduce((m, r) => Math.max(m, r.energyCollectable), 0);
  if (headroom !== null) {
    log(`  ▸ cap headroom: largest single ROM snapshot ${maxSnapshot}, pool headroom ${headroom}.`);
    // [session 54, brief §4] The condition that makes a decision safe should
    // announce when it stops holding — the same reasoning as session 53's
    // first-attempt telemetry. `descending` became the default claim order
    // BECAUSE `maxSnapshot < headroom` held on every measured run; if the
    // bank ever grows a ROM larger than the headroom, that default silently
    // starts being able to reach the untested overflow path, and it should
    // say so out loud rather than becoming reachable again in silence.
    if (overflowReachableFor(maxSnapshot)) {
      log(
        `  ⚠ WARN overflow reachable: the largest single ROM (${maxSnapshot}) is >= the pool headroom (${headroom}), ` +
          `so one claim can now reach the energy cap. The "overflow past the cap is non-wasting" path is UNTESTED — ` +
          `this is the condition that made "descending" safe as the default claim order, and it no longer holds.`,
      );
    } else {
      log(`    no single claim can reach the cap — overflow unreachable from this path.`);
    }
  }
  log(
    `  ▸ ROM bank: ${bank.length} ROMs, ${claimable.length} with energyCollectable > 0, ${bankTotal} energy claimable` +
      ` (claiming ${order}${Number.isFinite(maxClaims) ? `, max ${maxClaims} claims` : ""}).`,
  );

  if (poolBefore + bankTotal < requiredEnergy) {
    throw new EnergyPreflightError(
      `energy preflight: pool ${poolBefore} + ROM bank ${bankTotal} cannot fund the planned ${requiredEnergy}`,
      { requiredEnergy, poolBefore, bankTotal, romsWithBalance: claimable.length },
    );
  }

  const claimedDocIds: string[] = [];
  const claims: { docId: string; snapshot: number; fallback: boolean }[] = [];
  let claimedSnapshotTotal = 0;
  let fallbackClaimDocId: string | null = null;
  if (readOnly) {
    // Report exactly what a real invocation WOULD claim, without claiming it.
    const wouldClaim: string[] = [];
    let wouldTotal = 0;
    for (const rom of claimable) {
      if (wouldTotal >= deficit) break;
      if (wouldClaim.length >= maxClaims) break;
      wouldClaim.push(rom.docId);
      wouldTotal += rom.energyCollectable;
    }
    const wouldFallback = wouldTotal < deficit && wouldClaim.length >= maxClaims ? largestRemaining(claimable, new Set(wouldClaim)) : undefined;
    if (wouldFallback) wouldTotal += wouldFallback.energyCollectable;
    log(
      `  ▸ [read-only] would claim ${wouldClaim.length + (wouldFallback ? 1 : 0)} ROM(s) for a snapshot total of ` +
        `${wouldTotal}/${deficit}${wouldFallback ? ` (incl. largest-remaining fallback ${wouldFallback.docId})` : ""}; claiming NOTHING.`,
    );
    return {
      requiredEnergy,
      poolBefore,
      poolAfter: poolBefore,
      alreadySufficient: false,
      bankTotal,
      claimedDocIds: [],
      claimedSnapshotTotal: 0,
      claimOrder: order,
      fallbackClaimDocId: null,
      claims: [],
      maxSnapshot,
      headroom,
      overflowReachable: overflowReachableFor(maxSnapshot),
    };
  }

  const claimOne = async (rom: RomBankEntry, fallback: boolean) => {
    await sleep(paceMs());
    try {
      await deps.claimRom(rom.docId);
    } catch (e) {
      throw new EnergyPreflightError(`energy preflight: ROM claim failed for docId ${rom.docId} — refusing to proceed with a short pool`, {
        requiredEnergy,
        poolBefore,
        docId: rom.docId,
        snapshot: rom.energyCollectable,
        claimedDocIds,
        claimedSnapshotTotal,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    claimedDocIds.push(rom.docId);
    claims.push({ docId: rom.docId, snapshot: rom.energyCollectable, fallback });
    claimedSnapshotTotal += rom.energyCollectable;
    log(
      `    · claimed ${rom.docId} (snapshot ${rom.energyCollectable})${fallback ? " [largest-remaining fallback]" : ""}` +
        `; running total ${claimedSnapshotTotal}/${deficit}`,
    );
  };

  for (const rom of claimable) {
    if (claimedSnapshotTotal >= deficit) break;
    if (claimedDocIds.length >= maxClaims) break;
    await claimOne(rom, false);
  }

  // [session 52 §1a] Bounded-and-still-short. Not a fail-closed case: closing
  // the gap with the single largest remaining ROM is exactly what a descending
  // pass would have done anyway — reached deliberately and logged, instead of
  // either looping unbounded or throwing on a deficit the bank can cover.
  if (claimedSnapshotTotal < deficit && claimedDocIds.length >= maxClaims) {
    const largest = largestRemaining(claimable, new Set(claimedDocIds));
    if (largest) {
      log(
        `  ▸ maxClaims (${maxClaims}) reached at ${claimedSnapshotTotal}/${deficit} — falling back to the largest remaining ROM ` +
          `${largest.docId} (snapshot ${largest.energyCollectable}) to close the deficit in one step.`,
      );
      fallbackClaimDocId = largest.docId;
      await claimOne(largest, true);
    }
  }

  await sleep(paceMs());
  const poolAfter = await deps.getEnergy();
  log(`  ▸ energy preflight: pool ${poolBefore} -> ${poolAfter} after ${claimedDocIds.length} claim(s) (measured +${poolAfter - poolBefore}).`);

  if (poolAfter < requiredEnergy) {
    throw new EnergyPreflightError(`energy preflight: pool ${poolAfter} still short of the planned ${requiredEnergy} after claiming`, {
      requiredEnergy,
      poolBefore,
      poolAfter,
      bankTotal,
      claimedDocIds,
      claimedSnapshotTotal,
    });
  }

  return {
    requiredEnergy,
    poolBefore,
    poolAfter,
    alreadySufficient: false,
    bankTotal,
    claimedDocIds,
    claimedSnapshotTotal,
    claimOrder: order,
    fallbackClaimDocId,
    claims,
    maxSnapshot,
    headroom,
    overflowReachable: overflowReachableFor(maxSnapshot),
  };
}

/** The biggest ROM in `claimable` not already claimed. Undefined when the bank is exhausted. */
function largestRemaining(claimable: RomBankEntry[], taken: Set<string>): RomBankEntry | undefined {
  let best: RomBankEntry | undefined;
  for (const rom of claimable) {
    if (taken.has(rom.docId)) continue;
    if (!best || rom.energyCollectable > best.energyCollectable) best = rom;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Adapter from the real client.
// ---------------------------------------------------------------------------

/**
 * The three `GigaverseClient` methods this needs, described structurally so
 * `src/orchestrator/` keeps its zero imports from `src/api/` and the module
 * above stays mockable without a client at all. Both live scripts pass the
 * real client here.
 */
export interface RomEnergyClient {
  // [session 53] `maxEnergy` is OPTIONAL in this structural type even though
  // the real `EnergySchema` requires it — tests build minimal energy stubs,
  // and `headroom` degrades to null rather than failing when it is absent.
  getEnergy(address: string): Promise<{ entities: { parsedData: { energyValue: number; maxEnergy?: number } }[] }>;
  getRomsPlayer(address: string): Promise<{ entities: { docId: string; factoryStats: { energyCollectable: number } }[] }>;
  claimRomEnergy(romId: string, amount?: number): Promise<{ success: boolean }>;
}

/**
 * Wires a real client into `ensureEnergyFor`. The `success: false` check on
 * the claim matters: `POST /roms/factory-claim` returns 200 with a
 * `success` flag, so a rejected claim is not an HTTP error and would
 * otherwise pass silently as a claim that moved nothing.
 */
export function clientEnergyPreflightDeps(client: RomEnergyClient, address: string, log?: (line: string) => void): EnergyPreflightDeps {
  // [session 53, brief §3] Captured from the `getEnergy` response so
  // `headroom` costs no extra request. Null until the first read.
  let lastMaxEnergy: number | null = null;
  return {
    getEnergy: async () => {
      const energy = await client.getEnergy(address);
      const value = energy.entities[0]?.parsedData?.energyValue;
      if (typeof value !== "number") {
        throw new Error("GET /offchain/player/energy — entities[0].parsedData.energyValue missing or not a number");
      }
      const max = energy.entities[0]?.parsedData?.maxEnergy;
      lastMaxEnergy = typeof max === "number" ? max : null;
      return value;
    },
    getMaxEnergy: () => lastMaxEnergy,
    getRomBank: async () => {
      const roms = await client.getRomsPlayer(address);
      return roms.entities.map((e) => ({ docId: e.docId, energyCollectable: e.factoryStats.energyCollectable }));
    },
    claimRom: async (docId) => {
      const res = await client.claimRomEnergy(docId, 0);
      if (!res.success) throw new Error(`POST /roms/factory-claim returned success=false for docId ${docId}`);
    },
    log,
  };
}
