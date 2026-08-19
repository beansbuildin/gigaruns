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
  /** ROMs actually claimed, in the order they were claimed (descending by snapshot). */
  claimedDocIds: string[];
  /** Sum of the *snapshot* `energyCollectable` of the claimed ROMs — an estimate; `poolAfter - poolBefore` is the measured truth. */
  claimedSnapshotTotal: number;
}

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
 *  3. Claim in descending order by `energyCollectable`, stopping as soon as the
 *     claimed snapshots cover the deficit — the biggest wins land first, so an
 *     interrupted pass still made the most progress it could (same rationale as
 *     `scripts/claimAllRoms.ts`, which this deliberately does not replace: that
 *     script is still the right tool for draining the whole bank).
 *  4. Re-read the pool and verify against the real number, not the snapshots.
 *     A snapshot is a read-time estimate; the 420 cap and in-flight regen both
 *     make the measured delta the only figure worth gating on.
 *
 * Overflow past the 420 cap is CONFIRMED non-wasting (DECISIONS 2026-08-17,
 * sessions 21/22) — whatever doesn't fit stays banked in the ROM — so there is
 * no cap-aware batching to do and no reason to under-claim.
 */
export async function ensureEnergyFor(requiredEnergy: number, deps: EnergyPreflightDeps): Promise<EnergyPreflightResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const log = deps.log ?? (() => {});

  const poolBefore = await deps.getEnergy();
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
    };
  }

  const deficit = requiredEnergy - poolBefore;
  log(`  ▸ energy preflight: pool ${poolBefore} short of the planned ${requiredEnergy} (deficit ${deficit}) — reading the ROM bank.`);

  await sleep(paceMs());
  const bank = await deps.getRomBank();
  const claimable = bank.filter((r) => r.energyCollectable > 0).sort((a, b) => b.energyCollectable - a.energyCollectable);
  const bankTotal = claimable.reduce((s, r) => s + r.energyCollectable, 0);
  log(`  ▸ ROM bank: ${bank.length} ROMs, ${claimable.length} with energyCollectable > 0, ${bankTotal} energy claimable.`);

  if (poolBefore + bankTotal < requiredEnergy) {
    throw new EnergyPreflightError(
      `energy preflight: pool ${poolBefore} + ROM bank ${bankTotal} cannot fund the planned ${requiredEnergy}`,
      { requiredEnergy, poolBefore, bankTotal, romsWithBalance: claimable.length },
    );
  }

  const claimedDocIds: string[] = [];
  let claimedSnapshotTotal = 0;
  for (const rom of claimable) {
    if (claimedSnapshotTotal >= deficit) break;
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
    claimedSnapshotTotal += rom.energyCollectable;
    log(`    · claimed ${rom.docId} (snapshot ${rom.energyCollectable}); running total ${claimedSnapshotTotal}/${deficit}`);
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

  return { requiredEnergy, poolBefore, poolAfter, alreadySufficient: false, bankTotal, claimedDocIds, claimedSnapshotTotal };
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
  getEnergy(address: string): Promise<{ entities: { parsedData: { energyValue: number } }[] }>;
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
  return {
    getEnergy: async () => {
      const energy = await client.getEnergy(address);
      const value = energy.entities[0]?.parsedData?.energyValue;
      if (typeof value !== "number") {
        throw new Error("GET /offchain/player/energy — entities[0].parsedData.energyValue missing or not a number");
      }
      return value;
    },
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
