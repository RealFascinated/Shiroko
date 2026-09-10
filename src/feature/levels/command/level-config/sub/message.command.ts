import Command, { type ExecuteContext } from "../../../../../command/command";
import { integerOption, type CommandOptionBuilder } from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { PermissionFlags } from "../../../../../permission/permissions";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./view.command";

/**
 * Tune the message XP rate and the cooldown between XP-granting messages.
 * The cooldown floor of 10s keeps the system from being trivially
 * farmable with a 0s window.
 */
export default class MessageCommand extends Command {
  constructor() {
    super("message", "Set message XP and cooldown");
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_CONFIG_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      integerOption(false, "xp", "XP earned per eligible message"),
      integerOption(false, "cooldown", "Minimum seconds between XP-granting messages (10+)", 10),
    ];
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const updates: { messageXp?: number; messageCooldownSeconds?: number } = {};

    const messageXp = ctx.options.getInteger("xp");
    if (messageXp !== null) {
      if (messageXp < 1) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Message XP must be at least 1.")
          )
        );
      }
      updates.messageXp = messageXp;
    }

    const cooldown = ctx.options.getInteger("cooldown");
    if (cooldown !== null) {
      // A floor of 10s prevents a cooldown of 0; with no cooldown, every
      // message grants XP and the system is trivially farmable.
      if (cooldown < 10) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Cooldown must be at least 10 seconds.")
          )
        );
      }
      updates.messageCooldownSeconds = cooldown;
    }

    const config = await levelsService.setConfig(guild.id, updates);
    const embed = baseEmbed(commandName)
      .setTitle("💬 Message XP Updated")
      .setDescription(
        `**Message XP:** **${config.messageXp}** (cooldown **${config.messageCooldownSeconds}s**).\n${configSummaryLines(config).join("\n")}`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
