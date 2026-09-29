import { getVoiceConnection } from "@discordjs/voice";
import type { ApplicationCommandDataResolvable, Client } from "discord.js";
import { count } from "drizzle-orm";
import { db } from "@/db/index";
import { globalUsers } from "@/db/schemas/global-users";
import { EventBus } from "@/event/event-bus";
import { EventHandler } from "@/event/event-handler";
import { EventListener } from "@/event/event-listener";
import PostCommandLoadEvent from "@/event/events/post-command-load.event";

const API_BASE_URL = "https://discordbotlist.com/api/v1/bots";
const STATS_INTERVAL_MS = 60 * 60 * 1000;

export interface DiscordBotListOptions {
  /** The discordbotlist.com API token from the bot's dashboard. */
  readonly token: string;
  /** Milliseconds between statistics pushes. Default 3_600_000. */
  readonly intervalMs?: number;
}

/**
 * Mirrors the bot onto discordbotlist.com: publishes the command set once
 * the Discord sync succeeds, then keeps guild, user and voice connection
 * counts fresh on a timer.
 */
export class DiscordBotListManager extends EventListener {
  private readonly token: string;
  private readonly intervalMs: number;
  private timer: Timer | undefined;

  public constructor(options: DiscordBotListOptions) {
    super();
    this.token = options.token;
    this.intervalMs = options.intervalMs ?? STATS_INTERVAL_MS;
    EventBus.subscribe(this);
  }

  @EventHandler(PostCommandLoadEvent)
  public async onPostCommandLoad(event: PostCommandLoadEvent): Promise<void> {
    await this.pushCommands(event.client, event.commands);
    clearInterval(this.timer);
    await this.pushStatistics(event.client);
    this.timer = setInterval(() => void this.pushStatistics(event.client), this.intervalMs);
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
    await this.post(`/${botId}/commands`, commands);
  }

  /**
   * Publish the guild, user and active voice connection counts.
   */
  public async pushStatistics(client: Client): Promise<void> {
    const botId = client.user?.id;
    if (!botId) {
      return;
    }
    const [row] = await db.select({ count: count() }).from(globalUsers);
    let voiceConnections = 0;
    for (const guild of client.guilds.cache.values()) {
      if (getVoiceConnection(guild.id)) {
        voiceConnections++;
      }
    }
    await this.post(`/${botId}/stats`, {
      guilds: client.guilds.cache.size,
      users: row?.count ?? 0,
      voice_connections: voiceConnections,
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
          Authorization: this.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(
          `discordbotlist.com push to ${path} failed: ${res.status} ${res.statusText} ${await res.text().catch(() => "")}`
        );
      }
    } catch (error) {
      console.error(`discordbotlist.com push to ${path} failed:`, error);
    }
  }
}
