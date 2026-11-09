import { guildCount } from "@/cluster/cluster";
import { EventHandler } from "@/event/event-handler";
import BotReadyEvent from "@/event/events/bot-ready.event";
import type { Client } from "discord.js";
import { BotListManager } from "./bot-list";

const API_BASE_URL = "https://top.gg/api/v1";
const STATS_INTERVAL_MS = 30 * 60 * 1000;

export interface TopggOptions {
  /** The top.gg API token from the bot's dashboard. */
  readonly token: string;
  /** Milliseconds between statistics pushes. Default 1_800_000. */
  readonly intervalMs?: number;
}

export class TopggManager extends BotListManager {
  public constructor(options: TopggOptions) {
    super(
      {
        name: "top.gg",
        baseUrl: API_BASE_URL,
        method: "PATCH",
        authorization: `Bearer ${options.token}`,
      },
      options.intervalMs ?? STATS_INTERVAL_MS
    );
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    await this.startPolling(event.client);
  }

  protected async statistics(client: Client): Promise<{ path: string; body: unknown } | null> {
    const servers = await guildCount(client);
    if (servers === null) {
      return null;
    }
    return {
      path: "/projects/@me/metrics",
      body: {
        server_count: servers,
        shard_count: client.cluster.info.TOTAL_SHARDS,
      },
    };
  }
}
