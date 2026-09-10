import Command, { type ExecuteContext } from "../../../../../command/command";
import { integerOption, type CommandOptionBuilder } from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./config-helpers";

/**
 * Set the XP earned per eligible message.
 */
export default class MessageXpCommand extends Command {
  constructor() {
    super("message-xp", "Set XP per eligible message");
  }

  public override get options(): CommandOptionBuilder[] {
    return [integerOption(true, "xp", "XP earned per eligible message")];
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const messageXp = ctx.options.getInteger("xp", true)!;
    if (messageXp < 1) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Message XP must be at least 1.")
        )
      );
    }
    const config = await levelsService.setConfig(guild.id, { messageXp });
    const embed = baseEmbed(commandName)
      .setTitle("💬 Message XP Updated")
      .setDescription(
        `**Message XP** is now **${config.messageXp}**.\n${configSummaryLines(config).join("\n")}`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
