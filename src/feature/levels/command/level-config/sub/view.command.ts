import Command, { type ExecuteContext } from "../../../../../command/command";
import { baseEmbed } from "../../../../../lib/embed";
import { levelsService, type LevelConfig } from "../../../levels.service";

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

/**
 * Show the guild's current levelling configuration as a result card.
 */
export default class ViewCommand extends Command {
  constructor() {
    super("view", "Show the current levelling config");
  }

  public override get requiredFlags(): bigint {
    return 0n;
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const config = await levelsService.getConfig(guild.id);
    const embed = baseEmbed(commandName)
      .setTitle("⚙️ Levelling Config")
      .setDescription(configSummaryLines(config).join("\n"));
    return ctx.reply({ embeds: [embed] });
  }
}
