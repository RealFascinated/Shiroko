import { Cache } from "@/cache/cache";
import { Caches } from "@/cache/index";
import { guildKey } from "@/cache/key";
import { db } from "@/db";
import { logsSchema } from "@/db/schemas/logs";
import { TimeUnit } from "@/lib/time";
import GuildSettings from "@/settings/guild-settings";
import type { Guild } from "discord.js";
import { and, eq } from "drizzle-orm";
import { logTypes, type LogType } from "./log-type";

export default class LoggingService {
  private readonly enabledCache = Caches.register(
    new Cache<boolean>({
      name: "logging",
      mode: "authoritative",
      ttlMs: TimeUnit.toMillis(TimeUnit.Minute, 30),
    })
  );

  public async getChannelId(guild: Guild): Promise<string | null> {
    const raw = await GuildSettings.get(guild.id, "logs.channelId");
    return typeof raw === "string" ? raw : null;
  }

  public async setChannelId(guild: Guild, channelId: string): Promise<void> {
    await GuildSettings.set(guild.id, "logs.channelId", channelId);
  }

  public async isEnabled(guild: Guild, logType: LogType): Promise<boolean> {
    return this.enabledCache.load(guildKey(guild.id, logType), async () => {
      const rows = await db
        .select({ enabled: logsSchema.enabled })
        .from(logsSchema)
        .where(and(eq(logsSchema.guildId, guild.id), eq(logsSchema.logType, logType)));
      return rows[0]?.enabled ?? false;
    });
  }

  public async setEnabled(guild: Guild, logType: LogType, enabled: boolean): Promise<void> {
    await db
      .insert(logsSchema)
      .values({ guildId: guild.id, logType, enabled })
      .onConflictDoUpdate({
        target: [logsSchema.guildId, logsSchema.logType],
        set: { enabled },
      });
    this.enabledCache.invalidate(guildKey(guild.id, logType));
  }

  /**
   * A guild's logging configuration: the target channel and every log
   * type's enabled state, read from the same authoritative cache the
   * event pipeline uses.
   */
  public async info(
    guild: Guild
  ): Promise<{ channelId: string | null; states: Array<{ logType: LogType; enabled: boolean }> }> {
    const [channelId, states] = await Promise.all([
      this.getChannelId(guild),
      Promise.all(
        (Object.keys(logTypes) as LogType[]).map(async logType => ({
          logType,
          enabled: await this.isEnabled(guild, logType),
        }))
      ),
    ]);
    return { channelId, states };
  }
}

export const loggingService = new LoggingService();
