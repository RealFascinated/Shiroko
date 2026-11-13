import { FeatureIds } from "@/feature/feature-ids";
import SettingsModule from "@/settings/settings-module";
import { levelUpPlaceholders } from "./level-up-placeholders";

export interface LevelReward {
  type: string;
  roleId: string | null;
}

export interface LevelsSettingsData {
  messageXpMin: number;
  messageXpMax: number;
  messageCooldownMs: number;
  ignoredChannelIds: string[];
  announceChannelId: string | null;
  announceMode: string;
  levelUpMessage: string;
  rewards: Record<number, LevelReward>;
}

/**
 * The levelling feature's settings, exposed through the generic settings
 * system. Values that were rows in `level_configs` now live under the
 * `levels.` key namespace in `guild_settings`, and `level_rewards` rows
 * live under `levels.rewards.<level>`.
 */
export const levelsSettings = new SettingsModule<LevelsSettingsData>({
  id: "levels",
  displayName: "Levelling",
  featureId: FeatureIds.Levels,
  descriptors: [
    {
      key: "messageXpMin",
      label: "Message XP (min)",
      description: "Each XP-granting message rolls a random amount between min and max.",
      type: "number",
      default: 15,
      min: 1,
    },
    { key: "messageXpMax", label: "Message XP (max)", type: "number", default: 25, min: 1 },
    {
      key: "messageCooldownMs",
      label: "Message cooldown",
      description: "Minimum time between XP-granting messages.",
      type: "duration",
      default: 60_000,
      min: 10_000,
    },
    {
      key: "ignoredChannelIds",
      label: "Ignored channels",
      description: "Channels or categories that never grant XP, including their threads. One per line.",
      type: "string-list",
      default: [],
      format: ids => ids.map(id => `<#${id}>`).join(", "),
    },
    { key: "announceChannelId", label: "Announce channel", type: "channel", default: null },
    {
      key: "announceMode",
      label: "Announce mode",
      description: "Message sends only the text; card adds a level-up card image.",
      type: "choice",
      default: "card",
      choices: { message: "Message", card: "Card" },
    },
    {
      key: "levelUpMessage",
      label: "Level-up message",
      description: "Announced when a member levels up.",
      type: "string",
      default: "**{user_mention}** reached **level {level}**!",
      placeholders: levelUpPlaceholders,
    },
    {
      key: "rewards",
      label: "Level rewards",
      description: "Roles granted when a member reaches a level.",
      type: "map",
      default: {},
      keyLabel: "Level",
      validateKey: key => (/^[1-9]\d{0,5}$/.test(key) ? null : "Level must be a whole number of at least 1."),
      entry: {
        type: "group",
        label: "Reward",
        default: { type: "Role", roleId: null },
        fields: [
          { key: "type", label: "Type", type: "string", default: "Role" },
          { key: "roleId", label: "Role", type: "role", default: null },
        ],
      },
    },
  ],
});
