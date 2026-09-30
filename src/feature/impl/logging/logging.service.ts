import { Cache } from "@/cache/cache";
import { Caches } from "@/cache/index";
import { guildKey } from "@/cache/key";
import { db } from "@/db";
import { logsSchema } from "@/db/schemas/logs";
import { TimeUnit } from "@/lib/time";
import GuildSettings from "@/settings/guild-settings";
import type { Guild } from "discord.js";
import { and, eq } from "drizzle-orm";
import type { LogType } from "./log-type";

/**
 * The logging feature's state: the shared channel and the per-log-type
 * toggles. Backs both the `/logging` command and the feature's event
 * pipeline, so the command reads and the pipeline reads see the same
 * authoritative cache.
 */
export default class LoggingService {
  /**
   * Per-guild enabled state keyed by log type. Authoritative: `setEnabled`
   * invalidates, and guild leave purges it through the cache registry.
   */
  private readonly enabledCache = Caches.register(
    new Cache<boolean>({
      name: "logging",
      mode: "authoritative",
      ttlMs: TimeUnit.toMillis(TimeUnit.Minute, 30),
    })
  );

  /** The channel logs are sent to, or `null` when unset. */
  public async getChannelId(guild: Guild): Promise<string | null> {
    const raw = await GuildSettings.get(guild.id, "logs.channelId");
    return typeof raw === "string" ? raw : null;
  }

  public async setChannelId(guild: Guild, channelId: string): Promise<void> {
    await GuildSettings.set(guild.id, "logs.channelId", channelId);
  }

  /**
   * Whether a log type is enabled for a guild. Absence of a row means the
   * log type is off.
   */
  public async isEnabled(guild: Guild, logType: LogType): Promise<boolean> {
    return this.enabledCache.load(guildKey(guild.id, logType), async () => {
      const rows = await db
        .select({ enabled: logsSchema.enabled })
        .from(logsSchema)
        .where(and(eq(logsSchema.guildId, guild.id), eq(logsSchema.logType, logType)));
      return rows[0]?.enabled ?? false;
    });
  }

  /**
   * Enable or disable one log type for a guild, invalidating its cached
   * state so the next event sees the new value.
   */
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
}

export const loggingService = new LoggingService();
