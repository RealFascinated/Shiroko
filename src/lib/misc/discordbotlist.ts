import { EventHandler } from "@/event/event-handler";
import PostCommandLoadEvent from "@/event/events/post-command-load.event";
import { getVoiceConnection } from "@discordjs/voice";
import type { ApplicationCommandDataResolvable, Client } from "discord.js";
import { BotListManager, postBotList } from "./bot-list";

const API_BASE_URL = "https://discordbotlist.com/api/v1/bots";
const STATS_INTERVAL_MS = 60 * 60 * 1000;

export interface DiscordBotListOptions {
  /** The discordbotlist.com API token from the bot's dashboard. */
  readonly token: string;
  /** Milliseconds between statistics pushes. Default 3_600_000. */
  readonly intervalMs?: number;
}

export class DiscordBotListManager extends BotListManager {
  public constructor(options: DiscordBotListOptions) {
    super(
      {
        name: "discordbotlist.com",
        baseUrl: API_BASE_URL,
        method: "POST",
        authorization: options.token,
      },
      options.intervalMs ?? STATS_INTERVAL_MS
    );
  }

  @EventHandler(PostCommandLoadEvent)
  public async onPostCommandLoad(event: PostCommandLoadEvent): Promise<void> {
    await this.pushCommands(event.client, event.commands);
    await this.startPolling(event.client);
  }

  /**
   * Publish the slash and context menu command set so the listing matches
   * what users can invoke in Discord.
   */
  public async pushCommands(
    client: Client,
    commands: readonly ApplicationCommandDataResolvable[]
  ): Promise<void> {
    const botId = client.user?.id;
    if (!botId) {
      return;
    }
    // Slash builders serialize through their own toJSON while context menu
    // commands are plain objects, so JSON.stringify emits the exact body
    // Discord received.
    await postBotList(this.api, `/${botId}/commands`, commands);
  }

  protected statistics(client: Client): { path: string; body: unknown } | null {
    const botId = client.user?.id;
    if (!botId) {
      return null;
    }
    let voiceConnections = 0;
    for (const guild of client.guilds.cache.values()) {
      if (getVoiceConnection(guild.id)) {
        voiceConnections++;
      }
    }
    return {
      path: `/${botId}/stats`,
      body: {
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        voice_connections: voiceConnections,
      },
    };
  }
}
