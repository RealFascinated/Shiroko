import type { Guild } from "discord.js";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { guildFeatures } from "../db/schema";
import Feature from "./feature";
import type { FeatureIds } from "./feature-ids";

export default class GuildFeatures {
  private static CACHE = new Map<string, boolean>();

  /**
   * Whether `featureId` is enabled in `guild`. Stored rows override the
   * feature default; missing rows fall back to it.
   */
  public static async isFeatureEnabled(guild: Guild, featureId: FeatureIds): Promise<boolean> {
    const guildId = guild.id;
    const key = `${guildId}:${featureId}`;
    const cached = GuildFeatures.CACHE.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const [row] = await db
      .select()
      .from(guildFeatures)
      .where(and(eq(guildFeatures.guildId, guildId), eq(guildFeatures.featureId, featureId)));
    if (row !== undefined) {
      GuildFeatures.CACHE.set(key, row.enabled);
      return row.enabled;
    }
    return Feature.get(featureId)?.options.defaultEnabled ?? true;
  }

  /**
   * Persist an explicit per-guild toggle for `featureId`.
   */
  public static async setFeatureEnabled(
    guild: Guild,
    featureId: FeatureIds,
    enabled: boolean
  ): Promise<boolean> {
    const guildId = guild.id;
    const [row] = await db
      .insert(guildFeatures)
      .values({ guildId, featureId, enabled })
      .onConflictDoUpdate({
        target: [guildFeatures.guildId, guildFeatures.featureId],
        set: { enabled },
      })
      .returning();
    const value = row?.enabled ?? enabled;
    GuildFeatures.CACHE.set(`${guildId}:${featureId}`, value);
    return value;
  }

  /**
   * Drop cached toggles for one guild, one feature, or everything.
   */
  public static clearCache(guildId?: string, featureId?: FeatureIds): void {
    if (guildId === undefined && featureId === undefined) {
      GuildFeatures.CACHE.clear();
      return;
    }
    for (const key of GuildFeatures.CACHE.keys()) {
      if (guildId !== undefined && !key.startsWith(`${guildId}:`)) {
        continue;
      }
      if (featureId !== undefined && !key.endsWith(`:${featureId}`)) {
        continue;
      }
      GuildFeatures.CACHE.delete(key);
    }
  }
}
