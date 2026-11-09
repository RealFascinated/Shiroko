import type { HistoryActor } from "@/history/history-writer";
import type { Guild } from "discord.js";
import { getFeatureMetadata } from "./feature-metadata";
import { featureSettings } from "./feature-settings";
import type { FeatureId, FeatureIds } from "./feature-ids";

export default class GuildFeatures {
  /**
   * Whether `featureId` is enabled in `guild`. Stored rows override the
   * feature default; missing rows fall back to it.
   */
  public static async isFeatureEnabled(guild: Guild, featureId: FeatureIds): Promise<boolean> {
    // A non-toggleable feature is always on; no stored row can
    // disable it.
    if (getFeatureMetadata(featureId)?.toggleable === false) {
      return true;
    }
    return featureSettings().get(guild.id, `enabled.${`${featureId}` as FeatureId}`);
  }

  public static async setFeatureEnabled(
    guild: Guild,
    featureId: FeatureIds,
    enabled: boolean,
    userId: string
  ): Promise<boolean> {
    const actor: HistoryActor = { guild, userId };
    await featureSettings().set(guild.id, `enabled.${`${featureId}` as FeatureId}`, enabled, actor);
    return enabled;
  }
}
