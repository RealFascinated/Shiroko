import { EventHandler } from "@/event/event-handler";
import BotReadyEvent from "@/event/events/bot-ready.event";
import type { Client } from "discord.js";
import { BotListManager } from "./bot-list";

const API_BASE_URL = "https://topbot.gg/api/v1/bots";
const STATS_INTERVAL_MS = 30 * 60 * 1000;

export interface TopbotOptions {
  /** The topbot.gg API token from the bot's dashboard. */
  readonly token: string;
  /** Milliseconds between statistics pushes. Default 1_800_000. */
  readonly intervalMs?: number;
}

export class TopbotManager extends BotListManager {
  public constructor(options: TopbotOptions) {
    super(
      {
        name: "topbot.gg",
        baseUrl: API_BASE_URL,
        method: "POST",
        authorization: `Bearer ${options.token}`,
      },
      options.intervalMs ?? STATS_INTERVAL_MS
    );
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    await this.startPolling(event.client);
  }

  protected statistics(client: Client): { path: string; body: unknown } | null {
    const botId = client.user?.id;
    if (!botId) {
      return null;
    }
    return {
      path: `/${botId}/stats`,
      body: {
        serverCount: client.guilds.cache.size,
        shardCount: client.shard?.count ?? 1,
      },
    };
  }
}
