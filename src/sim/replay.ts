/**
 * src/sim/replay.ts — replay every recorded exchange through the combat model
 * and diff the prediction against what the server actually returned.
 *
 * This is the sim's ground truth. `scripts/verifyCombatModel.ts` does the same
 * job as a standalone script; this module exists so the same check runs inside
 * `vitest` against the shared loader, with coverage attached to every mismatch.
 */

import { resolveExchange } from "./combat.js";
import { CoverageReport, type Reason } from "./coverage.js";
import { exchanges, loadCorpus, toCombatant, type Exchange } from "./corpus.js";

export interface SideCheck {
  who: "me" | "foe";
  ok: boolean;
  predictedHp: number;
  predictedArmor: number;
  actualHp: number;
  actualArmor: number;
}

export interface ReplayCheck {
  run: string;
  label: string;
  myMove: string;
  foeMove: string;
  reasons: Reason[];
  sides: SideCheck[];
}

export function replayExchange(x: Exchange): ReplayCheck {
  const [bMe, bFoe] = x.before.run.players as [(typeof x.before.run.players)[0], (typeof x.before.run.players)[0]];
  const [aMe, aFoe] = x.after.run.players as [(typeof x.after.run.players)[0], (typeof x.after.run.players)[0]];

  const predicted = resolveExchange(
    { me: toCombatant(bMe), foe: toCombatant(bFoe), room: 0 },
    x.myMove,
    x.foeMove,
  ).state;

  const sides: SideCheck[] = [
    {
      who: "me",
      predictedHp: predicted.me.hp,
      predictedArmor: predicted.me.armor,
      actualHp: aMe.health.current,
      actualArmor: aMe.shield.current,
      ok: predicted.me.hp === aMe.health.current && predicted.me.armor === aMe.shield.current,
    },
    {
      who: "foe",
      predictedHp: predicted.foe.hp,
      predictedArmor: predicted.foe.armor,
      actualHp: aFoe.health.current,
      actualArmor: aFoe.shield.current,
      ok: predicted.foe.hp === aFoe.health.current && predicted.foe.armor === aFoe.shield.current,
    },
  ];

  return { run: x.run, label: x.label, myMove: x.myMove, foeMove: x.foeMove, reasons: x.reasons, sides };
}

export interface ReplayReport {
  checks: ReplayCheck[];
  /** Side-updates, the unit `verifyCombatModel.ts` counts in. */
  sideUpdates: number;
  matched: number;
  /** Mismatches that occurred inside the clean model — these are real bugs. */
  cleanFailures: ReplayCheck[];
  /** Mismatches on exchanges already marked unscorable — expected, not bugs. */
  unscorableFailures: ReplayCheck[];
  coverage: CoverageReport;
}

export function replayCorpus(root?: string): ReplayReport {
  const xs = exchanges(loadCorpus(root));
  const checks = xs.map(replayExchange);
  const coverage = new CoverageReport();

  let sideUpdates = 0;
  let matched = 0;
  const cleanFailures: ReplayCheck[] = [];
  const unscorableFailures: ReplayCheck[] = [];

  for (const c of checks) {
    coverage.record(c.reasons);
    for (const s of c.sides) {
      sideUpdates++;
      if (s.ok) matched++;
    }
    if (c.sides.some((s) => !s.ok)) {
      (c.reasons.length === 0 ? cleanFailures : unscorableFailures).push(c);
    }
  }

  return { checks, sideUpdates, matched, cleanFailures, unscorableFailures, coverage };
}
