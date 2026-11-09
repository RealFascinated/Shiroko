import { EventBus } from "@/event/event-bus";
import { EventListener } from "@/event/event-listener";
import type { Client } from "discord.js";
import { FETCH_TIMEOUT_MS } from "../fetch";

/** What one bot listing site needs to receive a request. */
export interface BotListApi {
  /** Used in log lines, e.g. "top.gg". */
  readonly name: string;
  readonly baseUrl: string;
  readonly method: "POST" | "PATCH";
  /** The full `Authorization` header value. */
  readonly authorization: string;
}

/**
 * Send one request to a bot listing, logging instead of throwing so a failed
 * publish never breaks the caller.
 */
export async function postBotList(api: BotListApi, path: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(`${api.baseUrl}${path}`, {
      method: api.method,
      headers: {
        Authorization: api.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(
        `${api.name} push to ${path} failed: ${res.status} ${res.statusText} ${await res.text().catch(() => "")}`
      );
    }
  } catch (error) {
    console.error(`${api.name} push to ${path} failed:`, error);
  }
}

/**
 * Publishes statistics to one bot listing on a fixed interval. Subclasses
 * supply the site's API and the request its statistics make; the arming and
 * the failed-publish handling are shared.
 */
export abstract class BotListManager extends EventListener {
  protected readonly api: BotListApi;
  protected readonly intervalMs: number;
  private timer: Timer | undefined;

  protected constructor(api: BotListApi, intervalMs: number) {
    super();
    this.api = api;
    this.intervalMs = intervalMs;
    EventBus.subscribe(this);
  }

  /** The statistics request for `client`, or null when it cannot be built yet. */
  protected abstract statistics(client: Client): { path: string; body: unknown } | null;

  protected async pushStatistics(client: Client): Promise<void> {
    const request = this.statistics(client);
    if (!request) {
      return;
    }
    await postBotList(this.api, request.path, request.body);
  }

  /** Push once now, then on the interval; a second start replaces the timer. */
  protected async startPolling(client: Client): Promise<void> {
    clearInterval(this.timer);
    await this.pushStatistics(client);
    this.timer = setInterval(() => void this.pushStatistics(client), this.intervalMs);
  }
}
