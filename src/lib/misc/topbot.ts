import { EventBus } from "@/event/event-bus";
import { EventHandler } from "@/event/event-handler";
import { EventListener } from "@/event/event-listener";
import PostCommandLoadEvent from "@/event/events/post-command-load.event";
import type { Client } from "discord.js";

const API_BASE_URL = "https://topbot.gg/api/v1/bots";
const STATS_INTERVAL_MS = 30 * 60 * 1000;

export interface TopbotOptions {
  /** The topbot.gg API token from the bot's dashboard. */
  readonly token: string;
  /** Milliseconds between statistics pushes. Default 1_800_000. */
  readonly intervalMs?: number;
}

/**
 * Mirrors the bot onto topbot.gg: keeps the guild and shard counts fresh
 * on a timer once the application command sync succeeds.
 */
export class TopbotManager extends EventListener {
  private readonly token: string;
  private readonly intervalMs: number;
  private timer: Timer | undefined;

  public constructor(options: TopbotOptions) {
    super();
    this.token = options.token;
    this.intervalMs = options.intervalMs ?? STATS_INTERVAL_MS;
    EventBus.subscribe(this);
  }

  @EventHandler(PostCommandLoadEvent)
  public async onPostCommandLoad(event: PostCommandLoadEvent): Promise<void> {
    clearInterval(this.timer);
    await this.pushStatistics(event.client);
    this.timer = setInterval(() => void this.pushStatistics(event.client), this.intervalMs);
  }

  /**
   * Publish the guild and shard counts.
   */
  public async pushStatistics(client: Client): Promise<void> {
    const botId = client.user?.id;
    if (!botId) {
      return;
    }
    await this.post(`/${botId}/stats`, {
      serverCount: client.guilds.cache.size,
      shardCount: client.shard?.count ?? 1,
    });
  }

  /**
   * POST `body` to a bot endpoint, logging instead of throwing so a failed
   * publish never breaks the caller.
   */
  private async post(path: string, body: unknown): Promise<void> {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(
          `topbot.gg push to ${path} failed: ${res.status} ${res.statusText} ${await res.text().catch(() => "")}`
        );
      }
    } catch (error) {
      console.error(`topbot.gg push to ${path} failed:`, error);
    }
  }
}
