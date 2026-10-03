import Command, { type ExecuteContext } from "@/command/command";
import { channelOption, stringOption, type CommandOptionBuilder } from "@/command/option";
import { fetchYoutubeFeed, resolveYoutubeChannel } from "@/feature/impl/youtube/youtube-feed";
import { MAX_CHANNELS_PER_GUILD, YoutubeService } from "@/feature/impl/youtube/youtube.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { PermissionFlags } from "@/permission/permissions";
import type { GuildBasedChannel } from "discord.js";

/**
 * Track a YouTube channel and choose where its uploads are announced.
 * Re-adding an already tracked channel repoints its destination.
 */
export default class AddCommand extends Command {
  constructor() {
    super("add", "Track a YouTube channel");
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.YOUTUBE_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      stringOption(true, "channel", "YouTube channel id (UC...), @handle, or channel URL"),
      channelOption(true, "discord_channel", "Where to announce new uploads"),
    ];
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const input = ctx.options.getString("channel", true);
    const destination = args.channel<GuildBasedChannel>("discord_channel");
    if (!destination || typeof destination === "string" || !destination.isSendable()) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Choose a channel I can send messages to.")
        )
      );
    }

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

    const alreadyTracked = (await YoutubeService.getDestination(guild.id, youtubeChannelId)) !== undefined;
    if (!alreadyTracked && (await YoutubeService.countForGuild(guild.id)) >= MAX_CHANNELS_PER_GUILD) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `This server already tracks the maximum of **${MAX_CHANNELS_PER_GUILD}** channels.`
          )
        )
      );
    }

    try {
      const feed = await fetchYoutubeFeed(youtubeChannelId);
      const displayName = feed.parsed?.channelName || youtubeChannelId;
      await YoutubeService.addSubscription(guild.id, youtubeChannelId, displayName, input, destination.id);
      if (!alreadyTracked) {
        await YoutubeService.seedLastVideoIfUnset(youtubeChannelId, feed.parsed?.videos[0]?.videoId ?? null, {
          etag: feed.etag,
          lastModified: feed.lastModified,
        });
      }
      return ctx.reply({
        embeds: [
          baseEmbed(commandName)
            .setTitle("📺 YouTube Channel Tracked")
            .setDescription(
              `${alreadyTracked ? "Updated" : "Now tracking"} **${displayName}**.\n` +
                `New uploads will be announced in <#${destination.id}>.`
            ),
        ],
      });
    } catch (error) {
      console.error(`Failed to add YouTube channel ${youtubeChannelId}:`, error);
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            "I couldn't reach that channel's feed. Check the input, or try again later."
          )
        )
      );
    }
  }
}
