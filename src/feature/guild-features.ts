import type { Guild } from "discord.js";
import { and, eq } from "drizzle-orm";
import { Cache } from "../cache/cache";
import { Caches } from "../cache/index";
import { guildKey } from "../cache/key";
import { db } from "../db/index";
import { guildFeatures } from "../db/schemas/guild-features";
import Feature from "./feature";
import type { FeatureIds } from "./feature-ids";

export default class GuildFeatures {
  private static readonly CACHE = Caches.register(
    new Cache<boolean>({ name: "guild-features", mode: "authoritative" })
  );

  /**
   * Whether `featureId` is enabled in `guild`. Stored rows override the
   * feature default; missing rows fall back to it.
   */
  public static async isFeatureEnabled(guild: Guild, featureId: FeatureIds): Promise<boolean> {
    return GuildFeatures.CACHE.load(guildKey(guild.id, featureId), async () => {
      const [row] = await db
        .select()
        .from(guildFeatures)
        .where(and(eq(guildFeatures.guildId, guild.id), eq(guildFeatures.featureId, featureId)));
      if (row !== undefined) {
        return row.enabled;
      }
      return Feature.get(featureId)?.options.defaultEnabled ?? true;
    });
  }

  /**
   * Persist an explicit per-guild toggle for `featureId`.
   */
  public static async setFeatureEnabled(
    guild: Guild,
    featureId: FeatureIds,
    enabled: boolean
  ): Promise<boolean> {
    const [row] = await db
      .insert(guildFeatures)
      .values({ guildId: guild.id, featureId, enabled })
      .onConflictDoUpdate({
        target: [guildFeatures.guildId, guildFeatures.featureId],
        set: { enabled },
      })
      .returning();
    const value = row?.enabled ?? enabled;
    GuildFeatures.CACHE.set(guildKey(guild.id, featureId), value);
    return value;
  }
}
