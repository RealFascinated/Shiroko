import Command, { type ExecuteContext } from "@/command/command";
import { stringOption, type CommandOptionBuilder } from "@/command/option";
import { resolveYoutubeChannel } from "@/feature/impl/youtube/youtube-feed";
import { YoutubeService } from "@/feature/impl/youtube/youtube.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { PermissionFlags } from "@/permission/permissions";

export default class RemoveCommand extends Command {
  constructor() {
    super("remove", "Stop tracking a YouTube channel");
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.YOUTUBE_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [stringOption(true, "channel", "YouTube channel id (UC...), @handle, or channel URL")];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const input = ctx.options.getString("channel", true);
    const youtubeChannelId = await resolveYoutubeChannel(input).catch(() => null);
    if (!youtubeChannelId) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            "I couldn't find that channel. Give me a `UC...` id, an `@handle`, or a channel URL."
          )
        )
      );
    }

    const removed = await YoutubeService.removeSubscription(guild.id, youtubeChannelId);
    if (!removed) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("This server isn't tracking that channel.")
        )
      );
    }
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("📺 YouTube Channel Removed")
          .setDescription(`No longer announcing **${removed.displayName}**.`),
      ],
    });
  }
}
