import SettingsModule from "../../../settings/settings-module";
import { FeatureIds } from "../../feature-ids";

export interface LevelsSettingsData {
  messageXp: number;
  messageCooldown: number; // milliseconds
  voiceXpPerMin: number;
  ignoredChannelIds: string[];
  announceChannelId: string | null;
}

/**
 * The levelling feature's settings, exposed through the generic settings
 * system. Values that were rows in `level_configs` now live under the
 * `levels.` key namespace in `guild_settings`.
 */
export const levelsSettings = new SettingsModule<LevelsSettingsData>({
  id: "levels",
  displayName: "Levelling",
  featureId: FeatureIds.Levels,
  defaults: {
    messageXp: 10,
    messageCooldown: 60_000,
    voiceXpPerMin: 5,
    ignoredChannelIds: [],
    announceChannelId: null,
  },
  descriptors: [
    { key: "messageXp", label: "Message XP", type: "number", default: 10, min: 1 },
    {
      key: "messageCooldown",
      label: "Message cooldown",
      description: "Minimum time between XP-granting messages",
      type: "duration",
      default: 60_000,
      min: 10_000,
    },
    { key: "voiceXpPerMin", label: "Voice XP per minute", type: "number", default: 5, min: 1 },
    {
      key: "ignoredChannelIds",
      label: "Ignored channels",
      description: "Channels that never grant XP; one per line",
      type: "string-list",
      default: [],
      format: ids => ids.map(id => `<#${id}>`).join(", ") || "None",
    },
    { key: "announceChannelId", label: "Announce channel", type: "channel", default: null },
  ],
});
