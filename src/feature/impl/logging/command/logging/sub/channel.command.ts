import Command, { type ExecuteContext } from "@/command/command";
import { channelOption, type CommandOptionBuilder } from "@/command/option";
import { loggingService } from "@/feature/impl/logging/logging.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { ChannelType } from "discord.js";

export default class ChannelCommand extends Command {
  constructor() {
    super({ id: "channel", displayName: "Set the channel logs are sent to" });
  }

  public override get options(): CommandOptionBuilder[] {
    return [channelOption(true, "channel", "The channel to send logs to")];
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const channel = args.channel("channel");
    if (!channel || typeof channel === "string" || channel.type !== ChannelType.GuildText) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Choose a text channel for logs.")
        )
      );
    }
    await loggingService.setChannelId(guild, channel.id);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("📔 Logging Channel Set")
          .setDescription(`Logs will be sent to <#${channel.id}>.`),
      ],
    });
  }
}
