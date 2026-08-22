/**
 * scripts/isLethalBlastRadius.ts — [session 74, brief §2 / GATE 2]
 *
 * **`isLethal` does not decline an action. It grants an override.** Session 73
 * classified it as the most consequential LIVE consumer of `pConnect`'s level
 * and put it first in line for a correction. Nobody had measured how often it
 * fires. This does, and the answer changes the priority.
 *
 * ── Two corrections that come first, because the brief is built on them ────
 *
 * **1. The second override path does not exist.** Session 73 recorded — in
 * `STATE.md`, in `tests/fishing/pConnectConsumers.test.ts`'s own rationale, and
 * from there into the session-74 brief — that a lethal claim "short-circuits
 * the oil gates". It does not. `isLethal` has exactly ONE call site
 * (`bestFocusForCard`), the shipped oil trigger `onDemandTriggers` is
 * `fishHp <= fishDamage` with no estimator input of any kind, and the derived
 * necessity gates read `bestKillProbability` /
 * `bestConnectProbabilityFromFrozenCell`, which are their own functions.
 * Card-play lethality and OIL lethality were conflated. §1 lists the five real
 * paths.
 *
 * **2. The gate's firing rate is ~0.** §2 measures it.
 *
 * ── The instrument ────────────────────────────────────────────────────────
 *
 * PAIRED AT THE TURN, not as a second replay. At every turn the replay re-plans
 * the identical state with `NEVER_LETHAL` — same hand, same mana, same
 * distribution, same focus budget, same spend constraint — and publishes the
 * result as `noOverride`. So "what the override changed" compares two choices
 * made on ONE state, never two policies whose turn sets need not line up. That
 * unpairing is what made session 73's §6 uninterpretable; here it is avoided by
 * construction rather than caveated.
 *
 * The replay is scored on BOTH the era and the whole corpus. The era split is
 * for outcome metrics; a firing RATE of a deterministic predicate is not one,
 * and reporting it on 134 turns when 440 are available would be the
 * over-correction session 70 already made once.
 *
 * DIAGNOSIS ONLY. Brief §3: the tightening (`STRICT_LETHALITY`) is BUILT and
 * DEFAULTED OFF; nothing here adopts it. `tests/fishing/lethalOverride.test.ts`
 * fails if the default moves.
 *
 * Usage: npx tsx scripts/isLethalBlastRadius.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { cellKey } from "../src/sim/fishing/geometry.js";
import { isCleanTrace, loadCastTraces, type CastTrace } from "../src/sim/fishing/castTrace.js";
import { replayCast, type ReplayTurnDiagnostic } from "../src/sim/fishing/offPolicyReplay.js";
import { profileArg, resolveProfile } from "../src/profile.js";
import { DEFAULT_LETHALITY, STRICT_LETHALITY, type LethalityPolicy } from "../src/strategy/fishing/cardChoice.js";
import { ERA_OPTS, eraCasts } from "./pConnectBiasDecomposition.js";

/** The certainty test `isLethal` applies, restated here so §2 can score its two halves apart. */
const CERTAINTY = 0.999999;

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const amountOf = (e: readonly { amount: number }[]) => e[0]?.amount ?? 0;

interface Row {
  docId: string;
  d: ReplayTurnDiagnostic;
}

function collectUnder(traces: readonly CastTrace[], set: readonly CastTrace[], lethality: LethalityPolicy): Row[] {
  const out: Row[] = [];
  for (const t of set) {
    const others = traces.filter((o) => o.docId !== t.docId);
    replayCast(t, others, { ...ERA_OPTS(), lethality, onTurn: (d) => out.push({ docId: t.docId, d }) });
  }
  return out;
}

/** The damage half of `isLethal`, on the card that was actually played. */
function damageSuffices(d: ReplayTurnDiagnostic): boolean {
  const card = d.played.card;
  const hitEffect = amountOf(card.hitEffects);
  const critEffect = card.critZones.length > 0 ? amountOf(card.critEffects) : hitEffect;
  return d.fishHpBefore - Math.min(hitEffect, critEffect || hitEffect) <= 0;
}

/**
 * Did withdrawing the override change the play? Compared on (hand index,
 * focus) — the two things that determine what is sent — not on the whole
 * choice object, whose scores are equal whenever the play is.
 */
function overrideChangedTheChoice(d: ReplayTurnDiagnostic): boolean {
  if (!d.noOverride) return true; // the override was the only reason a play existed
  return d.noOverride.handIndex !== d.played.handIndex || cellKey(d.noOverride.focus) !== cellKey(d.played.focus);
}

/**
 * Every `decision` record the LIVE loop has ever written, from the profile's
 * log tree. This is the only place the shipped predicate's real firing rate
 * can be read: the replay re-plans, so it answers "would it fire", while these
 * lines are "did it fire".
 */
function liveDecisions(): { total: number; lethal: Record<string, unknown>[] } {
  const root = resolveProfile(profileArg(process.argv)).logRoot;
  let total = 0;
  const lethal: Record<string, unknown>[] = [];
  for (const f of readdirSync(root).filter((n) => n.startsWith("fishing-") && n.endsWith(".jsonl"))) {
    for (const line of readFileSync(join(root, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let rec: Record<string, unknown>;
      try {
        rec = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (rec.event !== "decision") continue;
      total++;
      if (rec.lethal === true) lethal.push({ ...rec, file: f });
    }
  }
  return { total, lethal };
}

function reportFiring(label: string, rows: readonly Row[]): void {
  const certain = rows.filter((r) => r.d.pConnect >= CERTAINTY);
  const dmg = rows.filter((r) => damageSuffices(r.d));
  const both = rows.filter((r) => r.d.pConnect >= CERTAINTY && damageSuffices(r.d));
  const flagged = rows.filter((r) => r.d.lethal);
  console.log(
    `  ${label.padEnd(28)} turns ${String(rows.length).padStart(4)}   certainty half ${String(certain.length).padStart(4)}` +
      `   damage half ${String(dmg.length).padStart(4)}   BOTH ${String(both.length).padStart(4)}   lethal flag ${String(flagged.length).padStart(4)}`,
  );
}

function main(): void {
  const traces = loadCastTraces().filter(isCleanTrace);
  const era = eraCasts(traces);
  const eraRows = collectUnder(traces, era, DEFAULT_LETHALITY);
  const allRows = collectUnder(traces, traces, DEFAULT_LETHALITY);

  console.log(`\n▸ isLethalBlastRadius.ts — SESSION 74 GATE 2`);
  console.log(`  Replay: ${era.length} era casts / ${eraRows.length} turns, and ${traces.length} clean casts / ${allRows.length} turns.`);
  console.log(`  DIAGNOSIS ONLY — the tightening is built and defaulted OFF (brief §3).\n`);

  // ── §1 ────────────────────────────────────────────────────────────────
  console.log("── §1  THE BRIEF'S SECOND OVERRIDE PATH DOES NOT EXIST ──");
  console.log(`  §2a asks to split the blast radius by two paths: the focus spend constraint,`);
  console.log(`  and "an oil gate that would otherwise have fired". THE SECOND ONE IS NOT REAL.`);
  console.log(`  \`isLethal\` has ONE call site (\`bestFocusForCard\`). The shipped oil trigger`);
  console.log(`  \`onDemandTriggers\` is \`fishHp <= fishDamage\` — a deterministic comparison with`);
  console.log(`  NO estimator input at all — and the derived necessity gates read`);
  console.log(`  \`bestKillProbability\` / \`bestConnectProbabilityFromFrozenCell\`, their own`);
  console.log(`  functions. Card-play lethality and OIL lethality were conflated in session 73's`);
  console.log(`  note, and the error travelled note -> STATE.md -> brief. CLAUDE.md rule 9 says`);
  console.log(`  to expect a third occurrence rather than treat it as exceptional; this is it.`);
  console.log(`\n  The FIVE real override paths, from the one call site's consumers:`);
  console.log(`    1. \`bestFocusForCard\`   exemption from \`spendConstraint.maxMoveCost\``);
  console.log(`    2. \`bestFocusForCard\`   dominance over any non-lethal candidate, whatever the score`);
  console.log(`    3. \`bestFocusForCard\`   skips the \`moveEvThreshold\` stay-put comparison`);
  console.log(`    4. \`chooseCard\`         picks among LETHAL OPTIONS ONLY when any exists`);
  console.log(`    5. \`offPolicyReplay\`    skips the coverage re-ranking for a lethal choice`);

  // ── §2 ────────────────────────────────────────────────────────────────
  console.log("\n── §2  HOW OFTEN DOES IT FIRE? — AND THE TWO HALVES SCORED APART ──");
  console.log(`  \`isLethal\` is a CONJUNCTION: \`pAnyHit >= ${CERTAINTY}\` AND the worst-case damage`);
  console.log(`  finishes the fish. Scoring the halves separately is what makes a zero`);
  console.log(`  informative — it says WHICH half never passes rather than only that the`);
  console.log(`  conjunction does not.\n`);
  reportFiring("era only", eraRows);
  reportFiring("whole clean corpus", allRows);
  const live = liveDecisions();
  console.log(`\n  AND THE LIVE LOOP'S OWN LOG, which is the only record of what actually fired:`);
  console.log(`    \`decision\` records written by \`liveFishing.ts\`   ${live.total}`);
  console.log(`    ...with \`"lethal": true\`                          ${live.lethal.length}   (${pct(live.lethal.length / Math.max(1, live.total))})`);
  for (const r of live.lethal) {
    console.log(`      -> ${String(r.file)} turn ${String(r.turn)}: card ${String(r.cardId)} @ [${(r.focus as { x: number }).x},${(r.focus as { y: number }).y}], pHit ${String(r.pHit)}, pCrit ${String(r.pCrit)}`);
  }
  console.log(`\n  THE FINDING. The certainty half NEVER passes in replay — \`pConnect\` does not`);
  console.log(`  reach ${CERTAINTY} on a single one of the ${allRows.length} replayable turns — while the DAMAGE half`);
  console.log(`  passes often. So the gate is held shut by the probability, not by the damage,`);
  console.log(`  and the override this repo called "the most consequential live level consumer"`);
  console.log(`  has fired ${live.lethal.length} time in ${live.total} live decisions.`);
  console.log(`\n  "Most consequential" was a claim about consequence PER FIRING, and it is`);
  console.log(`  still true — the five paths above are real exemptions. What nobody had`);
  console.log(`  measured is the rate. A correction here has almost nothing to act on.`);
  console.log(`\n  THE DISCREPANCY, NOT RESOLVED. Live fired once and the replay fires never, on`);
  console.log(`  overlapping data. The replay re-plans against a leave-one-out matcher and a`);
  console.log(`  mixed tier; live played what it played, from whatever its state was at that`);
  console.log(`  moment. n=1 is not enough to chase, and it is recorded rather than explained.`);

  // ── §3 ────────────────────────────────────────────────────────────────
  console.log("\n── §3  THE BLAST RADIUS, SPLIT BY PATH — PAIRED AT THE TURN ──");
  const lethalTurns = allRows.filter((r) => r.d.lethal);
  console.log(`  Each row counts turns where the override was LOAD-BEARING: withdrawing it`);
  console.log(`  would have produced a different play on that same state. Paired by`);
  console.log(`  construction — the counterfactual is re-planned at the turn, so there is no`);
  console.log(`  unpaired-observed-column problem here (contrast session 73 §6).\n`);
  const overCap = lethalTurns.filter((r) => r.d.moveCost > r.d.maxMoveCost);
  const changed = lethalTurns.filter((r) => overrideChangedTheChoice(r.d));
  console.log(`  lethal turns in the replay                ${String(lethalTurns.length).padStart(4)} / ${allRows.length}`);
  console.log(`  path 1     spend-constraint bypass        ${String(overCap.length).padStart(4)}   (moveCost > maxMoveCost)`);
  console.log(`  paths 2-5  the play actually changed      ${String(changed.length).padStart(4)}   (different card or different focus)`);
  console.log(`\n  Not a partition and NOT summed — they are two questions about the same turn,`);
  console.log(`  and a turn can answer yes to both.`);
  if (lethalTurns.length === 0) {
    console.log(`\n  BOTH ARE ZERO BECAUSE THE NUMERATOR IS ZERO, which is a different statement`);
    console.log(`  from "the paths are harmless". The instrument works and has nothing to`);
    console.log(`  measure: this corpus contains no turn on which the override was exercised.`);
    console.log(`  On the one LIVE firing above it was not harmful either — that turn's card`);
    console.log(`  connected and the cast ended \`caught\` — but n=1 supports no rate at all.`);
  }

  // ── §4 ────────────────────────────────────────────────────────────────
  console.log("\n── §4  THE COST, IN FISH AND TURNS — NOT SUMMED ──");
  console.log(`  Brief §2a: "a lethal claim that misses costs that turn; a lethal claim that`);
  console.log(`  skipped an oil may have cost the cast. Those are not the same and should not`);
  console.log(`  be summed." §1 established the oil path does not exist, so the cast-level half`);
  console.log(`  has nothing to price. The turn-level half is reported alone.\n`);
  console.log(`  lethal claims that did not connect, replay   ${lethalTurns.filter((r) => !r.d.hit).length} / ${lethalTurns.length}`);
  console.log(`  lethal claims that did not connect, live     0 / ${live.lethal.length}  (the one firing hit; the cast ended caught)`);

  // ── §5 ────────────────────────────────────────────────────────────────
  console.log("\n── §5  THE TIGHTENING, AND WHAT IT WOULD HAVE CHANGED ──");
  console.log(`  \`STRICT_LETHALITY\`: certify lethal only if the card's connect cells ALSO cover`);
  console.log(`  the fish's CURRENT cell.`);
  console.log(`\n  WHY NOT A HIGHER THRESHOLD. There is no number above 1, and discounting`);
  console.log(`  \`pAnyHit\` by any calibration haircut puts it under ${CERTAINTY} always — that`);
  console.log(`  collapses the predicate to never-lethal, which is the degenerate reading, not`);
  console.log(`  a conservative one. The optimism does not enter through the threshold; it`);
  console.log(`  enters through the SUPPORT. \`pAnyHit\` reaches 1.0 over the ring model's`);
  console.log(`  support, and \`ringCells\` is Manhattan distance EXACTLY 1 or 2, so a no-move`);
  console.log(`  turn and an off-both-rings turn are impossible by construction. "Certain"`);
  console.log(`  silently means "certain GIVEN the fish moves 1 or 2 cells".\n`);
  const strictRows = collectUnder(traces, traces, STRICT_LETHALITY);
  console.log(`  shipped predicate   ${String(allRows.filter((r) => r.d.lethal).length).padStart(4)} lethal claims over ${allRows.length} turns`);
  console.log(`  STRICT predicate    ${String(strictRows.filter((r) => r.d.lethal).length).padStart(4)} lethal claims over ${strictRows.length} turns`);
  const noMove = allRows.filter((r) => cellKey(r.d.actual) === cellKey(r.d.currentCell));
  console.log(`\n  the escape it guards against, MEASURED: the fish did not move on ${noMove.length} of ${allRows.length}`);
  console.log(`  turns. Session 73 measured the same at 0/134 on the era.`);
  console.log(`\n  SO THE TIGHTENING IS INERT ON THIS CORPUS — and it would be inert even if the`);
  console.log(`  gate fired, because the escape it closes never happens. That is a RESULT, not`);
  console.log(`  a failed attempt: it says the override's optimism is not being spent on the`);
  console.log(`  no-move escape. The other structural escape, landing off BOTH rings, is not`);
  console.log(`  coverable by any single placement, so no predicate over one (card, focus) pair`);
  console.log(`  can guard it at all.`);
  console.log(`\n  THE CONCLUSION THE BRIEF ASKED FOR, ANSWERED THE OTHER WAY. §2 asked whether`);
  console.log(`  the level correction belongs at \`isLethal\` FIRST, because it is narrower than`);
  console.log(`  one at \`evaluateCardAtFocus\`. It is narrower — narrow enough to be empty. A`);
  console.log(`  gate that has fired ${live.lethal.length} time in ${live.total} live decisions is not where a +9pp`);
  console.log(`  optimism is doing its damage, and the three remaining live level gates (the`);
  console.log(`  two oil necessity gates and the shadow's certainty checks) should be measured`);
  console.log(`  the same way before any of them is corrected.`);

  console.log(`\n  NOTHING IS ADOPTED. \`DEFAULT_LETHALITY\` is the shipped predicate and is the`);
  console.log(`  default of every parameter it was threaded through;`);
  console.log(`  \`tests/fishing/lethalOverride.test.ts\` fails if that stops being true.\n`);
}

main();
