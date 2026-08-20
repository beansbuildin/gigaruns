/**
 * scripts/orchestrator.ts — Task 10. Budget-aware autonomous loop, energy-
 * regen sleeps, graceful SIGINT, a rollup at exit. FISHING ONLY as of
 * session 54 — see the rule 11 note below for why the dungeon arm is closed.
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
 * [session 54] THE DUNGEON ARM IS CLOSED — CLAUDE.md rule 11.
 *
 * Every dungeon run is now a 60-energy juiced Tier-3 entry that stops for
 * human approval before the next one. An autonomous loop cannot satisfy a
 * per-run approval requirement, so this script does not start dungeon runs
 * at all: `nextAction` is called with a null dungeon budget, and the
 * `dungeon` branch below fails closed. Dungeon runs go through
 * `npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1`.
 *
 * What that deleted, deliberately, rather than leaving unreachable:
 *  - `resolvePotionLoadout()` (session 20). It gated on `config.potions`
 *    alone while `liveRun.ts`'s `main()` gates on the config block AND
 *    `--juiced`, and this script called `runOnce` with no `juicedStartRun` —
 *    so with `forbiddenWoods.potions` now permanent (rule 11), the next
 *    invocation would have loaded 3 Big Heal Juices into a plain 20-energy
 *    run. That is session 24's incident verbatim. An unreachable potion
 *    loader is exactly the thing that gets re-reached later.
 *  - `dungeonBudgetSnapshot()`, whose `costPerAction` was
 *    `config.energyCostPerRun` (20) — wrong under rule 11, and not to be
 *    "fixed" to 60 while keeping the arm.
 *  - The dungeon-side guard/opponent-model/play-count LOCKS. They are held
 *    for the life of the process and `liveRun.ts` needs all three, so an
 *    8-hour orchestrator session would have refused every rule-11 dungeon
 *    run the user approved during it. With the arm closed this process
 *    never writes those files, so holding their locks is pure obstruction.
 *
 * The FISHING arm is untouched and still runs autonomously within budget.
 *
 * Usage:
 *   npx tsx scripts/orchestrator.ts --dry-run        # one real decision, no action sent
 *   npx tsx scripts/orchestrator.ts --hours=8         # the real loop
 */
import { GigaverseClient } from "../src/api/client.js";
import { UnexpectedResponseError } from "../src/api/errors.js";
import { loadBotConfig, type BotConfig } from "../src/orchestrator/config.js";
import { GuardState, GuardTrip, isBudgetGuardTrip } from "../src/orchestrator/guards.js";
import { acquireGuardLock, loadGuardBudget } from "../src/orchestrator/guardPersistence.js";
import { reconcileEnergyAccounting, describeEnergyAccounting } from "../src/orchestrator/energyAccounting.js";
import { nextAction, type EnergyState, type ModeBudget } from "../src/orchestrator/scheduler.js";
import { ensureEnergyFor, clientEnergyPreflightDeps, EnergyPreflightError } from "../src/orchestrator/energyPreflight.js";
import { runWithGuaranteedAccounting } from "../src/orchestrator/runWithAccounting.js";
import { createShutdownSignal, installProcessSigintHandler } from "../src/orchestrator/shutdown.js";
import { printStatus } from "./liveRun.js";
import { runOneCast, FixtureWriter as FishingFixtureWriter, RunLog as FishingRunLog, FISHING_GUARD_STATE_PATH, type LiveFishingDeps } from "./liveFishing.js";
import { regenerateRunReports } from "./regenerateReports.js";

/**
 * [session 54, CLAUDE.md rule 11] The dungeon arm, expressed as a value.
 *
 * `nextAction` already documents a null mode budget as "isn't configured at
 * all — treated as permanently unavailable, never as 'sleep and wait for
 * it'", which is exactly the semantics rule 11 wants: this loop must not
 * start a dungeon run, and must not stall waiting for energy it will never
 * spend. Naming the null makes the intent legible at both call sites and
 * makes the reason greppable from the branch that fails closed.
 */
const DUNGEON_ARM_DISABLED = null;

/** The one message every closed-dungeon path prints, so there is a single place to fix if the pointer changes. */
const RULE_11_POINTER =
  "dungeon runs are disabled in the orchestrator (CLAUDE.md rule 11: every run is a 60-energy juiced Tier-3 entry " +
  "needing explicit human approval, which an autonomous loop cannot give). " +
  "Run one with: npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1";

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
  // for the whole process. A `liveFishing.ts` invocation started against the
  // same account while this is running will refuse to start rather than
  // silently racing it.
  //
  // [session 54, rule 11] This process takes the FISHING lock only. It used
  // to take the dungeon guard-budget, opponent-model and play-counts locks
  // as well — all three held for the life of the process, and all three
  // needed by `liveRun.ts`. With the dungeon arm closed this process never
  // writes any of them, so holding their locks would do nothing but refuse
  // the user's approved rule-11 dungeon runs for the whole 8-hour window.
  if (config.dendren) process.once("exit", acquireGuardLock(FISHING_GUARD_STATE_PATH));

  const fishingGuards = config.dendren
    ? new GuardState(
        { dailyEnergyBudget: config.dendren.dailyEnergyBudget, maxRunsPerSession: config.dendren.maxCastsPerSession, maxConsecutiveActionFailures: config.maxConsecutiveActionFailures },
        loadGuardBudget(FISHING_GUARD_STATE_PATH),
      )
    : null;
  // [session 54, rule 11] The dungeon arm is closed, so fishing is the ONLY
  // thing this loop can do. Without a dendren block there is no work at all
  // — say so plainly rather than letting `nextAction` report it as "both
  // modes' budget exhausted", which it is not.
  if (!config.dendren) {
    console.log(`  · fishing not configured (config/discovered.json or config/bot.json missing a dendren block).`);
    console.log(`  · the dungeon arm is disabled (CLAUDE.md rule 11) — nothing for this loop to do.\n`);
  }

  // [session 54] The opponent-model bootstrap/save lived here to serve
  // `runOnce`. With the dungeon arm closed nothing in this process reads or
  // writes the model, and bootstrapping it would be a write to a real data
  // path by a process that never uses it. `liveRun.ts` still does its own.
  const shutdownSignal = createShutdownSignal();
  const uninstall = installProcessSigintHandler(shutdownSignal);

  if (args.dryRun) {
    const energy = await currentEnergyFull(client, me.address);
    const decision = nextAction(
      energy,
      // [session 54, rule 11] null = the dungeon arm is not merely out of
      // budget, it is permanently unavailable to this loop, so the scheduler
      // never sleeps waiting for it and never returns `{kind: "dungeon"}`.
      DUNGEON_ARM_DISABLED,
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
      // [session 54, rule 11] null = the dungeon arm is not merely out of
      // budget, it is permanently unavailable to this loop, so the scheduler
      // never sleeps waiting for it and never returns `{kind: "dungeon"}`.
      DUNGEON_ARM_DISABLED,
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
      // [session 54, rule 11] Unreachable by construction — `nextAction` is
      // called with a null dungeon budget above, so it cannot return this.
      // Kept as a loud fail-closed rather than deleted: if someone
      // reintroduces a dungeon budget at the call site, this stops the
      // process instead of quietly starting a run nobody approved.
      // CLAUDE.md §5 — a stopped bot costs nothing.
      throw new Error(`scheduler returned {kind: "dungeon"} — ${RULE_11_POINTER}`);
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
        onBudgetTrip: (e) => console.log(`  · fishing budget exhausted for today (${(e as Error).message}) — sleeping/finishing out the session.`),
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
