/**
 * scripts/orchestrator.ts — Task 10. Budget-aware loop across BOTH dungeon
 * and fishing, energy-regen sleeps, graceful SIGINT, a rollup at exit.
 *
 * Pure composition, not new game logic — every action still goes through
 * exactly the same `runOnce`/`runOneCast` this project's own supervised
 * live scripts use (Task 6/Task 9's already-met gates). What's new here is
 * `src/orchestrator/scheduler.ts` deciding WHICH mode to run next from the
 * real energy pool and each mode's own daily budget, and
 * `src/orchestrator/shutdown.ts` for the graceful stop.
 *
 * A per-mode `GuardTrip` for a reason `isBudgetGuardTrip` recognizes (daily
 * cap reached) marks that mode exhausted for today and lets the OTHER mode
 * keep going — the scheduler's own budget snapshot already reflects the
 * guard's real state on the next iteration, so this is a soft "stop asking
 * for this one" rather than a retry. Any OTHER thrown error (a genuine
 * anomaly per CLAUDE.md §5 — consecutive failures, a stalled state, a
 * rejected JWT, an unexpected response shape) propagates and halts the
 * WHOLE process, unchanged from every other live script in this repo.
 *
 * Honest scope note (CLAUDE.md §6): Task 10's gate as written is an
 * eight-hour UNATTENDED session with zero unhandled exceptions. That
 * can't be demonstrated inside one interactive coding session — nothing
 * here runs unattended for eight real hours while this conversation is
 * open. What IS done: the scheduler and shutdown logic are pure and unit-
 * tested (`tests/orchestrator/scheduler.test.ts`, `shutdown.test.ts`), and
 * this script itself is smoke-tested for a short bounded window
 * (`--dry-run`, and `--hours=<small>` against the real API). The actual
 * eight-hour run is the next thing to kick off and leave running,
 * separately — not something this session can also verify happened.
 *
 * Potion loading (session 20): reuses `liveRun.ts`'s exact policy
 * (`shouldUsePotion`/`DEFAULT_POTION_THRESHOLD`, `MAX_POTIONS_PER_RUN`,
 * `config/bot.json`'s `forbiddenWoods.potions` allowlist) rather than a
 * fresh design — same gate, same defaults, same "absent config -> 0
 * potions" fail-safe. One difference from `liveRun.ts`'s own `main()`,
 * required by this script's shape rather than a design choice:
 * `liveRun.ts` computes its potion loadout ONCE per process and reuses the
 * same mutable `potionPolicy` object across however many runs that one
 * invocation does (`remaining`/`used` intentionally NOT reset per run — see
 * `LiveRunDeps.potionPolicy`'s own doc comment). That's fine for
 * `liveRun.ts`, which in practice is one run per process. The orchestrator
 * starts many independent dungeon runs across one long-lived process, and
 * each genuinely new `start_run` commits its OWN fresh consumables loadout
 * server-side — so `resolvePotionLoadout()` below is called fresh before
 * every dungeon iteration, re-reading the live balance and building a new
 * `potionPolicy` object each time, rather than reusing one across runs.
 *
 * Usage:
 *   npx tsx scripts/orchestrator.ts --dry-run        # one real decision, no action sent
 *   npx tsx scripts/orchestrator.ts --hours=8         # the real loop
 */
import { GigaverseClient } from "../src/api/client.js";
import { UnexpectedResponseError } from "../src/api/errors.js";
import { loadBotConfig, type BotConfig } from "../src/orchestrator/config.js";
import { GuardState, GuardTrip, isBudgetGuardTrip } from "../src/orchestrator/guards.js";
import { acquireGuardLock, loadGuardBudget, DEFAULT_GUARD_STATE_PATH } from "../src/orchestrator/guardPersistence.js";
import { reconcileEnergyAccounting, describeEnergyAccounting } from "../src/orchestrator/energyAccounting.js";
import { nextAction, type EnergyState, type ModeBudget } from "../src/orchestrator/scheduler.js";
import { ensureEnergyFor, clientEnergyPreflightDeps, EnergyPreflightError } from "../src/orchestrator/energyPreflight.js";
import { runWithGuaranteedAccounting } from "../src/orchestrator/runWithAccounting.js";
import { createShutdownSignal, installProcessSigintHandler } from "../src/orchestrator/shutdown.js";
import {
  loadOpponentModel,
  bootstrapFromCorpus,
  saveOpponentModelAtomically,
  DEFAULT_OPPONENT_MODEL_PATH,
} from "../src/orchestrator/opponentModelPersistence.js";
import { DEFAULT_PLAY_COUNTS_PATH } from "../src/orchestrator/playCountsPersistence.js";
import { LIVE_CONFIG } from "../src/strategy/config.js";
import { DEFAULT_POTION_THRESHOLD } from "../src/strategy/potions.js";
import { runOnce, printStatus, MAX_POTIONS_PER_RUN, FixtureWriter as DungeonFixtureWriter, RunLog as DungeonRunLog, type LiveRunDeps } from "./liveRun.js";
import { runOneCast, FixtureWriter as FishingFixtureWriter, RunLog as FishingRunLog, FISHING_GUARD_STATE_PATH, type LiveFishingDeps } from "./liveFishing.js";
import { regenerateRunReports } from "./regenerateReports.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Cap on any one sleep chunk — keeps SIGINT response prompt during a long regen wait rather than blocking in one giant setTimeout. */
const MAX_SLEEP_CHUNK_S = 30;

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const hoursArg = argv.find((a) => a.startsWith("--hours="));
  const hours = hoursArg ? Number(hoursArg.split("=")[1]) : 8;
  // [session 47, brief §1a/§1f] Opt OUT of ROM claiming — same flag name and
  // meaning as scripts/liveFishing.ts's and scripts/liveRun.ts's.
  const noRomClaim = argv.includes("--no-rom-claim");
  return { dryRun, hours, noRomClaim };
}

async function currentEnergyFull(client: GigaverseClient, address: string): Promise<EnergyState> {
  const energy = await client.getEnergy(address);
  const p = energy.entities[0]?.parsedData;
  if (!p || typeof p.energyValue !== "number") {
    throw new Error("GET /offchain/player/energy — entities[0].parsedData missing or malformed");
  }
  return { value: p.energyValue, max: p.maxEnergy, regenPerHour: p.regenPerHour };
}

function dungeonBudgetSnapshot(config: BotConfig, guards: GuardState): ModeBudget {
  return {
    costPerAction: config.energyCostPerRun,
    dailyEnergyBudget: config.dailyEnergyBudget,
    energySpentToday: guards.spentEnergy,
    maxActionsPerSession: config.maxRunsPerSession,
    actionsToday: guards.runCount,
  };
}

function fishingBudgetSnapshot(config: BotConfig, guards: GuardState): ModeBudget {
  // Only called when config.dendren is present — see main()'s guard.
  const d = config.dendren!;
  return {
    costPerAction: d.energyCostPerCast,
    dailyEnergyBudget: d.dailyEnergyBudget,
    energySpentToday: guards.spentEnergy,
    maxActionsPerSession: d.maxCastsPerSession,
    actionsToday: guards.runCount,
  };
}

/**
 * Fresh per dungeon iteration — see this file's header comment for why this
 * can't reuse liveRun.ts's once-per-process pattern. Mirrors `liveRun.ts`'s
 * `main()` allowlist gate exactly: absent `config.potions` -> 0 potions,
 * full stop (silence is not authorization, session 17). Config is the ONLY
 * gate on the ITEM; the live balance only ever caps the per-run COUNT.
 */
async function resolvePotionLoadout(
  client: GigaverseClient,
  config: BotConfig,
): Promise<{ startConsumables?: number[]; potionPolicy?: LiveRunDeps["potionPolicy"] }> {
  if (!config.potions) return {};
  const balances = await client.getItemsBalances();
  const balance = balances.entities.find((e) => e.ID_CID === String(config.potions!.allowedItemId))?.BALANCE_CID ?? 0;
  const potionCount = Math.min(config.potions.maxPerRun, MAX_POTIONS_PER_RUN, balance);
  if (potionCount <= 0) return {};
  const itemId = config.potions.allowedItemId;
  return {
    startConsumables: Array(potionCount).fill(itemId),
    potionPolicy: { itemId, threshold: DEFAULT_POTION_THRESHOLD, remaining: potionCount, used: 0 },
  };
}

/** Sleeps in bounded chunks, breaking early on a shutdown request or the outer `--hours` deadline. */
async function sleepUntil(totalSeconds: number, deadlineMs: number, shutdownSignal: { requested: boolean }): Promise<void> {
  let remaining = totalSeconds;
  while (remaining > 0) {
    if (shutdownSignal.requested) return;
    const secondsUntilDeadline = (deadlineMs - Date.now()) / 1000;
    if (secondsUntilDeadline <= 0) return;
    const chunk = Math.max(1, Math.min(MAX_SLEEP_CHUNK_S, remaining, secondsUntilDeadline));
    await sleep(chunk * 1000);
    remaining -= chunk;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`\n▸ orchestrator.ts — ${args.dryRun ? "single dry-run decision" : `unattended for ${args.hours}h`}\n`);

  const config = loadBotConfig();
  const client = new GigaverseClient();
  const me = await client.getMe();
  console.log(`  account <USER>`);

  // [session 28, CODEXREVIEW #2] One live writer per guard-state file, held
  // for the whole process — the orchestrator manages BOTH files, so it takes
  // both locks. A `liveRun.ts`/`liveFishing.ts` invocation started against
  // the same account while this is running will refuse to start rather than
  // silently racing it.
  process.once("exit", acquireGuardLock(DEFAULT_GUARD_STATE_PATH));
  if (config.dendren) process.once("exit", acquireGuardLock(FISHING_GUARD_STATE_PATH));
  // [session 32, CODEXIMPROVE #1] Same reused lock, against the opponent-
  // model file's own path — see opponentModelPersistence.ts's header.
  process.once("exit", acquireGuardLock(DEFAULT_OPPONENT_MODEL_PATH));
  // [session 36, CODEXAUDIT #3] Same reused lock, against the play-counts
  // file's own path — see playCountsPersistence.ts's header. `liveRun.ts`'s
  // `main()` already took this lock; the orchestrator (the primary
  // unattended long-running entry point) never did, so an interrupted-and-
  // resumed dungeon run forgot every move played before the restart —
  // CODEXIMPROVE #5's resume requirement, unmet in the entry point that
  // matters most for it until now.
  process.once("exit", acquireGuardLock(DEFAULT_PLAY_COUNTS_PATH));
  const playCountsPersistence = { path: DEFAULT_PLAY_COUNTS_PATH };

  const dungeonSeed = loadGuardBudget(DEFAULT_GUARD_STATE_PATH);
  const dungeonGuards = new GuardState(
    { dailyEnergyBudget: config.dailyEnergyBudget, maxRunsPerSession: config.maxRunsPerSession, maxConsecutiveActionFailures: config.maxConsecutiveActionFailures },
    dungeonSeed,
  );
  const fishingGuards = config.dendren
    ? new GuardState(
        { dailyEnergyBudget: config.dendren.dailyEnergyBudget, maxRunsPerSession: config.dendren.maxCastsPerSession, maxConsecutiveActionFailures: config.maxConsecutiveActionFailures },
        loadGuardBudget(FISHING_GUARD_STATE_PATH),
      )
    : null;
  if (!config.dendren) {
    console.log(`  · fishing not configured (config/discovered.json or config/bot.json missing a dendren block) — dungeon-only session.`);
  }

  // [session 32, CODEXIMPROVE #1] Persist and bootstrap the opponent model
  // across restarts — see opponentModelPersistence.ts's header.
  const { model, bootstrapImportedIds } = loadOpponentModel(DEFAULT_OPPONENT_MODEL_PATH);
  const { imported } = bootstrapFromCorpus(model, bootstrapImportedIds);
  if (imported > 0) {
    console.log(`  · opponent model: bootstrapped ${imported} new exchange(s) from the fixture corpus (${bootstrapImportedIds.size} total imported)`);
    saveOpponentModelAtomically(model, bootstrapImportedIds, DEFAULT_OPPONENT_MODEL_PATH);
  }
  const opponentModelPersistence = { path: DEFAULT_OPPONENT_MODEL_PATH, bootstrapImportedIds };
  const shutdownSignal = createShutdownSignal();
  const uninstall = installProcessSigintHandler(shutdownSignal);

  if (args.dryRun) {
    const energy = await currentEnergyFull(client, me.address);
    const decision = nextAction(
      energy,
      dungeonBudgetSnapshot(config, dungeonGuards),
      fishingGuards ? fishingBudgetSnapshot(config, fishingGuards) : null,
    );
    console.log(`  real energy: ${energy.value}/${energy.max} (regen ${energy.regenPerHour}/hr)`);
    console.log(`  [dry-run] next decision: ${JSON.stringify(decision)}\n`);
    uninstall();
    return;
  }

  const deadlineMs = Date.now() + args.hours * 3600 * 1000;
  let iterations = 0;

  while (Date.now() < deadlineMs && !shutdownSignal.requested) {
    iterations++;
    const energy = await currentEnergyFull(client, me.address);
    const decision = nextAction(
      energy,
      dungeonBudgetSnapshot(config, dungeonGuards),
      fishingGuards ? fishingBudgetSnapshot(config, fishingGuards) : null,
    );

    if (decision.kind === "done") {
      console.log(`\n▸ done for today: ${decision.reason}`);
      break;
    }

    if (decision.kind === "sleep") {
      // [session 47, brief §1f] Claim before you wait.
      //
      // Every scheduler `sleep` is an energy shortfall, and since session 22
      // an energy shortfall has been a CLAIM, not a wait — the ROM bank
      // routinely holds thousands (2,603 measured in session 46). Session 25
      // hit the old behaviour live: the loop computed a ~1600s sleep at 4/420,
      // the user topped up from ROMs out-of-band, and the sleeping process had
      // no way to notice. This closes the standing scheduler energy-tracking
      // gap carried from sessions 25 and 40-42.
      //
      // Fail-soft, unlike the pre-batch preflight: if the bank cannot cover
      // the shortfall, sleeping is still the correct action, so the error is
      // reported and the original sleep is honoured rather than ending the
      // session.
      let toppedUp = false;
      if (!args.noRomClaim) {
        try {
          const preflight = await ensureEnergyFor(decision.targetEnergy, clientEnergyPreflightDeps(client, me.address, (l) => console.log(l)));
          toppedUp = !preflight.alreadySufficient;
        } catch (e) {
          if (!(e instanceof EnergyPreflightError)) throw e;
          console.log(`  · ROM bank can't cover the shortfall (${e.message}) — sleeping as planned.`);
        }
      }
      if (toppedUp) {
        console.log(`  ▸ topped up from the ROM bank instead of sleeping — re-deciding.`);
        continue;
      }
      console.log(`  ▸ sleeping ~${decision.seconds}s — ${decision.reason}`);
      await sleepUntil(decision.seconds, deadlineMs, shutdownSignal);
      continue;
    }

    if (decision.kind === "dungeon") {
      console.log(`\n▸ [${iterations}] dungeon run — real energy ${energy.value}/${energy.max}`);
      const before = energy.value;
      // [session 31, CODEXREVIEW #8] Isolates what THIS iteration commits —
      // see src/orchestrator/energyAccounting.ts.
      const committedBefore = dungeonGuards.spentEnergy;
      const { startConsumables, potionPolicy } = await resolvePotionLoadout(client, config);
      if (potionPolicy) {
        console.log(
          `  · potions: loading ${startConsumables!.length}x itemId ${potionPolicy.itemId}, used at own HP ≤${Math.round(potionPolicy.threshold * 100)}%.`,
        );
      }
      // [session 28, CODEXREVIEW #3] This used to `throw e` for any
      // non-budget error BEFORE the after-energy read/accounting below ever
      // ran — so if `start_run` had already spent real energy and something
      // failed afterward (an unexpected state, a schema mismatch, a genuine
      // anomaly), the restart forgot that real spend ever happened.
      // `runWithGuaranteedAccounting` enforces: accounting ALWAYS runs,
      // whatever happened, and a genuine anomaly still propagates AFTER it.
      await runWithGuaranteedAccounting({
        action: () =>
          runOnce({
            client,
            config,
            guards: dungeonGuards,
            model,
            strategyConfig: LIVE_CONFIG,
            fixtures: new DungeonFixtureWriter(me.address, (text) => client.redactSecrets(text)),
            log: new DungeonRunLog(),
            dryRun: false,
            shutdownSignal,
            guardStatePath: DEFAULT_GUARD_STATE_PATH,
            startConsumables,
            potionPolicy,
            opponentModelPersistence,
            playCountsPersistence,
          } satisfies LiveRunDeps),
        isBudgetTrip: (e) => e instanceof GuardTrip && isBudgetGuardTrip(e),
        onBudgetTrip: (e) => console.log(`  · dungeon budget exhausted for today (${(e as Error).message}) — switching to fishing/sleep for the rest of this session.`),
        account: async () => {
          // [session 31, CODEXREVIEW #8] Diagnostic only — the guard was
          // already enforced off the COMMITTED spend inside `runOnce`
          // (recorded and persisted the moment start_run succeeded). This
          // before/after read is reconciled against it, not fed back in.
          const after = await currentEnergyFull(client, me.address);
          const committedDelta = dungeonGuards.spentEnergy - committedBefore;
          const report = reconcileEnergyAccounting(before, after.value, committedDelta);
          console.log(describeEnergyAccounting(report));
        },
      });
      continue;
    }

    if (decision.kind === "fishing") {
      console.log(`\n▸ [${iterations}] fishing cast — real energy ${energy.value}/${energy.max}`);
      const before = energy.value;
      // [session 31, CODEXREVIEW #8] Isolates what THIS iteration commits —
      // see src/orchestrator/energyAccounting.ts.
      const committedBefore = fishingGuards!.spentEnergy;
      // [session 28, CODEXREVIEW #3] Same fix as the dungeon branch above —
      // accounting is guaranteed to run before any anomaly propagates.
      await runWithGuaranteedAccounting({
        action: async () => {
          await runOneCast({
            client,
            config,
            guards: fishingGuards!,
            fixtures: new FishingFixtureWriter(me.address, (text) => client.redactSecrets(text)),
            log: new FishingRunLog(),
            address: me.address,
            dryRun: false,
            shutdownSignal,
            guardStatePath: FISHING_GUARD_STATE_PATH,
          } satisfies LiveFishingDeps);
        },
        isBudgetTrip: (e) => e instanceof GuardTrip && isBudgetGuardTrip(e),
        onBudgetTrip: (e) => console.log(`  · fishing budget exhausted for today (${(e as Error).message}) — switching to dungeon/sleep for the rest of this session.`),
        account: async () => {
          // [session 31, CODEXREVIEW #8] Diagnostic only — the guard was
          // already enforced off the COMMITTED spend inside `runOneCast`.
          const after = await currentEnergyFull(client, me.address);
          const committedDelta = fishingGuards!.spentEnergy - committedBefore;
          const report = reconcileEnergyAccounting(before, after.value, committedDelta);
          console.log(describeEnergyAccounting(report));
        },
      });
      continue;
    }
  }

  uninstall();
  if (shutdownSignal.requested) console.log(`\n▸ stopped by SIGINT after ${iterations} iteration(s).`);
  else if (Date.now() >= deadlineMs) console.log(`\n▸ ${args.hours}h window elapsed after ${iterations} iteration(s).`);

  console.log(`\n▸ rollup:`);
  printStatus(config);
  const finalEnergy = await currentEnergyFull(client, me.address);
  console.log(`  real account energy: ${finalEnergy.value}/${finalEnergy.max} (regen ${finalEnergy.regenPerHour}/hr)\n`);

  // [session 30, extracted session 31] Run-visibility reporting —
  // regenerate both committed markdown reports from the full fixture corpus
  // at the end of every session (same "recap reads the real state"
  // discipline as STATE.md). Non-fatal, shared with liveRun.ts/
  // liveFishing.ts's standalone invocations — see regenerateReports.ts.
  regenerateRunReports(config);
}

const isMain = process.argv[1] && process.argv[1].endsWith("orchestrator.ts");
if (isMain) {
  main().catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
    if (e instanceof GuardTrip) console.error(`  detail: ${JSON.stringify(e.detail)}`);
    if (e instanceof UnexpectedResponseError) console.error(`  status ${e.status}  path ${e.path}\n  body: ${e.body}`);
    process.exit(1);
  });
}
