/**
 * src/orchestrator/fishingLedgerReconcile.ts — [session 70 §4] the join between
 * the two fishing cast ledgers, and the rule that the GAME's wins.
 *
 * TWO LEDGERS COUNT THE SAME THING AND THEY HAVE NOW DRIFTED IN BOTH
 * DIRECTIONS ON THE SAME DAY:
 *
 *   1. The GAME's `dayDocs[pondId 2].UINT256_CID` (see `src/api/fishingLedger.ts`).
 *      Authoritative: it counts every cast regardless of who sent it, and it is
 *      the counter the server actually enforces `maxPerDayJuiced` against.
 *   2. THIS REPO's `data/guard-budget-fishing.json` `runsStarted`, incremented
 *      by `GuardState.recordRunStarted()` after each successful `start_run`.
 *
 * Session 69 ended with game 14 / repo 15 — the repo HIGH. Session 70 opened
 * with game 16 / repo 15 — the repo LOW, because the user had played two casts
 * by hand in a browser, which this process cannot see. Both gaps are real and
 * they point opposite ways, which is why this module reconciles rather than
 * clamps:
 *
 *   - Repo HIGH is the SAFE direction and the WRONG answer. It stops a batch
 *     that had casts left (session 69: the game said six remained where the
 *     repo said five).
 *   - Repo LOW is the UNSAFE direction. It plans a batch the server will
 *     reject, which is how session 27 burned a `start_run` against a cap the
 *     local guard read as 0/20.
 *
 * WHAT THE OFF-BY-ONE ACTUALLY WAS, since it is now identified rather than
 * suspected. `liveFishing.ts` logs `ledgerRemaining` — a live read of the
 * game's ledger — after every cast in a batch. Across session 69's ten casts it
 * read 14 14 13 12 11 10 9 8 7 6, so `dayDocs` went 5 → 6 → **6** → 7 → … → 14
 * and exactly ONE cast failed to tick it: **docId 13024510, cast 2 of the
 * batch**. That cast is ordinary in every client-visible respect — `start_run`
 * answered `"Game started successfully."`, three `play_cards`, a lethal
 * Relaxing Oil, caught, looted — and **the server DID charge its energy**
 * (408 → 396, `observedDelta` 12, `drifted: false`). Ruled out by the same
 * data: it was not a double-counted doc (15 successful `start_run`s returned 15
 * distinct docIds), not a resume (session 65's free-cast precedent — there were
 * none), not a rejected start counted as a success (the one rejection,
 * "Player is already in a game", correctly recorded nothing), not read lag (the
 * settled value stayed 14 across two later reads a minute apart), and not
 * miscounted into another pond (`dayDocs[pondId 1]` is 0). Ending on an oil is
 * not the discriminator either — casts 5, 6, 8 and 10 also ended on
 * `use_fishing_item` and all four ticked.
 *
 * So the missing increment is SERVER-SIDE and has no client-visible cause. That
 * is precisely why this module exists: the repo cannot predict the game's
 * counter, so it must stop trying to and read it instead.
 *
 * ENERGY IS DELIBERATELY NOT RECONCILED. The two ledgers count casts; the
 * energy figure is this repo's own record of what IT spent, against
 * `config/bot.json`'s `dailyEnergyBudget`. Inferring energy from a cast count
 * the process did not send would be inventing a measurement, and per CLAUDE.md
 * rule 12 energy is not a constraint anyway.
 */

/**
 * The two numbers reconciliation actually touches. Deliberately narrower than
 * `PersistedGuardBudget` — `loadGuardBudget` returns the counts WITHOUT the
 * date key, and requiring a date here would force every caller to invent one.
 */
export interface FishingLedgerCounts {
  energySpent: number;
  runsStarted: number;
}

/**
 * What reconciliation did, in enough detail for the caller to print a line an
 * operator can act on. `direction` is from the REPO's point of view: `raised`
 * means the repo counter was moved UP to meet the game's.
 */
export interface FishingLedgerReconciliation<T extends FishingLedgerCounts = FishingLedgerCounts> {
  /** The seed the guard should actually be built from. Any extra fields the caller passed (a `date` key, say) are carried through untouched. */
  seed: T;
  /** The game's count, or `null` when its ledger could not be read. */
  gameCasts: number | null;
  /** What the repo file said before this call. */
  repoCastsBefore: number;
  /** True when `seed.runsStarted !== repoCastsBefore`. */
  adjusted: boolean;
  direction: "agreed" | "raised" | "lowered" | "unreadable";
  /** One line, safe to print. */
  note: string;
}

/**
 * Reconciles the repo's persisted cast count against the game's.
 *
 * THE INVARIANT, and it is the one `tests/fishing/fishingLedgerReconcile.test.ts`
 * exists to pin: whenever the game's ledger is readable, the returned
 * `runsStarted` **equals** the game's count — so it can never exceed it, in any
 * direction the two ledgers drift.
 *
 * `gameCasts === null` is the FAIL-CLOSED branch and it is not the same as
 * zero: a ledger we failed to read is not a ledger that says nothing was spent
 * (see `dendrenCastsRemaining`'s own doc comment). The repo's own count is kept
 * in that case, because a count that may be too high refuses casts and a
 * fabricated zero would authorize twenty.
 */
export function reconcileFishingLedger<T extends FishingLedgerCounts>(
  persisted: T,
  gameCasts: number | null,
): FishingLedgerReconciliation<T> {
  const repoCastsBefore = persisted.runsStarted;

  if (gameCasts === null) {
    return {
      seed: persisted,
      gameCasts: null,
      repoCastsBefore,
      adjusted: false,
      direction: "unreadable",
      note:
        `game ledger unreadable — keeping the repo's own count of ${repoCastsBefore} cast(s). ` +
        `This is the conservative side: an unreadable ledger is not an empty one.`,
    };
  }

  if (gameCasts === repoCastsBefore) {
    return {
      seed: persisted,
      gameCasts,
      repoCastsBefore,
      adjusted: false,
      direction: "agreed",
      note: `ledgers agree at ${gameCasts} cast(s) spent today.`,
    };
  }

  const direction = gameCasts > repoCastsBefore ? "raised" : "lowered";
  const why =
    direction === "raised"
      ? `casts this process did not send (a browser cast, or another client) — planning off the repo's ${repoCastsBefore} would attempt a cast the server will reject`
      : `the repo over-counted by ${repoCastsBefore - gameCasts} — the game says that many more cast(s) remain than the repo believed`;

  return {
    // `energySpent` is carried through untouched — see the header.
    seed: { ...persisted, runsStarted: gameCasts },
    gameCasts,
    repoCastsBefore,
    adjusted: true,
    direction,
    note: `LEDGERS DISAGREE: game ${gameCasts} vs repo ${repoCastsBefore} — deferring to the game (${direction} the repo counter). Cause: ${why}.`,
  };
}
