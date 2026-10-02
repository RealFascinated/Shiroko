import type { Guild } from "discord.js";
import { and, eq } from "drizzle-orm";
import { Cache } from "../cache/cache";
import { Caches } from "../cache/index";
import { guildKey } from "../cache/key";
import { db } from "../db/index";
import { guildFeaturesSchema } from "../db/schemas/guild-features";
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
    // A non-toggleable feature is always on; no stored row can
    // disable it.
    if (Feature.get(featureId)?.toggleable === false) {
      return true;
    }
    return GuildFeatures.CACHE.load(guildKey(guild.id, featureId), async () => {
      const [row] = await db
        .select()
        .from(guildFeaturesSchema)
        .where(and(eq(guildFeaturesSchema.guildId, guild.id), eq(guildFeaturesSchema.featureId, featureId)));
      if (row !== undefined) {
        return row.enabled;
      }
      return Feature.get(featureId)?.options.defaultEnabled ?? true;
    });
  }

  public static async setFeatureEnabled(
    guild: Guild,
    featureId: FeatureIds,
    enabled: boolean
  ): Promise<boolean> {
    const [row] = await db
      .insert(guildFeaturesSchema)
      .values({ guildId: guild.id, featureId, enabled })
      .onConflictDoUpdate({
        target: [guildFeaturesSchema.guildId, guildFeaturesSchema.featureId],
        set: { enabled },
      })
      .returning();
    const value = row?.enabled ?? enabled;
    GuildFeatures.CACHE.set(guildKey(guild.id, featureId), value);
    return value;
  }
}
