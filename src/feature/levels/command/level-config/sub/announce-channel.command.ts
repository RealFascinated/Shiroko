import { ChannelType } from "discord.js";
import Command, { type ExecuteContext } from "../../../../../command/command";
import { channelOption, type CommandOptionBuilder } from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./config-helpers";

/**
 * Set where level-ups are announced, or clear the announcement channel.
 * Omitting the channel clears it.
 */
export default class AnnounceChannelCommand extends Command {
  constructor() {
    super("announce-channel", "Set or clear the level-up announce channel");
  }

  public override get options(): CommandOptionBuilder[] {
    return [channelOption(false, "channel", "Channel to announce level-ups in (omit to clear)")];
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const channel = ctx.options.getChannel("channel");
    if (channel) {
      const isText =
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement ||
        channel.type === ChannelType.PublicThread ||
        channel.type === ChannelType.PrivateThread;
      if (!isText) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Announce channel must be a text channel.")
          )
        );
      }
    }
    const config = await levelsService.setConfig(guild.id, {
      announceChannelId: channel ? channel.id : null,
    });
    const embed = baseEmbed(commandName)
      .setTitle("📣 Announce Channel Updated")
      .setDescription(
        `Level-ups will be announced in ${config.announceChannelId ? `<#${config.announceChannelId}>` : "no channel (announcements off)"}.\n${configSummaryLines(config).join("\n")}`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
