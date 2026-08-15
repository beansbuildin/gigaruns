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
import { TokenExpiredError, RateLimitedError, UnexpectedResponseError } from "./errors.js";
import {
  UserMeSchema,
  AccountSchema,
  EnergySchema,
  DungeonTodaySchema,
  DungeonStateOrIdleSchema,
  ItemsBalancesSchema,
  JuiceSchema,
  DungeonActionResponseSchema,
  type UserMe,
  type Account,
  type Energy,
  type DungeonToday,
  type DungeonState,
  type ItemsBalances,
  type Juice,
  type DungeonActionRequest,
  type DungeonActionResponse,
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

class RateLimiter {
  private lastCallAt = 0;

  async wait(): Promise<void> {
    const gap = MIN_GAP_MS + Math.random() * JITTER_MS;
    const elapsed = Date.now() - this.lastCallAt;
    if (elapsed < gap) await sleep(gap - elapsed);
    this.lastCallAt = Date.now();
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
  private async raw(path: string, init?: RequestInit): Promise<{ status: number; text: string }> {
    return this.mutex.run(async () => {
      let attempt = 0;
      for (;;) {
        await this.limiter.wait();
        const res = await fetch(`${this.base}${path}`, {
          ...init,
          headers: {
            ...(init?.headers ?? {}),
            Authorization: `Bearer ${this.jwt}`,
          },
        });
        const text = await res.text();

        if (res.status === 429) {
          attempt++;
          if (attempt > MAX_429_RETRIES) throw new RateLimitedError(attempt);
          await sleep(BACKOFF_START_MS * 2 ** (attempt - 1));
          continue;
        }
        return { status: res.status, text };
      }
    });
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
  private async post<S extends z.ZodTypeAny>(path: string, body: unknown, schema: S): Promise<z.infer<S>> {
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
  async postDungeonAction(body: DungeonActionRequest): Promise<DungeonActionResponse> {
    return this.post("/game/dungeon/action", body, DungeonActionResponseSchema);
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
  async getDungeonState(): Promise<DungeonState | null> {
    const { status, text } = await this.raw("/game/dungeon/state", { method: "GET" });
    if (status === 401 || status === 403) throw new TokenExpiredError(status, text);
    if (status >= 500) return null;
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
    if (parsed.data.data.run === null) return null;
    // Narrowed above: `run` is non-null here, matching DungeonState's stricter shape.
    return parsed.data as DungeonState;
  }

  async getItemsBalances(): Promise<ItemsBalances> {
    return this.get("/items/balances", ItemsBalancesSchema);
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
}
