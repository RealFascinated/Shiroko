import type { LevelConfig } from "../../../levels.service";

/**
 * Compose the "current config" summary lines shared by `/level-config`
 * `view` and every settings subcommand's confirmation reply.
 */
export function configSummaryLines(config: LevelConfig): string[] {
  return [
    `Message XP: **${config.messageXp}** (cooldown **${config.messageCooldownSeconds}s**)`,
    `Voice XP: **${config.voiceXpPerMin}**/min`,
    `Ignored channels: ${
      config.ignoredChannelIds.length === 0
        ? "none"
        : config.ignoredChannelIds.map(id => `<#${id}>`).join(", ")
    }`,
    `Announce channel: ${config.announceChannelId ? `<#${config.announceChannelId}>` : "none"}`,
  ];
}
