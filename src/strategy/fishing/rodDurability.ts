/**
 * ROD DURABILITY PREFLIGHT — the fail-closed half.
 *
 * [session 100 §A, QUESTIONS.md §52]
 *
 * ## What this is for
 *
 * `GET /gear/instances/{address}` publishes `DURABILITY_CID` on every gear
 * instance the account owns. On 2026-08-26 it read Shroom (811) at **0** with
 * `EQUIPPED_TO_SLOT_CID: -1`, and the freshly-equipped Golkan (812) at **40**
 * in slot 14. Zero is what a rod that has RUN DRY looks like: sessions 89-91
 * spent three sessions reconstructing exactly that state indirectly, from the
 * fact that the server started dealing `BASE_DECK` instead of the rod's grant
 * (`src/sim/fishing/rodDeck.ts`, QUESTIONS.md §29).
 *
 * So this module turns an AFTER-THE-FACT diagnosis into a BEFORE-THE-BATCH
 * one. That is the whole claim. It is deliberately not a bigger one.
 *
 * ## What this is NOT, and must not become without new data
 *
 * **It does not predict "N casts of headroom remain."** QUESTIONS.md §52 is
 * explicit: the per-cast decrement rate is UNKNOWN. The repo holds exactly one
 * durability data point (Golkan at 40 on equip) and no paired post-batch
 * reading, so any "casts remaining" number would be a formula an agent made
 * up — the precise failure mode CLAUDE.md rule 9 exists to stop. The user's
 * own "~40 casts" estimate is a coincidence of magnitude with the 40 read
 * here, not a confirmed rate, and §52 says it stays an estimate until it has
 * been cross-checked against at least one real observed rod failure.
 *
 * `scripts/liveFishing.ts` records a durability reading before AND after every
 * live batch (`appendRodDurability`). Once a few paired readings exist, the
 * rate becomes derivable from ordinary play and a future session can upgrade
 * this from fail-closed to predictive. Until then: halt at 0, warn near it,
 * claim nothing about the middle.
 */

import { CURRENT_ROD } from "../../sim/fishing/rodDeck.js";

/** The one field-set this module needs off a `/gear/instances/{address}` row. */
export interface GearInstanceLike {
  docId: string;
  GAME_ITEM_ID_CID: number;
  DURABILITY_CID: number;
  EQUIPPED_TO_SLOT_CID: number;
}

/**
 * `EQUIPPED_TO_SLOT_CID` is -1 for an instance sitting in the bag. Any
 * non-negative value is a real slot. Observed: the rod occupies slot 14 (both
 * Golkan 812 on 2026-08-26 and the older Makeshift 922 in the HAR).
 *
 * **Slot 14 is NOT hardcoded as "the rod slot" anywhere below**, and that is
 * on purpose. The rod is identified by its ITEM ID matching the deck this repo
 * simulates (`CURRENT_ROD`), which makes the check self-validating: if the
 * account's equipped rod ever stops being the rod `REAL_DECK` describes, that
 * is itself a halt rather than a silently-wrong simulation. Session 89-91's
 * failure was precisely a mismatch between the deck assumed and the deck dealt.
 */
export const NOT_EQUIPPED_SLOT = -1;

/**
 * Durability at or below this WARNS (does not halt).
 *
 * **This number is a display threshold, not a model.** It says "you are close
 * enough to the floor that you should look before committing a 20-cast batch",
 * and nothing about how many casts that is. It is not derived — no decrement
 * rate exists to derive it from — so it is deliberately round and deliberately
 * has no consequence beyond a printed line and a logged field.
 */
export const ROD_DURABILITY_WARN_AT = 5;

export type RodDurabilityStatus = "ok" | "low" | "halt";

export interface RodDurabilityReading {
  status: RodDurabilityStatus;
  /** Human-readable, printed by the live loop and stored in the log row. */
  detail: string;
  /** `DURABILITY_CID` of the equipped rod, or null when no rod could be identified. */
  durability: number | null;
  /** `GAME_ITEM_ID_CID` of the equipped rod, or null when none was found. */
  rodItemId: number | null;
  /** `docId` of the equipped rod instance, or null. Stable across reads — the join key for a decrement-rate fit. */
  docId: string | null;
  /** Slot the rod was found in. Recorded, never keyed on. */
  slot: number | null;
  /** True when the batch must not start. */
  stop: boolean;
}

/**
 * Read the equipped rod's durability out of a `/gear/instances/{address}`
 * response and say whether a batch may start.
 *
 * Pure. No network, no clock, no I/O — CLAUDE.md working style: strategy takes
 * a state object and returns a decision.
 *
 * Fail-closed on all four of these, because each one means the batch would be
 * spending real casts on a rod this repo cannot describe:
 *
 *  1. **No instance of `expectedRodId` is equipped.** Either the rod was
 *     unequipped or the account is fishing with something else.
 *  2. **The equipped rod's durability is 0 or below.** The Shroom reading. The
 *     server will deal `BASE_DECK` and every damage-keyed number in the
 *     simulator will describe a rod that is not in play.
 *  3. **More than one instance of the rod is equipped.** Not observed, and an
 *     ambiguous read is not a read.
 *  4. **The response carried no rows at all.** A read that saw nothing is not
 *     evidence of a healthy rod (CLAUDE.md rule 5 — a stopped bot costs
 *     nothing).
 */
export function readRodDurability(
  instances: readonly GearInstanceLike[],
  expectedRodId: number = CURRENT_ROD,
): RodDurabilityReading {
  const none = { durability: null, rodItemId: null, docId: null, slot: null };

  if (instances.length === 0) {
    return {
      status: "halt",
      stop: true,
      detail: "/gear/instances returned zero rows — cannot see the rod at all. A read that saw nothing is not a healthy rod.",
      ...none,
    };
  }

  const equipped = instances.filter(
    (g) => g.GAME_ITEM_ID_CID === expectedRodId && g.EQUIPPED_TO_SLOT_CID !== NOT_EQUIPPED_SLOT,
  );

  if (equipped.length === 0) {
    // Say what IS equipped in a rod-ish sense, so the halt is actionable rather
    // than just a refusal. Any equipped row is fair game to name — the point is
    // to hand the reader the id they need to check against `ROD_CARD_GRANTS`.
    const otherEquipped = instances
      .filter((g) => g.EQUIPPED_TO_SLOT_CID !== NOT_EQUIPPED_SLOT)
      .map((g) => `${g.GAME_ITEM_ID_CID}@slot${g.EQUIPPED_TO_SLOT_CID}`)
      .join(", ");
    return {
      status: "halt",
      stop: true,
      detail:
        `rod ${expectedRodId} (the rod \`REAL_DECK\` describes) is NOT equipped. ` +
        `Equipped instances: ${otherEquipped || "none"}. ` +
        `Either re-equip it or repoint \`CURRENT_ROD\` — do not fish a rod the simulator does not model.`,
      ...none,
    };
  }

  if (equipped.length > 1) {
    return {
      status: "halt",
      stop: true,
      detail:
        `${equipped.length} instances of rod ${expectedRodId} read as equipped ` +
        `(${equipped.map((g) => `${g.docId} dur ${g.DURABILITY_CID}`).join(", ")}). ` +
        `An ambiguous read is not a read.`,
      ...none,
    };
  }

  const rod = equipped[0]!;
  const found = {
    durability: rod.DURABILITY_CID,
    rodItemId: rod.GAME_ITEM_ID_CID,
    docId: rod.docId,
    slot: rod.EQUIPPED_TO_SLOT_CID,
  };

  if (rod.DURABILITY_CID <= 0) {
    return {
      status: "halt",
      stop: true,
      detail:
        `rod ${expectedRodId} reads DURABILITY_CID ${rod.DURABILITY_CID} — it has RUN DRY. ` +
        `This is the Shroom (811) state: the server deals BASE_DECK, not the rod grant, ` +
        `so every damage-keyed sim number would describe a rod that is not in play (QUESTIONS.md §29).`,
      ...found,
    };
  }

  if (rod.DURABILITY_CID <= ROD_DURABILITY_WARN_AT) {
    return {
      status: "low",
      stop: false,
      detail:
        `rod ${expectedRodId} reads DURABILITY_CID ${rod.DURABILITY_CID}, at or below the ${ROD_DURABILITY_WARN_AT} warn line. ` +
        `The batch may proceed — the per-cast decrement rate is UNKNOWN (QUESTIONS.md §52), so this is a "look before you commit" ` +
        `line and NOT a claim about casts remaining.`,
      ...found,
    };
  }

  return {
    status: "ok",
    stop: false,
    detail: `rod ${expectedRodId} reads DURABILITY_CID ${rod.DURABILITY_CID} (slot ${rod.EQUIPPED_TO_SLOT_CID}, ${rod.docId}).`,
    ...found,
  };
}
