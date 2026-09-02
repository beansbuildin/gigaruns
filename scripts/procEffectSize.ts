/**
 * PROC EFFECT SIZES — what the five rolled stats DO when they proc.
 *
 * [session 101 §B, QUESTIONS.md §58]
 *
 * ## The question this answers
 *
 * Session 100 (`scripts/procEvidence.ts`, QUESTIONS.md §57) established the
 * RATES at which each of the five rolled stats procs, and validated the
 * flag-to-stat mapping with a zero-stat control. It said plainly that a rate
 * is not a mechanic: nothing yet said what `block` DOES when `blockProc0`
 * reads true. This script measures that, from the same committed corpus, with
 * no live play.
 *
 * ## The instrument
 *
 * The same `data.events[]` array carries, alongside the `use_move` proc
 * booleans, the resolved arithmetic of the exchange:
 *
 *     {"type":"OnDamage","value":10,"playerId":0,
 *      "data":{"ignoreShield":false,"prevent":0,"source":""}}
 *
 * Two properties of that row make the measurement possible, both verified
 * rather than assumed:
 *
 * - **`playerId` on `OnDamage` names the VICTIM, not the dealer.** Checked
 *   against the state diff on `run-2026-08-15-01-53-36/state-012`: player 0
 *   entered with 0 shield, the events show `OnApplyShield 12` then
 *   `OnDamage 10` both at `playerId: 0`, and the response reports shield 2.
 * - **`data.source` separates combat damage (`""`, 2591 rows) from burn ticks
 *   (`"burn"`, 522 rows).** Every measurement here filters to `source === ""`;
 *   burn is a `statusEffects` mechanic and CAPTURE-1 lists it separately.
 *
 * `data.prevent` is NOT the block instrument, despite the name. It reads 0 on
 * all 2591 combat damage rows, including all 76 on which a block procced.
 *
 * ## The null, and why the comparison is matched
 *
 * `src/sim/combat.ts` resolves an exchange by RPS: the winner deals its move's
 * ATK, a tie has both deal, the loser deals nothing. So the baseline
 * prediction for damage taken is the ATTACKER's `currentATK` for the move it
 * played, read off the state that PRECEDED the exchange. On no-proc exchanges
 * that prediction is exact **2211 / 2285** times.
 *
 * Every comparison below is therefore restricted to exchanges in which the
 * attacker actually owed damage (won or tied), and each flag is additionally
 * compared against a control holding the SAME stat non-zero and unfired —
 * without that restriction, "fired" would silently also mean "in a room deep
 * enough to have rolled the stat at all".
 *
 * ## The residual, stated up front
 *
 * The 74 no-proc exchanges the null misses, and every one of the 6 proc
 * exchanges that misses its rule, carry a NON-EMPTY `statusEffects` array on
 * one side or the other. Restricting to status-clean exchanges, the rules
 * below hold **72 / 72**. That is the honest boundary of this measurement:
 * it characterises the proc mechanics and it does NOT characterise `Weak`,
 * `Vulnerable`, `Burn`, `Regen` or lifesteal, which remain exactly as open as
 * CAPTURE-1 has always listed them.
 *
 * ## What this does NOT do
 *
 * It writes nothing into the simulator. CAPTURE-1's prohibition — "do not stub
 * it, default it, or hide it behind a flag" — is unchanged, and STATE.md
 * session 100's open question 2 (should the live loop read the proc booleans
 * in real time) stays deferred. This is evidence a future session would need
 * before building that model properly, not a shortcut past it.
 *
 * Re-runnable as volume accumulates:  `npx tsx scripts/procEffectSize.ts`
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** RPS pairs in which the first move beats the second — SPEC §2. */
const BEATS = new Set(["rock>scissor", "scissor>paper", "paper>rock"]);

export type MoveName = "rock" | "paper" | "scissor";

export interface Exchange {
  /** `run-<stamp>/state-NNN.json`, the same identity `src/sim/corpus.ts` uses. */
  label: string;
  /** Every proc boolean on both `use_move` rows, merged. */
  flags: Record<string, boolean>;
  /** The move each side played. */
  moves: [string, string];
  /** `+1` player 0 won the RPS, `-1` player 1 won, `0` tie. */
  outcome: -1 | 0 | 1;
  /** Combat damage taken by each side (`source === ""` rows only, summed). */
  taken: [number, number];
  /** Burn damage taken by each side (`source === "burn"` rows) — a status mechanic, kept separate. */
  burn: [number, number];
  /** `{type: amount}` on the PRECEDING state, per side. See `scripts/statusEffects.ts` on what `amount` means. */
  beforeStatus: [Record<string, number>, Record<string, number>];
  /** The same, on the response itself — `Burn` ticks for its AFTER value, so both are needed. */
  afterStatus: [Record<string, number>, Record<string, number>];
  /** Each side's `currentATK` for the move it played, from the PRECEDING state. */
  atk: [number | null, number | null];
  /** Each side's rolled-stat values, from the preceding state. */
  stat: [Record<string, number | null>, Record<string, number | null>];
  /** True when NEITHER side carried a status effect — the clean measurement set. */
  statusClean: boolean;
  /** `OnHeal` value per side, when one was emitted. At most one row per side ever — checked across the corpus. */
  heal: Partial<Record<0 | 1, number>>;
  /** HP each side entered the exchange on, and its max. */
  hp: [number | null, number | null];
  /** True for a side that took at least as much damage as it had HP — it died this exchange. */
  died: [boolean, boolean];
  /** `BoonType` of every boon each side had picked as of the PRECEDING state. See `tenacityByBoon`. */
  boons: [string[], string[]];
}

const ROLLED_STATS = ["block", "evasion", "lck", "tenacity", "intuition"] as const;

const current = (side: Record<string, unknown>, key: string): number | null => {
  const raw = side[key];
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object" && typeof (raw as { current?: unknown }).current === "number") {
    return (raw as { current: number }).current;
  }
  return null;
};

interface WireEvent {
  type?: string;
  value?: unknown;
  playerId?: number;
  data?: Record<string, unknown>;
}

/** Whether `attacker` owed damage on this exchange — it won the RPS or tied. */
export const dealtDamage = (ex: Exchange, attacker: 0 | 1): boolean =>
  attacker === 0 ? ex.outcome >= 0 : ex.outcome <= 0;

export interface LoadOptions {
  runsRoot?: string;
  /** Scan only the N most recent run dirs. See `procEvidence.ts`'s note — this bounds what a TEST pays as an append-only corpus grows, nothing more. */
  maxRunDirs?: number;
}

/**
 * Every exchange in the corpus, paired with the state that preceded it.
 *
 * An exchange is a captured response carrying exactly two `use_move` events.
 * Session 101 §A established that this set is complete: every POST response in
 * which an exchange resolved carries `data.events`, 1919 of 1919, and the
 * 3215 states without it are all reads or non-exchange responses.
 */
export function loadExchanges(options: LoadOptions = {}): Exchange[] {
  const { runsRoot = join("fixtures", "dungeon-runs"), maxRunDirs } = options;
  const out: Exchange[] = [];

  const allDirs = readdirSync(runsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("run-"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const dirs = maxRunDirs === undefined ? allDirs : allDirs.slice(-maxRunDirs);

  for (const d of dirs) {
    let files: string[] = [];
    try {
      // Canonical copies only — each run dir also holds a `raw/` mirror.
      files = readdirSync(join(runsRoot, d.name))
        .filter((f) => /^state-\d+\.json$/.test(f))
        .sort();
    } catch {
      continue;
    }

    const cache = new Map<string, Record<string, any> | null>();
    const load = (f: string): Record<string, any> | null => {
      if (!cache.has(f)) {
        try {
          cache.set(f, JSON.parse(readFileSync(join(runsRoot, d.name, f), "utf8")));
        } catch {
          cache.set(f, null);
        }
      }
      return cache.get(f) ?? null;
    };

    for (let i = 0; i < files.length; i++) {
      const body = load(files[i]!);
      const events = body?.data?.events;
      if (!Array.isArray(events)) continue;
      const useMove = (events as WireEvent[]).filter((e) => e.type === "use_move");
      if (useMove.length !== 2) continue;

      const flags: Record<string, boolean> = {};
      const moves: [string, string] = ["", ""];
      for (const e of useMove) {
        for (const [k, v] of Object.entries(e.data ?? {})) if (typeof v === "boolean") flags[k] = v;
        if (e.playerId === 0 || e.playerId === 1) moves[e.playerId] = String(e.value ?? "");
      }

      // The nearest preceding capture carrying a player array is the pre-exchange
      // state — the loop writes its `GET /game/dungeon/state` read before every POST.
      let before: Record<string, any> | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const prev = load(files[j]!);
        if (Array.isArray(prev?.data?.run?.players)) {
          before = prev;
          break;
        }
      }
      if (!before) continue;
      const bp = before.data.run.players as Record<string, unknown>[];
      if (bp.length < 2) continue;

      const taken: [number, number] = [0, 0];
      const burn: [number, number] = [0, 0];
      for (const e of events as WireEvent[]) {
        if (e.type !== "OnDamage") continue;
        if (e.playerId !== 0 && e.playerId !== 1) continue;
        // burn ticks are a status mechanic, kept out of `taken` and measured separately
        const bucket = (e.data ?? {}).source === "burn" ? burn : (e.data ?? {}).source === "" ? taken : null;
        if (bucket) bucket[e.playerId] += Number(e.value ?? 0);
      }

      const heal: Partial<Record<0 | 1, number>> = {};
      for (const e of events as WireEvent[]) {
        if (e.type === "OnHeal" && (e.playerId === 0 || e.playerId === 1)) heal[e.playerId] = Number(e.value ?? 0);
      }

      const hp = [0, 1].map((s) => {
        const h = (bp[s] as Record<string, any>).health;
        return h && typeof h.current === "number" ? (h.current as number) : null;
      });

      const statusOf = (side: Record<string, unknown>): unknown[] =>
        Array.isArray(side.statusEffects) ? (side.statusEffects as unknown[]) : [];
      const statusMap = (side: Record<string, unknown>): Record<string, number> =>
        Object.fromEntries(
          statusOf(side)
            .filter((x): x is { type: string; amount: number } =>
              !!x && typeof x === "object" && typeof (x as any).type === "string")
            .map((x) => [x.type, Number(x.amount)]),
        );
      // The response's own players[], for the AFTER reading. Falls back to the
      // before-state when a response omits it, which keeps a missing `run` from
      // silently reading as "every status cleared".
      const afterPlayers = Array.isArray(body?.data?.run?.players)
        ? (body.data.run.players as Record<string, unknown>[])
        : bp;

      out.push({
        label: `${d.name}/${files[i]}`,
        flags,
        moves,
        outcome: moves[0] === moves[1] ? 0 : BEATS.has(`${moves[0]}>${moves[1]}`) ? 1 : -1,
        taken,
        burn,
        beforeStatus: [statusMap(bp[0]!), statusMap(bp[1]!)],
        afterStatus: [statusMap(afterPlayers[0] ?? bp[0]!), statusMap(afterPlayers[1] ?? bp[1]!)],
        atk: [0, 1].map((s) => {
          const mv = (bp[s] as Record<string, any>)[moves[s]!];
          return mv && typeof mv.currentATK === "number" ? (mv.currentATK as number) : null;
        }) as [number | null, number | null],
        stat: [0, 1].map((s) =>
          Object.fromEntries(ROLLED_STATS.map((k) => [k, current(bp[s]!, k)])),
        ) as Exchange["stat"],
        statusClean: statusOf(bp[0]!).length === 0 && statusOf(bp[1]!).length === 0,
        heal,
        hp: hp as [number | null, number | null],
        died: [0, 1].map((s) => typeof hp[s] === "number" && taken[s]! + burn[s]! >= hp[s]!) as [boolean, boolean],
        boons: [0, 1].map((s) =>
          (Array.isArray((bp[s] as Record<string, any>).pickedBoons)
            ? ((bp[s] as Record<string, any>).pickedBoons as Record<string, unknown>[])
            : []
          )
            .map((b) => String(b?.BoonType ?? b?.boonTypeString ?? ""))
            .filter((t) => t !== ""),
        ) as [string[], string[]],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The four rules, each stated as a prediction the corpus can falsify.
// ---------------------------------------------------------------------------

export interface RuleResult {
  flag: string;
  /** Human-readable prediction, e.g. `floor(ATK/2)`. */
  predicts: string;
  /** Exchanges matching the prediction, over those tested, on STATUS-CLEAN exchanges. */
  ok: number;
  n: number;
  /** The same, over ALL exchanges including status-carrying ones. */
  okAll: number;
  nAll: number;
  /** Exchanges with the same stat non-zero where the flag did NOT fire, and how many matched. */
  controlMatched: number;
  controlN: number;
}

/** Wilson score interval — the right one at these sample sizes; a normal approximation is not. */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/**
 * `block` halves incoming damage; `evasion` negates it; `lck` doubles damage
 * dealt. Each is checked only where the attacker owed damage, and each excludes
 * exchanges on which the OPPOSING multiplier also fired — the two compose
 * (`run-2026-08-23-05-53-49/state-108`: crit then block, ATK 14 → 14 dealt).
 */
export function scoreRules(exchanges: Exchange[]): RuleResult[] {
  const results: RuleResult[] = [];

  const run = (
    flag: string,
    predicts: string,
    attacker: 0 | 1,
    victim: 0 | 1,
    stat: string,
    statSide: 0 | 1,
    matches: (atk: number, taken: number) => boolean,
    excludeFlags: readonly string[],
  ): void => {
    const eligible = (ex: Exchange, fired: boolean) =>
      ex.flags[flag] === fired &&
      dealtDamage(ex, attacker) &&
      typeof ex.atk[attacker] === "number" &&
      ex.atk[attacker]! > 0 &&
      !excludeFlags.some((f) => ex.flags[f]);

    const firedAll = exchanges.filter((ex) => eligible(ex, true));
    const firedClean = firedAll.filter((ex) => ex.statusClean);
    const control = exchanges.filter((ex) => eligible(ex, false) && (ex.stat[statSide][stat] ?? 0) > 0);
    const hit = (ex: Exchange) => matches(ex.atk[attacker]!, ex.taken[victim]);

    results.push({
      flag,
      predicts,
      ok: firedClean.filter(hit).length,
      n: firedClean.length,
      okAll: firedAll.filter(hit).length,
      nAll: firedAll.length,
      controlMatched: control.filter(hit).length,
      controlN: control.length,
    });
  };

  for (const s of [0, 1] as const) {
    const foe = (1 - s) as 0 | 1;
    // block/evasion sit on the VICTIM; the attacker is the other side.
    run(`blockProc${s}`, "floor(ATK/2)", foe, s, "block", s, (a, t) => t === Math.floor(a / 2), [`critProc${foe}`]);
    run(`evadeProc${s}`, "0", foe, s, "evasion", s, (_a, t) => t === 0, [`critProc${foe}`]);
    // lck sits on the ATTACKER.
    //
    // ⭐ [session 116, LIVE] **`evadeProc${foe}` is excluded here because EVADE
    // DOMINATES CRIT — and that was measured, not assumed.** An exchange whose
    // victim evaded takes **ZERO damage, without exception**, and the crit
    // co-fires are INSIDE that population rather than exceptions to it.
    //
    // The CLAIM is exceptionlessness; the COUNT below is a snapshot and is
    // expected to grow with the corpus. Do not read a larger number here later
    // as a change — read a NON-zero miss as one. (This file has already shipped
    // one caption that froze a count and went stale; see the BurnMastery note
    // in scripts/statusEffects.ts for what that costs.) At session 116, two
    // runs in: **54/54 whole-corpus, 18/18 status-clean.**
    //
    // This exclusion is a DEFECT FIX, not a rescue. `critProc` already excluded
    // `blockProc${foe}` — the same kind of victim-side proc that overrides the
    // attacker's arithmetic — and evade was simply never in the list, because
    // until this session the two had never co-fired on a status-clean exchange.
    // The census is why the gap stayed invisible: evade+crit co-fires numbered
    // **3 in the entire corpus** when this was written, all 3 from the room-13
    // Tier-2 run of 2026-09-01 (`state-128`: enemy ATK 16, crit predicts 32,
    // observed 0) — a rate that had kept them from ever meeting before.
    //
    // Note the asymmetry, deliberately left alone: `evadeProc` excludes
    // `critProc${foe}` above and does NOT need to — its rule holds over the
    // co-fires too. Removing that would make evade's claim strictly stronger at
    // a larger n, which is a separate change and not this one. See session 113's
    // `scaleRule` entry: an incomplete exclusion list is the defect, never the
    // multiplier.
    run(`critProc${s}`, "2*ATK", s, foe, "lck", s, (a, t) => t === 2 * a, [`blockProc${foe}`, `evadeProc${foe}`]);
  }
  return results;
}

/**
 * `tenacity`, split by whether the `AddTenacity` boon was picked on that side.
 *
 * [session 104] §58 measured tenacity's OnHeal association by POOLING every
 * tenacity-fired exchange. Session 103's dead-end note then found the proc RATE
 * moves with whether `AddTenacity` was picked and with pick order (0/48 with no
 * boon; 6/54 with it at pick 5 of 8; 0/38 with it at pick 6 of 7; 1/44 with no
 * boon). If the boon and the base stat drive different populations, pooling
 * them mixes two things — so the split is reported rather than assumed away.
 *
 * `damageNullOk / damageNullN` is the control that matters: it counts, on the
 * exchanges in this cell where the OTHER side owed damage, how often damage
 * taken still equals the attacker's plain `currentATK`. Tenacity being absent
 * from the damage path predicts this tracks the null in BOTH arms.
 */
export interface TenacityCell {
  side: 0 | 1;
  withBoon: boolean;
  fired: boolean;
  n: number;
  healed: number;
  damageNullOk: number;
  damageNullN: number;
}

export function tenacityByBoon(exchanges: Exchange[]): TenacityCell[] {
  const out: TenacityCell[] = [];
  for (const side of [0, 1] as const) {
    for (const withBoon of [true, false]) {
      for (const fired of [true, false]) {
        const rs = exchanges.filter(
          (e) =>
            (e.stat[side].tenacity ?? 0) > 0 &&
            e.flags[`tenacityProc${side}`] === fired &&
            e.boons[side].includes("AddTenacity") === withBoon,
        );
        let damageNullOk = 0;
        let damageNullN = 0;
        for (const ex of rs) {
          const attacker = (1 - side) as 0 | 1;
          if (!dealtDamage(ex, attacker) || typeof ex.atk[attacker] !== "number") continue;
          // Any OTHER proc would move damage for its own reasons — exclude them,
          // so this cell tests tenacity against a clean null and nothing else.
          if (["block", "evade", "crit"].some((f) => ex.flags[`${f}Proc${side}`] || ex.flags[`${f}Proc${attacker}`])) continue;
          damageNullN++;
          if (ex.taken[side] === ex.atk[attacker]) damageNullOk++;
        }
        out.push({ side, withBoon, fired, n: rs.length, healed: rs.filter((e) => e.heal[side] !== undefined).length, damageNullOk, damageNullN });
      }
    }
  }
  return out;
}

/**
 * `tenacity`, split by the POSITION at which `AddTenacity` was picked — and
 * STRATIFIED by the side's own `tenacity` stat, which is the whole point.
 *
 * [session 105, QUESTIONS.md §63] Session 103 saw the proc rate move with pick
 * order (pick 5 of 8 -> 6/54; pick 6 of 7 -> 0/38) at n=4 runs and correctly
 * declined to fit a rule. Session 104 then settled PRESENCE and left ORDER
 * open. This is the function that answers order, and the stratification is not
 * a refinement — it is the answer:
 *
 * **Pick order is structurally redundant given the stat.** `boons` and `stat`
 * are both read off the SAME preceding state, so the per-exchange `tenacity`
 * value already encodes what the boon did, at the moment it applied. Anything
 * pick order could contribute must therefore appear as a RESIDUAL after
 * conditioning on the stat — which is exactly what a stratum with more than
 * one pick position measures, and what a stratum with one position cannot.
 *
 * Cells with a single pick position are reported anyway, because their EXISTENCE
 * is the collinearity finding: a run contributes one pick position, so most
 * (stat, pick) cells are one run and pick order cannot be separated there at all.
 */
export interface PickOrderCell {
  side: 0 | 1;
  /** The side's `tenacity` on the preceding state. */
  stat: number;
  /** 1-based index of `AddTenacity` in that side's `pickedBoons`. */
  pick: number;
  n: number;
  fired: number;
  /** Distinct run dirs contributing to this cell. 1 means the cell is one run. */
  runs: number;
}

export function tenacityByPickOrder(exchanges: Exchange[], side: 0 | 1 = 0): PickOrderCell[] {
  const cells = new Map<string, PickOrderCell & { runSet: Set<string> }>();
  for (const e of exchanges) {
    const stat = e.stat[side].tenacity;
    if (typeof stat !== "number" || stat <= 0) continue;
    const i = e.boons[side].indexOf("AddTenacity");
    if (i < 0) continue;
    const key = `${stat}|${i + 1}`;
    let c = cells.get(key);
    if (!c) {
      c = { side, stat, pick: i + 1, n: 0, fired: 0, runs: 0, runSet: new Set() };
      cells.set(key, c);
    }
    c.n++;
    if (e.flags[`tenacityProc${side}`]) c.fired++;
    c.runSet.add(e.label.split("/")[0] ?? e.label);
  }
  return [...cells.values()]
    .map(({ runSet, ...c }) => ({ ...c, runs: runSet.size }))
    .sort((a, b) => a.stat - b.stat || a.pick - b.pick);
}

/**
 * The only part of {@link tenacityByPickOrder} that can inform pick order: the
 * strata where the stat is held fixed and the pick position still varies.
 *
 * `firedInInformativeStrata` is the number this question lives or dies on. Every
 * proc outside these strata is one where pick order and the stat move together
 * and neither can be credited.
 */
export function pickOrderPower(cells: PickOrderCell[]): {
  informativeStrata: number;
  totalStrata: number;
  firedInInformativeStrata: number;
  nInInformativeStrata: number;
} {
  const byStat = new Map<number, PickOrderCell[]>();
  for (const c of cells) byStat.set(c.stat, [...(byStat.get(c.stat) ?? []), c]);
  let informativeStrata = 0;
  let fired = 0;
  let n = 0;
  for (const group of byStat.values()) {
    if (group.length < 2) continue;
    informativeStrata++;
    for (const c of group) {
      fired += c.fired;
      n += c.n;
    }
  }
  return { informativeStrata, totalStrata: byStat.size, firedInInformativeStrata: fired, nInInformativeStrata: n };
}

function main(): void {
  const exchanges = loadExchanges();
  const clean = exchanges.filter((e) => e.statusClean);
  console.log(`\n▸ proc effect sizes — ${exchanges.length} exchanges, ${clean.length} of them status-clean\n`);

  // The null, restated every run: it is what makes every number below a measurement.
  let nullOk = 0;
  let nullN = 0;
  for (const ex of exchanges) {
    if (Object.values(ex.flags).some(Boolean)) continue;
    for (const victim of [0, 1] as const) {
      const attacker = (1 - victim) as 0 | 1;
      if (!dealtDamage(ex, attacker) || typeof ex.atk[attacker] !== "number") continue;
      nullN++;
      if (ex.taken[victim] === ex.atk[attacker]) nullOk++;
    }
  }
  console.log(`  NULL (no proc fired): damage taken === attacker currentATK   ${nullOk} / ${nullN}\n`);

  console.log(`  flag            predicts       status-clean        all exchanges     control (stat>0, unfired)`);
  for (const r of scoreRules(exchanges)) {
    const [lo, hi] = wilson(r.ok, r.n);
    const ci = r.n === 0 ? "n/a" : `[${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}%]`;
    console.log(
      `  ${r.flag.padEnd(15)} ${r.predicts.padEnd(13)} ${`${r.ok}/${r.n}`.padStart(7)} ${ci.padStart(11)}   ${`${r.okAll}/${r.nAll}`.padStart(8)}        ${`${r.controlMatched}/${r.controlN}`.padStart(9)}`,
    );
  }

  // tenacity and intuition get no rule — both are reported as what they are.
  console.log(`\n  tenacity — NOT damage mitigation. Matched on tenacity>0:`);
  for (const s of [0, 1] as const) {
    for (const fired of [true, false]) {
      const rs = exchanges.filter((e) => e.flags[`tenacityProc${s}`] === fired && (e.stat[s].tenacity ?? 0) > 0);
      const healed = rs.filter((e) => e.heal[s] !== undefined);
      const [lo, hi] = wilson(healed.length, rs.length);
      console.log(
        `    tenacityProc${s} ${fired ? "FIRED  " : "unfired"} n=${String(rs.length).padStart(4)}   OnHeal on that side ${String(healed.length).padStart(3)} (${((100 * healed.length) / (rs.length || 1)).toFixed(1)}%, 95% CI [${(100 * lo).toFixed(1)}-${(100 * hi).toFixed(1)}%])`,
      );
    }
  }

  console.log(`\n  tenacity, SPLIT by whether AddTenacity was picked on that side [session 104]:`);
  console.log(`    side  AddTenacity  proc       n   OnHeal   damage tracks the plain null`);
  for (const c of tenacityByBoon(exchanges)) {
    const nullCol = c.damageNullN === 0 ? "n/a" : `${c.damageNullOk}/${c.damageNullN}`;
    console.log(
      `    ${c.side}     ${(c.withBoon ? "picked" : "not picked").padEnd(11)}  ${(c.fired ? "FIRED" : "unfired").padEnd(7)} ${String(c.n).padStart(4)}   ${String(c.healed).padStart(4)}     ${nullCol.padStart(9)}`,
    );
  }

  console.log(`\n  tenacity, by AddTenacity PICK POSITION, stratified by the stat [session 105]:`);
  console.log(`    stat  pick   fired/n    runs   (a 1-run cell cannot separate order from the stat)`);
  const pickCells = tenacityByPickOrder(exchanges);
  for (const c of pickCells) {
    console.log(
      `    ${String(c.stat).padStart(4)}  ${String(c.pick).padStart(4)}   ${`${c.fired}/${c.n}`.padStart(7)}    ${String(c.runs).padStart(3)}`,
    );
  }
  const power = pickOrderPower(pickCells);
  console.log(
    `    -> ${power.informativeStrata} of ${power.totalStrata} stat strata have MORE THAN ONE pick position;` +
      ` those carry ${power.firedInInformativeStrata} proc(s) in ${power.nInInformativeStrata} exchanges.` +
      `\n       Every other proc is one where pick order and the stat move together and neither can be credited.\n`,
  );

  const intuition = exchanges.filter((e) => e.flags.intuitionProc0);
  const unmitigated = intuition.filter(
    (e) => !e.flags.blockProc0 && dealtDamage(e, 1) && e.taken[0] === e.atk[1],
  ).length;
  const blocked = intuition.filter((e) => e.flags.blockProc0).length;
  console.log(
    `\n  intuition — NOT damage mitigation either: ${unmitigated} of ${intuition.length - blocked} non-blocked procs took the attacker's FULL ATK` +
      `\n    (the remaining ${blocked} also carried blockProc0, and took exactly floor(ATK/2) — that is block, not intuition).\n`,
  );
}

const isMain = process.argv[1] && process.argv[1].endsWith("procEffectSize.ts");
if (isMain) main();
