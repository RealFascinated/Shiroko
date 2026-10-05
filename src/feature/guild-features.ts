import type { Guild } from "discord.js";
import Feature from "./feature";
import type { FeatureId, FeatureIds } from "./feature-ids";
import { featureSettings } from "./feature-settings";

export default class GuildFeatures {
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
    return featureSettings().get(guild.id, `enabled.${`${featureId}` as FeatureId}`);
  }

  public static async setFeatureEnabled(
    guild: Guild,
    featureId: FeatureIds,
    enabled: boolean
  ): Promise<boolean> {
    await featureSettings().set(guild.id, `enabled.${`${featureId}` as FeatureId}`, enabled);
    return enabled;
  }
}
