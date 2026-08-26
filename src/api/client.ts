/**
 * src/api/client.ts — the only module in this repo allowed to call
 * gigaverse.io. CLAUDE.md: "Keep the API client free of game logic" — this
 * file knows HTTP, auth, rate limiting and response shapes, and nothing about
 * strategy.
 *
 * Three disciplines stacked on every request, per CLAUDE.md §7 / SPEC §2:
 *  1. Rate limiter — minimum 1200ms + 0-400ms jitter between requests.
 *  2. Mutex — one request in flight at a time. The action-token window is
 *     ~5s; a second concurrent request can only race it, never help it.
 *  3. 429 backoff — exponential from 5s.
 */

import type { z } from "zod";
import { loadJwt, mask } from "./auth.js";
import { TokenExpiredError, RateLimitedError, UnexpectedResponseError, RequestTimeoutError } from "./errors.js";
import {
  UserMeSchema,
  AccountSchema,
  EnergySchema,
  DungeonTodaySchema,
  DungeonStateOrIdleSchema,
  ItemsBalancesSchema,
  GearInstancesResponseSchema,
  JuiceSchema,
  DungeonActionResponseSchema,
  RomClaimResponseSchema,
  RomsPlayerResponseSchema,
  type UserMe,
  type Account,
  type Energy,
  type DungeonToday,
  type DungeonState,
  type ItemsBalances,
  type GearInstancesResponse,
  type Juice,
  type DungeonActionRequest,
  type DungeonActionResponse,
  type RomClaimResponse,
  type RomsPlayerResponse,
} from "./schemas.js";
import {
  FishingStateSchema,
  FishingActionResponseSchema,
  type FishingState,
  type FishingActionRequest,
  type FishingActionResponse,
} from "./fishing.js";

const BASE = "https://gigaverse.io/api";
const MIN_GAP_MS = 1200;
const JITTER_MS = 400;
const BACKOFF_START_MS = 5000;
const MAX_429_RETRIES = 5;

/**
 * [session 78, §1 / CODEXAUG22REVIEW M1] Every request's deadline. Not a round
 * number picked for looking reasonable — derived from this file's own measured
 * constants, because a deadline set below the action-token window converts a
 * slow-but-fine request into an abort, which is a worse failure than the one it
 * prevents:
 *
 *   action-token window   ~5000ms   (CLAUDE.md §7, and `RequestPacing` below)
 *   observed latency      720-1780ms, median 1450 (session 53, ten run logs)
 *
 * 10s is 2x the token window and ~5.6x the slowest response this repo has ever
 * recorded, so nothing that was going to succeed gets cut off. Anything past it
 * has already missed the window it was racing: the token it carries is stale by
 * construction, so waiting longer cannot turn it into a success.
 *
 * The deadline covers headers AND body — `res.text()` can stall just as
 * completely as the connect — which is why the whole attempt is raced rather
 * than only the `fetch()` call.
 */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * A GET that times out is retried this many extra times before throwing. A GET
 * is idempotent and the abort proves nothing was written, so retrying is free
 * of the ambiguity a POST retry carries; bounded at 1 so a persistently dead
 * endpoint still fails closed rather than looping (CLAUDE.md §5). The rate
 * limiter already spaces the two attempts by the usual 1200ms + jitter, so no
 * extra delay is added here.
 */
const MAX_GET_TIMEOUT_RETRIES = 1;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serializes every request so the action-token sequence can never race itself. */
class Mutex {
  private tail: Promise<void> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const held = new Promise<void>((res) => (release = res));
    const prev = this.tail;
    this.tail = held;
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * Per-request pacing overrides. Pure timing mechanics — WHICH actions need a
 * longer gap is game knowledge and stays in `src/orchestrator`/`scripts`
 * (CLAUDE.md working style: the client knows HTTP, not strategy).
 */
export interface RequestPacing {
  /**
   * Minimum ms between the last RESPONSE we received and this request going
   * out. Distinct from `MIN_GAP_MS`, which is measured request-to-request.
   *
   * [session 53] The distinction is the whole point and it is easy to get
   * wrong. The server holds exactly one outstanding action token and rejects
   * any POST carrying `actionToken: ""` while it is still outstanding
   * (`Invalid action token  != <N>`). Measured across all ten run logs
   * (`scripts/rejectionAudit.ts`), on LOCAL response timestamps:
   *
   *   empty-token POST rejected  n=66  gap-since-last-response 0.90 - 1.54 s
   *   empty-token POST accepted  n=66  gap-since-last-response 3.40 - 4.92 s
   *   numeric-token POST         n=224 always accepted, 0.90 - 1.79 s
   *
   * Zero overlap: the threshold is somewhere in (1.54, 3.40) SINCE THE
   * RESPONSE. A request-to-request gap cannot express that, because it
   * differs from the response gap by one response latency (0.72 - 1.78 s,
   * median 1.45) — a `MIN_GAP_MS` of 3600 would leave only ~1.8 s since the
   * response in the worst case, i.e. inside the reject band.
   */
  minGapSinceResponseMs?: number;
}

class RateLimiter {
  private lastCallAt = 0;
  private lastResponseAt = 0;

  async wait(pacing?: RequestPacing): Promise<void> {
    const gap = MIN_GAP_MS + Math.random() * JITTER_MS;
    const now = Date.now();

    let sleepMs = Math.max(0, gap - (now - this.lastCallAt));

    const sinceResponseGap = pacing?.minGapSinceResponseMs ?? 0;
    if (sinceResponseGap > 0 && this.lastResponseAt > 0) {
      sleepMs = Math.max(sleepMs, sinceResponseGap - (now - this.lastResponseAt));
    }

    if (sleepMs > 0) await sleep(sleepMs);
    this.lastCallAt = Date.now();
  }

  /** Stamped when a response comes back, whatever its status — see `RequestPacing`. */
  noteResponse(): void {
    this.lastResponseAt = Date.now();
  }
}

export interface ClientOptions {
  /** Overrides the JWT loaded from ~/.secrets — used by tests to inject a bad token. */
  jwt?: string;
  /** Overrides the base URL — used by tests to point at a local mock server. */
  baseUrl?: string;
}

export class GigaverseClient {
  private readonly jwt: string;
  private readonly base: string;
  private readonly mutex = new Mutex();
  private readonly limiter = new RateLimiter();
  /** Newest actionToken seen from any dungeon endpoint. SPEC §2: always send the newest. */
  private actionToken = 0;
  /**
   * Fishing's own action-token sequence — kept SEPARATE from the dungeon
   * one above rather than sharing `get()`/`post()`'s auto-update, because
   * `SPEC-fishing.md §2` confirms it's a different chain with a different
   * wire shape (request token is a STRING, response token is a top-level
   * NUMBER that must be `String()`-ed for the next request; the dungeon
   * side's request token is a bare number). The real capture's first
   * `start_run` sends `actionToken: ""` (empty string), not a stale numeric
   * token — `fixtures/fishing-casts/cast.json` request 0, confirmed.
   */
  private fishingActionToken = "";

  constructor(opts: ClientOptions = {}) {
    this.jwt = opts.jwt ?? loadJwt();
    this.base = opts.baseUrl ?? BASE;
  }

  maskedJwt(): string {
    return mask(this.jwt);
  }

  /**
   * [session 28, CODEXREVIEW #7] The only way to redact a real bearer token
   * out of text that might echo it — every prior caller passed
   * `maskedJwt().split("...")[0]`, the truncated DISPLAY prefix (8 chars),
   * not the real token. If a live response ever echoed the full JWT, only
   * those 8 characters were ever replaced and most of a real credential
   * could land in a committed "redacted" fixture on this public repo
   * (DECISIONS 2026-08-12: repo is public). This keeps the real token
   * private to the instance — it is used internally and never returned.
   */
  redactSecrets(text: string): string {
    return this.jwt ? text.split(this.jwt).join("<JWT>") : text;
  }

  getActionToken(): number {
    return this.actionToken;
  }

  /** Current fishing actionToken, as the STRING the next request needs (`""` before any fishing action this session). */
  getFishingActionToken(): string {
    return this.fishingActionToken;
  }

  /**
   * One HTTP call, disciplined. Not exported — every endpoint below goes
   * through this so no caller can accidentally skip the mutex or the limiter.
   */
  private async raw(
    path: string,
    init?: RequestInit,
    pacing?: RequestPacing,
  ): Promise<{ status: number; text: string }> {
    const method = (init?.method ?? "GET").toUpperCase();
    return this.mutex.run(async () => {
      let attempt = 0;
      let timeouts = 0;
      for (;;) {
        await this.limiter.wait(pacing);

        let res: { status: number; text: string };
        try {
          res = await this.fetchWithDeadline(path, method, init);
        } catch (e) {
          // [session 78, §1] A GET abort proves nothing was written, so it may
          // be retried under a BOUNDED policy. A POST abort proves nothing at
          // all and is rethrown untouched for the caller's transaction helper
          // to reconcile — retrying it here is exactly the blind replay
          // CODEXAUG22REVIEW H1 is about.
          if (
            e instanceof RequestTimeoutError &&
            !e.ambiguousWrite &&
            timeouts < MAX_GET_TIMEOUT_RETRIES
          ) {
            timeouts++;
            continue;
          }
          throw e;
        }
        this.limiter.noteResponse();

        if (res.status === 429) {
          attempt++;
          if (attempt > MAX_429_RETRIES) throw new RateLimitedError(attempt);
          await sleep(BACKOFF_START_MS * 2 ** (attempt - 1));
          continue;
        }
        return res;
      }
    });
  }

  /**
   * [session 78, §1 / CODEXAUG22REVIEW M1] One `fetch` under a hard deadline.
   *
   * Two mechanisms, deliberately both:
   *  1. `AbortController` — tears the socket down, so a stalled connection is
   *     actually released rather than left dangling behind a returned promise.
   *  2. `Promise.race` against a timer — so `raw()`'s own return is bounded
   *     even if the fetch implementation ignores the signal. The point of this
   *     method is that the caller CANNOT hang; depending on the abort being
   *     honoured would make that guarantee conditional on the one thing we
   *     cannot observe from here.
   *
   * The race covers `res.text()` as well as the `fetch()`, because a response
   * whose headers arrive and whose body stalls hangs just as completely.
   */
  private async fetchWithDeadline(
    path: string,
    method: string,
    init?: RequestInit,
  ): Promise<{ status: number; text: string }> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new RequestTimeoutError(method, path, REQUEST_TIMEOUT_MS));
      }, REQUEST_TIMEOUT_MS);
    });

    const attempt = (async () => {
      const res = await fetch(`${this.base}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${this.jwt}`,
        },
      });
      const text = await res.text();
      return { status: res.status, text };
    })();

    // An abandoned attempt still rejects later (the abort lands on it); without
    // this it surfaces as an unhandled rejection and can kill the process.
    attempt.catch(() => {});

    try {
      return await Promise.race([attempt, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Parse + validate against a zod schema. Fails closed (CLAUDE.md §5): a
   * non-2xx or a body that doesn't match the schema throws rather than
   * returning something partially trusted.
   */
  private async get<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> {
    const { status, text } = await this.raw(path, { method: "GET" });

    if (status === 401 || status === 403) throw new TokenExpiredError(status, text);
    if (status < 200 || status >= 300) throw new UnexpectedResponseError(status, path, text);

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new UnexpectedResponseError(status, path, text);
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new UnexpectedResponseError(
        status,
        path,
        `zod validation failed: ${parsed.error.message}\n\nbody: ${text.slice(0, 2000)}`,
      );
    }
    const body = parsed.data as { actionToken?: number };
    if (typeof body.actionToken === "number") this.actionToken = body.actionToken;
    return parsed.data;
  }

  /**
   * POST + validate. Mirrors `get()`'s discipline exactly (fail closed on
   * non-2xx or a zod mismatch, update `actionToken` from the response) —
   * this is the first POST path in the client, and CLAUDE.md §4 makes every
   * live send high-stakes, so it gets no less scrutiny than a GET.
   */
  private async post<S extends z.ZodTypeAny>(
    path: string,
    body: unknown,
    schema: S,
    pacing?: RequestPacing,
  ): Promise<z.infer<S>> {
    const { status, text } = await this.raw(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      pacing,
    );

    if (status === 401 || status === 403) throw new TokenExpiredError(status, text);
    if (status < 200 || status >= 300) throw new UnexpectedResponseError(status, path, text);

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new UnexpectedResponseError(status, path, text);
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new UnexpectedResponseError(
        status,
        path,
        `zod validation failed: ${parsed.error.message}\n\nbody: ${text.slice(0, 2000)}`,
      );
    }
    const respBody = parsed.data as { actionToken?: number };
    if (typeof respBody.actionToken === "number") this.actionToken = respBody.actionToken;
    return parsed.data;
  }

  /**
   * SPEC §2's one CONFIRMED POST path — every dungeon action (`start_run`,
   * `rock`/`paper`/`scissor`, `loot_one`…, `use_item`, `heal_or_damage`,
   * `flee`, `cancel_run`) goes through this single method. The caller builds
   * `body.actionToken` from `getActionToken()` — this method does not inject
   * it, so the caller's log of "what did I send" always matches what went
   * over the wire.
   */
  async postDungeonAction(
    body: DungeonActionRequest,
    pacing?: RequestPacing,
  ): Promise<DungeonActionResponse> {
    return this.post("/game/dungeon/action", body, DungeonActionResponseSchema, pacing);
  }

  async getMe(): Promise<UserMe> {
    return this.get("/user/me", UserMeSchema);
  }

  async getAccount(address: string): Promise<Account> {
    return this.get(`/game/account/${address}`, AccountSchema);
  }

  async getEnergy(address: string): Promise<Energy> {
    return this.get(`/offchain/player/energy/${address}`, EnergySchema);
  }

  async getDungeonToday(): Promise<DungeonToday> {
    return this.get("/game/dungeon/today", DungeonTodaySchema);
  }

  /**
   * "No active run" has TWO wire shapes (session 08, live — SPEC was only
   * built around the first):
   *  1. A run that just ENDED: HTTP 500, an HTML error page.
   *  2. An account that was never in a run this session (or IS between runs):
   *     HTTP 200, `{success:true, data:{run:null, entity:null}, actionToken:0}`.
   * Both mean the same thing to a caller — return `null` either way. Every
   * other non-2xx, or a 2xx that fails even the nullable shape, still throws.
   *
   * **[session 08, live, Task 6 stage 3] This response's `actionToken` is
   * NOT a fresh token to track — it reports `0` regardless of the run's real
   * state.** Confirmed 3 times on one live run: read #1 (before any action)
   * → 0; a `rock` POST succeeded and returned a real token
   * (`1786737196369`); the very next `getDungeonState()` read → `0` again,
   * with the run state otherwise UNCHANGED. The old code did
   * `this.actionToken = parsed.data.actionToken` here unconditionally, which
   * clobbered the real token the POST had just set — the following action
   * was sent with the stale `0` and the server rejected it with HTTP 500.
   * SPEC §2's "every response returns a fresh actionToken, always send the
   * newest" holds for `POST /game/dungeon/action` (see `post()` below) but
   * NOT for this endpoint — a GET is a read, not an action, and apparently
   * doesn't advance or echo the action-token sequence. Do not restore this
   * line without new live evidence it's safe.
   */
  /**
   * One read attempt. Returns `{ kind: "5xx" }` rather than throwing on a
   * server failure — the caller (`getDungeonState` below) decides whether to
   * retry. Every other outcome (auth failure, a non-5xx non-2xx, an
   * unparseable body, a body that fails the schema) still throws directly —
   * only "the server itself failed" is deferred to the retry policy.
   */
  private async getDungeonStateOnce(): Promise<{ kind: "5xx" } | { kind: "state"; value: DungeonState | null }> {
    const { status, text } = await this.raw("/game/dungeon/state", { method: "GET" });
    if (status === 401 || status === 403) throw new TokenExpiredError(status, text);
    if (status >= 500) return { kind: "5xx" };
    if (status < 200 || status >= 300) throw new UnexpectedResponseError(status, "/game/dungeon/state", text);

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new UnexpectedResponseError(status, "/game/dungeon/state", text);
    }
    const parsed = DungeonStateOrIdleSchema.safeParse(json);
    if (!parsed.success) {
      throw new UnexpectedResponseError(
        status,
        "/game/dungeon/state",
        `zod validation failed: ${parsed.error.message}\n\nbody: ${text.slice(0, 2000)}`,
      );
    }
    if (parsed.data.data.run === null) return { kind: "state", value: null };
    // Narrowed above: `run` is non-null here, matching DungeonState's stricter shape.
    return { kind: "state", value: parsed.data as DungeonState };
  }

  /**
   * [session 28, CODEXREVIEW #4] A blanket "any 5xx means no active run"
   * used to live here directly. That conflated two genuinely different
   * things: the historical "a run that just ended returns an HTML 500"
   * shape (session 08), and a transient server outage — which reads
   * IDENTICALLY under the old rule. Worse, after a failed action POST,
   * `postWithVerifiedRetry()` (scripts/liveRun.ts) treats a null read here
   * as "the action is no longer pending" and can report it as applied when
   * it never did — risking an abandoned or duplicated run on nothing more
   * than a transient blip.
   *
   * Now: one 5xx retries once (the rate limiter already spaces the two
   * calls by the usual 1200ms+jitter gap — no extra delay needed). If the
   * retry clears to the authoritative HTTP-200 idle shape (`data.run:null`)
   * or a real run, that's returned as before. If the SECOND attempt is also
   * a 5xx, this now throws `UnexpectedResponseError` instead of silently
   * reading as idle — a persistent server failure is a genuine anomaly
   * (CLAUDE.md §5), not evidence the account has no active run.
   */
  async getDungeonState(): Promise<DungeonState | null> {
    const first = await this.getDungeonStateOnce();
    if (first.kind === "state") return first.value;
    const second = await this.getDungeonStateOnce();
    if (second.kind === "state") return second.value;
    throw new UnexpectedResponseError(
      500,
      "/game/dungeon/state",
      "repeated 5xx on /game/dungeon/state — treating as a genuine server failure, not an idle account (CODEXREVIEW #4)",
    );
  }

  async getItemsBalances(): Promise<ItemsBalances> {
    return this.get("/items/balances", ItemsBalancesSchema);
  }

  /**
   * `GET /api/gear/instances/{address}` — CONFIRMED, captured 200 in
   * `fixtures/fishing-casts/fishing-cast.har` (148 rows). Not brute-forced:
   * the path came out of a recorded browser session, per CLAUDE.md rule 2.
   *
   * The one place `DURABILITY_CID` is published for the equipped rod. A read,
   * not an action — no token chain, no pacing beyond the client's own.
   */
  async getGearInstances(address: string): Promise<GearInstancesResponse> {
    return this.get(`/gear/instances/${address}`, GearInstancesResponseSchema);
  }

  async getJuice(address: string): Promise<Juice> {
    return this.get(`/gigajuice/player/${address}`, JuiceSchema);
  }

  /**
   * `GET /api/fishing/state/{address}` — SPEC-fishing.md §1 (CONFIRMED).
   * Does not advance `fishingActionToken`: the token chain only moves via
   * `POST /fishing/action` responses (SPEC-fishing.md §2), and this read
   * carries no `actionToken` field at all to update from.
   */
  async getFishingState(address: string): Promise<FishingState> {
    const path = `/fishing/state/${address}`;
    const { status, text } = await this.raw(path, { method: "GET" });

    if (status === 401 || status === 403) throw new TokenExpiredError(status, text);
    if (status < 200 || status >= 300) throw new UnexpectedResponseError(status, path, text);

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new UnexpectedResponseError(status, path, text);
    }
    const parsed = FishingStateSchema.safeParse(json);
    if (!parsed.success) {
      throw new UnexpectedResponseError(
        status,
        path,
        `zod validation failed: ${parsed.error.message}\n\nbody: ${text.slice(0, 2000)}`,
      );
    }
    return parsed.data;
  }

  /**
   * `POST /api/fishing/action` — SPEC-fishing.md §2 (CONFIRMED envelope,
   * one write endpoint covering both `start_run` and `play_cards`). Updates
   * `fishingActionToken` from the response's TOP-LEVEL `actionToken`
   * (a number — `String()`-ed here since the next request needs it as a
   * string), never from `data.doc` or anywhere else.
   */
  async postFishingAction(body: FishingActionRequest): Promise<FishingActionResponse> {
    const path = "/fishing/action";
    const { status, text } = await this.raw(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (status === 401 || status === 403) throw new TokenExpiredError(status, text);
    if (status < 200 || status >= 300) throw new UnexpectedResponseError(status, path, text);

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new UnexpectedResponseError(status, path, text);
    }
    const parsed = FishingActionResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new UnexpectedResponseError(
        status,
        path,
        `zod validation failed: ${parsed.error.message}\n\nbody: ${text.slice(0, 2000)}`,
      );
    }
    this.fishingActionToken = String(parsed.data.actionToken);
    return parsed.data;
  }

  /**
   * `POST /roms/factory-claim` — CONFIRMED session 19/20 (SPEC.md "ROM
   * factory-claim"). `amount` is REQUIRED by the server (omitting it
   * returns HTTP 500) but is fully cosmetic — the server always credits
   * the ROM's own real-time `energyCollectable`, confirmed twice with a
   * deliberately mismatched value. Promoted from `scripts/
   * probeRomsFactoryClaim.ts`'s raw-fetch probe now that the endpoint is
   * confirmed, so it gets the same rate-limit/mutex discipline as every
   * other write.
   */
  async claimRomEnergy(romId: string, amount = 0): Promise<RomClaimResponse> {
    return this.post("/roms/factory-claim", { romId, claimId: "energy", amount }, RomClaimResponseSchema);
  }

  /**
   * `GET /roms/player?id=<address>` — CONFIRMED session 22 (user-supplied
   * URL, SPEC.md "ROM enumeration"). Lists all owned ROMs with their current
   * `factoryStats.energyCollectable`. Read-only.
   */
  async getRomsPlayer(address: string): Promise<RomsPlayerResponse> {
    return this.get(`/roms/player?id=${address}`, RomsPlayerResponseSchema);
  }
}
