/**
 * scripts/verifyCombatModel.ts — validate the combat model against recordings.
 *
 * Not strategy code: it makes no decisions. It replays each recorded exchange
 * in fixtures/dungeon-runs/, predicts the resulting HP and armor from the
 * previous state, and diffs the prediction against what the server actually
 * returned. Every side of every exchange must match exactly.
 *
 *   npx tsx scripts/verifyCombatModel.ts
 *
 * THE MODEL (user-supplied 2026-08-13, verified here):
 *   Sword > Spell > Shield > Sword  (rock > scissor > paper > rock)
 *   A side that WINS or TIES:  gains armor = its own move's DEF (capped at
 *                              currentMax), then deals its full ATK.
 *   A side that LOSES:         gains nothing, deals nothing.
 *   Armor gain resolves BEFORE incoming damage.
 *   Damage depletes armor first; the overflow carries to HP in the same
 *   exchange.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Defaults to the flat session-02 corpus; pass a run directory to verify a
// later capture. Runs must be verified one directory at a time — the boundary
// between two unrelated runs is not an exchange.
const DIR = process.argv[2] ?? "fixtures/dungeon-runs";
const MOVES = ["rock", "paper", "scissor"] as const;
type Move = (typeof MOVES)[number];

const WEAPON: Record<Move, string> = {
  rock: "Sword",
  paper: "Shield",
  scissor: "Spell",
};

/** rock > scissor > paper > rock. Returns 1 if a beats b, -1 if b beats a, 0 tie. */
function compare(a: Move, b: Move): number {
  if (a === b) return 0;
  const beats: Record<Move, Move> = { rock: "scissor", scissor: "paper", paper: "rock" };
  return beats[a] === b ? 1 : -1;
}

interface Pool { current: number; currentMax: number }
interface MoveStat { currentATK: number; currentDEF: number; currentCharges: number }
interface Side {
  id: string;
  health: Pool;
  shield: Pool;
  lastMove: string;
  rock: MoveStat;
  paper: MoveStat;
  scissor: MoveStat;
}

const load = (f: string) =>
  JSON.parse(readFileSync(join(DIR, f), "utf8")) as {
    data: { run: { players: Side[] } };
  };

/**
 * `--rejected` replays the SUPERSEDED model (only Shield grants armor; ties
 * deal ATK - opponent DEF) so this script can be shown to actually discriminate.
 * It is expected to FAIL. Session 02 could not tell the two apart because no
 * recorded exchange ever won or tied with a DEF-bearing non-Shield move; run 3
 * turn 004->005 (Spell vs Spell, tie) is that exchange. See DECISIONS 2026-08-13.
 */
const REJECTED = process.argv.includes("--rejected");

/** Predict one side's post-exchange HP/armor. `outcome` is 1 win, 0 tie, -1 loss. */
function resolve(me: Side, myMove: Move, outcome: number, incoming: number) {
  let armor = me.shield.current;
  let hp = me.health.current;

  // Winner and both tie-ers regenerate their move's DEF, capped.
  // Under the rejected model only Shield (paper) ever granted armor.
  if (outcome >= 0 && (!REJECTED || myMove === "paper")) {
    armor = Math.min(me.shield.currentMax, armor + me[myMove].currentDEF);
  }

  // Then absorb damage: armor first, overflow to HP.
  armor -= incoming;
  if (armor < 0) {
    hp += armor;
    armor = 0;
  }
  // HP floors at 0 — the server reports a dead side as 0, not as negative.
  // Without this the killing blow reads as a model failure (run 3, 007->008:
  // predicted -6 against an actual 0).
  if (hp < 0) hp = 0;
  return { hp, armor };
}

/**
 * True when two consecutive states represent an actual exchange. `lastMove`
 * persists across the reward/enemy path phases that follow a kill, so a naive
 * pair-walk replays the killing blow once per phase state and predicts the
 * corpse taking damage it never took.
 */
function isExchange(prev: Side[], next: Side[]): boolean {
  return prev.some((p, i) => {
    const n = next[i]!;
    return (
      p.health.current !== n.health.current ||
      p.shield.current !== n.shield.current ||
      MOVES.some((m) => p[m].currentCharges !== n[m].currentCharges)
    );
  });
}

function main() {
  const files = readdirSync(DIR).filter((f) => /^state-\d+\.json$/.test(f)).sort();
  let checks = 0;
  let fails = 0;

  for (let i = 1; i < files.length; i++) {
    const prev = load(files[i - 1]!).data.run.players;
    const next = load(files[i]!).data.run.players;

    // lastMove on the NEXT state names the moves that produced it.
    const moves = next.map((p) => p.lastMove as Move);
    const [mMove, fMove] = moves as [Move, Move];
    if (!MOVES.includes(mMove) || !MOVES.includes(fMove)) continue;
    if (!isExchange(prev, next)) continue;

    const [pMe, pFoe] = prev as [Side, Side];
    const [nMe, nFoe] = next as [Side, Side];

    const out = compare(mMove, fMove);

    // A side deals its full ATK only if it won or tied. Under the rejected
    // model a tie dealt ATK reduced by the opponent's DEF instead.
    const atk = (from: Side, fm: Move, to: Side, tm: Move, o: number) =>
      REJECTED && o === 0
        ? Math.max(0, from[fm].currentATK - to[tm].currentDEF)
        : from[fm].currentATK;
    const dmgFromMe = out >= 0 ? atk(pMe, mMove, pFoe, fMove, out) : 0;
    const dmgFromFoe = out <= 0 ? atk(pFoe, fMove, pMe, mMove, out) : 0;

    const predMe = resolve(pMe, mMove, out, dmgFromFoe);
    const predFoe = resolve(pFoe, fMove, -out, dmgFromMe);

    const label = `${files[i - 1]!.slice(6, 9)}→${files[i]!.slice(6, 9)}`;
    const verdict = out > 0 ? "me" : out < 0 ? "foe" : "tie";
    console.log(
      `\n── ${label}  ${WEAPON[mMove]} vs ${WEAPON[fMove]}  → ${verdict}`,
    );

    for (const [who, pred, actual] of [
      ["me ", predMe, nMe],
      ["foe", predFoe, nFoe],
    ] as const) {
      const ok = pred.hp === actual.health.current && pred.armor === actual.shield.current;
      checks++;
      if (!ok) fails++;
      console.log(
        `   ${ok ? "✓" : "✗"} ${who}  predicted HP ${pred.hp} ARM ${pred.armor}` +
          `   actual HP ${actual.health.current} ARM ${actual.shield.current}`,
      );
    }
  }

  console.log(
    `\n${fails === 0 ? "✓ MODEL HOLDS" : "✗ MODEL BROKEN"} — ${checks - fails}/${checks} side-updates matched\n`,
  );
  process.exit(fails === 0 ? 0 : 1);
}

main();
