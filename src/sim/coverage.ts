/**
 * src/sim/coverage.ts — fail-closed accounting for mechanics we cannot model.
 *
 * The rule (session-04 brief §4): anything the clean exchange model does not
 * cover is NOT approximated and NOT hardcoded to zero. It is a reason code, the
 * surrounding unit is marked UNSCORABLE, and the count is reported as a
 * headline metric.
 *
 * Hardcoded zeros produce a number that looks authoritative and is silently
 * biased toward room 1. Fail-closed without a coverage metric produces a sim
 * that quietly scores almost nothing. Coverage makes the blind spot a visible,
 * trackable quantity that should climb every session.
 */

export const REASONS = [
  /** `pickedBoons` non-empty — boon effects on stats are not modelled. */
  "BOON_TAKEN",
  /** `statusEffects` non-empty (e.g. Burn). Tick rate unknown. */
  "STATUS_EFFECT",
  /** evasion/block/lck/tenacity non-zero. Their damage effect is unexplained. */
  "ROLLED_STATS",
  /** `activeEnemyBuff` set on the run (e.g. shatterblade / Vulnerable). */
  "ENEMY_BUFF",
  /** `battleArmorReduction` non-zero. Semantics unknown. */
  "ARMOR_REDUCTION",
  /** activeEffects / triggeredBoons / gearBoons / focusBuffs non-empty. */
  "UNKNOWN_EFFECT",
  /**
   * Sim-only: under `chargesAreHardLimit` every move was locked at once. The
   * corpus never shows what the server does here, so we refuse to invent it.
   */
  "CHARGES_ALL_LOCKED",
  /** Sim-only: the run exceeded the room count the corpus can vouch for. */
  "DEPTH_BEYOND_CORPUS",
] as const;

export type Reason = (typeof REASONS)[number];

export const REASON_DETAIL: Record<Reason, string> = {
  BOON_TAKEN: "boon effects on stats are not modelled",
  STATUS_EFFECT: "Burn tick rate and its armor-regen interaction are unknown",
  ROLLED_STATS: "evasion/block/lck/tenacity affect damage by an unexplained rule",
  ENEMY_BUFF: "run-level enemy buff applies statuses we do not model",
  ARMOR_REDUCTION: "battleArmorReduction semantics unknown",
  UNKNOWN_EFFECT: "activeEffects/triggeredBoons/gearBoons/focusBuffs semantics unknown",
  CHARGES_ALL_LOCKED: "every move locked under chargesAreHardLimit; server behaviour unobserved",
  DEPTH_BEYOND_CORPUS: "room deeper than any the corpus reached",
};

/** A set of reasons, ordered by REASONS for stable reporting. */
export class ReasonSet {
  private readonly set = new Set<Reason>();

  add(r: Reason): this {
    this.set.add(r);
    return this;
  }

  addAll(rs: Iterable<Reason>): this {
    for (const r of rs) this.set.add(r);
    return this;
  }

  get clean(): boolean {
    return this.set.size === 0;
  }

  list(): Reason[] {
    return REASONS.filter((r) => this.set.has(r));
  }
}

/** The shape coverage cares about. A subset of the wire `players[]` entry. */
export interface CoverageProbe {
  pickedBoons?: unknown[];
  statusEffects?: unknown[];
  activeEffects?: unknown[];
  triggeredBoons?: unknown[];
  gearBoons?: unknown[];
  focusBuffs?: unknown[];
  battleArmorReduction?: number;
  evasion?: { current: number };
  block?: { current: number };
  lck?: { current: number };
  tenacity?: { current: number };
  intuition?: { current: number };
}

const nonEmpty = (v: unknown[] | undefined): boolean => Array.isArray(v) && v.length > 0;

/**
 * Reasons a single combatant's live state falls outside the clean model.
 *
 * NOTE the rolled stats are read from `.current`, never `.starting`. They are
 * `{current, starting}` pools and `starting` stays 0 even when `current` is
 * non-zero (enemy 65: starting 0, current 2). A check written against
 * `starting` reports a clean corpus and is wrong.
 */
export function probeCombatant(p: CoverageProbe): Reason[] {
  const out: Reason[] = [];
  if (nonEmpty(p.pickedBoons)) out.push("BOON_TAKEN");
  if (nonEmpty(p.statusEffects)) out.push("STATUS_EFFECT");
  if (
    (p.evasion?.current ?? 0) !== 0 ||
    (p.block?.current ?? 0) !== 0 ||
    (p.lck?.current ?? 0) !== 0 ||
    (p.tenacity?.current ?? 0) !== 0 ||
    (p.intuition?.current ?? 0) !== 0
  ) {
    out.push("ROLLED_STATS");
  }
  if ((p.battleArmorReduction ?? 0) !== 0) out.push("ARMOR_REDUCTION");
  if (
    nonEmpty(p.activeEffects) ||
    nonEmpty(p.triggeredBoons) ||
    nonEmpty(p.gearBoons) ||
    nonEmpty(p.focusBuffs)
  ) {
    out.push("UNKNOWN_EFFECT");
  }
  return out;
}

export interface RunProbe {
  activeEnemyBuff?: unknown;
  enemyStartingBuff?: unknown;
  perpetualBuffs?: unknown[];
}

export function probeRun(r: RunProbe): Reason[] {
  const buffed =
    (r.activeEnemyBuff ?? null) !== null ||
    (r.enemyStartingBuff ?? null) !== null ||
    nonEmpty(r.perpetualBuffs);
  return buffed ? ["ENEMY_BUFF"] : [];
}

/** Aggregated counts across many scored units, for the headline report. */
export class CoverageReport {
  scored = 0;
  unscorable = 0;
  readonly byReason = new Map<Reason, number>();

  record(reasons: Reason[]): void {
    if (reasons.length === 0) {
      this.scored++;
      return;
    }
    this.unscorable++;
    for (const r of reasons) this.byReason.set(r, (this.byReason.get(r) ?? 0) + 1);
  }

  get total(): number {
    return this.scored + this.unscorable;
  }

  /** Fraction of units the clean model can vouch for. 0 when nothing ran. */
  get fraction(): number {
    return this.total === 0 ? 0 : this.scored / this.total;
  }

  format(unit: string): string {
    const lines = [
      `scored ${this.scored} / ${this.total} ${unit} — ${this.unscorable} unscorable`,
    ];
    // A reason can co-occur with others, so these sum to >= unscorable.
    for (const r of REASONS) {
      const n = this.byReason.get(r);
      if (n) lines.push(`  ${String(n).padStart(6)}  ${r}  (${REASON_DETAIL[r]})`);
    }
    return lines.join("\n");
  }
}
