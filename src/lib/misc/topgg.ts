import { EventBus } from "@/event/event-bus";
import { EventHandler } from "@/event/event-handler";
import { EventListener } from "@/event/event-listener";
import BotReadyEvent from "@/event/events/bot-ready.event";
import type { Client } from "discord.js";

const API_BASE_URL = "https://top.gg/api/v1";
const STATS_INTERVAL_MS = 30 * 60 * 1000;

export interface TopggOptions {
  /** The top.gg API token from the bot's dashboard. */
  readonly token: string;
  /** Milliseconds between statistics pushes. Default 1_800_000. */
  readonly intervalMs?: number;
}

export class TopggManager extends EventListener {
  private readonly token: string;
  private readonly intervalMs: number;
  private timer: Timer | undefined;

  public constructor(options: TopggOptions) {
    super();
    this.token = options.token;
    this.intervalMs = options.intervalMs ?? STATS_INTERVAL_MS;
    EventBus.subscribe(this);
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    clearInterval(this.timer);
    await this.pushStatistics(event.client);
    this.timer = setInterval(() => void this.pushStatistics(event.client), this.intervalMs);
  }

  /**
   * Publish the server and shard counts. The token identifies the project,
   * so `@me` stands in for the project id.
   */
  public async pushStatistics(client: Client): Promise<void> {
    await this.patch("/projects/@me/metrics", {
      server_count: client.guilds.cache.size,
      shard_count: client.shard?.count ?? 1,
    });
  }

  /**
   * PATCH `body` to a top.gg endpoint, logging instead of throwing so a
   * failed publish never breaks the caller.
   */
  private async patch(path: string, body: unknown): Promise<void> {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(
          `top.gg push to ${path} failed: ${res.status} ${res.statusText} ${await res.text().catch(() => "")}`
        );
      }
    } catch (error) {
      console.error(`top.gg push to ${path} failed:`, error);
    }
  }
}
