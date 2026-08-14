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
  DungeonStateSchema,
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
   * SPEC: `/game/dungeon/state` returns a 500 HTML error page once a run
   * ends — that means "no active run", not a server failure. Every other
   * non-2xx still throws.
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
    const parsed = DungeonStateSchema.safeParse(json);
    if (!parsed.success) {
      throw new UnexpectedResponseError(
        status,
        "/game/dungeon/state",
        `zod validation failed: ${parsed.error.message}\n\nbody: ${text.slice(0, 2000)}`,
      );
    }
    this.actionToken = parsed.data.actionToken;
    return parsed.data;
  }

  async getItemsBalances(): Promise<ItemsBalances> {
    return this.get("/items/balances", ItemsBalancesSchema);
  }

  async getJuice(address: string): Promise<Juice> {
    return this.get(`/gigajuice/player/${address}`, JuiceSchema);
  }
}
