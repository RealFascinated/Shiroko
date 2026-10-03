import { FeatureIds } from "@/feature/feature-ids";
import GuildFeatures from "@/feature/guild-features";
import type { Client, Guild } from "discord.js";
import { youtubePlaceholders } from "./youtube-placeholders";
import { youtubeSettings } from "./youtube-settings";
import type { YoutubeDestination } from "./youtube.service";

/** Discord's hard cap on a message body; announcements are plain text, not embeds. */
const MAX_CONTENT = 2000;

export interface UploadAnnouncement {
  channelName: string;
  videoId: string;
  videoTitle: string;
}

/**
 * Post one upload to the destinations the poll cycle already resolved.
 * Returns the number of destinations reached, which is what marks the upload
 * as `posted`; a destination that vanished or is silent is logged and skipped,
 * never fatal.
 */
export async function announceUpload(
  client: Client,
  destinations: readonly YoutubeDestination[],
  announcement: UploadAnnouncement
): Promise<number> {
  let delivered = 0;
  for (const destination of destinations) {
    try {
      const guild = client.guilds.cache.get(destination.guildId);
      if (!guild) {
        continue;
      }
      if (await send(guild, destination.discordChannelId, announcement)) {
        delivered++;
      }
    } catch (error) {
      console.error(`YouTube announce failed for ${announcement.videoId} in ${destination.guildId}:`, error);
    }
  }
  return delivered;
}

async function send(
  guild: Guild,
  discordChannelId: string,
  announcement: UploadAnnouncement
): Promise<boolean> {
  const channel =
    guild.channels.cache.get(discordChannelId) ??
    (await guild.channels.fetch(discordChannelId).catch(() => null));
  if (!channel || !channel.isSendable()) {
    console.error(`YouTube destination ${discordChannelId} is not sendable in ${guild.id}`);
    return false;
  }
  if (!(await GuildFeatures.isFeatureEnabled(guild, FeatureIds.Youtube))) {
    return false;
  }
  const template = await youtubeSettings.get(guild.id, "message");
  const content = (
    await youtubePlaceholders.replace(
      {
        channelName: announcement.channelName,
        videoTitle: announcement.videoTitle,
        videoLink: `https://www.youtube.com/watch?v=${announcement.videoId}`,
      },
      template
    )
  ).slice(0, MAX_CONTENT);
  await channel.send({ content });
  return true;
}
